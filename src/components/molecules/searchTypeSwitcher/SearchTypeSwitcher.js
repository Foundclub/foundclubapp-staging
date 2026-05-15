import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
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
 * Horizontal switcher for search domains.
 * @param {{
 *  activeType: SearchType;
 *  onTypeChange: (type: SearchType) => void;
 * }} props
 * @returns {import('react').ReactElement}
 */
function SearchTypeSwitcher({ activeType, onTypeChange }) {
  const isWeb = Platform.OS === 'web';
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
        label: t('homeHub.cards.search.events.title', '\u00c9v\u00e9nement'),
      },
      {
        key: 'clubs',
        label: t('homeHub.cards.search.clubs.title', 'Club'),
      },
      {
        key: 'reservations',
        label: t('homeHub.cards.search.reservations.title', 'R\u00e9servations'),
      },
      {
        key: 'recruitment',
        label: t('searchTypeSwitcher.recruitment', 'Recrutement'),
      },
    ],
    [t],
  );

  return (
    <View style={[Spaces.marginBottom[24]]}>
      <ScrollView
        contentContainerStyle={[
          Alignments.row,
          Spaces.gap[8],
          {
            flexGrow: 1,
            paddingRight: 4,
          },
        ]}
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
                alignItems: 'center',
                backgroundColor: isActive ? Colors.primary500 : `${Colors.primary900}F0`,
                borderColor: isActive ? Colors.primary500 : `${Colors.primary500}30`,
                borderRadius: 999,
                borderWidth: 1,
                justifyContent: 'center',
                minHeight: isWeb ? 44 : 40,
                paddingHorizontal: 14,
                paddingVertical: isWeb ? 10 : 8,
              }}
            >
              <Text
                numberOfLines={1}
                style={[
                  Fonts.p4Bold,
                  isActive ? Fonts.neutral900 : Fonts.neutral100,
                  {
                    includeFontPadding: !isWeb ? false : undefined,
                    lineHeight: isWeb ? 17 : 16,
                    textAlign: 'center',
                    textAlignVertical: 'center',
                  },
                ]}
              >
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
