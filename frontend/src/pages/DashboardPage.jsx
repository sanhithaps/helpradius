import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocketEvent } from '../context/SocketContext';
import api from '../services/api';
import {
  AlertTriangle,
  Compass,
  Clock,
  Radio,
  Users,
  MapPin,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Flame,
  ArrowUpRight
} from 'lucide-react';

export default function DashboardPage({ onOpenSOS }) {
  const { user, userLocation } = useAuth();
  const navigate = useNavigate();

  const [activeRequests, setActiveRequests] = useState([]);
  const [pastRequests, setPastRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/requests/mine');
      const all = res.data.requests || [];
      setActiveRequests(all.filter(r => ['searching', 'scheduled', 'accepted', 'in_progress'].includes(r.status)));
      setPastRequests(all.filter(r => ['completed', 'cancelled', 'expired'].includes(r.status)));
    } catch (err) {
      console.warn('Failed to load user requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  useSocketEvent('request:updated', () => {
    fetchRequests();
  });

  if (!user && !loading) {
    return <Navigate to="/register" replace />;
  }

  const contactsCount = user?.emergencyContacts?.length || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / Location & Emergency Contacts HUD */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Account Dashboard
          </span>
          <h1 className="text-2xl font-black text-slate-900 flex flex-wrap items-center gap-2 mt-1">
            <span>{user?.name}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border">
              {user?.role === 'admin' ? 'Administrator' : (user?.isHelper ? 'Volunteer Helper' : 'Community Requester')}
            </span>
            {(user?.idLast4 || user?.verificationId) && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                ID: {user.idLast4 || user.verificationId} ({user.idType || 'Verified'})
              </span>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-600">
            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>
                {userLocation?.address || 'Acquiring GPS...'}
                {userLocation?.lat != null && userLocation?.lng != null ? ` (${userLocation.lat.toFixed(3)}, ${userLocation.lng.toFixed(3)})` : ''}
              </span>
            </div>
            <Link
              to="/profile"
              className="flex items-center gap-1 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-xl border border-rose-100 hover:bg-rose-100 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span><strong>{contactsCount}</strong> Emergency Contacts Saved</span>
            </Link>
          </div>
        </div>

        {/* Quick Helper Mode Status */}
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          <div className="text-xs">
            <span className="block font-bold text-slate-800">Community Safety Radius</span>
            <span className="text-slate-500">Volunteers active within 20 km</span>
          </div>
        </div>
      </div>

      {/* THREE MAIN ASSISTANCE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Emergency SOS - Large, Red, Glow, Pressable */}
        <div className="relative group bg-gradient-to-b from-rose-600 via-rose-600 to-red-700 rounded-3xl p-6 text-white shadow-xl glow-red overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <span className="px-2.5 py-1 rounded-full bg-white/20 text-white font-extrabold text-[10px] uppercase tracking-wider backdrop-blur-sm">
                Highest Priority
              </span>
            </div>

            <div>
              <h2 className="text-2xl font-black tracking-tight">Emergency SOS</h2>
              <p className="text-xs text-rose-100 mt-1 leading-relaxed">
                Accidents, medical distress, harassment, physical danger. Dispatches alerts to {contactsCount} contacts and searches verified helpers within 2 km.
              </p>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={onOpenSOS}
              className="w-full py-3.5 rounded-2xl bg-white text-rose-700 hover:bg-rose-50 font-black text-sm shadow-md flex items-center justify-center gap-2 transform active:scale-95 transition-all"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Trigger Emergency SOS</span>
            </button>
          </div>
        </div>

        {/* Card 2: General Immediate Help - Distinct Color (Amber / Teal) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-md hover:shadow-lg transition-all flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                <Compass className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[10px] uppercase tracking-wider">
                Immediate Help
              </span>
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">General Help</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Punctured tyre, vehicle breakdown, heavy objects, jumpstart, stranded groceries. Distance-based travel compensation clearly estimated.
              </p>
            </div>
          </div>

          <div className="pt-6">
            <Link
              to="/request/general"
              className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow flex items-center justify-center gap-2 transition-all"
            >
              <span>Request General Help</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Card 3: Scheduled Help - Indigo / Calendar */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-md hover:shadow-lg transition-all flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <Clock className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 font-extrabold text-[10px] uppercase tracking-wider">
                Scheduled
              </span>
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Scheduled Help</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Plan ahead for appointments, medical visits, elderly shopping assistance, moving luggage. Flexible date/time selection and rescheduling.
              </p>
            </div>
          </div>

          <div className="pt-6">
            <Link
              to="/request/scheduled"
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow flex items-center justify-center gap-2 transition-all"
            >
              <span>Schedule for Future Date</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ACTIVE REQUESTS PANEL */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h3 className="text-lg font-black text-slate-900">Active Requests</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
              {activeRequests.length}
            </span>
          </div>
          <span className="text-xs text-slate-400">Updates live automatically</span>
        </div>

        {activeRequests.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-dashed border-slate-200 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Radio className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-700 text-sm">No Active Requests</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You do not have any active assistance sessions running. Use the cards above to request help anytime.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeRequests.map((req) => (
              <div
                key={req.id}
                onClick={() => navigate(`/requests/${req.id}`)}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:border-rose-400 hover:shadow-md cursor-pointer transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    req.type === 'emergency' ? 'bg-rose-100 text-rose-700' : (req.type === 'general' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-700')
                  }`}>
                    {req.type} • {req.category.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase">
                    {req.status.replace('_', ' ')}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-snug">{req.description}</h4>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      Radius: <strong>{req.radius?.currentKm || 2} km</strong>
                    </span>
                    {req.acceptedHelperId && (
                      <span className="text-emerald-700 font-semibold">
                        Helper: {req.helper?.name || 'Assigned'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-rose-600">
                  <span>Open Emergency Command Center</span>
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* REQUEST HISTORY TABLE / LIST */}
      {pastRequests.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900">Recent Request History</h3>
          <div className="divide-y divide-slate-100">
            {pastRequests.slice(0, 5).map((req) => (
              <div key={req.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-800">{req.category.toUpperCase().replace('_', ' ')} ({req.type})</div>
                  <div className="text-slate-500 text-[11px]">{new Date(req.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                    req.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {req.status}
                  </span>
                  {req.finalPricing && (
                    <div className="font-mono text-[11px] text-slate-700 mt-0.5">
                      Total: ₹{req.finalPricing.total}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
