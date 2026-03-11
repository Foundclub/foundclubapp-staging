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
  Linking,
  Modal,
  PanResponder,
  PermissionsAndroid,
  Platform,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Bubble,
  Composer,
  GiftedChat,
  InputToolbar,
  Time,
} from 'react-native-gifted-chat';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getAuthTokens } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import CompositionMessageBubble from '@/components/molecules/compositionMessageBubble/CompositionMessageBubble';
import ContactShareBubble from '@/components/molecules/contactShareBubble/ContactShareBubble';
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
const isAttachmentDebugEnabled = isFlagEnabled(process.env.FC_CHAT_ATTACHMENT_DEBUG, true);

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
  const { allMyTeams, userData } = useAuth();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
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
      'Match confirme',
      'Ajouter ce match a votre agenda ?',
      [
        { style: 'cancel', text: 'Plus tard' },
        {
          onPress: async () => {
            const text = encodeURIComponent('Match FoundClub League');
            const details = encodeURIComponent('Match confirme depuis la messagerie League');
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

  /* import deleteMessage from useMessaging hook */
  const {
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
    conversationLogger.warn(`[attachment-debug] ${message}`, meta);
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

  /**
   * Handle message long press event to show actions modal
   * @param {any} _
   * @param {import('react-native-gifted-chat').IMessage
   * & {documentId: string}} currentMessage - The message object
   * @returns {void}
   */
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isGroupManagementVisible, setIsGroupManagementVisible] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [isGroupMutationLoading, setIsGroupMutationLoading] = useState(false);
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

  const myTeamIds = useMemo(
    () => Array.from(
      new Set(
        (allMyTeams || [])
          .map((team) => team?.documentId)
          .filter(Boolean),
      ),
    ),
    [allMyTeams],
  );

  const {
    data: sharedEventsPages,
    isFetching: isLoadingSharedEvents,
  } = useGetEvents(
    {
      myTeams: myTeamIds,
      pageSize: 20,
      sort: 'date:asc',
    },
    {
      enabled: isEventShareEnabled && myTeamIds.length > 0,
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

  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceRecordingLocked, setIsVoiceRecordingLocked] = useState(false);
  const [isSendingVoiceNote, setIsSendingVoiceNote] = useState(false);
  const [voiceRecordingDurationMs, setVoiceRecordingDurationMs] = useState(0);
  const [voiceRecordingHint, setVoiceRecordingHint] = useState('');
  const loggedAttachmentShapeMessageIdsRef = useRef(new Set());
  const isVoiceRecordingRef = useRef(false);
  const isVoiceRecordingLockedRef = useRef(false);

  // Event Participation Logic
  const queryClient = useQueryClient();
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(/** @type {{ documentId?: string; team?: Team } | undefined} */ (undefined));

  useEffect(() => {
    isVoiceRecordingRef.current = isVoiceRecording;
  }, [isVoiceRecording]);

  useEffect(() => {
    isVoiceRecordingLockedRef.current = isVoiceRecordingLocked;
  }, [isVoiceRecordingLocked]);

  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onError: (error) => {
      Alert.alert(t('common.error'), error.message || t('common.errorOccurred'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
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
    if (isVoiceRecordingRef.current || isVoiceRecordingLockedRef.current) {
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
        if (Platform.OS === 'android' && attempt === 1) {
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
        const errorMessage = rawErrorMessage.toLowerCase();
        const hasHttpResponse = typeof error === 'object'
          && error !== null
          && Boolean(error?.response);
        const errorCode = typeof error === 'object' && error !== null
          ? error?.code
          : undefined;
        const responseStatus = typeof error === 'object' && error !== null
          ? error?.response?.status
          : undefined;
        const isTransientNetworkError = !hasHttpResponse
          && (
            errorMessage.includes('network error')
            || errorMessage.includes('network request failed')
            || errorMessage.includes('failed to fetch')
            || errorCode === 'ECONNABORTED'
          );
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

        if (isTransientNetworkError) {
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
  }, [chatId, describeAsset, describeUploadItems, isSocketConnected, logAttachmentDebug, uploadAttachmentAssetWithFetch]);

  const uploadAndSendAttachment = async (
    /** @type {{ fileName?: string; type?: string; uri?: string | null }} */ asset,
    /** @type {{ caption?: string; replyTo?: { documentId?: string } | null }} */ options = {},
  ) => {
    if (!asset?.uri || !chatId) {
      logAttachmentDebug('uploadAndSendAttachment skipped: missing asset uri or chatId', {
        asset: describeAsset(asset),
        chatId,
      });
      return false;
    }

    try {
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
        Alert.alert('Erreur', 'Aucune piece jointe n a pu etre envoyee.');
        return false;
      }

      const uploadedMime = uploadedFiles?.[0]?.mime || asset.type || '';
      const uploadedName = uploadedFiles?.[0]?.name || asset.fileName || 'piece-jointe';
      const isImageAttachment = typeof uploadedMime === 'string'
        && uploadedMime.startsWith('image/');

      const normalizedCaption = String(options?.caption || '').trim();
      const fallbackText = isImageAttachment ? '' : `Piece jointe: ${uploadedName}`;
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
        Alert.alert('Erreur', 'Connexion messagerie indisponible. Reessayez dans quelques secondes.');
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
      Alert.alert('Erreur', 'Impossible d envoyer cette piece jointe.');
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const normalizePickedAsset = (
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
      type: safeType,
      uri: selectedAsset?.uri,
    };
  };

  const queueOrSendPickedAsset = async (
    /** @type {{ fileName?: string; type?: string; uri?: string | null }} */ selectedAsset,
  ) => {
    const normalizedAsset = normalizePickedAsset(selectedAsset);
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
      Alert.alert('Erreur', 'Impossible d ouvrir la galerie.');
    }
  };

  const ensureCameraPermission = async () => {
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
            'L application a besoin de la camera pour prendre une photo.',
          ),
          title: t('permissions.camera.title', 'Permission Camera'),
        },
      );

      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          t('common.error', 'Erreur'),
          t('permissions.camera.denied', 'Permission camera refusee'),
        );
        return false;
      }
      return true;
    } catch (error) {
      conversationLogger.warn('Camera permission request failed', error);
      Alert.alert('Erreur', 'Impossible de verifier la permission camera.');
      return false;
    }
  };

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
        Alert.alert('Erreur', response.errorMessage || 'Impossible d ouvrir la camera');
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
      Alert.alert('Fichier indisponible', 'Le selecteur de fichier est temporairement desactive sur cette build.');
      return;
    }

    const documentPicker = getDocumentPickerModule();
    if (!documentPicker?.pick || typeof documentPicker.pick !== 'function') {
      Alert.alert('Erreur', 'Le selecteur de fichier est indisponible sur cette build.');
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
        Alert.alert('Erreur', 'Impossible de recuperer ce fichier.');
        return;
      }

      await uploadAndSendAttachment({
        fileName: selectedFile.name || `file_${Date.now()}`,
        type: selectedFile.type || 'application/octet-stream',
        uri: selectedUri,
      });
    } catch (error) {
      if (isDocumentPickerCancellation(documentPicker, error)) return;
      conversationLogger.warn('Document picker failed', error);
      Alert.alert('Erreur', 'Impossible de selectionner un fichier.');
    }
  };

  const handleCreatePoll = () => {
    setIsPollModalVisible(true);
  };

  const handleSubmitPoll = async (/** @type {{ question: string; options: string[]; allowMultipleVotes: boolean; isAnonymous: boolean }} */ payload) => {
    const question = payload?.question?.trim() || '';
    const options = Array.isArray(payload?.options) ? payload.options : [];

    if (!question || options.length < 2) {
      throw new Error('Le sondage est incomplet.');
    }

    const now = Date.now();
    const pollComposition = {
      allowMultipleVotes: !!payload.allowMultipleVotes,
      createdAt: new Date(now).toISOString(),
      createdBy: userData?.documentId || '',
      isAnonymous: !!payload.isAnonymous,
      options: options.map((label, index) => ({
        id: `poll-option-${now}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        label,
        voteCount: 0,
        voters: [],
      })),
      pollId: `poll-${now}-${Math.random().toString(36).slice(2, 7)}`,
      question,
      type: 'poll',
    };

    if (!chatId) {
      throw new Error('Conversation introuvable.');
    }

    sendMessage(chatId, '', {
      composition: pollComposition,
      sender: userData,
    });
    setIsPollModalVisible(false);
  };

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

  const resolveEventLocationLabel = (event) => {
    const fallback = event?.location?.label || event?.facility?.address || event?.facility?.name || '';
    if (!event?.locationDetails) return fallback;

    try {
      const parsed = JSON.parse(event.locationDetails);
      const parsedLabel = parsed?.address?.description || parsed?.address?.label || parsed?.address?.address;
      return parsedLabel || fallback;
    } catch (_error) {
      return fallback;
    }
  };

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

  const handleShareEvent = (event) => {
    if (!chatId || !event?.documentId) return;

    const composition = {
      eventDate: event?.date || null,
      eventDocumentId: event.documentId,
      eventName: event?.name || 'Evenement',
      locationLabel: resolveEventLocationLabel(event),
      teamName: event?.team?.name || '',
      type: 'event_share',
    };

    sendMessage(chatId, '', {
      composition,
      sender: userData,
    });
    setIsEventShareModalVisible(false);
  };

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
      Alert.alert('Succes', 'Nom du groupe mis a jour.');
    } catch (error) {
      conversationLogger.warn('Failed to update group name', error);
      Alert.alert('Erreur', 'Impossible de mettre a jour le nom du groupe.');
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
    setIsVoiceRecording(false);
    setIsVoiceRecordingLocked(false);
    setIsSendingVoiceNote(false);
    setVoiceRecordingDurationMs(0);
    setVoiceRecordingHint('');
  }, []);

  const handleStartVoiceRecording = useCallback(async () => {
    if (!canRecordVoiceNote || !chatId) {
      Alert.alert(
        t('conversation.voice.unavailableTitle', 'Vocal indisponible'),
        t('conversation.voice.unavailableDescription', 'Le module vocal n est pas disponible sur cette build.'),
      );
      return;
    }

    if (isVoiceRecordingRef.current) return;
    try {
      setVoiceRecordingHint(t('conversation.voice.hint', 'Glisser gauche pour annuler, glisser haut pour verrouiller.'));
      setVoiceRecordingDurationMs(0);
      await startRecording({
        onProgress: (durationMs) => setVoiceRecordingDurationMs(durationMs),
      });
      setIsVoiceRecording(true);
      setIsVoiceRecordingLocked(false);
    } catch (error) {
      conversationLogger.warn('Failed to start voice recording', error);
      Alert.alert(
        t('conversation.voice.permissionTitle', 'Micro requis'),
        t('conversation.voice.permissionDescription', 'Autorisez le micro pour envoyer des notes vocales.'),
      );
      resetVoiceRecordingState();
    }
  }, [canRecordVoiceNote, chatId, resetVoiceRecordingState, t]);

  const handleCancelVoiceRecording = useCallback(async () => {
    if (!isVoiceRecordingRef.current && !isVoiceRecordingLockedRef.current) return;

    try {
      await cancelRecording();
    } catch (_error) {
      // No-op cleanup.
    }
    resetVoiceRecordingState();
  }, [resetVoiceRecordingState]);

  const handleStopVoiceRecordingAndSend = useCallback(async () => {
    if (!chatId || !isVoiceRecordingRef.current) return;

    try {
      setIsSendingVoiceNote(true);
      const draft = await stopRecording();

      if (!draft?.uri) {
        throw new Error('VOICE_EMPTY');
      }
      if ((draft?.durationMs || 0) < 500) {
        await handleCancelVoiceRecording();
        return;
      }

      const uploadedFiles = await uploadAttachmentAsset({
        fileName: `voice-note-${Date.now()}.m4a`,
        type: draft.mime || 'audio/mp4',
        uri: draft.uri,
      });

      if (!uploadedFiles.length) {
        throw new Error('VOICE_UPLOAD_FAILED');
      }

      sendMessage(chatId, '', {
        attachments: uploadedFiles,
        composition: {
          durationMs: draft.durationMs,
          mime: draft.mime || uploadedFiles?.[0]?.mime || 'audio/mp4',
          size: draft.size || uploadedFiles?.[0]?.size || 0,
          type: 'voice_note',
          version: 1,
          waveform: draft.waveform || [],
        },
        replyTo: replyingTo ? { documentId: replyingTo.documentId } : null,
        sender: userData,
      });
      setReplyingTo(null);
      resetVoiceRecordingState();
    } catch (error) {
      conversationLogger.warn('Failed to send voice note', error);
      Alert.alert(
        t('conversation.voice.sendErrorTitle', 'Envoi impossible'),
        t('conversation.voice.sendErrorDescription', 'Impossible d envoyer la note vocale. Reessayez.'),
      );
      resetVoiceRecordingState();
    }
  }, [chatId, handleCancelVoiceRecording, replyingTo, resetVoiceRecordingState, sendMessage, t, uploadAttachmentAsset, userData]);

  const microphonePanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: () => isVoiceRecordingRef.current,
    onPanResponderGrant: () => {
      handleStartVoiceRecording();
    },
    onPanResponderMove: (_event, gestureState) => {
      if (!isVoiceRecordingRef.current || isVoiceRecordingLockedRef.current) return;

      if (gestureState.dx <= -60) {
        handleCancelVoiceRecording();
        return;
      }

      if (gestureState.dy <= -60) {
        setIsVoiceRecordingLocked(true);
        setVoiceRecordingHint(t('conversation.voice.lockedHint', 'Enregistrement verrouille. Touchez envoyer ou annuler.'));
      }
    },
    onPanResponderRelease: () => {
      if (!isVoiceRecordingRef.current) return;
      if (isVoiceRecordingLockedRef.current) return;
      handleStopVoiceRecordingAndSend();
    },
    onPanResponderTerminate: () => {
      if (!isVoiceRecordingRef.current) return;
      if (!isVoiceRecordingLockedRef.current) {
        handleCancelVoiceRecording();
      }
    },
    onStartShouldSetPanResponder: () => true,
  }), [
    handleCancelVoiceRecording,
    handleStartVoiceRecording,
    handleStopVoiceRecordingAndSend,
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
    setIsAttachmentMenuVisible(false);
    setTimeout(() => {
      action();
    }, 250);
  };

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
        label: t('conversation.attachments.event', 'Evenement'),
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

      Alert.alert('Envoye', 'Votre proposition a ete envoyee !');
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
        Alert.alert('Erreur', 'Impossible de retrouver le match associÃ©.');
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
        Alert.alert('Match confirme', 'Le match est valide !');
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
      Alert.alert('Erreur', 'Une erreur est survenue lors de la rÃ©ponse.');
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
      Alert.alert('Erreur', "Impossible d'identifier votre Ã©quipe pour l'annulation.");
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

  const sendPendingMediaDraft = async () => {
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

    const options = Array.isArray(composition.options) ? composition.options : [];
    if (options.length === 0) return;

    const allowMultipleVotes = !!composition.allowMultipleVotes;
    const currentSelection = options
      .filter((option) => Array.isArray(option?.voters) && option.voters.includes(currentUserId))
      .map((option) => String(option.id));

    if (!allowMultipleVotes && currentSelection.length === 1 && currentSelection[0] === optionId) {
      return;
    }

    let hasChange = false;
    const nextOptions = options.map((option) => {
      const voters = Array.isArray(option?.voters)
        ? option.voters.filter((value) => typeof value === 'string' && value.length > 0)
        : [];
      const isTarget = String(option.id) === optionId;
      const hasCurrentUser = voters.includes(currentUserId);
      let nextVoters = voters;

      if (allowMultipleVotes) {
        if (isTarget && !hasCurrentUser) {
          nextVoters = [...voters, currentUserId];
        }
      } else if (isTarget && !hasCurrentUser) {
        nextVoters = [...voters, currentUserId];
      } else if (!isTarget && hasCurrentUser) {
        nextVoters = voters.filter((value) => value !== currentUserId);
      }

      if (nextVoters.length !== voters.length) {
        hasChange = true;
      }

      return {
        ...option,
        voteCount: nextVoters.length,
        voters: nextVoters,
      };
    });

    if (!hasChange) return;

    const nextComposition = {
      ...composition,
      options: nextOptions,
      updatedAt: new Date().toISOString(),
    };

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
      Alert.alert('Erreur', 'Impossible de sauvegarder ce vote.');
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
    setIsReportModalVisible(false);
    if (selectedMessage) {
      handleAvatarPress(selectedMessage.user);
    }
    setSelectedMessage(undefined);
  };

  /**
   * Handle message press event to show actions modal
   * @param {any} _
   * @param {import('react-native-gifted-chat').IMessage
   * & {documentId: string}} currentMessage - The message object
   * @returns {void}
   */
  const handleMessagePress = (_, currentMessage) => {
    const isOwnMessage = currentMessage.user._id === userData?.documentId;
    if (!isOwnMessage) {
      setIsReportModalVisible(true);
      setSelectedMessage(currentMessage);
    }
    const pressActions = /** @type {import('react-native').AlertButton[]} */ ([
      { onPress: () => setReplyingTo(currentMessage), text: 'Repondre' },
      !isOwnMessage ? {
        onPress: () => {
          setIsReportModalVisible(true);
          setSelectedMessage(currentMessage);
        },
        text: 'Signaler',
      } : null,
      { style: 'cancel', text: 'Annuler' },
    ].filter(Boolean));
    Alert.alert(t('Actions'), '', pressActions);
  };

  const handleSubmitReport = () => {
    if (selectedMessage?.documentId) {
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

    if (currentMessage.event) {
      return (
        <View style={{
          marginBottom,
          marginTop,
          // Removed margins as requested
        }}
        >
          <EventMessageBubble
            event={currentMessage.event}
            isMe={!isLeft}
            onDecline={() => {}}
            onJoin={() => handleJoinEvent(currentMessage.event)}
            onParticipate={() => handleParticipateToEvent(currentMessage.event)}
          />
        </View>
      );
    }

    // Composition message
    if (currentMessage.composition) {
      if (currentMessage.composition.type === 'poll') {
        return (
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
        );
      }

      if (currentMessage.composition.type === 'proposal') {
        return (
          <View style={{ marginBottom, marginTop }}>
            <ProposalMessageBubble
              isMe={!isLeft}
              onAccept={() => handleRespondProposal(currentMessage, 'accepted')}
              onDecline={() => handleRespondProposal(currentMessage, 'declined')}
              proposal={currentMessage.composition}
            />
          </View>
        );
      }

      if (currentMessage.composition.type === 'location_share') {
        return (
          <View style={{ marginBottom, marginTop }}>
            <LocationShareBubble
              composition={currentMessage.composition}
              isMe={!isLeft}
            />
          </View>
        );
      }

      if (currentMessage.composition.type === 'contact_share') {
        return (
          <View style={{ marginBottom, marginTop }}>
            <ContactShareBubble
              composition={currentMessage.composition}
              isMe={!isLeft}
              onPressContact={openSharedContact}
            />
          </View>
        );
      }

      if (currentMessage.composition.type === 'event_share') {
        return (
          <View style={{ marginBottom, marginTop }}>
            <EventShareBubble
              composition={currentMessage.composition}
              isMe={!isLeft}
              onPressEvent={openSharedEvent}
            />
          </View>
        );
      }

      if (currentMessage.composition.type === 'voice_note') {
        return (
          <View style={{ marginBottom, marginTop }}>
            <VoiceNoteBubble
              attachments={currentMessage.attachments || []}
              composition={currentMessage.composition}
              isMe={!isLeft}
            />
          </View>
        );
      }

      return (
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
      );
    }

    const isPending = Boolean(currentMessage.pending);
    const isFailed = Boolean(currentMessage.failed);

    return (
      <View style={{ opacity: isPending ? 0.5 : 1 }}>
        {currentMessage.replyTo && ( // Render Reply Preview
        <View style={{
          backgroundColor: 'rgba(0,0,0,0.1)',
          borderRadius: 8,
          marginBottom: 4,
          marginHorizontal: 12,
          marginTop: marginTop + 4,
          padding: 8,
        }}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary500]}>
            Reponse a
            {' '}
            {currentMessage.replyTo.sender?.firstname}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral500]}>
            {currentMessage.replyTo.message}
          </Text>
        </View>
        )}
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
                {t('common.retry', 'Reessayer')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  // ... rest of the file ...

  // Inside GiftedChat prop list (replacing renderUsernameOnMessage)

  /**
   * Render a custom composer component
   * @param {import('react-native-gifted-chat').ComposerProps} props - Component props
   * @returns {React.ReactNode} Rendered composer component
   */
  const renderComposer = (props) => (
    <Composer
      {...props}
      placeholder={
        pendingMediaDraft?.asset?.uri
          ? t('conversation.attachments.captionPlaceholder', 'Ajouter une legende')
          : t('conversation.messagePlaceholder')
      }
      textInputProps={{
        maxLength: 1000,
        multiline: true,
      }}
      textInputStyle={[
        ApplicationStyle.backgroundColor.neutral00,
        Fonts.p2,
        Spaces.paddingHorizontal[16],
        Spaces.paddingVertical[8], // Sleeker vertical padding
        {
          borderColor: Colors.neutral200,
          borderRadius: 20, // Manual border radius
          borderWidth: 1,
          color: Colors.neutral900,
          marginBottom: 0,
          marginTop: 0, // Reset default margins
        },
      ]}
    />
  );

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
        onPress={() => setIsAttachmentMenuVisible(true)}
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
    const hasVoicePreview = isVoiceRecording || isSendingVoiceNote;
    if (!hasMediaDraft && !hasReplyPreview && !hasVoicePreview) return null;

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
                {t('conversation.attachments.previewTitle', 'Photo prete a envoyer')}
              </Text>
              <Text
                numberOfLines={2}
                style={[Fonts.p4, { color: Colors.neutral400 }]}
              >
                {composerText?.trim()
                  ? t('conversation.attachments.previewWithCaption', 'La legende sera envoyee avec la photo.')
                  : t('conversation.attachments.previewWithoutCaption', 'Ajoutez une legende puis confirmez l envoi.')}
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

        {hasVoicePreview ? (
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
                  ? t('conversation.voice.locked', 'Note vocale verrouillee')
                  : t('conversation.voice.recording', 'Enregistrement vocal')}
              </Text>
              <Text
                numberOfLines={2}
                style={[Fonts.p4, { color: Colors.neutral400 }]}
              >
                {isSendingVoiceNote
                  ? t('conversation.voice.sending', 'Envoi en cours...')
                  : `${formatDurationLabel(voiceRecordingDurationMs)} - ${voiceRecordingHint || t('conversation.voice.hintShort', 'Maintenez appuye pour enregistrer')}`}
              </Text>
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
                  onPress={handleStopVoiceRecordingAndSend}
                  size="sm"
                  title={t('common.send', 'Envoyer')}
                  variant="PrimaryLight"
                />
              </View>
            ) : null}
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
        ? `${typingNames.slice(0, 2).join(', ')} ${typingNames.length > 1 ? 'ecrivent' : 'ecrit'}...`
        : 'Quelqu\'un ecrit...';
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
          { marginBottom: safeBottomInset },
        ]}
        >
          <Text style={[Fonts.p2, Fonts.neutral500]}>
            Ã°Å¸â€œÂ£
            {' '}
            {t('conversation.readOnly', 'Canal d\'annonce (lecture seule)')}
          </Text>
        </View>
      );
    }

    return (
      <InputToolbar
        {...props}
        containerStyle={[
          ApplicationStyle.backgroundColor.primary900, // Full width dark bar (or neutral00 for light mode app)
          ApplicationStyle.noBorderTop,
          Spaces.paddingHorizontal[8],
          Spaces.paddingVertical[8],
        // Removed negative margins to fix layout issues
        ]}
        primaryStyle={{ alignItems: 'center' }} // Align items vertically
        renderAccessory={renderAccessory}
        renderActions={renderActions}
        renderComposer={renderComposer}
      />
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
    const hasText = String(props.text || '').trim().length > 0;
    if (!hasText && !hasPendingMediaDraft && !canRecordVoiceNote) return null;

    if (!hasText && !hasPendingMediaDraft && canRecordVoiceNote) {
      return (
        <View
          {...microphonePanResponder.panHandlers}
          style={{
            height: 44, justifyContent: 'center', marginLeft: 8, marginRight: 8,
          }}
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: isVoiceRecording ? Colors.error500 : Colors.primary500,
              borderRadius: 16,
              height: 32,
              justifyContent: 'center',
              opacity: isSendingVoiceNote ? 0.7 : 1,
              width: 32,
            }}
          >
            {isSendingVoiceNote ? (
              <ActivityIndicator color={Colors.neutral00} size="small" />
            ) : (
              <Text style={{ color: Colors.neutral00, fontSize: 14 }}>
                {'\uD83C\uDFA4'}
              </Text>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={{
        height: 44, justifyContent: 'center', marginLeft: 8, marginRight: 8,
      }}
      >
        <TouchableOpacity
          onPress={() => {
            if (hasPendingMediaDraft) {
              sendPendingMediaDraft();
              return;
            }
            if (props.onSend) {
              props.onSend({ text: props.text }, true);
            }
          }}
          style={{
            alignItems: 'center',
            backgroundColor: Colors.primary500,
            borderRadius: 16,
            height: 32,
            justifyContent: 'center',
            width: 32,
          }}
        >
          {/* Simple arrow icon drawn with Views or Text if no Image available, assuming Image "send" exists but handling manually to be safe */}
          <Text style={{
            color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 2,
          }}
          >
            {'\u2191'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

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
          bottomOffset={safeBottomInset}
          dateFormat="DD MMMM"
          dateFormatCalendar={{
            lastDay: '[Hier]',
            lastWeek: '[La semaine derniÃ¨re] dddd',
            nextDay: '[Demain]',
            nextWeek: 'dddd',
            sameDay: '[Aujourd\'hui]',
            sameElse: 'DD/MM/YYYY',
          }}
          focusOnInputWhenOpeningKeyboard
          infiniteScroll
          inverted
          loadEarlier={hasNextPage}
          locale="fr"
          messages={messages}
          onInputTextChanged={handleInputTextChanged}
          onLoadEarlier={() => fetchNextPage()}
          onPress={handleMessagePress}
          onSend={onSend}
          renderBubble={renderBubble}
          renderFooter={renderFooter}
          renderInputToolbar={renderInputToolbar}
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
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>×</Text>
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
              title={t('conversation.actions.manageGroup', 'Gerer le groupe')}
              variant="SecondaryLight"
            />
            )}

            <Button
              onPress={() => {
                setIsMenuVisible(false);
                setTimeout(() => {
                  Alert.alert('Signaler', 'Pour signaler ce match ou cet utilisateur, veuillez contacter le support via les paramÃ¨tres.');
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
                title={t('conversation.attachments.createPoll', 'Creer un sondage')}
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
          <View style={Spaces.gap[12]}>
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
          <View style={Spaces.gap[12]}>
            <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
              {t('conversation.shareEvent.title', 'Partager un evenement')}
            </Text>

            {isLoadingSharedEvents ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <ActivityIndicator color={Colors.primary500} />
              </View>
            ) : null}

            {!isLoadingSharedEvents && shareableEvents.length === 0 ? (
              <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>
                {t('conversation.shareEvent.empty', 'Aucun evenement disponible.')}
              </Text>
            ) : null}

            {!isLoadingSharedEvents && shareableEvents.map((event) => (
              <TouchableOpacity
                key={`event-share-${event.documentId || event.id}`}
                onPress={() => handleShareEvent(event)}
                style={{
                  borderColor: 'rgba(255,255,255,0.16)',
                  borderRadius: 12,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                }}
              >
                <Text numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                  {event?.name || 'Evenement'}
                </Text>
                <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral300 }]}>
                  {event?.date ? new Date(event.date).toLocaleString('fr-FR') : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </BottomModal>

        <PollCreationModal
          isVisible={isPollModalVisible}
          onClose={() => setIsPollModalVisible(false)}
          onSubmit={handleSubmitPoll}
        />

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
