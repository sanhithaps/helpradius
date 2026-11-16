import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LocationPickerMap from '../components/LocationPickerMap';
import PricingBreakdownCard from '../components/PricingBreakdownCard';
import api from '../services/api';
import {
  Clock,
  Calendar,
  MapPin,
  HeartHandshake,
  Luggage,
  UserCheck,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

const SCHEDULED_CATEGORIES = [
  { id: 'appointment_companion', name: 'Hospital / Clinic Appointment Companion', icon: UserCheck, desc: 'Accompaniment to hospital, doctor checkups or tests' },
  { id: 'shopping_companion', name: 'Senior / Elderly Shopping Companion', icon: HeartHandshake, desc: 'Support navigating grocery stores, pharmacy or walking' },
  { id: 'move_luggage', name: 'Planned Luggage / Relocation Help', icon: Luggage, desc: 'Scheduled help loading bags, transport or moving items' },
  { id: 'planned_activity', name: 'Community Companion / Escort', icon: Clock, desc: 'Guidance and company for scheduled events or visits' }
];

export default function CreateScheduledRequestPage() {
  const { user, userLocation } = useAuth();
  const navigate = useNavigate();

  // Tomorrow morning default date-time
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const defaultDateTimeStr = tomorrow.toISOString().slice(0, 16);

  const [category, setCategory] = useState('appointment_companion');
  const [scheduledFor, setScheduledFor] = useState(defaultDateTimeStr);
  const [expectedDurationMin, setExpectedDurationMin] = useState(60);
  const [meetingLocationText, setMeetingLocationText] = useState('Victoria Hospital Main Entrance, Bengaluru');
  const [location, setLocation] = useState({ lat: userLocation.lat, lng: userLocation.lng });
  const [description, setDescription] = useState('');
  const [voluntaryReward, setVoluntaryReward] = useState(150);
  const [breakdown, setBreakdown] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchEstimate = async () => {
      try {
        const res = await api.get('/pricing/estimate', {
          params: {
            type: 'scheduled',
            distanceKm: 3.5,
            voluntaryReward,
            durationMinutes: expectedDurationMin,
            category
          }
        });
        setBreakdown(res.data.breakdown);
      } catch (e) {}
    };
    fetchEstimate();
  }, [category, expectedDurationMin, voluntaryReward]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in or register with your details before scheduling a request.');
      navigate('/login');
      return;
    }
    if (!description.trim()) {
      alert('Please enter a short description of the scheduled help.');
      return;
    }

    setSubmitting(true);
    try {
      const targetLat = (location && typeof location.lat === 'number') ? location.lat : (userLocation?.lat || 12.9716);
      const targetLng = (location && typeof location.lng === 'number') ? location.lng : (userLocation?.lng || 77.5946);

      const res = await api.post('/requests', {
        type: 'scheduled',
        category,
        description: description.trim(),
        scheduledFor,
        expectedDurationMin: Number(expectedDurationMin) || 60,
        meetingLocation: meetingLocationText || 'Meeting Point',
        location: {
          lat: targetLat,
          lng: targetLng,
          address: meetingLocationText || 'Meeting Location'
        },
        voluntaryReward: Number(voluntaryReward) || 0
      });

      navigate(`/requests/${res.data.request.id}`);
    } catch (err) {
      console.error('Failed to create scheduled request', err);
      alert(err.response?.data?.message || 'Could not create scheduled request. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-3xl p-6 text-white shadow-md flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-extrabold uppercase tracking-wider backdrop-blur-sm">
            <Calendar className="w-3.5 h-3.5" />
            <span>Planned Assistance</span>
          </div>
          <h1 className="text-2xl font-black mt-2">Book Scheduled Community Help</h1>
          <p className="text-xs text-indigo-100">
            For future medical appointments, grocery companions, and scheduled luggage support.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Category Selection */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            1. Select Purpose of Scheduled Assistance
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SCHEDULED_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-slate-900">{cat.name}</span>
                    <span className="text-xs text-slate-500 block mt-0.5 leading-snug">{cat.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Date, Time & Duration */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            2. Date, Time & Estimated Duration
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-xs font-semibold text-slate-600 mb-1">Appointment Date & Time:</span>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-indigo-600"
                required
              />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-600 mb-1">Expected Duration:</span>
              <div className="flex gap-2">
                {[30, 60, 120, 180].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setExpectedDurationMin(mins)}
                    className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-all ${
                      expectedDurationMin === mins
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Meeting Location & Details */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            3. Meeting Point & Map Pin
          </label>
          <input
            type="text"
            value={meetingLocationText}
            onChange={(e) => setMeetingLocationText(e.target.value)}
            placeholder="e.g., Hospital Reception Desk, Gate 2"
            className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-600"
            required
          />

          <LocationPickerMap
            location={location}
            onChange={setLocation}
            radiusKm={3}
            height="260px"
          />

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mt-3 mb-1">
              Instructions for the Helper
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Need someone to guide and assist with wheelchair inside the clinic."
              className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm outline-none focus:border-indigo-600"
              required
            />
          </div>
        </div>

        {/* Step 4: Transparent Compensation Estimate */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            4. Suggested Volunteer Compensation / Reward
          </label>
          <div className="flex items-center gap-3">
            {[100, 150, 250, 400].map(amt => (
              <button
                key={amt}
                type="button"
                onClick={() => setVoluntaryReward(amt)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  voluntaryReward === amt
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                ₹{amt}
              </button>
            ))}
            <div className="relative flex-1 max-w-[140px]">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
              <input
                type="number"
                min="0"
                value={voluntaryReward}
                onChange={(e) => setVoluntaryReward(Math.max(0, parseInt(e.target.value || '0', 10)))}
                className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none"
              />
            </div>
          </div>

          <PricingBreakdownCard breakdown={breakdown} title="Scheduled Assistance Estimate" />
        </div>

        {/* Reschedule & Cancel Policy Note */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
          <span className="font-bold text-slate-800 block">Flexibility Guarantee:</span>
          <p>
            You can reschedule the date or cancel this request at any time prior to the meeting time without penalty.
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-base shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transform active:scale-98 transition-all"
        >
          <span>{submitting ? 'Confirming Scheduled Request...' : 'Confirm Scheduled Booking'}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
