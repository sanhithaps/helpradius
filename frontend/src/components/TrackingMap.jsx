import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { calculateHaversineDistance, estimateETA } from '../utils/clientDistance';
import { getRoute } from '../services/routing';
import { Navigation, Compass, AlertCircle, RefreshCw } from 'lucide-react';

const RequesterIcon = L.divIcon({
  className: 'requester-pin',
  html: `<div style="background-color: #e11d48; width: 34px; height: 34px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(225,29,72,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">📍</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

const HelperIcon = L.divIcon({
  className: 'helper-pin',
  html: `<div style="background-color: #10b981; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(16,185,129,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; transition: transform 0.8s ease-out;">🚴</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

export default function TrackingMap({
  requesterLocation,
  helperLocation,
  helperName = 'Assigned Helper',
  height = '380px'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const requesterMarkerRef = useRef(null);
  const helperMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const initialFitDoneRef = useRef(false);

  const [routeData, setRouteData] = useState(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);

  // Update timer tracking seconds since last helper location update
  useEffect(() => {
    setSecondsSinceUpdate(0);
    const interval = setInterval(() => {
      setSecondsSinceUpdate((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [helperLocation?.updatedAt, helperLocation?.lat, helperLocation?.lng]);

  // Fetch road route from OSRM
  useEffect(() => {
    if (!requesterLocation?.lat || !helperLocation?.lat) return;

    let isCancelled = false;
    getRoute(helperLocation, requesterLocation).then((res) => {
      if (!isCancelled && res) {
        setRouteData(res);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    Math.round((helperLocation?.lat || 0) * 1000),
    Math.round((helperLocation?.lng || 0) * 1000),
    requesterLocation?.lat,
    requesterLocation?.lng
  ]);

  // Leaflet map setup and marker positioning
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!requesterLocation?.lat || !helperLocation?.lat) return;

    const rLat = requesterLocation.lat;
    const rLng = requesterLocation.lng;
    const hLat = helperLocation.lat;
    const hLng = helperLocation.lng;

    const coordsToDraw = routeData?.coordinates || [
      [hLat, hLng],
      [rLat, rLng]
    ];

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [(rLat + hLat) / 2, (rLng + hLng) / 2],
        zoom: 14,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Requester marker
      const rMarker = L.marker([rLat, rLng], { icon: RequesterIcon })
        .bindPopup('<strong>Requester Location</strong>')
        .addTo(map);

      // Helper marker
      const hMarker = L.marker([hLat, hLng], { icon: HelperIcon })
        .bindPopup(`<strong>${helperName}</strong> (Live Helper)`)
        .addTo(map);

      // Route polyline connecting them
      const polyline = L.polyline(coordsToDraw, {
        color: routeData?.isRoadRoute ? '#2563eb' : '#64748b',
        weight: 5,
        opacity: 0.85,
        dashArray: routeData?.isRoadRoute ? null : '6, 8'
      }).addTo(map);

      mapInstanceRef.current = map;
      requesterMarkerRef.current = rMarker;
      helperMarkerRef.current = hMarker;
      polylineRef.current = polyline;

      map.fitBounds([[rLat, rLng], [hLat, hLng]], { padding: [50, 50] });
      initialFitDoneRef.current = true;
    } else {
      // Update markers
      if (requesterMarkerRef.current) requesterMarkerRef.current.setLatLng([rLat, rLng]);
      if (helperMarkerRef.current) {
        helperMarkerRef.current.setLatLng([hLat, hLng]);
      }
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(coordsToDraw);
        polylineRef.current.setStyle({
          color: routeData?.isRoadRoute ? '#2563eb' : '#64748b',
          dashArray: routeData?.isRoadRoute ? null : '6, 8'
        });
      }

      if (!initialFitDoneRef.current) {
        mapInstanceRef.current.fitBounds([[rLat, rLng], [hLat, hLng]], { padding: [50, 50] });
        initialFitDoneRef.current = true;
      }
    }
  }, [requesterLocation, helperLocation, helperName, routeData]);

  const handleRecenter = () => {
    if (!mapInstanceRef.current || !requesterLocation?.lat || !helperLocation?.lat) return;
    mapInstanceRef.current.fitBounds(
      [
        [requesterLocation.lat, requesterLocation.lng],
        [helperLocation.lat, helperLocation.lng]
      ],
      { padding: [50, 50] }
    );
  };

  const distance = routeData?.distanceKm ?? (
    (requesterLocation?.lat && helperLocation?.lat)
      ? calculateHaversineDistance(requesterLocation.lat, requesterLocation.lng, helperLocation.lat, helperLocation.lng)
      : 1.2
  );

  const eta = routeData?.durationMin ?? estimateETA(distance);
  const isStale = secondsSinceUpdate > 30;

  return (
    <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-md" style={{ height }}>
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Live Tracking HUD */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-slate-700/60 flex items-center gap-3 pointer-events-auto">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Live Assistance Tracking</span>
              <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                routeData?.isRoadRoute ? 'bg-blue-900/80 text-blue-300' : 'bg-slate-800 text-slate-400'
              }`}>
                {routeData?.isRoadRoute ? 'Road Route (OSRM)' : 'Straight-line'}
              </span>
            </div>
            <span className="text-xs font-black text-white flex items-center gap-1.5">
              <span>{helperName} is en route</span>
            </span>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-slate-200 text-right pointer-events-auto">
          <div className="flex items-center justify-end gap-1 text-[10px] font-bold">
            <span className={isStale ? 'text-amber-600' : 'text-slate-500'}>
              {secondsSinceUpdate <= 3 ? 'Updated just now' : `Updated ${secondsSinceUpdate}s ago`}
            </span>
            {isStale && <AlertCircle className="w-3 h-3 text-amber-500" />}
          </div>
          <div className="text-xs font-black text-slate-900">
            <span className="text-rose-600 font-extrabold text-sm">{distance} km</span> • ~{eta} mins
          </div>
        </div>
      </div>

      {/* Re-center Control Button */}
      <button
        type="button"
        onClick={handleRecenter}
        className="absolute bottom-3 right-3 z-20 bg-white/95 hover:bg-white text-slate-700 p-2.5 rounded-2xl shadow-lg border border-slate-200 flex items-center gap-1.5 text-xs font-extrabold pointer-events-auto active:scale-95 transition-all"
        title="Re-centre Route"
      >
        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
        <span className="hidden sm:inline">Re-centre</span>
      </button>
    </div>
  );
}
