import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import { getSearchMapResultLabel } from '@/utils/searchMap';

/**
 * Shared HUD chrome for the search map.
 * @param {object} props
 * @param {boolean} [props.disabled]
 * @param {number} [props.geolocatableCount]
 * @param {boolean} [props.isLoadingResults]
 * @param {(width: number) => void} [props.onControlsWidthChange]
 * @param {(width: number) => void} [props.onSummaryWidthChange]
 * @param {() => void} [props.onLocateMe]
 * @param {() => void} [props.onRecenter]
 * @param {() => void} [props.onZoomIn]
 * @param {() => void} [props.onZoomOut]
 * @param {{
 *  dataCount?: number,
 *  renderableCount?: number,
 *  markerCount?: number,
 *  clusterCount?: number,
 *  fallbackActive?: boolean,
 * } | null} [props.renderStats]
 * @param {'events' | 'clubs' | 'reservations'} [props.scope]
 * @param {number} [props.totalCount]
 * @param {boolean} [props.truncated]
 * @returns {import('react').ReactElement}
 */
function SearchMapHud({
  disabled = false,
  geolocatableCount = 0,
  isLoadingResults = false,
  onControlsWidthChange,
  onLocateMe,
  onRecenter,
  onSummaryWidthChange,
  onZoomIn,
  onZoomOut,
  renderStats = null,
  scope = 'events',
  totalCount = 0,
  truncated = false,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const overlayOpacity = disabled ? 0.46 : 1;
  const safeAvailableCount = Number.isFinite(totalCount) && totalCount > 0
    ? totalCount
    : geolocatableCount;
  const isPartialDataset = safeAvailableCount > geolocatableCount;
  const resultLabel = getSearchMapResultLabel(scope, safeAvailableCount);
  const titleLabel = `${safeAvailableCount} ${resultLabel}`;
  const visibleMarkerCount = Math.max(
    0,
    Number(renderStats?.markerCount || 0) + Number(renderStats?.clusterCount || 0),
  );

  let geolocatableLabel = 'Aucun repère';
  if (visibleMarkerCount > 0) {
    geolocatableLabel = `${visibleMarkerCount} repères visibles`;
  } else if (safeAvailableCount > 0 && truncated) {
    geolocatableLabel = 'Zoome pour tout voir';
  } else if (safeAvailableCount > 0 && isLoadingResults) {
    geolocatableLabel = 'Mise à jour des repères...';
  } else if (geolocatableCount > 0 && isPartialDataset) {
    geolocatableLabel = `${geolocatableCount} geolocalisables`;
  } else if (geolocatableCount > 0) {
    geolocatableLabel = scope === 'clubs'
      ? `${geolocatableCount} geolocalisables`
      : 'Touche un repère';
  } else if (safeAvailableCount > 0) {
    geolocatableLabel = 'Aucun repère visible';
  }

  const zoomGroupStyle = [
    ApplicationStyle.shadow200,
    {
      alignItems: 'center',
      backgroundColor: 'rgba(5, 28, 42, 0.82)',
      borderColor: `${Colors.primary500}40`,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      padding: 4,
    },
  ];

  const zoomButtonStyle = {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 40,
  };

  const pillStyle = [
    ApplicationStyle.shadow200,
    {
      alignItems: 'center',
      backgroundColor: 'rgba(5, 28, 42, 0.82)',
      borderColor: `${Colors.primary500}40`,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 46,
      minWidth: 124,
      paddingHorizontal: 15,
      paddingVertical: 9,
    },
  ];

  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignStart,
        Alignments.justifySpaceBetween,
        Spaces.gap[12],
      ]}
    >
      <View
        onLayout={(event) => {
          onSummaryWidthChange?.(event?.nativeEvent?.layout?.width || 0);
        }}
        style={[
          ApplicationStyle.shadow200,
          {
            backgroundColor: 'rgba(5, 28, 42, 0.82)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderRadius: 20,
            borderWidth: 1,
            maxWidth: '56%',
            paddingHorizontal: 11,
            paddingVertical: 9,
          },
        ]}
      >
        <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
          {titleLabel}
        </Text>
        <Text style={[Fonts.p4, Fonts.neutral200, Spaces.marginTop[4]]}>
          {geolocatableLabel}
        </Text>
      </View>

      <View
        onLayout={(event) => {
          onControlsWidthChange?.(event?.nativeEvent?.layout?.width || 0);
        }}
        style={[Alignments.column, Spaces.gap[8], { opacity: overlayOpacity }]}
      >
        <View style={zoomGroupStyle}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={disabled}
            onPress={onZoomIn}
            style={zoomButtonStyle}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>+</Text>
          </TouchableOpacity>

          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              height: 22,
              width: 1,
            }}
          />

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={disabled}
            onPress={onZoomOut}
            style={zoomButtonStyle}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>-</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={disabled}
          onPress={onRecenter}
          style={pillStyle}
        >
          <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
            Recentrer
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={disabled}
          onPress={onLocateMe}
          style={pillStyle}
        >
          <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
            Me localiser
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default SearchMapHud;
