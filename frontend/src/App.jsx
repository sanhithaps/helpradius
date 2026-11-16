import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';

import Navbar from './components/Navbar';
import EmergencySOSModal from './components/EmergencySOSModal';

import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import CreateGeneralRequestPage from './pages/CreateGeneralRequestPage';
import CreateScheduledRequestPage from './pages/CreateScheduledRequestPage';
import ActiveRequestPage from './pages/ActiveRequestPage';
import HelperInboxPage from './pages/HelperInboxPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';

export default function App() {
  const [sosModalOpen, setSosModalOpen] = useState(false);

  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <Router>
          <div className="min-h-screen bg-slate-50 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-rose-500 selection:text-white">
            {/* Top Navigation */}
            <Navbar onOpenSOS={() => setSosModalOpen(true)} />

            {/* Main Application Content */}
            <main className="flex-1">
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
                  Built for safety, trust & swift community response • Prototype / Simulated Mode
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
