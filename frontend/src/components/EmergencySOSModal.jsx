import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  AlertTriangle,
  ShieldAlert,
  HeartPulse,
  Flame,
  UserCheck,
  PhoneCall,
  X,
  Compass,
  CheckCircle2,
  Clock
} from 'lucide-react';

const EMERGENCY_CATEGORIES = [
  { id: 'accident', name: 'Road Accident / Collision', icon: Flame, color: 'text-amber-500 bg-amber-50 border-amber-200' },
  { id: 'health', name: 'Medical Emergency / Cardiac', icon: HeartPulse, color: 'text-rose-500 bg-rose-50 border-rose-200' },
  { id: 'personal_safety', name: 'Personal Safety / Harassment', icon: UserCheck, color: 'text-purple-600 bg-purple-50 border-purple-200', verifiedOnly: true },
  { id: 'physical_danger', name: 'Physical Danger / Violence', icon: ShieldAlert, color: 'text-red-600 bg-red-50 border-red-200', verifiedOnly: true },
  { id: 'other_emergency', name: 'Other Immediate Danger', icon: AlertTriangle, color: 'text-slate-600 bg-slate-50 border-slate-200' }
];

export default function EmergencySOSModal({ isOpen, onClose }) {
  const { user, userLocation, getFreshDevicePosition } = useAuth();
  const navigate = useNavigate();

  const [selectedCategory, setSelectedCategory] = useState('personal_safety');
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100%
  const [inCountdown, setInCountdown] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const holdIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Clean intervals on unmount
  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Handle Press-and-Hold for 2 seconds (Prevents accidental triggers)
  const handleMouseDown = () => {
    if (inCountdown || submitting) return;
    setHolding(true);
    setHoldProgress(0);

    const stepMs = 40;
    const totalMs = 2000;
    let elapsed = 0;

    holdIntervalRef.current = setInterval(() => {
      elapsed += stepMs;
      const progress = Math.min(100, Math.round((elapsed / totalMs) * 100));
      setHoldProgress(progress);

      if (progress >= 100) {
        clearInterval(holdIntervalRef.current);
        setHolding(false);
        triggerCountdown();
      }
    }, stepMs);
  };

  const handleMouseUp = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHolding(false);
    if (!inCountdown) {
      setHoldProgress(0);
    }
  };

  // Start 5-second cancel countdown
  const triggerCountdown = () => {
    setInCountdown(true);
    setCountdownSeconds(5);

    // Audio beep simulation using Web Audio API
    playBeep(440, 0.1);

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          dispatchSOS();
          return 0;
        }
        playBeep(520, 0.08);
        return prev - 1;
      });
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setInCountdown(false);
    setHoldProgress(0);
    setCountdownSeconds(5);
  };

  // Web Audio API beep synthesizer
  const playBeep = (freq, duration) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio not permitted without user interaction on some browsers
    }
  };

  // Dispatch SOS request to Backend
  const dispatchSOS = async () => {
    if (!user) {
      alert('Please sign in or register with your details before dispatching emergency requests.');
      onClose();
      navigate('/login');
      return;
    }
    setSubmitting(true);
    try {
      let liveLoc = userLocation;
      if (typeof getFreshDevicePosition === 'function') {
        try {
          liveLoc = await getFreshDevicePosition();
        } catch (posErr) {
          console.warn('Could not refresh hardware GPS, using last known position', posErr);
        }
      }

      if (liveLoc?.lat == null || liveLoc?.lng == null) {
        alert('Could not determine your device live GPS location. Please allow browser location access.');
        setSubmitting(false);
        setInCountdown(false);
        return;
      }

      const res = await api.post('/requests', {
        type: 'emergency',
        category: selectedCategory,
        location: {
          lat: liveLoc.lat,
          lng: liveLoc.lng,
          accuracyMeters: liveLoc.accuracy || 10,
          address: liveLoc.address || 'Live Device Emergency Spot'
        },
        description: `High Priority Emergency Alert: ${selectedCategory.toUpperCase()}`
      });

      setSubmitting(false);
      onClose();
      // Navigate directly to the Active Emergency command dashboard
      navigate(`/requests/${res.data.request.id}`);
    } catch (err) {
      console.error('Failed to dispatch SOS', err);
      alert('Could not dispatch SOS. In life-threatening danger, dial 112 immediately.');
      setSubmitting(false);
      setInCountdown(false);
    }
  };

  if (!isOpen) return null;

  const currentCat = EMERGENCY_CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-rose-100 transition-all">
        {/* Header with 112 shortcut */}
        <div className="bg-gradient-to-r from-rose-600 to-red-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
            <div>
              <h3 className="font-extrabold text-lg leading-tight tracking-tight">Emergency SOS Dispatch</h3>
              <p className="text-xs text-rose-100">Instantly alerts verified helpers & contacts</p>
            </div>
          </div>
          <button
            onClick={() => { cancelCountdown(); onClose(); }}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* National Emergency Hotline Banner */}
        <div className="bg-amber-50 px-6 py-2.5 border-b border-amber-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5 text-amber-600" />
            In life-threatening danger, also dial:
          </span>
          <a
            href="tel:112"
            className="px-3 py-1 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-1"
          >
            Call 112
          </a>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1: Category Picker */}
          {!inCountdown && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Select Emergency Situation
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EMERGENCY_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/20 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${cat.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <span className="block text-xs font-bold text-slate-900 leading-snug">{cat.name}</span>
                        {cat.verifiedOnly && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-purple-700 bg-purple-100/70 px-1.5 py-0.2 rounded">
                            Verified Helpers Only
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {currentCat?.verifiedOnly && (
                <div className="mt-2 text-xs text-purple-700 bg-purple-50 p-2.5 rounded-xl border border-purple-200 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span><strong>Safety Guaranteed:</strong> This personal safety request will route exclusively to background-checked, verified helpers.</span>
                </div>
              )}
            </div>
          )}

          {/* Current GPS Coordinates Confirmation */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Compass className="w-4 h-4 text-rose-500" />
              <span>
                Location: <strong>{userLocation?.lat != null ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : 'Acquiring device GPS...'}</strong>
              </span>
            </div>
            {userLocation?.accuracy != null ? (
              <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                GPS ±{userLocation.accuracy}m
              </span>
            ) : (
              <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Locking GPS...
              </span>
            )}
          </div>

          {/* Center Action: Press & Hold Big Circular SOS Button OR Countdown */}
          {!inCountdown ? (
            <div className="text-center py-4 space-y-4">
              <div className="relative inline-flex items-center justify-center">
                {/* Ripple pulses behind button */}
                <div className="absolute -inset-4 rounded-full bg-rose-500/20 sos-ripple-1 pointer-events-none" />
                <div className="absolute -inset-8 rounded-full bg-rose-500/10 sos-ripple-2 pointer-events-none" />

                {/* SVG Radial Progress Ring for 2-second hold */}
                <svg className="absolute w-44 h-44 -rotate-90 pointer-events-none">
                  <circle
                    cx="88"
                    cy="88"
                    r="80"
                    stroke="#fee2e2"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="88"
                    cy="88"
                    r="80"
                    stroke="#e11d48"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 80}
                    strokeDashoffset={2 * Math.PI * 80 * (1 - holdProgress / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-75"
                  />
                </svg>

                {/* Actual Giant SOS Touch Target */}
                <button
                  type="button"
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleMouseDown}
                  onTouchEnd={handleMouseUp}
                  className={`w-36 h-36 rounded-full bg-gradient-to-b from-rose-500 to-red-700 text-white font-black text-2xl tracking-wider shadow-2xl glow-red flex flex-col items-center justify-center select-none cursor-pointer transform active:scale-95 transition-all ${
                    holding ? 'scale-95 brightness-110' : 'hover:scale-102'
                  }`}
                >
                  <AlertTriangle className="w-10 h-10 mb-1 animate-pulse" />
                  <span>SOS</span>
                  <span className="text-[10px] font-medium tracking-normal text-rose-100 uppercase opacity-90">
                    {holding ? `${holdProgress}%` : 'Hold 2s'}
                  </span>
                </button>
              </div>

              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Press and hold for 2 seconds to initiate emergency broadcast. Protects against accidental clicks.
              </p>
            </div>
          ) : (
            /* 5-Second Cancel Countdown State */
            <div className="text-center py-6 space-y-5 bg-rose-50/70 rounded-3xl p-6 border-2 border-rose-500 animate-pulse-fast">
              <div>
                <span className="text-xs font-black uppercase text-rose-600 tracking-widest block">
                  Broadcasting SOS In
                </span>
                <div className="text-6xl font-black text-rose-600 my-2">
                  {countdownSeconds}
                </div>
                <p className="text-xs text-slate-600">
                  Alerting emergency contacts & searching {currentCat?.name} helpers within 2 km...
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelCountdown}
                  className="flex-1 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow transition-all"
                >
                  Cancel SOS
                </button>
                <button
                  type="button"
                  onClick={dispatchSOS}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow transition-all"
                >
                  {submitting ? 'Sending...' : 'Send Immediately'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
