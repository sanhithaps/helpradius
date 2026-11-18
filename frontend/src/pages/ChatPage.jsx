import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket, useSocketEvent } from '../context/SocketContext';
import { useWebRTCCall } from '../hooks/useWebRTCCall';
import VoiceNoteRecorder from '../components/VoiceNoteRecorder';
import WebRTCCallOverlay from '../components/WebRTCCallOverlay';
import api from '../services/api';
import {
  Send,
  Phone,
  Image,
  Video,
  Camera,
  Loader2,
  Mic,
  MoreVertical,
  ShieldAlert,
  Check,
  CheckCheck,
  ArrowLeft,
  Lock,
  User
} from 'lucide-react';

export default function ChatPage() {
  const { id } = useParams(); // requestId
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [typingUser, setTypingUser] = useState(null);

  const webrtc = useWebRTCCall();

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // Initial load via REST
  const fetchChat = async () => {
    try {
      const res = await api.get(`/chats/${id}/messages`);
      setChat(res.data.chat);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.warn('Could not load chat messages', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChat();
  }, [id]);

  // Join Socket Request Room
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('request:join', { requestId: id });
    socket.emit('chat:read', { requestId: id });

    return () => {
      socket.emit('request:leave', { requestId: id });
    };
  }, [socket, id]);

  // Real-time Event: Incoming Message
  useSocketEvent('chat:message', (data) => {
    if (data.requestId === id) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
      // Mark read if it's from the other person
      if (data.message.senderId !== user?.id) {
        socket?.emit('chat:read', { requestId: id });
      }
    }
  });

  // Real-time Event: Typing Indicator
  useSocketEvent('chat:typing', (data) => {
    if (data.requestId === id && data.userId !== user?.id) {
      setTypingUser(data.isTyping ? data.userName : null);
    }
  });

  // Real-time Event: Messages Read
  useSocketEvent('chat:read', (data) => {
    if (data.requestId === id) {
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          readBy: Array.from(new Set([...(m.readBy || []), data.readerId]))
        }))
      );
    }
  });

  // Real-time Event: Request updated/locked
  useSocketEvent('request:updated', (data) => {
    if (data.request?.id === id && (data.request.status === 'completed' || data.request.status === 'cancelled')) {
      setChat((prev) => (prev ? { ...prev, active: false } : null));
    }
  });

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  const handleTyping = (text) => {
    setInputText(text);
    if (!socket) return;

    socket.emit('chat:typing', { requestId: id, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('chat:typing', { requestId: id, isTyping: false });
    }, 2000);
  };

  const handleSendMessage = async (customPayload) => {
    const payload = customPayload || { text: inputText };
    if (!payload.text && !payload.media) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket?.emit('chat:typing', { requestId: id, isTyping: false });

    // Try sending over socket for zero latency
    if (socket && isConnected) {
      socket.emit(
        'chat:send',
        {
          requestId: id,
          text: payload.text,
          type: payload.type || 'text',
          mediaUrl: payload.media?.url || null
        },
        (response) => {
          if (response?.error) {
            // Fallback to REST API if socket handler rejected
            api.post(`/chats/${id}/messages`, payload).catch(console.error);
          }
        }
      );
      setInputText('');
    } else {
      // Fallback to REST
      try {
        await api.post(`/chats/${id}/messages`, payload);
        setInputText('');
        fetchChat();
      } catch (e) {
        alert(e.response?.data?.message || 'Could not send message.');
      }
    }
  };

  const handleAudioReady = (audioItem) => {
    handleSendMessage({
      type: 'audio',
      text: 'Voice Note',
      media: audioItem
    });
    setShowVoiceRecorder(false);
  };

  const handleDeviceFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      alert(`File "${file.name}" exceeds the 50MB limit.`);
      if (e.target) e.target.value = '';
      return;
    }

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.file) {
        const uploaded = res.data.file;
        handleSendMessage({
          type: uploaded.type,
          text: uploaded.type === 'video' ? '🎥 Video message' : '📷 Photo message',
          media: uploaded
        });
      }
    } catch (err) {
      console.error('Failed to upload file from device', err);
      alert('Could not upload file from device. Please check format and try again.');
    } finally {
      setUploadingMedia(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleReport = async () => {
    const reason = prompt('Reason for reporting user (safety moderation):');
    if (!reason) return;
    try {
      await api.post(`/chats/${id}/report`, {
        reason,
        reportedUserId: chat?.participants?.find((p) => p !== user?.id)
      });
      alert('Report submitted to safety moderators. Thank you.');
      setMenuOpen(false);
    } catch (e) {
      alert('Could not submit report.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center text-xs font-bold text-slate-500">
        Loading encrypted chat...
      </div>
    );
  }

  const isLocked = chat && !chat.active;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[750px]">
        {/* Chat Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/requests/${id}`)}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white border border-slate-700">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">Assistance Chat</h3>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Real-Time Encrypted • Zero Phone Numbers Exposed</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isLocked && (
              <button
                onClick={() => webrtc.startCall(id, 'Connected Volunteer')}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 text-xs font-bold"
                title="In-App Voice Call (WebRTC)"
              >
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">Call</span>
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-300"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 w-44 bg-slate-800 rounded-xl shadow-xl py-1 text-xs border border-slate-700 z-30">
                  <button
                    onClick={handleReport}
                    className="w-full px-3 py-2 text-left text-rose-400 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Report User</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            const isSystem = msg.type === 'system';
            const isRead = msg.readBy && msg.readBy.length > 1;

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center my-2">
                  <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-600 text-[11px] font-semibold">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl p-3.5 space-y-1 shadow-sm ${
                    isMe
                      ? 'bg-rose-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-900 border border-slate-200 rounded-tl-none'
                  }`}
                >
                  <span className={`block text-[10px] font-bold ${isMe ? 'text-rose-200' : 'text-slate-500'}`}>
                    {msg.senderName}
                  </span>

                  {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}

                  {/* Photo Preview */}
                  {(msg.type === 'image' || msg.media?.type === 'image' || (msg.mediaUrl && !msg.mediaUrl.match(/\.(mp4|webm|mov|mkv)$/i))) && (
                    <div className="rounded-xl overflow-hidden mt-1.5 max-h-56 border border-black/10">
                      <img
                        src={msg.media?.url || msg.mediaUrl}
                        alt="Attached from device"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => window.open(msg.media?.url || msg.mediaUrl, '_blank')}
                      />
                    </div>
                  )}

                  {/* Video Player */}
                  {(msg.type === 'video' || msg.media?.type === 'video' || (msg.mediaUrl && msg.mediaUrl.match(/\.(mp4|webm|mov|mkv)$/i))) && (
                    <div className="rounded-xl overflow-hidden mt-1.5 max-h-64 border border-black/10 bg-black">
                      <video
                        controls
                        src={msg.media?.url || msg.mediaUrl}
                        className="w-full h-full max-h-64 rounded-xl"
                      />
                    </div>
                  )}

                  {/* Audio Note Player */}
                  {(msg.type === 'voice_note' || msg.type === 'audio' || msg.media?.type === 'audio') && (
                    <div className="pt-1">
                      <audio controls src={msg.media?.url || msg.mediaUrl} className="w-full h-8" />
                    </div>
                  )}

                  <div
                    className={`flex items-center justify-end gap-1 text-[9px] pt-1 ${
                      isMe ? 'text-rose-200' : 'text-slate-400'
                    }`}
                  >
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && (
                      isRead ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-300" title="Read" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-rose-200" title="Sent" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {typingUser && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 text-slate-500 text-xs px-3.5 py-2 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-200" />
                <span className="text-[11px] font-medium ml-1">{typingUser} is typing...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Reply Chips */}
        {!isLocked && (
          <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
            {["I'm on my way!", 'Where are you exactly?', 'I have reached the location.'].map((quick, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage({ text: quick })}
                className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap text-[11px] font-medium"
              >
                {quick}
              </button>
            ))}
          </div>
        )}

        {/* Voice Note Recorder Tray */}
        {showVoiceRecorder && (
          <div className="p-3 bg-white border-t border-slate-200">
            <VoiceNoteRecorder
              onAudioReady={handleAudioReady}
              onCancel={() => setShowVoiceRecorder(false)}
            />
          </div>
        )}

        {/* Hidden inputs for device media upload */}
        <input
          type="file"
          ref={photoInputRef}
          accept="image/*"
          onChange={handleDeviceFileUpload}
          className="hidden"
        />
        <input
          type="file"
          ref={videoInputRef}
          accept="video/*"
          onChange={handleDeviceFileUpload}
          className="hidden"
        />

        {uploadingMedia && (
          <div className="p-2.5 bg-amber-50 border-t border-amber-200 text-xs font-semibold text-amber-800 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <span>Uploading media from your device...</span>
          </div>
        )}

        {/* Composer Bar */}
        {!isLocked ? (
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingMedia}
              className="p-2.5 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
              title="Upload Photo from Device"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={uploadingMedia}
              className="p-2.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Upload Video from Device"
            >
              <Video className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
              disabled={uploadingMedia}
              className="p-2.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Record Voice Note"
            >
              <Mic className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type encrypted message..."
              className="flex-1 p-3 rounded-2xl bg-slate-100 border border-slate-200 text-sm outline-none focus:border-rose-500 font-medium"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={uploadingMedia}
              className="p-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white shadow-md active:scale-95 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-4 bg-slate-100 text-center text-xs text-slate-500 flex items-center justify-center gap-2 font-medium">
            <Lock className="w-4 h-4 text-slate-400" />
            <span>Assistance session has ended. Private chat is locked to protect user privacy.</span>
          </div>
        )}
      </div>

      <WebRTCCallOverlay
        callState={webrtc.callState}
        callInfo={webrtc.callInfo}
        isMuted={webrtc.isMuted}
        callDuration={webrtc.callDuration}
        errorMessage={webrtc.errorMessage}
        onAccept={webrtc.acceptCall}
        onDecline={webrtc.declineCall}
        onEnd={webrtc.endCall}
        onToggleMute={webrtc.toggleMute}
      />
    </div>
  );
}
