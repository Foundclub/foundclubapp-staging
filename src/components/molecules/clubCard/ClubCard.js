import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ClubCardSurface from '@/components/molecules/clubCard/ClubCardSurface';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import SponsorMarquee from '@/components/molecules/sponsorMarquee/SponsorMarquee';

import { formatClubDistanceLabel, getShortAddress } from '@/utils/location';

// Carte club du handoff « Cartes Rechercher » (tour 5a). Remplace la rangée
// de ClubListContent. Chaque bloc (chips sections, bandeau stats, badge
// RECRUTE, distance) ne s'affiche que si la donnée existe dans le payload —
// la liste des clubs ne charge aujourd'hui que logo + sponsors.
//
// L23 — le formateur de distance et l'enveloppe dégradée sont PARTAGÉS avec
// `views/onboarding/components/OnboardingClubCard`. Ces deux morceaux avaient
// été corrigés chacun d'un seul côté ; ils n'ont plus qu'un exemplaire.

/**
 * Libellés des chips sections, depuis les relations réellement chargées.
 * @param {any} item - Club affiché.
 * @returns {string[]} - Libellés des sections sportives chargées.
 */
const resolveSectionLabels = (item) => {
  const rawSections = item?.activites || item?.activities || item?.sections || [];
  if (Array.isArray(rawSections)) {
    return rawSections
      .map((section) => (typeof section === 'string' ? section : section?.name || ''))
      .map((label) => String(label).trim())
      .filter(Boolean);
  }
  return [];
};

/**
 * Premier compteur numérique disponible pour le bandeau stats.
 * @param {...any} candidates - Valeurs candidates pour un compteur.
 * @returns {number | null} - Premier compteur numérique, sinon null.
 */
const resolveStatValue = (...candidates) => {
  const found = candidates.find((value) => (
    value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  ));
  return found === undefined ? null : Number(found);
};

/**
 * Carte club des listes de recherche (design 5a).
 * @param {object} props
 * @param {any} props.item - Club (ou club multisport, `_type: 'multisport'`).
 * @param {() => void} [props.onPress]
 * @param {string} [props.reasonLabel] - Raison de pertinence (recherche intelligente).
 * @returns {import('react').ReactElement}
 */
function ClubCard({ item, onPress, reasonLabel = '' }) {
  const { Colors, Images } = useTheme();

  const isMultisport = Reflect.get(item || {}, '_type') === 'multisport';
  const shortAddress = getShortAddress(item?.addressDetails || item?.address);
  const searchMeta = Reflect.get(item || {}, '__search');
  const distanceLabel = formatClubDistanceLabel(searchMeta?.distanceKm);
  const sectionLabels = resolveSectionLabels(item);
  const sponsors = Array.isArray(item?.sponsor) ? item.sponsor : [];
  const isRecruiting = Boolean(
    (Array.isArray(item?.recruitmentAds) && item.recruitmentAds.length > 0)
    || item?.isRecruiting,
  );

  const teamsCount = resolveStatValue(
    item?.teamsCount,
    Array.isArray(item?.teams) ? item.teams.length : undefined,
  );
  const membersCount = resolveStatValue(
    item?.membersCount,
    Array.isArray(item?.members) ? item.members.length : undefined,
  );
  const adsCount = resolveStatValue(
    item?.openAdsCount,
    Array.isArray(item?.recruitmentAds) ? item.recruitmentAds.length : undefined,
  );
  const stats = [
    { label: 'Équipes', value: teamsCount },
    { label: 'Membres', value: membersCount },
    { accent: true, label: 'Annonces', value: adsCount },
  ].filter((stat) => stat.value !== null);

  const glassChipStyle = {
    backgroundColor: withAlpha(Colors.neutral00, 0.08),
    borderColor: withAlpha(Colors.neutral00, 0.16),
  };

  return (
    <TouchableOpacity
      accessibilityLabel={[item?.name || 'Club', shortAddress].filter(Boolean).join(', ')}
      accessibilityRole="button"
      activeOpacity={0.85}
      disabled={!onPress}
      onPress={onPress}
    >
      {/*
        R07 — le degrade est un FOND POSE DERRIERE, jamais le conteneur. Le motif
        (conteneur ordinaire + degrade en absoluteFill + overflow hidden) vit
        maintenant dans ClubCardSurface, partage avec la carte d'inscription :
        c'est ce qui empeche la correction de ne s'appliquer qu'a une carte sur
        deux, comme c'etait le cas jusqu'a L23.
      */}
      <ClubCardSurface style={styles.container}>
        {reasonLabel ? (
          <Text style={[styles.reasonLabel, { color: Colors.primary200 }]}>
            {reasonLabel}
          </Text>
        ) : null}

        {/* En-tête : logo (ou initiales), nom, OMNISPORT, ville + distance, RECRUTE */}
        <View style={styles.headerRow}>
          <ClubLogoMark
            club={item}
            logoStyle={styles.clubLogo}
            size={50}
          />
          <View style={styles.headerTextContainer}>
            <View style={styles.nameRow}>
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={[styles.clubName, { color: Colors.neutral00 }]}
              >
                {item?.name || 'Club'}
              </Text>
              {isMultisport ? (
                <View style={[styles.omnisportBadge, { backgroundColor: Colors.primary500 }]}>
                  <Text style={[styles.omnisportText, { color: Colors.primary900 }]}>
                    OMNISPORT
                  </Text>
                </View>
              ) : null}
            </View>
            {shortAddress || distanceLabel ? (
              <View style={styles.addressRow}>
                <Image
                  source={Images.pin}
                  style={[styles.pinIcon, { tintColor: Colors.primary500 }]}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.addressText, { color: Colors.neutral300 }]}
                >
                  {shortAddress}
                  {shortAddress && distanceLabel ? (
                    <Text style={{ color: Colors.primary500 }}>{' · '}</Text>
                  ) : null}
                  {distanceLabel ? (
                    <Text style={{ color: Colors.primary500 }}>{distanceLabel}</Text>
                  ) : null}
                </Text>
              </View>
            ) : null}
          </View>
          {isRecruiting ? (
            <View style={[styles.recruitBadge, { borderColor: Colors.success500 }]}>
              <Text style={[styles.recruitText, { color: Colors.success500 }]}>RECRUTE</Text>
            </View>
          ) : null}
        </View>

        {/* Chips sections sportives */}
        {sectionLabels.length > 0 || (isMultisport && item?.sectionsCount) ? (
          <View style={styles.chipsRow}>
            {sectionLabels.map((label) => (
              <View key={label} style={[styles.sectionChip, glassChipStyle]}>
                <Text style={[styles.sectionChipText, { color: Colors.neutral100 }]}>{label}</Text>
              </View>
            ))}
            {!sectionLabels.length && isMultisport && item?.sectionsCount ? (
              <View style={[styles.sectionChip, glassChipStyle]}>
                <Text style={[styles.sectionChipText, { color: Colors.neutral100 }]}>
                  {`${item.sectionsCount} section${item.sectionsCount > 1 ? 's' : ''}`}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Bandeau stats — seulement les compteurs réellement présents */}
        {stats.length > 0 ? (
          <View style={[styles.statsBand, { backgroundColor: withAlpha(Colors.neutral00, 0.05) }]}>
            {stats.map((stat, index) => (
              <View
                key={stat.label}
                style={[
                  styles.statCell,
                  index > 0
                    ? { borderLeftColor: withAlpha(Colors.neutral00, 0.1), borderLeftWidth: 1 }
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.statValue,
                    { color: stat.accent ? Colors.primary500 : Colors.neutral00 },
                  ]}
                >
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: Colors.neutral300 }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Pied sponsors — marquee continue, masqué sans sponsor */}
        <SponsorMarquee fadeColor={Colors.primary900} sponsors={sponsors} />
      </ClubCardSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  addressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  addressText: {
    flexShrink: 1,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  clubLogo: {
    borderRadius: 13,
  },
  clubName: {
    flexShrink: 1,
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
    fontWeight: '800',
  },
  // Cotes propres a la carte de recherche. La bordure, le fond degrade et la
  // decoupe des coins viennent de ClubCardSurface.
  container: {
    borderRadius: 18,
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
  },
  headerTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  omnisportBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  omnisportText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pinIcon: {
    height: 13,
    resizeMode: 'contain',
    width: 13,
  },
  reasonLabel: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 12,
  },
  recruitBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recruitText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  sectionChipText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 11,
    fontWeight: '700',
  },
  statCell: {
    alignItems: 'center',
    flex: 1,
    gap: 1,
  },
  statLabel: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    fontWeight: '600',
  },
  statsBand: {
    borderRadius: 12,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  statValue: {
    fontFamily: 'Montserrat-Black',
    fontSize: 16,
    fontWeight: '900',
  },
});

export default ClubCard;
