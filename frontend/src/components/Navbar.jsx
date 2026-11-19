import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../services/api';
import {
  AlertTriangle,
  Shield,
  Activity,
  User,
  Bell,
  Radio,
  CheckCircle2,
  Menu,
  X,
  PhoneCall,
  Clock,
  Compass,
  Lock,
  LogOut,
  LogIn,
  UserPlus,
  Home,
  MapPin
} from 'lucide-react';
import LocationSelectorModal from './LocationSelectorModal';

export default function Navbar({ onOpenSOS }) {
  const { user, helperProfile, logout, toggleAvailability, userLocation } = useAuth();
  const { notifications, markAllAsRead } = useNotifications();
  const { isConnected: isSocketConnected } = useSocket();
  const [backendStatus, setBackendStatus] = useState('checking');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.get('/health');
        if (res.data.status === 'ok') {
          setBackendStatus('online');
        } else {
          setBackendStatus('degraded');
        }
      } catch (err) {
        setBackendStatus('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-rose-950 to-rose-600 bg-clip-text text-transparent">
                  Help Radius
                </span>
                <span className="block text-[10px] font-semibold text-rose-600 tracking-wider uppercase -mt-1">
                  Emergency & Community
                </span>
              </div>
            </Link>

            {/* Backend & Real-time Socket status badge */}
            <div className="hidden md:flex items-center gap-2 ml-4 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 border-slate-200">
              <span className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-slate-600">
                Socket: <strong className={isSocketConnected ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>{isSocketConnected ? 'Live' : 'Reconnecting'}</strong>
              </span>
            </div>

            {/* Live Location Pill & Selector Trigger */}
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 ml-2 px-3 py-1 rounded-full text-xs font-semibold border bg-slate-50 hover:bg-slate-100 border-slate-200 transition-colors text-slate-700"
              title="Click to view or set device location"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
              <span className="truncate max-w-[130px]">
                {userLocation?.city || userLocation?.address?.split(',')[0] || 'Set Location'}
              </span>
            </button>
          </div>

          {/* Center Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link
              to="/dashboard"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                location.pathname === '/dashboard' ? 'text-rose-600 bg-rose-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Dashboard
            </Link>

            <Link
              to="/helper-inbox"
              className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors ${
                location.pathname === '/helper-inbox' ? 'text-rose-600 bg-rose-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Radio className="w-4 h-4 text-emerald-600" />
              Helper Inbox
            </Link>

            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors ${
                  location.pathname === '/admin' ? 'text-amber-700 bg-amber-50' : 'text-amber-800 hover:bg-amber-100/50'
                }`}
              >
                <Shield className="w-4 h-4 text-amber-600" />
                Admin Panel
              </Link>
            )}

            <Link
              to="/profile"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                location.pathname === '/profile' ? 'text-rose-600 bg-rose-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Profile & Contacts
            </Link>
          </nav>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification Bell Dropdown */}
            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                  className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-slide-up">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                          No notifications yet
                        </div>
                      ) : (
                        notifications.slice(0, 15).map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              setNotifDropdownOpen(false);
                              if (n.requestId) {
                                window.location.href = `/requests/${n.requestId}`;
                              }
                            }}
                            className={`p-3 text-xs hover:bg-slate-50 cursor-pointer transition-colors ${
                              !n.read ? 'bg-rose-50/40 font-semibold' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-slate-900 line-clamp-1">{n.title}</span>
                              <span className="text-[10px] text-slate-400 flex-shrink-0">
                                {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{n.body}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Session HUD: Signed in vs Signed out */}
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                    alt={user.name}
                    className="w-7 h-7 rounded-lg object-cover border border-slate-300"
                  />
                  <div className="hidden sm:block text-left text-xs leading-none">
                    <span className="font-bold text-slate-900 block truncate max-w-[120px]">{user.name}</span>
                    <span className="text-[10px] text-slate-500 font-semibold capitalize">
                      {user.role === 'admin' ? 'Admin' : (user.isHelper ? 'Volunteer Helper' : 'Requester')}
                    </span>
                  </div>
                </Link>
                <button
                  onClick={logout}
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 border border-slate-200"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-500" />
                  <span>Log In</span>
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </Link>
              </div>
            )}

            {/* Big Prominent Emergency SOS button in navbar */}
            <button
              onClick={onOpenSOS}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/30 flex items-center gap-1.5 transition-all transform active:scale-95 animate-pulse"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>SOS</span>
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2">
          {user ? (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                  alt={user.name}
                  className="w-8 h-8 rounded-xl object-cover"
                />
                <div>
                  <span className="font-bold text-slate-900 block text-xs">{user.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{user.email || user.phone}</span>
                </div>
              </div>
              <button
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-100"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pb-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 text-center text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 text-center text-xs font-bold rounded-xl bg-slate-900 text-white shadow-sm"
              >
                Create Account
              </Link>
            </div>
          )}

          <Link
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-semibold text-slate-800 hover:bg-slate-50"
          >
            Dashboard
          </Link>
          <Link
            to="/helper-inbox"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-semibold text-slate-800 hover:bg-slate-50"
          >
            Helper Inbox
          </Link>
          <Link
            to="/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-semibold text-slate-800 hover:bg-slate-50"
          >
            Emergency Contacts & Profile
          </Link>
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-semibold text-amber-700 hover:bg-amber-50"
            >
              Admin Moderation Panel
            </Link>
          )}
        </div>
      )}

      {/* Mobile Persistent Bottom Tab Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-2xl px-2 py-1.5 flex items-center justify-around">
        <Link
          to="/dashboard"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-bold transition-colors ${
            location.pathname === '/dashboard' ? 'text-rose-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </Link>

        <Link
          to="/dashboard#history"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-bold transition-colors ${
            location.hash === '#history' ? 'text-rose-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-5 h-5 mb-0.5" />
          <span>Requests</span>
        </Link>

        {/* Center Floating SOS Button */}
        <button
          type="button"
          onClick={onOpenSOS}
          className="relative -top-4 w-13 h-13 p-3.5 rounded-full bg-gradient-to-tr from-red-600 to-rose-600 text-white shadow-xl shadow-rose-600/40 border-4 border-white flex items-center justify-center transform active:scale-90 transition-transform animate-pulse"
          aria-label="Emergency SOS"
        >
          <AlertTriangle className="w-6 h-6 text-white" />
        </button>

        <Link
          to="/helper-inbox"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-bold transition-colors ${
            location.pathname === '/helper-inbox' ? 'text-rose-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Radio className="w-5 h-5 mb-0.5 text-emerald-600" />
          <span>Inbox</span>
        </Link>

        <Link
          to="/profile"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-bold transition-colors ${
            location.pathname === '/profile' ? 'text-rose-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-5 h-5 mb-0.5" />
          <span>Profile</span>
        </Link>
      </div>

      {/* Global Device Location Setup Modal */}
      <LocationSelectorModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
      />
    </header>
  );
}
