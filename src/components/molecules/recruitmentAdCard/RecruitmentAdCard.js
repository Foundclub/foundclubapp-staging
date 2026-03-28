import { useNavigation } from '@react-navigation/native';
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { RouteNames } from '@/navigation/routeNames';

import { resolveRecruitmentAdApplicationState } from '@/services/recruitment/recruitmentService';

import { formatDateWithDayPrefix } from '@/utils/date';
import { getImageUrl } from '@/utils/imageUrl';
import { getShortAddress } from '@/utils/location';

/**
 * RecruitmentAdCard component - Fully aligned with EventCardNew.js design
 * @param {object} props
 * @param {object} props.ad - The recruitment ad data
 * @param {Record<string, { status?: string, recruitmentAdDocumentId?: string }>} [props.detectionApplicationStatusByEvent]
 * @param {Function} [props.onPress] - Callback when card is pressed
 * @param {boolean} [props.isOwner] - If true, shows owner actions
 */
import useAuth from '@/domains/auth/useAuth';

import MatchIndicator from '@/components/atoms/matchIndicator/MatchIndicator';

// Asset: Same as EventCardNew (fallback/other)
const CARD_BACKGROUND = require('@/assets/background-card-event/card-autre.png');

const normalizeTypeLabel = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

// ... (imports)

/**
 *
 * @param {object} root0
 * @param {object} root0.ad
 * @param {Record<string, { status?: string, recruitmentAdDocumentId?: string }>} [root0.detectionApplicationStatusByEvent]
 * @param {boolean} [root0.isOwner]
 * @param {Function} [root0.onPress]
 */
function RecruitmentAdCard({
  ad,
  detectionApplicationStatusByEvent = {},
  isOwner = false,
  onPress,
}) {
  const navigation = useNavigation();
  const {
    Colors, Fonts, Images,
  } = useTheme();
  const { getClubInitials } = useClub();
  const { userData } = useAuth(); // Get user data for match calculation

  // Animation State
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withTiming(0.98, { duration: 100 });
  };

  const onPressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  // Data Extraction
  const { team } = ad;
  const club = team?.club;
  const clubName = club?.name || team?.name || 'Club inconnu';
  const clubLogo = getImageUrl(club?.logo?.url);

  // Position
  const positionLabel = ad.position || 'Poste non spécifié';

  // Level & Category
  const levelName = ad.level?.name || ad.minLevel || 'Niveau ?';
  const categoryName = ad.category?.name || ad.category || 'Catégorie ?';

  // Location
  const address = getShortAddress(ad.city || club?.city || '');

  // Section
  const sectionName = ad.section?.name || ad.section;
  const isDetectionLinked = normalizeTypeLabel(ad?.event?.type?.name).includes('detection');
  const detectionDateLabel = ad?.event?.date
    ? formatDateWithDayPrefix(new Date(ad.event.date))
    : '';
  const applicationState = resolveRecruitmentAdApplicationState(ad, userData, detectionApplicationStatusByEvent);
  let playerCtaBackgroundColor = Colors.primary500;
  let playerCtaBorderColor = 'transparent';
  let playerCtaTextColor = Colors.neutral900;
  let playerCtaLabel = 'Postuler';
  if (!ad.isActive) {
    playerCtaLabel = 'Annonce inactive';
  } else if (applicationState.status === 'accepted') {
    playerCtaLabel = 'Je participe';
    playerCtaBackgroundColor = `${Colors.success500}18`;
    playerCtaBorderColor = `${Colors.success500}35`;
    playerCtaTextColor = Colors.success500;
  } else if (applicationState.status === 'pending') {
    playerCtaLabel = 'Demande en attente';
    playerCtaBackgroundColor = `${Colors.warning500}18`;
    playerCtaBorderColor = `${Colors.warning500}35`;
    playerCtaTextColor = Colors.warning500;
  }

  // Sponsors
  // Owner specifics
  const candidatesCount = ad.candidates?.length || 0;
  const statusInfo = ad.isActive
    ? { color: Colors.primary500, text: 'En ligne' }
    : { color: Colors.neutral500, text: 'Inactif' };

  // Match Score Calculation
  const calculateMatchScore = () => {
    if (isOwner || !userData) return 0;

    let score = 50; // Base score (Sport match assumed)

    // Level Match (+25%)
    const userLevelId = userData.bestLevel?.documentId || userData.bestLevel?.id;
    const adLevelId = ad.level?.documentId || ad.level?.id;
    if (userLevelId && adLevelId && userLevelId === adLevelId) {
      score += 25;
    } else if (userData.bestLevel?.name === ad.level?.name) {
      score += 25;
    }

    // Location Match (+15%)
    // Simple string match on City or Geohash prefix
    if (ad.city && userData.city && ad.city.toLowerCase() === userData.city.toLowerCase()) {
      score += 15;
    }

    // Position Match (+10%)
    // Check if user has this position in their profile
    if (userData.position && ad.position && userData.position.toLowerCase() === ad.position.toLowerCase()) {
      score += 10;
    }

    return Math.min(100, score);
  };

  const matchScore = calculateMatchScore();

  // ... (rest of code)

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable
        onPress={() => {
          if (onPress) {
            onPress(ad);
          } else {
            navigation.navigate(RouteNames.RecruitmentAdDetails, { ad });
          }
        }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{ flex: 1 }}
      >
        <ImageBackground
          resizeMode="cover"
          source={CARD_BACKGROUND}
          style={[styles.backgroundImage, StyleSheet.absoluteFill]}
        />

        <View pointerEvents="box-none" style={styles.contentContainer}>

          {/* Match Indicator (Top Right) - Only for Players */}
          {!isOwner && matchScore > 0 && (
          <View style={{
            position: 'absolute', right: 10, top: 10, zIndex: 10,
          }}
          >
            <MatchIndicator score={matchScore} />
          </View>
          )}

          <View pointerEvents="none">
            {/* Header: Position */}
            <View style={styles.headerContainer}>
              <Text numberOfLines={1} style={styles.headerText}>
                {positionLabel.toUpperCase()}
              </Text>
            </View>

            {/* Club Info */}
            <View style={styles.clubInfoContainer}>
              <View style={styles.clubLogoContainer}>
                {clubLogo ? (
                  <ProfileAvatar
                    imageStyle={{ borderRadius: 24 }}
                    imageUrl={clubLogo}
                    size={48}
                    style={{ borderColor: Colors.neutral200, borderRadius: 24, borderWidth: 1 }}
                    variant="logo"
                  />
                ) : (
                  <TeamShield
                    initials={clubName ? getClubInitials(clubName) : ''}
                    isSmall
                    size={48}
                  />
                )}
              </View>
              <View style={styles.clubTextContainer}>
                <Text numberOfLines={1} style={styles.clubName}>{clubName}</Text>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
                  {team?.name ? <Text numberOfLines={1} style={styles.category}>{team.name}</Text> : null}
                  {/* Sport Badge if available */}
                  <View style={{
                    backgroundColor: `${Colors.primary500}20`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
                  }}
                  >
                    <Text style={[Fonts.p4Bold, { color: Colors.primary500, fontSize: 10, textTransform: 'uppercase' }]}>
                      {ad.sport || team?.sport || 'Football'}
                    </Text>
                  </View>
                </View>
                {isDetectionLinked ? (
                  <View
                    style={{
                      alignItems: 'center',
                      alignSelf: 'flex-start',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderColor: `${Colors.primary500}55`,
                      borderRadius: 999,
                      borderWidth: 1,
                      flexDirection: 'row',
                      gap: 6,
                      marginTop: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Detection</Text>
                    {detectionDateLabel ? (
                      <Text style={[Fonts.p4, { color: Colors.neutral200 }]}>{detectionDateLabel}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>

            {/* Details Grid */}
            <View style={styles.detailsContainer}>

              {/* Row 1: Level & Category/Section */}
              <View style={styles.detailRow}>
                {/* Level (Left) */}
                <View style={styles.detailItem}>
                  <Image source={Images.filter} style={[styles.icon, { tintColor: Colors.primary500 }]} />
                  <Text numberOfLines={1} style={styles.detailText}>
                    {levelName}
                  </Text>
                </View>
                {/* Category + Section (Right) */}
                <View style={[styles.detailItem, { justifyContent: 'flex-end' }]}>
                  <Image source={Images.users} style={[styles.icon, { tintColor: Colors.neutral300 }]} />
                  <Text numberOfLines={1} style={[styles.detailText, { flex: 0, textAlign: 'right' }]}>
                    {categoryName}
                    {' '}
                    {sectionName ? `• ${sectionName}` : ''}
                  </Text>
                </View>
              </View>

              {/* Row 2: Address (Full Width) */}
              <View style={styles.detailRow}>
                <View style={[styles.detailItem, { width: '100%' }]}>
                  <Image source={Images.pin} style={[styles.icon, { tintColor: Colors.primary500 }]} />
                  <Text numberOfLines={2} style={[styles.detailText, { flex: 1 }]}>
                    {(typeof ad.address === 'object' ? ad.address?.label : ad.address) || address || 'Lieu non précisé'}
                  </Text>
                </View>
              </View>

            </View>
          </View>

          {/* Footer / CTA */}
          <View pointerEvents="auto" style={[styles.ctaContainer, { elevation: 999, zIndex: 999 }]}>
            {isOwner ? (
              <View style={{
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: 12,
                flexDirection: 'row',
                height: 40,
                justifyContent: 'space-between',
                padding: 8, // Reduced padding to fit height better
              }}
              >
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                  <View style={{
                    backgroundColor: statusInfo.color, borderRadius: 4, height: 8, width: 8,
                  }}
                  />
                  <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>{statusInfo.text}</Text>
                </View>
                <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
                  {candidatesCount}
                  {' '}
                  candidat
                  {candidatesCount > 1 ? 's' : ''}
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.reservationButton,
                  {
                    backgroundColor: playerCtaBackgroundColor,
                    borderColor: playerCtaBorderColor,
                    borderWidth: applicationState.status ? 1 : 0,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.reservationButtonText,
                    { color: playerCtaTextColor },
                  ]}
                >
                  {playerCtaLabel}
                </Text>
              </View>
            )}
          </View>

        </View>
      </Pressable>
    </Animated.View>
  );
}

// Styles copied from EventCardNew.js
const styles = StyleSheet.create({
  backgroundImage: {
    borderRadius: 24,
    opacity: 1,
  },
  category: {
    color: '#E0E0E0',
    fontFamily: 'Montserrat-Medium',
    fontSize: 14,
  },
  clubInfoContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8, // Added a bit of spacing
  },
  clubLogoContainer: {},
  clubName: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 18,
    fontWeight: '800',
  },
  clubTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: '#173844',
    borderColor: '#01B3F4', // Electric Blue
    borderRadius: 24,
    borderWidth: 1.5,
    marginVertical: 8,
    minHeight: 200,
    overflow: 'hidden',
    width: '100%',
  },
  contentContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flex: 1,
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  ctaContainer: {
    marginTop: 12,
    width: '100%',
  },
  detailItem: {
    alignItems: 'center', // Icon center with first line of text
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  detailRow: {
    alignItems: 'flex-start', // Top align for address wrapping
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    width: '100%',
  },
  detailsContainer: {
    gap: 4,
  },
  detailText: {
    color: '#E0E0E0',
    fontFamily: 'Montserrat-Medium',
    fontSize: 13,
  },
  headerContainer: {
    alignItems: 'center',
    backgroundColor: '#01B3F4',
    borderRadius: 7,
    justifyContent: 'center',
    marginBottom: 8,
    paddingVertical: 6,
    width: '100%',
  },
  headerText: {
    color: '#FFFFFF', // Colors.neutral00
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  icon: {
    height: 16,
    marginTop: 1, // Visual adjustment for text alignment
    resizeMode: 'contain',
    width: 16,
  },
  reservationButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: '100%',
  },
  reservationButtonText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 13,
    fontWeight: 'bold',
  },
  sponsorInitial: {
    color: '#173844',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sponsorItem: {
    alignItems: 'center',
    gap: 4,
    width: 48,
  },
  sponsorLogo: {
    height: 24,
    resizeMode: 'contain',
    width: 24,
  },
  sponsorLogoWrapper: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 32,
  },
  sponsorName: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
  },
  sponsorsContainer: {
    marginTop: 8,
  },
  sponsorsScroll: {
    alignItems: 'center',
    gap: 20,
  },
});

export default RecruitmentAdCard;
