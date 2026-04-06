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
 * @param {(item: import('@/utils/searchMap').SearchMapItem) => void} [props.onOpenItem]
 * @param {(region: { lat: number; lng: number; zoom?: number }) => void} [props.onRegionChangeComplete]
 * @param {(itemId: string) => void} [props.onSelectItem]
 * @param {() => void} [props.onShowList]
 * @param {'camera' | 'highlight-only'} [props.selectionFocusBehavior]
 * @param {(stats: { renderableCount?: number, markerCount?: number, clusterCount?: number }) => void} [props.onRenderStats]
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
    Spaces,
  } = useTheme();
  const [internalSelectedItemId, setInternalSelectedItemId] = useState('');
  const [mapCommand, setMapCommand] = useState(null);
  const [focusMode, setFocusMode] = useState(/** @type {'results' | 'selected' | 'user' | 'region'} */ ('results'));
  const [renderStats, setRenderStats] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [focusedRegion, setFocusedRegion] = useState(regionHint);
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
    setRenderStats(stats || null);
  }, []);

  return (
    <View style={{ height, position: 'relative' }}>
      {renderMap({
        command: mapCommand,
        focusMode,
        height,
        items,
        message: emptyMessage,
        onOpenItem: handleOpenSelectedItem,
        onRegionChangeComplete,
        onRenderStats: handleRenderStats,
        onSelectItem: handleSelectItem,
        overlayInsets: resolvedOverlayInsets,
        regionHint: focusedRegion,
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
          geolocatableCount={items.length}
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
          <Text style={{ color: '#ffffff', fontWeight: '700', textAlign: 'center' }}>
            Touchez un repere pour voir la fiche
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
