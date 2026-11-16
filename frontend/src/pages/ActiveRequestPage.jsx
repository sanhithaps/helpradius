import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket, useSocketEvent } from '../context/SocketContext';
import { useLiveLocation } from '../hooks/useLiveLocation';
import { useWebRTCCall } from '../hooks/useWebRTCCall';
import TrackingMap from '../components/TrackingMap';
import LocationPickerMap from '../components/LocationPickerMap';
import WebRTCCallOverlay from '../components/WebRTCCallOverlay';
import PricingBreakdownCard from '../components/PricingBreakdownCard';
import api from '../services/api';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  Compass,
  Clock,
  Radio,
  ShieldCheck,
  CheckCircle2,
  PhoneCall,
  MessageSquare,
  Phone,
  User,
  Star,
  XCircle,
  Calendar,
  Share2,
  Info,
  ArrowRight
} from 'lucide-react';

export default function ActiveRequestPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [helper, setHelper] = useState(null);
  const [contactAlerts, setContactAlerts] = useState([]);
  const [trackingSession, setTrackingSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const webrtc = useWebRTCCall();
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isSafeChecked, setIsSafeChecked] = useState(true);
  const [retryingIndex, setRetryingIndex] = useState(null);

  // Poll request details and tracking updates
  const fetchDetails = async () => {
    try {
      const res = await api.get(`/requests/${id}`);
      setRequest(res.data.request);
      setHelper(res.data.helper);
      setContactAlerts(res.data.contactAlerts || []);
      setTrackingSession(res.data.trackingSession);
    } catch (err) {
      console.warn('Failed to load request details', err);
    } finally {
      setLoading(false);
    }
  };

  const { socket } = useSocket();

  useEffect(() => {
    fetchDetails();
  }, [id]);

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('request:join', { requestId: id });
    return () => {
      socket.emit('request:leave', { requestId: id });
    };
  }, [socket, id]);

  useSocketEvent('request:updated', (data) => {
    if (data.request?.id === id) {
      setRequest(data.request);
      if (data.helper) setHelper(data.helper);
      if (data.trackingSession) setTrackingSession(data.trackingSession);
    }
  });

  const isHelper = user?.id === request?.acceptedHelperId;
  const { isSharing, error: locationError, stopSharing, startSharing } = useLiveLocation(
    id,
    request?.status,
    isHelper
  );

  useSocketEvent('helper:location', (data) => {
    if (data.requestId === id && data.location) {
      setHelper((prev) => (prev ? { ...prev, location: data.location } : prev));
      setTrackingSession((prev) => (prev ? { ...prev, helperLocation: data.location } : prev));
    }
  });

  useSocketEvent('contact-alert:updated', (data) => {
    if (data.requestId === id && data.contactAlerts) {
      setContactAlerts(data.contactAlerts);
    }
  });

  const handleRetryAlert = async (idx) => {
    setRetryingIndex(idx);
    try {
      const res = await api.post(`/requests/${id}/contact-alerts/${idx}/retry`);
      if (res.data?.contactAlerts) {
        setContactAlerts(res.data.contactAlerts);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to retry sending alert.');
    } finally {
      setRetryingIndex(null);
    }
  };

  const handleMarkCompleted = async () => {
    try {
      const res = await api.post(`/requests/${id}/complete`);
      setRequest(res.data.request);
      setRatingModalOpen(true);
      confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
    } catch (e) {
      alert('Could not complete request.');
    }
  };

  const handleCancel = async () => {
    const confirmCancel = window.confirm('Are you sure you want to cancel this assistance request?');
    if (!confirmCancel) return;
    try {
      const res = await api.patch(`/requests/${id}/cancel`, {
        reason: 'Cancelled by requester'
      });
      setRequest(res.data.request);
    } catch (e) {
      alert(e.response?.data?.message || 'Could not cancel request.');
    }
  };

  const submitRating = async () => {
    try {
      await api.post(`/requests/${id}/rate`, {
        rating: stars,
        comment: ratingComment,
        isSafeConfirmed: isSafeChecked
      });
      setRatingModalOpen(false);
      fetchDetails();
    } catch (e) {
      alert('Could not submit rating.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-500">Connecting to Assistance Radar...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold">Request Not Found</h2>
        <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isEmergency = request.type === 'emergency';
  const isSearching = request.status === 'searching';
  const isAcceptedOrActive = ['accepted', 'in_progress'].includes(request.status);
  const isCompleted = request.status === 'completed';
  const isCancelled = request.status === 'cancelled';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Top Status Header */}
      <div className={`rounded-3xl p-6 text-white shadow-xl ${
        isCancelled
          ? 'bg-gradient-to-r from-slate-700 to-slate-800'
          : (isEmergency
            ? 'bg-gradient-to-r from-rose-600 to-red-700 glow-red'
            : (request.type === 'general' ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-indigo-600 to-indigo-700'))
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-black uppercase tracking-wider backdrop-blur-sm">
                {request.type} • {request.category?.replace('_', ' ')}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                isCancelled ? 'bg-rose-500/40 text-rose-200' : 'bg-black/20'
              }`}>
                Status: {request.status.replace('_', ' ')}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black mt-2 leading-tight">
              {request.description}
            </h1>
            <p className="text-xs text-white/80 mt-1">
              Initiated on {new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Request ID: {request.id}
            </p>
          </div>

          {/* Quick Action buttons */}
          <div className="flex items-center gap-2">
            {!isCompleted && !isCancelled && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-sm transition-all"
              >
                Cancel Request
              </button>
            )}
            {isEmergency && !isCancelled && !isCompleted && (
              <a
                href="tel:112"
                className="px-4 py-2 rounded-xl bg-white text-rose-600 font-black text-xs shadow-md flex items-center gap-1.5 hover:bg-rose-50"
              >
                <PhoneCall className="w-3.5 h-3.5 text-rose-600" />
                <span>Call 112</span>
              </a>
            )}
            {isCancelled && (
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 rounded-xl bg-white text-slate-900 font-bold text-xs shadow-md hover:bg-slate-100"
              >
                Dashboard
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DYNAMIC RADIUS EXPANSION ENGINE HUD (When searching) */}
      {isSearching && (
        <div className="bg-white rounded-3xl p-6 border-2 border-rose-200 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <h3 className="font-extrabold text-slate-900 text-base">
                Searching for Helpers within {request.radius?.currentKm || 2} km...
              </h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              Step {request.radius ? request.radius.stepIndex + 1 : 1} of {request.radius?.totalSteps || 4}
            </span>
          </div>

          {/* Progress Bar for Steps */}
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-rose-500 to-red-600 h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (((request.radius?.stepIndex || 0) + 1) / (request.radius?.totalSteps || 4)) * 100)}%`
              }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center text-xs">
            {request.radius?.history?.map((hist, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="block text-[10px] uppercase font-bold text-slate-400">Step {hist.step}</span>
                <span className="font-black text-slate-900">{hist.radiusKm} km radius</span>
                <span className="text-[10px] text-emerald-600 font-semibold block">{hist.helpersFound} notified</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            Helpers within the expanded zone are dispatched web push notifications automatically. Duplicate notifications are suppressed.
          </p>
        </div>
      )}

      {/* EMERGENCY CONTACTS ALERT STATUS HUD (Emergency requests) */}
      {isEmergency && contactAlerts.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm">Emergency Contacts Alert Stream</h3>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
              SMS & In-App Alerts
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {contactAlerts.map((contact, idx) => {
              const isSimulated = contact.status === 'simulated' || (!contact.status && contact.deliveryBadge?.includes('Simulated'));
              const isSent = contact.status === 'sent' || contact.status === 'delivered';
              const isFailed = contact.status === 'failed';

              return (
                <div key={contact.contactId || idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between text-xs gap-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">{contact.name} ({contact.relationship})</span>
                      <span className="text-[11px] text-slate-500 font-mono">{contact.phone}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-200/60 px-1.5 py-0.5 rounded">
                          Channel: {contact.inAppDelivered ? 'SMS + In-App' : 'SMS'}
                        </span>
                        {contact.inAppDelivered && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            ✓ In-App Alert Sent
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      {isSent && (
                        <span className="inline-flex items-center gap-1 font-bold text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Sent</span>
                        </span>
                      )}
                      {isSimulated && (
                        <span className="inline-flex items-center gap-1 font-bold text-[10px] text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-md border border-slate-300" title="Simulated (demo - no real SMS sent)">
                          <Info className="w-3 h-3 text-slate-500" />
                          <span>Simulated</span>
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1 font-bold text-[11px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Failed</span>
                        </span>
                      )}
                      <span className="block text-[9px] text-slate-400 mt-1">
                        {contact.timestamp ? new Date(contact.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>

                  {isFailed && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
                      <span className="text-rose-600 truncate max-w-[150px]">{contact.error || 'Failed to dispatch SMS'}</span>
                      <button
                        type="button"
                        onClick={() => handleRetryAlert(idx)}
                        disabled={retryingIndex === idx}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 transition-all shadow-sm"
                      >
                        {retryingIndex === idx ? 'Retrying...' : 'Retry SMS'}
                      </button>
                    </div>
                  )}
                  {isSimulated && (
                    <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-200/50">
                      Simulated (demo – no real SMS sent)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LIVE TRACKING & HELPER CARD (When accepted or in progress) */}
      {isAcceptedOrActive && (
        <div className="space-y-6">
          {/* Helper Live GPS Location Banner */}
          {isHelper && (
            <div className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
              isSharing ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isSharing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span className="font-semibold">
                  {isSharing
                    ? 'Sharing your live GPS location with the requester until this session ends.'
                    : 'Live GPS location sharing is paused.'}
                </span>
              </div>
              <button
                type="button"
                onClick={isSharing ? stopSharing : startSharing}
                className="px-3.5 py-1.5 rounded-xl bg-white border font-bold text-xs shadow-sm hover:bg-slate-50 transition-all self-start sm:self-auto"
              >
                {isSharing ? 'Pause Sharing' : 'Resume Sharing'}
              </button>
            </div>
          )}

          {/* Tracking Map with Helper Moving Towards Requester */}
          <TrackingMap
            requesterLocation={request.location}
            helperLocation={trackingSession?.helperLocation || {
              lat: request.location.lat + 0.007,
              lng: request.location.lng + 0.005
            }}
            helperName={helper?.name || 'Assigned Volunteer'}
            height="400px"
          />

          {/* Connected Helper Identity Card (Strict Privacy: NO PHONE NUMBERS) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden shadow-inner border border-slate-200 flex-shrink-0">
                <img
                  src={helper?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
                  alt={helper?.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <h3 className="font-extrabold text-slate-900 text-lg">{helper?.name || 'Assigned Volunteer'}</h3>
                  {helper?.safetyEligible && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                      Verified Safety Helper
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 justify-center sm:justify-start">
                  <span className="flex items-center gap-1 text-amber-500 font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{helper?.rating || 4.9}</span>
                  </span>
                  <span>•</span>
                  <span className="text-emerald-700 font-semibold">En Route to your GPS pin</span>
                </div>
              </div>
            </div>

            {/* Direct Communication Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => navigate(`/chats/${request.id}`)}
                className="flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>In-App Chat</span>
              </button>

              <button
                onClick={() => webrtc.startCall(request.id, helper?.name || 'Helper')}
                className="flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                <span>In-App Call</span>
              </button>

              <button
                onClick={handleMarkCompleted}
                className="flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete</span>
              </button>

              <button
                onClick={handleCancel}
                className="flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 font-bold text-xs border border-slate-200 transition-all flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4 text-rose-500" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETED STATUS & RATING CONFIRMATION */}
      {isCompleted && (
        <div className="bg-emerald-50 rounded-3xl p-8 border border-emerald-200 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-emerald-950">Assistance Session Completed</h3>
            <p className="text-xs text-emerald-800 max-w-md mx-auto mt-1">
              Thank you for trusting Help Radius. Live tracking has ceased and private chat is locked.
            </p>
          </div>

          {request.finalPricing && (
            <div className="max-w-md mx-auto text-left">
              <PricingBreakdownCard breakdown={request.finalPricing} title="Final Compensation Breakdown" />
            </div>
          )}

          <button
            onClick={() => setRatingModalOpen(true)}
            className="px-6 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow"
          >
            Review Assistance & Confirm Safety
          </button>
        </div>
      )}

      {/* CANCELLED STATUS NOTICE */}
      {isCancelled && (
        <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center mx-auto shadow-inner">
            <XCircle className="w-8 h-8 text-rose-500" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900">Request Cancelled</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
              {request.cancellationReason || 'This request has been cancelled by the user'}. Search radius expansion and live tracking have ceased.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Static Map of Requester Pin (When searching or scheduled) */}
      {!isAcceptedOrActive && !isCompleted && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Target Location</h3>
          <LocationPickerMap
            location={request.location}
            radiusKm={request.radius?.currentKm || 2}
            readOnly={true}
            height="300px"
          />
        </div>
      )}

      {/* IN-APP WEBRTC VOICE CALL OVERLAY */}
      <WebRTCCallOverlay
        callState={webrtc.callState}
        callInfo={webrtc.callInfo}
        isMuted={webrtc.isMuted}
        callDuration={webrtc.callDuration}
        errorMessage={webrtc.errorMessage}
        onAccept={webrtc.acceptCall}
        onDecline={webrtc.declineCall}
        onEnd={webrtc.endCall}
        onToggleMute={webrtc.toggleMute}
      />

      {/* RATING & "I'M SAFE" MODAL */}
      {ratingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <Star className="w-6 h-6 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">How was your assistance?</h3>
              <p className="text-xs text-slate-500 mt-1">Help us maintain community safety and trust</p>
            </div>

            {/* 5-star selector */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setStars(num)}
                  className="p-1.5 focus:outline-none"
                >
                  <Star className={`w-8 h-8 ${num <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Leave an encouraging comment for your helper..."
              className="w-full p-3 rounded-2xl border border-slate-200 text-xs outline-none focus:border-rose-500"
            />

            {/* "I'm Safe" confirmation checkbox */}
            <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-left cursor-pointer">
              <input
                type="checkbox"
                checked={isSafeChecked}
                onChange={(e) => setIsSafeChecked(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <span className="text-xs font-bold text-slate-800">
                I am currently safe and out of immediate danger.
              </span>
            </label>

            <button
              onClick={submitRating}
              className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow"
            >
              Submit Feedback
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
