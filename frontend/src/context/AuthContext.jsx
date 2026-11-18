import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const parts = [
        addr.amenity || addr.building || addr.road || addr.neighbourhood || addr.suburb,
        addr.city || addr.town || addr.village || addr.county,
        addr.state
      ].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
      if (data.display_name) {
        return data.display_name.split(',').slice(0, 3).join(',').trim();
      }
    }
  } catch (e) {
    // network or rate limit fallback
  }
  return `GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [helperProfile, setHelperProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(() => {
    try {
      const saved = sessionStorage.getItem('helpradius_device_gps');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return {
      lat: null,
      lng: null,
      accuracy: null,
      address: 'Acquiring live device GPS...',
      isLive: false,
      error: null
    };
  });

  // Track browser device hardware geolocation continuously
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setUserLocation(prev => ({
        ...prev,
        address: 'Geolocation is not supported by this browser',
        error: 'Not supported'
      }));
      return;
    }

    let isMounted = true;

    const handleSuccess = async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy);

      let address = 'Acquiring location name...';
      try {
        address = await reverseGeocode(lat, lng);
      } catch (e) {
        address = `Live Device GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }

      if (!isMounted) return;

      const loc = {
        lat,
        lng,
        accuracy,
        address,
        isLive: true,
        error: null,
        updatedAt: new Date().toISOString()
      };

      setUserLocation(loc);
      try {
        sessionStorage.setItem('helpradius_device_gps', JSON.stringify(loc));
      } catch (e) {}

      // Relocate seed helpers dynamically around live device coords for local simulation
      api.post('/seed/relocate', { lat, lng }).catch(() => {});

      // If user is logged in, sync helper live location to backend
      const token = localStorage.getItem('help_radius_token');
      if (token) {
        api.put('/helpers/me/location', { lat, lng }).catch(() => {});
      }
    };

    const handleError = (err) => {
      console.warn('Geolocation acquisition error:', err.message);
      if (!isMounted) return;
      setUserLocation(prev => {
        if (prev.lat != null) return prev;
        return {
          ...prev,
          address: 'Please allow browser location permissions for live device GPS',
          error: err.message
        };
      });
    };

    // 1. Immediate position fix
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    // 2. Continuous position watcher
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 3000
    });

    return () => {
      isMounted = false;
      if (navigator.geolocation.clearWatch && watchId != null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Fetch a fresh high-accuracy position snapshot on demand (e.g. before SOS dispatch)
  const getFreshDevicePosition = () => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        return reject(new Error('Geolocation not supported on this device'));
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy);
          const address = await reverseGeocode(lat, lng).catch(() => `Live GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          const loc = {
            lat,
            lng,
            accuracy,
            address,
            isLive: true,
            error: null,
            updatedAt: new Date().toISOString()
          };
          setUserLocation(loc);
          try {
            sessionStorage.setItem('helpradius_device_gps', JSON.stringify(loc));
          } catch (e) {}
          resolve(loc);
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  };

  // Fetch current user if token exists
  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('help_radius_token');
    if (!token) {
      setUser(null);
      setHelperProfile(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/users/me');
      setUser(res.data.user);
      setHelperProfile(res.data.helper);
    } catch (err) {
      console.warn('Could not restore user from token:', err);
      localStorage.removeItem('help_radius_token');
      setUser(null);
      setHelperProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Login with custom email or phone
  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    localStorage.setItem('help_radius_token', res.data.token);
    setUser(res.data.user);
    setHelperProfile(res.data.helper || null);
    return res.data;
  };

  // Register with full custom details
  const register = async (userData) => {
    const res = await api.post('/auth/register', userData);
    localStorage.setItem('help_radius_token', res.data.token);
    setUser(res.data.user);
    setHelperProfile(res.data.helper || null);
    return res.data;
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('help_radius_token');
    setUser(null);
    setHelperProfile(null);
  };

  // Toggle helper availability
  const toggleAvailability = async () => {
    try {
      const nextAvailable = helperProfile ? !helperProfile.isAvailable : true;
      const payload = { isAvailable: nextAvailable };
      if (userLocation?.lat != null && userLocation?.lng != null) {
        payload.lat = userLocation.lat;
        payload.lng = userLocation.lng;
      }
      const res = await api.patch('/helpers/me/availability', payload);
      setHelperProfile(prev => ({ ...(prev || res.data.helper || {}), isAvailable: res.data.isAvailable }));
      return res.data;
    } catch (e) {
      console.error('Failed to toggle availability', e);
      throw e;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        helperProfile,
        loading,
        userLocation,
        setUserLocation,
        getFreshDevicePosition,
        login,
        register,
        logout,
        toggleAvailability,
        refreshUser: fetchCurrentUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
