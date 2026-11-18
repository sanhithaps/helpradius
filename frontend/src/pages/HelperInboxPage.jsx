import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket, useSocketEvent } from '../context/SocketContext';
import api from '../services/api';
import {
  Radio,
  AlertTriangle,
  Compass,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  ShieldCheck,
  ChevronRight,
  Flame,
  UserCheck
} from 'lucide-react';

export default function HelperInboxPage() {
  const { user, helperProfile, userLocation, toggleAvailability } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();

  const [inboxRequests, setInboxRequests] = useState([]);
  const [declinedIds, setDeclinedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchInbox = async () => {
    try {
      const params = {};
      if (userLocation?.lat != null && userLocation?.lng != null) {
        params.lat = userLocation.lat;
        params.lng = userLocation.lng;
      }
      const res = await api.get('/helpers/inbox', { params });
      setInboxRequests(res.data.requests || []);
    } catch (e) {
      console.warn('Failed to fetch inbox', e);
    } finally {
      setLoading(false);
    }
  };

  // Sync helper live location to backend when device GPS updates
  useEffect(() => {
    if (userLocation?.lat != null && userLocation?.lng != null) {
      api.put('/helpers/me/location', {
        lat: userLocation.lat,
        lng: userLocation.lng
      }).catch(() => {});
      fetchInbox();
    }
  }, [userLocation?.lat, userLocation?.lng]);

  // Initial load once on mount
  useEffect(() => {
    fetchInbox();
  }, []);

  // Real-time Event: New Request broadcast to available helpers
  useSocketEvent('request:new', (data) => {
    if (data.request) {
      setInboxRequests((prev) => {
        if (prev.some((r) => r.id === data.request.id)) return prev;
        return [data.request, ...prev];
      });
      showToast(`🚨 New ${data.request.type.toUpperCase()} request nearby!`);
    }
  });

  // Real-time Event: Radius Engine Notification
  useSocketEvent('notification:new', () => {
    fetchInbox();
  });

  // Real-time Event: Request Taken by another helper
  useSocketEvent('request:taken', (data) => {
    setInboxRequests((prev) => prev.filter((r) => r.id !== data.requestId));
    if (data.cancelled) {
      showToast('A nearby request was cancelled by the requester.');
    } else {
      showToast('Request was accepted by another helper.');
    }
  });

  // Real-time Event: Request Updated/Expired/Completed
  useSocketEvent('request:updated', (data) => {
    if (data.request?.status !== 'searching' && data.request?.status !== 'scheduled') {
      setInboxRequests((prev) => prev.filter((r) => r.id !== data.request.id));
    }
  });

  const handleAccept = async (requestId) => {
    setAcceptingId(requestId);
    try {
      await api.post(`/requests/${requestId}/accept`);
      navigate(`/requests/${requestId}`);
    } catch (err) {
      if (err.response?.status === 410) {
        showToast('This request was cancelled by the requester and is no longer available.');
      } else if (err.response?.status === 409) {
        showToast('Another nearby helper already accepted this request.');
      } else {
        alert(err.response?.data?.message || 'Could not accept request.');
      }
      fetchInbox();
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDecline = (requestId) => {
    setDeclinedIds((prev) => new Set([...prev, requestId]));
  };

  const isAvailable = Boolean(helperProfile?.isAvailable);

  const handleToggleOnline = async () => {
    await toggleAvailability();
    if (userLocation?.lat != null && userLocation?.lng != null) {
      await api.put('/helpers/me/location', {
        lat: userLocation.lat,
        lng: userLocation.lng
      }).catch(() => {});
    }
    if (socket) {
      socket.emit('helpers:toggle-available', { isAvailable: !isAvailable });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Real-time Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2 animate-bounce">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner: Availability Radar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md transition-all ${
              isAvailable ? 'bg-emerald-500 shadow-emerald-500/20 animate-pulse' : 'bg-slate-400'
            }`}
          >
            <Radio className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">Helper Dispatch Radar</h1>
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isAvailable ? 'Live & Listening' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAvailable
                ? 'Listening to real-time incoming requests via Socket.io streaming'
                : 'Toggle online to receive nearby assistance notifications'}
            </p>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>
                <strong>Your Device Location:</strong> {userLocation?.address || 'Acquiring GPS...'}
                {userLocation?.lat != null ? ` (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={handleToggleOnline}
          className={`px-6 py-3 rounded-2xl font-bold text-xs shadow-md transition-all ${
            isAvailable
              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20'
          }`}
        >
          {isAvailable ? 'Go Offline' : 'Go Online Now'}
        </button>
      </div>

      {/* Helper Verification Badge Info */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 flex items-center justify-between shadow-lg text-xs">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <div>
            <span className="font-bold block">
              {helperProfile?.safetyEligible ? 'Verified Emergency First-Responder' : 'Community Volunteer'}
            </span>
            <span className="text-slate-400 text-[11px]">
              {helperProfile?.safetyEligible
                ? 'Authorized to accept high-priority personal safety and accident alerts'
                : 'Eligible for general and scheduled community assistance'}
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-[10px] font-mono font-bold text-emerald-400 border border-slate-700">
          Rating: {helperProfile?.rating || '5.0'} ★
        </span>
      </div>

      {/* INCOMING REQUESTS FEED */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-lg font-black text-slate-900">Nearby Incoming Requests</h2>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {inboxRequests.filter((req) => !declinedIds.has(req.id)).length} pending
          </span>
        </div>

        {inboxRequests.filter((req) => !declinedIds.has(req.id)).length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-dashed border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <p className="text-sm font-bold text-slate-700">No active assistance requests in your radius</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You are live on the network. When a nearby user triggers an SOS or requests general help, it will slide in here instantly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {inboxRequests
              .filter((req) => !declinedIds.has(req.id))
              .map((request) => {
                const isEmergency = request.type === 'emergency';
                return (
                  <div
                    key={request.id}
                    className={`bg-white rounded-3xl p-5 border shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isEmergency
                        ? 'border-rose-300 ring-2 ring-rose-500/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isEmergency
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {request.type}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900 capitalize">
                          {request.category?.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-slate-800">{request.description}</p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          <span>{request.location?.address || 'Near requester location'}</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleDecline(request.id)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={acceptingId === request.id}
                        onClick={() => handleAccept(request.id)}
                        className={`px-5 py-2.5 rounded-xl text-white font-extrabold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 ${
                          isEmergency
                            ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                        }`}
                      >
                        {acceptingId === request.id ? (
                          <span>Accepting...</span>
                        ) : (
                          <>
                            <span>Accept & Assist</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
