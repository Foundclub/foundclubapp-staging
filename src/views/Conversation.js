/* eslint-disable no-underscore-dangle */
/* eslint-disable react/jsx-props-no-spreading */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as ReactI18next from 'react-i18next';
import 'dayjs/locale/fr';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Keyboard,
  Linking,
  Modal,
  PanResponder,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import {
  Bubble,
  Composer,
  GiftedChat,
  InputToolbar,
  Time,
} from 'react-native-gifted-chat';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import {
  getAuthTokens,
  getManagedMultisportIds,
  getUserRoleKey,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { isFriendlyMatchChat } from '@/domains/messaging/messagingUseCases';
import {
  applyOptimisticPollVote,
  createPollComposition,
} from '@/domains/messaging/pollUseCases';
import useMessaging from '@/domains/messaging/useMessaging';
import {
  getParticipationErrorMessage,
  resolveParticipationFlow,
} from '@/domains/participation/participationFlow';
import {
  hideBlockedMessages,
  resolveOtherParticipantId,
  toBlockedUserIdSet,
} from '@/domains/userBlock/userBlockFilters';
import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ErrorWrapper from '@/components/atoms/errorWrapper/ErrorWrapper';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import CompositionMessageBubble from '@/components/molecules/compositionMessageBubble/CompositionMessageBubble';
import ContactShareBubble from '@/components/molecules/contactShareBubble/ContactShareBubble';
import DocumentMessageBubble from '@/components/molecules/documentMessageBubble/DocumentMessageBubble';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import EventMessageBubble from '@/components/molecules/eventMessageBubble/EventMessageBubble';
import EventShareBubble from '@/components/molecules/eventShareBubble/EventShareBubble';
import LocationShareBubble from '@/components/molecules/locationShareBubble/LocationShareBubble';
import PollMessageBubble from '@/components/molecules/pollMessageBubble/PollMessageBubble';
import ProposalMessageBubble from '@/components/molecules/proposalMessageBubble/ProposalMessageBubble';
import VoiceNoteBubble from '@/components/molecules/voiceNoteBubble/VoiceNoteBubble';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ChatAttachmentSheet from '@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import PollCreationModal from '@/components/organisms/pollCreationModal/PollCreationModal';
import GlobalPromptModal from '@/components/organisms/popup/GlobalPromptModal';
import VenueProposalModal from '@/components/organisms/venueProposalModal/VenueProposalModal';
import { useEventAnswerMutations } from '@/views/event/hooks/useEventAnswerMutations';
import {
  buildFriendlyProposalConfirmation,
  canAcceptFriendlyProposal,
  isFriendlyProposal,
  respondToFriendlyProposal,
} from '@/views/friendlyMatch/friendlyProposalInChat';
import { buildProposalDefaultsFromMatch } from '@/views/league/match/utils/proposalDefaults';
import {
  buildCanonicalLeagueProposalPayload,
  getProposalLocationLabel,
} from '@/views/league/match/utils/proposalPayload';

import { RouteNames } from '@/navigation/routeNames';

import { useGetChatById, useGetChatMessages } from '@/services/chat/chatQueriesCompat';
import {
  cancelRecording,
  deleteVoiceNoteFile,
  isVoiceNoteRecordingSupported,
  startRecording,
  stopRecording,
} from '@/services/chat/voiceNoteService';
import client from '@/services/client';
import { useGetEvents } from '@/services/event/eventQueries';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import { getPendingLeagueActionQueryKey } from '@/services/league/leagueActionQueries';
import {
  cancelMatch,
  createLeagueProposal,
  respondToLeagueProposal,
} from '@/services/league/leagueMatchService';
import { createMessageReport } from '@/services/messageReport/messageReportService';
import { joinReservation } from '@/services/reservation/reservationService';
import {
  useBlockUser,
  useGetMyBlockedUsers,
  useUnblockUser,
} from '@/services/userBlock/userBlockQueries';

import {
  getDocumentCaption,
  getDocumentDisplayName,
  getDocumentPreviewText,
  getPrimaryDocumentAttachment,
  isDocumentAttachment,
} from '@/utils/documentAttachment';
import { getEntityDocumentId } from '@/utils/entityId';
import { isLeagueCaptain } from '@/utils/league/captains';
import { createLogger } from '@/utils/logger/logger';
import { markMessagingPerf } from '@/utils/performance/messagingPerformance';
import safeJsonParse from '@/utils/safeJsonParse';

import { getApiBaseUrl, getPublicApiOrigin } from '@/config/runtimeUrls';
import { LEAGUE_LEGAL_SCOPES } from '@/constants/leagueLegalAcceptance';
import { useAppFeedback } from '@/context/AppFeedbackContext';
import useAudioPlayback from '@/hooks/useAudioPlayback';
import useLeagueLegalAcceptance from '@/hooks/useLeagueLegalAcceptance';
import useSafeTimers from '@/hooks/useSafeTimers';
import { EVENTS } from '@/hooks/useSocket';
import {
  buildFileTooLargeMessage, BYTES_PER_MB, MAX_UPLOAD_IMAGE_BYTES, PHOTO_PICKER_LIMITS,
} from '@/platform/media/photoLimits';
import shareApi from '@/platform/share';

const conversationLogger = createLogger('conversation');

/**
 * @typedef {{
 *   fileName?: string;
 *   fileSize?: number;
 *   name?: string;
 *   size?: number;
 *   type?: string;
 *   uri?: string | null;
 * }} AttachmentAsset
 */

const useTranslationCompat = (
  typeof ReactI18next.useTranslation === 'function'
    ? ReactI18next.useTranslation
    : () => ({ i18n, t: (/** @type {string} */ key, /** @type {any} */ options) => i18n.t(key, options) })
);
/**
 * @param {unknown} rawValue
 * @param {boolean} [defaultValue]
 * @returns {boolean}
 */
const isFlagEnabled = (rawValue, defaultValue = false) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') return defaultValue;
  const normalized = String(rawValue || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const isDocumentPickerDisabled = isFlagEnabled(process.env.FC_DISABLE_DOCUMENT_PICKER);
const isAttachmentSheetV2Enabled = isFlagEnabled(process.env.FC_CHAT_ATTACHMENT_SHEET_V2, true);
const isChatRetryEnabled = isFlagEnabled(process.env.FC_CHAT_MESSAGE_RETRY_V1, true);
const isSocketReadTypingEnabled = isFlagEnabled(process.env.FC_CHAT_SOCKET_READ_TYPING_V1, true);
const isVoiceNotesEnabled = isFlagEnabled(process.env.FC_CHAT_VOICE_NOTES, true);
const isVoiceDiagnosticsEnabled = __DEV__ || isFlagEnabled(process.env.FC_CHAT_VOICE_DEBUG, false);
const isLocationShareEnabled = isFlagEnabled(process.env.FC_CHAT_SHARE_LOCATION, true);
const isContactShareEnabled = isFlagEnabled(process.env.FC_CHAT_SHARE_CONTACT, true);
const isEventShareEnabled = isFlagEnabled(process.env.FC_CHAT_SHARE_EVENT, true);
const isAttachmentDebugEnabled = isFlagEnabled(process.env.FC_CHAT_ATTACHMENT_DEBUG, false);
// MSG1/N5 — au plus un « untel ecrit... » par seconde et par personne.
const TYPING_START_THROTTLE_MS = 1000;
const VOICE_GESTURE_CANCEL_THRESHOLD = -64;
const VOICE_GESTURE_LOCK_THRESHOLD = -64;
const VOICE_WAVEFORM_MAX_BARS = 32;
const VOICE_WAVEFORM_VISIBLE_BARS = 20;
const MESSAGE_REPLY_SWIPE_THRESHOLD = 44;
const MESSAGE_REPLY_SWIPE_ACTION_WIDTH = 68;
const VOICE_RECORDING_STATES = {
  error: 'error',
  idle: 'idle',
  locked: 'locked',
  recording: 'recording',
  sending: 'sending',
};

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * @param {unknown} metering
 * @param {number} [durationMs]
 * @param {number} [index]
 * @returns {number}
 */
const toVoiceWaveBarHeight = (metering, durationMs = 0, index = 0) => {
  const parsedMetering = Number(metering);
  if (Number.isFinite(parsedMetering)) {
    // Already-rendered heights from previous drafts/messages.
    if (parsedMetering >= 4 && parsedMetering <= 36) {
      return clampNumber(Math.round(parsedMetering), 4, 20);
    }
    let ratio = 0;
    // Most metering values are in dB scale (e.g. -160 to 0).
    if (parsedMetering <= 10 && parsedMetering >= -200) {
      ratio = (parsedMetering + 120) / 120;
    } else if (parsedMetering >= 0 && parsedMetering <= 1.2) {
      ratio = parsedMetering;
    } else if (parsedMetering > 1.2 && parsedMetering <= 220) {
      ratio = parsedMetering / 180;
    }
    ratio = clampNumber(ratio, 0, 1);
    return Math.round(4 + (ratio * 16));
  }

  // Fallback animation when metering is unavailable on the platform/build.
  const phase = ((Number(durationMs) || 0) / 180) + (index * 0.8);
  const value = (Math.sin(phase) + 1) / 2;
  return Math.round(5 + (value * 13));
};
const NON_EDITABLE_MESSAGE_COMPOSITION_TYPES = new Set([
  'contact_share',
  'event_share',
  'location_share',
  'poll',
  'proposal',
  'voice_note',
]);

/**
 * @param {unknown} value
 * @returns {'a' | 'b' | ''}
 */
const normalizeLeagueTeamSide = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'a' || normalized === 'b' ? normalized : '';
};

/**
 * @param {Set<string>} ids
 * @param {any} userLike
 */
const addLeagueTeamUserId = (ids, userLike) => {
  [
    getEntityDocumentId(userLike),
    userLike?.documentId,
    userLike?.id,
  ].forEach((candidateId) => {
    const normalizedId = String(candidateId || '').trim();
    if (normalizedId) ids.add(normalizedId);
  });
};

/**
 * @param {any} team
 * @returns {Set<string>}
 */
const collectLeagueTeamUserIds = (team) => {
  const ids = /** @type {Set<string>} */ (new Set());
  addLeagueTeamUserId(ids, team?.captain);
  if (Array.isArray(team?.co_captains)) {
    team.co_captains.forEach((/** @type {any} */ captain) => addLeagueTeamUserId(ids, captain));
  }

  ['roster', 'members', 'players'].forEach((key) => {
    if (!Array.isArray(team?.[key])) return;
    team[key].forEach((/** @type {any} */ member) => addLeagueTeamUserId(ids, member));
  });

  return ids;
};

/**
 * @param {any} message
 * @returns {string}
 */
const getMessageEntityId = (message) => String(
  message?.documentId
  || message?._id
  || message?.id
  || '',
).trim();

/**
 * @param {any} message
 * @returns {string}
 */
const getMessageSenderId = (message) => String(
  message?.senderDocumentId
  || message?.sender?.documentId
  || message?.sender?.id
  || message?.user?._id
  || '',
).trim();

/** @type {any | null | undefined} */
let clipboardModule;
const getClipboardModule = () => {
  if (clipboardModule !== undefined) return clipboardModule;
  try {
    // eslint-disable-next-line global-require
    const maybeModule = require('@react-native-clipboard/clipboard');
    clipboardModule = maybeModule?.default || maybeModule;
    return clipboardModule;
  } catch (_error) {
    clipboardModule = null;
    return null;
  }
};

/**
 *
 * @param {object} props
 * @param {string} [props.color]
 * @returns {import('react').ReactElement}
 */
function MicrophoneGlyph({ color = '#ffffff' }) {
  return (
    <Svg fill="none" height={16} viewBox="0 0 24 24" width={16}>
      <Rect height={11} rx={3.5} stroke={color} strokeWidth={1.8} width={7} x={8.5} y={3} />
      <Path d="M6.5 11.5C6.5 15.0899 8.91015 17.5 12 17.5C15.0899 17.5 17.5 15.0899 17.5 11.5" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
      <Path d="M12 17.5V21" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
      <Path d="M9.5 21H14.5" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
    </Svg>
  );
}
// Y01 — le plafond des IMAGES et sa phrase viennent desormais de
// `@/platform/media/photoLimits` : c'etait la seule verite du depot sur la
// taille d'une photo, et elle etait recopiee ici. Les trois autres plafonds
// (son, video, divers) restent propres a la messagerie.
const MAX_ATTACHMENT_BYTES = {
  audio: 20 * BYTES_PER_MB,
  default: 25 * BYTES_PER_MB,
  image: MAX_UPLOAD_IMAGE_BYTES,
  video: 80 * BYTES_PER_MB,
};

/**
 * @param {unknown} rawApiUrl
 * @returns {string}
 */
const toPublicApiOrigin = (rawApiUrl) => {
  const raw = String(rawApiUrl || '').trim();
  if (!raw) return getPublicApiOrigin() || 'http://localhost:1337';
  return raw.replace(/\/api\/?$/i, '');
};

/**
 * @param {unknown} rawApiUrl
 * @returns {string}
 */
const toApiBaseUrl = (rawApiUrl) => {
  const raw = String(rawApiUrl || '').trim();
  if (!raw) return getApiBaseUrl() || 'http://localhost:1337/api';
  const withoutTrailingSlash = raw.replace(/\/+$/g, '');
  if (/\/api$/i.test(withoutTrailingSlash)) return withoutTrailingSlash;
  return `${withoutTrailingSlash}/api`;
};

/**
 * @param {unknown} host
 * @returns {boolean}
 */
const isLoopbackHost = (host) => ['10.0.2.2', '127.0.0.1', 'localhost']
  .includes(String(host || '').trim().toLowerCase());

/**
 * @param {unknown} meta
 * @returns {string}
 */
const formatDiagnosticMeta = (meta) => {
  if (!meta || typeof meta !== 'object') return '';
  try {
    const serialized = JSON.stringify(meta);
    return serialized && serialized !== '{}' ? ` ${serialized}` : '';
  } catch (_error) {
    return '';
  }
};

/** @type {any | null | undefined} */
let cachedDocumentPickerModule;

const getDocumentPickerModule = () => {
  if (cachedDocumentPickerModule !== undefined) return cachedDocumentPickerModule;

  try {
    // Lazy load to avoid boot-time crashes when native module is missing on a stale build.
    // eslint-disable-next-line global-require
    const pickerModule = /** @type {any} */ (require('@react-native-documents/picker'));
    cachedDocumentPickerModule = pickerModule?.default || pickerModule;
    return cachedDocumentPickerModule;
  } catch (_error) {
    cachedDocumentPickerModule = null;
    return null;
  }
};

/**
 * @param {any} documentPicker
 * @param {any} error
 * @returns {boolean}
 */
const isDocumentPickerCancellation = (documentPicker, error) => (
  (
    typeof documentPicker?.isErrorWithCode === 'function'
    && !!documentPicker?.errorCodes?.OPERATION_CANCELED
    && documentPicker.isErrorWithCode(error)
    && error?.code === documentPicker.errorCodes.OPERATION_CANCELED
  )
  || (typeof documentPicker?.isCancel === 'function' && documentPicker.isCancel(error))
);

/**
 * PERF2 — une bulle factice du squelette de premiere ouverture.
 *
 * Une `View` avec son propre fond, JAMAIS du texte ni une vraie bulle :
 * tant que `SkeletonLoader` n a pas mesure son cadre, il rend ses enfants
 * NUS — du contenu factice ferait un eclair de faux fil.
 * @param {object} props
 * @param {number} props.height
 * @param {boolean} [props.mine] la bulle part-elle de moi (alignee a droite) ?
 * @param {string} props.width
 * @returns {import('react').ReactElement}
 */
function SkeletonBubble({ height, mine = false, width }) {
  const { Colors } = useTheme();
  return (
    <View style={{
      alignSelf: mine ? 'flex-end' : 'flex-start',
      backgroundColor: Colors.primary700,
      borderRadius: 16,
      height,
      width,
    }}
    />
  );
}

/**
 * Chat conversation screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Conversation screen component
 */
function Conversation({ navigation, route }) {
  const chatId = String(
    route?.params?.chatId
    || route?.params?.chatDocumentId
    || route?.params?.id
    || '',
  ).trim();
  const { t } = /** @type {{ t: (key: string, options?: any) => string }} */ (useTranslationCompat());
  const { hasClubAccess, userData } = useAuth();
  const { showBanner } = useAppFeedback();
  const { leagueLegalAcceptanceModal, requestLeagueLegalAcceptance } = useLeagueLegalAcceptance();
  const { clearSafeTimer, setSafeTimeout } = useSafeTimers();
  const shouldAvoidDeprecatedSystemBarColors = Platform.OS === 'android'
    && typeof Platform.Version === 'number'
    && Platform.Version >= 35;

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [conversationPrompt, setConversationPrompt] = useState(/** @type {any | null} */ (null));
  const uploadInFlightRef = useRef(false);
  // MSG1/N5 — la derniere fois qu'on a prevenu le serveur qu'on ecrit.
  const lastTypingStartSentAtRef = useRef(0);
  const closeConversationPrompt = useCallback(() => {
    setConversationPrompt(null);
  }, []);
  const openConversationPrompt = useCallback((/** @type {any} */ promptConfig) => {
    setConversationPrompt(promptConfig);
  }, []);
  const showErrorBanner = useCallback((/** @type {unknown} */ body, /** @type {string} */ title = 'Erreur') => {
    showBanner({
      body: String(body || '').trim() || 'Une erreur est survenue.',
      title,
      tone: 'error',
    });
  }, [showBanner]);
  const showSuccessBanner = useCallback((
    /** @type {unknown} */ body,
    /** @type {string} */ title = 'Succès',
    /** @type {'success' | 'info' | 'error' | 'league'} */ tone = 'success',
  ) => {
    showBanner({
      body: String(body || '').trim(),
      title,
      tone,
    });
  }, [showBanner]);
  const showInfoBanner = useCallback((
    /** @type {unknown} */ body,
    /** @type {string} */ title = 'Information',
    /** @type {'success' | 'info' | 'error' | 'league'} */ tone = 'info',
  ) => {
    showBanner({
      body: String(body || '').trim(),
      title,
      tone,
    });
  }, [showBanner]);
  const formatDateForGoogleCalendar = (/** @type {string | number | Date} */ dateInput) => {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return null;
    const pad = (/** @type {string | number} */ value) => String(value).padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  };

  const promptAddMatchToCalendar = (/** @type {any} */ message) => {
    const startIso = message?.composition?.date || chatData?.league_match?.date;
    const venue = getProposalLocationLabel(message?.composition?.venue)
      || getProposalLocationLabel(chatData?.league_match?.venue)
      || getProposalLocationLabel(chatData?.league_match?.proposed_venue)
      || '';
    if (!startIso) return;

    const startDate = new Date(startIso);
    if (Number.isNaN(startDate.getTime())) return;
    const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
    const startParam = formatDateForGoogleCalendar(startDate);
    const endParam = formatDateForGoogleCalendar(endDate);
    if (!startParam || !endParam) return;

    showBanner({
      actionLabel: 'Agenda',
      body: 'Match confirme. Tu peux l ajouter à ton agenda.',
      durationMs: 7000,
      onAction: async () => {
        const text = encodeURIComponent('Match FoundClub League');
        const details = encodeURIComponent('Match confirme depuis la messagerie League');
        const location = encodeURIComponent(venue);
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startParam}/${endParam}&details=${details}&location=${location}`;
        try {
          await Linking.openURL(url);
        } catch (error) {
          conversationLogger.warn('Failed to open calendar URL', error);
          showErrorBanner("Impossible d'ouvrir ton agenda.", 'Agenda');
        }
      },
      title: 'Match confirme',
      tone: 'league',
    });
  };

  const {
    deleteMessage,
    editMessage,
    getConversationName,
    isSocketConnected,
    removeGroupMember,
    retryFailedMessage,
    sendMessage,
    sendReadReceipt,
    sendTypingStart,
    sendTypingStop,
    socket,
    updateGroupMeta,
    votePoll,
  } = useMessaging(chatId);

  const logAttachmentDebug = useCallback((/** @type {string} */ message, /** @type {any} */ meta = undefined) => {
    if (!isAttachmentDebugEnabled) return;
    conversationLogger.debug(`[attachment-debug] ${message}`, meta);
  }, []);

  const logVoiceDiagnostic = useCallback((/** @type {string} */ stage, /** @type {any} */ meta = undefined) => {
    if (!isVoiceDiagnosticsEnabled) return;
    conversationLogger.warn(`[voice-diag] ${stage}${formatDiagnosticMeta(meta)}`);
  }, []);

  const describeAsset = useCallback((/** @type {any} */ asset) => {
    const uri = String(asset?.uri || '');
    const uriScheme = uri.includes(':') ? uri.split(':')[0] : 'unknown';
    return {
      fileName: String(asset?.fileName || ''),
      hasUri: Boolean(uri),
      size: Number(asset?.fileSize || asset?.size || 0) || 0,
      type: String(asset?.type || ''),
      uriScheme,
    };
  }, []);

  const describeUploadItems = useCallback((/** @type {any[] | undefined | null} */ items) => (
    Array.isArray(items)
      ? items.map((/** @type {any} */ item) => ({
        documentId: item?.documentId ?? null,
        id: item?.id ?? null,
        mime: item?.mime ?? null,
        name: item?.name ?? null,
        size: item?.size ?? null,
        url: item?.url ?? null,
      }))
      : []
  ), []);

  const isTransientNetworkUploadError = useCallback((/** @type {any} */ error) => {
    const rawErrorMessage = (
      typeof error === 'string'
        ? error
        : String(error?.message || error || '')
    ).toLowerCase();
    const hasHttpResponse = typeof error === 'object'
      && error !== null
      && Boolean(error?.response);
    const errorCode = typeof error === 'object' && error !== null
      ? error?.code
      : undefined;

    return !hasHttpResponse
      && (
        rawErrorMessage.includes('network error')
        || rawErrorMessage.includes('network request failed')
        || rawErrorMessage.includes('failed to fetch')
        || errorCode === 'ECONNABORTED'
      );
  }, []);

  const buildAttachmentUploadErrorMessage = useCallback((/** @type {any} */ error) => {
    const responseStatus = Number(error?.response?.status || 0);
    const rawErrorMessage = String(
      error?.response?.data?.error?.message
      || error?.response?.data?.message
      || error?.message
      || '',
    ).toLowerCase();
    if (rawErrorMessage.includes('voice_socket_unavailable')) {
      return 'Socket chat indisponible avant la création du message.';
    }
    if (rawErrorMessage.includes('voice_upload_failed')) {
      return 'Upload audio incomplet. Aucun fichier exploitable reçu.';
    }
    if (rawErrorMessage.includes('voice_file_empty')) {
      return 'Le fichier audio local est vide.';
    }
    if (rawErrorMessage.includes('voice note requires an audio attachment')) {
      return 'La note vocale a bien été enregistrée, mais le serveur n a pas reconnu le fichier audio. Réessaie.';
    }
    if (rawErrorMessage.includes('voice_module_unavailable')) {
      return 'Le module vocal n est pas disponible sur cette build.';
    }
    if (responseStatus === 413 || rawErrorMessage.includes('too large') || rawErrorMessage.includes('payload too large')) {
      return 'La pièce jointe est trop volumineuse pour être envoyée.';
    }
    if (responseStatus === 401 || responseStatus === 403) {
      return 'Session invalide. Reconnecte-te puis réessaie.';
    }
    if (isTransientNetworkUploadError(error)) {
      return 'Connexion instable. Vérifie ton réseau puis réessaie.';
    }
    if (rawErrorMessage.includes('invalid attachment')) {
      return 'Format de pièce jointe invalide.';
    }
    return "Impossible d'envoyer cette pièce jointe.";
  }, [isTransientNetworkUploadError]);

  const getAttachmentExtensionFromAsset = useCallback((/** @type {any} */ asset) => {
    const rawFileName = String(asset?.fileName || '').trim();
    const rawUri = String(asset?.uri || '').trim();
    const rawType = String(asset?.type || '').trim().toLowerCase();

    const extractExtension = (/** @type {unknown} */ value) => {
      const sanitized = String(value || '').split('?')[0].split('#')[0];
      const lastDotIndex = sanitized.lastIndexOf('.');
      if (lastDotIndex < 0) return '';
      return sanitized.slice(lastDotIndex + 1).trim().toLowerCase();
    };

    const fileNameExtension = extractExtension(rawFileName);
    if (fileNameExtension) return fileNameExtension;

    const uriExtension = extractExtension(rawUri.replace(/^file:\/\//i, ''));
    if (uriExtension) return uriExtension;

    if (rawType.startsWith('audio/mp4')) return 'mp4';
    if (rawType.startsWith('audio/')) return rawType.split('/')[1] || 'm4a';
    if (rawType.startsWith('video/')) return rawType.split('/')[1] || 'mp4';
    if (rawType.startsWith('image/')) return rawType.split('/')[1] || 'jpg';
    if (rawType.includes('/')) return rawType.split('/')[1] || 'bin';
    return 'bin';
  }, []);

  const getAttachmentSizeLimit = useCallback((/** @type {unknown} */ assetType) => {
    const normalizedType = String(assetType || '').toLowerCase();
    if (normalizedType.startsWith('image/')) return MAX_ATTACHMENT_BYTES.image;
    if (normalizedType.startsWith('video/')) return MAX_ATTACHMENT_BYTES.video;
    if (normalizedType.startsWith('audio/')) return MAX_ATTACHMENT_BYTES.audio;
    return MAX_ATTACHMENT_BYTES.default;
  }, []);

  const validateAttachmentAsset = useCallback((/** @type {any} */ asset) => {
    const hasUri = Boolean(String(asset?.uri || '').trim());
    const normalizedType = String(asset?.type || '').trim().toLowerCase();
    const normalizedSize = Number(asset?.fileSize || asset?.size || 0) || 0;
    if (!hasUri) {
      return {
        reason: 'missing_uri',
        userMessage: 'Impossible de lire ce fichier.',
      };
    }

    if (
      normalizedType
      && !(
        normalizedType.startsWith('image/')
        || normalizedType.startsWith('video/')
        || normalizedType.startsWith('audio/')
        || normalizedType.startsWith('application/')
        || normalizedType.startsWith('text/')
      )
    ) {
      return {
        reason: 'unsupported_type',
        userMessage: 'Type de fichier non pris en charge.',
      };
    }

    const maxBytes = getAttachmentSizeLimit(normalizedType);
    if (normalizedSize > 0 && normalizedSize > maxBytes) {
      return {
        reason: 'file_too_large',
        userMessage: buildFileTooLargeMessage(maxBytes),
      };
    }

    return null;
  }, [getAttachmentSizeLimit]);

  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isMessageActionsVisible, setIsMessageActionsVisible] = useState(false);
  const [isEditMessageModalVisible, setIsEditMessageModalVisible] = useState(false);
  const [isGroupManagementVisible, setIsGroupManagementVisible] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [isGroupMutationLoading, setIsGroupMutationLoading] = useState(false);
  const [isEditMessageSubmitting, setIsEditMessageSubmitting] = useState(false);
  const [isEditMessageUploadingAttachment, setIsEditMessageUploadingAttachment] = useState(false);
  const [editMessageText, setEditMessageText] = useState('');
  const [editMessageAttachments, setEditMessageAttachments] = useState(/** @type {any[]} */ ([]));
  const [selectedMessage, setSelectedMessage] = useState(
    /**
     * @type {import('react-native-gifted-chat').IMessage & {documentId: string} | undefined}
     */ (undefined),
  );
  const {
    data: rawMessagesPages,
    error: messagesError,
    fetchNextPage,
    hasNextPage,
    isError: isMessagesError,
    isFetching: isMessagesFetching,
    isLoading: isMessagesLoading,
    refetch: refetchMessages,
  } = useGetChatMessages({ chatId });
  const messagesPages = /** @type {any} */ (rawMessagesPages);
  const { data: rawChatData } = useGetChatById(chatId);
  const chatData = /** @type {any} */ (rawChatData);
  const leagueLegalMatchLabel = useMemo(() => {
    const match = chatData?.league_match;
    if (!match) return 'Match FoundClub League';
    return `${match?.team_a?.name || 'Équipe A'} VS ${match?.team_b?.name || 'Adversaire'}`;
  }, [chatData?.league_match]);
  const pendingLeagueActionTeamId = useMemo(() => {
    const currentUserId = String(userData?.documentId || '').trim();
    if (!currentUserId) return '';

    const teamA = chatData?.league_match?.team_a;
    if (isLeagueCaptain(teamA, currentUserId)) {
      return getEntityDocumentId(teamA) || '';
    }

    const teamB = chatData?.league_match?.team_b;
    if (isLeagueCaptain(teamB, currentUserId)) {
      return getEntityDocumentId(teamB) || '';
    }

    return String(userData?.team?.documentId || '').trim();
  }, [
    chatData?.league_match?.team_a,
    chatData?.league_match?.team_b,
    userData?.documentId,
    userData?.team?.documentId,
  ]);
  const isGroupChat = chatData?.type === 'group';
  const groupAdminIds = useMemo(() => {
    if (!Array.isArray(chatData?.groupAdmins)) return [];
    return chatData.groupAdmins
      .map((/** @type {any} */ admin) => String(admin?.documentId || admin?.id || ''))
      .filter(Boolean);
  }, [chatData?.groupAdmins]);
  const isGroupAdmin = isGroupChat && groupAdminIds.includes(String(userData?.documentId || ''));

  // 🚫 BLOQUER (K3) — LE SECOND ENDROIT QU APPLE REGARDE : le menu du fil.
  //
  // 🧒 K5 — « strictement a deux ». `resolveOtherParticipantId` ne rend
  // quelqu un que pour un `whisper` a EXACTEMENT deux participants : le fil
  // « Contact mineur » (enfant + parent + encadrant) en compte trois, il n a
  // donc pas de bouton « Bloquer » et ne se ferme jamais. Meme regle, meme
  // condition, qu au serveur.
  const otherParticipantId = useMemo(
    () => resolveOtherParticipantId(chatData, userData?.documentId),
    [chatData, userData?.documentId],
  );
  const { data: myBlockedRows } = useGetMyBlockedUsers({ enabled: Boolean(userData?.documentId) });
  const blockedUserIds = useMemo(() => toBlockedUserIdSet(myBlockedRows), [myBlockedRows]);
  const isOtherParticipantBlocked = Boolean(
    otherParticipantId && blockedUserIds.has(otherParticipantId),
  );
  const { isPending: isBlockingUser, mutate: blockOtherParticipant } = useBlockUser();
  const { isPending: isUnblockingUser, mutate: unblockOtherParticipant } = useUnblockUser();

  useEffect(() => {
    if (!isGroupChat) return;
    setGroupNameDraft(String(chatData?.groupName || ''));
  }, [chatData?.groupName, isGroupChat]);

  const [isEventShareModalVisible, setIsEventShareModalVisible] = useState(false);
  const {
    data: rawSharedEventsPages,
    isFetching: isLoadingSharedEvents,
  } = useGetEvents(
    {
      compact: true,
      excludeType: 'Réservation',
      myTeams: true,
      pageSize: 20,
      sort: 'date:asc',
    },
    {
      enabled: isEventShareEnabled && isEventShareModalVisible,
      refetchOnMount: false,
      staleTime: 30_000,
    },
  );
  const sharedEventsPages = /** @type {any} */ (rawSharedEventsPages);

  const shareableEvents = useMemo(() => {
    if (!Array.isArray(sharedEventsPages?.pages)) return [];
    const seen = new Set();
    /** @type {any[]} */
    const events = [];

    sharedEventsPages.pages.forEach((/** @type {{ data?: any[] }} */ page) => {
      if (!Array.isArray(page?.data)) return;
      page.data.forEach((/** @type {any} */ event) => {
        const eventId = String(event?.documentId || event?.id || '');
        if (!eventId || seen.has(eventId)) return;
        seen.add(eventId);
        events.push(event);
      });
    });

    return events.slice(0, 40);
  }, [sharedEventsPages?.pages]);

  const shareableContacts = useMemo(() => {
    const participants = Array.isArray(chatData?.participants) ? chatData.participants : [];
    return participants
      .filter((/** @type {any} */ participant) => participant?.documentId && participant.documentId !== userData?.documentId)
      .map((/** @type {any} */ participant) => ({
        avatar: participant?.avatar,
        documentId: participant?.documentId,
        firstname: participant?.firstname || '',
        lastname: participant?.lastname || '',
        role: participant?.role?.name || participant?.role?.type || '',
      }));
  }, [chatData?.participants, userData?.documentId]);

  const canRecordVoiceNote = useMemo(() => {
    if (!isVoiceNotesEnabled) return false;
    try {
      return isVoiceNoteRecordingSupported();
    } catch (error) {
      const safeError = /** @type {any} */ (error);
      conversationLogger.warn('Voice note capability check failed', {
        message: safeError?.message,
      });
      return false;
    }
  }, []);

  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  // Safe area insets (notch + home indicator)
  const { bottom, top } = useSafeAreaInsets();
  const safeBottomInset = Math.max(bottom, 10);
  const composerBottomInset = Platform.OS === 'ios' ? Math.max(bottom, 14) : 10;
  const giftedChatBottomOffset = Platform.OS === 'ios' ? 0 : safeBottomInset;
  const apiBaseUrl = useMemo(() => toApiBaseUrl(getApiBaseUrl()), []);
  const publicApiOrigin = useMemo(() => toPublicApiOrigin(getPublicApiOrigin()), []);
  const HEADER_SIDE_WIDTH = 56;
  const resolveMediaUri = useCallback((/** @type {unknown} */ rawUri) => {
    const uri = String(rawUri || '').trim();
    if (!uri) return '';

    if (/^(https?:\/\/|file:\/\/|content:\/\/|data:image\/)/i.test(uri)) {
      if (/^https?:\/\//i.test(uri)) {
        try {
          const currentUrl = new URL(uri);
          const apiOriginUrl = new URL(publicApiOrigin);
          if (isLoopbackHost(currentUrl.hostname) && !isLoopbackHost(apiOriginUrl.hostname)) {
            return `${apiOriginUrl.origin}${currentUrl.pathname}${currentUrl.search || ''}`;
          }
        } catch (_error) {
          // Keep original URI when parsing fails.
        }
      }
      return uri;
    }

    if (uri.startsWith('//')) {
      return `https:${uri}`;
    }

    const normalizedPath = uri.startsWith('/') ? uri : `/${uri}`;
    return `${publicApiOrigin}${normalizedPath}`;
  }, [publicApiOrigin]);

  const fetchAttachmentUrlById = useCallback(async (/** @type {string | number} */ attachmentId) => {
    const numericId = Number(attachmentId);
    if (!Number.isInteger(numericId) || numericId <= 0) return '';

    try {
      const response = await client.get(`/upload/files/${numericId}`);
      const file = response?.data || {};
      const candidates = [
        file?.url,
        file?.formats?.large?.url,
        file?.formats?.medium?.url,
        file?.formats?.small?.url,
        file?.formats?.thumbnail?.url,
        file?.previewUrl,
      ];

      for (let i = 0; i < candidates.length; i += 1) {
        const resolved = resolveMediaUri(candidates[i]);
        if (resolved) return resolved;
      }
    } catch (error) {
      const safeError = /** @type {any} */ (error);
      logAttachmentDebug('fetchAttachmentUrlById failed', {
        attachmentId: numericId,
        error: safeError?.message || safeError,
      });
    }

    return '';
  }, [logAttachmentDebug, resolveMediaUri]);

  const normalizeAttachmentItem = useCallback((/** @type {any} */ item) => {
    if (!item || typeof item !== 'object') return null;
    if (item?.attributes && typeof item.attributes === 'object') {
      return {
        ...item,
        ...item.attributes,
      };
    }
    return item;
  }, []);

  const normalizeMessageAttachments = useCallback((/** @type {any} */ rawAttachments) => {
    if (Array.isArray(rawAttachments)) {
      return rawAttachments
        .map((/** @type {any} */ item) => normalizeAttachmentItem(item))
        .filter(Boolean);
    }

    if (rawAttachments && Array.isArray(rawAttachments?.data)) {
      return rawAttachments.data
        .map((/** @type {any} */ item) => normalizeAttachmentItem(item))
        .filter(Boolean);
    }

    if (rawAttachments?.data && typeof rawAttachments.data === 'object') {
      const normalizedSingle = normalizeAttachmentItem(rawAttachments.data);
      return normalizedSingle ? [normalizedSingle] : [];
    }

    if (rawAttachments && typeof rawAttachments === 'object') {
      const normalizedObject = normalizeAttachmentItem(rawAttachments);
      return normalizedObject ? [normalizedObject] : [];
    }

    return [];
  }, [normalizeAttachmentItem]);

  const isImageAttachmentMessage = useCallback((/** @type {any} */ message) => {
    const attachment = normalizeMessageAttachments(message?.attachments)?.[0] || {};
    const attachmentUrl = String(attachment?.url || '').toLowerCase();
    const attachmentMime = String(attachment?.mime || '').toLowerCase();
    const attachmentName = String(attachment?.name || '').toLowerCase();
    const attachmentExt = String(attachment?.ext || '').toLowerCase();
    const imageUri = String(message?.image || '').toLowerCase();

    return attachmentMime.startsWith('image/')
      || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(attachmentUrl)
      || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(attachmentName)
      || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(attachmentExt)
      || imageUri.startsWith('data:image/');
  }, [normalizeMessageAttachments]);

  const getPrimaryImageUriFromMessage = useCallback((/** @type {any} */ message) => {
    const attachment = normalizeMessageAttachments(message?.attachments)?.[0] || {};
    const candidates = [
      message?.image,
      attachment?.url,
      attachment?.formats?.large?.url,
      attachment?.formats?.medium?.url,
      attachment?.formats?.small?.url,
      attachment?.formats?.thumbnail?.url,
      attachment?.previewUrl,
      attachment?.uri,
    ];

    for (let i = 0; i < candidates.length; i += 1) {
      const resolved = resolveMediaUri(candidates[i]);
      if (resolved) return resolved;
    }

    return '';
  }, [normalizeMessageAttachments, resolveMediaUri]);

  const { isPending: isReportingMessage, mutate: reportMessage } = useMutation({
    mutationFn: createMessageReport,
    onSuccess: () => {
      setIsReportModalVisible(false);
      setSelectedMessage(undefined);
      showSuccessBanner(
        t('conversation.modals.reportSuccess.description'),
        t('conversation.modals.reportSuccess.title'),
      );
    },
  });

  const [typingUsers, setTypingUsers] = useState(new Set());
  const [replyingTo, setReplyingTo] = useState(/** @type {(import('react-native-gifted-chat').IMessage & {documentId?: string}) | null} */ (null));
  const [composerText, setComposerText] = useState('');
  const [pendingMediaDraft, setPendingMediaDraft] = useState(
    /** @type {{ asset: AttachmentAsset } | null} */ (null),
  );
  const [pendingVoiceDraft, setPendingVoiceDraft] = useState(
    /** @type {{
     *  durationMs: number;
     *  fileName: string;
     *  diagnostics?: {
     *    maxDb: number | null;
     *    minDb: number | null;
     *    rangeDb: number;
     *    sampleCount: number;
     *    waveformSource: 'metering' | 'fallback';
     *  };
     *  mime: string;
     *  size: number;
     *  uri: string;
     *  waveform: number[];
     * } | null} */
    (null),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isAttachmentMenuVisible, setIsAttachmentMenuVisible] = useState(false);
  const [isPollModalVisible, setIsPollModalVisible] = useState(false);
  const [isProposalModalVisible, setIsProposalModalVisible] = useState(false);
  const [isProposalSubmitting, setIsProposalSubmitting] = useState(false);
  const [isProposalResponseSubmitting, setIsProposalResponseSubmitting] = useState(false);
  const [, setCounterProposalContext] = useState(
    /** @type {{ messageId: string; shouldDecline: boolean } | null} */ (null),
  );
  const [isLocationShareModalVisible, setIsLocationShareModalVisible] = useState(false);
  const [isContactShareModalVisible, setIsContactShareModalVisible] = useState(false);
  const [selectedLocationOption, setSelectedLocationOption] = useState(/** @type {any} */ (undefined));
  const [selectedContactId, setSelectedContactId] = useState('');
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [didTryImageHttpsFallback, setDidTryImageHttpsFallback] = useState(false);
  const handledSharedEventFromPickerRef = useRef('');
  const sharedEventPreviewByIdRef = useRef(new Map());
  const messageContainerRef = useRef(null);
  const conversationOpenLoggedChatIdRef = useRef('');
  const conversationPrimaryLoggedChatIdRef = useRef('');
  const conversationFirstRenderedChatIdRef = useRef('');
  const swipeableMessageRefs = useRef(new Map());
  const consumedNegotiationFocusKeyRef = useRef('');
  const pendingAttachmentActionRef = useRef(
    /** @type {null | (() => Promise<void> | void)} */ (null),
  );

  const [voiceRecordingState, setVoiceRecordingState] = useState(VOICE_RECORDING_STATES.idle);
  const [voiceRecordingDurationMs, setVoiceRecordingDurationMs] = useState(0);
  const [voiceRecordingHint, setVoiceRecordingHint] = useState('');
  const [voiceRecordingWaveform, setVoiceRecordingWaveform] = useState(/** @type {number[]} */ ([]));
  const loggedAttachmentShapeMessageIdsRef = useRef(new Set());
  const voiceRecordingStateRef = useRef(VOICE_RECORDING_STATES.idle);
  const voiceWaveformTickRef = useRef(0);

  const isVoiceRecording = voiceRecordingState === VOICE_RECORDING_STATES.recording
    || voiceRecordingState === VOICE_RECORDING_STATES.locked
    || voiceRecordingState === VOICE_RECORDING_STATES.sending;
  const isVoiceRecordingLocked = voiceRecordingState === VOICE_RECORDING_STATES.locked;
  const isSendingVoiceNote = voiceRecordingState === VOICE_RECORDING_STATES.sending;
  const hasActiveVoiceSession = isVoiceRecording || isVoiceRecordingLocked || isSendingVoiceNote;
  const {
    durationMs: draftPlaybackDurationMs,
    isPlaying: isDraftVoicePlaying,
    lastError: draftPlaybackError,
    positionMs: draftPlaybackPositionMs,
    progress: draftPlaybackProgress,
    stopPlayback: stopDraftVoicePlayback,
    togglePlayback: toggleDraftVoicePlayback,
  } = useAudioPlayback({ sourceUrl: pendingVoiceDraft?.uri || '' });

  // Event Participation Logic
  const queryClient = useQueryClient();
  const invalidatePendingLeagueActionQueries = useCallback(() => Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: getPendingLeagueActionQueryKey(undefined) }),
    pendingLeagueActionTeamId
      ? queryClient.invalidateQueries({
        queryKey: getPendingLeagueActionQueryKey(pendingLeagueActionTeamId),
      })
      : Promise.resolve(),
  ]), [pendingLeagueActionTeamId, queryClient]);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinModalError, setJoinModalError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(/** @type {{ documentId?: string; team?: Team } | undefined} */ (undefined));
  const [selectedDocumentActionMessage, setSelectedDocumentActionMessage] = useState(null);
  const selectedParticipationFlow = useMemo(
    () => resolveParticipationFlow(selectedEvent, { user: userData }),
    [selectedEvent, userData],
  );

  useEffect(() => {
    voiceRecordingStateRef.current = voiceRecordingState;
  }, [voiceRecordingState]);

  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onError: (error) => {
      showErrorBanner(
        getParticipationErrorMessage(error, t('common.errorOccurred')),
        t('common.error'),
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      markMessagingPerf('messaging_event_bubble_participation_completed', {
        chatId,
        eventId: variables?.event,
      });
      setIsJoinModalVisible(false);
      setJoinModalError('');
      showSuccessBanner(t('eventDetails.participationSuccess'), t('common.success'));
    },
  });
  const joinReservationMutation = useMutation({
    mutationFn: (/** @type {string} */ reservationId) => joinReservation(reservationId),
    onError: (error) => {
      showErrorBanner(
        getParticipationErrorMessage(error, t('common.errorOccurred')),
        t('common.error'),
      );
    },
    onSuccess: (_data, reservationId) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['featured-reservations'] });
      markMessagingPerf('messaging_event_bubble_reservation_join_completed', {
        chatId,
        reservationId,
      });
      setIsJoinModalVisible(false);
      setJoinModalError('');
      showSuccessBanner('Réservation rejointe.', t('common.success'));
    },
  });

  const handleParticipateToEvent = async (/** @type {{ documentId?: string; parentEvent?: { documentId?: string } }} */ event) => {
    const participationFlow = resolveParticipationFlow(event, { user: userData });

    if (!participationFlow?.canAct) {
      showErrorBanner(participationFlow?.blockedReason || t('common.errorOccurred'), t('common.error'));
      return;
    }

    if (participationFlow?.kind === 'reservation-recruiting') {
      setJoinModalError('');
      setSelectedEvent(event);
      setIsJoinModalVisible(true);
      return;
    }

    if (participationFlow?.submitMode === 'redirect-parent' && event?.parentEvent?.documentId) {
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId: event.parentEvent.documentId },
        screen: RouteNames.EventDetails,
      });
      return;
    }

    if (event?.documentId && userData?.documentId) {
      try {
        await createEventParticipationMutation.mutateAsync({
          event: event.documentId,
          user: userData.documentId,
        });
      } catch (error) {
        showErrorBanner(
          getParticipationErrorMessage(error, t('common.errorOccurred')),
          t('common.error'),
        );
      }
    }
  };

  // 🔇 TRIO/D3 — « ABSENT » N'ETAIT BRANCHE SUR RIEN.
  //
  // La carte d'evenement du fil recevait `onDecline={() => {}}`, une fonction
  // VIDE : le bouton s'enfoncait et il ne se passait rien. Ses deux voisines de
  // la meme carte (`onJoin`, `onParticipate`) etaient branchees, et les deux
  // bulles de proposition, quarante lignes plus bas dans ce fichier, branchent
  // le meme bouton correctement — c'etait donc un oubli, pas un choix.
  //
  // ⛔ Aucun appel invente : on reprend le hook partage que les deux AUTRES
  // ecrans qui repondent depuis une carte utilisent deja
  // (`EventListContent`, `ParticipantEventList`). Il porte la regle — une
  // seance de stage se repond par la porte des reponses, tout le reste par
  // `POST /events/:id/missing` — ET l'invalidation complete des six racines de
  // requetes, celle qui avait deja diverge trois fois.
  const { missingEventMutation, respondToEventRsvpMutation } = useEventAnswerMutations();

  const handleDeclineEvent = (
    /** @type {{ documentId?: string; eventFormat?: string }} */ event,
  ) => {
    if (!event?.documentId) return;
    if (String(event?.eventFormat || '').toLowerCase() === 'stage_day') {
      respondToEventRsvpMutation.mutate({
        answer: 'absent',
        eventId: event.documentId,
      });
      return;
    }
    missingEventMutation.mutate(event.documentId);
  };

  const handleJoinEvent = (/** @type {{ documentId?: string; team?: Team; parentEvent?: { documentId?: string } }} */ event) => {
    const participationFlow = resolveParticipationFlow(event, { user: userData });

    if (!participationFlow?.canAct) {
      showErrorBanner(participationFlow?.blockedReason || t('common.errorOccurred'), t('common.error'));
      return;
    }

    if (participationFlow?.submitMode === 'redirect-parent' && event?.parentEvent?.documentId) {
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId: event.parentEvent.documentId },
        screen: RouteNames.EventDetails,
      });
      return;
    }

    if (participationFlow?.submitMode === 'detection-slot-picker') {
      if (event?.documentId) {
        navigation.navigate(RouteNames.EventStack, {
          params: { eventId: event.documentId },
          screen: RouteNames.EventDetails,
        });
      }
      return;
    }

    setJoinModalError('');
    setSelectedEvent(event);
    setIsJoinModalVisible(true);
  };

  const handleCloseJoinModal = () => {
    setIsJoinModalVisible(false);
    setJoinModalError('');
    setSelectedEvent(undefined);
  };

  const handleConfirmJoinEvent = async () => {
    if (!selectedEvent?.documentId) {
      return;
    }

    try {
      if (selectedParticipationFlow?.kind === 'reservation-recruiting') {
        await joinReservationMutation.mutateAsync(selectedEvent.documentId);
        return;
      }

      if (!userData?.documentId) {
        return;
      }

      await createEventParticipationMutation.mutateAsync({
        event: selectedEvent.documentId,
        user: userData.documentId,
      });
    } catch (error) {
      setJoinModalError(getParticipationErrorMessage(error, t('common.errorOccurred')));
    }
  };

  // Typing Indicator Logic
  useEffect(() => {
    if (!isSocketReadTypingEnabled) return undefined;
    if (!socket) return undefined;

    const handleTypingStart = (
      /** @type {{ chatDocumentId?: string; userDocumentId?: string }} */
      { chatDocumentId, userDocumentId },
    ) => {
      if (chatDocumentId === chatId) {
        if (!userDocumentId || userDocumentId === userData?.documentId) return;
        setTypingUsers((prev) => new Set(prev).add(userDocumentId));
      }
    };

    const handleTypingStop = (
      /** @type {{ chatDocumentId?: string; userDocumentId?: string }} */
      { chatDocumentId, userDocumentId },
    ) => {
      if (chatDocumentId === chatId) {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          if (userDocumentId) {
            newSet.delete(userDocumentId);
          } else {
            newSet.clear();
          }
          return newSet;
        });
      }
    };

    socket.on(EVENTS.TYPING_STARTED, handleTypingStart);
    socket.on(EVENTS.TYPING_STOPPED, handleTypingStop);

    return () => {
      socket.off(EVENTS.TYPING_STARTED, handleTypingStart);
      socket.off(EVENTS.TYPING_STOPPED, handleTypingStop);
    };
  }, [socket, chatId, userData?.documentId]);

  useEffect(() => () => {
    if (voiceRecordingStateRef.current !== VOICE_RECORDING_STATES.idle) {
      cancelRecording().catch(() => {});
    }
  }, []);

  useEffect(() => () => {
    const currentDraftUri = String(pendingVoiceDraft?.uri || '').trim();
    if (!currentDraftUri) return;
    deleteVoiceNoteFile(currentDraftUri).catch(() => {});
  }, [pendingVoiceDraft?.uri]);

  // MSG1/N5 — ARRETER LA FRAPPE REARME LE RALENTISSEUR. Sans ca, le caractere
  // tape juste apres un envoi ne reprevient personne pendant une seconde : le
  // « ... » n apparaitrait plus chez l autre au debut du message suivant.
  // Les 4 endroits qui arretent la frappe passent par ici, une seule fois.
  const stopTyping = (/** @type {string} */ conversationId) => {
    lastTypingStartSentAtRef.current = 0;
    sendTypingStop(conversationId);
  };

  // Handle Input Text Change for Typing Indicator
  //
  // MSG1/N5 — LE RALENTISSEUR. Le serveur n'accepte que 10 evenements par
  // seconde et par personne (admin/src/socket/constants.ts:67), et ce quota est
  // PARTAGE avec l'envoi de messages. Or on prevenait le serveur A CHAQUE
  // TOUCHE : taper vite, ou coller un texte, epuisait le quota et le message
  // envoye juste apres etait REFUSE (bulle rouge immediate).
  // Le premier caractere previent tout de suite — c'est ce qui fait apparaitre
  // le « ... » chez l'autre sans retard — puis au plus une fois par seconde.
  // `typing-stop`, lui, n'est JAMAIS bride : c'est le signal qui ETEINT
  // l'indicateur, le retarder laisserait un « ... » allume chez quelqu'un qui
  // n'ecrit plus.
  const handleInputTextChanged = (/** @type {string} */ text) => {
    setComposerText(text);
    if (!isSocketReadTypingEnabled) return;

    if (text.length > 0) {
      const maintenant = Date.now();
      if (maintenant - lastTypingStartSentAtRef.current < TYPING_START_THROTTLE_MS) return;
      lastTypingStartSentAtRef.current = maintenant;
      sendTypingStart(chatId);
    } else {
      stopTyping(chatId);
    }
  };

  const createLocalUploadId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  const buildLocalPendingAttachment = useCallback((
    /** @type {AttachmentAsset} */ asset,
    /** @type {string} */ attachmentId,
  ) => ({
    documentId: attachmentId,
    id: attachmentId,
    mime: String(asset?.type || 'application/octet-stream'),
    name: String(asset?.fileName || 'piece-jointe'),
    uri: String(asset?.uri || ''),
  }), []);

  const buildLocalPendingMessage = useCallback((
    /** @type {{
     *  attachments?: any[];
     *  clientMessageId?: string;
     *  composition?: any;
     *  createdAt?: string;
     *  event?: any;
     *  message?: string;
     *  replyTo?: { documentId?: string } | null;
     * }} */ payload = {},
  ) => {
    const safePayload = /** @type {any} */ (payload || {});
    const {
      attachments: rawAttachments = [],
      clientMessageId = '',
      composition = undefined,
      createdAt = new Date().toISOString(),
      event = undefined,
      message = '',
      replyTo = null,
    } = safePayload;
    const attachments = Array.isArray(rawAttachments) ? rawAttachments : [];

    return {
      attachments: Array.isArray(attachments) ? attachments : [],
      chat: { documentId: chatId },
      clientMessageId: String(clientMessageId || '').trim(),
      composition,
      createdAt,
      event,
      failed: false,
      message: String(message || ''),
      pending: true,
      readBy: [],
      replyTo,
      sender: {
        avatar: userData?.avatar,
        documentId: userData?.documentId || 'me',
        firstname: userData?.firstname || '',
        lastname: userData?.lastname || '',
      },
    };
  }, [chatId, userData?.avatar, userData?.documentId, userData?.firstname, userData?.lastname]);

  const upsertLocalPendingMessage = useCallback((
    /** @type {string} */ messageId,
    /** @type {any} */ messagePayload,
  ) => {
    const safeMessageId = String(messageId || '').trim();
    if (!safeMessageId || !chatId) return;

    const normalizedMessage = {
      ...messagePayload,
      documentId: safeMessageId,
      id: safeMessageId,
    };

    queryClient.setQueriesData({ queryKey: ['chat-messages', chatId] }, (oldData) => {
      if (!oldData || !oldData.pages || !Array.isArray(oldData.pages) || oldData.pages.length === 0) {
        return {
          pageParams: [null],
          pages: [{
            data: [normalizedMessage],
            meta: { pagination: { page: 1, pageCount: 1, total: 1 } },
          }],
        };
      }

      let hasUpdatedExistingMessage = false;
      const nextPages = oldData.pages.map((/** @type {any} */ page) => {
        const pageData = Array.isArray(page?.data) ? page.data : [];
        const nextData = pageData.map((/** @type {any} */ message) => {
          const currentId = String(message?.documentId || message?.id || '').trim();
          if (currentId !== safeMessageId) return message;
          hasUpdatedExistingMessage = true;
          return {
            ...message,
            ...normalizedMessage,
            documentId: safeMessageId,
            id: safeMessageId,
          };
        });
        return { ...page, data: nextData };
      });

      if (hasUpdatedExistingMessage) {
        return { ...oldData, pages: nextPages };
      }

      const firstPage = nextPages[0];
      const firstPageData = Array.isArray(firstPage?.data) ? firstPage.data : [];
      return {
        ...oldData,
        pages: [{
          ...firstPage,
          data: [normalizedMessage, ...firstPageData],
        }, ...nextPages.slice(1)],
      };
    });
  }, [chatId, queryClient]);

  const removeLocalPendingMessage = useCallback((/** @type {string} */ messageId) => {
    const safeMessageId = String(messageId || '').trim();
    if (!safeMessageId || !chatId) return;

    queryClient.setQueriesData({ queryKey: ['chat-messages', chatId] }, (oldData) => {
      if (!oldData?.pages) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((/** @type {any} */ page) => ({
          ...page,
          data: Array.isArray(page?.data)
            ? page.data.filter((/** @type {any} */ message) => {
              const currentId = String(message?.documentId || message?.id || '').trim();
              return currentId !== safeMessageId;
            })
            : [],
        })),
      };
    });
  }, [chatId, queryClient]);

  const uploadAttachmentAssetWithFetch = useCallback(async (
    /** @type {AttachmentAsset} */ asset,
  ) => {
    if (!asset?.uri) return [];

    logAttachmentDebug('uploadAttachmentAsset fetch fallback start', {
      asset: describeAsset(asset),
      chatId,
      endpoint: `${apiBaseUrl}/upload`,
    });

    const formData = new FormData();
    formData.append('files', /** @type {any} */ ({
      name: asset.fileName || `upload_${Date.now()}.jpg`,
      type: asset.type || 'application/octet-stream',
      uri: asset.uri,
    }));

    const token = getAuthTokens()?.token;
    const headers = /** @type {any} */ (token ? { Authorization: `Bearer ${token}` } : {});
    const response = await fetch(`${apiBaseUrl}/upload`, {
      body: formData,
      headers,
      method: 'POST',
    });
    const rawBody = await response.text();
    let parsedBody = null;
    parsedBody = safeJsonParse(rawBody, null);

    if (!response.ok) {
      const parsedError = parsedBody?.error?.message
        || parsedBody?.error
        || parsedBody?.message
        || rawBody
        || `HTTP ${response.status}`;
      throw new Error(String(parsedError));
    }

    const uploadItems = Array.isArray(parsedBody) ? parsedBody : [];
    logAttachmentDebug('uploadAttachmentAsset fetch fallback success', {
      count: uploadItems.length,
      items: describeUploadItems(uploadItems),
      status: response.status,
    });
    return uploadItems;
  }, [apiBaseUrl, chatId, describeAsset, describeUploadItems, logAttachmentDebug]);

  const uploadAttachmentAsset = useCallback(async (/** @type {AttachmentAsset} */ asset) => {
    if (!asset?.uri) {
      logAttachmentDebug('uploadAttachmentAsset skipped: missing uri', {
        chatId,
        socketConnected: Boolean(isSocketConnected),
      });
      return [];
    }

    logAttachmentDebug('uploadAttachmentAsset start', {
      asset: describeAsset(asset),
      chatId,
      socketConnected: Boolean(isSocketConnected),
    });

    const isAudio = typeof asset.type === 'string' && asset.type.startsWith('audio/');
    const defaultExtension = getAttachmentExtensionFromAsset(asset) || 'jpg';
    const maxAttempts = 3;
    const wait = (/** @type {number} */ ms) => new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
    /**
     * @param {number} attempt
     * @returns {Promise<any[]>}
     */
    const attemptUpload = async (attempt) => {
      try {
        if (Platform.OS === 'android' && attempt === 1) {
          try {
            const androidFetchItems = await uploadAttachmentAssetWithFetch(asset);
            if (androidFetchItems.length > 0) {
              return androidFetchItems;
            }
          } catch (androidFetchError) {
            const safeAndroidFetchError = /** @type {any} */ (androidFetchError);
            logAttachmentDebug('uploadAttachmentAsset fetch-first failed', {
              attempt,
              chatId,
              error: safeAndroidFetchError?.message || safeAndroidFetchError,
            });
          }
        }

        const formData = new FormData();
        formData.append('files', /** @type {any} */ ({
          name: asset.fileName || `upload_${Date.now()}.${defaultExtension}`,
          type: asset.type || 'application/octet-stream',
          uri: asset.uri,
        }));

        const uploadResponse = await client.post('/upload', formData, {
          timeout: 45000,
        });
        const uploadItems = Array.isArray(uploadResponse?.data) ? uploadResponse.data : [];
        logAttachmentDebug('uploadAttachmentAsset success', {
          attempt,
          count: uploadItems.length,
          items: describeUploadItems(uploadItems),
          status: uploadResponse?.status,
        });
        return uploadItems;
      } catch (error) {
        const safeError = /** @type {any} */ (error);
        const rawErrorMessage = (
          typeof safeError === 'string'
            ? safeError
            : String(safeError?.message || safeError || '')
        );
        const errorCode = typeof safeError === 'object' && safeError !== null
          ? safeError?.code
          : undefined;
        const responseStatus = typeof safeError === 'object' && safeError !== null
          ? safeError?.response?.status
          : undefined;
        const isTransientNetworkError = isTransientNetworkUploadError(safeError);
        const shouldRetry = attempt < maxAttempts && isTransientNetworkError;

        logAttachmentDebug('uploadAttachmentAsset attempt failed', {
          attempt,
          chatId,
          code: errorCode,
          error: rawErrorMessage,
          isTransientNetworkError,
          responseStatus,
          shouldRetry,
        });

        if (Platform.OS === 'android' && isAudio && isTransientNetworkError) {
          try {
            const fallbackItems = await uploadAttachmentAssetWithFetch({
              ...asset,
              fileName: asset.fileName || `upload_${Date.now()}.${defaultExtension}`,
              type: asset.type || 'audio/mp4',
            });
            if (fallbackItems.length > 0) {
              return fallbackItems;
            }
          } catch (fetchFallbackError) {
            const safeFetchFallbackError = /** @type {any} */ (fetchFallbackError);
            logAttachmentDebug('uploadAttachmentAsset audio fetch fallback failed', {
              attempt,
              chatId,
              error: safeFetchFallbackError?.message || safeFetchFallbackError,
            });
          }
        } else if (isTransientNetworkError && !isAudio) {
          try {
            const fallbackItems = await uploadAttachmentAssetWithFetch(asset);
            if (fallbackItems.length > 0) {
              return fallbackItems;
            }
          } catch (fetchFallbackError) {
            const safeFetchFallbackError = /** @type {any} */ (fetchFallbackError);
            logAttachmentDebug('uploadAttachmentAsset fetch fallback failed', {
              attempt,
              chatId,
              error: safeFetchFallbackError?.message || safeFetchFallbackError,
            });
          }
        }

        if (!shouldRetry) {
          throw error;
        }

        await wait(500 * attempt);
        return attemptUpload(attempt + 1);
      }
    };

    return attemptUpload(1);
  }, [chatId, describeAsset, describeUploadItems, getAttachmentExtensionFromAsset, isSocketConnected, isTransientNetworkUploadError, logAttachmentDebug, uploadAttachmentAssetWithFetch]);

  const uploadAndSendAttachment = async (
    /** @type {AttachmentAsset} */ asset,
    /** @type {{
     *  caption?: string;
     *  clientMessageId?: string;
     *  createdAt?: string;
     *  optimisticMessageId?: string;
     *  replyTo?: { documentId?: string } | null;
     * }} */ options = {},
  ) => {
    if (uploadInFlightRef.current) {
      logAttachmentDebug('uploadAndSendAttachment skipped: upload already in progress', {
        asset: describeAsset(asset),
        chatId,
      });
      return false;
    }

    if (!asset?.uri || !chatId) {
      logAttachmentDebug('uploadAndSendAttachment skipped: missing asset uri or chatId', {
        asset: describeAsset(asset),
        chatId,
      });
      return false;
    }

    try {
      uploadInFlightRef.current = true;
      setIsUploading(true);
      logAttachmentDebug('uploadAndSendAttachment begin', {
        asset: describeAsset(asset),
        captionLength: String(options?.caption || '').trim().length,
        chatId,
        hasReplyTo: Boolean(options?.replyTo?.documentId),
      });
      const uploadedFiles = await uploadAttachmentAsset(asset);
      if (uploadedFiles.length === 0) {
        logAttachmentDebug('uploadAndSendAttachment failed: zéro uploaded files', {
          asset: describeAsset(asset),
          chatId,
        });
        showErrorBanner("Aucune pièce jointe n'a pu être envoyée.");
        return false;
      }

      const uploadedMime = uploadedFiles?.[0]?.mime || asset.type || '';
      const uploadedName = uploadedFiles?.[0]?.name || asset.fileName || 'pièce-jointe';
      const isImageAttachment = typeof uploadedMime === 'string'
        && uploadedMime.startsWith('image/');

      const normalizedCaption = String(options?.caption || '').trim();
      const fallbackText = isImageAttachment ? '' : `Pièce jointe : ${uploadedName}`;
      const messageText = normalizedCaption || fallbackText;

      const optimisticMessageId = sendMessage(chatId, messageText, {
        attachments: uploadedFiles,
        replyTo: options?.replyTo || null,
        sender: userData,
      });

      if (!optimisticMessageId) {
        logAttachmentDebug('uploadAndSendAttachment socket send skipped or failed', {
          chatId,
          messageLength: messageText.length,
          socketConnected: Boolean(isSocketConnected),
          uploadedFiles: describeUploadItems(uploadedFiles),
        });
        showErrorBanner('Connexion messagerie indisponible. Réessaie dans quelques secondes.');
        return false;
      }

      logAttachmentDebug('uploadAndSendAttachment success', {
        chatId,
        messageLength: messageText.length,
        optimisticMessageId,
        uploadedFiles: describeUploadItems(uploadedFiles),
      });
      return true;
    } catch (error) {
      const safeError = /** @type {any} */ (error);
      logAttachmentDebug('uploadAndSendAttachment exception', {
        chatId,
        code: safeError?.code,
        error: safeError?.message || safeError,
        responseData: safeError?.response?.data,
        responseStatus: safeError?.response?.status,
      });
      conversationLogger.warn('Attachment upload failed', error);
      showErrorBanner(buildAttachmentUploadErrorMessage(safeError));
      return false;
    } finally {
      uploadInFlightRef.current = false;
      setIsUploading(false);
    }
  };

  const uploadAndSendAttachmentWithPlaceholder = async (
    /** @type {AttachmentAsset} */ asset,
    /** @type {{
     *  caption?: string;
     *  clientMessageId?: string;
     *  createdAt?: string;
     *  optimisticMessageId?: string;
     *  replyTo?: { documentId?: string } | null;
     * }} */ options = {},
  ) => {
    if (uploadInFlightRef.current) {
      logAttachmentDebug('uploadAndSendAttachmentWithPlaceholder skipped: upload already in progress', {
        asset: describeAsset(asset),
        chatId,
      });
      return false;
    }

    if (!asset?.uri || !chatId) {
      logAttachmentDebug('uploadAndSendAttachmentWithPlaceholder skipped: missing asset uri or chatId', {
        asset: describeAsset(asset),
        chatId,
      });
      return false;
    }

    const safeClientMessageId = String(options?.clientMessageId || '').trim();
    const safeOptimisticMessageId = String(options?.optimisticMessageId || '').trim();
    const safeCreatedAt = String(options?.createdAt || '').trim() || new Date().toISOString();

    try {
      uploadInFlightRef.current = true;
      setIsUploading(true);
      logAttachmentDebug('uploadAndSendAttachmentWithPlaceholder begin', {
        asset: describeAsset(asset),
        captionLength: String(options?.caption || '').trim().length,
        chatId,
        hasReplyTo: Boolean(options?.replyTo?.documentId),
      });
      const uploadedFiles = await uploadAttachmentAsset(asset);
      if (uploadedFiles.length === 0) {
        if (safeOptimisticMessageId) {
          removeLocalPendingMessage(safeOptimisticMessageId);
        }
        showErrorBanner("Aucune pièce jointe n'a pu être envoyée.");
        return false;
      }

      const uploadedMime = uploadedFiles?.[0]?.mime || asset.type || '';
      const uploadedName = uploadedFiles?.[0]?.name || asset.fileName || 'pièce-jointe';
      const isImageAttachment = typeof uploadedMime === 'string'
        && uploadedMime.startsWith('image/');

      const normalizedCaption = String(options?.caption || '').trim();
      const fallbackText = isImageAttachment ? '' : `Pièce jointe : ${uploadedName}`;
      const messageText = normalizedCaption || fallbackText;

      if (safeOptimisticMessageId) {
        upsertLocalPendingMessage(safeOptimisticMessageId, buildLocalPendingMessage({
          attachments: uploadedFiles,
          clientMessageId: safeClientMessageId,
          createdAt: safeCreatedAt,
          message: messageText,
          replyTo: options?.replyTo || null,
        }));
      }

      const optimisticMessageId = sendMessage(chatId, messageText, {
        attachments: uploadedFiles,
        clientMessageId: safeClientMessageId || undefined,
        optimisticMessageId: safeOptimisticMessageId || undefined,
        replyTo: options?.replyTo || null,
        sender: userData,
        skipOptimistic: Boolean(safeOptimisticMessageId),
      });

      if (!optimisticMessageId) {
        if (safeOptimisticMessageId) {
          removeLocalPendingMessage(safeOptimisticMessageId);
        }
        showErrorBanner('Connexion messagerie indisponible. Réessaie dans quelques secondes.');
        return false;
      }

      logAttachmentDebug('uploadAndSendAttachmentWithPlaceholder success', {
        chatId,
        messageLength: messageText.length,
        optimisticMessageId,
        uploadedFiles: describeUploadItems(uploadedFiles),
      });
      return true;
    } catch (error) {
      const safeError = /** @type {any} */ (error);
      if (safeOptimisticMessageId) {
        removeLocalPendingMessage(safeOptimisticMessageId);
      }
      logAttachmentDebug('uploadAndSendAttachmentWithPlaceholder exception', {
        chatId,
        code: safeError?.code,
        error: safeError?.message || safeError,
        responseData: safeError?.response?.data,
        responseStatus: safeError?.response?.status,
      });
      conversationLogger.warn('Attachment upload failed', error);
      showErrorBanner(buildAttachmentUploadErrorMessage(safeError));
      return false;
    } finally {
      uploadInFlightRef.current = false;
      setIsUploading(false);
    }
  };

  const normalizePickedAsset = useCallback((
    /** @type {AttachmentAsset} */ selectedAsset,
  ) => {
    const rawType = String(selectedAsset?.type || '').trim().toLowerCase();
    const safeType = rawType || 'application/octet-stream';
    const baseName = String(selectedAsset?.fileName || '').trim();

    const extension = getAttachmentExtensionFromAsset({
      fileName: baseName,
      type: safeType,
      uri: selectedAsset?.uri,
    });

    return {
      fileName: baseName || `media_${Date.now()}.${extension}`,
      size: Number(selectedAsset?.fileSize || selectedAsset?.size || 0) || 0,
      type: safeType,
      uri: selectedAsset?.uri,
    };
  }, [getAttachmentExtensionFromAsset]);

  const queueOrSendPickedAsset = async (
    /** @type {AttachmentAsset} */ selectedAsset,
  ) => {
    const normalizedAsset = normalizePickedAsset(selectedAsset);
    const validationError = validateAttachmentAsset(normalizedAsset);
    if (validationError) {
      logAttachmentDebug('queueOrSendPickedAsset validation failed', {
        asset: describeAsset(normalizedAsset),
        chatId,
        reason: validationError.reason,
      });
      showErrorBanner(validationError.userMessage);
      return;
    }

    if (!normalizedAsset?.uri) {
      logAttachmentDebug('queueOrSendPickedAsset skipped: normalized asset has no uri', {
        selectedAsset: describeAsset(selectedAsset),
      });
      return;
    }

    logAttachmentDebug('queueOrSendPickedAsset normalized', {
      normalizedAsset: describeAsset(normalizedAsset),
      selectedAsset: describeAsset(selectedAsset),
    });

    const isImageAsset = String(normalizedAsset.type || '').toLowerCase().startsWith('image/');
    if (isImageAsset) {
      setPendingMediaDraft({ asset: normalizedAsset });
      logAttachmentDebug('queueOrSendPickedAsset draft queued (image)', {
        asset: describeAsset(normalizedAsset),
      });
      return;
    }

    await uploadAndSendAttachment(normalizedAsset, {
      replyTo: replyingTo ? { documentId: replyingTo.documentId } : null,
    });
    setReplyingTo(null);
  };

  const handlePickMedia = async () => {
    try {
      logAttachmentDebug('handlePickMedia open picker');
      const response = await launchImageLibrary({
        includeBase64: false,
        mediaType: 'mixed',
        selectionLimit: 1,
        ...PHOTO_PICKER_LIMITS,
      });

      if (response.didCancel) {
        logAttachmentDebug('handlePickMedia cancelled by user');
        return;
      }
      if (response.errorCode) {
        logAttachmentDebug('handlePickMedia picker error', {
          errorCode: response.errorCode,
          errorMessage: response.errorMessage,
        });
        showErrorBanner(response.errorMessage || 'Erreur lors de la sélection');
        return;
      }

      const selectedAsset = response.assets?.[0];
      if (!selectedAsset) {
        logAttachmentDebug('handlePickMedia no asset returned');
        return;
      }
      logAttachmentDebug('handlePickMedia asset selected', {
        asset: describeAsset(selectedAsset),
      });

      await queueOrSendPickedAsset(selectedAsset);
    } catch (error) {
      const safeError = /** @type {any} */ (error);
      logAttachmentDebug('handlePickMedia exception', {
        error: safeError?.message || safeError,
        responseData: safeError?.response?.data,
        responseStatus: safeError?.response?.status,
      });
      conversationLogger.warn('Media picker failed', error);
      showErrorBanner('Impossible d\'ouvrir la galerie.');
    }
  };

  const ensureCameraPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      if (alreadyGranted) return true;

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          buttonNegative: t('common.actions.cancel', 'Annuler'),
          buttonNeutral: t('common.actions.askLater', 'Plus tard'),
          buttonPositive: t('common.actions.ok', 'OK'),
          message: t(
            'permissions.camera.message',
            'L\'application a besoin de la caméra pour prendre une photo.',
          ),
          title: t('permissions.camera.title', 'Permission caméra'),
        },
      );

      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        showErrorBanner(
          t('permissions.camera.denied', 'Permission caméra refusée'),
          t('common.error', 'Erreur'),
        );
        return false;
      }
      return true;
    } catch (error) {
      conversationLogger.warn('Camera permission request failed', error);
      showErrorBanner('Impossible de vérifier la permission caméra.');
      return false;
    }
  }, [showErrorBanner, t]);

  const handleTakePhoto = async () => {
    try {
      logAttachmentDebug('handleTakePhoto open camera');
      const hasCameraPermission = await ensureCameraPermission();
      if (!hasCameraPermission) {
        logAttachmentDebug('handleTakePhoto blocked: missing camera permission');
        return;
      }

      const response = await launchCamera({
        cameraType: 'back',
        includeBase64: false,
        mediaType: 'photo',
        saveToPhotos: false,
        ...PHOTO_PICKER_LIMITS,
      });

      if (response.didCancel) {
        logAttachmentDebug('handleTakePhoto cancelled by user');
        return;
      }
      if (response.errorCode) {
        logAttachmentDebug('handleTakePhoto camera error', {
          errorCode: response.errorCode,
          errorMessage: response.errorMessage,
        });
        showErrorBanner(response.errorMessage || 'Impossible d\'ouvrir la camera');
        return;
      }

      const selectedAsset = response.assets?.[0];
      if (!selectedAsset) {
        logAttachmentDebug('handleTakePhoto no asset returned');
        return;
      }
      logAttachmentDebug('handleTakePhoto asset captured', {
        asset: describeAsset(selectedAsset),
      });

      await queueOrSendPickedAsset(selectedAsset);
    } catch (error) {
      const safeError = /** @type {any} */ (error);
      logAttachmentDebug('handleTakePhoto exception', {
        error: safeError?.message || safeError,
        responseData: safeError?.response?.data,
        responseStatus: safeError?.response?.status,
      });
      conversationLogger.warn('Camera open failed', error);
      showErrorBanner('Impossible de prendre la photo.');
    }
  };

  const handlePickFile = async () => {
    if (isDocumentPickerDisabled) {
      showInfoBanner('Le sélecteur de fichier est temporairement désactive sur cette build.', 'Fichier indisponible');
      return;
    }

    const documentPicker = getDocumentPickerModule();
    if (!documentPicker?.pick || typeof documentPicker.pick !== 'function') {
      showErrorBanner('Le sélecteur de fichier est indisponible sur cette build.');
      return;
    }

    try {
      const selectedResult = await documentPicker.pick();
      const selectedFile = Array.isArray(selectedResult) ? selectedResult[0] : selectedResult;
      if (!selectedFile) return;

      let localCopyResult;
      if (typeof documentPicker?.keepLocalCopy === 'function' && selectedFile?.uri) {
        const [localCopy] = await documentPicker.keepLocalCopy({
          destination: 'cachesDirectory',
          files: [
            {
              fileName: selectedFile.name || `file_${Date.now()}`,
              uri: selectedFile.uri,
            },
          ],
        });
        localCopyResult = localCopy;
      }

      const selectedUri = localCopyResult?.status === 'success'
        ? localCopyResult.localUri
        : selectedFile.uri;
      if (!selectedUri) {
        showErrorBanner('Impossible de récupérer ce fichier.');
        return;
      }

      await queueOrSendPickedAsset({
        fileName: selectedFile.name || `file_${Date.now()}`,
        size: Number(selectedFile?.size || selectedFile?.fileSize || 0) || 0,
        type: selectedFile.type || 'application/octet-stream',
        uri: selectedUri,
      });
    } catch (error) {
      if (isDocumentPickerCancellation(documentPicker, error)) return;
      conversationLogger.warn('Document picker failed', error);
      showErrorBanner('Impossible de sélectionner un fichier.');
    }
  };

  const appendEditAttachmentsFromAsset = useCallback(async (/** @type {AttachmentAsset} */ selectedAsset) => {
    const normalizedAsset = normalizePickedAsset(selectedAsset || {});
    const validationError = validateAttachmentAsset(normalizedAsset);
    if (validationError) {
      showErrorBanner(validationError.userMessage);
      return;
    }
    if (!normalizedAsset?.uri) {
      showErrorBanner('Impossible de lire ce fichier.');
      return;
    }

    setIsEditMessageUploadingAttachment(true);
    try {
      const uploadedFiles = await uploadAttachmentAsset(normalizedAsset);
      if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
        showErrorBanner("Impossible d'ajouter cette pièce jointe.");
        return;
      }

      setEditMessageAttachments((previousAttachments) => {
        const nextAttachments = Array.isArray(previousAttachments) ? [...previousAttachments] : [];
        uploadedFiles.forEach((uploadedFile) => {
          const nextKey = String(uploadedFile?.documentId || uploadedFile?.id || '').trim();
          if (!nextKey) return;
          const alreadyExists = nextAttachments.some((attachment) => (
            String(attachment?.documentId || attachment?.id || '').trim() === nextKey
          ));
          if (!alreadyExists) {
            nextAttachments.push(uploadedFile);
          }
        });
        return nextAttachments;
      });
    } catch (error) {
      conversationLogger.warn('Edit attachment upload failed', error);
      showErrorBanner(buildAttachmentUploadErrorMessage(error));
    } finally {
      setIsEditMessageUploadingAttachment(false);
    }
  }, [
    buildAttachmentUploadErrorMessage,
    normalizePickedAsset,
    showErrorBanner,
    uploadAttachmentAsset,
    validateAttachmentAsset,
  ]);

  const handleEditPickMedia = useCallback(async () => {
    try {
      const response = await launchImageLibrary({
        includeBase64: false,
        mediaType: 'mixed',
        selectionLimit: 1,
        ...PHOTO_PICKER_LIMITS,
      });

      if (response.didCancel) return;
      if (response.errorCode) {
        showErrorBanner(response.errorMessage || 'Erreur lors de la sélection');
        return;
      }

      const selectedAsset = response.assets?.[0];
      if (!selectedAsset) return;
      await appendEditAttachmentsFromAsset(selectedAsset);
    } catch (error) {
      conversationLogger.warn('Edit media picker failed', error);
      showErrorBanner('Impossible d\'ouvrir la galerie.');
    }
  }, [appendEditAttachmentsFromAsset, showErrorBanner]);

  const handleEditTakePhoto = useCallback(async () => {
    try {
      const hasCameraPermission = await ensureCameraPermission();
      if (!hasCameraPermission) return;

      const response = await launchCamera({
        cameraType: 'back',
        includeBase64: false,
        mediaType: 'photo',
        saveToPhotos: false,
        ...PHOTO_PICKER_LIMITS,
      });

      if (response.didCancel) return;
      if (response.errorCode) {
        showErrorBanner(response.errorMessage || 'Impossible d\'ouvrir la camera');
        return;
      }

      const selectedAsset = response.assets?.[0];
      if (!selectedAsset) return;
      await appendEditAttachmentsFromAsset(selectedAsset);
    } catch (error) {
      conversationLogger.warn('Edit camera failed', error);
      showErrorBanner('Impossible de prendre la photo.');
    }
  }, [appendEditAttachmentsFromAsset, ensureCameraPermission, showErrorBanner]);

  const handleEditPickFile = useCallback(async () => {
    if (isDocumentPickerDisabled) {
      showInfoBanner('Le sélecteur de fichier est temporairement désactive sur cette build.', 'Fichier indisponible');
      return;
    }

    const documentPicker = getDocumentPickerModule();
    if (!documentPicker?.pick || typeof documentPicker.pick !== 'function') {
      showErrorBanner('Le sélecteur de fichier est indisponible sur cette build.');
      return;
    }

    try {
      const selectedResult = await documentPicker.pick();
      const selectedFile = Array.isArray(selectedResult) ? selectedResult[0] : selectedResult;
      if (!selectedFile) return;

      let localCopyResult;
      if (typeof documentPicker?.keepLocalCopy === 'function' && selectedFile?.uri) {
        const [localCopy] = await documentPicker.keepLocalCopy({
          destination: 'cachesDirectory',
          files: [
            {
              fileName: selectedFile.name || `file_${Date.now()}`,
              uri: selectedFile.uri,
            },
          ],
        });
        localCopyResult = localCopy;
      }

      const selectedUri = localCopyResult?.status === 'success'
        ? localCopyResult.localUri
        : selectedFile.uri;
      if (!selectedUri) {
        showErrorBanner('Impossible de récupérer ce fichier.');
        return;
      }

      await appendEditAttachmentsFromAsset({
        fileName: selectedFile.name || `file_${Date.now()}`,
        size: Number(selectedFile?.size || selectedFile?.fileSize || 0) || 0,
        type: selectedFile.type || 'application/octet-stream',
        uri: selectedUri,
      });
    } catch (error) {
      if (isDocumentPickerCancellation(documentPicker, error)) return;
      conversationLogger.warn('Edit document picker failed', error);
      showErrorBanner('Impossible de sélectionner un fichier.');
    }
  }, [appendEditAttachmentsFromAsset, showErrorBanner, showInfoBanner]);

  const handleSubmitEditMessage = async () => {
    if (!selectedMessageDocumentId || !canEditSelectedMessage) return;

    const payloadAttachments = toEditAttachmentPayload(editMessageAttachments);
    const normalizedMessage = String(editMessageText || '');
    if (!normalizedMessage.trim() && payloadAttachments.length === 0) {
      showErrorBanner('Le message ne peut pas être vide.');
      return;
    }

    setIsEditMessageSubmitting(true);
    try {
      await editMessage({
        chatId,
        data: {
          attachments: payloadAttachments,
          message: normalizedMessage,
        },
        messageId: selectedMessageDocumentId,
      });

      setIsEditMessageModalVisible(false);
      setIsMessageActionsVisible(false);
      setSelectedMessage(undefined);
      resetEditMessageState();
    } catch (error) {
      conversationLogger.warn('Edit message failed', error);
      showErrorBanner('Impossible de modifier ce message.');
    } finally {
      setIsEditMessageSubmitting(false);
    }
  };

  const handleCreatePoll = useCallback(() => {
    Keyboard.dismiss();
    setIsPollModalVisible(true);
  }, []);

  const closePollModal = useCallback(() => {
    setIsPollModalVisible(false);
  }, []);

  const handleSubmitPoll = useCallback(async (/** @type {{ question: string; options: string[]; allowMultipleVotes: boolean; isAnonymous: boolean }} */ payload) => {
    const question = payload?.question?.trim() || '';
    const options = Array.isArray(payload?.options) ? payload.options : [];

    if (!question || options.length < 2) {
      throw new Error(t('conversation.poll.errors.incomplete', 'Le sondage est incomplet.'));
    }

    if (!chatId) {
      throw new Error(t('conversation.poll.errors.chatMissing', 'Conversation introuvable.'));
    }

    const pollComposition = createPollComposition({
      allowMultipleVotes: !!payload.allowMultipleVotes,
      createdBy: userData?.documentId || '',
      isAnonymous: !!payload.isAnonymous,
      options,
      question,
    });

    const optimisticMessageId = sendMessage(chatId, '', {
      composition: pollComposition,
      sender: userData,
    });

    if (!optimisticMessageId) {
      throw new Error(t(
        'conversation.poll.errors.sendUnavailable',
        'Connexion messagerie indisponible. Réessaie dans quelques secondes.',
      ));
    }

    setIsPollModalVisible(false);
  }, [chatId, sendMessage, t, userData]);

  const parseCoordinatesFromOption = (/** @type {any} */ option) => {
    const rawValue = String(option?.value || '');
    const [lngRaw, latRaw] = rawValue.split('|');
    const lat = Number(latRaw);
    const lng = Number(lngRaw);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { lat: null, lng: null };
    }

    return { lat, lng };
  };

  const resolveEventLocationLabel = useCallback((/** @type {any} */ event) => {
    const fallback = event?.location?.label || event?.facility?.address || event?.facility?.name || '';
    if (!event?.locationDetails) return fallback;

    const parsed = safeJsonParse(event.locationDetails, null);
    const parsedLabel = parsed?.address?.description || parsed?.address?.label || parsed?.address?.address;
    return parsedLabel || fallback;
  }, []);

  const handleShareLocation = () => {
    if (!chatId || !selectedLocationOption) return;
    const { lat, lng } = parseCoordinatesFromOption(selectedLocationOption);

    const composition = {
      address: selectedLocationOption?.label || '',
      label: selectedLocationOption?.label || '',
      lat,
      lng,
      type: 'location_share',
    };

    sendMessage(chatId, '', {
      composition,
      sender: userData,
    });
    setSelectedLocationOption(undefined);
    setIsLocationShareModalVisible(false);
  };

  const handleShareContact = () => {
    if (!chatId || !selectedContactId) return;
    const selectedContact = shareableContacts.find((/** @type {any} */ contact) => contact.documentId === selectedContactId);
    if (!selectedContact) return;

    const composition = {
      avatarUrl: selectedContact?.avatar?.url || '',
      firstname: selectedContact.firstname || '',
      lastname: selectedContact.lastname || '',
      roleLabel: selectedContact.role || '',
      type: 'contact_share',
      userDocumentId: selectedContact.documentId,
    };

    sendMessage(chatId, '', {
      composition,
      sender: userData,
    });
    setSelectedContactId('');
    setIsContactShareModalVisible(false);
  };

  const handleShareEvent = useCallback((
    /** @type {any} */ event,
    /** @type {{ closeModal?: boolean }} */ options = {},
  ) => {
    const { closeModal = true } = options;
    const eventDocumentId = String(event?.documentId || event?.id || '').trim();
    if (!chatId || !eventDocumentId) return;
    const locationLabel = resolveEventLocationLabel(event);
    const eventPreview = {
      club: event?.club
        ? {
          addressDetails: event?.club?.addressDetails || null,
          logo: event?.club?.logo || null,
          name: event?.club?.name || '',
        }
        : null,
      date: event?.date || null,
      documentId: eventDocumentId,
      endTime: event?.endTime || null,
      facility: event?.facility
        ? {
          address: event?.facility?.address || null,
          name: event?.facility?.name || '',
        }
        : null,
      location: event?.location || null,
      locationDetails: event?.locationDetails || locationLabel || '',
      name: event?.name || 'Événement',
      startTime: event?.startTime || null,
      team: event?.team
        ? {
          activities: Array.isArray(event?.team?.activities)
            ? event.team.activities
              .map((/** @type {any} */ activity) => ({ name: activity?.name || '' }))
              .filter((/** @type {any} */ activity) => activity?.name)
            : [],
          category: event?.team?.category || null,
          club: event?.team?.club
            ? {
              addressDetails: event?.team?.club?.addressDetails || null,
              logo: event?.team?.club?.logo || null,
              name: event?.team?.club?.name || '',
            }
            : null,
          level: event?.team?.level || null,
          name: event?.team?.name || '',
          section: event?.team?.section || null,
        }
        : null,
      type: event?.type && typeof event.type === 'object'
        ? {
          name: event?.type?.name || 'Événement',
        }
        : {
          name: 'Événement',
        },
    };
    sharedEventPreviewByIdRef.current.set(eventDocumentId, eventPreview);

    const composition = {
      eventDate: eventPreview.date,
      eventDocumentId,
      eventName: eventPreview.name,
      eventPreview,
      locationLabel,
      teamName: eventPreview?.team?.name || '',
      type: 'event_share',
    };

    sendMessage(chatId, 'Partage', {
      composition,
      event: eventDocumentId,
      sender: userData,
    });
    if (closeModal) {
      setIsEventShareModalVisible(false);
    }
  }, [chatId, resolveEventLocationLabel, sendMessage, userData]);

  const hasMeaningfulEventValue = useCallback((/** @type {any} */ value) => {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }, []);

  const preferEventValue = useCallback((/** @type {any} */ primaryValue, /** @type {any} */ fallbackValue) => (
    hasMeaningfulEventValue(primaryValue) ? primaryValue : fallbackValue
  ), [hasMeaningfulEventValue]);

  const mergeNamedEventEntity = useCallback((/** @type {any} */ previewEntity, /** @type {any} */ payloadEntity) => {
    if (!hasMeaningfulEventValue(previewEntity) && !hasMeaningfulEventValue(payloadEntity)) return null;
    if (!hasMeaningfulEventValue(previewEntity)) return payloadEntity;
    if (!hasMeaningfulEventValue(payloadEntity) || typeof payloadEntity !== 'object') return previewEntity;

    return {
      ...previewEntity,
      ...payloadEntity,
    };
  }, [hasMeaningfulEventValue]);

  const mergeSharedEventPayload = useCallback((/** @type {any} */ previewEvent, /** @type {any} */ payloadEvent) => {
    if (!hasMeaningfulEventValue(previewEvent) && !hasMeaningfulEventValue(payloadEvent)) return null;
    if (!hasMeaningfulEventValue(previewEvent)) return payloadEvent;
    if (!hasMeaningfulEventValue(payloadEvent) || typeof payloadEvent !== 'object') return previewEvent;

    const previewTeam = previewEvent?.team;
    const payloadTeam = payloadEvent?.team;

    return {
      ...previewEvent,
      ...payloadEvent,
      club: mergeNamedEventEntity(previewEvent?.club, payloadEvent?.club),
      facility: mergeNamedEventEntity(previewEvent?.facility, payloadEvent?.facility),
      location: preferEventValue(payloadEvent?.location, previewEvent?.location),
      locationDetails: preferEventValue(payloadEvent?.locationDetails, previewEvent?.locationDetails),
      name: preferEventValue(payloadEvent?.name, previewEvent?.name || 'Evenement'),
      team: (!hasMeaningfulEventValue(previewTeam) && !hasMeaningfulEventValue(payloadTeam))
        ? null
        : {
          ...(previewTeam || {}),
          ...(payloadTeam || {}),
          activities: preferEventValue(payloadTeam?.activities, previewTeam?.activities || []),
          category: preferEventValue(payloadTeam?.category, previewTeam?.category),
          club: mergeNamedEventEntity(previewTeam?.club, payloadTeam?.club),
          level: preferEventValue(payloadTeam?.level, previewTeam?.level),
          name: preferEventValue(payloadTeam?.name, previewTeam?.name),
          section: preferEventValue(payloadTeam?.section, previewTeam?.section),
        },
      type: mergeNamedEventEntity(previewEvent?.type, payloadEvent?.type)
        || { name: previewEvent?.type?.name || payloadEvent?.type?.name || 'Evenement' },
    };
  }, [
    hasMeaningfulEventValue,
    mergeNamedEventEntity,
    preferEventValue,
  ]);

  const resolveMessageEventPayload = useCallback((/** @type {any} */ message) => {
    const composition = message?.composition;
    const eventPayload = message?.event;
    const eventDocumentId = String(
      eventPayload?.documentId
      || eventPayload?.id
      || eventPayload
      || composition?.eventDocumentId
      || '',
    ).trim();

    const cachedEvent = eventDocumentId
      ? sharedEventPreviewByIdRef.current.get(eventDocumentId)
      : null;

    const compositionEventPreview = composition?.type === 'event_share'
      && composition?.eventPreview
      && typeof composition?.eventPreview === 'object'
      ? composition.eventPreview
      : null;

    const fallbackEvent = composition?.type === 'event_share' && eventDocumentId
      ? {
        date: composition?.eventDate || null,
        documentId: eventDocumentId,
        locationDetails: composition?.locationLabel || '',
        name: composition?.eventName || 'Evenement',
        team: composition?.teamName ? { name: composition?.teamName } : null,
        type: { name: 'Evenement' },
      }
      : null;

    const previewBase = compositionEventPreview || cachedEvent || fallbackEvent;

    if (eventPayload && typeof eventPayload === 'object') {
      const resolvedEvent = composition?.type === 'event_share'
        ? mergeSharedEventPayload(previewBase, eventPayload)
        : eventPayload;
      if (eventDocumentId && resolvedEvent) {
        sharedEventPreviewByIdRef.current.set(eventDocumentId, resolvedEvent);
      }
      return resolvedEvent;
    }

    if (previewBase && eventDocumentId) {
      sharedEventPreviewByIdRef.current.set(eventDocumentId, previewBase);
      return previewBase;
    }

    return null;
  }, [mergeSharedEventPayload]);

  const handleOpenPublicEventPicker = useCallback(() => {
    if (!chatId) return;
    setIsEventShareModalVisible(false);
    navigation.navigate(RouteNames.ConversationPublicEventPicker, { chatId });
  }, [chatId, navigation]);

  useEffect(() => {
    const eventFromPicker = route?.params?.sharedEventFromPicker;
    const eventDocumentId = String(eventFromPicker?.documentId || '').trim();
    if (!eventDocumentId) {
      handledSharedEventFromPickerRef.current = '';
      return;
    }
    if (handledSharedEventFromPickerRef.current === eventDocumentId) return;
    handledSharedEventFromPickerRef.current = eventDocumentId;

    handleShareEvent(eventFromPicker, { closeModal: false });
    navigation.setParams({ sharedEventFromPicker: undefined });
  }, [handleShareEvent, navigation, route?.params?.sharedEventFromPicker]);

  const handleOpenGroupManagement = () => {
    if (!isGroupAdmin) return;
    setGroupNameDraft(String(chatData?.groupName || ''));
    setIsMenuVisible(false);
    setIsGroupManagementVisible(true);
  };

  const handleSaveGroupName = async () => {
    const nextGroupName = String(groupNameDraft || '').trim();
    if (!chatId || !nextGroupName) {
      showErrorBanner('Entre un nom de groupe valide.', 'Nom requis');
      return;
    }

    try {
      setIsGroupMutationLoading(true);
      await updateGroupMeta({
        chatId,
        data: { groupName: nextGroupName },
      });
      showSuccessBanner('Nom du groupe mis à jour.', 'Succès');
    } catch (error) {
      conversationLogger.warn('Failed to update group name', error);
      showErrorBanner('Impossible de mettre à jour le nom du groupe.');
    } finally {
      setIsGroupMutationLoading(false);
    }
  };

  const handleAddGroupMembers = () => {
    if (!chatId) return;
    setIsGroupManagementVisible(false);
    navigation.navigate(RouteNames.NewConversation, {
      chatId,
      mode: 'add_group_members',
    });
  };

  const handleRemoveGroupMember = (/** @type {any} */ member) => {
    const memberId = String(member?.documentId || member?.id || '').trim();
    if (!chatId || !memberId) return;

    const memberLabel = `${member?.firstname || ''} ${member?.lastname || ''}`.trim() || 'ce membre';
    openConversationPrompt({
      body: `Retirer ${memberLabel} du groupe ?`,
      primaryAction: {
        label: 'Retirer',
        onPress: async () => {
          closeConversationPrompt();
          try {
            setIsGroupMutationLoading(true);
            await removeGroupMember({
              chatId,
              userId: memberId,
            });
          } catch (error) {
            conversationLogger.warn('Failed to remove group member', error);
            showErrorBanner('Impossible de retirer ce membre.');
          } finally {
            setIsGroupMutationLoading(false);
          }
        },
      },
      secondaryAction: {
        label: 'Annuler',
        onPress: closeConversationPrompt,
        variant: 'Secondary',
      },
      title: 'Retirer un membre',
      tone: 'critical',
    });
  };

  const resetVoiceRecordingState = useCallback(() => {
    setVoiceRecordingState(VOICE_RECORDING_STATES.idle);
    setVoiceRecordingDurationMs(0);
    setVoiceRecordingHint('');
    setVoiceRecordingWaveform([]);
    voiceWaveformTickRef.current = 0;
  }, []);

  const handleStartVoiceRecording = useCallback(async () => {
    if (pendingVoiceDraft?.uri) {
      stopDraftVoicePlayback().catch(() => {});
    }

    if (!canRecordVoiceNote || !chatId) {
      showInfoBanner(
        t('conversation.voice.unavailableDescription', 'Le module vocal n\'est pas disponible sur cette build.'),
        t('conversation.voice.unavailableTitle', 'Vocal indisponible'),
      );
      return;
    }

    if (voiceRecordingStateRef.current !== VOICE_RECORDING_STATES.idle) return;
    logVoiceDiagnostic('record-start-requested', {
      chatId,
      hasPendingDraft: Boolean(pendingVoiceDraft?.uri),
    });
    try {
      setVoiceRecordingHint(t('conversation.voice.hint', 'Glisser gauche pour annuler, glisser haut pour verrouiller.'));
      setVoiceRecordingDurationMs(0);
      setVoiceRecordingWaveform(
        Array.from({ length: 14 }, (_, index) => toVoiceWaveBarHeight(null, 0, index)),
      );
      voiceWaveformTickRef.current = 0;
      await startRecording({
        onMetering: (metering, durationMs) => {
          const now = Date.now();
          if (now - voiceWaveformTickRef.current < 80) return;
          voiceWaveformTickRef.current = now;

          setVoiceRecordingWaveform((previousWaveform) => {
            const nextHeight = toVoiceWaveBarHeight(
              metering,
              durationMs,
              previousWaveform.length,
            );
            const trimmedWaveform = previousWaveform.length >= VOICE_WAVEFORM_MAX_BARS
              ? previousWaveform.slice(previousWaveform.length - VOICE_WAVEFORM_MAX_BARS + 1)
              : previousWaveform;
            return [...trimmedWaveform, nextHeight];
          });
        },
        onProgress: (durationMs) => setVoiceRecordingDurationMs(durationMs),
      });
      setVoiceRecordingState(VOICE_RECORDING_STATES.recording);
      logVoiceDiagnostic('record-start-succeeded', { chatId });
    } catch (error) {
      const safeError = /** @type {any} */ (error);
      const code = String(safeError?.message || '');
      logVoiceDiagnostic('record-start-failed', {
        chatId,
        code,
        message: safeError?.message || safeError,
      });
      if (code === 'VOICE_ALREADY_RECORDING') return;
      conversationLogger.warn('Failed to start voice recording', error);
      setVoiceRecordingState(VOICE_RECORDING_STATES.error);
      if (code === 'VOICE_MODULE_UNAVAILABLE') {
        showInfoBanner(
          t('conversation.voice.unavailableDescription', 'Le module vocal n\'est pas disponible sur cette build.'),
          t('conversation.voice.unavailableTitle', 'Vocal indisponible'),
        );
      } else {
        showErrorBanner(
          t('conversation.voice.permissionDescription', 'Autorise le micro pour envoyer des notes vocales.'),
          t('conversation.voice.permissionTitle', 'Micro requis'),
        );
      }
      resetVoiceRecordingState();
    }
  }, [canRecordVoiceNote, chatId, logVoiceDiagnostic, pendingVoiceDraft?.uri, resetVoiceRecordingState, showErrorBanner, showInfoBanner, stopDraftVoicePlayback, t]);

  const handleCancelVoiceRecording = useCallback(async () => {
    if (voiceRecordingStateRef.current === VOICE_RECORDING_STATES.idle) return;

    try {
      await cancelRecording();
    } catch (_error) {
      // No-op cleanup.
    }
    logVoiceDiagnostic('record-cancelled', { chatId });
    resetVoiceRecordingState();
  }, [chatId, logVoiceDiagnostic, resetVoiceRecordingState]);

  const handleStopVoiceRecordingToDraft = useCallback(async () => {
    if (!chatId || !isVoiceRecording) return;

    try {
      setVoiceRecordingState(VOICE_RECORDING_STATES.sending);
      const draft = await stopRecording();
      logVoiceDiagnostic('record-stop-succeeded', {
        chatId,
        durationMs: Number(draft?.durationMs || 0) || 0,
        fileName: draft?.fileName || '',
        mime: draft?.mime || '',
        size: Number(draft?.size || 0) || 0,
        uri: draft?.uri || '',
      });

      if (!draft?.uri) {
        throw new Error('VOICE_EMPTY');
      }
      if ((draft?.durationMs || 0) < 500) {
        logVoiceDiagnostic('record-too-short-discarded', {
          chatId,
          durationMs: Number(draft?.durationMs || 0) || 0,
        });
        await deleteVoiceNoteFile(draft.uri);
        resetVoiceRecordingState();
        return;
      }

      const normalizedDurationMs = Math.max(0, Number(draft?.durationMs) || 0);
      let normalizedWaveform = Array.from(
        { length: 14 },
        (_, index) => toVoiceWaveBarHeight(null, normalizedDurationMs, index),
      );
      if (Array.isArray(draft?.waveform) && draft.waveform.length > 0) {
        normalizedWaveform = draft.waveform
          .map((bar, index) => toVoiceWaveBarHeight(bar, normalizedDurationMs, index))
          .slice(-VOICE_WAVEFORM_MAX_BARS);
      } else if (voiceRecordingWaveform.length > 0) {
        normalizedWaveform = voiceRecordingWaveform.slice(-VOICE_WAVEFORM_MAX_BARS);
      }

      setPendingVoiceDraft({
        diagnostics: draft?.diagnostics,
        durationMs: normalizedDurationMs,
        fileName: draft?.fileName || `voice-note-${Date.now()}.${getAttachmentExtensionFromAsset({
          type: draft?.mime || 'audio/mp4',
          uri: draft?.uri,
        })}`,
        mime: draft?.mime || 'audio/mp4',
        size: Math.max(0, Number(draft?.size) || 0),
        uri: draft.uri,
        waveform: normalizedWaveform,
      });

      setVoiceRecordingHint(t('conversation.voice.draftReadyHint', 'Note vocale prête. Ajoute un message puis envoie.'));
      logVoiceDiagnostic('draft-created', {
        chatId,
        diagnostics: draft?.diagnostics || null,
        durationMs: normalizedDurationMs,
        mime: draft?.mime || 'audio/mp4',
        size: Math.max(0, Number(draft?.size) || 0),
        uriScheme: String(draft?.uri || '').split(':')[0] || 'unknown',
      });
      resetVoiceRecordingState();
    } catch (error) {
      const safeError = /** @type {any} */ (error);
      conversationLogger.warn('Failed to finalize voice note draft', error);
      logVoiceDiagnostic('record-stop-failed', {
        chatId,
        code: String(safeError?.message || ''),
        message: safeError?.message || safeError,
      });
      setVoiceRecordingState(VOICE_RECORDING_STATES.error);
      const code = String(safeError?.message || '');
      let errorMessage = t(
        'conversation.voice.sendErrorDescription',
        'Impossible d\'envoyer la note vocale. Réessaie.',
      );
      if (code === 'VOICE_STOP_FAILED') {
        errorMessage = t(
          'conversation.voice.stopErrorDescription',
          'Impossible de finaliser l\'enregistrement vocal. Réessaie.',
        );
      } else if (code === 'VOICE_FILE_EMPTY') {
        errorMessage = t(
          'conversation.voice.emptyErrorDescription',
          'Aucun son exploitable n\'a été capturé. Réessaie.',
        );
      }
      showErrorBanner(
        errorMessage,
        t('conversation.voice.sendErrorTitle', 'Envoi impossible'),
      );
      resetVoiceRecordingState();
    }
  }, [
    chatId,
    getAttachmentExtensionFromAsset,
    isVoiceRecording,
    logVoiceDiagnostic,
    resetVoiceRecordingState,
    showErrorBanner,
    t,
    voiceRecordingWaveform,
  ]);

  const microphonePanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: () => (
      voiceRecordingStateRef.current === VOICE_RECORDING_STATES.recording
      || voiceRecordingStateRef.current === VOICE_RECORDING_STATES.locked
    ),
    onPanResponderGrant: () => {
      handleStartVoiceRecording();
    },
    onPanResponderMove: (_event, gestureState) => {
      if (voiceRecordingStateRef.current !== VOICE_RECORDING_STATES.recording) return;

      if (gestureState.dx <= VOICE_GESTURE_CANCEL_THRESHOLD) {
        handleCancelVoiceRecording();
        return;
      }

      if (gestureState.dy <= VOICE_GESTURE_LOCK_THRESHOLD) {
        setVoiceRecordingState(VOICE_RECORDING_STATES.locked);
        setVoiceRecordingHint(t('conversation.voice.lockedHint', 'Enregistrement verrouillé. Touche envoyer ou annuler.'));
      }
    },
    onPanResponderRelease: () => {
      if (voiceRecordingStateRef.current === VOICE_RECORDING_STATES.locked) return;
      if (voiceRecordingStateRef.current !== VOICE_RECORDING_STATES.recording) return;
      handleStopVoiceRecordingToDraft();
    },
    onPanResponderTerminate: () => {
      if (voiceRecordingStateRef.current === VOICE_RECORDING_STATES.recording) {
        handleCancelVoiceRecording();
      }
    },
    onStartShouldSetPanResponder: () => true,
  }), [
    handleCancelVoiceRecording,
    handleStartVoiceRecording,
    handleStopVoiceRecordingToDraft,
    t,
  ]);

  const openSharedContact = (/** @type {string} */ userDocumentId) => {
    if (!userDocumentId) return;
    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: userDocumentId },
      screen: RouteNames.UserDetails,
    });
  };

  const openSharedEvent = (/** @type {string} */ eventDocumentId) => {
    if (!eventDocumentId) return;
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: eventDocumentId },
      screen: RouteNames.EventDetails,
    });
  };

  const runAttachmentAction = (/** @type {() => Promise<void> | void} */ action) => {
    pendingAttachmentActionRef.current = action;
    setIsAttachmentMenuVisible(false);
  };

  const handleAttachmentSheetDismissed = useCallback(() => {
    const queuedAction = pendingAttachmentActionRef.current;
    pendingAttachmentActionRef.current = null;
    if (!queuedAction) return;
    queuedAction();
  }, []);

  const handleOpenAttachmentMenu = useCallback(() => {
    if (isAttachmentMenuVisible) return;

    const openMenu = () => setIsAttachmentMenuVisible(true);
    const visibleKeyboardHeight = Keyboard.metrics?.()?.height || 0;

    Keyboard.dismiss();

    if (visibleKeyboardHeight > 0) {
      setSafeTimeout(openMenu, Platform.OS === 'ios' ? 120 : 170);
      return;
    }

    openMenu();
  }, [isAttachmentMenuVisible, setSafeTimeout]);

  const attachmentSheetActions = useMemo(() => {
    let contactReason = '';
    if (!isContactShareEnabled) {
      contactReason = t('conversation.attachments.unavailable', 'Bientôt disponible');
    } else if (shareableContacts.length === 0) {
      contactReason = t('conversation.attachments.noContact', 'Aucun contact partageable');
    }

    const documentReason = isDocumentPickerDisabled
      ? t('conversation.attachments.documentDisabled', 'Indisponible sur cette build')
      : '';
    const eventReason = !isEventShareEnabled
      ? t('conversation.attachments.unavailable', 'Bientôt disponible')
      : '';
    const locationReason = !isLocationShareEnabled
      ? t('conversation.attachments.unavailable', 'Bientôt disponible')
      : '';

    return [
      {
        icon: 'PH',
        key: 'photos',
        label: t('conversation.attachments.photos', 'Photos'),
        loading: isUploading,
      },
      {
        icon: 'CA',
        key: 'camera',
        label: t('conversation.attachments.camera', 'Camera'),
        loading: isUploading,
      },
      {
        disabled: !isLocationShareEnabled,
        icon: 'LO',
        key: 'location',
        label: t('conversation.attachments.location', 'Localisation'),
        unavailableReason: locationReason,
      },
      {
        disabled: !isContactShareEnabled || shareableContacts.length === 0,
        icon: 'CO',
        key: 'contact',
        label: t('conversation.attachments.contact', 'Contact'),
        unavailableReason: contactReason,
      },
      {
        disabled: isDocumentPickerDisabled,
        icon: 'DO',
        key: 'document',
        label: t('conversation.attachments.document', 'Document'),
        unavailableReason: documentReason,
      },
      {
        icon: 'PO',
        key: 'poll',
        label: t('conversation.attachments.poll', 'Sondage'),
      },
      {
        disabled: !isEventShareEnabled,
        icon: 'EV',
        key: 'event',
        label: t('conversation.attachments.event', 'Événement'),
        unavailableReason: eventReason,
      },
    ];
  }, [
    isUploading,
    shareableContacts.length,
    t,
  ]);

  const handleAttachmentSheetAction = (/** @type {string} */ actionKey) => {
    switch (actionKey) {
      case 'camera':
        runAttachmentAction(handleTakePhoto);
        break;
      case 'contact':
        runAttachmentAction(() => setIsContactShareModalVisible(true));
        break;
      case 'document':
        runAttachmentAction(handlePickFile);
        break;
      case 'event':
        runAttachmentAction(() => setIsEventShareModalVisible(true));
        break;
      case 'location':
        runAttachmentAction(() => setIsLocationShareModalVisible(true));
        break;
      case 'photos':
        runAttachmentAction(handlePickMedia);
        break;
      case 'poll':
        runAttachmentAction(handleCreatePoll);
        break;
      default:
        break;
    }
  };

  /* Proposal Logic */
  const handleSendProposal = async (
    /** @type {any} */ proposalData,
    /** @type {{ legalAcceptance?: Record<string, unknown> } | undefined} */ options = undefined,
  ) => {
    try {
      const matchId = getEntityDocumentId(chatData?.league_match);
      if (!matchId) {
        throw new Error('Missing match id');
      }
      const proposalPayload = buildCanonicalLeagueProposalPayload(proposalData);
      if (!proposalPayload.venueLabel) {
        throw new Error('Missing proposal venue');
      }
      const legalAcceptance = options?.legalAcceptance || await requestLeagueLegalAcceptance({
        metadata: {
          chatId,
          matchLabel: leagueLegalMatchLabel,
          venueLabel: proposalPayload.venueLabel,
        },
        scope: LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
        sourceScreen: 'conversation_league_proposal',
        targetDocumentId: matchId,
        targetLabel: leagueLegalMatchLabel,
        targetType: 'league_match',
      });
      if (!legalAcceptance) return;

      setIsProposalSubmitting(true);
      await createLeagueProposal(matchId, /** @type {any} */ (proposalPayload), { legalAcceptance });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      await invalidatePendingLeagueActionQueries();

      setIsProposalModalVisible(false);
      setCounterProposalContext(null);
      showSuccessBanner('Ta proposition a été envoyée !', 'Envoye', 'league');
    } catch (error) {
      conversationLogger.error('Send proposal failed', error);
      showErrorBanner("Impossible d'envoyer la proposition.");
    } finally {
      setIsProposalSubmitting(false);
    }
  };

  const handleOpenCounterProposal = useCallback((
    /** @type {any} */ message,
    /** @type {{ isMine?: boolean; shouldDecline?: boolean }} */ options = {},
  ) => {
    const proposalMessageId = String(
      message?.documentId
      || message?._id
      || message?.id
      || '',
    ).trim();
    setCounterProposalContext({
      messageId: proposalMessageId,
      shouldDecline: options?.shouldDecline !== false && !options?.isMine,
    });
    setIsProposalModalVisible(true);
  }, []);

  const handleRespondProposal = async (/** @type {any} */ message, /** @type {string} */ status) => {
    const matchId = message?.composition?.matchId || getEntityDocumentId(chatData?.league_match);
    const proposalMessageId = String(message?.documentId || message?._id || message?.id || '').trim();

    if (isProposalResponseSubmitting) return;

    if (!proposalMessageId) {
      showErrorBanner('Impossible de retrouver la proposition.');
      return;
    }

    if (!matchId) {
      showErrorBanner('Impossible de retrouver le match associe.');
      return;
    }

    // Optimistic update of the message bubble.
    const updatedComposition = { ...message.composition, status };

    queryClient.setQueriesData({ queryKey: ['chat-messages', chatId] }, (/** @type {any} */ oldData) => {
      if (!oldData?.pages) return oldData;
      const targetMessageId = proposalMessageId;
      return {
        ...oldData,
        pages: oldData.pages.map((/** @type {any} */ page) => ({
          ...page,
          data: page.data.map((/** @type {any} */ msg) => {
            const msgId = String(msg.documentId || msg._id || msg.id || '');
            return msgId === targetMessageId ? { ...msg, composition: updatedComposition } : msg;
          }),
        })),
      };
    });

    try {
      setIsProposalResponseSubmitting(true);
      if (status === 'accepted') {
        conversationLogger.debug('Accepting match proposal', { matchId });
        const legalAcceptance = await requestLeagueLegalAcceptance({
          metadata: {
            chatId,
            matchLabel: leagueLegalMatchLabel,
            proposalMessageId,
          },
          scope: LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_ACCEPTANCE,
          sourceScreen: 'conversation_league_proposal_accept',
          targetDocumentId: matchId,
          targetLabel: leagueLegalMatchLabel,
          targetType: 'league_match',
        });
        if (!legalAcceptance) {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
          return;
        }

        await respondToLeagueProposal(matchId, proposalMessageId, 'accept', { legalAcceptance });
        showSuccessBanner('Le match est validé !', 'Match confirme', 'league');
        promptAddMatchToCalendar(message);
      } else {
        await respondToLeagueProposal(matchId, proposalMessageId, 'decline');
        conversationLogger.debug('Proposal declined');
        showSuccessBanner('Ton refus a été envoyé.', 'Proposition refusée', 'league');
      }

      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['league-matches'] });
      await invalidatePendingLeagueActionQueries();
    } catch (error) {
      conversationLogger.error('Proposal action failed', error);
      showErrorBanner('Une erreur est survenue lors de la réponse.');
    } finally {
      setIsProposalResponseSubmitting(false);
    }
  };

  /**
   * S03 — répondre à une proposition de match AMICAL depuis le fil.
   *
   * Constat d'Adel (16/08) : « il doit y avoir, pour l'entraîneur qui reçoit la
   * proposition, un BOUTON POUR ACCEPTER ». Sans ça, il fallait ressortir du fil,
   * retrouver l'annonce, ouvrir la liste des candidatures — pour un clic.
   *
   * ⛔ Ce n'est PAS une seconde règle d'acceptation : `respondToFriendlyProposal`
   * appelle exactement le service qu'appelle déjà le bouton « Accepter ce match »
   * de l'écran de l'annonce. Le serveur reste seul juge de qui a le droit.
   * @param {any} message - Le message porteur de la bulle.
   * @param {'accept' | 'decline'} action - Ce qu'on répond.
   * @returns {Promise<void>}
   */
  const submitFriendlyProposalResponse = async (message, action) => {
    const proposalMessageId = String(
      message?.documentId || message?._id || message?.id || '',
    ).trim();
    // La bulle passe tout de suite dans son état d'arrivée : le staff voit sa
    // réponse prise en compte sans attendre l'aller-retour, et le serveur
    // reposera le même verdict dans la charge du message.
    const nextStatus = action === 'accept' ? 'accepted' : 'declined';
    const messagesKey = { queryKey: ['chat-messages', chatId] };
    queryClient.setQueriesData(messagesKey, (/** @type {any} */ oldData) => {
      if (!oldData?.pages) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((/** @type {any} */ page) => ({
          ...page,
          data: page.data.map((/** @type {any} */ msg) => {
            const msgId = String(msg.documentId || msg._id || msg.id || '');
            return msgId === proposalMessageId
              ? { ...msg, composition: { ...msg.composition, status: nextStatus } }
              : msg;
          }),
        })),
      };
    });

    try {
      setIsProposalResponseSubmitting(true);
      await respondToFriendlyProposal(message?.composition, action);
      showSuccessBanner(
        action === 'accept'
          ? 'Le match est créé : il apparaît dans le planning des deux équipes.'
          : 'Ton refus a été envoyé.',
        action === 'accept' ? 'Match confirmé' : 'Proposition refusée',
      );
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
      queryClient.invalidateQueries({ queryKey: ['friendly-match-ads'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (error) {
      conversationLogger.error('Friendly proposal action failed', error);
      // Le message du serveur est LISIBLE (« Cette candidature n est plus en
      // attente », « Only the ad staff… ») : on le montre plutôt que de le
      // remplacer par un « Accès refusé » qui n'explique rien.
      showErrorBanner(
        /** @type {any} */ (error)?.message || 'Une erreur est survenue lors de la réponse.',
      );
      // La bulle reprend l'état que le serveur, lui, connaît.
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
    } finally {
      setIsProposalResponseSubmitting(false);
    }
  };

  /**
   * Accepter est un geste LOURD et irréversible côté serveur : il crée le match,
   * le pose dans le planning des deux équipes et refuse les autres candidatures
   * (Q6). Il passe donc par une confirmation qui dit ce qui va se produire.
   * @param {any} message - Le message porteur de la bulle.
   * @param {'accept' | 'decline'} action - Ce qu'on répond.
   * @returns {void}
   */
  const handleRespondFriendlyProposal = (message, action) => {
    if (isProposalResponseSubmitting) return;

    if (action === 'decline') {
      submitFriendlyProposalResponse(message, 'decline');
      return;
    }

    const confirmation = buildFriendlyProposalConfirmation();
    openConversationPrompt({
      body: confirmation.body,
      primaryAction: {
        label: 'Accepter',
        onPress: () => {
          closeConversationPrompt();
          submitFriendlyProposalResponse(message, 'accept');
        },
      },
      secondaryAction: {
        label: 'Annuler',
        onPress: closeConversationPrompt,
        variant: 'Secondary',
      },
      title: confirmation.title,
    });
  };

  const handleCancelMatch = async () => {
    const matchId = getEntityDocumentId(chatData?.league_match);
    if (!matchId) return;

    // Determine teamId of the current user
    const userId = userData?.documentId;
    /** @type {string | null} */
    let teamId = null;
    const teamA = chatData?.league_match?.team_a;
    const teamB = chatData?.league_match?.team_b;

    if (isLeagueCaptain(teamA, userId)) {
      teamId = getEntityDocumentId(teamA);
    } else if (isLeagueCaptain(teamB, userId)) {
      teamId = getEntityDocumentId(teamB);
    } else {
      teamId = userData?.team?.documentId || null;
    }

    if (!teamId) {
      showErrorBanner("Impossible d'identifier ton équipe pour l'annulation.");
      return;
    }

    openConversationPrompt({
      body: 'Cette action annulera le match et supprimera la conversation.',
      primaryAction: {
        label: 'Oui, annuler',
        onPress: async () => {
          closeConversationPrompt();
          try {
            const resolvedTeamId = teamId;
            if (!resolvedTeamId) return;
            conversationLogger.debug('Cancelling match', { matchId, teamId: resolvedTeamId });
            await cancelMatch(matchId, resolvedTeamId, 'Demande capitaine');
            navigation.goBack();
          } catch (error) {
            conversationLogger.error('Cancel match failed', error);
            showErrorBanner("Impossible d'annuler le match.");
          }
        },
      },
      secondaryAction: {
        label: 'Non',
        onPress: closeConversationPrompt,
        variant: 'Secondary',
      },
      title: 'Annuler le match ?',
      tone: 'critical',
    });
  };

  // Calculate title for Custom Header
  // Calculate title for Custom Header
  const title = useMemo(() => {
    const routeTitle = String(route?.params?.title || '').trim();
    const safeRouteTitle = routeTitle === 'common.chat' ? '' : routeTitle;
    let displayTitle = '';

    if (chatData?.type === 'league_match') {
      const matchDate = chatData?.league_match?.date;
      const dateDisplay = matchDate
        ? new Date(matchDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        : '?';
      displayTitle = `Match ${dateDisplay}`;
    } else {
      displayTitle = getConversationName({
        chatClub: chatData?.club,
        chatGroupName: chatData?.groupName,
        chatLeagueMatch: chatData?.league_match,
        chatMultisportClub: chatData?.multisportClub,
        chatParticipants: chatData?.participants,
        chatTeam: chatData?.team,
        chatType: chatData?.type || '',
        meId: userData?.documentId,
      });
    }
    return displayTitle || safeRouteTitle || t('common.chat', 'Conversation');
  }, [chatData, route.params, getConversationName, userData, t]);

  const subtitle = route.params?.subTitle || '';
  const proposalDefaults = useMemo(
    () => buildProposalDefaultsFromMatch(chatData?.league_match || null),
    [chatData?.league_match],
  );

  const isLeagueConversation = chatData?.type === 'league_match' || Boolean(chatData?.league_match);
  const leagueConversationStatus = String(chatData?.league_match?.status || '').trim().toLowerCase();
  const leagueConversationPhase = String(
    chatData?.league_match?.phase
    || chatData?.league_match?.workflow?.phase
    || '',
  ).trim().toLowerCase();
  const canCreateLeagueProposalFromChat = isLeagueConversation
    && (
      ['negotiating', 'provisional', 'provisionary'].includes(leagueConversationStatus)
      || leagueConversationPhase === 'waiting_proposal'
    );
  const showCancelButton = isLeagueConversation && chatData?.league_match;
  conversationLogger.debug('Computed cancel button visibility', {
    hasLeagueMatch: Boolean(chatData?.league_match),
    showCancelButton: Boolean(showCancelButton),
    type: chatData?.type,
  });

  // Anonymization helper for league_match chats
  const getAnonymizedName = useCallback((/** @type {User} */ sender) => {
    // If not a league match chat, show real name
    if (chatData?.type !== 'league_match') {
      return `${sender?.firstname || ''} ${sender?.lastname || ''}`;
    }

    // Check if the sender is the current user
    if (sender?.documentId === userData?.documentId) {
      return `${sender?.firstname || ''} ${sender?.lastname || ''}`;
    }

    // For league match chats, check if event has passed
    const eventDate = chatData?.league_match?.date;
    const hasEventPassed = eventDate && new Date(eventDate) < new Date();

    if (hasEventPassed) {
      // Event passed, reveal real names
      return `${sender?.firstname || ''} ${sender?.lastname || ''}`;
    }

    // Get my team's members to determine if sender is opponent
    const myTeamMembers = chatData?.myTeamMembers || [];
    const isMyTeamMember = myTeamMembers.some((/** @type {any} */ m) => m.documentId === sender?.documentId);

    if (isMyTeamMember) {
      // Show real name for teammates
      return `${sender?.firstname || ''} ${sender?.lastname || ''}`;
    }

    // This is an opponent - anonymize
    const isCaptain = isLeagueCaptain(chatData?.league_match?.team_a, sender)
      || isLeagueCaptain(chatData?.league_match?.team_b, sender);

    return isCaptain ? 'Capitaine Adverse' : 'Joueur Adverse';
  }, [chatData, userData?.documentId]);

  const voterNameDirectory = useMemo(() => {
    /** @type {Map<string, string>} */
    const directory = new Map();

    const registerUser = (/** @type {any} */ user) => {
      const userId = user?.documentId || user?.id;
      if (!userId) return;

      const firstname = (user?.firstname || '').trim();
      const lastname = (user?.lastname || '').trim();
      const fullName = `${firstname} ${lastname}`.trim();
      const fallbackName = (user?.username || user?.email || '').trim();
      const nextName = fullName || fallbackName || 'Membre';
      directory.set(String(userId), nextName);
    };

    registerUser(userData);

    if (Array.isArray(chatData?.participants)) {
      chatData.participants.forEach((/** @type {any} */ participant) => registerUser(participant));
    }

    if (Array.isArray(messagesPages?.pages)) {
      messagesPages.pages.forEach((/** @type {any} */ page) => {
        if (!Array.isArray(page?.data)) return;
        page.data.forEach((/** @type {any} */ msg) => registerUser(msg?.sender));
      });
    }

    return directory;
  }, [chatData?.participants, messagesPages?.pages, userData]);

  const resolveVoterName = (/** @type {string} */ voterId) => {
    if (!voterId) return 'Membre';
    return voterNameDirectory.get(String(voterId)) || 'Membre';
  };

  /** @type {any[]} */
  // 🙈 BLOQUER (K4) — LE BLOCAGE CACHE, IL NE SUPPRIME PAS. Les bulles d une
  // personne bloquee sortent de l AFFICHAGE ; elles restent en base, ou elles
  // peuvent servir a un signalement. Utile surtout dans un fil COLLECTIF : un
  // groupe ou un fil de club reste ouvert, mais on n y lit plus la personne
  // bloquee. Pour un tete-a-tete, le serveur a deja ferme la porte.
  const messages = useMemo(() => hideBlockedMessages((messagesPages ? messagesPages?.pages?.reduce((/** @type {any[]} */ acc, /** @type {any} */ page) => {
    const formattedMessages = page.data.map((/** @type {any} */ msg) => {
      const rawAttachments = msg.attachments;
      const normalizedAttachments = normalizeMessageAttachments(msg.attachments);
      const messageKey = String(msg?.documentId || msg?.id || '');
      if (
        isAttachmentDebugEnabled
        && rawAttachments
        && normalizedAttachments.length === 0
        && messageKey
        && !loggedAttachmentShapeMessageIdsRef.current.has(messageKey)
      ) {
        loggedAttachmentShapeMessageIdsRef.current.add(messageKey);
        const rawIsObject = rawAttachments && typeof rawAttachments === 'object';
        logAttachmentDebug('message attachments normalization empty', {
          hasDataArray: Boolean(rawIsObject && Array.isArray(rawAttachments?.data)),
          hasDataObject: Boolean(rawIsObject && rawAttachments?.data && typeof rawAttachments.data === 'object' && !Array.isArray(rawAttachments.data)),
          messageId: messageKey,
          rawKeys: rawIsObject ? Object.keys(rawAttachments).slice(0, 10) : [],
          rawType: Array.isArray(rawAttachments) ? 'array' : typeof rawAttachments,
        });
      }
      const safeMessage = { attachments: normalizedAttachments };
      const imageUrl = isImageAttachmentMessage(safeMessage)
        ? getPrimaryImageUriFromMessage(safeMessage)
        : undefined;

      const senderAvatarUrl = msg.sender?.avatar?.url || '';
      const avatarUrl = resolveMediaUri(senderAvatarUrl);
      const senderEntityId = getEntityDocumentId(msg.sender);
      const stableMessageId = String(
        msg?.documentId
        || msg?.id
        || `${msg?.createdAt || 'message'}-${senderEntityId || 'system'}`,
      ).trim();

      return {
        _id: stableMessageId,
        attachments: normalizedAttachments,
        composition: msg.composition,
        createdAt: new Date(msg.createdAt),
        documentId: msg.documentId,
        event: msg.event,
        failed: msg.failed,
        image: imageUrl,
        pending: msg.pending,
        readBy: msg.readBy,
        replyTo: msg.replyTo,
        senderDocumentId: senderEntityId,
        text: msg.message,
        user: {
          _id: senderEntityId,
          avatar: avatarUrl,
          name: getAnonymizedName(msg.sender),
        },
      };
    });
    return [...acc, ...formattedMessages];
  }, /** @type {any[]} */ ([])) : []), blockedUserIds), [blockedUserIds, messagesPages, getAnonymizedName, getPrimaryImageUriFromMessage, isImageAttachmentMessage, logAttachmentDebug, normalizeMessageAttachments, resolveMediaUri]);

  // Impasse corrigee : sans ces etats, un chargement en echec laissait une
  // conversation vide et muette, sans aucune issue autre que tuer l'app.
  const hasNoMessageToShow = messages.length === 0;
  const hasMessagesLoadingError = Boolean(isMessagesError) && hasNoMessageToShow;
  const isMessagesFirstLoad = Boolean(isMessagesLoading)
    && !hasMessagesLoadingError
    && hasNoMessageToShow;

  const handleRetryMessages = useCallback(() => {
    refetchMessages();
  }, [refetchMessages]);

  useEffect(() => {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId || conversationOpenLoggedChatIdRef.current === safeChatId) return;

    conversationOpenLoggedChatIdRef.current = safeChatId;
    conversationPrimaryLoggedChatIdRef.current = '';
    conversationFirstRenderedChatIdRef.current = '';
    markMessagingPerf('messaging_conversation_open_started', {
      chatId: safeChatId,
    });
  }, [chatId]);

  useEffect(() => {
    const safeChatId = String(chatId || '').trim();
    if (
      !safeChatId
      || !Array.isArray(messagesPages?.pages)
      || isMessagesLoading
      || conversationPrimaryLoggedChatIdRef.current === safeChatId
    ) {
      return;
    }

    conversationPrimaryLoggedChatIdRef.current = safeChatId;
    markMessagingPerf('messaging_conversation_primary_query_completed', {
      chatId: safeChatId,
      fromCache: !isMessagesFetching,
      messageCount: messages.length,
    });
  }, [chatId, isMessagesFetching, isMessagesLoading, messages.length, messagesPages?.pages]);

  useEffect(() => {
    const safeChatId = String(chatId || '').trim();
    if (
      !safeChatId
      || !Array.isArray(messagesPages?.pages)
      || isMessagesLoading
      || conversationFirstRenderedChatIdRef.current === safeChatId
    ) {
      return undefined;
    }

    const frameId = requestAnimationFrame(() => {
      conversationFirstRenderedChatIdRef.current = safeChatId;
      markMessagingPerf('messaging_conversation_first_messages_rendered', {
        chatId: safeChatId,
        messageCount: messages.length,
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [chatId, isMessagesLoading, messages.length, messagesPages?.pages]);

  const latestMessageId = String(
    messages?.[0]?.documentId
    || messages?.[0]?._id
    || '',
  ).trim();
  const latestProposalMessage = useMemo(() => (
    Array.isArray(messages)
      ? messages.find((/** @type {any} */ message) => message?.composition?.type === 'proposal' && message?.composition?.status === 'pending')
        || messages.find((/** @type {any} */ message) => message?.composition?.type === 'proposal')
        || null
      : null
  ), [messages]);
  const latestProposalMessageId = String(
    latestProposalMessage?.documentId
    || latestProposalMessage?._id
    || '',
  ).trim();
  const leagueConversationMatch = chatData?.league_match || null;
  const leagueConversationMatchId = getEntityDocumentId(leagueConversationMatch);
  const teamAUserIds = useMemo(
    () => collectLeagueTeamUserIds(leagueConversationMatch?.team_a),
    [leagueConversationMatch?.team_a],
  );
  const teamBUserIds = useMemo(
    () => collectLeagueTeamUserIds(leagueConversationMatch?.team_b),
    [leagueConversationMatch?.team_b],
  );
  const currentUserLeagueSide = useMemo(() => {
    const currentUserIds = new Set();
    addLeagueTeamUserId(currentUserIds, userData);
    const currentUserBelongsToTeamA = Array.from(currentUserIds).some((userId) => teamAUserIds.has(userId));
    if (currentUserBelongsToTeamA) return 'a';

    const currentUserBelongsToTeamB = Array.from(currentUserIds).some((userId) => teamBUserIds.has(userId));
    if (currentUserBelongsToTeamB) return 'b';

    return '';
  }, [teamAUserIds, teamBUserIds, userData]);
  const myTeamMemberIds = useMemo(() => {
    /** @type {Set<string>} */
    let ownSideIds = new Set();
    if (currentUserLeagueSide === 'a') {
      ownSideIds = teamAUserIds;
    } else if (currentUserLeagueSide === 'b') {
      ownSideIds = teamBUserIds;
    }

    const ids = new Set(ownSideIds);
    const members = Array.isArray(chatData?.myTeamMembers) ? chatData.myTeamMembers : [];
    members.forEach((/** @type {any} */ member) => addLeagueTeamUserId(ids, member));
    addLeagueTeamUserId(ids, userData);
    return ids;
  }, [chatData?.myTeamMembers, currentUserLeagueSide, teamAUserIds, teamBUserIds, userData]);
  const getLeagueSideForUserId = useCallback((/** @type {string} */ userId) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) return '';
    if (teamAUserIds.has(safeUserId)) return 'a';
    if (teamBUserIds.has(safeUserId)) return 'b';
    return '';
  }, [teamAUserIds, teamBUserIds]);
  const getProposalAuthorSide = useCallback((/** @type {any} */ message) => {
    const proposal = message?.composition || {};
    const explicitSide = normalizeLeagueTeamSide(
      proposal.proposalSide
      || proposal.senderTeamSide
      || proposal.teamSide
      || proposal.authorSide,
    );
    if (explicitSide) return explicitSide;

    const messageId = getMessageEntityId(message);
    if (messageId && latestProposalMessageId && messageId === latestProposalMessageId) {
      const latestProposalSide = normalizeLeagueTeamSide(
        leagueConversationMatch?.automation_meta?.last_proposal_by_side,
      );
      if (latestProposalSide) return latestProposalSide;
    }

    return getLeagueSideForUserId(getMessageSenderId(message));
  }, [getLeagueSideForUserId, latestProposalMessageId, leagueConversationMatch?.automation_meta]);
  const isProposalMessageFromMySquad = useCallback((message) => {
    const proposalAuthorSide = getProposalAuthorSide(message);
    if (proposalAuthorSide && currentUserLeagueSide) {
      return proposalAuthorSide === currentUserLeagueSide;
    }

    const proposalSenderId = getMessageSenderId(message);
    return Boolean(proposalSenderId && myTeamMemberIds.has(proposalSenderId));
  }, [currentUserLeagueSide, getProposalAuthorSide, myTeamMemberIds]);
  const isLatestProposalFromMySquad = useMemo(
    () => isProposalMessageFromMySquad(latestProposalMessage),
    [isProposalMessageFromMySquad, latestProposalMessage],
  );
  const leagueNegotiationSummary = useMemo(() => {
    const proposal = latestProposalMessage?.composition || null;
    const proposalDate = proposal?.date || leagueConversationMatch?.proposed_time || leagueConversationMatch?.date || null;
    const proposalEndDate = proposal?.endDate || leagueConversationMatch?.location?.proposed_end_time || null;
    const proposalVenue = getProposalLocationLabel(proposal?.venue)
      || getProposalLocationLabel(leagueConversationMatch?.proposed_venue)
      || getProposalLocationLabel(leagueConversationMatch?.venue)
      || 'Lieu à définir';
    const proposalStatus = String(proposal?.status || '').trim().toLowerCase();

    let statusLabel = 'Négociation active';
    let summaryTitle = 'Organisation du match en cours';
    if (proposalStatus === 'accepted') {
      statusLabel = 'Proposition acceptée';
      summaryTitle = 'Le match est en bonne voie';
    } else if (proposalStatus === 'declined') {
      statusLabel = 'Proposition refusée';
      summaryTitle = 'Une nouvelle proposition est attendue';
    } else if (proposalStatus === 'pending') {
      statusLabel = isLatestProposalFromMySquad ? 'Proposition envoyée' : 'Proposition reçue';
      summaryTitle = isLatestProposalFromMySquad
        ? 'Ta proposition attend une réponse'
        : 'Une proposition attend ta réponse';
    }

    let helper = 'La conversation avec l adversaire reste l espace principal pour conclure ce match.';
    if (proposalStatus === 'pending') {
      helper = isLatestProposalFromMySquad
        ? 'Suis la réponse adverse depuis le chat ou la fiche match.'
        : 'Consulte la proposition puis acceptes, refuse ou contre-propose.';
    } else if (proposalStatus === 'accepted') {
      helper = 'Retrouve les détails confirms sur la fiche match.';
    } else if (proposalStatus === 'declined') {
      helper = 'Poursuis la négociation pour trouver un nouveau créneau.';
    }

    let formattedDate = 'Date à définir';
    if (proposalDate) {
      try {
        formattedDate = new Date(proposalDate).toLocaleString('fr-FR', {
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          month: 'long',
        });
      } catch (_error) {
        formattedDate = 'Date à définir';
      }
    }

    let scheduleLabel = formattedDate;
    if (proposalDate) {
      try {
        const start = new Date(proposalDate);
        const end = proposalEndDate ? new Date(proposalEndDate) : null;
        const dayLabel = start.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'short',
          weekday: 'short',
        });
        const startTime = start.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const endTime = end && !Number.isNaN(end.getTime())
          ? end.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })
          : null;
        scheduleLabel = endTime ? `${dayLabel} • ${startTime} - ${endTime}` : `${dayLabel} • ${startTime}`;
      } catch (_error) {
        scheduleLabel = formattedDate;
      }
    }

    let compactHelper = 'La discussion dans le chat reste l espace principal pour organiser ce match.';
    if (proposalStatus === 'pending') {
      compactHelper = isLatestProposalFromMySquad
        ? 'Suis la réponse adverse directement dans le fil.'
        : 'Réponds directement depuis la proposition dans le fil.';
    } else if (proposalStatus === 'accepted') {
      compactHelper = 'Retrouve les détails confirms dans la fiche match.';
    } else if (proposalStatus === 'declined') {
      compactHelper = 'La négociation continue dans le fil de discussion.';
    }

    return {
      compactHelper,
      formattedDate,
      helper,
      proposalStatus,
      scheduleLabel,
      statusLabel,
      title: summaryTitle,
      venue: proposalVenue,
    };
  }, [isLatestProposalFromMySquad, latestProposalMessage?.composition, leagueConversationMatch]);

  useEffect(() => {
    if (!isSocketReadTypingEnabled) return;
    if (!chatId) return;
    sendReadReceipt(chatId, latestMessageId || undefined);
  }, [chatId, latestMessageId, sendReadReceipt]);

  const openFirstAttachment = useCallback(async (message) => {
    const normalizedAttachments = normalizeMessageAttachments(message?.attachments);
    const normalizedMessage = { ...message, attachments: normalizedAttachments };
    const isImageAttachment = isImageAttachmentMessage(normalizedMessage);
    const previewUri = getPrimaryImageUriFromMessage(normalizedMessage);

    if (isImageAttachment && previewUri) {
      logAttachmentDebug('openFirstAttachment image preview', {
        resolvedUrl: previewUri,
      });
      setDidTryImageHttpsFallback(false);
      setPreviewImageUrl(previewUri);
      setIsImagePreviewVisible(true);
      return;
    }
    const attachment = normalizedAttachments?.[0] || {};
    let fallbackUrl = resolveMediaUri(
      attachment?.url
      || attachment?.uri
      || attachment?.formats?.large?.url
      || attachment?.formats?.medium?.url
      || attachment?.formats?.small?.url
      || attachment?.formats?.thumbnail?.url,
    );
    if (!fallbackUrl && attachment?.id) {
      fallbackUrl = await fetchAttachmentUrlById(attachment.id);
    }
    if (!fallbackUrl) return;
    const resolvedUrl = fallbackUrl;

    if (isImageAttachment) {
      setDidTryImageHttpsFallback(false);
      setPreviewImageUrl(resolvedUrl);
      setIsImagePreviewVisible(true);
      return;
    }

    try {
      await Linking.openURL(resolvedUrl);
    } catch (error) {
      logAttachmentDebug('openFirstAttachment failed to open URL', {
        error: error?.message || error,
        resolvedUrl,
      });
      conversationLogger.warn('Failed to open attachment URL', error);
    }
  }, [fetchAttachmentUrlById, resolveMediaUri, isImageAttachmentMessage, getPrimaryImageUriFromMessage, logAttachmentDebug, normalizeMessageAttachments]);

  const resolveAttachmentActionUrl = useCallback(async (attachment) => {
    if (!attachment || typeof attachment !== 'object') return '';

    let resolvedUrl = resolveMediaUri(
      attachment?.url
      || attachment?.uri
      || attachment?.formats?.large?.url
      || attachment?.formats?.medium?.url
      || attachment?.formats?.small?.url
      || attachment?.formats?.thumbnail?.url
      || attachment?.previewUrl,
    );

    if (!resolvedUrl && attachment?.id) {
      resolvedUrl = await fetchAttachmentUrlById(attachment.id);
    }

    return resolvedUrl || '';
  }, [fetchAttachmentUrlById, resolveMediaUri]);

  const openAttachmentActionUrl = useCallback(async (resolvedUrl, attachmentLabel = '') => {
    if (!resolvedUrl) {
      showInfoBanner(
        t('conversation.attachments.unavailableDescription', 'Ce document ne peut pas être ouvert pour le moment.'),
        t('conversation.attachments.unavailableTitle', 'Fichier indisponible'),
      );
      return false;
    }

    try {
      await Linking.openURL(resolvedUrl);
      return true;
    } catch (error) {
      logAttachmentDebug('openAttachmentActionUrl failed', {
        attachmentLabel,
        error: error?.message || error,
        resolvedUrl,
      });
      conversationLogger.warn('Failed to open attachment action URL', error);
      showErrorBanner(
        t('conversation.attachments.openErrorDescription', 'Le document n a pas pu être ouvert.'),
        t('conversation.attachments.openErrorTitle', 'Ouverture impossible'),
      );
      return false;
    }
  }, [logAttachmentDebug, showErrorBanner, showInfoBanner, t]);

  const toDocumentActionMessage = useCallback((message) => {
    const normalizedAttachments = normalizeMessageAttachments(message?.attachments);
    const primaryDocumentAttachment = getPrimaryDocumentAttachment(normalizedAttachments);
    if (!primaryDocumentAttachment) return null;

    return {
      ...message,
      attachments: normalizedAttachments,
    };
  }, [normalizeMessageAttachments]);

  const closeDocumentActionMenu = useCallback(() => {
    setSelectedDocumentActionMessage(null);
  }, []);

  const openDocumentActionMenu = useCallback((message) => {
    const actionableMessage = toDocumentActionMessage(message);
    if (!actionableMessage) return;
    setSelectedDocumentActionMessage(actionableMessage);
  }, [toDocumentActionMessage]);

  const openDocumentAttachmentFromMessage = useCallback(async (message) => {
    const actionableMessage = toDocumentActionMessage(message);
    if (!actionableMessage) return false;

    const primaryDocumentAttachment = getPrimaryDocumentAttachment(actionableMessage.attachments);
    const resolvedUrl = await resolveAttachmentActionUrl(primaryDocumentAttachment);
    const attachmentLabel = getDocumentDisplayName(primaryDocumentAttachment);
    return openAttachmentActionUrl(resolvedUrl, attachmentLabel);
  }, [openAttachmentActionUrl, resolveAttachmentActionUrl, toDocumentActionMessage]);

  const downloadDocumentAttachmentFromMessage = useCallback(async (message) => (
    openDocumentAttachmentFromMessage(message)
  ), [openDocumentAttachmentFromMessage]);

  const shareDocumentAttachmentFromMessage = useCallback(async (message) => {
    const actionableMessage = toDocumentActionMessage(message);
    if (!actionableMessage) return false;

    const primaryDocumentAttachment = getPrimaryDocumentAttachment(actionableMessage.attachments);
    const resolvedUrl = await resolveAttachmentActionUrl(primaryDocumentAttachment);
    const attachmentLabel = getDocumentDisplayName(primaryDocumentAttachment);
    if (!resolvedUrl) {
      showInfoBanner(
        t('conversation.attachments.shareUnavailableDescription', 'Ce document ne peut pas être partage pour le moment.'),
        t('conversation.attachments.unavailableTitle', 'Fichier indisponible'),
      );
      return false;
    }

    try {
      await shareApi.share({
        message: `${attachmentLabel}\n${resolvedUrl}`,
        title: attachmentLabel,
        url: resolvedUrl,
      });
      return true;
    } catch (error) {
      logAttachmentDebug('shareDocumentAttachmentFromMessage failed', {
        attachmentLabel,
        error: error?.message || error,
        resolvedUrl,
      });
      conversationLogger.warn('Failed to share attachment URL', error);
      showErrorBanner(
        t('conversation.attachments.shareErrorDescription', 'Le document n a pas pu être partage.'),
        t('conversation.attachments.shareErrorTitle', 'Partage impossible'),
      );
      return false;
    }
  }, [logAttachmentDebug, resolveAttachmentActionUrl, showErrorBanner, showInfoBanner, t, toDocumentActionMessage]);

  const handleOpenSelectedDocumentAttachment = useCallback(async () => {
    const selectedDocumentMessage = selectedDocumentActionMessage;
    closeDocumentActionMenu();
    await openDocumentAttachmentFromMessage(selectedDocumentMessage);
  }, [closeDocumentActionMenu, openDocumentAttachmentFromMessage, selectedDocumentActionMessage]);

  const handleDownloadSelectedDocumentAttachment = useCallback(async () => {
    const selectedDocumentMessage = selectedDocumentActionMessage;
    closeDocumentActionMenu();
    await downloadDocumentAttachmentFromMessage(selectedDocumentMessage);
  }, [closeDocumentActionMenu, downloadDocumentAttachmentFromMessage, selectedDocumentActionMessage]);

  const handleShareSelectedDocumentAttachment = useCallback(async () => {
    const selectedDocumentMessage = selectedDocumentActionMessage;
    closeDocumentActionMenu();
    await shareDocumentAttachmentFromMessage(selectedDocumentMessage);
  }, [closeDocumentActionMenu, selectedDocumentActionMessage, shareDocumentAttachmentFromMessage]);

  const handleRetrySelectedDocumentAttachment = useCallback(() => {
    if (!selectedDocumentActionMessage) return;
    const selectedDocumentMessage = selectedDocumentActionMessage;
    closeDocumentActionMenu();
    retryFailedMessage(chatId, selectedDocumentMessage);
  }, [chatId, closeDocumentActionMenu, retryFailedMessage, selectedDocumentActionMessage]);

  const renderMessageImage = useCallback((messageImageProps) => {
    const rawMessage = messageImageProps?.currentMessage || {};
    const safeMessage = {
      ...rawMessage,
      attachments: normalizeMessageAttachments(rawMessage?.attachments),
    };
    const resolvedUrl = getPrimaryImageUriFromMessage(safeMessage);
    if (!resolvedUrl) return null;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          logAttachmentDebug('renderMessageImage open preview', { resolvedUrl });
          setDidTryImageHttpsFallback(false);
          setPreviewImageUrl(resolvedUrl);
          setIsImagePreviewVisible(true);
        }}
      >
        <Image
          onError={(event) => {
            logAttachmentDebug('renderMessageImage load error', {
              error: event?.nativeEvent?.error || 'unknown',
              resolvedUrl,
            });
          }}
          resizeMode="cover"
          source={{ uri: resolvedUrl }}
          style={{
            borderRadius: 12,
            height: 170,
            marginTop: 4,
            width: 220,
          }}
        />
      </TouchableOpacity>
    );
  }, [getPrimaryImageUriFromMessage, logAttachmentDebug, normalizeMessageAttachments]);

  const selectedDocumentActionAttachment = useMemo(() => (
    getPrimaryDocumentAttachment(
      normalizeMessageAttachments(selectedDocumentActionMessage?.attachments),
    )
  ), [normalizeMessageAttachments, selectedDocumentActionMessage?.attachments]);

  const selectedDocumentActionPreview = useMemo(() => (
    getDocumentPreviewText(normalizeMessageAttachments(selectedDocumentActionMessage?.attachments))
  ), [normalizeMessageAttachments, selectedDocumentActionMessage?.attachments]);

  const clearPendingMediaDraft = () => {
    setPendingMediaDraft(null);
  };

  const clearPendingVoiceDraft = useCallback(async () => {
    const currentDraftUri = String(pendingVoiceDraft?.uri || '').trim();
    stopDraftVoicePlayback().catch(() => {});
    setPendingVoiceDraft(null);
    logVoiceDiagnostic('draft-cleared', {
      chatId,
      hadUri: Boolean(currentDraftUri),
    });
    if (!currentDraftUri) return;
    try {
      await deleteVoiceNoteFile(currentDraftUri);
    } catch (error) {
      conversationLogger.warn('Failed to delete local voice draft', {
        message: error?.message || error,
        uri: currentDraftUri,
      });
    }
  }, [chatId, logVoiceDiagnostic, pendingVoiceDraft?.uri, stopDraftVoicePlayback]);

  const sendPendingVoiceDraft = async () => {
    if (uploadInFlightRef.current) {
      logAttachmentDebug('sendPendingVoiceDraft skipped: upload already in progress', { chatId });
      return;
    }

    if (!pendingVoiceDraft?.uri || !chatId) {
      logVoiceDiagnostic('send-skipped-missing-draft', {
        chatId,
        hasDraftUri: Boolean(pendingVoiceDraft?.uri),
      });
      return;
    }
    if (!isSocketConnected || !socket) {
      logVoiceDiagnostic('send-socket-unavailable', {
        chatId,
        socketConnected: Boolean(isSocketConnected && socket),
      });
      showErrorBanner(
        'Connexion messagerie indisponible. Réessaie quand la conversation est reconnectée.',
        t('conversation.voice.sendErrorTitle', 'Envoi impossible'),
      );
      return;
    }

    const normalizedVoiceAsset = {
      fileName: pendingVoiceDraft.fileName || `voice-note-${Date.now()}.${getAttachmentExtensionFromAsset({
        type: pendingVoiceDraft.mime || 'audio/mp4',
        uri: pendingVoiceDraft.uri,
      })}`,
      size: Number(pendingVoiceDraft.size || 0) || 0,
      type: pendingVoiceDraft.mime || 'audio/mp4',
      uri: pendingVoiceDraft.uri,
    };
    logVoiceDiagnostic('send-start', {
      asset: describeAsset(normalizedVoiceAsset),
      chatId,
      hasReplyTo: Boolean(replyingTo?.documentId),
      messageLength: String(composerText || '').trim().length,
      socketConnected: Boolean(isSocketConnected && socket),
    });
    const voiceValidationError = validateAttachmentAsset(normalizedVoiceAsset);
    if (voiceValidationError) {
      logVoiceDiagnostic('send-validation-failed', {
        chatId,
        reason: voiceValidationError?.reason,
        userMessage: voiceValidationError?.userMessage,
      });
      showErrorBanner(
        voiceValidationError?.userMessage || 'Validation audio impossible.',
        t('conversation.voice.sendErrorTitle', 'Envoi impossible'),
      );
      return;
    }

    const localUploadId = createLocalUploadId();
    const optimisticMessageId = `temp-upload-${localUploadId}`;
    const clientMessageId = `cmid-upload-${localUploadId}`;
    const createdAt = new Date().toISOString();
    const replyToPayload = replyingTo ? { documentId: replyingTo.documentId } : null;
    const voiceComposition = {
      durationMs: pendingVoiceDraft.durationMs || 0,
      mime: pendingVoiceDraft.mime || 'audio/mp4',
      size: pendingVoiceDraft.size || 0,
      type: 'voice_note',
      version: 1,
      waveform: pendingVoiceDraft.waveform || [],
    };

    upsertLocalPendingMessage(optimisticMessageId, buildLocalPendingMessage({
      attachments: [buildLocalPendingAttachment(normalizedVoiceAsset, `${optimisticMessageId}-attachment`)],
      clientMessageId,
      composition: voiceComposition,
      createdAt,
      message: String(composerText || '').trim(),
      replyTo: replyToPayload,
    }));

    try {
      uploadInFlightRef.current = true;
      setIsUploading(true);
      const uploadedFiles = await uploadAttachmentAsset(normalizedVoiceAsset);

      if (!uploadedFiles.length) {
        removeLocalPendingMessage(optimisticMessageId);
        throw new Error('VOICE_UPLOAD_FAILED');
      }
      logVoiceDiagnostic('send-upload-succeeded', {
        chatId,
        uploadedFiles: describeUploadItems(uploadedFiles),
      });

      const uploadedVoiceComposition = {
        ...voiceComposition,
        mime: pendingVoiceDraft.mime || uploadedFiles?.[0]?.mime || 'audio/mp4',
        size: pendingVoiceDraft.size || uploadedFiles?.[0]?.size || 0,
      };

      upsertLocalPendingMessage(optimisticMessageId, buildLocalPendingMessage({
        attachments: uploadedFiles,
        clientMessageId,
        composition: uploadedVoiceComposition,
        createdAt,
        message: String(composerText || '').trim(),
        replyTo: replyToPayload,
      }));

      const queuedMessageId = sendMessage(chatId, String(composerText || '').trim(), {
        attachments: uploadedFiles,
        clientMessageId,
        composition: uploadedVoiceComposition,
        optimisticMessageId,
        replyTo: replyToPayload,
        sender: userData,
        skipOptimistic: true,
      });
      if (!queuedMessageId) {
        removeLocalPendingMessage(optimisticMessageId);
        throw new Error('VOICE_SOCKET_UNAVAILABLE');
      }
      logVoiceDiagnostic('send-socket-queued', {
        chatId,
        optimisticMessageId: queuedMessageId,
      });

      await clearPendingVoiceDraft();
      setReplyingTo(null);
      setComposerText('');
      stopTyping(chatId);
    } catch (error) {
      if (String(error?.message || '') !== 'VOICE_SOCKET_UNAVAILABLE') {
        removeLocalPendingMessage(optimisticMessageId);
      }
      conversationLogger.warn('Failed to send pending voice draft', error);
      logVoiceDiagnostic('send-failed', {
        chatId,
        message: error?.message || error,
        responseStatus: Number(error?.response?.status || 0) || 0,
      });
      const detailedMessage = buildAttachmentUploadErrorMessage(error);
      showErrorBanner(
        detailedMessage || t('conversation.voice.sendErrorDescription', "Impossible d'envoyer la note vocale. Réessaie."),
        t('conversation.voice.sendErrorTitle', 'Envoi impossible'),
      );
    } finally {
      uploadInFlightRef.current = false;
      setIsUploading(false);
    }
  };

  const sendPendingMediaDraft = async () => {
    if (uploadInFlightRef.current) {
      logAttachmentDebug('sendPendingMediaDraft skipped: upload already in progress', {
        chatId,
      });
      return;
    }

    if (!pendingMediaDraft?.asset?.uri) {
      logAttachmentDebug('sendPendingMediaDraft skipped: no pending media draft');
      return;
    }
    if (!chatId) {
      logAttachmentDebug('sendPendingMediaDraft skipped: missing chatId', {
        asset: describeAsset(pendingMediaDraft.asset),
      });
      return;
    }
    if (!isSocketConnected || !socket) {
      logAttachmentDebug('sendPendingMediaDraft skipped: socket unavailable', {
        chatId,
        socketConnected: Boolean(isSocketConnected && socket),
      });
      showErrorBanner(
        'Connexion messagerie indisponible. Réessaie quand la conversation est reconnectée.',
        'Envoi impossible',
      );
      return;
    }

    logAttachmentDebug('sendPendingMediaDraft start', {
      asset: describeAsset(pendingMediaDraft.asset),
      captionLength: String(composerText || '').trim().length,
      chatId,
      hasReplyTo: Boolean(replyingTo?.documentId),
      socketConnected: Boolean(isSocketConnected),
    });

    const localUploadId = createLocalUploadId();
    const optimisticMessageId = `temp-upload-${localUploadId}`;
    const clientMessageId = `cmid-upload-${localUploadId}`;
    const createdAt = new Date().toISOString();
    const localAsset = pendingMediaDraft.asset;
    const localMime = String(localAsset?.type || '').trim();
    const localName = String(localAsset?.fileName || '').trim() || 'pièce-jointe';
    const isLocalImage = localMime.startsWith('image/');
    const normalizedCaption = String(composerText || '').trim();
    const previewText = normalizedCaption || (isLocalImage ? '' : `Pièce jointe : ${localName}`);
    const replyToPayload = replyingTo ? { documentId: replyingTo.documentId } : null;

    upsertLocalPendingMessage(optimisticMessageId, buildLocalPendingMessage({
      attachments: [buildLocalPendingAttachment(localAsset, `${optimisticMessageId}-attachment`)],
      clientMessageId,
      createdAt,
      message: previewText,
      replyTo: replyToPayload,
    }));

    const sent = await uploadAndSendAttachmentWithPlaceholder(localAsset, {
      caption: composerText,
      clientMessageId,
      createdAt,
      optimisticMessageId,
      replyTo: replyToPayload,
    });

    if (!sent) {
      logAttachmentDebug('sendPendingMediaDraft failed', {
        asset: describeAsset(pendingMediaDraft.asset),
        chatId,
      });
      return;
    }

    clearPendingMediaDraft();
    setReplyingTo(null);
    setComposerText('');
    stopTyping(chatId);
    logAttachmentDebug('sendPendingMediaDraft success', {
      chatId,
    });
  };

  const onSend = (msgs = /** @type {import('react-native-gifted-chat').IMessage[]} */ ([])) => {
    if (pendingMediaDraft?.asset?.uri) {
      sendPendingMediaDraft();
      return;
    }
    if (pendingVoiceDraft?.uri) {
      sendPendingVoiceDraft();
      return;
    }

    // MSG1/N1 — LE TEXTE NE S'EFFACE PLUS DANS LE VIDE.
    // Avant, le champ etait vide INCONDITIONNELLEMENT, sans jamais regarder si
    // le message etait parti. Quand le fil temps reel est coupe, `sendMessage`
    // abandonne en silence (`return null`, useMessaging.js:851-858) : le texte
    // disparaissait de l'ecran sans etre envoye nulle part, et rien ne le
    // disait. Une lenteur se rattrape, un message perdu non.
    // On reprend ici exactement le garde que font deja les TROIS autres
    // chemins d'envoi — piece jointe (:1694), piece jointe avec vignette
    // (:1803), note vocale (:4066) — y compris leur banniere, celle qui existe
    // deja dans cet ecran.
    let messagesRefuses = 0;
    msgs.forEach((msg) => {
      if (!chatId) {
        messagesRefuses += 1;
        return;
      }
      const queuedMessageId = sendMessage(chatId, msg.text, {
        replyTo: replyingTo ? { documentId: replyingTo.documentId } : null,
        sender: userData, // for optimistic
      });
      if (!queuedMessageId) {
        messagesRefuses += 1;
        return;
      }
      stopTyping(chatId);
    });

    if (messagesRefuses > 0) {
      // On ne vide RIEN : ni le champ, ni la citation. Le texte reste sous les
      // yeux de celui qui l'a ecrit, et il peut le renvoyer d'un appui.
      showErrorBanner('Connexion messagerie indisponible. Réessaie dans quelques secondes.');
      return;
    }

    setReplyingTo(null);
    setComposerText('');
  };

  const handleVoteOnPoll = async (
    /** @type {import('react-native-gifted-chat').IMessage & { documentId?: string; id?: string | number; _id?: string | number }} */ message,
    /** @type {string} */ optionId,
  ) => {
    const currentUserId = userData?.documentId || '';
    const messageId = message?.documentId || message?._id || message?.id;
    const composition = message?.composition;

    if (!chatId || !currentUserId || !messageId || !optionId || composition?.type !== 'poll') return;

    const { changed, nextComposition } = applyOptimisticPollVote({
      currentUserId,
      optionId,
      poll: composition,
    });

    if (!changed) return;

    queryClient.setQueriesData({ queryKey: ['chat-messages', chatId] }, (/** @type {any} */ oldData) => {
      if (!oldData?.pages) return oldData;

      return {
        ...oldData,
        pages: oldData.pages.map((/** @type {any} */ page) => ({
          ...page,
          data: Array.isArray(page?.data)
            ? page.data.map((/** @type {any} */ msg) => {
              const msgId = msg?.documentId || msg?.id || msg?._id;
              if (String(msgId) !== String(messageId)) return msg;
              return { ...msg, composition: nextComposition };
            })
            : [],
        })),
      };
    });

    try {
      await votePoll(String(messageId), optionId);
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
      showErrorBanner(
        t('conversation.poll.errors.voteSave', 'Impossible de sauvegarder ce vote.'),
        t('common.error', 'Erreur'),
      );
    }
  };

  const handleOpenPollDetails = (
    /** @type {import('react-native-gifted-chat').IMessage & { documentId?: string; id?: string | number; _id?: string | number }} */ message,
  ) => {
    const messageDocId = String(message?.documentId || message?._id || message?.id || '');
    if (!chatId || !messageDocId || message?.composition?.type !== 'poll') return;

    navigation.navigate(RouteNames.PollDetails, {
      chatId,
      messageId: messageDocId,
      poll: message.composition,
    });
  };

  /**
   * Handle avatar press event
   * @param {import('react-native-gifted-chat').User} user - The user object
   * @returns {void}
   */
  const handleAvatarPress = (user) => {
    if (user._id === userData?.documentId) {
      navigation.navigate(RouteNames.ProfileStack);
    } else {
      // UserDetails is inside ProfileStack
      navigation.navigate(RouteNames.ProfileStack, {
        params: { userId: user._id },
        screen: RouteNames.UserDetails,
      });
    }
  };

  const handleGoToUserDetails = () => {
    setIsMessageActionsVisible(false);
    setIsReportModalVisible(false);
    if (selectedMessage) {
      handleAvatarPress(selectedMessage.user);
    }
    setSelectedMessage(undefined);
  };

  const getMessageDocumentId = useCallback((message) => (
    String(message?.documentId || message?.id || message?._id || '').trim()
  ), []);

  const getMessageTextValue = useCallback((message) => (
    String(message?.text ?? message?.message ?? '')
  ), []);

  const isMessageOwnedByCurrentUser = useCallback((message) => (
    String(message?.user?._id || '') === String(userData?.documentId || '')
  ), [userData?.documentId]);

  const isMessageEditable = useCallback((message) => {
    const compositionType = String(message?.composition?.type || '').trim().toLowerCase();
    return !compositionType || !NON_EDITABLE_MESSAGE_COMPOSITION_TYPES.has(compositionType);
  }, []);

  const selectedMessageDocumentId = useMemo(() => (
    getMessageDocumentId(selectedMessage)
  ), [getMessageDocumentId, selectedMessage]);
  const selectedMessageTextValue = useMemo(() => (
    getMessageTextValue(selectedMessage)
  ), [getMessageTextValue, selectedMessage]);
  const isSelectedMessageOwn = useMemo(() => (
    isMessageOwnedByCurrentUser(selectedMessage)
  ), [isMessageOwnedByCurrentUser, selectedMessage]);
  const canCopySelectedMessage = useMemo(() => (
    selectedMessageTextValue.trim().length > 0
  ), [selectedMessageTextValue]);
  const canEditSelectedMessage = useMemo(() => (
    isSelectedMessageOwn && isMessageEditable(selectedMessage)
  ), [isMessageEditable, isSelectedMessageOwn, selectedMessage]);

  const messageIndexByDocumentId = useMemo(() => {
    /** @type {Map<string, number>} */
    const indexMap = new Map();
    (Array.isArray(messages) ? messages : []).forEach((message, index) => {
      const messageId = getMessageDocumentId(message);
      if (!messageId || indexMap.has(messageId)) return;
      indexMap.set(messageId, index);
    });
    return indexMap;
  }, [getMessageDocumentId, messages]);

  const closeMessageActionsModal = useCallback(() => {
    setIsMessageActionsVisible(false);
    setSelectedMessage(undefined);
  }, []);

  const handleMessageLongPress = useCallback((_, currentMessage) => {
    if (!currentMessage) return;
    setSelectedMessage(currentMessage);
    setIsMessageActionsVisible(true);
  }, []);

  const handleReplySelectedMessage = useCallback(() => {
    if (!selectedMessage) return;
    setReplyingTo(selectedMessage);
    setIsMessageActionsVisible(false);
  }, [selectedMessage]);

  const getReplyTargetDocumentId = useCallback((replyTo) => (
    String(
      replyTo?.documentId
      || replyTo?.id
      || replyTo?._id
      || '',
    ).trim()
  ), []);

  const scrollToMessageByDocumentId = useCallback((messageDocumentId) => {
    const targetId = String(messageDocumentId || '').trim();
    if (!targetId) return false;

    const targetIndex = messageIndexByDocumentId.get(targetId);
    if (!Number.isInteger(targetIndex)) return false;

    const listRef = messageContainerRef.current;
    if (!listRef || typeof listRef.scrollToIndex !== 'function') return false;

    try {
      listRef.scrollToIndex({
        animated: true,
        index: targetIndex,
        viewPosition: 0.4,
      });
      return true;
    } catch (_error) {
      if (typeof listRef.scrollToOffset === 'function') {
        listRef.scrollToOffset({
          animated: true,
          offset: Math.max(0, targetIndex * 96),
        });
        return true;
      }
    }

    return false;
  }, [messageIndexByDocumentId]);

  const handleOpenLeagueMatchDetails = useCallback(() => {
    if (!leagueConversationMatchId) return;
    navigation.navigate(RouteNames.LeagueMatchDetails, {
      focusSection: 'negotiation',
      matchId: leagueConversationMatchId,
    });
  }, [leagueConversationMatchId, navigation]);

  useEffect(() => {
    const focusToken = String(route?.params?.leagueNegotiationFocusToken || '').trim();
    const explicitMessageId = String(route?.params?.focusProposalMessageId || '').trim();
    const shouldFocusLatestProposal = Boolean(route?.params?.focusLatestProposal);
    const targetMessageId = explicitMessageId || (shouldFocusLatestProposal ? latestProposalMessageId : '');
    if (!targetMessageId) return undefined;

    const focusKey = `${focusToken || 'default'}:${targetMessageId}`;
    if (consumedNegotiationFocusKeyRef.current === focusKey) return undefined;

    const timeout = setSafeTimeout(() => {
      const didScroll = scrollToMessageByDocumentId(targetMessageId);
      if (didScroll) {
        consumedNegotiationFocusKeyRef.current = focusKey;
      }
    }, 180);

    return () => clearSafeTimer(timeout);
  }, [
    clearSafeTimer,
    latestProposalMessageId,
    route?.params?.focusLatestProposal,
    route?.params?.focusProposalMessageId,
    route?.params?.leagueNegotiationFocusToken,
    scrollToMessageByDocumentId,
    setSafeTimeout,
  ]);

  const handleReplyPreviewPress = useCallback((replyTo) => {
    const targetDocumentId = getReplyTargetDocumentId(replyTo);
    if (!targetDocumentId) return;
    scrollToMessageByDocumentId(targetDocumentId);
  }, [getReplyTargetDocumentId, scrollToMessageByDocumentId]);

  const handleSwipeToReply = useCallback((currentMessage) => {
    if (!currentMessage) return;
    setReplyingTo(currentMessage);
  }, []);

  const handleCopySelectedMessage = useCallback(() => {
    if (!canCopySelectedMessage) return;
    const clipboard = getClipboardModule();
    if (clipboard && typeof clipboard.setString === 'function') {
      clipboard.setString(selectedMessageTextValue);
      showSuccessBanner(
        t('conversation.actions.copySuccess.description', 'Le message a été copié.'),
        t('conversation.actions.copySuccess.title', 'Copié'),
      );
    } else {
      showErrorBanner(
        t('conversation.actions.copyUnavailable', 'Le presse-papiers est indisponible sur cette build.'),
        t('common.error', 'Erreur'),
      );
    }
    setIsMessageActionsVisible(false);
  }, [canCopySelectedMessage, selectedMessageTextValue, showErrorBanner, showSuccessBanner, t]);

  const handleOpenReportForSelectedMessage = useCallback(() => {
    if (!selectedMessageDocumentId || isSelectedMessageOwn) return;
    setIsMessageActionsVisible(false);
    setIsReportModalVisible(true);
  }, [isSelectedMessageOwn, selectedMessageDocumentId]);

  const resetEditMessageState = useCallback(() => {
    setEditMessageText('');
    setEditMessageAttachments([]);
    setIsEditMessageSubmitting(false);
    setIsEditMessageUploadingAttachment(false);
  }, []);

  const handleCloseEditMessageModal = useCallback(() => {
    setIsEditMessageModalVisible(false);
    setSelectedMessage(undefined);
    resetEditMessageState();
  }, [resetEditMessageState]);

  const handleOpenEditForSelectedMessage = useCallback(() => {
    if (!canEditSelectedMessage || !selectedMessage) return;
    setIsMessageActionsVisible(false);
    setEditMessageText(String(selectedMessage?.text ?? selectedMessage?.message ?? ''));
    setEditMessageAttachments(normalizeMessageAttachments(selectedMessage?.attachments));
    setIsEditMessageModalVisible(true);
  }, [canEditSelectedMessage, normalizeMessageAttachments, selectedMessage]);

  const handleRemoveEditAttachment = useCallback((attachmentToRemove) => {
    const targetKey = String(
      attachmentToRemove?.documentId
      || attachmentToRemove?.id
      || attachmentToRemove?.url
      || attachmentToRemove?.name
      || '',
    );
    if (!targetKey) return;

    setEditMessageAttachments((previousAttachments) => previousAttachments.filter((attachment) => {
      const attachmentKey = String(
        attachment?.documentId
        || attachment?.id
        || attachment?.url
        || attachment?.name
        || '',
      );
      return attachmentKey !== targetKey;
    }));
  }, []);

  const toEditAttachmentPayload = useCallback((/** @type {any[]} */ attachments) => (
    /** @type {{ id?: number; documentId?: string }[]} */ ((Array.isArray(attachments) ? attachments : [])
      .map((/** @type {any} */ attachment) => {
        const numericId = Number(attachment?.id);
        if (Number.isInteger(numericId) && numericId > 0) return { id: numericId };
        const attachmentDocumentId = String(attachment?.documentId || '').trim();
        if (attachmentDocumentId) return { documentId: attachmentDocumentId };
        return null;
      })
      .filter(Boolean))
  ), []);

  const handleDeleteSelectedMessage = useCallback(() => {
    if (!selectedMessageDocumentId || !isSelectedMessageOwn) return;

    openConversationPrompt({
      body: t('conversation.actions.deleteConfirm.description', 'Ce message sera supprimé pour tous les participants.'),
      primaryAction: {
        label: t('common.actions.delete', 'Supprimer'),
        onPress: async () => {
          closeConversationPrompt();
          try {
            await deleteMessage(selectedMessageDocumentId);
            setIsMessageActionsVisible(false);
            setIsEditMessageModalVisible(false);
            setSelectedMessage(undefined);
            resetEditMessageState();
          } catch (error) {
            showErrorBanner(
              t('conversation.actions.deleteError', 'Impossible de supprimer ce message.'),
              t('common.error', 'Erreur'),
            );
          }
        },
      },
      secondaryAction: {
        label: t('common.actions.cancel', 'Annuler'),
        onPress: closeConversationPrompt,
        variant: 'Secondary',
      },
      title: t('conversation.actions.deleteConfirm.title', 'Supprimer le message'),
      tone: 'critical',
    });
  }, [closeConversationPrompt, deleteMessage, isSelectedMessageOwn, openConversationPrompt, resetEditMessageState, selectedMessageDocumentId, showErrorBanner, t]);

  // 🚫 BLOQUER (K3) — la confirmation passe par `openConversationPrompt`,
  // exactement comme la suppression d un message juste au-dessus : c est la
  // mecanique de confirmation DEJA en place dans cet ecran.
  // Debloquer, lui, ne demande rien : le geste ne detruit rien.
  const handleToggleBlockFromMenu = useCallback(() => {
    if (!otherParticipantId) return;
    setIsMenuVisible(false);

    if (isOtherParticipantBlocked) {
      unblockOtherParticipant(otherParticipantId);
      return;
    }

    openConversationPrompt({
      // ⚠️ Pas de `common.user` ici : le filet AD10 refuse qu une meme clef
      // partagee soit appelee avec deux textes de repli differents. Dans un
      // tete-a-tete on est deja dans le fil de la personne : la phrase n a
      // besoin d aucun nom.
      body: t(
        'userBlock.confirm.messageNoName',
        'Cette personne ne pourra plus t’écrire ni ouvrir de discussion avec toi, et tu ne verras plus ses messages.',
      ),
      primaryAction: {
        label: t('userBlock.confirm.block', 'Bloquer'),
        onPress: () => {
          closeConversationPrompt();
          blockOtherParticipant(otherParticipantId);
        },
      },
      secondaryAction: {
        label: t('userBlock.confirm.cancel', 'Annuler'),
        onPress: closeConversationPrompt,
        variant: 'Secondary',
      },
      title: t('userBlock.confirm.title', 'Bloquer cette personne ?'),
      tone: 'critical',
    });
  }, [
    blockOtherParticipant,
    closeConversationPrompt,
    isOtherParticipantBlocked,
    openConversationPrompt,
    otherParticipantId,
    t,
    unblockOtherParticipant,
  ]);

  const handleSubmitReport = () => {
    if (selectedMessage?.documentId) {
      setIsMessageActionsVisible(false);
      reportMessage({
        message: selectedMessage.documentId,
      });
    }
  };

  /**
   * Render a custom time component
   * @param {import('react-native-gifted-chat').TimeProps<any>} props - Component props
   * @returns {React.ReactNode} Rendered time component
   */
  /**
   * Render a custom time component
   * @param {import('react-native-gifted-chat').TimeProps<any>} props - Component props
   * @returns {React.ReactNode} Rendered time component
   */
  const renderTime = (props) => {
    const { currentMessage, position } = props;
    if (position === 'left' && currentMessage.user.name) {
      return (
        <View style={{
          alignItems: 'center', flexDirection: 'row', marginBottom: 5, marginLeft: 10,
        }}
        >
          <Text style={{ ...Fonts.p3, color: Colors.neutral500 }}>
            ~
            {' '}
            {currentMessage.user.name}
          </Text>
          <Time
            {...props}
            containerStyle={{ left: { marginLeft: 0 } }}
            timeTextStyle={{
              left: { ...Fonts.p3, color: Colors.neutral500, marginLeft: 5 },
              right: { ...Fonts.p3, color: Colors.primary900 },
            }}
          />
        </View>
      );
    }
    return (
      <Time
        {...props}
        timeTextStyle={{
          left: [Fonts.p3, Fonts.neutral500],
          right: [Fonts.p3, Fonts.primary900],
        }}
      />
    );
  };

  const renderReplySwipeAction = useCallback(() => (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: MESSAGE_REPLY_SWIPE_ACTION_WIDTH,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: 'rgba(1, 179, 244, 0.18)',
          borderColor: Colors.primary500,
          borderRadius: 16,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 32,
          minWidth: 32,
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>↩</Text>
      </View>
    </View>
  ), [Colors.primary500, Fonts.p3Bold]);

  const wrapWithMessageInteractions = useCallback((currentMessage, children) => {
    if (!currentMessage) return children;

    const messageKey = getMessageDocumentId(currentMessage);
    const setSwipeableRef = (instance) => {
      if (!messageKey) return;
      if (instance) {
        swipeableMessageRefs.current.set(messageKey, instance);
      } else {
        swipeableMessageRefs.current.delete(messageKey);
      }
    };

    const handleSwipeableOpen = () => {
      handleSwipeToReply(currentMessage);
      if (messageKey) {
        const swipeableRef = swipeableMessageRefs.current.get(messageKey);
        if (typeof swipeableRef?.close === 'function') {
          swipeableRef.close();
        }
      }
    };

    return (
      <Swipeable
        friction={2}
        leftThreshold={MESSAGE_REPLY_SWIPE_THRESHOLD}
        onSwipeableOpen={handleSwipeableOpen}
        overshootLeft={false}
        overshootRight={false}
        ref={setSwipeableRef}
        renderLeftActions={renderReplySwipeAction}
        renderRightActions={renderReplySwipeAction}
        rightThreshold={MESSAGE_REPLY_SWIPE_THRESHOLD}
      >
        <TouchableOpacity
          activeOpacity={1}
          delayLongPress={250}
          onLongPress={() => handleMessageLongPress(null, currentMessage)}
        >
          {children}
        </TouchableOpacity>
      </Swipeable>
    );
  }, [getMessageDocumentId, handleMessageLongPress, handleSwipeToReply, renderReplySwipeAction]);

  /**
   * Render a custom bubble component
   * @param {import('react-native-gifted-chat').BubbleProps<any>} props - Component props
   * @returns {React.ReactNode} Rendered bubble component
   */
  const renderBubble = (props) => {
    const {
      currentMessage, nextMessage, position, previousMessage,
    } = props;

    // Check if messages are from the same user
    const isSameUserAsPrevious = previousMessage?.user?._id === currentMessage?.user?._id;
    const isSameUserAsNext = nextMessage?.user?._id === currentMessage?.user?._id;

    // Adjust margins for grouped messages
    const marginTop = isSameUserAsPrevious ? 2 : 8;
    const marginBottom = isSameUserAsNext ? 2 : 8;

    // Adjust border radius for grouped messages (rounded corners at edges, flat in middle)
    const isLeft = position === 'left';
    const topLeftRadius = isLeft && isSameUserAsPrevious ? 4 : 12;
    const bottomLeftRadius = isLeft && isSameUserAsNext ? 4 : 12;
    const topRightRadius = !isLeft && isSameUserAsPrevious ? 4 : 12;
    const bottomRightRadius = !isLeft && isSameUserAsNext ? 4 : 12;

    const resolvedMessageEvent = resolveMessageEventPayload(currentMessage);
    if (resolvedMessageEvent) {
      return wrapWithMessageInteractions(
        currentMessage, (
          <View style={{
            marginBottom,
            marginTop,
            // Removed margins as requested
          }}
          >
            <EventMessageBubble
              event={resolvedMessageEvent}
              isMe={!isLeft}
              onDecline={() => handleDeclineEvent(resolvedMessageEvent)}
              onJoin={() => handleJoinEvent(resolvedMessageEvent)}
              onParticipate={() => handleParticipateToEvent(resolvedMessageEvent)}
            />
          </View>
        ),
      );
    }

    // Composition message
    if (currentMessage.composition) {
      if (currentMessage.composition.type === 'poll') {
        return wrapWithMessageInteractions(
          currentMessage, (
            <View style={{ marginBottom, marginTop }}>
              <PollMessageBubble
                currentUserId={userData?.documentId || ''}
                isMe={!isLeft}
                onOpenDetails={() => handleOpenPollDetails(currentMessage)}
                onVote={(optionId) => handleVoteOnPoll(currentMessage, optionId)}
                poll={currentMessage.composition}
                resolveVoterName={resolveVoterName}
              />
            </View>
          ),
        );
      }

      // S03 — la proposition de match AMICAL. Même bulle que son jumeau LEAGUE
      // (on n'invente pas un troisième format), mais deux différences qui
      // comptent : les boutons appellent le workflow amical, et c'est le
      // SERVEUR qui a désigné dans la charge du message qui peut accepter.
      if (isFriendlyProposal(currentMessage.composition)) {
        const jePeuxAccepter = canAcceptFriendlyProposal(
          currentMessage.composition,
          userData?.documentId,
        );

        return wrapWithMessageInteractions(
          currentMessage, (
            <View style={{ marginBottom, marginTop }}>
              <ProposalMessageBubble
                allowResponseActions
                isMe={!jePeuxAccepter}
                onAccept={() => handleRespondFriendlyProposal(currentMessage, 'accept')}
                onDecline={() => handleRespondFriendlyProposal(currentMessage, 'decline')}
                proposal={currentMessage.composition}
              />
            </View>
          ),
        );
      }

      if (currentMessage.composition.type === 'proposal') {
        const isProposalFromMySide = isLeagueConversation
          ? isProposalMessageFromMySquad(currentMessage)
          : !isLeft;

        return wrapWithMessageInteractions(
          currentMessage, (
            <View style={{ marginBottom, marginTop }}>
              <ProposalMessageBubble
                allowResponseActions
                isHighlighted={latestProposalMessageId === String(currentMessage.documentId || currentMessage._id || '')}
                isMe={isProposalFromMySide}
                onAccept={() => handleRespondProposal(currentMessage, 'accepted')}
                onCounter={() => handleOpenCounterProposal(currentMessage, {
                  isMine: isProposalFromMySide,
                  shouldDecline: !isProposalFromMySide,
                })}
                onDecline={() => handleRespondProposal(currentMessage, 'declined')}
                onViewMatch={handleOpenLeagueMatchDetails}
                proposal={currentMessage.composition}
                viewMatchLabel="Voir la fiche match"
              />
            </View>
          ),
        );
      }

      if (currentMessage.composition.type === 'location_share') {
        return wrapWithMessageInteractions(
          currentMessage, (
            <View style={{ marginBottom, marginTop }}>
              <LocationShareBubble
                composition={currentMessage.composition}
                isMe={!isLeft}
              />
            </View>
          ),
        );
      }

      if (currentMessage.composition.type === 'contact_share') {
        return wrapWithMessageInteractions(
          currentMessage, (
            <View style={{ marginBottom, marginTop }}>
              <ContactShareBubble
                composition={currentMessage.composition}
                isMe={!isLeft}
                onPressContact={openSharedContact}
              />
            </View>
          ),
        );
      }

      if (currentMessage.composition.type === 'event_share') {
        return wrapWithMessageInteractions(
          currentMessage, (
            <View style={{ marginBottom, marginTop }}>
              <EventShareBubble
                composition={currentMessage.composition}
                isMe={!isLeft}
                onPressEvent={openSharedEvent}
              />
            </View>
          ),
        );
      }

      if (currentMessage.composition.type === 'voice_note') {
        return wrapWithMessageInteractions(
          currentMessage, (
            <View
              style={{
                alignItems: isLeft ? 'flex-start' : 'flex-end',
                marginBottom,
                marginTop,
                width: '100%',
              }}
            >
              <VoiceNoteBubble
                attachments={currentMessage.attachments || []}
                composition={currentMessage.composition}
                isMe={!isLeft}
                message={currentMessage.message}
              />
              {currentMessage.failed ? (
                <Text style={[Fonts.p4Bold, { color: Colors.error500, marginTop: 4, textAlign: isLeft ? 'left' : 'right' }]}>
                  {t('common.retry', 'Réessayer')}
                </Text>
              ) : null}
              {currentMessage.pending ? (
                <Text style={[Fonts.p4, { color: Colors.neutral300, marginTop: 4, textAlign: isLeft ? 'left' : 'right' }]}>
                  {t('conversation.sending', 'Envoi en cours...')}
                </Text>
              ) : null}
            </View>
          ),
        );
      }

      return wrapWithMessageInteractions(
        currentMessage, (
          <View style={{
            marginBottom,
            marginTop,
          }}
          >
            <CompositionMessageBubble
              composition={currentMessage.composition}
              isMe={!isLeft}
            />
          </View>
        ),
      );
    }

    const isPending = Boolean(currentMessage.pending);
    const isFailed = Boolean(currentMessage.failed);
    const replyAuthorName = String(
      currentMessage?.replyTo?.sender?.firstname
      || currentMessage?.replyTo?.sender?.name
      || currentMessage?.replyTo?.user?.name
      || t('conversation.replyPreview.defaultAuthor', 'Membre'),
    ).trim();
    const replyPreviewText = String(
      currentMessage?.replyTo?.message
      || currentMessage?.replyTo?.text
      || t('conversation.replyPreview.defaultText', 'Message'),
    );
    const replyPreviewNode = currentMessage.replyTo ? (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleReplyPreviewPress(currentMessage.replyTo)}
        style={{
          backgroundColor: 'rgba(1,179,244,0.12)',
          borderColor: Colors.primary700,
          borderRadius: 8,
          borderWidth: 1,
          marginBottom: 4,
          marginHorizontal: 12,
          marginTop: marginTop + 4,
          padding: 8,
        }}
      >
        <Text style={[Fonts.p3Bold, Fonts.primary500]}>
          {t('conversation.replyPreview.label', 'Réponse à')}
          {' '}
          {replyAuthorName}
        </Text>
        <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral500]}>
          {replyPreviewText}
        </Text>
      </TouchableOpacity>
    ) : null;
    const normalizedCurrentAttachments = normalizeMessageAttachments(currentMessage?.attachments);
    const hasDocumentAttachment = normalizedCurrentAttachments.some((attachment) => (
      isDocumentAttachment(attachment)
    ));

    if (hasDocumentAttachment) {
      const actionableMessage = {
        ...currentMessage,
        attachments: normalizedCurrentAttachments,
      };
      const documentCaption = getDocumentCaption(
        currentMessage?.message || currentMessage?.text || '',
        normalizedCurrentAttachments,
      );

      return wrapWithMessageInteractions(
        currentMessage,
        (
          <View style={{ opacity: isPending ? 0.5 : 1, width: '100%' }}>
            {replyPreviewNode}
            <View
              style={{
                alignItems: isLeft ? 'flex-start' : 'flex-end',
                marginBottom,
                marginTop: currentMessage.replyTo ? 2 : marginTop,
                width: '100%',
              }}
            >
              <DocumentMessageBubble
                attachments={normalizedCurrentAttachments}
                caption={documentCaption}
                failed={isFailed}
                isMe={!isLeft}
                onDownload={() => downloadDocumentAttachmentFromMessage(actionableMessage)}
                onOpen={() => openDocumentActionMenu(actionableMessage)}
                onRetry={() => retryFailedMessage(chatId, actionableMessage)}
                onShare={() => shareDocumentAttachmentFromMessage(actionableMessage)}
                pending={isPending}
              />
            </View>
          </View>
        ),
      );
    }

    return wrapWithMessageInteractions(
      currentMessage,
      (
        <View style={{ opacity: isPending ? 0.5 : 1 }}>
          {currentMessage.replyTo ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleReplyPreviewPress(currentMessage.replyTo)}
              style={{
                backgroundColor: 'rgba(1,179,244,0.12)',
                borderColor: Colors.primary700,
                borderRadius: 8,
                borderWidth: 1,
                marginBottom: 4,
                marginHorizontal: 12,
                marginTop: marginTop + 4,
                padding: 8,
              }}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                {t('conversation.replyPreview.label', 'Réponse à')}
                {' '}
                {replyAuthorName}
              </Text>
              <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral500]}>
                {replyPreviewText}
              </Text>
            </TouchableOpacity>
          ) : null}
          <Bubble
            {...props}
            onPress={() => {
              if (Array.isArray(currentMessage?.attachments) && currentMessage.attachments.length > 0) {
                openFirstAttachment(currentMessage);
              }
            }}
            renderMessageImage={renderMessageImage}
            renderTicks={(/** @type {any} */ bubbleMessage) => {
              if (bubbleMessage.failed) {
                return <Text style={{ color: Colors.error500, fontSize: 10, marginRight: 4 }}>!</Text>;
              }
              if (bubbleMessage.pending) return <Text style={{ fontSize: 10, marginRight: 4 }}>...</Text>;
              // Checkmark logic using icons or text
              // GiftedChat appelle un renderTicks personnalise AVANT son propre
              // garde gauche/droite : ce rendu s'applique donc AUSSI aux bulles
              // recues (fond sombre #0F1821). L'encre suit le fond : primary900
              // sur la bulle envoyee primary500 (7,96:1, cf. THEME.md),
              // neutral00 sur la bulle recue sombre (17,90:1).
              const tickColor = isLeft ? Colors.neutral00 : Colors.primary900;
              if (bubbleMessage.readBy && bubbleMessage.readBy.length > 0) {
                return <Text style={{ color: tickColor, fontSize: 10, fontWeight: 'bold' }}>vv</Text>;
              }
              return <Text style={{ color: tickColor, fontSize: 10 }}>v</Text>;
            }}
            renderTime={renderTime}
            textStyle={{
              left: [Fonts.p1, { color: Colors.neutral00 }], // White text for dark bubble
              // Bulle envoyee = fond primary500 : encre primary900 (cf. THEME.md).
              right: [Fonts.p1, Fonts.primary900],
            }}
            wrapperStyle={{
              left: {
                backgroundColor: '#0F1821', // Dark background for received messages to match screenshot
                borderBottomLeftRadius: bottomLeftRadius,
                borderBottomRightRadius: 18,
                borderTopLeftRadius: topLeftRadius,
                borderTopRightRadius: 18,
                marginBottom,
                marginTop: currentMessage.replyTo ? 2 : marginTop,
                padding: 4,
              },
              right: {
                backgroundColor: Colors.primary500,
                borderBottomLeftRadius: 18,
                borderBottomRightRadius: bottomRightRadius,
                borderTopLeftRadius: 18,
                borderTopRightRadius: topRightRadius,
                marginBottom,
                marginTop: currentMessage.replyTo ? 2 : marginTop,
                padding: 4,
              },
            }}
          />
          {isChatRetryEnabled && isFailed && !isLeft ? (
            <View style={{ alignItems: 'flex-end', marginRight: 10, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => retryFailedMessage(chatId, currentMessage)}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.25)',
                  borderColor: Colors.error500,
                  borderRadius: 12,
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.error500 }]}>
                  {t('common.retry', 'Réessayer')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ),
    );
  };

  // ... rest of the file ...

  // Inside GiftedChat prop list (replacing renderUsernameOnMessage)

  /**
   * Render a custom composer component
   * @param {import('react-native-gifted-chat').ComposerProps} props - Component props
   * @returns {React.ReactNode} Rendered composer component
   */
  const renderComposer = (props) => {
    let composerPlaceholder = t('conversation.messagePlaceholder');
    if (pendingMediaDraft?.asset?.uri) {
      composerPlaceholder = t('conversation.attachments.captionPlaceholder', 'Ajouter une légende');
    } else if (pendingVoiceDraft?.uri) {
      composerPlaceholder = t('conversation.voice.captionPlaceholder', 'Ajouter un message (optionnel)');
    }

    return (
      <Composer
        {...props}
        placeholder={composerPlaceholder}
        textInputProps={{
          editable: !isPollModalVisible,
          maxLength: 1000,
          multiline: true,
          showSoftInputOnFocus: !isPollModalVisible,
        }}
        textInputStyle={[
          Fonts.p2,
          Spaces.paddingHorizontal[16],
          Spaces.paddingVertical[8],
          {
            backgroundColor: 'rgba(12, 28, 37, 0.94)',
            borderColor: Colors.primary700,
            borderRadius: 22,
            borderWidth: 1,
            color: Colors.neutral00,
            marginBottom: 0,
            marginTop: 0,
            minHeight: 44,
            paddingRight: 46,
          },
        ]}
      />
    );
  };

  /**
   * Render a custom input toolbar component
   * @param {import('react-native-gifted-chat').InputToolbarProps<any>} props - Component props
   * @returns {React.ReactNode} Rendered input toolbar component
   */
  /* Permission Check */
  /* Permission Check */
  const canWrite = useMemo(() => {
    if (!chatData || !userData) return false;
    const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
    const isManagerRole = roleKey === 'president';

    // Whisper, Team, League Match and Friendly Match chats: all participants write.
    // D92 — `friendly_match` manquait ici alors que son jumeau `league_match` y
    // etait : le fil ouvert par une proposition tombait donc dans le `return
    // false` du bas et s affichait « Canal d annonce (lecture seule) ». Ce
    // n etait pas un choix — le serveur, lui, l autorise (chat-message.ts,
    // `ensureUserCanWriteInChat` ne restreint que `club` et `multisport`).
    if (
      chatData.type === 'whisper'
      || chatData.type === 'team'
      || isLeagueConversation
      || isFriendlyMatchChat(chatData)
    ) return true;

    // Club Chat: Only section managers and parent multisport managers can write
    if (chatData.type === 'club') {
      const chatClubId = String(chatData?.club?.documentId || chatData?.club?.id || '').trim();
      return Boolean(chatClubId) && isManagerRole && hasClubAccess(chatClubId);
    }

    // Multisport Chat: Only Multisport Admins can write
    if (chatData.type === 'multisport') {
      const chatMultisportId = String(
        chatData?.multisportClub?.documentId || chatData?.multisportClub?.id || '',
      ).trim();
      const managedMultisportIds = getManagedMultisportIds(userData);
      const admins = chatData.multisportClub?.admins || [];
      const isChatDeclaredAdmin = admins.some((admin) => admin.documentId === userData.documentId);
      const isManagedMultisportChat = Boolean(
        chatMultisportId && managedMultisportIds.has(chatMultisportId),
      );
      return isManagerRole && (isChatDeclaredAdmin || isManagedMultisportChat);
    }

    return false;
  }, [chatData, hasClubAccess, isLeagueConversation, userData]);

  /**
   * Render custom actions (attachment buttons)
   * @returns {React.ReactNode} Rendered actions component
   */
  const renderActions = () => (
    <View style={{ alignItems: 'center', flexDirection: 'row', height: 44 }}>
      {isLeagueConversation ? (
        <TouchableOpacity
          accessibilityLabel={canCreateLeagueProposalFromChat ? 'Envoyer une proposition League' : 'Ouvrir le match League'}
          onPress={() => {
            if (canCreateLeagueProposalFromChat) {
              setIsProposalModalVisible(true);
              return;
            }
            handleOpenLeagueMatchDetails();
          }}
          style={{
            alignItems: 'center',
            backgroundColor: Colors.gold500,
            borderColor: 'rgba(255,255,255,0.24)',
            borderRadius: 16,
            borderWidth: 1,
            height: 32,
            justifyContent: 'center',
            marginHorizontal: 4,
            overflow: 'hidden',
            width: 32,
          }}
        >
          <Image
            resizeMode="contain"
            source={Images.logo}
            style={{
              height: 20,
              width: 20,
            }}
          />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        onPress={handleOpenAttachmentMenu}
        style={{
          alignItems: 'center',
          backgroundColor: Colors.primary500,
          borderRadius: 16,
          height: 32,
          justifyContent: 'center',
          marginHorizontal: 4,
          width: 32,
        }}
      >
        {/* Croix sur fond primary500 : encre primary900 (cf. THEME.md). */}
        <View style={{
          backgroundColor: Colors.primary900, height: 2, position: 'absolute', width: 16,
        }}
        />
        <View style={{
          backgroundColor: Colors.primary900, height: 16, position: 'absolute', width: 2,
        }}
        />
      </TouchableOpacity>
    </View>
  );

  const formatDurationLabel = (durationMs) => {
    const totalSeconds = Math.max(0, Math.floor((Number(durationMs) || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const renderAccessory = () => {
    const hasMediaDraft = Boolean(pendingMediaDraft?.asset?.uri);
    const hasReplyPreview = !!replyingTo;
    const hasVoiceSession = hasActiveVoiceSession;
    const hasVoiceDraft = Boolean(pendingVoiceDraft?.uri);
    if (!hasMediaDraft && !hasReplyPreview && !hasVoiceSession && !hasVoiceDraft) return null;
    const fallbackWaveform = Array.from(
      { length: 14 },
      (_, index) => toVoiceWaveBarHeight(null, voiceRecordingDurationMs, index),
    );
    const liveWaveformBars = voiceRecordingWaveform.length > 0
      ? voiceRecordingWaveform
      : fallbackWaveform;
    const visibleWaveformBars = liveWaveformBars.slice(-VOICE_WAVEFORM_VISIBLE_BARS);
    const draftTotalMs = Math.max(
      Number(pendingVoiceDraft?.durationMs) || 0,
      Number(draftPlaybackDurationMs) || 0,
    );
    const rawDraftWaveform = Array.isArray(pendingVoiceDraft?.waveform)
      ? pendingVoiceDraft.waveform
      : [];
    const draftWaveformBars = (rawDraftWaveform.length > 0
      ? rawDraftWaveform
        .slice(-VOICE_WAVEFORM_VISIBLE_BARS)
        .map((bar, index) => toVoiceWaveBarHeight(bar, draftTotalMs, index))
      : Array.from(
        { length: 14 },
        (_, index) => toVoiceWaveBarHeight(null, draftTotalMs, index),
      ));
    const draftActiveBarsCount = Math.max(
      0,
      Math.min(
        draftWaveformBars.length,
        Math.round((Number(draftPlaybackProgress) || 0) * draftWaveformBars.length),
      ),
    );
    const draftCurrentMs = Math.min(
      Number(draftPlaybackPositionMs) || 0,
      draftTotalMs || Number(draftPlaybackPositionMs) || 0,
    );

    return (
      <View style={Spaces.gap[8]}>
        {hasMediaDraft ? (
          <View style={[
            ApplicationStyle.backgroundColor.neutral100,
            Spaces.padding[8],
            Alignments.row,
            Alignments.alignCenter,
            { borderRadius: 14, gap: 10 },
          ]}
          >
            <Image
              source={{ uri: pendingMediaDraft?.asset?.uri || '' }}
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: 10,
                height: 56,
                width: 56,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p3Bold, { color: Colors.primary700 }]}>
                {t('conversation.attachments.previewTitle', 'Photo prête à envoyer')}
              </Text>
              <Text
                numberOfLines={2}
                style={[Fonts.p4, { color: Colors.neutral700 }]}
              >
                {composerText?.trim()
                  ? t('conversation.attachments.previewWithCaption', 'La légende sera envoyée avec la photo.')
                  : t('conversation.attachments.previewWithoutCaption', "Ajoute une légende puis confirme l'envoi.")}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                onPress={clearPendingMediaDraft}
                size="sm"
                title={t('common.cancel', 'Annuler')}
                variant="SecondaryLight"
              />
              <Button
                isLoading={isUploading}
                onPress={sendPendingMediaDraft}
                size="sm"
                title={t('common.send', 'Envoyer')}
                variant="PrimaryLight"
              />
            </View>
          </View>
        ) : null}

        {hasVoiceSession ? (
          <View style={[
            ApplicationStyle.backgroundColor.neutral100,
            Spaces.padding[8],
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            { borderRadius: 14 },
          ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p3Bold, { color: Colors.primary700 }]}>
                {isVoiceRecordingLocked
                  ? t('conversation.voice.locked', 'Note vocale verrouillée')
                  : t('conversation.voice.recording', 'Enregistrement vocal')}
              </Text>
              <Text
                numberOfLines={2}
                style={[Fonts.p4, { color: Colors.neutral700 }]}
              >
                {isSendingVoiceNote
                  ? t('conversation.voice.sending', 'Envoi en cours...')
                  : `${formatDurationLabel(voiceRecordingDurationMs)} - ${voiceRecordingHint || t('conversation.voice.hintShort', 'Maintiens appuyé pour enregistrer')}`}
              </Text>
              <View
                style={{
                  alignItems: 'flex-end',
                  flexDirection: 'row',
                  height: 22,
                  marginTop: 8,
                  maxWidth: 190,
                  overflow: 'hidden',
                }}
              >
                {visibleWaveformBars.map((barHeight, index) => (
                  <View
                    // eslint-disable-next-line react/no-array-index-key
                    key={`voice-wave-${index}`}
                    style={{
                      backgroundColor: isSendingVoiceNote ? Colors.neutral300 : Colors.primary500,
                      borderRadius: 2,
                      height: barHeight,
                      marginRight: index === visibleWaveformBars.length - 1 ? 0 : 2,
                      opacity: isSendingVoiceNote
                        ? (0.45 + (((index + 1) / Math.max(visibleWaveformBars.length, 1)) * 0.35))
                        : (0.35 + (((index + 1) / Math.max(visibleWaveformBars.length, 1)) * 0.65)),
                      width: 3,
                    }}
                  />
                ))}
              </View>
            </View>
            {isVoiceRecordingLocked ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  onPress={handleCancelVoiceRecording}
                  size="sm"
                  title={t('common.cancel', 'Annuler')}
                  variant="SecondaryLight"
                />
                <Button
                  isLoading={isSendingVoiceNote}
                  onPress={handleStopVoiceRecordingToDraft}
                  size="sm"
                  title={t('common.send', 'Envoyer')}
                  variant="PrimaryLight"
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {hasVoiceDraft ? (
          <View style={[
            ApplicationStyle.backgroundColor.neutral100,
            Spaces.padding[8],
            {
              backgroundColor: 'rgba(10, 29, 40, 0.95)',
              borderColor: Colors.primary700,
              borderRadius: 14,
              borderWidth: 1,
            },
          ]}
          >
            <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
              <TouchableOpacity
                onPress={toggleDraftVoicePlayback}
                style={{
                  alignItems: 'center',
                  backgroundColor: isDraftVoicePlaying ? Colors.primary500 : 'rgba(0, 173, 239, 0.16)',
                  borderColor: Colors.primary500,
                  borderRadius: 11,
                  borderWidth: 1,
                  height: 22,
                  justifyContent: 'center',
                  width: 22,
                }}
              >
                <Text style={[Fonts.p4Bold, {
                  color: isDraftVoicePlaying ? Colors.primary900 : Colors.primary500,
                }]}
                >
                  {isDraftVoicePlaying ? '||' : '>'}
                </Text>
              </TouchableOpacity>
              <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                {t('conversation.voice.draftReady', 'Brouillon vocal')}
              </Text>
              <Text style={[Fonts.p4, { color: Colors.neutral300, marginLeft: 'auto' }]}>
                {formatDurationLabel(draftCurrentMs)}
                {' / '}
                {formatDurationLabel(draftTotalMs)}
              </Text>
            </View>

            <View
              style={{
                alignItems: 'flex-end',
                flexDirection: 'row',
                height: 24,
                marginTop: 8,
                overflow: 'hidden',
                width: '100%',
              }}
            >
              {draftWaveformBars
                .map((barHeight, index, array) => (
                  <View
                    // eslint-disable-next-line react/no-array-index-key
                    key={`voice-draft-wave-${index}`}
                    style={{
                      backgroundColor: index < draftActiveBarsCount
                        ? Colors.primary500
                        : 'rgba(255,255,255,0.24)',
                      borderRadius: 2,
                      height: clampNumber(Number(barHeight) || 4, 4, 20),
                      marginRight: index === array.length - 1 ? 0 : 2,
                      opacity: index < draftActiveBarsCount
                        ? 0.85
                        : (0.35 + (((index + 1) / Math.max(array.length, 1)) * 0.35)),
                      width: 3,
                    }}
                  />
                ))}
            </View>

            <Text style={[Fonts.p4, { color: Colors.neutral300, marginTop: 6 }]}>
              {composerText?.trim()
                ? t('conversation.voice.draftWithText', 'Le texte sera envoyé avec la note vocale.')
                : t('conversation.voice.draftWithoutText', 'Ajoute un message optionnel puis appuie sur Envoyer.')}
            </Text>
            {draftPlaybackError ? (
              <Text style={[Fonts.p4, { color: Colors.error500, marginTop: 4 }]}>
                {draftPlaybackError}
              </Text>
            ) : null}

            <View style={[Alignments.row, Alignments.justifyEnd, Spaces.marginTop[8], { gap: 8 }]}>
              <Button
                onPress={clearPendingVoiceDraft}
                size="sm"
                title={t('common.cancel', 'Annuler')}
                variant="SecondaryLight"
              />
              <Button
                isLoading={isUploading}
                onPress={sendPendingVoiceDraft}
                size="sm"
                title={t('common.send', 'Envoyer')}
                variant="PrimaryLight"
              />
            </View>
          </View>
        ) : null}

        {hasReplyPreview ? (
          <View style={[
            ApplicationStyle.backgroundColor.neutral100,
            Spaces.padding[8],
            Alignments.row,
            Alignments.justifySpaceBetween,
            Alignments.alignCenter,
          ]}
          >
            <View>
              <Text style={[Fonts.p3Bold, Fonts.primary700]}>
                Répondre a
                {' '}
                {replyingTo.user?.name}
              </Text>
              <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral700]}>{replyingTo.text}</Text>
            </View>
            <Button
              onPress={() => setReplyingTo(null)}
              title="X"
              variant="SecondaryLight"
            />
          </View>
        ) : null}
      </View>
    );
  };

  const renderFooter = () => {
    if (typingUsers.size > 0) {
      const typingNames = Array.from(typingUsers)
        .map((typingUserId) => resolveVoterName(String(typingUserId)))
        .filter(Boolean);
      const typingLabel = typingNames.length > 0
        ? `${typingNames.slice(0, 2).join(', ')} ${typingNames.length > 1 ? 'écrivent' : 'écrit'}...`
        : "Quelqu'un écrit...";
      return (
        <View style={[Spaces.padding[8], Spaces.marginLeft[16]]}>
          <Text style={[Fonts.p3, Fonts.neutral500]}>{typingLabel}</Text>
        </View>
      );
    }
    return null;
  };

  /**
   * Render the empty conversation placeholder.
   * La liste est inversee (`inverted`), donc gifted-chat rend ce contenu tel quel
   * dans une FlatList retournee : on retourne le bloc a notre tour.
   * @returns {React.ReactElement} Rendered empty state
   */
  const renderChatEmpty = () => (
    <View style={[
      Alignments.fill,
      Alignments.justifyCenter,
      Alignments.alignCenter,
      Spaces.padding[24],
      { transform: [{ scaleY: -1 }] },
    ]}
    >
      <Text style={[Fonts.h4Bold, { color: Colors.neutral00, textAlign: 'center' }]}>
        Aucun message pour le moment
      </Text>
      <Text style={[
        Fonts.p2,
        Spaces.marginTop[8],
        { color: Colors.neutral300, textAlign: 'center' },
      ]}
      >
        Envoie le premier message pour lancer la conversation.
      </Text>
    </View>
  );

  /**
   * Render a custom input toolbar component
   * @param {import('react-native-gifted-chat').InputToolbarProps<any>} props - Component props
   * @returns {React.ReactNode} Rendered input toolbar component
   */
  const renderInputToolbar = (props) => {
    if (!canWrite) {
      return (
        <View style={[
          ApplicationStyle.borderRadius32,
          ApplicationStyle.backgroundColor.neutral100,
          Spaces.padding[16],
          Alignments.alignCenter,
          Alignments.justifyCenter,
          { marginBottom: composerBottomInset },
        ]}
        >
          <Text style={[Fonts.p2, Fonts.neutral500]}>
            {t('conversation.readOnly', 'Canal d\'annonce (lecture seule)')}
          </Text>
        </View>
      );
    }

    const accessory = renderAccessory();
    const shouldRenderAccessoryAfterToolbar = Platform.OS === 'ios';
    const accessoryBlock = accessory ? (
      <View style={shouldRenderAccessoryAfterToolbar ? Spaces.marginTop[8] : Spaces.marginBottom[8]}>
        {accessory}
      </View>
    ) : null;

    return (
      <View style={[
        ApplicationStyle.backgroundColor.primary900,
        ApplicationStyle.noBorderTop,
        Spaces.paddingHorizontal[8],
        { paddingBottom: composerBottomInset },
        Spaces.paddingVertical[8],
      ]}
      >
        {!shouldRenderAccessoryAfterToolbar ? accessoryBlock : null}
        <InputToolbar
          {...props}
          containerStyle={[
            ApplicationStyle.backgroundColor.primary900,
            ApplicationStyle.noBorderTop,
            { paddingHorizontal: 0, paddingVertical: 0 },
          ]}
          primaryStyle={{ alignItems: 'center' }}
          renderActions={renderActions}
          renderComposer={renderComposer}
        />
        {shouldRenderAccessoryAfterToolbar ? accessoryBlock : null}
      </View>
    );
  };

  /**
   * Render a custom send button component
   * @param {import('react-native-gifted-chat').SendProps<any>} props - Component props
   * @returns {React.ReactNode} Rendered send button component
   */
  /**
   * Render a custom send button component
   * @param {import('react-native-gifted-chat').SendProps<any>} props - Component props
   * @returns {React.ReactNode} Rendered send button component
   */
  const renderSend = (props) => {
    const hasPendingMediaDraft = Boolean(pendingMediaDraft?.asset?.uri);
    const hasPendingVoiceDraft = Boolean(pendingVoiceDraft);
    const hasText = String(props.text || '').trim().length > 0;
    const shouldShowVoiceButton = !hasText
      && !hasPendingMediaDraft
      && !hasPendingVoiceDraft
      && isVoiceNotesEnabled;
    let voiceButtonBackgroundColor = Colors.neutral700;
    let voiceButtonBorderColor = Colors.neutral600;
    // Encre du micro : foncee sur fond primary500 (cf. THEME.md), claire sinon.
    let voiceButtonInkColor = Colors.neutral00;
    let voiceButtonOpacity = canRecordVoiceNote ? 1 : 0.6;
    if (canRecordVoiceNote) {
      voiceButtonBackgroundColor = Colors.primary500;
      voiceButtonBorderColor = Colors.primary200;
      voiceButtonInkColor = Colors.primary900;
    }
    if (isVoiceRecording) {
      voiceButtonBackgroundColor = Colors.error500;
      voiceButtonBorderColor = Colors.error700;
      voiceButtonInkColor = Colors.neutral00;
    }
    if (isSendingVoiceNote) {
      voiceButtonOpacity = 0.7;
    }
    if (!hasText && !hasPendingMediaDraft && !hasPendingVoiceDraft && !isVoiceNotesEnabled) return null;

    if (shouldShowVoiceButton) {
      return (
        <View
          {...microphonePanResponder.panHandlers}
          style={{
            alignItems: 'center',
            height: 44,
            justifyContent: 'center',
            marginLeft: -44,
            marginRight: 4,
            width: 44,
          }}
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: voiceButtonBackgroundColor,
              borderColor: voiceButtonBorderColor,
              borderRadius: 17,
              borderWidth: 1,
              height: 34,
              justifyContent: 'center',
              opacity: voiceButtonOpacity,
              width: 34,
            }}
          >
            {isSendingVoiceNote ? (
              <ActivityIndicator color={voiceButtonInkColor} size="small" />
            ) : (
              <MicrophoneGlyph color={voiceButtonInkColor} />
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={{
        alignItems: 'center',
        height: 44,
        justifyContent: 'center',
        marginLeft: -44,
        marginRight: 4,
        width: 44,
      }}
      >
        <TouchableOpacity
          disabled={isUploading}
          onPress={() => {
            if (hasPendingMediaDraft) {
              sendPendingMediaDraft();
              return;
            }
            if (hasPendingVoiceDraft) {
              sendPendingVoiceDraft();
              return;
            }
            if (props.onSend) {
              props.onSend({ text: props.text }, true);
            }
          }}
          style={{
            alignItems: 'center',
            backgroundColor: Colors.primary500,
            borderColor: Colors.primary200,
            borderRadius: 17,
            borderWidth: 1,
            height: 34,
            justifyContent: 'center',
            opacity: isUploading ? 0.7 : 1,
            width: 34,
          }}
        >
          {/* Bouton Envoyer sur fond primary500 : encre primary900 (cf. THEME.md). */}
          {isUploading ? (
            <ActivityIndicator color={Colors.primary900} size="small" />
          ) : (
            <Image
              source={Images.send}
              style={{
                height: 16,
                tintColor: Colors.primary900,
                width: 16,
              }}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const handleScrollToIndexFailed = useCallback((info) => {
    if (!info) return;

    const listRef = messageContainerRef.current;
    if (!listRef || typeof listRef.scrollToOffset !== 'function') return;

    const estimatedOffset = Math.max(0, (info.averageItemLength || 88) * info.index);
    listRef.scrollToOffset({ animated: true, offset: estimatedOffset });

    setSafeTimeout(() => {
      if (typeof listRef.scrollToIndex !== 'function') return;
      listRef.scrollToIndex({
        animated: true,
        index: info.index,
        viewPosition: 0.4,
      });
    }, 120);
  }, [setSafeTimeout]);

  const renderLeagueNegotiationBanner = () => {
    if (!isLeagueConversation || !leagueConversationMatch) return null;
    return (
      <View
        style={[
          ApplicationStyle.borderRadius24,
          Spaces.marginHorizontal[16],
          Spaces.marginBottom[12],
          Spaces.padding[16],
          Spaces.gap[12],
          {
            backgroundColor: 'rgba(10, 28, 43, 0.92)',
            borderColor: 'rgba(1,179,244,0.28)',
            borderWidth: 1,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.justifyBetween, Alignments.alignCenter, { columnGap: 12 }]}>
          <View
            style={{
              backgroundColor: 'rgba(1,179,244,0.14)',
              borderColor: 'rgba(1,179,244,0.36)',
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
              {leagueNegotiationSummary.statusLabel}
            </Text>
          </View>
        </View>

        <View style={Spaces.gap[4]}>
          <Text style={[Fonts.p3Bold, { color: Colors.neutral00, lineHeight: 20 }]}>
            {leagueNegotiationSummary.title}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200, lineHeight: 20 }]}>
            {leagueNegotiationSummary.compactHelper}
          </Text>
        </View>

        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifyBetween, { columnGap: 12 }]}>
          <Text
            numberOfLines={1}
            style={[Fonts.p4, { color: Colors.neutral300, flex: 1 }]}
          >
            {latestProposalMessageId
              ? 'La proposition détaillée reste visible dans le fil ci-dessous.'
              : 'Retrouve l historique de l organisation dans le fil ci-dessous.'}
          </Text>
          <TouchableOpacity
            onPress={handleOpenLeagueMatchDetails}
            style={{
              backgroundColor: 'rgba(1,179,244,0.12)',
              borderColor: 'rgba(1,179,244,0.32)',
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
              Voir la fiche match
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground
      resizeMode="cover"
      source={Images.bg2}
      style={[Alignments.fill]}
    >
      {shouldAvoidDeprecatedSystemBarColors ? (
        <StatusBar barStyle="light-content" translucent />
      ) : (
        <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      )}

      {/* Custom Header */}
      <View style={{
        alignItems: 'center',
        flexDirection: 'row',
        paddingBottom: 10,
        paddingHorizontal: 16,
        paddingTop: top + 10,
        zIndex: 10,
      }}
      >
        <View style={{ alignItems: 'flex-start', width: HEADER_SIDE_WIDTH }}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            style={{ marginLeft: 0 }}
            withDefaultMargin={false}
          />
        </View>

        <View style={{ alignItems: 'flex-start', flex: 1, paddingHorizontal: 16 }}>
          <Text
            numberOfLines={1}
            style={[Fonts.h3, { color: Colors.neutral00 }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[Fonts.p3, { color: Colors.neutral300 }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: 'flex-end', width: HEADER_SIDE_WIDTH }}>
          <TouchableOpacity
            onPress={() => setIsMenuVisible(true)}
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 20,
              height: 40,
              justifyContent: 'center',
              width: 40,
            }}
          >
            <Text
              style={{
                color: Colors.neutral00,
                fontSize: 20,
                fontWeight: 'bold',
              }}
            >
              {'\u22EE'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[Alignments.fill]}>
        {renderLeagueNegotiationBanner()}
        {hasMessagesLoadingError ? (
          <ErrorWrapper
            error={messagesError}
            onRetry={handleRetryMessages}
            retryLabel="Recharger la conversation"
            wrapperStyle={[Alignments.fill]}
          >
            <View style={[Alignments.fill]} />
          </ErrorWrapper>
        ) : null}
        {!hasMessagesLoadingError && isMessagesFirstLoad ? (
          // PERF2 — premiere ouverture : la FORME d un fil (des bulles qui
          // balayent), plus une roue plein ecran qui ne montre rien.
          <View
            style={[Alignments.fill, { padding: 16 }]}
            testID="conversation-messages-skeleton"
          >
            <WithDataWrapper isLoading wrapperStyle={[{ gap: 12 }]}>
              <SkeletonBubble height={44} width="62%" />
              <SkeletonBubble height={36} width="44%" />
              <SkeletonBubble height={44} mine width="55%" />
              <SkeletonBubble height={36} width="40%" />
              <SkeletonBubble height={56} mine width="65%" />
            </WithDataWrapper>
          </View>
        ) : null}
        {!hasMessagesLoadingError && !isMessagesFirstLoad ? (
          <GiftedChat
            bottomOffset={giftedChatBottomOffset}
            dateFormat="DD MMMM"
            dateFormatCalendar={{
              lastDay: '[Hier]',
              lastWeek: '[La semaine dernière] dddd',
              nextDay: '[Demain]',
              nextWeek: 'dddd',
              sameDay: '[Aujourd\'hui]',
              sameElse: 'DD/MM/YYYY',
            }}
            focusOnInputWhenOpeningKeyboard={!isPollModalVisible}
            infiniteScroll
            inverted
            listViewProps={{ onScrollToIndexFailed: handleScrollToIndexFailed }}
            loadEarlier={hasNextPage}
            locale="fr"
            messageContainerRef={messageContainerRef}
            messages={messages}
            onInputTextChanged={handleInputTextChanged}
            onLoadEarlier={() => fetchNextPage()}
            onLongPress={handleMessageLongPress}
            onSend={onSend}
            renderBubble={renderBubble}
            renderChatEmpty={renderChatEmpty}
            renderFooter={renderFooter}
            renderInputToolbar={isPollModalVisible ? () => null : renderInputToolbar}
            renderSend={renderSend}
            text={composerText}
            user={{
              _id: userData?.documentId || '',
              avatar: userData?.avatar?.url,
              name: `${userData?.firstname || ''} ${userData?.lastname || ''}`,
            }}
          />
        ) : null}

        <Modal
          animationType="fade"
          onRequestClose={() => {
            setIsImagePreviewVisible(false);
            setPreviewImageUrl('');
            setDidTryImageHttpsFallback(false);
          }}
          transparent={false}
          visible={isImagePreviewVisible}
        >
          <View style={{
            alignItems: 'center',
            backgroundColor: '#000',
            flex: 1,
            justifyContent: 'center',
          }}
          >
            <TouchableOpacity
              onPress={() => {
                setIsImagePreviewVisible(false);
                setPreviewImageUrl('');
                setDidTryImageHttpsFallback(false);
              }}
              style={{
                left: 20,
                padding: 12,
                position: 'absolute',
                top: top + 8,
                zIndex: 2,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>X</Text>
            </TouchableOpacity>

            {previewImageUrl ? (
              <Image
                onError={(event) => {
                  const canRetryWithHttps = /^http:\/\//i.test(previewImageUrl)
                    && !didTryImageHttpsFallback;
                  if (canRetryWithHttps) {
                    const httpsUrl = previewImageUrl.replace(/^http:\/\//i, 'https://');
                    setDidTryImageHttpsFallback(true);
                    setPreviewImageUrl(httpsUrl);
                    logAttachmentDebug('imagePreviewModal retry with https', {
                      previousUrl: previewImageUrl,
                      retryUrl: httpsUrl,
                    });
                    return;
                  }
                  logAttachmentDebug('imagePreviewModal load error', {
                    didTryImageHttpsFallback,
                    error: event?.nativeEvent?.error || 'unknown',
                    previewImageUrl,
                  });
                }}
                onLoad={() => {
                  logAttachmentDebug('imagePreviewModal load success', { previewImageUrl });
                }}
                resizeMode="contain"
                source={{ uri: previewImageUrl }}
                style={{
                  height: '90%',
                  width: '100%',
                }}
              />
            ) : null}
          </View>
        </Modal>

        {/* Menu Modal */}
        <BottomModal
          close={() => setIsMenuVisible(false)}
          isVisible={isMenuVisible}
        >
          <View style={[Spaces.gap[16], Spaces.marginTop[32]]}>
            {showCancelButton && (
            <Button
              onPress={() => {
                setIsMenuVisible(false);
                setSafeTimeout(() => {
                  handleCancelMatch();
                }, 300);
              }}
              title={t('common.cancelMatch', 'Annuler le match')}
              variant="Secondary"
            />
            )}

            {isGroupAdmin && (
            <Button
              onPress={handleOpenGroupManagement}
              title={t('conversation.actions.manageGroup', 'Gérer le groupe')}
              variant="SecondaryLight"
            />
            )}

            <Button
              onPress={() => {
                setIsMenuVisible(false);
                setSafeTimeout(() => {
                  showInfoBanner(
                    'Pour signaler ce match ou cet utilisateur, merci de contacter le support via les paramètres.',
                    'Signaler',
                  );
                }, 300);
              }}
              title={t('conversation.actions.report', 'Signaler')}
              variant="SecondaryLight"
            />

            {/* 🚫 BLOQUER (K3) — le second des deux endroits qu Apple regarde.
                Il n apparait QUE pour un tete-a-tete : un fil de club, d equipe
                ou de groupe n a personne a bloquer, et la discussion a trois du
                mineur avec son parent n en a pas non plus (K5). */}
            {otherParticipantId ? (
              <Button
                disabled={isBlockingUser || isUnblockingUser}
                isLoading={isBlockingUser || isUnblockingUser}
                onPress={handleToggleBlockFromMenu}
                title={isOtherParticipantBlocked
                  ? t('userBlock.actions.unblock', 'Débloquer cette personne')
                  : t('userBlock.actions.block', 'Bloquer cette personne')}
                variant="SecondaryLight"
              />
            ) : null}

            <Button
              onPress={() => setIsMenuVisible(false)}
              title={t('common.cancel', 'Fermer')}
              variant="PrimaryLight"
            />
          </View>
        </BottomModal>

        <GlobalPromptModal
          body={conversationPrompt?.body}
          inlineOnAndroid
          onRequestClose={closeConversationPrompt}
          primaryAction={conversationPrompt?.primaryAction}
          secondaryAction={conversationPrompt?.secondaryAction}
          title={conversationPrompt?.title || ''}
          tone={conversationPrompt?.tone || 'primary'}
          visible={Boolean(conversationPrompt)}
        />

        <BottomModal
          close={() => setIsGroupManagementVisible(false)}
          isVisible={isGroupManagementVisible}
        >
          <View style={[Spaces.gap[12], Spaces.marginTop[24], Spaces.marginBottom[12]]}>
            <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter]}>
              {t('conversation.group.title', 'Gestion du groupe')}
            </Text>

            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('conversation.group.nameLabel', 'Nom du groupe')}
            </Text>
            <TextInput
              onChangeText={setGroupNameDraft}
              placeholder={t('conversation.group.namePlaceholder', 'Nom du groupe')}
              placeholderTextColor={Colors.neutral300}
              style={[
                Fonts.p2,
                ApplicationStyle.borderRadius16,
                Spaces.paddingHorizontal[16],
                Spaces.paddingVertical[12],
                {
                  borderColor: Colors.primary500,
                  borderWidth: 1,
                  color: Colors.neutral00,
                },
              ]}
              value={groupNameDraft}
            />

            <Button
              disabled={isGroupMutationLoading}
              isLoading={isGroupMutationLoading}
              onPress={handleSaveGroupName}
              title={t('conversation.group.saveName', 'Enregistrer le nom')}
              variant="SecondaryLight"
            />

            <Button
              disabled={isGroupMutationLoading}
              onPress={handleAddGroupMembers}
              title={t('conversation.group.addMembers', 'Ajouter des membres')}
              variant="SecondaryLight"
            />

            <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[8]]}>
              {t('conversation.group.members', 'Membres')}
            </Text>
            {(Array.isArray(chatData?.participants) ? chatData.participants : []).map((participant) => {
              const participantId = String(participant?.documentId || participant?.id || '').trim();
              if (!participantId) return null;
              const isSelf = participantId === String(userData?.documentId || '');
              const isMemberAdmin = groupAdminIds.includes(participantId);
              const participantName = `${participant?.firstname || ''} ${participant?.lastname || ''}`.trim() || participant?.username || participant?.phoneNumber || participantId;

              return (
                <View
                  key={`group-member:${participantId}`}
                  style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    Alignments.justifyBetween,
                    Spaces.paddingVertical[8],
                  ]}
                >
                  <View style={Alignments.fill}>
                    <Text style={[Fonts.p2, Fonts.neutral00]}>{participantName}</Text>
                    <Text style={[Fonts.p4, Fonts.neutral300]}>
                      {isMemberAdmin ? t('conversation.group.admin', 'Admin') : t('conversation.group.member', 'Membre')}
                    </Text>
                  </View>
                  {!isSelf && (
                    <TouchableOpacity
                      disabled={isGroupMutationLoading}
                      onPress={() => handleRemoveGroupMember(participant)}
                    >
                      <Text style={[Fonts.p3Bold, { color: Colors.warning500 || Colors.primary500 }]}>
                        {t('conversation.group.remove', 'Retirer')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <Button
              onPress={() => setIsGroupManagementVisible(false)}
              title={t('common.close', 'Fermer')}
              variant="PrimaryLight"
            />
          </View>
        </BottomModal>

        <BottomModal
          close={() => setIsAttachmentMenuVisible(false)}
          contentContainerStyle={{ gap: 16, paddingBottom: 56, paddingTop: 18 }}
          hideCloseButton
          isVisible={isAttachmentMenuVisible}
          keyboardBehavior="extend"
          onDismissed={handleAttachmentSheetDismissed}
        >
          {isAttachmentSheetV2Enabled ? (
            <ChatAttachmentSheet
              actions={attachmentSheetActions}
              onActionPress={handleAttachmentSheetAction}
              subtitle={t('conversation.attachments.subtitle', 'Partage du contenu dans cette conversation')}
              title={t('conversation.attachments.title', 'Ajouter')}
            />
          ) : (
            <View style={Spaces.gap[16]}>
              <Button
                disabled={isUploading}
                isLoading={isUploading}
                onPress={() => runAttachmentAction(handleTakePhoto)}
                title={t('conversation.attachments.takePhoto', 'Prendre une photo')}
                variant="PrimaryLight"
              />
              <Button
                disabled={isUploading}
                onPress={() => runAttachmentAction(handlePickMedia)}
                title={t('conversation.attachments.pickMedia', 'Envoyer un media')}
                variant="SecondaryLight"
              />
              <Button
                disabled={isUploading}
                onPress={() => runAttachmentAction(handlePickFile)}
                title={t('conversation.attachments.pickFile', 'Envoyer un fichier')}
                variant="SecondaryLight"
              />
              <Button
                onPress={() => runAttachmentAction(handleCreatePoll)}
                title={t('conversation.attachments.createPoll', 'Créer un sondage')}
                variant="SecondaryLight"
              />
              <Button
                onPress={() => setIsAttachmentMenuVisible(false)}
                title={t('common.cancel', 'Fermer')}
                variant="PrimaryLight"
              />
            </View>
          )}
        </BottomModal>

        <BottomModal
          close={() => {
            setIsLocationShareModalVisible(false);
            setSelectedLocationOption(undefined);
          }}
          isVisible={isLocationShareModalVisible}
        >
          <View style={[Spaces.gap[16], { paddingBottom: 18 }]}>
            <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
              {t('conversation.shareLocation.title', 'Partager une localisation')}
            </Text>
            <AutocompleteAddressInput
              address={selectedLocationOption}
              placeholder={t('conversation.shareLocation.placeholder', 'Rechercher une adresse')}
              setAddress={setSelectedLocationOption}
            />
            <Button
              disabled={!selectedLocationOption}
              onPress={handleShareLocation}
              title={t('conversation.shareLocation.send', 'Partager')}
              variant="PrimaryLight"
            />
          </View>
        </BottomModal>

        <BottomModal
          close={() => {
            setIsContactShareModalVisible(false);
            setSelectedContactId('');
          }}
          isVisible={isContactShareModalVisible}
        >
          <View style={[Spaces.gap[12], { paddingBottom: 18 }]}>
            <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
              {t('conversation.shareContact.title', 'Partager un contact')}
            </Text>

            {shareableContacts.length === 0 ? (
              <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>
                {t('conversation.shareContact.empty', 'Aucun contact partageable dans ce chat.')}
              </Text>
            ) : shareableContacts.map((contact) => {
              const fullName = `${contact?.firstname || ''} ${contact?.lastname || ''}`.trim() || 'Membre';
              const isSelected = selectedContactId === contact.documentId;

              return (
                <TouchableOpacity
                  key={`contact-share-${contact.documentId}`}
                  onPress={() => setSelectedContactId(contact.documentId)}
                  style={{
                    borderColor: isSelected ? Colors.primary500 : 'rgba(255,255,255,0.16)',
                    borderRadius: 12,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                  }}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{fullName}</Text>
                  {contact?.role ? (
                    <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>{contact.role}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}

            <Button
              disabled={!selectedContactId}
              onPress={handleShareContact}
              title={t('conversation.shareContact.send', 'Partager')}
              variant="PrimaryLight"
            />
          </View>
        </BottomModal>

        <BottomModal
          close={() => setIsEventShareModalVisible(false)}
          hideCloseButton
          isVisible={isEventShareModalVisible}
        >
          <View style={[Spaces.gap[12], { maxHeight: 560 }]}>
            <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
              {t('conversation.shareEvent.planningTitle', 'Événements de mon planning')}
            </Text>

            {isLoadingSharedEvents ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <ActivityIndicator color={Colors.primary500} />
              </View>
            ) : null}

            {!isLoadingSharedEvents && shareableEvents.length === 0 ? (
              <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>
                {t('conversation.shareEvent.empty', 'Aucun événement disponible.')}
              </Text>
            ) : null}

            {!isLoadingSharedEvents && shareableEvents.length > 0 ? (
              <View style={{ flexGrow: 1 }}>
                <ScrollView
                  contentContainerStyle={{ paddingBottom: 4 }}
                  showsVerticalScrollIndicator={false}
                >
                  {shareableEvents.map((event, index) => (
                    <View
                      key={`event-share-${event.documentId || event.id}`}
                      style={index < shareableEvents.length - 1 ? Spaces.marginBottom[12] : null}
                    >
                      <EventCardNew
                        item={event}
                        mode="share"
                        onPress={handleShareEvent}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <Button
              onPress={handleOpenPublicEventPicker}
              title={t('conversation.shareEvent.sharePublicAction', 'Partager un événement public')}
              variant="SecondaryLight"
            />
          </View>
        </BottomModal>

        <BottomModal
          close={closeDocumentActionMenu}
          isVisible={Boolean(selectedDocumentActionMessage)}
        >
          <View style={[Spaces.gap[12], Spaces.marginTop[24], Spaces.marginBottom[8]]}>
            <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter]}>
              {t('conversation.documentActions.title', 'Actions du document')}
            </Text>
            {selectedDocumentActionAttachment ? (
              <View
                style={[
                  ApplicationStyle.borderRadius16,
                  Spaces.paddingHorizontal[16],
                  Spaces.paddingVertical[12],
                  {
                    backgroundColor: 'rgba(10, 28, 38, 0.94)',
                    borderColor: 'rgba(1,179,244,0.28)',
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {getDocumentDisplayName(selectedDocumentActionAttachment)}
                </Text>
                {selectedDocumentActionPreview ? (
                  <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
                    {selectedDocumentActionPreview}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Button
              disabled={!selectedDocumentActionAttachment}
              onPress={handleOpenSelectedDocumentAttachment}
              title={t('conversation.documentActions.open', 'Ouvrir')}
              variant="SecondaryLight"
            />
            <Button
              disabled={!selectedDocumentActionAttachment}
              onPress={handleDownloadSelectedDocumentAttachment}
              title={t('conversation.documentActions.download', 'Télécharger')}
              variant="SecondaryLight"
            />
            <Button
              disabled={!selectedDocumentActionAttachment}
              onPress={handleShareSelectedDocumentAttachment}
              title={t('conversation.documentActions.share', 'Partager')}
              variant="SecondaryLight"
            />
            {selectedDocumentActionMessage?.failed ? (
              <Button
                onPress={handleRetrySelectedDocumentAttachment}
                title={t('common.retry', 'Réessayer')}
                variant="Secondary"
              />
            ) : null}
            <Button
              onPress={closeDocumentActionMenu}
              title={t('common.close', 'Fermer')}
              variant="PrimaryLight"
            />
          </View>
        </BottomModal>

        <PollCreationModal
          isVisible={isPollModalVisible}
          onClose={closePollModal}
          onSubmit={handleSubmitPoll}
        />

        <BottomModal
          close={closeMessageActionsModal}
          isVisible={isMessageActionsVisible}
        >
          <View style={[Spaces.gap[12], Spaces.marginTop[24], Spaces.marginBottom[8]]}>
            <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter]}>
              {t('conversation.actions.modalTitle', 'Actions du message')}
            </Text>
            <Button
              onPress={handleReplySelectedMessage}
              title={t('conversation.actions.reply', 'Repondre')}
              variant="SecondaryLight"
            />
            {canCopySelectedMessage ? (
              <Button
                onPress={handleCopySelectedMessage}
                title={t('conversation.actions.copy', 'Copier')}
                variant="SecondaryLight"
              />
            ) : null}
            {canEditSelectedMessage ? (
              <Button
                onPress={handleOpenEditForSelectedMessage}
                title={t('conversation.actions.edit', 'Modifier')}
                variant="SecondaryLight"
              />
            ) : null}
            {isSelectedMessageOwn ? (
              <Button
                onPress={handleDeleteSelectedMessage}
                title={t('conversation.actions.delete', 'Supprimer')}
                variant="Secondary"
              />
            ) : null}
            {!isSelectedMessageOwn ? (
              <Button
                onPress={handleOpenReportForSelectedMessage}
                title={t('conversation.actions.report', 'Signaler')}
                variant="SecondaryLight"
              />
            ) : null}
            <Button
              onPress={closeMessageActionsModal}
              title={t('common.actions.cancel', 'Annuler')}
              variant="PrimaryLight"
            />
          </View>
        </BottomModal>

        <BottomModal
          close={handleCloseEditMessageModal}
          isVisible={isEditMessageModalVisible}
        >
          <View style={[Spaces.gap[12], Spaces.marginTop[16], Spaces.marginBottom[8]]}>
            <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter]}>
              {t('conversation.actions.editModal.title', 'Modifier le message')}
            </Text>

            <TextInput
              multiline
              onChangeText={setEditMessageText}
              placeholder={t('conversation.actions.editModal.placeholder', 'Modifier le texte...')}
              placeholderTextColor={Colors.neutral300}
              style={[
                Fonts.p2,
                ApplicationStyle.borderRadius16,
                Spaces.paddingHorizontal[16],
                Spaces.paddingVertical[12],
                {
                  borderColor: Colors.primary500,
                  borderWidth: 1,
                  color: Colors.neutral00,
                  minHeight: 120,
                  textAlignVertical: 'top',
                },
              ]}
              value={editMessageText}
            />

            <View style={[Alignments.row, Alignments.justifyBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t('conversation.actions.editModal.attachments', 'Pièces jointes')}
              </Text>
              {isEditMessageUploadingAttachment ? (
                <ActivityIndicator color={Colors.primary500} size="small" />
              ) : null}
            </View>

            {Array.isArray(editMessageAttachments) && editMessageAttachments.length > 0 ? (
              <View style={Spaces.gap[8]}>
                {editMessageAttachments.map((attachment, index) => {
                  const attachmentKey = String(
                    attachment?.documentId
                    || attachment?.id
                    || attachment?.url
                    || attachment?.name
                    || `attachment-${index}`,
                  );
                  const attachmentLabel = String(
                    attachment?.name
                    || attachment?.alternativeText
                    || attachment?.caption
                    || t('conversation.actions.editModal.attachmentFallback', 'Pièce jointe'),
                  );
                  return (
                    <View
                      key={`edit-attachment-${attachmentKey}`}
                      style={[
                        Alignments.row,
                        Alignments.alignCenter,
                        Alignments.justifyBetween,
                        ApplicationStyle.borderRadius12,
                        Spaces.paddingHorizontal[12],
                        Spaces.paddingVertical[8],
                        {
                          borderColor: 'rgba(255,255,255,0.18)',
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral00, Alignments.fill]}>
                        {attachmentLabel}
                      </Text>
                      <TouchableOpacity onPress={() => handleRemoveEditAttachment(attachment)}>
                        <Text style={[Fonts.p3Bold, { color: Colors.error500 || Colors.primary500 }]}>
                          {t('common.actions.delete', 'Supprimer')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[Fonts.p4, Fonts.neutral300]}>
                {t('conversation.actions.editModal.noAttachments', 'Aucune pièce jointe')}
              </Text>
            )}

            <View style={Spaces.gap[8]}>
              <Button
                disabled={isEditMessageUploadingAttachment || isEditMessageSubmitting}
                onPress={handleEditPickMedia}
                title={t('conversation.actions.editModal.addMedia', 'Ajouter un media')}
                variant="SecondaryLight"
              />
              <Button
                disabled={isEditMessageUploadingAttachment || isEditMessageSubmitting}
                onPress={handleEditTakePhoto}
                title={t('conversation.actions.editModal.takePhoto', 'Prendre une photo')}
                variant="SecondaryLight"
              />
              <Button
                disabled={isEditMessageUploadingAttachment || isEditMessageSubmitting}
                onPress={handleEditPickFile}
                title={t('conversation.actions.editModal.addFile', 'Ajouter un fichier')}
                variant="SecondaryLight"
              />
            </View>

            <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[8]]}>
              <Button
                disabled={isEditMessageSubmitting}
                onPress={handleCloseEditMessageModal}
                style={Alignments.fill}
                title={t('common.actions.cancel', 'Annuler')}
                variant="SecondaryLight"
              />
              <Button
                disabled={isEditMessageUploadingAttachment}
                isLoading={isEditMessageSubmitting}
                onPress={handleSubmitEditMessage}
                style={Alignments.fill}
                title={t('common.actions.save', 'Enregistrer')}
                variant="PrimaryLight"
              />
            </View>
          </View>
        </BottomModal>

        <BottomModal
          close={() => {
            setIsReportModalVisible(false);
            setSelectedMessage(undefined);
          }}
          isVisible={isReportModalVisible}
        >
          <View style={[Spaces.gap[16], Spaces.marginTop[32]]}>
            <Button
              disabled={isReportingMessage}
              onPress={handleGoToUserDetails}
              title={t('conversation.modals.actions.seeUser')}
              variant="PrimaryLight"
            />
            <Button
              disabled={isReportingMessage}
              isLoading={isReportingMessage}
              onPress={handleSubmitReport}
              title={t('conversation.modals.actions.report')}
              variant="SecondaryLight"
            />
          </View>
        </BottomModal>
        <JoinEventModal
          clubName={selectedEvent?.team?.club?.name || ''}
          confirmLabel={selectedParticipationFlow?.confirmLabel}
          errorMessage={joinModalError || null}
          isSubmitting={
            createEventParticipationMutation.isPending
            || joinReservationMutation.isPending
          }
          isVisible={isJoinModalVisible}
          onClose={handleCloseJoinModal}
          onConfirm={handleConfirmJoinEvent}
        />

        <VenueProposalModal
          initialDate={proposalDefaults.date}
          initialEndTime={proposalDefaults.end}
          initialStartTime={proposalDefaults.start}
          isSubmitting={isProposalSubmitting}
          isVisible={isProposalModalVisible}
          legalAcceptanceConfig={{
            metadata: {
              chatId,
              matchLabel: leagueLegalMatchLabel,
            },
            scope: LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
            sourceScreen: 'conversation_league_proposal',
            targetDocumentId: getEntityDocumentId(chatData?.league_match),
            targetLabel: leagueLegalMatchLabel,
            targetType: 'league_match',
          }}
          onClose={() => {
            setCounterProposalContext(null);
            setIsProposalModalVisible(false);
          }}
          onSend={handleSendProposal}
          onSkip={() => {
            setCounterProposalContext(null);
            setIsProposalModalVisible(false);
          }}
        />
        {leagueLegalAcceptanceModal}
      </View>
    </ImageBackground>
  );
}

export default Conversation;
