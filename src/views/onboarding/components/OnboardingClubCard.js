import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import { getShortAddress } from '@/utils/location';

// Carte club COMPACTE du handoff onboarding 6b. C'est la carte 5a
// (components/molecules/clubCard/ClubCard) resserrée pour l'étape onboarding :
// mêmes blocs, cotes réduites, et SANS marquee sponsors — le handoff l'exclut
// explicitement dans ce contexte.
//
// Chaque bloc ne s'affiche que si la donnée existe : la liste `/clubs` ne
// charge aujourd'hui que logo + sponsors + champs scalaires (mesuré le
// 2026-07-31 sur api-staging), donc chips sections et bandeau stats restent
// masqués tant que le serveur ne les renvoie pas. Le jour où il les renvoie,
// la carte les affiche sans changement de code.

/**
 * Libellé de distance, non tronquable dans la sous-ligne.
 * @param {any} distanceKm - Distance en kilomètres, ou null.
 * @returns {string} - « à X km », vide si la distance est inconnue.
 */
export const formatOnboardingDistance = (distanceKm) => {
  // `Number(null)` vaut 0, pas NaN : sans ce garde, une distance inconnue
  // s'afficherait « à 50 m ». La distance est calculée ici et renvoie null
  // quand un point manque — le cas passe donc par cette porte à chaque rendu.
  if (distanceKm === null || distanceKm === undefined || distanceKm === '') return '';
  const value = Number(distanceKm);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1) return `à ${Math.max(50, Math.round((value * 1000) / 50) * 50)} m`;
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `à ${String(rounded).replace('.', ',')} km`;
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
  const distanceLabel = formatOnboardingDistance(distanceKm);
  const sectionLabels = resolveSectionLabels(item);
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
      <LinearGradient
        colors={[withAlpha(Colors.primary700, 0.9), withAlpha(Colors.primary900, 0.96)]}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.container, { borderColor: withAlpha(Colors.primary500, 0.25) }]}
      >
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

        {/* Rangée 2 — chips sections */}
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
      </LinearGradient>
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
  container: {
    borderRadius: 16,
    borderWidth: 1,
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
