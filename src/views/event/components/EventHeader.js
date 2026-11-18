import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  Image, ImageBackground, Text, TouchableOpacity, View,
} from 'react-native';

import { resolveEventCustomName } from '@/domains/event/eventDisplayName';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Tag from '@/components/atoms/tag/Tag';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import OuvrirDansLeGps from '@/components/molecules/ouvrirDansLeGps/OuvrirDansLeGps';

import { formatDateWithDayPrefix } from '@/utils/date';
import { getEventLocationText, toDisplayText } from '@/utils/eventLocationText';
import {
  resolveExternalMatchDisplay,
  resolveExternalMatchLocation,
} from '@/utils/externalMatchDisplay';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import { getLocationCoordinates as resolveLocationCoordinates } from '@/utils/location';
import safeJsonParse from '@/utils/safeJsonParse';
import texteInsecable from '@/utils/texteInsecable';

// Assets — imports statiques (pas require) : require n'existe pas sur le rendu web ESM.
import BG_OTHER from '@/assets/background-card-event/card-autre.png';
import BG_DETECTION from '@/assets/background-card-event/card-detection.png';
import BG_TRAINING from '@/assets/background-card-event/card-entrainement.png';
import BG_MATCH from '@/assets/background-card-event/card-match.png';
import BG_RESERVATION from '@/assets/background-card-event/card-reservation.png';
import BG_STAGE from '@/assets/background-card-event/card-stage.png';
import BG_TOURNAMENT from '@/assets/background-card-event/card-tournoi.png';
// Même motif que `EventDetails.web.js` : `import/order` et `perfectionist` se contredisent
// sur l'ordre des imports relatifs et des alias non classés.
/* eslint-disable perfectionist/sort-imports */
import { openExternalMap } from '@/platform/maps/externalMap';
import {
  formatEventPlaceLine,
  formatEventTeamLine,
  formatEventWhenLine,
  getStageLastDay,
} from '../eventInfoLines';
import { getTournamentShortPlace } from '../tournamentJoinRules';
import {
  getTournamentCategoryLabel,
  getTournamentEntryFeeLabel,
  getTournamentMinAge,
} from '../tournamentUtils';
import MatchScoreEncart from './MatchScoreEncart';
/* eslint-enable perfectionist/sort-imports */

// AE01 — les 7 fonds, recopies des CARTES de liste (`EventCardNew.js:53-62`) :
// le tournoi empruntait le fond du match et le stage tombait dans « autre »,
// alors que `card-tournoi.png` et `card-stage.png` existent depuis `ed41a15`.
// C'est RESTE_A_FAIRE_DESIGN.md (L6-B, 22/08) qui commande, PAS la planche 03
// v2 : celle-ci gardait card-match pour le tournoi en croyant que le visuel
// dedie n'existait pas.
const getBackgroundImage = (/** @type {any} */ typeName, /** @type {any} */ eventFormat) => {
  const normalizedType = (typeName?.toLowerCase() || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  // Un stage se reconnait a son FORMAT, pas a son libelle de type : c'est ce
  // que lisent deja `EventDetails.js` (isStageParentEvent / isStageDayEvent)
  // et `EventCardNew.js`. Le libelle est accepte lui aussi, pour rester
  // exactement aligne sur la carte de liste, qui teste les deux.
  const normalizedFormat = String(eventFormat || '').toLowerCase();
  const isStageEvent = normalizedFormat === 'stage_parent'
    || normalizedFormat === 'stage_day'
    || normalizedType.includes('stage');
  if (
    normalizedType.includes('match')
    || normalizedType.includes('competition')
  ) return BG_MATCH;
  if (normalizedType.includes('entrainement')) return BG_TRAINING;
  if (normalizedType.includes('detection')) return BG_DETECTION;
  if (normalizedType.includes('reservation')) return BG_RESERVATION;
  if (normalizedType.includes('tournoi')) return BG_TOURNAMENT;
  if (isStageEvent) return BG_STAGE;
  return BG_OTHER;
};

/**
 * @param {{
 *   detectionSummary?: {
 *     openPositions: number;
 *     toReview: number;
 *   } | null;
 *   event: any;
 *   matchScoreSummary?: {
 *     authorLine?: string | null;
 *     awaitingOpponent?: boolean;
 *     badgeLabel?: string;
 *     centerLabel?: string | null;
 *     helperText?: string | null;
 *     isScoreShown?: boolean;
 *     onEnterScore?: (() => void) | null;
 *     onNameOpponent?: (() => void) | null;
 *     onSeeStats?: (() => void) | null;
 *     opponentName?: string;
 *     scorersLine?: string | null;
 *     statusLine?: { text: string, tone: 'neutral' | 'warning' } | null;
 *     value: string;
 *     verdict?: 'win' | 'draw' | 'loss' | null;
 *   } | null;
 *   tournamentHero?: { showFacility?: boolean, statusLabel?: string | null } | null;
 * }} props
 */
function EventHeader({
  detectionSummary = null, event, matchScoreSummary = null, tournamentHero = null,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const backgroundImage = getBackgroundImage(event?.type?.name, event?.eventFormat);
  // La couleur appartient au LIEU, pas au type : deux evenements au meme
  // endroit portent le meme accent. Sans installation, l'icone GPS et la
  // pastille de section gardent le cyan d'avant AD09.
  // AD10 — le LISERE, lui, ne se pose plus du tout sans lieu. Mesure du
  // 2026-08-21 : le trait etait applique sans condition, donc un evenement
  // sans lieu portait 4 px de cyan `primary500` qu'il n'avait jamais eus
  // avant AD09 (`c60763e` a INTRODUIT `borderLeftWidth`). Le commentaire
  // disait pourtant « ne change pas d'apparence » : il decrivait l'intention,
  // pas le code. Un lisere qui code la couleur d'un lieu ABSENT est un
  // mensonge visuel — et la carte fait deja le bon geste (`EventCardNew.js`,
  // `containerAccentStyle` n'existe que s'il y a une couleur de lieu).
  const facilityAccentColor = resolveFacilityPlanningColor(event?.facility);
  const accentColor = facilityAccentColor || Colors.primary500;
  const normalizedTypeName = String(event?.type?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const clubName = toDisplayText(event?.team?.club?.name || event?.club?.name);
  const matchDisplay = resolveExternalMatchDisplay(event);
  const externalMatchLocation = resolveExternalMatchLocation(event);
  const eventTitle = matchDisplay.title;
  const isTournamentEvent = normalizedTypeName.includes('tournoi');
  const sectionName = toDisplayText(event?.team?.section?.name || event?.tournamentSection?.name);
  // T-FINITIONS-3 (16/11) : sur un tournoi à âge minimum, « À partir de {minAge} ans » remplace
  // l'âge de la catégorie.
  const nomDeCategorie = toDisplayText(
    event?.team?.category?.name || event?.tournamentCategory?.name,
  );
  const categoryName = isTournamentEvent
    ? getTournamentCategoryLabel(event, nomDeCategorie)
    : nomDeCategorie;
  const levelName = toDisplayText(event?.team?.level?.name);
  const activityName = toDisplayText(event?.team?.activities?.[0]?.name || event?.tournamentActivity?.name);
  const eventClub = event?.team?.club || event?.club;
  const logoUrl = eventClub?.logo?.url;
  const locationDetails = event?.locationDetails;
  // Le nom du lieu est une DONNEE, pas un libelle : aucune clef de traduction.
  const facilityName = toDisplayText(event?.facility?.name);
  const isImportedExternalMatch = (
    event?.externalAutoSource === 'external_competition'
    || Array.isArray(event?.team?.externalCalendarData)
  );
  const showMatchTitle = Boolean(eventTitle && (
    normalizedTypeName.includes('match')
    || normalizedTypeName.includes('competition')
    || normalizedTypeName.includes('tournoi')
  ));
  const matchContextLabel = showMatchTitle ? matchDisplay.contextLabel : '';
  const eventOwnName = toDisplayText(event?.name);
  const teamName = toDisplayText(event?.team?.name);
  // T-NOM (16/11) : le nom donne au tournoi d'abord, meme si `name` est encore le nom machine.
  const tournamentTitle = toDisplayText(resolveEventCustomName(event)) || eventOwnName
    || t('eventDetails.header.tournamentFallback', 'Tournoi');
  // AE01 — le titre principal suit le TYPE (planche 03, cadres C/D/E/G/H).
  // Deux familles en sont EXCLUES et gardent le nom du club :
  //  - le match (voir N3 juste en dessous) ;
  //  - la reservation, qui n'a pas de nom propre a montrer.
  // Le club ne disparait de NULLE PART : le logo et la pastille le portent.
  const keepsClubNameTitle = normalizedTypeName.includes('match')
    || normalizedTypeName.includes('competition')
    || normalizedTypeName.includes('reservation');

  // 🏷️ N3 (D4, Q1 = C — Adel, 20/08) — LE MATCH GARDE LE NOM DU CLUB.
  //
  // Avant ce lot il portait « VS FC Bonneveine » en titre et repoussait le club
  // dans un sous-titre « Domicile - Test FC ». Les deux moities de cette phrase
  // ont trouve une meilleure place : l'adversaire dans l'encart, face au club
  // (« Test FC — FC Bonneveine »), et le lieu dans la pastille de type (D1).
  // Le titre n'a donc plus qu'une chose a dire, et le sous-titre plus rien —
  // le remplir du seul `clubName` repeterait le titre mot pour mot.
  //
  // ⚠️ `showMatchTitle` couvre AUSSI le tournoi (l. ~153) : un tournoi dont le
  // nom contient « VS X » passe par la meme branche. Il n'est PAS concerne par
  // Q1 — d'ou ce drapeau, qui ne retient que le match et la competition.
  const isMatchLikeEvent = normalizedTypeName.includes('match')
    || normalizedTypeName.includes('competition');
  const showsMatchOpponentTitle = showMatchTitle && !isMatchLikeEvent;

  let headerPrimaryTitle = clubName;
  if (showsMatchOpponentTitle) {
    headerPrimaryTitle = eventTitle;
  } else if (isTournamentEvent) {
    headerPrimaryTitle = tournamentTitle;
  } else if (normalizedTypeName.includes('entrainement')) {
    headerPrimaryTitle = teamName || clubName;
  } else if (!keepsClubNameTitle) {
    // EVT-AUTRE-NOM : le nom donne a un « Autre » d'abord.
    headerPrimaryTitle = toDisplayText(resolveEventCustomName(event)) || eventOwnName || clubName;
  }

  let headerSecondaryTitle = '';
  if (showsMatchOpponentTitle) {
    headerSecondaryTitle = [matchContextLabel, clubName].filter(Boolean).join(' - ');
  } else if (isTournamentEvent) {
    headerSecondaryTitle = [clubName, activityName, categoryName].filter(Boolean).join(' - ');
  }
  // T-PAGES-4b (18/11, maquette design/DESIGN-TOURNOI-PAGES (b), téléphone) — demandé par la fiche
  // (`tournamentHero`), le haut d'un tournoi devient un bandeau : « Organisé par … », puis les
  // étiquettes statut / section / âge. Date, lieu et prix sont dans « L'essentiel », sous « Mon
  // équipe » : le bandeau ne les redit pas, et l'âge n'y paraît qu'une fois (M1328).
  const enBandeau = isTournamentEvent && Boolean(tournamentHero);
  if (enBandeau) {
    headerSecondaryTitle = [
      clubName
        ? t('tournamentFicheWeb.organizedBy', { name: clubName, ...SANS_ECHAPPEMENT })
        : '',
      activityName,
    ].filter(Boolean).join(' · ');
  }
  const etiquettesDuBandeau = enBandeau
    ? [tournamentHero?.statusLabel, sectionName, categoryName].filter(Boolean)
    : [];
  const invitedTeamNames = (event?.invitedTeams || [])
    .map((/** @type {any} */ team) => toDisplayText(team?.name))
    .filter(Boolean);

  const getParsedLocationDetails = () => {
    if (!locationDetails) return null;
    return safeJsonParse(locationDetails, null);
  };

  const getLocationText = () => {
    if (isImportedExternalMatch && externalMatchLocation) {
      return externalMatchLocation;
    }
    return getEventLocationText(event) || externalMatchLocation || '';
  };

  const getLocationCoordinates = () => {
    const parsed = getParsedLocationDetails();
    return resolveLocationCoordinates(event?.location)
      || resolveLocationCoordinates(parsed?.address)
      || resolveLocationCoordinates(parsed);
  };

  // CONVOC (demande d'Adel du 26/09) — Plans, Google Maps ou Waze, AU CHOIX, et le
  // meme geste que sur « Tu es convoque » : l'aide partagee `openExternalMap`.
  // Elle remplace ici une copie de la logique (`maps:` / `geo:` / Google Maps)
  // qui ne proposait aucun choix — et qui, sur iPhone, ouvrait la PAGE Google Maps
  // faute de declaration : `canOpenURL('maps:')` y rendait toujours faux.
  const handleOpenLocationInGps = () => {
    const coordinates = getLocationCoordinates();
    openExternalMap({
      label: getLocationText().trim(),
      latitude: coordinates?.lat,
      longitude: coordinates?.lng,
    });
  };

  // 📅 ST-VUES3-ORDI (écran 1, point 2) — LE BLOC D'INFOS DU MATCH, dans l'ordre de la
  // planche « L'encart du score » : calendrier (« Sam. 5 sept. · 19:00 – 20:00 »), épingle
  // (« Lyon (69001) », qui ouvre toujours le GPS), personnes (« U15 · AS Montrivage »). Ni
  // nom de section, ni « Ouvrir dans le GPS » écrit, ni catégorie en capitales. Un lieu
  // sans ville connue garde son libellé d'avant (ne rien inventer) ; un match importé,
  // son lieu de compétition. Les autres types gardent leur bloc (leur propre pack).
  const matchWhenLine = matchScoreSummary ? formatEventWhenLine(event) : '';
  const matchPlaceLine = matchScoreSummary
    ? ((isImportedExternalMatch && externalMatchLocation) || formatEventPlaceLine(event)
      || getLocationText())
    : '';
  const matchTeamLine = matchScoreSummary ? formatEventTeamLine(event) : '';
  const renderMatchInfo = (
    /** @type {any} */ icon,
    /** @type {string} */ text,
    /** @type {string} */ testID,
  ) => (
    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]} testID={testID}>
      <Image
        source={icon}
        style={[{ height: 16, width: 16 }, { tintColor: Colors.primary200 }]}
      />
      <Text style={[Fonts.p2, Fonts.neutral200, { flexShrink: 1 }]}>{text}</Text>
    </View>
  );

  // Le bloc d'infos des autres types d'événement, inchangé (leur propre pack).
  const defaultInfoBlock = (
    <>
      {/* Section Name */}
      <View style={[Alignments.fullWidth, Spaces.gap[8], Spaces.marginBottom[12]]}>
        <Text style={[Fonts.p2Bold, Fonts.textRight, Alignments.fullWidth, { color: accentColor }]}>
          {sectionName}
        </Text>
        <View style={[Alignments.fullWidth, ApplicationStyle.separator, { backgroundColor: accentColor }]} />
      </View>

      {/* Info: Location, Date, Time, Team Category */}
      <View style={[Spaces.gap[24], Alignments.fill]}>
        {getLocationText() ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleOpenLocationInGps}
            style={[Alignments.justifyCenter, Spaces.gap[8]]}
          >
            <View style={[Alignments.row, Alignments.justifyCenter, Spaces.gap[8]]}>
              <Image
                source={Images.pin}
                style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
              />
              <Text style={[Fonts.p2, Fonts.primary100, { maxWidth: '90%' }]}>
                {getLocationText()}
              </Text>
            </View>
            <Text style={[Fonts.p4, Fonts.textCenter, { color: accentColor }]}>
              {t('common.openInGps', 'Ouvrir dans le GPS')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {event?.date && (
          <View style={[Alignments.row, Alignments.fill, Spaces.gap[16]]}>
            <View style={[Spaces.gap[8]]}>
              <View style={[Alignments.row, Spaces.gap[8]]}>
                <Image
                  source={Images.calendar}
                  style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
                />
                {/* FINITIONS7 (tournee 8) — la date s affichait « jeu » seul : un texte de
                    plusieurs mots a sa largeur mesuree perd son dernier mot sous Android 16
                    (piege paye par FINITIONS le 29/09). Insecable, il tient comme un mot. */}
                <Text style={[Fonts.p2, Fonts.neutral00]}>
                  {texteInsecable(formatDateWithDayPrefix(event.date))}
                  {/* REPRISE-EVENEMENTS 128 : un stage de plusieurs jours dit son dernier jour. */}
                  {getStageLastDay(event)
                    ? ` – ${texteInsecable(formatDateWithDayPrefix(getStageLastDay(event)))}`
                    : null}
                </Text>
              </View>

              <View style={[Alignments.row, Spaces.gap[4]]}>
                <Image
                  source={Images.clock}
                  style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
                />
                <Text style={[Fonts.p2, Fonts.primary100]}>
                  {/* P8-22 : sans fin, l heure de début saisie (`date` = un jour seul). */}
                  {event?.startTime && event?.endTime
                    ? `${event.startTime.substring(0, 5)} - ${event.endTime.substring(0, 5)}`
                    : (event?.startTime?.substring(0, 5) || format(new Date(event.date), 'HH:mm'))}
                </Text>
              </View>
            </View>

            <View style={[{ height: 45, width: 1 }, ApplicationStyle.backgroundColor.neutral00]} />

            {(categoryName || levelName || activityName) && (
              // FINITIONS7 — c est cette colonne qui retrecit (ses textes ont deja leur « … ») :
              // une longue categorie (« SÉNIOR (+18 ANS) ») ne pousse plus la date hors de l ecran.
              <View style={[Spaces.gap[8], { flexShrink: 1 }]}>
                {categoryName ? (
                  <Text numberOfLines={1} style={[Fonts.p2, Fonts.primary100, Fonts.uppercase]}>
                    {categoryName}
                  </Text>
                ) : null}
                <Text numberOfLines={1} style={[Fonts.p2, Fonts.primary100, Fonts.uppercase]}>
                  {levelName || activityName}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* T-PARCOURS-2, point 1 : le prix d'un tournoi payant (« Prix / personne » du site). */}
        {isTournamentEvent && getTournamentEntryFeeLabel(event) ? (
          <Text style={[Fonts.p2Bold, Fonts.neutral00]} testID="event-header-entry-fee">
            {getTournamentEntryFeeLabel(event)}
          </Text>
        ) : null}

        {invitedTeamNames.length > 0 && (
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p3Bold, { color: accentColor }]}>
              {t('eventDetails.header.invitedTeams', 'Équipes invitées')}
            </Text>
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {invitedTeamNames.join(' \u2022 ')}
            </Text>
          </View>
        )}
      </View>
    </>
  );

  // IMPL-1-FICHE (18/11, pack T-DESIGN-TOURNOI, écran 6b, remarque 1 d'Adel) — LE BANDEAU DU
  // TOURNOI : l'image du tournoi (celle de sa carte dans les listes) en bandeau, le nom et
  // « Organisé par … · lieu court » sur le voile, puis les pastilles sur UNE ligne : TOURNOI en
  // bleu, l'état, l'âge. « Mixte » et l'activité passent dans le format (« L'essentiel »).
  // ponytail: l'image est celle du TYPE (card-tournoi.png) : l'événement n'a aucun champ photo
  // (schéma admin) ; la photo du complexe demande un champ ou les photos de l'installation.
  if (enBandeau && !matchScoreSummary) {
    const lieuCourt = getTournamentShortPlace(event);
    const lieuSansClub = clubName && lieuCourt.startsWith(`${clubName} · `)
      ? lieuCourt.slice(clubName.length + 3)
      : lieuCourt;
    const sousTitre = [
      clubName ? t('tournamentFicheWeb.organizedBy', { name: clubName, ...SANS_ECHAPPEMENT }) : '',
      clubName ? lieuSansClub : lieuCourt,
    ].filter(Boolean).join(' · ');
    const minAge = getTournamentMinAge(event);
    let pastilleAge = categoryName ? { cle: 'age', texte: categoryName } : null;
    if (minAge) pastilleAge = { cle: 'age', texte: t('implFiche.fromAge', { minAge }) };
    const pastilles = [
      { cle: 'type', plein: true, texte: t('eventCardNew.tournament', 'TOURNOI') },
      tournamentHero?.statusLabel
        ? { cle: 'etat', etat: true, texte: String(tournamentHero.statusLabel) }
        : null,
      pastilleAge,
    ].filter(Boolean);
    return (
      <View style={Spaces.gap[12]} testID="event-header-tournament-banner">
        <ImageBackground
          imageStyle={{ borderRadius: 24 }}
          resizeMode="cover"
          source={/** @type {any} */ (BG_TOURNAMENT)}
          style={[ApplicationStyle.borderRadius24, {
            justifyContent: 'flex-end', minHeight: 184, overflow: 'hidden',
          }]}
        >
          <View
            pointerEvents="none"
            style={{
              backgroundColor: withAlpha(Colors.primary900, 0.35),
              bottom: 0,
              left: 0,
              position: 'absolute',
              right: 0,
              top: 0,
            }}
          />
          <View
            style={[Spaces.gap[4], Spaces.padding[16], {
              backgroundColor: withAlpha(Colors.primary900, 0.7),
            }]}
          >
            <Text numberOfLines={2} style={[Fonts.h3Bold, Fonts.neutral00]}>
              {headerPrimaryTitle}
            </Text>
            {sousTitre ? (
              <Text style={[Fonts.p2, Fonts.neutral200]}>{sousTitre}</Text>
            ) : null}
          </View>
        </ImageBackground>
        {/* Une ligne sur un téléphone ; sur un écran étroit, la rangée passe à la ligne plutôt que
            de couper une pastille (site à 375 px, mesuré). */}
        <View
          style={[Alignments.row, Alignments.wrap, Alignments.alignCenter, Spaces.gap[8]]}
          testID="event-header-tournament-tags"
        >
          {pastilles.map((/** @type {any} */ pastille) => {
            let fond = 'transparent';
            if (pastille.plein) fond = Colors.primary500;
            else if (pastille.etat) fond = withAlpha(Colors.primary500, 0.16);
            let encre = Colors.neutral00;
            if (pastille.plein) encre = Colors.primary900;
            else if (pastille.etat) encre = Colors.primary500;
            return (
              <View
                key={pastille.cle}
                style={[ApplicationStyle.borderRadius100, Spaces.paddingHorizontal[12], {
                  backgroundColor: fond,
                  borderColor: pastille.plein || pastille.etat
                    ? fond
                    : withAlpha(Colors.neutral00, 0.24),
                  borderWidth: 1,
                  paddingVertical: 6,
                }]}
              >
                <Text style={[pastille.plein ? Fonts.p4Bold : Fonts.p4, { color: encre }]}>
                  {pastille.texte}
                </Text>
              </View>
            );
          })}
          {facilityName && tournamentHero?.showFacility ? (
            <View
              style={[ApplicationStyle.borderRadius100, Spaces.paddingHorizontal[12], {
                backgroundColor: withAlpha(accentColor, 0.14), paddingVertical: 6,
              }]}
            >
              <Text style={[Fonts.p4, Fonts.neutral00]}>{facilityName}</Text>
            </View>
          ) : null}
        </View>
        {invitedTeamNames.length > 0 ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('eventDetails.header.invitedTeams', 'Équipes invitées')}
            {' : '}
            {invitedTeamNames.join(' • ')}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <ImageBackground
      imageStyle={{ borderRadius: 24 }}
      resizeMode="cover"
      source={/** @type {any} */ (backgroundImage)}
      style={[
        ApplicationStyle.borderRadius24,
        Alignments.alignCenter,
        Alignments.relative,
        Spaces.gap[8],
        Spaces.paddingHorizontal[24],
        // RETOURS-TESTEUR-2 (06/11/2026, M0980) — le tournoi, dont la fiche est la plus longue,
        // resserre sa carte d en-tete (le testeur : « réduire le padding du titre en haut »).
        // ponytail: carte fixe ; une carte qui se replie au defilement est un chantier a part.
        isTournamentEvent ? Spaces.paddingVertical[16] : Spaces.paddingVertical[32],
        // Lisere gauche : la couleur du lieu reste lisible meme quand le fond
        // photo la mange. 4 est une LARGEUR DE BORD, pas un espacement : elle
        // ne passe pas par la rampe Spaces (cf. { height: 45, width: 1 } plus bas).
        // AD10 : PAS de lieu, PAS de lisere (voir le commentaire plus haut).
        facilityAccentColor
          ? { borderLeftColor: facilityAccentColor, borderLeftWidth: 4 }
          : null,
      ]}
    >
      {/* Header: Logo + Main label */}
      {/* 🆚 ST-MATCH (écran 1) — un match n'a plus de rangée de titre : le face-à-face,
          plus bas, porte l'écusson et le nom du club (le camp de gauche). Les écrire
          aussi en titre disait la même chose deux fois. */}
      {matchScoreSummary ? null : (
        <View
          style={[
            Spaces.gap[4],
            Alignments.alignCenter,
            Alignments.fullWidth,
            Alignments.row,
          ]}
        >
          <ClubLogoMark
            club={eventClub}
            logoStyle={[
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.neutral00,
              { borderRadius: 60 },
            ]}
            logoUrl={logoUrl}
            name={clubName}
            size={60}
          />
          <View style={[Spaces.gap[4], { maxWidth: '75%' }]}>
            {/* N3 — un match affiche desormais son club en titre, avec ou sans
                adversaire. Sans ce `isMatchLikeEvent`, le MEME nom de club
                s'ecrirait en gros quand l'adversaire est connu et en petit
                sinon : une difference de taille que rien a l'ecran n'explique. */}
            {/* R9 — BORNE A DEUX LIGNES. La barre de navigation est transparente
                pour toute la pile (`commonOptions.js`) et le contenu passe dessous :
                sans limite, un titre long grimpait DANS les boutons du haut (le
                drapeau et le ⋯), constate en recette le 24/08. */}
            <Text
              numberOfLines={2}
              style={[
                showMatchTitle || isMatchLikeEvent ? Fonts.h3Black : Fonts.p1Bold,
                Fonts.neutral00,
              ]}
            >
              {headerPrimaryTitle}
            </Text>
            {headerSecondaryTitle ? (
              <Text style={[Fonts.p2, Fonts.primary100]}>
                {headerSecondaryTitle}
              </Text>
            ) : null}
            {etiquettesDuBandeau.length ? (
              <View
                style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}
                testID="event-header-tournament-tags"
              >
                {etiquettesDuBandeau.map((etiquette, index) => (
                  <Tag
                    key={etiquette}
                    style={{}}
                    text={String(etiquette)}
                    textColor={
                      index === 0 && tournamentHero?.statusLabel ? 'success500' : 'neutral00'
                    }
                    textStyle={Fonts.p4}
                  />
                ))}
              </View>
            ) : null}
            {/* T-SUITES-TOURNOI (18/11, point 9) : dans le bandeau d'un tournoi, la pastille du
                terrain n'est que pour l'organisateur (`tournamentHero.showFacility`). */}
            {facilityName && !(enBandeau && !tournamentHero?.showFacility) ? (
              <View
                style={[
                  ApplicationStyle.borderRadius100,
                  Alignments.selfStart,
                  Spaces.paddingHorizontal[8],
                  Spaces.paddingVertical[4],
                  { backgroundColor: withAlpha(accentColor, 0.14) },
                ]}
              >
                <Text style={[Fonts.p4, Fonts.neutral00]}>
                  {event?.wholeFacility === true
                    ? t('eventDetails.facilityWhole', '{{nom}} · Toute l’installation', {
                      nom: facilityName,
                      ...SANS_ECHAPPEMENT,
                    })
                    : facilityName}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* 🆚 ST-MATCH (écran 1, design des statistiques validé le 02/10) — LE FACE-À-FACE.
          Reprise du pack « Détail d'un événement » (05C) : le score monte au centre,
          entre les deux camps, avec « Score saisi » ou « Score officiel » dessous. La
          pastille de type, au-dessus de la carte, porte l'étape et le verdict
          (« MATCH · TERMINÉ · VICTOIRE »).
          Dessous, une ligne par chose à savoir (qui a saisi, les buteurs, ce qu'on
          attend). ⛔ L'ÉCRAN les fournit DÉJÀ FILTRÉES selon le lecteur : un visiteur
          ne les reçoit pas, la carte n'a donc rien à oublier de cacher (mineurs en U15).
          Retirés : le badge « Score du match · Victoire », la couleur du verdict sur la
          bordure (la pastille dit le verdict), et le mot « manuel ». */}
      {matchScoreSummary ? (
        <MatchScoreEncart
          accentColor={accentColor}
          clubName={clubName}
          eventClub={eventClub}
          facilityName={facilityName}
          logoUrl={logoUrl}
          matchScoreSummary={matchScoreSummary}
        />
      ) : null}

      {/* 🔭 P7 — LES DEUX TUILES DE RECRUTEMENT (planche 03, carte E).
          « Les deux chiffres du metier remplacent l'encart score » : un
          evenement ne peut pas etre a la fois un match et une detection, les
          deux blocs ne se croisent donc jamais a l'ecran.

          🪤 LEUR PLACE EST UNE REGLE, PAS UN GOUT. `EventHeaderAE01.test.js`
          lit le PREMIER `Text` de l'arbre pour verifier le titre de la carte.
          Une tuile posee au-dessus du titre casserait ses 3 temoins d'un coup,
          avec un message d'echec parlant de fond d'ecran. Les tuiles restent
          donc SOUS le titre, exactement comme l'encart score de N3.
          Le temoin 3 d'`EventHeaderP7DetectionTuiles.test.js` tient la regle. */}
      {detectionSummary ? (
        <View
          style={[Alignments.row, Alignments.fullWidth, Spaces.gap[8]]}
          testID="p7-tuiles-detection"
        >
          <View
            style={[
              ApplicationStyle.borderRadius16,
              Alignments.fill,
              Spaces.padding[12],
              Spaces.gap[4],
              {
                backgroundColor: withAlpha(Colors.primary900, 0.45),
                borderColor: withAlpha(Colors.primary500, 0.3),
                borderWidth: 1,
              },
            ]}
            testID="p7-tuile-postes-ouverts"
          >
            <Text style={[Fonts.h2Black, Fonts.neutral00]}>
              {String(detectionSummary.openPositions)}
            </Text>
            <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
              {detectionSummary.openPositions === 1
                ? t('eventDetails.detection.tileOpenPosition', 'poste ouvert')
                : t('eventDetails.detection.tileOpenPositions', 'postes ouverts')}
            </Text>
          </View>
          {/* Le chiffre des candidatures porte l'orange `warning500` : c'est
              lui qui appelle une action du staff, le nombre de postes ne
              decrit qu'un reglage. */}
          <View
            style={[
              ApplicationStyle.borderRadius16,
              Alignments.fill,
              Spaces.padding[12],
              Spaces.gap[4],
              {
                backgroundColor: withAlpha(Colors.primary900, 0.45),
                borderColor: withAlpha(Colors.warning500, 0.3),
                borderWidth: 1,
              },
            ]}
            testID="p7-tuile-candidatures"
          >
            <Text style={[Fonts.h2Black, { color: Colors.warning500 }]}>
              {String(detectionSummary.toReview)}
            </Text>
            <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
              {detectionSummary.toReview === 1
                ? t('eventDetails.detection.tileApplication', 'candidature à voir')
                : t('eventDetails.detection.tileApplications', 'candidatures à voir')}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 📅 ST-VUES3-ORDI (écran 1, point 2) — le bloc d'infos de la planche pour un match ;
          les autres types gardent le leur. */}
      {matchScoreSummary ? (
        <View
          style={[
            Alignments.fullWidth,
            Spaces.gap[8],
            {
              borderTopColor: withAlpha(Colors.neutral00, 0.08),
              borderTopWidth: 1,
              paddingTop: 12,
            },
          ]}
          testID="event-header-infos-match"
        >
          {matchWhenLine
            ? renderMatchInfo(
              Images.calendar,
              texteInsecable(matchWhenLine),
              'event-header-info-date',
            )
            : null}
          {matchPlaceLine ? (
            <TouchableOpacity
              accessibilityHint={t('common.openInGps', 'Ouvrir dans le GPS')}
              accessibilityRole="button"
              activeOpacity={0.8}
              onPress={handleOpenLocationInGps}
            >
              {renderMatchInfo(Images.pin, matchPlaceLine, 'event-header-info-lieu')}
            </TouchableOpacity>
          ) : null}
          {/* ACCUEIL-JOUEUR (09/11/2026, point 4) — l'adresse ouvrait le GPS sans le montrer :
              la ligne d'action visible, même ouverture (remplace « ni Ouvrir dans le GPS écrit »
              de la planche ST-VUES3-ORDI). */}
          {matchPlaceLine ? (
            <OuvrirDansLeGps onPress={handleOpenLocationInGps} testID="event-header-ouvrir-gps" />
          ) : null}
          {matchTeamLine
            ? renderMatchInfo(Images.users, matchTeamLine, 'event-header-info-equipe')
            : null}
          {invitedTeamNames.length > 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('eventDetails.header.invitedTeams', 'Équipes invitées')}
              {' : '}
              {invitedTeamNames.join(' \u2022 ')}
            </Text>
          ) : null}
        </View>
      ) : null}
      {/* Les équipes invitées d'un tournoi restent lisibles dans le bandeau. */}
      {!matchScoreSummary && enBandeau && invitedTeamNames.length > 0 ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('eventDetails.header.invitedTeams', 'Équipes invitées')}
          {' : '}
          {invitedTeamNames.join(' • ')}
        </Text>
      ) : null}
      {!matchScoreSummary && !enBandeau ? defaultInfoBlock : null}
    </ImageBackground>
  );
}

export default EventHeader;
