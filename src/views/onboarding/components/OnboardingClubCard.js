import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import ClubCardSurface from '@/components/molecules/clubCard/ClubCardSurface';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import { formatClubDistanceLabel, getShortAddress } from '@/utils/location';

// Carte club COMPACTE du handoff onboarding 6b. C'est la carte 5a
// (components/molecules/clubCard/ClubCard) resserrée pour l'étape onboarding :
// mêmes blocs, cotes réduites, et SANS marquee sponsors — la ligne défilante
// de la carte 5a n'a pas sa place ici.
//
// D56 — le sponsor, LUI, y a sa place, et le pack d'inscription le réclame
// nommément : il s'affiche en ligne FIXE sous l'en-tête. C'est la seule
// différence avec le handoff 6b d'origine.
//
// Chaque bloc ne s'affiche que si la donnée existe : la liste `/clubs` ne
// charge aujourd'hui que logo + sponsors + champs scalaires (mesuré le
// 2026-07-31 sur api-staging), donc chips sections et bandeau stats restent
// masqués tant que le serveur ne les renvoie pas. Le jour où il les renvoie,
// la carte les affiche sans changement de code.
//
// L23 — les DEUX morceaux qui avaient divergé avec la carte 5a sont désormais
// partagés : le formateur de distance (`@/utils/location`) et l'enveloppe
// dégradée (`ClubCardSurface`). Corriger l'un des deux côtés seulement rend
// rouge `src/utils/clubDistanceLabel.test.js`.

/**
 * Sponsor mis en avant sur la carte, avec son libellé affichable.
 * @param {any} item - Club affiché.
 * @returns {{ label: string, logoUrl: string, sponsor: any } | null} - Sponsor, ou null.
 */
const resolveHighlightedSponsor = (item) => {
  const sponsors = Array.isArray(item?.sponsor) ? item.sponsor : [];
  const sponsor = sponsors[0];
  if (!sponsor) return null;

  const label = String(sponsor.title || sponsor.name || '').trim();
  const logoUrl = sponsor.logo?.url || '';
  if (!label && !logoUrl) return null;

  return { label, logoUrl, sponsor };
};

/**
 * Libellés des sections sportives réellement chargées.
 * @param {any} item - Club affiché.
 * @returns {string[]} - Libellés non vides.
 */
const resolveSectionLabels = (item) => {
  const raw = item?.activites || item?.activities || item?.sections || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((section) => (typeof section === 'string' ? section : section?.name || ''))
    .map((label) => String(label).trim())
    .filter(Boolean);
};

/**
 * Premier compteur numérique disponible.
 * @param {...any} candidates - Valeurs candidates.
 * @returns {number | null} - Compteur, ou null si aucun n'est exploitable.
 */
const resolveStatValue = (...candidates) => {
  const found = candidates.find((value) => (
    value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  ));
  return found === undefined ? null : Number(found);
};

/**
 * Carte club compacte de l'étape onboarding « Trouve ton club ».
 * @param {object} props
 * @param {any} props.item - Club affiché.
 * @param {string} [props.accessibilityHint]
 * @param {string} [props.accessibilityLabel]
 * @param {number | null} [props.distanceKm] - Distance calculée côté client.
 * @param {() => void} [props.onPress] - Ouverture de la fiche club.
 * @returns {import('react').ReactElement}
 */
function OnboardingClubCard({
  accessibilityHint = undefined,
  accessibilityLabel = undefined,
  distanceKm = null,
  item,
  onPress = undefined,
}) {
  const { Colors, Images } = useTheme();

  const clubName = item?.name || 'Club';
  const shortAddress = getShortAddress(item?.addressDetails || item?.address);
  const distanceLabel = formatClubDistanceLabel(distanceKm);
  const sectionLabels = resolveSectionLabels(item);
  const highlightedSponsor = resolveHighlightedSponsor(item);
  const isRecruiting = Boolean(
    (Array.isArray(item?.recruitmentAds) && item.recruitmentAds.length > 0)
    || item?.isRecruiting,
  );

  const stats = [
    {
      label: 'Équipes',
      value: resolveStatValue(
        item?.teamsCount,
        Array.isArray(item?.teams) ? item.teams.length : undefined,
      ),
    },
    {
      label: 'Membres',
      value: resolveStatValue(
        item?.membersCount,
        Array.isArray(item?.members) ? item.members.length : undefined,
      ),
    },
    {
      accent: true,
      label: 'Annonces',
      value: resolveStatValue(
        item?.openAdsCount,
        Array.isArray(item?.recruitmentAds) ? item.recruitmentAds.length : undefined,
      ),
    },
  ].filter((stat) => stat.value !== null);

  const glassChipStyle = {
    backgroundColor: withAlpha(Colors.neutral00, 0.08),
    borderColor: withAlpha(Colors.neutral00, 0.16),
  };

  return (
    <TouchableOpacity
      accessibilityHint={accessibilityHint}
      accessibilityLabel={
        accessibilityLabel || [clubName, shortAddress].filter(Boolean).join(', ')
      }
      accessibilityRole="button"
      activeOpacity={0.85}
      disabled={!onPress}
      onPress={onPress}
    >
      {/*
        R18 — le dégradé ENVELOPPAIT ce contenu : il devait donc se dimensionner
        sur ses enfants, et tranchait la carte. Même défaut que R07 sur la carte
        de recherche, même remède, désormais dans un seul endroit.
      */}
      <ClubCardSurface style={styles.container}>
        {/* Rangée 1 — logo réel ou initiale, nom, ville + distance, RECRUTE */}
        <View style={styles.headerRow}>
          <ClubLogoMark
            club={item}
            logoStyle={styles.clubLogo}
            name={clubName}
            size={44}
          />
          <View style={styles.headerTextContainer}>
            <Text
              ellipsizeMode="tail"
              numberOfLines={1}
              style={[styles.clubName, { color: Colors.neutral00 }]}
            >
              {clubName}
            </Text>
            {shortAddress || distanceLabel ? (
              <View style={styles.addressRow}>
                <Image
                  source={Images.pin}
                  style={[styles.pinIcon, { tintColor: Colors.primary500 }]}
                />
                {shortAddress ? (
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={[styles.addressText, { color: Colors.neutral300 }]}
                  >
                    {shortAddress}
                  </Text>
                ) : null}
                {shortAddress && distanceLabel ? (
                  <Text style={[styles.addressText, { color: Colors.primary500 }]}>·</Text>
                ) : null}
                {distanceLabel ? (
                  <Text style={[styles.distanceText, { color: Colors.primary500 }]}>
                    {distanceLabel}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
          {isRecruiting ? (
            <View style={[styles.recruitBadge, { borderColor: Colors.success500 }]}>
              <Text style={[styles.recruitText, { color: Colors.success500 }]}>RECRUTE</Text>
            </View>
          ) : null}
        </View>

        {/*
          D56 — le pack d'inscription demande le sponsor du club ICI : sous
          l'en-tête, au-dessus des chips sports, sur « Trouve ton club » (les 3
          parcours) et « Quel ancien club ? ». Ce n'est PAS le marquee de la
          carte 5a — la carte compacte garde une ligne FIXE, sans animation.
          ponytail: un seul sponsor est montré, le pack le décrit au singulier
          et la carte n'a pas la place d'en aligner plusieurs. Sortie si la
          recette en demande plus : passer à SponsorMarquee, déjà partagé.
        */}
        {highlightedSponsor ? (
          <View style={styles.sponsorRow}>
            <SponsorLogoTile
              height={22}
              imageUrl={highlightedSponsor.logoUrl}
              showTitle={false}
              title={highlightedSponsor.label}
              width={22}
            />
            {highlightedSponsor.label ? (
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={[styles.sponsorName, { color: Colors.neutral300 }]}
              >
                {highlightedSponsor.label}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Rangée 3 — chips sections */}
        {sectionLabels.length > 0 ? (
          <View style={styles.chipsRow}>
            {sectionLabels.map((label) => (
              <View key={label} style={[styles.sectionChip, glassChipStyle]}>
                <Text style={[styles.sectionChipText, { color: Colors.neutral100 }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Rangée 3 — bandeau stats, seulement les compteurs présents */}
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
      </ClubCardSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  addressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 2,
  },
  addressText: {
    flexShrink: 1,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11.5,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  clubLogo: {
    borderRadius: 12,
  },
  clubName: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 14.5,
    fontWeight: '800',
  },
  // Cotes resserrées propres à l'étape onboarding. La bordure, le fond dégradé
  // et la découpe des coins viennent de ClubCardSurface.
  container: {
    borderRadius: 16,
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  // Non tronquable : la distance est l'information de pertinence de la liste.
  distanceText: {
    flexShrink: 0,
    fontFamily: 'Montserrat-Bold',
    fontSize: 11.5,
    fontWeight: '700',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  headerTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  pinIcon: {
    height: 12,
    resizeMode: 'contain',
    width: 12,
  },
  recruitBadge: {
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  recruitText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  sectionChipText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 10.5,
    fontWeight: '700',
  },
  sponsorName: {
    flexShrink: 1,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10.5,
    fontWeight: '600',
  },
  sponsorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  statCell: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 9,
    fontWeight: '600',
  },
  statsBand: {
    borderRadius: 10,
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 7,
  },
  statValue: {
    fontFamily: 'Montserrat-Black',
    fontSize: 14,
    fontWeight: '900',
  },
});

export default OnboardingClubCard;
