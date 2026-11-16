import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket, useSocketEvent } from '../context/SocketContext';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export function useWebRTCCall() {
  const { socket } = useSocket();

  const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'
  const [callInfo, setCallInfo] = useState(null); // { requestId, callId, otherPartyId, otherPartyName, isCaller }
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const timerRef = useRef(null);
  const ringingTimeoutRef = useRef(null);

  // Initialize hidden remote audio element
  useEffect(() => {
    if (!remoteAudioRef.current) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      remoteAudioRef.current = audio;
    }

    return () => {
      cleanupCall();
    };
  }, []);

  // Cleanup helper
  const cleanupCall = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    iceCandidatesQueueRef.current = [];
    setIsMuted(false);
    setCallDuration(0);
  }, []);

  // Setup RTCPeerConnection
  const createPeerConnection = useCallback((targetUserId, requestId, callId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:ice', {
          requestId,
          callId,
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        if (!timerRef.current) {
          timerRef.current = setInterval(() => {
            setCallDuration((d) => d + 1);
          }, 1000);
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [socket]);

  // Handle incoming call invitation
  useSocketEvent('call:incoming', ({ requestId, callId, callerId, callerName }) => {
    if (callState !== 'idle') {
      socket?.emit('call:decline', { requestId, callId, callerId });
      return;
    }

    setCallInfo({ requestId, callId, otherPartyId: callerId, otherPartyName: callerName, isCaller: false });
    setCallState('incoming');

    // Ring for max 30 seconds before auto-declining as missed call
    ringingTimeoutRef.current = setTimeout(() => {
      socket?.emit('call:end', { requestId, callId, targetUserId: callerId, durationSeconds: 0 });
      cleanupCall();
      setCallState('idle');
      setCallInfo(null);
    }, 30000);
  });

  // Handle call accepted by recipient
  useSocketEvent('call:accepted', async ({ requestId, callId, calleeId }) => {
    if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    try {
      const pc = createPeerConnection(calleeId, requestId, callId);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket?.emit('call:offer', { requestId, callId, targetUserId: calleeId, sdp: offer });
    } catch (err) {
      setErrorMessage('Microphone access denied or audio hardware unavailable.');
      endCall();
    }
  });

  // Handle incoming offer
  useSocketEvent('call:offer', async ({ requestId, callId, sdp, fromUserId }) => {
    try {
      const pc = pcRef.current || createPeerConnection(fromUserId, requestId, callId);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Process queued ICE candidates
      while (iceCandidatesQueueRef.current.length > 0) {
        const candidate = iceCandidatesQueueRef.current.shift();
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket?.emit('call:answer', { requestId, callId, targetUserId: fromUserId, sdp: answer });
    } catch (err) {
      setErrorMessage('Failed to process call audio connection.');
      endCall();
    }
  });

  // Handle incoming answer
  useSocketEvent('call:answer', async ({ sdp }) => {
    try {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        while (iceCandidatesQueueRef.current.length > 0) {
          const candidate = iceCandidatesQueueRef.current.shift();
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    } catch (err) {
      console.warn('Error setting remote description:', err);
    }
  });

  // Handle incoming ICE candidate
  useSocketEvent('call:ice', async ({ candidate }) => {
    try {
      if (pcRef.current && pcRef.current.remoteDescription) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        iceCandidatesQueueRef.current.push(candidate);
      }
    } catch (err) {
      console.warn('Error adding ICE candidate:', err);
    }
  });

  // Handle call ended by other party
  useSocketEvent('call:ended', () => {
    cleanupCall();
    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setCallInfo(null);
    }, 2000);
  });

  useSocketEvent('call:declined', () => {
    cleanupCall();
    setErrorMessage('Call was declined.');
    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setCallInfo(null);
      setErrorMessage(null);
    }, 2500);
  });

  useSocketEvent('call:cancelled', () => {
    cleanupCall();
    setCallState('idle');
    setCallInfo(null);
  });

  // Start outgoing call
  const startCall = (requestId, otherPartyName) => {
    if (!socket) return;
    setErrorMessage(null);
    setCallState('calling');

    socket.emit('call:invite', { requestId }, (response) => {
      if (response?.error) {
        setErrorMessage(response.message || 'Unable to connect call.');
        setCallState('idle');
        return;
      }
      setCallInfo({
        requestId,
        callId: response.callId,
        otherPartyId: response.calleeId,
        otherPartyName: otherPartyName || 'Participant',
        isCaller: true
      });

      // Ringing timeout 30s
      ringingTimeoutRef.current = setTimeout(() => {
        endCall();
        setErrorMessage('No answer.');
      }, 30000);
    });
  };

  // Accept incoming call
  const acceptCall = () => {
    if (!socket || !callInfo) return;
    if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    socket.emit('call:accept', {
      requestId: callInfo.requestId,
      callId: callInfo.callId,
      callerId: callInfo.otherPartyId
    });
    setCallState('calling');
  };

  // Decline incoming call
  const declineCall = () => {
    if (!socket || !callInfo) return;
    if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    socket.emit('call:decline', {
      requestId: callInfo.requestId,
      callId: callInfo.callId,
      callerId: callInfo.otherPartyId
    });
    cleanupCall();
    setCallState('idle');
    setCallInfo(null);
  };

  // End active call
  const endCall = () => {
    if (socket && callInfo) {
      socket.emit('call:end', {
        requestId: callInfo.requestId,
        callId: callInfo.callId,
        targetUserId: callInfo.otherPartyId,
        durationSeconds: callDuration
      });
    }
    cleanupCall();
    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setCallInfo(null);
    }, 1500);
  };

  // Toggle Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  };

  return {
    callState,
    callInfo,
    isMuted,
    callDuration,
    errorMessage,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute
  };
}
