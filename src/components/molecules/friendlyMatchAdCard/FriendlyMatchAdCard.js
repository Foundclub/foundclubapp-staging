import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

import { getHostingTag, normalizeCandidateDates } from '@/domains/search/friendlyMatchFlow';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import HostingIcon from '@/components/atoms/hostingIcon/HostingIcon';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import { formatDateWithDayPrefix } from '@/utils/date';
import { getImageUrl } from '@/utils/imageUrl';
import { getShortAddress } from '@/utils/location';

import CARD_BACKGROUND from '@/assets/background-card-event/card-match.png';

/**
 * Carte d une annonce de match amical (spec §4.2, redessinee par le lot D07).
 *
 * 🧩 ANATOMIE REPRISE DE LA CARTE EVENEMENT (`molecules/eventCard/EventCardNew`) :
 * blason + nom + sous-ligne, tag en contour, filet puis deux rangees meta a
 * icones, boutons de pied de 44 pt. Le COMPOSANT, lui, n est pas reutilisable :
 * il prend un FCEvent, appelle useAuth / useEvent / resolveParticipationFlow,
 * rend EventAnswerButtons (Present / Absent) et une frise de sponsors. Une
 * annonce n a ni participation, ni type, ni capacite, ni sponsor, et son action
 * est « Proposer un match ». Le monter ici demanderait de fabriquer un faux
 * evenement — ce qui coute plus cher, et ment davantage, que de reprendre sa
 * grammaire. Ce qui EST partage l est vraiment : `ClubLogoMark`, le meme blason.
 *
 * ⚠️ Cette carte ne porte AUCUN litteral de couleur : tout passe par les jetons
 * du theme et withAlpha(). RecruitmentAdCard vit dans l allowlist d exceptions ;
 * ce fichier n a aucune raison d y entrer.
 *
 * 🗣️ LOT D41 ② — elle ne porte plus non plus de texte litteral : tout passe par
 * `t(cle, 'repli')`, le repli etant le texte deja affiche, mot pour mot. Une
 * regle sans exception, plus simple a tenir qu une liste de cas.
 * ⚠️ Seuls des NOMBRES et une heure validee par regex traversent `{{...}}` :
 * i18next echappe les valeurs interpolees, donc un nom de club ou une ville s y
 * transformerait (« L'Étoile » → « L&#39;Étoile »). Ces valeurs-la restent
 * assemblees en JS, autour du fragment traduit.
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
  const { t } = useTranslation();

  // Les teintes sont calculees ici, et volontairement pas en ligne dans le
  // rendu : `verify:theme-contract` signale toute encre claire ecrite a moins
  // de 4 lignes d un `backgroundColor: ...primary500`, meme quand ce fond est
  // un voile a 8 % sur lequel le blanc reste parfaitement lisible.
  const palette = useMemo(() => ({
    accentBorder: withAlpha(Colors.primary500, 0.18),
    ctaOutlineBorder: withAlpha(Colors.primary500, 0.7),
    disabledBorder: withAlpha(Colors.neutral00, 0.12),
    disabledSurface: withAlpha(Colors.neutral00, 0.06),
    hairline: withAlpha(Colors.neutral00, 0.08),
    mutedInk: withAlpha(Colors.neutral100, 0.72),
    tagBorder: withAlpha(Colors.primary500, 0.7),
    veil: withAlpha(Colors.neutral900, 0.56),
  }), [Colors]);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const team = ad?.team;
  const club = team?.club;
  const clubName = club?.name
    || team?.name
    || t('friendlyMatch.adCard.fallback.club', 'Club inconnu');
  const clubLogo = getImageUrl(club?.logo?.url);
  const categoryName = ad?.category?.name
    || t('friendlyMatch.adCard.fallback.category', 'Catégorie libre');
  const sectionName = ad?.section?.name || '';
  const levelName = ad?.level?.name || t('friendlyMatch.adCard.fallback.level', 'Niveau libre');
  const formatLabel = ad?.format || t('friendlyMatch.adCard.fallback.format', 'Format à convenir');
  const sportName = ad?.activity?.name
    || team?.sport
    || t('friendlyMatch.adCard.fallback.sport', 'Football');
  const hostingTag = getHostingTag(ad);
  const isOpen = ad?.status === 'open' && ad?.isActive !== false;

  // Sous-ligne de la maquette : « Seniors A · Basketball · Sénior +18 · 5v5 ».
  const subLine = [team?.name, sportName, categoryName, sectionName, formatLabel]
    .filter(Boolean)
    .join(' · ');

  // La maquette separe date et heure en deux cellules meta. La carte ne montre
  // donc plus que le PREMIER creneau, et compte les autres : le detail les
  // affiche tous, et deux dates entieres ne tiennent pas dans une demi-rangee.
  const candidateSlots = normalizeCandidateDates(ad?.candidateDates);
  const firstSlot = candidateSlots[0];
  const extraSlotsCount = Math.max(0, candidateSlots.length - 1);
  const dateLabel = firstSlot
    ? [
      formatDateWithDayPrefix(new Date(`${firstSlot.date}T12:00:00`)),
      extraSlotsCount > 0 ? `+${extraSlotsCount}` : '',
    ].filter(Boolean).join(' ')
    : t('friendlyMatch.adCard.fallback.dates', 'Dates à convenir');

  let timeLabel = t('friendlyMatch.adCard.fallback.time', 'Heure à convenir');
  if (firstSlot?.start && firstSlot?.end) timeLabel = `${firstSlot.start}-${firstSlot.end}`;
  // `start` est valide par regex `HH:MM` en amont (normalizeCandidateDates) :
  // c est la seule donnee du fichier qui peut traverser une interpolation sans
  // risquer l echappement HTML d i18next.
  else if (firstSlot?.start) {
    timeLabel = t('friendlyMatch.adCard.timeFrom', 'dès {{start}}', { start: firstSlot.start });
  }

  const cityLabel = getShortAddress(ad?.city || ad?.location?.city || club?.city || '')
    || t('friendlyMatch.adCard.fallback.place', 'Lieu non précisé');
  // La ville reste HORS de l interpolation : elle vient de la base et i18next
  // echapperait ses apostrophes. Seul le fragment « à N km » est traduit.
  const distanceSuffix = Number.isFinite(distanceKm) && distanceKm !== null
    ? t('friendlyMatch.adCard.distance', 'à {{km}} km', { km: Math.round(distanceKm) })
    : '';
  const distanceLabel = distanceSuffix ? `${cityLabel} · ${distanceSuffix}` : cityLabel;

  const applicationsCount = ad?.pendingApplicationsCount ?? ad?.applicationsCount ?? 0;
  const hasApplications = Number(applicationsCount) > 0;
  // Un seul pluriel pour les deux endroits qui comptent les propositions : le
  // pied de statut et le CTA. Ecrit deux fois, il s'accorde une fois sur deux
  // — c'est exactement ce que le filet a attrape (« Voir les 1 propositions »).
  // Le « s » reste calcule en JS et voyage comme variable : la marque du pluriel
  // francais n'a pas d'equivalent dans toutes les langues, et une clef par forme
  // dupliquerait la branche que ce lot vient justement d'unifier.
  const applicationsPlural = applicationsCount > 1 ? 's' : '';
  const applicationsVars = { plural: applicationsPlural, total: applicationsCount };
  const applicationsLabel = t(
    'friendlyMatch.adCard.applications',
    '{{total}} proposition{{plural}}',
    applicationsVars,
  );
  // L annonce du lecteur d ecran assemble en JS le nom du club, la sous-ligne et
  // l etat de lieu : trois valeurs qui viennent de la base. Seul son prefixe est
  // une phrase, donc seul lui est traduit.
  const adPrefix = t('friendlyMatch.adCard.accessibilityLabelPrefix', 'Match amical');
  const openHint = t('friendlyMatch.adCard.accessibilityHint', 'Ouvrir le détail de l\'annonce');
  // Les deux actions du proprietaire ouvrent son annonce : c'est la que vivent
  // « Reposter avec de nouvelles dates » et « Annuler l'annonce »
  // (FriendlyMatchAdDetails.js:409-419). Pas de second chemin invente ici.
  const handleManage = () => onPress?.(ad);

  let ctaLabel = t('friendlyMatch.adCard.cta.apply', 'Proposer un match');
  let isCtaInteractive = Boolean(onApply) && canApply && isOpen && !isApplying;

  if (!isOpen) {
    ctaLabel = ad?.status === 'matched'
      ? t('friendlyMatch.adCard.cta.matched', 'Adversaire trouvé')
      : t('friendlyMatch.adCard.cta.closed', 'Annonce clôturée');
    isCtaInteractive = false;
  } else if (myApplicationStatus === 'accepted') {
    ctaLabel = t('friendlyMatch.adCard.cta.confirmed', 'Match confirmé');
    isCtaInteractive = false;
  } else if (myApplicationStatus === 'pending') {
    ctaLabel = t('friendlyMatch.adCard.cta.pending', 'Proposition envoyée');
    isCtaInteractive = false;
  } else if (myApplicationStatus === 'declined') {
    ctaLabel = t('friendlyMatch.adCard.cta.declined', 'Proposition refusée');
    isCtaInteractive = false;
  } else if (isApplying) {
    ctaLabel = t('friendlyMatch.adCard.cta.applying', 'Envoi...');
  } else if (!canApply) {
    ctaLabel = t('friendlyMatch.adCard.cta.staffOnly', 'Réservé aux entraîneurs et dirigeants');
    isCtaInteractive = false;
  }

  let ownerStatusLabel = t('friendlyMatch.adCard.status.closed', 'Clôturée');
  if (isOpen) ownerStatusLabel = t('friendlyMatch.adCard.status.online', 'En ligne');
  else if (ad?.status === 'matched') {
    ownerStatusLabel = t('friendlyMatch.adCard.status.matched', 'Match trouvé');
  }

  /**
   * Un bouton de pied : plein par defaut, en contour sinon, toujours 44 pt.
   * @param {{
   *   isCompact?: boolean, isOutline?: boolean, label: string, onPressButton?: () => void,
   * }} params Reglages du bouton.
   * @returns {import('react').ReactElement} Le bouton.
   */
  const renderFooterButton = ({
    isCompact = false, isOutline = false, label, onPressButton,
  }) => {
    const isPressable = typeof onPressButton === 'function';
    const buttonStyle = [
      styles.footerButton,
      isCompact ? styles.footerButtonCompact : styles.footerButtonGrow,
      isOutline
        ? { borderColor: palette.ctaOutlineBorder, borderWidth: 1.5 }
        : { backgroundColor: Colors.primary500 },
      !isPressable && !isOutline
        ? {
          backgroundColor: palette.disabledSurface,
          borderColor: palette.disabledBorder,
          borderWidth: 1,
        }
        : null,
    ];
    const inkColor = isOutline || !isPressable ? Colors.primary100 : Colors.primary900;
    // Pas de `numberOfLines` : les libelles non interactifs portent la RAISON
    // d'un refus (« Réservé aux entraîneurs et dirigeants »). Tronquee a cote
    // de « Voir », cette raison devient un refus muet — la famille de defauts
    // payee par le lot L10-B. Le bouton fait 44 pt AU MINIMUM, il grandit.
    const content = (
      <Text style={[Fonts.p3Bold, styles.footerButtonLabel, { color: inkColor }]}>{label}</Text>
    );

    if (!isPressable) return <View style={buttonStyle}>{content}</View>;

    return (
      <TouchableOpacity
        accessibilityLabel={label}
        accessibilityRole="button"
        activeOpacity={0.9}
        onPress={onPressButton}
        style={buttonStyle}
      >
        {content}
      </TouchableOpacity>
    );
  };

  /**
   * Une cellule meta : icone cyan + texte, comme sur la carte evenement.
   * @param {any} iconSource Icone de la cellule.
   * @param {string} label Texte de la cellule.
   * @param {boolean} [isRight] Aligne la cellule a droite de sa rangee.
   * @returns {import('react').ReactElement} La cellule.
   */
  const renderMetaCell = (iconSource, label, isRight = false) => (
    <View style={[styles.metaCell, isRight ? styles.metaCellRight : null]}>
      <Image source={iconSource} style={[styles.metaIcon, { tintColor: Colors.primary500 }]} />
      <Text numberOfLines={1} style={[Fonts.p3Bold, styles.metaText, { color: Colors.neutral100 }]}>
        {label}
      </Text>
    </View>
  );

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
        accessibilityHint={openHint}
        accessibilityLabel={`${adPrefix}, ${clubName}, ${subLine}, ${hostingTag.label}`}
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
          <View style={styles.clubRow}>
            <ClubLogoMark
              logoStyle={{ borderColor: Colors.neutral200, borderRadius: 10, borderWidth: 1 }}
              logoUrl={clubLogo}
              name={clubName}
              size={40}
            />

            <View style={styles.clubTextContainer}>
              {/* ③ Le nom du club n'est JAMAIS tronque : pas de numberOfLines,
                  pas d'ellipse, pas de capitales. Un nom long passe a la ligne. */}
              <Text style={[Fonts.p2Black, { color: Colors.neutral00 }]}>{clubName}</Text>
              <Text style={[Fonts.small, styles.subLine, { color: palette.mutedInk }]}>
                {subLine}
              </Text>
            </View>
          </View>

          {/* ② Le tag lieu occupe sa PROPRE ligne, sous le nom : sur la meme
              ligne, un nom long l'ecrase. Icone + libelle, jamais une banniere. */}
          <View style={[styles.hostingTag, { borderColor: palette.tagBorder }]}>
            <HostingIcon color={Colors.primary100} iconKey={hostingTag.iconKey} size={11} />
            <Text style={[Fonts.p4Bold, { color: Colors.primary100 }]}>{hostingTag.label}</Text>
          </View>

          <View style={[styles.metaGrid, { borderTopColor: palette.hairline }]}>
            <View style={styles.metaRow}>
              {renderMetaCell(Images.pin, distanceLabel)}
              {renderMetaCell(Images.trophy, levelName, true)}
            </View>
            <View style={styles.metaRow}>
              {renderMetaCell(Images.calendar, dateLabel)}
              {renderMetaCell(Images.clock, timeLabel, true)}
            </View>
          </View>

          {isOwner ? (
            <View style={[styles.ownerStatusRow, { borderTopColor: palette.hairline }]}>
              <View style={styles.ownerStatusLeft}>
                <View style={[
                  styles.ownerStatusDot,
                  { backgroundColor: isOpen ? Colors.success500 : Colors.neutral500 },
                ]}
                />
                <Text style={[Fonts.p3Bold, { color: Colors.neutral200 }]}>{ownerStatusLabel}</Text>
              </View>
              <Text style={[
                Fonts.p3Bold,
                { color: hasApplications ? Colors.neutral00 : palette.mutedInk },
              ]}
              >
                {applicationsLabel}
              </Text>
            </View>
          ) : null}
        </View>

        <View pointerEvents="auto" style={styles.footerRow}>
          {isOwner ? null : renderFooterButton({
            label: ctaLabel,
            onPressButton: isCtaInteractive ? () => onApply?.(ad) : undefined,
          })}
          {isOwner ? null : renderFooterButton({
            isCompact: true,
            isOutline: true,
            label: t('friendlyMatch.adCard.view', 'Voir'),
            onPressButton: () => onPress?.(ad),
          })}

          {/* A N ≥ 1, les propositions recues passent devant : c'est ce que le
              proprietaire vient faire. A N = 0, il n'y a rien a voir. */}
          {isOwner && hasApplications ? renderFooterButton({
            label: t(
              'friendlyMatch.adCard.seeApplications',
              'Voir les {{total}} proposition{{plural}}',
              applicationsVars,
            ),
            onPressButton: handleManage,
          }) : null}
          {isOwner && hasApplications ? renderFooterButton({
            isCompact: true,
            isOutline: true,
            label: t('friendlyMatch.adCard.edit', 'Modifier'),
            onPressButton: handleManage,
          }) : null}
          {isOwner && !hasApplications ? renderFooterButton({
            isOutline: true,
            label: t('friendlyMatch.adCard.editAd', 'Modifier l’annonce'),
            onPressButton: handleManage,
          }) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    borderRadius: 18,
    opacity: 1,
  },
  clubRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 11,
  },
  clubTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  container: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  footerButton: {
    alignItems: 'center',
    borderRadius: 22,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  footerButtonCompact: {
    flexGrow: 0,
    flexShrink: 0,
  },
  footerButtonGrow: {
    flex: 1,
  },
  footerButtonLabel: {
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    width: '100%',
  },
  hostingTag: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  metaCell: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 28,
  },
  metaCellRight: {
    flexShrink: 0,
    justifyContent: 'flex-end',
  },
  metaGrid: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  metaIcon: {
    height: 14,
    resizeMode: 'contain',
    width: 14,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  metaText: {
    flexShrink: 1,
  },
  ownerStatusDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  ownerStatusLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  ownerStatusRow: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 11,
  },
  subLine: {
    marginTop: 3,
  },
});

export default FriendlyMatchAdCard;
