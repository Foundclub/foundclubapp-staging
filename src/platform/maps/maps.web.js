import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Text, View } from 'react-native';

import { getLocationCoordinates, normalizeLocationInput } from '@/utils/location';

const DEFAULT_CENTER = {
  lat: 43.2965,
  lng: 5.3698,
};

const TILE_LAYER_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const TILE_LAYER_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const toFiniteNumber = (value) => {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const extractCoordinatesFromObject = (value) => {
  if (!value || typeof value !== 'object') return null;

  const latitude = toFiniteNumber(
    value.lat
    ?? value.latitude
    ?? value.location?.lat
    ?? value.location?.latitude
    ?? value.address?.lat
    ?? value.address?.latitude,
  );
  const longitude = toFiniteNumber(
    value.lng
    ?? value.lon
    ?? value.longitude
    ?? value.location?.lng
    ?? value.location?.lon
    ?? value.location?.longitude
    ?? value.address?.lng
    ?? value.address?.lon
    ?? value.address?.longitude,
  );

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { lat: latitude, lng: longitude };
  }

  return null;
};

const resolveMarkerCoordinates = (item) => {
  const directCoordinates = extractCoordinatesFromObject(item);
  if (directCoordinates) return directCoordinates;

  const locationCandidates = [
    item?.location,
    item?.locationDetails,
    item?.address,
    item?.home_base,
    item?.facility?.address,
    item?.team?.club?.address,
    item?.club?.address,
  ];

  for (const candidate of locationCandidates) {
    const normalizedCoordinates = getLocationCoordinates(candidate);
    if (normalizedCoordinates) return normalizedCoordinates;

    const normalizedLocation = normalizeLocationInput(candidate);
    if (normalizedLocation && Number.isFinite(normalizedLocation.lat) && Number.isFinite(normalizedLocation.lng)) {
      return {
        lat: normalizedLocation.lat,
        lng: normalizedLocation.lng,
      };
    }
  }

  return null;
};

const resolveMarkerLabel = (item, type) => {
  if (type === 'club') {
    return String(item?.name || item?.title || 'Club').trim() || 'Club';
  }

  return String(item?.subject || item?.title || item?.name || 'Evenement').trim() || 'Evenement';
};

const resolveMarkerSubtitle = (item) => {
  const locationCandidates = [
    item?.location,
    item?.locationDetails,
    item?.address,
    item?.facility?.address,
    item?.facility?.name,
    item?.club?.name,
  ];

  for (const candidate of locationCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }

    const normalizedLocation = normalizeLocationInput(candidate);
    if (normalizedLocation?.label) return normalizedLocation.label;
    if (normalizedLocation?.address) return normalizedLocation.address;
    if (normalizedLocation?.city) return normalizedLocation.city;
  }

  return '';
};

const createMarkerIcon = (leaflet, color) => leaflet.divIcon({
  className: '',
  html: `<span style="background:${color};border:3px solid rgba(255,255,255,0.92);border-radius:999px;box-shadow:0 10px 28px rgba(0,18,24,0.3);display:block;height:18px;width:18px;"></span>`,
  iconAnchor: [9, 9],
  iconSize: [18, 18],
});

const resolveMarkerColor = (type) => (type === 'club' ? '#ffd700' : '#01b3f4');

function LeafletRuntimeMap({
  height = 240,
  items = [],
  message = 'Carte web indisponible.',
  onMarkerPress,
  type = 'event',
}) {
  const mapNodeRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const mapEntries = useMemo(() => items
    .map((item) => {
      const coordinates = resolveMarkerCoordinates(item);
      if (!coordinates) return null;

      return {
        item,
        key: String(item?.documentId || item?.id || `${coordinates.lat}-${coordinates.lng}`),
        label: resolveMarkerLabel(item, type),
        lat: coordinates.lat,
        lng: coordinates.lng,
        subtitle: resolveMarkerSubtitle(item),
      };
    })
    .filter(Boolean), [items, type]);

  useEffect(() => {
    let isDisposed = false;
    let cleanup = () => {};

    setIsReady(false);

    (async () => {
      if (!mapNodeRef.current || typeof window === 'undefined') return;

      const leafletModule = await import('leaflet');
      if (isDisposed) return;

      const leaflet = leafletModule.default || leafletModule;
      const mapInstance = leaflet.map(mapNodeRef.current, {
        attributionControl: true,
        scrollWheelZoom: true,
        zoomControl: true,
      });

      leaflet.tileLayer(TILE_LAYER_URL, {
        attribution: TILE_LAYER_ATTRIBUTION,
      }).addTo(mapInstance);

      const markersLayer = leaflet.featureGroup().addTo(mapInstance);
      const markerColor = resolveMarkerColor(type);

      mapEntries.forEach((entry) => {
        const marker = leaflet.marker([entry.lat, entry.lng], {
          icon: createMarkerIcon(leaflet, markerColor),
        });

        marker.bindPopup(
          entry.subtitle
            ? `<strong>${entry.label}</strong><br/>${entry.subtitle}`
            : `<strong>${entry.label}</strong>`,
        );

        marker.on('click', () => {
          if (typeof onMarkerPress === 'function') {
            onMarkerPress(entry.item);
          }
        });

        marker.addTo(markersLayer);
      });

      if (mapEntries.length > 1) {
        mapInstance.fitBounds(markersLayer.getBounds(), {
          maxZoom: 13,
          padding: [28, 28],
        });
      } else if (mapEntries.length === 1) {
        mapInstance.setView([mapEntries[0].lat, mapEntries[0].lng], 13);
      } else {
        mapInstance.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 6);
      }

      setIsReady(true);

      cleanup = () => {
        mapInstance.remove();
      };
    })().catch(() => {
      if (!isDisposed) {
        setIsReady(true);
      }
    });

    return () => {
      isDisposed = true;
      cleanup();
    };
  }, [mapEntries, onMarkerPress, type]);

  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 18,
        borderWidth: 1,
        height,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div ref={mapNodeRef} style={{ height: '100%', width: '100%' }} />
      {!isReady ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(7, 24, 35, 0.28)',
            inset: 0,
            justifyContent: 'center',
            position: 'absolute',
          }}
        >
          <Text style={{ color: '#e9f2ff', textAlign: 'center' }}>Chargement de la carte...</Text>
        </View>
      ) : null}
      {isReady && mapEntries.length === 0 ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(7, 24, 35, 0.58)',
            borderRadius: 14,
            bottom: 12,
            left: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            position: 'absolute',
            right: 12,
          }}
        >
          <Text style={{ color: '#e9f2ff', textAlign: 'center' }}>{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

export const renderMap = ({
  height = 240,
  items = [],
  message = 'Carte web indisponible.',
  onMarkerPress,
  type = 'event',
} = {}) => (
  <LeafletRuntimeMap
    height={height}
    items={items}
    message={message}
    onMarkerPress={onMarkerPress}
    type={type}
  />
);

export const openExternalMap = async ({ label, latitude, longitude }) => {
  if (typeof window === 'undefined') return;
  const query = encodeURIComponent(label || `${latitude},${longitude}`);
  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
};

export default {
  openExternalMap,
  renderMap,
};
