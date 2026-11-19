import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause, Loader2, Volume2, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export default function VoiceNoteRecorder({ onAudioReady, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0);
  const [recordedBytes, setRecordedBytes] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioBlobRef = useRef(null);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close(); } catch (e) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setErrorMessage(null);
    setAudioVolume(0);

    if (!navigator?.mediaDevices?.getUserMedia) {
      if (typeof window !== 'undefined' && !window.isSecureContext && window.location.protocol === 'http:') {
        setErrorMessage(`Microphone is restricted by browsers on plain HTTP (${window.location.host}). Please access via localhost or upload an audio file directly.`);
      } else {
        setErrorMessage('Microphone recording is not supported in this browser.');
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio volume visualizer via Web Audio API to prove microphone is working
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioVolume(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (visErr) {
        console.warn('Audio visualizer not supported, continuing recording:', visErr);
      }

      // Pick supported audio format
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
          try { audioCtxRef.current.close(); } catch (e) {}
        }
        setAudioVolume(0);

        const actualType = mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualType });
        audioBlobRef.current = audioBlob;
        setRecordedBytes(audioBlob.size);

        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Stop all audio tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      // Flush chunks every 250ms to ensure complete capture
      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordDuration(0);

      timerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied or unsupported:', err);
      setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser address bar.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleDiscard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordDuration(0);
    setIsRecording(false);
    setRecordedBytes(0);
    audioBlobRef.current = null;
    setErrorMessage(null);
    if (onCancel) onCancel();
  };

  const handleSend = async () => {
    if (!audioBlobRef.current) {
      setErrorMessage('No recorded audio available to send.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const blob = audioBlobRef.current;
      const ext = blob.type.includes('mp4') ? '.mp4' : (blob.type.includes('ogg') ? '.ogg' : (blob.type.includes('wav') ? '.wav' : '.webm'));
      const fileName = `voice_note_${Date.now()}${ext}`;

      const formData = new FormData();
      formData.append('file', blob, fileName);

      // Upload to server so all devices/laptops on network can access and listen to it
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.file) {
        const uploaded = res.data.file;
        uploaded.durationSec = recordDuration;
        uploaded.type = 'audio';

        if (onAudioReady) {
          onAudioReady(uploaded);
        }
        handleDiscard();
      } else {
        throw new Error('Server returned incomplete file payload');
      }
    } catch (uploadErr) {
      console.error('Failed to upload audio voice note to server:', uploadErr);
      setErrorMessage('Could not upload voice note to server. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Audio playback failed:', err);
          setIsPlaying(false);
        });
    }
  };

  const formatSec = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-slate-100 dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 shadow-inner transition-all">
      {errorMessage && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span className="leading-tight font-medium">{errorMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {!audioUrl ? (
          <>
            <div className="flex items-center gap-3 flex-1">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2.5 rounded-xl text-white font-bold transition-all shadow-sm ${
                  isRecording ? 'bg-red-600 animate-pulse' : 'bg-slate-900 hover:bg-slate-800'
                }`}
                title={isRecording ? 'Stop Recording' : 'Start Recording'}
              >
                {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-slate-400'}`} />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {isRecording ? `Recording Audio: ${formatSec(recordDuration)}` : 'Click mic to record voice note'}
                  </span>
                </div>

                {/* Real-time microphone input visualizer */}
                {isRecording && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-slate-500 font-mono">Mic Input:</span>
                    <div className="flex items-center gap-0.5 h-3">
                      {[15, 35, 55, 75, 95].map((thresh, idx) => (
                        <div
                          key={idx}
                          className={`w-1.5 rounded-full transition-all duration-75 ${
                            audioVolume >= thresh ? 'bg-emerald-500 h-3' : 'bg-slate-300 dark:bg-slate-600 h-1'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold ml-1">
                      {audioVolume > 10 ? 'Receiving Audio' : 'Speak into mic...'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-1">
              <button
                type="button"
                onClick={togglePlayback}
                className="p-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
                title={isPlaying ? 'Pause Preview' : 'Play Voice Note on Laptop'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Audio Recorded: {formatSec(recordDuration)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ({Math.round(recordedBytes / 1024)} KB)
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Click play above to listen on your laptop, or send to attach.
                </span>
              </div>

              <audio
                ref={audioPlayerRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={isUploading}
                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Discard & Re-record"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleSend}
                disabled={isUploading}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                title="Upload & Attach Voice Note"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Attach</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
