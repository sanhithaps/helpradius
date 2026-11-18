import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LocationPickerMap from '../components/LocationPickerMap';
import PricingBreakdownCard from '../components/PricingBreakdownCard';
import VoiceNoteRecorder from '../components/VoiceNoteRecorder';
import api from '../services/api';
import {
  Compass,
  Wrench,
  Car,
  Package,
  ShoppingBag,
  HelpCircle,
  Camera,
  Video,
  UploadCloud,
  Loader2,
  IndianRupee,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';

const GENERAL_CATEGORIES = [
  { id: 'puncture', name: 'Tyre Puncture / Flat', icon: Wrench, desc: 'Need puncture kit, portable air pump or spare wheel help' },
  { id: 'stranded', name: 'Stranded Vehicle / Breakdown', icon: Car, desc: 'Jumpstart cables, tow assistance or stalled engine' },
  { id: 'luggage', name: 'Heavy Luggage / Moving', icon: Package, desc: 'Help lifting or loading boxes, suitcases or furniture' },
  { id: 'groceries', name: 'Essential Goods / Delivery', icon: ShoppingBag, desc: 'Urgent groceries, medicines or pickup companion' },
  { id: 'other', name: 'Other Immediate Assistance', icon: HelpCircle, desc: 'General neighborhood hands-on help' }
];

export default function CreateGeneralRequestPage() {
  const { user, userLocation } = useAuth();
  const navigate = useNavigate();

  const [category, setCategory] = useState('puncture');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState({ lat: userLocation?.lat, lng: userLocation?.lng });
  const [isPinManuallyMoved, setIsPinManuallyMoved] = useState(false);
  const [selectedRadiusKm, setSelectedRadiusKm] = useState(2);
  const [mediaList, setMediaList] = useState([]);
  const [breakdown, setBreakdown] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // Sync location with live device GPS when acquired
  useEffect(() => {
    if (!isPinManuallyMoved && userLocation?.lat != null && userLocation?.lng != null) {
      setLocation({ lat: userLocation.lat, lng: userLocation.lng });
    }
  }, [userLocation?.lat, userLocation?.lng, isPinManuallyMoved]);

  // Fetch live transparent pricing breakdown when values change
  useEffect(() => {
    const fetchEstimate = async () => {
      try {
        const res = await api.get('/pricing/estimate', {
          params: {
            type: 'general',
            distanceKm: selectedRadiusKm,
            voluntaryReward,
            category
          }
        });
        setBreakdown(res.data.breakdown);
      } catch (e) {}
    };
    fetchEstimate();
  }, [category, selectedRadiusKm, voluntaryReward]);

  const handleAudioReady = (audioItem) => {
    setMediaList(prev => [...prev, audioItem]);
    setShowVoiceRecorder(false);
  };

  // Upload local image or video from device
  const handleDeviceFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingMedia(true);
    try {
      for (const file of files) {
        if (file.size > 50 * 1024 * 1024) {
          alert(`File "${file.name}" exceeds 50MB.`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data?.file) {
          setMediaList(prev => [...prev, res.data.file]);
        }
      }
    } catch (err) {
      console.error('File upload failed', err);
      alert('Could not upload media from device. Please check file format and size.');
    } finally {
      setUploadingMedia(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in or register with your details before posting a request.');
      navigate('/login');
      return;
    }
    if (!description.trim()) {
      alert('Please enter a brief description of the help needed.');
      return;
    }

    if (!location?.lat || !location?.lng) {
      alert('Could not determine your device live GPS location. Please allow browser location access or drag the pin on the map.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/requests', {
        type: 'general',
        category,
        description,
        location: {
          lat: location.lat,
          lng: location.lng,
          address: userLocation?.address || 'Requester Live Spot'
        },
        voluntaryReward: Number(voluntaryReward) || 0,
        media: mediaList
      });

      navigate(`/requests/${res.data.request.id}`);
    } catch (err) {
      console.error('Failed to create general help request', err);
      alert('Could not create request. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl p-6 text-white shadow-md flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-extrabold uppercase tracking-wider backdrop-blur-sm">
            <Compass className="w-3.5 h-3.5" />
            <span>Community Assistance</span>
          </div>
          <h1 className="text-2xl font-black mt-2">Request General Immediate Help</h1>
          <p className="text-xs text-amber-100">
            For vehicle roadside assistance, punctured tyres, heavy objects, or grocery runs.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Category Selection */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            1. Select Category of Assistance
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GENERAL_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
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

        {/* Step 2: Description & Media Upload */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            2. Describe the Situation (Max 300 Characters)
          </label>
          <textarea
            rows={3}
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Rear tyre is punctured near the petrol pump. I have a spare wheel but need a jack tool and assistance."
            className="w-full p-4 rounded-2xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm outline-none transition-all"
            required
          />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Be specific about tools or physical help required.</span>
            <span>{description.length} / 300</span>
          </div>

          {/* Media Attachments from Local Device */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <span className="text-xs font-bold text-slate-600 block">Optional Media from Your Device:</span>

            {/* Hidden device file inputs */}
            <input
              type="file"
              ref={photoInputRef}
              accept="image/*"
              onChange={handleDeviceFileUpload}
              className="hidden"
              multiple
            />
            <input
              type="file"
              ref={videoInputRef}
              accept="video/*"
              onChange={handleDeviceFileUpload}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingMedia}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Camera className="w-4 h-4 text-amber-500" />
                <span>Upload Photo</span>
              </button>

              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={uploadingMedia}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Video className="w-4 h-4 text-rose-500" />
                <span>Upload Video</span>
              </button>

              <button
                type="button"
                onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
              >
                <span>Record Audio Note</span>
              </button>
            </div>

            {uploadingMedia && (
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                <span>Uploading media file from your device...</span>
              </div>
            )}

            {showVoiceRecorder && (
              <VoiceNoteRecorder
                onAudioReady={handleAudioReady}
                onCancel={() => setShowVoiceRecorder(false)}
              />
            )}

            {mediaList.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {mediaList.map((m, i) => (
                  <div key={i} className="relative group p-2 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 shadow-sm">
                    {m.type === 'image' && (
                      <img src={m.url} alt={m.fileName} className="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0" />
                    )}
                    {m.type === 'video' && (
                      <video src={m.url} className="w-12 h-12 rounded-xl object-cover bg-black flex-shrink-0" />
                    )}
                    {m.type === 'audio' && (
                      <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-lg flex-shrink-0">
                        🎤
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <span className="block text-xs font-bold text-slate-800 truncate">
                        {m.fileName || `${m.type.toUpperCase()} Attachment`}
                      </span>
                      <span className="block text-[10px] text-slate-500 uppercase font-semibold">
                        {m.type} {m.size ? `• ${Math.round(m.size / 1024)} KB` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMediaList(prev => prev.filter((_, idx) => idx !== i))}
                      className="w-6 h-6 rounded-full bg-slate-200 hover:bg-rose-500 hover:text-white text-slate-600 flex items-center justify-center text-xs font-bold transition-colors"
                      title="Remove media"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Location Confirmation on Map */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            3. Confirm Your Location on Map
          </label>
          <LocationPickerMap
            location={location}
            onChange={(newLoc) => {
              setLocation(newLoc);
              setIsPinManuallyMoved(true);
            }}
            radiusKm={selectedRadiusKm}
            height="280px"
          />

          <div className="pt-2 flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Initial Search Radius:</span>
            {[2, 5, 10].map(km => (
              <button
                key={km}
                type="button"
                onClick={() => setSelectedRadiusKm(km)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  selectedRadiusKm === km
                    ? 'bg-amber-500 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {km} km
              </button>
            ))}
          </div>
        </div>

        {/* Step 4: Voluntary Reward & Transparent Pricing */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            4. Voluntary Token of Gratitude / Reward (Optional)
          </label>
          <div className="flex items-center gap-3">
            {[0, 50, 100, 200].map(amt => (
              <button
                key={amt}
                type="button"
                onClick={() => setVoluntaryReward(amt)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  voluntaryReward === amt
                    ? 'bg-emerald-600 text-white shadow'
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

          <PricingBreakdownCard breakdown={breakdown} />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-base shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transform active:scale-98 transition-all"
        >
          <span>{submitting ? 'Broadcasting to Helpers...' : 'Broadcast General Help Request'}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
