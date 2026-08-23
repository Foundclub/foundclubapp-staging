// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  isMatchTypeName,
  OPPONENT_NAME_MAX_LENGTH,
  resolveEventDisplayName,
  resolveEventOpponentName,
} from '@/domains/event/eventDisplayName';
import { resolveTrainingOpenConfig } from '@/domains/event/eventUseCases';
import { getCurrentUserEventParticipationState } from '@/domains/event/participationState';
import useMessaging from '@/domains/messaging/useMessaging';
import {
  getParticipationErrorMessage,
  resolveClientSourceTeamForUser,
  resolveParticipationFlow,
} from '@/domains/participation/participationFlow';
import { getSubscriptionQuotaItem, hasActiveClubOffer } from '@/domains/subscription/subscriptionDecision';
import { hasLivingUser, withoutDeletedAccounts } from '@/domains/user/deletedAccount';
import { getEventShowcaseTemplate, isEventShowcaseOffered } from '@/domains/visuals/eventShowcaseTemplate';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkbox from '@/components/atoms/checkbox/Checkbox';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import Tag from '@/components/atoms/tag/Tag';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import RefuseParticipationModal from '@/components/organisms/refuseParticipationModal/RefuseParticipationModal';
import ReportEventModal from '@/components/organisms/reportEventModal/ReportEventModal';
import ShareEventModal from '@/components/organisms/shareEventModal/ShareEventModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  CONVOCATION_ROLE_STARTER,
  getViewerConvocationRole,
} from '@/views/playerConvocation/playerConvocationUtils';

import { hasRouteInNavigationTree } from '@/navigation/navigationAvailability';
import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

import { celebrate } from '@/services/celebrations/celebrationRuntime';
import {
  useGetEvent,
  useGetEventAttendance,
  useGetEventConvocation,
  useGetEventTeamComposition,
} from '@/services/event/eventQueries';
import {
  approveFeatured,
  exportEventParticipants,
  rejectFeatured,
} from '@/services/event/eventService';
import { useGetEventParticipations } from '@/services/eventParticipation/eventParticipationQueries';
// 🧾 N2 — AUCUN MODULE NOUVEAU N'ENTRE ICI : `licenseQueries` etait deja
// importe pour `useLicenseCampaigns`. Les deux fonctions de service qui
// s'ajoutent sont des RE-EXPORTS du meme fichier, et elles ne sont appelees que
// dans la fermeture d'une mutation — jamais au montage. C'est ce qui evite le
// piege connu du projet (un import de service de plus = des suites entieres qui
// ne s'executent plus, `.env` etant absent des copies de travail).
import {
  generateLicenseAssignments,
  sendBulkLicenseReminder,
  useLicenseCampaigns,
} from '@/services/license/licenseQueries';
import {
  useGetEventMatchStats,
  useGetEventMyMatchResponse,
} from '@/services/matchStats/matchStatsQueries';
import { applyToRecruitmentAd } from '@/services/recruitment/recruitmentService';
import {
  createCustomTournamentTeam,
  registerClubTeamToTournament,
  requestJoinTournamentTeam,
  respondToTournamentTeam,
  reviewTournamentTeamRegistration,
} from '@/services/tournamentTeam/tournamentTeamService';

import { resolveExternalMatchDisplay } from '@/utils/externalMatchDisplay';
import {
  dismissMatchStatsPromptForSession,
  isMatchStatsPromptDismissedForSession,
} from '@/utils/matchStatsPromptSession';
import { markEventDetailsPerf } from '@/utils/performance/eventDetailsPerformance';

import {
  formatTimeInZone,
  resolveAttendanceWindow,
  resolveCallMode,
} from './attendance/attendanceCallModel';
import EventDetectionSlots from './components/EventDetectionSlots';
import EventExportSheet from './components/EventExportSheet';
import EventHeader from './components/EventHeader';
import EventNextActionCard from './components/EventNextActionCard';
import EventParticipants from './components/EventParticipants';
import EventReservationActions from './components/EventReservationActions';
import EventTasksSection from './components/EventTasksSection';
import EventTeamAudiencesSection from './components/EventTeamAudiencesSection';
import PostMatchJourneyCard from './components/PostMatchJourneyCard';
import RemindTeamsSheet from './components/RemindTeamsSheet';
import TournamentPeopleList from './components/TournamentPeopleList';
import TournamentProgressRail from './components/TournamentProgressRail';
import { resolveEventAttendanceGate } from './eventAttendanceGate';
import { resolveEventEndedAt, resolveIsMatchFinished } from './eventMatchClock';
import { useEventMutations } from './hooks/useEventMutations';
import { OwnAnswerAction, resolveOwnAnswerAction } from './ownAnswerAction';
import { createTournamentDesignSystem } from './tournamentDesignSystem';
import {
  getTournamentMemberBuckets,
  getTournamentPendingMembershipForUser,
  getTournamentRosterSummary,
  getTournamentStatusCounters,
  isTournamentActiveMemberStatus,
  isTournamentTeamNonCompliant,
  normalizeTournamentText,
} from './tournamentUtils';

// import statique (pas require) : require n'existe pas sur le rendu web ESM.
import SharePlatform from '@/platform/share';

const EVENT_DETAILS_STALE_MS = 30_000;
// D53 — `FLOATING_MANAGE_CLEARANCE = 80` a disparu d'ici, et le motif est
// geometrique, pas esthetique. D21 reservait 80 px sous le DERNIER bloc de la
// liste pour que le menu flottant ne recouvre rien. Le calcul etait juste
// (46 px de pastille + 16 px d'ecart = 62 <= 80) mais il ne protegeait QUE la
// fin de la liste : la pastille etait ancree au cadre, pas au contenu, donc
// elle occupait en permanence les 62 px du bas. Tout ce qui defilait dessous
// passait derriere — et la liste des participants est rendue AU MILIEU du
// defilement (`EventParticipants`, suivie des stats de match, des avis et des
// compositions). C'est ce qui cachait a moitie « Leo Diallo ».
//
// ⛔ Aucune reserve, si grande soit-elle, ne corrige ca : une marge en bas de
// liste ne protege pas le milieu d'une liste. Le menu est donc passe DANS LE
// FLUX. Il ne peut plus rien recouvrir, et il coute moins de hauteur qu'avant :
// 46 + 12 = 58 px au lieu des 80 px reserves.
//
// D64 — et il a change d'ENDROIT, parce que le mettre en flux ne suffisait pas.
// D53 le laissait en pied de cadre, sous la liste. Une ScrollView porte
// `flexGrow: 1` : elle remplit le cadre meme quand son contenu est court, donc
// le menu restait plaque en bas avec un grand vide au-dessus de lui — le « gros
// bloc de padding » qu'Adel a vu a l'emulateur le 2026-08-10. Il est desormais
// rendu EN TETE DU CONTENU, juste apres la carte de l'evenement, dans le meme
// creneau que `renderTournamentActionsPanel` : c'est deja le creneau « ce que je
// peux faire ici », on n'en invente pas un second. Plus rien a caler, donc plus
// rien a reserver.
//
// 🧱 Trois lots ont tourne autour de ce bouton (D21 flottant, D53 en flux,
// D64 en tete). Ce qu'ils ont appris : sa POSITION est le probleme, jamais la
// taille d'une marge. Ne pas reintroduire de constante de degagement.
const MIN_PARTICIPANTS = 1;
const MAX_PARTICIPANTS = 200;
const DEFAULT_EXTERNAL_PARTICIPANT_LIMIT = 3;
/**
 * @param {number | string | null | undefined} amountCents
 * @param {string} currency
 * @returns {string}
 */
const formatCampaignAmount = (amountCents, currency = 'EUR') => {
  try {
    return new Intl.NumberFormat('fr-FR', { currency, style: 'currency' }).format((Number(amountCents) || 0) / 100);
  } catch (_) {
    return `${((Number(amountCents) || 0) / 100).toFixed(2)} ${currency}`;
  }
};

/**
 * @param {number} value
 * @returns {number}
 */
const clampParticipants = (value) => (
  Math.min(MAX_PARTICIPANTS, Math.max(MIN_PARTICIPANTS, value))
);

/**
 * @param {object} props
 * @param {any} props.Alignments
 * @param {any} props.ApplicationStyle
 * @param {any} props.Colors
 * @param {any} props.Fonts
 * @param {any} props.Spaces
 * @param {number | null | undefined} props.initialLimit
 * @param {'auto' | 'manual' | null | undefined} props.initialValidationMode
 * @param {boolean} props.isSubmitting
 * @param {boolean} props.isVisible
 * @param {() => void} props.onClose
 * @param {(payload: { externalParticipantLimit: number; externalParticipantValidationMode: 'auto' | 'manual' }) => void} props.onSubmit
 * @returns {import('react').ReactElement}
 */
function TrainingOpenBottomSheet({
  Alignments,
  ApplicationStyle,
  Colors,
  Fonts,
  initialLimit,
  initialValidationMode,
  isSubmitting,
  isVisible,
  onClose,
  onSubmit,
  Spaces,
}) {
  const resolveInitialLimit = useCallback(
    () => clampParticipants(Number(initialLimit) || DEFAULT_EXTERNAL_PARTICIPANT_LIMIT),
    [initialLimit],
  );
  const [limitValue, setLimitValue] = useState(resolveInitialLimit);
  const [validationMode, setValidationMode] = useState(
    initialValidationMode === 'auto' ? 'auto' : 'manual',
  );

  useEffect(() => {
    if (!isVisible) return;
    setLimitValue(resolveInitialLimit());
    setValidationMode(initialValidationMode === 'auto' ? 'auto' : 'manual');
  }, [initialValidationMode, isVisible, resolveInitialLimit]);

  const canDecreaseLimit = limitValue > MIN_PARTICIPANTS;
  const canIncreaseLimit = limitValue < MAX_PARTICIPANTS;
  const counterButtonStyle = (isEnabled) => ([
    ApplicationStyle.card,
    Alignments.alignCenter,
    Alignments.justifyCenter,
    {
      backgroundColor: isEnabled ? 'rgba(1, 179, 244, 0.12)' : 'rgba(1, 179, 244, 0.06)',
      borderColor: 'rgba(1, 179, 244, 0.28)',
      borderRadius: 16,
      height: 56,
      opacity: isEnabled ? 1 : 0.45,
      width: 56,
    },
  ]);

  return (
    <BottomModal
      close={onClose}
      isVisible={isVisible}
      snapPoints={['60%']}
    >
      <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Ouvrir l entraînement</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            Définis combien de joueurs externes peuvent rejoindre cet entraînement, puis choisis leur mode de validation.
          </Text>
        </View>

        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Places externes</Text>
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
            <TouchableOpacity
              disabled={!canDecreaseLimit}
              onPress={() => setLimitValue((value) => clampParticipants(value - 1))}
              style={counterButtonStyle(canDecreaseLimit)}
            >
              <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
            </TouchableOpacity>

            <View style={[Spaces.paddingHorizontal[12]]}>
              <Text style={[Fonts.h1, Fonts.neutral00, { textAlign: 'center' }]}>
                {limitValue}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'center' }]}>
                joueurs externes max
              </Text>
            </View>

            <TouchableOpacity
              disabled={!canIncreaseLimit}
              onPress={() => setLimitValue((value) => clampParticipants(value + 1))}
              style={counterButtonStyle(canIncreaseLimit)}
            >
              <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Validation des joueurs externes</Text>
          <View style={[Alignments.row, Spaces.gap[8]]}>
            {[
              { key: 'auto', label: 'Automatique' },
              { key: 'manual', label: 'Manuelle' },
            ].map((option) => {
              const selected = validationMode === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setValidationMode(option.key)}
                  style={[
                    ApplicationStyle.card,
                    Spaces.paddingHorizontal[16],
                    Spaces.paddingVertical[12],
                    {
                      backgroundColor: selected ? `${Colors.primary500}18` : 'transparent',
                      borderColor: selected ? Colors.primary500 : `${Colors.primary500}44`,
                      borderRadius: 999,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p2Bold, selected ? Fonts.primary500 : Fonts.neutral100]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
          <Button
            disabled={isSubmitting}
            isLoading={isSubmitting}
            onPress={() => onSubmit({
              externalParticipantLimit: limitValue,
              externalParticipantValidationMode: validationMode,
            })}
            title="Confirmer l ouverture"
            variant="Primary"
          />
          <Button
            disabled={isSubmitting}
            onPress={onClose}
            title="Annuler"
            variant="Secondary"
          />
        </View>
      </View>
    </BottomModal>
  );
}

/** @typedef {import('@/domains/event/types').FCEvent} FCEvent */
/**
 * @typedef {{
 *   id?: string | number;
 *   documentId?: string;
 *   firstname?: string;
 *   lastname?: string;
 *   avatar?: { url?: string };
 * }} User
 */
/** @typedef {{ documentId?: string; updatedAt?: string; participationStatus?: string; isActive?: boolean; sourceTeam?: { documentId?: string; name?: string }; user: User }} EventParticipation */

const START_TIME_RE = /^(\d{1,2}):(\d{2})/;
const normalizeEventTypeLabel = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

// @ts-ignore: FIXME: Baseline TS regression
const getActiveParticipationRequests = (event) => (
  Array.isArray(event?.participationRequests)
    // @ts-ignore: FIXME: Baseline TS regression
    ? event.participationRequests.filter((request) => request?.isActive !== false)
    : []
);

// @ts-ignore: FIXME: Baseline TS regression
const getStageDayStatusSummary = (stageDay) => {
  const requests = getActiveParticipationRequests(stageDay);
  // @ts-ignore: FIXME: Baseline TS regression
  return requests.reduce((summary, request) => {
    const status = String(request?.participationStatus || '').toLowerCase();
    if (status === 'accepted') return { ...summary, present: summary.present + 1 };
    if (status === 'missing' || status === 'declined') {
      return { ...summary, absent: summary.absent + 1 };
    }
    if (status === 'pending') return { ...summary, pending: summary.pending + 1 };
    return summary;
  }, { absent: 0, pending: 0, present: 0 });
};

/**
 * 🔢 N2 — L'EFFECTIF COLLE AU LIBELLE D'UN ONGLET (planche 04).
 *
 * `SegmentedControl` n'accepte qu'une CHAINE par option : le compteur ne peut
 * pas etre un noeud pose a cote, il fait partie du mot. Un seul endroit le
 * colle, pour les quatre types — sinon « Participants · 8 » et « Personnes ·8 »
 * finiraient par diverger d'un espace, et personne ne le verrait avant l'ecran.
 *
 * ⛔ Un compteur absent (`null`, `undefined`, `NaN`) rend le libelle NU plutot
 * que « Répartition · 0 » : la planche 04 donne un effectif a tous les onglets
 * SAUF « Répartition », qui ne compte rien.
 *
 * @param {string} label Le nom de l'onglet.
 * @param {number} [count] L'effectif, quand cet onglet en a un.
 * @returns {string} Le libelle a afficher.
 */
const withTabCount = (label, count) => (
  Number.isFinite(count) ? `${label} · ${count}` : label
);

/**
 * 🏷️ N1 (c) — LE LIBELLE DE LA PASTILLE DE TYPE, EN UN SEUL ENDROIT.
 *
 * Le nom du type en capitales, puis autant de precisions que le lot en cours
 * sait dire, collees par « · ». Une FONCTION plutot qu'une ternaire dans le JSX
 * parce que le lot N3 vient poser « MATCH · À DOMICILE » dans CETTE MEME
 * pastille juste apres celui-ci : deux ternaires imbriquees deviendraient
 * illisibles au troisieme segment. N3 n'a qu'a allonger le tableau.
 *
 * Un segment vide est retire : il ne laisse jamais un separateur orphelin.
 * @param {string | null | undefined} typeName - Le nom du type d'evenement.
 * @param {Array<string | null | undefined>} [segments] - Les precisions a coller.
 * @returns {string} Le libelle, pret pour la pastille.
 */
const buildTypeTagLabel = (typeName, segments = []) => [
  String(typeName || '').toUpperCase(),
  ...segments,
]
  .map((/** @type {any} */ part) => String(part || '').trim())
  .filter(Boolean)
  .join(' · ');

// @ts-ignore: FIXME: Baseline TS regression
const getFeaturedScopeStatusLabel = (status) => {
  if (status === 'pending') return 'Demande en attente';
  if (status === 'approved') return 'Déjà à la une';
  if (status === 'rejected') return 'Refusée, tu peux redemander';
  return 'Disponible';
};

/**
 * @param {User | null | undefined} user
 * @returns {string | null}
 */
const getUserKey = (user) => {
  if (user?.documentId) return `doc:${user.documentId}`;
  if (user?.id) return `id:${String(user.id)}`;
  return null;
};

/**
 * AA02 — LE POINT DE PASSAGE UNIQUE des listes de personnes de cet ecran.
 *
 * Presents, absents, sans reponse, joueurs d'equipe, participants externes,
 * historique, candidats a la compo : TOUT remonte ici. Le tri des comptes
 * supprimes est donc pose a UN seul endroit, pas recopie huit fois.
 * `withoutDeletedAccounts` ecarte les deux trous possibles — la relation vide
 * (`null`) et le fantome (compte anonymise et bloque par `deleteAccount`).
 * @param {User[]} [users]
 * @returns {User[]}
 */
const uniqueUsers = (users = []) => {
  const map = new Map();
  withoutDeletedAccounts(users).forEach((user) => {
    const key = getUserKey(user);
    if (!key || map.has(key)) return;
    map.set(key, user);
  });
  return Array.from(map.values());
};

// @ts-ignore: FIXME: Baseline TS regression
const getTrainerKeySet = (team) => new Set(
  (team?.trainers || [])
    // @ts-ignore: FIXME: Baseline TS regression
    .map((trainer) => getUserKey(trainer))
    .filter(Boolean),
);

// @ts-ignore: FIXME: Baseline TS regression
const getEligibleTeamPlayers = (team) => {
  const trainerKeys = getTrainerKeySet(team);
  return uniqueUsers(
    // @ts-ignore: FIXME: Baseline TS regression
    (team?.players || []).filter((player) => {
      const playerKey = getUserKey(player);
      return Boolean(playerKey) && !trainerKeys.has(playerKey);
    }),
  );
};

const getDetectionCandidatePlayers = (event, team) => {
  const excludedKeys = new Set([
    ...Array.from(getTrainerKeySet(team)),
    ...getEligibleTeamPlayers(team).map((player) => getUserKey(player)).filter(Boolean),
  ]);

  // On garde le POSTE POSTULÉ (appliedPosition) sur chaque candidat : le poste de
  // l'annonce pour un candidat d'annonce, la position de la participation sinon.
  // Sert à l'affichage « a postulé X » et au pré-placement au bon poste.
  const adCandidates = Array.isArray(event?.recruitmentAds)
    ? event.recruitmentAds.flatMap((recruitmentAd) => (recruitmentAd?.candidates || [])
      .map((candidate) => ({ ...candidate, appliedPosition: recruitmentAd?.position || null })))
    : [];
  const acceptedRequests = getActiveParticipationRequests(event)
    .filter((participation) => ['accepted', 'missing'].includes(String(participation?.participationStatus || '').toLowerCase()))
    .map((participation) => (participation?.user
      ? { ...participation.user, appliedPosition: participation?.position || null }
      : null))
    .filter(Boolean);
  const acceptedParticipations = Array.isArray(event?.participations) ? event.participations : [];

  return filterUsersByExcludedKeys(
    [
      ...adCandidates,
      ...acceptedParticipations,
      ...acceptedRequests,
    ],
    excludedKeys,
  );
};

const getCompositionPlayersForEvent = (event, team, detectionEnabled) => {
  const teamPlayers = getEligibleTeamPlayers(team);
  if (!detectionEnabled) return teamPlayers;
  return uniqueUsers([
    ...teamPlayers,
    ...getDetectionCandidatePlayers(event, team),
  ]);
};

// @ts-ignore: FIXME: Baseline TS regression
const filterUsersByExcludedKeys = (users = [], excludedKeys = new Set()) => uniqueUsers(
  users.filter((user) => {
    const key = getUserKey(user);
    return Boolean(key) && !excludedKeys.has(key);
  }),
);

/**
 * @param {FCEvent | null | undefined} event
 * @returns {Date | null}
 */
const resolveEventStartAt = (event) => {
  const eventDate = event?.date ? new Date(event.date) : null;
  if (!eventDate || Number.isNaN(eventDate.getTime())) return null;

  const startTime = String(event?.startTime || '');
  const match = startTime.match(START_TIME_RE);
  if (!match) return eventDate;

  const isMidnight = eventDate.getUTCHours() === 0
    && eventDate.getUTCMinutes() === 0
    && eventDate.getUTCSeconds() === 0;
  if (!isMidnight) return eventDate;

  const withTime = new Date(eventDate);
  withTime.setUTCHours(Number(match[1]), Number(match[2]), 0, 0);
  return withTime;
};

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any>; route: { params?: { eventId?: string, fromEventCreation?: boolean, eventCampaignCreationSuggested?: boolean, creationCelebration?: { actionKey?: string, payload?: Record<string, any> }, subscriptionFollowUp?: { beforeRemaining?: number, consumedCount?: number, quotaType?: string, total?: number } | null } } }} props
 */
function EventDetails({ navigation, route }) {
  const { eventId } = route?.params ?? {};
  const fromEventCreation = Boolean(route?.params?.fromEventCreation);
  const eventCampaignCreationSuggested = Boolean(route?.params?.eventCampaignCreationSuggested);
  const creationCelebration = route?.params?.creationCelebration || null;
  const subscriptionFollowUp = route?.params?.subscriptionFollowUp || null;
  // @ts-ignore: FIXME: Baseline TS regression
  const highlightedSection = route?.params?.focusSection || null;

  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinModalError, setJoinModalError] = useState('');
  const [isDetectionSlotPickerVisible, setIsDetectionSlotPickerVisible] = useState(false);
  const [pendingDetectionSlot, setPendingDetectionSlot] = useState(null);
  const [isRefuseModalVisible, setIsRefuseModalVisible] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isFeaturedModalVisible, setIsFeaturedModalVisible] = useState(false);
  const [isTournamentParticipationModalVisible, setIsTournamentParticipationModalVisible] = useState(false);
  const [isTournamentCreateModalVisible, setIsTournamentCreateModalVisible] = useState(false);
  const [isTournamentJoinSelectorVisible, setIsTournamentJoinSelectorVisible] = useState(false);
  const [isTournamentRegisterModalVisible, setIsTournamentRegisterModalVisible] = useState(false);
  const [selectedFeaturedScopes, setSelectedFeaturedScopes] = useState({
    CM: false,
    PUBLIC: false,
    SECTION: false,
  });
  const [tournamentTeamNameDraft, setTournamentTeamNameDraft] = useState('');
  const [pendingTournamentAction, setPendingTournamentAction] = useState(null);
  const [isExportSheetVisible, setIsExportSheetVisible] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isTrainingOpenModalVisible, setIsTrainingOpenModalVisible] = useState(false);
  const [selectedParticipationId, setSelectedParticipationId] = useState('');
  // 🎛️ L'UNIQUE ETAT D'ONGLET DE LA PAGE, pour les quatre types ranges.
  // ⛔ N2 a SUPPRIME `stageDetailsTab`, le second etat qui vivait ici et ne
  // servait qu'au stage : ses deux pastilles dessinees a la main creaient des
  // onglets DANS un onglet. Un seul mecanisme, un seul etat — c'est la
  // condition pour que « Aperçu » veuille dire la meme chose partout.
  const [detailsTab, setDetailsTab] = useState('overview');
  // L4-B : le panneau d'organisation n'est plus un accordeon dans la colonne,
  // c'est une FEUILLE ouverte par le ⋯ de la barre du haut. Elle part fermee,
  // pour la meme raison qu'avant D4 : ouverte, elle cache la page entiere.
  const [isEventActionsSheetOpen, setIsEventActionsSheetOpen] = useState(false);
  // N4 (D5) : `null` = feuille fermee ; une CHAINE (meme vide) = feuille
  // ouverte, la chaine etant l'equipe a pre-cocher. Un booleen a cote d'une
  // clef ferait deux etats a garder d'accord — et un jour ils divergeraient.
  /** @type {[string | null, (v: string | null) => void]} */
  const [remindSheetTeamKey, setRemindSheetTeamKey] = useState(null);
  const [isMatchStatsPromptVisible, setIsMatchStatsPromptVisible] = useState(false);
  const [dismissedMatchStatsPromptKey, setDismissedMatchStatsPromptKey] = useState(null);
  const [areDeferredQueriesEnabled, setAreDeferredQueriesEnabled] = useState(false);
  const [isSubscriptionFollowUpVisible, setIsSubscriptionFollowUpVisible] = useState(false);
  const firstFocusRefreshRef = useRef(true);
  const lastFocusRefreshAtRef = useRef(0);
  const openedEventIdRef = useRef('');
  const primaryCompletedEventIdRef = useRef('');
  const firstRenderedEventIdRef = useRef('');
  const secondaryCompletedEventIdRef = useRef('');
  const creationCelebrationShownRef = useRef(false);
  const subscriptionFollowUpShownRef = useRef(false);

  const [isLateModalVisible, setIsLateModalVisible] = useState(false);
  const [lateModalMode, setLateModalMode] = useState(/** @type {'coach_mark' | 'coach_edit' | 'player_declare' | 'player_update'} */ ('coach_mark'));
  const [lateModalUser, setLateModalUser] = useState(/** @type {User | null} */ (null));
  const [lateModalMinutes, setLateModalMinutes] = useState('0');
  const [lateModalArrivedAt, setLateModalArrivedAt] = useState(/** @type {string | null} */ (null));
  const [lateModalNote, setLateModalNote] = useState('');
  const [elapsedSinceServerNowMs, setElapsedSinceServerNowMs] = useState(0);
  const [selfArrivalMarkedLocal, setSelfArrivalMarkedLocal] = useState(false);

  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    canEditClub,
    canEditEvent,
    canManageEvent,
    freeUsageSummary,
    subscriptionAccessLevel,
    userData,
  } = useAuth();
  const { sendMessage } = useMessaging();
  const currentEventPublishQuotaItem = useMemo(
    () => getSubscriptionQuotaItem(freeUsageSummary, 'EVENT_PUBLISH', subscriptionAccessLevel),
    [freeUsageSummary, subscriptionAccessLevel],
  );
  const remainingEventPublishQuota = useMemo(() => {
    if (currentEventPublishQuotaItem) {
      return currentEventPublishQuotaItem.remaining;
    }

    return Math.max(
      0,
      Number(subscriptionFollowUp?.beforeRemaining || 0) - Number(subscriptionFollowUp?.consumedCount || 1),
    );
  }, [
    currentEventPublishQuotaItem,
    subscriptionFollowUp?.beforeRemaining,
    subscriptionFollowUp?.consumedCount,
  ]);
  const totalEventPublishQuota = currentEventPublishQuotaItem?.total
    || Number(subscriptionFollowUp?.total || 0);
  const shouldSuggestSubscriptionAfterCreate = Boolean(
    fromEventCreation
    && subscriptionFollowUp
    && subscriptionAccessLevel === 'FREE',
  );

  const {
    data: event,
    dataUpdatedAt: eventDataUpdatedAt,
    error,
    isFetching: isEventFetching,
    isLoading,
    refetch,
  } = useGetEvent(eventId || '', {
    refetchOnMount: fromEventCreation ? 'always' : false,
    staleTime: fromEventCreation ? 0 : EVENT_DETAILS_STALE_MS,
  });
  const hasLoadedEvent = Boolean(event);

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
    const task = InteractionManager.runAfterInteractions(() => {
      celebrationDelay = setTimeout(() => {
        celebrate(
          resolvedCreationCelebration?.actionKey || 'event_created',
          resolvedCreationCelebration?.payload || {},
        );
        creationCelebrationShownRef.current = true;
      }, 220);
    });

    return () => {
      task?.cancel?.();
      if (celebrationDelay) {
        clearTimeout(celebrationDelay);
      }
    };
  }, [creationCelebration, event, eventId, fromEventCreation]);

  useEffect(() => {
    if (!shouldSuggestSubscriptionAfterCreate || subscriptionFollowUpShownRef.current) {
      return undefined;
    }

    let openDelay = null;
    const task = InteractionManager.runAfterInteractions(() => {
      openDelay = setTimeout(() => {
        setIsSubscriptionFollowUpVisible(true);
        subscriptionFollowUpShownRef.current = true;
        if (typeof navigation?.setParams === 'function') {
          navigation.setParams({ subscriptionFollowUp: undefined });
        }
      }, 620);
    });

    return () => {
      task?.cancel?.();
      if (openDelay) {
        clearTimeout(openDelay);
      }
    };
  }, [navigation, shouldSuggestSubscriptionAfterCreate]);

  // L33 — cap sur le CARROUSEL : la relance qui suit une publication parle de
  // quotas, donc elle doit ouvrir des offres achetables, pas la page de gestion.
  // L40 — et on note d'ou part la personne : apres l'achat, l'ecran de succes la
  // ramene sur CET evenement au lieu de l'accueil. La cible s'exprime depuis la
  // RACINE (`EventStack` + l'ecran), le seul niveau que l'ecran de succes sache
  // viser — un nom de feuille y echouerait en silence (R06).
  const handleOpenSubscriptionOverview = useCallback(() => {
    setIsSubscriptionFollowUpVisible(false);
    navigation.navigate(RouteNames.ProfileStack, {
      params: {
        resumeRouteName: RouteNames.EventStack,
        resumeRouteParams: { params: { eventId }, screen: RouteNames.EventDetails },
      },
      screen: RouteNames.SubscriptionOffers,
    });
  }, [eventId, navigation]);

  useEffect(() => {
    const safeEventId = String(eventId || '');
    if (!safeEventId || openedEventIdRef.current === safeEventId) return;
    openedEventIdRef.current = safeEventId;
    primaryCompletedEventIdRef.current = '';
    firstRenderedEventIdRef.current = '';
    secondaryCompletedEventIdRef.current = '';
    firstFocusRefreshRef.current = true;
    markEventDetailsPerf('event_detail_open_started', {
      eventId: safeEventId,
    });
  }, [eventId]);

  useEffect(() => {
    const safeEventId = String(eventId || '');
    if (!safeEventId || !hasLoadedEvent || isLoading || primaryCompletedEventIdRef.current === safeEventId) return;
    primaryCompletedEventIdRef.current = safeEventId;
    markEventDetailsPerf('event_detail_primary_query_completed', {
      eventId: safeEventId,
      fromCache: !isEventFetching,
      hasEvent: hasLoadedEvent,
    });
  }, [eventId, hasLoadedEvent, isEventFetching, isLoading]);

  useEffect(() => {
    const safeEventId = String(eventId || '');
    if (!safeEventId || !hasLoadedEvent || isLoading || firstRenderedEventIdRef.current === safeEventId) return undefined;

    const frameId = requestAnimationFrame(() => {
      firstRenderedEventIdRef.current = safeEventId;
      markEventDetailsPerf('event_detail_first_content_rendered', {
        eventId: safeEventId,
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [eventId, hasLoadedEvent, isLoading]);

  useEffect(() => {
    const safeEventId = String(eventId || '');
    setAreDeferredQueriesEnabled(false);
    if (!safeEventId || !hasLoadedEvent || isLoading) return undefined;

    const task = InteractionManager.runAfterInteractions(() => {
      setAreDeferredQueriesEnabled(true);
      markEventDetailsPerf('event_detail_secondary_queries_enabled', {
        eventId: safeEventId,
      });
    });

    return () => task.cancel?.();
  }, [event?.documentId, eventId, hasLoadedEvent, isLoading]);
  const externalMatchDisplay = useMemo(() => resolveExternalMatchDisplay(event), [event]);
  const isStageParentEvent = String(event?.eventFormat || '').toLowerCase() === 'stage_parent';
  const isStageDayEvent = String(event?.eventFormat || '').toLowerCase() === 'stage_day';
  const stageChildDays = useMemo(
    () => (Array.isArray(event?.childStageEvents) ? [...event.childStageEvents] : [])
      // @ts-ignore: FIXME: Baseline TS regression
      .sort((left, right) => new Date(left?.date || 0) - new Date(right?.date || 0)),
    [event?.childStageEvents],
  );
  const stagePeriodSummary = useMemo(() => {
    if (!isStageParentEvent || !event?.stageStartDate || !event?.stageEndDate) return '';
    const start = new Date(event.stageStartDate);
    const end = new Date(event.stageEndDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
    return `${start.toLocaleDateString('fr-FR')} - ${end.toLocaleDateString('fr-FR')}`;
  }, [event?.stageEndDate, event?.stageStartDate, isStageParentEvent]);
  const stageHoursSummary = useMemo(() => {
    if (!isStageParentEvent) return '';
    const defaultStart = String(event?.stageDefaultStartTime || '').slice(0, 5);
    const defaultEnd = String(event?.stageDefaultEndTime || '').slice(0, 5);
    const activeDays = stageChildDays.filter((day) => day?.isActive !== false);
    const hasVariableHours = activeDays.some((day) => (
      String(day?.startTime || '').slice(0, 5) !== defaultStart
      || String(day?.endTime || '').slice(0, 5) !== defaultEnd
    ));
    if (hasVariableHours) return 'Horaires variables';
    if (defaultStart && defaultEnd) return `${defaultStart} - ${defaultEnd}`;
    return '';
  }, [event?.stageDefaultEndTime, event?.stageDefaultStartTime, isStageParentEvent, stageChildDays]);
  const isTournamentEvent = normalizeEventTypeLabel(event?.type?.name).includes('tournoi');
  const tournamentTeams = useMemo(
    () => (Array.isArray(event?.tournamentTeams) ? [...event.tournamentTeams] : [])
      .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || ''))),
    [event?.tournamentTeams],
  );
  const tournamentConfig = useMemo(
    () => (event?.tournamentConfig && typeof event.tournamentConfig === 'object' ? event.tournamentConfig : {}),
    [event?.tournamentConfig],
  );
  const tournamentTeamCounters = useMemo(
    () => getTournamentStatusCounters(tournamentTeams, tournamentConfig),
    [tournamentConfig, tournamentTeams],
  );
  // 👥 N2 — COMBIEN DE PERSONNES sur ce tournoi, toutes equipes confondues.
  // ⛔ Les ACTIFS seulement (pending | present | absent) : une invitation sans
  // reponse n'est pas encore quelqu'un qui vient, et un refus n'est plus
  // personne. C'est le meme decoupage que la liste elle-meme, sinon l'onglet
  // annoncerait « Personnes · 74 » au-dessus d'une liste de 61.
  const tournamentPeopleCount = useMemo(() => tournamentTeams.reduce(
    (somme, team) => somme + getTournamentMemberBuckets(team?.members || []).activeMembers.length,
    0,
  ), [tournamentTeams]);
  const currentUserTournamentTeam = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return null;

    return tournamentTeams.find((team) => (
      Array.isArray(team?.members)
      // @ts-ignore: FIXME: Baseline TS regression
      && team.members.some((member) => (
        member?.user?.documentId === currentUserId
        && isTournamentActiveMemberStatus(member?.responseStatus)
      ))
    )) || null;
  }, [tournamentTeams, userData?.documentId]);
  const currentUserTournamentMember = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId || !currentUserTournamentTeam?.members) return null;

    // @ts-ignore: FIXME: Baseline TS regression
    return currentUserTournamentTeam.members.find((member) => (
      member?.user?.documentId === currentUserId
      && isTournamentActiveMemberStatus(member?.responseStatus)
    )) || null;
  }, [currentUserTournamentTeam, userData?.documentId]);
  const currentUserTournamentStatus = normalizeTournamentText(currentUserTournamentMember?.responseStatus);
  const currentUserPendingTournamentTeam = useMemo(
    () => getTournamentPendingMembershipForUser(tournamentTeams, userData?.documentId || ''),
    [tournamentTeams, userData?.documentId],
  );
  const managedTournamentTeam = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return null;

    return tournamentTeams.find((team) => (
      team?.captainUser?.documentId === currentUserId
      // @ts-ignore: FIXME: Baseline TS regression
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
      // @ts-ignore: FIXME: Baseline TS regression
      .filter((team) => team?.documentId && !registeredTournamentSourceTeamIds.has(team.documentId)),
    [registeredTournamentSourceTeamIds, userData?.trainedTeams],
  );
  const canCreateCustomTournamentTeam = Boolean(
    isTournamentEvent
    && !isStageDayEvent
    && event?.tournamentConfig?.allowCustomTeams !== false
    && userData?.documentId
    && !currentUserTournamentTeam
    && !currentUserPendingTournamentTeam,
  );
  const canRegisterTournamentSourceTeam = Boolean(
    isTournamentEvent
    && !isStageDayEvent
    && !currentUserTournamentTeam
    && !currentUserPendingTournamentTeam
    && availableTournamentSourceTeams.length > 0,
  );
  const joinableTournamentTeams = useMemo(
    () => tournamentTeams.filter((team) => {
      const normalizedSourceType = normalizeTournamentText(team?.sourceType);
      const normalizedStatus = normalizeTournamentText(team?.status);
      if (!team?.documentId) return false;
      if (normalizedSourceType !== 'custom_team') return false;
      if (team?.isOpenToJoinRequests !== true) return false;
      if (normalizedStatus === 'declined' || normalizedStatus === 'archived') return false;
      return true;
    }),
    [tournamentTeams],
  );
  // 🔄 CHANGER D EVENEMENT REMET L ONGLET SUR L APERÇU. Cet effet existait deja,
  // mais il ne remettait que l ancien etat du stage. Il commande desormais
  // l etat UNIQUE : sans lui, ouvrir une journee de stage depuis l onglet
  // « Jours » afficherait la journee sur un onglet qu elle n a pas.
  useEffect(() => {
    setDetailsTab('overview');
  }, [event?.documentId]);
  const eventDescriptionText = useMemo(() => {
    const rawDescription = event?.description;
    let resolvedDescription = '';
    if (typeof rawDescription === 'string') {
      resolvedDescription = rawDescription.trim();
    } else if (typeof rawDescription === 'number') {
      resolvedDescription = String(rawDescription);
    } else if (rawDescription && typeof rawDescription === 'object') {
      if (typeof rawDescription.description === 'string') {
        resolvedDescription = rawDescription.description.trim();
      } else if (typeof rawDescription.label === 'string') {
        resolvedDescription = rawDescription.label.trim();
      } else if (typeof rawDescription.address === 'string') {
        resolvedDescription = rawDescription.address.trim();
      }
    }

    const normalizedDescription = String(resolvedDescription || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const isRobotSyncPhrase = normalizedDescription.includes('match externe synchron');

    // 🤖 N7 item 1 (vague P, 23/08) — LA PHRASE-ROBOT NE SERT PLUS DE DESCRIPTION.
    // « Match externe synchronisé - Domicile » n'est pas une description, c'est
    // la trace du robot FFF. Jusqu'ici la page l'affichait en lui ACCOLANT
    // l'adversaire : la pastille N3 porte deja Domicile/Exterieur et le titre
    // porte deja « VS … ». Sur un evenement synchronise, elle s'efface donc :
    // le bloc « Description » disparait avec elle (gate `eventDescriptionText`
    // au rendu). Une VRAIE phrase ecrite par un humain sur ce meme match reste
    // affichee — la garde est la phrase-robot ET la source externe, jamais
    // l'une sans l'autre.
    if (event?.externalAutoSource && isRobotSyncPhrase) {
      return '';
    }

    if (
      externalMatchDisplay?.title
      && isRobotSyncPhrase
      && !/\bvs\b/i.test(resolvedDescription)
    ) {
      return [
        resolvedDescription,
        externalMatchDisplay.contextLabel,
        externalMatchDisplay.title,
      ]
        .filter(Boolean)
        .join(' - ');
    }

    return resolvedDescription;
  }, [
    event?.description,
    event?.externalAutoSource,
    externalMatchDisplay?.contextLabel,
    externalMatchDisplay?.title,
  ]);
  const canEdit = Boolean(canManageEvent(event));
  const trainingOpenConfig = useMemo(() => resolveTrainingOpenConfig(event || {}), [event]);
  const canManageTrainingVisibility = Boolean(canEdit && trainingOpenConfig.isTraining);
  const eventClubId = event?.team?.club?.documentId || event?.club?.documentId || '';
  const eventMultisportId = event?.team?.club?.parentMultisport?.documentId || event?.club?.parentMultisport?.documentId || '';
  const userClubId = userData?.club?.documentId || '';
  const userMultisportIds = useMemo(
    // @ts-ignore: FIXME: Baseline TS regression
    () => (userData?.multisportClubs || []).map((club) => club?.documentId).filter(Boolean),
    [userData?.multisportClubs],
  );
  const isClubManagerForEvent = Boolean(
    userData?.role?.name === USER_ROLES.president
    && userClubId
    && eventClubId
    && userClubId === eventClubId,
  );
  const canApprovePendingRequests = Boolean(
    canEditEvent(event?.team?.documentId || '')
    || isClubManagerForEvent,
  );
  const isMultisportAdminForEvent = Boolean(
    eventMultisportId
    && userMultisportIds.includes(eventMultisportId),
  );
  const canManageFeatured = Boolean(
    canEdit
    || isClubManagerForEvent
    || isMultisportAdminForEvent
    || userData?.role?.name === USER_ROLES.superAdmin,
  );
  const licenseCampaignEventId = isStageDayEvent && event?.parentEvent?.documentId
    ? event.parentEvent.documentId
    : (event?.documentId || eventId || '');
  const licenseCampaignEvent = useMemo(() => (
    isStageDayEvent && event?.parentEvent?.documentId
      ? {
        ...event.parentEvent,
        club: event?.club,
        date: event?.parentEvent?.date || event?.date,
        eventFormat: 'stage_parent',
        name: event?.parentEvent?.name || event?.name,
        stageEndDate: event?.parentEvent?.stageEndDate || event?.stageEndDate,
        stageStartDate: event?.parentEvent?.stageStartDate || event?.stageStartDate,
        team: event?.parentEvent?.team || event?.team,
        type: event?.parentEvent?.type || event?.type,
      }
      : event
  ), [
    event,
    isStageDayEvent,
  ]);
  const canManageEventLicenseCampaigns = Boolean(
    eventClubId
    && (
      canEditClub(eventClubId)
      || userData?.role?.name === USER_ROLES.superAdmin
    ),
  );
  const eventLicenseCampaignsQueryParams = useMemo(() => ({
    clubId: eventClubId,
    eventId: licenseCampaignEventId,
  }), [eventClubId, licenseCampaignEventId]);
  const eventLicenseCampaignsQuery = useLicenseCampaigns(eventLicenseCampaignsQueryParams, {
    enabled: Boolean(canManageEventLicenseCampaigns && eventClubId && licenseCampaignEventId),
  });
  const eventLicenseCampaigns = useMemo(() => {
    const queriedCampaigns = eventLicenseCampaignsQuery.data?.data;
    if (Array.isArray(queriedCampaigns)) return queriedCampaigns;
    return Array.isArray(event?.licenseCampaigns) ? event.licenseCampaigns : [];
  }, [event?.licenseCampaigns, eventLicenseCampaignsQuery.data]);

  // 💶 N2 — LA COTISATION DU STAGE : DEUX GESTES QUI EXISTAIENT DEJA COTE
  // SERVEUR ET QUE LA PAGE N'OFFRAIT PAS.
  //
  // ⚠️ Le chiffrage l'a montre : la campagne rattachee a l'evenement livre DEJA
  // neuf compteurs (total, paidCount, statusCounts, expectedCents, paidCents…)
  // et la relance groupee existe (`POST /licenses/campaigns/:id/reminders/bulk`,
  // deja branchee sur l'ecran des cotisations du club). La page de l'evenement
  // n'en lisait qu'UN SEUL — `totals.total` — pour ecrire « Cotisations liées ».
  // Il n'y avait donc rien a construire, seulement a montrer.
  //
  // ⛔ On passe par `useMutation` et NON par `useLicenseMutation` : ce dernier
  // s'appelle au MONTAGE, et les treize suites qui montent cet ecran mockent
  // `licenseQueries` sans lui. Les fonctions de service, elles, ne sont touchees
  // que dans la fermeture — jamais au rendu.
  const eventLicenseReminderMutation = useMutation({
    mutationFn: (/** @type {any} */ { campaignId, ...payload }) => (
      sendBulkLicenseReminder(campaignId, payload)
    ),
  });
  const eventLicenseAssignmentsMutation = useMutation({
    mutationFn: (/** @type {any} */ { campaignId }) => generateLicenseAssignments(campaignId),
  });

  const featuredRequestsSummary = useMemo(() => ({
    CM: {
      requestId: null,
      scopeLabel: 'Multisport',
      status: 'none',
      ...(event?.featuredRequestsSummary?.CM || {}),
    },
    PUBLIC: {
      requestId: null,
      scopeLabel: 'Public',
      status: 'none',
      ...(event?.featuredRequestsSummary?.PUBLIC || {}),
    },
    SECTION: {
      requestId: null,
      scopeLabel: 'Club',
      status: 'none',
      ...(event?.featuredRequestsSummary?.SECTION || {}),
    },
  }), [event?.featuredRequestsSummary]);

  const isTeamMember = useMemo(() => {
    const userDocId = userData?.documentId;
    if (!userDocId) return false;
    const teams = [event?.team, ...(event?.invitedTeams || [])].filter(Boolean);
    const players = teams.flatMap((team) => team?.players || []);
    const trainers = teams.flatMap((team) => team?.trainers || []);
    return players.some((player) => player?.documentId === userDocId)
      || trainers.some((trainer) => trainer?.documentId === userDocId);
  }, [event?.invitedTeams, event?.team, userData?.documentId]);
  const trainerKeysForEvent = useMemo(() => {
    const teams = [event?.team, ...(event?.invitedTeams || [])].filter(Boolean);
    return new Set(
      teams
        .flatMap((team) => team?.trainers || [])
        .map((trainer) => getUserKey(trainer))
        .filter(Boolean),
    );
  }, [event?.invitedTeams, event?.team]);

  const isCurrentUserParticipating = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return false;
    return (event?.participations || []).some(
      (/** @type {User} */ participant) => participant?.documentId === currentUserId
        && !trainerKeysForEvent.has(getUserKey(participant)),
    );
  }, [event?.participations, trainerKeysForEvent, userData?.documentId]);

  const { canAccessAttendance, canSelfMarkArrival } = useMemo(
    () => resolveEventAttendanceGate({
      canEdit,
      isCurrentUserParticipating,
      isTeamMember,
    }),
    [canEdit, isCurrentUserParticipating, isTeamMember],
  );

  const {
    data: attendancePayload,
    isFetching: isAttendanceFetching,
    refetch: refetchAttendance,
  } = useGetEventAttendance(
    eventId || '',
    {
      enabled: Boolean(eventId && canAccessAttendance && areDeferredQueriesEnabled),
    },
  );

  const eventStartAt = useMemo(() => {
    const backendStart = attendancePayload?.data?.eventStartAt;
    if (backendStart) {
      const parsed = new Date(backendStart);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return resolveEventStartAt(event);
  }, [attendancePayload?.data?.eventStartAt, event]);

  const eventEndedAt = useMemo(
    () => resolveEventEndedAt(event?.endDate, eventStartAt),
    [event?.endDate, eventStartAt],
  );

  // AC10 — l'horloge du SERVEUR, ou rien : `null` quand il ne l'a pas donnee.
  // C'est elle, et elle seule, qui decide qu'un match est fini.
  const serverClockMs = useMemo(() => {
    const backendNowRaw = attendancePayload?.data?.serverNow;
    const backendNowMs = backendNowRaw ? new Date(backendNowRaw).getTime() : NaN;
    if (Number.isNaN(backendNowMs)) return null;
    return backendNowMs + elapsedSinceServerNowMs;
  }, [attendancePayload?.data?.serverNow, elapsedSinceServerNowMs]);

  const isMatchFinished = useMemo(
    () => resolveIsMatchFinished({ eventEndedAt, serverNowMs: serverClockMs }),
    [eventEndedAt, serverClockMs],
  );

  // Le compte a rebours d'arrivee, lui, doit rester affichable meme sans le
  // serveur : il tombe alors sur l'horloge locale, comme avant AC10.
  const serverNowMs = useMemo(
    () => (serverClockMs === null ? Date.now() + elapsedSinceServerNowMs : serverClockMs),
    [elapsedSinceServerNowMs, serverClockMs],
  );

  // ==========================================================================
  // N5 (D1/D2/D5) — LA PORTE D ENTREE DE L APPEL.
  //
  // ⛔ C est `serverClockMs` qui decide, JAMAIS `serverNowMs` juste au-dessus :
  // le second retombe sur `Date.now()` quand le serveur n a rien dit — il sert
  // au compte a rebours, qui doit rester affichable sans lui. Ouvrir la porte
  // sur l horloge du telephone la rendrait cliquable alors que le serveur
  // refuse ensuite ligne par ligne.
  //
  // 🧭 La fenetre n est pas recalculee ici : `resolveAttendanceWindow` est LA
  // definition unique (celle de L5-A), serveur d abord, repli 30/120 ensuite.
  // ==========================================================================
  const attendanceCallWindow = useMemo(
    () => resolveAttendanceWindow({ event, payloadData: attendancePayload?.data }),
    [attendancePayload?.data, event],
  );

  // D5 — sans charge d appel (requete desactivee ou en vol), la carte se montre
  // avec le repli local pour que le coach VOIE la porte, mais elle ne s ouvre
  // pas : `before` est le seul etat honnete tant qu aucune fenetre n a ete
  // confirmee par le serveur.
  const nextActionMode = useMemo(() => {
    if (!attendancePayload?.data) return 'before';

    return resolveCallMode({ serverNowMs: serverClockMs, window: attendanceCallWindow });
  }, [attendanceCallWindow, attendancePayload?.data, serverClockMs]);

  // D2 — « N attendus » = l audience entiere : c est ce que la maquette
  // additionne (18 + 2 + 2). `null` quand la charge n est pas la — on ne dit
  // pas « 0 attendu » a la place de « je ne sais pas ».
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

  useEffect(() => {
    setElapsedSinceServerNowMs(0);
  }, [attendancePayload?.data?.serverNow]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setElapsedSinceServerNowMs((previous) => previous + 30000);
    }, 30000);

    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    setSelfArrivalMarkedLocal(false);
  }, [eventId]);

  const {
    data: eventParticipations,
    isFetching: isParticipationsFetching,
    refetch: refetchParticipations,
  } = useGetEventParticipations(eventId || '', undefined, {
    includeInactive: true,
    pageSize: 100,
  }, {
    enabled: Boolean(eventId && areDeferredQueriesEnabled),
  });

  const mutations = useEventMutations(eventId, refetch, refetchParticipations);
  const handleSubmitTrainingOpenConfig = useCallback(async ({
    externalParticipantLimit,
    externalParticipantValidationMode,
  }) => {
    if (!eventId) return;

    if (!Number.isFinite(externalParticipantLimit) || externalParticipantLimit < 1) {
      Alert.alert(
        t('common.error', 'Erreur'),
        'Indique combien de places externes tu veux ouvrir pour cet entraînement.',
      );
      return;
    }

    try {
      await mutations.updateEventNoNavMutation.mutateAsync({
        documentId: eventId,
        eventData: {
          externalParticipantLimit,
          externalParticipantValidationMode,
          sessionStatus: 'open',
        },
      });
      setIsTrainingOpenModalVisible(false);
    } catch (trainingOpenError) {
      Alert.alert(
        t('common.error', 'Erreur'),
        trainingOpenError?.message || 'Impossible d\'ouvrir cet entraînement pour le moment.',
      );
    }
  }, [
    eventId,
    mutations.updateEventNoNavMutation,
    t,
  ]);
  const handleCloseTraining = useCallback(async () => {
    if (!eventId) return;

    try {
      await mutations.updateEventNoNavMutation.mutateAsync({
        documentId: eventId,
        eventData: {
          sessionStatus: 'closed',
        },
      });
    } catch (trainingCloseError) {
      Alert.alert(
        t('common.error', 'Erreur'),
        trainingCloseError?.message || 'Impossible de fermer cet entraînement pour le moment.',
      );
    }
  }, [eventId, mutations.updateEventNoNavMutation, t]);
  const approveFeaturedRequestMutation = useMutation({
    mutationFn: approveFeatured,
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de valider cette demande.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['requestsHub'] });
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      refetch();
    },
  });
  const rejectFeaturedRequestMutation = useMutation({
    mutationFn: rejectFeatured,
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de refuser cette demande.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['requestsHub'] });
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      refetch();
    },
  });
  const registerTournamentTeamMutation = useMutation({
    // @ts-ignore: FIXME: Baseline TS regression
    mutationFn: ({ sourceTeamId }) => registerClubTeamToTournament(eventId, sourceTeamId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible d inscrire cette équipe au tournoi.');
    },
    onSuccess: () => {
      setIsTournamentRegisterModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      refetch();
    },
  });
  const createTournamentTeamMutation = useMutation({
    // @ts-ignore: FIXME: Baseline TS regression
    mutationFn: ({ acceptRiskDeclaration, name }) => createCustomTournamentTeam(eventId, { acceptRiskDeclaration, name }),
    onError: (mutationError) => {
      setJoinModalError(mutationError?.message || 'Impossible de créer cette équipe de tournoi.');
    },
    onSuccess: (createdTeam) => {
      setIsJoinModalVisible(false);
      setIsTournamentParticipationModalVisible(false);
      setIsTournamentCreateModalVisible(false);
      setIsTournamentJoinSelectorVisible(false);
      setPendingTournamentAction(null);
      setJoinModalError('');
      setTournamentTeamNameDraft('');
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      refetch();
      if (createdTeam?.documentId) {
        navigation.navigate(RouteNames.TournamentTeamDetails, {
          eventId,
          teamId: createdTeam.documentId,
        });
      }
    },
  });
  const requestJoinTournamentTeamMutation = useMutation({
    // @ts-ignore: FIXME: Baseline TS regression
    mutationFn: ({ acceptRiskDeclaration, teamDocumentId }) => requestJoinTournamentTeam(teamDocumentId, { acceptRiskDeclaration }),
    onError: (mutationError) => {
      setJoinModalError(mutationError?.message || 'Impossible d envoyer cette demande pour le moment.');
    },
    onSuccess: (updatedTeam) => {
      setIsJoinModalVisible(false);
      setIsTournamentParticipationModalVisible(false);
      setIsTournamentJoinSelectorVisible(false);
      setPendingTournamentAction(null);
      setJoinModalError('');
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      refetch();
      if (updatedTeam?.documentId) {
        navigation.navigate(RouteNames.TournamentTeamDetails, {
          eventId,
          teamId: updatedTeam.documentId,
        });
      }
    },
  });
  const reviewTournamentTeamMutation = useMutation({
    // @ts-ignore: FIXME: Baseline TS regression
    mutationFn: ({ status, teamDocumentId }) => reviewTournamentTeamRegistration(teamDocumentId, status),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de mettre à jour cette inscription.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      refetch();
    },
  });
  const respondTournamentPresenceMutation = useMutation({
    // @ts-ignore: FIXME: Baseline TS regression
    mutationFn: ({ status, teamDocumentId }) => respondToTournamentTeam(teamDocumentId, status),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible d enregistrer ta réponse tournoi.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      refetch();
    },
  });

  const attendanceByUserId = useMemo(() => {
    const items = /** @type {any[]} */ (attendancePayload?.data?.items || []);
    /**
     * @type {Record<string, {
     * arrivedAt?: string | null,
     * attendanceStatus?: string | null,
     * countsInTeamStats?: {
     *   absence?: boolean,
     *   attendance?: boolean,
     *   late?: boolean,
     *   rsvpYes?: boolean,
     * } | null,
     * declaredAt?: string | null,
     * declaredLateMinutes?: number | null,
     * declarationSource?: string | null,
     * finalOperationalStatus?: string | null,
     * finalizedAt?: string | null,
     * finalState?: string | null,
     * lateMinutes?: number | null,
     * rsvpStatus?: string | null,
     * source?: string | null,
     * manualOverride?: boolean,
     * note?: string | null,
     * updatedAt?: string | null,
     * updatedBy?: { firstname?: string, lastname?: string } | null
      }>} */
    const map = {};
    items.forEach((item) => {
      const userDocId = item?.user?.documentId;
      if (!userDocId) return;
      map[userDocId] = {
        arrivedAt: item?.attendance?.arrivedAt || null,
        attendanceStatus: item?.attendanceStatus || item?.attendance?.finalState || null,
        countsInTeamStats: item?.countsInTeamStats || null,
        declarationSource: item?.attendance?.declarationSource || null,
        declaredAt: item?.attendance?.declaredAt || null,
        declaredLateMinutes: item?.attendance?.declaredLateMinutes || 0,
        finalizedAt: item?.attendance?.finalizedAt || null,
        finalOperationalStatus: item?.finalOperationalStatus || null,
        finalState: item?.attendance?.finalState || null,
        lateMinutes: item?.attendance?.lateMinutes || 0,
        manualOverride: Boolean(item?.attendance?.manualOverride),
        note: item?.attendance?.note || null,
        rsvpStatus: item?.rsvpStatus || null,
        source: item?.attendance?.source || null,
        updatedAt: item?.attendance?.updatedAt || null,
        updatedBy: item?.attendance?.updatedBy || null,
      };
    });
    return map;
  }, [attendancePayload]);

  const myAttendance = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return null;
    return attendanceByUserId[currentUserId] || null;
  }, [attendanceByUserId, userData?.documentId]);

  const hasSelfArrived = Boolean(myAttendance?.arrivedAt || selfArrivalMarkedLocal);

  const selfAttendanceStatus = useMemo(() => {
    if (!canSelfMarkArrival || !eventStartAt) {
      return null;
    }

    const eventStartMs = eventStartAt.getTime();
    if (Number.isNaN(eventStartMs)) return null;
    const normalizedAttendanceStatus = String(
      myAttendance?.attendanceStatus || myAttendance?.finalState || '',
    ).trim().toLowerCase();

    if (normalizedAttendanceStatus === 'no_show') {
      return {
        accentColor: Colors.error500 || 'rgb(248, 113, 113)',
        badgeBackgroundColor: `${Colors.error500 || 'rgb(248, 113, 113)'}22`,
        badgeBorderColor: `${Colors.error500 || 'rgb(248, 113, 113)'}38`,
        badgeLabel: 'Absence enregistrée',
        badgeTextColor: Colors.error500 || 'rgb(248, 113, 113)',
        badgeValue: null,
        description: "L'événement est terminé et aucune arrivée n'a été confirmée. Un coach doit corriger le pointage si besoin.",
        hasArrived: false,
        primaryAction: null,
        secondaryAction: null,
      };
    }

    if (myAttendance?.arrivedAt) {
      const arrivedAtMs = new Date(myAttendance.arrivedAt).getTime();
      const hasValidArrival = !Number.isNaN(arrivedAtMs);

      if (hasValidArrival && arrivedAtMs < eventStartMs) {
        const earlyMinutes = Math.max(1, Math.floor((eventStartMs - arrivedAtMs) / 60000));
        return {
          accentColor: Colors.success500 || 'rgb(34, 197, 94)',
          badgeBackgroundColor: `${Colors.success500 || 'rgb(34, 197, 94)'}22`,
          badgeBorderColor: `${Colors.success500 || 'rgb(34, 197, 94)'}38`,
          badgeLabel: 'Arrive',
          badgeTextColor: Colors.success500 || 'rgb(34, 197, 94)',
          badgeValue: null,
          description: `${earlyMinutes} min avant le début de l'événement.`,
          hasArrived: true,
          primaryAction: null,
          secondaryAction: null,
        };
      }

      const lateMinutesFromRecord = Math.max(0, Number(myAttendance.lateMinutes || 0));
      const lateMinutesFromDiff = hasValidArrival && arrivedAtMs > eventStartMs
        ? Math.max(0, Math.floor((arrivedAtMs - eventStartMs) / 60000))
        : 0;
      const lateMinutes = Math.max(lateMinutesFromRecord, lateMinutesFromDiff);

      if (lateMinutes > 0) {
        return {
          accentColor: Colors.warning500 || 'rgb(245, 158, 11)',
          badgeBackgroundColor: `${Colors.warning500 || 'rgb(245, 158, 11)'}22`,
          badgeBorderColor: `${Colors.warning500 || 'rgb(245, 158, 11)'}38`,
          badgeLabel: 'Arrive',
          badgeTextColor: Colors.warning500 || 'rgb(245, 158, 11)',
          badgeValue: `+${lateMinutes} min`,
          description: 'Ton arrivée réelle a bien été enregistrée.',
          hasArrived: true,
          primaryAction: null,
          secondaryAction: null,
        };
      }

      return {
        accentColor: Colors.success500 || 'rgb(34, 197, 94)',
        badgeBackgroundColor: `${Colors.success500 || 'rgb(34, 197, 94)'}22`,
        badgeBorderColor: `${Colors.success500 || 'rgb(34, 197, 94)'}38`,
        badgeLabel: 'Arrive',
        badgeTextColor: Colors.success500 || 'rgb(34, 197, 94)',
        badgeValue: null,
        description: 'Tu es signale present a l\'heure.',
        hasArrived: true,
        primaryAction: null,
        secondaryAction: null,
      };
    }

    const declaredLateMinutes = Math.max(0, Number(myAttendance?.declaredLateMinutes || 0));
    if (declaredLateMinutes > 0) {
      return {
        accentColor: Colors.warning500 || 'rgb(245, 158, 11)',
        badgeBackgroundColor: `${Colors.warning500 || 'rgb(245, 158, 11)'}22`,
        badgeBorderColor: `${Colors.warning500 || 'rgb(245, 158, 11)'}38`,
        badgeLabel: 'Retard annonce',
        badgeTextColor: Colors.warning500 || 'rgb(245, 158, 11)',
        badgeValue: `+${declaredLateMinutes} min`,
        description: `Retard signale : +${declaredLateMinutes} min. Confirme ton arrivée une fois sur place.`,
        hasArrived: false,
        primaryAction: {
          title: 'Mettre à jour',
          type: 'declare-late',
        },
        secondaryAction: {
          title: t('eventDetails.attendanceBadge.selfArrived'),
          type: 'arrived',
        },
      };
    }

    const diffMs = eventStartMs - serverNowMs;
    if (diffMs > 0) {
      const minutesLeft = Math.max(1, Math.ceil(diffMs / 60000));
      return {
        accentColor: Colors.primary500,
        badgeBackgroundColor: `${Colors.primary500}22`,
        badgeBorderColor: `${Colors.primary500}38`,
        badgeLabel: 'Aucun signalement',
        badgeTextColor: Colors.primary500,
        badgeValue: null,
        description: `Il te reste ${minutesLeft} min pour signaler ton arrivée ou ton retard.`,
        hasArrived: false,
        primaryAction: {
          title: t('eventDetails.attendanceBadge.selfArrived'),
          type: 'arrived',
        },
        secondaryAction: {
          title: 'Je serai en retard',
          type: 'declare-late',
        },
      };
    }

    const liveLateMinutes = Math.max(0, Math.floor(Math.abs(diffMs) / 60000));
    return {
      accentColor: Colors.error500 || 'rgb(248, 113, 113)',
      badgeBackgroundColor: `${Colors.error500 || 'rgb(248, 113, 113)'}22`,
      badgeBorderColor: `${Colors.error500 || 'rgb(248, 113, 113)'}38`,
      badgeLabel: 'En attente',
      badgeTextColor: Colors.error500 || 'rgb(248, 113, 113)',
      badgeValue: liveLateMinutes > 0 ? `+${liveLateMinutes} min` : null,
      description: 'Le début est passé. Signale ton retard ou confirme ton arrivée.',
      hasArrived: false,
      primaryAction: {
        title: t('eventDetails.attendanceBadge.selfArrived'),
        type: 'arrived',
      },
      secondaryAction: {
        title: 'Je serai en retard',
        type: 'declare-late',
      },
    };
  }, [
    canSelfMarkArrival,
    Colors.error500,
    Colors.primary500,
    Colors.success500,
    Colors.warning500,
    eventStartAt,
    myAttendance?.arrivedAt,
    myAttendance?.attendanceStatus,
    myAttendance?.declaredLateMinutes,
    myAttendance?.finalState,
    myAttendance?.lateMinutes,
    serverNowMs,
    t,
  ]);

  const allEventParticipations = useMemo(() => {
    const pages = /** @type {any[]} */ (eventParticipations?.pages || []);
    const embeddedRequests = /** @type {EventParticipation[]} */ (
      Array.isArray(event?.participationRequests) ? event.participationRequests : []
    );
    /** @type {Map<string, EventParticipation>} */
    const deduped = new Map();
    embeddedRequests.forEach((/** @type {EventParticipation} */ participation) => {
      const key = participation?.documentId
        || `${getUserKey(participation?.user) || 'user'}:${participation?.participationStatus || 'status'}:${participation?.updatedAt || ''}:${participation?.isActive === false ? 'inactive' : 'active'}`;
      if (!key || deduped.has(key)) return;
      deduped.set(key, participation);
    });
    pages.forEach((page) => {
      (page?.data || []).forEach((/** @type {EventParticipation} */ participation) => {
        const key = participation?.documentId
          || `${getUserKey(participation?.user) || 'user'}:${participation?.participationStatus || 'status'}:${participation?.updatedAt || ''}:${participation?.isActive === false ? 'inactive' : 'active'}`;
        if (!key || deduped.has(key)) return;
        deduped.set(key, participation);
      });
    });
    // AA02 — le SECOND point de passage unique : toutes les listes bati es sur
    // une DEMANDE (`{ user }`) descendent d'ici — en attente, historique,
    // reponse du joueur connecte. Une demande dont la personne n'existe plus
    // n'a plus rien a montrer, et c'est vrai quel que soit son statut.
    return /** @type {EventParticipation[]} */ (
      Array.from(deduped.values()).filter((participation) => hasLivingUser(participation?.user))
    );
  }, [event?.participationRequests, eventParticipations?.pages]);

  const activeEventParticipations = useMemo(
    () => allEventParticipations.filter((participation) => participation?.isActive !== false),
    [allEventParticipations],
  );

  const currentUserParticipationState = useMemo(
    () => getCurrentUserEventParticipationState({
      missings: event?.missings,
      participationRequests: activeEventParticipations,
      participations: event?.participations,
      user: userData,
    }),
    [activeEventParticipations, event?.missings, event?.participations, userData],
  );
  const canViewPublishedComposition = useMemo(() => {
    const effectiveStatus = String(currentUserParticipationState?.effectiveStatus || '').trim().toLowerCase();
    return canEdit || isTeamMember || effectiveStatus === 'accepted' || effectiveStatus === 'missing';
  }, [canEdit, currentUserParticipationState?.effectiveStatus, isTeamMember]);

  const { hasAcceptedRequest, hasPendingRequest } = currentUserParticipationState;
  const isDetectionEvent = useMemo(
    () => normalizeEventTypeLabel(event?.type?.name).includes('detection'),
    [event?.type?.name],
  );
  const detectionRecruitmentAds = useMemo(() => {
    if (!isDetectionEvent || !Array.isArray(event?.recruitmentAds)) return [];
    // @ts-ignore: FIXME: Baseline TS regression
    return event.recruitmentAds.filter((recruitmentAd) => {
      if (!recruitmentAd?.position) return false;
      if (!recruitmentAd?.event?.documentId) return true;
      return recruitmentAd.event.documentId === event?.documentId;
    });
  }, [event?.documentId, event?.recruitmentAds, isDetectionEvent]);
  const currentUserDetectionParticipation = useMemo(() => {
    const currentUserDocumentId = userData?.documentId;
    if (!currentUserDocumentId) return null;

    return activeEventParticipations.find((participation) => (
      participation?.user?.documentId === currentUserDocumentId
      // @ts-ignore: FIXME: Baseline TS regression
      && participation?.recruitmentAd?.documentId
      && ['accepted', 'pending'].includes(String(participation?.participationStatus || '').toLowerCase())
    )) || null;
  }, [activeEventParticipations, userData?.documentId]);
  const detectionSlots = useMemo(() => (
    // @ts-ignore: FIXME: Baseline TS regression
    detectionRecruitmentAds.map((slot) => {
      const relatedParticipations = activeEventParticipations.filter(
        // @ts-ignore: FIXME: Baseline TS regression
        (participation) => participation?.recruitmentAd?.documentId === slot?.documentId,
      );
      const acceptedCount = relatedParticipations.filter(
        (participation) => participation?.participationStatus === 'accepted',
      ).length;
      const pendingCount = relatedParticipations.filter(
        (participation) => participation?.participationStatus === 'pending',
      ).length;
      const candidatesCount = Math.max(
        Array.isArray(slot?.candidates) ? slot.candidates.length : 0,
        acceptedCount + pendingCount,
      );
      const quantity = Math.max(1, Number(slot?.quantity || 1));
      const remaining = Math.max(0, quantity - acceptedCount);

      return {
        ...slot,
        acceptedCount,
        candidatesCount,
        isComplete: remaining <= 0,
        pendingCount,
        quantity,
        remaining,
      };
    })
  ), [activeEventParticipations, detectionRecruitmentAds]);
  const detectionSlotsSummary = useMemo(() => {
    // @ts-ignore: FIXME: Baseline TS regression
    const totalOpen = detectionSlots.reduce((sum, slot) => sum + (slot?.isComplete ? 0 : 1), 0);
    // @ts-ignore: FIXME: Baseline TS regression
    const totalRequested = detectionSlots.reduce((sum, slot) => sum + Number(slot?.quantity || 0), 0);

    return {
      totalOpen,
      totalRequested,
    };
  }, [detectionSlots]);
  const currentParticipationFlow = useMemo(() => resolveParticipationFlow(event, {
    detectionSlotsCount: detectionSlots.length,
    participationState: currentUserParticipationState,
    user: userData,
  }), [currentUserParticipationState, detectionSlots.length, event, userData]);
  // W01 — MEMBRE D'UNE EQUIPE CONVIEE, au sens EXACT du serveur : figurer dans
  // `players` OU dans `trainers` (`event-audience.ts:253 getTeamMembers`). On
  // appelle la fonction partagee plutot que `isTeamMember` de cet ecran, qui ne
  // regarde que l'evenement : le profil d'un encadrant porte aussi ses equipes,
  // et deux definitions de « membre » dans la meme app finiraient par diverger.
  const isConvenedTeamMember = useMemo(
    () => Boolean(resolveClientSourceTeamForUser(event, userData)),
    [event, userData],
  );
  const tournamentAwareParticipationFlow = useMemo(() => {
    if (!isTournamentEvent || isStageDayEvent || userData?.role?.name !== USER_ROLES.player) {
      return currentParticipationFlow;
    }

    if (managedTournamentTeam?.documentId) {
      return {
        ...currentParticipationFlow,
        actionLabel: 'Gérer mon équipe tournoi',
        confirmLabel: 'Gérer mon équipe tournoi',
      };
    }

    if (currentUserTournamentTeam?.documentId) {
      return {
        ...currentParticipationFlow,
        actionLabel: 'Voir mon équipe tournoi',
        confirmLabel: 'Voir mon équipe tournoi',
      };
    }

    if (currentUserPendingTournamentTeam?.documentId) {
      return {
        ...currentParticipationFlow,
        actionLabel: 'Suivre ma demande',
        confirmLabel: 'Suivre ma demande',
      };
    }

    return {
      ...currentParticipationFlow,
      actionLabel: 'Participer',
      confirmLabel: 'Participer',
    };
  }, [
    currentParticipationFlow,
    currentUserPendingTournamentTeam?.documentId,
    currentUserTournamentTeam?.documentId,
    isStageDayEvent,
    isTournamentEvent,
    managedTournamentTeam?.documentId,
    userData?.role?.name,
  ]);

  const pendingParticipations = useMemo(
    () => /** @type {EventParticipation[]} */ (
      activeEventParticipations.filter((participation) => participation.participationStatus === 'pending')
    ),
    [activeEventParticipations],
  );

  const inactiveEventParticipations = useMemo(
    () => allEventParticipations.filter((participation) => participation?.isActive === false),
    [allEventParticipations],
  );

  const {
    externalParticipationSection,
    participantsSummary,
    teamParticipationSections,
  } = useMemo(() => {
    if (!event) {
      return {
        externalParticipationSection: null,
        participantsSummary: {
          capacity: 0,
          participatingCount: 0,
        },
        teamParticipationSections: [],
      };
    }

    const teamBuckets = [
      event?.team ? {
        isHome: true,
        key: event.team.documentId || 'home-team',
        players: getEligibleTeamPlayers(event.team),
        teamName: event.team.name || 'Équipe organisatrice',
      } : null,
      ...((event?.invitedTeams || []).map((/** @type {any} */ team) => ({
        isHome: false,
        key: team?.documentId || `invited-${team?.name || 'team'}`,
        players: getEligibleTeamPlayers(team),
        teamName: team?.name || 'Équipe invitée',
      }))),
    ].filter(Boolean);

    const knownTeamPlayerKeys = new Set(
      teamBuckets
        .flatMap((bucket) => bucket.players || [])
        .map((/** @type {User} */ player) => getUserKey(player))
        .filter(Boolean),
    );
    const knownTeamSectionKeys = new Set(teamBuckets.map((bucket) => bucket.key));
    const teamKeyByUserKey = new Map();
    const teamNameByUserKey = new Map();
    teamBuckets.forEach((bucket) => {
      (bucket.players || []).forEach((/** @type {User} */ player) => {
        const userKey = getUserKey(player);
        if (!userKey || teamKeyByUserKey.has(userKey)) return;
        teamKeyByUserKey.set(userKey, bucket.key);
        teamNameByUserKey.set(userKey, bucket.teamName);
      });
    });

    const participatingUsers = filterUsersByExcludedKeys(event?.participations || [], trainerKeysForEvent);
    const missingUsers = filterUsersByExcludedKeys(event?.missings || [], trainerKeysForEvent);
    const participatingKeys = new Set(participatingUsers.map((/** @type {User} */ participant) => getUserKey(participant)).filter(Boolean));
    const missingKeys = new Set(missingUsers.map((/** @type {User} */ missing) => getUserKey(missing)).filter(Boolean));

    const pendingByUserKey = new Map();
    pendingParticipations.forEach((participation) => {
      const key = getUserKey(participation?.user);
      if (!key || trainerKeysForEvent.has(key)) return;
      pendingByUserKey.set(key, participation);
    });

    /** @type {Map<string, any>} */
    const historicalByTeam = new Map();
    const historicalExternal = /** @type {{ missing: User[]; participating: User[]; pending: EventParticipation[] }} */ ({
      missing: [],
      participating: [],
      pending: [],
    });
    inactiveEventParticipations
      .filter((participation) => participation?.user)
      .forEach((participation) => {
        const userKey = getUserKey(participation?.user);
        if (!userKey || trainerKeysForEvent.has(userKey)) return;
        const sourceTeamId = participation?.sourceTeam?.documentId;
        const sourceTeamKnown = Boolean(
          sourceTeamId && knownTeamSectionKeys.has(sourceTeamId),
        );
        const fallbackTeamKey = userKey ? teamKeyByUserKey.get(userKey) : null;
        const resolvedTeamKey = sourceTeamKnown ? sourceTeamId : fallbackTeamKey;
        let resolvedTeamName = null;
        if (sourceTeamKnown) {
          resolvedTeamName = participation?.sourceTeam?.name || null;
        } else if (userKey) {
          resolvedTeamName = teamNameByUserKey.get(userKey) || null;
        }
        const isExternal = !resolvedTeamKey;

        if (isExternal) {
          if (participation.participationStatus === 'missing') {
            historicalExternal.missing.push(participation.user);
          } else if (participation.participationStatus === 'accepted') {
            historicalExternal.participating.push(participation.user);
          } else if (participation.participationStatus === 'pending') {
            historicalExternal.pending.push(participation);
          }
          return;
        }

        const teamKey = resolvedTeamKey;
        const teamName = resolvedTeamName || 'Équipe retirée';
        const current = historicalByTeam.get(teamKey) || {
          key: teamKey,
          missing: [],
          participating: [],
          pending: [],
          teamName,
        };
        if (participation.participationStatus === 'missing') {
          current.missing.push(participation.user);
        } else if (participation.participationStatus === 'accepted') {
          current.participating.push(participation.user);
        } else if (participation.participationStatus === 'pending') {
          current.pending.push(participation);
        }
        historicalByTeam.set(teamKey, current);
      });

    const sections = teamBuckets.map((bucket) => {
      const participating = bucket.players.filter((/** @type {User} */ player) => participatingKeys.has(getUserKey(player)));
      const missing = bucket.players.filter((/** @type {User} */ player) => missingKeys.has(getUserKey(player)));
      const pending = bucket.players
        .map((/** @type {User} */ player) => pendingByUserKey.get(getUserKey(player)))
        .filter(Boolean);
      const notAnswered = bucket.players.filter((/** @type {User} */ player) => {
        const key = getUserKey(player);
        return !participatingKeys.has(key) && !missingKeys.has(key) && !pendingByUserKey.has(key);
      });

      const historical = historicalByTeam.get(bucket.key) || {
        missing: [],
        participating: [],
        pending: [],
      };

      return {
        ...bucket,
        allowCoachActions: canEdit,
        historical: {
          missing: uniqueUsers(historical.missing || []),
          participating: uniqueUsers(historical.participating || []),
          pending: historical.pending || [],
        },
        missing: uniqueUsers(missing),
        notAnswered: uniqueUsers(notAnswered),
        participating: uniqueUsers(participating),
        pending,
      };
    });

    const existingSectionKeys = new Set(sections.map((section) => section.key));
    historicalByTeam.forEach((historicalSection, key) => {
      if (existingSectionKeys.has(key)) return;
      sections.push({
        allowCoachActions: false,
        historical: {
          missing: uniqueUsers(historicalSection.missing || []),
          participating: uniqueUsers(historicalSection.participating || []),
          pending: historicalSection.pending || [],
        },
        isHome: false,
        key,
        missing: [],
        notAnswered: [],
        participating: [],
        pending: [],
        players: [],
        teamName: historicalSection.teamName,
      });
    });

    const externalParticipating = uniqueUsers(
      participatingUsers.filter((/** @type {User} */ user) => !knownTeamPlayerKeys.has(getUserKey(user))),
    );
    const externalMissing = uniqueUsers(
      missingUsers.filter((/** @type {User} */ user) => !knownTeamPlayerKeys.has(getUserKey(user))),
    );
    const externalPending = pendingParticipations.filter(
      (participation) => !knownTeamPlayerKeys.has(getUserKey(participation?.user)),
    );
    const externalHistorical = {
      missing: uniqueUsers(historicalExternal.missing || []),
      participating: uniqueUsers(historicalExternal.participating || []),
      pending: historicalExternal.pending || [],
    };

    const hasExternalData = externalParticipating.length > 0
      || externalMissing.length > 0
      || externalPending.length > 0
      || externalHistorical.participating.length > 0
      || externalHistorical.missing.length > 0
      || externalHistorical.pending.length > 0;

    const visibleParticipating = uniqueUsers([
      ...sections.flatMap((section) => section.participating || []),
      ...externalParticipating,
    ]);

    return {
      externalParticipationSection: hasExternalData
        ? {
          allowCoachActions: canEdit,
          historical: externalHistorical,
          isExternal: true,
          key: 'external-participants',
          missing: externalMissing,
          notAnswered: [],
          participating: externalParticipating,
          pending: externalPending,
          players: [],
          teamName: 'Participants externes',
        }
        : null,
      participantsSummary: {
        capacity: Number(event?.capacity || 0),
        participatingCount: visibleParticipating.length,
      },
      teamParticipationSections: sections,
    };
  }, [canEdit, event, inactiveEventParticipations, pendingParticipations, trainerKeysForEvent]);

  // 🎯 N4 (D5) — LES EQUIPES QU'IL Y A QUELQUE CHOSE A RELANCER.
  // C'est cette liste, et elle seule, qui decide si « Relancer » ouvre une
  // feuille de choix ou refait le geste direct d'avant : proposer un choix
  // entre zero option serait une porte qui ne mene nulle part.
  // ⛔ `external-participants` n'y entre pas : le serveur ne sait pas cibler
  // une non-equipe (`teamId` obligatoire), la ligne serait un bouton mort.
  const remindableTeamSections = useMemo(
    () => teamParticipationSections.filter(
      (/** @type {any} */ section) => (section?.notAnswered?.length || 0) > 0,
    ),
    [teamParticipationSections],
  );

  // 🗣️ N1 (b) — CE QUE L'ENTRAINEMENT OUVERT DIT ENFIN A TOUT LE MONDE.
  //
  // 🧨 LE DEFAUT : « Accueille N joueurs de l'exterieur » n'existait QUE dans la
  // carte d'organisation, reservee a `canManageTrainingVisibility`. Un joueur ou
  // un visiteur ne voyait donc NULLE PART que la seance lui etait ouverte — et
  // c'est pourtant la seule information de ce bloc qui le concerne.
  //
  // 🔒 Q14 — DES NOMBRES, JAMAIS DES NOMS. Le compte des demandes a verifier
  // reste chez l'organisateur ; le reste est public parce que le serveur le
  // publie deja : `sessionStatus`, `externalParticipantLimit` et
  // `externalParticipantValidationMode` ne sont pas `private` au schema,
  // `getEventById` n'a aucune projection `fields`, et
  // `shieldEventPayloadForViewer` masque les identites EN GARDANT les comptes.
  //
  // ⛔ Un entrainement ferme, ou ouvert sans quota, ne dit rien : « Accueille 0
  // joueur·se·s » serait pire que le silence.
  const openTrainingPublicLine = useMemo(() => {
    const quota = Number(trainingOpenConfig.externalParticipantLimit || 0);
    if (!trainingOpenConfig.isOpenTraining || quota <= 0) return '';

    const taken = externalParticipationSection?.participating?.length || 0;
    const ligne = t(
      'eventDetails.openTraining.publicLine',
      'Accueille {{quota}} joueur·se·s de l’extérieur · {{taken}} place(s) prise(s)',
      { quota, taken },
    );

    const pending = externalParticipationSection?.pending?.length || 0;
    if (!canEdit || pending <= 0) return ligne;

    const suffixe = t(
      'eventDetails.openTraining.pendingSuffix',
      '{{pending}} demande(s) à vérifier',
      { pending },
    );
    return `${ligne} · ${suffixe}`;
  }, [
    canEdit,
    externalParticipationSection,
    t,
    trainingOpenConfig.externalParticipantLimit,
    trainingOpenConfig.isOpenTraining,
  ]);

  // 🎟️ N1 (c) — LA CAPACITE D'UN « AUTRE », DANS SA PASTILLE.
  //
  // `event.capacity` existe depuis toujours au schema Strapi et descend jusqu'ici
  // dans `participantsSummary.capacity`. La pastille de type, elle, restait nue :
  // un evenement « Autre » limite a 12 places ne le disait nulle part.
  //
  // ⛔ SANS CAPACITE, PASTILLE NUE — surtout pas « Illimité » : on n'invente pas
  // une regle que personne n'a ecrite. Et la portee reste le type « Autre » : les
  // autres types ont deja leurs propres compteurs ailleurs dans la page.
  const isOtherEventType = normalizeEventTypeLabel(event?.type?.name).includes('autre');
  const typeTagSegments = useMemo(() => {
    const total = Number(participantsSummary?.capacity || 0);
    if (!isOtherEventType || total <= 0) return [];

    const taken = Number(participantsSummary?.participatingCount || 0);
    return [t('eventDetails.typeTag.capacity', '{{taken}}/{{total}} PLACES', { taken, total })];
  }, [isOtherEventType, participantsSummary, t]);

  const participationsByStatus = useMemo(() => {
    if (!canEdit) {
      return {
        missing: [],
        notAnswered: [],
        participating: filterUsersByExcludedKeys(event?.participations || [], trainerKeysForEvent),
      };
    }

    const teamPlayers = uniqueUsers([
      ...getEligibleTeamPlayers(event?.team),
      ...((event?.invitedTeams || []).flatMap((/** @type {any} */ team) => getEligibleTeamPlayers(team))),
    ]);
    const participatingPlayers = filterUsersByExcludedKeys(event?.participations || [], trainerKeysForEvent);
    const missingPlayers = filterUsersByExcludedKeys(event?.missings || [], trainerKeysForEvent);
    const pendingKeys = new Set(
      (pendingParticipations || [])
        .map((participation) => getUserKey(participation?.user))
        .filter((key) => Boolean(key) && !trainerKeysForEvent.has(key)),
    );

    const notAnsweredPlayers = teamPlayers.filter((player) => {
      const key = getUserKey(player);
      return !participatingPlayers.some((/** @type {User} */ participant) => getUserKey(participant) === key)
        && !missingPlayers.some((/** @type {User} */ missing) => getUserKey(missing) === key)
        && !pendingKeys.has(key);
    });

    return {
      missing: missingPlayers,
      notAnswered: notAnsweredPlayers,
      participating: participatingPlayers,
    };
  }, [canEdit, event, pendingParticipations, trainerKeysForEvent]);
  const applyToDetectionSlotMutation = useMutation({
    // @ts-ignore: FIXME: Baseline TS regression
    mutationFn: ({ payload = {}, slotDocumentId }) => applyToRecruitmentAd(slotDocumentId, payload),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['eventParticipations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      // @ts-ignore: FIXME: Baseline TS regression
      queryClient.invalidateQueries({ queryKey: ['recruitmentAd', variables?.slotDocumentId] });
      queryClient.invalidateQueries({ queryKey: ['myApplications'] });
      Alert.alert(
        'Detection',
        // @ts-ignore: FIXME: Baseline TS regression
        result?.message || 'Ta participation a bien été envoyée sur ce poste.',
      );
    },
  });

  const featuredScopeOptions = useMemo(() => ([
    {
      kind: 'PUBLIC',
      label: 'À la une publique',
      status: featuredRequestsSummary.PUBLIC.status,
      summary: featuredRequestsSummary.PUBLIC,
      visible: canManageFeatured,
    },
    {
      kind: 'SECTION',
      label: 'À la une dans mon club',
      status: featuredRequestsSummary.SECTION.status,
      summary: featuredRequestsSummary.SECTION,
      visible: canManageFeatured && Boolean(eventClubId),
    },
    {
      kind: 'CM',
      label: 'À la une dans le club multisport',
      status: featuredRequestsSummary.CM.status,
      summary: featuredRequestsSummary.CM,
      visible: canManageFeatured && Boolean(eventMultisportId),
    },
  ].filter((option) => option.visible)), [
    canManageFeatured,
    eventClubId,
    eventMultisportId,
    featuredRequestsSummary.CM,
    featuredRequestsSummary.PUBLIC,
    featuredRequestsSummary.SECTION,
  ]);

  const canRequestFeatured = useMemo(
    () => featuredScopeOptions.some((option) => option.status === 'none' || option.status === 'rejected'),
    [featuredScopeOptions],
  );

  const hasPendingFeaturedScope = useMemo(
    () => featuredScopeOptions.some((option) => option.status === 'pending'),
    [featuredScopeOptions],
  );

  const hasApprovedFeaturedScope = useMemo(
    () => featuredScopeOptions.some((option) => option.status === 'approved'),
    [featuredScopeOptions],
  );

  const selectedFeaturedScopeKinds = useMemo(
    () => Object.entries(selectedFeaturedScopes)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([kind]) => kind),
    [selectedFeaturedScopes],
  );

  const pendingFeaturedApproval = useMemo(() => {
    if (userData?.role?.name === USER_ROLES.superAdmin && featuredRequestsSummary.PUBLIC.status === 'pending') {
      return {
        requestId: featuredRequestsSummary.PUBLIC.requestId,
        scopeLabel: featuredRequestsSummary.PUBLIC.scopeLabel,
      };
    }

    if (isClubManagerForEvent && featuredRequestsSummary.SECTION.status === 'pending') {
      return {
        requestId: featuredRequestsSummary.SECTION.requestId,
        scopeLabel: featuredRequestsSummary.SECTION.scopeLabel,
      };
    }

    if (isMultisportAdminForEvent && featuredRequestsSummary.CM.status === 'pending') {
      return {
        requestId: featuredRequestsSummary.CM.requestId,
        scopeLabel: featuredRequestsSummary.CM.scopeLabel,
      };
    }

    return null;
  }, [
    featuredRequestsSummary.CM.requestId,
    featuredRequestsSummary.CM.scopeLabel,
    featuredRequestsSummary.CM.status,
    featuredRequestsSummary.PUBLIC.requestId,
    featuredRequestsSummary.PUBLIC.scopeLabel,
    featuredRequestsSummary.PUBLIC.status,
    featuredRequestsSummary.SECTION.requestId,
    featuredRequestsSummary.SECTION.scopeLabel,
    featuredRequestsSummary.SECTION.status,
    isClubManagerForEvent,
    isMultisportAdminForEvent,
    userData?.role?.name,
  ]);

  useEffect(() => {
    if (isFeaturedModalVisible) return;
    setSelectedFeaturedScopes({
      CM: false,
      PUBLIC: false,
      SECTION: false,
    });
  }, [isFeaturedModalVisible]);

  const computeLateMinutes = useCallback((/** @type {string | null | undefined} */ arrivedAtIso) => {
    const eventStart = eventStartAt;
    const arrivedAt = arrivedAtIso ? new Date(arrivedAtIso) : null;
    if (!eventStart || !arrivedAt || Number.isNaN(arrivedAt.getTime())) return 0;
    const diffMs = arrivedAt.getTime() - eventStart.getTime();
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / 60000);
  }, [eventStartAt]);

  const handleEditEvent = useCallback(() => {
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId },
      screen: RouteNames.EventEdit,
    });
  }, [eventId, navigation]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleOpenTournamentTeam = useCallback((teamDocumentId) => {
    if (!teamDocumentId) return;
    navigation.navigate(RouteNames.TournamentTeamDetails, {
      eventId,
      teamId: teamDocumentId,
    });
  }, [eventId, navigation]);

  const handleOpenTournamentManagement = useCallback(() => {
    if (!eventId) return;
    navigation.navigate(RouteNames.TournamentManagement, { eventId });
  }, [eventId, navigation]);

  const handleOpenTournamentSettings = useCallback(() => {
    if (!eventId) return;
    navigation.navigate(RouteNames.TournamentSettingsEdit, { eventId });
  }, [eventId, navigation]);

  // D21 ③ : l'affiche de l'evenement EXISTE (`EventPublishedShowcase`), mais
  // elle n'etait atteignable QUE juste apres la creation — le recap du tunnel
  // l'empile derriere le detail par un `navigation.reset`, et une fois fermee
  // plus rien n'y ramenait. On rouvre EXACTEMENT le meme chemin : meme route,
  // meme parametre `eventId`. Seule la celebration de creation est omise —
  // rejouer des confettis sur une simple consultation serait un mensonge.
  // D28 : le gabarit voyage en PARAMETRE, decide par le TYPE de l'evenement.
  // Sans lui, l'ecran retombait sur `params.template || 'affiche-detection'` :
  // un match rouvert d'ici recevait l'affiche de detection par accident, pas par
  // choix. Le type est deja charge ici (`event.type.name`), aucun appel de plus.
  const handleOpenEventPoster = useCallback(() => {
    if (!eventId) return;
    navigation.navigate(RouteNames.EventPublishedShowcase, {
      eventId,
      // D94/C2 : le type voyage aussi, pour que le TEXTE du partage le suive
      // comme le gabarit — sans lui, un match repartait avec « viens essayer ».
      eventTypeName: event?.type?.name,
      template: getEventShowcaseTemplate(event?.type?.name),
    });
  }, [event?.type?.name, eventId, navigation]);

  // D99 : L'AIGUILLAGE qui remplace l'affiche sur un entrainement. On ouvre la
  // 1re etape du tunnel de creation — le choix du type — parce que c'est la que
  // « Detection / Seance d'essai » se choisit, et que sa ligne d'explication y
  // dit deja « Ouvre ton equipe a de nouveaux joueurs » (EventWizardType.js).
  //
  // ⛔ ON N'AMORCE PAS LE TYPE A LA PLACE DE L'ORGANISATEUR : `SET_TYPE` est
  // pose par l'ecran au toucher, et c'est lui qui calcule la suite de la chaine
  // (une detection gagne ses postes). Sauter l'etape le priverait de ce calcul.
  //
  // Le motif de navigation est celui que 5 appelants emploient deja pour ouvrir
  // ce tunnel de l'exterieur (HomeHub, TeamDetails, ParticipantEventList,
  // MultisportClubDetails, CMDashboard) : la pile, puis l'ecran (§1 bis,
  // barreau 2 — on ne reinvente pas un chemin qui existe).
  const handleCreateDetection = useCallback(() => {
    navigation.navigate(RouteNames.EventStack, { screen: RouteNames.EventWizardType });
  }, [navigation]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleRespondTournamentPresence = useCallback((status) => {
    if (!currentUserTournamentTeam?.documentId) return;
    // @ts-ignore: FIXME: Baseline TS regression
    respondTournamentPresenceMutation.mutate({
      status,
      teamDocumentId: currentUserTournamentTeam.documentId,
    });
  }, [currentUserTournamentTeam?.documentId, respondTournamentPresenceMutation]);

  const closeTournamentParticipationFlow = useCallback(() => {
    setIsTournamentParticipationModalVisible(false);
    setIsTournamentCreateModalVisible(false);
    setIsTournamentJoinSelectorVisible(false);
    setPendingTournamentAction(null);
    setJoinModalError('');
  }, []);

  const handleOpenTournamentParticipationOptions = useCallback(() => {
    if (userData?.role?.name !== USER_ROLES.player) return;

    if (!canCreateCustomTournamentTeam && joinableTournamentTeams.length === 0) {
      Alert.alert(
        'Tournoi',
        'Aucune équipe tournoi ouverte ne peut être rejointe pour le moment.',
      );
      return;
    }

    setPendingDetectionSlot(null);
    setJoinModalError('');
    setPendingTournamentAction(null);
    setIsTournamentCreateModalVisible(false);
    setIsTournamentJoinSelectorVisible(false);
    setIsTournamentParticipationModalVisible(true);
  }, [
    canCreateCustomTournamentTeam,
    joinableTournamentTeams.length,
    userData?.role?.name,
  ]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleSelectExistingTournamentTeam = useCallback((team) => {
    if (!team?.documentId) return;
    setPendingTournamentAction({
      // @ts-ignore: FIXME: Baseline TS regression
      mode: 'join_existing',
      teamDocumentId: team.documentId,
      teamName: team?.name || 'Équipe tournoi',
    });
    setIsTournamentJoinSelectorVisible(false);
    setJoinModalError('');
    setIsJoinModalVisible(true);
  }, []);

  const handleCreateTournamentTeam = useCallback(() => {
    const trimmedName = String(tournamentTeamNameDraft || '').trim();
    if (!trimmedName) {
      Alert.alert('Équipe tournoi', 'Ajoute un nom d équipe avant de continuer.');
      return;
    }

    setPendingTournamentAction({
      // @ts-ignore: FIXME: Baseline TS regression
      mode: 'create_custom',
      teamName: trimmedName,
    });
    setIsTournamentParticipationModalVisible(false);
    setIsTournamentCreateModalVisible(false);
    setJoinModalError('');
    setIsJoinModalVisible(true);
  }, [tournamentTeamNameDraft]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleReviewTournamentTeam = useCallback((teamDocumentId, status) => {
    // @ts-ignore: FIXME: Baseline TS regression
    reviewTournamentTeamMutation.mutate({ status, teamDocumentId });
  }, [reviewTournamentTeamMutation]);

  // @ts-ignore: FIXME: Baseline TS regression
  const toggleFeaturedScope = useCallback((kind) => {
    setSelectedFeaturedScopes((previous) => ({
      ...previous,
      // @ts-ignore: FIXME: Baseline TS regression
      [kind]: !previous[kind],
    }));
  }, []);

  const handleSubmitFeaturedScopes = useCallback(() => {
    if (!selectedFeaturedScopeKinds.length || !eventId) return;
    setIsFeaturedModalVisible(false);
    mutations.requestFeaturedMutation.mutate({
      eventId,
      scopes: selectedFeaturedScopeKinds,
    });
  }, [eventId, mutations.requestFeaturedMutation, selectedFeaturedScopeKinds]);

  const handleRejectFeaturedApproval = useCallback(() => {
    if (!pendingFeaturedApproval?.requestId) return;
    Alert.alert(
      'Refuser la demande ?',
      'Le demandeur sera notifié du refus.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => rejectFeaturedRequestMutation.mutate({ requestId: pendingFeaturedApproval.requestId }),
          style: 'destructive',
          text: 'Refuser',
        },
      ],
    );
  }, [pendingFeaturedApproval?.requestId, rejectFeaturedRequestMutation]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleApplyToDetectionSlot = useCallback((slot) => {
    const slotDocumentId = slot?.documentId;
    if (!slotDocumentId || applyToDetectionSlotMutation.isPending) return;
    setPendingDetectionSlot(slot);
    setJoinModalError('');
    setIsJoinModalVisible(true);
  }, [applyToDetectionSlotMutation.isPending]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleOpenDetectionSlot = useCallback((slot) => {
    if (!slot?.documentId) return;
    navigation.navigate(RouteNames.RecruitmentAdDetails, {
      ad: slot,
      adId: slot.documentId,
    });
  }, [navigation]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleBlockedParticipationFlow = useCallback((flow) => {
    if (!flow?.blockedReason) return;
    Alert.alert('Participation', flow.blockedReason);
  }, []);

  const handleJoinEvent = useCallback(() => {
    if (isTournamentEvent && !isStageDayEvent && userData?.role?.name === USER_ROLES.player) {
      if (managedTournamentTeam?.documentId) {
        handleOpenTournamentTeam(managedTournamentTeam.documentId);
        return;
      }
      if (currentUserTournamentTeam?.documentId) {
        handleOpenTournamentTeam(currentUserTournamentTeam.documentId);
        return;
      }
      if (currentUserPendingTournamentTeam?.documentId) {
        handleOpenTournamentTeam(currentUserPendingTournamentTeam.documentId);
        return;
      }
      handleOpenTournamentParticipationOptions();
      return;
    }

    if (currentParticipationFlow?.submitMode === 'redirect-parent') {
      const parentEventId = event?.parentEvent?.documentId;
      if (parentEventId) {
        navigation.navigate(RouteNames.EventDetails, { eventId: parentEventId });
      }
      return;
    }

    if (currentParticipationFlow?.submitMode === 'detection-slot-picker') {
      setIsJoinModalVisible(false);
      setIsDetectionSlotPickerVisible(true);
      return;
    }

    if (!currentParticipationFlow?.canAct) {
      handleBlockedParticipationFlow(currentParticipationFlow);
      return;
    }

    // AA01 — un membre d une equipe conviee REPOND, il ne demande pas : pas de
    // declaration de responsabilite, et la porte des reponses. Voir le motif
    // complet dans `participationFlow.js`.
    if (currentParticipationFlow?.submitMode === 'rsvpPresent' && event?.documentId) {
      // @ts-ignore: FIXME: Baseline TS regression
      mutations.respondToEventRsvpMutation.mutate({
        answer: 'present',
        eventId: event.documentId,
      });
      return;
    }

    setJoinModalError('');
    setIsJoinModalVisible(true);
  }, [
    currentParticipationFlow,
    event?.documentId,
    event?.parentEvent?.documentId,
    mutations.respondToEventRsvpMutation,
    handleBlockedParticipationFlow,
    handleOpenTournamentParticipationOptions,
    handleOpenTournamentTeam,
    currentUserPendingTournamentTeam?.documentId,
    currentUserTournamentTeam?.documentId,
    isStageDayEvent,
    isTournamentEvent,
    managedTournamentTeam?.documentId,
    navigation,
    userData?.role?.name,
  ]);

  const handleParticipateToEvent = useCallback((eventToParticipate = event) => {
    const targetEventId = eventToParticipate?.documentId;
    const targetIsStageDay = String(eventToParticipate?.eventFormat || '').toLowerCase() === 'stage_day';
    if (targetIsStageDay && targetEventId) {
      // @ts-ignore: FIXME: Baseline TS regression
      mutations.respondToEventRsvpMutation.mutate({
        answer: 'present',
        eventId: targetEventId,
      });
      return;
    }

    handleJoinEvent();
  }, [event, handleJoinEvent, mutations.respondToEventRsvpMutation]);

  const handleConfirmParticipation = useCallback(async () => {
    if (!event?.documentId) return;

    if (!currentParticipationFlow?.canAct) {
      handleBlockedParticipationFlow(currentParticipationFlow);
      return;
    }

    setJoinModalError('');

    try {
      if (currentParticipationFlow.submitMode === 'joinReservation') {
        await mutations.joinReservationMutation.mutateAsync(event.documentId);
      } else {
        if (!userData?.documentId) return;
        await mutations.createEventParticipationMutation.mutateAsync({
          event: event.documentId,
          user: userData.documentId,
        });
      }

      setIsJoinModalVisible(false);
      setPendingDetectionSlot(null);
    } catch (mutationError) {
      setJoinModalError(
        getParticipationErrorMessage(mutationError, 'Impossible de confirmer ta participation pour le moment.'),
      );
    }
  }, [
    currentParticipationFlow,
    event?.documentId,
    handleBlockedParticipationFlow,
    mutations.createEventParticipationMutation,
    mutations.joinReservationMutation,
    userData?.documentId,
  ]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleApplyToDetectionSlotFromPicker = useCallback((slot) => {
    const slotDocumentId = String(slot?.documentId || '').trim();
    if (!slotDocumentId || applyToDetectionSlotMutation.isPending) return;
    setIsDetectionSlotPickerVisible(false);
    setPendingDetectionSlot(slot);
    setJoinModalError('');
    setIsJoinModalVisible(true);
  }, [applyToDetectionSlotMutation.isPending]);

  const handleDeclineEvent = (/** @type {any} */ eventToDecline) => {
    if (!eventToDecline?.documentId) return;
    if (String(eventToDecline?.eventFormat || '').toLowerCase() === 'stage_day') {
      // @ts-ignore: FIXME: Baseline TS regression
      mutations.respondToEventRsvpMutation.mutate({
        answer: 'absent',
        eventId: eventToDecline.documentId,
      });
      return;
    }
    mutations.missingEventMutation.mutate(eventToDecline.documentId);
  };

  // 🎯 N4 (D5) — RELANCER DEVIENT UN CHOIX, QUAND IL Y A UN CHOIX A FAIRE.
  //
  // Un amical, un tournoi ou un stage reunit PLUSIEURS equipes, et le serveur
  // n'accepte qu'un `teamId` par appel : « relancer les sans-reponse » ne
  // pouvait donc viser personne en particulier. La feuille pose la question.
  //
  // ⛔ MAIS SEULEMENT S'IL Y A UNE QUESTION. Sur la liste plate (aucune section
  // d'equipe — le cas le plus courant), il n'y a rien a cocher : la feuille
  // afficherait « personne a relancer » alors qu'il y a du monde. Ce chemin-la
  // garde donc EXACTEMENT le geste d'avant, modale comprise.
  const handleRemindPlayers = (/** @type {string | undefined} */ teamKey) => {
    if (!eventId) return;
    if (!remindableTeamSections.length) {
      mutations.remindEventMutation.mutate(eventId);
      return;
    }
    setRemindSheetTeamKey(typeof teamKey === 'string' ? teamKey : '');
  };

  const handleUserPress = (/** @type {User | null | undefined} */ user) => {
    if (!user?.documentId) return;
    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: user.documentId },
      screen: RouteNames.UserDetails,
    });
  };

  const handleUpdateParticipation = (
    /** @type {string | undefined} */ participationId,
    /** @type {string | undefined} */ status,
  ) => {
    if (!participationId) return;
    setSelectedParticipationId(participationId);

    if (status === 'accepted') {
      Alert.alert(t('eventDetails.modals.accept.title'), '', [
        { onPress: () => setSelectedParticipationId(''), style: 'cancel', text: t('eventDetails.modals.actions.cancel') },
        {
          onPress: () => {
            mutations.acceptParticipationMutation.mutate(participationId);
            setSelectedParticipationId('');
          },
          text: t('eventDetails.modals.actions.confirm'),
        },
      ]);
      return;
    }

    if (status === 'declined') {
      setIsRefuseModalVisible(true);
    }
  };

  const handleBackAfterCreation = useCallback(() => {
    const parentNavigation = navigation.getParent();
    if (parentNavigation?.canGoBack?.()) {
      parentNavigation.goBack();
      return;
    }

    navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.MyEventList });
  }, [navigation]);

  const handleDeleteParticipation = useCallback(() => {
    const { kind, participationId } = resolveOwnAnswerAction({
      activeEventParticipations,
      event,
      user: userData,
    });

    if (kind === OwnAnswerAction.none) return;

    if (kind === OwnAnswerAction.deleteParticipation) {
      Alert.alert(
        t('eventDetails.modals.deleteParticipation.title'),
        t('eventDetails.modals.deleteParticipation.description'),
        [
          { style: 'cancel', text: t('eventDetails.modals.deleteParticipation.actions.cancel') },
          {
            onPress: () => mutations.deleteParticipationMutation.mutate(participationId),
            style: 'destructive',
            text: t('eventDetails.modals.deleteParticipation.actions.confirm'),
          },
        ],
      );
      return;
    }

    if (kind === OwnAnswerAction.switchToPresent) {
      Alert.alert(
        t('eventDetails.modals.editResponse.title'),
        t('eventDetails.modals.editResponse.description'),
        [
          { style: 'cancel', text: t('eventDetails.modals.actions.cancel') },
          {
            onPress: () => {
              if (!event?.documentId) return;
              // 🥇 AA01 — LA BASCULE DU CONSTAT D ADEL (2026-08-20).
              //
              // Cette ligne appelait `POST /event-participations`, la porte des
              // DEMANDES : sur un evenement a validation manuelle, la reponse
              // naissait « en attente », et « en attente » n entre ni dans
              // `participations` ni dans `missings` cote serveur
              // (`event-audience.ts:917`). L ecran affichait donc « sans
              // reponse » — la reponse donnee etait perdue.
              //
              // 🎯 Une bascule est UN geste, par la porte des REPONSES.
              // `applyRsvp` desactive l ancienne reponse AVANT d en creer une
              // nouvelle et resynchronise les relations : il ne reste jamais
              // absent ET present. ⛔ Surtout pas un rattrapage cote app
              // (supprimer puis recreer) — deux appels, deux occasions de finir
              // a moitie.
              // @ts-ignore: FIXME: Baseline TS regression
              mutations.respondToEventRsvpMutation.mutate({
                answer: 'present',
                eventId: event.documentId,
              });
              setIsJoinModalVisible(false);
            },
            text: t('eventDetails.modals.actions.confirm'),
          },
        ],
      );
      return;
    }

    if (kind === OwnAnswerAction.declareMissing) {
      Alert.alert(
        t('eventDetails.modals.deleteParticipation.title'),
        t('eventDetails.modals.deleteParticipation.description'),
        [
          { style: 'cancel', text: t('eventDetails.modals.deleteParticipation.actions.cancel') },
          {
            onPress: () => mutations.missingEventMutation.mutate(event.documentId),
            style: 'destructive',
            text: t('eventDetails.modals.deleteParticipation.actions.confirm'),
          },
        ],
      );
      return;
    }

    Alert.alert(
      t('common.error'),
      'Impossible de retrouver ta réponse pour cet événement. Recharge la page et réessaie.',
    );
  }, [
    activeEventParticipations,
    event,
    mutations,
    t,
    userData,
  ]);

  // AD10 — « Exporter » OUVRE LA FEUILLE, il ne telecharge plus rien.
  // Avant : un appui sortait directement un classeur de 8 colonnes, dont
  // l e-mail et le telephone de tout le monde, sans un mot. La feuille livree
  // par AD05 (`EventExportSheet`) nomme les 8 colonnes et porte la bascule
  // « Retirer e-mails et telephones » ; c est ELLE qui lance le telechargement.
  const handleExportParticipants = useCallback(() => {
    if (!eventId) return;
    setIsExportSheetVisible(true);
  }, [eventId]);

  const handleConfirmExport = useCallback(async (
    /** @type {{ withoutContacts?: boolean }} */ options,
  ) => {
    setIsExportSheetVisible(false);
    if (!eventId) return;
    const withoutContacts = Boolean(options?.withoutContacts);
    Alert.alert(t('common.loading'), t('eventDetails.exporting'));
    try {
      const path = await exportEventParticipants(
        eventId,
        event?.name || 'participants',
        { withoutContacts },
      );
      if (Platform.OS === 'ios') {
        setTimeout(() => {
          SharePlatform.share({ title: 'Participants', url: path }).catch(() => undefined);
        }, 500);
      } else {
        ReactNativeBlobUtil.android
          .actionViewIntent(path, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          .catch(() => Alert.alert(t('common.success'), t('eventDetails.exportSuccess')));
      }
    } catch (exportError) {
      Alert.alert(t('common.error'), t('eventDetails.exportError'));
    }
  }, [event?.name, eventId, t]);

  const handleShareEventInChat = useCallback((/** @type {string} */ chatId) => {
    const sentMessageId = sendMessage(chatId, 'Partage', { event: eventId || '' });

    if (!sentMessageId) {
      Alert.alert(
        t('common.error'),
        t('event.shareInChatError', 'Impossible de partager l\'événement pour le moment.'),
      );
      return;
    }

    setIsShareModalVisible(false);
    setTimeout(() => {
      Alert.alert(
        t('event.shareInChatSuccessTitle', 'Événement partage'),
        t(
          'event.shareInChatSuccessDescription',
          'Ton événement a bien été partage. Appuie sur OK pour ouvrir la conversation.',
        ),
        [
          {
            onPress: () => navigation.navigate(RouteNames.Conversation, { chatId }),
            text: 'OK',
          },
        ],
      );
    }, 120);
  }, [eventId, navigation, sendMessage, t]);

  const handleCancelEvent = useCallback(() => {
    if (!eventId) return;
    if (event?.recurrenceGroupId) {
      Alert.alert(
        t('eventDetails.modals.recurrenceCancel.title'),
        t('eventDetails.modals.recurrenceCancel.description'),
        [
          { style: 'cancel', text: t('eventDetails.modals.actions.cancel') },
          {
            onPress: () => mutations.cancelEventMutation.mutate({ documentId: eventId }),
            style: 'destructive',
            text: t('eventDetails.modals.recurrenceCancel.actions.thisEvent'),
          },
          {
            onPress: () => mutations.cancelEventMutation.mutate({
              documentId: eventId,
              recurrenceMode: 'future',
            }),
            style: 'destructive',
            text: t('eventDetails.modals.recurrenceCancel.actions.future'),
          },
          {
            onPress: () => mutations.cancelEventMutation.mutate({
              documentId: eventId,
              recurrenceMode: 'all',
            }),
            style: 'destructive',
            text: t('eventDetails.modals.recurrenceCancel.actions.all'),
          },
        ],
      );
      return;
    }

    Alert.alert(
      t('eventDetails.modals.cancelEvent.title'),
      t('eventDetails.modals.cancelEvent.description'),
      [
        { style: 'cancel', text: t('eventDetails.modals.actions.cancel') },
        {
          onPress: () => mutations.cancelEventMutation.mutate({ documentId: eventId }),
          style: 'destructive',
          text: t('eventDetails.modals.actions.confirm'),
        },
      ],
    );
  }, [event?.recurrenceGroupId, eventId, mutations.cancelEventMutation, t]);

  // D4 : les deux menus intermediaires (« Actions evenement » et « Actions
  // tournoi ») ont ete supprimes. Chaque chip du panneau compact appelle
  // directement son handler — un tap au lieu de deux, et parfois trois pour un
  // tournoi. Verifie orphelins par recherche avant suppression.

  const openEventLicenseCampaignSettings = useCallback(() => {
    if (!eventClubId || !licenseCampaignEventId) return;
    const navigateToCampaignSettings = () => navigation.navigate(RouteNames.ClubStack, {
      params: {
        clubId: eventClubId,
        createNew: true,
        event: licenseCampaignEvent,
        eventId: licenseCampaignEventId,
      },
      screen: RouteNames.ClubLicenseCampaignSettings,
    });

    if (eventLicenseCampaigns.length > 0) {
      Alert.alert(
        'Campagne déjà liée',
        'Cet événement a déjà une campagne de cotisation. Crée-en une autre seulement si tu veux un paiement distinct.',
        [
          { style: 'cancel', text: t('common.cancel', 'Annuler') },
          {
            onPress: navigateToCampaignSettings,
            text: 'Créer quand même',
          },
        ],
      );
      return;
    }

    navigateToCampaignSettings();
  }, [
    eventClubId,
    eventLicenseCampaigns.length,
    licenseCampaignEvent,
    licenseCampaignEventId,
    navigation,
    t,
  ]);

  const openEventLicenseCampaign = useCallback((/** @type {any} */ campaign) => {
    const campaignId = campaign?.documentId || campaign?.id;
    if (!eventClubId || !campaignId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: {
        campaignId,
        clubId: eventClubId,
      },
      screen: RouteNames.ClubLicenseCampaignDetail,
    });
  }, [eventClubId, navigation]);

  const editEventLicenseCampaign = useCallback((/** @type {any} */ campaign) => {
    const campaignId = campaign?.documentId || campaign?.id;
    if (!eventClubId || !campaignId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: {
        campaignId,
        clubId: eventClubId,
        event: licenseCampaignEvent,
        eventId: licenseCampaignEventId,
      },
      screen: RouteNames.ClubLicenseCampaignSettings,
    });
  }, [eventClubId, licenseCampaignEvent, licenseCampaignEventId, navigation]);

  const isMatchEvent = useMemo(() => {
    const typeName = String(event?.type?.name || '').trim().toLowerCase();
    return typeName.includes('match');
  }, [event?.type?.name]);
  // Y02 : l'adversaire, resolu UNE fois pour tout l'ecran (champ `opponentName`,
  // puis equipe invitee, puis match de League). Chaine vide s'il est inconnu.
  const matchOpponentName = useMemo(
    () => (isMatchEvent ? resolveEventOpponentName(event) : ''),
    [event, isMatchEvent],
  );
  const supportsEventComposition = Boolean(event?.team?.documentId || (event?.invitedTeams || []).length > 0);

  // @ts-ignore: FIXME: Baseline TS regression
  const getCompositionSourceLabel = useCallback((source) => {
    switch (source) {
      case 'default_composition':
        return t('eventDetails.compositionSource.defaultComposition', 'Composition type');
      case 'draft':
        return 'Brouillon';
      case 'last_match':
        return 'Dernier match';
      case 'published':
        return "Composition d'équipes publiée";
      default:
        return 'Nouvelle composition';
    }
  }, [t]);

  const compositionTeamId = useMemo(() => {
    const teams = [event?.team, ...(event?.invitedTeams || [])].filter(Boolean);
    if (!teams.length) return null;

    const userDocumentId = userData?.documentId;
    const trainedTeamIds = new Set(
      (userData?.trainedTeams || [])
        // @ts-ignore: FIXME: Baseline TS regression
        .map((team) => team?.documentId)
        .filter(Boolean),
    );

    const managedTeam = teams.find((team) => trainedTeamIds.has(team?.documentId))
      // @ts-ignore: FIXME: Baseline TS regression
      || teams.find((team) => (team?.trainers || []).some((trainer) => trainer?.documentId === userDocumentId));
    if (managedTeam?.documentId) return managedTeam.documentId;

    // @ts-ignore: FIXME: Baseline TS regression
    const playerTeam = teams.find((team) => (team?.players || []).some((player) => player?.documentId === userDocumentId));
    if (playerTeam?.documentId) return playerTeam.documentId;

    return teams[0]?.documentId || null;
  }, [event?.invitedTeams, event?.team, userData?.documentId, userData?.trainedTeams]);

  // 🔄 N3 (D3) — QUI REGARDE CE MATCH ? Un evenement a UNE equipe organisatrice
  // et des equipes invitees ; le meme match est donc « a domicile » pour l'une
  // et « a l'exterieur » pour l'autre. Le score le savait deja (il s'inversait
  // dans `matchHeaderScoreSummary`), mais la regle etait ecrite a l'interieur du
  // calcul du score et n'etait donc utilisable par personne d'autre. Elle sort
  // ici parce que la pastille de type et le verdict en ont besoin aussi — et
  // qu'une pastille « À domicile » posee au-dessus d'un score inverse serait
  // une contradiction visible a l'ecran.
  const isViewerFromInvitedTeam = useMemo(() => {
    const organizerTeamId = event?.team?.documentId || null;
    const currentTeamId = compositionTeamId || organizerTeamId || null;
    return Boolean(organizerTeamId && currentTeamId && organizerTeamId !== currentTeamId);
  }, [compositionTeamId, event?.team?.documentId]);

  const compositionEditorTeam = useMemo(() => {
    const teams = [event?.team, ...(event?.invitedTeams || [])].filter(Boolean);
    return teams.find((team) => team?.documentId === compositionTeamId)
      || event?.team
      || null;
  }, [compositionTeamId, event?.invitedTeams, event?.team]);

  // 🏷️ N3 (D1/D2/D3/D8) — CE QUE LA PASTILLE DE TYPE AJOUTE POUR UN MATCH.
  //
  // N1 a centralise le libelle dans `buildTypeTagLabel` en prevoyant ce lot :
  // « MATCH » se complete d'un segment, et d'un seul a la fois.
  //
  // ⛔ `isHome` EST TRI-ETAT, et le troisieme etat n'est pas `false` :
  // `null` veut dire « personne ne sait », ce qui est le cas de tout match
  // saisi a la main. `Boolean(event?.isHome)` afficherait « À l'extérieur »
  // pour ces matchs-la — une affirmation fausse, la ou se taire est juste.
  //
  // ⚠️ Le serveur qui ECRIT `isHome` (admin AE03, `3e7dd58`) n'est pas deploye
  // sur la recette au 23/08. Jusque-la, le seul chemin qui affichera quelque
  // chose en vrai est le repli sur `contextLabel`, deduit de la description des
  // matchs synchronises. Ce n'est pas une rustine : c'est l'ancien parc, qui
  // restera de toute facon depourvu du champ.
  const matchVenueTagSegment = useMemo(() => {
    if (!isMatchEvent) return '';
    // D8 — un match fini s'est deja joue quelque part. Dire ou n'apprend plus
    // rien a personne ; dire qu'il est TERMINÉ, si.
    if (isMatchFinished) return t('eventDetails.typeTag.matchFinished', 'TERMINÉ');

    let playsAtHome = null;
    if (event?.isHome === true) playsAtHome = true;
    else if (event?.isHome === false) playsAtHome = false;
    else if (externalMatchDisplay?.contextLabel === 'Domicile') playsAtHome = true;
    else if (externalMatchDisplay?.contextLabel === 'Exterieur') playsAtHome = false;

    if (playsAtHome === null) return '';

    const playsAtHomeForViewer = isViewerFromInvitedTeam ? !playsAtHome : playsAtHome;
    return playsAtHomeForViewer
      ? t('eventDetails.typeTag.matchHome', 'À DOMICILE')
      : t('eventDetails.typeTag.matchAway', 'À L\'EXTÉRIEUR');
  }, [
    event?.isHome,
    externalMatchDisplay?.contextLabel,
    isMatchEvent,
    isMatchFinished,
    isViewerFromInvitedTeam,
    t,
  ]);

  // N1 avait prevu que N3 « allonge le tableau » des precisions de la pastille.
  // Il ne peut pas l'allonger DANS `typeTagSegments` : le lieu du match depend
  // de `compositionTeamId`, declare 800 lignes plus bas — un hook ne se lit pas
  // avant d'exister. Les deux listes se rejoignent donc ici, et
  // `buildTypeTagLabel` retire tout seul les segments vides.
  const typeTagSegmentsComplets = useMemo(
    () => [...typeTagSegments, matchVenueTagSegment],
    [matchVenueTagSegment, typeTagSegments],
  );

  const compositionEditorPlayers = useMemo(
    () => getCompositionPlayersForEvent(event, compositionEditorTeam, isDetectionEvent),
    [compositionEditorTeam, event, isDetectionEvent],
  );

  const compositionSport = useMemo(
    () => compositionEditorTeam?.activities?.[0]?.name || event?.team?.activities?.[0]?.name || 'football',
    [compositionEditorTeam?.activities, event?.team?.activities],
  );

  // Y02 — LE NOM DE L'EVENEMENT, ecrit UNE SEULE FOIS pour tout l'ecran.
  // C'est lui que portent la convocation, la carte de compo du tchat, le libelle
  // du match et le bandeau de composition. Un match dont on connait l'adversaire
  // s'appelle « Match vs X » ; tout le reste garde exactement son nom d'avant.
  const compositionEventLabel = useMemo(() => {
    const nomAvecAdversaire = resolveEventDisplayName(event, '');
    if (nomAvecAdversaire && isMatchTypeName(event?.type?.name) && / vs /i.test(nomAvecAdversaire)) {
      return nomAvecAdversaire;
    }

    const preferredLabel = [eventDescriptionText, event?.name, event?.description]
      .find((value) => typeof value === 'string' && value.trim());

    if (typeof preferredLabel === 'string' && preferredLabel.trim()) {
      return preferredLabel.trim();
    }

    return event?.type?.name || 'Evenement';
  }, [event, eventDescriptionText]);

  const {
    data: staffCompositionPayload,
    isFetching: isStaffCompositionFetching,
    refetch: refetchTeamComposition,
  } = useGetEventTeamComposition(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(areDeferredQueriesEnabled && eventId && supportsEventComposition && compositionTeamId && canEdit),
    },
  );

  const {
    data: matchStatsPayload,
    isFetching: isMatchStatsFetching,
    refetch: refetchMatchStats,
  } = useGetEventMatchStats(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(
        areDeferredQueriesEnabled
          && eventId
          && isMatchEvent
          && compositionTeamId
          && (canEdit || isTeamMember),
      ),
    },
  );

  const {
    data: myMatchResponsePayload,
    isFetching: isMyMatchResponseFetching,
    refetch: refetchMyMatchResponse,
  } = useGetEventMyMatchResponse(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(
        areDeferredQueriesEnabled
          && eventId
          && isMatchEvent
          && compositionTeamId
          && isTeamMember
          && isMatchFinished,
      ),
    },
  );

  const {
    data: convocationPayload,
    isFetching: isConvocationFetching,
    refetch: refetchConvocation,
  } = useGetEventConvocation(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(areDeferredQueriesEnabled && eventId && supportsEventComposition && compositionTeamId && canViewPublishedComposition),
    },
  );

  useEffect(() => {
    const safeEventId = String(eventId || '');
    if (
      !safeEventId
      || !areDeferredQueriesEnabled
      || secondaryCompletedEventIdRef.current === safeEventId
      || isAttendanceFetching
      || isParticipationsFetching
      || isStaffCompositionFetching
      || isMatchStatsFetching
      || isMyMatchResponseFetching
      || isConvocationFetching
    ) {
      return;
    }

    secondaryCompletedEventIdRef.current = safeEventId;
    markEventDetailsPerf('event_detail_secondary_queries_completed', {
      eventId: safeEventId,
      hasAttendance: Boolean(attendancePayload),
      hasComposition: Boolean(staffCompositionPayload),
      hasConvocation: Boolean(convocationPayload),
      hasMatchStats: Boolean(matchStatsPayload),
      hasMyMatchResponse: Boolean(myMatchResponsePayload),
      participationPages: eventParticipations?.pages?.length || 0,
    });
  }, [
    areDeferredQueriesEnabled,
    attendancePayload,
    convocationPayload,
    eventId,
    eventParticipations?.pages?.length,
    isAttendanceFetching,
    isConvocationFetching,
    isMatchStatsFetching,
    isMyMatchResponseFetching,
    isParticipationsFetching,
    isStaffCompositionFetching,
    matchStatsPayload,
    myMatchResponsePayload,
    staffCompositionPayload,
  ]);

  const matchStatsReport = matchStatsPayload?.report || null;
  const playerCollectiveRating = matchStatsPayload?.playerCollectiveRating || null;
  const hasCollectiveRatings = Boolean(matchStatsReport?.collectiveRating)
    || playerCollectiveRating?.average != null;
  const myCoachReview = matchStatsPayload?.myCoachReview || null;
  const myMatchResponse = myMatchResponsePayload?.response || null;
  const isCoachFeedbackHighlighted = highlightedSection === 'coachFeedback';
  const hasMyCoachReview = myCoachReview?.rating != null || Boolean(myCoachReview?.comment);
  const hasExplicitMyMatchResponsePermission = typeof myMatchResponsePayload?.permissions?.canRespond === 'boolean';
  const canRespondMyMatchStats = hasExplicitMyMatchResponsePermission
    ? Boolean(myMatchResponsePayload?.permissions?.canRespond)
    : (!isMyMatchResponseFetching && Boolean(isTeamMember));
  const isMatchStatsFinal = matchStatsReport?.status === 'final';
  const isMatchStatsReviewRequired = Boolean(matchStatsReport?.needsReview);
  const isMatchStatsCompleted = isMatchStatsFinal && !isMatchStatsReviewRequired;
  const canViewMatchStats = Boolean(matchStatsPayload?.permissions?.canView || isTeamMember);
  const canManageMatchStats = Boolean(matchStatsPayload?.permissions?.canManage);
  const matchStatsScoreLabel = useMemo(() => {
    if (!matchStatsPayload?.score?.available) {
      return 'Score à compléter';
    }

    return `${matchStatsPayload?.score?.scoreFor ?? '-'} - ${matchStatsPayload?.score?.scoreAgainst ?? '-'}`;
  }, [
    matchStatsPayload?.score?.available,
    matchStatsPayload?.score?.scoreAgainst,
    matchStatsPayload?.score?.scoreFor,
  ]);
  // ✍️ N3 (D9) — NOMMER L'ADVERSAIRE, DEPUIS LA CARTE.
  //
  // Le champ existe deja dans EventEdit (hors lot, nomme) : il faut ouvrir le
  // formulaire complet de l'evenement pour renseigner UN mot. La feuille ci-
  // dessous est le raccourci du cadre 03 · I — un champ, deux boutons, et on
  // repart. Elle ne fait PAS de recherche de club : l'adversaire est du texte
  // libre cote serveur (`opponentName`, varchar 120, accepte tel quel par
  // PUT /events/:id), et une recherche de club promettrait un rattachement
  // qui n'existe pas.
  const [isOpponentSheetVisible, setIsOpponentSheetVisible] = useState(false);
  const [opponentNameDraft, setOpponentNameDraft] = useState('');
  const [isOpponentSaving, setIsOpponentSaving] = useState(false);

  const handleOpenOpponentSheet = useCallback(() => {
    setOpponentNameDraft(matchOpponentName || '');
    setIsOpponentSheetVisible(true);
  }, [matchOpponentName]);

  const handleSaveOpponentName = useCallback(async () => {
    const nomSaisi = opponentNameDraft.trim();
    if (!eventId || !nomSaisi) return;

    setIsOpponentSaving(true);
    try {
      await mutations.updateEventNoNavMutation.mutateAsync({
        documentId: eventId,
        eventData: { opponentName: nomSaisi },
      });
      setIsOpponentSheetVisible(false);
    } catch (opponentError) {
      // 🗣️ Une porte fermee DIT pourquoi — sinon la feuille reste ouverte sans
      // que rien n'explique que l'enregistrement a echoue.
      Alert.alert(
        t('common.error', 'Erreur'),
        opponentError?.message
          || t(
            'eventDetails.matchCard.saveOpponentFailed',
            'Impossible d\'enregistrer le nom de l\'adversaire pour le moment.',
          ),
      );
    } finally {
      setIsOpponentSaving(false);
    }
  }, [eventId, mutations.updateEventNoNavMutation, opponentNameDraft, t]);

  const matchHeaderScoreSummary = useMemo(() => {
    if (!isMatchEvent) return null;

    const scoreState = matchStatsPayload?.score || null;
    const storedMatchResult = event?.matchResult || null;
    // La regle d'orientation vit desormais dans `isViewerFromInvitedTeam` (D3) :
    // le score et la pastille ne peuvent plus diverger.
    const shouldInvertStoredScore = Boolean(storedMatchResult && isViewerFromInvitedTeam);

    let fallbackScoreFor = null;
    let fallbackScoreAgainst = null;
    if (storedMatchResult) {
      fallbackScoreFor = shouldInvertStoredScore
        ? storedMatchResult?.scoreAgainst
        : storedMatchResult?.scoreFor;
      fallbackScoreAgainst = shouldInvertStoredScore
        ? storedMatchResult?.scoreFor
        : storedMatchResult?.scoreAgainst;
    }
    const fallbackAvailable = fallbackScoreFor !== null
      && fallbackScoreFor !== undefined
      && fallbackScoreAgainst !== null
      && fallbackScoreAgainst !== undefined;
    const fallbackSource = storedMatchResult?.source || null;

    const available = Boolean(scoreState?.available || fallbackAvailable);
    const resolvedScoreFor = scoreState?.available ? scoreState?.scoreFor : fallbackScoreFor;
    const resolvedScoreAgainst = scoreState?.available ? scoreState?.scoreAgainst : fallbackScoreAgainst;
    const resolvedSource = scoreState?.available ? scoreState?.source : fallbackSource;
    const waitingOfficial = Boolean(
      scoreState?.waitingOfficial || (!scoreState?.available && event?.externalAutoSource),
    );

    // 🆕 N3 (D5) — L'ENCART EXISTE AVANT LE MATCH.
    // Jusqu'ici cette ligne rendait `null` : un match a venir n'affichait donc
    // AUCUN encart, et l'adversaire n'apparaissait nulle part sur la carte.
    // C'est le cadre A de la planche 03 — « Test FC — FC Bonneveine » et
    // « Score en attente » se montrent des qu'un adversaire est connu, et le
    // cadre I (adversaire inconnu) se montre aussi, pour le dire.
    const awaitingOpponent = !matchOpponentName;

    // 🏁 N3 (D6) — LE VERDICT SE DEDUIT, IL NE SE STOCKE PAS.
    // `resolvedScoreFor/Against` sont DEJA orientes vers le lecteur (D3) :
    // le verdict herite donc de l'orientation sans rien recalculer, et le
    // 3-1 de l'organisateur devient bien une defaite pour l'equipe invitee.
    let verdict = null;
    if (available) {
      const scoredFor = Number(resolvedScoreFor);
      const scoredAgainst = Number(resolvedScoreAgainst);
      if (Number.isFinite(scoredFor) && Number.isFinite(scoredAgainst)) {
        if (scoredFor > scoredAgainst) verdict = 'win';
        else if (scoredFor < scoredAgainst) verdict = 'loss';
        else verdict = 'draw';
      }
    }

    // D9/D10 — LA PRESENCE DU RAPPEL PORTE LE DROIT, pas un drapeau que
    // l'entete pourrait oublier de lire. Il n'existe que pour qui peut editer
    // ET quand l'adversaire manque : renommer un adversaire deja connu reste
    // dans EventEdit, ou vit le champ complet.
    const onNameOpponent = canEdit && awaitingOpponent ? handleOpenOpponentSheet : null;

    if (!available) {
      return {
        awaitingOpponent,
        badgeLabel: waitingOfficial ? 'Score officiel' : 'Score du match',
        // Le repli disait « Score en attente » ICI ET dans `value` : la meme
        // phrase deux fois dans un encart de 172 px. Une seule suffit.
        helperText: waitingOfficial ? 'Score en attente de synchronisation' : null,
        onNameOpponent,
        opponentName: matchOpponentName,
        value: 'Score en attente',
        verdict: null,
      };
    }

    let badgeLabel = 'Score du match';
    if (resolvedSource === 'external_sync') {
      badgeLabel = 'Score officiel';
    } else if (resolvedSource === 'manual') {
      badgeLabel = 'Score manuel';
    }

    return {
      awaitingOpponent,
      badgeLabel,
      helperText: waitingOfficial ? 'Synchronise automatiquement depuis la source officielle' : null,
      onNameOpponent,
      opponentName: matchOpponentName,
      value: `${resolvedScoreFor} - ${resolvedScoreAgainst}`,
      verdict,
    };
  }, [
    // `isMatchFinished` a QUITTE cette liste avec D5 : l'encart ne dependait de
    // lui que pour se CACHER avant le coup d'envoi (`!available && !isMatchFinished`
    // rendait null). Il s'affiche desormais des qu'il s'agit d'un match, donc
    // le calcul ne lit plus l'etat de fin. La pastille, elle, le lit toujours (D8).
    canEdit,
    event?.externalAutoSource,
    event?.matchResult,
    handleOpenOpponentSheet,
    isMatchEvent,
    isViewerFromInvitedTeam,
    matchOpponentName,
    matchStatsPayload?.score,
  ]);
  // N4 (D6) : `matchStatsSummaryText`, `matchStatsStatusMeta` et
  // `matchStatsCardButtonTitle` ont QUITTE ce fichier. Ils decrivaient l'entete
  // du bloc « Stats du match » — une phrase de resume, une pastille d'etat et le
  // libelle d'un bouton unique — que la carte-parcours remplace en nommant les
  // trois etapes. Ils n'avaient plus aucun lecteur ; les garder aurait fait
  // trois juges de plus sur le meme etat, qui divergeraient au premier
  // changement de regle. Meme motif que `compositionPrimaryAction` (D4).

  const convocationBranches = useMemo(() => {
    if (Array.isArray(convocationPayload?.branches)) {
      return convocationPayload.branches;
    }

    if (convocationPayload?.published) {
      return [{
        published: convocationPayload.published,
        team: convocationPayload?.team || {
          documentId: compositionTeamId,
          name: compositionEditorTeam?.name || null,
        },
        viewer: {
          inReserve: false,
          teamEntryIds: [],
        },
      }];
    }

    return [];
  }, [compositionEditorTeam?.name, compositionTeamId, convocationPayload?.branches, convocationPayload?.published, convocationPayload?.team]);
  const hasPublishedComposition = convocationBranches.length > 0;
  const publishedCompositionTeamCount = useMemo(
    () => convocationBranches.reduce((total, branch) => (
      total + (Array.isArray(branch?.published?.teams) ? branch.published.teams.length : 0)
    ), 0),
    [convocationBranches],
  );
  const publishedCompositionReserveCount = useMemo(
    () => convocationBranches.reduce((total, branch) => (
      total + (Array.isArray(branch?.published?.reservePlayerIds) ? branch.published.reservePlayerIds.length : 0)
    ), 0),
    [convocationBranches],
  );

  // AC08 — « SUIS-JE CONVOQUE ? », enfin repondu SUR LA PAGE.
  //
  // 🚨 Jusqu'ici, convoque et non-convoque lisaient exactement le meme bloc —
  // « 1 branche(s) visible(s) » — et le meme bouton les envoyait tous les deux
  // sur le tableau du coach desactive. La convocation vit dans une AUTRE requete
  // que l'evenement (`['eventConvocation', eventId, teamId]`) : c'est pour ça
  // que la page ne savait pas le dire. Elle a la charge sous la main, elle ne
  // s'en servait pas.
  const viewerConvocationRole = useMemo(
    () => getViewerConvocationRole(
      convocationPayload,
      userData?.documentId || userData?.id,
    ),
    [convocationPayload, userData?.documentId, userData?.id],
  );

  const viewerConvocationLine = useMemo(() => {
    if (viewerConvocationRole === CONVOCATION_ROLE_STARTER) return 'Tu es convoqué · Titulaire';
    if (viewerConvocationRole) return 'Tu es convoqué · Remplaçant';
    return 'Tu n’es pas dans la composition publiée.';
  }, [viewerConvocationRole]);

  // AD01 — LA MEME PHRASE, MAIS EN HAUT DE LA PAGE.
  //
  // 🥇 AC08 a repondu a « suis-je convoque ? » — mais la reponse vit dans le
  // DERNIER bloc du defilement (« Composition d'equipes », `:5672`), au bas
  // d'une fiche de 6 496 lignes. Un joueur devait faire defiler l'evenement
  // ENTIER pour apprendre s'il jouait. C'est un DEPLACEMENT, pas une
  // construction : `viewerConvocationLine` (`:3136`) reste la seule source,
  // aucune requete de plus, aucun second calcul.
  //
  // 🗣️ ET AVANT PUBLICATION, LA PAGE PARLE AU LIEU DE SE TAIRE. Le silence,
  // le lecteur le lit comme « je ne joue pas » — c'est le defaut n°3 de la
  // matrice d'audit. Une 4e phrase honnete coute une ligne et supprime le
  // contresens.
  const viewerConvocationHeadline = useMemo(() => (
    hasPublishedComposition
      ? viewerConvocationLine
      : t('eventDetails.convocation.notPublished', 'La composition n’est pas encore publiée.')
  ), [hasPublishedComposition, t, viewerConvocationLine]);

  const publishedCompositionCtaTitle = useMemo(() => {
    if (canEdit) return t('matchConvocation.published.openCta');
    return viewerConvocationRole ? 'Voir ma convocation' : "Voir la composition d'équipes";
  }, [canEdit, t, viewerConvocationRole]);
  // ==========================================================================
  // C2 — LE RAPPEL DE COMPO. Un bandeau, jamais une fenetre.
  //
  // Demande d'Adel : « apres la creation d'un MATCH, proposer de creer la
  // composition ». L'etude D88 (docs/REFLEXION_AFFICHES_ET_POPUP_COMPO.md
  // §2.6-2.7) a mesure pourquoi une fenetre serait le mauvais objet :
  //   · l'apres-creation porte DEJA 4 sollicitations (atelier d'affiche,
  //     confettis, fenetre d'abonnement, pastille cotisation) ;
  //   · un match est cree 4 jours (mediane) avant sa date, et 14 sur 35 plus
  //     d'une semaine avant ⇒ a la creation, il est trop tot pour 40 % d'entre
  //     eux. Un bandeau, lui, se revoit a chaque ouverture du match — donc
  //     aussi la veille, quand la compo se prepare vraiment.
  //
  // ⛔ AUCUN COMPTEUR, AUCUNE MEMOIRE « deja vu », rien a purger : l'ETAT fait
  // tout le travail. Le bandeau existe tant que la compo n'existe pas, et
  // disparait tout seul le jour ou elle existe.
  //
  // 🔒 « PAS DE COMPO » SE LIT SUR L'EXISTENCE, JAMAIS SUR LE CONTENU. Un
  // brouillon dont la selection de joueurs est vide (`[]`) reste un brouillon :
  // le coach a commence, lui redire « tu n'as pas encore de compo » serait faux.
  // Et `bootstrap` n'est PAS une compo — le serveur le rend toujours (source
  // `empty`), c'est une proposition de depart.
  const hasTeamComposition = Boolean(
    staffCompositionPayload?.draft || staffCompositionPayload?.published,
  );

  // La composition fait partie des offres Equipe et Club — c'est la matrice du
  // serveur (`composition.manage: ['TEAM', 'CLUB']`,
  // admin/src/api/subscription/services/subscription-permission.ts:80).
  // `hasActiveClubOffer` couvre CLUB **et** CLUB_UNVERIFIED : depuis la decision
  // produit du 2026-07-17, un entitlement Club actif ouvre l'acces meme sans
  // club verifie. Recopier la condition a la main ici reviendrait a revendre
  // l'offre Club a quelqu'un qui l'a deja payee.
  const canManageComposition = subscriptionAccessLevel === 'TEAM'
    || hasActiveClubOffer(subscriptionAccessLevel);

  // 🚪 Le rappel ne parait QUE la ou il y a quelque chose a preparer, et il se
  // tait partout ailleurs :
  //   · ce n'est pas un match, ou le match est deja joue → plus rien a preparer ;
  //   · la personne n'organise pas, ou aucune equipe n'est rattachee → il n'y a
  //     aucune porte a montrer (un bandeau qui mene a un ecran vide est pire
  //     que pas de bandeau) ;
  //   · la reponse du serveur n'est pas encore la → on ne SAIT pas. Se taire
  //     evite le rappel qui s'affiche puis disparait a chaque ouverture ;
  //   · le niveau d'abonnement n'est pas encore connu → aucun argument de vente,
  //     meme garde-fou que SubscriptionQuotaBanner.js:96.
  const isCompoReminderVisible = Boolean(
    isMatchEvent
    && canEdit
    && supportsEventComposition
    && compositionTeamId
    && !isMatchFinished
    && subscriptionAccessLevel
    && staffCompositionPayload
    && !hasTeamComposition,
  );

  // D4 : `compositionPrimaryAction` decrivait le titre et le sous-titre du gros
  // bouton de composition (« Brouillon enregistre le ... »). Ce bouton est
  // devenu la chip « Convocation » ; le bloc n'avait plus aucun lecteur.

  // 🗣️ N4 (D6) — LES SEPT TITRES ONT DISPARU, L'ETAT EST RESTE.
  //
  // Ce bloc decidait AUSSI le libelle du bouton : sept mots differents
  // (« Enregistrer le score », « Saisir les stats du match », « Mettre à jour
  // après score officiel », « En attente de l'équipe »…) pour une porte qui
  // mene toujours au meme endroit. Le lecteur voyait changer le MOT sans
  // jamais voir OU il en etait — or il y a trois etapes apres un match.
  // ⇒ La rangee du menu et la modale d'invite disent desormais UNE chaine,
  // « Stats du match ». Ce qui variait — l'ETAT — n'est pas perdu : il vit
  // dans `subtitle` (la note de la rangee, le motif d'une porte fermee) et,
  // en entier, dans `PostMatchJourneyCard`.
  // ⛔ `disabled` et `isScoreEntry` NE BOUGENT PAS : ce sont eux qui portent le
  // droit et l'aiguillage, et ils vivent ici, a un seul endroit.
  const matchStatsPrimaryAction = useMemo(() => {
    if (!isMatchFinished) {
      return {
        disabled: true,
        subtitle: 'Les stats seront disponibles à la fin du match.',
      };
    }
    if (matchStatsPayload?.score?.waitingOfficial) {
      return {
        disabled: true,
        subtitle: 'En attente du score officiel synchronise.',
      };
    }
    if (isMatchStatsReviewRequired) {
      return {
        disabled: false,
        subtitle: 'Le score officiel a changé. Vérifie puis republie cette version.',
      };
    }
    if (isMatchStatsFinal) {
      return {
        disabled: false,
        subtitle: matchStatsReport?.finalizedAt
          ? `Rapport finalise le ${new Date(matchStatsReport.finalizedAt).toLocaleString('fr-FR')}`
          : 'Rapport finalise',
      };
    }
    if (!canManageMatchStats) {
      return {
        disabled: true,
        subtitle: 'Les membres de ton équipe peuvent encore finaliser ce rapport.',
      };
    }
    if (matchStatsPayload?.score?.available) {
      return {
        disabled: false,
        subtitle: 'Complète le temps de jeu et les stats clés de ton équipe.',
      };
    }
    // AD01 (✍️) — LE SEUL CAS QUE LA FEUILLE COURTE DETOURNE. Ce drapeau vit
    // ici, et nulle part ailleurs : recopier la condition a cote serait un
    // second juge, qui divergerait au premier changement de regle.
    return {
      disabled: false,
      isScoreEntry: true,
      subtitle: 'Commence par enregistrer le score du match.',
    };
  }, [
    isMatchFinished,
    isMatchStatsFinal,
    canManageMatchStats,
    isMatchStatsReviewRequired,
    matchStatsPayload?.score?.available,
    matchStatsPayload?.score?.waitingOfficial,
    matchStatsReport?.finalizedAt,
  ]);
  const myMatchResponseStatusMeta = useMemo(() => {
    if (myMatchResponse?.status === 'draft') {
      return {
        backgroundColor: `${Colors.primary500}20`,
        borderColor: `${Colors.primary500}45`,
        label: 'Brouillon',
        textColor: Colors.primary500,
      };
    }
    if (myMatchResponse?.status === 'submitted') {
      if (myMatchResponse?.participation === 'not_involved') {
        return {
          backgroundColor: `${Colors.neutral00}14`,
          borderColor: `${Colors.neutral00}24`,
          label: 'Non concerne',
          textColor: Colors.neutral00,
        };
      }
      if (myMatchResponse?.quantitativeState === 'unknown') {
        return {
          backgroundColor: `${Colors.gold500}20`,
          borderColor: `${Colors.gold500}45`,
          label: 'Je ne sais pas',
          textColor: Colors.gold500,
        };
      }
      return {
        backgroundColor: `${Colors.success500}20`,
        borderColor: `${Colors.success500}45`,
        label: 'Envoye',
        textColor: Colors.success500,
      };
    }
    return {
      backgroundColor: `${Colors.primary500}20`,
      borderColor: `${Colors.primary500}45`,
      label: 'A faire',
      textColor: Colors.primary500,
    };
  }, [Colors.gold500, Colors.neutral00, Colors.primary500, Colors.success500, myMatchResponse]);
  const myMatchResponseSummary = useMemo(() => {
    if (myMatchResponse?.status === 'submitted') {
      if (myMatchResponse?.participation === 'not_involved') {
        return 'Tu as indique ne pas être concerne par ce match.';
      }
      if (myMatchResponse?.participation === 'present_no_play') {
        return 'Tu as indique que tu etais la sans jouer.';
      }
      if (myMatchResponse?.quantitativeState === 'unknown') {
        return 'Ton ressenti est enregistré, sans stats quantitatives.';
      }
      return 'Tes stats personnelles et ta note sont enregistrées.';
    }
    if (myMatchResponse?.status === 'draft') {
      return 'Ton brouillon perso post-match attend encore une validation.';
    }
    return 'Renseigne ton retour individuel, puis ajoute une note sur 10.';
  }, [myMatchResponse]);
  const myMatchResponseButtonTitle = useMemo(() => {
    if (myMatchResponse?.status === 'draft') return 'Reprendre';
    if (myMatchResponse?.status === 'submitted') return 'Voir';
    return 'Renseigner';
  }, [myMatchResponse]);
  const matchStatsPromptMessage = useMemo(() => {
    if (matchStatsPayload?.score?.available) {
      if (isMatchStatsReviewRequired) {
        return 'Le score officiel a changé. Vérifie les lignes puis republie ce rapport.';
      }

      return 'Le score est prêt. Tu peux maintenant compléter le temps de jeu et les stats clés de ton équipe.';
    }

    return 'Le match est terminé. Enregistre d abord le score puis complète les statistiques de ton équipe.';
  }, [isMatchStatsReviewRequired, matchStatsPayload?.score?.available]);
  const matchStatsPromptSessionKey = useMemo(() => {
    if (!eventId || !compositionTeamId) return '';

    return [
      'event',
      eventId,
      compositionTeamId,
      String(matchStatsReport?.documentId || matchStatsReport?.id || 'report'),
      `version:${Number(matchStatsReport?.version || 0)}`,
      `review:${isMatchStatsReviewRequired ? 'yes' : 'no'}`,
      `score:${matchStatsPayload?.score?.available ? 'ready' : 'pending'}`,
    ].join(':');
  }, [
    compositionTeamId,
    eventId,
    isMatchStatsReviewRequired,
    matchStatsPayload?.score?.available,
    matchStatsReport?.documentId,
    matchStatsReport?.id,
    matchStatsReport?.version,
  ]);
  const dismissMatchStatsPrompt = useCallback(() => {
    if (matchStatsPromptSessionKey) {
      dismissMatchStatsPromptForSession(matchStatsPromptSessionKey);
      setDismissedMatchStatsPromptKey(matchStatsPromptSessionKey);
    }
    setIsMatchStatsPromptVisible(false);
  }, [matchStatsPromptSessionKey]);

  // @ts-ignore: FIXME: Baseline TS regression
  const openCompositionBoard = useCallback((composition, options = {}) => {
    if (!eventId || !compositionTeamId) return;

    // @ts-ignore: FIXME: Baseline TS regression
    let playersForBoard = compositionEditorPlayers;
    // @ts-ignore: FIXME: Baseline TS regression
    if (Array.isArray(options.players) && options.players.length > 0) {
      // @ts-ignore: FIXME: Baseline TS regression
      playersForBoard = options.players;
    // @ts-ignore: FIXME: Baseline TS regression
    } else if (Array.isArray(options?.teamComposition?.eligiblePlayers) && options.teamComposition.eligiblePlayers.length > 0) {
      // @ts-ignore: FIXME: Baseline TS regression
      playersForBoard = options.teamComposition.eligiblePlayers;
    }

    // D77 — un MATCH commence par « Convoquer » (ecran 1 du pack composition),
    // puis enchaine sur le terrain.
    //
    // C-E (🚪) — ET UNE DETECTION COMMENCE PAR « MEMBRES DE L'EQUIPE » (ecran 13).
    // Le lot C-D a livre les ecrans 13, 14 et 15 et l'a dit lui-meme : aucun
    // bouton ne les atteignait, parce que cette ligne envoyait TOUTE detection
    // sur l'ancien terrain. Trois ecrans qu'aucun bouton n'atteint n'existent
    // pas. ⚠️ Le MATCH ne change pas de destination : seule la branche detection
    // bouge (temoin de non-regression dedie dans `EventDetailsManagePanel`).
    //
    // La LECTURE SEULE reste sur l'ancien terrain dans les deux cas : ni l'une
    // ni l'autre ne compose, et c'est le lot C-F qui la reprendra.
    // @ts-ignore: FIXME: Baseline TS regression
    const canComposeNow = Boolean(options.canEdit) && !options.readOnly;
    let compositionRoute = RouteNames.TacticalBoardV2;
    if (canComposeNow) {
      compositionRoute = isDetectionEvent
        ? RouteNames.DetectionSquadSetup
        : RouteNames.MatchCallUpSelection;
    }

    navigation.navigate(compositionRoute, {
      // @ts-ignore: FIXME: Baseline TS regression
      canEdit: Boolean(options.canEdit),
      clubId: event?.team?.club?.documentId || null,
      // @ts-ignore: FIXME: Baseline TS regression
      compositionIntent: options.compositionIntent || null,
      // @ts-ignore: FIXME: Baseline TS regression
      editorMode: options.editorMode || 'event',
      // @ts-ignore: FIXME: Baseline TS regression
      editorSource: options.editorSource || null,
      // @ts-ignore: FIXME: Baseline TS regression
      editorSourceLabel: options.editorSourceLabel || null,
      eventId,
      eventKind: isDetectionEvent ? 'detection' : 'match',
      eventName: compositionEventLabel,
      eventTypeLabel: event?.type?.name || null,
      // @ts-ignore: FIXME: Baseline TS regression
      aggregateBranches: Array.isArray(options.aggregateBranches) ? options.aggregateBranches : undefined,
      existingComposition: composition,
      // @ts-ignore: FIXME: Baseline TS regression
      multiTeamComposition: Boolean(
        Array.isArray(options.aggregateBranches)
          || Array.isArray(composition?.teams)
          || Number(composition?.schemaVersion) === 3
          || Array.isArray(options?.teamComposition?.draft?.teams)
          || Array.isArray(options?.teamComposition?.published?.teams),
      ),
      players: playersForBoard,
      // @ts-ignore: FIXME: Baseline TS regression
      readOnly: Boolean(options.readOnly),
      sport: composition?.sportContext || compositionSport,
      // @ts-ignore: FIXME: Baseline TS regression
      teamComposition: options.teamComposition || staffCompositionPayload || null,
      teamId: compositionTeamId,
      teamName: compositionEditorTeam?.name || staffCompositionPayload?.team?.name || null,
    });
  }, [
    compositionEditorPlayers,
    compositionEditorTeam?.name,
    compositionSport,
    compositionTeamId,
    compositionEventLabel,
    event?.team?.club?.documentId,
    event?.type?.name,
    eventId,
    isDetectionEvent,
    navigation,
    staffCompositionPayload,
  ]);

  // C-B — ECRAN 7 du pack : « Convocation publiee », la vue du COACH.
  //
  // 🔒 Reserve a `canEdit`, et ce n'est pas une precaution de style : l'ecran 7
  // lit `GET /events/:id/composition`, que le serveur ferme par
  // `ensureCanManageTeam` (`event-composition.ts`). Un joueur ou un simple
  // membre d'equipe — que `canViewPublishedComposition` laisse pourtant entrer
  // dans ce bloc — y recevrait un 403. Il garde donc la vue en lecture seule
  // qu'il avait deja : c'est l'ecran 10 du pack qui la remplacera (lot C-C).
  const openPublishedConvocation = useCallback(() => {
    if (!eventId || !compositionTeamId) return;

    // 🥇 AC08 — LA PORTE. Un joueur CONVOQUE atteint son terrain en un appui.
    // L'ecran existait entier depuis le 15/08 et une notification poussee etait
    // le SEUL chemin qui y menait : effacee, il devenait inatteignable.
    // ⛔ Un non-convoque n'est pas envoye la-bas : il y serait repose aussitot,
    // et ce serait un aller-retour pour rien. Il garde la vue en lecture seule.
    if (!canEdit && viewerConvocationRole) {
      navigation.navigate(RouteNames.PlayerConvocation, {
        eventId,
        teamId: compositionTeamId,
      });
      return;
    }

    if (!canEdit) {
      openCompositionBoard(convocationBranches[0]?.published || null, {
        aggregateBranches: convocationBranches,
        canEdit: false,
        editorSource: 'published',
        editorSourceLabel: getCompositionSourceLabel('published'),
        readOnly: true,
      });
      return;
    }

    navigation.navigate(RouteNames.MatchConvocationPublished, {
      clubId: event?.team?.club?.documentId || null,
      eventId,
      eventLabel: compositionEventLabel,
      players: compositionEditorPlayers,
      sport: compositionSport,
      teamId: compositionTeamId,
      teamName: compositionEditorTeam?.name || null,
    });
  }, [
    canEdit,
    compositionEditorPlayers,
    compositionEditorTeam?.name,
    compositionEventLabel,
    compositionSport,
    compositionTeamId,
    convocationBranches,
    event?.team?.club?.documentId,
    eventId,
    getCompositionSourceLabel,
    navigation,
    openCompositionBoard,
    viewerConvocationRole,
  ]);

  const handleManageComposition = useCallback(() => {
    if (!eventId || !compositionTeamId) return;

    if (isStaffCompositionFetching) {
      Alert.alert('Patiente', "On récupère l'état actuel de la composition.");
      return;
    }

    if (staffCompositionPayload?.draft) {
      openCompositionBoard(staffCompositionPayload.draft, {
        canEdit: true,
        compositionIntent: staffCompositionPayload?.draft?.mode || 'manual',
        editorSource: 'draft',
        editorSourceLabel: getCompositionSourceLabel('draft'),
        readOnly: false,
      });
      return;
    }

    if (staffCompositionPayload?.published) {
      openCompositionBoard(staffCompositionPayload.published, {
        canEdit: true,
        compositionIntent: staffCompositionPayload?.published?.mode || 'manual',
        editorSource: 'published',
        editorSourceLabel: getCompositionSourceLabel('published'),
        players: Array.isArray(staffCompositionPayload?.published?.snapshotPlayers)
          ? staffCompositionPayload.published.snapshotPlayers
          : compositionEditorPlayers,
        readOnly: false,
      });
      return;
    }

    const openNewComposition = (intent = 'manual') => {
      openCompositionBoard(staffCompositionPayload?.bootstrap?.composition || null, {
        canEdit: true,
        compositionIntent: intent,
        editorSource: staffCompositionPayload?.bootstrap?.source || 'empty',
        editorSourceLabel: getCompositionSourceLabel(staffCompositionPayload?.bootstrap?.source || 'empty'),
        readOnly: false,
      });
    };

    // C-E — L'ALERTE « Creation auto / Faire a la main » A ETE RETIREE, ET C'EST
    // UNE CONSEQUENCE DE LA PORTE, PAS UN CHOIX DE STYLE.
    //
    // D44 l'avait reservee a la detection (elle promettait a tout match de
    // football une creation automatique d'equipes). Depuis que la detection
    // ouvre l'ecran 13, ses DEUX chemins menent au meme endroit — l'ecran 13
    // POSE LUI-MEME la question, avec ses CTA `Manuel` et `Continuer`, et il la
    // pose apres avoir montre les inscrits et le pointage. La garder ici, c'est
    // demander deux fois la meme chose, la premiere fois sans rien montrer.
    // ⚠️ `compositionIntent` continue de voyager : l'ancien terrain le lit encore
    // sur les vues en lecture seule.
    openNewComposition('manual');
  }, [
    compositionEditorPlayers,
    compositionTeamId,
    eventId,
    getCompositionSourceLabel,
    isStaffCompositionFetching,
    openCompositionBoard,
    staffCompositionPayload,
  ]);

  const openMatchStatsEditor = useCallback(() => {
    if (!eventId || !compositionTeamId) return;

    navigation.navigate(RouteNames.MatchStatsEditor, {
      eventId,
      sourceType: 'event',
      sport: matchStatsPayload?.sport || compositionSport,
      teamId: compositionTeamId,
      teamName: compositionEditorTeam?.name || matchStatsPayload?.team?.name || null,
      title: 'Bilan équipe',
    });
  }, [
    compositionEditorTeam?.name,
    compositionSport,
    compositionTeamId,
    eventId,
    matchStatsPayload?.sport,
    matchStatsPayload?.team?.name,
    navigation,
  ]);

  // AD01 (✍️) — ECRIRE « 3-1 » SANS OUVRIR 1 615 LIGNES.
  //
  // Le tuyau court existe de bout en bout — `saveEventMatchResult`
  // (`matchStatsService.js:62`, `PUT /events/:id/match-result`), sa route
  // serveur et sa regle metier — et il n'avait AUCUN appelant. Pour ecrire deux
  // chiffres, un coach devait ouvrir `MatchStatsEditor` : 1 615 lignes.
  //
  // ⛔ CE N'EST PAS UN REMPLACEMENT. La feuille detourne UN SEUL cas, le dernier
  // de `matchStatsPrimaryAction` (« Enregistrer le score »). Tous les autres
  // ouvrent toujours l'editeur complet — il reste la porte longue, intacte.
  //
  // 🔒 CE QUE LE SERVEUR REFUSE, LA FEUILLE LE DIT AVANT D'ENVOYER
  // (`match-stats-report.ts:1921-1937`) : match non fini (la chip est deja
  // grisee en amont), score verrouille par une source externe, et « Both scores
  // are required » — les DEUX sont obligatoires. Sans ce garde-fou, le coach
  // attend un aller-retour pour se voir refuser en anglais.
  //
  // 💡 Le score courant est DEJA dans la charge de la page
  // (`matchStatsPayload.score`) : la feuille se pre-remplit sans une requete
  // de plus.
  const [isMatchScoreSheetVisible, setIsMatchScoreSheetVisible] = useState(false);
  const [matchScoreForDraft, setMatchScoreForDraft] = useState('');
  const [matchScoreAgainstDraft, setMatchScoreAgainstDraft] = useState('');
  const [isMatchScoreSaving, setIsMatchScoreSaving] = useState(false);

  const isMatchScoreLocked = Boolean(matchStatsPayload?.score?.locked);
  const isMatchScoreComplete = matchScoreForDraft.trim() !== ''
    && matchScoreAgainstDraft.trim() !== '';

  const openMatchScoreSheet = useCallback(() => {
    const asDraft = (/** @type {any} */ value) => (
      value === null || value === undefined ? '' : String(value)
    );

    setMatchScoreForDraft(asDraft(matchStatsPayload?.score?.scoreFor));
    setMatchScoreAgainstDraft(asDraft(matchStatsPayload?.score?.scoreAgainst));
    setIsMatchScoreSheetVisible(true);
  }, [matchStatsPayload?.score?.scoreAgainst, matchStatsPayload?.score?.scoreFor]);

  const handleSaveMatchScore = useCallback(async () => {
    if (!eventId || !compositionTeamId) return;
    if (isMatchScoreLocked || !isMatchScoreComplete || isMatchScoreSaving) return;

    setIsMatchScoreSaving(true);
    try {
      await mutations.saveMatchResultMutation.mutateAsync({
        eventId,
        scoreAgainst: Number(matchScoreAgainstDraft),
        scoreFor: Number(matchScoreForDraft),
        teamId: compositionTeamId,
      });
      setIsMatchScoreSheetVisible(false);
      // Le meme rafraichissement que le reste de la page (`:4775`) : sans lui,
      // l'entete continuerait d'afficher « Score en attente ».
      refetchMatchStats();
      Alert.alert(
        t('eventDetails.matchScore.savedTitle', 'Score enregistré'),
        t('eventDetails.matchScore.savedMessage', 'Le score du match est enregistré.'),
      );
    } catch (scoreError) {
      Alert.alert(
        t('common.error'),
        t('eventDetails.matchScore.error', 'Le score n’a pas pu être enregistré. Réessaie.'),
      );
    } finally {
      setIsMatchScoreSaving(false);
    }
  }, [
    compositionTeamId,
    eventId,
    isMatchScoreComplete,
    isMatchScoreLocked,
    isMatchScoreSaving,
    matchScoreAgainstDraft,
    matchScoreForDraft,
    mutations.saveMatchResultMutation,
    refetchMatchStats,
    t,
  ]);

  // AD01 (🚪) — LA PORTE DU TERRAIN DE DETECTION.
  //
  // `DetectionTeamsBoard` (850 lignes) et `DetectionRotationBoard` (697 lignes)
  // sont ecrits, testes, et declares dans les QUATRE fichiers de routes
  // (routeNames:273, webRoutes:215, EventStack:189-196, screenRegistry:976-987).
  // Et pourtant : ZERO appelant. Les deux ecrans qui devaient y mener finissent
  // par un `navigation.goBack()` (DetectionTeamsManual:177, DetectionTeamsAuto).
  // 1 547 lignes qu'aucun bouton n'atteignait — un ecran qu'aucun bouton
  // n'atteint n'existe pas. Il ne manquait QUE ce bouton.
  //
  // 🔑 `eventId` et `teamId` SUFFISENT : l'ecran relit lui-meme la charge
  // serveur (`DetectionTeamsBoard:145`, exactement la requete de cette page).
  // Le reste n'est qu'un demarrage a chaud, pour lui eviter un premier rendu
  // vide — et `sport`, sans quoi il retombe sur « football » par defaut.
  const detectionSplit = staffCompositionPayload?.detectionSplit || null;
  const hasDetectionTeams = Boolean(detectionSplit?.teams?.length);

  // 🔢 N2 — COMBIEN DE PERSONNES SONT DEJA POINTEES, d'apres le SERVEUR.
  // ⛔ Ni l'etat local de `DetectionSquadSetup`, ni le RSVP : `not_marked` est
  // la valeur que le serveur donne a quelqu'un qu'on n'a PAS encore pointe, et
  // la compter ferait afficher « 14 pointé·e·s sur 14 » avant meme le coup
  // d'envoi. Meme lecture qu'`EventParticipants` (`attendanceStatus` d'abord,
  // `finalState` en repli).
  const detectionPointedCount = useMemo(() => (
    Object.values(attendanceByUserId).filter((/** @type {any} */ entry) => {
      const state = String(entry?.attendanceStatus || entry?.finalState || '').toLowerCase();
      return Boolean(state) && state !== 'not_marked';
    }).length
  ), [attendanceByUserId]);

  const openDetectionTeamsBoard = useCallback(() => {
    if (!eventId || !compositionTeamId) return;

    navigation.navigate(RouteNames.DetectionTeamsBoard, {
      eventId,
      memberMode: detectionSplit?.memberMode || undefined,
      players: compositionEditorPlayers,
      sport: compositionSport,
      teamId: compositionTeamId,
    });
  }, [
    compositionEditorPlayers,
    compositionSport,
    compositionTeamId,
    detectionSplit?.memberMode,
    eventId,
    navigation,
  ]);

  /**
   * 🔁 N2 — L'ETAPE 4 DU CHEMIN DE DETECTION CESSE D'ETRE INATTEIGNABLE DEPUIS
   * LA PAGE. Jusqu'ici, la rotation ne s'ouvrait QUE depuis le terrain
   * (`DetectionTeamsBoard`), c'est-a-dire seulement si on savait deja qu'elle
   * existait.
   *
   * ⚠️ Ce n'est PAS un raccourci fragile : `DetectionRotationBoard` est ecrit
   * pour etre ouvert directement — il recharge la composition lui-meme et
   * retombe sur le `detectionSplit` du serveur quand la route n'en porte pas
   * (`DetectionRotationBoard.js`, « sinon du serveur quand on ouvre cet ecran
   * directement »). On lui passe donc les MEMES parametres que le terrain,
   * plus l'equipe de depart.
   */
  const openDetectionRotation = useCallback(() => {
    if (!eventId || !compositionTeamId) return;

    navigation.navigate(RouteNames.DetectionRotation, {
      eventId,
      players: compositionEditorPlayers,
      sport: compositionSport,
      teamId: compositionTeamId,
      teamIndex: 0,
    });
  }, [
    compositionEditorPlayers,
    compositionSport,
    compositionTeamId,
    eventId,
    navigation,
  ]);

  const openMyMatchResponse = useCallback(() => {
    if (!eventId || !compositionTeamId) return;

    navigation.navigate(RouteNames.PlayerMatchResponse, {
      eventId,
      matchLabel: compositionEventLabel,
      sourceType: 'event',
      sport: myMatchResponsePayload?.sport || matchStatsPayload?.sport || compositionSport,
      teamId: compositionTeamId,
      teamName: compositionEditorTeam?.name || myMatchResponsePayload?.team?.name || matchStatsPayload?.team?.name || null,
      title: 'Mon retour post-match',
    });
  }, [
    compositionEditorTeam?.name,
    compositionEventLabel,
    compositionSport,
    compositionTeamId,
    eventId,
    matchStatsPayload?.sport,
    matchStatsPayload?.team?.name,
    myMatchResponsePayload?.sport,
    myMatchResponsePayload?.team?.name,
    navigation,
  ]);

  useFocusEffect(useCallback(() => () => {
    setIsMatchStatsPromptVisible(false);
  }, []));

  useEffect(() => {
    if (!canManageMatchStats || !isMatchEvent || !compositionTeamId || !isMatchFinished) {
      setIsMatchStatsPromptVisible(false);
      return;
    }

    if (matchStatsPayload?.score?.waitingOfficial) {
      setIsMatchStatsPromptVisible(false);
      return;
    }

    if (isMatchStatsCompleted) {
      setIsMatchStatsPromptVisible(false);
      return;
    }

    if (
      matchStatsPayload
      && !isMatchStatsFetching
      && dismissedMatchStatsPromptKey !== matchStatsPromptSessionKey
      && !isMatchStatsPromptDismissedForSession(matchStatsPromptSessionKey)
    ) {
      setIsMatchStatsPromptVisible(true);
    }
  }, [canManageMatchStats, compositionTeamId,
    dismissedMatchStatsPromptKey,
    isMatchEvent,
    isMatchFinished,
    isMatchStatsFetching,
    isMatchStatsCompleted,
    matchStatsPayload,
    matchStatsPayload?.score?.waitingOfficial,
    matchStatsPromptSessionKey,
  ]);

  const openCoachLateModal = useCallback((/** @type {User | null | undefined} */ targetUser, /** @type {'coach_mark' | 'coach_edit'} */ mode) => {
    if (!targetUser?.documentId) return;

    const nowIso = new Date(serverNowMs).toISOString();
    const existing = attendanceByUserId[targetUser.documentId];
    const defaultArrival = existing?.arrivedAt || nowIso;
    const defaultMinutes = mode === 'coach_edit'
      ? Number(existing?.lateMinutes || 0)
      : computeLateMinutes(nowIso);

    setLateModalMode(mode);
    setLateModalUser(targetUser);
    setLateModalArrivedAt(defaultArrival);
    setLateModalMinutes(String(Math.max(0, defaultMinutes)));
    setLateModalNote(String(existing?.note || ''));
    setIsLateModalVisible(true);
  }, [attendanceByUserId, computeLateMinutes, serverNowMs]);

  const openSelfLateModal = useCallback(() => {
    const currentUser = userData
      ? {
        avatar: userData.avatar,
        documentId: userData.documentId,
        firstname: userData.firstname,
        lastname: userData.lastname,
      }
      : null;
    if (!currentUser?.documentId) return;

    const existing = attendanceByUserId[currentUser.documentId];
    setLateModalMode(existing?.declaredLateMinutes ? 'player_update' : 'player_declare');
    setLateModalUser(currentUser);
    setLateModalArrivedAt(null);
    setLateModalMinutes(String(Math.max(0, Number(existing?.declaredLateMinutes || 10))));
    setLateModalNote('');
    setIsLateModalVisible(true);
  }, [attendanceByUserId, userData]);

  const closeLateModal = useCallback(() => {
    setIsLateModalVisible(false);
    setLateModalMode('coach_mark');
    setLateModalUser(null);
    setLateModalMinutes('0');
    setLateModalArrivedAt(null);
    setLateModalNote('');
  }, []);

  const handleCoachMarkArrival = useCallback((/** @type {User | null | undefined} */ targetUser) => {
    openCoachLateModal(targetUser, 'coach_mark');
  }, [openCoachLateModal]);

  const handleCoachEditLate = useCallback((/** @type {User | null | undefined} */ targetUser) => {
    openCoachLateModal(targetUser, 'coach_edit');
  }, [openCoachLateModal]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleSetLatePreset = useCallback((value) => {
    setLateModalMinutes(String(value));
  }, []);

  const handleSaveLateModal = useCallback(() => {
    if (!eventId || !lateModalUser?.documentId) return;

    const parsedMinutes = Number(lateModalMinutes);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes < 0) {
      Alert.alert(t('common.error'), t('eventDetails.late.minutesInvalid', 'Le retard doit être un nombre positif.'));
      return;
    }

    if (lateModalMode === 'player_declare' || lateModalMode === 'player_update') {
      /** @type {any} */ (mutations.selfLateMutation).mutate(
        {
          eventId,
          payload: {
            lateMinutes: Math.floor(parsedMinutes),
          },
        },
        { onSuccess: () => closeLateModal() },
      );
      return;
    }

    const payload = {
      arrivedAt: lateModalArrivedAt || new Date().toISOString(),
      lateMinutes: Math.floor(parsedMinutes),
      note: lateModalNote.trim() || null,
    };

    if (lateModalMode === 'coach_mark') {
      /** @type {any} */ (mutations.coachArrivalMutation).mutate(
        { eventId, payload, userId: lateModalUser.documentId },
        { onSuccess: () => closeLateModal() },
      );
      return;
    }

    /** @type {any} */ (mutations.updateLateMinutesMutation).mutate(
      { eventId, payload, userId: lateModalUser.documentId },
      { onSuccess: () => closeLateModal() },
    );
  }, [
    closeLateModal,
    eventId,
    lateModalArrivedAt,
    lateModalMinutes,
    lateModalMode,
    lateModalNote,
    lateModalUser?.documentId,
    mutations.coachArrivalMutation,
    mutations.selfLateMutation,
    mutations.updateLateMinutesMutation,
    t,
  ]);

  const handleResetLateModal = useCallback(() => {
    if (!eventId || !lateModalUser?.documentId) return;
    /** @type {any} */ (mutations.resetAttendanceMutation).mutate(
      { eventId, userId: lateModalUser.documentId },
      { onSuccess: () => closeLateModal() },
    );
  }, [closeLateModal, eventId, lateModalUser?.documentId, mutations.resetAttendanceMutation]);

  const handleSelfArrival = useCallback(() => {
    if (!eventId) {
      Alert.alert(t('common.error'), "Impossible d'enregistrer ton arrivée (événement introuvable).");
      return;
    }
    if (hasSelfArrived) {
      Alert.alert(t('common.success'), 'Arrivée déjà enregistrée.');
      return;
    }
    setSelfArrivalMarkedLocal(true);
    /** @type {any} */ (mutations.selfArrivalMutation).mutate(
      {
        eventId,
        payload: {},
      },
      {
        onError: () => {
          setSelfArrivalMarkedLocal(false);
        },
        onSuccess: (/** @type {any} */ response) => {
          const lateMinutesFromResponse = Math.max(0, Number(response?.data?.lateMinutes || 0));
          const arrivedAtRaw = response?.data?.arrivedAt || null;
          const eventStartMs = eventStartAt?.getTime() || null;
          const arrivedAtMs = arrivedAtRaw ? new Date(arrivedAtRaw).getTime() : Number.NaN;
          const hasValidTimestamps = Boolean(
            eventStartMs
            && !Number.isNaN(eventStartMs)
            && !Number.isNaN(arrivedAtMs),
          );

          let message = t('eventDetails.late.selfOnTime', 'Arrivée enregistrée a l\'heure.');

          if (hasValidTimestamps && eventStartMs && arrivedAtMs < eventStartMs) {
            const earlyMinutes = Math.max(1, Math.floor((eventStartMs - arrivedAtMs) / 60000));
            message = t('eventDetails.late.selfEarly', `Bravo ! Tu es en avance de ${earlyMinutes} min.`);
          } else {
            const lateMinutesFromDiff = hasValidTimestamps && eventStartMs && arrivedAtMs > eventStartMs
              ? Math.max(0, Math.floor((arrivedAtMs - eventStartMs) / 60000))
              : 0;
            const lateMinutes = Math.max(lateMinutesFromResponse, lateMinutesFromDiff);
            if (lateMinutes > 0) {
              message = t('eventDetails.late.selfLate', `Arrivée enregistrée : ${lateMinutes} min de retard.`);
            }
          }

          Alert.alert(t('common.success'), message);
        },
      },
    );
  }, [eventId, eventStartAt, hasSelfArrived, mutations.selfArrivalMutation, t]);

  /**
   * Les actions d'organisation reellement ouvertes a cette personne, sur cet
   * evenement. C'est le SEUL juge : le panneau ne se dessine qu'a partir de
   * cette liste, et disparait quand elle est vide.
   * @param {{ includeTournamentSettings?: boolean }} [options] - Variante tournoi.
   * @returns {Array<any>} - Les chips visibles, dans l'ordre d'affichage.
   */
  const buildManageChips = (options = {}) => {
    const chips = [];

    if (canEdit) {
      chips.push({
        icon: 'edit',
        key: 'edit',
        label: t('eventDetails.managePanel.edit', 'Modifier'),
        onPress: handleEditEvent,
      });
    }

    if (canManageFeatured && canRequestFeatured) {
      chips.push({
        icon: 'bell',
        key: 'feature',
        label: t('eventDetails.managePanel.feature', 'À la une'),
        onPress: () => setIsFeaturedModalVisible(true),
      });
    }

    // 🗣️ N4 (D1) — « COMPO » DISPARAIT COMME MOT, ET LE LIBELLE DIT LA
    // DESTINATION. « Compo » est un mot de metier : personne qui decouvre
    // l'app ne devine qu'il mene a la convocation des joueur·se·s. Le libelle
    // suit donc l'ecran au bout du chemin, qui n'est pas le meme partout :
    //   · detection  -> `DetectionSquadSetup`   => « Répartition »
    //   · tout le reste -> `MatchCallUpSelection` => « Convocation »
    // ⛔ AUCUNE DESTINATION NE CHANGE : c'est le mot qui change, pas la porte.
    if (canEdit && supportsEventComposition) {
      chips.push({
        disabled: isStaffCompositionFetching,
        icon: 'users',
        key: 'lineup',
        label: isDetectionEvent
          ? t('eventDetails.managePanel.lineupDetection', 'Répartition')
          : t('eventDetails.managePanel.lineup', 'Convocation'),
        onPress: handleManageComposition,
      });
    }

    // AD01 (🚪) — LE TERRAIN DE DETECTION CESSE D'ETRE INATTEIGNABLE.
    // ⚠️ GRISEE, JAMAIS ABSENTE tant que la repartition n'existe pas : une
    // porte qui disparait ne s'explique pas, alors qu'une porte fermee qui DIT
    // pourquoi se comprend. Meme motif que la chip `matchStats` juste dessous.
    // 🖼️ Icone `stadium` : elle existe deja (`images.js` et `images.web.js`,
    // et 3 ecrans l'utilisent) — aucune image nouvelle n'est livree ici.
    if (canEdit && isDetectionEvent && supportsEventComposition && compositionTeamId) {
      chips.push({
        disabled: !hasDetectionTeams || isStaffCompositionFetching,
        fullWidth: true,
        icon: 'stadium',
        key: 'detectionTeamsBoard',
        label: t(
          'eventDetails.managePanel.detectionTeamsBoard',
          'Placer les équipes sur les terrains',
        ),
        note: hasDetectionTeams ? null : t(
          'eventDetails.managePanel.detectionTeamsBoardHint',
          'Répartis d’abord les équipes depuis « Répartition ».',
        ),
        onPress: openDetectionTeamsBoard,
      });
    }

    // D71 : les statistiques du match quittent le pied d'ecran pour ce menu.
    // Demande d'Adel du 2026-08-11 : le bas de la page n'est plus un endroit ou
    // l'on pose une action d'organisation — il n'y en a qu'un seul, et c'est
    // ici. Les conditions de visibilite sont REPRISES TELLES QUELLES du bloc
    // d'ou elle vient (`matchStatsNode`) : c'est un deplacement, pas un
    // elargissement de droits. Le libelle reste celui que l'etat decide
    // (« Stats du match », « Saisir les stats du match », « Enregistrer le
    // score »…), et la destination reste `openMatchStatsEditor`.
    //
    // ⛔ AUCUNE INFORMATION PERDUE : le sous-titre qui vivait sous le bouton
    // (« Les stats seront disponibles à la fin du match », « Le score officiel
    // a changé »…) devient la NOTE de la chip. Sans lui, une chip grisee ne
    // dirait plus POURQUOI elle l'est — et c'est justement son etat le plus
    // frequent, avant la fin du match. La chip prend donc la pleine largeur :
    // sa note est une phrase, pas une etiquette.
    if (canEdit && supportsEventComposition && isMatchEvent) {
      chips.push({
        disabled: matchStatsPrimaryAction.disabled || isMatchStatsFetching,
        fullWidth: true,
        icon: 'running',
        key: 'matchStats',
        // N4 (D6) : UNE SEULE CHAINE. Cette rangee affichait l'un des SEPT titres
        // de `matchStatsPrimaryAction` — un mot different a chaque visite, pour
        // une porte qui mene toujours au meme endroit. L'ETAT n'est pas perdu :
        // il descend dans la note (juste dessous) et se lit en entier dans la
        // carte-parcours de l'Apercu.
        label: isMatchStatsFetching ? 'Chargement...' : 'Stats du match',
        note: matchStatsPrimaryAction.subtitle,
        // AD01 (✍️) — LE DETOURNEMENT D'UN SEUL CAS. « Enregistrer le score »
        // ouvre desormais deux champs ; tous les autres etats de cette meme
        // chip ouvrent toujours `MatchStatsEditor`, inchange.
        onPress: matchStatsPrimaryAction.isScoreEntry
          ? openMatchScoreSheet
          : openMatchStatsEditor,
      });
    }

    if (options.includeTournamentSettings && canEdit) {
      chips.push({
        icon: 'filter',
        key: 'tournamentSettings',
        label: t('eventDetails.managePanel.tournamentSettings', 'Réglages tournoi'),
        onPress: handleOpenTournamentSettings,
      });
    }

    // D21 ③ : le point d'entree vers l'affiche. Meme motif que ClubDetails et
    // RecruitmentAdDetails, qui ouvrent deja leur propre affiche depuis leur
    // ecran de detail, reserve au proprietaire.
    // ⚠️ Il ne s'affiche QUE la ou la route est reellement enregistree : depuis
    // la pile PUBLIQUE, `EventPublishedShowcase` n'existe pas, et le bouton y
    // serait muet — un bouton qui ne fait rien est pire que pas de bouton.
    // D99 — L'ENTRAINEMENT N'A PLUS D'AFFICHE, ET IL REPART AVEC UN CHEMIN.
    // Decision d'Adel du 2026-08-13. Le pourquoi (heure et lieu recurrents d'un
    // groupe souvent mineur, deja notifie par ailleurs) est ecrit une seule
    // fois, la ou la regle vit : `eventShowcaseTemplate.js`.
    // ⚠️ Les DEUX chips sont exclusives et couvrent tous les cas : on ne ferme
    // jamais la porte sans poser le panneau a cote.
    if (canEdit && eventId && isEventShowcaseOffered(event?.type?.name)
      && hasRouteInNavigationTree(navigation, RouteNames.EventPublishedShowcase)) {
      chips.push({
        icon: 'camera',
        key: 'poster',
        label: t('eventDetails.managePanel.poster', "Voir l'affiche"),
        onPress: handleOpenEventPoster,
      });
    }

    // Meme garde-fou que la chip ci-dessus, mais sur SA destination a elle : la
    // ou le tunnel n'est pas enregistre (pile publique), l'aiguillage serait un
    // bouton muet — et un bouton muet est pire que pas de bouton.
    // La chip prend la pleine largeur : sa note est une phrase, pas une
    // etiquette (meme motif que « Stats du match », D71).
    if (canEdit && eventId && !isEventShowcaseOffered(event?.type?.name)
      && hasRouteInNavigationTree(navigation, RouteNames.EventWizardType)) {
      chips.push({
        fullWidth: true,
        icon: 'camera',
        key: 'detectionSwitch',
        label: t('eventDetails.managePanel.detectionSwitch', 'Faire venir des joueurs'),
        note: t(
          'eventDetails.managePanel.detectionSwitchNote',
          'L’affiche sert à attirer des gens de l’extérieur : on ne publie donc pas '
          + 'l’heure et le lieu d’un entraînement. Pour ouvrir une séance à de '
          + 'nouveaux joueurs, crée une détection / séance d’essai.',
        ),
        onPress: handleCreateDetection,
      });
    }

    // D21 ① : le geste « campagne de cotisation » quitte le bas de page pour ce
    // menu. Les conditions de visibilite sont REPRISES TELLES QUELLES du bloc
    // d'ou il vient (`renderEventLicenseCampaignActions`) : c'est un
    // deplacement, pas un elargissement de droits.
    //
    // UN SEUL libelle — decision d'Adel du 2026-08-07. Il remplace le couple
    // « Preparer la campagne de cotisation » / « Creer une campagne de
    // cotisation ». Un nom, pas un verbe, et c'est ce qui le rend vrai dans
    // TOUS les etats : l'action n'ouvre pas toujours directement la creation,
    // elle previent d'abord quand une campagne existe deja.
    //
    // ⛔ AUCUNE INFORMATION PERDUE, elle a seulement change de place :
    //   - « l'app te le suggere maintenant » etait porte par le verbe
    //     « preparer » ; c'est desormais la PRESENCE de l'entree qui le dit —
    //     elle n'apparait que lorsque le tunnel de creation l'a suggeree ;
    //   - « cet evenement a deja une campagne » est porte par l'action
    //     elle-meme (`openEventLicenseCampaignSettings`, l. ~2543 : « Crée-en
    //     une autre seulement si tu veux un paiement distinct ») ET par le bloc
    //     « Cotisations liées » de la page. Les deux sont intacts.
    // ⛔ SEUL LE TEXTE est unifie : le code se comporte toujours differemment
    //    selon qu'une campagne existe — avertissement d'abord, navigation
    //    ensuite. Fige par test.
    // 💶 N7 item 2 (vague P, 23/08) — GRISEE AVEC SON MOTIF, JAMAIS MASQUEE.
    // Jusqu'ici la rangee DISPARAISSAIT des qu'une campagne existait : une porte
    // qui s'efface ne s'explique pas, alors qu'une porte fermee qui DIT pourquoi
    // se comprend (meme motif que « Placer les équipes », AD01). La condition de
    // PRESENCE ne change pas ; c'est la condition « aucune campagne » qui passe
    // de la presence a l'etat `disabled` + note. `renderManageRow` sait deja
    // rendre les deux.
    if (canManageEventLicenseCampaigns
      && (eventCampaignCreationSuggested || eventLicenseCampaigns.length > 0)
      && !eventLicenseCampaignsQuery.isLoading) {
      const hasLinkedCampaign = eventLicenseCampaigns.length > 0;
      chips.push({
        disabled: hasLinkedCampaign,
        icon: 'euroCircle',
        key: 'licenseCampaign',
        label: t('eventDetails.managePanel.campaign', 'Cotisation'),
        note: hasLinkedCampaign
          ? t('eventDetails.managePanel.campaignAlreadyLinked', 'Cet événement a déjà une cotisation')
          : null,
        onPress: openEventLicenseCampaignSettings,
      });
    }

    if (canEdit) {
      chips.push({
        icon: 'close',
        isDestructive: true,
        key: 'cancel',
        label: t('eventDetails.managePanel.cancel', 'Annuler'),
        onPress: handleCancelEvent,
      });
    }

    return chips;
  };

  // D21 ② : les chips sont calculees UNE SEULE FOIS pour tout l'ecran, parce
  // que le menu ne vit plus a deux endroits (panneau tournoi + pied d'ecran)
  // mais flotte au-dessus de la liste. La variante tournoi reste exactement
  // celle d'avant : reglages tournoi seulement hors journee de stage.
  const manageChips = buildManageChips({
    includeTournamentSettings: isTournamentEvent && !isStageDayEvent,
  });
  const hasManageActions = manageChips.length > 0;

  // ───────────────────────────────────────────────────────────────────────────
  // L4-A — LES ONGLETS DU MATCH (maquette planche 04, cadres 4A et 4B).
  //
  // La page empilait 19 blocs dans UNE colonne. Elle en garde une ZONE FIXE
  // (pastille de type, adversaire, carte d'entete, statut de convocation, barre
  // du bas) et repartit le RESTE en trois onglets.
  //
  // ───────────────────────────────────────────────────────────────────────────
  // N2 — LA MATRICE : LES TROIS AUTRES TYPES REJOIGNENT LE MECANISME.
  //
  // L4 avait pose le mecanisme pour UN SEUL type, le match, en attendant
  // qu'Adel tranche le sort du tournoi (Q2, 20/08). C'est fait. La detection,
  // le stage parent et le tournoi se rangent maintenant DE LA MEME FACON :
  // meme etat `detailsTab`, meme `SegmentedControl`, meme helper de compteur.
  //
  // ⛔ CE N'EST PAS UN SECOND JEU D'ONGLETS. C'est le point de tout le lot : le
  // stage en avait un a lui, deux pastilles dessinees a la main dans une carte,
  // qui creaient un emboitement (des onglets DANS un onglet). Elles
  // disparaissent au profit de celui-ci.
  //
  // 🔢 LES REGLES DE LA MATRICE, telles que la planche 04 les fixe :
  //   · jamais plus de TROIS onglets ;
  //   · le premier s'appelle TOUJOURS « Aperçu » ;
  //   · chaque onglet porte son effectif, sauf « Répartition » qui ne compte
  //     rien ;
  //   · un onglet vide reste AFFICHE avec son etat vide — il ne se retire pas,
  //     sinon la page change de forme selon les donnees et on ne sait plus ou
  //     chercher.
  //
  // 🔑 LA VALEUR `participants` EST PARTAGEE PAR LES QUATRE TYPES, et c'est
  // precisement ce qui evite un second mecanisme : seul le LIBELLE change
  // (« Participants », « Candidats », « Personnes »), et le rang de l'onglet
  // change (2e sur un match, 3e ailleurs). Le drapeau qui commande la liste
  // reste donc UN SEUL, `showParticipantsTab`, quel que soit le type.
  //
  // ⇒ Hors des types ranges, `detailsTabs` est VIDE : tous les `isOnTab` rendent
  // VRAI en meme temps, et la colonne unique se rend exactement comme avant.
  //
  // ⚠️ « Match amical » contient « match » : `isMatchEvent` est vrai pour lui
  // (comparaison par sous-chaine, l. ~2750). C'est voulu — meme metier, meme
  // page — et c'est fige par temoin plutot que laisse a la surprise.
  // 🔢 L'effectif que portent les onglets « Participants » (match),
  // « Candidats » (detection) et « Personnes » (stage) : les personnes
  // ACCEPTEES. C'est EXACTEMENT le nombre que la carte de cotisation appelle
  // « inscrit·e·s » (N2-C) — un seul comptage, sinon l'onglet et la carte se
  // contrediraient a trois centimetres l'un de l'autre.
  const acceptedPeopleCount = participationsByStatus.participating.length;

  const detailsTabs = useMemo(() => {
    const overviewTab = { label: t('eventDetails.tabs.overview', 'Aperçu'), value: 'overview' };

    if (isMatchEvent) {
      return [
        overviewTab,
        {
          label: withTabCount(
            t('eventDetails.fields.participations', 'Participants'),
            acceptedPeopleCount,
          ),
          value: 'participants',
        },
        { label: t('eventDetails.tabs.callUp', 'Convocation'), value: 'callUp' },
      ];
    }

    if (isDetectionEvent) {
      return [
        overviewTab,
        {
          label: t('eventDetails.tabs.detectionSplit', 'Répartition'),
          value: 'detectionSplit',
        },
        {
          label: withTabCount(
            t('eventDetails.tabs.detectionCandidates', 'Candidats'),
            acceptedPeopleCount,
          ),
          value: 'participants',
        },
      ];
    }

    if (isStageParentEvent) {
      return [
        overviewTab,
        {
          label: withTabCount(t('eventDetails.tabs.stageDays', 'Jours'), stageChildDays.length),
          value: 'stageDays',
        },
        {
          label: withTabCount(t('eventDetails.tabs.people', 'Personnes'), acceptedPeopleCount),
          value: 'participants',
        },
      ];
    }

    if (isTournamentEvent && !isStageDayEvent) {
      return [
        overviewTab,
        {
          label: withTabCount(t('eventDetails.tabs.teams', 'Équipes'), tournamentTeams.length),
          value: 'tournamentTeams',
        },
        {
          label: withTabCount(t('eventDetails.tabs.people', 'Personnes'), tournamentPeopleCount),
          value: 'participants',
        },
      ];
    }

    return [];
  }, [
    acceptedPeopleCount,
    isDetectionEvent,
    isMatchEvent,
    isStageDayEvent,
    isStageParentEvent,
    isTournamentEvent,
    stageChildDays.length,
    t,
    tournamentPeopleCount,
    tournamentTeams.length,
  ]);

  // 🚪 LE DRAPEAU QUI OUVRE TOUT : y a-t-il des onglets sur cette page ?
  // Hors des types ranges (entrainement, reservation, « autre »…), il est FAUX
  // et chaque `isOnTab` rend VRAI — la colonne unique se rend comme avant, sans
  // qu'aucune condition de bloc n'ait a connaitre la liste des types.
  const hasDetailsTabs = detailsTabs.length > 0;
  const isOnTab = (/** @type {string} */ value) => !hasDetailsTabs || detailsTab === value;

  const showOverviewTab = isOnTab('overview');
  const showParticipantsTab = isOnTab('participants');
  const showCallUpTab = isOnTab('callUp');
  const showDetectionSplitTab = isOnTab('detectionSplit');
  const showStageDaysTab = isOnTab('stageDays');
  const showTournamentTeamsTab = isOnTab('tournamentTeams');

  // D3 — QUI VOIT LA PORTE. `canEdit` ne suffit pas : la grille d acces
  // (`eventAttendanceGate`) ne regarde que l appartenance a l equipe et la
  // participation. Un dirigeant organisateur hors de l equipe est donc
  // `canEdit` sans etre `canAccessAttendance`, et le serveur lui repondrait
  // 403 : lui montrer la porte serait lui promettre une piece fermee a clef.
  // 🕳️ Elargir la grille est un lot a part (L5-0), pas une correction ici.
  // Un tournoi, lui, n a pas d appel du tout.
  const showNextActionCard = showOverviewTab
    && canEdit
    && canAccessAttendance
    && !isTournamentEvent;

  // Les trois conditions que la repartition en onglets rendait trop longues
  // pour tenir sur leur ligne d'ouverture. Elles sont REPRISES TELLES QUELLES
  // des blocs ou elles vivaient : c'est un nom pose dessus, pas une regle qui
  // change.
  const hasEventTasks = Array.isArray(event?.eventTasks) && event.eventTasks.length > 0;
  const hasTeamAudiences = Array.isArray(event?.teamAudiences)
    && event.teamAudiences.length > 0;
  const showPublishedComposition = supportsEventComposition
    && (canViewPublishedComposition || canEdit);

  /**
   * 🧭 N2 — LE CHEMIN COMPLET D'UNE DETECTION (planche 04, cadre 4G).
   *
   * Une seance de detection se deroule en QUATRE gestes, dans cet ordre : on
   * pointe qui est la, on repartit en equipes, on place sur le terrain, on fait
   * tourner pour que chacun joue. Les quatre ecrans existent — 2 980 lignes
   * livrees — mais seuls DEUX etaient atteignables, par des chips du menu, et
   * rien ne disait qu'ils formaient une suite.
   *
   * ⚠️ CE QUE CET ONGLET REPARE N'EST PAS UN MANQUE D'ECRANS, C'EST UN MANQUE
   * D'ORDRE. Un organisateur voyait « Convocation » et « Placer les équipes » comme
   * deux boutons sans rapport, et n'atteignait jamais la rotation.
   *
   * 🔢 L'ETAPE 1 SE LIT SUR LE SERVEUR, jamais sur l'ecran de repartition :
   * `attendanceByUserId` vient de `GET /events/:id/attendance`. L'etat local de
   * `DetectionSquadSetup` ne survivrait pas a un retour en arriere, et dirait
   * « 0 pointé » a un coach qui vient d'en pointer quatorze.
   */
  const renderDetectionSplitTab = () => {
    if (!isDetectionEvent) return null;

    // 🔒 RESERVE AU STAFF — et l'onglet reste AFFICHE pour tout le monde.
    // La planche 04 est explicite : un onglet vide garde sa place et porte son
    // etat vide. Le retirer aux candidats ferait changer la page de forme selon
    // qui regarde, et un candidat qui a entendu parler de « la répartition » ne
    // saurait pas si elle n'existe pas ou si elle ne lui est pas destinee.
    if (!canEdit) {
      return (
        <View
          style={[
            ApplicationStyle.borderRadius16,
            ApplicationStyle.borderWidth1,
            Spaces.padding[16],
            Spaces.gap[8],
            {
              backgroundColor: withAlpha(Colors.primary500, 0.08),
              borderColor: withAlpha(Colors.primary500, 0.24),
            },
          ]}
          testID="detection-split-staff-only"
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('eventDetails.detectionSplit.staffOnlyTitle', 'Réservé au staff de la séance')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'eventDetails.detectionSplit.staffOnlyHint',
              'Le staff répartit les candidats en équipes et gère leur temps de jeu.',
            )}
          </Text>
        </View>
      );
    }

    const detectionTeamCount = detectionSplit?.teams?.length || 0;
    const blockedUntilSplit = t(
      'eventDetails.detectionSplit.blockedUntilSplit',
      'Génère d’abord la répartition, à l’étape 2.',
    );

    const steps = [
      {
        done: acceptedPeopleCount > 0 && detectionPointedCount >= acceptedPeopleCount,
        hint: acceptedPeopleCount > 0
          ? t(
            'eventDetails.detectionSplit.stepAttendanceCount',
            '{{pointed}} pointé·e·s sur {{total}}',
            { pointed: detectionPointedCount, total: acceptedPeopleCount },
          )
          : t(
            'eventDetails.detectionSplit.stepAttendanceEmpty',
            'Aucun candidat inscrit pour l’instant',
          ),
        key: 'attendance',
        rank: 1,
        title: t('eventDetails.detectionSplit.stepAttendance', 'Pointer les présent·e·s'),
      },
      {
        action: t('eventDetails.detectionSplit.generate', 'Générer la répartition'),
        done: hasDetectionTeams,
        hint: t(
          'eventDetails.detectionSplit.stepSplitHint',
          'Séparer par poste recherché',
        ),
        key: 'split',
        onPress: handleManageComposition,
        rank: 2,
        title: hasDetectionTeams
          ? t(
            'eventDetails.detectionSplit.stepSplitDone',
            'Réparti·e·s en {{count}} équipes',
            { count: detectionTeamCount },
          )
          : t('eventDetails.detectionSplit.stepSplit', 'Répartir en équipes'),
      },
      {
        action: t('eventDetails.detectionSplit.openBoard', 'Placer sur le terrain'),
        blockedReason: blockedUntilSplit,
        disabled: !hasDetectionTeams || isStaffCompositionFetching,
        hint: t('eventDetails.detectionSplit.stepBoardHint', 'Après la répartition'),
        key: 'board',
        onPress: openDetectionTeamsBoard,
        rank: 3,
        title: t('eventDetails.detectionSplit.stepBoard', 'Placer sur le terrain'),
      },
      {
        action: t('eventDetails.detectionSplit.openRotation', 'Faire tourner'),
        blockedReason: blockedUntilSplit,
        disabled: !hasDetectionTeams || isStaffCompositionFetching,
        hint: t(
          'eventDetails.detectionSplit.stepRotationHint',
          'Temps de jeu par joueur · plancher 5 min',
        ),
        key: 'rotation',
        onPress: openDetectionRotation,
        rank: 4,
        title: t('eventDetails.detectionSplit.stepRotation', 'Faire tourner'),
      },
    ];

    return (
      <View style={[Spaces.gap[12]]} testID="detection-split-path">
        <Text style={[Fonts.p4Bold, Fonts.primary500]}>
          {t('eventDetails.detectionSplit.title', 'LE CHEMIN COMPLET')}
        </Text>

        {steps.map((step) => (
          <View
            key={step.key}
            style={[
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth1,
              Spaces.padding[12],
              Spaces.gap[8],
              {
                backgroundColor: withAlpha(Colors.primary500, step.done ? 0.12 : 0.06),
                borderColor: withAlpha(
                  step.done ? Colors.success500 : Colors.primary500,
                  step.done ? 0.45 : 0.24,
                ),
              },
            ]}
            testID={`detection-split-step-${step.key}`}
          >
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {`${step.rank}. ${step.title}`}
                </Text>
                <Text style={[Fonts.p4, Fonts.neutral200]}>{step.hint}</Text>
              </View>
              {step.done ? (
                <Tag
                  style={tournamentDs.getToneTagStyle(Colors.success500)}
                  text={t('eventDetails.detectionSplit.stepDone', 'Fait')}
                  textColor="neutral00"
                  textStyle={{ color: Colors.success500 }}
                />
              ) : null}
            </View>

            {step.action ? (
              <Button
                disabled={Boolean(step.disabled)}
                onPress={step.onPress}
                title={step.action}
                variant={step.done ? 'SecondaryLight' : 'Primary'}
              />
            ) : null}

            {/* 🔇 Regle 5 du pack : JAMAIS un bouton gris sans son motif. Celui-ci
                est ferme parce que l'etape 2 n'est pas faite, et il le dit. */}
            {step.action && step.disabled && step.blockedReason ? (
              <Text style={[Fonts.p4, Fonts.neutral300]}>{step.blockedReason}</Text>
            ) : null}
          </View>
        ))}
      </View>
    );
  };

  /**
   * 💶 N2 — « QUI N'A PAS PAYE », SUR LA PAGE DU STAGE (planche 04, cadre 4F).
   *
   * ⚠️ CETTE CARTE NE CALCULE RIEN. Tout ce qu'elle montre existait deja : le
   * serveur livre neuf compteurs par campagne, et la relance groupee tourne
   * depuis l'ecran des cotisations du club. La page de l'evenement n'en lisait
   * qu'un seul (`totals.total`). C'est un branchement, pas une fonctionnalite.
   *
   * 🔒 ELLE EST DERRIERE `canManageEventLicenseCampaigns`, ET SEULEMENT LA.
   * Ce sont des donnees FINANCIERES nominatives par ricochet (« 6 n'ont pas
   * réglé » sur un stage de 24 designe un sixieme du groupe) : elles ne
   * remontent jamais dans l'entete, que tout le monde voit.
   */
  const renderStageLicenseCard = () => {
    if (!canManageEventLicenseCampaigns) return null;

    const campaign = eventLicenseCampaigns[0];
    if (!campaign) return null;

    const campaignId = campaign?.documentId || campaign?.id;
    const statusCounts = campaign?.totals?.statusCounts || {};
    // 💰 Les trois etats qui valent une relance, exactement ceux de l'ecran des
    // cotisations du club — meme definition, meme charge envoyee au serveur.
    const unpaidCount = Number(statusCounts.pending || 0)
      + Number(statusCounts.partial || 0)
      + Number(statusCounts.overdue || 0);
    const assignedCount = Number(campaign?.totals?.total || 0);
    // 🧮 Les inscrit·e·s a qui AUCUNE cotisation n'est rattachee. Ce trou-la est
    // invisible partout ailleurs : ils ne sont ni payeurs ni impayes, ils
    // n'existent simplement pas dans la campagne.
    const withoutAssignment = Math.max(0, acceptedPeopleCount - assignedCount);
    const isCampaignActive = String(campaign?.status || '') === 'active';
    const currency = campaign?.currency || 'EUR';

    const handleRelance = () => {
      if (!campaignId || !unpaidCount) return;
      Alert.alert(
        t('eventDetails.stageLicense.confirmTitle', 'Relancer les impayés'),
        t(
          'eventDetails.stageLicense.confirmBody',
          'Envoyer une relance aux cotisations en attente, partielles ou en retard ?',
        ),
        [
          { style: 'cancel', text: t('common.cancel', 'Annuler') },
          {
            onPress: () => eventLicenseReminderMutation.mutate(
              { campaignId, statuses: ['pending', 'partial', 'overdue'] },
              {
                onError: (/** @type {any} */ echec) => Alert.alert(
                  t('eventDetails.stageLicense.errorTitle', 'Relance impossible'),
                  echec?.message
                    || t('eventDetails.stageLicense.errorBody', 'Rien n’a été envoyé.'),
                ),
                onSuccess: () => {
                  eventLicenseCampaignsQuery.refetch();
                  Alert.alert(
                    t('eventDetails.stageLicense.sentTitle', 'Relances envoyées'),
                    t('eventDetails.stageLicense.sentBody', 'Les impayés ont reçu un rappel.'),
                  );
                },
              },
            ),
            text: t('eventDetails.stageLicense.confirmSend', 'Envoyer'),
          },
        ],
      );
    };

    const handleAffectations = () => {
      if (!campaignId) return;
      eventLicenseAssignmentsMutation.mutate({ campaignId }, {
        onSuccess: () => eventLicenseCampaignsQuery.refetch(),
      });
    };

    return (
      <View
        style={[
          ApplicationStyle.borderRadius16,
          ApplicationStyle.borderWidth1,
          Spaces.padding[16],
          Spaces.gap[12],
          {
            backgroundColor: withAlpha(Colors.primary500, 0.08),
            borderColor: withAlpha(Colors.primary500, 0.24),
          },
        ]}
        testID="stage-license-card"
      >
        <Text style={[Fonts.p4Bold, Fonts.primary500]}>
          {t('eventDetails.stageLicense.kicker', 'PROCHAINE ACTION')}
        </Text>

        {unpaidCount > 0 ? (
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t('eventDetails.stageLicense.title', 'Relancer {{count}} impayés', {
                count: unpaidCount,
              })}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'eventDetails.stageLicense.body',
                'Sur {{total}} inscrit·e·s, {{unpaid}} n’ont pas réglé les {{amount}} du stage',
                {
                  amount: formatCampaignAmount(campaign?.defaultAmountCents, currency),
                  total: assignedCount,
                  unpaid: unpaidCount,
                },
              )}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              {t('eventDetails.stageLicense.collected', '{{paid}} reçus sur {{expected}} attendus', {
                expected: formatCampaignAmount(campaign?.totals?.expectedCents, currency),
                paid: formatCampaignAmount(campaign?.totals?.paidCents, currency),
              })}
            </Text>
          </View>
        ) : (
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('eventDetails.stageLicense.allPaid', 'Tout le monde a réglé sa cotisation.')}
          </Text>
        )}

        {unpaidCount > 0 ? (
          <Button
            disabled={!isCampaignActive || eventLicenseReminderMutation.isPending}
            isLoading={eventLicenseReminderMutation.isPending}
            onPress={handleRelance}
            title={t('eventDetails.stageLicense.remind', 'Relancer {{count}} impayés', {
              count: unpaidCount,
            })}
            variant="Primary"
          />
        ) : null}

        {/* 🔇 Regle 5 du pack : un bouton ferme DIT pourquoi. Une campagne en
            brouillon ou en pause ne peut rien envoyer, et c'est ecrit. */}
        {unpaidCount > 0 && !isCampaignActive ? (
          <Text style={[Fonts.p4, Fonts.neutral300]}>
            {t(
              'eventDetails.stageLicense.inactive',
              'La campagne n’est pas active : aucune relance ne peut partir.',
            )}
          </Text>
        ) : null}

        {withoutAssignment > 0 ? (
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'eventDetails.stageLicense.withoutAssignment',
                '{{count}} inscrit·e·s sans cotisation',
                { count: withoutAssignment },
              )}
            </Text>
            <Button
              disabled={eventLicenseAssignmentsMutation.isPending}
              isLoading={eventLicenseAssignmentsMutation.isPending}
              onPress={handleAffectations}
              title={t(
                'eventDetails.stageLicense.generate',
                'Mettre à jour les affectations',
              )}
              variant="SecondaryLight"
            />
          </View>
        ) : null}
      </View>
    );
  };

  /**
   * 🏕️ N2 — L'APERÇU D'UN STAGE (planche 04, cadre 4F).
   *
   * Meme contenu qu'avant — periode, horaires, lieu, puces — mais SANS la carte
   * qui l'enfermait et sans ses deux pastilles maison. Elles creaient un
   * emboitement que la planche 04 interdit : des onglets DANS un onglet.
   */
  const renderStageOverviewTab = () => (
    <View style={[Spaces.gap[12]]} testID="stage-overview">
      {renderStageLicenseCard()}

      <View style={[Spaces.gap[4]]}>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('eventDetails.stage.period', 'Période')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          {stagePeriodSummary || t('eventDetails.stage.periodEmpty', 'Non renseignée')}
        </Text>
      </View>
      <View style={[Spaces.gap[4]]}>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('eventDetails.stage.hours', 'Horaires')}
        </Text>
        <Text style={[Fonts.p2, Fonts.primary500]}>
          {stageHoursSummary || t('eventDetails.stage.hoursEmpty', 'Variables')}
        </Text>
      </View>
      <View style={[Spaces.gap[4]]}>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('eventDetails.stage.mainPlace', 'Lieu principal')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {event?.facility?.name
            || event?.locationDetails
            || t('eventDetails.stage.placeEmpty', 'À définir')}
        </Text>
      </View>
    </View>
  );

  /**
   * 📅 N2 — LES JOURNEES DU STAGE (planche 04, cadre 4F, onglet « Jours »).
   *
   * Chaque ligne porte son rang, sa date, ses horaires et ses trois compteurs.
   * ⚠️ Les trois nombres etaient deja la, mais ecrits « 22 presents 1 absents
   * 1 sans réponse » sur chaque ligne — la planche 04 sort la legende UNE FOIS,
   * en tete, et laisse les lignes ne porter que les chiffres.
   */
  const renderStageDaysTab = () => {
    if (!stageChildDays.length) {
      return (
        <Text style={[Fonts.p2, Fonts.neutral200]} testID="stage-days-empty">
          {t('eventDetails.stage.noDays', 'Aucune journée de stage n’est encore disponible.')}
        </Text>
      );
    }

    return (
      <View style={[Spaces.gap[12]]} testID="stage-days">
        <Text style={[Fonts.p4, Fonts.neutral300]}>
          {t('eventDetails.stage.legend', 'présent·e·s · absent·e·s · sans réponse')}
        </Text>

        {stageChildDays.map((stageDay, index) => {
          const summary = getStageDayStatusSummary(stageDay);
          const dayDate = new Date(stageDay?.date);
          const isToday = new Date(serverNowMs).toDateString() === dayDate.toDateString();

          return (
            <TouchableOpacity
              key={stageDay?.documentId || stageDay?.date}
              onPress={() => navigation.navigate(RouteNames.EventDetails, {
                eventId: stageDay?.documentId,
              })}
              style={[
                ApplicationStyle.borderRadius16,
                ApplicationStyle.borderWidth1,
                Spaces.padding[16],
                Spaces.gap[8],
                {
                  backgroundColor: withAlpha(Colors.primary500, isToday ? 0.14 : 0.08),
                  borderColor: withAlpha(Colors.primary500, isToday ? 0.5 : 0.2),
                },
              ]}
              testID={`stage-day-${index + 1}`}
            >
              <View
                style={[
                  Alignments.row,
                  Alignments.justifySpaceBetween,
                  Alignments.alignCenter,
                  Spaces.gap[12],
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {`${t('eventDetails.stage.day', 'Jour')} ${index + 1} · ${dayDate.toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      weekday: 'long',
                    })}`}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>
                    {`${String(stageDay?.startTime || '').slice(0, 5)} - ${String(stageDay?.endTime || '').slice(0, 5)}`}
                  </Text>
                </View>
                {isToday ? (
                  <Tag
                    style={tournamentDs.getToneTagStyle(Colors.success500)}
                    text={t('eventDetails.stage.today', 'AUJOURD’HUI')}
                    textColor="neutral00"
                    textStyle={{ color: Colors.success500 }}
                  />
                ) : null}
              </View>
              <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
                {`${summary.present} · ${summary.absent} · ${summary.pending}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ⚠️ `centerContent` N'EST PAS UN CHOIX DE STYLE : sans lui, `SegmentedControl`
  // installe un pan gesture MANUEL (SegmentedControl.js:56 et 243-265) qui
  // entrerait en conflit avec le defilement vertical de la ScrollView qui
  // l'entoure. Avec trois onglets courts, la repartition en largeurs egales est
  // de toute facon celle de la maquette.
  // ⚠️ Le composant ne pose AUCUNE marge externe : c'est l'appelant qui les
  // pose (motif CMMembersScreen.js:297). Ici, le `gap: 24` du conteneur suffit.
  const renderDetailsTabs = () => {
    if (!detailsTabs.length) return null;

    return (
      <View style={[Alignments.alignCenter]} testID="event-details-tabs">
        <SegmentedControl
          centerContent
          onChange={setDetailsTab}
          options={detailsTabs}
          value={detailsTab}
        />
      </View>
    );
  };

  // L4-B : `manageSurfaceStyle` decrivait la surface flottante de l'accordeon.
  // Il n'a plus de lecteur — la feuille porte son propre fond, celui de
  // `BottomModal`.

  /**
   * D53 : le menu d'organisation ne flotte plus AU-DESSUS de la liste — il est
   * pose DANS LE FLUX, juste sous elle, aligne a droite. Il garde donc la
   * compacite voulue par D21 (une pastille de 46 px, pas la bande pleine
   * largeur d'avant D21) sans jamais recouvrir un participant.
   *
   * Ce que ce changement supprime, et qu'aucune reserve ne pouvait corriger :
   * ancre en absolu, le menu occupait en permanence les 62 px du bas du cadre,
   * quel que soit l'endroit ou l'utilisateur avait defile.
   *
   * Consequence gratuite : deplie, la grille de chips repousse desormais la
   * liste au lieu de la masquer. La grille elle-meme ne change pas — memes
   * colonnes 48 % / 100 %, memes handlers, un seul tap.
   * @returns {any} - Le bloc du menu, ou null si aucune action n'est ouverte.
   */
  // C2 — LE BANDEAU LUI-MEME. Il se pose SOUS « Gerer l'evenement », c'est-a-dire
  // juste a cote de la porte qu'il designe : la rangee « Convocation » vit dans ce menu,
  // et ce menu est REPLIE par defaut (`useState(false)`) — le rappel est donc le
  // seul endroit de la page ou le geste se voit sans deplier quoi que ce soit.
  //
  // 🧷 C'est un MORCEAU D'ECRAN, jamais une route de plus : D81 a mesure qu'un
  // `navigate` vers un ecran absent de la pile l'y empile, et que la fleche
  // retour y redescend. Le bandeau reutilise `handleManageComposition`, la
  // destination exacte de la rangee « Convocation ».
  //
  // 💳 ET LE PRIX EST SUR LA PROPOSITION, PAS AU BOUT. Aujourd'hui la chip
  // « Convocation » s'affiche sans aucun controle d'abonnement et le refus tombe en
  // 403 AU MOMENT DE PUBLIER (D88 §2.2) — apres que le coach a coche et place
  // ses joueurs. Un rappel muet laisserait ce mur entier ; un rappel qui dirait
  // « prepare ta compo » le mettrait en vitrine a zero clic. Il annonce donc
  // l'offre, et il mene aux offres — il ne promet aucun travail qui finira
  // refuse.
  const renderCompoReminder = () => {
    if (!isCompoReminderVisible) return null;

    return (
      <View
        style={[
          ApplicationStyle.borderRadius16,
          ApplicationStyle.borderWidth1,
          Spaces.padding[12],
          Spaces.gap[4],
          // Pas de marge propre : le conteneur de contenu porte deja `gap: 24`
          // (`WithDataWrapper wrapperStyle`), et une marge en plus ferait 36 pt
          // de vide entre le menu de gestion et le rappel.
          {
            backgroundColor: withAlpha(Colors.primary500, 0.08),
            borderColor: withAlpha(Colors.primary500, 0.24),
          },
        ]}
        testID="event-compo-reminder"
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {canManageComposition
            ? t('eventDetails.compoReminder.title', 'Ce match n’a pas encore de convocation')
            : t(
              'eventDetails.compoReminder.offerTitle',
              'La convocation est incluse dans l’offre Équipe',
            )}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={canManageComposition ? handleManageComposition : handleOpenSubscriptionOverview}
          style={[Spaces.paddingVertical[12], { alignSelf: 'flex-start' }]}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary500]}>
            {canManageComposition
              ? t('eventDetails.compoReminder.action', 'Préparer la convocation')
              : t('eventDetails.compoReminder.offerAction', 'Voir l’offre Équipe')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // AD01 — LA LIGNE COMPACTE, EN HAUT DU CORPS DE LA PAGE.
  //
  // 🔒 Elle parait EXACTEMENT la ou le bloc du bas paraissait deja pour ce
  // lecteur (`:5672`) : meme garde `supportsEventComposition`, meme garde
  // `canViewPublishedComposition`, meme exclusion de l'organisateur
  // (`:5682` — le coach ne lit pas « Tu es convoque », ce n'est pas son ecran).
  // ⇒ Aucune surface nouvelle : la phrase change de PLACE, pas de public.
  const renderViewerConvocationLine = () => {
    if (canEdit || !supportsEventComposition || !canViewPublishedComposition) return null;

    const estRetenu = Boolean(hasPublishedComposition && viewerConvocationRole);

    return (
      <View
        style={[
          ApplicationStyle.borderRadius16,
          ApplicationStyle.borderWidth1,
          Spaces.paddingHorizontal[16],
          Spaces.paddingVertical[12],
          { borderColor: withAlpha(estRetenu ? Colors.primary500 : Colors.neutral300, 0.45) },
        ]}
      >
        <Text style={[Fonts.p2Bold, estRetenu ? Fonts.primary500 : Fonts.neutral300]}>
          {viewerConvocationHeadline}
        </Text>
      </View>
    );
  };

  // L4-B — CE QUE CHAQUE RANGEE DIT SOUS SON LIBELLE.
  // La maquette 04 · 4C demande que le menu annonce OU il mene : « Convocation » et
  // « Modifier » ne se distinguent pas d'un seul mot quand on ne connait pas
  // l'app. ⛔ Les chips qui portent DEJA une `note` (l'etat des stats du match,
  // le motif d'une porte fermee) gardent la leur : un MOTIF prime toujours sur
  // une destination — une porte grisee doit dire pourquoi, pas ou elle mene.
  const manageRowSubtitles = {
    cancel: t('eventDetails.menu.cancel', 'Prévenir les participant·e·s et annuler'),
    detectionTeamsBoard: t('eventDetails.menu.detectionTeamsBoard', 'Les terrains de la détection'),
    edit: t('eventDetails.menu.edit', 'Date, lieu, description'),
    feature: t('eventDetails.menu.feature', 'Proposer cet événement à la une'),
    licenseCampaign: t('eventDetails.menu.campaign', 'Créer la cotisation de cet événement'),
    // N4 (D1) : le sous-titre suit le libelle. « Convoquer » ne veut rien dire
    // sur une detection, ou l'on repartit des inconnus sur des terrains.
    lineup: isDetectionEvent
      ? t('eventDetails.menu.lineupDetection', 'Répartir les joueur·se·s sur les terrains')
      : t('eventDetails.menu.lineup', 'Choisir et convoquer les joueur·se·s'),
    poster: t('eventDetails.menu.poster', 'Voir et partager l’affiche'),
    tournamentSettings: t('eventDetails.menu.tournamentSettings', 'Format, équipes et terrains'),
  };

  /**
   * Une rangee de la feuille d'organisation. Recopie du motif AC01
   * (`TeamDetails.js:2487`) avec UNE difference : elle porte un sous-titre, et
   * ce sous-titre n'est JAMAIS tronque — deux des notes sont des phrases de
   * trois lignes, et une porte fermee coupee au milieu ne s'explique plus.
   * @param {any} chip - La chip issue de `buildManageChips`.
   * @param {boolean} isLast - Vraie pour la derniere rangee (pas de filet).
   * @returns {import('react').ReactElement} - La rangee.
   */
  const renderManageRow = (chip, isLast) => {
    let rowColor = Colors.primary500;
    if (chip.isDestructive) rowColor = Colors.error500;
    else if (chip.disabled) rowColor = Colors.neutral300;

    const subtitle = chip.note || manageRowSubtitles[chip.key] || '';

    return (
      // 🪤 LE `testID` VIT SUR CE `View`, PAS SUR LE PRESSABLE, et ce n'est pas
      // un detail de style : `TouchableOpacity` propage son `testID` a cinq
      // noeuds internes, et les temoins voisins comptent les chips par
      // `node.props.testID === … && node.type === View`. Pose sur le pressable,
      // le meme releve rendrait « 25 actions » la ou il y en a 5.
      // ⛔ La largeur est `100%` : la grille a deux colonnes de l'accordeon
      // laisse place aux rangees pleine largeur de la maquette 04 · 4C — une
      // demi-chip ne peut pas porter un libelle ET sa destination.
      <View key={chip.key} style={{ width: '100%' }} testID="event-manage-chip">
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.82}
          disabled={chip.disabled}
          onPress={chip.onPress}
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[12],
            Spaces.paddingHorizontal[16],
            Spaces.paddingVertical[12],
            {
              borderBottomColor: withAlpha(Colors.neutral00, 0.07),
              borderBottomWidth: isLast ? 0 : 1,
              minHeight: 52,
            },
          ]}
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: withAlpha(rowColor, 0.1),
              borderRadius: 12,
              height: 32,
              justifyContent: 'center',
              opacity: chip.disabled ? 0.55 : 1,
              width: 32,
            }}
          >
            <Image
              source={Images[chip.icon]}
              style={{ height: 15, tintColor: rowColor, width: 15 }}
            />
          </View>

          <View style={{ flex: 1 }}>
            {/* 🎯 N4 (D2) — LE LIBELLE SE VISE PAR SA CLEF, JAMAIS PAR SON
                TEXTE. Depuis L4 il existe un ONGLET « Convocation » ET une
                rangee « Convocation » sur la meme page : tout releve par
                sous-chaine attrape l'onglet en premier et ne prouve plus rien.
                Le `testID` porte la clef de la rangee, ce qui permet une
                egalite STRICTE de libelle dans les temoins.
                ⛔ Il vit sur ce `Text` et pas sur le `View` du dessus : celui-la
                porte deja `event-manage-chip`, par lequel les temoins voisins
                COMPTENT les rangees. */}
            <Text
              style={[
                Fonts.p2Bold,
                { color: chip.isDestructive ? Colors.error500 : Colors.neutral00 },
              ]}
              testID={`event-manage-label-${chip.key}`}
            >
              {chip.label}
            </Text>
            {subtitle ? (
              <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <Text style={[Fonts.p2, Fonts.neutral500]}>›</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // L4-B — L'ACCORDEON DEVIENT UNE FEUILLE, OUVERTE PAR LE ⋯ DE LA BARRE DU HAUT.
  //
  // ⛔ AUCUNE ACTION N'A ETE RETIREE NI DEPLACEE : la feuille rend EXACTEMENT
  // `manageChips`, dans le meme ordre, avec les memes conditions et les memes
  // libelles. Seul le CONTENANT change — l'accordeon vivait au milieu de la
  // colonne, ferme par defaut, et il fallait defiler pour le trouver.
  //
  // `snapPoints` reste ABSENT a dessein : la feuille porte un en-tete et AUCUN
  // pied, cas ou le dimensionnement dynamique de `BottomModal` suffit
  // (`BottomModal.js:297`, `enableDynamicSizing={!snapPoints}`). C'est
  // l'association en-tete + pied qui exige des `snapPoints` (piege paye au lot
  // D19, meme choix qu'AC01 sur `TeamDetails.js:4561`).
  const renderManageSheet = () => {
    if (!hasManageActions) return null;

    return (
      <BottomModal
        close={() => setIsEventActionsSheetOpen(false)}
        headerComponent={(
          <Text style={[Fonts.h5Bold, Fonts.neutral00]}>
            {t('eventDetails.managePanel.title', "Gérer l'événement")}
          </Text>
        )}
        isVisible={isEventActionsSheetOpen}
      >
        <View
          style={[
            ApplicationStyle.borderWidth1,
            {
              borderColor: withAlpha(Colors.primary500, 0.3),
              borderRadius: 16,
              overflow: 'hidden',
            },
          ]}
          testID="event-manage-sheet"
        >
          {manageChips.map((chip, index) => renderManageRow(
            chip,
            index === manageChips.length - 1,
          ))}
        </View>
      </BottomModal>
    );
  };

  /**
   * 🎯 N2 — L'ACTION PRIMAIRE D'UN TOURNOI, SELON QUI REGARDE (Q8=C, 6 etats).
   *
   * ⚠️ Un tournoi etait le SEUL type d'evenement sans barre du bas : depuis
   * avril, `renderActionButtons` rendait `null` des qu'il en voyait un, et
   * l'ecran se terminait sur du vide. Toutes les actions vivaient dans un
   * panneau pose en HAUT de la page — donc hors de portee du pouce, et hors de
   * vue des qu'on avait defile.
   *
   * ⛔ AUCUN LIBELLE N'EST INVENTE ICI : les six existaient deja dans le
   * panneau de tete. C'est un DEPLACEMENT, pas un elargissement de droits —
   * les conditions sont reprises telles quelles, dans le meme ordre.
   *
   * @returns {{ onPress: () => void, title: string } | null}
   */
  const getTournamentPrimaryAction = () => {
    if (!isTournamentEvent || isStageDayEvent) return null;

    if (canEdit) {
      return { onPress: handleOpenTournamentManagement, title: 'Gérer le tournoi' };
    }

    if (managedTournamentTeam?.documentId) {
      return {
        onPress: () => handleOpenTournamentTeam(managedTournamentTeam.documentId),
        title: 'Gérer mon équipe inscrite',
      };
    }

    if (currentUserTournamentTeam?.documentId) {
      return {
        onPress: () => handleOpenTournamentTeam(currentUserTournamentTeam.documentId),
        title: 'Voir mon équipe inscrite',
      };
    }

    if (currentUserPendingTournamentTeam?.documentId) {
      const pendingStatus = normalizeTournamentText(
        currentUserPendingTournamentTeam?.members?.find(
          // @ts-ignore: FIXME: Baseline TS regression
          (member) => member?.user?.documentId === userData?.documentId,
        )?.responseStatus,
      );
      return {
        onPress: () => handleOpenTournamentTeam(currentUserPendingTournamentTeam.documentId),
        title: pendingStatus === 'invited' ? 'Répondre à mon invitation' : 'Suivre ma demande',
      };
    }

    return { onPress: handleOpenTournamentManagement, title: 'Voir le tournoi' };
  };

  const renderTournamentActionsPanel = () => {
    if (!isTournamentEvent || isStageDayEvent) return null;
    // 🎯 N2 — LES QUATRE ACTIONS PRIMAIRES ONT QUITTE CE PANNEAU pour la barre
    // du bas (`getTournamentPrimaryAction`). Elles etaient en HAUT de la page :
    // hors de portee du pouce, et invisibles des qu'on avait defile.
    // ⛔ Il ne reste ici que les deux gestes d'INSCRIPTION.
    if (!canRegisterTournamentSourceTeam && !canCreateCustomTournamentTeam) return null;

    return (
      <View style={[Spaces.gap[12]]}>
        <View
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius24,
            Spaces.paddingHorizontal[16],
            Spaces.paddingVertical[16],
            Spaces.gap[12],
            {
              borderColor: withAlpha(Colors.primary500, 0.27),
              borderWidth: 1,
              overflow: 'hidden',
            },
          ]}
        >
          {canRegisterTournamentSourceTeam ? (
            <Button
              onPress={() => setIsTournamentRegisterModalVisible(true)}
              title="Inscrire une équipe du club"
              variant="Secondary"
            />
          ) : null}

          {canCreateCustomTournamentTeam ? (
            <Button
              onPress={() => setIsTournamentCreateModalVisible(true)}
              title="Créer une équipe pour ce tournoi"
              variant="Secondary"
            />
          ) : null}
        </View>
      </View>
    );
  };

  const renderEventLicenseCampaignActions = () => {
    if (!canManageEventLicenseCampaigns) return null;
    if (!eventCampaignCreationSuggested && eventLicenseCampaigns.length === 0) return null;

    const hasLinkedCampaigns = eventLicenseCampaigns.length > 0;

    if (eventLicenseCampaignsQuery.isLoading) {
      return (
        <View style={[Spaces.gap[8], Spaces.paddingTop[4]]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Cotisations</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            Chargement des campagnes...
          </Text>
        </View>
      );
    }

    // D21 ① : le bouton de creation qui vivait ici est devenu la chip
    // « Préparer la cotisation » du menu « Gérer l'événement ». Le geste n'a
    // pas disparu, il a change de place — voir `buildManageChips`.
    if (!hasLinkedCampaigns) return null;

    return (
      <View style={[Spaces.gap[12], Spaces.paddingTop[4]]}>
        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Cotisations liées</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            Campagnes de paiement rattachées à cet événement.
          </Text>
        </View>

        {eventLicenseCampaigns.map((/** @type {any} */ campaign) => {
          const campaignId = campaign?.documentId || campaign?.id;
          const assignmentTotal = Number(campaign?.totals?.total || 0);
          return (
            <View
              key={campaignId}
              style={[
                ApplicationStyle.borderRadius16,
                ApplicationStyle.borderWidth1,
                Spaces.padding[12],
                Spaces.gap[8],
                {
                  backgroundColor: Colors.primary700,
                  borderColor: `${Colors.primary500}55`,
                },
              ]}
            >
              <View
                style={[
                  Alignments.row,
                  Alignments.justifySpaceBetween,
                  Alignments.alignCenter,
                  Spaces.gap[12],
                ]}
              >
                <View style={[Spaces.gap[4], { flex: 1 }]}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {campaign?.name || 'Campagne événement'}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    {formatCampaignAmount(
                      campaign?.defaultAmountCents,
                      campaign?.currency || 'EUR',
                    )}
                    {' '}
                    par participant
                    {' - '}
                    {assignmentTotal}
                    {' '}
                    affectation(s)
                  </Text>
                </View>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                  {String(campaign?.status || 'draft').toUpperCase()}
                </Text>
              </View>
              <View style={[Alignments.row, Spaces.gap[8]]}>
                <Button
                  onPress={() => openEventLicenseCampaign(campaign)}
                  style={{ flex: 1 }}
                  title="Ouvrir"
                  variant="Secondary"
                />
                <Button
                  onPress={() => editEventLicenseCampaign(campaign)}
                  style={{ flex: 1 }}
                  title="Modifier"
                  variant="Secondary"
                />
              </View>
            </View>
          );
        })}
        <Button
          onPress={openEventLicenseCampaignSettings}
          title="Créer une autre campagne"
          variant="Secondary"
        />
      </View>
    );
  };

  const renderTournamentSection = () => {
    if (!isTournamentEvent || isStageDayEvent) return null;
    let tournamentFormatLabel = 'Poules uniquement';
    if (event?.tournamentConfig?.formatMode === 'groups_to_knockout') {
      tournamentFormatLabel = 'Poules + finale';
    } else if (event?.tournamentConfig?.formatMode === 'knockout_only') {
      tournamentFormatLabel = 'Phase finale directe';
    } else if (event?.tournamentConfig?.formatMode === 'round_robin') {
      tournamentFormatLabel = 'Championnat';
    }
    const isCompetitionPublished = event?.tournamentConfig?.competitionState === 'published';
    const competitionStateLabel = isCompetitionPublished
      ? 'Compétition publiée'
      : 'Compétition en brouillon';
    let primaryActionHelper = 'Consulte le déroulé, les équipes et les résultats du tournoi.';
    if (canEdit && isCompetitionPublished) {
      primaryActionHelper = 'Calendrier, résultats et classement sont prêts à être pilotés.';
    } else if (canEdit) {
      primaryActionHelper = 'Finalise les équipes et les paramètres avant de lancer le tournoi.';
    }
    const teamsSummary = `${tournamentTeamCounters.accepted} validée(s) · ${tournamentTeamCounters.pending} en attente`;

    // 🧭 LES CINQ ETAPES DU FIL — ce que la page sait, sans un appel de plus.
    //
    // ponytail: « Poules » et « Matchs » ne sont pas distinguees de « Publié ».
    //   PLAFOND : la page ne peut pas savoir si les poules existent mais ne sont
    //   pas publiees — cet etat-la vit derriere `GET /events/:id/tournament/dashboard`.
    //   POURQUOI ON NE L'APPELLE PAS : ce hook tire `tournamentCompetitionService`,
    //   donc `@/services/client`. Les treize suites qui montent cet ecran
    //   devraient toutes le mocker, et le projet a deja paye ce piege (un import
    //   de service de plus = des suites entieres qui ne s'executent plus).
    //   CE QUI RESTE VRAI : publier EXIGE des poules et des matchs. Un tournoi
    //   publie a donc necessairement franchi les etapes 3 et 4 — le fil ne ment
    //   jamais, il est seulement moins precis pendant le brouillon.
    //   SORTIE : appeler `useGetTournamentDashboard` le jour ou un lot mocke ce
    //   module dans les treize suites.
    const tournamentRailSteps = [
      {
        done: Boolean(event?.tournamentConfig?.formatMode),
        label: t('eventDetails.tournamentRail.settings', 'Réglages'),
      },
      {
        done: tournamentTeamCounters.accepted >= 2,
        label: t('eventDetails.tournamentRail.teams', 'Équipes'),
      },
      {
        done: isCompetitionPublished,
        label: t('eventDetails.tournamentRail.groups', 'Poules'),
      },
      {
        done: isCompetitionPublished,
        label: t('eventDetails.tournamentRail.matches', 'Matchs'),
      },
      {
        done: isCompetitionPublished,
        label: t('eventDetails.tournamentRail.published', 'Publié'),
      },
    ];
    const tournamentScopeLabel = event?.tournamentScopeMode === 'autonomous'
      ? 'Tournoi autonome'
      : 'Équipe source';
    const tournamentContextTags = [
      tournamentScopeLabel,
      event?.tournamentActivity?.name,
      event?.tournamentSection?.name,
      event?.tournamentCategory?.name,
    ].filter(Boolean);
    let playerTournamentStatusLabel = 'Réponse attendue';
    let playerTournamentStatusTone = Colors.warning500;
    if (currentUserTournamentStatus === 'present') {
      playerTournamentStatusLabel = 'Présent';
      playerTournamentStatusTone = Colors.success500;
    } else if (currentUserTournamentStatus === 'absent') {
      playerTournamentStatusLabel = 'Absent';
      playerTournamentStatusTone = Colors.error500;
    }
    return (
      <View style={Spaces.gap[16]}>
        <View style={tournamentDs.styles.panelCard}>
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p4Bold, Fonts.primary500]}>TOURNOI</Text>
              <Text style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginTop[4]]}>
                {competitionStateLabel}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[8], { lineHeight: 20 }]}>
                {primaryActionHelper}
              </Text>
            </View>
            <Tag
              style={tournamentDs.getToneTagStyle(isCompetitionPublished ? Colors.success500 : Colors.warning500)}
              text={isCompetitionPublished ? 'Publié' : 'Brouillon'}
              // @ts-ignore: FIXME: Baseline TS regression
              textColor={isCompetitionPublished ? 'neutral00' : 'warning500'}
              textStyle={isCompetitionPublished ? { color: Colors.success500 } : undefined}
            />
          </View>

          <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
            {tournamentContextTags.map((label) => (
              <Tag
                key={label}
                style={tournamentDs.getToneTagStyle(Colors.primary500)}
                text={label}
                textColor="primary500"
              />
            ))}
            <Tag style={tournamentDs.getToneTagStyle(Colors.primary500)} text={tournamentFormatLabel} textColor="primary500" />
            <Tag
              style={tournamentDs.getToneTagStyle(Colors.warning500)}
              text={teamsSummary}
              textColor={/** @type {any} */ ('warning500')}
            />
            {event?.tournamentConfig?.knockoutSize ? (
              <Tag
                style={tournamentDs.getToneTagStyle(Colors.primary500)}
                text={`Bracket ${event.tournamentConfig.knockoutSize}`}
                textColor="primary500"
              />
            ) : null}
          </View>

          <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
            <View style={[tournamentDs.styles.insetPanelCard, { flexGrow: 1, minWidth: 132 }]}>
              <Text style={[Fonts.p4, Fonts.neutral300]}>Équipes</Text>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{tournamentTeams.length}</Text>
            </View>
            <View style={[tournamentDs.styles.insetPanelCard, { flexGrow: 1, minWidth: 132 }]}>
              <Text style={[Fonts.p4, Fonts.neutral300]}>Validation</Text>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {event?.tournamentConfig?.registrationMode === 'auto' ? 'Auto' : 'Manuelle'}
              </Text>
            </View>
            <View style={[tournamentDs.styles.insetPanelCard, { flexGrow: 1, minWidth: 132 }]}>
              <Text style={[Fonts.p4, Fonts.neutral300]}>Points</Text>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {`V${event?.tournamentConfig?.pointsWin ?? 3} N${event?.tournamentConfig?.pointsDraw ?? 1} D${event?.tournamentConfig?.pointsLoss ?? 0}`}
              </Text>
            </View>
          </View>

          {event?.tournamentConfig?.rulesText ? (
            <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 20 }]}>
              {event.tournamentConfig.rulesText}
            </Text>
          ) : null}
        </View>

        <TournamentProgressRail
          note={tournamentTeamCounters.pending > 0
            ? `${tournamentTeamCounters.pending} inscription${tournamentTeamCounters.pending > 1 ? 's' : ''} à vérifier`
            : ''}
          steps={tournamentRailSteps}
          title={t('eventDetails.tournamentRail.title', 'OÙ EN EST LE TOURNOI')}
        />

        {currentUserTournamentMember ? (
          <View style={tournamentDs.styles.panelCard}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Ma réponse au tournoi</Text>
                <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4], { lineHeight: 20 }]}>
                  Ta réponse concerne ton équipe tournoi, pas le RSVP classique de l’événement.
                </Text>
              </View>
              <Tag
                style={tournamentDs.getToneTagStyle(playerTournamentStatusTone)}
                text={playerTournamentStatusLabel}
                textColor="neutral00"
                textStyle={{ color: playerTournamentStatusTone }}
              />
            </View>

            <View style={[Alignments.row, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={respondTournamentPresenceMutation.isPending || currentUserTournamentStatus === 'present'}
                  isLoading={respondTournamentPresenceMutation.isPending}
                  onPress={() => handleRespondTournamentPresence('present')}
                  title={currentUserTournamentStatus === 'present' ? 'Présent confirmé' : 'Je suis présent'}
                  variant={currentUserTournamentStatus === 'present' ? 'Primary' : 'Secondary'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={respondTournamentPresenceMutation.isPending || currentUserTournamentStatus === 'absent'}
                  isLoading={respondTournamentPresenceMutation.isPending}
                  onPress={() => handleRespondTournamentPresence('absent')}
                  title={currentUserTournamentStatus === 'absent' ? 'Absence confirmée' : 'Je suis absent'}
                  variant={currentUserTournamentStatus === 'absent' ? 'Primary' : 'Secondary'}
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  /**
   * 🏆 N2 — L'ONGLET « Équipes » D'UN TOURNOI (planche 04, cadre 4E).
   *
   * Tout ce qui parle des equipes inscrites vit ici : le resume, les cartes, et
   * les deux gestes d'INSCRIPTION qui vivaient dans le panneau de tete.
   *
   * ⚠️ LES BOUTONS « Valider » / « Refuser » N'ONT PAS BOUGE D'UN POUCE. Ils
   * acceptent ou refusent l'inscription d'une equipe — un geste qui engage
   * l'organisateur vis-a-vis d'un tiers. Meme condition (`canEdit` et statut
   * `pending`), meme handler, meme charge. Seul l'onglet qui les contient est
   * neuf, et c'est le filet de l'etape 1 qui le prouve.
   */
  const renderTournamentTeamsTab = () => {
    if (!isTournamentEvent || isStageDayEvent) return null;

    const teamsSummary = `${tournamentTeamCounters.accepted} validée(s) · ${tournamentTeamCounters.pending} en attente`;

    return (
      <View style={Spaces.gap[16]}>
        {renderTournamentActionsPanel()}

        <View style={tournamentDs.styles.panelCard}>
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Équipes tournoi</Text>
              <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>{teamsSummary}</Text>
            </View>
            {tournamentTeamCounters.warning > 0 ? (
              <Tag
                style={tournamentDs.getToneTagStyle(Colors.gold500)}
                text={`${tournamentTeamCounters.warning} à vérifier`}
                // @ts-ignore: FIXME: Baseline TS regression
                textColor="gold500"
              />
            ) : null}
          </View>

        </View>

        {tournamentTeams.length === 0 ? (
          <View style={tournamentDs.styles.panelCard}>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Aucune équipe n est encore inscrite sur ce tournoi.
            </Text>
          </View>
        ) : null}

        {tournamentTeams.map((tournamentTeam) => {
          const rosterSummary = getTournamentRosterSummary(tournamentTeam, tournamentConfig);
          const hasRosterWarning = isTournamentTeamNonCompliant(tournamentTeam, tournamentConfig);
          // 🏷️ Les quatre etats, tels que la planche 04 les nomme : deux mots
          // en capitales, lisibles d'un coup d'oeil sur une pile de cartes.
          let tournamentTeamStatusLabel = t('eventDetails.tournamentTeams.accepted', 'INSCRITE');
          if (tournamentTeam?.status === 'pending') {
            tournamentTeamStatusLabel = t('eventDetails.tournamentTeams.pending', 'À VÉRIFIER');
          } else if (tournamentTeam?.status === 'declined') {
            tournamentTeamStatusLabel = t('eventDetails.tournamentTeams.declined', 'REFUSÉE');
          } else if (tournamentTeam?.status === 'archived') {
            tournamentTeamStatusLabel = t('eventDetails.tournamentTeams.archived', 'ARCHIVÉE');
          }
          // 👑 Le capitaine ou le referent : la carte disait le NOMBRE de joueurs
          // sans jamais dire A QUI s'adresser pour cette equipe.
          const tournamentTeamLead = [
            tournamentTeam?.captainUser?.firstname,
            tournamentTeam?.captainUser?.lastname,
          ].filter(Boolean).join(' ');

          return (
            <TouchableOpacity
              key={tournamentTeam?.documentId || tournamentTeam?.name}
              onPress={() => handleOpenTournamentTeam(tournamentTeam?.documentId)}
              style={tournamentDs.styles.panelCard}
            >
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {tournamentTeam?.name || 'Équipe tournoi'}
                  </Text>
                  <Text style={[Fonts.p4, Fonts.primary100]}>
                    {tournamentTeam?.sourceType === 'club_team'
                      ? `Depuis ${tournamentTeam?.sourceTeam?.name || 'une équipe club'}`
                      : 'Équipe éphémère'}
                  </Text>
                </View>
                <Tag
                  style={tournamentDs.getToneTagStyle(Colors.primary500)}
                  text={String(rosterSummary.totalCount || 0)}
                  textColor="primary500"
                />
              </View>

              <Text style={[Fonts.p4Bold, Fonts.neutral200]}>
                {tournamentTeamStatusLabel}
              </Text>
              {tournamentTeamLead ? (
                <Text style={[Fonts.p4, Fonts.neutral300]}>
                  {t('eventDetails.tournamentTeams.lead', 'Référent·e : {{name}}', {
                    name: tournamentTeamLead,
                  })}
                </Text>
              ) : null}
              <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                {rosterSummary.invitedCount > 0 ? (
                  <Tag
                    style={tournamentDs.getToneTagStyle(Colors.primary500)}
                    text={`${rosterSummary.invitedCount} invitation${rosterSummary.invitedCount > 1 ? 's' : ''}`}
                    textColor="primary500"
                  />
                ) : null}
                {rosterSummary.requestedCount > 0 ? (
                  <Tag
                    style={tournamentDs.getToneTagStyle(Colors.warning500)}
                    text={`${rosterSummary.requestedCount} demande${rosterSummary.requestedCount > 1 ? 's' : ''}`}
                    // @ts-ignore: FIXME: Baseline TS regression
                    textColor="warning500"
                  />
                ) : null}
                {hasRosterWarning ? (
                  // @ts-ignore: FIXME: Baseline TS regression
                  <Tag style={tournamentDs.getToneTagStyle(Colors.gold500)} text="Warning roster" textColor="gold500" />
                ) : null}
              </View>

              {canEdit && tournamentTeam?.status === 'pending' ? (
                <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[4]]}>
                  {/* 📏 44 px (`isOption`), et non les 39 px de `size="sm"` : la
                      planche 04 fixe cette taille pour les deux gestes qui
                      engagent l'organisateur vis-a-vis d'une equipe. */}
                  <Button
                    isLoading={reviewTournamentTeamMutation.isPending}
                    isOption
                    onPress={() => handleReviewTournamentTeam(tournamentTeam?.documentId, 'accepted')}
                    title="Valider"
                    variant="Primary"
                  />
                  <Button
                    isLoading={reviewTournamentTeamMutation.isPending}
                    isOption
                    onPress={() => handleReviewTournamentTeam(tournamentTeam?.documentId, 'declined')}
                    style={{ borderColor: `${Colors.error500}55` }}
                    textStyle={{ color: Colors.error300 }}
                    title="Refuser"
                    variant="SecondaryLight"
                  />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderActionButtons = () => {
    const isReservation = event?.type?.name?.toLowerCase()?.includes('reservation')
      || event?.type?.name?.toLowerCase()?.includes('reservation');

    if (isReservation) {
      const userDocumentId = userData?.documentId;
      const hasAlreadyJoined = event?.participations?.some((/** @type {any} */ participation) => participation?.documentId === userDocumentId);
      return (
        <View>
          <EventReservationActions
            event={event}
            hasAlreadyJoined={hasAlreadyJoined}
            mutations={mutations}
            userData={userData}
          />
          {hasAlreadyJoined && <Button disabled title="Je participe !" variant="Primary" />}
          {!hasAlreadyJoined && <Button onPress={handleJoinEvent} title="Reserver" variant="Primary" />}
        </View>
      );
    }

    // 🏆 N2 — LE TOURNOI RETROUVE UNE BARRE DU BAS (Q8=C).
    //
    // ⚠️ Il en etait prive DEPUIS AVRIL : ce `return null` renvoyait un ecran
    // qui se termine sur du vide, quel que soit le role. Un seul bouton
    // desormais, celui que CE lecteur-la peut faire — jamais une pile de six.
    //
    // 📏 52 px, et non les 47 px par defaut du composant : la planche 04 le
    // demande explicitement pour cette barre-la. C'est le seul bouton de
    // l'ecran, il porte donc toute la surface d'appui.
    if (isTournamentEvent && !isStageDayEvent) {
      const primaryAction = getTournamentPrimaryAction();
      if (!primaryAction) return null;

      return (
        <View testID="tournament-bottom-bar">
          <Button
            onPress={primaryAction.onPress}
            style={{ height: 52 }}
            title={primaryAction.title}
            variant="Primary"
          />
        </View>
      );
    }

    // D4 : le bouton autonome « Mettre à la une » a disparu — c'est la chip
    // « À la une » du panneau qui ouvre la meme modale, sous la meme condition.
    const pendingFeaturedActionNode = (() => {
      // 🔇 N1 (d) — CES DEUX BOUTONS-LA NE SONT PAS MUETS, ET C'EST LE POINT.
      //
      // La regle 5 du pack interdit un bouton gris sans explication. Ces deux-ci
      // portent DEJA leur motif dans leur titre : « Demande en attente » et
      // « Déjà à la une » disent exactement pourquoi on ne peut pas appuyer. Rien
      // a corriger, donc — mais leurs libelles etaient ecrits EN DUR, ce qui les
      // rendait invisibles a toute relecture de fr.js et impossibles a traduire.
      //
      // ⛔ « Demande en attente » existait deja en DEUX clefs : on reprend celle
      // du domaine de la mise a la une plutot que d'en creer une troisieme.
      // Seul « Déjà à la une » n'existait nulle part et devient une clef neuve.
      if (hasPendingFeaturedScope) {
        return (
          <View style={{ marginTop: 12, opacity: 0.7 }}>
            <Button
              disabled
              icon="clock"
              title={t('reservation.featuredRequest.pending', 'Demande en attente')}
              variant="Secondary"
            />
          </View>
        );
      }

      if (hasApprovedFeaturedScope && canManageFeatured) {
        return (
          <View style={{ marginTop: 12, opacity: 0.8 }}>
            <Button
              disabled
              icon="check"
              title={t('eventDetails.featuredRequest.alreadyFeatured', 'Déjà à la une')}
              variant="Secondary"
            />
          </View>
        );
      }

      return null;
    })();
    const eventLicenseCampaignActionsNode = canManageEventLicenseCampaigns
      ? renderEventLicenseCampaignActions()
      : null;
    const eventAnswerButtonsNode = (
      <EventAnswerButtons
        event={event}
        hasAcceptedRequest={hasAcceptedRequest}
        hasPendingRequest={hasPendingRequest}
        onDecline={() => handleDeclineEvent(event)}
        onDeleteParticipation={handleDeleteParticipation}
        onJoin={handleJoinEvent}
        onLogin={() => openPublicAuthFlow(navigation, {
          origin: RouteNames.EventDetails,
          source: 'event-details-login',
        })}
        onParticipate={() => handleParticipateToEvent(event)}
        participationFlow={tournamentAwareParticipationFlow}
      />
    );
    // D71 : les statistiques de match ont quitte ce bloc pour la chip
    // « matchStats » du menu « Gerer l'evenement ». C'etait le DERNIER geste
    // d'organisation pose en pied d'ecran par un organisateur — celui qu'Adel
    // cite le 2026-08-11. La condition de la branche perd donc `matchStatsNode`
    // sans changer de comportement : la chip n'existe que si `canEdit`, et
    // `canEdit` garantit deja `hasManageActions` par la chip « Modifier ».
    //
    // Ce qui n'est pas une action d'organisation reste en pied d'ecran. Le menu,
    // lui, a quitte ce bloc (D21 ② pour flotter, D53 pour redescendre en flux,
    // D64 pour remonter en tete de contenu) — mais `hasManageActions` reste dans
    // la condition, sinon un organisateur sans cotisation basculerait dans la
    // branche du bas et recevrait les boutons de participation qu'il n'a jamais
    // eus.
    // W01 — UN ORGANISATEUR QUI FAIT PARTIE DE L'EQUIPE REPOND AUSSI.
    //
    // `canEdit` a longtemps suffi a retirer les boutons de reponse : un
    // organisateur « ne repond pas, il organise ». Le lot U02 a change la regle
    // du serveur — un entraineur ou un dirigeant MEMBRE de l'equipe est
    // desormais accepte — et c'est exactement le compte d'Adel : il entraine
    // l'equipe, donc `canEdit` est vrai, donc l'ecran ne montait meme pas le
    // composant. Le bouton n'etait pas gris, il etait ABSENT.
    //
    // 🔒 L'organisateur qui n'est membre d'aucune equipe conviee (le club qui
    // pilote un evenement d'une autre equipe) garde l'ecran d'avant : sans
    // equipe source, le serveur refuserait sa reponse.
    const canAnswerWhileManaging = !canEdit || isConvenedTeamMember;

    if (hasManageActions || eventLicenseCampaignActionsNode) {
      return (
        <View style={[Spaces.gap[12]]}>
          {eventLicenseCampaignActionsNode}
          {canAnswerWhileManaging ? eventAnswerButtonsNode : null}
          {pendingFeaturedActionNode}
        </View>
      );
    }

    return (
      <View>
        {eventAnswerButtonsNode}
        {pendingFeaturedActionNode}
      </View>
    );
  };

  const refreshEventDetails = useCallback((options = {}) => {
    // @ts-ignore: FIXME: Baseline TS regression
    const includeSecondary = options?.includeSecondary !== false;

    refetch();
    if (!includeSecondary || !areDeferredQueriesEnabled) return;

    refetchParticipations();
    if (canAccessAttendance) {
      refetchAttendance();
    }
    if (supportsEventComposition && canEdit && compositionTeamId) {
      refetchTeamComposition();
    }
    if (isMatchEvent && compositionTeamId && (canManageMatchStats || isTeamMember)) {
      refetchMatchStats();
    }
    if (supportsEventComposition && canViewPublishedComposition && compositionTeamId) {
      refetchConvocation();
    }
    if (isMatchEvent && isTeamMember && compositionTeamId) {
      refetchMyMatchResponse();
    }
  }, [
    areDeferredQueriesEnabled,
    canAccessAttendance,
    canEdit,
    canManageMatchStats,
    canViewPublishedComposition,
    compositionTeamId,
    isMatchEvent,
    isTeamMember,
    refetch,
    refetchAttendance,
    refetchConvocation,
    refetchMatchStats,
    refetchMyMatchResponse,
    refetchParticipations,
    refetchTeamComposition,
    supportsEventComposition,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocusRefreshRef.current) {
        firstFocusRefreshRef.current = false;
        return undefined;
      }

      const now = Date.now();
      const hasFreshPrimaryData = Boolean(
        eventDataUpdatedAt
        && now - eventDataUpdatedAt < EVENT_DETAILS_STALE_MS,
      );
      const recentlyRefreshedOnFocus = Boolean(
        lastFocusRefreshAtRef.current
        && now - lastFocusRefreshAtRef.current < EVENT_DETAILS_STALE_MS,
      );

      if (hasFreshPrimaryData || recentlyRefreshedOnFocus) {
        return undefined;
      }

      lastFocusRefreshAtRef.current = now;
      markEventDetailsPerf('event_detail_focus_refresh_requested', {
        eventId,
        includeSecondary: areDeferredQueriesEnabled,
      });
      refreshEventDetails({ includeSecondary: areDeferredQueriesEnabled });
      return undefined;
    }, [
      areDeferredQueriesEnabled,
      eventDataUpdatedAt,
      eventId,
      refreshEventDetails,
    ]),
  );

  const renderHeaderLeft = useCallback(
    () => (fromEventCreation ? <HeaderBackButton onPress={handleBackAfterCreation} /> : null),
    [fromEventCreation, handleBackAfterCreation],
  );

  // L4-B — LA BARRE DU HAUT : ← · signaler · ⋯ (maquette planche 04 · 4C).
  // Le ⋯ remplace l'accordeon « Gérer l'événement » qui vivait au milieu de la
  // colonne. Il n'apparait QUE s'il y a quelque chose a gerer : c'est la meme
  // regle que l'accordeon d'avant (`hasManageActions`), donc aucun droit n'est
  // elargi et personne ne gagne un bouton muet.
  // 🖼️ Le glyphe `dotsVertical` existe deja (`GlyphIcon.js:120`, lot AD07) —
  // aucune image nouvelle n'est livree ici, et on ne redessine pas trois ronds
  // a la main comme AC01 avait du le faire avant lui.
  const renderHeaderRight = useCallback(
    () => (
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[4], Spaces.marginRight[16]]}>
        <Button
          icon="flag"
          isOption
          onPress={() => setIsReportModalVisible(true)}
          variant="Secondary"
        />
        {hasManageActions ? (
          <TouchableOpacity
            accessibilityLabel={t('eventDetails.managePanel.title', "Gérer l'événement")}
            accessibilityRole="button"
            activeOpacity={0.7}
            onPress={() => setIsEventActionsSheetOpen(true)}
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              { height: 44, width: 44 },
            ]}
            testID="event-actions-menu-button"
          >
            <GlyphIcon color={Colors.neutral00} name="dotsVertical" size={20} />
          </TouchableOpacity>
        ) : null}
      </View>
    ),
    [Alignments, Colors.neutral00, hasManageActions, Spaces, t],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: fromEventCreation ? renderHeaderLeft : undefined,
      headerRight: renderHeaderRight,
    });
  }, [fromEventCreation, navigation, renderHeaderLeft, renderHeaderRight]);

  const isCoachLateModal = lateModalMode === 'coach_mark' || lateModalMode === 'coach_edit';
  const isPlayerLateModal = lateModalMode === 'player_declare' || lateModalMode === 'player_update';
  const lateModalAttendance = lateModalUser?.documentId
    ? attendanceByUserId[lateModalUser.documentId]
    : null;
  const canResetLateModal = isCoachLateModal && Boolean(
    lateModalAttendance?.arrivedAt
    || lateModalAttendance?.declaredLateMinutes
    || lateModalAttendance?.manualOverride
    || lateModalAttendance?.note,
  );
  const isLateModalLoading = mutations.coachArrivalMutation.isPending
    || mutations.updateLateMinutesMutation.isPending
    || mutations.selfLateMutation.isPending
    || mutations.resetAttendanceMutation.isPending;
  let lateModalTitle = 'Corriger le retard';
  let lateModalDescription = 'Mets à jour le retard réel ou réinitialise le pointage.';
  let lateModalPrimaryActionTitle = 'Enregistrer';

  if (isPlayerLateModal) {
    lateModalTitle = lateModalMode === 'player_update' ? 'Mettre à jour mon retard' : 'Je serai en retard';
    lateModalDescription = 'Signale ton retard avant d\'arriver. Tu confirmeras ensuite ton arrivée réelle.';
    lateModalPrimaryActionTitle = 'Enregistrer mon retard';
  } else if (lateModalMode === 'coach_mark') {
    lateModalTitle = 'Pointer l\'arrivée';
    lateModalDescription = 'Pointe l\'arrivée et ajuste le retard si nécessaire.';
    lateModalPrimaryActionTitle = 'Pointer l\'arrivée';
  }

  // @ts-ignore: FIXME: Baseline TS regression
  const renderSelfAttendanceActionButton = (action, variant = 'Primary') => {
    if (!action) return null;

    if (action.type === 'arrived') {
      return (
        <Button
          disabled={mutations.selfArrivalMutation.isPending}
          icon="check"
          isLoading={mutations.selfArrivalMutation.isPending}
          onPress={handleSelfArrival}
          title={action.title}
          // @ts-ignore: FIXME: Baseline TS regression
          variant={variant}
        />
      );
    }

    return (
      <Button
        disabled={isLateModalLoading}
        onPress={openSelfLateModal}
        title={action.title}
        // @ts-ignore: FIXME: Baseline TS regression
        variant={variant}
      />
    );
  };

  // T02 — PLUS DE MARGE BASSE SUR LE CONTENEUR. Adel, le 2026-08-17 :
  // « supprimer le padding en bas des pages détails événement ». Elle
  // s'AJOUTAIT au plancher systeme au lieu de le porter : `ScreenContainer` pose
  // deja `insets.bottom` sur son cadre exterieur, et `contentContainerStyle`
  // habille un cadre INTERIEUR — mesure du jour, 12 px de vide en trop sous les
  // boutons de reponse. Le degagement de la barre systeme, lui, ne bouge pas
  // (mode `none` = plancher seul) et deux temoins le gardent dans
  // `EventDetailsBottomActions.test.js`.
  return (
    <ScreenContainer bgImage="bg2" contentContainerStyle={[Spaces.gap[32], Alignments.fill]} gradient={null} withHeaderPadding>
      <View style={[Spaces.gap[8], Alignments.alignCenter]}>
        <Tag
          style={{}}
          text={buildTypeTagLabel(event?.type?.name, typeTagSegmentsComplets)}
          textStyle={Fonts.p2}
        />
        {/* N3 (D4, Q1 = C) — la ligne « vs X » qu'Y02 avait posee ici est
            RETIREE : l'adversaire vit desormais dans l'encart de la carte,
            face au club (« Test FC — FC Bonneveine »). La garder ferait dire
            trois fois la meme chose — encart, titre, et cette ligne.
            ✅ Rien a nettoyer dans fr.js : `eventDetails.opponentLine` n'y a
            JAMAIS ete ajoutee (verifie — aucune occurrence dans
            src/theme/strings/translations/). Elle ne vivait que comme repli
            de t() ici meme ; elle part avec la ligne. */}
      </View>

      {/* D64 : ce cadre ne contient plus que la liste, et c'est le geste du lot.
          D53 y tenait le menu d'organisation en SECOND enfant, colle au bas du
          cadre. Or une ScrollView porte `flexGrow: 1` (son style de base dans
          React Native) : elle occupe donc TOUT le cadre meme quand son contenu
          est court, et le menu se retrouvait plaque en bas avec un grand vide
          entre le dernier bloc et lui. C'est le « gros bloc de padding pour
          caler Gerer l'evenement » signale par Adel le 2026-08-10.
          Le cadre reste indispensable : c'est lui qui borne la hauteur de la
          liste et garde le pied d'ecran (cotisations liees, stats de match,
          boutons de reponse) sur sa propre bande. */}
      <View style={Alignments.fill}>
        <ScrollView
          contentContainerStyle={[
            Spaces.gap[32],
            // D53 — la reserve n'a plus de bouton a degager : plus rien ne
            // flotte au-dessus de la liste. Il ne reste qu'un terminateur, le
            // meme dans les deux cas (avec ou sans actions d'organisation).
            Spaces.paddingBottom[16],
          ]}
          refreshControl={(
            <RefreshControl
              onRefresh={() => refreshEventDetails({ includeSecondary: true })}
              refreshing={isLoading || isEventFetching}
            />
          )}
          showsVerticalScrollIndicator={false}
        >
          <WithDataWrapper error={error} isLoading={isLoading} wrapperStyle={[Alignments.fill, Spaces.gap[24]]}>
            <EventHeader event={event} matchScoreSummary={matchHeaderScoreSummary} />
            {/* N1 (b) — sous la carte d'entete, et pour TOUS les lecteurs. Elle
                ne concerne que l'entrainement ouvert : les onglets du match ne
                la voient jamais, donc rien a brancher sur `showOverviewTab`. */}
            {openTrainingPublicLine ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>{openTrainingPublicLine}</Text>
            ) : null}
            {renderTournamentActionsPanel()}
            {renderViewerConvocationLine()}
            {renderDetailsTabs()}
            <View style={[Spaces.gap[24]]}>
              {/* 🚪 N5 (D4) — LA PROCHAINE ACTION PASSE EN PREMIER, juste sous
                  l entete, comme la maquette 2A la dessine. Elle ne renverse pas
                  la regle de L4 (« la description ouvre l Aperçu ») : elle la
                  precise — description AVANT les taches, action AVANT la
                  description. C est la seule chose a faire maintenant ; le reste
                  de la page est de la consultation. */}
              {showNextActionCard ? (
                <EventNextActionCard
                  expectedCount={nextActionExpectedCount}
                  mode={nextActionMode}
                  onPress={openAttendanceCall}
                  opensAtLabel={nextActionOpensAtLabel}
                />
              ) : null}

              {/* 🧾 N2 — LA DESCRIPTION OUVRE L APERÇU, POUR LES QUATRE TYPES.
                  Regle 2 du pack : un seul champ, le meme nom partout, EN HAUT
                  de l Apercu. Sur un stage et sur un tournoi, quatre blocs
                  passaient avant elle — rappel compo, bloc du stage, lien vers
                  le stage parent, section tournoi. Elle passe devant. */}
              {showOverviewTab && eventDescriptionText ? (
                <View style={[Spaces.gap[16]]}>
                  <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('eventDetails.fields.description')}</Text>
                  <Text style={[Fonts.p1, Fonts.primary100]}>{eventDescriptionText}</Text>
                </View>
              ) : null}

              {showCallUpTab && renderCompoReminder()}

              {/* 🏕️ N2 — LE STAGE PERD SES DEUX PASTILLES MAISON. Elles
                  vivaient DANS une carte, ce qui faisait des onglets a
                  l interieur d un onglet. Le contenu, lui, est intact : il a
                  simplement rejoint la matrice commune. */}
              {showOverviewTab && isStageParentEvent ? renderStageOverviewTab() : null}

              {showStageDaysTab && isStageParentEvent ? renderStageDaysTab() : null}

              {isStageDayEvent && event?.parentEvent?.documentId ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate(RouteNames.EventDetails, {
                    eventId: event.parentEvent.documentId,
                  })}
                  style={[
                    ApplicationStyle.backgroundColor.primary900,
                    ApplicationStyle.borderRadius24,
                    ApplicationStyle.borderWidth1,
                    Spaces.padding[16],
                    Spaces.gap[8],
                    {
                      borderColor: `${Colors.primary500}55`,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>Journée de stage</Text>
                  <Text style={[Fonts.p2, Fonts.neutral00]}>
                    Cette journée depend du stage principal.
                  </Text>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>Voir le stage</Text>
                </TouchableOpacity>
              ) : null}

              {showOverviewTab ? renderTournamentSection() : null}

              {showTournamentTeamsTab ? renderTournamentTeamsTab() : null}

              {showOverviewTab && canSelfMarkArrival && selfAttendanceStatus ? (
                <View style={[Spaces.gap[12]]}>
                  <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Statut d&apos;arrivée</Text>
                  <View
                    style={[
                      ApplicationStyle.backgroundColor.primary900,
                      ApplicationStyle.borderRadius24,
                      ApplicationStyle.borderWidth1,
                      Spaces.padding[16],
                      Spaces.gap[12],
                      {
                        borderColor: selfAttendanceStatus.accentColor,
                      },
                    ]}
                  >
                    <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.p3Bold, Fonts.neutral200]}>Présence événement</Text>
                        <Text style={[Fonts.p2, Fonts.neutral100, Spaces.marginTop[4]]}>
                          {selfAttendanceStatus.description}
                        </Text>
                      </View>
                      <View
                        style={[
                          {
                            backgroundColor: selfAttendanceStatus.badgeBackgroundColor,
                            borderColor: selfAttendanceStatus.badgeBorderColor,
                            borderRadius: 18,
                            borderWidth: 1,
                            minWidth: selfAttendanceStatus.badgeValue ? 136 : 104,
                            paddingHorizontal: selfAttendanceStatus.badgeValue ? 14 : 12,
                            paddingVertical: selfAttendanceStatus.badgeValue ? 9 : 7,
                          },
                        ]}
                      >
                        <Text style={[Fonts.p4, { color: selfAttendanceStatus.badgeTextColor, textAlign: 'center' }]}>
                          {selfAttendanceStatus.badgeLabel}
                        </Text>
                        {selfAttendanceStatus.badgeValue ? (
                          <Text
                            style={[
                              Fonts.p4Bold,
                              {
                                color: selfAttendanceStatus.badgeTextColor,
                                marginTop: 2,
                                textAlign: 'center',
                              },
                            ]}
                          >
                            {selfAttendanceStatus.badgeValue}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {!selfAttendanceStatus.hasArrived ? (
                      <View style={[Spaces.gap[8]]}>
                        {renderSelfAttendanceActionButton(selfAttendanceStatus.primaryAction, 'Primary')}
                        {selfAttendanceStatus.secondaryAction ? (
                          renderSelfAttendanceActionButton(selfAttendanceStatus.secondaryAction, 'SecondaryLight')
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* N1 (a) — LE BLOC SE MONTE DES QU'IL S'AGIT D'UNE DETECTION,
                  et non plus seulement quand il y a des postes a montrer.
                  🧨 Avant, deux gardes se superposaient : `length > 0` ici, et un
                  `return null` dans le composant. Une detection sans poste
                  n'affichait donc RIEN — l'organisateur ne savait pas s'il avait
                  oublie un reglage. C'est desormais le composant qui decide quoi
                  dire, en UN seul endroit, commande par `isDetection`. */}
              {showDetectionSplitTab && isDetectionEvent ? renderDetectionSplitTab() : null}

              {showOverviewTab && isDetectionEvent ? (
                <EventDetectionSlots
                  canEdit={canEdit}
                  currentUserHasGenericParticipation={Boolean((hasAcceptedRequest || hasPendingRequest) && !currentUserDetectionParticipation)}
                  // @ts-ignore: FIXME: Baseline TS regression
                  currentUserSlotId={currentUserDetectionParticipation?.recruitmentAd?.documentId || ''}
                  currentUserSlotStatus={String(currentUserDetectionParticipation?.participationStatus || '').toLowerCase()}
                  // @ts-ignore: FIXME: Baseline TS regression
                  isApplyingSlotId={applyToDetectionSlotMutation.isPending ? String(applyToDetectionSlotMutation.variables?.slotDocumentId || '') : ''}
                  isDetection
                  onApply={handleApplyToDetectionSlot}
                  onOpenSlot={handleOpenDetectionSlot}
                  slots={detectionSlots}
                />
              ) : null}

              {showOverviewTab && hasEventTasks ? (
                <EventTasksSection
                  canManageEvent={canEdit}
                  event={event}
                  userData={userData}
                />
              ) : null}

              {showOverviewTab && hasTeamAudiences ? (
                <EventTeamAudiencesSection
                  canManageEvent={canEdit}
                  event={event}
                  userData={userData}
                />
              ) : null}

              {canManageTrainingVisibility ? (
                <View
                  style={[
                    ApplicationStyle.backgroundColor.primary900,
                    ApplicationStyle.borderRadius16,
                    ApplicationStyle.borderWidth1,
                    Spaces.padding[16],
                    Spaces.gap[12],
                    {
                      borderColor: `${Colors.primary500}33`,
                    },
                  ]}
                >
                  <View style={[Spaces.gap[4]]}>
                    <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                      {trainingOpenConfig.isOpenTraining ? 'Entraînement ouvert' : 'Entraînement prive'}
                    </Text>
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {trainingOpenConfig.isOpenTraining
                        ? 'Les joueurs externes peuvent rejoindre selon ton quota et ton mode de validation.'
                        : 'Ouvre l\'entraînement pour autoriser un quota de joueurs externes sans toucher à tes joueurs internes.'}
                    </Text>
                  </View>

                  {trainingOpenConfig.externalParticipantLimit !== null ? (
                    <Text style={[Fonts.p3, Fonts.primary100]}>
                      {trainingOpenConfig.isOpenTraining
                        ? `${trainingOpenConfig.externalParticipantLimit} place(s) externes - validation ${trainingOpenConfig.externalParticipantValidationMode === 'auto' ? 'automatique' : 'manuelle'}`
                        : `Dernier reglage mémorise: ${trainingOpenConfig.externalParticipantLimit} place(s) externes - validation ${trainingOpenConfig.externalParticipantValidationMode === 'auto' ? 'automatique' : 'manuelle'}`}
                    </Text>
                  ) : null}

                  <Button
                    disabled={mutations.updateEventNoNavMutation.isPending}
                    isLoading={mutations.updateEventNoNavMutation.isPending}
                    onPress={trainingOpenConfig.isOpenTraining
                      ? handleCloseTraining
                      : () => setIsTrainingOpenModalVisible(true)}
                    title={trainingOpenConfig.isOpenTraining ? 'Fermer l\'entraînement' : 'Ouvrir l\'entraînement'}
                    variant={trainingOpenConfig.isOpenTraining ? 'SecondaryLight' : 'Primary'}
                  />
                </View>
              ) : null}

              {showParticipantsTab && (!isTournamentEvent || isStageDayEvent) ? (
                <EventParticipants
                  // @ts-ignore: FIXME: Baseline TS regression
                  attendanceByUserId={attendanceByUserId}
                  canApprovePendingRequests={canApprovePendingRequests}
                  canEdit={canEdit}
                  event={event}
                  eventStartAt={eventStartAt}
                  externalParticipationSection={externalParticipationSection}
                  handleExportParticipants={handleExportParticipants}
                  handleRemindPlayers={handleRemindPlayers}
                  handleShare={() => setIsShareModalVisible(true)}
                  handleUpdateParticipation={handleUpdateParticipation}
                  handleUserPress={handleUserPress}
                  nowMs={serverNowMs}
                  onCoachEditLate={handleCoachEditLate}
                  onCoachMarkArrival={handleCoachMarkArrival}
                  participantsSummary={participantsSummary}
                  participationsByStatus={participationsByStatus}
                  pendingParticipations={pendingParticipations}
                  teamParticipationSections={teamParticipationSections}
                />
              ) : null}

              {/* 👥 N2 — « Personnes » SUR UN TOURNOI. La liste des participations
                  ne dit rien d'un tournoi : on n'y participe pas seul, on y
                  participe PAR SON EQUIPE. C'est donc les effectifs des equipes
                  inscrites qu'il faut reunir, et c'est un composant a part.
                  🔒 Les noms ne sortent que pour qui organise. */}
              {showParticipantsTab && isTournamentEvent && !isStageDayEvent ? (
                <TournamentPeopleList canSeeNames={canEdit} teams={tournamentTeams} />
              ) : null}

              {showOverviewTab && isMatchEvent
            && compositionTeamId
            && isTeamMember
            && isMatchFinished
            && myMatchResponsePayload?.attendanceRestriction === 'no_show' ? (
              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Mes stats</Text>
                <View
                  style={[
                    ApplicationStyle.backgroundColor.primary900,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[16],
                    Spaces.gap[12],
                    {
                      borderColor: `${Colors.error500 || 'rgb(248, 113, 113)'}55`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.error500 || 'rgb(248, 113, 113)' }]}>
                    Pointage à corriger
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    Ton arrivée n&apos;a pas été confirmée avant la fin du match. Un coach doit corriger ta présence avant de débloquer ton retour post-match.
                  </Text>
                </View>
              </View>
                ) : null}

              {showOverviewTab && isMatchEvent && compositionTeamId && isTeamMember && isMatchFinished && canRespondMyMatchStats ? (
                <View style={[Spaces.gap[12]]}>
                  <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Mes stats</Text>
                  <View
                    style={[
                      ApplicationStyle.backgroundColor.primary900,
                      ApplicationStyle.borderRadius24,
                      ApplicationStyle.borderColor.primary500,
                      ApplicationStyle.borderWidth1,
                      Spaces.padding[16],
                      Spaces.gap[12],
                    ]}
                  >
                    <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.p4Bold, Fonts.primary500]}>Retour individuel</Text>
                        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                          {myMatchResponse?.selfRating ? `${myMatchResponse.selfRating}/10` : 'A compléter'}
                        </Text>
                      </View>
                      <View
                        style={[
                          Spaces.paddingHorizontal[12],
                          Spaces.paddingVertical[8],
                          {
                            backgroundColor: myMatchResponseStatusMeta.backgroundColor,
                            borderColor: myMatchResponseStatusMeta.borderColor,
                            borderRadius: 999,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Text
                          style={[Fonts.p4Bold, { color: myMatchResponseStatusMeta.textColor }]}
                        >
                          {myMatchResponseStatusMeta.label}
                        </Text>
                      </View>
                    </View>

                    <Text style={[Fonts.p2, Fonts.neutral100]}>
                      {myMatchResponseSummary}
                    </Text>

                    {myMatchResponse?.teamRating ? (
                      <View
                        style={[
                          ApplicationStyle.backgroundColor.primary700,
                          ApplicationStyle.borderRadius16,
                          Spaces.padding[12],
                        ]}
                      >
                        <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                          {`Le match de l equipe : ${myMatchResponse.teamRating}/10`}
                        </Text>
                      </View>
                    ) : null}

                    {myMatchResponse?.selfComment ? (
                      <View
                        style={[
                          ApplicationStyle.backgroundColor.primary700,
                          ApplicationStyle.borderRadius16,
                          Spaces.padding[12],
                        ]}
                      >
                        <Text numberOfLines={3} style={[Fonts.p4, Fonts.neutral100]}>
                          {myMatchResponse.selfComment}
                        </Text>
                      </View>
                    ) : null}

                    <Button
                      disabled={isMyMatchResponseFetching}
                      onPress={openMyMatchResponse}
                      size="sm"
                      title={myMatchResponseButtonTitle}
                      variant="Secondary"
                    />
                  </View>
                </View>
              ) : null}

              {showOverviewTab && isMatchEvent && compositionTeamId && isTeamMember && isMatchFinished && canRespondMyMatchStats ? (
                <View style={[Spaces.gap[12]]}>
                  <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Mon retour coach</Text>
                  <View
                    style={[
                      ApplicationStyle.backgroundColor.primary900,
                      ApplicationStyle.borderRadius24,
                      ApplicationStyle.borderColor.primary500,
                      ApplicationStyle.borderWidth1,
                      Spaces.padding[16],
                      Spaces.gap[12],
                      isCoachFeedbackHighlighted
                        ? {
                          borderColor: Colors.primary200,
                          borderWidth: 2,
                        }
                        : null,
                    ]}
                  >
                    <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.p4Bold, Fonts.primary500]}>Retour individuel du coach</Text>
                        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                          {myCoachReview?.rating != null ? `${myCoachReview.rating}/10` : 'En attente'}
                        </Text>
                      </View>
                      <View
                        style={[
                          Spaces.paddingHorizontal[12],
                          Spaces.paddingVertical[8],
                          {
                            backgroundColor: hasMyCoachReview ? `${Colors.success500}18` : `${Colors.primary500}18`,
                            borderColor: hasMyCoachReview ? `${Colors.success500}55` : `${Colors.primary500}40`,
                            borderRadius: 999,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Text style={[Fonts.p4Bold, hasMyCoachReview ? Fonts.success500 : Fonts.primary100]}>
                          {hasMyCoachReview ? 'Disponible' : 'Pas encore partage'}
                        </Text>
                      </View>
                    </View>

                    <Text style={[Fonts.p2, Fonts.neutral100]}>
                      {hasMyCoachReview
                        ? 'Le coach a publié un retour individuel pour ton match.'
                        : "Le coach n'a pas encore laisse d'avis individuel pour ce match."}
                    </Text>

                    {myCoachReview?.comment ? (
                      <View
                        style={[
                          ApplicationStyle.backgroundColor.primary700,
                          ApplicationStyle.borderRadius16,
                          Spaces.padding[12],
                        ]}
                      >
                        <Text style={[Fonts.p4, Fonts.neutral100]}>
                          {myCoachReview.comment}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {showOverviewTab && isMatchEvent && compositionTeamId && canViewMatchStats ? (
                <View style={[Spaces.gap[12]]}>
                  <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Stats du match</Text>

                  {/* 🎯 N4 (D6) — LA CARTE-PARCOURS « APRÈS LE MATCH » (maquette 05 · 5C).
                      Elle remplace l'entete de ce bloc : une pastille d'etat, un score et
                      une phrase de resume disaient TROIS fois « ou on en est » sans jamais
                      nommer les etapes. Le parcours les nomme, et le seul bouton qui reste
                      est celui de l'etape COURANTE.
                      ⛔ Rien n'est perdu : le motif d'une porte fermee (le sous-titre de
                      `matchStatsPrimaryAction`) descend DANS la carte, et le detail du
                      rapport reste juste dessous. */}
                  <PostMatchJourneyCard
                    boutonDesactive={matchStatsPrimaryAction.disabled || isMatchStatsFetching}
                    motif={matchStatsPrimaryAction.subtitle}
                    onPressEtape={(/** @type {string} */ etape) => (etape === 'score'
                      ? openMatchScoreSheet()
                      : openMatchStatsEditor())}
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

                  {/* Le DETAIL du rapport, sous le parcours. Son cadre disparait quand il
                      n'y a encore rien a detailler : une boite bordee et vide se lit comme
                      un contenu qui n'a pas charge. */}
                  <View
                    style={matchStatsReport || hasCollectiveRatings ? [
                      ApplicationStyle.backgroundColor.primary900,
                      ApplicationStyle.borderRadius24,
                      Spaces.padding[16],
                      Spaces.gap[12],
                    ] : null}
                  >
                    {hasCollectiveRatings ? (
                      <View style={[Alignments.row, Spaces.gap[12]]}>
                        {matchStatsReport?.collectiveRating ? (
                          <View
                            style={[
                              ApplicationStyle.backgroundColor.primary700,
                              ApplicationStyle.borderRadius16,
                              Spaces.padding[12],
                              Spaces.gap[4],
                              { flex: 1 },
                            ]}
                          >
                            <Text style={[Fonts.p4Bold, Fonts.primary100]}>Note coach</Text>
                            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{`${matchStatsReport.collectiveRating}/10`}</Text>
                          </View>
                        ) : null}
                        {playerCollectiveRating?.average != null ? (
                          <View
                            style={[
                              ApplicationStyle.backgroundColor.primary700,
                              ApplicationStyle.borderRadius16,
                              Spaces.padding[12],
                              Spaces.gap[4],
                              { flex: 1 },
                            ]}
                          >
                            <Text style={[Fonts.p4Bold, Fonts.primary100]}>Ressenti joueurs</Text>
                            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{`${playerCollectiveRating.average}/10`}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {matchStatsReport?.collectiveComment ? (
                      <View
                        style={[
                          ApplicationStyle.backgroundColor.primary700,
                          ApplicationStyle.borderRadius16,
                          Spaces.padding[12],
                        ]}
                      >
                        <Text numberOfLines={3} style={[Fonts.p4, Fonts.neutral100]}>
                          {matchStatsReport.collectiveComment}
                        </Text>
                      </View>
                    ) : null}

                    {/* N4 (D6) : « 4/12 joueurs ont repondu » est devenu l'ETAPE 3 de la
                        carte, juste au-dessus. Le repeter ici serait le meme chiffre a
                        trois centimetres de lui-meme. Le nombre de notes collectives
                        prises en compte, lui, reste — il ne dit pas la meme chose. */}
                    {playerCollectiveRating?.count ? (
                      <View
                        style={[
                          ApplicationStyle.backgroundColor.primary700,
                          ApplicationStyle.borderRadius16,
                          Spaces.padding[12],
                          Spaces.gap[4],
                        ]}
                      >
                        <Text style={[Fonts.p4, Fonts.neutral100]}>
                          {`${playerCollectiveRating.count} note${playerCollectiveRating.count > 1 ? 's' : ''} collective${playerCollectiveRating.count > 1 ? 's' : ''} prise${playerCollectiveRating.count > 1 ? 's' : ''} en compte`}
                        </Text>
                      </View>
                    ) : null}

                    {matchStatsReport ? (
                      <View style={[Alignments.row, Spaces.gap[12]]}>
                        <View
                          style={[
                            ApplicationStyle.backgroundColor.primary700,
                            ApplicationStyle.borderRadius16,
                            Spaces.padding[12],
                            { flex: 1 },
                          ]}
                        >
                          <Text style={[Fonts.p4, Fonts.neutral300]}>Version</Text>
                          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                            {`v${Number(matchStatsReport?.version || 1)}`}
                          </Text>
                        </View>
                        <View
                          style={[
                            ApplicationStyle.backgroundColor.primary700,
                            ApplicationStyle.borderRadius16,
                            Spaces.padding[12],
                            { flex: 2 },
                          ]}
                        >
                          <Text style={[Fonts.p4, Fonts.neutral300]}>Publication</Text>
                          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                            {matchStatsReport?.finalizedAt
                              ? new Date(matchStatsReport.finalizedAt).toLocaleString('fr-FR')
                              : '-'}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {isMatchStatsReviewRequired ? (
                      <View
                        style={[
                          ApplicationStyle.borderRadius16,
                          Spaces.padding[12],
                          {
                            backgroundColor: `${Colors.warning500}14`,
                            borderColor: `${Colors.warning500}45`,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Text style={[Fonts.p4, Fonts.warning500]}>
                          Le score officiel a changé après la première publication. Une mise à jour est requise.
                        </Text>
                      </View>
                    ) : null}

                  </View>
                </View>
              ) : null}

              {showCallUpTab && showPublishedComposition ? (
                <View style={[Spaces.gap[12]]}>
                  <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                    Composition d&apos;equipes
                  </Text>
                  {hasPublishedComposition ? (
                    <View style={[Spaces.gap[8]]}>
                      {/* AC08 — LA LIGNE D'ETAT. Convoque, remplacant ou non
                          retenu : trois phrases differentes la ou il n'y en
                          avait qu'une, identique pour tout le monde. */}
                      {canEdit ? null : (
                        <Text
                          style={[
                            Fonts.p2Bold,
                            viewerConvocationRole ? Fonts.primary500 : Fonts.neutral300,
                          ]}
                        >
                          {viewerConvocationLine}
                        </Text>
                      )}
                      <Text style={[Fonts.p2, Fonts.neutral300]}>
                        {publishedCompositionTeamCount > 0
                          ? `${publishedCompositionTeamCount} équipe(s) publiée(s)`
                          : 'Composition publiée'}
                      </Text>
                      <Text style={[Fonts.p3, Fonts.neutral300]}>
                        {convocationBranches.length}
                        {' '}
                        branche(s) visible(s)
                        {publishedCompositionReserveCount > 0 ? ` · ${publishedCompositionReserveCount} remplacant(s)` : ''}
                      </Text>
                      {convocationBranches[0]?.published?.publishedAt ? (
                        <Text style={[Fonts.p3, Fonts.neutral300]}>
                          Publie le
                          {' '}
                          {new Date(convocationBranches[0].published.publishedAt).toLocaleString('fr-FR')}
                        </Text>
                      ) : null}
                      {publishedCompositionTeamCount > 0 ? (
                        <Button
                          onPress={openPublishedConvocation}
                          title={publishedCompositionCtaTitle}
                          variant={viewerConvocationRole && !canEdit ? 'Primary' : 'Secondary'}
                        />
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[Fonts.p2, Fonts.neutral300]}>
                      Aucune composition publiée pour le moment.
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          </WithDataWrapper>
        </ScrollView>
      </View>

      <View style={[Spaces.gap[16]]}>
        {pendingFeaturedApproval?.requestId
          ? (
            <View style={[Alignments.row, Spaces.gap[16]]}>
              <Button
                icon="check"
                isLoading={approveFeaturedRequestMutation.isPending}
                isOption
                onPress={() => approveFeaturedRequestMutation.mutate(pendingFeaturedApproval.requestId)}
                style={{ flex: 1 }}
                title={`Valider ${pendingFeaturedApproval.scopeLabel.toLowerCase()}`}
                variant="Primary"
              />
              <Button
                icon="close"
                isLoading={rejectFeaturedRequestMutation.isPending}
                isOption
                onPress={handleRejectFeaturedApproval}
                style={{ flex: 1 }}
                title="Refuser"
                variant="Secondary"
              />
            </View>
          )
          : renderActionButtons()}
      </View>

      {/* L4-B : la feuille d'organisation vit AVEC LES MODALES, hors de la
          ScrollView — elle se pose PAR-DESSUS la page. C'est ce qui la rend
          incapable de recouvrir le bas de la liste des participants, defaut
          que D64 avait du corriger sur l'accordeon flottant d'avant. */}
      {renderManageSheet()}

      {(() => {
        let joinModalConfirmLabel = currentParticipationFlow?.confirmLabel;
        let joinModalContextNote;
        let joinModalIsSubmitting = mutations.createEventParticipationMutation.isPending;

        // @ts-ignore: FIXME: Baseline TS regression
        if (pendingDetectionSlot?.documentId) {
          joinModalConfirmLabel = 'Participer';
          // @ts-ignore: FIXME: Baseline TS regression
          joinModalContextNote = `Poste choisi : ${pendingDetectionSlot.position}.`;
          joinModalIsSubmitting = applyToDetectionSlotMutation.isPending
            // @ts-ignore: FIXME: Baseline TS regression
            && Boolean(pendingDetectionSlot?.documentId);
        // @ts-ignore: FIXME: Baseline TS regression
        } else if (pendingTournamentAction?.mode === 'create_custom') {
          joinModalConfirmLabel = 'Créer mon équipe';
          // @ts-ignore: FIXME: Baseline TS regression
          joinModalContextNote = `Équipe à créer : ${pendingTournamentAction?.teamName || 'Mon équipe'}.`;
          joinModalIsSubmitting = createTournamentTeamMutation.isPending;
        // @ts-ignore: FIXME: Baseline TS regression
        } else if (pendingTournamentAction?.mode === 'join_existing') {
          joinModalConfirmLabel = 'Envoyer ma demande';
          // @ts-ignore: FIXME: Baseline TS regression
          joinModalContextNote = `Équipe choisie : ${pendingTournamentAction?.teamName || 'Équipe tournoi'}.`;
          joinModalIsSubmitting = requestJoinTournamentTeamMutation.isPending;
        } else if (currentParticipationFlow?.submitMode === 'joinReservation') {
          joinModalIsSubmitting = mutations.joinReservationMutation.isPending;
        }

        /** @type {(acceptance?: { acceptRiskDeclaration?: boolean }) => Promise<void>} */
        let handleJoinModalConfirm = handleConfirmParticipation;

        // @ts-ignore: FIXME: Baseline TS regression
        if (pendingDetectionSlot?.documentId) {
          handleJoinModalConfirm = async (acceptance = {}) => {
            try {
              setJoinModalError('');
              // @ts-ignore: FIXME: Baseline TS regression
              await applyToDetectionSlotMutation.mutateAsync({
                payload: {
                  acceptRiskDeclaration: acceptance?.acceptRiskDeclaration === true,
                },
                // @ts-ignore: FIXME: Baseline TS regression
                slotDocumentId: pendingDetectionSlot.documentId,
              });
              setIsJoinModalVisible(false);
              setPendingDetectionSlot(null);
            } catch (mutationError) {
              setJoinModalError(
                getParticipationErrorMessage(mutationError, 'Impossible de confirmer ta participation pour le moment.'),
              );
            }
          };
        // @ts-ignore: FIXME: Baseline TS regression
        } else if (pendingTournamentAction?.mode === 'create_custom') {
          handleJoinModalConfirm = async (acceptance = {}) => {
            try {
              setJoinModalError('');
              // @ts-ignore: FIXME: Baseline TS regression
              await createTournamentTeamMutation.mutateAsync({
                acceptRiskDeclaration: acceptance?.acceptRiskDeclaration === true,
                // @ts-ignore: FIXME: Baseline TS regression
                name: pendingTournamentAction?.teamName || 'Mon équipe',
              });
            } catch (mutationError) {
              setJoinModalError(
                getParticipationErrorMessage(mutationError, 'Impossible de créer cette équipe de tournoi pour le moment.'),
              );
            }
          };
        // @ts-ignore: FIXME: Baseline TS regression
        } else if (pendingTournamentAction?.mode === 'join_existing') {
          handleJoinModalConfirm = async (acceptance = {}) => {
            try {
              setJoinModalError('');
              // @ts-ignore: FIXME: Baseline TS regression
              await requestJoinTournamentTeamMutation.mutateAsync({
                acceptRiskDeclaration: acceptance?.acceptRiskDeclaration === true,
                // @ts-ignore: FIXME: Baseline TS regression
                teamDocumentId: pendingTournamentAction?.teamDocumentId,
              });
            } catch (mutationError) {
              setJoinModalError(
                getParticipationErrorMessage(mutationError, 'Impossible d envoyer cette demande pour le moment.'),
              );
            }
          };
        }

        return (
          // @ts-ignore: FIXME: Baseline TS regression
          <JoinEventModal
            clubName={event?.team?.club?.name || event?.club?.name || ''}
            confirmLabel={joinModalConfirmLabel}
            contextNote={joinModalContextNote}
            errorMessage={joinModalError || null}
            isSubmitting={joinModalIsSubmitting}
            isVisible={isJoinModalVisible}
            onClose={() => {
              setIsJoinModalVisible(false);
              setPendingDetectionSlot(null);
              setPendingTournamentAction(null);
              setJoinModalError('');
            }}
            onConfirm={handleJoinModalConfirm}
          />
        );
      })()}

      <BottomModal
        close={() => setIsDetectionSlotPickerVisible(false)}
        headerComponent={(
          <View style={[Spaces.gap[12]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00, { textAlign: 'center' }]}>
              Choisir un poste
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100, { textAlign: 'center' }]}>
              Sélectionne le poste auquel tu veux participer.
            </Text>
            <Text style={[Fonts.p3, Fonts.primary200, { textAlign: 'center' }]}>
              {`${detectionSlots.length} poste(s) - ${detectionSlotsSummary.totalRequested} place(s) - ${detectionSlotsSummary.totalOpen} ouvert(s)`}
            </Text>
          </View>
        )}
        isVisible={isDetectionSlotPickerVisible}
        snapPoints={['68%']}
        style={{
          borderColor: `${Colors.primary500}24`,
          borderWidth: 1,
        }}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[24]]}>
          {detectionSlots.map((/** @type {any} */ slot) => {
            const slotId = String(slot?.documentId || '').trim();
            // @ts-ignore: FIXME: Baseline TS regression
            const isCurrentUserSlot = currentUserDetectionParticipation?.recruitmentAd?.documentId === slotId;
            const isComplete = Boolean(slot?.isComplete) && !isCurrentUserSlot;
            const isDisabled = isComplete || applyToDetectionSlotMutation.isPending || isCurrentUserSlot;
            let buttonTitle = 'Participer';
            if (isCurrentUserSlot) {
              buttonTitle = 'Demande envoyée';
            } else if (isComplete) {
              buttonTitle = 'Poste complet';
            }
            const remainingLabel = isComplete
              ? 'Complet'
              : `${slot?.remaining || 0} ${Number(slot?.remaining || 0) > 1 ? 'places restantes' : 'place restante'}`;

            return (
              <View
                key={slotId || `${slot?.position}-${slot?.quantity}`}
                style={[
                  ApplicationStyle.borderRadius24,
                  ApplicationStyle.borderWidth1,
                  Spaces.padding[16],
                  Spaces.gap[16],
                  {
                    backgroundColor: isComplete ? 'rgba(255, 215, 0, 0.06)' : 'rgba(1, 179, 244, 0.10)',
                    borderColor: isComplete ? `${Colors.gold500}34` : `${Colors.primary500}28`,
                  },
                ]}
              >
                <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                      {slot?.position || 'Poste'}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral300, { marginTop: 4 }]}>
                      {`${slot?.acceptedCount || 0}/${slot?.quantity || 1} valide - ${slot?.pendingCount || 0} en attente`}
                    </Text>
                  </View>
                  <Tag
                    style={{
                      backgroundColor: isComplete ? `${Colors.gold500}18` : `${Colors.primary500}18`,
                      borderColor: isComplete ? `${Colors.gold500}30` : `${Colors.primary500}30`,
                    }}
                    text={remainingLabel}
                    // @ts-ignore: FIXME: Baseline TS regression
                    textColor={isComplete ? 'gold500' : 'primary500'}
                    textStyle={{ fontWeight: '700' }}
                  />
                </View>

                <View style={Spaces.marginTop[4]}>
                  <Button
                    disabled={isDisabled}
                    // @ts-ignore: FIXME: Baseline TS regression
                    isLoading={applyToDetectionSlotMutation.isPending && applyToDetectionSlotMutation.variables?.slotDocumentId === slotId}
                    onPress={() => handleApplyToDetectionSlotFromPicker(slot)}
                    title={buttonTitle}
                    variant={isDisabled ? 'SecondaryLight' : 'Primary'}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </BottomModal>

      <RefuseParticipationModal
        isVisible={isRefuseModalVisible}
        onClose={() => setIsRefuseModalVisible(false)}
        onSubmit={(reason) => {
          mutations.declineParticipationMutation.mutate({ reason, requestId: selectedParticipationId });
          setIsRefuseModalVisible(false);
        }}
      />
      <ReportEventModal
        isVisible={isReportModalVisible}
        onClose={() => setIsReportModalVisible(false)}
        onSubmit={(reason) => mutations.reportEventMutation.mutate({ event: eventId || '', reason })}
      />
      <ShareEventModal
        event={event ? {
          ...event,
          title: event?.title || event?.name || event?.type?.name || 'Événement FoundClub',
        } : null}
        isVisible={isShareModalVisible}
        onClose={() => setIsShareModalVisible(false)}
        onSelectChat={handleShareEventInChat}
      />

      {/*
        ponytail: la feuille sait afficher « le fichier contiendra N personnes »,
        et on ne lui passe PAS ce nombre. Plafond assume : l ecran ne connait
        que ses participants VISIBLES, alors que le classeur porte aussi les
        joueurs eligibles sans reponse et l historique des demandes refusees.
        Un compte faux sur une feuille qui parle de donnees personnelles est
        pire que pas de compte. Voie de sortie : exposer le compte reel depuis
        le serveur (`event-export.ts`), puis le passer ici.
      */}
      <EventExportSheet
        isVisible={isExportSheetVisible}
        onClose={() => setIsExportSheetVisible(false)}
        onConfirm={handleConfirmExport}
      />

      {/* 🎯 N4 (D5) — LA FEUILLE DE RELANCE (1G / 1H / 1I).
          Elle lit `data` et `error` de la mutation : c'est ce qui permet a la
          modale du hook de SE TAIRE (D4, `presentation: 'sheet'`) sans qu'aucune
          information ne se perde — deux fenetres pour un seul geste, ce serait
          la modale par-dessus la feuille.
          🔢 Le chiffre du pied vient de l'app et se dit indicatif ; celui du
          compte rendu vient du SERVEUR, qui seul sait qui l'anti-spam ecarte. */}
      <RemindTeamsSheet
        equipePreCochee={remindSheetTeamKey || ''}
        erreur={mutations.remindEventMutation.error}
        isReminding={mutations.remindEventMutation.isPending}
        isVisible={remindSheetTeamKey !== null}
        nowMs={serverNowMs}
        onClose={() => setRemindSheetTeamKey(null)}
        onRelancer={(/** @type {string[]} */ teamIds) => mutations.remindEventMutation.mutate({
          eventId,
          presentation: 'sheet',
          teamIds,
        })}
        rapport={mutations.remindEventMutation.data}
        sections={remindableTeamSections}
      />

      <TrainingOpenBottomSheet
        Alignments={Alignments}
        ApplicationStyle={ApplicationStyle}
        Colors={Colors}
        Fonts={Fonts}
        initialLimit={trainingOpenConfig.externalParticipantLimit}
        initialValidationMode={trainingOpenConfig.externalParticipantValidationMode}
        isSubmitting={mutations.updateEventNoNavMutation.isPending}
        isVisible={isTrainingOpenModalVisible}
        onClose={() => setIsTrainingOpenModalVisible(false)}
        onSubmit={handleSubmitTrainingOpenConfig}
        Spaces={Spaces}
      />

      <BottomModal
        close={() => setIsSubscriptionFollowUpVisible(false)}
        isVisible={isSubscriptionFollowUpVisible}
        snapPoints={['70%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              Bravo, ton événement est en ligne
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {remainingEventPublishQuota > 0
                ? `Ton credit gratuit événement a bien été utilise. Il t en reste ${remainingEventPublishQuota}${totalEventPublishQuota > 0 ? `/${totalEventPublishQuota}` : ''}.`
                : 'Ton credit gratuit événement a bien été utilise. Les prochaines publications passeront par une offre Team ou Club.'}
            </Text>
          </View>

          <View
            style={[
              ApplicationStyle.backgroundColor.primary900,
              ApplicationStyle.borderRadius24,
              ApplicationStyle.borderWidth1,
              Spaces.padding[16],
              Spaces.gap[8],
              {
                borderColor: `${Colors.primary500}44`,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              Suite logique
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Consulte ton abonnement pour voir les offres FoundClub, tes quotas restants et les droits qui se debloquent ensuite.
            </Text>
          </View>

          <Button
            onPress={handleOpenSubscriptionOverview}
            title="Voir mon abonnement"
            variant="Primary"
          />
          <Button
            onPress={() => setIsSubscriptionFollowUpVisible(false)}
            title="Continuer"
            variant="Secondary"
          />
        </View>
      </BottomModal>

      <BottomModal
        close={closeTournamentParticipationFlow}
        isVisible={isTournamentParticipationModalVisible}
        snapPoints={['42%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Participer au tournoi</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Choisis si tu créés ton équipe éphémère ou si tu rejoins une équipe déjà inscrite.
            </Text>
          </View>

          {canCreateCustomTournamentTeam ? (
            <Button
              onPress={() => {
                setIsTournamentParticipationModalVisible(false);
                setIsTournamentCreateModalVisible(true);
              }}
              title="Créer une équipe pour le tournoi"
              variant="Primary"
            />
          ) : null}

          <Button
            disabled={joinableTournamentTeams.length === 0}
            onPress={() => {
              setIsTournamentParticipationModalVisible(false);
              setIsTournamentJoinSelectorVisible(true);
            }}
            title="Rejoindre une équipe existante"
            variant="Secondary"
          />

          {joinableTournamentTeams.length === 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Aucune équipe ouverte aux demandes n est disponible pour le moment.
            </Text>
          ) : null}
        </View>
      </BottomModal>

      <BottomModal
        close={() => {
          setIsTournamentJoinSelectorVisible(false);
          setPendingTournamentAction(null);
        }}
        isVisible={isTournamentJoinSelectorVisible}
        snapPoints={['62%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Équipes ouvertes</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Sélectionne une équipe tournoi qui accepte actuellement de nouvelles demandes.
            </Text>
          </View>

          {joinableTournamentTeams.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Aucune équipe tournoi n accepte de nouvelles demandes pour le moment.
            </Text>
          ) : (
            joinableTournamentTeams.map((team) => {
              const rosterSummary = getTournamentRosterSummary(team, tournamentConfig);
              return (
                <TouchableOpacity
                  key={team?.documentId}
                  onPress={() => handleSelectExistingTournamentTeam(team)}
                  style={tournamentDs.styles.compactPanelCard}
                >
                  <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{team?.name || 'Équipe tournoi'}</Text>
                      <Text style={[Fonts.p4, Fonts.primary100]}>
                        {`${rosterSummary.totalCount || 0} membre(s) - demandes ouvertes`}
                      </Text>
                    </View>
                    <Tag
                      style={tournamentDs.getToneTagStyle(Colors.primary500)}
                      text="Rejoindre"
                      textColor="primary500"
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </BottomModal>

      <BottomModal
        close={() => setIsTournamentRegisterModalVisible(false)}
        isVisible={isTournamentRegisterModalVisible}
        snapPoints={['52%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Inscrire mon équipe</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Sélectionne une équipe club. L application creera une équipe éphémère de tournoi sans toucher à ton effectif permanent.
            </Text>
          </View>

          {availableTournamentSourceTeams.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Aucune équipe club disponible à inscrire.
            </Text>
          ) : (
            // @ts-ignore: FIXME: Baseline TS regression
            availableTournamentSourceTeams.map((sourceTeam) => (
              <TouchableOpacity
                key={sourceTeam?.documentId}
                // @ts-ignore: FIXME: Baseline TS regression
                onPress={() => registerTournamentTeamMutation.mutate({ sourceTeamId: sourceTeam.documentId })}
                style={[
                  ...tournamentDs.styles.compactPanelCard,
                  {
                    opacity: registerTournamentTeamMutation.isPending ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{sourceTeam?.name || 'Equipe'}</Text>
                <Text style={[Fonts.p4, Fonts.primary100]}>
                  {[
                    sourceTeam?.section?.name,
                    sourceTeam?.category?.name || sourceTeam?.category,
                    sourceTeam?.level?.name || sourceTeam?.level,
                  ].filter(Boolean).join(' - ')}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </BottomModal>

      <BottomModal
        close={() => setIsTournamentCreateModalVisible(false)}
        isVisible={isTournamentCreateModalVisible}
        snapPoints={['44%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Créer une équipe</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Cette équipe n existera que pour ce tournoi. Tu en deviendras automatiquement le capitaine.
            </Text>
          </View>

          <TextInput
            onChangeText={setTournamentTeamNameDraft}
            placeholder="Nom de l équipe"
            placeholderTextColor={Colors.neutral300}
            style={[
              ...tournamentDs.styles.input,
              Fonts.neutral00,
            ]}
            value={tournamentTeamNameDraft}
          />

          <View style={[Spaces.gap[12]]}>
            <Button
              disabled={createTournamentTeamMutation.isPending}
              onPress={handleCreateTournamentTeam}
              title="Créer mon équipe"
              variant="Primary"
            />
            <Button
              onPress={() => setIsTournamentCreateModalVisible(false)}
              title="Annuler"
              variant="Secondary"
            />
          </View>
        </View>
      </BottomModal>

      <BottomModal
        close={dismissMatchStatsPrompt}
        isVisible={isMatchStatsPromptVisible}
        snapPoints={['42%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Stats de fin de match</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {matchStatsPromptMessage}
            </Text>
          </View>

          <View
            style={[
              ApplicationStyle.backgroundColor.primary900,
              { borderRadius: 20 },
              Spaces.padding[16],
              Spaces.gap[8],
            ]}
          >
            <Text style={[Fonts.p3, Fonts.neutral300]}>Match</Text>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{compositionEventLabel}</Text>
            <Text style={[Fonts.p3, Fonts.primary100]}>
              {compositionEditorTeam?.name || matchStatsPayload?.team?.name || 'Equipe'}
            </Text>
          </View>

          <Button
            onPress={() => {
              dismissMatchStatsPrompt();
              openMatchStatsEditor();
            }}
            title="Stats du match"
            variant="Primary"
          />
          <Button
            onPress={dismissMatchStatsPrompt}
            title="Plus tard"
            variant="Secondary"
          />
        </View>
      </BottomModal>

      {/* AD01 (✍️) — LA FEUILLE DU SCORE : deux champs, et c'est tout.
          ⚠️ `snapPoints` est OBLIGATOIRE : sans lui, une `BottomModal` ne peut
          pas porter a la fois un en-tete et un pied (piege D19, deja paye). */}
      <BottomModal
        close={() => setIsMatchScoreSheetVisible(false)}
        isVisible={isMatchScoreSheetVisible}
        snapPoints={['52%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventDetails.matchScore.title', 'Score du match')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {compositionEditorTeam?.name || matchStatsPayload?.team?.name || 'Ton équipe'}
            </Text>
          </View>

          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
            {[
              {
                key: 'for',
                label: t('eventDetails.matchScore.us', 'Nous'),
                onChangeText: setMatchScoreForDraft,
                value: matchScoreForDraft,
              },
              {
                key: 'against',
                label: t('eventDetails.matchScore.them', 'Eux'),
                onChangeText: setMatchScoreAgainstDraft,
                value: matchScoreAgainstDraft,
              },
            ].map((champ) => (
              <View key={champ.key} style={[Spaces.gap[8], { flex: 1 }]}>
                <Text style={[Fonts.p3Bold, Fonts.neutral300]}>{champ.label}</Text>
                <TextInput
                  editable={!isMatchScoreLocked}
                  keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                  maxLength={3}
                  onChangeText={(value) => champ.onChangeText(value.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={Colors.neutral400}
                  selectionColor={Colors.primary500}
                  style={[
                    ApplicationStyle.input,
                    ApplicationStyle.backgroundColor.neutral800,
                    ApplicationStyle.borderColor.neutral600,
                    Fonts.h3Bold,
                    Fonts.neutral00,
                    { textAlign: 'center' },
                  ]}
                  value={champ.value}
                />
              </View>
            ))}
          </View>

          {/* 🗣️ Une porte fermee DIT pourquoi. Le serveur refuserait de toute
              facon (`match-stats-report.ts:1921-1937`) — autant l'ecrire ici,
              en francais, avant l'aller-retour. */}
          {isMatchScoreLocked ? (
            <Text style={[Fonts.p3, Fonts.gold500]}>
              {t(
                'eventDetails.matchScore.lockedHint',
                'Ce score vient de la source officielle : il ne se modifie pas ici.',
              )}
            </Text>
          ) : null}
          {!isMatchScoreLocked && !isMatchScoreComplete ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('eventDetails.matchScore.bothRequired', 'Les deux scores sont obligatoires.')}
            </Text>
          ) : null}

          <View style={[Spaces.gap[12]]}>
            <Button
              disabled={isMatchScoreLocked || !isMatchScoreComplete || isMatchScoreSaving}
              isLoading={isMatchScoreSaving}
              onPress={handleSaveMatchScore}
              title={t('eventDetails.matchScore.submit', 'Valider le score')}
              variant="Primary"
            />
            <Button
              onPress={() => setIsMatchScoreSheetVisible(false)}
              title={t('common.cancel', 'Annuler')}
              variant="Secondary"
            />
          </View>
        </View>
      </BottomModal>

      {/* N3 (D9, ✍️) — LA FEUILLE DE L'ADVERSAIRE : un champ, et c'est tout.
          ⚠️ `snapPoints` est OBLIGATOIRE : sans lui, une `BottomModal` ne peut
          pas porter a la fois un en-tete et un pied (piege D19, deja paye).
          Meme gabarit que la feuille du score juste au-dessus — on ne cherche
          pas un autre agencement pour un formulaire encore plus court. */}
      <BottomModal
        close={() => setIsOpponentSheetVisible(false)}
        isVisible={isOpponentSheetVisible}
        snapPoints={['52%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventDetails.matchCard.nameOpponent', 'Nommer l\'adversaire')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'eventDetails.matchCard.nameOpponentHint',
                'Il apparaitra sur la carte du match, face a ton club.',
              )}
            </Text>
          </View>

          <TextInput
            autoFocus
            maxLength={OPPONENT_NAME_MAX_LENGTH}
            onChangeText={setOpponentNameDraft}
            placeholder={t('eventDetails.matchCard.opponentPlaceholder', 'Nom de l\'équipe adverse')}
            placeholderTextColor={Colors.neutral400}
            selectionColor={Colors.primary500}
            style={[
              ApplicationStyle.input,
              ApplicationStyle.backgroundColor.neutral800,
              ApplicationStyle.borderColor.neutral600,
              Fonts.p1,
              Fonts.neutral00,
            ]}
            value={opponentNameDraft}
          />

          <View style={[Spaces.gap[12]]}>
            <Button
              disabled={!opponentNameDraft.trim() || isOpponentSaving}
              isLoading={isOpponentSaving}
              onPress={handleSaveOpponentName}
              title={t('common.save', 'Enregistrer')}
              variant="Primary"
            />
            <Button
              onPress={() => setIsOpponentSheetVisible(false)}
              title={t('common.cancel', 'Annuler')}
              variant="Secondary"
            />
          </View>
        </View>
      </BottomModal>

      <Modal
        onRequestClose={() => setIsFeaturedModalVisible(false)}
        transparent
        visible={isFeaturedModalVisible}
      >
        <TouchableOpacity
          onPress={() => setIsFeaturedModalVisible(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableOpacity activeOpacity={1} style={[ApplicationStyle.backgroundColor.primary700, { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }]}>
            <View style={[Spaces.gap[16]]}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                Mettre à la une
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Choisis ou tu souhaites mettre cet événement en avant.
              </Text>
              {featuredScopeOptions.map((option) => {
                const isDisabled = option.status === 'pending' || option.status === 'approved';
                // @ts-ignore: FIXME: Baseline TS regression
                const isSelected = Boolean(selectedFeaturedScopes[option.kind]);
                const statusLabel = getFeaturedScopeStatusLabel(option.status);

                return (
                  <View
                    key={option.kind}
                    style={[
                      ApplicationStyle.borderRadius16,
                      ApplicationStyle.borderWidth1,
                      Spaces.padding[16],
                      Spaces.gap[8],
                      {
                        borderColor: `${Colors.primary500}55`,
                        opacity: isDisabled ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
                      <Checkbox
                        disabled={isDisabled}
                        onValueChange={() => toggleFeaturedScope(option.kind)}
                        value={isSelected}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                          {option.label}
                        </Text>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>
                          {statusLabel}
                        </Text>
                        {option.summary?.targetName ? (
                          <Text style={[Fonts.p4, Fonts.primary100]}>
                            {option.summary.targetName}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}

              <View style={[Spaces.gap[12]]}>
                <Button
                  disabled={!selectedFeaturedScopeKinds.length || mutations.requestFeaturedMutation.isPending}
                  onPress={handleSubmitFeaturedScopes}
                  title="Envoyer la demande"
                  variant="Primary"
                />
                <Button
                  onPress={() => setIsFeaturedModalVisible(false)}
                  title="Annuler"
                  variant="Secondary"
                />
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeLateModal}
        statusBarTranslucent
        transparent
        visible={isLateModalVisible}
      >
        <View style={[Alignments.fill, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeLateModal}
            style={Alignments.fill}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
              style={[Alignments.fill, Alignments.justifyCenter, Spaces.paddingHorizontal[24]]}
            >
              <TouchableOpacity activeOpacity={1} onPress={() => null}>
                <View
                  style={[
                    ApplicationStyle.backgroundColor.primary700,
                    ApplicationStyle.borderRadius24,
                    ApplicationStyle.borderWidth1,
                    ApplicationStyle.borderColor.neutral700,
                    Spaces.padding[24],
                    Spaces.gap[16],
                  ]}
                >
                  <View style={[Spaces.gap[4]]}>
                    <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                      {lateModalTitle}
                    </Text>
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {lateModalDescription}
                    </Text>
                  </View>

                  <View
                    style={[
                      ApplicationStyle.card,
                      ApplicationStyle.borderRadius12,
                      ApplicationStyle.backgroundColor.neutral800,
                      Spaces.padding[12],
                      Spaces.gap[4],
                    ]}
                  >
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {isPlayerLateModal ? 'Participant' : t('eventDetails.late.playerLabel', 'Joueur')}
                    </Text>
                    <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                      {lateModalUser
                        ? `${lateModalUser.firstname || ''} ${lateModalUser.lastname || ''}`.trim()
                        : '-'}
                    </Text>
                  </View>

                  <View style={[Spaces.gap[8]]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                      {t('eventDetails.late.minutesLabel', 'Minutes de retard')}
                    </Text>
                    <View style={[Alignments.row, Spaces.gap[8]]}>
                      {[5, 10, 15].map((preset) => (
                        <Button
                          key={`late-preset-${preset}`}
                          onPress={() => handleSetLatePreset(preset)}
                          size="sm"
                          title={`+${preset}`}
                          variant="SecondaryLight"
                        />
                      ))}
                    </View>
                    <TextInput
                      keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                      maxLength={3}
                      onChangeText={(value) => setLateModalMinutes(value.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      placeholderTextColor={Colors.neutral400}
                      selectionColor={Colors.primary500}
                      style={[
                        ApplicationStyle.input,
                        ApplicationStyle.backgroundColor.neutral800,
                        ApplicationStyle.borderColor.neutral600,
                        Fonts.p1Bold,
                        Fonts.neutral00,
                      ]}
                      value={lateModalMinutes}
                    />
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {isPlayerLateModal
                        ? 'Annonce le retard estime. Tu confirmeras ensuite ton arrivée réelle.'
                        : t('eventDetails.late.helper', '0 = a l\'heure. Ajuste la valeur si nécessaire avant validation.')}
                    </Text>
                  </View>

                  {isCoachLateModal ? (
                    <View style={[Spaces.gap[8]]}>
                      <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                        Note staff
                      </Text>
                      <TextInput
                        multiline
                        onChangeText={setLateModalNote}
                        placeholder="Facultatif"
                        placeholderTextColor={Colors.neutral400}
                        selectionColor={Colors.primary500}
                        style={[
                          ApplicationStyle.input,
                          ApplicationStyle.backgroundColor.neutral800,
                          ApplicationStyle.borderColor.neutral600,
                          Fonts.p2,
                          Fonts.neutral00,
                          { minHeight: 88, textAlignVertical: 'top' },
                        ]}
                        value={lateModalNote}
                      />
                    </View>
                  ) : null}

                  {canResetLateModal ? (
                    <Button
                      disabled={isLateModalLoading}
                      onPress={handleResetLateModal}
                      title="Réinitialiser le pointage"
                      variant="Secondary"
                    />
                  ) : null}

                  <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[8]]}>
                    <Button
                      onPress={closeLateModal}
                      style={{ flex: 1 }}
                      title={t('common.cancel', 'Annuler')}
                      variant="Secondary"
                    />
                    <Button
                      disabled={isLateModalLoading || lateModalMinutes.trim() === ''}
                      isLoading={isLateModalLoading}
                      onPress={handleSaveLateModal}
                      style={{ flex: 1 }}
                      title={lateModalPrimaryActionTitle}
                      variant="Primary"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

export default EventDetails;
