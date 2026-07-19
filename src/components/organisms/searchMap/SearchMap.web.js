import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import SearchMapPreviewCard from '@/components/molecules/searchMapPreviewCard/SearchMapPreviewCard';
import SearchMapHud from '@/components/organisms/searchMap/SearchMapHud';

import {
  getSearchMapEmptyMessage,
  getSearchMapNoCoordinatesMessage,
} from '@/utils/searchMap';

import mapsPlatform from '@/platform/maps';
import { buildSearchMapRenderableModel } from '@/platform/maps/searchMapClustering';
import { requestCurrentSearchMapLocation } from '@/platform/maps/searchMapGeolocation';

const resolveMeasuredOverlayInsets = (
  overlayInsets,
  controlsWidth,
  previewBottomOffset,
  previewHeight,
  summaryWidth,
) => ({
  bottom: Math.max(
    132,
    Number(overlayInsets?.bottom) || 0,
    previewBottomOffset + (previewHeight > 0 ? previewHeight + 18 : 44),
  ),
  left: Math.max(
    24,
    Number(overlayInsets?.left) || 0,
    summaryWidth > 0 ? Math.min(summaryWidth + 24, 204) : 0,
  ),
  right: Math.max(
    24,
    Number(overlayInsets?.right) || 0,
    controlsWidth > 0 ? controlsWidth + 24 : 0,
  ),
  top: Math.max(72, Number(overlayInsets?.top) || 0),
});

/**
 * Web map explorer aligned with the shared mobile props.
 * @param {object} props
 * @param {number} [props.height]
 * @param {boolean} [props.isLoadingResults]
 * @param {import('@/utils/searchMap').SearchMapItem[]} [props.items]
 * @param {{
 *  lat: number;
 *  lng: number;
 *  zoom?: number;
 *  north?: number;
 *  south?: number;
 *  east?: number;
 *  west?: number;
 *  latitudeDelta?: number;
 *  longitudeDelta?: number;
 * } | null} [props.focusedViewport]
 * @param {(item: import('@/utils/searchMap').SearchMapItem) => void} [props.onOpenItem]
 * @param {(region: { lat: number; lng: number; zoom?: number }) => void} [props.onRegionChangeComplete]
 * @param {(itemId: string) => void} [props.onSelectItem]
 * @param {() => void} [props.onShowList]
 * @param {'camera' | 'highlight-only'} [props.selectionFocusBehavior]
 * @param {'manual' | 'debounced-auto'} [props.refreshStrategy]
 * @param {(stats: {
 *  dataCount?: number,
 *  renderableCount?: number,
 *  markerCount?: number,
 *  clusterCount?: number,
 *  fallbackActive?: boolean,
 * }) => void} [props.onRenderStats]
 * @param {{ top?: number, right?: number, bottom?: number, left?: number }} [props.overlayInsets]
 * @param {number} [props.previewBottomOffset]
 * @param {{ lat: number, lng: number, zoom?: number } | null} [props.regionHint]
 * @param {string} [props.selectedItemId]
 * @param {'events' | 'clubs' | 'reservations'} [props.scope]
 * @param {number} [props.topMargin]
 * @param {number} [props.totalCount]
 * @param {boolean} [props.truncated]
 * @returns {import('react').ReactElement}
 */
function SearchMap({
  aggregates = null,
  focusedViewport = null,
  height = 360,
  isLoadingResults = false,
  items = [],
  onOpenItem,
  onRegionChangeComplete,
  onRenderStats,
  onSelectItem,
  onShowList,
  overlayInsets = null,
  previewBottomOffset = 12,
  refreshStrategy = 'manual',
  regionHint = null,
  scope = 'events',
  selectedItemId,
  selectionFocusBehavior = 'camera',
  topMargin = 12,
  totalCount = 0,
  truncated = false,
}) {
  const { renderMap } = mapsPlatform;
  const {
    Alignments,
    Fonts,
    Spaces,
  } = useTheme();
  const [internalSelectedItemId, setInternalSelectedItemId] = useState('');
  const [mapCommand, setMapCommand] = useState(null);
  const [focusMode, setFocusMode] = useState(/** @type {'results' | 'selected' | 'user' | 'region'} */ ('results'));
  const [providerRenderStats, setProviderRenderStats] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [focusedRegion, setFocusedRegion] = useState(regionHint);
  const [visibleViewport, setVisibleViewport] = useState(focusedViewport || regionHint || null);
  const [hudControlsWidth, setHudControlsWidth] = useState(0);
  const [hudSummaryWidth, setHudSummaryWidth] = useState(0);
  const [previewCardHeight, setPreviewCardHeight] = useState(0);
  const hasValidRegionHint = useCallback((value) => (
    !!value
    && Number.isFinite(Number(value.lat))
    && Number.isFinite(Number(value.lng))
  ), []);

  const activeSelectedItemId = selectedItemId ?? internalSelectedItemId;
  const selectedItem = useMemo(
    () => items.find((item) => item.id === activeSelectedItemId) || null,
    [activeSelectedItemId, items],
  );
  const activeViewport = visibleViewport || focusedViewport || focusedRegion || regionHint || null;
  const renderModel = useMemo(
    () => buildSearchMapRenderableModel({
      aggregates,
      items,
      viewport: activeViewport,
    }),
    [activeViewport, aggregates, items],
  );
  const renderItems = renderModel.entries;
  const renderStats = renderModel.stats;
  const totalResults = Number.isFinite(totalCount) && totalCount > 0 ? totalCount : items.length;
  const visibleMarkerCount = Math.max(
    0,
    Number(renderStats?.markerCount || 0) + Number(renderStats?.clusterCount || 0),
  );
  const resolvedOverlayInsets = useMemo(
    () => resolveMeasuredOverlayInsets(
      overlayInsets,
      hudControlsWidth,
      previewBottomOffset,
      previewCardHeight,
      hudSummaryWidth,
    ),
    [hudControlsWidth, hudSummaryWidth, overlayInsets, previewBottomOffset, previewCardHeight],
  );
  const emptyMessage = totalResults > 0 && items.length === 0
    ? getSearchMapNoCoordinatesMessage(scope, totalResults)
    : getSearchMapEmptyMessage(scope);

  useEffect(() => {
    onRenderStats?.(renderStats || null);
  }, [onRenderStats, renderStats]);

  useEffect(() => {
    if (!__DEV__ || !providerRenderStats) {
      return;
    }

    const sharedSignature = JSON.stringify({
      clusterCount: renderStats?.clusterCount || 0,
      dataCount: renderStats?.dataCount || 0,
      fallbackActive: Boolean(renderStats?.fallbackActive),
      markerCount: renderStats?.markerCount || 0,
      renderableCount: renderStats?.renderableCount || 0,
    });
    const providerSignature = JSON.stringify({
      clusterCount: providerRenderStats?.clusterCount || 0,
      dataCount: providerRenderStats?.dataCount || 0,
      fallbackActive: Boolean(providerRenderStats?.fallbackActive),
      markerCount: providerRenderStats?.markerCount || 0,
      renderableCount: providerRenderStats?.renderableCount || 0,
    });

    if (sharedSignature !== providerSignature) {
      console.log('[search-map-web] provider stats mismatch', {
        provider: providerRenderStats,
        refreshStrategy,
        shared: renderStats,
      });
    }
  }, [providerRenderStats, refreshStrategy, renderStats]);

  useEffect(() => {
    if (selectedItemId === undefined) {
      if (internalSelectedItemId && !items.some((item) => item.id === internalSelectedItemId)) {
        setInternalSelectedItemId('');
        setFocusMode(hasValidRegionHint(regionHint) ? 'region' : 'results');
      }
      return;
    }

    setFocusMode((current) => {
      if (selectedItemId) {
        if (selectionFocusBehavior !== 'highlight-only') {
          return 'selected';
        }

        if (current === 'user') {
          return current;
        }

        return hasValidRegionHint(regionHint) ? 'region' : 'results';
      }

      if (current === 'user') {
        return current;
      }

      return hasValidRegionHint(regionHint) ? 'region' : 'results';
    });
  }, [hasValidRegionHint, internalSelectedItemId, items, regionHint, selectedItemId, selectionFocusBehavior]);

  useEffect(() => {
    if (!regionHint || !Number.isFinite(regionHint.lat) || !Number.isFinite(regionHint.lng)) {
      return;
    }

    setFocusedRegion(regionHint);
    setFocusMode('region');
  }, [regionHint]);

  useEffect(() => {
    if (!focusedViewport || !Number.isFinite(Number(focusedViewport.lat)) || !Number.isFinite(Number(focusedViewport.lng))) {
      return;
    }

    setVisibleViewport((current) => {
      if (!current) {
        return focusedViewport;
      }

      const sameCenter = Math.abs(Number(current.lat) - Number(focusedViewport.lat)) < 0.0001
        && Math.abs(Number(current.lng) - Number(focusedViewport.lng)) < 0.0001;
      const sameZoom = !Number.isFinite(Number(current.zoom))
        || !Number.isFinite(Number(focusedViewport.zoom))
        || Math.abs(Number(current.zoom) - Number(focusedViewport.zoom)) < 0.1;

      return sameCenter && sameZoom ? current : focusedViewport;
    });
  }, [focusedViewport]);

  const handleSelectItem = (itemId) => {
    if (selectedItemId === undefined) {
      setInternalSelectedItemId(itemId);
    }
    setFocusMode((current) => {
      if (selectionFocusBehavior !== 'highlight-only') {
        return 'selected';
      }

      if (current === 'user') {
        return current;
      }

      if (hasValidRegionHint(focusedRegion)) {
        return 'region';
      }

      return current === 'selected' ? 'results' : current;
    });
    onSelectItem?.(itemId);
  };

  const handleOpenSelectedItem = useCallback((itemId) => {
    const targetItem = items.find((item) => item.id === itemId);
    if (!targetItem) {
      return;
    }

    onOpenItem?.(targetItem);
  }, [items, onOpenItem]);

  const handleClearSelection = () => {
    if (selectedItemId === undefined) {
      setInternalSelectedItemId('');
    }
    setFocusMode(hasValidRegionHint(focusedRegion) ? 'region' : 'results');
    onSelectItem?.('');
  };

  const handleLocateMe = async () => {
    const coordinates = await requestCurrentSearchMapLocation();
    if (!coordinates) return;

    setUserLocation(coordinates);
    setFocusMode('user');
  };

  const issueCommand = (type) => {
    setMapCommand({
      id: `${type}-${Date.now()}`,
      type,
    });
  };

  const handleRenderStats = useCallback((stats) => {
    setProviderRenderStats(stats || null);
  }, []);

  const handleMapRegionChange = useCallback((nextViewport) => {
    setVisibleViewport(nextViewport || null);
    onRegionChangeComplete?.(nextViewport);
  }, [onRegionChangeComplete]);

  return (
    <View style={{ height, position: 'relative' }}>
      {renderMap({
        command: mapCommand,
        focusMode,
        height,
        items,
        message: emptyMessage,
        onOpenItem: handleOpenSelectedItem,
        onRegionChangeComplete: handleMapRegionChange,
        onRenderStats: handleRenderStats,
        onSelectItem: handleSelectItem,
        overlayInsets: resolvedOverlayInsets,
        regionHint: focusedRegion,
        renderItems,
        renderStats,
        scope,
        selectedItemId: activeSelectedItemId,
        userLocation,
      })}

      <View
        pointerEvents="box-none"
        style={{
          left: 0,
          paddingHorizontal: 12,
          paddingTop: topMargin + 12,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      >
        <SearchMapHud
          geolocatableCount={renderStats.aggregated ? totalResults : items.length}
          isLoadingResults={isLoadingResults}
          onControlsWidthChange={setHudControlsWidth}
          onLocateMe={handleLocateMe}
          onRecenter={() => {
            const shouldFocusRegion = scope !== 'reservations' && hasValidRegionHint(focusedRegion);
            setFocusMode(shouldFocusRegion ? 'region' : 'results');
            issueCommand(shouldFocusRegion ? 'focus_region' : 'focus_results');
          }}
          onSummaryWidthChange={setHudSummaryWidth}
          onZoomIn={() => issueCommand('zoom_in')}
          onZoomOut={() => issueCommand('zoom_out')}
          renderStats={renderStats}
          scope={scope}
          totalCount={totalResults}
          truncated={truncated}
        />
      </View>

      {items.length > 0 && visibleMarkerCount > 0 && !selectedItem ? (
        <View
          pointerEvents="none"
          style={{
            backgroundColor: 'rgba(6, 24, 34, 0.84)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderRadius: 18,
            borderWidth: 1,
            bottom: Math.max(24, previewBottomOffset + previewCardHeight + 10),
            left: 18,
            paddingHorizontal: 14,
            paddingVertical: 11,
            position: 'absolute',
            right: 18,
          }}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { textAlign: 'center' }]}>
            Touche un repère pour voir la fiche
          </Text>
        </View>
      ) : null}

      <View pointerEvents="box-none" style={[Alignments.fill, Spaces.gap[12]]}>
        <SearchMapPreviewCard
          bottomOffset={previewBottomOffset}
          item={selectedItem}
          onDismiss={handleClearSelection}
          onHeightChange={setPreviewCardHeight}
          onOpen={(item) => onOpenItem?.(item)}
          onShowList={() => onShowList?.()}
          scope={scope}
        />
      </View>
    </View>
  );
}

export default SearchMap;
