import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { calculateHaversineDistance } from '../utils/clientDistance';

export function useLiveLocation(requestId, requestStatus, isHelper) {
  const { socket, isConnected } = useSocket();
  const [isSharing, setIsSharing] = useState(true);
  const [error, setError] = useState(null);
  const [lastCoords, setLastCoords] = useState(null);

  const watchIdRef = useRef(null);
  const lastEmittedRef = useRef({ time: 0, lat: 0, lng: 0 });

  const isActive = (requestStatus === 'accepted' || requestStatus === 'in_progress') && isHelper && isSharing;

  useEffect(() => {
    if (!isActive || !requestId || !navigator.geolocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    const handleSuccess = (position) => {
      const { latitude: lat, longitude: lng, accuracy, heading, speed } = position.coords;
      const now = Date.now();

      setLastCoords({ lat, lng, accuracy, heading, speed, updatedAt: new Date().toISOString() });
      setError(null);

      // Throttle: at most once every 3 seconds, and skip if moved < 10 meters (0.01 km)
      const last = lastEmittedRef.current;
      const timeSinceLast = now - last.time;
      const distanceMovedKm = calculateHaversineDistance(last.lat, last.lng, lat, lng);

      if (timeSinceLast < 3000) return;
      if (last.time > 0 && distanceMovedKm < 0.01) return; // less than 10 meters

      lastEmittedRef.current = { time: now, lat, lng };

      if (socket && isConnected) {
        socket.emit('helper:location', {
          requestId,
          lat,
          lng,
          accuracy,
          heading: heading || null,
          speed: speed || null
        });
      }
    };

    const handleError = (err) => {
      let msg = 'Unable to acquire live location.';
      if (err.code === 1) msg = 'Location permission denied. Please grant browser location access.';
      if (err.code === 2) msg = 'Location unavailable. Verify GPS is turned on.';
      if (err.code === 3) msg = 'Location acquisition timed out.';
      setError(msg);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isActive, requestId, socket, isConnected]);

  const stopSharing = () => {
    if (window.confirm('Stop sharing your live location with the requester?')) {
      setIsSharing(false);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }
  };

  const startSharing = () => setIsSharing(true);

  return {
    isSharing,
    error,
    lastCoords,
    stopSharing,
    startSharing
  };
}
