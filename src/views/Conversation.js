/* eslint-disable no-underscore-dangle */
/* eslint-disable react/jsx-props-no-spreading */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View, TouchableOpacity, ImageBackground, StatusBar } from 'react-native';
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
import { launchImageLibrary } from 'react-native-image-picker';
import client from '@/services/client';
import useSocket, { EVENTS } from '@/hooks/useSocket';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import EventMessageBubble from '@/components/molecules/eventMessageBubble/EventMessageBubble';
import CompositionMessageBubble from '@/components/molecules/compositionMessageBubble/CompositionMessageBubble';
import ProposalMessageBubble from '@/components/molecules/proposalMessageBubble/ProposalMessageBubble';
import ProposalModal from '@/components/organisms/proposalModal/ProposalModal';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';

import { RouteNames } from '@/navigation/routeNames';

import { useGetChatById, useGetChatMessages } from '@/services/chat/chatQueries';
import { createMessageReport } from '@/services/messageReport/messageReportService';
import { confirmMatch, cancelMatch } from '@/services/league/MatchService';

/**
 * Chat conversation screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Conversation screen component
 */
function Conversation({ navigation, route }) {
  const { chatId } = route.params ?? {};
  const { t } = useTranslation();
  const { userData } = useAuth();
  /* import deleteMessage from useMessaging hook */
  const { 
     getConversationName, 
     sendMessage, 
     updateLastReadMessage,
     deleteMessage,
     updateMessage 
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
    const actions = [
       { text: 'Répondre', onPress: () => setReplyingTo(currentMessage) }
    ];

    if (isOwnMessage) {
       actions.push({
          text: t('conversation.actions.delete', 'Supprimer'),
          style: 'destructive',
          onPress: () => {
             Alert.alert(
                t('conversation.modals.deleteConfirm.title', 'Supprimer le message ?'),
                t('conversation.modals.deleteConfirm.description', 'Cette action est irréversible.'),
                [
                   { text: t('common.cancel', 'Annuler'), style: 'cancel' },
                   { 
                      text: t('common.delete', 'Supprimer'), 
                      style: 'destructive', 
                      onPress: () => deleteMessage(currentMessage.documentId)
                   }
                ]
             );
          }
       });
    } else {
       actions.push({
          text: t('conversation.actions.report', 'Signaler'),
          onPress: () => {
              setIsReportModalVisible(true);
              setSelectedMessage(currentMessage);
          }
       });
    }

    actions.push({ text: t('common.cancel', 'Annuler'), style: 'cancel' });

    Alert.alert(
      t('conversation.actions.title', 'Actions'),
      '',
      actions
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
  const { top, bottom } = useSafeAreaInsets();


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

  const { socket } = useSocket();
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [replyingTo, setReplyingTo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProposalModalVisible, setIsProposalModalVisible] = useState(false);
  const { sendTypingStart, sendTypingStop, sendReadReceipt } = useMessaging(chatId);

  // Event Participation Logic
  const queryClient = useQueryClient();
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(undefined);

  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
      Alert.alert(t('common.success'), t('eventDetails.participationSuccess'));
    },
    onError: (error) => {
      Alert.alert(t('common.error'), error.message || t('common.errorOccurred'));
    }
  });

  const handleParticipateToEvent = (event) => {
    if (event?.documentId && userData?.documentId) {
      createEventParticipationMutation.mutate({
        event: event.documentId,
        user: userData.documentId,
      });
    }
  };

  const handleJoinEvent = (event) => {
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

    const handleTypingStart = ({ chatDocumentId }) => {
      if (chatDocumentId === chatId) {
        // Since we don't have user info in typing event, we just show generic
        // In a real app we'd pass userId
        setTypingUsers(prev => new Set(prev).add('someone'));
      }
    };

    const handleTypingStop = ({ chatDocumentId }) => {
       if (chatDocumentId === chatId) {
         setTypingUsers(prev => {
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
  const handleInputTextChanged = (text) => {
     if (text.length > 0) {
        sendTypingStart(chatId);
     } else {
        sendTypingStop(chatId);
     }
  };

  const handleChoosePhoto = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1000,
        maxHeight: 1000,
        includeBase64: false,
      });

      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert('Erreur', response.errorMessage || 'Erreur lors de la sélection');
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const image = response.assets[0];
        
        setIsUploading(true);

        const formData = new FormData();
        formData.append('files', {
          uri: image.uri,
          type: image.type,
          name: image.fileName || `upload_${Date.now()}.jpg`,
        });

        const uploadResponse = await client.post('/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (uploadResponse.data && uploadResponse.data.length > 0) {
           // Send message with attachment
           sendMessage(chatId, '', { 
              attachments: uploadResponse.data,
              sender: userData 
           });
        }
        setIsUploading(false);
      }
    } catch (error) {
      setIsUploading(false);
      console.warn('ImagePicker Error', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'image');
    }
  };



  /* Proposal Logic */
  const handleRespondProposal = async (message, status) => {
      const matchId = message?.composition?.matchId;
      if (!matchId) {
          Alert.alert("Erreur", "Impossible de retrouver le match associé.");
          return;
      }

      // Optimistic update of the message bubble
      const updatedComposition = { ...message.composition, status };
      
      // Update local cache immediately (Optimistic)
      queryClient.setQueryData(['chat-messages', chatId], (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
              ...oldData,
              pages: oldData.pages.map(page => ({
                  ...page,
                  data: page.data.map(msg => 
                      msg.id === message._id ? { ...msg, composition: updatedComposition } : msg
                  )
              }))
          };
      });

      try {
          if (status === 'accepted') {
              await confirmMatch(matchId);
              // Persist message update
              await updateMessage({
                  messageId: message.documentId || message._id || message.id,
                  data: {
                      composition: updatedComposition
                  }
              });
              Alert.alert("Match Confirmé", "Le match est validé !");
          } else {
              // Handle Decline
              await updateMessage({
                  messageId: message.documentId || message._id || message.id,
                  data: {
                      composition: updatedComposition
                  }
              });
              console.log("Proposal Declined");
          }
          
          // Invalidate to refresh match status elsewhere
          queryClient.invalidateQueries({ queryKey: ['league-matches'] }); 
          
      } catch (error) {
          console.error("Proposal Action Error:", error);
          Alert.alert("Erreur", "Une erreur est survenue.");
          // Rollback optimistic update if needed, but for now we keep it simple
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

  const { confirmMatch, cancelMatch } = require('@/services/league/MatchService'); // Importing inline to be safe or add to top

// ... inside component ...

  const handleCancelMatch = async () => {
    const matchId = chatData?.league_match?.documentId || chatData?.league_match?.id;
    if (!matchId) return;

    // Determine teamId of the current user
    const userId = userData?.documentId;
    let teamId = null;
    const teamA = chatData?.league_match?.team_a;
    const teamB = chatData?.league_match?.team_b;

    if (teamA?.captain?.documentId === userId) {
        teamId = teamA.documentId;
    } else if (teamB?.captain?.documentId === userId) {
        teamId = teamB.documentId;
    } else {
        teamId = userData?.team?.documentId;
    }

    if (!teamId) {
        Alert.alert("Erreur", "Impossible d'identifier votre équipe pour l'annulation.");
        return;
    }

    Alert.alert(
      "Annuler le match ?",
      "Cette action annulera le match et supprimera la conversation.",
      [
        { text: "Non", style: "cancel" },
        {
          text: "Oui, annuler",
          style: "destructive",
          onPress: async () => {
            try {
              console.log('[Conversation] Cancelling match:', matchId, 'Team:', teamId);
              await cancelMatch(matchId, teamId, 'Demande capitaine');
              navigation.goBack(); 
            } catch (error) {
              console.error('[Conversation] Cancel match failed:', error);
              Alert.alert("Erreur", "Impossible d'annuler le match.");
            }
          }
        }
      ]
    );
  };

  // Calculate title for Custom Header
  // Calculate title for Custom Header
  const title = useMemo(() => {
     console.log('[Conversation] Debug Title Calc:', {
        type: chatData?.type,
        league_match: chatData?.league_match,
        participantsCount: chatData?.participants?.length
     });
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

  const showCancelButton = chatData?.type === 'league_match' && chatData?.league_match;
  console.log('[Conversation] showCancelButton:', showCancelButton, 'type:', chatData?.type, 'hasLeagueMatch:', !!chatData?.league_match);

  // Anonymization helper for league_match chats
  const getAnonymizedName = (sender, senderIndex) => {
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
    const isMyTeamMember = myTeamMembers.some(m => m.documentId === sender?.documentId);
    
    if (isMyTeamMember) {
      // Show real name for teammates
      return `${sender?.firstname || ''} ${sender?.lastname || ''}`;
    }

    // This is an opponent - anonymize
    const isCaptain = chatData?.league_match?.team_a?.captain?.documentId === sender?.documentId ||
                      chatData?.league_match?.team_b?.captain?.documentId === sender?.documentId;
    
    return isCaptain ? 'Capitaine Adverse' : `Joueur Adverse`;
  };

  const messages = useMemo(() => (messagesPages ? messagesPages?.pages?.reduce((acc, page) => {
    const formattedMessages = page.data.map((msg, index) => ({
      _id: msg.id,
      createdAt: new Date(msg.createdAt),
      documentId: msg.documentId,
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
      image: msg.attachments?.[0]?.url 
            ? (msg.attachments[0].url.startsWith('http')
               ? msg.attachments[0].url
               : `${process.env.API_URL || 'http://10.0.2.2:1337'}${msg.attachments[0].url}`)
            : undefined,
      event: msg.event,
      composition: msg.composition,
      pending: msg.pending,
      replyTo: msg.replyTo,
      readBy: msg.readBy,
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
        screen: RouteNames.UserDetails,
        params: { userId: user._id },
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
     // Handle long press to reply for everyone
     Alert.alert(
        t('Actions'),
        '',
        [
           { text: 'Répondre', onPress: () => setReplyingTo(currentMessage) },
           !isOwnMessage ? { text: 'Signaler', onPress: () => {
              setIsReportModalVisible(true);
              setSelectedMessage(currentMessage);
           }} : null,
           { text: 'Annuler', style: 'cancel' }
        ].filter(Boolean)
     );
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10, marginBottom: 5 }}>
                <Text style={{ ...Fonts.p3, color: Colors.neutral500 }}>
                    ~ {currentMessage.user.name}
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
    const { currentMessage, previousMessage, nextMessage, position } = props;
    
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
                marginBottom: marginBottom,
                marginTop: marginTop,
                // Removed margins as requested
            }}>
                <EventMessageBubble 
                  event={currentMessage.event} 
                  isMe={!isLeft} 
                  onJoin={() => handleJoinEvent(currentMessage.event)}
                  onParticipate={() => handleParticipateToEvent(currentMessage.event)}
                  onDecline={() => {}}
                />
            </View>
        );
    }

    // Composition message
    if (currentMessage.composition) {
        if (currentMessage.composition.type === 'proposal') {
            return (
                <View style={{ marginBottom: marginBottom, marginTop: marginTop }}>
                    <ProposalMessageBubble
                        proposal={currentMessage.composition}
                        isMe={!isLeft}
                        onAccept={() => handleRespondProposal(currentMessage, 'accepted')}
                        onDecline={() => handleRespondProposal(currentMessage, 'declined')}
                    />
                </View>
            );
        }
        return (
            <View style={{
                marginBottom: marginBottom,
                marginTop: marginTop,
            }}>
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
              padding: 8,
              borderRadius: 8,
              marginBottom: 4,
              marginHorizontal: 12,
              marginTop: marginTop + 4
           }}>
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                 Réponse à {currentMessage.replyTo.sender?.firstname}
              </Text>
              <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral500]}>
                 {currentMessage.replyTo.message}
              </Text>
           </View>
        )}
        <Bubble
          {...props}
          renderTime={renderTime}
          textStyle={{
            left: [Fonts.p1, { color: Colors.neutral00 }], // White text for dark bubble
            right: [Fonts.p1, Fonts.neutral00],
          }}
          wrapperStyle={{
            left: {
              backgroundColor: '#0F1821', // Dark background for received messages to match screenshot
              borderTopLeftRadius: topLeftRadius,
              borderTopRightRadius: 18,
              borderBottomLeftRadius: bottomLeftRadius,
              borderBottomRightRadius: 18,
              marginTop: currentMessage.replyTo ? 2 : marginTop, 
              marginBottom,
              padding: 4,
            },
            right: {
              backgroundColor: Colors.primary500,
              borderTopLeftRadius: 18,
              borderTopRightRadius: topRightRadius,
              borderBottomLeftRadius: 18,
              borderBottomRightRadius: bottomRightRadius,
              marginTop: currentMessage.replyTo ? 2 : marginTop,
              marginBottom,
              padding: 4,
            },
          }}
          renderTicks={(currentMessage) => {
             if (currentMessage.pending) return <Text style={{ fontSize: 10, marginRight: 4 }}>🕒</Text>;
             // Checkmark logic using icons or text
             const tickColor = 'rgba(255,255,255,0.8)';
             if (currentMessage.readBy && currentMessage.readBy.length > 0) {
                return <Text style={{ color: tickColor, fontSize: 10, fontWeight: 'bold' }}>✓✓</Text>;
             }
             return <Text style={{ color: tickColor, fontSize: 10 }}>✓</Text>;
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
           borderRadius: 20, // Manual border radius
           color: Colors.neutral900,
           borderWidth: 1,
           borderColor: Colors.neutral200,
           marginTop: 0, // Reset default margins
           marginBottom: 0,
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
       const isMultisportAdmin = admins.some(admin => admin.documentId === userData.documentId);
       return isMultisportAdmin;
    }

    return false;
  }, [chatData, userData]);

  /**
   * Render custom actions (attachment button)
   */
  const renderActions = (props) => (
       <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
            <TouchableOpacity 
                onPress={() => setIsProposalModalVisible(true)}
                style={{ 
                    width: 32, height: 32, borderRadius: 16, 
                    backgroundColor: Colors.gold500,
                    justifyContent: 'center', alignItems: 'center', marginHorizontal: 4
                }}
            >
                <Text style={{ fontSize: 16 }}>🤝</Text>
            </TouchableOpacity>
           <TouchableOpacity 
              onPress={handleChoosePhoto}
              style={{ 
                 width: 32, height: 32, borderRadius: 16, 
                 backgroundColor: Colors.primary500,
                 justifyContent: 'center', alignItems: 'center', marginHorizontal: 4
              }}
           >
              {/* We use a text plus or an image if available */}
              <View style={{ width: 16, height: 2, backgroundColor: 'white', position: 'absolute' }} />
              <View style={{ width: 2, height: 16, backgroundColor: 'white', position: 'absolute' }} />
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
          Alignments.alignCenter
       ]}>
          <View>
             <Text style={[Fonts.p3Bold, Fonts.primary500]}>Repondre à {replyingTo.user?.name}</Text>
             <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral500]}>{replyingTo.text}</Text>
          </View>
          <Button 
             variant="SecondaryLight" 
             onPress={() => setReplyingTo(null)}
             title="X"
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
            { marginBottom: 10 }
         ]}>
            <Text style={[Fonts.p2, Fonts.neutral500]}>
               📣 {t('conversation.readOnly', 'Canal d\'annonce (lecture seule)')}
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
      renderComposer={renderComposer}
      renderActions={renderActions}
      renderAccessory={renderAccessory}
    />
  )};

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
       <View style={{ justifyContent: 'center', height: 44, marginRight: 8, marginLeft: 8 }}>
          <TouchableOpacity
            onPress={() => {
              if (props.onSend) {
                props.onSend({ text: props.text }, true);
              }
            }}
            style={{
               width: 32,
               height: 32,
               borderRadius: 16,
               backgroundColor: Colors.primary500,
               justifyContent: 'center',
               alignItems: 'center',
            }}
          >
             {/* Simple arrow icon drawn with Views or Text if no Image available, assuming Image "send" exists but handling manually to be safe */}
             <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 2 }}>↑</Text> 
          </TouchableOpacity>
       </View>
    );
  };

  return (
    <ImageBackground
      source={Images.bg2}
      style={[Alignments.fill]}
      resizeMode="cover"
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      {/* Custom Header */}
      <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: top + 10,
          paddingHorizontal: 16,
          paddingBottom: 10,
          zIndex: 10,
      }}>
          <HeaderBackButton onPress={() => navigation.goBack()} />
          
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>{title}</Text>
            {!!subtitle && (
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{subtitle}</Text>
            )}
          </View>

          {showCancelButton ? (
             <TouchableOpacity 
                onPress={handleCancelMatch}
                style={{ 
                    backgroundColor: 'rgba(255, 59, 48, 0.2)',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8
                }}
             >
                <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>Annuler</Text>
             </TouchableOpacity>
          ) : (
             <View style={{ width: 40 }} /> // Spacer to balance BackButton
          )}
      </View>

      <View style={[Alignments.fill]}>
        <GiftedChat
          safeAreaInsets={{
            top: 0, bottom, left: 0, right: 0,
          }}
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
        user={{
          _id: userData?.documentId,
          name: `${userData?.firstname || ''} ${userData?.lastname || ''}`,
          avatar: userData?.avatar?.url,
        }}
        renderBubble={renderBubble}
        renderInputToolbar={renderInputToolbar}
        renderSend={renderSend}
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
      </View>
    </ImageBackground>
  );
}

export default Conversation;
