import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  Image, ImageBackground, Linking, Platform, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import { formatDateWithDayPrefix } from '@/utils/date';
import {
  resolveExternalMatchDisplay,
  resolveExternalMatchLocation,
} from '@/utils/externalMatchDisplay';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import {
  normalizeLocationInput,
  getLocationCoordinates as resolveLocationCoordinates,
} from '@/utils/location';
import safeJsonParse from '@/utils/safeJsonParse';

// Assets — imports statiques (pas require) : require n'existe pas sur le rendu web ESM.
import BG_OTHER from '@/assets/background-card-event/card-autre.png';
import BG_DETECTION from '@/assets/background-card-event/card-detection.png';
import BG_TRAINING from '@/assets/background-card-event/card-entrainement.png';
import BG_MATCH from '@/assets/background-card-event/card-match.png';
import BG_RESERVATION from '@/assets/background-card-event/card-reservation.png';
import BG_STAGE from '@/assets/background-card-event/card-stage.png';
import BG_TOURNAMENT from '@/assets/background-card-event/card-tournoi.png';

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
 * 🏁 N3 (D7) — LES TROIS COULEURS DU VERDICT, en jetons de theme.
 *
 * Un objet plutot que trois ternaires : la couleur du badge et celle de la
 * bordure se lisent alors au meme endroit, et un quatrieme etat (forfait,
 * report…) s'ajoute par une ligne. ⛔ Aucun hex : `verify:theme-contract`
 * les compte, y compris dans les tests.
 */
const VERDICT_COLOR_TOKENS = {
  draw: 'primary100',
  loss: 'error300',
  win: 'success500',
};

/** L'opacite de la bordure quand un verdict la colore (planche 03, cadre B). */
const VERDICT_BORDER_ALPHA = 0.4;

/**
 * @param {unknown} value
 * @returns {string}
 */
const toDisplayText = (value) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (!value || typeof value !== 'object') {
    return '';
  }

  const entity = /** @type {any} */ (value);
  if (typeof entity.description === 'string') {
    return entity.description.trim();
  }
  if (typeof entity.label === 'string') {
    return entity.label.trim();
  }
  if (entity.label && typeof entity.label === 'object') {
    return toDisplayText(entity.label);
  }
  if (typeof entity.address === 'string') {
    return entity.address.trim();
  }
  if (typeof entity.name === 'string') {
    return entity.name.trim();
  }
  if (entity.address && typeof entity.address === 'object') {
    return toDisplayText(entity.address);
  }
  return '';
};

/**
 * @param {{
 *   detectionSummary?: {
 *     openPositions: number;
 *     toReview: number;
 *   } | null;
 *   event: any;
 *   matchScoreSummary?: {
 *     awaitingOpponent?: boolean;
 *     badgeLabel?: string;
 *     helperText?: string | null;
 *     onNameOpponent?: (() => void) | null;
 *     opponentName?: string;
 *     value: string;
 *     verdict?: 'win' | 'draw' | 'loss' | null;
 *   } | null;
 * }} props
 */
function EventHeader({ detectionSummary = null, event, matchScoreSummary = null }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const SpacesAny = /** @type {any} */ (Spaces);
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
  const categoryName = toDisplayText(event?.team?.category?.name || event?.tournamentCategory?.name);
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
  const tournamentTitle = eventOwnName || t('eventDetails.header.tournamentFallback', 'Tournoi');
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
    headerPrimaryTitle = eventOwnName || clubName;
  }

  let headerSecondaryTitle = '';
  if (showsMatchOpponentTitle) {
    headerSecondaryTitle = [matchContextLabel, clubName].filter(Boolean).join(' - ');
  } else if (isTournamentEvent) {
    headerSecondaryTitle = [clubName, activityName, categoryName].filter(Boolean).join(' - ');
  }
  const invitedTeamNames = (event?.invitedTeams || [])
    .map((/** @type {any} */ team) => toDisplayText(team?.name))
    .filter(Boolean);

  const getParsedLocationDetails = () => {
    if (!locationDetails) return null;
    return safeJsonParse(locationDetails, null);
  };

  const getLocationText = () => {
    const parsed = getParsedLocationDetails();
    const fromDetails = toDisplayText(parsed?.address);
    const fromEventLocation = toDisplayText(event?.location);
    const normalized = normalizeLocationInput(parsed?.address || event?.location || parsed);
    if (isImportedExternalMatch && externalMatchLocation) {
      return externalMatchLocation;
    }
    return fromDetails || fromEventLocation || normalized?.label || normalized?.address || externalMatchLocation || '';
  };

  const getLocationCoordinates = () => {
    const parsed = getParsedLocationDetails();
    return resolveLocationCoordinates(event?.location)
      || resolveLocationCoordinates(parsed?.address)
      || resolveLocationCoordinates(parsed);
  };

  const handleOpenLocationInGps = () => {
    const addressLabel = getLocationText().trim();
    if (!addressLabel) return;

    const coordinates = getLocationCoordinates();
    const encodedAddress = encodeURIComponent(addressLabel);
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    const nativeUrl = coordinates
      ? Platform.select({
        android: `geo:${coordinates.lat},${coordinates.lng}?q=${coordinates.lat},${coordinates.lng}(${encodedAddress})`,
        default: fallbackUrl,
        ios: `maps:${coordinates.lat},${coordinates.lng}?q=${encodedAddress}`,
      })
      : Platform.select({
        android: `geo:0,0?q=${encodedAddress}`,
        default: fallbackUrl,
        ios: `maps:0,0?q=${encodedAddress}`,
      });

    if (!nativeUrl) {
      Linking.openURL(fallbackUrl).catch(() => {});
      return;
    }

    Linking.canOpenURL(nativeUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(nativeUrl);
        }
        return Linking.openURL(fallbackUrl);
      })
      .catch(() => {
        Linking.openURL(fallbackUrl).catch(() => {});
      });
  };

  // 🏁 N3 (D5/D6/D7) — CE QUE L'ENCART AFFICHE, calcule une fois.
  // L'ecran fournit la DONNEE (`opponentName`, `verdict`) ; la carte fournit la
  // MISE EN FORME. C'est la meme separation que pour l'orientation (D3), a
  // l'envers : l'ecran sait qui regarde, la carte sait comment le dire.
  const verdictColorToken = matchScoreSummary?.verdict
    ? VERDICT_COLOR_TOKENS[matchScoreSummary.verdict]
    : null;
  const verdictColor = verdictColorToken ? Colors[verdictColorToken] : null;
  const verdictFontStyle = verdictColorToken ? Fonts[verdictColorToken] : Fonts.primary100;
  const verdictLabel = {
    draw: t('eventDetails.matchCard.verdict.draw', 'Nul'),
    loss: t('eventDetails.matchCard.verdict.loss', 'Défaite'),
    win: t('eventDetails.matchCard.verdict.win', 'Victoire'),
  }[matchScoreSummary?.verdict || ''] || '';
  const badgeLabelWithVerdict = [matchScoreSummary?.badgeLabel, verdictLabel]
    .filter(Boolean)
    .join(' · ');
  const opponentDisplayName = toDisplayText(matchScoreSummary?.opponentName);
  const matchupLabel = opponentDisplayName
    ? [clubName, opponentDisplayName].filter(Boolean).join(' — ')
    : t('eventDetails.matchCard.opponentToConfirm', 'Adversaire à confirmer');

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
        Spaces.paddingVertical[32],
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
          {facilityName ? (
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
                {facilityName}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {matchScoreSummary ? (
        <View
          style={[
            ApplicationStyle.borderRadius24,
            Alignments.alignCenter,
            Spaces.paddingVertical[12],
            SpacesAny.paddingHorizontal[18],
            Spaces.gap[8],
            {
              backgroundColor: withAlpha(accentColor, 0.09),
              borderColor: verdictColor
                ? withAlpha(verdictColor, VERDICT_BORDER_ALPHA)
                : withAlpha(accentColor, 0.33),
              borderWidth: 1,
              minWidth: 172,
            },
            // D10 — le POINTILLE dit « il manque quelque chose » sans ecrire un
            // mot de plus. Un trait plein annoncerait un encart complet.
            matchScoreSummary.awaitingOpponent ? { borderStyle: 'dashed' } : null,
          ]}
          testID="event-header-match-encart"
        >
          {/* D5 — LE FACE-A-FACE, en tete de l'encart : « Test FC — FC Bonneveine ».
              Le tiret cadratin et AUCUN mot entre les deux noms (Q1 = C) : la
              mise en page dit deja « contre ».
              ⚠️ Le libelle se compose ICI et non dans l'ecran : le nom du club
              est deja resolu a cet endroit (`clubName`), le refaire au-dessus
              serait la meme regle ecrite deux fois. */}
          <Text style={[Fonts.p3Bold, Fonts.neutral00, Fonts.textCenter]}>
            {matchupLabel}
          </Text>
          {badgeLabelWithVerdict ? (
            <Text style={[Fonts.p4Bold, verdictFontStyle]}>
              {badgeLabelWithVerdict}
            </Text>
          ) : null}
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>
            {matchScoreSummary.value}
          </Text>
          {matchScoreSummary.helperText ? (
            <Text style={[Fonts.p4, Fonts.primary100, Fonts.textCenter]}>
              {matchScoreSummary.helperText}
            </Text>
          ) : null}
          {/* D9/D10 — la PRESENCE du rappel porte le droit. Un lecteur qui
              n'organise pas ne recoit pas `onNameOpponent`, donc aucun bouton
              n'est monte : impossible d'afficher une action interdite en
              oubliant de lire un drapeau. */}
          {matchScoreSummary.onNameOpponent ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={matchScoreSummary.onNameOpponent}
              style={[
                ApplicationStyle.borderRadius100,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[4],
                { backgroundColor: withAlpha(accentColor, 0.18) },
              ]}
              testID="event-header-nommer-adversaire"
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                {t('eventDetails.matchCard.nameOpponent', 'Nommer l\'adversaire')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
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
                <Text style={[Fonts.p2, Fonts.neutral00]}>
                  {formatDateWithDayPrefix(event.date)}
                </Text>
              </View>

              <View style={[Alignments.row, Spaces.gap[4]]}>
                <Image
                  source={Images.clock}
                  style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
                />
                <Text style={[Fonts.p2, Fonts.primary100]}>
                  {event?.startTime && event?.endTime
                    ? `${event.startTime.substring(0, 5)} - ${event.endTime.substring(0, 5)}`
                    : format(new Date(event.date), 'HH:mm')}
                </Text>
              </View>
            </View>

            <View style={[{ height: 45, width: 1 }, ApplicationStyle.backgroundColor.neutral00]} />

            {(categoryName || levelName || activityName) && (
              <View style={[Spaces.gap[8]]}>
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
    </ImageBackground>
  );
}

export default EventHeader;
