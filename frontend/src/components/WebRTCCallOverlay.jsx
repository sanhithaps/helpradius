import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, ShieldCheck, User, AlertCircle } from 'lucide-react';

export default function WebRTCCallOverlay({
  callState,
  callInfo,
  isMuted,
  callDuration,
  errorMessage,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute
}) {
  const toneIntervalRef = useRef(null);

  // Play synthetic incoming ringtone via Web Audio API
  useEffect(() => {
    if (callState === 'incoming') {
      const playRingtone = () => {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 1.2);
        } catch (_) {}
      };

      playRingtone();
      toneIntervalRef.current = setInterval(playRingtone, 2500);
    } else {
      if (toneIntervalRef.current) {
        clearInterval(toneIntervalRef.current);
        toneIntervalRef.current = null;
      }
    }

    return () => {
      if (toneIntervalRef.current) {
        clearInterval(toneIntervalRef.current);
        toneIntervalRef.current = null;
      }
    };
  }, [callState]);

  if (callState === 'idle') return null;

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 text-center text-white shadow-2xl space-y-6">
        {/* Avatar & Pulse Indicator */}
        <div className="relative mx-auto w-24 h-24">
          <div className={`absolute inset-0 rounded-full ${
            callState === 'connected' ? 'bg-emerald-500/20 animate-pulse' : 'bg-rose-500/20 animate-ping'
          }`} />
          <div className="relative w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-white overflow-hidden shadow-lg">
            <User className="w-12 h-12 text-slate-400" />
          </div>
        </div>

        {/* Identity & Status */}
        <div className="space-y-1.5">
          <h3 className="text-xl font-black text-white">
            {callInfo?.otherPartyName || 'Assistance Participant'}
          </h3>
          <p className="text-xs text-slate-400">
            {callState === 'incoming' && 'Incoming Real-Time Voice Call...'}
            {callState === 'calling' && 'Connecting audio stream...'}
            {callState === 'connected' && (
              <span className="text-emerald-400 font-mono font-bold text-sm">
                {formatTimer(callDuration)}
              </span>
            )}
            {callState === 'ended' && 'Call ended'}
          </p>

          <div className="pt-2 flex items-center justify-center gap-1.5 text-[10px] text-emerald-400/90 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>WebRTC Encrypted • Zero Phone Numbers Exposed</span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-2xl text-xs text-rose-300 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-4 flex items-center justify-center gap-6">
          {callState === 'incoming' ? (
            <>
              <button
                type="button"
                onClick={onDecline}
                className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
                title="Decline Call"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
                title="Accept Call"
              >
                <Phone className="w-7 h-7" />
              </button>
            </>
          ) : (
            <>
              {callState === 'connected' && (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center border text-white transition-all ${
                    isMuted ? 'bg-amber-600 border-amber-500' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'
                  }`}
                  title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
              )}

              <button
                type="button"
                onClick={onEnd}
                className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
                title="End Call"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
