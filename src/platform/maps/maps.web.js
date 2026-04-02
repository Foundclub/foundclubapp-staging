import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Text, View } from 'react-native';

const DEFAULT_CENTER = {
  lat: 43.2965,
  lng: 5.3698,
};

const TILE_LAYER_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const TILE_LAYER_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const createMarkerIcon = (leaflet, color, isSelected) => leaflet.divIcon({
  className: '',
  html: `<span style="align-items:center;background:${isSelected ? color : `${color}CC`};border:${isSelected ? 3 : 2}px solid rgba(255,255,255,0.92);border-radius:999px;display:flex;height:${isSelected ? 22 : 18}px;justify-content:center;transform:${isSelected ? 'scale(1.08)' : 'scale(1)'};transition:transform .15s ease;width:${isSelected ? 22 : 18}px;"><span style="background:${isSelected ? '#ffffff' : 'rgba(5,28,42,0.96)'};border-radius:999px;display:block;height:8px;width:8px;"></span></span>`,
  iconAnchor: [isSelected ? 11 : 9, isSelected ? 11 : 9],
  iconSize: [isSelected ? 22 : 18, isSelected ? 22 : 18],
});

const resolveMarkerColor = (scope) => (scope === 'clubs' ? '#ffd700' : '#01b3f4');

function LeafletRuntimeMap({
  focusMode = 'results',
  height = 240,
  items = [],
  message = 'Carte web indisponible.',
  onSelectItem,
  scope = 'events',
  selectedItemId = '',
  userLocation = null,
}) {
  const mapNodeRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const mapEntries = useMemo(() => items.filter(Boolean), [items]);

  useEffect(() => {
    let isDisposed = false;
    let cleanup = () => {};

    setIsReady(false);

    (async () => {
      if (!mapNodeRef.current || typeof window === 'undefined') return;

      // eslint-disable-next-line import/no-unresolved
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
      const markerColor = resolveMarkerColor(scope);
      let selectedMarker = null;

      mapEntries.forEach((entry) => {
        const isSelected = entry.id === selectedItemId;
        const marker = leaflet.marker([entry.lat, entry.lng], {
          icon: createMarkerIcon(leaflet, markerColor, isSelected),
        });

        marker.bindPopup(
          entry.subtitle
            ? `<strong>${entry.title}</strong><br/>${entry.subtitle}`
            : `<strong>${entry.title}</strong>`,
        );

        marker.on('click', () => {
          if (typeof onSelectItem === 'function') {
            onSelectItem(entry.id);
          }
        });

        marker.addTo(markersLayer);

        if (isSelected) {
          selectedMarker = marker;
        }
      });

      if (focusMode === 'user' && userLocation) {
        mapInstance.setView([userLocation.lat, userLocation.lng], 14);
      } else if (selectedMarker) {
        mapInstance.setView(selectedMarker.getLatLng(), 13);
        selectedMarker.openPopup();
      } else if (mapEntries.length > 1) {
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
  }, [focusMode, mapEntries, onSelectItem, scope, selectedItemId, userLocation]);

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
  focusMode = 'results',
  height = 240,
  items = [],
  message = 'Carte web indisponible.',
  onSelectItem,
  scope = 'events',
  selectedItemId = '',
  userLocation = null,
} = {}) => (
  <LeafletRuntimeMap
    focusMode={focusMode}
    height={height}
    items={items}
    message={message}
    onSelectItem={onSelectItem}
    scope={scope}
    selectedItemId={selectedItemId}
    userLocation={userLocation}
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
