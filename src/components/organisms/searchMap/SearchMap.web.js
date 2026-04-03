import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { View } from 'react-native';

import useTheme from '@/theme/themeContext';

import SearchMapPreviewCard from '@/components/molecules/searchMapPreviewCard/SearchMapPreviewCard';
import SearchMapHud from '@/components/organisms/searchMap/SearchMapHud';

import {
  getSearchMapEmptyMessage,
  getSearchMapNoCoordinatesMessage,
} from '@/utils/searchMap';

import mapsPlatform from '@/platform/maps';
import { requestCurrentSearchMapLocation } from '@/platform/maps/searchMapGeolocation';

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
        return 'selected';
      }

      if (current === 'user') {
        return current;
      }

      return hasValidRegionHint(regionHint) ? 'region' : 'results';
    });
  }, [hasValidRegionHint, internalSelectedItemId, items, regionHint, selectedItemId]);

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
    setFocusMode('selected');
    onSelectItem?.(itemId);
  };

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
        onRegionChangeComplete,
        onRenderStats: handleRenderStats,
        onSelectItem: handleSelectItem,
        overlayInsets,
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
          onLocateMe={handleLocateMe}
          onRecenter={() => {
            const shouldFocusRegion = scope === 'clubs' && hasValidRegionHint(focusedRegion);
            setFocusMode(shouldFocusRegion ? 'region' : 'results');
            issueCommand(shouldFocusRegion ? 'focus_region' : 'focus_results');
          }}
          onZoomIn={() => issueCommand('zoom_in')}
          onZoomOut={() => issueCommand('zoom_out')}
          renderStats={renderStats}
          scope={scope}
          totalCount={totalResults}
          truncated={truncated}
        />
      </View>

      <View pointerEvents="box-none" style={[Alignments.fill, Spaces.gap[12]]}>
        <SearchMapPreviewCard
          bottomOffset={previewBottomOffset}
          item={selectedItem}
          onDismiss={handleClearSelection}
          onOpen={(item) => onOpenItem?.(item)}
          onShowList={() => onShowList?.()}
          scope={scope}
        />
      </View>
    </View>
  );
}

export default SearchMap;
