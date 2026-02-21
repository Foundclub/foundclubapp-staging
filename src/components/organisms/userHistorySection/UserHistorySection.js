import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Image, Text, TouchableOpacity, View } from 'react-native';

import { getImageUrl } from '@/utils/imageUrl';
import useTheme from '@/theme/themeContext';
import useClub from '@/domains/club/useClub';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import { useGetMyHistories, useGetUserHistories, useDeleteHistory } from '@/services/userHistory/userHistoryQueries';

/**
 * @typedef {{
 *   id?: string | number;
 *   documentId?: string;
 *   isCurrentlyActive?: boolean;
 *   startYear?: number | string;
 *   endYear?: number | string;
 *   customClubName?: string;
 *   club?: { name?: string; logo?: { url?: string } };
 *   multisport_club?: { name?: string; logo?: { url?: string } };
 *   category?: { name?: string };
 *   level?: { name?: string };
 * }} UserHistoryItem
 */
/**
 * UserHistorySection - Displays user's sports history (CV)
 * @param {object} props
 * @param {string} [props.userId] - The user's documentId (optional, if not provided shows current user's history)
 * @param {boolean} props.isOwnProfile - Whether this is the current user's profile
 * @param {() => void} [props.onAddPress] - Callback when add button is pressed
 * @param {(item: UserHistoryItem) => void} [props.onEditPress] - Callback when edit button is pressed
 * @param {string} [props.bestLevel] - User best level display
 * @param {string} [props.preferredSport] - Preferred sport display
 */
function UserHistorySection({ userId, isOwnProfile = false, onAddPress, onEditPress, bestLevel, preferredSport }) {
  const { Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces } = useTheme();
  const { t } = useTranslation();
  const { getClubInitials } = useClub();
  
  const { data: historiesData, isLoading } = userId 
    ? useGetUserHistories(userId) 
    : useGetMyHistories();
  const histories = Array.isArray(historiesData) ? historiesData : [];
  
  const deleteHistoryMutation = useDeleteHistory();

  const handleDelete = (/** @type {string | number | undefined} */ historyId) => {
    if (!historyId) return;
    Alert.alert(
      t('common.actions.delete', 'Supprimer'),
      t('profile.history.deleteConfirmation', 'Voulez-vous vraiment supprimer cette expérience ?'),
      [
        {
          text: t('common.actions.cancel', 'Annuler'),
          style: 'cancel',
        },
        {
          text: t('common.actions.delete', 'Supprimer'),
          onPress: () => deleteHistoryMutation.mutate(historyId),
          style: 'destructive',
        },
      ]
    );
  };

  // Format year range display
  const formatYearRange = (/** @type {UserHistoryItem} */ item) => {
    if (item.isCurrentlyActive || !item.endYear) {
      return `${item.startYear} - Aujourd'hui`;
    }
    if (item.startYear === item.endYear) {
      return `${item.startYear}`;
    }
    return `${item.startYear} - ${item.endYear}`;
  };

  // Get club display name
  const getClubName = (/** @type {UserHistoryItem} */ item) => {
    if (item.club?.name) {
      return item.club.name;
    }
    if (item.multisport_club?.name) {
      return item.multisport_club.name;
    }
    return item.customClubName || 'Club inconnu';
  };

  // Render club logo or shield with initials
  const renderClubLogo = (/** @type {UserHistoryItem} */ item) => {
    // If club has a logo, show it
    const logoUrl = item.club?.logo?.url || item.multisport_club?.logo?.url;
    
    if (logoUrl) {
      return (
        <Image
          source={{ uri: getImageUrl(logoUrl) }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            marginRight: 12,
            backgroundColor: Colors.neutral700,
          }}
          resizeMode="contain"
        />
      );
    }

    // Otherwise show TeamShield with initials
    const clubName = item.club?.name || item.multisport_club?.name || item.customClubName || '';
    const initials = getClubInitials(clubName);

    return (
      <View style={{ marginRight: 12 }}>
        <TeamShield initials={initials} isSmall />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[Spaces.padding[16], Alignments.alignCenter]}>
        <ActivityIndicator color={Colors.primary500} />
      </View>
    );
  }

  return (
    <View style={[Spaces.gap[16]]}>
      {/* Header */}
      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>
          {t('profile.history.title', 'Historique sportif')}
        </Text>
        {isOwnProfile && (
          <TouchableOpacity
            onPress={() => onAddPress?.()}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: Colors.primary500,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image 
              source={/** @type {any} */ (require('@/assets/icons/plus.png'))} 
              style={{ width: 14, height: 14, tintColor: '#FFF' }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Best Level & Sport Info */}
      {(bestLevel || preferredSport) && (
        <View style={[
          Spaces.padding[12],
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius8,
          Alignments.row,
          Alignments.alignCenter,
          Spaces.gap[12]
        ]}>
          <Image
            source={/** @type {any} */ (require('@/assets/icons/flag.png'))}
            style={{ width: 20, height: 20, tintColor: Colors.primary500 }}
            resizeMode="contain"
          />
          <View>
            {preferredSport && (
              <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
                {preferredSport}
              </Text>
            )}
            {bestLevel && (
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                {t('profile.history.bestLevel', 'Meilleur niveau')} : {bestLevel}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Empty state */}
      {histories.length === 0 && (
        <View style={[
          Spaces.padding[24],
          Alignments.alignCenter,
          {
            backgroundColor: Colors.neutral800,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: Colors.neutral700,
            borderStyle: 'dashed',
          }
        ]}>
          <Text style={[Fonts.p1, { color: Colors.neutral00, textAlign: 'center' }]}>
            {isOwnProfile 
              ? t('profile.history.empty', 'Ajoute ton parcours sportif pour enrichir ton profil')
              : t('profile.history.emptyOther', 'Aucun historique renseigné')
            }
          </Text>
          {isOwnProfile && (
            <TouchableOpacity
              onPress={() => onAddPress?.()}
              style={[Spaces.marginTop[16]]}
            >
              <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
                + Ajouter une expérience
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* History list */}
      {histories.length > 0 && (
        <View style={[Spaces.gap[12]]}>
          {histories.map((/** @type {UserHistoryItem} */ item) => (
            <TouchableOpacity
              key={item.documentId || item.id}
              onPress={() => {
                if (isOwnProfile) onEditPress?.(item);
              }}
              disabled={!isOwnProfile}
              style={[
                Spaces.padding[16],
                Alignments.row,
                Alignments.alignCenter,
                {
                  backgroundColor: Colors.neutral800,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.neutral700,
                },
              ]}
            >
              {/* Club logo or shield with initials */}
              {renderClubLogo(item)}

              {/* Info */}
              <View style={[Alignments.fill, Spaces.gap[4]]}>
                <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                  {getClubName(item)}
                </Text>
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                  {item.category?.name && (
                    <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                      {item.category.name}
                    </Text>
                  )}
                  {item.category?.name && item.level?.name && (
                    <Text style={[Fonts.p2, { color: Colors.neutral500 }]}>•</Text>
                  )}
                  {item.level?.name && (
                    <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                      {item.level.name}
                    </Text>
                  )}
                </View>
                <Text style={[Fonts.p2, { color: Colors.primary500 }]}>
                  {formatYearRange(item)}
                </Text>
              </View>

              {/* Active badge */}
              {item.isCurrentlyActive && (
                <View style={{
                  backgroundColor: Colors.primary500 + '20',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                }}>
                  <Text style={[Fonts.p3, { color: Colors.primary500 }]}>Actif</Text>
                </View>
              )}

              {/* Delete Button */}
              {isOwnProfile && (
                <TouchableOpacity
                  onPress={() => handleDelete(item.documentId || item.id)}
                  style={[
                    Spaces.padding[8],
                    { marginRight: -8 }
                  ]}
                >
                  <Image
                    source={Images.trash}
                    style={{
                      width: 20,
                      height: 20,
                      tintColor: '#FF4D4D',
                    }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default UserHistorySection;
