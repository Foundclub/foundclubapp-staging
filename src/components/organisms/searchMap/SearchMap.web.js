import { useMemo, useState } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import SearchMapPreviewCard from '@/components/molecules/searchMapPreviewCard/SearchMapPreviewCard';

import {
  getSearchMapEmptyMessage,
  getSearchMapResultLabel,
} from '@/utils/searchMap';

import mapsPlatform from '@/platform/maps';

/**
 * Web map explorer aligned with the shared mobile props.
 * @param {object} props
 * @param {import('@/utils/searchMap').SearchMapItem[]} [props.items]
 * @param {(item: import('@/utils/searchMap').SearchMapItem) => void} [props.onOpenItem]
 * @param {() => void} [props.onShowList]
 * @param {(itemId: string) => void} [props.onSelectItem]
 * @param {() => void} [props.onLocateMe]
 * @param {'events' | 'clubs' | 'reservations'} [props.scope]
 * @param {string} [props.selectedItemId]
 * @param {number} [props.totalCount]
 * @returns {import('react').ReactElement}
 */
function SearchMap({
  items = [],
  onLocateMe,
  onOpenItem,
  onSelectItem,
  onShowList,
  scope = 'events',
  selectedItemId,
  totalCount = 0,
}) {
  const { renderMap } = mapsPlatform;
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const [internalSelectedItemId, setInternalSelectedItemId] = useState('');
  const [focusMode, setFocusMode] = useState('results');
  const [userLocation, setUserLocation] = useState(null);

  const activeSelectedItemId = selectedItemId ?? internalSelectedItemId;
  const selectedItem = useMemo(
    () => items.find((item) => item.id === activeSelectedItemId) || null,
    [activeSelectedItemId, items],
  );
  const totalResults = Number.isFinite(totalCount) && totalCount > 0 ? totalCount : items.length;

  const handleSelectItem = (itemId) => {
    if (selectedItemId === undefined) {
      setInternalSelectedItemId(itemId);
    }
    setFocusMode('selected');
    onSelectItem?.(itemId);
  };

  const handleLocateMe = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition((position) => {
      const coordinates = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setUserLocation(coordinates);
      setFocusMode('user');
      onLocateMe?.();
    });
  };

  return (
    <View style={[Spaces.marginTop[12], { minHeight: 360, position: 'relative' }]}>
      {renderMap({
        focusMode,
        height: 360,
        items,
        message: getSearchMapEmptyMessage(scope),
        onSelectItem: handleSelectItem,
        scope,
        selectedItemId: activeSelectedItemId,
        userLocation,
      })}

      <View
        pointerEvents="box-none"
        style={{
          left: 0,
          paddingHorizontal: 12,
          paddingTop: 12,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      >
        <View style={[Alignments.row, Alignments.alignStart, Alignments.justifySpaceBetween]}>
          <View
            style={[
              ApplicationStyle.shadow200,
              {
                backgroundColor: 'rgba(6, 24, 34, 0.84)',
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: 18,
                borderWidth: 1,
                maxWidth: '72%',
                paddingHorizontal: 14,
                paddingVertical: 10,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
              {`${totalResults} ${getSearchMapResultLabel(scope)}`}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral200]}>
              {`${items.length} affichables sur la carte`}
            </Text>
          </View>

          <View style={[Alignments.column, { gap: 10 }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setFocusMode('results')}
              style={[
                {
                  alignItems: 'center',
                  backgroundColor: 'rgba(6, 24, 34, 0.9)',
                  borderColor: `${Colors.primary500}33`,
                  borderRadius: 999,
                  borderWidth: 1,
                  justifyContent: 'center',
                  minHeight: 40,
                  minWidth: 108,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                Recentrer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleLocateMe}
              style={[
                {
                  alignItems: 'center',
                  backgroundColor: 'rgba(6, 24, 34, 0.9)',
                  borderColor: `${Colors.primary500}33`,
                  borderRadius: 999,
                  borderWidth: 1,
                  justifyContent: 'center',
                  minHeight: 40,
                  minWidth: 108,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                Me localiser
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <SearchMapPreviewCard
        item={selectedItem}
        onOpen={(item) => onOpenItem?.(item)}
        onShowList={() => onShowList?.()}
        scope={scope}
      />
    </View>
  );
}

export default SearchMap;
