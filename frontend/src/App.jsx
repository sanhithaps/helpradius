import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';

import Navbar from './components/Navbar';
import EmergencySOSModal from './components/EmergencySOSModal';

// Route-level code splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CreateGeneralRequestPage = lazy(() => import('./pages/CreateGeneralRequestPage'));
const CreateScheduledRequestPage = lazy(() => import('./pages/CreateScheduledRequestPage'));
const ActiveRequestPage = lazy(() => import('./pages/ActiveRequestPage'));
const HelperInboxPage = lazy(() => import('./pages/HelperInboxPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const LoginPage = lazy(() => import('./pages/AuthPages').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/AuthPages').then(m => ({ default: m.RegisterPage })));

function RouteLoadingFallback() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3 py-16">
      <div className="w-9 h-9 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-bold text-slate-400">Loading Help Radius module...</p>
    </div>
  );
}

export default function App() {
  const [sosModalOpen, setSosModalOpen] = useState(false);

  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <Router>
            <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
              {/* Top Navigation */}
              <Navbar onOpenSOS={() => setSosModalOpen(true)} />

              {/* Main Application Content with Mobile Bottom Padding */}
              <main className="flex-1 pb-20 lg:pb-0">
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<LandingPage onOpenSOS={() => setSosModalOpen(true)} />} />
                    <Route path="/dashboard" element={<DashboardPage onOpenSOS={() => setSosModalOpen(true)} />} />
                    <Route path="/request/general" element={<CreateGeneralRequestPage />} />
                    <Route path="/request/scheduled" element={<CreateScheduledRequestPage />} />
                    <Route path="/requests/:id" element={<ActiveRequestPage />} />
                    <Route path="/helper-inbox" element={<HelperInboxPage />} />
                    <Route path="/chats/:id" element={<ChatPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </main>

              {/* Global Emergency SOS Trigger Modal */}
              <EmergencySOSModal
                isOpen={sosModalOpen}
                onClose={() => setSosModalOpen(false)}
              />

              {/* Footer */}
              <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
                <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div>
                    <strong>Help Radius</strong> – Location-Based Emergency and Community Assistance Platform
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Built for safety, trust & swift community response • Real-Time WebRTC & Socket.io Enabled
                  </div>
                </div>
              </footer>
            </div>
          </Router>
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
