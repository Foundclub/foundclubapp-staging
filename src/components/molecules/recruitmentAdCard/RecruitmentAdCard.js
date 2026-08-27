import { useNavigation } from '@react-navigation/native';
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import { RouteNames } from '@/navigation/routeNames';

import { resolveRecruitmentAdApplicationState } from '@/services/recruitment/recruitmentService';

import { formatDateWithDayPrefix } from '@/utils/date';
import { resolveLocationDisplayLabel } from '@/utils/facilityAddressLabel';
import { getImageUrl } from '@/utils/imageUrl';
import { getShortAddress } from '@/utils/location';

import CARD_BACKGROUND from '@/assets/background-card-event/card-autre.png';
import { getRecruitAthleteNoun } from '@/constants/positions';

const normalizeTypeLabel = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const humanizeEnumLabel = (value, fallback = '') => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return fallback;

  return normalizedValue
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * RecruitmentAdCard component.
 * @param {object} props
 * @param {object} props.ad
 * @param {Record<string, { status?: string, recruitmentAdDocumentId?: string }>} [props.detectionApplicationStatusByEvent]
 * @param {boolean} [props.isOwner]
 * @param {boolean} [props.isApplying]
 * @param {(ad: object) => void} [props.onApply]
 * @param {(ad: object) => void} [props.onPress]
 * @returns {import('react').ReactElement}
 */
function RecruitmentAdCard({
  ad,
  detectionApplicationStatusByEvent = {},
  isApplying = false,
  isOwner = false,
  onApply,
  onPress,
}) {
  const navigation = useNavigation();
  const {
    Colors, Fonts, Images,
  } = useTheme();
  const { userData } = useAuth();

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.985, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  const { team } = ad;
  const club = team?.club;
  const clubName = club?.name || team?.name || 'Club inconnu';
  const clubLogo = getImageUrl(club?.logo?.url);
  const isCoachAd = String(ad?.audienceType || '').trim().toLowerCase() === 'coach';
  const positionLabel = isCoachAd
    ? humanizeEnumLabel(ad?.coachRoleOther || ad?.coachRole, 'Rôle entraîneur')
    : (ad.position || 'Poste non spécifié');
  const levelName = ad.level?.name || ad.minLevel || 'Niveau ?';
  const categoryName = ad.category?.name || ad.category || 'Catégorie ?';
  const sectionName = ad.section?.name || ad.section || '';
  const sportName = ad.sport || team?.sport || 'Football';
  const address = getShortAddress(ad.city || club?.city || '');
  // T8 : 6 annonces portent « Gymnase - [object Object] » ECRIT EN BASE (releve du
  // 26/08). Tant que ces lignes ne sont pas reparees, l'affichage recompose le
  // libelle depuis les champs restes sains de la MEME charge.
  const locationLabel = resolveLocationDisplayLabel(ad.address, address || 'Lieu non précisé');
  const isDetectionLinked = normalizeTypeLabel(ad?.event?.type?.name).includes('detection');
  const detectionDateLabel = ad?.event?.date
    ? formatDateWithDayPrefix(new Date(ad.event.date))
    : '';
  const applicationState = resolveRecruitmentAdApplicationState(
    ad,
    userData,
    detectionApplicationStatusByEvent,
  );

  let playerCtaBackgroundColor = Colors.primary500;
  let playerCtaBorderColor = 'transparent';
  let playerCtaTextColor = Colors.neutral00;
  let playerCtaBorderWidth = 0;
  let playerCtaLabel = isCoachAd ? 'Candidater' : 'Postuler';

  if (!ad.isActive) {
    playerCtaLabel = 'Annonce inactive';
    playerCtaBackgroundColor = 'rgba(255,255,255,0.06)';
    playerCtaBorderColor = 'rgba(255,255,255,0.12)';
    playerCtaTextColor = Colors.neutral300;
    playerCtaBorderWidth = 1;
  } else if (applicationState.status === 'accepted') {
    playerCtaLabel = isCoachAd ? 'Candidature acceptée' : 'Je participe';
    playerCtaBackgroundColor = `${Colors.primary500}18`;
    playerCtaBorderColor = `${Colors.primary500}45`;
    playerCtaTextColor = Colors.primary500;
    playerCtaBorderWidth = 1;
  } else if (applicationState.status === 'pending') {
    playerCtaLabel = 'Demande en attente';
    playerCtaBackgroundColor = 'rgba(255,255,255,0.06)';
    playerCtaBorderColor = `${Colors.primary500}35`;
    playerCtaTextColor = Colors.primary100;
    playerCtaBorderWidth = 1;
  } else if (isApplying) {
    playerCtaLabel = 'Envoi...';
  }

  const candidatesCount = ad.applicationsCount || ad.candidatesCount || ad.candidates?.length || 0;
  const statusInfo = ad.isActive
    ? { color: Colors.primary500, text: 'En ligne' }
    : { color: Colors.neutral500, text: 'Inactive' };
  const rightMetaLabel = [categoryName, sectionName].filter(Boolean).join(' - ');
  const audienceTypeLabel = isCoachAd ? 'ENTRAINEUR' : getRecruitAthleteNoun(sportName).toUpperCase();

  const handlePress = () => {
    if (onPress) {
      onPress(ad);
      return;
    }

    navigation.navigate(RouteNames.RecruitmentAdDetails, { ad });
  };

  const handleApplyPress = () => {
    if (!onApply) return;
    onApply(ad);
  };

  const isPlayerCtaDisabled = !ad.isActive || applicationState.hasApplied || isApplying;
  const shouldRenderInteractiveCta = Boolean(onApply) && !isPlayerCtaDisabled;
  const playerCtaStyles = [
    styles.ctaBadge,
    !shouldRenderInteractiveCta && styles.ctaBadgeDisabled,
    {
      backgroundColor: playerCtaBackgroundColor,
      borderColor: playerCtaBorderColor,
      borderWidth: playerCtaBorderWidth,
    },
  ];

  const playerCtaContent = (
    <Text style={[styles.ctaBadgeText, { color: playerCtaTextColor }]}>
      {playerCtaLabel}
    </Text>
  );
  const playerCtaNode = shouldRenderInteractiveCta ? (
    <TouchableOpacity
      accessibilityHint="Postuler à cette annonce"
      accessibilityLabel={playerCtaLabel}
      accessibilityRole="button"
      activeOpacity={0.9}
      onPress={handleApplyPress}
      style={playerCtaStyles}
    >
      {playerCtaContent}
    </TouchableOpacity>
  ) : (
    <View style={playerCtaStyles}>{playerCtaContent}</View>
  );

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ImageBackground
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
        source={CARD_BACKGROUND}
        style={StyleSheet.absoluteFill}
      />

      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="box-none" style={styles.contentContainer}>
        <View pointerEvents="none">
          <View style={styles.headerContainer}>
            <Text numberOfLines={1} style={styles.headerText}>
              {positionLabel.toUpperCase()}
            </Text>
          </View>

          <View style={styles.clubInfoContainer}>
            <View style={styles.clubLogoContainer}>
              <ClubLogoMark
                logoStyle={{ borderColor: Colors.neutral200, borderRadius: 24, borderWidth: 1 }}
                logoUrl={clubLogo}
                name={clubName}
                size={48}
              />
            </View>

            <View style={styles.clubTextContainer}>
              {/* MARQUEE — le nom du club de l annonce se lit en entier */}
              <MarqueeText
                style={styles.clubName}
                text={clubName}
              />

              <View style={styles.subHeaderRow}>
                {team?.name ? (
                  <MarqueeText
                    style={styles.category}
                    text={team.name}
                  />
                ) : null}

                <View style={styles.typeBadge}>
                  <Text
                    numberOfLines={1}
                    style={[Fonts.p4Bold, styles.typeBadgeText]}
                  >
                    {audienceTypeLabel}
                  </Text>
                </View>

                <View style={styles.sportBadge}>
                  <Text
                    numberOfLines={1}
                    style={[Fonts.p4Bold, styles.sportBadgeText]}
                  >
                    {sportName}
                  </Text>
                </View>
              </View>

              {isDetectionLinked ? (
                <View style={styles.detectionChip}>
                  <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                    Détection
                  </Text>
                  {detectionDateLabel ? (
                    <Text style={[Fonts.p4, { color: Colors.neutral200 }]}>
                      {detectionDateLabel}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Image source={Images.filter} style={[styles.icon, { tintColor: Colors.primary500 }]} />
                <Text numberOfLines={1} style={styles.detailText}>
                  {isCoachAd ? (ad?.engagementType || levelName) : levelName}
                </Text>
              </View>

              <View style={[styles.detailItem, styles.detailItemRight]}>
                <Image source={Images.users} style={[styles.icon, { tintColor: Colors.neutral300 }]} />
                <Text numberOfLines={1} style={[styles.detailText, styles.detailTextRight]}>
                  {rightMetaLabel || (isCoachAd ? 'Cadre à preciser' : 'Catégorie libre')}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.detailItem, { width: '100%' }]}>
                <Image source={Images.pin} style={[styles.icon, { tintColor: Colors.primary500 }]} />
                <Text numberOfLines={2} style={[styles.detailText, { flex: 1 }]}>
                  {locationLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View pointerEvents="auto" style={[styles.ctaContainer, { elevation: 999, zIndex: 999 }]}>
          {isOwner ? (
            <View style={styles.ownerStatusContainer}>
              <View style={styles.ownerStatusLeft}>
                <View style={[styles.ownerStatusDot, { backgroundColor: statusInfo.color }]} />
                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>{statusInfo.text}</Text>
              </View>
              <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
                {candidatesCount}
                {' '}
                candidat
                {candidatesCount > 1 ? 's' : ''}
              </Text>
            </View>
          ) : playerCtaNode}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    borderRadius: 24,
    opacity: 1,
  },
  category: {
    color: '#BFD5E2',
    fontFamily: 'Montserrat-Medium',
    fontSize: 13,
    marginTop: 2,
  },
  clubInfoContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 2,
  },
  clubLogoContainer: {},
  clubName: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  clubTextContainer: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 6,
  },
  container: {
    backgroundColor: '#173844',
    borderColor: 'rgba(1,179,244,0.18)',
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 200,
    overflow: 'hidden',
    width: '100%',
  },
  contentContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
    flex: 1,
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  ctaBadge: {
    alignItems: 'center',
    borderRadius: 19,
    height: 42,
    justifyContent: 'center',
    width: '100%',
  },
  ctaBadgeDisabled: {
    opacity: 0.98,
  },
  ctaBadgeText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 13,
    fontWeight: 'bold',
  },
  ctaContainer: {
    marginTop: 16,
    width: '100%',
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  detailItemRight: {
    justifyContent: 'flex-end',
  },
  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    width: '100%',
  },
  detailsContainer: {
    gap: 12,
    marginTop: 4,
  },
  detailText: {
    color: '#D6E7EE',
    fontFamily: 'Montserrat-Medium',
    fontSize: 13,
  },
  detailTextRight: {
    flex: 0,
    textAlign: 'right',
  },
  detectionChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(1,179,244,0.35)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(1, 179, 244, 0.10)',
    borderColor: '#01B3F4',
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    marginBottom: 8,
    paddingVertical: 3,
    width: '100%',
  },
  headerText: {
    color: '#01B3F4',
    fontFamily: 'Montserrat-Bold',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  icon: {
    height: 16,
    resizeMode: 'contain',
    width: 16,
  },
  ownerStatusContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderColor: 'rgba(1,179,244,0.14)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  ownerStatusDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  ownerStatusLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sportBadge: {
    backgroundColor: 'rgba(1, 179, 244, 0.16)',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sportBadgeText: {
    color: '#01B3F4',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  subHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    textTransform: 'uppercase',
  },
});
export default RecruitmentAdCard;
