import { useMemo } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { getPositionGroupsForSport } from '@/constants/positions';

/**
 * Shared position picker used by recruitment and detection flows.
 * @param {object} props
 * @param {(position: string) => number} props.getQuantity
 * @param {(position: string) => boolean} props.isSelected
 * @param {(position: string, delta: number) => void} props.onQuantityChange
 * @param {(position: string) => void} props.onToggle
 * @param {string[]} props.positions
 * @param {(quantity: number) => string} props.selectedQuantityLabel
 * @param {string} [props.sportName]
 * @param {string} [props.selectedSectionTitle]
 * @param {string} [props.unselectedActionLabel]
 * @returns {import('react').ReactElement | null}
 */
function PositionSelectionList({
  getQuantity,
  isSelected,
  onQuantityChange,
  onToggle,
  positions = [],
  selectedQuantityLabel,
  selectedSectionTitle = 'Selection actuelle',
  sportName = '',
  unselectedActionLabel = 'Selectionner',
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const selectedPositions = useMemo(
    () => positions.filter((position) => isSelected(position)),
    [isSelected, positions],
  );
  const unselectedGroups = useMemo(() => {
    const availablePositions = positions.filter((position) => !isSelected(position));
    return getPositionGroupsForSport(sportName, availablePositions);
  }, [isSelected, positions, sportName]);

  if (!positions.length) {
    return null;
  }

  /**
   * @param {string} position
   * @returns {import('react').ReactElement}
   */
  const renderPositionRow = (position) => {
    const selected = isSelected(position);
    const quantity = getQuantity(position);

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        key={position}
        onPress={() => onToggle(position)}
        style={[
          ApplicationStyle.card,
          Spaces.padding[24],
          selected ? Spaces.gap[16] : Spaces.gap[12],
          {
            backgroundColor: selected ? 'rgba(1, 179, 244, 0.16)' : 'rgba(4, 31, 44, 0.82)',
            borderColor: selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.20)',
            borderWidth: selected ? 1.5 : 1,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[16]]}>
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16], { flex: 1 }]}>
            <View
              style={[
                Alignments.alignCenter,
                Alignments.justifyCenter,
                {
                  backgroundColor: selected ? Colors.primary500 : 'transparent',
                  borderColor: selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.32)',
                  borderRadius: 999,
                  borderWidth: 1.5,
                  height: 28,
                  width: 28,
                },
              ]}
            >
              {selected ? (
                <Text style={[Fonts.p4Bold, { color: Colors.neutral900 }]}>OK</Text>
              ) : null}
            </View>

            <View style={[Spaces.gap[10], { flex: 1 }]}>
              <Text style={[Fonts.h4, selected ? Fonts.neutral00 : Fonts.neutral100]}>
                {position}
              </Text>
              {selected ? (
                <Text style={[Fonts.p4, Fonts.neutral300]}>
                  {selectedQuantityLabel(quantity)}
                </Text>
              ) : null}
            </View>
          </View>

          {selected ? (
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={quantity <= 1}
                onPress={(event) => {
                  event.stopPropagation();
                  onQuantityChange(position, -1);
                }}
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  {
                    backgroundColor: quantity <= 1 ? 'rgba(255,255,255,0.05)' : 'rgba(1, 179, 244, 0.12)',
                    borderColor: 'rgba(1, 179, 244, 0.18)',
                    borderRadius: 12,
                    borderWidth: 1,
                    height: 36,
                    width: 36,
                  },
                ]}
              >
                <Text style={[Fonts.h4, quantity <= 1 ? Fonts.neutral500 : Fonts.neutral00]}>-</Text>
              </TouchableOpacity>

              <View style={[Alignments.alignCenter, Alignments.justifyCenter, { minWidth: 34 }]}>
                <Text style={[Fonts.h3Bold, Fonts.primary500]}>{quantity}</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={quantity >= 10}
                onPress={(event) => {
                  event.stopPropagation();
                  onQuantityChange(position, 1);
                }}
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  {
                    backgroundColor: quantity >= 10 ? 'rgba(255,255,255,0.05)' : Colors.primary500,
                    borderColor: quantity >= 10 ? 'rgba(1, 179, 244, 0.18)' : Colors.primary500,
                    borderRadius: 12,
                    borderWidth: 1,
                    height: 36,
                    width: 36,
                  },
                ]}
              >
                <Text style={[Fonts.h4, quantity >= 10 ? Fonts.neutral500 : Fonts.neutral00]}>+</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.10)',
                  borderColor: 'rgba(1, 179, 244, 0.24)',
                  borderRadius: 999,
                  borderWidth: 1,
                  minWidth: 124,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.primary500, { textAlign: 'center' }]}>
                {unselectedActionLabel}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[Spaces.gap[24]]}>
      {selectedPositions.length > 0 ? (
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.p4Bold, Fonts.neutral300]}>
            {selectedSectionTitle}
          </Text>
          <View style={[Spaces.gap[12]]}>
            {selectedPositions.map(renderPositionRow)}
          </View>
        </View>
      ) : null}

      {unselectedGroups.map((group) => (
        <View key={group.label} style={[Spaces.gap[16]]}>
          <Text style={[Fonts.p4Bold, Fonts.neutral300]}>
            {group.label}
          </Text>
          <View style={[Spaces.gap[12]]}>
            {group.positions.map(renderPositionRow)}
          </View>
        </View>
      ))}
    </View>
  );
}

export default PositionSelectionList;
