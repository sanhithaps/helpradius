import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useSocketEvent } from './SocketContext';
import { Bell, AlertTriangle, CheckCircle, Info, Volume2, X } from 'lucide-react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [activeToast, setActiveToast] = useState(null);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const audioCtxRef = useRef(null);

  // Initialize Web Audio API on first user interaction if possible
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Play soft chime for standard notifications
  const playSoftChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Note 1: 523.25 Hz (C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: 659.25 Hz (E5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.12);
      gain2.gain.setValueAtTime(0.15, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.5);
    } catch (_) {}
  };

  // Play loud repeating siren / alarm for Emergency SOS alerts
  const playEmergencyAlarm = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      for (let i = 0; i < 3; i++) {
        const start = now + i * 0.3;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        // Alternate between 880 Hz and 660 Hz
        osc.frequency.setValueAtTime(880, start);
        osc.frequency.setValueAtTime(660, start + 0.15);
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.28);
      }

      if ('vibrate' in navigator) {
        navigator.vibrate([300, 150, 300, 150, 300]);
      }
    } catch (_) {}
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
    } catch (e) {
      // Ignore network errors on initial load
    }
  };

  // Check if browser notification permission should be prompted
  useEffect(() => {
    if (!user) {
      setShowPermissionPrompt(false);
      return;
    }
    fetchNotifications();

    if ('Notification' in window && Notification.permission === 'default') {
      const dismissed = sessionStorage.getItem('notif_prompt_dismissed');
      if (!dismissed) {
        // Show friendly prompt 2 seconds after login
        const timer = setTimeout(() => setShowPermissionPrompt(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [user?.id]);

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      try {
        await Notification.requestPermission();
      } catch (_) {}
    }
    setShowPermissionPrompt(false);
    sessionStorage.setItem('notif_prompt_dismissed', 'true');
  };

  const dismissPermissionPrompt = () => {
    setShowPermissionPrompt(false);
    sessionStorage.setItem('notif_prompt_dismissed', 'true');
  };

  // Real-time Event: Incoming push notification via Socket.io
  useSocketEvent('notification:new', (data) => {
    if (!data?.notification) return;
    const notif = data.notification;
    setNotifications((prev) => [notif, ...prev]);

    const isEmergency = notif.type === 'emergency_sos' || notif.priority === 'urgent';

    // Play appropriate sound & vibration
    if (isEmergency) {
      playEmergencyAlarm();
    } else {
      playSoftChime();
    }

    // If tab is hidden in background and permission granted, fire system notification
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const sysNotif = new Notification(notif.title || 'Help Radius Alert', {
          body: notif.body,
          icon: '/vite.svg',
          badge: '/vite.svg',
          tag: notif.id || `notif_${Date.now()}`
        });

        sysNotif.onclick = () => {
          window.focus();
          sysNotif.close();
          if (notif.requestId) {
            window.location.href = `/requests/${notif.requestId}`;
          }
        };
      } catch (_) {}
    }

    // Always show in-app toast if user is interacting or viewing tab
    showToast({
      title: notif.title,
      body: notif.body,
      type: notif.type,
      requestId: notif.requestId
    });
  });

  const showToast = (toast) => {
    setActiveToast(toast);
    setTimeout(() => {
      setActiveToast((prev) => (prev === toast ? null : prev));
    }, 6000);
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.post('/notifications/mark-read');
    } catch (_) {}
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        fetchNotifications,
        showToast,
        markAllAsRead,
        requestBrowserPermission
      }}
    >
      {children}

      {/* Friendly Browser Notification Permission Pre-Prompt */}
      {showPermissionPrompt && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600/30 text-rose-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 text-xs">
              <h4 className="font-extrabold text-sm text-white">Enable Safety Alerts</h4>
              <p className="text-slate-300 mt-1 leading-relaxed">
                Allow notifications to receive immediate emergency alerts and assistance updates when the tab is running in the background.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={requestBrowserPermission}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-white shadow-sm transition-all"
                >
                  Allow Alerts
                </button>
                <button
                  type="button"
                  onClick={dismissPermissionPrompt}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-slate-300 transition-all"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissPermissionPrompt}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Active In-App Toast */}
      {activeToast && (
        <div
          className={`fixed top-20 right-4 z-50 max-w-sm rounded-2xl p-4 shadow-2xl border transition-all transform animate-bounce cursor-pointer ${
            activeToast.type === 'emergency_sos'
              ? 'bg-rose-600 text-white border-rose-700'
              : 'bg-white text-slate-900 border-slate-200'
          }`}
          onClick={() => {
            if (activeToast.requestId) {
              window.location.href = `/requests/${activeToast.requestId}`;
            }
            setActiveToast(null);
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                activeToast.type === 'emergency_sos'
                  ? 'bg-white/20 text-white'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              {activeToast.type === 'emergency_sos' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1">
              <h4
                className={`text-xs font-black ${
                  activeToast.type === 'emergency_sos' ? 'text-white' : 'text-slate-900'
                }`}
              >
                {activeToast.title}
              </h4>
              <p
                className={`text-[11px] mt-0.5 line-clamp-2 ${
                  activeToast.type === 'emergency_sos' ? 'text-white/90' : 'text-slate-600'
                }`}
              >
                {activeToast.body}
              </p>
              {activeToast.requestId && (
                <span
                  className={`inline-block mt-1 text-[10px] font-bold underline ${
                    activeToast.type === 'emergency_sos' ? 'text-white' : 'text-rose-600'
                  }`}
                >
                  View Details &rarr;
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveToast(null);
              }}
              className={`text-xs ml-1 ${
                activeToast.type === 'emergency_sos'
                  ? 'text-white/70 hover:text-white'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
