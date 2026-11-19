import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  MapPin,
  X,
  Search,
  Navigation,
  Globe,
  Check,
  ShieldAlert,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import api from '../services/api';

const QUICK_PRESETS = [
  { name: 'Mysuru (NIE Campus / Central)', lat: 12.2842, lng: 76.6415, city: 'Mysuru' },
  { name: 'Bengaluru (MG Road / Central)', lat: 12.9756, lng: 77.6066, city: 'Bengaluru' },
  { name: 'Bengaluru (Koramangala)', lat: 12.9352, lng: 77.6245, city: 'Bengaluru' },
  { name: 'Bengaluru (Indiranagar)', lat: 12.9784, lng: 77.6408, city: 'Bengaluru' },
  { name: 'Bengaluru (Hebbal)', lat: 13.0358, lng: 77.5970, city: 'Bengaluru' },
  { name: 'Mangaluru', lat: 12.9141, lng: 74.8560, city: 'Mangaluru' },
  { name: 'Hubballi', lat: 15.3647, lng: 75.1240, city: 'Hubballi' }
];

export default function LocationSelectorModal({ isOpen, onClose }) {
  const { userLocation, setUserManualLocation, getFreshDevicePosition } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  if (!isOpen) return null;

  const isHttpInsecure = typeof window !== 'undefined' && !window.isSecureContext && window.location.protocol === 'http:';

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setStatusMsg(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=5`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data || []);
        if (!data || data.length === 0) {
          setStatusMsg('No matching locations found. Try entering city or area name.');
        }
      }
    } catch (err) {
      setStatusMsg('Could not search location. Please check your internet connection.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = async (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    await setUserManualLocation({
      lat,
      lng,
      address: item.display_name.split(',').slice(0, 3).join(',').trim()
    });
    onClose();
  };

  const handleSelectPreset = async (preset) => {
    await setUserManualLocation({
      lat: preset.lat,
      lng: preset.lng,
      address: `${preset.name}, Karnataka`
    });
    onClose();
  };

  const handleDetectNetwork = async () => {
    setDetecting(true);
    setStatusMsg(null);
    try {
      const res = await api.get('/location/detect');
      if (res.data && typeof res.data.lat === 'number') {
        await setUserManualLocation({
          lat: res.data.lat,
          lng: res.data.lng,
          address: res.data.address
        });
        onClose();
      }
    } catch (e) {
      setStatusMsg('Network detection failed. Please select from presets or search above.');
    } finally {
      setDetecting(false);
    }
  };

  const handleHardwareGps = async () => {
    setDetecting(true);
    setStatusMsg(null);
    try {
      const loc = await getFreshDevicePosition();
      if (loc?.lat != null) {
        onClose();
      } else {
        setStatusMsg('Hardware GPS not permitted or unavailable on this device. Using Network location.');
      }
    } catch (e) {
      setStatusMsg('Could not acquire hardware GPS. Please allow browser location permissions.');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Device GPS & Location Setup
              </h2>
              <span className="text-[11px] text-slate-500 block">
                Set accurate live coordinates for SOS radius and nearby helpers
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Insecure Origin Notice for Friend's Laptop */}
          {isHttpInsecure && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Accessing over HTTP (Not Secure):</span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Browsers restrict hardware satellite GPS on unencrypted HTTP local IPs. 
                    Help Radius automatically uses <strong>Live Network / Wi-Fi Geolocation</strong> so you can dispatch and accept requests immediately!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Current Active Location Pill */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-extrabold text-slate-500 uppercase text-[10px] tracking-wider block">
                Active Location on this Device
              </span>
              <span className="font-bold text-slate-900 block truncate max-w-[280px]">
                {userLocation?.address || 'Acquiring location...'}
              </span>
              {userLocation?.lat != null && userLocation?.lng != null && (
                <span className="text-[10px] text-slate-500 font-mono block">
                  Latitude: {userLocation.lat.toFixed(4)}, Longitude: {userLocation.lng.toFixed(4)}
                  {userLocation.isNetworkFallback ? ' (Live Network/Wi-Fi)' : ' (Live GPS)'}
                </span>
              )}
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          </div>

          {/* Quick Auto-Detect Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleDetectNetwork}
              disabled={detecting}
              className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Detect via Network</span>
            </button>

            <button
              type="button"
              onClick={handleHardwareGps}
              disabled={detecting}
              className="p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all"
            >
              <Navigation className="w-4 h-4 text-rose-600" />
              <span>Browser GPS Check</span>
            </button>
          </div>

          {/* Location Search Bar */}
          <form onSubmit={handleSearch} className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Search by Street, Landmark, or City
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="e.g. Mysuru NIE, Koramangala, Hebbal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-3 pl-10 rounded-2xl border border-slate-200 text-xs outline-none focus:border-rose-500 transition-colors"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all"
              >
                {searching ? 'Finding...' : 'Search'}
              </button>
            </div>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200 p-2">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectResult(item)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-rose-50 transition-colors text-xs flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2 text-slate-800 font-medium">{item.display_name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Status Message */}
          {statusMsg && (
            <div className="p-3 rounded-xl bg-slate-100 text-xs text-slate-700">
              {statusMsg}
            </div>
          )}

          {/* Quick City Presets */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Quick Locality Presets (Instant 1-Click Set):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-rose-500 hover:text-rose-600 text-slate-700 text-xs font-semibold transition-all"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
