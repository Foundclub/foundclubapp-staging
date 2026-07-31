import { useMemo } from 'react';
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

import { getHostingSummary, normalizeCandidateDates } from '@/domains/search/friendlyMatchFlow';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import { formatDateWithDayPrefix } from '@/utils/date';
import { getImageUrl } from '@/utils/imageUrl';
import { getShortAddress } from '@/utils/location';

import CARD_BACKGROUND from '@/assets/background-card-event/card-match.png';

const MAX_VISIBLE_DATES = 2;

/**
 * Une date candidate en clair. Midi local evite qu un fuseau fasse reculer la
 * date d un jour a l affichage.
 * @param {{ date: string, end?: string, start?: string }} slot
 * @returns {string}
 */
const formatCandidateSlot = (slot) => {
  const label = formatDateWithDayPrefix(new Date(`${slot.date}T12:00:00`));
  if (slot.start && slot.end) return `${label} · ${slot.start}-${slot.end}`;
  if (slot.start) return `${label} · dès ${slot.start}`;
  return label;
};

/**
 * Carte d une annonce de match amical (spec §4.2).
 *
 * Adaptee de RecruitmentAdCard : meme grammaire visuelle (fond d evenement,
 * voile sombre, logo de club, lignes de detail), autres donnees — categorie,
 * format, QUI RECOIT, dates candidates et distance.
 *
 * ⚠️ Contrairement a son modele, cette carte ne porte AUCUN litteral de couleur :
 * tout passe par les jetons du theme et withAlpha(). RecruitmentAdCard vit dans
 * l allowlist d exceptions ; un fichier neuf n a aucune raison d y entrer.
 * @param {object} props
 * @param {any} props.ad
 * @param {boolean} [props.canApply]
 * @param {number | null} [props.distanceKm]
 * @param {boolean} [props.isApplying]
 * @param {boolean} [props.isOwner]
 * @param {string | null} [props.myApplicationStatus]
 * @param {(ad: any) => void} [props.onApply]
 * @param {(ad: any) => void} [props.onPress]
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchAdCard({
  ad,
  canApply = false,
  distanceKm = null,
  isApplying = false,
  isOwner = false,
  myApplicationStatus = null,
  onApply,
  onPress,
}) {
  const { Colors, Fonts, Images } = /** @type {any} */ (useTheme());

  const palette = useMemo(() => ({
    accentBorder: withAlpha(Colors.primary500, 0.18),
    accentSoft: withAlpha(Colors.primary500, 0.1),
    accentTint: withAlpha(Colors.primary500, 0.16),
    chipSurface: withAlpha(Colors.neutral00, 0.08),
    disabledBorder: withAlpha(Colors.neutral00, 0.12),
    disabledSurface: withAlpha(Colors.neutral00, 0.06),
    ownerBorder: withAlpha(Colors.primary500, 0.14),
    ownerSurface: withAlpha(Colors.neutral900, 0.3),
    veil: withAlpha(Colors.neutral900, 0.56),
  }), [Colors]);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const team = ad?.team;
  const club = team?.club;
  const clubName = club?.name || team?.name || 'Club inconnu';
  const clubLogo = getImageUrl(club?.logo?.url);
  const categoryName = ad?.category?.name || 'Catégorie libre';
  const sectionName = ad?.section?.name || '';
  const levelName = ad?.level?.name || 'Niveau libre';
  const formatLabel = ad?.format || 'Format à convenir';
  const sportName = ad?.activity?.name || team?.sport || 'Football';
  const hosting = getHostingSummary(ad);
  const isOpen = ad?.status === 'open' && ad?.isActive !== false;

  const candidateSlots = normalizeCandidateDates(ad?.candidateDates);
  const visibleSlots = candidateSlots.slice(0, MAX_VISIBLE_DATES);
  const extraSlotsCount = candidateSlots.length - visibleSlots.length;
  const datesLabel = visibleSlots.length > 0
    ? [
      visibleSlots.map(formatCandidateSlot).join(' · '),
      extraSlotsCount > 0 ? ` +${extraSlotsCount}` : '',
    ].join('')
    : 'Dates à convenir';

  const cityLabel = getShortAddress(ad?.city || ad?.location?.city || club?.city || '')
    || 'Lieu non précisé';
  const distanceLabel = Number.isFinite(distanceKm) && distanceKm !== null
    ? `${cityLabel} · à ${Math.round(distanceKm)} km`
    : cityLabel;

  const headerLabel = [categoryName, formatLabel].filter(Boolean).join(' · ');
  const applicationsCount = ad?.pendingApplicationsCount ?? ad?.applicationsCount ?? 0;

  // Le badge « qui recoit » porte toujours du TEXTE : la teinte seule ne dirait
  // rien a qui ne distingue pas les couleurs (regle color-not-only).
  const hostingTint = hosting.tone === 'unknown' ? Colors.neutral300 : Colors.primary500;

  let ctaLabel = 'Proposer un match';
  let ctaBackgroundColor = Colors.primary500;
  let ctaBorderColor = Colors.transparent;
  let ctaTextColor = Colors.neutral900;
  let ctaBorderWidth = 0;
  let isCtaInteractive = Boolean(onApply) && canApply && isOpen && !isApplying;

  if (!isOpen) {
    ctaLabel = ad?.status === 'matched' ? 'Adversaire trouvé' : 'Annonce clôturée';
    ctaBackgroundColor = palette.disabledSurface;
    ctaBorderColor = palette.disabledBorder;
    ctaTextColor = Colors.neutral300;
    ctaBorderWidth = 1;
    isCtaInteractive = false;
  } else if (myApplicationStatus === 'accepted') {
    ctaLabel = 'Match confirmé';
    ctaBackgroundColor = withAlpha(Colors.primary500, 0.12);
    ctaBorderColor = withAlpha(Colors.primary500, 0.35);
    ctaTextColor = Colors.primary500;
    ctaBorderWidth = 1;
    isCtaInteractive = false;
  } else if (myApplicationStatus === 'pending') {
    ctaLabel = 'Proposition envoyée';
    ctaBackgroundColor = palette.disabledSurface;
    ctaBorderColor = withAlpha(Colors.primary500, 0.25);
    ctaTextColor = Colors.primary100;
    ctaBorderWidth = 1;
    isCtaInteractive = false;
  } else if (myApplicationStatus === 'declined') {
    ctaLabel = 'Proposition refusée';
    ctaBackgroundColor = palette.disabledSurface;
    ctaBorderColor = palette.disabledBorder;
    ctaTextColor = Colors.neutral300;
    ctaBorderWidth = 1;
    isCtaInteractive = false;
  } else if (isApplying) {
    ctaLabel = 'Envoi...';
  } else if (!canApply) {
    ctaLabel = 'Réservé aux entraîneurs et dirigeants';
    ctaBackgroundColor = palette.disabledSurface;
    ctaBorderColor = palette.disabledBorder;
    ctaTextColor = Colors.neutral300;
    ctaBorderWidth = 1;
  }

  const ctaStyles = [
    styles.ctaBadge,
    {
      backgroundColor: ctaBackgroundColor,
      borderColor: ctaBorderColor,
      borderWidth: ctaBorderWidth,
    },
  ];
  const ctaContent = (
    <Text style={[Fonts.p3Bold, { color: ctaTextColor }]}>{ctaLabel}</Text>
  );

  let ownerStatusLabel = 'Clôturée';
  if (isOpen) ownerStatusLabel = 'En ligne';
  else if (ad?.status === 'matched') ownerStatusLabel = 'Match trouvé';

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: Colors.primary700, borderColor: palette.accentBorder },
        animatedStyle,
      ]}
    >
      <ImageBackground
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
        source={/** @type {any} */ (CARD_BACKGROUND)}
        style={StyleSheet.absoluteFill}
      />

      <Pressable
        accessibilityHint="Ouvrir le détail de l'annonce"
        accessibilityLabel={`Match amical, ${clubName}, ${headerLabel}, ${hosting.label}`}
        accessibilityRole="button"
        onPress={() => onPress?.(ad)}
        onPressIn={() => { scale.value = withTiming(0.985, { duration: 100 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 100 }); }}
        style={StyleSheet.absoluteFill}
      />

      <View
        pointerEvents="box-none"
        style={[styles.contentContainer, { backgroundColor: palette.veil }]}
      >
        <View pointerEvents="none">
          <View style={[
            styles.headerContainer,
            { backgroundColor: palette.accentSoft, borderColor: Colors.primary500 },
          ]}
          >
            <Text
              numberOfLines={1}
              style={[Fonts.p3Bold, styles.headerText, { color: Colors.primary500 }]}
            >
              {headerLabel.toUpperCase()}
            </Text>
          </View>

          <View style={styles.clubInfoContainer}>
            <ClubLogoMark
              logoStyle={{ borderColor: Colors.neutral200, borderRadius: 24, borderWidth: 1 }}
              logoUrl={clubLogo}
              name={clubName}
              size={48}
            />

            <View style={styles.clubTextContainer}>
              <Text numberOfLines={1} style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                {clubName}
              </Text>

              <View style={styles.subHeaderRow}>
                {team?.name ? (
                  <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral200 }]}>
                    {team.name}
                  </Text>
                ) : null}

                <View style={[styles.sportBadge, { backgroundColor: palette.accentTint }]}>
                  <Text
                    numberOfLines={1}
                    style={[Fonts.p4Bold, styles.badgeText, { color: Colors.primary500 }]}
                  >
                    {sportName}
                  </Text>
                </View>
              </View>

              <View style={[
                styles.hostingChip,
                { backgroundColor: palette.chipSurface, borderColor: withAlpha(hostingTint, 0.35) },
              ]}
              >
                <Text style={[Fonts.p4Bold, { color: hostingTint }]}>
                  {hosting.label.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Image
                  source={Images.filter}
                  style={[styles.icon, { tintColor: Colors.primary500 }]}
                />
                <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral100 }]}>
                  {levelName}
                </Text>
              </View>

              <View style={[styles.detailItem, styles.detailItemRight]}>
                <Image
                  source={Images.users}
                  style={[styles.icon, { tintColor: Colors.neutral300 }]}
                />
                <Text
                  numberOfLines={1}
                  style={[Fonts.p4, styles.detailTextRight, { color: Colors.neutral100 }]}
                >
                  {[categoryName, sectionName].filter(Boolean).join(' - ')}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.detailItem, styles.detailItemFull]}>
                <Image
                  source={Images.calendar}
                  style={[styles.icon, { tintColor: Colors.primary500 }]}
                />
                <Text
                  numberOfLines={2}
                  style={[Fonts.p4, styles.detailTextGrow, { color: Colors.neutral100 }]}
                >
                  {datesLabel}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.detailItem, styles.detailItemFull]}>
                <Image
                  source={Images.pin}
                  style={[styles.icon, { tintColor: Colors.primary500 }]}
                />
                <Text
                  numberOfLines={2}
                  style={[Fonts.p4, styles.detailTextGrow, { color: Colors.neutral100 }]}
                >
                  {distanceLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View pointerEvents="auto" style={styles.ctaContainer}>
          {isOwner ? (
            <View style={[
              styles.ownerStatusContainer,
              { backgroundColor: palette.ownerSurface, borderColor: palette.ownerBorder },
            ]}
            >
              <View style={styles.ownerStatusLeft}>
                <View style={[
                  styles.ownerStatusDot,
                  { backgroundColor: isOpen ? Colors.primary500 : Colors.neutral500 },
                ]}
                />
                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>{ownerStatusLabel}</Text>
              </View>
              <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
                {`${applicationsCount} proposition${applicationsCount > 1 ? 's' : ''}`}
              </Text>
            </View>
          ) : null}

          {!isOwner && isCtaInteractive ? (
            <TouchableOpacity
              accessibilityHint="Proposer un match à cette équipe"
              accessibilityLabel={ctaLabel}
              accessibilityRole="button"
              activeOpacity={0.9}
              onPress={() => onApply?.(ad)}
              style={ctaStyles}
            >
              {ctaContent}
            </TouchableOpacity>
          ) : null}

          {!isOwner && !isCtaInteractive ? (
            <View style={ctaStyles}>{ctaContent}</View>
          ) : null}
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
  badgeText: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  clubInfoContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 2,
  },
  clubTextContainer: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 6,
  },
  container: {
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 232,
    overflow: 'hidden',
    width: '100%',
  },
  contentContainer: {
    flex: 1,
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  ctaBadge: {
    alignItems: 'center',
    borderRadius: 19,
    height: 44,
    justifyContent: 'center',
    width: '100%',
  },
  ctaContainer: {
    elevation: 999,
    marginTop: 16,
    width: '100%',
    zIndex: 999,
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  detailItemFull: {
    width: '100%',
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
    gap: 10,
    marginTop: 4,
  },
  detailTextGrow: {
    flex: 1,
  },
  detailTextRight: {
    flex: 0,
    textAlign: 'right',
  },
  headerContainer: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    marginBottom: 8,
    paddingVertical: 3,
    width: '100%',
  },
  headerText: {
    textTransform: 'uppercase',
  },
  hostingChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  icon: {
    height: 16,
    resizeMode: 'contain',
    width: 16,
  },
  ownerStatusContainer: {
    alignItems: 'center',
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
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  subHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
});

export default FriendlyMatchAdCard;
