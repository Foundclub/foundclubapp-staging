import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * @typedef {'events' | 'clubs' | 'reservations' | 'recruitment'} SearchType
 */

/**
 * @param {{
 *  activeType: SearchType;
 *  onTypeChange: (type: SearchType) => void;
 * }} props
 * @returns {import('react').ReactElement}
 */
function SearchTypeSwitcher({ activeType, onTypeChange }) {
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const options = useMemo(
    () => [
      {
        key: 'events',
        label: t('homeHub.cards.search.events.title', 'Evenement'),
      },
      {
        key: 'clubs',
        label: t('homeHub.cards.search.clubs.title', 'Club'),
      },
      {
        key: 'reservations',
        label: t('homeHub.cards.search.reservations.title', 'Reservations'),
      },
      {
        key: 'recruitment',
        label: t('searchTypeSwitcher.recruitment', 'Recrutement'),
      },
    ],
    [t],
  );

  return (
    <View style={[Spaces.marginBottom[16]]}>
      <ScrollView
        contentContainerStyle={[Alignments.row, Spaces.gap[8], Spaces.paddingRight[24]]}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {options.map((option) => {
          const isActive = option.key === activeType;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              key={option.key}
              onPress={() => onTypeChange(/** @type {SearchType} */ (option.key))}
              style={{
                backgroundColor: isActive ? Colors.primary500 : 'rgba(1,179,244,0.12)',
                borderColor: isActive ? Colors.primary500 : 'rgba(1,179,244,0.45)',
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text style={[Fonts.p3Bold, isActive ? Fonts.neutral900 : Fonts.primary200]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default SearchTypeSwitcher;
