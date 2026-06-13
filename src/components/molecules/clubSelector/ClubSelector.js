// @ts-nocheck
import {
  ActivityIndicator, Pressable, ScrollView, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

const normalizeId = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const getClubLabel = (club) => String(club?.name || '').trim() || 'Club';

/**
 * Compact horizontal selector used when the user has multiple club affiliations.
 * @param {object} props
 * @param {Array<any>} [props.clubs]
 * @param {string | null | undefined} [props.activeClubId]
 * @param {(club: any) => void | Promise<void>} [props.onSelectClub]
 * @param {boolean} [props.isLoading]
 * @param {string} [props.title]
 * @returns {import('react').ReactElement | null}
 */
function ClubSelector({
  activeClubId = null,
  clubs = [],
  isLoading = false,
  onSelectClub,
  title = 'Mes clubs',
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const visibleClubs = Array.isArray(clubs)
    ? clubs
      .map((club) => ({
        ...club,
        normalizedDocumentId: normalizeId(club?.documentId || club?.id),
      }))
      .filter((club) => club.normalizedDocumentId)
    : [];

  if (visibleClubs.length <= 1 || typeof onSelectClub !== 'function') {
    return null;
  }

  const normalizedActiveClubId = normalizeId(activeClubId);
  const orderedClubs = [...visibleClubs].sort((left, right) => {
    const leftActive = normalizeId(left.normalizedDocumentId) === normalizedActiveClubId;
    const rightActive = normalizeId(right.normalizedDocumentId) === normalizedActiveClubId;
    if (leftActive === rightActive) return 0;
    return leftActive ? -1 : 1;
  });

  return (
    <View style={[Spaces.marginBottom[16], Spaces.gap[8]]}>
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
        <Text style={[Fonts.p3Bold, Fonts.neutral200]}>{title}</Text>
        {isLoading ? <ActivityIndicator color={Colors.primary300} size="small" /> : null}
      </View>

      <ScrollView
        contentContainerStyle={[Alignments.row, Spaces.gap[8], { paddingRight: 8 }]}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {orderedClubs.map((club) => {
          const isActive = normalizedActiveClubId === club.normalizedDocumentId;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(isLoading), selected: isActive }}
              disabled={isLoading}
              key={club.normalizedDocumentId}
              onPress={() => onSelectClub(club)}
              style={[
                ApplicationStyle.borderRadius24,
                {
                  alignItems: 'center',
                  backgroundColor: isActive ? `${Colors.primary500}22` : Colors.primary800,
                  borderColor: isActive ? Colors.primary500 : `${Colors.primary400}55`,
                  borderWidth: 1,
                  minWidth: 132,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  Fonts.p3Bold,
                  {
                    color: isActive ? Colors.primary100 : Colors.neutral100,
                    textAlign: 'center',
                  },
                ]}
              >
                {getClubLabel(club)}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  Fonts.p4,
                  {
                    color: isActive ? Colors.primary200 : Colors.neutral400,
                    marginTop: 4,
                    textAlign: 'center',
                  },
                ]}
              >
                {isActive ? 'Club actif' : 'Basculer'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default ClubSelector;
