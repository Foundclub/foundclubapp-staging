// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Dimensions,
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
import {
  buildParticipationsByStatus,
  buildTeamParticipationSections,
  filterUsersByExcludedKeys,
  getEligibleTeamPlayers,
  getEventTrainerKeys,
  getTrainerKeySet,
  getUserKey,
  uniqueUsers,
} from '@/domains/event/eventParticipantSections';
import { getEventEditSupport, resolveTrainingOpenConfig } from '@/domains/event/eventUseCases';
import { getCurrentUserEventParticipationState } from '@/domains/event/participationState';
import { canDeclareLatePresence, isArrivalTrackingEnabled } from '@/domains/event/presenceRule';
import useMessaging from '@/domains/messaging/useMessaging';
import {
  getParticipationErrorMessage,
  resolveClientSourceTeamForUser,
  resolveParticipationFlow,
} from '@/domains/participation/participationFlow';
import {
  canManageCompositionForClub,
  getSubscriptionQuotaItem,
} from '@/domains/subscription/subscriptionDecision';
import { hasLivingUser } from '@/domains/user/deletedAccount';
import { getEventShowcaseTemplate, isEventShowcaseOffered } from '@/domains/visuals/eventShowcaseTemplate';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkbox from '@/components/atoms/checkbox/Checkbox';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import Tag from '@/components/atoms/tag/Tag';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';
import FacilityClosureBanner from '@/components/molecules/facilityClosure/FacilityClosureBanner';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import RefuseParticipationModal from '@/components/organisms/refuseParticipationModal/RefuseParticipationModal';
import ReportEventModal from '@/components/organisms/reportEventModal/ReportEventModal';
import ShareEventModal from '@/components/organisms/shareEventModal/ShareEventModal';
import MyTrainingReviewBlock from '@/components/organisms/trainingReview/MyTrainingReviewBlock';
import TrainingReviewsCard, {
  peutRelireSaNote,
  peutVoirLesAvisDEntrainement,
} from '@/components/organisms/trainingReview/TrainingReviewsCard';
import ConvocationFieldPreview from '@/components/tactical/ConvocationFieldPreview';
import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  buildConvocationFieldTokens,
  buildConvocationReserveList,
  buildConvocationStaffList,
  CONVOCATION_ROLE_STARTER,
  getConvocationPersonId,
  getPersonName,
  getViewerConvocationRole,
} from '@/views/playerConvocation/playerConvocationUtils';

import { hasRouteInNavigationTree } from '@/navigation/navigationAvailability';
import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

import { celebrate } from '@/services/celebrations/celebrationRuntime';
import { EVENT_DETAIL_STALE_MS } from '@/services/event/eventCacheDurations';
import {
  useGetEvent,
  useGetEventAttendance,
  useGetEventConvocation,
  useGetEventTeamComposition,
} from '@/services/event/eventQueries';
import {
  approveFeatured,
  exportEventParticipants,
  getEventByIdForEdit,
  getEventTypes,
  rejectFeatured,
} from '@/services/event/eventService';
import { useGetEventParticipations } from '@/services/eventParticipation/eventParticipationQueries';

// import statique (pas require) : require n'existe pas sur le rendu web ESM.
import SharePlatform from '@/platform/share';
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
import {
  applyToRecruitmentAd,
  getRecruitmentApplications,
} from '@/services/recruitment/recruitmentService';
import { useGetTrainingReviews } from '@/services/trainingReview/trainingReviewQueries';
// R9 — LE RAIL D INVITATION DU LOT P10, recolte et deploye. Comme pour N2
// plus haut, ces deux fonctions ne sont appelees que dans une fermeture (le
// rendu de la fiche et la mutation), jamais au montage — mais l IMPORT, lui,
// tire `@/services/client`, qui jette sans `.env`. Les 20 suites qui montent
// cet ecran doublent donc le service, dans LE MEME COMMIT que cette ligne.
import {
  inviteToTeam,
  resolveTeamInvitationAvailability,
} from '@/services/teamMembershipRequest/teamMembershipRequestService';
import {
  useGetTournamentDashboard,
} from '@/services/tournamentCompetition/tournamentCompetitionQueries';
import {
  createCustomTournamentTeam,
  registerClubTeamToTournament,
  requestJoinTournamentTeam,
  respondToTournamentTeam,
  reviewTournamentTeamRegistration,
} from '@/services/tournamentTeam/tournamentTeamService';

import { getErrorStatus } from '@/utils/errors/displayError';
import { resolveExternalMatchDisplay } from '@/utils/externalMatchDisplay';
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
import MatchBilanCard from './components/MatchBilanCard';
import MonMatchCard from './components/MonMatchCard';
import PostMatchJourneyCard from './components/PostMatchJourneyCard';
import RemindTeamsSheet from './components/RemindTeamsSheet';
import TournamentPeopleList from './components/TournamentPeopleList';
import TournamentProgressRail from './components/TournamentProgressRail';
import { resolveEventAttendanceGate } from './eventAttendanceGate';
import { resolveEventEndedAt, resolveIsMatchFinished } from './eventMatchClock';
import { useEventMutations } from './hooks/useEventMutations';
import { findParentTeamId } from './matchEncartLines';
import {
  buildMatchHeaderScoreSummary,
  countPlayersToRemind,
  formatMatchEndLabel,
  hasPublishedConvocation,
  listMissingResponders,
  listPresentWithoutConvocation,
  resolveMatchStartTimeLabel,
  resolveMatchStatsDoor,
  resolveMatchVerdictTag,
  resolveTeamCoachFirstname,
  resolveViewerFromInvitedTeam,
} from './matchPageModel';
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
    return new Intl.NumberFormat(localeDesFormats(), { currency, style: 'currency' }).format((Number(amountCents) || 0) / 100);
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
 * @param {any} props.Fonts
 * @param {any} props.Spaces
 * @param {number | null | undefined} props.initialLimit
 * @param {boolean} props.isSubmitting
 * @param {boolean} props.isVisible
 * @param {() => void} props.onClose
 * @param {(payload: { externalParticipantLimit: number; externalParticipantValidationMode: 'auto' | 'manual' }) => void} props.onSubmit
 * @returns {import('react').ReactElement}
 */
// S11-bis / reliquat S11 — LA FEUILLE NE PROPOSE PLUS DE CHOISIR LA VALIDATION.
// Depuis la regle corrigee par Adel le 2026-08-25, les demandes exterieures sont
// validees a la main TOUJOURS, et le serveur le force sur ses trois portes.
// Garder le choix ici, c'etait garder un bouton dont la valeur etait ignoree.
// `Colors` disparait avec lui : c'etait son seul usage dans cette feuille.
function TrainingOpenBottomSheet({
  Alignments,
  ApplicationStyle,
  Fonts,
  initialLimit,
  isSubmitting,
  isVisible,
  onClose,
  onSubmit,
  Spaces,
}) {
  const { t } = useTranslation();
  const resolveInitialLimit = useCallback(
    () => clampParticipants(Number(initialLimit) || DEFAULT_EXTERNAL_PARTICIPANT_LIMIT),
    [initialLimit],
  );
  const [limitValue, setLimitValue] = useState(resolveInitialLimit);

  useEffect(() => {
    if (!isVisible) return;
    setLimitValue(resolveInitialLimit());
  }, [isVisible, resolveInitialLimit]);

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
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('eventDetails.openTheTrainingSession', 'Ouvrir l entraînement')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t(
              'eventDetails.setHowManyExternalPlayers',
              'Définis combien de joueurs externes peuvent rejoindre cet entraînement.',
            )}
          </Text>
        </View>

        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
            {t('eventDetails.externalSpots', 'Places externes')}
          </Text>
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
                {t('eventDetails.externalPlayersMax', 'joueurs externes max')}
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

        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
            {t('eventDetails.externalRequests', 'Demandes extérieures')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t(
              'eventDetails.externalRequestsAreApprovedBy',
              'Les demandes extérieures sont validées par toi.',
            )}
          </Text>
        </View>

        <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
          <Button
            disabled={isSubmitting}
            isLoading={isSubmitting}
            onPress={() => onSubmit({
              externalParticipantLimit: limitValue,
              // S11 — la seule valeur possible. Le serveur l'imposerait de toute
              // facon ; l'envoyer explicitement garde la base d'accord avec lui.
              externalParticipantValidationMode: 'manual',
            })}
            title={t('eventDetails.confirmOpening', 'Confirmer l ouverture')}
            variant="Primary"
          />
          <Button
            disabled={isSubmitting}
            onPress={onClose}
            title={t('eventDetails.cancel', 'Annuler')}
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
/**
 * 🔤 N7 item 3 (vague P, 23/08) — LES QUATRE STATUTS PASSENT PAR `t()`.
 * La fonction vit hors du composant, la ou `t` n'existe pas : il DESCEND en
 * parametre plutot que de remonter la logique au point d'appel. Deux clefs
 * existaient deja (N1 les avait posees pour le bouton de la page), deux sont
 * neuves.
 * @param {any} t - La fonction de traduction du composant.
 * @param {string} status - Le statut de la demande pour cette portee.
 * @returns {string} - Le libelle, traduit.
 */
const getFeaturedScopeStatusLabel = (t, status) => {
  if (status === 'pending') return t('reservation.featuredRequest.pending', 'Demande en attente');
  if (status === 'approved') {
    return t('eventDetails.featuredRequest.alreadyFeatured', 'Déjà à la une');
  }
  if (status === 'rejected') {
    return t('eventDetails.featuredRequest.rejected', 'Refusée, tu peux redemander');
  }
  return t('eventDetails.featuredRequest.available', 'Disponible');
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
 * 🕳️ EVEDIT-2 / D1 — LE SIGNAL DE FIN DE FERMETURE DE LA FEUILLE.
 *
 * Il ne dessine RIEN. Il vit dans le contenu de la feuille de gestion, et son
 * seul travail est de prevenir a l'instant precis ou ce contenu quitte l'arbre.
 *
 * 🧱 POURQUOI IL EXISTE, alors que `BottomModal` offre deja `onDismissed` :
 * cette poignee-la n'est branchee que sur la feuille NATIVE. Le remplacant web
 * (`BottomModal.web.js`) n'a pas d'animation : il retire son contenu tout de
 * suite et n'emet jamais de fermeture. Une action qui n'attendrait QUE
 * `onDismissed` ne repartirait donc JAMAIS sur le site.
 *
 * 🎯 CE QU'IL MESURE EST EXACTEMENT LE DEFAUT : ce qui avale l'appui, c'est la
 * feuille MONTEE. Son depart de l'arbre est donc le signal juste, et il vaut
 * sur les deux plateformes — a la fin de l'animation sur telephone
 * (`BottomModal.js` ne fait `setShouldRender(false)` que dans `handleDismiss`),
 * immediatement sur le web, ou il n'y a rien a attendre.
 *
 * ⛔ CE N'EST PAS UN MINUTEUR. Aucune duree n'est pariee nulle part : un
 * `setTimeout` en dur marcherait sur un telephone rapide et raterait sur un
 * lent, ce qui est precisement le defaut qu'on corrige.
 * @param {{ onExit: () => void }} props - Le rappel de sortie.
 * @returns {null} - Rien : ce composant n'a pas de rendu.
 */
function SheetExitSignal({ onExit }) {
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  useEffect(() => () => {
    onExitRef.current?.();
  }, []);

  return null;
}

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
  // 🗂️ P7 — LA FICHE CANDIDAT. `null` = fermee. Elle porte la personne, sa
  // participation (quand il y en a une) et le poste retrouve.
  // R9 — les candidats dont l invitation vient de partir. Meme motif que dans
  // `RecruitmentAdDetails` (lot P10) : le serveur ne renvoie pas l etat de
  // l invitation avec la demande, et on s interdit une requete de plus.
  const [invitedParticipationIds, setInvitedParticipationIds] = useState(
    /** @type {string[]} */ ([]),
  );
  const [detectionCandidateSheet, setDetectionCandidateSheet] = useState(
    /** @type {any} */ (null),
  );
  // 📝 Le retour individuel (regle 6) vit sur la CANDIDATURE D'ANNONCE, pas sur
  // l'evenement : `eventService` peuple `recruitmentAds.candidates` (des
  // personnes) et jamais `recruitmentAds.applications`. On va donc le chercher
  // a l'ouverture de la fiche, et on dit franchement ou on en est.
  const [detectionCandidateReview, setDetectionCandidateReview] = useState(
    /** @type {{ note: string, state: 'idle' | 'loading' | 'loaded' | 'error' }} */
    ({ note: '', state: 'idle' }),
  );
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
  // 🎯 EVEDIT-2 (D1 + D2) — L'ACTION CHOISIE ATTEND QUE LA FEUILLE SOIT PARTIE.
  //
  // 🧱 LE DEFAUT, TEL QU'ADEL LE VIT (recette du 27/08) : « la pop reste
  // ouverte, et quand je clique sur un champ il ne s'ouvre pas instantanement.
  // Mais si je clique deux fois ca marche. » Et, sur « Enregistrer » : « si je
  // fais une action, pour qu'elle soit prise en compte je dois faire une AUTRE
  // action. » Les deux phrases decrivent LE MEME defaut, et ce n'est pas de la
  // lenteur : la feuille n'etait jamais fermee avant de naviguer, elle restait
  // montee PAR-DESSUS l'ecran d'arrivee, et sa couche mangeait le premier
  // contact. Le second appui passait parce que la couche avait fini de partir.
  //
  // 🔑 LE REMEDE : on ne lance plus l'action au toucher. On l'ARME, on demande
  // la fermeture, et on ne la lance qu'a la SORTIE REELLE de la feuille.
  //
  // ⛔ PAS DE MINUTEUR, ET C'EST LE POINT DUR. Un `setTimeout` « le temps que
  // l'animation joue » est un pari sur la vitesse du telephone : juste sur un
  // appareil recent, faux sur un lent — donc exactement le defaut d'origine,
  // rendu intermittent. On attend l'evenement, jamais une duree.
  //
  // ⛔ ET FERMER JUSTE AVANT DE NAVIGUER NE SUFFIT PAS NON PLUS : la fermeture
  // est ANIMEE, la couche survit quelques images. C'est la forme qu'avait
  // « Voir mon abonnement » (§D3), et elle est traitee par le meme mecanisme.
  //
  // 🚪 LE POINT DE SORTIE COMMUN (D2) : les six rangees du menu passent TOUTES
  // par `renderManageRow`, donc par ici. Corriger « Modifier » seul aurait
  // laisse les cinq autres portes cassees (§1 bis — la cause racine, une fois).
  //
  // Le motif est celui du depot, deja eprouve sur le menu de pieces jointes de
  // la messagerie (`Conversation.js` : `runAttachmentAction` +
  // `handleAttachmentSheetDismissed`). Rien de neuf n'est invente ici.
  //
  // 🏷️ L'ETIQUETTE N'EST PAS DECORATIVE : deux feuilles de cet ecran se servent
  // du meme rangement. Sans elle, une feuille qui se ferme lancerait l'action
  // armee par l'AUTRE.
  /** @type {{ current: null | { action: () => void, sheet: string } }} */
  const pendingSheetActionRef = useRef(null);

  const armSheetAction = useCallback((
    /** @type {string} */ sheet,
    /** @type {() => void} */ action,
    /** @type {() => void} */ hideSheet,
  ) => {
    if (typeof action !== 'function') return;
    pendingSheetActionRef.current = { action, sheet };
    hideSheet();
  }, []);

  // Idempotent PAR CONSTRUCTION : le rangement est vide AVANT l'appel. Les deux
  // signaux de sortie d'une feuille (son rappel `onDismissed` et le depart de
  // `SheetExitSignal`) peuvent donc arriver tous les deux sans que l'action
  // parte deux fois.
  const runPendingSheetAction = useCallback((/** @type {string} */ sheet) => {
    const queued = pendingSheetActionRef.current;
    if (!queued || queued.sheet !== sheet) return;
    pendingSheetActionRef.current = null;
    queued.action();
  }, []);

  const closeManageSheet = useCallback(() => setIsEventActionsSheetOpen(false), []);
  const runManageSheetExit = useCallback(
    () => runPendingSheetAction('manage'),
    [runPendingSheetAction],
  );

  // Rouvrir la feuille DESARME ce qui attendait. Sans ca, un appui suivi d'une
  // reouverture immediate laisserait l'action en embuscade : la bibliotheque
  // represente alors la meme feuille sans emettre sa fermeture
  // (`staleDismissUntilRef`, `BottomModal.js`), et l'action serait repartie
  // plus tard, sur une fermeture qui n'a rien a voir avec elle.
  const openManageSheet = useCallback(() => {
    pendingSheetActionRef.current = null;
    setIsEventActionsSheetOpen(true);
  }, []);

  // N4 (D5) : `null` = feuille fermee ; une CHAINE (meme vide) = feuille
  // ouverte, la chaine etant l'equipe a pre-cocher. Un booleen a cote d'une
  // clef ferait deux etats a garder d'accord — et un jour ils divergeraient.
  /** @type {[string | null, (v: string | null) => void]} */
  const [remindSheetTeamKey, setRemindSheetTeamKey] = useState(null);
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

  // 🧭 P8 — LE RAIL QUI DESCEND DE LA CARTE D'OUVERTURE JUSQU'A LA FILE DES
  // EXTERNES.
  //
  // La page d'un evenement est UNE colonne qui defile (decision d'Adel du
  // 20/08 : pas d'onglets sur l'entrainement). La file des demandes des joueurs
  // de l'exterieur vit donc tout en bas, DANS la liste des participants —
  // « noyee », dit le pack (BRIEF_DESIGN_EVENT_DETAILS_2026_08_20.md, fiche 2).
  // La carte d'ouverture annonce un nombre de demandes ; sans ce rail, elle
  // annoncerait un chiffre sans dire ou aller.
  //
  // ⚠️ Aucun `ref` n'existait sur la ScrollView de cet ecran : il nait ici.
  // `measureLayout` est la fonction NATIVE de React Native pour situer une vue
  // dans une autre (§1 bis, barreau 4). Elle traverse les emboitements
  // (`WithDataWrapper`, la colonne `gap[24]`) sans qu'on additionne des
  // decalages a la main — une addition qui se romprait au premier `padding`
  // ajoute plus haut, et EN SILENCE.
  //
  // ⛔ Jest n'a pas de moteur de mise en page : `measureLayout` n'y rend rien,
  // et le geste devient un non-evenement (aucune erreur, aucun defilement). Le
  // defilement REEL ne se voit qu'a la recette.
  const overviewScrollRef = useRef(null);
  const participantsAnchorRef = useRef(null);
  // ST-MATCH (écran 1) — l'ancre du bloc « Stats du match », visée par l'encart.
  const matchStatsAnchorRef = useRef(null);
  const scrollToAnchor = useCallback((/** @type {any} */ ancreRef) => {
    const defileur = overviewScrollRef.current;
    const ancre = ancreRef.current;
    if (!defileur || typeof defileur.scrollTo !== 'function') return;

    const contenu = typeof defileur.getInnerViewNode === 'function'
      ? defileur.getInnerViewNode()
      : null;
    if (!ancre || !contenu || typeof ancre.measureLayout !== 'function') return;

    ancre.measureLayout(
      contenu,
      (_x, y) => {
        // 16 px d'air au-dessus de la liste : sans eux, son titre arrive colle
        // au bord haut de l'ecran et on ne voit plus d'ou l'on vient.
        defileur.scrollTo({ animated: true, y: Math.max(0, y - 16) });
      },
      () => {},
    );
  }, []);
  const scrollToParticipants = useCallback(
    () => scrollToAnchor(participantsAnchorRef),
    [scrollToAnchor],
  );

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
    getSubscriptionAccessLevelForClub,
    subscriptionAccessLevel,
    userData,
  } = useAuth();
  const { sendMessage, startWhisperChat } = /** @type {any} */ (useMessaging());
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
  // LIENS-EVENEMENT : un lien partage peut viser un evenement supprime (404). Le pave
  // d'erreur dit alors CE qui manque, au lieu de « ressource introuvable ».
  // Temoin : __tests__/EventDetailsLienEvenementDisparu.test.js.
  const eventLoadErrorMessage = getErrorStatus(error) === 404
    ? t('eventDetails.eventGone', 'Cet événement n’est plus disponible ou a été supprimé.')
    : undefined;

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
  // 🚪 EVEDIT-2 / D3 — LA MEME PORTE, SUR LA FEUILLE DE FIN DE CREATION.
  //
  // Le balayage du lot a trouve UNE seule autre sortie de feuille de cet
  // ecran : celle-ci. Elle fermait la feuille et naviguait dans la FOULEE —
  // ce qui parait correct, et ne l est pas : la fermeture est animee, la
  // couche survit quelques images, et elle avale le premier appui sur
  // l ecran des offres. C est le defaut de G1, en plus discret.
  //
  // ⛔ Le geste ne ferme donc plus lui-meme : il ARME, et la feuille le
  // lance en partant — meme mecanisme que les six rangees du menu.
  const closeSubscriptionFollowUp = useCallback(
    () => setIsSubscriptionFollowUpVisible(false),
    [],
  );
  const runSubscriptionFollowUpExit = useCallback(
    () => runPendingSheetAction('subscriptionFollowUp'),
    [runPendingSheetAction],
  );

  const openSubscriptionOverview = useCallback(() => {
    navigation.navigate(RouteNames.ProfileStack, {
      params: {
        resumeRouteName: RouteNames.EventStack,
        resumeRouteParams: { params: { eventId }, screen: RouteNames.EventDetails },
      },
      screen: RouteNames.SubscriptionOffers,
    });
  }, [eventId, navigation]);

  // 🪤 DEUX APPELANTS, DEUX BESOINS — et les confondre casse le premier.
  // Celui-ci est appele depuis la PAGE (la carte de rappel de compo, au
  // forfait gratuit) : la personne n a aucune feuille devant elle, donc rien
  // n a a etre attendu. Il part tout de suite, comme avant ce lot.
  const handleOpenSubscriptionOverview = useCallback(() => {
    closeSubscriptionFollowUp();
    openSubscriptionOverview();
  }, [closeSubscriptionFollowUp, openSubscriptionOverview]);

  // Celui-ci est appele DEPUIS LA FEUILLE de fin de creation : la couche est
  // devant l ecran des offres, il faut donc attendre qu elle soit partie.
  const handleOpenSubscriptionOverviewFromSheet = useCallback(
    () => armSheetAction(
      'subscriptionFollowUp',
      openSubscriptionOverview,
      closeSubscriptionFollowUp,
    ),
    [armSheetAction, closeSubscriptionFollowUp, openSubscriptionOverview],
  );

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
    const locale = localeDesFormats();
    return `${start.toLocaleDateString(locale)} - ${end.toLocaleDateString(locale)}`;
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
    if (hasVariableHours) return t('eventDetails.variableTimes', 'Horaires variables');
    if (defaultStart && defaultEnd) return `${defaultStart} - ${defaultEnd}`;
    return '';
  }, [event?.stageDefaultEndTime, event?.stageDefaultStartTime, isStageParentEvent, stageChildDays, t]);
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
  // 🏆 N7 item 5 (vague P, 23/08) — LE FIL DU TOURNOI LIT LE DASHBOARD.
  // Jusqu'ici les etapes Poules / Matchs / Publié s'effondraient sur le seul
  // `competitionState` de l'evenement (voir `renderTournamentSection`). Le
  // dashboard (`GET /events/:id/tournament/dashboard`, meme appel que
  // `TournamentManagement`) sait, lui, si les poules et les matchs EXISTENT
  // avant publication. Il n'est demande QUE pour un tournoi (pas une journee
  // de stage) : les autres types ne paient pas l'appel.
  // ⚠️ Ce hook tire `@/services/client` : les 16 suites qui montent cet ecran
  //    le mockent (`tournamentCompetitionQueries`), sinon elles tombent a 0 test.
  const tournamentDashboardQuery = useGetTournamentDashboard(eventId || '', {
    enabled: Boolean(eventId && isTournamentEvent && !isStageDayEvent),
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
  // STATS-FIX2 · point 4 (T10, ecran 7) — JOUEUR d une equipe du match. « Ma réponse de match »,
  // « Mes stats » et « Mon retour coach » sont les blocs du JOUEUR : le serveur refuse la
  // réponse perso a un entraineur pur (403, `canRespond: isPlayer`). `isTeamMember`, qui compte
  // aussi les entraineurs, les ouvrait a Karim sur son propre match.
  const isTeamPlayer = useMemo(() => {
    const userDocId = userData?.documentId;
    if (!userDocId) return false;
    return [event?.team, ...(event?.invitedTeams || [])]
      .filter(Boolean)
      .flatMap((team) => team?.players || [])
      .some((player) => player?.documentId === userDocId);
  }, [event?.invitedTeams, event?.team, userData?.documentId]);
  // Seuls les deux champs lus sont passes : le memo se recalcule sur les memes
  // dependances qu avant l extraction (PARTWEB).
  const trainerKeysForEvent = useMemo(
    () => getEventTrainerKeys({ invitedTeams: event?.invitedTeams, team: event?.team }),
    [event?.invitedTeams, event?.team],
  );

  const isCurrentUserParticipating = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return false;
    return (event?.participations || []).some(
      (/** @type {User} */ participant) => participant?.documentId === currentUserId
        && !trainerKeysForEvent.has(getUserKey(participant)),
    );
  }, [event?.participations, trainerKeysForEvent, userData?.documentId]);

  // POINTAGE (29/09) — « Suivre les arrivees » decochee par l organisateur :
  // le joueur ne signale plus son arrivee (la lecture de la feuille reste).
  const arrivalTrackingEnabled = isArrivalTrackingEnabled(event);
  const { canAccessAttendance, canSelfMarkArrival } = useMemo(
    () => resolveEventAttendanceGate({
      arrivalTrackingEnabled,
      canEdit,
      isCurrentUserParticipating,
      isTeamMember,
    }),
    [arrivalTrackingEnabled, canEdit, isCurrentUserParticipating, isTeamMember],
  );

  const {
    data: attendancePayload,
    isError: isAttendanceError,
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
    // STATS-FIX2 · point 8 : l heure de fin SAISIE (endTime) decide, comme au serveur.
    () => resolveEventEndedAt(event?.endDate, eventStartAt, event?.endTime),
    [event?.endDate, event?.endTime, eventStartAt],
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

  // AVIS (09/09) — LE BLOC « AVIS DES JOUEURS », et sa porte.
  // Les trois conditions vivent dans `peutVoirLesAvisDEntrainement` plutot qu ici :
  // c est la SEULE facon de les tester sans monter les 8 000 lignes de cet ecran
  // (temoins AVIS-APP/1 et AVIS-APP/2). La requete ne part que si la porte est
  // ouverte — un joueur ne doit jamais l appeler, la policy la lui refuserait.
  const peutVoirLesAvisDEntrainementIci = peutVoirLesAvisDEntrainement({
    canEdit,
    isFinished: isMatchFinished,
    isTraining: trainingOpenConfig.isTraining,
  });
  const { data: avisDEntrainement } = useGetTrainingReviews(
    peutVoirLesAvisDEntrainementIci ? eventId : null,
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
  // pour que le coach VOIE la porte, mais elle ne s ouvre pas.
  // 🕰️ FINITIONS4 (D7, recette du 29/09) — et elle CHARGE, sans heure : elle
  // affichait l heure du repli local (« Ouvre à 16:30 ») sous « ouvert dès la
  // création ». Une charge en erreur ne montre pas de carte du tout.
  const nextActionMode = useMemo(() => {
    if (!attendancePayload?.data) return isAttendanceError ? 'unavailable' : 'loading';

    return resolveCallMode({ serverNowMs: serverClockMs, window: attendanceCallWindow });
  }, [attendanceCallWindow, attendancePayload?.data, isAttendanceError, serverClockMs]);

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
        t(
          'eventDetails.sayHowManyExternalSpots',
          'Indique combien de places externes tu veux ouvrir pour cet entraînement.',
        ),
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
        trainingOpenError?.message || t(
          'eventDetails.unableToOpenThisTraining',
          "Impossible d'ouvrir cet entraînement pour le moment.",
        ),
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
        trainingCloseError?.message || t(
          'eventDetails.unableToCloseThisTraining',
          'Impossible de fermer cet entraînement pour le moment.',
        ),
      );
    }
  }, [eventId, mutations.updateEventNoNavMutation, t]);
  const approveFeaturedRequestMutation = useMutation({
    mutationFn: approveFeatured,
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'eventDetails.unableToApproveThisRequest',
        'Impossible de valider cette demande.',
      ));
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
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'eventDetails.unableToDeclineThisRequest',
        'Impossible de refuser cette demande.',
      ));
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
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'eventDetails.unableToRegisterThisTeam',
        'Impossible d inscrire cette équipe au tournoi.',
      ));
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
      setJoinModalError(mutationError?.message || t(
        'eventDetails.unableToCreateThisTournament',
        'Impossible de créer cette équipe de tournoi.',
      ));
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
      setJoinModalError(mutationError?.message || t(
        'eventDetails.unableToSendThisRequest',
        'Impossible d envoyer cette demande pour le moment.',
      ));
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
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'eventDetails.unableToUpdateThisRegistration',
        'Impossible de mettre à jour cette inscription.',
      ));
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
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'eventDetails.unableToSaveYourTournament',
        'Impossible d enregistrer ta réponse tournoi.',
      ));
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
        badgeLabel: t('eventDetails.absenceRecorded', 'Absence enregistrée'),
        badgeTextColor: Colors.error500 || 'rgb(248, 113, 113)',
        badgeValue: null,
        // POINTAGE (29/09) — `no_show` n est plus qu une absence CONSTATEE A
        // L APPEL : ne pas pointer ne rend jamais absent.
        description: t(
          'eventDetails.theEventIsOverAnd',
          "Un encadrant t'a marqué absent à l'appel. "
            + "S'il s'est trompé, il peut corriger ton pointage.",
        ),
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
          badgeLabel: t('eventDetails.attendanceBadge.arrived', 'Arrivé'),
          badgeTextColor: Colors.success500 || 'rgb(34, 197, 94)',
          badgeValue: null,
          description: t(
            'eventDetails.minBeforeTheStartOf',
            "{{earlyMinutes}} min avant le début de l'événement.",
            { earlyMinutes, ...SANS_ECHAPPEMENT },
          ),
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
          badgeLabel: t('eventDetails.attendanceBadge.arrived', 'Arrivé'),
          badgeTextColor: Colors.warning500 || 'rgb(245, 158, 11)',
          badgeValue: `+${lateMinutes} min`,
          description: t(
            'eventDetails.yourActualArrivalHasBeen',
            'Ton arrivée réelle a bien été enregistrée.',
          ),
          hasArrived: true,
          primaryAction: null,
          secondaryAction: null,
        };
      }

      return {
        accentColor: Colors.success500 || 'rgb(34, 197, 94)',
        badgeBackgroundColor: `${Colors.success500 || 'rgb(34, 197, 94)'}22`,
        badgeBorderColor: `${Colors.success500 || 'rgb(34, 197, 94)'}38`,
        badgeLabel: t('eventDetails.attendanceBadge.arrived', 'Arrivé'),
        badgeTextColor: Colors.success500 || 'rgb(34, 197, 94)',
        badgeValue: null,
        description: t('eventDetails.youAreMarkedPresentOn', 'Tu es signalé présent à l’heure.'),
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
        badgeLabel: t('eventDetails.attendanceBadge.declaredLate', 'Retard annoncé'),
        badgeTextColor: Colors.warning500 || 'rgb(245, 158, 11)',
        badgeValue: `+${declaredLateMinutes} min`,
        description: t(
          'eventDetails.lateArrivalReportedMinConfirm',
          'Retard signalé : +{{declaredLateMinutes}} min. Confirme ton arrivée une fois sur '
            + 'place.',
          { declaredLateMinutes, ...SANS_ECHAPPEMENT },
        ),
        hasArrived: false,
        primaryAction: {
          title: t('eventDetails.update', 'Mettre à jour'),
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
        badgeLabel: t('eventDetails.nothingReported', 'Aucun signalement'),
        badgeTextColor: Colors.primary500,
        badgeValue: null,
        description: t(
          'eventDetails.youHaveMinLeftTo',
          'Il te reste {{minutesLeft}} min pour signaler ton arrivée ou ton retard.',
          { minutesLeft, ...SANS_ECHAPPEMENT },
        ),
        hasArrived: false,
        primaryAction: {
          title: t('eventDetails.attendanceBadge.selfArrived'),
          type: 'arrived',
        },
        secondaryAction: {
          title: t('eventDetails.iLlBeLate', 'Je serai en retard'),
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
      description: t(
        'eventDetails.theStartHasPassedReport',
        'Le début est passé. Signale ton retard ou confirme ton arrivée.',
      ),
      hasArrived: false,
      primaryAction: {
        title: t('eventDetails.attendanceBadge.selfArrived'),
        type: 'arrived',
      },
      secondaryAction: {
        title: t('eventDetails.iLlBeLate', 'Je serai en retard'),
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

    /**
     * 🔑 R9 — RANGER UNE DEMANDE EN GARDANT LA COPIE LA PLUS COMPLETE.
     *
     * 🧨 LE DEFAUT REPARE : les demandes arrivent par DEUX chemins — embarquees
     * dans l evenement, et paginees par `useGetEventParticipations`. Seule la
     * copie PAGINEE portait `recruitmentAd`. Or les embarquees etaient inserees
     * en premier et `deduped.has(key)` faisait gagner cette copie AMPUTEE : le
     * candidat perdait son poste, donc il disparaissait des groupes par poste
     * avant comme apres sa validation (constat de recette du 24/08).
     *
     * Le populate est repare des deux cotes ; cette regle est la CEINTURE : tant
     * qu une seule des deux copies porte le lien, c est celle-la qu on garde.
     * Le rang d insertion, lui, ne bouge pas — `Map.set` sur une cle existante
     * conserve sa place, et l ordre d affichage avec.
     * @param {EventParticipation} participation - la demande a ranger
     * @returns {void}
     */
    const retenirLaPlusComplete = (participation) => {
      const key = participation?.documentId
        || `${getUserKey(participation?.user) || 'user'}:${participation?.participationStatus || 'status'}:${participation?.updatedAt || ''}:${participation?.isActive === false ? 'inactive' : 'active'}`;
      if (!key) return;
      const dejaRangee = deduped.get(key);
      if (dejaRangee
        && (dejaRangee?.recruitmentAd?.documentId || !participation?.recruitmentAd?.documentId)) {
        return;
      }
      deduped.set(key, participation);
    };

    embeddedRequests.forEach(retenirLaPlusComplete);
    pages.forEach((page) => {
      (page?.data || []).forEach(retenirLaPlusComplete);
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
    // 🔭 P7 — « candidatures a voir » = celles qui attendent encore une
    // decision, poste par poste.
    // 🪤 ON NE RECOMPTE RIEN : `candidatesCount` porte deja le `max()`
    // anti-double-comptage pose plus haut (une meme personne peut figurer a la
    // fois dans `slot.candidates` et dans une participation). Repartir des
    // listes brutes ici afficherait un nombre plus gros que la realite.
    // On retranche les personnes DEJA validees : ce qui reste est ce que le
    // staff doit encore regarder.
    const totalToReview = detectionSlots.reduce(
      // @ts-ignore: FIXME: Baseline TS regression
      (sum, slot) => sum + Math.max(
        0,
        Number(slot?.candidatesCount || 0) - Number(slot?.acceptedCount || 0),
      ),
      0,
    );

    return {
      totalOpen,
      totalRequested,
      totalToReview,
    };
  }, [detectionSlots]);
  // 🔭 P7 — le resume que porte l'entete. `null` hors detection : c'est cette
  // prop, et elle seule, qui commande les deux tuiles (temoin 4 de
  // `EventHeaderP7DetectionTuiles.test.js`).
  const detectionHeaderSummary = useMemo(() => (
    isDetectionEvent
      ? {
        openPositions: detectionSlotsSummary.totalOpen,
        toReview: detectionSlotsSummary.totalToReview,
      }
      : null
  ), [detectionSlotsSummary, isDetectionEvent]);
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
  // 🙋 POINTAGE (« reponse B » d Adel, 29/09) — APRES COUP, LE « PAS
  // RENSEIGNE » PEUT PASSER PRESENT. La regle vit dans
  // `domains/event/presenceRule.js`, miroir de celle du serveur ; un tournoi
  // garde son propre parcours d inscription.
  const peutPasserPresentApresCoup = !isTournamentEvent && canDeclareLatePresence({
    event,
    hasPendingRequest: currentUserParticipationState.hasPendingRequest,
    isConvenedMember: isConvenedTeamMember,
    isMissing: currentUserParticipationState.isMissing,
    isParticipating: currentUserParticipationState.isParticipating,
    myAttendanceStatus: myAttendance?.attendanceStatus,
  });
  const tournamentAwareParticipationFlow = useMemo(() => {
    if (!isTournamentEvent || isStageDayEvent || userData?.role?.name !== USER_ROLES.player) {
      return currentParticipationFlow;
    }

    if (managedTournamentTeam?.documentId) {
      return {
        ...currentParticipationFlow,
        actionLabel: t('eventDetails.manageMyTournamentTeam', 'Gérer mon équipe tournoi'),
        confirmLabel: t('eventDetails.manageMyTournamentTeam', 'Gérer mon équipe tournoi'),
      };
    }

    if (currentUserTournamentTeam?.documentId) {
      return {
        ...currentParticipationFlow,
        actionLabel: t('eventDetails.seeMyTournamentTeam', 'Voir mon équipe tournoi'),
        confirmLabel: t('eventDetails.seeMyTournamentTeam', 'Voir mon équipe tournoi'),
      };
    }

    if (currentUserPendingTournamentTeam?.documentId) {
      return {
        ...currentParticipationFlow,
        actionLabel: t('eventDetails.followMyRequest', 'Suivre ma demande'),
        confirmLabel: t('eventDetails.followMyRequest', 'Suivre ma demande'),
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
    userData?.role?.name, t,
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
  } = useMemo(
    // PARTWEB — le calcul vit dans le domaine : le site appelle le MEME.
    () => buildTeamParticipationSections({
      canEdit,
      event,
      inactiveParticipations: inactiveEventParticipations,
      pendingParticipations,
      t,
      trainerKeys: trainerKeysForEvent,
    }),
    [canEdit, event, inactiveEventParticipations, pendingParticipations, trainerKeysForEvent, t],
  );

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
  //
  // ♻️ P8 (vague P, 23/08) — LE SUFFIXE « N demande(s) a verifier » A QUITTE
  // CETTE LIGNE. Il y etait reserve a `canEdit` ; la carte d'ouverture, juste
  // au-dessus de la liste, le dit desormais mieux — avec son bouton pour y
  // aller. Le garder ici l'aurait fait lire DEUX fois a l'organisateur.
  // 🔒 Rien n'a change pour un lecteur : cette ligne est, mot pour mot, celle
  // qu'il voyait deja. La clef `openTraining.pendingSuffix` n'est pas
  // supprimee : c'est la carte qui la demande maintenant.
  const openTrainingPublicLine = useMemo(() => {
    const quota = Number(trainingOpenConfig.externalParticipantLimit || 0);
    if (!trainingOpenConfig.isOpenTraining || quota <= 0) return '';

    const taken = externalParticipationSection?.participating?.length || 0;
    return t(
      'eventDetails.openTraining.publicLine',
      'Accueille {{quota}} joueur·se·s de l’extérieur · {{taken}} place(s) prise(s)',
      { quota, taken },
    );
  }, [
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

  const participationsByStatus = useMemo(
    () => buildParticipationsByStatus({
      canEdit,
      event,
      pendingParticipations,
      trainerKeys: trainerKeysForEvent,
    }),
    [canEdit, event, pendingParticipations, trainerKeysForEvent],
  );
  // 🗂️ P7 — LES CANDIDATS, RANGES PAR POSTE (regle 5 du pack : « chaque poste
  // ouvre les gens de ce poste, en deux groupes nommes : participants (retenus)
  // et demandes (a accepter / refuser) »).
  //
  // 🔒 CE CALCUL NE FABRIQUE PERSONNE ET N'EN PERD AUCUN. Il REPARTIT les deux
  // listes que l'onglet rendait deja — `participationsByStatus.participating`
  // et `pendingParticipations` — au lieu d'aller rechercher les gens ailleurs.
  // C'est ce qui garantit qu'un regroupement ne fait disparaitre personne.
  //
  // 🪤 LES DEUX LISTES NE VIENNENT PAS DE LA MEME SOURCE : les retenus sont des
  // UTILISATEURS (`event.participations`), les demandes sont des PARTICIPATIONS
  // (`participationRequests`). Seule la participation porte le poste ; on passe
  // donc par une table « personne validee -> poste » pour rattacher les retenus.
  const detectionPositionSections = useMemo(() => {
    if (!isDetectionEvent || !detectionSlots.length) return [];

    /** @type {Map<string, string>} */
    const slotIdByAcceptedUserKey = new Map();
    activeEventParticipations.forEach((/** @type {any} */ participation) => {
      const slotId = String(participation?.recruitmentAd?.documentId || '');
      const userKey = getUserKey(participation?.user);
      const status = String(participation?.participationStatus || '').toLowerCase();
      if (!slotId || !userKey || status !== 'accepted') return;
      slotIdByAcceptedUserKey.set(String(userKey), slotId);
    });

    const retenus = /** @type {any[]} */ (participationsByStatus?.participating || []);
    const demandes = /** @type {any[]} */ (pendingParticipations || []);

    // @ts-ignore: FIXME: Baseline TS regression
    const sections = detectionSlots.map((/** @type {any} */ slot) => {
      const slotId = String(slot?.documentId || '');
      return {
        acceptedCount: Number(slot?.acceptedCount || 0),
        isComplete: Boolean(slot?.isComplete),
        key: slotId || `poste-${String(slot?.position || '')}`,
        participating: retenus.filter(
          (player) => slotIdByAcceptedUserKey.get(String(getUserKey(player) || '')) === slotId,
        ),
        pending: demandes.filter(
          (participation) => String(participation?.recruitmentAd?.documentId || '') === slotId,
        ),
        position: String(slot?.position || ''),
        quantity: Number(slot?.quantity || 1),
      };
    });

    // 🧯 LE GROUPE DE REPLI, ET LA RAISON D'ETRE DE CE LOT EN UNE LIGNE : une
    // detection accepte AUSSI des inscriptions hors annonce (`getDetectionCandi
    // datePlayers` en compte trois canaux). Sans ce groupe, regrouper par poste
    // ferait disparaitre de l'ecran des gens qui y etaient la veille. Il ne
    // s'affiche que s'il porte quelqu'un : pas de titre pour un groupe vide.
    const placesRetenus = new Set(
      sections.flatMap((section) => section.participating.map(
        (/** @type {any} */ player) => String(getUserKey(player) || ''),
      )),
    );
    const placesDemandes = new Set(
      sections.flatMap((section) => section.pending.map(
        (/** @type {any} */ participation) => String(participation?.documentId || ''),
      )),
    );
    const retenusSansPoste = retenus.filter(
      (player) => !placesRetenus.has(String(getUserKey(player) || '')),
    );
    const demandesSansPoste = demandes.filter(
      (participation) => !placesDemandes.has(String(participation?.documentId || '')),
    );

    if (retenusSansPoste.length || demandesSansPoste.length) {
      sections.push({
        acceptedCount: retenusSansPoste.length,
        isComplete: false,
        key: 'p7-sans-poste',
        participating: retenusSansPoste,
        pending: demandesSansPoste,
        position: '',
        quantity: 0,
      });
    }

    return sections;
  }, [
    activeEventParticipations,
    detectionSlots,
    isDetectionEvent,
    participationsByStatus,
    pendingParticipations,
  ]);
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
        result?.message || t(
          'eventDetails.yourParticipationForThisPosition',
          'Ta participation a bien été envoyée sur ce poste.',
        ),
      );
    },
  });

  const featuredScopeOptions = useMemo(() => ([
    {
      kind: 'PUBLIC',
      label: t('eventDetails.featuredPublicly', 'À la une publique'),
      status: featuredRequestsSummary.PUBLIC.status,
      summary: featuredRequestsSummary.PUBLIC,
      visible: canManageFeatured,
    },
    {
      kind: 'SECTION',
      label: t('eventDetails.featuredInMyClub', 'À la une dans mon club'),
      status: featuredRequestsSummary.SECTION.status,
      summary: featuredRequestsSummary.SECTION,
      visible: canManageFeatured && Boolean(eventClubId),
    },
    {
      kind: 'CM',
      label: t('eventDetails.featuredInTheMultisportClub', 'À la une dans le club multisport'),
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
    featuredRequestsSummary.SECTION, t,
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
    // 🧱 D3 — LE REFUS SE CONSULTE ICI, LA OU LE BOUTON SE DECIDE.
    //
    // Constat de l'audit du 2026-08-26 : sur un STAGE ou un TOURNOI, le bouton
    // s'affichait, l'ecran s'ouvrait, les DEUX lectures ci-dessous partaient
    // pour rien, le formulaire se remplissait, on pouvait tout saisir — et
    // « Enregistrer » etait GRIS. Le refus n'arrivait qu'au bout du parcours,
    // sous la forme d'un bandeau au milieu du formulaire.
    //
    // ⚠️ LE BOUTON NE DISPARAIT PAS, ET C'EST DELIBERE. Un bouton qui s'evapore
    // sans explication serait un DEUXIEME defaut : on chercherait ce qu'on a
    // perdu. Il reste, et il DIT pourquoi c'est ferme — avec le motif exact que
    // porte deja `getEventEditSupport`, seul juge de la question dans le depot.
    //
    // ⛔ Ce garde-fou est place AVANT le prechargement : c'est lui qui rend les
    // deux lectures inutiles, pas l'inverse.
    const editSupport = getEventEditSupport(event);
    if (!editSupport.isSupported) {
      Alert.alert(
        t('eventDetails.editUnsupported.title', 'Modification limitée'),
        editSupport.reason
          || t(
            'eventDetails.editUnsupported.description',
            "Ce type d'événement ne se modifie pas encore depuis cette fiche.",
          ),
      );
      return;
    }

    // R5 (b) — LE DEPART ANTICIPE DES DEUX LECTURES DE L'ECRAN DE MODIFICATION.
    //
    // Constat de recette (2.6.26) : « tous les boutons de modifier un evenement
    // sont lents a s'ouvrir ». EventEdit tire ses donnees AU MONTAGE — donc
    // l'ecran s'affiche vide, puis se remplit. Les deux lectures qui le
    // bloquent partent desormais ICI, au toucher, pendant que la transition
    // de navigation joue : c'est autant de temps repris sur l'attente.
    //
    // 🔑 LES CLEFS SONT CELLES D'EventEdit, AU CARACTERE PRES
    // (`eventQueries.js` : `useGetEventForEdit` et `useGetEventTypes`). C'est
    // la seule chose qui compte : une clef voisine remplirait une case que
    // personne ne lit, et l'attente serait exactement la meme.
    // ⛔ La fiche d'evenement lit `['event', eventId]` — une clef DIFFERENTE,
    // sur une projection plus large. Le cache de la fiche ne sert donc a rien
    // a l'ecran de modification, et c'est pour ca qu'il faut precharger.
    //
    // ⚠️ Aucun `await` : c'est un depart anticipe, pas une etape du parcours.
    // La navigation ne l'attend pas, et un echec reseau n'est pas traite ici —
    // EventEdit refera l appel lui-meme si le cache est vide.
    // Motif Q2, deja eprouve (`EventWizardTeam.js`).
    if (eventId) {
      queryClient.prefetchQuery({
        queryFn: () => getEventByIdForEdit(eventId),
        queryKey: ['event', eventId, 'edit'],
        // 🔑 EVEDIT-3 — LA MEME FRAICHEUR QUE LE LECTEUR (`useGetEventForEdit`).
        //
        // ⚠️ LA REGLE ETAIT DEJA ECRITE JUSTE EN DESSOUS, POUR `event-types`, ET
        // ELLE N'AVAIT ETE APPLIQUEE QU'A UNE LIGNE SUR DEUX. Sans duree de
        // fraicheur, un prechargement repart au reseau A CHAQUE appui sur
        // « Modifier », meme deux secondes apres le precedent.
        //
        // 🔗 CE QUE CA COUTAIT VRAIMENT : un appui qui n'a pas l'air d'agir se
        // rejoue, et chaque rejeu relancait une lecture complete de
        // l'evenement. Le lot FCMSTORM a mesure 27 refus `429` en rafale le
        // 28/08 — et un `429` sur CETTE lecture-la fige l'ecran de
        // modification, puisque `queryClient.js` ne retente jamais un 429.
        staleTime: EVENT_DETAIL_STALE_MS,
      });
      queryClient.prefetchQuery({
        queryFn: () => getEventTypes(),
        queryKey: ['event-types'],
        // MEME fraicheur que le lecteur (`EventEdit.js`). Sans elle, ce
        // prechargement-ci repartirait au reseau a CHAQUE appui sur « Modifier »
        // — et il annulerait exactement ce que la duree de fraicheur economise.
        staleTime: Infinity,
      });
    }

    navigation.navigate(RouteNames.EventStack, {
      params: { eventId },
      screen: RouteNames.EventEdit,
    });
    // ⚠️ `event` et `t` ENTRENT dans les dependances : sans eux, le refus serait
    // calcule sur l'evenement du premier rendu — donc sur `undefined`, donc
    // jamais.
  }, [event, eventId, navigation, queryClient, t]);

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
        t(
          'eventDetails.noOpenTournamentTeamCan',
          'Aucune équipe tournoi ouverte ne peut être rejointe pour le moment.',
        ),
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
    userData?.role?.name, t,
  ]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleSelectExistingTournamentTeam = useCallback((team) => {
    if (!team?.documentId) return;
    setPendingTournamentAction({
      // @ts-ignore: FIXME: Baseline TS regression
      mode: 'join_existing',
      teamDocumentId: team.documentId,
      teamName: team?.name || t('eventDetails.tournamentTeam', 'Équipe tournoi'),
    });
    setIsTournamentJoinSelectorVisible(false);
    setJoinModalError('');
    setIsJoinModalVisible(true);
  }, [t]);

  const handleCreateTournamentTeam = useCallback(() => {
    const trimmedName = String(tournamentTeamNameDraft || '').trim();
    if (!trimmedName) {
      Alert.alert(t(
        'eventDetails.tournamentTeam',
        'Équipe tournoi',
      ), t(
        'eventDetails.addATeamNameBefore',
        'Ajoute un nom d équipe avant de continuer.',
      ));
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
  }, [tournamentTeamNameDraft, t]);

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
      t('eventDetails.declineTheRequest', 'Refuser la demande ?'),
      t('eventDetails.theRequesterWillBeNotified', 'Le demandeur sera notifié du refus.'),
      [
        { style: 'cancel', text: t('eventDetails.cancel', 'Annuler') },
        {
          onPress: () => rejectFeaturedRequestMutation.mutate({ requestId: pendingFeaturedApproval.requestId }),
          style: 'destructive',
          text: t('eventDetails.decline', 'Refuser'),
        },
      ],
    );
  }, [pendingFeaturedApproval?.requestId, rejectFeaturedRequestMutation, t]);

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

  // POINTAGE — la porte etroite passe par la route des reponses : le serveur
  // l ouvre au seul « pas renseigne » (`assertLatePresenceAllowed`).
  const handleDeclareLatePresence = useCallback(() => {
    if (!event?.documentId) return;
    // @ts-ignore: FIXME: Baseline TS regression
    mutations.respondToEventRsvpMutation.mutate({
      answer: 'present',
      eventId: event.documentId,
    });
  }, [event?.documentId, mutations.respondToEventRsvpMutation]);

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
        getParticipationErrorMessage(mutationError, t(
          'eventDetails.unableToConfirmYourParticipation',
          'Impossible de confirmer ta participation pour le moment.',
        )),
      );
    }
  }, [
    currentParticipationFlow,
    event?.documentId,
    handleBlockedParticipationFlow,
    mutations.createEventParticipationMutation,
    mutations.joinReservationMutation,
    userData?.documentId, t,
  ]);

  // 🎯 R9 — POSTULER SANS VISER UN POSTE.
  //
  // Le groupe d affichage « Sans poste precise » existait deja cote liste
  // (`p7-sans-poste`), parce qu une detection accepte aussi des inscriptions
  // hors annonce. Mais rien a l ecran ne permettait D Y ENTRER : le selecteur
  // n offrait que des postes. C etait une porte de sortie sans porte d entree.
  //
  // ⛔ AUCUN SECOND CHEMIN D ECRITURE : `pendingDetectionSlot` a `null` renvoie
  // la confirmation vers `handleConfirmParticipation`, exactement comme avant ce
  // lot — donc avec la meme declaration de responsabilite.
  const handleApplyWithoutDetectionSlot = useCallback(() => {
    setIsDetectionSlotPickerVisible(false);
    setPendingDetectionSlot(null);
    setJoinModalError('');
    setIsJoinModalVisible(true);
  }, []);

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

  // 🗂️ P7 — OUVRIR LA FICHE D'UN CANDIDAT.
  //
  // 🪤 LES DEUX CHEMINS N'ARRIVENT PAS AVEC LA MEME MATIERE : une DEMANDE
  // apporte sa participation (c'est elle qu'on a tapee), un RETENU n'apporte
  // que la personne (la liste des retenus est une liste d'utilisateurs). On
  // retrouve donc la participation manquante ici, en UN endroit, plutot que de
  // demander aux deux appelants de la porter.
  const handleOpenDetectionCandidate = ({ participation = null, user }) => {
    if (!user) return;
    const userKey = String(getUserKey(user) || '');
    const resolvedParticipation = participation || activeEventParticipations.find(
      (/** @type {any} */ item) => String(getUserKey(item?.user) || '') === userKey,
    ) || null;
    // @ts-ignore: FIXME: Baseline TS regression
    const slotId = String(resolvedParticipation?.recruitmentAd?.documentId || '');
    const slot = detectionSlots.find(
      (/** @type {any} */ item) => String(item?.documentId || '') === slotId,
    ) || null;

    setDetectionCandidateSheet({ participation: resolvedParticipation, slot, user });

    // 🔒 PAS DE POSTE, PAS DE RETOUR INDIVIDUEL — et on ne l'invente pas. Une
    // inscription hors annonce (`event-participation`) n'a AUCUN champ
    // `reviewNote` : seule une `recruitment-application` en porte un. La fiche
    // le DIT au lieu d'afficher un cadre vide qui ferait croire a une note
    // effacee.
    if (!slotId) {
      setDetectionCandidateReview({ note: '', state: 'idle' });
      return;
    }

    setDetectionCandidateReview({ note: '', state: 'loading' });
    // Le service est appele DANS CE HANDLER, jamais au rendu : les 15 suites
    // voisines qui doublent `recruitmentService` avec le seul
    // `applyToRecruitmentAd` continuent de monter l'ecran sans rien casser.
    // `Promise.resolve().then(...)` fait tomber une doublure incomplete dans le
    // `catch` au lieu de jeter en pleine poignee d'appui.
    Promise.resolve()
      .then(() => getRecruitmentApplications(slotId))
      .then((/** @type {any[]} */ applications) => {
        const application = (applications || []).find(
          (/** @type {any} */ item) => String(getUserKey(item?.user) || '') === userKey,
        );
        setDetectionCandidateReview({
          note: String(application?.reviewNote || ''),
          state: 'loaded',
        });
      })
      .catch(() => setDetectionCandidateReview({ note: '', state: 'error' }));
  };

  // 🏷️ LES LIBELLES DE LA FICHE, CALCULES ICI ET PAS DANS LE JSX. Une regle
  // d'affichage ecrite au milieu d'une balise n'est relisible par personne, et
  // c'est la que les fautes se cachent. La feuille, plus bas, ne fait que les
  // poser.
  // 🤝 R9 — PEUT-ON INVITER CE CANDIDAT DANS L EQUIPE ?
  //
  // 🪤 L ADAPTATEUR, ET C EST LE PIEGE DU LOT : la regle partagee a ete
  // ecrite pour une CANDIDATURE d annonce, elle lit donc `application.applicant`.
  // La fiche, elle, porte `participation.user`. On adapte l objet qu on lui
  // passe ; on NE TOUCHE PAS a la fonction, qui sert aussi a l ecran de l annonce.
  //
  // 🏟️ L equipe est celle de l EVENEMENT : l annonce ne descend pas la
  // sienne (`recruitmentAds` est peuple sans `team`), et c est de toute facon
  // l equipe organisatrice qui a du sens ici — c est deja elle qui commande le
  // droit de trancher les demandes (`canApprovePendingRequests`).
  const detectionCandidateInvitation = resolveTeamInvitationAvailability(
    { applicant: detectionCandidateSheet?.user },
    event?.team?.documentId,
  );
  const detectionCandidateAlreadyInvited = invitedParticipationIds.includes(
    String(detectionCandidateSheet?.participation?.documentId || ''),
  );
  const inviteCandidateMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ payload = {}) => inviteToTeam({
      team: payload.teamId,
      user: payload.candidateId,
    }),
    onError: (/** @type {any} */ echecInvitation) => {
      Alert.alert(
        t('eventDetails.detection.candidateInvite', 'Inviter dans l’équipe'),
        echecInvitation?.message || t('common.errorOccurred'),
      );
    },
    onSuccess: (/** @type {any} */ _data, /** @type {any} */ variables) => {
      const participationId = String(variables?.participationId || '').trim();
      if (!participationId) return;
      setInvitedParticipationIds((previous) => (
        previous.includes(participationId) ? previous : [...previous, participationId]
      ));
    },
  }));
  const detectionCandidateName = [
    detectionCandidateSheet?.user?.firstname,
    detectionCandidateSheet?.user?.lastname,
  ].filter(Boolean).join(' ').trim()
    || t('eventDetails.detection.candidateFallbackName', 'Candidat·e');
  const detectionCandidateStatus = String(
    detectionCandidateSheet?.participation?.participationStatus || '',
  ).toLowerCase();
  const detectionCandidateStatusLabel = {
    accepted: t('eventDetails.detection.candidateStatusAccepted', 'Retenu·e sur ce poste'),
    declined: t('eventDetails.detection.candidateStatusDeclined', 'Refusé·e'),
    pending: t('eventDetails.detection.candidateStatusPending', 'Demande à traiter'),
  }[detectionCandidateStatus]
    || t('eventDetails.detection.candidateStatusUnknown', 'Inscrit·e à la séance');
  const detectionCandidatePositionLabel = detectionCandidateSheet?.slot?.position
    ? t(
      'eventDetails.detection.candidateAppliedFor',
      'A postulé au poste : {{position}}',
      { position: detectionCandidateSheet.slot.position },
    )
    : t(
      'eventDetails.detection.candidateNoPosition',
      'Inscription hors annonce, sans poste',
    );
  // 📝 Les QUATRE etats du retour individuel, dits franchement : il n'y en a
  // pas ici, on le charge, le voici, on n'a pas pu.
  const detectionCandidateReviewLabel = (() => {
    if (!detectionCandidateSheet?.slot) {
      return t(
        'eventDetails.detection.candidateReviewUnavailable',
        'Le retour individuel n’existe que pour les candidatures passées par une annonce.',
      );
    }
    if (detectionCandidateReview.state === 'loading') {
      return t('eventDetails.detection.candidateReviewLoading', 'Chargement du retour…');
    }
    if (detectionCandidateReview.state === 'error') {
      return t(
        'eventDetails.detection.candidateReviewError',
        'Impossible de lire le retour pour le moment.',
      );
    }
    return detectionCandidateReview.note
      || t('eventDetails.detection.candidateReviewEmpty', 'Pas encore de retour du staff.');
  })();

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
      // 🗣️ R6 (vague R) — LE PARTIEL LAISSE PAR R4. Le geste avait change ici
      // (marquer absent au lieu d effacer la reponse), les MOTS de la fenetre
      // etaient restes ceux de la suppression : « Annuler ma participation ».
      // La personne lisait une question et en executait une autre — et la
      // difference compte : effacer sa reponse et se declarer absent ne donnent
      // pas le meme compteur au coach.
      // ⛔ Les BOUTONS restent partages (« Non, retour » / « Oui, annuler ») :
      // ils conviennent aux deux gestes, et les dupliquer ferait deux endroits
      // a corriger le jour ou l un d eux change.
      Alert.alert(
        t('eventDetails.modals.declareMissing.title'),
        t('eventDetails.modals.declareMissing.description'),
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
      t(
        'eventDetails.unableToFindYourAnswer',
        'Impossible de retrouver ta réponse pour cet événement. Recharge la page et réessaie.',
      ),
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
          SharePlatform.share({
            title: t('eventDetails.participants', 'Participants'),
            url: path,
          }).catch(() => undefined);
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
        t('eventDetails.campaignAlreadyLinked', 'Campagne déjà liée'),
        t(
          'eventDetails.thisEventAlreadyHasA',
          'Cet événement a déjà une campagne de cotisation. Crée-en une autre seulement si tu '
            + 'veux un paiement distinct.',
        ),
        [
          { style: 'cancel', text: t('common.cancel', 'Annuler') },
          {
            onPress: navigateToCampaignSettings,
            text: t('eventDetails.createAnyway', 'Créer quand même'),
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
        return t('eventDetails.draft', 'Brouillon');
      case 'last_match':
        return t('eventDetails.lastMatch', 'Dernier match');
      case 'published':
        return t('eventDetails.teamLineUpPublished', "Composition d'équipes publiée");
      default:
        return t('eventDetails.newLineUp', 'Nouvelle composition');
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

    // 👪 DECISIONS-SOIR (02/10) — le parent : l'équipe de SON enfant, que le serveur nomme.
    const parentTeamId = findParentTeamId({
      invitedTeams: event?.invitedTeams,
      team: event?.team,
      viewerParentTeamDocumentIds: event?.viewerParentTeamDocumentIds,
    });
    if (parentTeamId) return parentTeamId;

    return teams[0]?.documentId || null;
  }, [
    event?.invitedTeams,
    event?.team,
    event?.viewerParentTeamDocumentIds,
    userData?.documentId,
    userData?.trainedTeams,
  ]);

  // 🔄 N3 (D3) — QUI REGARDE CE MATCH ? Un evenement a UNE equipe organisatrice
  // et des equipes invitees ; le meme match est donc « a domicile » pour l'une
  // et « a l'exterieur » pour l'autre. Le score le savait deja (il s'inversait
  // dans `matchHeaderScoreSummary`), mais la regle etait ecrite a l'interieur du
  // calcul du score et n'etait donc utilisable par personne d'autre. Elle sort
  // ici parce que la pastille de type et le verdict en ont besoin aussi — et
  // qu'une pastille « À domicile » posee au-dessus d'un score inverse serait
  // une contradiction visible a l'ecran.
  // 🧨 R2 (recette 2.6.26) — DEUX EQUIPES DU MEME CLUB NE S'AFFRONTENT PAS.
  // Inviter une equipe de son propre club retournait la pastille et le score
  // pour ses joueurs : le 3-1 gagne par le club devenait une DEFAITE a
  // l'ecran. La regle est la meme qu'au nommage (`eventDisplayName.js`) —
  // les DEUX clubs doivent etre connus et egaux, sinon rien ne change.
  // ST-VUES3-ORDI — la regle vit dans `matchPageModel.js`, partagee avec le site.
  const isViewerFromInvitedTeam = useMemo(
    () => resolveViewerFromInvitedTeam({ compositionTeamId, event }),
    [compositionTeamId, event],
  );

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

    return event?.type?.name || t('eventDetails.eventFallback', 'Evenement');
  }, [event, eventDescriptionText, t]);

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

  // 👪 DECISIONS-SOIR (02/10, « parents encart B ») — le parent d'un joueur de CETTE équipe
  // demande aussi la feuille : le serveur ne lui rend que l'encart (score, auteur, buteurs).
  const isTeamParent = Boolean(compositionTeamId) && compositionTeamId === findParentTeamId(event);
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
          && (canEdit || isTeamMember || isTeamParent),
      ),
    },
  );

  // 🔇 FINITIONS (recette émulateur du 28/09) — UNE SEULE PORTE pour « ma réponse de
  // match ». Le serveur la refuse avant la fin du match (400 « Match statistics are
  // only available after the match has ended », 6 fois en une tournée). La requête
  // était bien fermée, mais le rafraîchissement de la fiche appelait `refetch()` à la
  // main avec une condition RECOPIÉE, sans la fin du match — et `refetch` passe outre
  // `enabled`. Les deux lisent désormais ce même booléen.
  const canLoadMyMatchResponse = Boolean(
    eventId
      && isMatchEvent
      && compositionTeamId
      && isTeamPlayer
      && isMatchFinished,
  );
  const {
    data: myMatchResponsePayload,
    isFetching: isMyMatchResponseFetching,
    refetch: refetchMyMatchResponse,
  } = useGetEventMyMatchResponse(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(areDeferredQueriesEnabled && canLoadMyMatchResponse),
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
  const myCoachReview = matchStatsPayload?.myCoachReview || null;
  const myMatchResponse = myMatchResponsePayload?.response || null;
  const isCoachFeedbackHighlighted = highlightedSection === 'coachFeedback';
  // 🎯 ST-MONMATCH (écran 12, état 5, défaut 25) — la notification « Retour de Karim » ouvre
  // la fiche SUR le retour : dès que la carte « Mon match » est posée avec son retour, on y
  // descend, une seule fois. ⛔ Jest ne mesure rien : le défilement se voit à la recette.
  const monMatchAnchorRef = useRef(null);
  const hasScrolledToCoachFeedbackRef = useRef(false);
  const onMonMatchLayout = useCallback(() => {
    if (!isCoachFeedbackHighlighted || hasScrolledToCoachFeedbackRef.current) return;
    if (myCoachReview?.rating == null && !myCoachReview?.comment) return;
    hasScrolledToCoachFeedbackRef.current = true;
    requestAnimationFrame(() => scrollToAnchor(monMatchAnchorRef));
  }, [isCoachFeedbackHighlighted, myCoachReview, scrollToAnchor]);
  const hasExplicitMyMatchResponsePermission = typeof myMatchResponsePayload?.permissions?.canRespond === 'boolean';
  const canRespondMyMatchStats = hasExplicitMyMatchResponsePermission
    ? Boolean(myMatchResponsePayload?.permissions?.canRespond)
    : (!isMyMatchResponseFetching && Boolean(isTeamPlayer));
  const isMatchStatsFinal = matchStatsReport?.status === 'final';
  const isMatchStatsReviewRequired = Boolean(matchStatsReport?.needsReview);
  const canViewMatchStats = Boolean(matchStatsPayload?.permissions?.canView || isTeamMember);
  const canManageMatchStats = Boolean(matchStatsPayload?.permissions?.canManage);
  const matchStatsScoreLabel = useMemo(() => {
    if (!matchStatsPayload?.score?.available) {
      return t('eventDetails.scoreToComplete', 'Score à compléter');
    }

    return `${matchStatsPayload?.score?.scoreFor ?? '-'} - ${matchStatsPayload?.score?.scoreAgainst ?? '-'}`;
  }, [
    matchStatsPayload?.score?.available,
    matchStatsPayload?.score?.scoreAgainst,
    matchStatsPayload?.score?.scoreFor, t,
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

  // ST-MATCH (écrans 1 et 7) — le prénom de l'entraîneur de l'équipe : « Karim n'a pas
  // encore saisi le score », « Le bilan de Karim ».
  const teamCoachFirstname = useMemo(
    () => resolveTeamCoachFirstname(compositionEditorTeam || event?.team),
    [compositionEditorTeam, event?.team],
  );
  // ST-MONMATCH (écran 12) — « Le retour de Karim » : qui a publié la feuille
  // (`report.submittedBy`, rendu au joueur), sinon l'entraîneur de l'équipe.
  const monMatchEntraineur = String(matchStatsReport?.submittedBy?.firstname || '').trim()
    || teamCoachFirstname || '';

  // ST-MATCH (écran 1, état 1) — « VS » et l'heure du coup d'envoi, au centre.
  const matchStartTimeLabel = useMemo(() => resolveMatchStartTimeLabel(event), [event]);

  // ST-VUES3-ORDI — le calcul de l'encart vit dans `matchPageModel.js` : le site
  // (`EventDetails.web.js`) appelle le MEME, avec ses propres faits.
  const matchHeaderScoreSummary = useMemo(() => {
    if (!isMatchEvent) return null;

    return buildMatchHeaderScoreSummary({
      canEdit,
      canManage: canManageMatchStats,
      // 🔒 L'équipe et son encadrement ; jamais un visiteur (mineurs en U15). 👪 Et le parent d'un
      // joueur que le SERVEUR a reconnu (DECISIONS-SOIR, « parents encart B ») : l'app ne le
      // décide jamais seule.
      canSeeDetails: Boolean(
        isTeamMember || canEdit || matchStatsPayload?.permissions?.actorRole === 'parent',
      ),
      coachFirstname: teamCoachFirstname,
      event,
      isFinal: isMatchStatsFinal,
      isFinished: isMatchFinished,
      isViewerFromInvitedTeam,
      onNameOpponent: handleOpenOpponentSheet,
      opponentName: matchOpponentName,
      playerLines: matchStatsReport?.playerLines,
      scoreState: matchStatsPayload?.score || null,
      sport: matchStatsPayload?.sport,
      startTimeLabel: matchStartTimeLabel,
      t,
      viewerDocumentId: userData?.documentId || null,
    });
  }, [
    // `isMatchFinished` choisit le centre du face-à-face : « VS 19:00 » avant le coup
    // d'envoi, « – – Score en attente » après (la règle de FINITIONS7 tient).
    canEdit,
    canManageMatchStats,
    event,
    handleOpenOpponentSheet,
    isMatchEvent,
    isMatchFinished,
    isMatchStatsFinal,
    isTeamMember,
    isViewerFromInvitedTeam,
    matchOpponentName,
    matchStartTimeLabel,
    matchStatsPayload?.permissions?.actorRole,
    matchStatsPayload?.score,
    matchStatsPayload?.sport,
    matchStatsReport?.playerLines,
    t,
    teamCoachFirstname,
    userData?.documentId,
  ]);

  // 🏷️ ST-MATCH (écran 1) — la pastille de type porte le VERDICT une fois le score
  // connu : « MATCH · TERMINÉ · VICTOIRE ». Le badge de l'encart qui le disait est
  // retiré : une seule place pour le résultat.
  const matchVerdictTagSegment = useMemo(() => resolveMatchVerdictTag({
    isFinished: isMatchFinished,
    t,
    verdict: matchHeaderScoreSummary?.verdict,
  }), [isMatchFinished, matchHeaderScoreSummary?.verdict, t]);
  const typeTagSegmentsAvecVerdict = useMemo(
    () => [...typeTagSegmentsComplets, matchVerdictTagSegment],
    [matchVerdictTagSegment, typeTagSegmentsComplets],
  );
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
  // 🗣️ FINITIONS (recette émulateur du 28/09) — LE RÉSUMÉ DE LA CONVOCATION PUBLIÉE,
  // EN MOTS DE DIRIGEANT. Il écrivait « 1 équipe(s) publiée(s) » et « 1 branche(s)
  // visible(s) · 1 remplacant(s) ». Vrais pluriels (i18next, `count`) ; une branche
  // est une CONVOCATION (celle d'une équipe), qu'on ne compte qu'à partir de deux ;
  // zéro remplaçant ne se dit pas.
  const publishedCompositionSummary = useMemo(() => ({
    counts: [
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
    ].filter(Boolean).join(' · '),
    teams: publishedCompositionTeamCount > 0 ? t('eventDetails.teamSPublished', {
      count: publishedCompositionTeamCount,
      defaultValue_one: '{{count}} équipe publiée',
      defaultValue_other: '{{count}} équipes publiées',
    }) : t('eventDetails.lineUpPublished', 'Composition publiée'),
  }), [
    convocationBranches.length,
    publishedCompositionReserveCount,
    publishedCompositionTeamCount,
    t,
  ]);

  // 🧾 R6 (vague R) — LES NOMS DES CONVOQUES, DEPUIS LA CHARGE DEJA LA.
  //
  // 🧨 Le resume publie comptait (« 1 equipe(s) publiee(s) · 1 branche(s)
  // visible(s) ») et ne nommait PERSONNE. Pour lire qui vient, il fallait
  // ouvrir un second ecran — alors que les noms voyagent DEJA dans la meme
  // reponse, a la meme milliseconde : `published.snapshotPlayers`.
  //
  // ♻️ ZERO CALCUL NEUF. `buildConvocationFieldTokens` apparie les placements
  // aux personnes, `buildConvocationReserveList` fusionne les deux listes du
  // banc — les deux servent DEJA l'ecran du joueur convoque. Les redecrire ici
  // donnerait deux facons de lire un convoque, qui divergeraient a la premiere
  // charge partielle (AD08 a deja paye ce prix : un remplacant present dans
  // `reserveSnapshotPlayers` seul etait lu par l'une et pas par l'autre).
  //
  // ⛔ Les placements sont aplatis sur TOUTES les equipes de la branche, pas
  // sur `teams[0]` : un pack a deux equipes montrerait sinon la moitie de ses
  // titulaires, sans que rien ne le dise.
  const publishedConvocationRoster = useMemo(() => convocationBranches.map((branch, index) => {
    const published = branch?.published || null;

    // ⚽ S5-D : les placements sont ASSEMBLES UNE FOIS et gardes tels quels. Ils
    // servaient deja aux titulaires ; le terrain les reutilise, il ne les
    // recalcule pas. Deux aplatissements du meme pack finiraient par diverger.
    const placements = (Array.isArray(published?.teams) ? published.teams : [])
      .flatMap((entry) => (Array.isArray(entry?.placements) ? entry.placements : []));

    return {
      bench: buildConvocationReserveList(published),
      key: String(branch?.team?.documentId || index),
      placements,
      snapshotPlayers: Array.isArray(published?.snapshotPlayers) ? published.snapshotPlayers : [],
      sportContext: published?.sportContext || null,
      // COACH1 — l encadrement voyage a cote du pack (`branch.staff`).
      staff: buildConvocationStaffList(branch),
      starters: buildConvocationFieldTokens({
        placements,
        snapshotPlayers: published?.snapshotPlayers,
      }),
      teamName: String(branch?.team?.name || '').trim(),
    };
  }), [convocationBranches]);

  // ⚽ COMPOLECT (D3 · D5 · D6) — CE QU'IL FAUT POUR OUVRIR LE VRAI TERRAIN.
  //
  // 🗣️ Adel, 26/08 : « pour les convocations avec composition, quand on ouvre,
  // on doit voir vraiment la composition en plein ecran avec le banc — pas le
  // reste ». Le plateau qu'il montre existe (`MatchCompositionBoard`) ; ce qui
  // manquait, c'est une destination de LECTURE qui y mene.
  //
  // ⛔ CETTE CIBLE VAUT `null` DANS DEUX CAS, ET LES DEUX SONT VOULUS :
  //   · aucun placement — chemin S5-c, legitime. Un terrain vide ferait croire
  //     a une compo perdue : on garde alors le comportement d'avant (D6), c'est
  //     la meme regle que l'apercu de l'onglet (`:6092`) ;
  //   · plusieurs equipes publiees avec des titulaires — le plateau ne dessine
  //     QU'UN terrain. Y envoyer un pack a deux equipes en cacherait une sans
  //     rien dire ; la vue agregee reste la pour ce cas-la.
  //
  // ♻️ ZERO CALCUL NEUF : `publishedConvocationRoster` apparie DEJA placements
  // et personnes (S5-D), `convocationBranches` porte le pack brut dont
  // `MatchCallUpSelection` a besoin pour pre-cocher. Les deux listes sont
  // alignees par construction — la premiere est le `map` de la seconde.
  const publishedBoardTarget = useMemo(() => {
    const drawable = publishedConvocationRoster
      .map((branch, index) => ({
        branch,
        published: convocationBranches[index]?.published || null,
      }))
      .filter((entry) => entry.branch.starters.length > 0);
    if (drawable.length !== 1) return null;

    const [{ branch, published }] = drawable;
    return {
      existingComposition: published,
      // Titulaires PUIS remplacants : le plateau retrouve le banc tout seul en
      // retirant de cette liste ceux que les placements portent (`getBenchPlayers`).
      selectedPlayers: [
        ...branch.starters.map((/** @type {any} */ token) => token.player),
        ...branch.bench.map((/** @type {any} */ entry) => entry.player),
      ],
      sport: branch.sportContext || compositionSport,
      startPlacements: branch.starters.map((/** @type {any} */ token) => token.placement),
      // FINITIONS6 · F6-2 — la charge de composition, comme a la premiere compo
      // (`openCompositionEditor`). Sans elle, « Modifier » (ici ou depuis le plein
      // ecran, qui retransmet ses parametres) rallumait « Demander une reponse »
      // sur un match aux reponses coupees : `isRsvpEnabled(null) === true`.
      teamComposition: staffCompositionPayload || null,
      teamName: branch.teamName || compositionEditorTeam?.name || '',
    };
  }, [
    compositionEditorTeam?.name,
    compositionSport,
    convocationBranches,
    publishedConvocationRoster,
    staffCompositionPayload,
  ]);

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
    if (viewerConvocationRole === CONVOCATION_ROLE_STARTER) {
      return t(
        'eventDetails.youReCalledUpStarter',
        'Tu es convoqué · Titulaire',
      );
    }
    if (viewerConvocationRole) {
      return t(
        'eventDetails.youReCalledUpSubstitute',
        'Tu es convoqué · Remplaçant',
      );
    }
    return t('eventDetails.youReNotInThe', 'Tu n’es pas dans la composition publiée.');
  }, [viewerConvocationRole, t]);

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
    return viewerConvocationRole ? t(
      'eventDetails.seeMyCallUp',
      'Voir ma convocation',
    ) : t(
      'eventDetails.seeTheTeamLineUp',
      "Voir la composition d'équipes",
    );
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
  //
  // 🕳️ R6 (vague R) — LE TROU MESURE LE 24/08 : UN SEUL DRAPEAU POUR DEUX ETATS.
  // `hasTeamComposition` melangeait le BROUILLON et le PUBLIE, et le bandeau ne
  // paraissait qu'en leur absence a tous les deux. A l'ecran, pour un entraineur
  // qui avait commence sa convocation : le bandeau disparaissait, le resume
  // publie n'existait pas encore, et l'onglet « Convocation » ne montrait PLUS
  // RIEN. Son travail etait invisible, et la seule porte pour le reprendre
  // vivait dans un menu REPLIE par defaut.
  //
  // ⇒ Deux drapeaux, parce qu'il y a deux etats : un brouillon se REPREND, un
  // publie se LIT. Aucun des deux ne laisse l'onglet vide.
  const hasPublishedTeamComposition = Boolean(staffCompositionPayload?.published);
  const hasDraftOnlyComposition = Boolean(
    staffCompositionPayload?.draft && !staffCompositionPayload?.published,
  );

  // 🧾 S5 (vague S) — QUI EST CONVOQUE, AVANT MEME QUE LA COMPO EXISTE.
  //
  // 🗣️ Adel, recette du 25/08 : « on peut convoquer SANS faire de composition ».
  // R6 ne montrait de liste qu APRES publication, et la construisait a partir
  // des PLACEMENTS. Un coach qui coche ses joueurs sans jamais ouvrir le
  // terrain n avait donc aucune liste — alors que c est le chemin le plus
  // court, et que le serveur l accepte deja : `publishConvocation` n exige
  // qu un BROUILLON (`event-composition.ts`, `if (!draft) throw`), jamais un
  // placement.
  //
  // ♻️ ZERO REQUETE NEUVE : les coches (`selectedPlayerIds`), l effectif
  // (`eligiblePlayers`) et les joueurs saisis a la main sont DEJA dans la
  // charge que cet ecran a chargee.
  //
  // ⚠️ `manualPlayers` vit DANS LE BROUILLON, pas a la racine de la charge. Les
  // chercher au mauvais endroit ferait disparaitre les invites SANS UN MOT —
  // et un joueur saisi a la main est justement celui qu aucune autre liste ne
  // rattrape.
  //
  // ⛔ L ORDRE EST CELUI DU COACH, pas l ordre alphabetique : on parcourt
  // `selectedPlayerIds`, qui porte la selection telle qu il l a faite.
  // ⛔ Un identifiant coche dont on ne connait pas la personne n ecrit pas de
  // ligne : mieux vaut un nom de moins qu une ligne vide.
  const draftConvocationRoster = useMemo(() => {
    if (!hasDraftOnlyComposition) return [];

    const draft = staffCompositionPayload?.draft;
    const selectedIds = Array.isArray(draft?.selectedPlayerIds) ? draft.selectedPlayerIds : [];
    if (!selectedIds.length) return [];

    const byId = new Map();
    [
      ...(Array.isArray(staffCompositionPayload?.eligiblePlayers)
        ? staffCompositionPayload.eligiblePlayers : []),
      ...(Array.isArray(draft?.manualPlayers) ? draft.manualPlayers : []),
    ].forEach((/** @type {any} */ player) => byId.set(getConvocationPersonId(player), player));

    return selectedIds
      .map((/** @type {any} */ playerId) => byId.get(String(playerId ?? '').trim()))
      .filter(Boolean);
  }, [
    hasDraftOnlyComposition,
    staffCompositionPayload?.draft,
    staffCompositionPayload?.eligiblePlayers,
  ]);

  // La composition fait partie des offres Equipe et Club — c'est la matrice du
  // serveur (`composition.manage: ['TEAM', 'CLUB']`,
  // admin/src/api/subscription/services/subscription-permission.ts:80).
  // `hasActiveClubOffer` couvre CLUB **et** CLUB_UNVERIFIED : depuis la decision
  // produit du 2026-07-17, un entitlement Club actif ouvre l'acces meme sans
  // club verifie. Recopier la condition a la main ici reviendrait a revendre
  // l'offre Club a quelqu'un qui l'a deja payee.
  //
  // ABOPARCLUB (2026-09-29) — le niveau qui compte est celui du club de
  // l'EVENEMENT : un match de FoundClub Demo ouvert depuis AIKI reste couvert
  // par l'offre de Demo (le serveur l'accepte), et un match d'AIKI montre le mur
  // d'avance (le serveur le refusait en 403 apres coup : recette du 28/09).
  // Repli sur le club affiche pour les doublures de `useAuth` d'avant ce lot.
  // FINITIONS3 (29/09) — la garde vit desormais dans `subscriptionDecision.js` :
  // la selection des convoques (portes « Modifier ») la reutilise.
  const canManageComposition = canManageCompositionForClub(
    { getSubscriptionAccessLevelForClub, subscriptionAccessLevel },
    eventClubId,
  );

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
    // ⛔ R6 : c'etait `!hasTeamComposition`, et c'est LA le trou. Un brouillon
    // fermait la porte au lieu de l'ouvrir. Seul le PUBLIE fait taire le
    // bandeau — a ce moment-la, le resume et la liste des convoques, juste en
    // dessous, prennent le relais.
    && !hasPublishedTeamComposition,
  );

  // D4 : `compositionPrimaryAction` decrivait le titre et le sous-titre du gros
  // bouton de composition (« Brouillon enregistre le ... »). Ce bouton est
  // devenu la chip « Convocation » ; le bloc n'avait plus aucun lecteur.

  // 🎯 ST-MATCH (écrans 7 et 8) — « Tout s'ouvre à la fin du match, sam. 5 sept. à 20:00 ».
  const matchEndLabel = useMemo(() => formatMatchEndLabel({ eventEndedAt, t }), [eventEndedAt, t]);

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
  //
  // 🎯 ST-MATCH (écran 8, design validé le 02/10) — la note parle le langage de la carte :
  // « Étape 1 sur 3 : le score », « Feuille publiée le 1 oct. à 22:39 », « S'ouvre à la
  // fin du match, sam. 5 sept. à 20:00 », et au dirigeant qui n'entraîne pas (« score A »)
  // QUI saisit. Retirés : « Commence par enregistrer le score du match. », « Rapport
  // finalise », « Les membres de ton équipe peuvent encore finaliser ce rapport. ».
  // ST-VUES3-ORDI — la porte vit dans `matchPageModel.js` : la puce du menu Gérer du
  // SITE (planche P3-match-ordi, état 4) lit la même.
  const matchStatsPrimaryAction = useMemo(() => resolveMatchStatsDoor({
    canManage: canManageMatchStats,
    coachFirstname: teamCoachFirstname,
    endLabel: matchEndLabel,
    finalizedAt: matchStatsReport?.finalizedAt || null,
    isFinal: isMatchStatsFinal,
    isFinished: isMatchFinished,
    isReviewRequired: isMatchStatsReviewRequired,
    scoreAvailable: Boolean(matchStatsPayload?.score?.available),
    t,
    waitingOfficial: Boolean(matchStatsPayload?.score?.waitingOfficial),
  }), [
    isMatchFinished,
    canManageMatchStats,
    isMatchStatsReviewRequired,
    isMatchStatsFinal,
    matchEndLabel,
    matchStatsPayload?.score?.available,
    matchStatsPayload?.score?.waitingOfficial,
    matchStatsReport?.finalizedAt,
    t,
    teamCoachFirstname,
  ]);
  // 🚩 ST-MATCH (écran 2, design validé le 02/10) — « MARQUÉ ABSENT À L'APPEL ».
  // QUI a pointé et QUAND viennent du serveur (`attendanceRestrictionBy/At`, admin
  // ST-MATCH) ; sans eux (serveur plus ancien), la phrase reste vraie sans les nommer.
  const absenceMarker = myMatchResponsePayload?.attendanceRestrictionBy || null;
  const absenceMarkerName = String(absenceMarker?.firstname || '').trim();
  const absenceMarkedLine = useMemo(() => {
    const markedAt = myMatchResponsePayload?.attendanceRestrictionAt
      ? new Date(myMatchResponsePayload.attendanceRestrictionAt)
      : null;
    if (!markedAt || Number.isNaN(markedAt.getTime())) {
      return absenceMarkerName
        ? t('stMatch.absent.markedBy', '{{name}} t\'a marqué absent à l\'appel.', {
          name: absenceMarkerName, ...SANS_ECHAPPEMENT,
        })
        : t('stMatch.absent.markedByStaff', 'Un encadrant t\'a marqué absent à l\'appel.');
    }
    const day = markedAt.toLocaleDateString(localeDesFormats(), { weekday: 'long' });
    const time = markedAt.toLocaleTimeString(localeDesFormats(), {
      hour: '2-digit', minute: '2-digit',
    });
    return absenceMarkerName
      ? t('stMatch.absent.markedByAt', '{{name}} t\'a marqué absent {{day}} à {{time}}.', {
        day, name: absenceMarkerName, time, ...SANS_ECHAPPEMENT,
      })
      : t('stMatch.absent.markedAt', 'Tu as été marqué absent {{day}} à {{time}}.', {
        day, time, ...SANS_ECHAPPEMENT,
      });
  }, [absenceMarkerName, myMatchResponsePayload?.attendanceRestrictionAt, t]);
  // « Écrire à Karim » (amélioration 2) : la conversation privée avec celui qui a pointé ;
  // une erreur d'appel se règle en un message. Même geste que « Écrire à … » de l'équipe.
  const canWriteToAbsenceMarker = Boolean(
    absenceMarker?.documentId && absenceMarker.documentId !== userData?.documentId,
  );
  const absenceClosedText = t(
    'stMatch.absent.closed',
    'Ton questionnaire de match est fermé tant que ta présence n\'est pas corrigée.',
  );
  const absenceReopensText = absenceMarkerName
    ? t(
      'stMatch.absent.reopens',
      'Si tu étais là, {{name}} corrige l\'appel et ton questionnaire se rouvre tout seul.',
      { name: absenceMarkerName, ...SANS_ECHAPPEMENT },
    )
    : t(
      'stMatch.absent.reopensUnnamed',
      'Si tu étais là, l\'encadrant corrige l\'appel et ton questionnaire se rouvre tout seul.',
    );
  const writeToAbsenceMarkerTitle = t('stMatch.absent.writeTo', 'Écrire à {{name}}', {
    name: absenceMarkerName || t('stMatch.absent.writeToFallback', 'l\'encadrant'),
    ...SANS_ECHAPPEMENT,
  });
  const writeToAbsenceMarker = useCallback(async () => {
    if (!absenceMarker?.documentId) return;
    try {
      const chat = await startWhisperChat([absenceMarker.documentId]);
      if (chat?.documentId) {
        navigation.navigate(RouteNames.Conversation, { chatId: chat.documentId });
      }
    } catch (_error) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('stMatch.absent.writeError', 'Impossible d\'ouvrir la conversation pour le moment.'),
      );
    }
  }, [absenceMarker?.documentId, navigation, startWhisperChat, t]);

  // 🎯 ST-MATCH (écran 5, ABANDONNÉ par le design validé le 02/10) — la fenêtre « Stats de
  // fin de match » qui s'ouvrait toute seule par-dessus la page est RETIRÉE, avec son
  // message, sa clef de session et son effet. Elle recouvrait la carte « Après le match »,
  // qui dit la même chose avec le bon bouton, et revenait à chaque étape. Le rappel hors de
  // la page reste celui de `MatchStatsPromptHost` (écrans 3 et 4) ;
  // `utils/matchStatsPromptSession` reste, LeagueMatchDetails s'en sert.

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
      // 🎁 LOT TERRAIN — LA CATEGORIE DECIDE DU FORMAT AU FOOTBALL (a 5, a 8, a
      // 11). Elle n'est pas toujours peuplee dans la charge de l'evenement :
      // l'ecran « Partir de… » retombe alors sur le NOM de l'equipe, qui porte
      // presque toujours la categorie (« U15 Filles »).
      teamCategory: compositionEditorTeam?.category?.name
        || compositionEditorTeam?.category
        || null,
      teamId: compositionTeamId,
      teamName: compositionEditorTeam?.name || staffCompositionPayload?.team?.name || null,
    });
  }, [
    compositionEditorPlayers,
    compositionEditorTeam?.category,
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

    // ⚽ COMPOLECT (D3 + D5) — LE TERRAIN, EN PLEIN ECRAN, POUR TOUS CEUX QUI
    // LISENT. C'est LA correction du lot, et elle repare deux branches d'un coup :
    //   · le COACH (`canEdit`) n'avait AUCUN terrain — il atterrissait sur
    //     `MatchConvocationPublished`, un ecran de REPONSES qui ne dessine rien.
    //     C'est exactement le constat d'Adel du 26/08 ;
    //   · le non-editeur SANS role tombait sur l'ANCIEN terrain (`TacticalBoardV2`),
    //     ce que le commentaire de `openCompositionBoard` (:4413) annoncait
    //     lui-meme comme « repris par le lot C-F ».
    // ⇒ Une seule destination de lecture, la meme pour les deux.
    //
    // ⛔ LES REPONSES NE SONT PAS PERDUES : le plateau porte le bouton qui mene
    // a `MatchConvocationPublished` (D4). Un ecran qu'aucun bouton n'atteint
    // n'existe pas — le depot a deja paye cette erreur trois fois.
    // ⛔ Et sans placement, `publishedBoardTarget` vaut `null` : les deux
    // branches d'origine ci-dessous reprennent la main, inchangees (D6).
    if (publishedBoardTarget) {
      navigation.navigate(RouteNames.MatchCompositionBoard, {
        ...publishedBoardTarget,
        canEdit: Boolean(canEdit),
        clubId: event?.team?.club?.documentId || null,
        eventId,
        eventLabel: compositionEventLabel,
        eventTypeLabel: event?.type?.name || null,
        // La liste ou « Modifier » ira repecher des convoques : c'est l'effectif
        // eligible, pas les seuls publies.
        players: compositionEditorPlayers,
        readOnly: true,
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
    event?.type?.name,
    eventId,
    getCompositionSourceLabel,
    navigation,
    openCompositionBoard,
    publishedBoardTarget,
    viewerConvocationRole,
  ]);

  // 🚪 COMPOMODIF (M1) — « Modifier », SANS PASSER PAR LE PLEIN ECRAN.
  //
  // 🗣️ Adel, 27/08 : « si c'est le coach qui ouvre, il manque un petit bouton
  // Modifier, a chaque fois, des qu'il peut voir la compo ».
  //
  // ⛔ CE N'EST PAS UNE 2e PORTE D'ECRITURE : c'est EXACTEMENT le geste du
  // bouton « Modifier » du plateau (`MatchCompositionBoard`) — meme route, meme
  // libelle (`matchComposition.board.edit`), memes 3 bascules (`canEdit`,
  // `readOnly: false`, le terrain en point de depart). Ce qui change, c'est
  // qu'on n'oblige plus le coach a ouvrir le plein ecran d'abord.
  //
  // ♻️ ZERO CALCUL NEUF : `publishedBoardTarget` (:4048) porte deja le pack
  // publie, les convoques, le sport et les placements. C'est le MEME objet que
  // l'ouverture en lecture, avec `readOnly` retourne.
  //
  // ⛔ ET IL VAUT `null` SANS PLACEMENT : la porte n'aurait pas de terrain a
  // rouvrir, on garde alors le comportement d'avant (D6).
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
      // La liste ou le coach va repecher un convoque : l'effectif ELIGIBLE, pas
      // les seuls publies.
      players: compositionEditorPlayers,
      readOnly: false,
      teamId: compositionTeamId,
    });
  }, [
    compositionEditorPlayers,
    compositionEventLabel,
    compositionTeamId,
    event?.team?.club?.documentId,
    event?.type?.name,
    eventId,
    navigation,
    publishedBoardTarget,
  ]);

  const handleManageComposition = useCallback(() => {
    if (!eventId || !compositionTeamId) return;

    if (isStaffCompositionFetching) {
      Alert.alert('Patiente', t(
        'eventDetails.weReFetchingTheCurrent',
        "On récupère l'état actuel de la composition.",
      ));
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
    staffCompositionPayload, t,
  ]);

  // 📐 ST-MATCH10-BIS (écran 10 des stats, état 10) — « Ouvrir la convocation » depuis la
  // feuille de match VIDE. La feuille ne sait pas bâtir une convocation : elle revient ici
  // avec `focusSection: 'convocation'`, et la page ouvre SA porte — celle de la puce
  // « Convocation » du menu Gérer, mêmes conditions — dès que la compo du staff est lue
  // (jamais avant : on ouvrirait une compo vide par-dessus un brouillon). Le paramètre est
  // effacé aussitôt : revenir de la convocation ne la rouvre pas. Le verrou tient UNE
  // ouverture par arrivée : l'effacement du paramètre n'est pas immédiat, et un rendu
  // intermédiaire rouvrirait la convocation par-dessus elle-même.
  const convocationOuverteRef = useRef(false);
  useEffect(() => {
    if (highlightedSection !== 'convocation') {
      convocationOuverteRef.current = false;
      return;
    }
    if (convocationOuverteRef.current) return;
    if (!canEdit || !supportsEventComposition) return;
    if (isStaffCompositionFetching || !staffCompositionPayload) return;
    convocationOuverteRef.current = true;
    navigation.setParams?.({ focusSection: undefined });
    handleManageComposition();
  }, [
    canEdit, handleManageComposition, highlightedSection, isStaffCompositionFetching, navigation,
    staffCompositionPayload, supportsEventComposition,
  ]);

  // H8 — la liste des bilans en attente, atteignable depuis la page du match.
  const openPendingMatchStatsList = useCallback(() => {
    navigation.navigate(RouteNames.PendingMatchStats);
  }, [navigation]);

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
  //
  // 🎯 ST-MATCH (écran 9, design validé le 02/10) — des COMPTEURS − / + de 44 px, d'une
  // main, sans clavier ; ils partent de 0, donc « Les deux scores sont obligatoires »
  // disparaît et le bouton DIT le score qu'il enregistre. Après l'envoi, la suite vit
  // DANS la feuille (`matchScoreSheetStep`), plus dans une alerte système qui fermait tout.
  const [isMatchScoreSheetVisible, setIsMatchScoreSheetVisible] = useState(false);
  const [matchScoreDraft, setMatchScoreDraft] = useState({ against: 0, for: 0 });
  const [isMatchScoreSaving, setIsMatchScoreSaving] = useState(false);
  const [matchScoreSheetStep, setMatchScoreSheetStep] = useState('saisie');
  const [hasMatchScoreSaveError, setHasMatchScoreSaveError] = useState(false);

  const isMatchScoreLocked = Boolean(matchStatsPayload?.score?.locked);

  const openMatchScoreSheet = useCallback(() => {
    const asCount = (/** @type {any} */ value) => {
      const count = Number(value);
      return Number.isFinite(count) && count > 0 ? Math.min(99, Math.floor(count)) : 0;
    };

    setMatchScoreDraft({
      against: asCount(matchStatsPayload?.score?.scoreAgainst),
      for: asCount(matchStatsPayload?.score?.scoreFor),
    });
    setMatchScoreSheetStep('saisie');
    setHasMatchScoreSaveError(false);
    setIsMatchScoreSheetVisible(true);
  }, [matchStatsPayload?.score?.scoreAgainst, matchStatsPayload?.score?.scoreFor]);

  const changeMatchScore = useCallback((
    /** @type {'against' | 'for'} */ side,
    /** @type {number} */ step,
  ) => {
    setMatchScoreDraft((draft) => ({
      ...draft,
      [side]: Math.min(99, Math.max(0, draft[side] + step)),
    }));
  }, []);

  // 🎯 ST-MATCH (écran 9, amélioration 1) — les deux équipes NOMMÉES, du côté de QUI marque :
  // `scoreFor` est celui de l'équipe de la feuille (`compositionTeamId`). L'équipe de
  // l'événement : son club (le camp de gauche de l'encart) contre l'adversaire. Une équipe
  // invitée : elle contre le club qui reçoit — aucune inversion possible.
  const matchScoreSides = useMemo(() => {
    const hostClub = String(event?.team?.club?.name || event?.club?.name || '').trim();
    const ourTeam = String(
      compositionEditorTeam?.name || matchStatsPayload?.team?.name || '',
    ).trim();
    const isEventTeam = !compositionTeamId || compositionTeamId === event?.team?.documentId;
    const forName = (isEventTeam ? hostClub || ourTeam : ourTeam)
      || t('stMatch.score.us', 'Mon équipe');
    const againstName = isEventTeam
      ? matchOpponentName
      : hostClub || String(event?.team?.name || '').trim();
    return { againstName: againstName || '', forName };
  }, [
    compositionEditorTeam?.name,
    compositionTeamId,
    event?.club?.name,
    event?.team?.club?.name,
    event?.team?.documentId,
    event?.team?.name,
    matchOpponentName,
    matchStatsPayload?.team?.name,
    t,
  ]);

  // « Sam. 5 sept. · fin à 20:00 ».
  const matchScoreWhen = useMemo(() => {
    if (!eventEndedAt || Number.isNaN(eventEndedAt.getTime())) return '';
    const day = eventEndedAt.toLocaleDateString(localeDesFormats(), {
      day: 'numeric', month: 'short', weekday: 'short',
    });
    return t('stMatch.score.when', '{{day}} · fin à {{time}}', {
      day: day.charAt(0).toUpperCase() + day.slice(1),
      time: eventEndedAt.toLocaleTimeString(localeDesFormats(), {
        hour: '2-digit', minute: '2-digit',
      }),
      ...SANS_ECHAPPEMENT,
    });
  }, [eventEndedAt, t]);

  // 🆚 ST-MATCH (écran 1, amélioration 2) — « Voir les stats du match » DESCEND au
  // bloc, depuis l'endroit qu'on regarde. Le bloc ne vit que dans l'Aperçu : on y
  // revient d'abord, puis on mesure l'ancre au tour suivant (elle n'existe qu'une fois
  // l'onglet rendu). ⛔ Jest ne sait pas mesurer : le défilement se voit à la recette.
  const scrollToMatchStats = useCallback(() => {
    setDetailsTab('overview');
    requestAnimationFrame(() => scrollToAnchor(matchStatsAnchorRef));
  }, [scrollToAnchor]);

  // 🎯 ST-MATCH (écran 7, amélioration 3) — l'étape 3 NOMME qui manque. La feuille de
  // l'encadrement porte la liste (le joueur n'en reçoit que le compte : SECU-STATS).
  const matchMissingResponders = useMemo(
    () => listMissingResponders(matchStatsPayload?.playerResponses),
    [matchStatsPayload?.playerResponses],
  );
  // 🔔 FINITIONS11 · point 4 — « Relancer les N » : ceux que le serveur relancera (convoqués,
  // avec un compte), pas la liste des prénoms coupée à 5.
  const matchPlayersToRemind = useMemo(
    () => countPlayersToRemind(matchStatsPayload?.playerResponses),
    [matchStatsPayload?.playerResponses],
  );
  // 📋 FINITIONS11 · point 6 bis (« listes ok ») — « Convoqués : … » et « Aussi présents, sans
  // convocation : … », lus dans la charge de la feuille (aucune lecture neuve).
  const matchHasConvocation = hasPublishedConvocation(matchStatsPayload?.playerResponses);
  const matchPresentWithoutConvocation = useMemo(
    () => listPresentWithoutConvocation(
      matchStatsPayload?.playerResponses,
      matchStatsPayload?.report?.playerLines,
    ),
    [matchStatsPayload?.playerResponses, matchStatsPayload?.report?.playerLines],
  );

  // 🎯 ST-MATCH (écran 7) — « Relancer », depuis la carte : la route existe (remind-responses,
  // celle de l'éditeur) ; le serveur ne relance que les convoqués (« c oui », 02/10).
  // ⚠️ Par `useEventMutations` et non par un import de service : chaque service importé ici
  // doit être doublé dans chacun des témoins de l'écran (piège AD01).
  const remindResponsesMutation = mutations.remindMatchResponsesMutation;
  const isRemindingResponders = Boolean(remindResponsesMutation?.isPending);
  // STATS-FIX2 · 8-7 (T10, ecran 7) — apres la relance, le bouton restait « Relancer les 2 » :
  // rien ne disait que c etait fait. La relance faite (ou deja faite ce jour) est retenue pour
  // CE match et CETTE equipe ; la carte le dit (« Déjà relancés aujourd’hui »).
  const [relanceDuJourCle, setRelanceDuJourCle] = useState(/** @type {string | null} */ (null));
  const relanceCle = `${eventId || ''}:${compositionTeamId || ''}`;
  const remindMissingResponders = useMemo(() => {
    if (!remindResponsesMutation || !eventId || !compositionTeamId) return null;
    return async () => {
      try {
        const resultat = await remindResponsesMutation.mutateAsync({ eventId, teamId: compositionTeamId });
        const relances = Number(resultat?.remindedCount || 0);
        const dejaRelances = Number(resultat?.alreadyRemindedCount || 0);
        if (relances > 0 || dejaRelances > 0) setRelanceDuJourCle(relanceCle);
        // 🔁 ST-VUES2 (02/10) — la relance est idempotente PAR JOUR côté serveur : au 2e appui le
        // même jour, personne n'est relancé et le serveur le dit (`alreadyRemindedCount`). Dire
        // « aucune relance nécessaire » serait faux : il en manque toujours.
        if (relances === 0 && dejaRelances > 0) {
          Alert.alert(t('stMatch.relance.alreadyToday', 'Déjà relancés aujourd’hui'));
          return;
        }
        Alert.alert(
          t('stMatch.carte.remindedTitle', 'Relance envoyée'),
          relances > 0
            ? t('stMatch.carte.reminded', {
              count: relances,
              defaultValue_one: '{{count}} joueur relancé.',
              defaultValue_other: '{{count}} joueurs relancés.',
            })
            : t('matchStatsEditor.noReminderNeeded', 'Aucune relance nécessaire pour ce match.'),
        );
      } catch (_error) {
        Alert.alert(
          t('common.error', 'Erreur'),
          t('stMatch.carte.remindError', 'La relance n’a pas pu partir. Réessaie.'),
        );
      }
    };
  }, [compositionTeamId, eventId, relanceCle, remindResponsesMutation, t]);

  // 🎯 ST-MATCH (écran 7, état 4) — le dirigeant trouve les résultats dans la fiche de
  // l'équipe, onglet Stats (même entrée que l'ancienne adresse de TeamStats, ST-VUES).
  const resultsTeamId = compositionTeamId || event?.team?.documentId || null;
  const openTeamResults = useMemo(() => (resultsTeamId ? () => navigation.navigate(
    RouteNames.TeamStack,
    { params: { initialTab: 'stats', teamId: resultsTeamId }, screen: RouteNames.TeamDetails },
  ) : null), [navigation, resultsTeamId]);

  // 🆚 ST-MATCH (écran 1) — ce que l'encart PERMET, posé ici parce que ses deux gestes
  // sont déclarés plus bas que lui. « Saisir le score » (amélioration 4, état 2) suit
  // le SEUL juge de l'aiguillage, `matchStatsPrimaryAction.isScoreEntry` : le droit
  // (`canManage`), la fin du match et l'absence de score officiel attendu y vivent.
  // « Voir les stats du match » n'existe que pour qui lit le bloc, une fois le score là.
  const matchEncartSummary = useMemo(() => {
    if (!matchHeaderScoreSummary) return null;
    return {
      ...matchHeaderScoreSummary,
      onEnterScore: matchStatsPrimaryAction.isScoreEntry && !matchStatsPrimaryAction.disabled
        ? openMatchScoreSheet
        : null,
      onSeeStats: matchHeaderScoreSummary.isScoreShown && canViewMatchStats && compositionTeamId
        ? scrollToMatchStats
        : null,
    };
  }, [
    canViewMatchStats,
    compositionTeamId,
    matchHeaderScoreSummary,
    matchStatsPrimaryAction.disabled,
    matchStatsPrimaryAction.isScoreEntry,
    openMatchScoreSheet,
    scrollToMatchStats,
  ]);

  const handleSaveMatchScore = useCallback(async () => {
    if (!eventId || !compositionTeamId) return;
    if (isMatchScoreLocked || isMatchScoreSaving) return;

    setIsMatchScoreSaving(true);
    setHasMatchScoreSaveError(false);
    try {
      await mutations.saveMatchResultMutation.mutateAsync({
        eventId,
        scoreAgainst: matchScoreDraft.against,
        scoreFor: matchScoreDraft.for,
        teamId: compositionTeamId,
      });
      // 🎯 ST-MATCH (écran 9, état 5) — la suite DANS la feuille. Le meme
      // rafraichissement que le reste de la page : sans lui, l'entete continuerait
      // d'afficher « Score en attente ».
      setMatchScoreSheetStep('enregistre');
      refetchMatchStats();
    } catch (scoreError) {
      // État 6 — le score saisi RESTE en place ; la feuille dit quoi faire.
      setHasMatchScoreSaveError(true);
    } finally {
      setIsMatchScoreSaving(false);
    }
  }, [
    compositionTeamId,
    eventId,
    isMatchScoreLocked,
    isMatchScoreSaving,
    matchScoreDraft,
    mutations.saveMatchResultMutation,
    refetchMatchStats,
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
      title: t('eventDetails.myPostMatchFeedback', 'Mon retour post-match'),
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
    navigation, t,
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

  const handleCoachEditLate = useCallback((/** @type {User | null | undefined} */ targetUser) => {
    openCoachLateModal(targetUser, 'coach_edit');
  }, [openCoachLateModal]);

  // 🚪 ST-MONMATCH (écran 2, état 3) — « Présent » sur la ligne d'un absent à l'appel : la
  // correction SANS fenêtre du serveur (`patchLate`, retard 0 ⇒ arrivé à l'heure, au coup
  // d'envoi). L'absence signée n'existe plus : sur un match fini, le serveur rouvre son
  // questionnaire tout seul (`findSignedAbsenceForUser`).
  const handleCoachMarkPresent = useCallback((/** @type {User | undefined} */ targetUser) => {
    if (!eventId || !targetUser?.documentId) return;
    /** @type {any} */ (mutations.updateLateMinutesMutation).mutate({
      eventId,
      payload: { lateMinutes: 0, note: null },
      userId: targetUser.documentId,
    });
  }, [eventId, mutations.updateLateMinutesMutation]);

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
      Alert.alert(t('common.error'), t(
        'eventDetails.unableToRecordYourArrival',
        "Impossible d'enregistrer ton arrivée (événement introuvable).",
      ));
      return;
    }
    if (hasSelfArrived) {
      Alert.alert(t('common.success'), t(
        'eventDetails.arrivalAlreadyRecorded',
        'Arrivée déjà enregistrée.',
      ));
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
        label: isMatchStatsFetching ? t('common.loading', 'Chargement...') : t(
          'eventDetails.matchStats',
          'Stats du match',
        ),
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
          ? t(
            'eventDetails.managePanel.campaignAlreadyLinked',
            'Cet événement a déjà une cotisation',
          )
          : null,
        onPress: openEventLicenseCampaignSettings,
      });
    }

    // 🏋️ N7 item 4 (vague P, 23/08) — LA BASCULE D'OUVERTURE DE L'ENTRAINEMENT
    // DEMENAGE DANS CE MENU. La carte « Entraînement ouvert / privé » de
    // l'Apercu portait trois choses : un ETAT, la ligne de quota, et le BOUTON
    // de bascule. Le bouton est une action d'organisation — il n'y a qu'un
    // endroit pour ca, et c'est ici (meme motif que « Stats du match », D71).
    // La ligne de quota, reprise TELLE QUELLE, devient la note de la rangee.
    // ⛔ L'ETAT (ouvert / prive, a qui c'est ouvert) n'est PAS reconstruit ici :
    //    c'est la carte d'ouverture enrichie du lot P8, qui vient apres.
    // ✅ Ce que tout le monde voit (« Accueille N joueur·se·s de l'extérieur »,
    //    `openTrainingPublicLine`) n'a pas bouge : il ne dependait pas de la carte.
    // Gate et gestes REPRIS TELS QUELS de la carte : `canManageTrainingVisibility`,
    // `handleCloseTraining` / `setIsTrainingOpenModalVisible`.
    if (canManageTrainingVisibility) {
      const validationLabel = trainingOpenConfig.externalParticipantValidationMode === 'auto'
        ? 'automatique'
        : 'manuelle';
      let quotaNote = null;
      if (trainingOpenConfig.externalParticipantLimit !== null) {
        const quotaLine = `${trainingOpenConfig.externalParticipantLimit} place(s) externes`
          + ` - validation ${validationLabel}`;
        quotaNote = trainingOpenConfig.isOpenTraining
          ? quotaLine
          : t(
            'eventDetails.lastSavedSetting',
            'Dernier reglage mémorise: {{quotaLine}}',
            { quotaLine, ...SANS_ECHAPPEMENT },
          );
      }
      chips.push({
        disabled: mutations.updateEventNoNavMutation.isPending,
        icon: 'whistle',
        key: 'trainingVisibility',
        label: trainingOpenConfig.isOpenTraining
          ? t('eventDetails.managePanel.closeTraining', 'Fermer l\'entraînement')
          : t('eventDetails.managePanel.openTraining', 'Ouvrir l\'entraînement'),
        note: quotaNote,
        onPress: trainingOpenConfig.isOpenTraining
          ? handleCloseTraining
          : () => setIsTrainingOpenModalVisible(true),
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
  // 🎯 ST-MATCH (écran 7) — le bloc « Stats du match » : l'équipe qui lit la feuille, et le
  // dirigeant (« score A ») une fois le match fini, à qui il dit qui saisit.
  const showMatchStatsBlock = showOverviewTab && isMatchEvent && Boolean(
    (compositionTeamId && canViewMatchStats) || (canEdit && isMatchFinished),
  );

  // D3 — QUI VOIT LA PORTE. La grille d acces (`eventAttendanceGate`) inclut
  // `canEdit` depuis L5-0 (vague P, 23/08) : un dirigeant organisateur hors
  // de l equipe voit la porte, et la policy serveur de LECTURE est alignee
  // sur celle d ecriture (can-access-attendance, meme audience que
  // is-event-trainer). Le trou « 403 sur une piece promise » est ferme.
  // Un tournoi, lui, n a pas d appel du tout.
  const showNextActionCard = showOverviewTab
    && canEdit
    && canAccessAttendance
    && !isTournamentEvent
    // POINTAGE (29/09) — « Suivre les arrivees » decochee : pas d appel.
    && arrivalTrackingEnabled;

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
                    {`${t('eventDetails.stage.day', 'Jour')} ${index + 1} · ${dayDate.toLocaleDateString(localeDesFormats(), {
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
  // l'entoure. La repartition en largeurs egales est celle de la maquette.
  // ⚠️ Le composant ne pose AUCUNE marge externe : c'est l'appelant qui les
  // pose (motif CMMembersScreen.js:297). Ici, le `gap: 24` du conteneur suffit.
  //
  // 📏 R6 puis S5 — DEUX RECETTES, DEUX REPONSES A LA MEME EXIGENCE.
  //
  // Le probleme de fond n'a pas change : les libelles ne sont PAS courts, ils
  // portent leur effectif (planche 04, `withTabCount`). Un tiers de 360 pt vaut
  // ~110 pt, et « Participants · 12 » n'y tient pas.
  //
  // R6 (24/08) a repondu par `fullLabels` : DEUX lignes, jamais tronque.
  // 🧨 S5 (25/08) — Adel l'a regarde : en deux lignes, la coupure tombe sur la
  // DERNIERE lettre. Un « s » seul sous « Participant », un « n » seul sous
  // « Convocatio ». Ce n'est pas plus lisible qu'une troncature, ca ressemble a
  // un bug d'affichage — et ca double la hauteur du bandeau pour ca.
  //
  // ⇒ `fitLabels` : UNE ligne, et le texte RETRECIT jusqu'a 72 % pour tenir.
  // ⛔ On ne corrige PAS `fullLabels` en place : sa semantique deux-lignes est
  // celle dont `FacilityForm` depend, et la hauteur y est reservee pour deux
  // lignes (FacilityForm.js). Les deux besoins sont reels et opposes.
  // ⛔ Et on ne raccourcit toujours PAS les libelles : le compteur est exige.
  const renderDetailsTabs = () => {
    if (!detailsTabs.length) return null;

    return (
      <View style={[Alignments.alignCenter]} testID="event-details-tabs">
        <SegmentedControl
          centerContent
          fitLabels
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

    // 🚪 R6 (vague R) — TROIS ETATS, TROIS PHRASES, ZERO CUL-DE-SAC.
    //   · rien de commence   → « Ce match n'a pas encore de convocation »
    //   · brouillon en cours → « Ta convocation est commencée », et on la reprend
    //   · pas l'offre        → la vitrine, inchangee
    // Le PUBLIE n'est pas dans cette liste : il ETEINT le bandeau
    // (`isCompoReminderVisible`) et laisse la place au resume et a la liste des
    // convoques, juste en dessous dans le meme onglet.
    //
    // ♻️ ZERO HANDLER NEUF, et c'est le point : `handleManageComposition` rouvre
    // DEJA le brouillon quand il y en a un (`staffCompositionPayload.draft`).
    // La porte existait — il manquait les MOTS qui disent qu'elle est la.
    let compoReminderTitle = t(
      'eventDetails.compoReminder.title',
      'Ce match n’a pas encore de convocation',
    );
    let compoReminderAction = t('eventDetails.compoReminder.action', 'Préparer la convocation');

    if (!canManageComposition) {
      compoReminderTitle = t(
        'eventDetails.compoReminder.offerTitle',
        'La convocation est incluse dans l’offre Équipe',
      );
      compoReminderAction = t('eventDetails.compoReminder.offerAction', 'Voir l’offre Équipe');
    } else if (hasDraftOnlyComposition) {
      // 🗣️ S5 (vague S) — LES MOTS D ADEL, MOT POUR MOT. Deux corrections dans
      // la meme phrase : le PLURIEL (un coach prepare une convocation par equipe
      // conviee, pas une seule), et « brouillon » qui disparait — c est un mot
      // d outil, pas un mot de terrain. « Continuer » dit ce qui se passe au
      // doigt. Seules les VALEURS changent : les clefs et la condition sont
      // celles de R6.
      compoReminderTitle = t(
        'eventDetails.compoReminder.draftTitle',
        'Tes convocations sont commencées',
      );
      compoReminderAction = t(
        'eventDetails.compoReminder.draftAction',
        'Continuer mes convocations',
      );
    }

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
          {compoReminderTitle}
        </Text>
        {/* 🔘 S5 (vague S) — UN VRAI BOUTON, PAS UN LIEN.
            Ce qu il y avait : un pressable nu portant du texte primary500. A
            l ecran il se lisait comme une note de bas de bloc, alors que c est
            LA porte principale de l onglet « Convocation ».
            ♻️ Meme handler, meme condition : seul l habillage change. Le
            composant partage porte deja la cible tactile et le contraste
            (encre primary900 sur primary500, THEME.md) — les redecrire ici
            aurait fait un seizieme bouton maison a corriger un jour. */}
        <Button
          onPress={canManageComposition ? handleManageComposition : handleOpenSubscriptionOverview}
          title={compoReminderAction}
          variant="Primary"
        />
      </View>
    );
  };

  /**
   * 🧾 S5 (vague S) — LES CONVOQUES DU BROUILLON, sous le bandeau.
   *
   * ⛔ Le bloc entier disparait quand personne n est coche. Le bandeau, lui,
   * parle toujours (« ABSENT n est pas VIDE ») : un brouillon vide reste un
   * brouillon. Mais un titre « Convoqués » suivi de rien se lit comme un bug.
   * @returns {any} La liste des coches, ou null quand il n y en a aucun.
   */
  const renderDraftRoster = () => {
    // 🚪 MEME PORTE QUE LE BANDEAU, pas une porte de plus. `isCompoReminderVisible`
    // porte deja `canEdit` : la liste accompagne le bandeau, elle apparait et
    // disparait avec lui.
    //
    // 🧨 POURQUOI CE N EST PAS SUPERFLU, alors que la charge « n arrive que sous
    // canEdit » : mesure du 25/08 — la requete est aussi gardee par
    // `areDeferredQueriesEnabled`, qui vaut FAUX au montage. Un temoin qui lirait
    // `enabled` serait donc vert pour TOUT LE MONDE, y compris si `canEdit`
    // disparaissait de la condition. La protection ne serait plus mesuree par
    // rien. Ici elle l est, et le temoin la prouve avec la charge en main.
    if (!isCompoReminderVisible || !draftConvocationRoster.length) return null;

    return (
      <View style={[Spaces.gap[4]]}>
        <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
          {t('eventDetails.convocation.called', 'Convoqués')}
        </Text>
        {draftConvocationRoster.map((/** @type {any} */ player) => (
          <Text
            key={`brouillon-${getConvocationPersonId(player)}`}
            style={[Fonts.p3, Fonts.neutral300]}
          >
            {getPersonName(player)}
          </Text>
        ))}
      </View>
    );
  };

  /**
   * 🧾 R6 (vague R) — LA LISTE DES CONVOQUES, DANS L'ONGLET « CONVOCATION ».
   *
   * ⛔ LE TITRE D'UNE SECTION NE PARAIT QUE SI ELLE A QUELQU'UN DEDANS. Un
   * « Sur le banc » suivi de rien se lit comme un bug, pas comme une absence —
   * et un pack sans remplacant est le cas NORMAL, pas l'exception.
   * ⛔ Un identifiant sans personne connue n'ecrit pas de ligne vide : les deux
   * assembleurs le filtrent deja a la source.
   * @returns {any} Une liste par branche publiee, ou null quand il n'y en a pas.
   */
  const renderPublishedRoster = () => {
    if (!publishedConvocationRoster.length) return null;

    return publishedConvocationRoster.map((branch) => (
      <View key={branch.key} style={[Spaces.gap[4]]}>
        {/* Le nom de l'equipe n'apparait qu'a partir de DEUX branches : sur un
            match il n'y en a qu'une, et la coiffer de son propre nom, deja
            ecrit trois lignes plus haut, n'apprend rien a personne. */}
        {publishedConvocationRoster.length > 1 && branch.teamName ? (
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{branch.teamName}</Text>
        ) : null}

        {/* ⚽ S5-D (vague S) — LE TERRAIN, SANS APPUYER SUR RIEN.
            🗣️ Adel, 26/08 : « une fois la composition publiee, ca doit afficher
            LE TERRAIN avec les joueurs places directement dans l onglet, sans
            devoir cliquer le bouton du bas ».
            L onglet DECRIVAIT la compo (des compteurs, puis les noms depuis R6)
            et laissait le DESSIN derriere un appui — or c est le dessin qui
            repond a la question d un coach : qui joue ou.
            ⛔ Il ne parait QUE s il y a des titulaires : une convocation publiee
            sans placement (S5-c) garde sa liste « Convoqués », et un terrain
            vide y ferait croire a une compo perdue.
            ⛔ Et le CTA reste dessous : ce terrain est un APERCU en lecture
            seule, la modification vit sur l ecran complet. */}
        {branch.starters.length ? (
          <ConvocationFieldPreview
            /* 🪑 COMPOLECT-2 — LE BANC DESCEND AVEC LE TERRAIN (capture d'Adel
               du 27/08 : « on ne voit pas le banc »). `branch.bench` est deja
               assemble par `buildConvocationReserveList` juste au-dessus : on
               lui passe les personnes, aucun calcul neuf. */
            benchPlayers={branch.bench.map((/** @type {any} */ entry) => entry.player)}
            placements={branch.placements}
            snapshotPlayers={branch.snapshotPlayers}
            sportContext={branch.sportContext}
          />
        ) : null}

        {branch.starters.length ? (
          <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
            {t('eventDetails.convocation.starters', 'Sur le terrain')}
          </Text>
        ) : null}
        {branch.starters.map((token) => (
          <Text
            key={`${branch.key}-terrain-${token?.placement?.playerId}`}
            style={[Fonts.p3, Fonts.neutral300]}
          >
            {getPersonName(token.player)}
          </Text>
        ))}

        {/* 🧾 S5 (vague S) — « SUR LE BANC » N A DE SENS QUE S IL Y A UN TERRAIN.
            📏 Mesure serveur (`event-composition.ts:428`) :
            `reservePlayerIds = selectedPlayerIds.filter(non places)`. Une
            convocation publiee SANS aucun placement — le chemin que S5 (c)
            legitime — met donc TOUT LE MONDE dans cette liste. L ecran
            annoncait « Sur le banc » a des gens qui n ont pas de terrain du
            tout : factuellement faux, et vexant pour un titulaire.
            ⇒ Sans titulaire, ce sont simplement des « Convoqués ». */}
        {branch.bench.length ? (
          <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
            {branch.starters.length
              ? t('eventDetails.convocation.bench', 'Sur le banc')
              : t('eventDetails.convocation.called', 'Convoqués')}
          </Text>
        ) : null}
        {branch.bench.map((entry) => (
          <Text key={`${branch.key}-banc-${entry.id}`} style={[Fonts.p3, Fonts.neutral300]}>
            {getPersonName(entry.player)}
          </Text>
        ))}

        {/* COACH1 (decision d Adel du 21/09) — L ENCADREMENT, a part : les
            entraineurs qui ont repondu Present au match. Ni terrain, ni banc,
            et pas de titre sans personne dessous. */}
        {branch.staff.length ? (
          <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
            {t('eventDetails.convocation.staff', 'Staff')}
          </Text>
        ) : null}
        {branch.staff.map((entry) => (
          <Text key={`${branch.key}-encadrement-${entry.id}`} style={[Fonts.p3, Fonts.neutral300]}>
            {getPersonName(entry.person)}
          </Text>
        ))}
      </View>
    ));
  };

  // 🏋️ P8 — LA CARTE D'OUVERTURE, CELLE QUI COMPTE ENFIN.
  //
  // 🧨 LE DEFAUT MESURE (pack « detail evenement », fiche 2) : la carte d'avant
  // melangeait un ETAT et une ACTION, et ne comptait RIEN. Pour savoir s'il
  // restait de la place, ou combien de personnes attendaient sa reponse, un
  // organisateur devait ouvrir la liste des participants et compter a la main.
  //
  // Ce que la carte dit maintenant, et d'ou ca vient — ZERO requete neuve :
  //   · l'etat              ← `trainingOpenConfig` (deja calcule pour le menu ⋯)
  //   · les places restantes ← quota - externes deja acceptes
  //   · qui valide          ← `externalParticipantValidationMode`
  //   · les demandes        ← `externalParticipationSection.pending`
  //
  // 🪤 « Ouvert » porte DEUX sens dans l'app : public/prive d'un cote, ouvert
  // aux joueurs de l'exterieur de l'autre. Le pack demande de les demeler. Le
  // titre garde le mot que les dirigeants connaissent deja (Annexe B du pack) ;
  // la ligne juste en dessous dit A QUI c'est ouvert, et c'est elle qui tranche.
  //
  // ⛔ AUCUN BOUTON MUET (regle 5 du pack) : sans participant externe et sans
  //    demande, la file n'existe pas — le bouton non plus.
  // 🔁 S11-bis (GO Adel du 2026-08-25) — CETTE REGLE DE N7 A ETE REVUE, ET PAR
  //    LUI : « il manque sur la page detail de l'evenement entrainement un
  //    bouton pour ouvrir l'entrainement au public ». La carte porte donc
  //    desormais UN raccourci, et un seul : ouvrir, quand c'est ferme.
  //    · FERMER reste dans le menu ⋯ (N7 item 4) — on n'y touche pas ;
  //    · le raccourci ne DUPLIQUE rien : il ouvre la MEME feuille que la rangee
  //      du menu, laquelle demande deja les places et enregistre ;
  //    · il ne touche pas a la validation : depuis S11 les demandes
  //      exterieures sont validees a la main, toujours, et le serveur le force.
  const renderTrainingOpeningCard = () => {
    const quota = Number(trainingOpenConfig.externalParticipantLimit || 0);
    const taken = externalParticipationSection?.participating?.length || 0;
    // 🪤 LE COMPTEUR SE TAIT POUR QUI NE PEUT PAS VALIDER, et ce n'est pas de la
    // prudence : c'est la MEME condition que la liste des participants, qui ne
    // rend les demandes que sous `canApprovePendingRequests` (EventParticipants
    // :686). Or « organiser » et « valider » ne sont pas le meme droit ici —
    // `canManageEvent` s'ouvre a qui gere le CLUB, `canEditEvent` demande
    // d'entrainer CETTE equipe (useAuth:591-624). Un dirigeant de club qui
    // n'entraine pas l'equipe a donc `canEdit` sans `canApprovePendingRequests` :
    // sans cette ligne, la carte lui annoncerait des demandes et son bouton le
    // ferait descendre vers une liste qui ne les montre pas.
    const pending = canApprovePendingRequests
      ? (externalParticipationSection?.pending?.length || 0)
      : 0;
    // ⛔ Un entrainement ferme, ou ouvert sans quota, ne promet aucune place :
    // « 0 place restante sur 0 » serait pire que le silence (motif N1).
    const showSeats = Boolean(trainingOpenConfig.isOpenTraining && quota > 0);

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
        testID="p8-carte-ouverture-entrainement"
      >
        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {trainingOpenConfig.isOpenTraining
              ? t('eventDetails.openTraining.cardOpenTitle', 'Entraînement ouvert')
              : t('eventDetails.openTraining.cardClosedTitle', 'Entraînement privé')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {trainingOpenConfig.isOpenTraining
              ? t(
                'eventDetails.openTraining.cardOpenMeaning',
                'Ouvert aux joueur·se·s de l’extérieur, en plus de ton équipe.',
              )
              : t(
                'eventDetails.openTraining.cardClosedMeaning',
                'Réservé à ton équipe : personne de l’extérieur ne peut s’inscrire.',
              )}
          </Text>
        </View>

        {showSeats ? (
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t(
              'eventDetails.openTraining.seatsLeft',
              '{{left}} place(s) externe(s) restante(s) sur {{quota}}',
              { left: Math.max(0, quota - taken), quota },
            )}
          </Text>
        ) : null}

        {/* S11 — UNE SEULE PHRASE POSSIBLE DESORMAIS. La branche « validation
            automatique » etait devenue INATTEIGNABLE : `resolveTrainingOpenConfig`
            rend toujours 'manual' pour un entrainement ouvert, et le serveur le
            force de son cote. Afficher un `if` dont une moitie ne peut plus
            arriver, c'est laisser croire qu'elle le peut encore.
            🔑 La clef `eventDetails.openTraining.validationAuto` reste dans
            fr.js : aucune clef ne se supprime (controle des ENSEMBLES). */}
        {showSeats ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'eventDetails.openTraining.validationManual',
              'Validation manuelle : c’est toi qui acceptes chaque demande.',
            )}
          </Text>
        ) : null}

        {pending > 0 ? (
          <Text style={[Fonts.p2Bold, Fonts.primary100]}>
            {t(
              'eventDetails.openTraining.pendingSuffix',
              '{{pending}} demande(s) à vérifier',
              { pending },
            )}
          </Text>
        ) : null}

        {externalParticipationSection ? (
          <Button
            onPress={scrollToParticipants}
            title={pending > 0
              ? t('eventDetails.openTraining.goToPending', 'Voir les demandes')
              : t('eventDetails.openTraining.goToExternals', 'Voir les participants externes')}
            variant="SecondaryLight"
          />
        ) : null}

        {/* S11-bis — LE RACCOURCI D'ADEL. Il ne parait que sur un entrainement
            FERME : ouvrir ce qui est deja ouvert ne menerait nulle part (regle
            5 du pack, « aucun bouton muet »).
            🔒 Pas de garde de droit ici, et c'est voulu : la carte entiere est
            deja rendue sous `canManageTrainingVisibility` (voir son point de
            montage). En rajouter une seconde ferait croire qu'elle protege
            quelque chose de plus. Un temoin le prouve cote lecteur. */}
        {!trainingOpenConfig.isOpenTraining ? (
          <Button
            onPress={() => setIsTrainingOpenModalVisible(true)}
            title={t('eventDetails.openTraining.openCta', 'Ouvrir l’entraînement au public')}
            variant="Primary"
          />
        ) : null}
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
    // N7 item 4 : repli quand aucun quota n'est memorise (la note porte sinon le quota).
    trainingVisibility: t(
      'eventDetails.menu.trainingVisibility',
      'Accueillir des joueur·se·s de l’extérieur',
    ),
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
        {/* 🚪 EVEDIT-2 (D2) — LE POINT DE SORTIE COMMUN DES SIX ACTIONS.
            La rangee n execute plus au toucher : elle ARME l action et
            demande la fermeture de la feuille. C est ici, et nulle part
            ailleurs, que le defaut se corrige — six rustines auraient
            laisse la prochaine action ajoutee cassee des sa naissance. */}
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.82}
          disabled={chip.disabled}
          onPress={() => armSheetAction('manage', chip.onPress, closeManageSheet)}
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
              <Text
                style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}
                testID={`event-manage-note-${chip.key}`}
              >
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
  // ⚠️ S2 — POURQUOI LE TITRE VIT DANS LE CONTENU, ET NON EN `headerComponent`.
  //
  // En dimensionnement dynamique (`BottomModal.js:307`,
  // `enableDynamicSizing={!snapPoints}`), la bibliotheque taille la feuille sur
  // la hauteur du CONTENU DEFILANT SEUL. Un `headerComponent` fixe n entre
  // JAMAIS dans cette mesure : la feuille etait donc trop courte de la hauteur
  // du titre (~64 pt, reconnaissance du 25/08), et ce sont les DERNIERES
  // rangees qui sortaient du cadre — « Annuler l'evenement » en tete.
  //
  // 🧨 ET ELLES N ETAIENT PAS RATTRAPABLES AU DOIGT : du point de vue de la zone
  // defilante, rien ne deborde — sa fenetre vaut exactement son contenu, donc
  // aucune course de defilement. C est ce qui rendait le defaut si etrange a
  // decrire : « coupe en bas » ET « ne defile pas », en meme temps.
  //
  // ⛔ LE COMMENTAIRE QUI VIVAIT ICI AFFIRMAIT L INVERSE (« en-tete sans pied :
  // le dimensionnement dynamique suffit ») et renvoyait a une ligne qui a bouge
  // depuis. La regle vraie, et elle est simple : en dimensionnement dynamique,
  // AUCUN element porteur de hauteur ne doit vivre hors du contenu.
  //
  // ⛔ `snapPoints` reste ABSENT a dessein : il reglerait la hauteur, mais
  // figerait aussi la feuille a 90 % de l'ecran quand il n y a que deux actions
  // a montrer. Et le corriger ici ne touche PAS `BottomModal`, donc aucun de ses
  // 69 autres appelants ne bouge.
  const renderManageSheet = () => {
    if (!hasManageActions) return null;

    // S2-bis — LE PLAFOND SE MESURE SUR LA HAUTEUR UTILISABLE, PAS SUR LA DALLE.
    //
    // Retour de recette du 25/08 : la feuille s affiche entiere SAUF « Annuler »,
    // coupee au ras du bord bas, la barre de gestes par-dessus.
    //
    // ⛔ Ce n est PAS une marge basse qui manque : `BottomModal` pose deja
    // `paddingBottom = 40 + insets.bottom` sur son contenu defilant.
    // ⚠️ FEUILLES-BAS (16/09) : c etait FAUX sur telephone jusqu a ce lot — la
    // bibliotheque jetait cette marge (BottomModal.margeBasse.test.js). C est encore
    // une mesure fausse — son plafond se calcule sur `Dimensions.get('screen')`,
    // la DALLE ENTIERE, barre d etat et barre de gestes comprises. A 90 % de la
    // dalle, la zone defilante peut donc etre PLUS HAUTE que la fenetre
    // affichable : son bas sort de l ecran, et rien ne defile puisque, de son
    // point de vue, elle ne deborde pas.
    //
    // ✅ On lui demande donc la fraction de DALLE qui vaut 90 % de FENETRE.
    // Sur un ecran ou les deux se valent, `Math.min` garde 90 % : non-evenement.
    // ⛔ Rien a changer dans `BottomModal` : ses 69 autres appelants ne bougent
    // pas, et aucun d eux ne passe cette prop.
    const hauteurDalle = Dimensions.get('screen').height;
    const hauteurFenetre = Dimensions.get('window').height;
    const plafondUtile = hauteurDalle > 0
      ? Math.min(0.9, (hauteurFenetre / hauteurDalle) * 0.9)
      : 0.9;

    return (
      <BottomModal
        close={closeManageSheet}
        isVisible={isEventActionsSheetOpen}
        maxContentHeightRatio={plafondUtile}
        onDismissed={runManageSheetExit}
      >
        {/* Le titre est le PREMIER enfant du contenu : c est ce qui le fait
            entrer dans la mesure de la feuille. Les marges rendent l espacement
            que le bandeau fixe donnait avant (12 de la feuille + 12 = 24 en
            haut, 16 avant les rangees) — a l oeil, rien ne bouge. */}
        <Text
          style={[Fonts.h5Bold, Fonts.neutral00, Spaces.marginTop[12], Spaces.marginBottom[16]]}
          testID="event-manage-title"
        >
          {t('eventDetails.managePanel.title', "Gérer l'événement")}
        </Text>
        {/* S2-ter — L AIR SOUS LA DERNIERE RANGEE.
            Retour de recette : « Annuler » est visible, mais la feuille colle
            trop au bas. Ce cran de rampe s AJOUTE au degagement que BottomModal
            pose deja (40 + encoche basse) — on ne remplace pas son calcul, sinon
            on perdrait la part systeme.
            ⛔ Pas touche au plafond : la feuille etant ancree EN BAS et
            dimensionnee sur son contenu, le baisser la rendrait plus COURTE et
            ferait DESCENDRE son bord haut — l inverse de ce qui est demande. */}
        <View
          style={[
            ApplicationStyle.borderWidth1,
            Spaces.marginBottom[24],
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

        {/* 🚪 EVEDIT-2 (D1) — LE SIGNAL DE SORTIE, DANS LE CONTENU.
            `onDismissed` ci-dessus est la poignee du depot (elle sert deja
            au menu de pieces jointes de la messagerie), mais elle n existe
            que sur la feuille NATIVE : le remplacant web n a pas
            d animation et n emet jamais de fermeture. Ce temoin-ci part
            quand le CONTENU quitte l arbre — c est-a-dire au moment exact
            ou la couche cesse d avaler les appuis, sur les deux
            plateformes. Les deux signaux menent au meme appel, qui est
            idempotent : l action ne peut pas partir deux fois.
            ⛔ IL EST LE DERNIER ENFANT, ET IL NE REND RIEN : le titre reste
            le PREMIER, comme S2 l exige pour la mesure de la feuille. */}
        <SheetExitSignal onExit={runManageSheetExit} />
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
   * @returns {{ onPress: () => void, title: string } | null}
   */
  const getTournamentPrimaryAction = () => {
    if (!isTournamentEvent || isStageDayEvent) return null;

    if (canEdit) {
      return {
        onPress: handleOpenTournamentManagement,
        title: t('eventDetails.manageTheTournament', 'Gérer le tournoi'),
      };
    }

    if (managedTournamentTeam?.documentId) {
      return {
        onPress: () => handleOpenTournamentTeam(managedTournamentTeam.documentId),
        title: t('eventDetails.manageMyRegisteredTeam', 'Gérer mon équipe inscrite'),
      };
    }

    if (currentUserTournamentTeam?.documentId) {
      return {
        onPress: () => handleOpenTournamentTeam(currentUserTournamentTeam.documentId),
        title: t('eventDetails.seeMyRegisteredTeam', 'Voir mon équipe inscrite'),
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
        title: pendingStatus === 'invited' ? t(
          'eventDetails.answerMyInvitation',
          'Répondre à mon invitation',
        ) : t(
          'eventDetails.followMyRequest',
          'Suivre ma demande',
        ),
      };
    }

    return {
      onPress: handleOpenTournamentManagement,
      title: t('eventDetails.seeTheTournament', 'Voir le tournoi'),
    };
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
              title={t('eventDetails.registerAClubTeam', 'Inscrire une équipe du club')}
              variant="Secondary"
            />
          ) : null}

          {canCreateCustomTournamentTeam ? (
            <Button
              onPress={() => setIsTournamentCreateModalVisible(true)}
              title={t('eventDetails.createATeamForThis', 'Créer une équipe pour ce tournoi')}
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
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('eventDetails.fees', 'Cotisations')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('eventDetails.loadingCampaigns', 'Chargement des campagnes...')}
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
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('eventDetails.linkedFees', 'Cotisations liées')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'eventDetails.paymentCampaignsLinkedToThis',
              'Campagnes de paiement rattachées à cet événement.',
            )}
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
                    {campaign?.name || t('eventDetails.eventCampaign', 'Campagne événement')}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    {formatCampaignAmount(
                      campaign?.defaultAmountCents,
                      campaign?.currency || 'EUR',
                    )}
                    {' '}
                    {t('eventDetails.perParticipant', 'par participant')}
                    {' - '}
                    {assignmentTotal}
                    {' '}
                    {t('eventDetails.assignmentS', 'affectation(s)')}
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
                  title={t('eventDetails.open', 'Ouvrir')}
                  variant="Secondary"
                />
                <Button
                  onPress={() => editEventLicenseCampaign(campaign)}
                  style={{ flex: 1 }}
                  title={t('eventDetails.edit', 'Modifier')}
                  variant="Secondary"
                />
              </View>
            </View>
          );
        })}
        <Button
          onPress={openEventLicenseCampaignSettings}
          title={t('eventDetails.createAnotherCampaign', 'Créer une autre campagne')}
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
      ? t('eventDetails.competitionPublished', 'Compétition publiée')
      : t('eventDetails.competitionInDraft', 'Compétition en brouillon');
    let primaryActionHelper = t(
      'eventDetails.seeTheScheduleTheTeams',
      'Consulte le déroulé, les équipes et les résultats du tournoi.',
    );
    if (canEdit && isCompetitionPublished) {
      primaryActionHelper = t(
        'eventDetails.scheduleResultsAndStandingsAre',
        'Calendrier, résultats et classement sont prêts à être pilotés.',
      );
    } else if (canEdit) {
      primaryActionHelper = t(
        'eventDetails.finaliseTheTeamsAndSettings',
        'Finalise les équipes et les paramètres avant de lancer le tournoi.',
      );
    }
    const teamsSummary = t(
      'eventDetails.approvedPending',
      '{{accepted}} validée(s) · {{pending}} en attente',
      {
        accepted: tournamentTeamCounters.accepted,
        pending: tournamentTeamCounters.pending,
        ...SANS_ECHAPPEMENT,
      },
    );

    // 🧭 LES CINQ ETAPES DU FIL — les trois dernieres lisent le dashboard.
    //
    // N7 item 5 (vague P, 23/08) — SORTIE DU PONYTAIL. Avant ce lot, « Poules »
    // et « Matchs » n'etaient pas distinguees de « Publié » : la page ne
    // savait pas si les poules existaient sans etre publiees, et le hook qui le
    // sait tirait `@/services/client` — un import de service de plus aurait
    // fait tomber a 0 test les suites qui montent cet ecran. Les 16 suites le
    // mockent desormais (`tournamentCompetitionQueries`), le hook est branche.
    //
    // 📦 FORME REELLE du dashboard (admin `tournament-competition.js`) :
    //   { bracket, config, event, groups, matches, overview, phases, standings,
    //     teams } avec `config.competitionState` ('draft' | 'published').
    // REGLE DE DERIVATION :
    //   · Poules  = `groups.length > 0`
    //   · Matchs  = `matches.length > 0`
    //   · Publié  = `config.competitionState === 'published'`
    // ✅ CE QUI RESTE VRAI : publier EXIGE des poules et des matchs — un tournoi
    //    publie coche donc 3 et 4 meme si son format n'a pas de poules
    //    (`knockout_only`) : le fil ne dit jamais « pas encore » d'une etape
    //    que la publication a deja franchie.
    // ♻️ REPLI : tant que le dashboard n'a rien rendu (`data` absent), le calcul
    //    d'avant tient — tout s'effondre sur `competitionState` de l'evenement.
    const tournamentDashboard = tournamentDashboardQuery.data;
    const hasTournamentDashboard = Boolean(
      tournamentDashboard && typeof tournamentDashboard === 'object',
    );
    const dashboardGroupsCount = Array.isArray(tournamentDashboard?.groups)
      ? tournamentDashboard.groups.length
      : 0;
    const dashboardMatchesCount = Array.isArray(tournamentDashboard?.matches)
      ? tournamentDashboard.matches.length
      : 0;
    const dashboardPublished = tournamentDashboard?.config?.competitionState === 'published';
    const railGroupsDone = hasTournamentDashboard
      ? dashboardGroupsCount > 0 || dashboardPublished
      : isCompetitionPublished;
    const railMatchesDone = hasTournamentDashboard
      ? dashboardMatchesCount > 0 || dashboardPublished
      : isCompetitionPublished;
    const railPublishedDone = hasTournamentDashboard ? dashboardPublished : isCompetitionPublished;
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
        done: railGroupsDone,
        label: t('eventDetails.tournamentRail.groups', 'Poules'),
      },
      {
        done: railMatchesDone,
        label: t('eventDetails.tournamentRail.matches', 'Matchs'),
      },
      {
        done: railPublishedDone,
        label: t('eventDetails.tournamentRail.published', 'Publié'),
      },
    ];
    const tournamentScopeLabel = event?.tournamentScopeMode === 'autonomous'
      ? t('eventDetails.standaloneTournament', 'Tournoi autonome')
      : t('eventDetails.sourceTeam', 'Équipe source');
    const tournamentContextTags = [
      tournamentScopeLabel,
      event?.tournamentActivity?.name,
      event?.tournamentSection?.name,
      event?.tournamentCategory?.name,
    ].filter(Boolean);
    let playerTournamentStatusLabel = t('eventDetails.answerExpected', 'Réponse attendue');
    let playerTournamentStatusTone = Colors.warning500;
    if (currentUserTournamentStatus === 'present') {
      playerTournamentStatusLabel = t('eventDetails.present', 'Présent');
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
              <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                {t('eventDetails.tournament', 'TOURNOI')}
              </Text>
              <Text style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginTop[4]]}>
                {competitionStateLabel}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[8], { lineHeight: 20 }]}>
                {primaryActionHelper}
              </Text>
            </View>
            <Tag
              style={tournamentDs.getToneTagStyle(isCompetitionPublished ? Colors.success500 : Colors.warning500)}
              text={isCompetitionPublished
                ? t('eventDetails.published', 'Publié')
                : t('eventDetails.draft', 'Brouillon')}
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
              <Text style={[Fonts.p4, Fonts.neutral300]}>{t('eventDetails.teams', 'Équipes')}</Text>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{tournamentTeams.length}</Text>
            </View>
            <View style={[tournamentDs.styles.insetPanelCard, { flexGrow: 1, minWidth: 132 }]}>
              <Text style={[Fonts.p4, Fonts.neutral300]}>Validation</Text>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {event?.tournamentConfig?.registrationMode === 'auto' ? 'Auto' : t(
                  'eventDetails.manual',
                  'Manuelle',
                )}
              </Text>
            </View>
            <View style={[tournamentDs.styles.insetPanelCard, { flexGrow: 1, minWidth: 132 }]}>
              <Text style={[Fonts.p4, Fonts.neutral300]}>{t('eventDetails.points', 'Points')}</Text>
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
            ? t(
              'eventDetails.registrationsToCheck',
              {
                count: tournamentTeamCounters.pending,
                defaultValue_one: '{{count}} inscription à vérifier',
                defaultValue_other: '{{count}} inscriptions à vérifier',
              },
            )
            : ''}
          steps={tournamentRailSteps}
          title={t('eventDetails.tournamentRail.title', 'OÙ EN EST LE TOURNOI')}
        />

        {currentUserTournamentMember ? (
          <View style={tournamentDs.styles.panelCard}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                  {t('eventDetails.myTournamentAnswer', 'Ma réponse au tournoi')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4], { lineHeight: 20 }]}>
                  {t(
                    'eventDetails.yourAnswerIsAboutYour',
                    'Ta réponse concerne ton équipe tournoi, pas le RSVP classique de '
                      + 'l’événement.',
                  )}
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
                  title={currentUserTournamentStatus === 'present' ? t(
                    'eventDetails.presenceConfirmed',
                    'Présent confirmé',
                  ) : t(
                    'eventDetails.iMPresent',
                    'Je suis présent',
                  )}
                  variant={currentUserTournamentStatus === 'present' ? 'Primary' : 'Secondary'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={respondTournamentPresenceMutation.isPending || currentUserTournamentStatus === 'absent'}
                  isLoading={respondTournamentPresenceMutation.isPending}
                  onPress={() => handleRespondTournamentPresence('absent')}
                  title={currentUserTournamentStatus === 'absent' ? t(
                    'eventDetails.absenceConfirmed',
                    'Absence confirmée',
                  ) : t(
                    'eventDetails.iMAbsent',
                    'Je suis absent',
                  )}
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

    const teamsSummary = t(
      'eventDetails.approvedPending',
      '{{accepted}} validée(s) · {{pending}} en attente',
      {
        accepted: tournamentTeamCounters.accepted,
        pending: tournamentTeamCounters.pending,
        ...SANS_ECHAPPEMENT,
      },
    );

    return (
      <View style={Spaces.gap[16]}>
        {renderTournamentActionsPanel()}

        <View style={tournamentDs.styles.panelCard}>
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                {t('eventDetails.tournamentTeams2', 'Équipes tournoi')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>{teamsSummary}</Text>
            </View>
            {tournamentTeamCounters.warning > 0 ? (
              <Tag
                style={tournamentDs.getToneTagStyle(Colors.gold500)}
                text={t(
                  'eventDetails.toCheck',
                  '{{warning}} à vérifier',
                  { warning: tournamentTeamCounters.warning, ...SANS_ECHAPPEMENT },
                )}
                // @ts-ignore: FIXME: Baseline TS regression
                textColor="gold500"
              />
            ) : null}
          </View>

        </View>

        {tournamentTeams.length === 0 ? (
          <View style={tournamentDs.styles.panelCard}>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'eventDetails.noTeamIsRegisteredFor',
                'Aucune équipe n est encore inscrite sur ce tournoi.',
              )}
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
                    {tournamentTeam?.name || t('eventDetails.tournamentTeam', 'Équipe tournoi')}
                  </Text>
                  <Text style={[Fonts.p4, Fonts.primary100]}>
                    {tournamentTeam?.sourceType === 'club_team'
                      ? t('eventDetails.fromTeam', 'Depuis {{teamName}}', {
                        teamName: tournamentTeam?.sourceTeam?.name
                          || t('eventDetails.aClubTeam', 'une équipe club'),
                        ...SANS_ECHAPPEMENT,
                      })
                      : t('eventDetails.temporaryTeam', 'Équipe éphémère')}
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
                    ...SANS_ECHAPPEMENT,
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
                    title={t('eventDetails.approve', 'Valider')}
                    variant="Primary"
                  />
                  <Button
                    isLoading={reviewTournamentTeamMutation.isPending}
                    isOption
                    onPress={() => handleReviewTournamentTeam(tournamentTeam?.documentId, 'declined')}
                    style={{ borderColor: `${Colors.error500}55` }}
                    textStyle={{ color: Colors.error300 }}
                    title={t('eventDetails.decline', 'Refuser')}
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
          {hasAlreadyJoined && (
            <Button disabled title={t('eventDetails.iMIn', 'Je participe !')} variant="Primary" />
          )}
          {!hasAlreadyJoined && (
            <Button
              onPress={handleJoinEvent}
              title={t('eventDetails.book', 'Reserver')}
              variant="Primary"
            />
          )}
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
    // ST-MONMATCH (écran 12, défaut 23) — plus de « Tu étais là ? Passe en présent » sous une
    // réponse de match déjà envoyée : le joueur a déjà dit s il était là.
    const offrePresentApresCoup = peutPasserPresentApresCoup && myMatchResponse?.status !== 'submitted';
    const eventAnswerButtonsNode = (
      <EventAnswerButtons
        event={event}
        hasAcceptedRequest={hasAcceptedRequest}
        hasPendingRequest={hasPendingRequest}
        isFinished={isMatchFinished}
        onDeclareLatePresence={offrePresentApresCoup ? handleDeclareLatePresence : undefined}
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
    if (canLoadMyMatchResponse) {
      refetchMyMatchResponse();
    }
  }, [
    areDeferredQueriesEnabled,
    canAccessAttendance,
    canEdit,
    canLoadMyMatchResponse,
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
  // 🎨 R9 — LE FOND DE LA BARRE DU HAUT, POSE PAR CET ECRAN SEULEMENT.
  //
  // 🧨 Le defaut de recette du 24/08 : le titre chevauche le drapeau et le ⋯.
  // La barre est TRANSPARENTE pour toute la pile (`commonOptions.js`) et les
  // deux glyphes n ont aucun fond : le contenu passe dessous — c est voulu, c est
  // ce qui donne l entete pleine largeur — mais rien ne garantissait que les
  // boutons restent lisibles par-dessus.
  //
  // ⛔ POURQUOI PAS DANS `commonOptions` : ce fichier commande TOUS les ecrans
  // de l app. Rendre la barre opaque partout pour reparer une detection serait
  // un changement global que personne n a demande.
  //
  // 🖌️ Un degrade en quatre bandes plutot qu une bibliotheque : les huit
  // suites qui montent un composant a `LinearGradient` le doublent TOUTES une
  // par une. L importer ici obligerait a doubler la meme chose dans les vingt
  // suites de cet ecran, pour un fond de barre. Meme motif que `HomeActionCard`,
  // qui imite deja une retombee de degrade sans lib ni image.
  const renderHeaderBackground = useCallback(
    () => (
      <View pointerEvents="none" style={[Alignments.fill]}>
        {[0.92, 0.7, 0.42, 0.14].map((opacite) => (
          <View
            key={`r9-voile-${opacite}`}
            style={[
              Alignments.fill,
              { backgroundColor: withAlpha(Colors.primary900, opacite) },
            ]}
          />
        ))}
      </View>
    ),
    [Alignments, Colors.primary900],
  );

  const renderHeaderRight = useCallback(
    () => (
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[4], Spaces.marginRight[16]]}>
        <Button
          // FINITIONS7 — tournee 8 : un drapeau sans nom pour le lecteur d ecran.
          accessibilityLabel={t('eventDetails.a11y.reportEvent', 'Signaler l’événement')}
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
            onPress={openManageSheet}
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
    [Alignments, Colors.neutral00, hasManageActions, openManageSheet, Spaces, t],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      // FINITIONS7 — la fleche de la pile s annoncait « Go back » (repli anglais de
      // @react-navigation/elements, HeaderBackButton.tsx:35) : elle dit « Retour ».
      headerBackAccessibilityLabel: t('common.back', 'Retour'),
      headerBackground: renderHeaderBackground,
      headerLeft: fromEventCreation ? renderHeaderLeft : undefined,
      headerRight: renderHeaderRight,
    });
  }, [
    fromEventCreation,
    navigation,
    renderHeaderBackground,
    renderHeaderLeft,
    renderHeaderRight,
    t,
  ]);

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
  let lateModalTitle = t('eventDetails.correctTheDelay', 'Corriger le retard');
  let lateModalDescription = t(
    'eventDetails.updateTheActualDelayOr',
    'Mets à jour le retard réel ou réinitialise le pointage.',
  );
  let lateModalPrimaryActionTitle = 'Enregistrer';

  if (isPlayerLateModal) {
    lateModalTitle = lateModalMode === 'player_update' ? t(
      'eventDetails.updateMyDelay',
      'Mettre à jour mon retard',
    ) : t(
      'eventDetails.iLlBeLate',
      'Je serai en retard',
    );
    lateModalDescription = t(
      'eventDetails.reportYourDelayBeforeArriving',
      "Signale ton retard avant d'arriver. Tu confirmeras ensuite ton arrivée réelle.",
    );
    lateModalPrimaryActionTitle = t('eventDetails.saveMyDelay', 'Enregistrer mon retard');
  } else if (lateModalMode === 'coach_mark') {
    lateModalTitle = t('eventDetails.checkInTheArrival', "Pointer l'arrivée");
    lateModalDescription = t(
      'eventDetails.checkInTheArrivalAnd',
      "Pointe l'arrivée et ajuste le retard si nécessaire.",
    );
    lateModalPrimaryActionTitle = t('eventDetails.checkInTheArrival', "Pointer l'arrivée");
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
      {/* 🧨 S6 (recette 2.6.27) — LA PASTILLE RESPIRE SOUS LA BARRE.
          `ScreenContainer` pose un rembourrage haut EGAL a la hauteur de la
          barre, et le `gap` du conteneur s applique ENTRE les enfants, jamais
          AVANT le premier : cette rangee demarrait donc pile au ras de la barre.
          Or les deux boutons (44x44 dans une bande de 44 pt) debordent d environ
          2,7 px dessous sur un iPhone a Dynamic Island, et la pastille centree
          passe sous le drapeau. 12 px de separation VERTICALE suffisent.
          ⛔ Ni `ScreenContainer` ni `Tag` ne bougent : ils sont partages, le
          defaut ne l est pas. Et surtout PAS de plafond de largeur ici, qui
          tronquerait « SEANCE D ESSAI ». */}
      <View
        style={[Spaces.gap[8], Spaces.marginTop[12], Alignments.alignCenter]}
        testID="event-type-tag-row"
      >
        <Tag
          style={{}}
          text={buildTypeTagLabel(event?.type?.name, typeTagSegmentsAvecVerdict)}
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
          ref={overviewScrollRef}
          refreshControl={(
            <RefreshControl
              onRefresh={() => refreshEventDetails({ includeSecondary: true })}
              refreshing={isLoading || isEventFetching}
            />
          )}
          showsVerticalScrollIndicator={false}
        >
          <WithDataWrapper
            error={error}
            errorMessage={eventLoadErrorMessage}
            isLoading={isLoading}
            wrapperStyle={[Alignments.fill, Spaces.gap[24]]}
          >
            <EventHeader
              detectionSummary={detectionHeaderSummary}
              event={event}
              matchScoreSummary={matchEncartSummary}
            />
            {/* COLL-C4B (02/10) — D16 : la Ville a ferme l installation ce jour-la
                (`facilityClosure` de la fiche). Le bandeau et les deux gestes du CLUB
                (P4v3-fermer-tel ecran 5) ; rien n est annule a sa place. */}
            {event?.facilityClosure && canEdit ? (
              <FacilityClosureBanner
                closure={event.facilityClosure}
                facilityType={event?.facility?.type}
                onCancel={handleCancelEvent}
                onMove={handleEditEvent}
              />
            ) : null}
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
              {/* 🧾 S5 — les convoques du brouillon, JUSTE SOUS le bandeau qui
                  propose de continuer. Les deux repondent a la meme question
                  (« ou en est ma convocation ? ») : les separer obligerait a
                  chercher. ⛔ Hors du bandeau, pas dedans : son plafond de
                  hauteur (120 pt) protege le contenu du match, et une liste de
                  onze noms le creverait. */}
              {showCallUpTab && renderDraftRoster()}

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
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                    {t('eventDetails.trainingCampDay', 'Journée de stage')}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral00]}>
                    {t(
                      'eventDetails.thisDayBelongsToThe',
                      'Cette journée depend du stage principal.',
                    )}
                  </Text>
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                    {t('eventDetails.seeTheTrainingCamp', 'Voir le stage')}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {showOverviewTab ? renderTournamentSection() : null}

              {showTournamentTeamsTab ? renderTournamentTeamsTab() : null}

              {showOverviewTab && canSelfMarkArrival && selfAttendanceStatus ? (
                <View style={[Spaces.gap[12]]}>
                  <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                    {t('eventDetails.arrivalStatus', "Statut d'arrivée")}
                  </Text>
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
                        <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                          {t('eventDetails.eventAttendance', 'Présence événement')}
                        </Text>
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

              {/* 🏋️ P8 — LA CARTE D'OUVERTURE, A SA PLACE : juste au-dessus de
                  la liste des participants (rang 10 de la matrice du pack), et
                  seulement pour qui organise un entrainement.
                  🧭 L'ANCRE qui la suit est le bas du rail : une vue vide, sans
                  style, dans un cadre SANS `gap` — elle ne deplace donc RIEN.
                  ⚠️ Elle est le seul point de mesure legal : le bloc
                  `<EventParticipants` lui-meme appartient au lot P2. */}
              {canManageTrainingVisibility ? (
                <View>
                  {renderTrainingOpeningCard()}
                  <View
                    collapsable={false}
                    ref={participantsAnchorRef}
                    testID="p8-ancre-participants"
                  />
                </View>
              ) : null}

              {showParticipantsTab && (!isTournamentEvent || isStageDayEvent) ? (
                <EventParticipants
                  // @ts-ignore: FIXME: Baseline TS regression
                  attendanceByUserId={attendanceByUserId}
                  canApprovePendingRequests={canApprovePendingRequests}
                  canEdit={canEdit}
                  canManageEventLicenseCampaigns={canManageEventLicenseCampaigns}
                  detectionPositionSections={detectionPositionSections}
                  event={event}
                  eventLicenseCampaigns={eventLicenseCampaigns}
                  eventStartAt={eventStartAt}
                  externalParticipationSection={externalParticipationSection}
                  handleExportParticipants={handleExportParticipants}
                  handleRemindPlayers={handleRemindPlayers}
                  handleShare={() => setIsShareModalVisible(true)}
                  handleUpdateParticipation={handleUpdateParticipation}
                  handleUserPress={handleUserPress}
                  nowMs={serverNowMs}
                  onCandidatePress={handleOpenDetectionCandidate}
                  onCoachEditLate={handleCoachEditLate}
                  onCoachMarkPresent={handleCoachMarkPresent}
                  participantsSummary={participantsSummary}
                  participationsByStatus={participationsByStatus}
                  pendingParticipations={pendingParticipations}
                  rouvreLeQuestionnaire={Boolean(isMatchEvent && isMatchFinished)}
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
              /* 🚩 ST-MATCH (écran 2, état 1) — l'ORANGE de l'avertissement au lieu du
                 rouge de l'erreur : l'erreur peut venir de l'appel, pas du joueur (le titre
                 rouge gras « Absent à l'appel » l'accusait). Le bloc s'appelle « Mon match ».
                 Il dit QUI a pointé et QUAND, et « Écrire à Karim » ouvre la conversation. */
              <View style={[Spaces.gap[12]]} testID="st-match-absent-a-l-appel">
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                  {t('stMatch.absent.blockTitle', 'Mon match')}
                </Text>
                <View
                  style={[
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[16],
                    Spaces.gap[12],
                    {
                      backgroundColor: withAlpha(Colors.primary700, 0.55),
                      borderColor: withAlpha(Colors.primary500, 0.24),
                      borderWidth: 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      ApplicationStyle.borderRadius12,
                      Spaces.paddingHorizontal[16],
                      Spaces.paddingVertical[12],
                      Spaces.gap[8],
                      {
                        backgroundColor: withAlpha(Colors.warning500, 0.1),
                        borderColor: withAlpha(Colors.warning500, 0.4),
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                      <SvgIcon color={Colors.warning400} height={16} name="flag" width={16} />
                      <Text style={[Fonts.p2Bold, { color: Colors.warning400, flexShrink: 1 }]}>
                        {t('stMatch.absent.title', 'Marqué absent à l\'appel')}
                      </Text>
                    </View>
                    <Text style={[Fonts.p2, Fonts.neutral100]}>{absenceMarkedLine}</Text>
                    <Text style={[Fonts.p2, Fonts.neutral100]}>{absenceClosedText}</Text>
                  </View>
                  {canWriteToAbsenceMarker ? (
                    <Button
                      onPress={writeToAbsenceMarker}
                      title={writeToAbsenceMarkerTitle}
                      variant="Secondary"
                    />
                  ) : null}
                  <Text style={[Fonts.p3, Fonts.neutral300]}>{absenceReopensText}</Text>
                </View>
              </View>
                ) : null}

              {showOverviewTab && isMatchEvent && compositionTeamId && isTeamPlayer && isMatchFinished && canRespondMyMatchStats ? (
                /* 🎯 ST-MONMATCH (écran 12, design validé le 02/10) — « MON MATCH » : UNE carte au
                   lieu de « Mes stats » et « Mon retour coach ». Même porte qu'avant : au JOUEUR
                   seul (STATS-FIX2 · 4). La carte ne lit que SA réponse et SON avis (SECU-STATS). */
                <View collapsable={false} onLayout={onMonMatchLayout} ref={monMatchAnchorRef}>
                  <MonMatchCard
                    arriveParLeRetour={isCoachFeedbackHighlighted}
                    entraineur={monMatchEntraineur}
                    estOccupee={isMyMatchResponseFetching}
                    onRepondre={openMyMatchResponse}
                    reponse={myMatchResponse}
                    retourDuCoach={myCoachReview}
                    sport={matchStatsPayload?.sport || myMatchResponsePayload?.sport || 'football'}
                  />
                </View>
              ) : null}

              {/* 🎯 ST-MATCH (écran 7, design des statistiques validé le 02/10) — « STATS DU
                  MATCH ». Trois lecteurs, trois cartes :
                  · l'ENCADREMENT (`canManage`) : la carte des trois étapes, qui porte
                    désormais l'auteur du score, le brouillon, la publication, qui manque
                    (et « Relancer »), les deux notes et le mot de l'entraîneur ;
                  · le JOUEUR : « Le bilan de Karim », la lecture déjà filtrée par le serveur
                    (SECU-STATS, moyenne B) — plus de bouton éteint ;
                  · le DIRIGEANT qui n'entraîne pas (« score A ») : qui saisit, et où trouver
                    les résultats (le serveur lui refuse la feuille).
                  Retirés : « Version v1 », la date brute, « 1 note collective prise en
                  compte » (tout est dans la carte). */}
              {showMatchStatsBlock ? (
                <View collapsable={false} ref={matchStatsAnchorRef} style={[Spaces.gap[12]]}>
                  <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                    {t('eventDetails.matchStats', 'Stats du match')}
                  </Text>

                  {canManageMatchStats ? (
                    <PostMatchJourneyCard
                      avantLaFin={!isMatchFinished}
                      avecConvocation={matchHasConvocation}
                      boutonDesactive={matchStatsPrimaryAction.disabled || isMatchStatsFetching}
                      feuilleBrouillonDepuis={matchStatsReport?.status === 'draft'
                        ? matchStatsReport?.updatedAt || matchStatsReport?.createdAt || ''
                        : ''}
                      feuillePublieeLe={matchStatsReport?.finalizedAt || ''}
                      finDuMatch={matchEndLabel}
                      manquants={matchMissingResponders}
                      monDocumentId={userData?.documentId || ''}
                      motDuCoach={matchStatsReport?.collectiveComment || ''}
                      motif={matchStatsPrimaryAction.subtitle}
                      moyenneJoueurs={playerCollectiveRating}
                      nombreARelancer={matchPlayersToRemind}
                      noteEquipe={matchStatsReport?.collectiveRating ?? null}
                      onPressEtape={(/** @type {string} */ etape) => (etape === 'score'
                        ? openMatchScoreSheet()
                        : openMatchStatsEditor())}
                      onRelancer={remindMissingResponders}
                      presentsSansConvocation={matchPresentWithoutConvocation}
                      relanceEnCours={isRemindingResponders}
                      relanceFaite={relanceDuJourCle === relanceCle}
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
                      scoreAuteur={matchStatsPayload?.score?.recordedBy || null}
                      scoreDeLaFeuille={matchStatsReport
                        && Number.isFinite(Number(matchStatsReport?.scoreFor))
                        ? `${matchStatsReport.scoreFor} - ${matchStatsReport.scoreAgainst}`
                        : ''}
                      scoreDisponible={Boolean(matchStatsPayload?.score?.available)}
                      scoreLibelle={matchStatsScoreLabel}
                      scoreOfficiel={matchStatsPayload?.score?.available
                        ? `${matchStatsPayload.score.scoreFor} - ${matchStatsPayload.score.scoreAgainst}`
                        : ''}
                      scoreOrigine={matchStatsPayload?.score?.source || ''}
                      scoreSaisiA={matchStatsPayload?.score?.recordedAt || ''}
                      statsFinalisees={isMatchStatsFinal}
                      verificationRequise={isMatchStatsReviewRequired}
                    />
                  ) : (
                    <MatchBilanCard
                      avantLaFin={!isMatchFinished}
                      buteurs={matchEncartSummary?.scorersLine || ''}
                      entraineur={teamCoachFirstname || ''}
                      equipe={compositionEditorTeam?.name || event?.team?.name || ''}
                      finDuMatch={matchEndLabel}
                      mode={compositionTeamId && canViewMatchStats ? 'joueur' : 'dirigeant'}
                      motDuCoach={matchStatsReport?.collectiveComment || ''}
                      moyenneJoueurs={playerCollectiveRating}
                      noteEquipe={matchStatsReport?.collectiveRating ?? null}
                      onVoirLesResultats={openTeamResults}
                      publiee={isMatchStatsFinal}
                      publieeLe={matchStatsReport?.finalizedAt || ''}
                    />
                  )}

                  {/* 🚪 H8 — LA DEUXIEME PORTE VERS « MATCHS EN ATTENTE ». Le design la
                      retire (« l'accueil et la fenêtre y mènent ») ; ST-MATCH la GARDE :
                      l'accueil n'a aucune porte vers cet écran, et la fenêtre de rappel n'y
                      mène qu'à partir de DEUX matchs en attente. Sans elle, avec un seul
                      match, l'écran redeviendrait inatteignable (la régression H8). */}
                  {compositionTeamId && canViewMatchStats ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={openPendingMatchStatsList}
                      style={[
                        Alignments.row,
                        Alignments.alignCenter,
                        Alignments.justifyCenter,
                        Spaces.gap[8],
                        { minHeight: 44 },
                      ]}
                    >
                      <Text
                        style={[
                          Fonts.p3Bold,
                          Fonts.primary200,
                          { flexGrow: 1, textAlign: 'center' },
                        ]}
                      >
                        {t(
                          'eventDetails.seeAllMyPendingMatches',
                          'Voir tous mes matchs en attente',
                        )}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {/* AVIS (09/09) — l avis anonyme des joueurs sur cet entrainement.
                  Il se pose a cote de « Stats du match », qui est son exact
                  equivalent cote match. La porte est calculee plus haut. */}
              {/* `avisDEntrainement` gate le rendu : sans lui, la carte annoncerait
                  « aucun avis » pendant le chargement, puis se contredirait. */}
              {showOverviewTab && peutVoirLesAvisDEntrainementIci && avisDEntrainement ? (
                <TrainingReviewsCard donnees={avisDEntrainement} />
              ) : null}
              {/* ST-RETOURS (planche 21, etat 4) — le joueur relit SA note, jamais les autres. */}
              {showOverviewTab && peutRelireSaNote({
                canEdit,
                isFinished: isMatchFinished,
                isTeamMember,
                isTraining: trainingOpenConfig.isTraining,
              }) ? (
                <MyTrainingReviewBlock
                  eventId={eventId}
                  trainerFirstname={(event?.team?.trainers || [])[0]?.firstname || null}
                />
                ) : null}

              {showCallUpTab && showPublishedComposition ? (
                <View style={[Spaces.gap[12]]}>
                  <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                    {t('eventDetails.teamLineUp', 'Composition d’équipes')}
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
                        {publishedCompositionSummary.teams}
                      </Text>
                      {publishedCompositionSummary.counts ? (
                        <Text style={[Fonts.p3, Fonts.neutral300]}>
                          {publishedCompositionSummary.counts}
                        </Text>
                      ) : null}
                      {convocationBranches[0]?.published?.publishedAt ? (
                        <Text style={[Fonts.p3, Fonts.neutral300]}>
                          {t('eventDetails.publishedOn', 'Publiée le')}
                          {' '}
                          {new Date(convocationBranches[0].published.publishedAt).toLocaleString(localeDesFormats())}
                        </Text>
                      ) : null}
                      {/* 🧾 R6 — LES NOMS, AVANT le bouton. La question que se
                          pose un entraineur en ouvrant cet onglet est « qui
                          vient ? » : y repondre derriere un appui de plus,
                          alors que la reponse est deja chargee, etait le
                          defaut. Le bouton reste, pour le terrain et le detail. */}
                      {renderPublishedRoster()}
                      {/* FINITIONS (recette Android 16 du 28/09) — EMPILÉS. Côte à
                          côte, chaque bouton n'avait qu'une demi-largeur : « Voir la
                          convocation et les réponses » y tombait en police minuscule
                          et perdait quand même « réponses ». Chacun a désormais toute
                          la largeur. ⛔ Plus de `flex: 1` : dans une colonne sans
                          hauteur, il écraserait le bouton à zéro. */}
                      {publishedCompositionTeamCount > 0 ? (
                        <View style={[Spaces.gap[8]]}>
                          <Button
                            onPress={openPublishedConvocation}
                            title={publishedCompositionCtaTitle}
                            variant={viewerConvocationRole && !canEdit ? 'Primary' : 'Secondary'}
                          />
                          {/* 🚪 COMPOMODIF (M1) — le petit bouton « Modifier »,
                              la ou le coach LIT sa compo. Reserve a qui peut
                              vraiment modifier, et seulement s'il y a un terrain
                              a rouvrir. */}
                          {canEdit && publishedBoardTarget ? (
                            <Button
                              onPress={openCompositionEdit}
                              title={t('matchComposition.board.edit', 'Modifier')}
                              variant="Primary"
                            />
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[Fonts.p2, Fonts.neutral300]}>
                      {t(
                        'eventDetails.noLineUpPublishedYet',
                        'Aucune composition publiée pour le moment.',
                      )}
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
                title={t('eventDetails.decline', 'Refuser')}
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
          joinModalConfirmLabel = t('eventDetails.takePart', 'Participer');
          // @ts-ignore: FIXME: Baseline TS regression
          joinModalContextNote = t('eventDetails.chosenPosition', 'Poste choisi : {{position}}.', {
            position: pendingDetectionSlot.position,
            ...SANS_ECHAPPEMENT,
          });
          joinModalIsSubmitting = applyToDetectionSlotMutation.isPending
            // @ts-ignore: FIXME: Baseline TS regression
            && Boolean(pendingDetectionSlot?.documentId);
        // @ts-ignore: FIXME: Baseline TS regression
        } else if (pendingTournamentAction?.mode === 'create_custom') {
          joinModalConfirmLabel = t('eventDetails.createMyTeam', 'Créer mon équipe');
          // @ts-ignore: FIXME: Baseline TS regression
          joinModalContextNote = t('eventDetails.teamToCreate', 'Équipe à créer : {{teamName}}.', { teamName: pendingTournamentAction?.teamName || t('eventDetails.myTeam', 'Mon équipe'), ...SANS_ECHAPPEMENT });
          joinModalIsSubmitting = createTournamentTeamMutation.isPending;
        // @ts-ignore: FIXME: Baseline TS regression
        } else if (pendingTournamentAction?.mode === 'join_existing') {
          joinModalConfirmLabel = t('eventDetails.sendMyRequest', 'Envoyer ma demande');
          // @ts-ignore: FIXME: Baseline TS regression
          joinModalContextNote = t('eventDetails.chosenTeam', 'Équipe choisie : {{teamName}}.', { teamName: pendingTournamentAction?.teamName || t('eventDetails.tournamentTeam', 'Équipe tournoi'), ...SANS_ECHAPPEMENT });
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
                getParticipationErrorMessage(mutationError, t('eventDetails.unableToConfirmYourParticipation', 'Impossible de confirmer ta participation pour le moment.')),
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
                name: pendingTournamentAction?.teamName || t('eventDetails.myTeam', 'Mon équipe'),
              });
            } catch (mutationError) {
              setJoinModalError(
                getParticipationErrorMessage(mutationError, t('eventDetails.unableToCreateThisTournament2', 'Impossible de créer cette équipe de tournoi pour le moment.')),
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
                getParticipationErrorMessage(mutationError, t('eventDetails.unableToSendThisRequest', 'Impossible d envoyer cette demande pour le moment.')),
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
              {t('eventDetails.chooseAPosition', 'Choisir un poste')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100, { textAlign: 'center' }]}>
              {t(
                'eventDetails.selectThePositionYouWant',
                'Sélectionne le poste auquel tu veux participer.',
              )}
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
              buttonTitle = t('eventDetails.requestSent', 'Demande envoyée');
            } else if (isComplete) {
              buttonTitle = t('eventDetails.positionFull', 'Poste complet');
            }
            const remainingLabel = isComplete
              ? t('eventDetails.full', 'Complet')
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
                      {slot?.position || t('eventDetails.position', 'Poste')}
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

          {/* 🧯 R9 — LA RANGEE QUI MANQUAIT : postuler sans viser un poste.
              Elle est posee APRES les postes (on propose d abord ce que le club
              cherche) et elle s affiche TOUJOURS, meme quand la detection n a
              aucun poste — sinon le selecteur serait un cul-de-sac. */}
          <View
            style={[
              ApplicationStyle.borderRadius24,
              ApplicationStyle.borderWidth1,
              Spaces.padding[16],
              Spaces.gap[12],
              {
                backgroundColor: withAlpha(Colors.neutral00, 0.04),
                borderColor: withAlpha(Colors.neutral00, 0.16),
              },
            ]}
            testID="r9-poste-libre"
          >
            <View style={[Spaces.gap[4]]}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {t('eventDetails.detection.noSpecificPositionTitle', 'Sans poste précis')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {t(
                  'eventDetails.detection.noSpecificPositionHint',
                  'Tu rejoins la séance sans viser un poste en particulier.'
                  + ' Le staff te placera sur place.',
                )}
              </Text>
            </View>
            <Button
              disabled={applyToDetectionSlotMutation.isPending}
              onPress={handleApplyWithoutDetectionSlot}
              title={t('eventDetails.detection.noSpecificPositionAction', 'Participer sans poste')}
              variant="Secondary"
            />
          </View>
        </View>
      </BottomModal>

      {/* 🗂️ P7 — LA FICHE CANDIDAT (decision 4=B : une FEUILLE, pas un ecran).
          Elle repond aux 4 questions qu'on se pose devant un nom sur une
          detection : a quoi a-t-il postule, ou en est sa demande, qu'en a dit
          le staff, et qu'est-ce que j'en fais maintenant.
          ⚠️ AUCUNE ROUTE NEUVE : `RecruitmentAdDetails` reste le chemin de
          l'ANNONCE ; ceci est le chemin du CANDIDAT, depuis sa seance. */}
      <BottomModal
        close={() => setDetectionCandidateSheet(null)}
        headerComponent={(
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00, { textAlign: 'center' }]}>
              {detectionCandidateName}
            </Text>
            <Text
              style={[Fonts.p3, Fonts.primary200, { textAlign: 'center' }]}
              testID="p7-fiche-poste"
            >
              {detectionCandidatePositionLabel}
            </Text>
          </View>
        )}
        isVisible={Boolean(detectionCandidateSheet)}
        snapPoints={['62%']}
        style={{
          borderColor: withAlpha(Colors.primary500, 0.14),
          borderWidth: 1,
        }}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[24]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
              {t('eventDetails.detection.candidateStatusTitle', 'Statut')}
            </Text>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]} testID="p7-fiche-statut">
              {detectionCandidateStatusLabel}
            </Text>
          </View>

          {/* 📝 LE RETOUR INDIVIDUEL (regle 6). Ses quatre etats se decident
              plus haut, avec les autres libelles de la fiche. */}
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
              {t('eventDetails.detection.candidateReviewTitle', 'Retour individuel')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral300]} testID="p7-fiche-retour">
              {detectionCandidateReviewLabel}
            </Text>
          </View>

          {/* ✅ ACCEPTER / REFUSER — les MEMES mutations que la carte de demande
              de l'onglet Candidats (`handleUpdateParticipation`), pas un second
              chemin d'ecriture. Ils ne se montent que devant une demande a
              trancher, et pour qui a le droit de la trancher. */}
          {canApprovePendingRequests && detectionCandidateStatus === 'pending' ? (
            <View style={[Alignments.row, Spaces.gap[12]]} testID="p7-fiche-actions">
              <View style={[Alignments.fill]}>
                <Button
                  onPress={() => {
                    handleUpdateParticipation(
                      detectionCandidateSheet?.participation?.documentId,
                      'accepted',
                    );
                    setDetectionCandidateSheet(null);
                  }}
                  title={t('eventDetails.detection.candidateAccept', 'Accepter')}
                  variant="Primary"
                />
              </View>
              <View style={[Alignments.fill]}>
                <Button
                  onPress={() => {
                    handleUpdateParticipation(
                      detectionCandidateSheet?.participation?.documentId,
                      'declined',
                    );
                    setDetectionCandidateSheet(null);
                  }}
                  title={t('eventDetails.detection.candidateDecline', 'Refuser')}
                  variant="Secondary"
                />
              </View>
            </View>
          ) : null}

          {/* 🤝 R9 — « INVITER DANS L'EQUIPE », BRANCHE SUR LE RAIL P10.
              ⛔ CE N'EST PAS UN AJOUT A L'EQUIPE : le serveur cree une invitation
              `pending`, la personne recoit une notification, et c'est ELLE qui
              accepte. Jamais de `players.connect` ici — ce serait se passer de
              son consentement.
              🗣️ Et quand ce n'est pas possible, le bouton reste GRISE AVEC SON
              MOTIF : un bouton disparu ne s'explique pas. Ce qui change depuis P7,
              c'est que le motif dit desormais la VERITE (pas de compte, pas
              d'equipe) au lieu de « ca arrive bientot ». */}
          <View style={[Spaces.gap[4]]}>
            <Button
              disabled={!detectionCandidateInvitation.canInvite
                || detectionCandidateAlreadyInvited
                || inviteCandidateMutation.isPending}
              isLoading={inviteCandidateMutation.isPending}
              onPress={() => inviteCandidateMutation.mutate({
                candidateId: detectionCandidateInvitation.candidateId,
                participationId: detectionCandidateSheet?.participation?.documentId,
                teamId: event?.team?.documentId,
              })}
              title={detectionCandidateAlreadyInvited
                ? t('recruitment.invite.sent', 'Invitation envoyée')
                : t('eventDetails.detection.candidateInvite', 'Inviter dans l’équipe')}
              variant="Primary"
            />
            {detectionCandidateInvitation.canInvite && !detectionCandidateAlreadyInvited
              ? null
              : (
                <Text style={[Fonts.p4, Fonts.neutral300]} testID="p7-fiche-invite-motif">
                  {detectionCandidateInvitation.reason === 'missing-team'
                    ? t(
                      'eventDetails.detection.candidateInviteNoTeam',
                      'Cet événement n’est rattaché à aucune équipe :'
                      + ' il n’y a nulle part où inviter cette personne.',
                    )
                    : t(
                      'recruitment.invite.needsAccount',
                      'Cette personne n’a pas encore de compte FoundClub :'
                      + ' impossible de l’inviter.',
                    )}
                </Text>
              )}
          </View>
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
          title: event?.title || event?.name || event?.type?.name || t(
            'eventDetails.foundclubEvent',
            'Événement FoundClub',
          ),
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
        Fonts={Fonts}
        initialLimit={trainingOpenConfig.externalParticipantLimit}
        isSubmitting={mutations.updateEventNoNavMutation.isPending}
        isVisible={isTrainingOpenModalVisible}
        onClose={() => setIsTrainingOpenModalVisible(false)}
        onSubmit={handleSubmitTrainingOpenConfig}
        Spaces={Spaces}
      />

      <BottomModal
        close={closeSubscriptionFollowUp}
        isVisible={isSubscriptionFollowUpVisible}
        onDismissed={runSubscriptionFollowUpExit}
        snapPoints={['70%']}
      >
        {/* 🚪 EVEDIT-2 / D3 — meme signal de sortie que le menu ⋯ :
            il ne rend rien, et il part quand la feuille quitte l arbre. */}
        <SheetExitSignal onExit={runSubscriptionFollowUpExit} />
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventDetails.wellDoneYourEventIs', 'Bravo, ton événement est en ligne')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {remainingEventPublishQuota > 0
                ? t('eventDetails.yourFreeEventCreditHas', 'Ton credit gratuit événement a bien été utilise. Il t en reste {{remainingEventPublishQuota}}{{totalSuffix}}.', { remainingEventPublishQuota, totalSuffix: totalEventPublishQuota > 0 ? `/${totalEventPublishQuota}` : '', ...SANS_ECHAPPEMENT })
                : t('eventDetails.yourFreeEventCreditHas2', 'Ton credit gratuit événement a bien été utilise. Les prochaines publications passeront par une offre Team ou Club.')}
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
              {t('eventDetails.nextStep', 'Suite logique')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('eventDetails.checkYourSubscriptionToSee', 'Consulte ton abonnement pour voir les offres FoundClub, tes quotas restants et les droits qui se debloquent ensuite.')}
            </Text>
          </View>

          <Button
            onPress={handleOpenSubscriptionOverviewFromSheet}
            title={t('eventDetails.seeMySubscription', 'Voir mon abonnement')}
            variant="Primary"
          />
          <Button
            onPress={closeSubscriptionFollowUp}
            title={t('eventDetails.continue', 'Continuer')}
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
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventDetails.joinTheTournament', 'Participer au tournoi')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'eventDetails.chooseWhetherYouCreateYour',
                'Choisis si tu créés ton équipe éphémère ou si tu rejoins une équipe déjà '
                  + 'inscrite.',
              )}
            </Text>
          </View>

          {canCreateCustomTournamentTeam ? (
            <Button
              onPress={() => {
                setIsTournamentParticipationModalVisible(false);
                setIsTournamentCreateModalVisible(true);
              }}
              title={t('eventDetails.createATeamForThe', 'Créer une équipe pour le tournoi')}
              variant="Primary"
            />
          ) : null}

          <Button
            disabled={joinableTournamentTeams.length === 0}
            onPress={() => {
              setIsTournamentParticipationModalVisible(false);
              setIsTournamentJoinSelectorVisible(true);
            }}
            title={t('eventDetails.joinAnExistingTeam', 'Rejoindre une équipe existante')}
            variant="Secondary"
          />

          {joinableTournamentTeams.length === 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'eventDetails.noTeamOpenToRequests',
                'Aucune équipe ouverte aux demandes n est disponible pour le moment.',
              )}
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
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventDetails.openTeams', 'Équipes ouvertes')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'eventDetails.selectATournamentTeamThat',
                'Sélectionne une équipe tournoi qui accepte actuellement de nouvelles demandes.',
              )}
            </Text>
          </View>

          {joinableTournamentTeams.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'eventDetails.noTournamentTeamAcceptsNew',
                'Aucune équipe tournoi n accepte de nouvelles demandes pour le moment.',
              )}
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
                      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{team?.name || t('eventDetails.tournamentTeam', 'Équipe tournoi')}</Text>
                      <Text style={[Fonts.p4, Fonts.primary100]}>
                        {`${rosterSummary.totalCount || 0} membre(s) - demandes ouvertes`}
                      </Text>
                    </View>
                    <Tag
                      style={tournamentDs.getToneTagStyle(Colors.primary500)}
                      text={t('eventDetails.join', 'Rejoindre')}
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
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventDetails.registerMyTeam', 'Inscrire mon équipe')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('eventDetails.selectAClubTeamThe', 'Sélectionne une équipe club. L application creera une équipe éphémère de tournoi sans toucher à ton effectif permanent.')}
            </Text>
          </View>

          {availableTournamentSourceTeams.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('eventDetails.noClubTeamAvailableTo', 'Aucune équipe club disponible à inscrire.')}
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
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {sourceTeam?.name || t('eventDetails.teamFallback', 'Equipe')}
                </Text>
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
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventDetails.createATeam', 'Créer une équipe')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('eventDetails.thisTeamWillOnlyExist', 'Cette équipe n existera que pour ce tournoi. Tu en deviendras automatiquement le capitaine.')}
            </Text>
          </View>

          <TextInput
            onChangeText={setTournamentTeamNameDraft}
            placeholder={t('eventDetails.teamName', 'Nom de l équipe')}
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
              title={t('eventDetails.createMyTeam', 'Créer mon équipe')}
              variant="Primary"
            />
            <Button
              onPress={() => setIsTournamentCreateModalVisible(false)}
              title={t('eventDetails.cancel', 'Annuler')}
              variant="Secondary"
            />
          </View>
        </View>
      </BottomModal>

      {/* AD01 (✍️) — LA FEUILLE DU SCORE.
          🎯 ST-MATCH (écran 9, design validé le 02/10, « 05D Saisir le score ») : « Score
          final », les deux équipes NOMMÉES (plus de « Nous / Eux »), − et + de 44 px, le
          bouton qui dit le score, la suite DANS la feuille, le verrou en orange.
          ⚠️ `snapPoints` est OBLIGATOIRE : sans lui, une `BottomModal` ne peut
          pas porter a la fois un en-tete et un pied (piege D19, deja paye). */}
      <BottomModal
        close={() => setIsMatchScoreSheetVisible(false)}
        isVisible={isMatchScoreSheetVisible}
        snapPoints={['62%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]} testID="st-match-feuille-score">
          {matchScoreSheetStep === 'enregistre' ? (
            <>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                  {t('stMatch.score.saved', 'Score enregistré : {{score}}', {
                    score: `${matchScoreDraft.for} - ${matchScoreDraft.against}`,
                    ...SANS_ECHAPPEMENT,
                  })}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral200]}>
                  {t('stMatch.score.savedBody', 'Les joueurs le voient sur la page du match.')}
                </Text>
              </View>
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
                <View
                  style={[
                    Alignments.alignCenter,
                    Alignments.justifyCenter,
                    {
                      backgroundColor: withAlpha(Colors.primary500, 0.14),
                      borderColor: Colors.primary500,
                      borderRadius: 16,
                      borderWidth: 1,
                      height: 32,
                      width: 32,
                    },
                  ]}
                >
                  <Text style={[Fonts.p2Bold, Fonts.primary200]}>2</Text>
                </View>
                <View style={{ flexShrink: 1 }}>
                  <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                    {t('stMatch.score.nextSheet', 'Ensuite : la feuille de match')}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    {Number(matchStatsReport?.responseEligibleCount) > 0
                      ? t('stMatch.score.responses', {
                        count: Number(matchStatsReport?.responseCompletionCount || 0),
                        defaultValue_one: '{{count}} sur {{total}} a déjà répondu',
                        defaultValue_other: '{{count}} sur {{total}} ont déjà répondu',
                        total: Number(matchStatsReport?.responseEligibleCount),
                        ...SANS_ECHAPPEMENT,
                      })
                      : t('stMatch.carte.sheetDetail', 'Ta note, les buteurs, le temps de jeu')}
                  </Text>
                </View>
              </View>
              <View style={[Spaces.gap[12]]}>
                <Button
                  onPress={() => {
                    setIsMatchScoreSheetVisible(false);
                    openMatchStatsEditor();
                  }}
                  title={t('stMatch.score.openSheet', 'Saisir la feuille')}
                  variant="Primary"
                />
                <Button
                  onPress={() => setIsMatchScoreSheetVisible(false)}
                  title={t('stMatch.score.later', 'Plus tard')}
                  variant="Secondary"
                />
              </View>
            </>
          ) : (
            <>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                  {t('stMatch.score.title', 'Score final')}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {`${matchScoreSides.forName} — ${matchScoreSides.againstName
                    || t('stMatch.score.opponent', 'Adversaire')}`}
                </Text>
                {matchScoreWhen ? (
                  <Text style={[Fonts.p3, Fonts.neutral300]}>{matchScoreWhen}</Text>
                ) : null}
              </View>

              {/* 🔒 Verrouillé : les compteurs s'éteignent (min = max = la valeur), sans
                  toucher au composant partagé par 4 autres écrans. */}
              <View style={[Spaces.gap[8]]}>
                {[
                  {
                    name: matchScoreSides.forName,
                    side: /** @type {'for'} */ ('for'),
                    spoken: matchScoreSides.forName,
                  },
                  {
                    name: matchScoreSides.againstName || t('stMatch.score.opponent', 'Adversaire'),
                    side: /** @type {'against'} */ ('against'),
                    spoken: matchScoreSides.againstName
                      || t('stMatch.score.theOpponent', 'l’adversaire'),
                  },
                ].map((row, index) => (
                  <View key={row.side} style={[Spaces.gap[8]]}>
                    {index === 1 ? (
                      <Text style={[Fonts.h3Black, Fonts.neutral300, Fonts.textCenter]}>-</Text>
                    ) : null}
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
                      <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>
                        {row.name}
                      </Text>
                      <View style={{ width: 168 }}>
                        <InputStepper
                          decrementLabel={t(
                            'stMatch.score.minus',
                            'Un but de moins pour {{team}}',
                            { team: row.spoken, ...SANS_ECHAPPEMENT },
                          )}
                          incrementLabel={t('stMatch.score.plus', 'Un but de plus pour {{team}}', {
                            team: row.spoken, ...SANS_ECHAPPEMENT,
                          })}
                          // FINITIONS11 · point 5 — la bordure pointillée orange de la planche.
                          locked={isMatchScoreLocked}
                          max={isMatchScoreLocked ? matchScoreDraft[row.side] : 99}
                          min={isMatchScoreLocked ? matchScoreDraft[row.side] : 0}
                          onDecrement={() => changeMatchScore(row.side, -1)}
                          onIncrement={() => changeMatchScore(row.side, 1)}
                          tone="tunnel"
                          value={matchScoreDraft[row.side]}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* 🗣️ Une porte fermee DIT pourquoi — en orange (plus en or), derrière le CADENAS
                  (ST-MONMATCH, `cadenas B` : le `lock` de GlyphIcon, dans le même orange). */}
              {isMatchScoreLocked ? (
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                  <GlyphIcon color={Colors.warning500} name="lock" size={16} />
                  <Text style={[Fonts.p3, Fonts.warning500, { flexShrink: 1 }]}>
                    {t(
                      'stMatch.score.locked',
                      'Ce score vient de la fédération ; il ne se modifie pas ici.',
                    )}
                  </Text>
                </View>
              ) : null}
              {!isMatchScoreLocked && hasMatchScoreSaveError ? (
                <Text style={[Fonts.p3, Fonts.error500]}>
                  {t(
                    'stMatch.score.error',
                    'Le score n’a pas pu être enregistré. Vérifie ta connexion, puis réessaie. '
                      + 'Rien n’a été perdu.',
                  )}
                </Text>
              ) : null}

              <View style={[Spaces.gap[12]]}>
                {isMatchScoreLocked ? (
                  <>
                    <Button
                      onPress={() => {
                        setIsMatchScoreSheetVisible(false);
                        openMatchStatsEditor();
                      }}
                      title={t('stMatch.score.openSheet', 'Saisir la feuille')}
                      variant="Primary"
                    />
                    <Button
                      onPress={() => setIsMatchScoreSheetVisible(false)}
                      title={t('stMatch.score.close', 'Fermer')}
                      variant="Secondary"
                    />
                  </>
                ) : (
                  // ST-MONMATCH (écran 9, état 4) — « Enregistrement… » ET la roue : l'atome
                  // la fait tourner à côté du libellé (`keepTitleWhileLoading`).
                  <Button
                    disabled={isMatchScoreSaving}
                    isLoading={isMatchScoreSaving}
                    keepTitleWhileLoading
                    onPress={handleSaveMatchScore}
                    title={(() => {
                      if (isMatchScoreSaving) return t('stMatch.score.saving', 'Enregistrement…');
                      if (hasMatchScoreSaveError) return t('stMatch.score.retry', 'Réessayer');
                      return t('stMatch.score.save', 'Enregistrer {{score}}', {
                        score: `${matchScoreDraft.for} - ${matchScoreDraft.against}`,
                        ...SANS_ECHAPPEMENT,
                      });
                    })()}
                    variant="Primary"
                  />
                )}
              </View>
            </>
          )}
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
                {t('eventDetails.featureIt', 'Mettre à la une')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {t(
                  'eventDetails.chooseWhereYouWantTo',
                  'Choisis ou tu souhaites mettre cet événement en avant.',
                )}
              </Text>
              {featuredScopeOptions.map((option) => {
                const isDisabled = option.status === 'pending' || option.status === 'approved';
                // @ts-ignore: FIXME: Baseline TS regression
                const isSelected = Boolean(selectedFeaturedScopes[option.kind]);
                const statusLabel = getFeaturedScopeStatusLabel(t, option.status);

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
                  title={t('eventDetails.sendTheRequest', 'Envoyer la demande')}
                  variant="Primary"
                />
                <Button
                  onPress={() => setIsFeaturedModalVisible(false)}
                  title={t('eventDetails.cancel', 'Annuler')}
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
                        ? t(
                          'eventDetails.announceTheEstimatedDelayYou',
                          'Annonce le retard estime. Tu confirmeras ensuite ton arrivée réelle.',
                        )
                        : t('eventDetails.late.helper', '0 = a l\'heure. Ajuste la valeur si nécessaire avant validation.')}
                    </Text>
                  </View>

                  {isCoachLateModal ? (
                    <View style={[Spaces.gap[8]]}>
                      <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                        {t('eventDetails.staffNote', 'Note staff')}
                      </Text>
                      <TextInput
                        multiline
                        onChangeText={setLateModalNote}
                        placeholder={t('eventDetails.optional', 'Facultatif')}
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
                      title={t('eventDetails.resetTheCheckIn', 'Réinitialiser le pointage')}
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
