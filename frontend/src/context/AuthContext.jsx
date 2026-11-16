import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [helperProfile, setHelperProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState({
    lat: 12.9716, // Bengaluru default
    lng: 77.5946,
    accuracy: 10,
    address: 'Bengaluru Central, Karnataka'
  });

  // Track browser geolocation on load
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            address: 'Current GPS Location'
          };
          setUserLocation(loc);
          // Inform backend to position seed helpers nearby
          api.post('/seed/relocate', { lat: loc.lat, lng: loc.lng }).catch(() => {});
        },
        (err) => {
          console.warn('Geolocation warning (using default Indian tech hub coords):', err.message);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

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
      const res = await api.patch('/helpers/me/availability', {
        isAvailable: nextAvailable
      });
      setHelperProfile(prev => ({ ...(prev || res.data.helper || {}), isAvailable: res.data.isAvailable }));
    } catch (e) {
      console.error('Failed to toggle availability', e);
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
