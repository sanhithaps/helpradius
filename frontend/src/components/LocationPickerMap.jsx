import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

// Fix for default Leaflet marker icon paths in modern Vite bundlers
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const HelperIcon = L.divIcon({
  className: 'custom-helper-icon',
  html: `<div style="background-color: #10b981; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold;">🤝</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

export default function LocationPickerMap({
  location,
  onChange,
  radiusKm = 2,
  nearbyHelpers = [],
  readOnly = false,
  height = '320px'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const helpersLayerRef = useRef(null);

  const hasCoords = location && typeof location.lat === 'number' && typeof location.lng === 'number';

  useEffect(() => {
    if (!mapContainerRef.current || !hasCoords) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [location.lat, location.lng],
        zoom: 14,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Requester draggable marker
      const marker = L.marker([location.lat, location.lng], {
        icon: DefaultIcon,
        draggable: !readOnly
      }).addTo(map);

      if (!readOnly && onChange) {
        marker.on('dragend', (e) => {
          const latlng = e.target.getLatLng();
          onChange({
            lat: Math.round(latlng.lat * 10000) / 10000,
            lng: Math.round(latlng.lng * 10000) / 10000
          });
        });
      }

      // Radius circle
      const circle = L.circle([location.lat, location.lng], {
        radius: (radiusKm || 2) * 1000,
        color: '#e11d48',
        fillColor: '#f43f5e',
        fillOpacity: 0.12,
        weight: 2
      }).addTo(map);

      const helpersGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
      helpersLayerRef.current = helpersGroup;
    } else {
      // Update marker and circle position
      mapInstanceRef.current.setView([location.lat, location.lng]);
      if (markerRef.current) {
        markerRef.current.setLatLng([location.lat, location.lng]);
      }
      if (circleRef.current) {
        circleRef.current.setLatLng([location.lat, location.lng]);
        circleRef.current.setRadius((radiusKm || 2) * 1000);
      }
    }

    // Render nearby helpers
    if (helpersLayerRef.current) {
      helpersLayerRef.current.clearLayers();
      if (Array.isArray(nearbyHelpers)) {
        nearbyHelpers.forEach(h => {
          if (h.location?.lat && h.location?.lng) {
            L.marker([h.location.lat, h.location.lng], { icon: HelperIcon })
              .bindPopup(`<strong>${h.name}</strong><br/>${h.safetyEligible ? 'Verified Safety Helper' : 'Community Helper'}`)
              .addTo(helpersLayerRef.current);
          }
        });
      }
    }
  }, [hasCoords, location?.lat, location?.lng, radiusKm, nearbyHelpers, readOnly]);

  if (!hasCoords) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-3" style={{ height }}>
        <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
        <div className="text-sm font-semibold text-slate-700">Acquiring Live Device GPS...</div>
        <div className="text-xs text-slate-500 max-w-xs">
          Please allow browser location permissions when prompted so helpers can locate you accurately.
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ height }}>
      <div ref={mapContainerRef} className="w-full h-full" />
      {!readOnly && (
        <div className="absolute bottom-2 left-2 z-20 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow text-[11px] font-semibold text-slate-700 pointer-events-none">
          📍 Drag pin to fine-tune your exact pickup / emergency spot
        </div>
      )}
    </div>
  );
}
