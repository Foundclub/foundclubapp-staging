/* eslint-disable no-underscore-dangle */
/* eslint-disable react/jsx-props-no-spreading */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ImageBackground, Linking, StatusBar, Text, TouchableOpacity, View,
} from 'react-native';
import 'dayjs/locale/fr';
import {
  Actions,
  Bubble,
  Composer,
  GiftedChat,
  InputToolbar,
  MessageImage,
  Time,
} from 'react-native-gifted-chat';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import CompositionMessageBubble from '@/components/molecules/compositionMessageBubble/CompositionMessageBubble';
import EventMessageBubble from '@/components/molecules/eventMessageBubble/EventMessageBubble';
import PollMessageBubble from '@/components/molecules/pollMessageBubble/PollMessageBubble';
import ProposalMessageBubble from '@/components/molecules/proposalMessageBubble/ProposalMessageBubble';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import PollCreationModal from '@/components/organisms/pollCreationModal/PollCreationModal';
import VenueProposalModal from '@/components/organisms/venueProposalModal/VenueProposalModal';
import { buildProposalDefaultsFromMatch } from '@/views/league/match/utils/proposalDefaults';

import { RouteNames } from '@/navigation/routeNames';

import { useGetChatById, useGetChatMessages } from '@/services/chat/chatQueries';
import client from '@/services/client';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import { cancelMatch, confirmMatch, updateMatch } from '@/services/league/leagueMatchService';
import { createMessageReport } from '@/services/messageReport/messageReportService';

import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';
import { createLogger } from '@/utils/logger/logger';

import { EVENTS } from '@/hooks/useSocket';

const conversationLogger = createLogger('conversation');
/** @type {any | null | undefined} */
let cachedDocumentPickerModule;

const getDocumentPickerModule = () => {
  if (cachedDocumentPickerModule !== undefined) return cachedDocumentPickerModule;
  try {
    // Lazy import to avoid eager native resolution during app bootstrap.
    // eslint-disable-next-line global-require
    const maybeModule = require('react-native-document-picker');
    cachedDocumentPickerModule = maybeModule?.default || maybeModule;
    return cachedDocumentPickerModule;
  } catch (error) {
    conversationLogger.warn('DocumentPicker module unavailable', error);
    cachedDocumentPickerModule = null;
    return null;
  }
};

/**
 * Chat conversation screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Conversation screen component
 */
function Conversation({ navigation, route }) {
  const { chatId } = route.params ?? {};
  const { t } = useTranslation();
  const { userData } = useAuth();

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
    deleteMessage,
    getConversationName,
    sendMessage,
    sendReadReceipt,
    sendTypingStart,
    sendTypingStop,
    socket,
    updateMessage,
  } = useMessaging(chatId);

  /**
   * Handle message long press event to show actions modal
   * @param {any} _
   * @param {import('react-native-gifted-chat').IMessage
   * & {documentId: string}} currentMessage - The message object
   * @returns {void}
   */
  const handleMessageLongPress = (_, currentMessage) => {
    const isOwnMessage = currentMessage.user._id === userData?.documentId;

    // Base actions
    /** @type {import('react-native').AlertButton[]} */
    const actions = [
      { onPress: () => setReplyingTo(currentMessage), text: 'Répondre' },
    ];

    if (isOwnMessage) {
      actions.push({
        onPress: () => {
          Alert.alert(
            t('conversation.modals.deleteConfirm.title', 'Supprimer le message ?'),
            t('conversation.modals.deleteConfirm.description', 'Cette action est irréversible.'),
            [
              { style: 'cancel', text: t('common.cancel', 'Annuler') },
              {
                onPress: () => deleteMessage(currentMessage.documentId),
                style: 'destructive',
                text: t('common.delete', 'Supprimer'),
              },
            ],
          );
        },
        style: 'destructive',
        text: t('conversation.actions.delete', 'Supprimer'),
      });
    } else {
      actions.push({
        onPress: () => {
          setIsReportModalVisible(true);
          setSelectedMessage(currentMessage);
        },
        text: t('conversation.actions.report', 'Signaler'),
      });
    }

    actions.push({ style: 'cancel', text: t('common.cancel', 'Annuler') });

    Alert.alert(
      t('conversation.actions.title', 'Actions'),
      '',
      actions,
    );
  };
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
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
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  // DEBUG LOGS
  const { bottom, top } = useSafeAreaInsets();
  const HEADER_SIDE_WIDTH = 56;

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
  const [isUploading, setIsUploading] = useState(false);
  const [isAttachmentMenuVisible, setIsAttachmentMenuVisible] = useState(false);
  const [isPollModalVisible, setIsPollModalVisible] = useState(false);
  const [isProposalModalVisible, setIsProposalModalVisible] = useState(false);

  // Event Participation Logic
  const queryClient = useQueryClient();
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(/** @type {{ documentId?: string; team?: Team } | undefined} */ (undefined));

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
    if (!socket) return;

    const handleTypingStart = (/** @type {{ chatDocumentId?: string }} */ { chatDocumentId }) => {
      if (chatDocumentId === chatId) {
        // Since we don't have user info in typing event, we just show generic
        // In a real app we'd pass userId
        setTypingUsers((prev) => new Set(prev).add('someone'));
      }
    };

    const handleTypingStop = (/** @type {{ chatDocumentId?: string }} */ { chatDocumentId }) => {
      if (chatDocumentId === chatId) {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.clear(); // For now, basic implementation
          return newSet;
        });
      }
    };

    socket.on(EVENTS.TYPING_START, handleTypingStart);
    socket.on(EVENTS.TYPING_STOP, handleTypingStop);

    return () => {
      socket.off(EVENTS.TYPING_START, handleTypingStart);
      socket.off(EVENTS.TYPING_STOP, handleTypingStop);
    };
  }, [socket, chatId]);

  // Read Receipt on Mount
  useEffect(() => {
    sendReadReceipt(chatId);
  }, [chatId, sendReadReceipt]);

  // Handle Input Text Change for Typing Indicator
  const handleInputTextChanged = (/** @type {string} */ text) => {
    if (text.length > 0) {
      sendTypingStart(chatId);
    } else {
      sendTypingStop(chatId);
    }
  };

  const uploadAndSendAttachment = async (/** @type {{ fileName?: string; type?: string; uri?: string | null }} */ asset) => {
    if (!asset?.uri || !chatId) return;

    try {
      setIsUploading(true);

      const isVideo = typeof asset.type === 'string' && asset.type.startsWith('video/');
      const defaultExtension = isVideo ? 'mp4' : 'jpg';
      const formData = new FormData();

      formData.append('files', /** @type {any} */ ({
        name: asset.fileName || `upload_${Date.now()}.${defaultExtension}`,
        type: asset.type || 'application/octet-stream',
        uri: asset.uri,
      }));

      const uploadResponse = await client.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploadedFiles = Array.isArray(uploadResponse?.data) ? uploadResponse.data : [];
      if (uploadedFiles.length === 0) {
        Alert.alert('Erreur', 'Aucune piece jointe n a pu etre envoyee.');
        return;
      }

      const uploadedMime = uploadedFiles?.[0]?.mime || asset.type || '';
      const uploadedName = uploadedFiles?.[0]?.name || asset.fileName || 'piece-jointe';
      const isImageAttachment = typeof uploadedMime === 'string'
        && uploadedMime.startsWith('image/');

      sendMessage(chatId, isImageAttachment ? '' : `Piece jointe: ${uploadedName}`, {
        attachments: uploadedFiles,
        sender: userData,
      });
    } catch (error) {
      conversationLogger.warn('Attachment upload failed', error);
      Alert.alert('Erreur', 'Impossible d envoyer cette piece jointe.');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePickMedia = async () => {
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

      await uploadAndSendAttachment({
        fileName: selectedAsset.fileName,
        type: selectedAsset.type,
        uri: selectedAsset.uri,
      });
    } catch (error) {
      conversationLogger.warn('Media picker failed', error);
      Alert.alert('Erreur', 'Impossible d ouvrir la galerie.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const response = await launchCamera({
        cameraType: 'back',
        includeBase64: false,
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: false,
      });

      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert('Erreur', response.errorMessage || 'Impossible d ouvrir la camera');
        return;
      }

      const selectedAsset = response.assets?.[0];
      if (!selectedAsset) return;

      await uploadAndSendAttachment({
        fileName: selectedAsset.fileName,
        type: selectedAsset.type,
        uri: selectedAsset.uri,
      });
    } catch (error) {
      conversationLogger.warn('Camera open failed', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
    }
  };

  const handlePickFile = async () => {
    try {
      const documentPicker = getDocumentPickerModule();
      if (!documentPicker) {
        Alert.alert('Erreur', 'Le selecteur de fichiers est indisponible.');
        return;
      }

      const selectedFile = await documentPicker.pickSingle({
        copyTo: 'cachesDirectory',
        type: [documentPicker.types.allFiles],
      });

      const selectedUri = selectedFile.fileCopyUri || selectedFile.uri;
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
      const documentPicker = getDocumentPickerModule();
      if (documentPicker?.isCancel?.(error)) return;
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

  const runAttachmentAction = (/** @type {() => Promise<void> | void} */ action) => {
    setIsAttachmentMenuVisible(false);
    setTimeout(() => {
      action();
    }, 250);
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
        Alert.alert('Erreur', 'Impossible de retrouver le match associé.');
        return;
      }
    }

    // Optimistic update of the message bubble
    const updatedComposition = { ...message.composition, status };

    // Update local cache immediately (Optimistic)
    queryClient.setQueryData(['chat-messages', chatId], (/** @type {any} */ oldData) => {
      if (!oldData?.pages) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((/** @type {any} */ page) => ({
          ...page,
          data: page.data.map((/** @type {any} */ msg) => (msg.id === message._id ? { ...msg, composition: updatedComposition } : msg)),
        })),
      };
    });

    try {
      if (status === 'accepted') {
        conversationLogger.debug('Accepting match proposal', { matchId });
        await confirmMatch(matchId);
        // Persist message update
        await updateMessage({
          data: {
            composition: updatedComposition,
          },
          messageId: message.documentId || message._id || message.id,
        });
        Alert.alert('Match confirme', 'Le match est valide !');
        promptAddMatchToCalendar(message);
      } else {
        // Handle Decline
        await updateMessage({
          data: {
            composition: updatedComposition,
          },
          messageId: message.documentId || message._id || message.id,
        });
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

  const headerLeft = useMemo(() => (
    <HeaderBackButton
      onPress={() => {
        navigation.navigate(RouteNames.HomeTab, {
          screen: RouteNames.Chat,
        });
      }}
    />
  ), [navigation]);

  // Removed inline require

  // ... inside component ...

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
  const getAnonymizedName = (/** @type {User} */ sender, /** @type {number} */ senderIndex) => {
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
  };

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
    const formattedMessages = page.data.map((msg, index) => ({
      _id: msg.id,
      composition: msg.composition,
      createdAt: new Date(msg.createdAt),
      documentId: msg.documentId,
      event: msg.event,
      image: msg.attachments?.[0]?.url
        && (
          (msg.attachments?.[0]?.mime || '').startsWith('image/')
          || /\.(png|jpe?g|gif|webp)$/i.test(msg.attachments[0].url)
        )
        ? (msg.attachments[0].url.startsWith('http')
          ? msg.attachments[0].url
          : `${process.env.API_URL || 'http://10.0.2.2:1337'}${msg.attachments[0].url}`)
        : undefined,
      pending: msg.pending,
      readBy: msg.readBy,
      replyTo: msg.replyTo,
      text: msg.message,
      user: {
        _id: msg.sender?.documentId || '', // Check optional chaining
        avatar: msg.sender?.avatar?.url
          ? (msg.sender.avatar.url.startsWith('http')
            ? msg.sender.avatar.url
            : `${process.env.API_URL || 'http://10.0.2.2:1337'}${msg.sender.avatar.url}`)
          : undefined,
        name: getAnonymizedName(msg.sender, index),
      },
    }));
    return [...acc, ...formattedMessages];
  }, /** @type {import('react-native-gifted-chat').IMessage[]} */ ([])) : []), [messagesPages, chatData, userData]);

  const canShowUsernameOnMessage = useMemo(() => {
    const hasMultipleParticpants = chatData?.participants && chatData?.participants.length > 2;
    return chatData?.type !== 'whisper' || hasMultipleParticpants;
  }, [chatData]);

  const onSend = (msgs = /** @type {import('react-native-gifted-chat').IMessage[]} */ ([])) => {
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
        } else if (isTarget && hasCurrentUser) {
          nextVoters = voters.filter((value) => value !== currentUserId);
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
      await updateMessage({
        data: {
          composition: nextComposition,
        },
        messageId: String(messageId),
      });
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

    const isPending = currentMessage.pending;

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
            Réponse à
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
          renderTicks={(/** @type {any} */ currentMessage) => {
            if (currentMessage.pending) return <Text style={{ fontSize: 10, marginRight: 4 }}>🕒</Text>;
            // Checkmark logic using icons or text
            const tickColor = 'rgba(255,255,255,0.8)';
            if (currentMessage.readBy && currentMessage.readBy.length > 0) {
              return <Text style={{ color: tickColor, fontSize: 10, fontWeight: 'bold' }}>✓✓</Text>;
            }
            return <Text style={{ color: tickColor, fontSize: 10 }}>✓</Text>;
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
      placeholder={t('conversation.messagePlaceholder')}
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

  const renderAccessory = () => {
    if (!replyingTo) return null;
    return (
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
            Repondre à
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
    );
  };

  const renderFooter = () => {
    if (typingUsers.size > 0) {
      return (
        <View style={[Spaces.padding[8], Spaces.marginLeft[16]]}>
          <Text style={[Fonts.p3, Fonts.neutral500]}>Quelqu'un écrit...</Text>
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
          { marginBottom: 10 },
        ]}
        >
          <Text style={[Fonts.p2, Fonts.neutral500]}>
            📣
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
    if (!props.text) return null;
    return (
      <View style={{
        height: 44, justifyContent: 'center', marginLeft: 8, marginRight: 8,
      }}
      >
        <TouchableOpacity
          onPress={() => {
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
          dateFormat="DD MMMM"
          dateFormatCalendar={{
            lastDay: '[Hier]',
            lastWeek: '[La semaine dernière] dddd',
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
          onLoadEarlier={() => fetchNextPage()}
          onPress={handleMessagePress}
          onSend={onSend}
          renderBubble={renderBubble}
          renderInputToolbar={renderInputToolbar}
          renderSend={renderSend}
          user={{
            _id: userData?.documentId || '',
            avatar: userData?.avatar?.url,
            name: `${userData?.firstname || ''} ${userData?.lastname || ''}`,
          }}
        />

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
          close={() => setIsAttachmentMenuVisible(false)}
          contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 18 }}
          hideCloseButton
          isVisible={isAttachmentMenuVisible}
        >
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
