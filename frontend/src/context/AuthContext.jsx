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

    // Fallback to real network IP geolocation when browser blocks HTML5 geolocation (e.g. HTTP on LAN)
    const fetchFallbackLocation = async (reason) => {
      try {
        const res = await api.get('/location/detect');
        if (res.data && typeof res.data.lat === 'number' && typeof res.data.lng === 'number') {
          if (!isMounted) return;
          const loc = {
            lat: res.data.lat,
            lng: res.data.lng,
            accuracy: res.data.accuracy || 2000,
            city: res.data.city || 'Current Area',
            address: res.data.address || 'Live Network Location',
            isLive: true,
            isNetworkFallback: true,
            source: res.data.source,
            error: null,
            updatedAt: new Date().toISOString()
          };

          setUserLocation(loc);
          try {
            sessionStorage.setItem('helpradius_device_gps', JSON.stringify(loc));
          } catch (e) {}

          api.post('/seed/relocate', { lat: loc.lat, lng: loc.lng }).catch(() => {});

          const token = localStorage.getItem('help_radius_token');
          if (token) {
            api.put('/helpers/me/location', { lat: loc.lat, lng: loc.lng }).catch(() => {});
          }
        }
      } catch (fallbackErr) {
        console.warn('Network location fallback error:', fallbackErr);
      }
    };

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
        isNetworkFallback: false,
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
      console.warn('Browser geolocation acquisition warning:', err.message);
      // Immediately fallback to real live network/IP geolocation so coordinates are never empty
      fetchFallbackLocation(err.message);
    };

    // If on insecure origin (HTTP on LAN IP), browser blocks navigator.geolocation immediately
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      console.info('HTTP LAN context detected: using live network/IP geolocation fallback.');
      fetchFallbackLocation('insecure_origin');
    }

    // Attempt browser hardware / Wi-Fi geolocation with graceful accuracy fallback
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (err) => {
          // If high accuracy fails on laptop (e.g. no satellite chip), retry with standard Wi-Fi accuracy
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            handleError,
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
          );
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      fetchFallbackLocation('no_geolocation_api');
    }

    // Continuous watcher when available
    let watchId = null;
    if ('geolocation' in navigator && (typeof window === 'undefined' || window.isSecureContext)) {
      watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000
      });
    }

    return () => {
      isMounted = false;
      if (navigator.geolocation && navigator.geolocation.clearWatch && watchId != null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Fetch a fresh position snapshot on demand (e.g. before SOS dispatch or manual trigger)
  const getFreshDevicePosition = (options = {}) => {
    return new Promise((resolve) => {
      const forceHardware = options?.forceHardware || false;

      // If insecure origin (HTTP on LAN), return current or network fallback immediately unless forceHardware requested
      if (typeof window !== 'undefined' && !window.isSecureContext && !forceHardware) {
        if (userLocation?.lat != null && userLocation?.lng != null) {
          return resolve(userLocation);
        }
        return api.get('/location/detect')
          .then(res => {
            const loc = {
              lat: res.data.lat,
              lng: res.data.lng,
              accuracy: res.data.accuracy || 2000,
              address: res.data.address || 'Live Network Location',
              city: res.data.city,
              isLive: true,
              isNetworkFallback: true,
              updatedAt: new Date().toISOString()
            };
            setUserLocation(loc);
            resolve(loc);
          })
          .catch(() => resolve(userLocation));
      }

      if (!('geolocation' in navigator)) {
        return resolve(userLocation);
      }

      const applyPos = async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 0);
        const address = await reverseGeocode(lat, lng).catch(() => `Live GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        const loc = {
          lat,
          lng,
          accuracy,
          address,
          isLive: true,
          isNetworkFallback: false,
          error: null,
          updatedAt: new Date().toISOString()
        };
        setUserLocation(loc);
        try {
          sessionStorage.setItem('helpradius_device_gps', JSON.stringify(loc));
        } catch (e) {}
        api.post('/seed/relocate', { lat, lng }).catch(() => {});
        resolve(loc);
      };

      navigator.geolocation.getCurrentPosition(
        applyPos,
        (err) => {
          // If high accuracy failed (e.g. timeout on laptop without GPS chip), retry with standard Wi-Fi accuracy
          navigator.geolocation.getCurrentPosition(
            applyPos,
            async (err2) => {
              console.warn('getFreshDevicePosition fallback triggered:', err2.message);
              if (userLocation?.lat != null && userLocation?.lng != null) {
                return resolve(userLocation);
              }
              try {
                const res = await api.get('/location/detect');
                const loc = {
                  lat: res.data.lat,
                  lng: res.data.lng,
                  accuracy: res.data.accuracy || 2000,
                  address: res.data.address || 'Live Network Location',
                  city: res.data.city,
                  isLive: true,
                  isNetworkFallback: true,
                  updatedAt: new Date().toISOString()
                };
                setUserLocation(loc);
                resolve(loc);
              } catch (e) {
                resolve(userLocation);
              }
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
          );
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    });
  };

  // Set user manual location from map or city search
  const setUserManualLocation = async ({ lat, lng, address, city }) => {
    let finalAddress = address;
    if (!finalAddress) {
      try {
        finalAddress = await reverseGeocode(lat, lng);
      } catch (e) {
        finalAddress = `Custom Spot (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }
    }

    const loc = {
      lat,
      lng,
      accuracy: 30,
      city: city || finalAddress.split(',')[0],
      address: finalAddress,
      isLive: true,
      isManual: true,
      error: null,
      updatedAt: new Date().toISOString()
    };

    setUserLocation(loc);
    try {
      sessionStorage.setItem('helpradius_device_gps', JSON.stringify(loc));
    } catch (e) {}

    api.post('/seed/relocate', { lat, lng }).catch(() => {});
    const token = localStorage.getItem('help_radius_token');
    if (token) {
      api.put('/helpers/me/location', { lat, lng }).catch(() => {});
    }
    return loc;
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
        setUserManualLocation,
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
