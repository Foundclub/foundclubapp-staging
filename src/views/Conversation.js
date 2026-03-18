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
  Alert,
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

import { getAuthTokens } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  applyOptimisticPollVote,
  createPollComposition,
} from '@/domains/messaging/pollUseCases';
import useMessaging from '@/domains/messaging/useMessaging';
import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import CompositionMessageBubble from '@/components/molecules/compositionMessageBubble/CompositionMessageBubble';
import ContactShareBubble from '@/components/molecules/contactShareBubble/ContactShareBubble';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import EventMessageBubble from '@/components/molecules/eventMessageBubble/EventMessageBubble';
import EventShareBubble from '@/components/molecules/eventShareBubble/EventShareBubble';
import LocationShareBubble from '@/components/molecules/locationShareBubble/LocationShareBubble';
import PollMessageBubble from '@/components/molecules/pollMessageBubble/PollMessageBubble';
import ProposalMessageBubble from '@/components/molecules/proposalMessageBubble/ProposalMessageBubble';
import VoiceNoteBubble from '@/components/molecules/voiceNoteBubble/VoiceNoteBubble';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ChatAttachmentSheet from '@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import PollCreationModal from '@/components/organisms/pollCreationModal/PollCreationModal';
import VenueProposalModal from '@/components/organisms/venueProposalModal/VenueProposalModal';
import { buildProposalDefaultsFromMatch } from '@/views/league/match/utils/proposalDefaults';

import { RouteNames } from '@/navigation/routeNames';

import { useGetChatById, useGetChatMessages } from '@/services/chat/chatQueriesCompat';
import {
  cancelRecording,
  isVoiceNoteRecordingSupported,
  startRecording,
  stopRecording,
} from '@/services/chat/voiceNoteService';
import client from '@/services/client';
import { useGetEvents } from '@/services/event/eventQueries';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import { cancelMatch, confirmMatch, updateMatch } from '@/services/league/leagueMatchService';
import { createMessageReport } from '@/services/messageReport/messageReportService';

import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';
import { createLogger } from '@/utils/logger/logger';

import useAudioPlayback from '@/hooks/useAudioPlayback';
import { EVENTS } from '@/hooks/useSocket';

const conversationLogger = createLogger('conversation');

const useTranslationCompat = (
  typeof ReactI18next.useTranslation === 'function'
    ? ReactI18next.useTranslation
    : () => ({ i18n, t: (key, options) => i18n.t(key, options) })
);
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
const isLocationShareEnabled = isFlagEnabled(process.env.FC_CHAT_SHARE_LOCATION, true);
const isContactShareEnabled = isFlagEnabled(process.env.FC_CHAT_SHARE_CONTACT, true);
const isEventShareEnabled = isFlagEnabled(process.env.FC_CHAT_SHARE_EVENT, true);
const isAttachmentDebugEnabled = isFlagEnabled(process.env.FC_CHAT_ATTACHMENT_DEBUG, false);
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

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

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
 * @param root0
 * @param root0.color
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
const BYTES_PER_MB = 1024 * 1024;
const MAX_ATTACHMENT_BYTES = {
  audio: 20 * BYTES_PER_MB,
  default: 25 * BYTES_PER_MB,
  image: 15 * BYTES_PER_MB,
  video: 80 * BYTES_PER_MB,
};

const toPublicApiOrigin = (rawApiUrl) => {
  const raw = String(rawApiUrl || '').trim();
  if (!raw) return 'http://10.0.2.2:1337';
  return raw.replace(/\/api\/?$/i, '');
};

const toApiBaseUrl = (rawApiUrl) => {
  const raw = String(rawApiUrl || '').trim();
  if (!raw) return 'http://10.0.2.2:1337/api';
  const withoutTrailingSlash = raw.replace(/\/+$/g, '');
  if (/\/api$/i.test(withoutTrailingSlash)) return withoutTrailingSlash;
  return `${withoutTrailingSlash}/api`;
};

const isLoopbackHost = (host) => ['10.0.2.2', '127.0.0.1', 'localhost']
  .includes(String(host || '').trim().toLowerCase());

/** @type {any | null | undefined} */
let cachedDocumentPickerModule;

const getDocumentPickerModule = () => {
  if (cachedDocumentPickerModule !== undefined) return cachedDocumentPickerModule;

  try {
    // Lazy load to avoid boot-time crashes when native module is missing on a stale build.
    // eslint-disable-next-line global-require
    const pickerModule = require('@react-native-documents/picker');
    cachedDocumentPickerModule = pickerModule?.default || pickerModule;
    return cachedDocumentPickerModule;
  } catch (_error) {
    cachedDocumentPickerModule = null;
    return null;
  }
};

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
  const { t } = useTranslationCompat();
  const { userData } = useAuth();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const uploadInFlightRef = useRef(false);
  const formatDateForGoogleCalendar = (/** @type {string | number | Date} */ dateInput) => {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return null;
    const pad = (/** @type {string | number} */ value) => String(value).padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  };

  const promptAddMatchToCalendar = (/** @type {any} */ message) => {
    const startIso = message?.composition?.date || chatData?.league_match?.date;
    const venue = message?.composition?.venue || chatData?.league_match?.venue || chatData?.league_match?.proposed_venue || '';
    if (!startIso) return;

    const startDate = new Date(startIso);
    if (Number.isNaN(startDate.getTime())) return;
    const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
    const startParam = formatDateForGoogleCalendar(startDate);
    const endParam = formatDateForGoogleCalendar(endDate);
    if (!startParam || !endParam) return;

    Alert.alert(
      'Match confirmé ?',
      'Ajouter ce match à votre agenda ?',
      [
        { style: 'cancel', text: 'Plus tard' },
        {
          onPress: async () => {
            const text = encodeURIComponent('Match FoundClub League');
            const details = encodeURIComponent('Match confirmé depuis la messagerie League');
            const location = encodeURIComponent(venue);
            const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startParam}/${endParam}&details=${details}&location=${location}`;
            try {
              await Linking.openURL(url);
            } catch (error) {
              conversationLogger.warn('Failed to open calendar URL', error);
            }
          },
          text: 'Ajouter',
        },
      ],
    );
  };

  const {
    deleteMessage,
    editMessage,
    getConversationName,
    isSocketConnected,
    removeGroupMember,
    respondToProposal,
    retryFailedMessage,
    sendMessage,
    sendReadReceipt,
    sendTypingStart,
    sendTypingStop,
    socket,
    updateGroupMeta,
    votePoll,
  } = useMessaging(chatId);

  const logAttachmentDebug = useCallback((message, meta = undefined) => {
    if (!isAttachmentDebugEnabled) return;
    conversationLogger.debug(`[attachment-debug] ${message}`, meta);
  }, []);

  const describeAsset = useCallback((asset) => {
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

  const describeUploadItems = useCallback((items) => (
    Array.isArray(items)
      ? items.map((item) => ({
        documentId: item?.documentId ?? null,
        id: item?.id ?? null,
        mime: item?.mime ?? null,
        name: item?.name ?? null,
        size: item?.size ?? null,
        url: item?.url ?? null,
      }))
      : []
  ), []);

  const isTransientNetworkUploadError = useCallback((error) => {
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

  const buildAttachmentUploadErrorMessage = useCallback((error) => {
    const responseStatus = Number(error?.response?.status || 0);
    const rawErrorMessage = String(
      error?.response?.data?.error?.message
      || error?.response?.data?.message
      || error?.message
      || '',
    ).toLowerCase();
    if (responseStatus === 413 || rawErrorMessage.includes('too large') || rawErrorMessage.includes('payload too large')) {
      return 'La pièce jointe est trop volumineuse pour être envoyée.';
    }
    if (responseStatus === 401 || responseStatus === 403) {
      return 'Session invalide. Reconnectez-vous puis réessayez.';
    }
    if (isTransientNetworkUploadError(error)) {
      return 'Connexion instable. Vérifiez votre réseau puis réessayez.';
    }
    if (rawErrorMessage.includes('invalid attachment')) {
      return 'Format de pièce jointe invalide.';
    }
    return "Impossible d'envoyer cette pièce jointe.";
  }, [isTransientNetworkUploadError]);

  const getAttachmentSizeLimit = useCallback((assetType) => {
    const normalizedType = String(assetType || '').toLowerCase();
    if (normalizedType.startsWith('image/')) return MAX_ATTACHMENT_BYTES.image;
    if (normalizedType.startsWith('video/')) return MAX_ATTACHMENT_BYTES.video;
    if (normalizedType.startsWith('audio/')) return MAX_ATTACHMENT_BYTES.audio;
    return MAX_ATTACHMENT_BYTES.default;
  }, []);

  const validateAttachmentAsset = useCallback((asset) => {
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
      const maxMb = Math.round(maxBytes / BYTES_PER_MB);
      return {
        reason: 'file_too_large',
        userMessage: `Fichier trop volumineux (max ${maxMb} Mo).`,
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
  const [editMessageAttachments, setEditMessageAttachments] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(
    /**
     * @type {import('react-native-gifted-chat').IMessage & {documentId: string} | undefined}
     */ (undefined),
  );
  const {
    data: messagesPages,
    fetchNextPage,
    hasNextPage,
  } = useGetChatMessages({ chatId });
  const { data: chatData } = useGetChatById(chatId);
  const isGroupChat = chatData?.type === 'group';
  const groupAdminIds = useMemo(() => {
    if (!Array.isArray(chatData?.groupAdmins)) return [];
    return chatData.groupAdmins
      .map((admin) => String(admin?.documentId || admin?.id || ''))
      .filter(Boolean);
  }, [chatData?.groupAdmins]);
  const isGroupAdmin = isGroupChat && groupAdminIds.includes(String(userData?.documentId || ''));

  useEffect(() => {
    if (!isGroupChat) return;
    setGroupNameDraft(String(chatData?.groupName || ''));
  }, [chatData?.groupName, isGroupChat]);

  const {
    data: sharedEventsPages,
    isFetching: isLoadingSharedEvents,
  } = useGetEvents(
    {
      excludeType: 'R\u00E9servation',
      myTeams: true,
      pageSize: 20,
      sort: 'date:asc',
    },
    {
      enabled: isEventShareEnabled,
    },
  );

  const shareableEvents = useMemo(() => {
    if (!Array.isArray(sharedEventsPages?.pages)) return [];
    const seen = new Set();
    /** @type {any[]} */
    const events = [];

    sharedEventsPages.pages.forEach((page) => {
      if (!Array.isArray(page?.data)) return;
      page.data.forEach((event) => {
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
      .filter((participant) => participant?.documentId && participant.documentId !== userData?.documentId)
      .map((participant) => ({
        avatar: participant?.avatar,
        documentId: participant?.documentId,
        firstname: participant?.firstname || '',
        lastname: participant?.lastname || '',
        role: participant?.role?.name || participant?.role?.type || '',
      }));
  }, [chatData?.participants, userData?.documentId]);

  const canRecordVoiceNote = useMemo(
    () => isVoiceNotesEnabled && isVoiceNoteRecordingSupported(),
    [],
  );

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
  const apiBaseUrl = useMemo(() => toApiBaseUrl(process.env.API_URL), []);
  const publicApiOrigin = useMemo(() => toPublicApiOrigin(process.env.API_URL), []);
  const HEADER_SIDE_WIDTH = 56;
  const resolveMediaUri = useCallback((rawUri) => {
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

  const fetchAttachmentUrlById = useCallback(async (attachmentId) => {
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
      logAttachmentDebug('fetchAttachmentUrlById failed', {
        attachmentId: numericId,
        error: error?.message || error,
      });
    }

    return '';
  }, [logAttachmentDebug, resolveMediaUri]);

  const normalizeAttachmentItem = useCallback((item) => {
    if (!item || typeof item !== 'object') return null;
    if (item?.attributes && typeof item.attributes === 'object') {
      return {
        ...item,
        ...item.attributes,
      };
    }
    return item;
  }, []);

  const normalizeMessageAttachments = useCallback((rawAttachments) => {
    if (Array.isArray(rawAttachments)) {
      return rawAttachments
        .map((item) => normalizeAttachmentItem(item))
        .filter(Boolean);
    }

    if (rawAttachments && Array.isArray(rawAttachments?.data)) {
      return rawAttachments.data
        .map((item) => normalizeAttachmentItem(item))
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

  const isImageAttachmentMessage = useCallback((message) => {
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

  const getPrimaryImageUriFromMessage = useCallback((message) => {
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
      Alert.alert(
        t('conversation.modals.reportSuccess.title'),
        t('conversation.modals.reportSuccess.description'),
      );
    },
  });

  const [typingUsers, setTypingUsers] = useState(new Set());
  const [replyingTo, setReplyingTo] = useState(/** @type {(import('react-native-gifted-chat').IMessage & {documentId?: string}) | null} */ (null));
  const [composerText, setComposerText] = useState('');
  const [pendingMediaDraft, setPendingMediaDraft] = useState(
    /** @type {{ asset: { fileName?: string; type?: string; uri?: string | null } } | null} */ (null),
  );
  const [pendingVoiceDraft, setPendingVoiceDraft] = useState(
    /** @type {{
     *  durationMs: number;
     *  fileName: string;
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
  const [isLocationShareModalVisible, setIsLocationShareModalVisible] = useState(false);
  const [isContactShareModalVisible, setIsContactShareModalVisible] = useState(false);
  const [isEventShareModalVisible, setIsEventShareModalVisible] = useState(false);
  const [selectedLocationOption, setSelectedLocationOption] = useState(/** @type {any} */ (undefined));
  const [selectedContactId, setSelectedContactId] = useState('');
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [didTryImageHttpsFallback, setDidTryImageHttpsFallback] = useState(false);
  const handledSharedEventFromPickerRef = useRef('');
  const sharedEventPreviewByIdRef = useRef(new Map());
  const messageContainerRef = useRef(null);
  const swipeableMessageRefs = useRef(new Map());
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
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(/** @type {{ documentId?: string; team?: Team } | undefined} */ (undefined));

  useEffect(() => {
    voiceRecordingStateRef.current = voiceRecordingState;
  }, [voiceRecordingState]);

  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onError: (error) => {
      Alert.alert(t('common.error'), error.message || t('common.errorOccurred'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
      Alert.alert(t('common.success'), t('eventDetails.participationSuccess'));
    },
  });

  const handleParticipateToEvent = (/** @type {{ documentId?: string }} */ event) => {
    if (event?.documentId && userData?.documentId) {
      createEventParticipationMutation.mutate({
        event: event.documentId,
        user: userData.documentId,
      });
    }
  };

  const handleJoinEvent = (/** @type {{ documentId?: string; team?: Team }} */ event) => {
    setSelectedEvent(event);
    setIsJoinModalVisible(true);
  };

  const handleCloseJoinModal = () => {
    setIsJoinModalVisible(false);
    setSelectedEvent(undefined);
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

  // Handle Input Text Change for Typing Indicator
  const handleInputTextChanged = (/** @type {string} */ text) => {
    setComposerText(text);
    if (!isSocketReadTypingEnabled) return;

    if (text.length > 0) {
      sendTypingStart(chatId);
    } else {
      sendTypingStop(chatId);
    }
  };

  const uploadAttachmentAssetWithFetch = useCallback(async (
    /** @type {{ fileName?: string; type?: string; uri?: string | null }} */ asset,
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
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`${apiBaseUrl}/upload`, {
      body: formData,
      headers,
      method: 'POST',
    });
    const rawBody = await response.text();
    let parsedBody = null;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch (_parseError) {
      parsedBody = null;
    }

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

  const uploadAttachmentAsset = useCallback(async (/** @type {{ fileName?: string; type?: string; uri?: string | null }} */ asset) => {
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

    const isVideo = typeof asset.type === 'string' && asset.type.startsWith('video/');
    const isAudio = typeof asset.type === 'string' && asset.type.startsWith('audio/');
    let defaultExtension = 'jpg';
    if (isVideo) {
      defaultExtension = 'mp4';
    } else if (isAudio) {
      defaultExtension = 'm4a';
    }
    const maxAttempts = 3;
    const wait = (ms) => new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
    const attemptUpload = async (attempt) => {
      try {
        if (Platform.OS === 'android' && attempt === 1 && !isAudio) {
          try {
            const androidFetchItems = await uploadAttachmentAssetWithFetch(asset);
            if (androidFetchItems.length > 0) {
              return androidFetchItems;
            }
          } catch (androidFetchError) {
            logAttachmentDebug('uploadAttachmentAsset fetch-first failed', {
              attempt,
              chatId,
              error: androidFetchError?.message || androidFetchError,
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
        const rawErrorMessage = (
          typeof error === 'string'
            ? error
            : String(error?.message || error || '')
        );
        const errorCode = typeof error === 'object' && error !== null
          ? error?.code
          : undefined;
        const responseStatus = typeof error === 'object' && error !== null
          ? error?.response?.status
          : undefined;
        const isTransientNetworkError = isTransientNetworkUploadError(error);
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

        if (Platform.OS === 'android' && isAudio && attempt === 1) {
          try {
            const fallbackItems = await uploadAttachmentAssetWithFetch({
              ...asset,
              fileName: asset.fileName || `upload_${Date.now()}.m4a`,
              type: asset.type || 'audio/mp4',
            });
            if (fallbackItems.length > 0) {
              return fallbackItems;
            }
          } catch (fetchFallbackError) {
            logAttachmentDebug('uploadAttachmentAsset audio fetch fallback failed', {
              attempt,
              chatId,
              error: fetchFallbackError?.message || fetchFallbackError,
            });
          }
        } else if (isTransientNetworkError && !isAudio) {
          try {
            const fallbackItems = await uploadAttachmentAssetWithFetch(asset);
            if (fallbackItems.length > 0) {
              return fallbackItems;
            }
          } catch (fetchFallbackError) {
            logAttachmentDebug('uploadAttachmentAsset fetch fallback failed', {
              attempt,
              chatId,
              error: fetchFallbackError?.message || fetchFallbackError,
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
  }, [chatId, describeAsset, describeUploadItems, isSocketConnected, isTransientNetworkUploadError, logAttachmentDebug, uploadAttachmentAssetWithFetch]);

  const uploadAndSendAttachment = async (
    /** @type {{ fileName?: string; type?: string; uri?: string | null }} */ asset,
    /** @type {{ caption?: string; replyTo?: { documentId?: string } | null }} */ options = {},
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
        logAttachmentDebug('uploadAndSendAttachment failed: zero uploaded files', {
          asset: describeAsset(asset),
          chatId,
        });
        Alert.alert('Erreur', "Aucune pièce jointe n'a pu être envoyée.");
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
        Alert.alert('Erreur', 'Connexion messagerie indisponible. Réessayez dans quelques secondes.');
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
      logAttachmentDebug('uploadAndSendAttachment exception', {
        chatId,
        code: error?.code,
        error: error?.message || error,
        responseData: error?.response?.data,
        responseStatus: error?.response?.status,
      });
      conversationLogger.warn('Attachment upload failed', error);
      Alert.alert('Erreur', buildAttachmentUploadErrorMessage(error));
      return false;
    } finally {
      uploadInFlightRef.current = false;
      setIsUploading(false);
    }
  };

  const normalizePickedAsset = useCallback((
    /** @type {{ fileName?: string; type?: string; uri?: string | null }} */ selectedAsset,
  ) => {
    const rawType = String(selectedAsset?.type || '').trim().toLowerCase();
    const safeType = rawType || 'application/octet-stream';
    const baseName = String(selectedAsset?.fileName || '').trim();

    let extension = 'bin';
    if (safeType.startsWith('image/')) {
      extension = safeType.split('/')[1] || 'jpg';
    } else if (safeType.startsWith('video/')) {
      extension = safeType.split('/')[1] || 'mp4';
    } else if (safeType.startsWith('audio/')) {
      extension = safeType.split('/')[1] || 'm4a';
    } else if (safeType.includes('/')) {
      extension = safeType.split('/')[1] || extension;
    }

    return {
      fileName: baseName || `media_${Date.now()}.${extension}`,
      size: Number(selectedAsset?.fileSize || selectedAsset?.size || 0) || 0,
      type: safeType,
      uri: selectedAsset?.uri,
    };
  }, []);

  const queueOrSendPickedAsset = async (
    /** @type {{ fileName?: string; type?: string; uri?: string | null }} */ selectedAsset,
  ) => {
    const normalizedAsset = normalizePickedAsset(selectedAsset);
    const validationError = validateAttachmentAsset(normalizedAsset);
    if (validationError) {
      logAttachmentDebug('queueOrSendPickedAsset validation failed', {
        asset: describeAsset(normalizedAsset),
        chatId,
        reason: validationError.reason,
      });
      Alert.alert('Erreur', validationError.userMessage);
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
        quality: 0.8,
        selectionLimit: 1,
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
        Alert.alert('Erreur', response.errorMessage || 'Erreur lors de la selection');
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
      logAttachmentDebug('handlePickMedia exception', {
        error: error?.message || error,
        responseData: error?.response?.data,
        responseStatus: error?.response?.status,
      });
      conversationLogger.warn('Media picker failed', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la galerie.');
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
        Alert.alert(
          t('common.error', 'Erreur'),
          t('permissions.camera.denied', 'Permission caméra refusée'),
        );
        return false;
      }
      return true;
    } catch (error) {
      conversationLogger.warn('Camera permission request failed', error);
      Alert.alert('Erreur', 'Impossible de vérifier la permission caméra.');
      return false;
    }
  }, [t]);

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
        quality: 0.8,
        saveToPhotos: false,
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
        Alert.alert('Erreur', response.errorMessage || 'Impossible d\'ouvrir la camera');
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
      logAttachmentDebug('handleTakePhoto exception', {
        error: error?.message || error,
        responseData: error?.response?.data,
        responseStatus: error?.response?.status,
      });
      conversationLogger.warn('Camera open failed', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
    }
  };

  const handlePickFile = async () => {
    if (isDocumentPickerDisabled) {
      Alert.alert('Fichier indisponible', 'Le sélecteur de fichier est temporairement desactive sur cette build.');
      return;
    }

    const documentPicker = getDocumentPickerModule();
    if (!documentPicker?.pick || typeof documentPicker.pick !== 'function') {
      Alert.alert('Erreur', 'Le sélecteur de fichier est indisponible sur cette build.');
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
        Alert.alert('Erreur', 'Impossible de récupérer ce fichier.');
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
      Alert.alert('Erreur', 'Impossible de sélectionner un fichier.');
    }
  };

  const appendEditAttachmentsFromAsset = useCallback(async (selectedAsset) => {
    const normalizedAsset = normalizePickedAsset(selectedAsset || {});
    const validationError = validateAttachmentAsset(normalizedAsset);
    if (validationError) {
      Alert.alert('Erreur', validationError.userMessage);
      return;
    }
    if (!normalizedAsset?.uri) {
      Alert.alert('Erreur', 'Impossible de lire ce fichier.');
      return;
    }

    setIsEditMessageUploadingAttachment(true);
    try {
      const uploadedFiles = await uploadAttachmentAsset(normalizedAsset);
      if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
        Alert.alert('Erreur', "Impossible d'ajouter cette pièce jointe.");
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
      Alert.alert('Erreur', buildAttachmentUploadErrorMessage(error));
    } finally {
      setIsEditMessageUploadingAttachment(false);
    }
  }, [
    buildAttachmentUploadErrorMessage,
    normalizePickedAsset,
    uploadAttachmentAsset,
    validateAttachmentAsset,
  ]);

  const handleEditPickMedia = useCallback(async () => {
    try {
      const response = await launchImageLibrary({
        includeBase64: false,
        mediaType: 'mixed',
        quality: 0.8,
        selectionLimit: 1,
      });

      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert('Erreur', response.errorMessage || 'Erreur lors de la selection');
        return;
      }

      const selectedAsset = response.assets?.[0];
      if (!selectedAsset) return;
      await appendEditAttachmentsFromAsset(selectedAsset);
    } catch (error) {
      conversationLogger.warn('Edit media picker failed', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la galerie.');
    }
  }, [appendEditAttachmentsFromAsset]);

  const handleEditTakePhoto = useCallback(async () => {
    try {
      const hasCameraPermission = await ensureCameraPermission();
      if (!hasCameraPermission) return;

      const response = await launchCamera({
        cameraType: 'back',
        includeBase64: false,
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: false,
      });

      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert('Erreur', response.errorMessage || 'Impossible d\'ouvrir la camera');
        return;
      }

      const selectedAsset = response.assets?.[0];
      if (!selectedAsset) return;
      await appendEditAttachmentsFromAsset(selectedAsset);
    } catch (error) {
      conversationLogger.warn('Edit camera failed', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
    }
  }, [appendEditAttachmentsFromAsset, ensureCameraPermission]);

  const handleEditPickFile = useCallback(async () => {
    if (isDocumentPickerDisabled) {
      Alert.alert('Fichier indisponible', 'Le sélecteur de fichier est temporairement desactive sur cette build.');
      return;
    }

    const documentPicker = getDocumentPickerModule();
    if (!documentPicker?.pick || typeof documentPicker.pick !== 'function') {
      Alert.alert('Erreur', 'Le sélecteur de fichier est indisponible sur cette build.');
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
        Alert.alert('Erreur', 'Impossible de récupérer ce fichier.');
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
      Alert.alert('Erreur', 'Impossible de sélectionner un fichier.');
    }
  }, [appendEditAttachmentsFromAsset]);

  const handleSubmitEditMessage = async () => {
    if (!selectedMessageDocumentId || !canEditSelectedMessage) return;

    const payloadAttachments = toEditAttachmentPayload(editMessageAttachments);
    const normalizedMessage = String(editMessageText || '');
    if (!normalizedMessage.trim() && payloadAttachments.length === 0) {
      Alert.alert('Erreur', 'Le message ne peut pas être vide.');
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
      Alert.alert('Erreur', 'Impossible de modifier ce message.');
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
        'Connexion messagerie indisponible. Reessayez dans quelques secondes.',
      ));
    }

    setIsPollModalVisible(false);
  }, [chatId, sendMessage, t, userData]);

  const parseCoordinatesFromOption = (option) => {
    const rawValue = String(option?.value || '');
    const [lngRaw, latRaw] = rawValue.split('|');
    const lat = Number(latRaw);
    const lng = Number(lngRaw);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { lat: null, lng: null };
    }

    return { lat, lng };
  };

  const resolveEventLocationLabel = useCallback((event) => {
    const fallback = event?.location?.label || event?.facility?.address || event?.facility?.name || '';
    if (!event?.locationDetails) return fallback;

    try {
      const parsed = JSON.parse(event.locationDetails);
      const parsedLabel = parsed?.address?.description || parsed?.address?.label || parsed?.address?.address;
      return parsedLabel || fallback;
    } catch (_error) {
      return fallback;
    }
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
    const selectedContact = shareableContacts.find((contact) => contact.documentId === selectedContactId);
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

  const handleShareEvent = useCallback((event, options = {}) => {
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
              .map((activity) => ({ name: activity?.name || '' }))
              .filter((activity) => activity?.name)
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

  const resolveMessageEventPayload = useCallback((message) => {
    const eventPayload = message?.event;
    if (eventPayload && typeof eventPayload === 'object') {
      const eventDocumentId = String(eventPayload?.documentId || eventPayload?.id || '').trim();
      if (eventDocumentId) {
        sharedEventPreviewByIdRef.current.set(eventDocumentId, eventPayload);
      }
      return eventPayload;
    }

    const eventDocumentId = String(eventPayload || '').trim();
    if (eventDocumentId) {
      const cachedEvent = sharedEventPreviewByIdRef.current.get(eventDocumentId);
      if (cachedEvent) return cachedEvent;
    }

    const composition = message?.composition;
    if (composition?.type !== 'event_share') return null;

    const compositionEventPreview = composition?.eventPreview;
    if (compositionEventPreview && typeof compositionEventPreview === 'object') {
      const previewDocumentId = String(
        compositionEventPreview?.documentId
        || composition?.eventDocumentId
        || '',
      ).trim();
      if (previewDocumentId) {
        sharedEventPreviewByIdRef.current.set(previewDocumentId, compositionEventPreview);
      }
      return compositionEventPreview;
    }

    const compositionEventDocumentId = String(composition?.eventDocumentId || '').trim();
    if (!compositionEventDocumentId) return null;

    const fallbackEvent = {
      date: composition?.eventDate || null,
      documentId: compositionEventDocumentId,
      locationDetails: composition?.locationLabel || '',
      name: composition?.eventName || 'Événement',
      team: composition?.teamName ? { name: composition?.teamName } : null,
      type: { name: 'Événement' },
    };
    sharedEventPreviewByIdRef.current.set(compositionEventDocumentId, fallbackEvent);
    return fallbackEvent;
  }, []);

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
      Alert.alert('Nom requis', 'Entrez un nom de groupe valide.');
      return;
    }

    try {
      setIsGroupMutationLoading(true);
      await updateGroupMeta({
        chatId,
        data: { groupName: nextGroupName },
      });
      Alert.alert('Succès', 'Nom du groupe mis à jour.');
    } catch (error) {
      conversationLogger.warn('Failed to update group name', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le nom du groupe.');
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

  const handleRemoveGroupMember = (member) => {
    const memberId = String(member?.documentId || member?.id || '').trim();
    if (!chatId || !memberId) return;

    const memberLabel = `${member?.firstname || ''} ${member?.lastname || ''}`.trim() || 'ce membre';
    Alert.alert(
      'Retirer un membre',
      `Retirer ${memberLabel} du groupe ?`,
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: async () => {
            try {
              setIsGroupMutationLoading(true);
              await removeGroupMember({
                chatId,
                userId: memberId,
              });
            } catch (error) {
              conversationLogger.warn('Failed to remove group member', error);
              Alert.alert('Erreur', 'Impossible de retirer ce membre.');
            } finally {
              setIsGroupMutationLoading(false);
            }
          },
          style: 'destructive',
          text: 'Retirer',
        },
      ],
    );
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
      Alert.alert(
        t('conversation.voice.unavailableTitle', 'Vocal indisponible'),
        t('conversation.voice.unavailableDescription', 'Le module vocal n\'est pas disponible sur cette build.'),
      );
      return;
    }

    if (voiceRecordingStateRef.current !== VOICE_RECORDING_STATES.idle) return;
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
    } catch (error) {
      const code = String(error?.message || '');
      if (code === 'VOICE_ALREADY_RECORDING') return;
      conversationLogger.warn('Failed to start voice recording', error);
      setVoiceRecordingState(VOICE_RECORDING_STATES.error);
      if (code === 'VOICE_MODULE_UNAVAILABLE') {
        Alert.alert(
          t('conversation.voice.unavailableTitle', 'Vocal indisponible'),
          t('conversation.voice.unavailableDescription', 'Le module vocal n\'est pas disponible sur cette build.'),
        );
      } else {
        Alert.alert(
          t('conversation.voice.permissionTitle', 'Micro requis'),
          t('conversation.voice.permissionDescription', 'Autorisez le micro pour envoyer des notes vocales.'),
        );
      }
      resetVoiceRecordingState();
    }
  }, [canRecordVoiceNote, chatId, pendingVoiceDraft?.uri, resetVoiceRecordingState, stopDraftVoicePlayback, t]);

  const handleCancelVoiceRecording = useCallback(async () => {
    if (voiceRecordingStateRef.current === VOICE_RECORDING_STATES.idle) return;

    try {
      await cancelRecording();
    } catch (_error) {
      // No-op cleanup.
    }
    resetVoiceRecordingState();
  }, [resetVoiceRecordingState]);

  const handleStopVoiceRecordingToDraft = useCallback(async () => {
    if (!chatId || !isVoiceRecording) return;

    try {
      setVoiceRecordingState(VOICE_RECORDING_STATES.sending);
      const draft = await stopRecording();

      if (!draft?.uri) {
        throw new Error('VOICE_EMPTY');
      }
      if ((draft?.durationMs || 0) < 500) {
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
        durationMs: normalizedDurationMs,
        fileName: draft?.fileName || `voice-note-${Date.now()}.m4a`,
        mime: draft?.mime || 'audio/mp4',
        size: Math.max(0, Number(draft?.size) || 0),
        uri: draft.uri,
        waveform: normalizedWaveform,
      });

      setVoiceRecordingHint(t('conversation.voice.draftReadyHint', 'Note vocale prête. Ajoutez un message puis envoyez.'));
      resetVoiceRecordingState();
    } catch (error) {
      conversationLogger.warn('Failed to finalize voice note draft', error);
      setVoiceRecordingState(VOICE_RECORDING_STATES.error);
      const code = String(error?.message || '');
      let errorMessage = t(
        'conversation.voice.sendErrorDescription',
        'Impossible d\'envoyer la note vocale. Réessayez.',
      );
      if (code === 'VOICE_STOP_FAILED') {
        errorMessage = t(
          'conversation.voice.stopErrorDescription',
          'Impossible de finaliser l\'enregistrement vocal. Réessayez.',
        );
      } else if (code === 'VOICE_FILE_EMPTY') {
        errorMessage = t(
          'conversation.voice.emptyErrorDescription',
          'Aucun son exploitable n\'a été capturé. Réessayez.',
        );
      }
      Alert.alert(
        t('conversation.voice.sendErrorTitle', 'Envoi impossible'),
        errorMessage,
      );
      resetVoiceRecordingState();
    }
  }, [
    chatId,
    isVoiceRecording,
    resetVoiceRecordingState,
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
        setVoiceRecordingHint(t('conversation.voice.lockedHint', 'Enregistrement verrouillé. Touchez envoyer ou annuler.'));
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

  const openSharedContact = (userDocumentId) => {
    if (!userDocumentId) return;
    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: userDocumentId },
      screen: RouteNames.UserDetails,
    });
  };

  const openSharedEvent = (eventDocumentId) => {
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
      setTimeout(openMenu, Platform.OS === 'ios' ? 120 : 170);
      return;
    }

    openMenu();
  }, [isAttachmentMenuVisible]);

  const attachmentSheetActions = useMemo(() => {
    let contactReason = '';
    if (!isContactShareEnabled) {
      contactReason = t('conversation.attachments.unavailable', 'Bientot disponible');
    } else if (shareableContacts.length === 0) {
      contactReason = t('conversation.attachments.noContact', 'Aucun contact partageable');
    }

    const documentReason = isDocumentPickerDisabled
      ? t('conversation.attachments.documentDisabled', 'Indisponible sur cette build')
      : '';
    const eventReason = !isEventShareEnabled
      ? t('conversation.attachments.unavailable', 'Bientot disponible')
      : '';
    const locationReason = !isLocationShareEnabled
      ? t('conversation.attachments.unavailable', 'Bientot disponible')
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

  const handleAttachmentSheetAction = (actionKey) => {
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
  const handleSendProposal = async (/** @type {any} */ proposalData) => {
    try {
      const proposalStartDate = new Date(proposalData.date);
      const proposalEndDate = proposalData.endDate
        ? new Date(proposalData.endDate)
        : new Date(proposalStartDate.getTime() + (60 * 60 * 1000));
      const matchId = getEntityDocumentId(chatData?.league_match);
      const addressLabel = typeof proposalData?.address === 'string'
        ? proposalData.address
        : proposalData?.addressObject?.label
              || proposalData?.addressObject?.address
              || null;
      const nextLocation = {
        ...(chatData?.league_match?.location && typeof chatData.league_match.location === 'object'
          ? chatData.league_match.location
          : {}),
        ...(proposalData?.addressObject && typeof proposalData.addressObject === 'object'
          ? proposalData.addressObject
          : {}),
        ...(addressLabel ? { address: addressLabel, label: addressLabel } : {}),
        proposed_end_time: proposalEndDate.toISOString(),
      };

      if (matchId) {
        await updateMatch(matchId, {
          location: nextLocation,
          proposed_time: proposalStartDate.toISOString(),
          proposed_venue: proposalData.venue,
        });
      }

      // Construct the message content
      const messageText = 'Nouvelle proposition de match';
      const proposalComposition = {
        address: addressLabel,
        addressObject: nextLocation,
        date: proposalStartDate.toISOString(),
        endDate: proposalEndDate.toISOString(),
        matchId,
        status: 'pending',
        type: 'proposal',
        venue: proposalData.venue,
      };

      // Send message
      await sendMessage(chatId, messageText, {
        composition: proposalComposition,
        sender: userData,
      });

      Alert.alert('Envoyé', 'Votre proposition a été envoyée !');
    } catch (error) {
      conversationLogger.error('Send proposal failed', error);
      Alert.alert('Erreur', "Impossible d'envoyer la proposition.");
    }
  };

  const handleRespondProposal = async (/** @type {any} */ message, /** @type {string} */ status) => {
    const matchId = message?.composition?.matchId || getEntityDocumentId(chatData?.league_match);

    if (!matchId && status === 'accepted') {
      // If matchId is missing in composition, try fallback to chat's match
      if (!chatData?.league_match) {
        Alert.alert('Erreur', 'Impossible de retrouver le match associé.');
        return;
      }
    }

    // Optimistic update of the message bubble
    const updatedComposition = { ...message.composition, status };

    // Update local cache immediately (Optimistic)
    queryClient.setQueryData(['chat-messages', chatId], (/** @type {any} */ oldData) => {
      if (!oldData?.pages) return oldData;
      const targetMessageId = String(message.documentId || message._id || message.id || '');
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
      if (status === 'accepted') {
        conversationLogger.debug('Accepting match proposal', { matchId });
        await confirmMatch(matchId);
        await respondToProposal(
          String(message.documentId || message._id || message.id || ''),
          'accepted',
        );
        Alert.alert('Match confirmé', 'Le match est validé !');
        promptAddMatchToCalendar(message);
      } else {
        await respondToProposal(
          String(message.documentId || message._id || message.id || ''),
          'declined',
        );
        conversationLogger.debug('Proposal declined');
      }

      // Invalidate to refresh match status elsewhere
      queryClient.invalidateQueries({ queryKey: ['league-matches'] });
    } catch (error) {
      conversationLogger.error('Proposal action failed', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la réponse.');
      // Rollback could go here
    }
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

    if (areSameEntityId(teamA?.captain?.documentId, userId)) {
      teamId = getEntityDocumentId(teamA);
    } else if (areSameEntityId(teamB?.captain?.documentId, userId)) {
      teamId = getEntityDocumentId(teamB);
    } else {
      teamId = userData?.team?.documentId || null;
    }

    if (!teamId) {
      Alert.alert('Erreur', "Impossible d'identifier votre équipe pour l'annulation.");
      return;
    }

    Alert.alert(
      'Annuler le match ?',
      'Cette action annulera le match et supprimera la conversation.',
      [
        { style: 'cancel', text: 'Non' },
        {
          onPress: async () => {
            try {
              const resolvedTeamId = teamId;
              if (!resolvedTeamId) return;
              conversationLogger.debug('Cancelling match', { matchId, teamId: resolvedTeamId });
              await cancelMatch(matchId, resolvedTeamId, 'Demande capitaine');
              navigation.goBack();
            } catch (error) {
              conversationLogger.error('Cancel match failed', error);
              Alert.alert('Erreur', "Impossible d'annuler le match.");
            }
          },
          style: 'destructive',
          text: 'Oui, annuler',
        },
      ],
    );
  };

  // Calculate title for Custom Header
  // Calculate title for Custom Header
  const title = useMemo(() => {
    let displayTitle = route.params?.title;
    if (!displayTitle && chatData?.type === 'league_match') {
      const matchDate = chatData?.league_match?.date;
      const dateDisplay = matchDate
        ? new Date(matchDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        : '?';
      displayTitle = `Match ${dateDisplay}`;
    } else if (!displayTitle) {
      displayTitle = getConversationName({
        chatClub: chatData?.club,
        chatGroupName: chatData?.groupName,
        chatMultisportClub: chatData?.multisportClub,
        chatParticipants: chatData?.participants,
        chatTeam: chatData?.team,
        chatType: chatData?.type || '',
        meId: userData?.documentId,
      }) || t('common.chat');
    }
    return displayTitle;
  }, [chatData, route.params, getConversationName, userData, t]);

  const subtitle = route.params?.subTitle || '';
  const proposalDefaults = useMemo(
    () => buildProposalDefaultsFromMatch(chatData?.league_match || null),
    [chatData?.league_match],
  );

  const isLeagueConversation = chatData?.type === 'league_match';
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
    const isMyTeamMember = myTeamMembers.some((m) => m.documentId === sender?.documentId);

    if (isMyTeamMember) {
      // Show real name for teammates
      return `${sender?.firstname || ''} ${sender?.lastname || ''}`;
    }

    // This is an opponent - anonymize
    const isCaptain = areSameEntityId(chatData?.league_match?.team_a?.captain?.documentId, sender?.documentId)
      || areSameEntityId(chatData?.league_match?.team_b?.captain?.documentId, sender?.documentId);

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
      chatData.participants.forEach((participant) => registerUser(participant));
    }

    if (Array.isArray(messagesPages?.pages)) {
      messagesPages.pages.forEach((page) => {
        if (!Array.isArray(page?.data)) return;
        page.data.forEach((msg) => registerUser(msg?.sender));
      });
    }

    return directory;
  }, [chatData?.participants, messagesPages?.pages, userData]);

  const resolveVoterName = (/** @type {string} */ voterId) => {
    if (!voterId) return 'Membre';
    return voterNameDirectory.get(String(voterId)) || 'Membre';
  };

  const messages = useMemo(() => (messagesPages ? messagesPages?.pages?.reduce((acc, page) => {
    const formattedMessages = page.data.map((msg) => {
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

      return {
        _id: msg.id,
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
        text: msg.message,
        user: {
          _id: msg.sender?.documentId || '',
          avatar: avatarUrl,
          name: getAnonymizedName(msg.sender),
        },
      };
    });
    return [...acc, ...formattedMessages];
  }, /** @type {import('react-native-gifted-chat').IMessage[]} */ ([])) : []), [messagesPages, getAnonymizedName, getPrimaryImageUriFromMessage, isImageAttachmentMessage, logAttachmentDebug, normalizeMessageAttachments, resolveMediaUri]);

  const latestMessageId = String(
    messages?.[0]?.documentId
    || messages?.[0]?._id
    || '',
  ).trim();

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

  const clearPendingMediaDraft = () => {
    setPendingMediaDraft(null);
  };

  const clearPendingVoiceDraft = () => {
    stopDraftVoicePlayback().catch(() => {});
    setPendingVoiceDraft(null);
  };

  const sendPendingVoiceDraft = async () => {
    if (uploadInFlightRef.current) {
      logAttachmentDebug('sendPendingVoiceDraft skipped: upload already in progress', { chatId });
      return;
    }

    if (!pendingVoiceDraft?.uri || !chatId) return;

    try {
      uploadInFlightRef.current = true;
      setIsUploading(true);
      const uploadedFiles = await uploadAttachmentAsset({
        fileName: pendingVoiceDraft.fileName || `voice-note-${Date.now()}.m4a`,
        type: pendingVoiceDraft.mime || 'audio/mp4',
        uri: pendingVoiceDraft.uri,
      });

      if (!uploadedFiles.length) {
        throw new Error('VOICE_UPLOAD_FAILED');
      }

      const optimisticMessageId = sendMessage(chatId, String(composerText || '').trim(), {
        attachments: uploadedFiles,
        composition: {
          durationMs: pendingVoiceDraft.durationMs || 0,
          mime: pendingVoiceDraft.mime || uploadedFiles?.[0]?.mime || 'audio/mp4',
          size: pendingVoiceDraft.size || uploadedFiles?.[0]?.size || 0,
          type: 'voice_note',
          version: 1,
          waveform: pendingVoiceDraft.waveform || [],
        },
        replyTo: replyingTo ? { documentId: replyingTo.documentId } : null,
        sender: userData,
      });
      if (!optimisticMessageId) {
        throw new Error('VOICE_SOCKET_UNAVAILABLE');
      }

      clearPendingVoiceDraft();
      setReplyingTo(null);
      setComposerText('');
      sendTypingStop(chatId);
    } catch (error) {
      conversationLogger.warn('Failed to send pending voice draft', error);
      const detailedMessage = buildAttachmentUploadErrorMessage(error);
      Alert.alert(
        t('conversation.voice.sendErrorTitle', 'Envoi impossible'),
        detailedMessage || t('conversation.voice.sendErrorDescription', "Impossible d'envoyer la note vocale. Réessayez."),
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

    logAttachmentDebug('sendPendingMediaDraft start', {
      asset: describeAsset(pendingMediaDraft.asset),
      captionLength: String(composerText || '').trim().length,
      chatId,
      hasReplyTo: Boolean(replyingTo?.documentId),
      socketConnected: Boolean(isSocketConnected),
    });

    const sent = await uploadAndSendAttachment(pendingMediaDraft.asset, {
      caption: composerText,
      replyTo: replyingTo ? { documentId: replyingTo.documentId } : null,
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
    sendTypingStop(chatId);
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

    msgs.forEach((msg) => {
      if (chatId) {
        sendMessage(chatId, msg.text, {
          replyTo: replyingTo ? { documentId: replyingTo.documentId } : null,
          sender: userData, // for optimistic
        });
        sendTypingStop(chatId);
      }
    });
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

    queryClient.setQueryData(['chat-messages', chatId], (/** @type {any} */ oldData) => {
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
      Alert.alert(
        t('common.error', 'Erreur'),
        t('conversation.poll.errors.voteSave', 'Impossible de sauvegarder ce vote.'),
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
      Alert.alert(
        t('conversation.actions.copySuccess.title', 'Copié'),
        t('conversation.actions.copySuccess.description', 'Le message a été copié.'),
      );
    } else {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('conversation.actions.copyUnavailable', 'Le presse-papiers est indisponible sur cette build.'),
      );
    }
    setIsMessageActionsVisible(false);
  }, [canCopySelectedMessage, selectedMessageTextValue, t]);

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

  const toEditAttachmentPayload = useCallback((attachments) => (
    (Array.isArray(attachments) ? attachments : [])
      .map((attachment) => {
        const numericId = Number(attachment?.id);
        if (Number.isInteger(numericId) && numericId > 0) return { id: numericId };
        const attachmentDocumentId = String(attachment?.documentId || '').trim();
        if (attachmentDocumentId) return { documentId: attachmentDocumentId };
        return null;
      })
      .filter(Boolean)
  ), []);

  const handleDeleteSelectedMessage = useCallback(() => {
    if (!selectedMessageDocumentId || !isSelectedMessageOwn) return;

    Alert.alert(
      t('conversation.actions.deleteConfirm.title', 'Supprimer le message'),
      t('conversation.actions.deleteConfirm.description', 'Ce message sera supprime pour tous les participants.'),
      [
        {
          style: 'cancel',
          text: t('common.actions.cancel', 'Annuler'),
        },
        {
          onPress: async () => {
            try {
              await deleteMessage(selectedMessageDocumentId);
              setIsMessageActionsVisible(false);
              setIsEditMessageModalVisible(false);
              setSelectedMessage(undefined);
              resetEditMessageState();
            } catch (error) {
              Alert.alert(
                t('common.error', 'Erreur'),
                t('conversation.actions.deleteError', 'Impossible de supprimer ce message.'),
              );
            }
          },
          style: 'destructive',
          text: t('common.actions.delete', 'Supprimer'),
        },
      ],
    );
  }, [deleteMessage, isSelectedMessageOwn, resetEditMessageState, selectedMessageDocumentId, t]);

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
              right: { ...Fonts.p3, color: Colors.primary200 },
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
          right: [Fonts.p3, Fonts.primary200],
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
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>â†©</Text>
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
              onDecline={() => {}}
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

      if (currentMessage.composition.type === 'proposal') {
        return wrapWithMessageInteractions(
          currentMessage, (
            <View style={{ marginBottom, marginTop }}>
              <ProposalMessageBubble
                isMe={!isLeft}
                onAccept={() => handleRespondProposal(currentMessage, 'accepted')}
                onDecline={() => handleRespondProposal(currentMessage, 'declined')}
                proposal={currentMessage.composition}
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
            <View style={{ marginBottom, marginTop }}>
              <VoiceNoteBubble
                attachments={currentMessage.attachments || []}
                composition={currentMessage.composition}
                isMe={!isLeft}
              />
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
              const tickColor = 'rgba(255,255,255,0.8)';
              if (bubbleMessage.readBy && bubbleMessage.readBy.length > 0) {
                return <Text style={{ color: tickColor, fontSize: 10, fontWeight: 'bold' }}>vv</Text>;
              }
              return <Text style={{ color: tickColor, fontSize: 10 }}>v</Text>;
            }}
            renderTime={renderTime}
            textStyle={{
              left: [Fonts.p1, { color: Colors.neutral00 }], // White text for dark bubble
              right: [Fonts.p1, Fonts.neutral00],
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

    // Whisper, Team, and League Match chats: All participants can write
    if (chatData.type === 'whisper' || chatData.type === 'team' || chatData.type === 'league_match') return true;

    // Club Chat: Only Club Admins can write
    if (chatData.type === 'club') {
      const userIsAdmin = userData.role?.type === 'dirigeant' && userData.club?.documentId === chatData.club?.documentId;
      return userIsAdmin;
    }

    // Multisport Chat: Only Multisport Admins can write
    if (chatData.type === 'multisport') {
      const admins = chatData.multisportClub?.admins || [];
      const isMultisportAdmin = admins.some((admin) => admin.documentId === userData.documentId);
      return isMultisportAdmin;
    }

    return false;
  }, [chatData, userData]);

  /**
   * Render custom actions (attachment buttons)
   * @returns {React.ReactNode} Rendered actions component
   */
  const renderActions = () => (
    <View style={{ alignItems: 'center', flexDirection: 'row', height: 44 }}>
      {isLeagueConversation ? (
        <TouchableOpacity
          onPress={() => setIsProposalModalVisible(true)}
          style={{
            alignItems: 'center',
            backgroundColor: Colors.gold500,
            borderRadius: 16,
            height: 32,
            justifyContent: 'center',
            marginHorizontal: 4,
            width: 32,
          }}
        >
          <Text style={{ fontSize: 16 }}>{'\uD83E\uDD1D'}</Text>
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
        <View style={{
          backgroundColor: 'white', height: 2, position: 'absolute', width: 16,
        }}
        />
        <View style={{
          backgroundColor: 'white', height: 16, position: 'absolute', width: 2,
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
            Spaces.padding[10],
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
              <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                {t('conversation.attachments.previewTitle', 'Photo prête à envoyer')}
              </Text>
              <Text
                numberOfLines={2}
                style={[Fonts.p4, { color: Colors.neutral400 }]}
              >
                {composerText?.trim()
                  ? t('conversation.attachments.previewWithCaption', 'La légende sera envoyée avec la photo.')
                  : t('conversation.attachments.previewWithoutCaption', "Ajoutez une légende puis confirmez l'envoi.")}
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
            Spaces.padding[10],
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            { borderRadius: 14 },
          ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                {isVoiceRecordingLocked
                  ? t('conversation.voice.locked', 'Note vocale verrouillée')
                  : t('conversation.voice.recording', 'Enregistrement vocal')}
              </Text>
              <Text
                numberOfLines={2}
                style={[Fonts.p4, { color: Colors.neutral400 }]}
              >
                {isSendingVoiceNote
                  ? t('conversation.voice.sending', 'Envoi en cours...')
                  : `${formatDurationLabel(voiceRecordingDurationMs)} - ${voiceRecordingHint || t('conversation.voice.hintShort', 'Maintenez appuyé pour enregistrer')}`}
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
            Spaces.padding[10],
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
                <Text style={[Fonts.p4Bold, { color: isDraftVoicePlaying ? Colors.neutral00 : Colors.primary500 }]}>
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
                : t('conversation.voice.draftWithoutText', 'Ajoutez un message optionnel puis appuyez sur Envoyer.')}
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
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                Repondre a
                {' '}
                {replyingTo.user?.name}
              </Text>
              <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral500]}>{replyingTo.text}</Text>
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
    let voiceButtonOpacity = canRecordVoiceNote ? 1 : 0.6;
    if (canRecordVoiceNote) {
      voiceButtonBackgroundColor = Colors.primary500;
      voiceButtonBorderColor = Colors.primary200;
    }
    if (isVoiceRecording) {
      voiceButtonBackgroundColor = Colors.error500;
      voiceButtonBorderColor = Colors.error700;
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
              <ActivityIndicator color={Colors.neutral00} size="small" />
            ) : (
              <MicrophoneGlyph color={Colors.neutral00} />
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
          {isUploading ? (
            <ActivityIndicator color={Colors.neutral00} size="small" />
          ) : (
            <Image
              source={Images.send}
              style={{
                height: 16,
                tintColor: Colors.neutral00,
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

    setTimeout(() => {
      if (typeof listRef.scrollToIndex !== 'function') return;
      listRef.scrollToIndex({
        animated: true,
        index: info.index,
        viewPosition: 0.4,
      });
    }, 120);
  }, []);

  return (
    <ImageBackground
      resizeMode="cover"
      source={Images.bg2}
      style={[Alignments.fill]}
    >
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />

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
                setTimeout(() => {
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
                setTimeout(() => {
                  Alert.alert('Signaler', 'Pour signaler ce match ou cet utilisateur, veuillez contacter le support via les paramètres.');
                }, 300);
              }}
              title={t('conversation.actions.report', 'Signaler')}
              variant="SecondaryLight"
            />

            <Button
              onPress={() => setIsMenuVisible(false)}
              title={t('common.cancel', 'Fermer')}
              variant="PrimaryLight"
            />
          </View>
        </BottomModal>

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
              subtitle={t('conversation.attachments.subtitle', 'Partagez du contenu dans cette conversation')}
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
          <View style={[Spaces.gap[12], Spaces.marginTop[20], Spaces.marginBottom[8]]}>
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
                {t('conversation.actions.editModal.attachments', 'Pieces jointes')}
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
          createEventParticipationMutation={createEventParticipationMutation}
          eventId={selectedEvent?.documentId || ''}
          isVisible={isJoinModalVisible}
          onClose={handleCloseJoinModal}
        />

        <VenueProposalModal
          initialDate={proposalDefaults.date}
          initialEndTime={proposalDefaults.end}
          initialStartTime={proposalDefaults.start}
          isVisible={isProposalModalVisible}
          onClose={() => setIsProposalModalVisible(false)}
          onSend={handleSendProposal}
          onSkip={() => setIsProposalModalVisible(false)}
        />
      </View>
    </ImageBackground>
  );
}

export default Conversation;
