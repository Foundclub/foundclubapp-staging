import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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
import LinearGradient from 'react-native-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import useAuth from '@/domains/auth/useAuth';
import { estDuClubOrganisateur } from '@/domains/event/eventDisplayName';
import { resolveTrainingOpenConfig } from '@/domains/event/eventUseCases';
import { getCurrentUserEventParticipationState } from '@/domains/event/participationState';
import useEvent from '@/domains/event/useEvent';
import { resolveParticipationFlow } from '@/domains/participation/participationFlow';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Tag from '@/components/atoms/tag/Tag';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';
import SponsorMarquee from '@/components/molecules/sponsorMarquee/SponsorMarquee';

import {
  resolveExternalMatchDisplay,
  resolveExternalMatchLocation,
} from '@/utils/externalMatchDisplay';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import { getShortAddress } from '@/utils/location';

/**
 * Normalise un nom de type (casse et accents) pour comparaison.
 * @param {string | undefined} typeName - Nom du type d'événement.
 * @returns {string} - Nom normalisé.
 */
const normalizeTypeName = (typeName) => (typeName?.toLowerCase() || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

/**
 * Choisit le fond illustré correspondant au type d'événement.
 * @param {string | undefined} typeName - Nom du type d'événement.
 * @param {Record<string, any>} Images - Catalogue d'images du thème.
 * @param {boolean} [isStageEvent] - Événement au format stage.
 * @returns {any} - Source du fond illustré.
 */
const getBackgroundImage = (typeName, Images, isStageEvent = false) => {
  const normalizedType = normalizeTypeName(typeName);
  if (normalizedType.includes('match')) return Images.eventCardMatch;
  if (normalizedType.includes('entrainement')) return Images.eventCardTraining;
  if (normalizedType.includes('detection')) return Images.eventCardDetection;
  if (normalizedType.includes('reservation')) return Images.eventCardReservation;
  if (normalizedType.includes('tournoi')) return Images.eventCardTournament;
  if (normalizedType.includes('stage') || isStageEvent) return Images.eventCardStage;
  return Images.eventCardOther;
};

// Libellés du chip type — tableau du handoff « Cartes Rechercher » (tour 3b).
const DETECTION_EVENT_CARD_HEADER_TITLE = 'DÉTECTION / ESSAI';

/**
 * Libéllé du chip type, selon le tableau du handoff (tour 3b).
 * @param {string | undefined} typeName - Nom du type d'événement.
 * @param {any} eventItem - Événement affiché.
 * @returns {string} - Libellé du chip type.
 */
const getHeaderTitle = (typeName, eventItem) => {
  const normalizedType = normalizeTypeName(typeName);
  if (normalizedType.includes('match')) return 'MATCH';
  if (normalizedType.includes('entrainement')) {
    const trainingConfig = resolveTrainingOpenConfig({
      ...(eventItem || {}),
      typeName,
    });
    const externalLimit = Number(trainingConfig?.externalParticipantLimit || 0);
    if (trainingConfig?.isOpenTraining && externalLimit > 0) {
      return 'Entraînement OUVERT';
    }
    return 'ENTRAINEMENT';
  }
  if (normalizedType.includes('detection')) return DETECTION_EVENT_CARD_HEADER_TITLE;
  if (normalizedType.includes('reservation')) return 'RÉSERVATION';
  if (normalizedType.includes('tournoi')) return 'TOURNOI';
  if (normalizedType.includes('stage')) return 'STAGE';
  return typeName?.toUpperCase() || 'ÉVÉNEMENT';
};

// Couleur du chip par type — SEUL le chip change, tout le reste reste cyan
// (handoff, tour 3). Détection reste cyan volontairement.
/**
 * Couleur d'accent du chip selon le type (handoff, tour 3).
 * @param {string | undefined} typeName - Nom du type d'événement.
 * @param {boolean} isStageEvent - Événement au format stage.
 * @param {Record<string, string>} Colors - Jetons couleur du thème.
 * @returns {string} - Couleur d'accent du chip.
 */
const getTypeAccentColor = (typeName, isStageEvent, Colors) => {
  const normalizedType = normalizeTypeName(typeName);
  if (normalizedType.includes('detection')) return Colors.primary500;
  if (normalizedType.includes('entrainement')) return Colors.success500;
  if (normalizedType.includes('match')) return Colors.violet500;
  if (normalizedType.includes('tournoi')) return Colors.rose500;
  if (normalizedType.includes('stage') || isStageEvent) return Colors.warning500;
  if (normalizedType.includes('reservation')) return Colors.gold500;
  return Colors.neutral300;
};

/**
 * Extrait un libellé affichable d'une valeur brute.
 * @param {any} value - Libellé brut (chaîne ou objet nommé).
 * @returns {string} - Libellé affichable.
 */
const getDisplayLabel = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name.trim();
    if (typeof value.label === 'string') return value.label.trim();
    if (typeof value.title === 'string') return value.title.trim();
  }
  return '';
};

/**
 * Réduit un texte à ses caractères comparables.
 * @param {any} value - Texte à normaliser pour comparaison.
 * @returns {string} - Texte comparable.
 */
const normalizeComparableText = (value) => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

/**
 * Retire le préfixe « vs » d'un titre de match.
 * @param {any} value - Titre de match dont on retire le préfixe « vs ».
 * @returns {string} - Titre nettoyé.
 */
const stripMatchPrefix = (value) => String(value || '')
  .trim()
  .replace(/^vs\b\.?\s*/i, '')
  .trim();

/**
 * Formate la date longue de la grille méta.
 * @param {any} value - Date source.
 * @returns {string} - Date longue capitalisée.
 */
const formatEventDateLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const formatted = format(date, 'EEEE dd MMMM', { locale: fr });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

/**
 * Formate une date compacte pour les périodes de stage.
 * @param {any} value - Date source.
 * @returns {string} - Date compacte capitalisée.
 */
const formatCompactEventDateLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const formatted = format(date, 'EEE dd MMM', { locale: fr });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

/**
 * Formate la date courte de la pastille en rangée 1.
 * @param {any} value - Date source.
 * @returns {string} - Date courte du chip (« mer. 27/05 »).
 */
const formatShortDateLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'EEE dd/MM', { locale: fr });
};

/**
 * Formate la période d'un stage (début - fin, ou date seule).
 * @param {any} startValue - Début du stage.
 * @param {any} endValue - Fin du stage.
 * @returns {string} - Période affichable.
 */
const formatStagePeriodLabel = (startValue, endValue) => {
  if (!startValue) return '';

  const startDate = new Date(startValue);
  if (Number.isNaN(startDate.getTime())) return '';

  if (!endValue) return formatEventDateLabel(startDate);

  const endDate = new Date(endValue);
  if (Number.isNaN(endDate.getTime())) return formatEventDateLabel(startDate);

  if (format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
    return formatEventDateLabel(startDate);
  }

  return `${formatCompactEventDateLabel(startDate)} - ${formatCompactEventDateLabel(endDate)}`;
};

/**
 * Titre principal en mode planning (adversaire d'abord pour un match).
 * @param {{
 *   clubName: string, eventTitle: string, invitedOpponentNames: string[],
 *   isMatchEvent: boolean, matchContext: any, teamName: string,
 * }} params - Contexte du titre.
 * @returns {string} - Titre principal de la carte planning.
 */
const resolveTeamFocusedPrimaryTitle = ({
  clubName,
  eventTitle,
  invitedOpponentNames,
  isMatchEvent,
  matchContext,
  teamName,
}) => {
  if (!isMatchEvent) {
    return teamName || clubName || 'Equipe';
  }

  const opponentFromContext = stripMatchPrefix(matchContext?.opponentName);
  if (opponentFromContext) return opponentFromContext;

  const opponentFromTitle = stripMatchPrefix(eventTitle);
  if (opponentFromTitle) return opponentFromTitle;

  // ⚠️ `invitedOpponentNames` a DEJA ete filtre par la regle « meme club »
  // (voir plus bas, au montage de la carte). Ce repli ne compare donc plus
  // que des noms — ce qui est exactement son role — sans jamais pouvoir
  // designer une equipe de notre propre club comme adversaire (S7).
  const normalizedTeamName = normalizeComparableText(teamName);
  const invitedOpponent = invitedOpponentNames.find((name) => (
    normalizeComparableText(name) && normalizeComparableText(name) !== normalizedTeamName
  ));
  if (invitedOpponent) return invitedOpponent;

  return teamName || clubName || 'Match';
};

// Encart d'info spécifique au type (handoff, tour 3) — construit uniquement
// avec les données déjà présentes sur l'événement, masqué sinon.
/**
 * Contenu de l'encart d'info par type, avec les seules données présentes.
 * @param {{
 *   eventItem: any, matchContextLabel: string, matchOpponent: string,
 *   tournamentMetaName: string, typeName: string,
 * }} params - Contexte de l'encart.
 * @returns {string} - Texte de l'encart, vide si rien à montrer.
 */
const resolveTypeInfoText = ({
  eventItem,
  matchContextLabel,
  matchOpponent,
  tournamentMetaName,
  typeName,
}) => {
  const normalizedType = normalizeTypeName(typeName);
  const description = String(eventItem?.description || '').trim();

  if (normalizedType.includes('detection')) {
    const slots = (eventItem?.detectionSlots || [])
      .map((slot) => {
        const position = String(slot?.position || '').trim();
        if (!position) return '';
        const quantity = Number(slot?.quantity || 0);
        return quantity > 1 ? `${position} ×${quantity}` : position;
      })
      .filter(Boolean);
    if (slots.length) return `Postes recherchés : ${slots.join(', ')}`;
    return description;
  }

  if (normalizedType.includes('entrainement')) {
    const trainingConfig = resolveTrainingOpenConfig({
      ...(eventItem || {}),
      typeName,
    });
    const externalLimit = Number(trainingConfig?.externalParticipantLimit || 0);
    if (trainingConfig?.isOpenTraining && externalLimit > 0) {
      return `Ouvert aux joueurs externes · ${externalLimit} places externes`;
    }
    return description;
  }

  if (normalizedType.includes('match')) {
    const parts = [
      matchOpponent ? `vs ${matchOpponent}` : '',
      matchContextLabel,
    ].filter(Boolean);
    if (parts.length) return parts.join(' · ');
    return description;
  }

  if (normalizedType.includes('tournoi')) {
    return tournamentMetaName || description;
  }

  if (normalizedType.includes('reservation')) {
    const parts = [
      eventItem?.pricePerPerson !== undefined ? `${eventItem.pricePerPerson}€ / pers` : '',
      Number(eventItem?.totalPlayers || 0) > 0 ? `${eventItem.totalPlayers} joueurs max` : '',
    ].filter(Boolean);
    if (parts.length) return parts.join(' · ');
    return description;
  }

  return description;
};

// Jauge de places (handoff, tour 3) : inscrits/capacité, en équipes pour un
// tournoi, joueurs pour une réservation. Masquée sans capacité connue.
/**
 * Jauge de places : inscrits/capacité, équipes pour un tournoi.
 * @param {any} eventItem - Événement affiché.
 * @param {{ isReservation: boolean, isTournamentEvent: boolean }} kind - Nature de l'événement.
 * @returns {{ taken: number, total: number, unit: string } | null} - Jauge ou null.
 */
const resolveCapacityGauge = (eventItem, { isReservation, isTournamentEvent }) => {
  if (isReservation) {
    const total = Number(eventItem?.totalPlayers || 0);
    if (!total) return null;
    return { taken: Number(eventItem?.currentPlayers || 0), total, unit: '' };
  }
  if (isTournamentEvent) {
    const total = Number(eventItem?.tournamentConfig?.maxTeams || 0);
    if (!total) return null;
    return { taken: (eventItem?.tournamentTeams || []).length, total, unit: ' équipes' };
  }
  const total = Number(eventItem?.capacity || 0);
  if (!total) return null;
  return { taken: (eventItem?.participations || []).length, total, unit: '' };
};

/**
 * Event Card component (New Design)
 * @param {object} props
 * @param {FCEvent} props.item
 * @param {Function} props.onPress
 * @param {Function} props.onJoin
 * @param {Function} props.onDecline
 * @param {Function} props.onParticipate
 * @param {(item: any) => void} [props.onEditAnswer] - AA01 : changer une reponse deja donnee
 *   depuis la carte (« Modifier ma reponse » / « Annuler ma participation »).
 *   Sans lui, la carte n offre AUCUN bouton a qui a repondu « absent ».
 * @param {Function} props.onLogin
 * @param {string} [props.actionLabel] - Custom label for the action button (used in reservations)
 * @param {Function} [props.onRefuse]
 * @param {Function} [props.onValidate]
 * @param {boolean} [props.showClubHeader]
 * @param {'default' | 'share'} [props.mode]
 * @param {'default' | 'teamFocused'} [props.displayProfile]
 * @param {boolean} [props.useFacilityAccentColor]
 * @returns {import('react').ReactElement}
 */
function EventCardNew({
  actionLabel,
  displayProfile = 'default',
  item,
  mode = 'default',
  onDecline,
  onEditAnswer,
  onJoin,
  onLogin,
  onParticipate,
  onPress,
  onRefuse,
  onValidate,
  showClubHeader = false,
  useFacilityAccentColor = false,
}) {
  const {
    Alignments,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { haveIAlreadyJoined } = useEvent();

  const participationState = getCurrentUserEventParticipationState({
    missings: item?.missings,
    participationRequests: item?.participationRequests,
    participations: item?.participations,
    user: userData,
  });

  // Check if user has already joined (for reservations)
  const alreadyJoined = haveIAlreadyJoined({
    participations: item?.participations,
    userId: userData?.documentId,
  });
  const { hasAcceptedRequest, hasPendingRequest } = participationState;
  const participationFlow = useMemo(() => resolveParticipationFlow(item, {
    participationState,
    user: userData,
  }), [item, participationState, userData]);

  // Booking status for reservations
  const bookingStatus = item?.bookingStatus || 'open';
  const isLastMinuteAlert = item?.isLastMinuteAlert || false;
  const currentPlayers = item?.currentPlayers || 0;
  const totalPlayers = item?.totalPlayers || 4;
  const missingPlayers = item?.missingPlayers || (totalPlayers - currentPlayers);
  const isShared = bookingStatus === 'shared';
  const isBooked = bookingStatus === 'booked';

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 100 });
    opacity.value = withTiming(0.9, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
    opacity.value = withTiming(1, { duration: 100 });
  };

  const typeName = item?.type?.name || '';
  const normalizedTypeName = normalizeTypeName(typeName);
  const isReservation = normalizedTypeName.includes('reservation');
  const isMatchEvent = normalizedTypeName.includes('match');
  const isTournamentEvent = normalizedTypeName.includes('tournoi');
  const isStageParentEvent = String(item?.eventFormat || '').toLowerCase() === 'stage_parent';
  const isStageEvent = isStageParentEvent
    || String(item?.eventFormat || '').toLowerCase() === 'stage_day'
    || normalizedTypeName.includes('stage');
  const isShareMode = mode === 'share';
  const isTeamFocusedCard = displayProfile === 'teamFocused' && !isShareMode && !isReservation;
  const backgroundImage = getBackgroundImage(typeName, Images, isStageEvent);
  const headerTitle = getHeaderTitle(typeName, item);

  // Sponsors
  const sponsors = item?.club?.sponsor || item?.team?.club?.sponsor || [];
  const externalMatchLocation = isMatchEvent ? resolveExternalMatchLocation(item) : '';
  const isImportedExternalMatch = isMatchEvent && (
    item?.externalAutoSource === 'external_competition'
    || Array.isArray(item?.team?.externalCalendarData)
  );

  // Location - check facility first (club installation), then other options
  const locationText = isImportedExternalMatch
    ? (
      item?.facility?.name
      || externalMatchLocation
      || getShortAddress(item?.locationDetails)
      || getShortAddress(item?.location)
      || t('eventDetails.locationUnknown', 'Lieu à confirmer')
    )
    : (
      item?.facility?.name
      || getShortAddress(item?.locationDetails)
      || getShortAddress(item?.club?.addressDetails)
      || getShortAddress(item?.team?.club?.addressDetails)
      || getShortAddress(item?.location)
      || externalMatchLocation
      || null
    );

  // Sport/Activity
  const sportName = item?.team?.activities?.map(({ name }) => name)?.join(', ')
    || item?.tournamentActivity?.name
    || item?.type?.name
    || 'Sport';

  const clubName = item?.team?.club?.name || item?.club?.name || 'FoundClub';
  const clubLogo = item?.team?.club?.logo?.url || item?.club?.logo?.url;
  const tournamentMetaName = [
    getDisplayLabel(item?.tournamentActivity),
    getDisplayLabel(item?.tournamentSection),
    getDisplayLabel(item?.tournamentCategory),
  ].filter(Boolean).join(' • ');
  const teamName = item?.team?.name
    || (isTournamentEvent && item?.tournamentScopeMode === 'autonomous' ? 'Tournoi autonome' : '');
  const matchDisplay = isMatchEvent
    ? resolveExternalMatchDisplay(item)
    : { contextLabel: '', title: '' };
  const eventTitle = matchDisplay.title;
  const matchContextLabel = matchDisplay.contextLabel;
  const defaultPrimaryTitle = isMatchEvent && eventTitle ? eventTitle : (item?.name || clubName);
  const defaultSecondaryTitle = isMatchEvent && eventTitle
    ? [matchContextLabel, clubName].filter(Boolean).join(' - ')
    : (teamName || (isTournamentEvent ? tournamentMetaName : ''));
  const teamSection = getDisplayLabel(
    item?.team?.section || item?.tournamentSection || item?.section,
  );
  const teamLevel = getDisplayLabel(item?.team?.level || item?.level);
  const teamCategory = getDisplayLabel(
    item?.team?.category || item?.tournamentCategory || item?.category,
  );
  const defaultTeamMetaLine = [teamCategory, teamSection, teamLevel]
    .filter((value) => !!value)
    .join(' • ');
  const invitedTeams = Array.isArray(item?.invitedTeams) ? item.invitedTeams : [];
  // 📋 TOUTES les equipes conviees : c'est la liste que la carte par defaut
  // affiche telle quelle (« equipes invitees: … »). Elle ne se filtre pas —
  // une equipe interne conviee reste une equipe conviee.
  const invitedTeamNames = invitedTeams
    .map((team) => team?.name)
    .filter(Boolean);
  // 🧨 S7 — CELLES QUI PEUVENT ETRE L ADVERSAIRE, et elles seules.
  // Le repli du titre planning ne comparait que des NOMS : c'etait la 4e
  // copie de « qui est l'adversaire », et la seule que R2 n'avait pas
  // corrigee. On REFERENCE ici la regle unique de `eventDisplayName.js`
  // plutot que d'en ecrire une cinquieme version.
  // ⚖️ Elle exige les DEUX clubs connus et egaux : sans club (ancien parc,
  // charge utile compacte), rien n'est filtre et le comportement d'avant reste.
  const invitedOpponentNames = invitedTeams
    .filter((team) => !estDuClubOrganisateur(team, item))
    .map((team) => team?.name)
    .filter(Boolean);
  const primaryTitle = isTeamFocusedCard
    ? resolveTeamFocusedPrimaryTitle({
      clubName,
      eventTitle,
      invitedOpponentNames,
      isMatchEvent,
      matchContext: item?.matchContext,
      teamName,
    })
    : defaultPrimaryTitle;
  const secondaryTitle = isTeamFocusedCard
    ? [teamName, clubName]
      .filter((value, index, values) => value && values.indexOf(value) === index)
      .join(' • ')
    : defaultSecondaryTitle;
  const teamMetaLine = isTeamFocusedCard
    ? [typeName, matchContextLabel, defaultTeamMetaLine].filter(Boolean).join(' • ')
    : defaultTeamMetaLine;

  const facilityAccentColor = useFacilityAccentColor
    ? resolveFacilityPlanningColor(item?.facility)
    : null;
  const typeAccentColor = facilityAccentColor
    || getTypeAccentColor(typeName, isStageEvent, Colors);
  const containerAccentStyle = facilityAccentColor ? { borderColor: facilityAccentColor } : null;
  const locationIconAccentStyle = facilityAccentColor ? { tintColor: facilityAccentColor } : null;
  const locationTextAccentStyle = facilityAccentColor ? { color: facilityAccentColor } : null;

  const dateLabel = isStageParentEvent
    ? formatStagePeriodLabel(item?.stageStartDate || item?.date, item?.stageEndDate)
    : formatEventDateLabel(item?.date);
  const shortDateLabel = isStageParentEvent
    ? formatShortDateLabel(item?.stageStartDate || item?.date)
    : formatShortDateLabel(item?.date);
  let timeLabel = '';
  if (item?.startTime && item?.endTime) {
    timeLabel = `${item.startTime.substring(0, 5)} - ${item.endTime.substring(0, 5)}`;
  } else if (item?.startTime) {
    timeLabel = item.startTime.substring(0, 5);
  } else if (item?.date && !Number.isNaN(new Date(item.date).getTime())) {
    timeLabel = format(new Date(item.date), 'HH:mm');
  }

  const typeInfoText = resolveTypeInfoText({
    eventItem: item,
    matchContextLabel,
    matchOpponent: stripMatchPrefix(eventTitle),
    tournamentMetaName,
    typeName,
  });
  const capacityGauge = resolveCapacityGauge(item, { isReservation, isTournamentEvent });
  const gaugeRatio = capacityGauge
    ? Math.min(1, Math.max(0, capacityGauge.taken / capacityGauge.total))
    : 0;
  let gaugeCountLabel = '';
  if (capacityGauge) {
    if (isReservation && isShared && missingPlayers > 0) {
      const plural = missingPlayers > 1 ? 's' : '';
      const countSuffix = `(${currentPlayers}/${totalPlayers})`;
      gaugeCountLabel = `Il manque ${missingPlayers} joueur${plural} ${countSuffix}`;
    } else {
      gaugeCountLabel = `${capacityGauge.taken} / ${capacityGauge.total}${capacityGauge.unit}`;
    }
  }

  const glassChipStyle = {
    backgroundColor: withAlpha(Colors.neutral00, 0.08),
    borderColor: withAlpha(Colors.neutral00, 0.16),
  };
  const veilColors = [
    withAlpha(Colors.primary900, 0.55),
    withAlpha(Colors.primary900, 0.82),
    withAlpha(Colors.primary900, 0.94),
  ];

  const renderCtaContent = () => {
    if (onValidate && onRefuse) {
      return (
        <View style={styles.ctaRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onValidate?.(item)}
            style={[styles.pillButton, { backgroundColor: Colors.primary500 }]}
          >
            <Text style={[styles.pillButtonText, { color: Colors.primary900 }]}>Valider</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onRefuse?.(item)}
            style={[styles.pillButton, styles.pillButtonOutline, { borderColor: Colors.error500 }]}
          >
            <Text style={[styles.pillButtonText, { color: Colors.error500 }]}>Refuser</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!isReservation) {
      return (
        <EventAnswerButtons
          event={item}
          hasAcceptedRequest={hasAcceptedRequest}
          hasPendingRequest={hasPendingRequest}
          onAbout={() => onPress?.(item)}
          onDecline={() => onDecline?.(item)}
          onDeleteParticipation={onEditAnswer ? () => onEditAnswer(item) : undefined}
          onJoin={() => onJoin?.(item)}
          onLogin={onLogin}
          onParticipate={() => onParticipate?.(item)}
          participationFlow={participationFlow}
        />
      );
    }

    if (alreadyJoined) {
      return (
        <View style={[Alignments.fullWidth]}>
          <Tag
            text={t('eventList.info.alreadyJoined', 'Je participe !')}
            textStyle={Fonts.p1Bold}
          />
        </View>
      );
    }

    return (
      <View style={[Alignments.fullWidth, Spaces.gap[8]]}>
        <Pressable
          disabled={!participationFlow?.canAct}
          onPress={() => onParticipate?.(item)}
          style={[
            styles.pillButton,
            { backgroundColor: Colors.primary500 },
            !participationFlow?.canAct ? styles.pillButtonDisabled : null,
          ]}
        >
          <Text style={[styles.pillButtonText, { color: Colors.primary900 }]}>
            {actionLabel || t('reservation.actions.participate') || 'Réserver'}
          </Text>
        </Pressable>
        {!participationFlow?.canAct && participationFlow?.blockedReason ? (
          <Text style={[Fonts.p4, Fonts.neutral300]}>
            {participationFlow.blockedReason}
          </Text>
        ) : null}
      </View>
    );
  };

  /**
   * Cellule de la grille méta 2x2 (icône cyan + texte).
   * @param {any} iconSource - Icône de la cellule.
   * @param {string | null} label - Texte de la cellule.
   * @param {{ iconAccentStyle?: any, textAccentStyle?: any }} [options] - Accents planning.
   * @returns {import('react').ReactElement | null} - Cellule méta.
   */
  const renderMetaCell = (iconSource, label, options = {}) => {
    if (!label) return null;
    return (
      <View style={styles.metaCell}>
        <Image
          source={iconSource}
          style={[
            styles.metaIcon,
            { tintColor: Colors.primary500 },
            options.iconAccentStyle,
          ]}
        />
        <Text
          numberOfLines={1}
          style={[styles.metaText, { color: Colors.neutral00 }, options.textAccentStyle]}
        >
          {label}
        </Text>
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: Colors.primary800,
          borderColor: withAlpha(Colors.primary500, 0.32),
        },
        containerAccentStyle,
        animatedStyle,
      ]}
    >
      {/* Fond illustré du type + voile de lisibilité */}
      <ImageBackground
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
        source={backgroundImage}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={veilColors}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Main Card Pressable (Background) */}
      <Pressable
        onPress={() => onPress?.(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={StyleSheet.absoluteFill}
      />

      {/* Content Container */}
      <View pointerEvents="box-none" style={styles.contentContainer}>

        {/* Non-interactive Content (Passes touches to background Pressable) */}
        <View pointerEvents="none" style={styles.staticContent}>
          {/* Rangée 1 — chip type + date courte */}
          <View style={styles.topRow}>
            <View style={[styles.typeChip, glassChipStyle]}>
              <View style={[styles.typeDot, { backgroundColor: typeAccentColor }]} />
              <Text
                numberOfLines={1}
                style={[styles.typeChipText, { color: typeAccentColor }]}
              >
                {headerTitle}
              </Text>
            </View>
            {shortDateLabel ? (
              <Text
                style={[
                  styles.datePill,
                  {
                    backgroundColor: withAlpha(Colors.primary900, 0.55),
                    color: Colors.neutral100,
                  },
                ]}
              >
                {shortDateLabel}
              </Text>
            ) : null}
          </View>

          {/* Rangée 2 — club */}
          <View style={styles.clubRow}>
            <ClubLogoMark
              logoStyle={styles.clubLogo}
              logoUrl={clubLogo}
              name={clubName}
              size={44}
            />
            <View style={styles.clubTextContainer}>
              <Text
                numberOfLines={showClubHeader ? 2 : 1}
                style={[
                  styles.clubName,
                  { color: Colors.neutral00 },
                  showClubHeader ? styles.clubNameLarge : null,
                ]}
              >
                {primaryTitle}
              </Text>
              {secondaryTitle ? (
                <Text numberOfLines={1} style={[styles.clubSubLine, { color: Colors.neutral200 }]}>
                  {secondaryTitle}
                </Text>
              ) : null}
              {teamMetaLine ? (
                <Text numberOfLines={1} style={[styles.clubSubLine, { color: Colors.neutral200 }]}>
                  {teamMetaLine}
                </Text>
              ) : null}
              {!isTeamFocusedCard && invitedTeamNames.length > 0 ? (
                <Text numberOfLines={1} style={[styles.clubSubLine, { color: Colors.primary200 }]}>
                  {`équipes invitées: ${invitedTeamNames.join(', ')}`}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Grille méta 2×2 — icônes cyan */}
          <View style={styles.metaGrid}>
            <View style={styles.metaRow}>
              {renderMetaCell(Images.calendar, dateLabel)}
              {renderMetaCell(Images.clock, timeLabel)}
            </View>
            <View style={styles.metaRow}>
              {renderMetaCell(Images.pin, locationText || 'Lieu non défini', {
                iconAccentStyle: locationIconAccentStyle,
                textAccentStyle: locationTextAccentStyle,
              })}
              {renderMetaCell(Images.running, sportName)}
            </View>
          </View>

          {/* Badges d'état des réservations (données réelles conservées) */}
          {isReservation && (isLastMinuteAlert || isShared || isBooked) ? (
            <View style={styles.statusBadgesRow}>
              {isLastMinuteAlert ? (
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: withAlpha(Colors.warning500, 0.9) },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: Colors.primary900 }]}>
                    🔥 Dernière minute
                  </Text>
                </View>
              ) : null}
              {isShared && !isLastMinuteAlert ? (
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: withAlpha(Colors.gold500, 0.9) },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: Colors.primary900 }]}>
                    👥 Joueurs recherchés
                  </Text>
                </View>
              ) : null}
              {isBooked ? (
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: withAlpha(Colors.success500, 0.9) },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: Colors.primary900 }]}>
                    ✅ Complet
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Encart d'info spécifique au type */}
          {typeInfoText ? (
            <View
              style={[
                styles.typeInfoBox,
                {
                  backgroundColor: withAlpha(Colors.primary900, 0.5),
                  borderColor: withAlpha(Colors.neutral00, 0.08),
                },
              ]}
            >
              <Text numberOfLines={2} style={[styles.typeInfoText, { color: Colors.neutral100 }]}>
                {typeInfoText}
              </Text>
            </View>
          ) : null}

          {/* Jauge de places */}
          {capacityGauge ? (
            <View style={styles.gaugeBlock}>
              <View style={styles.gaugeLabelsRow}>
                <Text style={[styles.gaugeLabel, { color: Colors.neutral200 }]}>Places</Text>
                <Text style={[styles.gaugeLabel, { color: Colors.primary500 }]}>
                  {gaugeCountLabel}
                </Text>
              </View>
              <View
                style={[styles.gaugeTrack, { backgroundColor: withAlpha(Colors.neutral00, 0.14) }]}
              >
                <View
                  style={[
                    styles.gaugeFill,
                    {
                      backgroundColor: Colors.primary500,
                      width: `${Math.round(gaugeRatio * 100)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </View>

        {/* CTA - Interactive (Captures touches) */}
        {!isShareMode ? (
          <View pointerEvents="auto" style={styles.ctaContainer}>
            {renderCtaContent()}
          </View>
        ) : null}

        {/* Pied sponsors — marquee continue, masqué sans sponsor. En mode
            partage (bulle de chat, sélecteurs en ScrollView), la ligne reste
            STATIQUE : ces surfaces montent des dizaines de cartes d'un coup. */}
        {sponsors.length > 0 ? (
          <View pointerEvents="auto">
            <SponsorMarquee
              fadeColor={Colors.primary900}
              paused={isShareMode}
              sponsors={sponsors}
            />
          </View>
        ) : null}

      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    borderRadius: 20,
  },
  clubLogo: {
    borderRadius: 22,
  },
  clubName: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  clubNameLarge: {
    fontSize: 20,
    lineHeight: 25,
  },
  clubRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  clubSubLine: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 12,
    marginTop: 1,
  },
  clubTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  contentContainer: {
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  ctaContainer: {
    width: '100%',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  datePill: {
    borderRadius: 999,
    fontFamily: 'Montserrat-Bold',
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  gaugeBlock: {
    gap: 5,
  },
  gaugeFill: {
    borderRadius: 3,
    height: '100%',
  },
  gaugeLabel: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    fontWeight: '600',
  },
  gaugeLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gaugeTrack: {
    borderRadius: 3,
    height: 5,
    overflow: 'hidden',
  },
  metaCell: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 7,
  },
  metaGrid: {
    gap: 8,
  },
  metaIcon: {
    height: 15,
    resizeMode: 'contain',
    width: 15,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 14,
  },
  metaText: {
    flexShrink: 1,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12.5,
    fontWeight: '600',
  },
  // ponytail: hauteur 44 (au lieu des 38 du mock) — cible tactile minimale
  // 44pt, décision Adel du 2026-07-20 (arbitrage n°2). Voie de sortie : NON.
  pillButton: {
    alignItems: 'center',
    borderRadius: 22,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  pillButtonDisabled: {
    opacity: 0.55,
  },
  pillButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  pillButtonText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 12.5,
    fontWeight: '800',
  },
  staticContent: {
    gap: 12,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  typeChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  typeChipText: {
    flexShrink: 1,
    fontFamily: 'Montserrat-Bold',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  typeDot: {
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  typeInfoBox: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeInfoText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default EventCardNew;
