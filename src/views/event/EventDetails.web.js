// @ts-nocheck
/* eslint-disable no-alert, no-nested-ternary, jsx-a11y/label-has-associated-control, object-curly-newline */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { resolveEventDisplayName } from '@/domains/event/eventDisplayName';
import { buildTeamParticipationSections, getEventTrainerKeys } from '@/domains/event/eventParticipantSections';
import { isDetectionEventType, resolveTrainingOpenConfig } from '@/domains/event/eventUseCases';
import { getCurrentUserEventParticipationState } from '@/domains/event/participationState';
import {
  canDeclareLatePresence,
  isArrivalTrackingEnabled,
  isRsvpEnabled,
} from '@/domains/event/presenceRule';
import { resolveClientSourceTeamForUser } from '@/domains/participation/participationFlow';
import { withoutDeletedAccountEntries, withoutDeletedAccounts } from '@/domains/user/deletedAccount';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  getTournamentPendingMembershipForUser,
  getTournamentRosterSummary,
  getTournamentStatusCounters,
  isTournamentActiveMemberStatus,
  isTournamentTeamNonCompliant,
  normalizeTournamentText,
} from '@/views/event/tournamentUtils';
import { buildPublishedBoardTarget, getViewerConvocationRole } from '@/views/playerConvocation/playerConvocationUtils';

import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

import { celebrate } from '@/services/celebrations/celebrationRuntime';
import {
  useGetEvent,
  useGetEventAttendance,
  useGetEventConvocation,
  useGetEventTeamComposition,
} from '@/services/event/eventQueries';
import { respondToEventRsvp, updateEvent } from '@/services/event/eventService';
import { useGetEventParticipations } from '@/services/eventParticipation/eventParticipationQueries';
import {
  createEventParticipation,
  deleteEventParticipation,
} from '@/services/eventParticipation/eventParticipationService';
import { useGetEventMatchStats } from '@/services/matchStats/matchStatsQueries';
import {
  createCustomTournamentTeam,
  registerClubTeamToTournament,
  reviewTournamentTeamRegistration,
} from '@/services/tournamentTeam/tournamentTeamService';

import {
  getClubCertificationLabel,
  getClubCertificationPalette,
} from '@/utils/clubCertification';
import { getEntityDocumentId } from '@/utils/entityId';
import { getErrorStatus } from '@/utils/errors/displayError';
import getImageUrl from '@/utils/imageUrl';
import { buildPublicEventUrl, buildShareMessageWithUrl } from '@/utils/shareLinks';

/* eslint-disable perfectionist/sort-imports */
import * as SharePlatform from '@/platform/share';
import { BREAKPOINTS } from '@/responsive';
import {
  formatTimeInZone,
  resolveAttendanceWindow,
  resolveCallMode,
  resolveServerClockMs,
} from './attendance/attendanceCallModel';
import EventNextActionCard from './components/EventNextActionCard';
import EventTasksSection from './components/EventTasksSection';
import EventTeamAudiencesSection from './components/EventTeamAudiencesSection';
import PostMatchJourneyCard from './components/PostMatchJourneyCard';
import { resolveEventAttendanceGate } from './eventAttendanceGate';
import { resolveEventEndedAt, resolveIsMatchFinished } from './eventMatchClock';
/* eslint-enable perfectionist/sort-imports */

const flattenPages = (pages) => {
  if (!Array.isArray(pages)) return [];
  return pages.flatMap((page) => (Array.isArray(page?.data) ? page.data : []));
};

const getParticipationLabel = (effectiveStatus) => {
  if (effectiveStatus === 'accepted') {
    return i18next.t(
      'eventDetails.youReTakingPart',
      'Tu participes',
    );
  }
  if (effectiveStatus === 'pending') {
    return i18next.t(
      'eventDetails.waitingForApproval',
      'En attente de validation',
    );
  }
  if (effectiveStatus === 'missing') {
    return i18next.t(
      'eventDetails.youReMarkedAbsent',
      'Tu es signale absent',
    );
  }
  return i18next.t('eventDetails.noAnswer', 'Aucune réponse');
};

const getTournamentTeamStatusLabel = (status) => {
  if (status === 'accepted') return i18next.t('eventDetails.approved', 'Validee');
  if (status === 'declined') return i18next.t('eventDetails.declined', 'Refusée');
  if (status === 'archived') return i18next.t('eventDetails.archived', 'Archivee');
  return i18next.t('eventDetails.pending', 'En attente');
};

const formatDate = (value, options = {}) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(localeDesFormats(), options);
};

const formatDateTimeLabel = (value) => formatDate(value, {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'long',
  year: 'numeric',
});

const formatTimeLabel = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.slice(0, 5);
};

const getUserDisplayName = (user) => `${String(user?.firstname || '').trim()} ${String(user?.lastname || '').trim()}`.trim() || i18next.t('eventDetails.member', 'Membre');

const getAvatarUrl = (user) => getImageUrl(user?.avatar?.url || '');

const getInitials = (value) => String(value || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase() || '')
  .join('');

const normalizeTypeName = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function EventDetails({ navigation, route }) {
  const { t } = useTranslation();
  const { eventId } = route?.params || {};
  const highlightedSection = route?.params?.focusSection || null;
  const fromEventCreation = Boolean(route?.params?.fromEventCreation);
  const creationCelebration = route?.params?.creationCelebration || null;
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = width >= BREAKPOINTS.tablet;
  const queryClient = useQueryClient();
  const {
    Colors,
  } = useTheme();
  const {
    canManageEvent,
    userData,
  } = useAuth();
  const {
    data: event,
    error,
    isLoading,
    refetch,
  } = useGetEvent(eventId || '', {
    refetchOnMount: fromEventCreation ? 'always' : false,
    staleTime: fromEventCreation ? 0 : undefined,
  });
  // LIENS-EVENEMENT : un lien partage peut viser un evenement supprime (404). Ce n'est
  // pas une panne : pas de « Chargement impossible », pas de « Recharger » dans le vide.
  // Temoin : web/tests/smoke/event-link.spec.ts.
  const isEventGone = getErrorStatus(error) === 404;
  const {
    data: myParticipationPages,
  } = useGetEventParticipations(eventId || '', userData?.documentId, {
    includeInactive: true,
    pageSize: 20,
  }, {
    enabled: Boolean(eventId && userData?.documentId),
  });
  const [isSharing, setIsSharing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isTrainingSettingsVisible, setIsTrainingSettingsVisible] = useState(false);
  const [trainingOpenLimitDraft, setTrainingOpenLimitDraft] = useState('');
  const creationCelebrationShownRef = useRef(false);

  useEffect(() => {
    if (!fromEventCreation || !eventId) return undefined;

    const refreshTimeout = setTimeout(() => {
      refetch();
    }, 450);

    return () => clearTimeout(refreshTimeout);
  }, [eventId, fromEventCreation, refetch]);

  useEffect(() => {
    const resolvedCreationCelebration = creationCelebration || (
      event
        ? {
          actionKey: 'event_created',
          payload: {
            eventId,
            eventName: event?.name || event?.description || '',
            teamId: event?.team?.documentId || null,
          },
        }
        : null
    );

    if (!fromEventCreation || !resolvedCreationCelebration || creationCelebrationShownRef.current) {
      return undefined;
    }

    let celebrationDelay = null;
    const task = setTimeout(() => {
      celebrationDelay = setTimeout(() => {
        celebrate(
          resolvedCreationCelebration?.actionKey || 'event_created',
          resolvedCreationCelebration?.payload || {},
        );
        creationCelebrationShownRef.current = true;
      }, 220);
    }, 0);

    return () => {
      clearTimeout(task);
      if (celebrationDelay) {
        clearTimeout(celebrationDelay);
      }
    };
  }, [creationCelebration, event, eventId, fromEventCreation]);

  const myParticipations = useMemo(
    () => flattenPages(myParticipationPages?.pages),
    [myParticipationPages?.pages],
  );

  const participationState = useMemo(() => getCurrentUserEventParticipationState({
    missings: event?.missings || [],
    participationRequests: myParticipations.length > 0 ? myParticipations : event?.participationRequests || [],
    participations: event?.participations || [],
    user: userData,
  }), [event?.missings, event?.participationRequests, event?.participations, myParticipations, userData]);

  const canEdit = Boolean(canManageEvent(event));
  const hasEvent = Boolean(event);
  const trainingOpenConfig = useMemo(() => resolveTrainingOpenConfig(event || {}), [event]);
  const canManageTrainingVisibility = Boolean(canEdit && trainingOpenConfig.isTraining);
  const supportsEventComposition = Boolean(event?.team?.documentId || (event?.invitedTeams || []).length > 0);
  const isTeamMember = useMemo(() => {
    const userDocumentId = userData?.documentId;
    if (!userDocumentId) return false;
    const teams = [event?.team, ...(Array.isArray(event?.invitedTeams) ? event.invitedTeams : [])].filter(Boolean);
    return teams.some((team) => (
      Array.isArray(team?.players) && team.players.some((player) => player?.documentId === userDocumentId)
    ) || (
      Array.isArray(team?.trainers) && team.trainers.some((trainer) => trainer?.documentId === userDocumentId)
    ));
  }, [event?.invitedTeams, event?.team, userData?.documentId]);
  const canViewPublishedComposition = useMemo(() => {
    const effectiveStatus = String(participationState?.effectiveStatus || '').trim().toLowerCase();
    return canEdit || isTeamMember || effectiveStatus === 'accepted' || effectiveStatus === 'missing';
  }, [canEdit, isTeamMember, participationState?.effectiveStatus]);
  // AD02 — la page d'un evenement est PUBLIQUE sur le site (arbitrage d'Adel :
  // `web/src/routes/screenRegistry.tsx` la declare `access: 'public'`), donc un
  // inconnu y arrive par un simple lien de partage.
  //
  // AD11 — decision D20 d'Adel du 2026-08-22 (DEROGATIONS.md) : « visible veut
  // dire public, c'est le choix de l'organisateur ». Elle remplace Q14=A du
  // 20/08. Seul le REGLAGE DE L'EVENEMENT decide donc qui lit les noms — avoir
  // un compte n'entre plus dans cette question-la.
  //
  // UNE SEULE regle pour les TROIS surfaces nominatives de cet ecran
  // (participants, absences/manques, taches confiees) : deux conditions qui se
  // ressemblent finiraient par raconter deux histoires le jour ou l'une bouge.
  const isSignedIn = Boolean(userData?.documentId);
  const canViewParticipantNames = event?.participantIdentitiesHidden !== true;
  // ⚠️ Deux questions differentes, ne jamais les fusionner. `isSignedIn` =
  // « cette personne peut-elle AGIR ? » et commande le bouton de participation
  // (AD02). `canViewParticipantNames` = « a-t-elle le droit de lire QUI
  // vient ? » et ne depend QUE du reglage de l'organisateur (D20).
  const compositionTeamId = useMemo(() => {
    const teams = [event?.team, ...(Array.isArray(event?.invitedTeams) ? event.invitedTeams : [])].filter(Boolean);
    if (!teams.length) return null;

    const userDocumentId = userData?.documentId;
    const trainedTeamIds = new Set((userData?.trainedTeams || []).map((team) => team?.documentId).filter(Boolean));
    const managedTeam = teams.find((team) => trainedTeamIds.has(team?.documentId))
      || teams.find((team) => Array.isArray(team?.trainers) && team.trainers.some((trainer) => trainer?.documentId === userDocumentId));
    if (managedTeam?.documentId) return managedTeam.documentId;

    const playerTeam = teams.find((team) => Array.isArray(team?.players) && team.players.some((player) => player?.documentId === userDocumentId));
    if (playerTeam?.documentId) return playerTeam.documentId;

    return teams[0]?.documentId || null;
  }, [event?.invitedTeams, event?.team, userData?.documentId, userData?.trainedTeams]);
  const compositionEditorTeam = useMemo(() => {
    const teams = [event?.team, ...(Array.isArray(event?.invitedTeams) ? event.invitedTeams : [])].filter(Boolean);
    return teams.find((team) => team?.documentId === compositionTeamId) || event?.team || null;
  }, [compositionTeamId, event?.invitedTeams, event?.team]);
  const isReservation = normalizeTypeName(event?.type?.name).includes('reservation');
  const isTournamentEvent = normalizeTypeName(event?.type?.name).includes('tournoi');
  // D48 : le board decide d'apres cette etiquette s'il propose les commandes de
  // la detection (D44). Le telephone la transmet depuis EventDetails.js:3197 ;
  // le site ne la calculait meme pas. On passe par le helper PARTAGE plutot que
  // par le `normalizeTypeName` local — les deux normalisent a l'identique, mais
  // seul le helper garantit que les deux surfaces resteront d'accord.
  const isDetectionEvent = isDetectionEventType(event?.type?.name);

  // ==========================================================================
  // P9 · ECRAN 1 — LA PORTE D ENTREE DE L APPEL, SUR LE SITE (miroir de N5).
  //
  // 🪞 CE BLOC N INVENTE AUCUNE REGLE, IL IMPORTE CELLES DU TELEPHONE :
  // `resolveEventAttendanceGate`, `resolveAttendanceWindow`, `resolveCallMode`
  // et `EventNextActionCard` sont les modules de `EventDetails.js`, servis ici
  // par react-native-web. Les recopier aurait pose un SECOND juge sur le meme
  // etat, qui divergerait au premier changement de regle — c est exactement le
  // defaut que P9 repare (D08, D22, D40, D48, et le gate elargi en ce moment).
  //
  // ⛔ L HORLOGE QUI DECIDE EST CELLE DU SERVEUR, jamais celle du navigateur.
  // Sans `serverNow`, `resolveCallMode` repond `before` : la porte se VOIT mais
  // ne s ouvre pas. C est le seul etat honnete — l ouvrir sur l heure du poste
  // la rendrait cliquable alors que le serveur refuse ensuite ligne par ligne.
  // ==========================================================================

  // 🧭 LE TELEPHONE ECARTE ICI LES ENTRAINEURS de la liste des participants
  // (`trainerKeysForEvent`, EventDetails.js:1154). Cette soustraction n est PAS
  // recopiee, et ce n est pas un oubli : elle ne peut pas changer la reponse du
  // gate. Pour qu elle retire quelqu un, il faut qu un entraineur de l equipe
  // porte le meme `documentId` que le lecteur — or c est exactement ce qui rend
  // `isTeamMember` vrai, et le gate est un OU. Elle ne sert la-bas qu au second
  // drapeau (`canSelfMarkArrival`), que cette carte n emploie pas.
  const isCurrentUserParticipating = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return false;
    return (event?.participations || []).some(
      (participant) => participant?.documentId === currentUserId,
    );
  }, [event?.participations, userData?.documentId]);
  const { canAccessAttendance } = useMemo(
    () => resolveEventAttendanceGate({ canEdit, isCurrentUserParticipating, isTeamMember }),
    [canEdit, isCurrentUserParticipating, isTeamMember],
  );
  const {
    data: attendancePayload,
    isError: isAttendanceError,
  } = useGetEventAttendance(eventId || '', {
    enabled: Boolean(eventId && canAccessAttendance),
  });

  // ⏱️ L instant du serveur AVANCE, sinon la porte resterait fermee jusqu au
  // prochain rechargement de la page pour qui attend l heure d ouverture. Meme
  // mecanique que le telephone (EventDetails.js:1263-1273) : un pas de 30 s,
  // remis a zero des que le serveur redonne son instant.
  const [elapsedSinceServerNowMs, setElapsedSinceServerNowMs] = useState(0);

  useEffect(() => {
    setElapsedSinceServerNowMs(0);
  }, [attendancePayload?.data?.serverNow]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setElapsedSinceServerNowMs((previous) => previous + 30000);
    }, 30000);

    return () => clearInterval(timerId);
  }, []);

  const serverClockMs = useMemo(
    () => resolveServerClockMs({
      elapsedMs: elapsedSinceServerNowMs,
      serverNowIso: attendancePayload?.data?.serverNow,
    }),
    [attendancePayload?.data?.serverNow, elapsedSinceServerNowMs],
  );
  const attendanceCallWindow = useMemo(
    () => resolveAttendanceWindow({ event, payloadData: attendancePayload?.data }),
    [attendancePayload?.data, event],
  );
  // D5 du telephone : sans charge d appel, la carte se montre pour que
  // l organisateur VOIE la porte, mais elle ne s ouvre pas.
  // 🕰️ FINITIONS4 (D7) — comme le telephone : elle CHARGE, sans heure inventee ;
  // une charge en erreur ne montre pas de carte.
  const nextActionMode = useMemo(() => {
    if (!attendancePayload?.data) return isAttendanceError ? 'unavailable' : 'loading';

    return resolveCallMode({ serverNowMs: serverClockMs, window: attendanceCallWindow });
  }, [attendanceCallWindow, attendancePayload?.data, isAttendanceError, serverClockMs]);
  // « N attendus » = l audience entiere. `null` quand la charge n est pas la :
  // on ne dit pas « 0 attendu » a la place de « je ne sais pas ».
  const nextActionExpectedCount = useMemo(() => {
    const items = attendancePayload?.data?.items;

    return Array.isArray(items) ? items.length : null;
  }, [attendancePayload?.data?.items]);
  const nextActionOpensAtLabel = formatTimeInZone(
    attendanceCallWindow.opensAtMs,
    attendancePayload?.data?.timezone,
  );
  const openAttendanceCall = useCallback(() => {
    navigation.navigate(RouteNames.EventAttendanceCall, { eventId });
  }, [eventId, navigation]);
  // Le telephone ajoute `showOverviewTab` a cette condition : le site n a pas
  // d onglets, sa page EST l Apercu. Les trois autres sont celles de N5
  // (EventDetails.js:4747), mot pour mot.
  // POINTAGE (29/09) — « Suivre les arrivees » decochee : pas d appel.
  const showNextActionCard = canEdit && canAccessAttendance && !isTournamentEvent
    && isArrivalTrackingEnabled(event);

  // 🙋 POINTAGE — LES MEMES REGLES QUE LE TELEPHONE (`domains/event/presenceRule.js`).
  // Un MEMBRE convie ne « demande » pas a participer : il repond. Reponses
  // decochees = pas de bouton ; apres coup, le « pas renseigne » passe present
  // par la route des reponses (le serveur ne l ouvre qu a lui).
  const isConvenedMember = Boolean(resolveClientSourceTeamForUser(event, userData));
  const monPointage = useMemo(
    () => (attendancePayload?.data?.items || [])
      .find((item) => (
        item?.user?.documentId && item.user.documentId === userData?.documentId
      )) || null,
    [attendancePayload?.data?.items, userData?.documentId],
  );
  const peutPasserPresentApresCoup = !isTournamentEvent && canDeclareLatePresence({
    event,
    hasPendingRequest: participationState?.hasPendingRequest,
    isConvenedMember,
    isMissing: participationState?.isMissing,
    isParticipating: participationState?.isParticipating,
    myAttendanceStatus: monPointage?.attendanceStatus,
  });
  const reponsesFermeesAuMembre = isConvenedMember && !isRsvpEnabled(event);
  const afficherParticiper = !canEdit
    && !peutPasserPresentApresCoup
    && !reponsesFermeesAuMembre
    && !participationState?.isParticipating
    && !participationState?.hasPendingRequest;
  const tournamentConfig = useMemo(
    () => event?.tournamentConfig || {},
    [event?.tournamentConfig],
  );
  const tournamentTeams = useMemo(
    () => (Array.isArray(event?.tournamentTeams) ? [...event.tournamentTeams] : [])
      .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || ''))),
    [event?.tournamentTeams],
  );
  const currentUserTournamentTeam = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return null;
    return tournamentTeams.find((team) => Array.isArray(team?.members) && team.members.some((member) => (
      member?.user?.documentId === currentUserId
      && isTournamentActiveMemberStatus(member?.responseStatus)
    ))) || null;
  }, [tournamentTeams, userData?.documentId]);
  const currentUserPendingTournamentTeam = useMemo(
    () => getTournamentPendingMembershipForUser(tournamentTeams, userData?.documentId || ''),
    [tournamentTeams, userData?.documentId],
  );
  const managedTournamentTeam = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return null;
    return tournamentTeams.find((team) => (
      team?.captainUser?.documentId === currentUserId
      || (team?.adminUsers || []).some((adminUser) => adminUser?.documentId === currentUserId)
    )) || null;
  }, [tournamentTeams, userData?.documentId]);
  const registeredTournamentSourceTeamIds = useMemo(
    () => new Set(
      tournamentTeams
        .map((team) => team?.sourceTeam?.documentId)
        .filter(Boolean),
    ),
    [tournamentTeams],
  );
  const availableTournamentSourceTeams = useMemo(
    () => (userData?.trainedTeams || [])
      .filter((team) => team?.documentId && !registeredTournamentSourceTeamIds.has(team.documentId)),
    [registeredTournamentSourceTeamIds, userData?.trainedTeams],
  );
  const canCreateCustomTournamentTeam = Boolean(
    isTournamentEvent
    && event?.tournamentConfig?.allowCustomTeams !== false
    && userData?.documentId
    && !currentUserTournamentTeam
    && !currentUserPendingTournamentTeam,
  );
  const canRegisterTournamentSourceTeam = Boolean(
    isTournamentEvent
    && !currentUserTournamentTeam
    && !currentUserPendingTournamentTeam
    && availableTournamentSourceTeams.length > 0,
  );
  const tournamentTeamCounters = useMemo(
    () => getTournamentStatusCounters(tournamentTeams, tournamentConfig),
    [tournamentConfig, tournamentTeams],
  );
  const facilityId = getEntityDocumentId(event?.facility);
  const eventLink = buildPublicEventUrl({ eventId });
  const participationLabel = getParticipationLabel(
    participationState?.effectiveStatus,
  );
  const compositionSport = useMemo(
    () => compositionEditorTeam?.activities?.[0]?.name || event?.team?.activities?.[0]?.name || 'football',
    [compositionEditorTeam?.activities, event?.team?.activities],
  );
  // Y02 — meme regle que la version native : un match dont on connait
  // l'adversaire s'appelle « Match vs X », tout le reste garde son nom d'avant.
  // ⚠️ Les deux ecrans doivent dire la MEME chose : c'est ce nom que porte la
  // carte de compo envoyee dans le tchat, lisible depuis les deux.
  const compositionEventLabel = useMemo(
    () => resolveEventDisplayName(event, 'Evenement'),
    [event],
  );

  // ==========================================================================
  // P9 · ECRAN 2 — LA CARTE-PARCOURS « APRES LE MATCH » (miroir de N4).
  //
  // 🪞 Meme principe que l ecran 1 : `PostMatchJourneyCard` est le composant du
  // telephone, servi tel quel. Il recoit des FAITS et rend un dessin — c est LUI
  // qui decide de l etape courante (`resoudreLeParcours`), pas ce fichier.
  //
  // 🧭 LA CARTE SE MONTRE AVANT LA FIN DU MATCH, et c est VOLONTAIRE : elle
  // annonce ce qui vient. C est la condition de EventDetails.js:6912 reprise
  // telle quelle — y mettre « match termine » serait un contresens.
  // ==========================================================================
  const isMatchEvent = normalizeTypeName(event?.type?.name).includes('match');
  // ⛔ LE DEBUT VIENT DU SERVEUR, IL NE SE DEDUIT PAS DE `event.date` : quand la
  // date est a minuit et que l heure vit dans `startTime`, la deduction placerait
  // la fin du match a 02:00 et ouvrirait l apres-match AVANT le coup d envoi
  // (lecon AC10). Le telephone repare ce cas avec un helper local
  // (EventDetails.js:555) que ce fichier n a pas. Sans debut serveur la fin reste
  // inconnue, `resolveIsMatchFinished` repond NON, et la porte reste fermee :
  // l erreur va donc toujours dans le sens sur.
  const eventEndedAt = useMemo(
    () => resolveEventEndedAt(event?.endDate, attendancePayload?.data?.eventStartAt),
    [attendancePayload?.data?.eventStartAt, event?.endDate],
  );
  const isMatchFinished = useMemo(
    () => resolveIsMatchFinished({ eventEndedAt, serverNowMs: serverClockMs }),
    [eventEndedAt, serverClockMs],
  );
  // 🏁 FINITIONS4 (D6, recette du 29/09) — LA REGLE DU TELEPHONE
  // (`EventParticipants.js`) : quand une reponse n est plus attendue (« Les
  // participants repondent » decochee, ou evenement termine), « Sans réponse »
  // devient « pas renseigné », un seul mot ; reponses decochees, les groupes
  // Present / Absent vides et leurs messages disparaissent.
  const reponsesOuvertes = isRsvpEnabled(event);
  const libelleSansReponse = reponsesOuvertes && !isMatchFinished
    ? t('eventDetails.participationStatus.notAnswered', 'Sans réponse')
    : t('eventDetails.attendanceBadge.notReported', 'Pas renseigné');
  const {
    data: matchStatsPayload,
    isFetching: isMatchStatsFetching,
  } = useGetEventMatchStats(eventId || '', compositionTeamId || undefined, {
    enabled: Boolean(eventId && isMatchEvent && compositionTeamId && (canEdit || isTeamMember)),
  });
  const matchStatsReport = matchStatsPayload?.report || null;
  const playerCollectiveRating = matchStatsPayload?.playerCollectiveRating || null;
  const isMatchStatsFinal = matchStatsReport?.status === 'final';
  const isMatchStatsReviewRequired = Boolean(matchStatsReport?.needsReview);
  const canViewMatchStats = Boolean(matchStatsPayload?.permissions?.canView || isTeamMember);
  const canManageMatchStats = Boolean(matchStatsPayload?.permissions?.canManage);
  const matchStatsScoreLabel = useMemo(() => {
    const score = matchStatsPayload?.score;
    if (!score?.available) return t('eventDetails.scoreToComplete', 'Score à compléter');

    return `${score.scoreFor ?? '-'} - ${score.scoreAgainst ?? '-'}`;
  }, [matchStatsPayload?.score, t]);

  // 🚪 LA PORTE DE LA CARTE : ouverte ou fermee, et POURQUOI quand elle est
  // fermee. L ordre des branches suit celui du telephone
  // (EventDetails.js:3596), a UNE difference pres, nommee plus bas.
  //
  // 🧾 Seules les branches FERMEES portent une phrase, et ce n est pas un
  // oubli : la carte ne dessine le motif que porte close
  // (`boutonDesactive && motif`). Les etats ouverts du telephone ont bien un
  // sous-titre, mais il n est JAMAIS affiche — le recopier ici aurait ajoute du
  // texte que personne ne lit, et un second juge a maintenir.
  const postMatchAction = useMemo(() => {
    if (!isMatchFinished) {
      return {
        disabled: true,
        subtitle: t(
          'eventDetails.statsWillBeAvailableAt',
          'Les stats seront disponibles à la fin du match.',
        ),
      };
    }
    if (matchStatsPayload?.score?.waitingOfficial) {
      return {
        disabled: true,
        subtitle: t(
          'eventDetails.waitingForTheSyncedOfficial',
          'En attente du score officiel synchronise.',
        ),
      };
    }
    // ⛔ LA DIFFERENCE ANNONCEE — L ETAPE « SCORE » N A PAS DE DESTINATION ICI.
    // Le telephone l ouvre dans une feuille (`openMatchScoreSheet`) que ce
    // fichier n a pas. Un bouton qui ne ferait RIEN serait un menteur : il
    // rendrait la main sans avoir rien ecrit. La porte se ferme donc, et elle
    // DIT ou aller. Ce test passe AVANT les suivants pour tenir une regle
    // simple : quand le parcours designe l etape 1, la porte est close.
    // Voie de sortie : un ecran de saisie du score au registre web.
    if (!matchStatsPayload?.score?.available) {
      return {
        disabled: true,
        subtitle: t(
          'eventDetails.theScoreIsSavedFrom',
          'Le score s’enregistre depuis l’application mobile.',
        ),
      };
    }
    // 🔒 SECU-STATS — UN TEST LE PRECEDAIT ET ROUVRAIT LA PORTE : « un rapport
    // publie ou a re-verifier se RELIT toujours, meme sans le droit de le
    // gerer ». Mais la relecture, c est `MatchStatsEditor`, l outil de
    // l encadrement : il affiche l avis du coach et l auto-evaluation de CHAQUE
    // joueur. Un joueur n y entre plus ; il garde sa reponse sur le telephone.
    if (!canManageMatchStats) {
      return {
        disabled: true,
        subtitle: isMatchStatsFinal
          ? t('eventDetails.reportFinalised', 'Rapport finalise')
          : t(
            'eventDetails.yourTeamMembersCanStill',
            'Les membres de ton équipe peuvent encore finaliser ce rapport.',
          ),
      };
    }

    return { disabled: false, subtitle: '' };
  }, [
    canManageMatchStats,
    isMatchFinished,
    isMatchStatsFinal,
    matchStatsPayload?.score?.available,
    matchStatsPayload?.score?.waitingOfficial, t,
  ]);
  const openMatchStatsEditor = useCallback(() => {
    // 🔒 SECU-STATS — la seconde couche. La carte, la rangee du menu et l invite
    // passent toutes par ici : sans le droit de gerer, l editeur ne s ouvre pas.
    if (!eventId || !compositionTeamId || !canManageMatchStats) return;

    navigation.navigate(RouteNames.MatchStatsEditor, {
      eventId,
      sourceType: 'event',
      sport: matchStatsPayload?.sport || compositionSport,
      teamId: compositionTeamId,
      teamName: compositionEditorTeam?.name || matchStatsPayload?.team?.name || null,
      title: t('eventDetails.teamReport', 'Bilan équipe'),
    });
  }, [
    canManageMatchStats,
    compositionEditorTeam?.name,
    compositionSport,
    compositionTeamId,
    eventId,
    matchStatsPayload?.sport,
    matchStatsPayload?.team?.name,
    navigation, t,
  ]);
  const isPostMatchDoorClosed = Boolean(postMatchAction.disabled || isMatchStatsFetching);
  // Comme pour l ecran 1, `showOverviewTab` tombe : le site n a pas d onglets.
  const showPostMatchCard = Boolean(isMatchEvent && compositionTeamId && canViewMatchStats);
  const {
    data: staffCompositionPayload,
    isFetching: isStaffCompositionFetching,
  } = useGetEventTeamComposition(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(eventId && compositionTeamId && supportsEventComposition && canEdit),
    },
  );
  const {
    data: convocationPayload,
  } = useGetEventConvocation(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(eventId && compositionTeamId && supportsEventComposition && canViewPublishedComposition),
    },
  );
  const convocationBranches = useMemo(() => {
    if (Array.isArray(convocationPayload?.branches)) return convocationPayload.branches;
    if (convocationPayload?.published) {
      return [{
        published: convocationPayload.published,
        team: convocationPayload?.team || { documentId: compositionTeamId, name: compositionEditorTeam?.name || null },
        viewer: { inReserve: false, teamEntryIds: [] },
      }];
    }
    return [];
  }, [compositionEditorTeam?.name, compositionTeamId, convocationPayload?.branches, convocationPayload?.published, convocationPayload?.team]);
  const publishedCompositionTeamCount = useMemo(
    () => convocationBranches.reduce((total, branch) => total + (Array.isArray(branch?.published?.teams) ? branch.published.teams.length : 0), 0),
    [convocationBranches],
  );
  const publishedCompositionReserveCount = useMemo(
    () => convocationBranches.reduce((total, branch) => total + (Array.isArray(branch?.published?.reservePlayerIds) ? branch.published.reservePlayerIds.length : 0), 0),
    [convocationBranches],
  );
  // 🥇 AC08 — LE SITE SUIT LE TELEPHONE. `web` compile PHYSIQUEMENT les sources
  // de `app`, mais un fichier `.web.js` REMPLACE son jumeau : ne poser la porte
  // que dans `EventDetails.js` laisserait ici un appelant frere casse — le motif
  // a deja coute 4 correctifs (D08, D22, D40, D48).
  const viewerConvocationRole = useMemo(
    () => getViewerConvocationRole(convocationPayload, userData?.documentId || userData?.id),
    [convocationPayload, userData?.documentId, userData?.id],
  );
  const compositionEligiblePlayerCount = Array.isArray(staffCompositionPayload?.eligiblePlayers)
    ? staffCompositionPayload.eligiblePlayers.length
    : 0;
  const handleManageComposition = useCallback(() => {
    if (!eventId || !compositionTeamId) return;

    if (isStaffCompositionFetching) {
      window.alert(t(
        'eventDetails.theTeamLineUpIs',
        "La composition d'équipes est encore en cours de chargement.",
      ));
      return;
    }

    const openBoard = (composition, options = {}) => {
      // C-A — LA PORTE DES 4 ECRANS NEUFS SUR LE SITE.
      //
      // Les routes du pack composition existent et sont montees depuis D77/D79,
      // mais le site envoyait TOUJOURS vers l'ancien terrain : on ne pouvait les
      // atteindre qu'en tapant l'URL. La condition est celle du fichier natif
      // (EventDetails.js:3232), a l'identique — une divergence entre les deux
      // jumeaux vit indefiniment, aucune porte de `app` ne la voit.
      //
      // C-E (🚪) — LA PORTE DES 3 ECRANS DE DETECTION, SUR LE SITE AUSSI.
      // Le lot C-D a livre les ecrans 13, 14 et 15 ; rien n'y menait. La regle
      // est identique a celle du natif (`EventDetails.js`), volontairement :
      // une divergence entre les deux jumeaux vit indefiniment, aucune porte de
      // `app` ne la voit. La LECTURE SEULE reste sur l'ancien terrain des deux
      // cotes — elle ne compose pas, c'est le lot C-F qui la reprendra.
      const canComposeNow = Boolean(options.canEdit) && !options.readOnly;
      let compositionRoute = RouteNames.TacticalBoardV2;
      if (canComposeNow) {
        compositionRoute = isDetectionEvent
          ? RouteNames.DetectionSquadSetup
          : RouteNames.MatchCallUpSelection;
      }

      navigation.navigate(compositionRoute, {
        aggregateBranches: Array.isArray(options.aggregateBranches) ? options.aggregateBranches : undefined,
        canEdit: Boolean(options.canEdit),
        // COMPO-WEB — le club et la categorie voyagent comme sur le telephone
        // (renforts du club a l'ecran 1, format du terrain a l'ecran 4).
        clubId: event?.team?.club?.documentId || null,
        compositionIntent: options.compositionIntent || null,
        editorMode: 'event',
        editorSource: options.editorSource || null,
        editorSourceLabel: options.editorSourceLabel || null,
        eventId,
        eventKind: isDetectionEvent ? 'detection' : 'match',
        eventName: compositionEventLabel,
        eventTypeLabel: event?.type?.name || null,
        existingComposition: composition,
        multiTeamComposition: true,
        players: Array.isArray(options.players) ? options.players : (Array.isArray(staffCompositionPayload?.eligiblePlayers) ? staffCompositionPayload.eligiblePlayers : []),
        readOnly: Boolean(options.readOnly),
        sport: composition?.sportContext || compositionSport,
        teamCategory: compositionEditorTeam?.category?.name
          || compositionEditorTeam?.category
          || null,
        teamComposition: options.teamComposition || staffCompositionPayload || null,
        teamId: compositionTeamId,
        teamName: compositionEditorTeam?.name || staffCompositionPayload?.team?.name || null,
      });
    };

    if (staffCompositionPayload?.draft) {
      openBoard(staffCompositionPayload.draft, {
        canEdit: true,
        compositionIntent: staffCompositionPayload?.draft?.mode || 'manual',
        editorSource: 'draft',
        editorSourceLabel: 'Brouillon',
        readOnly: false,
      });
      return;
    }

    if (staffCompositionPayload?.published) {
      openBoard(staffCompositionPayload.published, {
        canEdit: true,
        compositionIntent: staffCompositionPayload?.published?.mode || 'manual',
        editorSource: 'published',
        editorSourceLabel: t('eventDetails.teamLineUpPublished', "Composition d'équipes publiée"),
        players: Array.isArray(staffCompositionPayload?.published?.snapshotPlayers) ? staffCompositionPayload.published.snapshotPlayers : [],
        readOnly: false,
      });
      return;
    }

    // COMPO-WEB — COMME LE TELEPHONE (C-E, `EventDetails.js`) : plus de fenetre
    // « Creation auto / a la main » avant d'ouvrir. Elle interrompait le coach du
    // site avec un OK/Annuler du navigateur, pour une question que l'ecran
    // suivant pose lui-meme (la selection, ou l'ecran 13 d'une detection).
    openBoard(staffCompositionPayload?.bootstrap?.composition || null, {
      canEdit: true,
      compositionIntent: 'manual',
      editorSource: staffCompositionPayload?.bootstrap?.source || 'empty',
      editorSourceLabel: 'Nouvelle composition',
      readOnly: false,
    });
  }, [
    compositionEditorTeam?.category,
    compositionEditorTeam?.name,
    compositionEventLabel,
    compositionSport,
    compositionTeamId,
    event?.team?.club?.documentId,
    event?.type?.name,
    eventId,
    isDetectionEvent,
    isStaffCompositionFetching,
    navigation,
    staffCompositionPayload, t,
  ]);

  // 🚪 COMPO-WEB — LA PORTE « CONVOCATION PUBLIEE » DE L'ENTRAINEUR, SUR LE SITE.
  //
  // Sur le site, l'entraineur n'avait que l'ANCIEN terrain en lecture seule
  // (« Voir la composition publiee ») : AUCUN chemin vers les reponses de ses
  // convoques, la relance, ni « Remplacer » un desistement. Ces deux gestes sont
  // le miroir d'`openPublishedConvocation` et d'`openCompositionEdit`
  // (`EventDetails.js`) : le terrain en consultation (qui porte « Voir la
  // convocation et les reponses »), sinon directement l'ecran des reponses.
  // ♻️ Le terrain a rouvrir vient du helper PARTAGE `buildPublishedBoardTarget`
  // (carte du fil, « Tu es convoque ») — aucune regle recopiee. Meme garde que le
  // telephone : UN seul terrain dessinable, sinon pas de terrain.
  const compositionEligiblePlayers = Array.isArray(staffCompositionPayload?.eligiblePlayers)
    ? staffCompositionPayload.eligiblePlayers
    : null;
  const publishedBoardTarget = useMemo(() => {
    const dessinables = convocationBranches
      .map((branch) => buildPublishedBoardTarget(branch?.published, {
        sport: compositionSport,
        teamName: branch?.team?.name || compositionEditorTeam?.name || '',
      }))
      .filter(Boolean);
    return dessinables.length === 1 ? dessinables[0] : null;
  }, [compositionEditorTeam?.name, compositionSport, convocationBranches]);

  const openPublishedConvocation = useCallback(() => {
    if (!eventId || !compositionTeamId) return;
    if (publishedBoardTarget) {
      navigation.navigate(RouteNames.MatchCompositionBoard, {
        ...publishedBoardTarget,
        canEdit: true,
        clubId: event?.team?.club?.documentId || null,
        eventId,
        eventLabel: compositionEventLabel,
        eventTypeLabel: event?.type?.name || null,
        // La liste ou « Modifier » ira repecher des convoques : l'effectif eligible.
        players: compositionEligiblePlayers || publishedBoardTarget.selectedPlayers,
        readOnly: true,
        teamId: compositionTeamId,
      });
      return;
    }
    navigation.navigate(RouteNames.MatchConvocationPublished, {
      clubId: event?.team?.club?.documentId || null,
      eventId,
      eventLabel: compositionEventLabel,
      sport: compositionSport,
      teamId: compositionTeamId,
      teamName: compositionEditorTeam?.name || null,
    });
  }, [
    compositionEditorTeam?.name,
    compositionEligiblePlayers,
    compositionEventLabel,
    compositionSport,
    compositionTeamId,
    event?.team?.club?.documentId,
    event?.type?.name,
    eventId,
    navigation,
    publishedBoardTarget,
  ]);

  const openCompositionEdit = useCallback(() => {
    if (!eventId || !compositionTeamId || !publishedBoardTarget) return;
    navigation.navigate(RouteNames.MatchCallUpSelection, {
      ...publishedBoardTarget,
      canEdit: true,
      clubId: event?.team?.club?.documentId || null,
      eventId,
      eventLabel: compositionEventLabel,
      eventName: compositionEventLabel,
      eventTypeLabel: event?.type?.name || null,
      players: compositionEligiblePlayers || publishedBoardTarget.selectedPlayers,
      readOnly: false,
      teamId: compositionTeamId,
    });
  }, [
    compositionEligiblePlayers,
    compositionEventLabel,
    compositionTeamId,
    event?.team?.club?.documentId,
    event?.type?.name,
    eventId,
    navigation,
    publishedBoardTarget,
  ]);

  // 🗣️ COMPO-WEB — LE RESUME DE LA CONVOCATION PUBLIEE, avec les MEMES clefs et
  // les memes pluriels que le telephone (FINITIONS du 28/09) : le site ecrivait
  // encore « 1 equipe(s) publiee(s) » et « 1 {{count}} convocations ».
  const publishedCompositionSummary = [
    publishedCompositionTeamCount > 0 ? t('eventDetails.teamSPublished', {
      count: publishedCompositionTeamCount,
      defaultValue_one: '{{count}} équipe publiée',
      defaultValue_other: '{{count}} équipes publiées',
    }) : t('eventDetails.lineUpPublished', 'Composition publiée'),
    convocationBranches.length > 1 ? t('eventDetails.visibleBranchEs', {
      count: convocationBranches.length,
      defaultValue_one: '{{count}} convocation',
      defaultValue_other: '{{count}} convocations',
    }) : '',
    publishedCompositionReserveCount > 0 ? t('eventDetails.substitutesCount', {
      count: publishedCompositionReserveCount,
      defaultValue_one: '{{count}} remplaçant',
      defaultValue_other: '{{count}} remplaçants',
    }) : '',
  ].filter(Boolean);

  useEffect(() => {
    if (!trainingOpenConfig.isTraining) return;
    setTrainingOpenLimitDraft(
      trainingOpenConfig.externalParticipantLimit != null
        ? String(trainingOpenConfig.externalParticipantLimit)
        : '',
    );
  }, [
    trainingOpenConfig.externalParticipantLimit,
    trainingOpenConfig.isTraining,
  ]);

  useEffect(() => {
    if (!highlightedSection || isLoading) {
      return undefined;
    }
    const frameId = window.requestAnimationFrame(() => {
      const section = document.querySelector(`[data-event-section="${highlightedSection}"]`);
      section?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [highlightedSection, isLoading]);

  const invalidateEventQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventParticipations', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] }),
      queryClient.invalidateQueries({ queryKey: ['myApplications'] }),
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] }),
    ]);
    await refetch();
  }, [eventId, queryClient, refetch]);

  const createParticipationMutation = useMutation({
    mutationFn: () => createEventParticipation({
      event: eventId,
      user: userData?.documentId || '',
    }),
    onSuccess: invalidateEventQueries,
  });

  const cancelParticipationMutation = useMutation({
    mutationFn: (requestId) => deleteEventParticipation(requestId),
    onSuccess: invalidateEventQueries,
  });
  // POINTAGE — « Je passe en present », apres coup.
  const latePresenceMutation = useMutation({
    mutationFn: () => respondToEventRsvp(eventId, 'present'),
    onSuccess: invalidateEventQueries,
  });
  const updateTrainingMutation = useMutation({
    mutationFn: (eventData) => updateEvent({ documentId: eventId, eventData }),
    onSuccess: async () => {
      setActionError('');
      setIsTrainingSettingsVisible(false);
      await invalidateEventQueries();
    },
  });
  const registerTournamentTeamMutation = useMutation({
    mutationFn: (sourceTeamId) => registerClubTeamToTournament(eventId, sourceTeamId),
    onSuccess: invalidateEventQueries,
  });
  const createTournamentTeamMutation = useMutation({
    mutationFn: (payload) => createCustomTournamentTeam(eventId, payload),
    onSuccess: invalidateEventQueries,
  });
  const reviewTournamentTeamMutation = useMutation({
    mutationFn: ({ status, teamDocumentId }) => reviewTournamentTeamRegistration(teamDocumentId, status),
    onSuccess: invalidateEventQueries,
  });

  const activeParticipationRequestId = getEntityDocumentId(participationState?.activeRequest);
  const heroImage = getImageUrl(event?.team?.club?.logo?.url || event?.team?.club?.sponsor?.logo?.url || '');
  const sectionBackground = 'rgba(6, 19, 29, 0.76)';
  const borderColor = 'rgba(255,255,255,0.08)';
  const textColor = Colors?.neutral00 || '#ffffff';
  const mutedTextColor = Colors?.neutral300 || '#adb1b2';
  const accentColor = Colors?.primary500 || '#01b3f4';
  const softTextColor = Colors?.neutral100 || '#e6eef2';
  const softSurfaceColor = 'rgba(255,255,255,0.04)';
  const pillSurfaceColor = 'rgba(255,255,255,0.06)';
  const clubCertificationPalette = getClubCertificationPalette(event?.team?.club, Colors);
  const clubCertificationLabel = getClubCertificationLabel(event?.team?.club);
  const sectionTitleStyle = {
    color: textColor,
    fontFamily: 'Montserrat-Bold, sans-serif',
    fontSize: 20,
    margin: 0,
  };
  const outlineButtonStyle = {
    background: 'transparent',
    border: `1px solid ${borderColor}`,
    borderRadius: 999,
    color: textColor,
    cursor: 'pointer',
    fontFamily: 'Montserrat-SemiBold, Montserrat-Bold, sans-serif',
    padding: '10px 16px',
  };
  const primaryButtonStyle = {
    background: accentColor,
    border: 0,
    borderRadius: 999,
    color: textColor,
    cursor: 'pointer',
    fontFamily: 'Montserrat-Bold, sans-serif',
    padding: '10px 16px',
  };

  // AD02 — un visiteur satisfait les trois conditions d'affichage du bouton
  // (pas gestionnaire, pas participant, pas de demande en attente) : il le voyait
  // donc toujours. Le bouton reste a sa place et garde `primaryButtonStyle` ;
  // seul son libelle dit la verite sur ce qu'il va faire.
  const joinButtonLabel = isSignedIn ? t(
    'eventDetails.takePart',
    'Participer',
  ) : t(
    'eventDetails.signInToTakePart',
    'Se connecter pour participer',
  );
  const statusHeadingLabel = isSignedIn ? t(
    'eventDetails.myStatus',
    'Mon statut',
  ) : t(
    'eventDetails.joinThisEvent',
    'Rejoindre cet événement',
  );
  const statusDetailLabel = (isSignedIn
    ? participationLabel
    : t('eventDetails.signInToAnswerThis', 'Connecte-toi pour répondre à cet événement.'));

  const handleJoin = useCallback(async () => {
    setActionError('');
    // AD02 — la cause racine du « bouton muet » : `createParticipationMutation`
    // part avec `user: userData?.documentId || ''`. Sans compte, la demande
    // partait donc avec un identifiant VIDE et le visiteur recevait un message
    // d'erreur technique au lieu d'une porte. On n'appelle plus le serveur du
    // tout : on ouvre le tunnel de connexion, comme le fait deja le telephone
    // (EventDetails.js:4708).
    if (!isSignedIn) {
      openPublicAuthFlow(navigation, {
        origin: RouteNames.EventDetails,
        source: 'event-details-login',
      });
      return;
    }
    try {
      await createParticipationMutation.mutateAsync();
    } catch (joinError) {
      setActionError(joinError?.message || t(
        'eventDetails.unableToJoinThisEvent',
        'Impossible de rejoindre cet événement.',
      ));
    }
  }, [createParticipationMutation, isSignedIn, navigation, t]);

  const handleCancelParticipation = useCallback(async () => {
    if (!activeParticipationRequestId) return;
    setActionError('');
    try {
      await cancelParticipationMutation.mutateAsync(activeParticipationRequestId);
    } catch (cancelError) {
      setActionError(cancelError?.message || t(
        'eventDetails.unableToCancelThisParticipation',
        'Impossible d annuler cette participation.',
      ));
    }
  }, [activeParticipationRequestId, cancelParticipationMutation, t]);

  const handleSubmitTrainingOpenConfig = useCallback(async () => {
    if (!eventId) return;

    const externalParticipantLimit = Number.parseInt(String(trainingOpenLimitDraft || '').trim(), 10);
    if (!Number.isFinite(externalParticipantLimit) || externalParticipantLimit < 1) {
      setActionError(t(
        'eventDetails.sayHowManyExternalSpots',
        'Indique combien de places externes tu veux ouvrir pour cet entraînement.',
      ));
      return;
    }

    try {
      await updateTrainingMutation.mutateAsync({
        externalParticipantLimit,
        // S11 — la seule valeur possible : le serveur force le manuel pour les
        // demandes exterieures, quoi qu'on lui envoie.
        externalParticipantValidationMode: 'manual',
        sessionStatus: 'open',
      });
    } catch (mutationError) {
      setActionError(mutationError?.message || t(
        'eventDetails.unableToOpenThisTraining2',
        "Impossible d'ouvrir cet entraînement.",
      ));
    }
  }, [
    eventId,
    trainingOpenLimitDraft,
    updateTrainingMutation, t,
  ]);

  const handleCloseTraining = useCallback(async () => {
    if (!eventId) return;

    try {
      await updateTrainingMutation.mutateAsync({
        sessionStatus: 'closed',
      });
    } catch (mutationError) {
      setActionError(mutationError?.message || t(
        'eventDetails.unableToCloseThisTraining2',
        'Impossible de fermer cet entraînement.',
      ));
    }
  }, [eventId, updateTrainingMutation, t]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const shareMessage = buildShareMessageWithUrl({
        intro: event?.name || event?.type?.name || t('eventDetails.eventFallback', 'Evenement'),
        linkLabel: t('eventDetails.seeTheFoundclubPage', 'Voir la fiche FoundClub'),
        url: eventLink,
      });
      await SharePlatform.share({
        message: shareMessage,
        title: event?.name || t('eventDetails.foundclubEvent', 'Événement FoundClub'),
        url: eventLink,
      });
    } catch (_error) {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(eventLink);
        window.alert(t(
          'eventDetails.linkCopiedToTheClipboard',
          'Lien copie dans le presse-papiers.',
        ));
      } else {
        window.alert(eventLink);
      }
    } finally {
      setIsSharing(false);
    }
  }, [event?.name, event?.type?.name, eventLink, t]);

  const handleOpenTournamentTeam = useCallback((teamDocumentId) => {
    if (!teamDocumentId) return;
    navigation.navigate(RouteNames.TournamentTeamDetails, { eventId, teamId: teamDocumentId });
  }, [eventId, navigation]);

  const handleCreateTournamentTeam = useCallback(async () => {
    const proposedName = window.prompt(t(
      'eventDetails.tournamentTeamName',
      'Nom de l équipe tournoi',
    ));
    const trimmedName = String(proposedName || '').trim();
    if (!trimmedName) return;
    setActionError('');
    try {
      await createTournamentTeamMutation.mutateAsync({ name: trimmedName });
    } catch (mutationError) {
      setActionError(mutationError?.message || t(
        'eventDetails.unableToCreateThisTournament3',
        'Impossible de créer cette équipe tournoi.',
      ));
    }
  }, [createTournamentTeamMutation, t]);

  const handleRegisterTournamentTeam = useCallback(async () => {
    if (availableTournamentSourceTeams.length === 0) return;
    const optionsText = availableTournamentSourceTeams
      .map((team, index) => `${index + 1}. ${team?.name || t(
        'eventDetails.teamFallback',
        'Equipe',
      )}`)
      .join('\n');
    const rawChoice = window.prompt(t(
      'eventDetails.chooseATeamToRegister',
      'Choisis une équipe à inscrire :\n{{optionsText}}',
      { optionsText, ...SANS_ECHAPPEMENT },
    ));
    const choiceIndex = Number.parseInt(String(rawChoice || '').trim(), 10) - 1;
    const sourceTeam = availableTournamentSourceTeams[choiceIndex];
    if (!sourceTeam?.documentId) return;
    setActionError('');
    try {
      await registerTournamentTeamMutation.mutateAsync(sourceTeam.documentId);
    } catch (mutationError) {
      setActionError(mutationError?.message || t(
        'eventDetails.unableToRegisterThisTeam2',
        'Impossible d inscrire cette équipe.',
      ));
    }
  }, [availableTournamentSourceTeams, registerTournamentTeamMutation, t]);

  const handleReviewTournamentTeam = useCallback(async (teamDocumentId, status) => {
    setActionError('');
    try {
      await reviewTournamentTeamMutation.mutateAsync({ status, teamDocumentId });
    } catch (mutationError) {
      setActionError(mutationError?.message || t(
        'eventDetails.unableToUpdateThisTeam',
        'Impossible de mettre à jour cette équipe.',
      ));
    }
  }, [reviewTournamentTeamMutation, t]);

  // AA02 — les listes de personnes de la page web passent par le meme
  // tri que l'application mobile : `web` compile les sources de `app`, donc la
  // fonction partagee est litteralement la meme. Un compte supprime est
  // anonymise et bloque cote serveur, pas efface : sans ce tri il reste ici.
  const participants = withoutDeletedAccounts(event?.participations);
  const participationRequests = withoutDeletedAccountEntries(event?.participationRequests);
  const invitedTeams = Array.isArray(event?.invitedTeams) ? event.invitedTeams : [];
  const hasVisibleEventTasks = canViewParticipantNames
    && Array.isArray(event?.eventTasks)
    && event.eventTasks.length > 0;

  // 👥 PARTWEB (21/09) — LES MEMES LISTES QUE LE TELEPHONE : Presents, Absents,
  // Sans reponse, PAR EQUIPE.
  //
  // 📸 Le defaut : le site ne lisait que `event.participations` — ceux qui ont
  // DEJA dit « present ». L entrainement Senior d Adel affichait donc « Aucun
  // participant confirme » a cote de « Faire l appel : 15 attendus ».
  //
  // 🎯 On n ecrit AUCUNE regle ici : `buildTeamParticipationSections` est la
  // fonction que l ecran du telephone appelle (`EventDetails.js`). Memes
  // equipes, memes absents, memes entraineurs ecartes (COACH1, « 2-A » : leur
  // reponse ne compte pas dans les listes des joueurs) — et la meme
  // « Encadrement » (`staff`, ENCADRE du 22/09) ou leur reponse se voit.
  // 🧭 Les demandes viennent de l evenement lui-meme (`participationRequests`,
  // actives seulement cote serveur) ; le telephone y ajoute une liste paginee
  // dont il tire l historique des equipes retirees — le site ne l affiche pas.
  const {
    externalParticipationSection,
    teamParticipationSections,
  } = buildTeamParticipationSections({
    canEdit,
    event,
    inactiveParticipations: participationRequests.filter((request) => request?.isActive === false),
    pendingParticipations: participationRequests.filter(
      (request) => request?.isActive !== false && request?.participationStatus === 'pending',
    ),
    t,
    trainerKeys: getEventTrainerKeys(event),
  });
  const participantSections = [
    ...teamParticipationSections,
    ...(externalParticipationSection ? [externalParticipationSection] : []),
  ];
  // 🔢 « Joueurs attendus » DIT LE NOMBRE DE L APPEL. Il affichait
  // `event.totalPlayers`, un champ de saisie qui vaut 0 par defaut au schema :
  // « 0 » a cote de « 15 attendus ». Quand l evenement a des equipes, on prend
  // le nombre de la carte « Faire l appel » (le serveur) s il est la, sinon
  // l effectif des listes ci-dessus. Sans equipe, rien ne change.
  const expectedPlayersCount = teamParticipationSections.length > 0
    ? (nextActionExpectedCount ?? teamParticipationSections.reduce(
      (total, section) => total
        + section.participating.length
        + section.missing.length
        + section.pending.length
        + section.notAnswered.length,
      0,
    ))
    : null;

  // `statusLabel` : la reponse d un encadrant (ENCADRE) ; les joueurs n en ont
  // pas, leur groupe la dit deja. ⚠️ Jamais passee directement a `.map`, qui
  // glisserait l INDEX a sa place.
  const renderParticipantCard = (participant, statusLabel = '') => {
    const displayName = getUserDisplayName(participant);
    const avatarUrl = getAvatarUrl(participant);
    return (
      <div
        key={getEntityDocumentId(participant) || displayName}
        style={{
          alignItems: 'center',
          background: softSurfaceColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 16,
          display: 'flex',
          gap: 12,
          padding: '12px 14px',
        }}
      >
        {avatarUrl ? (
          <img
            alt={displayName}
            src={avatarUrl}
            style={{
              borderRadius: '50%', height: 42, objectFit: 'cover', width: 42,
            }}
          />
        ) : (
          <div style={{
            alignItems: 'center', background: 'rgba(1,179,244,0.16)', borderRadius: '50%', display: 'inline-flex', height: 42, justifyContent: 'center', width: 42,
          }}
          >
            {getInitials(displayName)}
          </div>
        )}
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>{displayName}</span>
          {statusLabel ? (
            <span style={{ color: mutedTextColor, fontSize: 12 }}>{statusLabel}</span>
          ) : null}
        </div>
      </div>
    );
  };

  // Un groupe d une section : son titre compte ses gens (« Sans réponse · 15 »,
  // la forme des pastilles du telephone), et un groupe vide DIT qu il est vide.
  const renderParticipantGroup = (statusKey, title, people, emptyMessage) => (
    <div
      data-testid={`PARTWEB-groupe-${statusKey}`}
      key={statusKey}
      style={{ display: 'grid', gap: 10 }}
    >
      <span style={{ color: accentColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}>
        {`${title} · ${people.length}`}
      </span>
      {people.length > 0 ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {people.map((person) => renderParticipantCard(person))}
        </div>
      ) : (
        <div style={{ color: mutedTextColor, fontSize: 13 }}>{emptyMessage}</div>
      )}
    </div>
  );

  // Les etiquettes de section sont celles du telephone (EventParticipants,
  // `getSectionBadgeMeta`), memes clefs de traduction.
  const getParticipantSectionBadge = (section) => {
    if (section.isExternal) return t('eventDetails.invitedTeams.externalBadge', 'Ouvert à tous');
    if (section.isHome) return t('eventDetails.invitedTeams.homeTeamBadge', 'Équipe organisatrice');
    return t('eventDetails.invitedTeams.invitedTeamBadge', 'Équipe invitée');
  };

  // 🧑‍🏫 ENCADRE (22/09, decision d Adel « PARTWEB-1 → B ») — L ENCADREMENT DE
  // LA CARTE, comme sur le telephone : les encadrants de l equipe, chacun avec
  // sa reponse. Le rangement vient de la fonction partagee (`section.staff`) :
  // rien n est recalcule ici. Il n entre dans aucun chiffre des joueurs
  // (« Joueurs attendus » ne lit que leurs listes). Pas de groupe vide.
  const renderStaffGroup = (section) => {
    const staff = section.staff || {};
    const present = t('eventDetails.present', 'Présent');
    const absent = t('eventParticipants.absent', 'Absent');
    const sansReponse = reponsesOuvertes && !isMatchFinished
      ? t('eventParticipants.noAnswer', 'Sans réponse')
      : libelleSansReponse;
    const rangees = [
      ...(staff.participating || []).map((person) => [person, present]),
      ...(staff.missing || []).map((person) => [person, absent]),
      ...(staff.notAnswered || []).map((person) => [person, sansReponse]),
    ];
    if (rangees.length === 0) return null;
    return (
      <div data-testid="ENCADRE-groupe-staff" style={{ display: 'grid', gap: 10 }}>
        <span
          style={{ color: accentColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}
        >
          {`${t('eventDetails.convocation.staff', 'Staff')} · ${rangees.length}`}
        </span>
        <div style={{ display: 'grid', gap: 12 }}>
          {rangees.map(([person, reponse]) => renderParticipantCard(person, reponse))}
        </div>
      </div>
    );
  };

  const renderParticipantSection = (section) => (
    <div
      data-testid={`PARTWEB-section-${section.key}`}
      key={section.key}
      style={{
        background: sectionBackground,
        border: `1px solid ${borderColor}`,
        borderRadius: 20,
        display: 'grid',
        gap: 16,
        padding: '16px 18px',
      }}
    >
      <div style={{
        alignItems: 'center', display: 'flex', gap: 8, justifyContent: 'space-between',
      }}
      >
        <span style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 16 }}>
          {section.teamName}
        </span>
        <span style={{ color: mutedTextColor, fontSize: 12 }}>
          {getParticipantSectionBadge(section)}
        </span>
      </div>
      {reponsesOuvertes || section.participating.length > 0 ? renderParticipantGroup(
        'participating',
        t('eventDetails.participationStatus.participating', 'Présent·e·s'),
        section.participating,
        t('eventDetails.emptyStates.noConfirmation', 'Personne n\'a encore confirmé sa présence.'),
      ) : null}
      {reponsesOuvertes || section.missing.length > 0 ? renderParticipantGroup(
        'missing',
        t('eventDetails.participationStatus.missing', 'Absent·e·s'),
        section.missing,
        t('eventDetails.emptyStates.noAbsence', 'Aucune absence signalée.'),
      ) : null}
      {renderParticipantGroup(
        'notAnswered',
        libelleSansReponse,
        section.notAnswered,
        reponsesOuvertes
          ? t('eventDetails.emptyStates.allAnswered', 'Tout le monde a répondu.')
          : '',
      )}
      {renderStaffGroup(section)}
    </div>
  );

  const renderParticipantsSection = () => {
    // Noms visibles : les listes du telephone. Sinon on garde la suite d avant —
    // 🔒 identites masquees par l organisateur = le serveur remplace chaque
    // personne par un jeton anonyme ; on montre un NOMBRE, jamais une liste.
    if (canViewParticipantNames && participantSections.length > 0) {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          {participantSections.map(renderParticipantSection)}
        </div>
      );
    }

    if (participants.length === 0) {
      return <div style={{ color: mutedTextColor }}>{t('eventDetails.noConfirmedParticipantYet', 'Aucun participant confirme pour le moment.')}</div>;
    }

    if (!canViewParticipantNames) {
      return (
        <div style={{
          background: softSurfaceColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 16,
          display: 'grid',
          gap: 14,
          padding: '16px 18px',
        }}
        >
          <div style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}>
            {participants.length}
            {' '}
            participant
            {participants.length > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {Array.from({ length: Math.min(participants.length, 6) }).map((_, index) => (
              <div
                key={`participant-anon-${index + 1}`}
                style={{
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '50%',
                  color: mutedTextColor,
                  display: 'inline-flex',
                  fontFamily: 'Montserrat-Bold, sans-serif',
                  height: 42,
                  justifyContent: 'center',
                  width: 42,
                }}
              >
                ?
              </div>
            ))}
          </div>
          <div style={{ color: mutedTextColor, fontSize: 13, lineHeight: 1.5 }}>
            {t(
              'eventDetails.participantsIdentitiesAreHiddenBy',
              'Les identités des participants sont masquees par l organisateur.',
            )}
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {participants.map((participant) => renderParticipantCard(participant))}
      </div>
    );
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentWidth="wide"
      responsivePadding
      style={{ paddingBottom: 32 }}
    >
      <div style={{ color: textColor, display: 'grid', gap: 24 }}>
        {fromEventCreation ? (
          <section
            style={{
              background: 'rgba(1, 179, 244, 0.10)',
              border: `1px solid ${accentColor}`,
              borderRadius: 20,
              color: textColor,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'space-between',
              padding: 16,
            }}
          >
            <span>
              {t(
                'eventDetails.eventCreatedCheckTheLast',
                'Événement crée. Vérifie les derniers détails avant de le partager.',
              )}
            </span>
            <button
              onClick={() => navigation.navigate(RouteNames.MyEventList)}
              style={{ ...outlineButtonStyle, padding: '8px 14px' }}
              type="button"
            >
              {t('eventDetails.seeMyPlanning', 'Voir mon planning')}
            </button>
          </section>
        ) : null}
        <section
          data-event-section="overview"
          style={{
            background: sectionBackground,
            border: `1px solid ${borderColor}`,
            borderRadius: 28,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              alignItems: 'stretch',
              display: 'grid',
              gap: 0,
              gridTemplateColumns: isDesktop && hasEvent ? 'minmax(0, 1.2fr) 320px' : 'minmax(0, 1fr)',
            }}
          >
            <div style={{ display: 'grid', gap: 18, padding: isTablet ? 32 : 22 }}>
              <div style={{
                alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between',
              }}
              >
                <button
                  onClick={() => navigation.goBack()}
                  style={{ ...outlineButtonStyle, padding: '10px 14px' }}
                  type="button"
                >
                  {t('common.back', 'Retour')}
                </button>
                {hasEvent ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      onClick={handleShare}
                      style={{ ...outlineButtonStyle, padding: '10px 14px' }}
                      type="button"
                    >
                      {isSharing
                        ? t('eventDetails.sharing', 'Partage...')
                        : t('eventDetails.share', 'Partager')}
                    </button>
                    {canEdit ? (
                      <button
                        onClick={() => navigation.navigate(RouteNames.EventEdit, { eventId })}
                        style={primaryButtonStyle}
                        type="button"
                      >
                        {t('eventDetails.edit', 'Modifier')}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {hasEvent ? (
                <>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <span style={{
                      color: accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}
                    >
                      {event?.type?.name || t('eventDetails.eventFallback', 'Evenement')}
                    </span>
                    <h1 style={{
                      color: textColor,
                      fontFamily: 'Montserrat-Black, sans-serif',
                      fontSize: isTablet ? 38 : 30,
                      lineHeight: 1.1,
                      margin: 0,
                    }}
                    >
                      {event?.name || event?.type?.name || t(
                        'eventDetails.eventFallback',
                        'Evenement',
                      )}
                    </h1>
                    <div style={{
                      color: softTextColor, display: 'flex', flexWrap: 'wrap', gap: 14,
                    }}
                    >
                      <span>{formatDateTimeLabel(event?.date)}</span>
                      {event?.startTime ? (
                        <span>
                          {formatTimeLabel(event?.startTime)}
                          {' '}
                          -
                          {' '}
                          {formatTimeLabel(event?.endTime)}
                        </span>
                      ) : null}
                      {event?.team?.name ? <span>{event.team.name}</span> : null}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {event?.facility?.name ? (
                      <span style={{
                        background: pillSurfaceColor, borderRadius: 999, color: textColor, padding: '9px 14px',
                      }}
                      >
                        {event.facility.name}
                      </span>
                    ) : null}
                    {event?.validationMode ? (
                      <span style={{
                        background: pillSurfaceColor, borderRadius: 999, color: textColor, padding: '9px 14px',
                      }}
                      >
                        Validation
                        {' '}
                        {event.validationMode === 'manual' ? 'manuelle' : 'auto'}
                      </span>
                    ) : null}
                    {event?.sessionStatus ? (
                      <span style={{
                        background: pillSurfaceColor, borderRadius: 999, color: textColor, padding: '9px 14px',
                      }}
                      >
                        Session
                        {' '}
                        {event.sessionStatus === 'closed' ? 'fermee' : 'ouverte'}
                      </span>
                    ) : null}
                  </div>

                  {String(event?.description || '').trim() ? (
                    <p style={{
                      color: softTextColor, fontSize: 15, lineHeight: 1.65, margin: 0, maxWidth: 840,
                    }}
                    >
                      {String(event?.description || '').trim()}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            {hasEvent ? (
              <div
                style={{
                  background: heroImage ? `linear-gradient(rgba(3, 13, 20, 0.22), rgba(3, 13, 20, 0.48)), url(${heroImage}) center/cover` : 'linear-gradient(160deg, rgba(1,179,244,0.16), rgba(23,56,68,0.4))',
                  borderLeft: isDesktop ? `1px solid ${borderColor}` : 'none',
                  display: 'grid',
                  gap: 14,
                  padding: isTablet ? 32 : 22,
                }}
              >
                <div style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}>{statusHeadingLabel}</div>
                <div style={{ color: mutedTextColor, fontSize: 14, lineHeight: 1.5 }}>
                  {statusDetailLabel}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {peutPasserPresentApresCoup ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <span style={{ color: mutedTextColor, fontSize: 14 }}>
                        {t(
                          'eventList.info.notReported',
                          "Tu n'as pas répondu : tu es « pas renseigné ». "
                            + 'Tu étais là ? Passe en présent.',
                        )}
                      </span>
                      <button
                        disabled={latePresenceMutation.isPending}
                        onClick={async () => {
                          setActionError('');
                          try {
                            await latePresenceMutation.mutateAsync();
                          } catch (lateError) {
                            setActionError(lateError?.message || t(
                              'eventDetails.unableToJoinThisEvent',
                              'Impossible de rejoindre cet événement.',
                            ));
                          }
                        }}
                        style={{
                          ...primaryButtonStyle,
                          cursor: latePresenceMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: latePresenceMutation.isPending ? 0.7 : 1,
                          padding: '12px 16px',
                        }}
                        type="button"
                      >
                        {t('eventList.actions.declareLatePresence', 'Je passe en présent')}
                      </button>
                    </div>
                  ) : null}
                  {afficherParticiper ? (
                    <button
                      disabled={createParticipationMutation.isPending}
                      onClick={handleJoin}
                      style={{
                        ...primaryButtonStyle,
                        cursor: createParticipationMutation.isPending ? 'not-allowed' : 'pointer',
                        opacity: createParticipationMutation.isPending ? 0.7 : 1,
                        padding: '12px 16px',
                      }}
                      type="button"
                    >
                      {createParticipationMutation.isPending ? t(
                        'eventDetails.sending',
                        'Envoi...',
                      ) : joinButtonLabel}
                    </button>
                  ) : null}
                  {!canEdit && activeParticipationRequestId ? (
                    <button
                      disabled={cancelParticipationMutation.isPending}
                      onClick={handleCancelParticipation}
                      style={{
                        ...outlineButtonStyle,
                        cursor: cancelParticipationMutation.isPending ? 'not-allowed' : 'pointer',
                        opacity: cancelParticipationMutation.isPending ? 0.7 : 1,
                        padding: '12px 16px',
                      }}
                      type="button"
                    >
                      {cancelParticipationMutation.isPending ? t('eventDetails.cancelling', 'Annulation...') : t('eventDetails.cancelMyRequest', 'Annuler ma demande')}
                    </button>
                  ) : null}
                  {isReservation && facilityId ? (
                    <button
                      onClick={() => navigation.navigate(RouteNames.BookingCalendar, { facilityId })}
                      style={{ ...outlineButtonStyle, padding: '12px 16px' }}
                      type="button"
                    >
                      {t('eventDetails.openTheCalendar', 'Ouvrir le calendrier')}
                    </button>
                  ) : null}
                </div>
                {actionError ? (
                  <div style={{ color: '#ffb0ba', fontSize: 13, lineHeight: 1.5 }}>
                    {actionError}
                  </div>
                ) : null}
                {event?.team?.club?.name ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ color: mutedTextColor, fontSize: 13 }}>
                      {t('eventDetails.organisingClub', 'Club organisateur:')}
                      {' '}
                      {event.team.club.name}
                    </div>
                    <div
                      style={{
                        alignSelf: 'flex-start',
                        background: clubCertificationPalette.backgroundColor,
                        border: `1px solid ${clubCertificationPalette.borderColor}`,
                        borderRadius: 999,
                        color: clubCertificationPalette.textColor,
                        fontFamily: 'Montserrat-Bold, sans-serif',
                        fontSize: 12,
                        padding: '6px 10px',
                      }}
                    >
                      {clubCertificationLabel}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {error && !isEventGone ? (
          <section style={{
            background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, padding: 22,
          }}
          >
            <div style={{ color: '#ff6b81', fontFamily: 'Montserrat-Bold, sans-serif', marginBottom: 8 }}>{t('eventDetails.loadingFailed', 'Chargement impossible')}</div>
            <div style={{ color: mutedTextColor, marginBottom: 14 }}>{error?.message || t('eventDetails.anErrorOccurred', 'Une erreur est survenue.')}</div>
            <button
              onClick={() => refetch()}
              style={{ ...primaryButtonStyle, padding: '10px 16px' }}
              type="button"
            >
              {t('eventDetails.reload', 'Recharger')}
            </button>
          </section>
        ) : null}

        {isLoading ? (
          <section style={{
            background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, color: mutedTextColor, padding: 22,
          }}
          >
            {t('eventDetails.loadingTheEvent', 'Chargement de l événement...')}
          </section>
        ) : null}

        {!isLoading && (isEventGone || (!error && !hasEvent)) ? (
          <section style={{
            background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, color: mutedTextColor, display: 'grid', gap: 10, padding: 22,
          }}
          >
            <div style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 22 }}>
              {t('eventDetails.eventNotFound', 'Événement introuvable')}
            </div>
            <div>
              {isEventGone ? t(
                'eventDetails.eventGone',
                'Cet événement n’est plus disponible ou a été supprimé.',
              ) : t(
                'eventDetails.thisEventIsNoLonger',
                'Cet événement n est plus disponible ou n a pas pu être charge.',
              )}
            </div>
          </section>
        ) : null}

        {!isLoading && event ? (
          <div style={{ display: 'grid', gap: 24, gridTemplateColumns: isDesktop ? 'minmax(0, 1.15fr) minmax(300px, 0.85fr)' : 'minmax(0, 1fr)' }}>
            {/* PARTWEB — `alignContent: 'start'` sur les DEUX colonnes : une grille
                s'etire a la hauteur de la colonne voisine, et ses blocs avec — la
                liste des participants, longue, creusait des trous dans « Infos rapides ». */}
            <section style={{
              alignContent: 'start', background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 18, padding: 22,
            }}
            >
              {/* 🚪 P9 · ECRAN 1 — LA PROCHAINE ACTION PASSE EN PREMIER, comme sur
                  le telephone : c est la seule chose a FAIRE maintenant, tout
                  le reste de la page est de la consultation. */}
              {showNextActionCard ? (
                <EventNextActionCard
                  expectedCount={nextActionExpectedCount}
                  mode={nextActionMode}
                  onPress={openAttendanceCall}
                  opensAtLabel={nextActionOpensAtLabel}
                />
              ) : null}

              {hasVisibleEventTasks ? (
                <div>
                  <EventTasksSection
                    canManageEvent={canEdit}
                    event={event}
                    userData={userData}
                  />
                </div>
              ) : null}

              {canManageTrainingVisibility ? (
                <div
                  style={{
                    background: softSurfaceColor,
                    border: `1px solid ${accentColor}44`,
                    borderRadius: 18,
                    display: 'grid',
                    gap: 12,
                    padding: '16px 18px',
                  }}
                >
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif' }}>
                      {trainingOpenConfig.isOpenTraining ? t('eventDetails.openTraining2', 'Entraînement ouvert') : t('eventDetails.privateTraining', 'Entraînement prive')}
                    </strong>
                    <span style={{ color: mutedTextColor, fontSize: 14, lineHeight: 1.6 }}>
                      {trainingOpenConfig.isOpenTraining
                        ? t('eventDetails.externalPlayersCanJoinAccording', 'Les joueurs externes peuvent rejoindre selon le quota et le mode de validation choisis.')
                        : t('eventDetails.openTheTrainingSessionTo', 'Ouvre l entraînement pour accueillir des joueurs externes sans compter les membres de tes équipes.')}
                    </span>
                  </div>

                  {trainingOpenConfig.externalParticipantLimit !== null ? (
                    <span style={{ color: softTextColor, fontSize: 14 }}>
                      {trainingOpenConfig.isOpenTraining
                        ? t(
                          'eventDetails.externalSpotsSetting',
                          '{{limit}} place(s) externes - validation {{mode}}',
                          {
                            limit: trainingOpenConfig.externalParticipantLimit,
                            mode: trainingOpenConfig.externalParticipantValidationMode === 'auto'
                              ? t('eventDetails.validationAutomatic', 'automatique')
                              : t('eventDetails.validationManual', 'manuelle'),
                          },
                        )
                        : t(
                          'eventDetails.lastSavedExternalSpotsSetting',
                          'Dernier reglage mémorise: {{limit}} place(s) externes - validation {{mode}}',
                          {
                            limit: trainingOpenConfig.externalParticipantLimit,
                            mode: trainingOpenConfig.externalParticipantValidationMode === 'auto'
                              ? t('eventDetails.validationAutomatic', 'automatique')
                              : t('eventDetails.validationManual', 'manuelle'),
                          },
                        )}
                    </span>
                  ) : null}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      disabled={updateTrainingMutation.isPending}
                      onClick={trainingOpenConfig.isOpenTraining
                        ? handleCloseTraining
                        : () => setIsTrainingSettingsVisible((current) => !current)}
                      style={trainingOpenConfig.isOpenTraining ? outlineButtonStyle : primaryButtonStyle}
                      type="button"
                    >
                      {updateTrainingMutation.isPending
                        ? t('eventDetails.saving', 'Enregistrement...')
                        : (trainingOpenConfig.isOpenTraining ? t('eventDetails.closeTheTrainingSession', 'Fermer l entraînement') : t('eventDetails.openTheTrainingSession', 'Ouvrir l entraînement'))}
                    </button>
                  </div>

                  {!trainingOpenConfig.isOpenTraining && isTrainingSettingsVisible ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <label style={{ display: 'grid', gap: 8 }}>
                        <span style={{ color: mutedTextColor, fontSize: 13 }}>
                          {t('eventDetails.externalSpots', 'Places externes')}
                        </span>
                        <input
                          min="1"
                          onChange={(eventObject) => setTrainingOpenLimitDraft(eventObject.target.value)}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${borderColor}`,
                            borderRadius: 14,
                            color: textColor,
                            fontFamily: 'Montserrat-Regular, sans-serif',
                            fontSize: 14,
                            outline: 'none',
                            padding: '12px 14px',
                          }}
                          type="number"
                          value={trainingOpenLimitDraft}
                        />
                      </label>

                      {/* S11 — plus un choix, une information : le serveur met
                          toute demande venue du dehors en attente. */}
                      <div style={{ display: 'grid', gap: 4 }}>
                        <span style={{ color: mutedTextColor, fontSize: 13 }}>
                          {t('eventDetails.externalRequests', 'Demandes extérieures')}
                        </span>
                        <span style={{ color: mutedTextColor, fontSize: 13 }}>
                          {t(
                            'eventDetails.externalRequestsAreApprovedBy',
                            'Les demandes extérieures sont validées par toi.',
                          )}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        <button
                          disabled={updateTrainingMutation.isPending}
                          onClick={handleSubmitTrainingOpenConfig}
                          style={primaryButtonStyle}
                          type="button"
                        >
                          {t('eventDetails.confirmOpening', 'Confirmer l ouverture')}
                        </button>
                        <button
                          disabled={updateTrainingMutation.isPending}
                          onClick={() => setIsTrainingSettingsVisible(false)}
                          style={outlineButtonStyle}
                          type="button"
                        >
                          {t('eventDetails.cancel', 'Annuler')}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {supportsEventComposition && (canEdit || canViewPublishedComposition) ? (
                <div
                  style={{
                    background: softSurfaceColor,
                    border: `1px solid ${accentColor}33`,
                    borderRadius: 18,
                    display: 'grid',
                    gap: 12,
                    padding: '16px 18px',
                  }}
                >
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif' }}>
                      {t('eventDetails.teamLineUp', "Composition d'equipes")}
                    </strong>
                    <span style={{ color: mutedTextColor, fontSize: 14, lineHeight: 1.6 }}>
                      {staffCompositionPayload?.draft
                        ? t('eventDetails.aDraftAlreadyExistsResume', 'Un brouillon existe déjà. Reprends-le, ajuste les équipes puis publie la version finale.')
                        : compositionEligiblePlayerCount === 0
                          ? t('eventDetails.youCanAlreadyCreateThe', 'Tu peux déjà créer les équipes même sans participant: les postes resteront libres et se completeront ensuite.')
                          : t('eventDetails.createSeveralTeamsByHand', 'Crée plusieurs équipes à la main ou génère-les automatiquement, puis publie la version finale.')}
                    </span>
                  </div>

                  {convocationBranches.length > 0 ? (
                    <div style={{ color: softTextColor, display: 'grid', fontSize: 14, gap: 6 }}>
                      <span>{publishedCompositionSummary.join(' · ')}</span>
                      {convocationBranches[0]?.published?.publishedAt ? (
                        <span>
                          {t('eventDetails.publishedOn', 'Publiée le')}
                          {' '}
                          {new Date(convocationBranches[0].published.publishedAt).toLocaleString(localeDesFormats())}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {canEdit ? (
                      <button
                        disabled={isStaffCompositionFetching}
                        onClick={handleManageComposition}
                        style={primaryButtonStyle}
                        type="button"
                      >
                        {isStaffCompositionFetching ? t('common.loading', 'Chargement...') : t('eventDetails.manageTheTeamLineUp', "Gérer la composition d'équipes")}
                      </button>
                    ) : null}

                    {/* 🚪 COMPO-WEB — l'entraineur : les reponses de ses convoques
                        (et le terrain qui y mene), puis « Modifier ». */}
                    {canEdit && convocationBranches.length > 0 ? (
                      <button
                        onClick={openPublishedConvocation}
                        style={outlineButtonStyle}
                        type="button"
                      >
                        {t('matchConvocation.published.openCta')}
                      </button>
                    ) : null}

                    {/* « Modifier la composition », et non « Modifier » seul comme
                        sur le telephone : l'en-tete de la fiche du site porte deja
                        un « Modifier » (celui de l'evenement). */}
                    {canEdit && publishedBoardTarget ? (
                      <button
                        onClick={openCompositionEdit}
                        style={outlineButtonStyle}
                        type="button"
                      >
                        {t('matchConvocation.published.actions.edit')}
                      </button>
                    ) : null}

                    {!canEdit && convocationBranches.length > 0 && viewerConvocationRole ? (
                      <button
                        onClick={() => navigation.navigate(RouteNames.PlayerConvocation, {
                          eventId,
                          teamId: compositionTeamId,
                        })}
                        style={outlineButtonStyle}
                        type="button"
                      >
                        {t('eventDetails.seeMyCallUp', 'Voir ma convocation')}
                      </button>
                    ) : null}

                    {!canEdit && convocationBranches.length > 0 && !viewerConvocationRole ? (
                      <button
                        onClick={() => navigation.navigate(RouteNames.TacticalBoardV2, {
                          aggregateBranches: convocationBranches,
                          canEdit: false,
                          compositionIntent: null,
                          editorMode: 'event',
                          editorSource: 'published',
                          editorSourceLabel: t(
                            'eventDetails.teamLineUpPublished',
                            "Composition d'équipes publiée",
                          ),
                          eventId,
                          eventKind: isDetectionEvent ? 'detection' : 'match',
                          eventName: compositionEventLabel,
                          eventTypeLabel: event?.type?.name || null,
                          existingComposition: convocationBranches[0]?.published || null,
                          multiTeamComposition: true,
                          readOnly: true,
                          sport: compositionSport,
                          teamId: compositionTeamId,
                          teamName: compositionEditorTeam?.name || null,
                        })}
                        style={outlineButtonStyle}
                        type="button"
                      >
                        {t('eventDetails.seeThePublishedLineUp', 'Voir la composition publiée')}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* 🎯 P9 · ECRAN 2 — LE PARCOURS D APRES-MATCH, juste apres la
                  composition : les deux parlent du meme match. */}
              {showPostMatchCard ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <h2 style={sectionTitleStyle}>
                    {t('eventDetails.matchStats', 'Stats du match')}
                  </h2>
                  <PostMatchJourneyCard
                    boutonDesactive={isPostMatchDoorClosed}
                    motif={postMatchAction.subtitle}
                    onPressEtape={(/** @type {string} */ etape) => {
                      // 🔒 DEUX COUCHES, ET C EST VOULU. Contrairement a la carte
                      // d appel (N5), qui RETIRE son `onPress` porte close, cette
                      // carte-ci le garde toujours : seul `TouchableOpacity` bloque
                      // alors l appui. Une seule couche ne suffit pas devant une
                      // porte qui protege l apres-match — ouvrir l editeur avant la
                      // fin du match est exactement la faute d AC10, et l etape
                      // « Score » n a de toute facon aucune destination ici.
                      if (isPostMatchDoorClosed || etape === 'score') return;
                      openMatchStatsEditor();
                    }}
                    reponsesAttendues={Number(
                      matchStatsReport?.responseEligibleCount
                      ?? playerCollectiveRating?.eligibleCount
                      ?? 0,
                    )}
                    reponsesRecues={Number(
                      matchStatsReport?.responseCompletionCount
                      ?? playerCollectiveRating?.count
                      ?? 0,
                    )}
                    scoreDisponible={Boolean(matchStatsPayload?.score?.available)}
                    scoreLibelle={matchStatsScoreLabel}
                    scoreOrigine={matchStatsPayload?.score?.source || ''}
                    statsFinalisees={isMatchStatsFinal}
                    verificationRequise={isMatchStatsReviewRequired}
                  />
                </div>
              ) : null}

              <h2 style={sectionTitleStyle}>{t('eventDetails.participants', 'Participants')}</h2>
              {renderParticipantsSection()}

              {Array.isArray(event?.teamAudiences) && event.teamAudiences.length > 0 ? (
                <div style={{ marginTop: 24 }}>
                  <EventTeamAudiencesSection
                    canManageEvent={canEdit}
                    event={event}
                    userData={userData}
                  />
                </div>
              ) : null}

              {canEdit ? (
                <>
                  <h3 style={{ ...sectionTitleStyle, fontSize: 18 }}>
                    {t('eventDetails.pendingRequests', 'Demandes en attente')}
                  </h3>
                  {participationRequests.length === 0 ? (
                    <div style={{ color: mutedTextColor }}>
                      {t('eventDetails.noPendingRequest', 'Aucune demande en attente.')}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {participationRequests.map((request) => (
                        <div
                          key={getEntityDocumentId(request) || getEntityDocumentId(request?.user)}
                          style={{
                            background: softSurfaceColor,
                            border: `1px solid ${borderColor}`,
                            borderRadius: 16,
                            display: 'grid',
                            gap: 6,
                            padding: '12px 14px',
                          }}
                        >
                          <span style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>
                            {getUserDisplayName(request?.user)}
                          </span>
                          <span style={{ color: mutedTextColor, fontSize: 13 }}>
                            {t('eventDetails.status', 'Statut:')}
                            {' '}
                            {request?.participationStatus || 'pending'}
                          </span>
                          {request?.sourceTeam?.name ? (
                            <span style={{ color: mutedTextColor, fontSize: 13 }}>
                              {t('eventDetails.sourceTeam2', 'Equipe source:')}
                              {' '}
                              {request.sourceTeam.name}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </section>

            <section style={{ alignContent: 'start', display: 'grid', gap: 24 }}>
              <div style={{
                background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 14, padding: 22,
              }}
              >
                <h2 style={sectionTitleStyle}>{t('eventDetails.quickInfo', 'Infos rapides')}</h2>
                <div style={{ display: 'grid', gap: 12 }}>
                  {[
                    {
                      label: 'Type',
                      value: event?.type?.name || t('eventDetails.notSet', 'Non défini'),
                    },
                    {
                      label: t('eventDetails.teamFallback', 'Equipe'),
                      value: event?.team?.name || t('eventDetails.notSetFeminine', 'Non définie'),
                    },
                    {
                      label: 'Section',
                      value: event?.team?.section?.name
                        || t('eventDetails.notSetFeminine', 'Non définie'),
                    },
                    {
                      label: t('eventDetails.capacity', 'Capacite'),
                      value: event?.capacity ?? t('eventDetails.open2', 'Libre'),
                    },
                    ...(!trainingOpenConfig.isOpenTraining
                      ? [{
                        label: t('eventDetails.expectedPlayers', 'Joueurs attendus'),
                        value: expectedPlayersCount ?? event?.totalPlayers ?? t('eventDetails.notSet', 'Non défini'),
                      }]
                      : []),
                    {
                      label: t('eventDetails.pricePerson', 'Prix / personne'),
                      value: event?.pricePerPerson != null
                        ? `${event.pricePerPerson} EUR`
                        : t('eventDetails.freeOrNotSet', 'Gratuit ou non défini'),
                    },
                  ].map((item, index, rows) => (
                    <div
                      key={item.label}
                      style={{
                        borderBottom: index < rows.length - 1 ? `1px solid ${borderColor}` : 'none',
                        display: 'grid',
                        gap: 4,
                        paddingBottom: index < rows.length - 1 ? 12 : 0,
                      }}
                    >
                      <span style={{
                        color: mutedTextColor, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}
                      >
                        {item.label}
                      </span>
                      <span style={{ color: textColor, fontFamily: 'Montserrat-SemiBold, Montserrat-Bold, sans-serif', fontSize: 15 }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {isTournamentEvent ? (
                <div
                  data-event-section="tournament"
                  style={{
                    background: sectionBackground,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 24,
                    display: 'grid',
                    gap: 14,
                    padding: 22,
                  }}
                >
                  <h2 style={sectionTitleStyle}>
                    {t('eventDetails.tournamentMode', 'Mode tournoi')}
                  </h2>
                  <div style={{
                    color: mutedTextColor, display: 'grid', fontSize: 14, gap: 10,
                  }}
                  >
                    <span>
                      {t('eventDetails.teamApproval', 'Validation des equipes:')}
                      {event?.tournamentConfig?.registrationMode === 'auto'
                        ? t('eventDetails.automatic', 'Automatique')
                        : t('eventDetails.manual', 'Manuelle')}
                    </span>
                    <span>
                      {t('eventDetails.maxTeams', 'Max equipes:')}
                      {event?.tournamentConfig?.maxTeams ?? t(
                        'eventDetails.unlimited',
                        'Non limite',
                      )}
                    </span>
                    <span>
                      {t('eventDetails.squadSize', 'Effectif:')}
                      {event?.tournamentConfig?.minRosterSize ?? t('eventDetails.open2', 'Libre')}
                      {' '}
                      -
                      {event?.tournamentConfig?.maxRosterSize ?? t('eventDetails.open2', 'Libre')}
                    </span>
                    <span>
                      {t('eventDetails.temporaryTeams', 'Equipes ephemeres:')}
                      {event?.tournamentConfig?.allowCustomTeams !== false
                        ? t('eventDetails.allowed', 'Autorisees')
                        : t('eventDetails.disabled', 'Desactivees')}
                    </span>
                    <span>
                      {t('eventDetails.mixedClubs', 'Mix clubs:')}
                      {event?.tournamentConfig?.allowCrossClubPlayers === true ? t('eventDetails.allowedSingular', 'Autorise') : t('eventDetails.notAllowed', 'Non autorise')}
                    </span>
                  </div>
                  {String(event?.tournamentConfig?.rulesText || '').trim() ? (
                    <div style={{ color: textColor, fontSize: 14, lineHeight: 1.6 }}>
                      {String(event?.tournamentConfig?.rulesText || '').trim()}
                    </div>
                  ) : null}
                  <div style={{
                    color: mutedTextColor, display: 'flex', flexWrap: 'wrap', fontSize: 13, gap: 12,
                  }}
                  >
                    <span>
                      {tournamentTeams.length}
                      {' '}
                      {t('eventDetails.teamS', 'equipe(s)')}
                    </span>
                    <span>
                      {tournamentTeamCounters.pending}
                      {' '}
                      {t('eventDetails.pendingLower', 'en attente')}
                    </span>
                    <span>
                      {tournamentTeamCounters.accepted}
                      {' '}
                      {t('eventDetails.approved2', 'validee(s)')}
                    </span>
                    <span>
                      {tournamentTeamCounters.warning}
                      {' '}
                      warning(s)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      onClick={() => navigation.navigate(RouteNames.TournamentManagement, { eventId })}
                      style={{
                        background: canEdit ? accentColor : 'transparent',
                        border: canEdit ? 0 : `1px solid ${borderColor}`,
                        borderRadius: 999,
                        color: textColor,
                        cursor: 'pointer',
                        fontFamily: canEdit ? 'Montserrat-Bold, sans-serif' : 'Montserrat-Regular, sans-serif',
                        padding: '10px 16px',
                      }}
                      type="button"
                    >
                      {canEdit ? t(
                        'eventDetails.runTheCompetition',
                        'Piloter la compétition',
                      ) : t(
                        'eventDetails.seeTheCompetition',
                        'Voir la compétition',
                      )}
                    </button>
                    {canEdit ? (
                      <button
                        onClick={() => navigation.navigate(RouteNames.TournamentSettingsEdit, { eventId })}
                        style={primaryButtonStyle}
                        type="button"
                      >
                        {t('eventDetails.editTheSettings', 'Modifier les paramètres')}
                      </button>
                    ) : null}
                    {managedTournamentTeam?.documentId ? (
                      <button
                        onClick={() => handleOpenTournamentTeam(managedTournamentTeam.documentId)}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: 999,
                          color: textColor,
                          cursor: 'pointer',
                          padding: '10px 16px',
                        }}
                        type="button"
                      >
                        {t('eventDetails.manageMyTeam', 'Gérer mon équipe')}
                      </button>
                    ) : null}
                    {!managedTournamentTeam?.documentId && currentUserTournamentTeam?.documentId ? (
                      <button
                        onClick={() => handleOpenTournamentTeam(currentUserTournamentTeam.documentId)}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: 999,
                          color: textColor,
                          cursor: 'pointer',
                          padding: '10px 16px',
                        }}
                        type="button"
                      >
                        {t('eventDetails.seeMyTeam', 'Voir mon équipe')}
                      </button>
                    ) : null}
                    {!managedTournamentTeam?.documentId && !currentUserTournamentTeam?.documentId && currentUserPendingTournamentTeam?.documentId ? (
                      <button
                        onClick={() => handleOpenTournamentTeam(currentUserPendingTournamentTeam.documentId)}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: 999,
                          color: textColor,
                          cursor: 'pointer',
                          padding: '10px 16px',
                        }}
                        type="button"
                      >
                        {normalizeTournamentText(
                          currentUserPendingTournamentTeam?.members?.find(
                            (member) => member?.user?.documentId === userData?.documentId,
                          )?.responseStatus,
                        ) === 'invited'
                          ? t('eventDetails.answerMyInvitation', 'Répondre à mon invitation')
                          : t('eventDetails.followMyRequest', 'Suivre ma demande')}
                      </button>
                    ) : null}
                    {canRegisterTournamentSourceTeam ? (
                      <button
                        disabled={registerTournamentTeamMutation.isPending}
                        onClick={handleRegisterTournamentTeam}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: 999,
                          color: textColor,
                          cursor: registerTournamentTeamMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: registerTournamentTeamMutation.isPending ? 0.7 : 1,
                          padding: '10px 16px',
                        }}
                        type="button"
                      >
                        {t('eventDetails.registerMyTeam', 'Inscrire mon équipe')}
                      </button>
                    ) : null}
                    {canCreateCustomTournamentTeam ? (
                      <button
                        disabled={createTournamentTeamMutation.isPending}
                        onClick={handleCreateTournamentTeam}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: 999,
                          color: textColor,
                          cursor: createTournamentTeamMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: createTournamentTeamMutation.isPending ? 0.7 : 1,
                          padding: '10px 16px',
                        }}
                        type="button"
                      >
                        {t('eventDetails.createATeam', 'Créer une équipe')}
                      </button>
                    ) : null}
                  </div>
                  {tournamentTeams.length === 0 ? (
                    <div style={{ color: mutedTextColor, fontSize: 14 }}>
                      {t(
                        'eventDetails.noTeamIsRegisteredYet',
                        'Aucune équipe n est encore inscrite.',
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {tournamentTeams.map((team) => {
                        const rosterSummary = getTournamentRosterSummary(team, tournamentConfig);
                        const hasRosterWarning = isTournamentTeamNonCompliant(team, tournamentConfig);
                        const status = normalizeTournamentText(team?.status);
                        const statusLabel = getTournamentTeamStatusLabel(status);

                        return (
                          <div
                            key={getEntityDocumentId(team) || team?.name}
                            style={{
                              background: softSurfaceColor,
                              border: `1px solid ${borderColor}`,
                              borderRadius: 16,
                              display: 'grid',
                              gap: 8,
                              padding: '12px 14px',
                            }}
                          >
                            <div style={{
                              alignItems: 'center', display: 'flex', gap: 12, justifyContent: 'space-between',
                            }}
                            >
                              <div style={{ display: 'grid', gap: 4 }}>
                                <span style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>
                                  {team?.name || t('eventDetails.tournamentTeam', 'Équipe tournoi')}
                                </span>
                                <span style={{ color: mutedTextColor, fontSize: 13 }}>
                                  {team?.sourceType === 'club_team'
                                    ? t('eventDetails.fromTeam', 'Depuis {{teamName}}', {
                                      teamName: team?.sourceTeam?.name
                                        || t('eventDetails.aClubTeam', 'une équipe club'),
                                      ...SANS_ECHAPPEMENT,
                                    })
                                    : t('eventDetails.temporaryTeam', 'Équipe éphémère')}
                                </span>
                              </div>
                              <span style={{ color: accentColor, fontSize: 13 }}>
                                {statusLabel}
                              </span>
                            </div>
                            <div style={{
                              color: mutedTextColor, display: 'flex', flexWrap: 'wrap', fontSize: 13, gap: 12,
                            }}
                            >
                              <span>
                                {rosterSummary.totalCount}
                                {' '}
                                roster
                              </span>
                              <span>
                                {rosterSummary.presentCount}
                                {' '}
                                {t('eventDetails.present2', 'presents')}
                              </span>
                              <span>
                                {rosterSummary.pendingCount}
                                {' '}
                                {t('eventDetails.pendingLower', 'en attente')}
                              </span>
                              {rosterSummary.invitedCount > 0 ? (
                                <span>
                                  {rosterSummary.invitedCount}
                                  {' '}
                                  {t('eventDetails.invitationS', 'invitation(s)')}
                                </span>
                              ) : null}
                              {rosterSummary.requestedCount > 0 ? (
                                <span>
                                  {rosterSummary.requestedCount}
                                  {' '}
                                  {t('eventDetails.requestS', 'demande(s)')}
                                </span>
                              ) : null}
                              {hasRosterWarning ? <span style={{ color: '#ffd54a' }}>Warning roster</span> : null}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              <button
                                onClick={() => handleOpenTournamentTeam(team?.documentId)}
                                style={{
                                  background: 'transparent',
                                  border: `1px solid ${borderColor}`,
                                  borderRadius: 999,
                                  color: textColor,
                                  cursor: 'pointer',
                                  padding: '9px 14px',
                                }}
                                type="button"
                              >
                                {t('eventDetails.openTheTeam', 'Ouvrir l équipe')}
                              </button>
                              {canEdit && status === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => handleReviewTournamentTeam(team?.documentId, 'accepted')}
                                    style={{
                                      ...primaryButtonStyle,
                                      padding: '9px 14px',
                                    }}
                                    type="button"
                                  >
                                    {t('eventDetails.approve', 'Valider')}
                                  </button>
                                  <button
                                    onClick={() => handleReviewTournamentTeam(team?.documentId, 'declined')}
                                    style={{
                                      background: 'transparent',
                                      border: '1px solid rgba(255, 107, 129, 0.38)',
                                      borderRadius: 999,
                                      color: '#ff6b81',
                                      cursor: 'pointer',
                                      padding: '9px 14px',
                                    }}
                                    type="button"
                                  >
                                    {t('eventDetails.decline', 'Refuser')}
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              <div style={{
                background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 14, padding: 22,
              }}
              >
                <h2 style={sectionTitleStyle}>
                  {t('eventDetails.invitedTeams2', 'Équipes invitées')}
                </h2>
                {invitedTeams.length === 0 ? (
                  <div style={{ color: mutedTextColor }}>
                    {t('eventDetails.noInvitedTeam', 'Aucune équipe invitée.')}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {invitedTeams.map((team) => (
                      <div
                        key={getEntityDocumentId(team) || team?.name}
                        style={{
                          background: softSurfaceColor, border: `1px solid ${borderColor}`, borderRadius: 16, padding: '12px 14px',
                        }}
                      >
                        <div style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>{team?.name || t('eventDetails.teamFallback', 'Equipe')}</div>
                        <div style={{ color: mutedTextColor, fontSize: 13 }}>{team?.club?.name || team?.section?.name || ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PARTWEB — « Absences / manques » a quitte la page : chaque absent
                  est desormais DANS son equipe (groupe « Absent·e·s » de la
                  section Participants), comme sur le telephone. */}
            </section>
          </div>
        ) : null}
      </div>
    </ScreenContainer>
  );
}

export default EventDetails;
