import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useSocketEvent } from './SocketContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [activeToast, setActiveToast] = useState(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
    } catch (e) {
      // Ignore network errors on initial load
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
  }, [user?.id]);

  // Real-time Event: Incoming push notification via Socket.io
  useSocketEvent('notification:new', (data) => {
    if (data?.notification) {
      setNotifications((prev) => [data.notification, ...prev]);
      showToast({
        title: data.notification.title,
        body: data.notification.body
      });
    }
  });

  const showToast = (toast) => {
    setActiveToast(toast);
    setTimeout(() => {
      setActiveToast(null);
    }, 5000);
  };

  return (
    <NotificationContext.Provider value={{ notifications, fetchNotifications, showToast }}>
      {children}
      {activeToast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm bg-white dark:bg-slate-900 border-l-4 border-rose-500 shadow-2xl rounded-r-xl p-4 transition-all transform animate-bounce">
          <div className="flex items-start">
            <div className="flex-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{activeToast.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{activeToast.body}</p>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-slate-600 ml-3 text-sm font-semibold"
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
