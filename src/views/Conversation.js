/* eslint-disable no-underscore-dangle */
/* eslint-disable react/jsx-props-no-spreading */
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import 'dayjs/locale/fr';
import {
  Bubble,
  Composer,
  GiftedChat,
  InputToolbar,
  Time,
} from 'react-native-gifted-chat';

import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetChatById, useGetChatMessages } from '@/services/chat/chatQueries';
import { createMessageReport } from '@/services/messageReport/messageReportService';

/**
 * Chat conversation screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Conversation screen component
 */
function Conversation({ navigation, route }) {
  const { chatId } = route.params ?? {};
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { getConversationName, sendMessage, updateLastReadMessage } = useMessaging(chatId);
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
    Spaces,
  } = useTheme();

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

  const headerLeft = useMemo(() => (
    <HeaderBackButton
      onPress={() => {
        navigation.navigate(RouteNames.HomeTab, {
          screen: RouteNames.Chat,
        });
      }}
    />
  ), [navigation]);

  // Set navigation options
  useEffect(() => {
    if (chatData) {
      navigation.setOptions({
        headerLeft: () => headerLeft,
        headerTitle: getConversationName({
          chatClub: chatData?.club,
          chatParticipants: chatData?.participants,
          chatTeam: chatData?.team,
          chatType: chatData?.type || '',
          meId: userData?.documentId,
        }),
      });
    }
  }, [navigation,
    headerLeft,
    chatData,
    getConversationName,
    userData]);

  const messages = useMemo(() => (messagesPages ? messagesPages?.pages?.reduce((acc, page) => {
    const formattedMessages = page.data.map((msg) => ({
      _id: msg.id,
      createdAt: new Date(msg.createdAt),
      documentId: msg.documentId,
      text: msg.message,
      user: {
        _id: msg.sender.documentId || '',
        avatar: msg.sender.avatar?.url,
        name: `${msg.sender.firstname} ${msg.sender.lastname}`,
      },
    }));
    return [...acc, ...formattedMessages];
  }, /** @type {import('react-native-gifted-chat').IMessage[]} */ ([])) : []), [messagesPages]);

  const canShowUsernameOnMessage = useMemo(() => {
    const hasMultipleParticpants = chatData?.participants && chatData?.participants.length > 2;
    return chatData?.type !== 'whisper' || hasMultipleParticpants;
  }, [chatData]);

  const onSend = (msgs = /** @type {import('react-native-gifted-chat').IMessage[]} */ ([])) => {
    msgs.forEach((msg) => {
      if (chatId) {
        sendMessage(chatId, msg.text);
        // Update last read message timestamp when sending a new message
        updateLastReadMessage(chatId);
      }
    });
  };

  /**
   * Handle avatar press event
   * @param {import('react-native-gifted-chat').User} user - The user object
   * @returns {void}
   */
  const handleAvatarPress = (user) => {
    if (user._id === userData?.documentId) {
      navigation.navigate(RouteNames.Profile);
    } else {
      navigation.navigate(RouteNames.UserDetails, { userId: user._id });
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
  const renderTime = (props) => (
    <Time
      {...props}
      timeTextStyle={{
        left: [Fonts.p3, Fonts.neutral200],
        right: [Fonts.p3, Fonts.primary200],
      }}
    />
  );

  /**
   * Render a custom bubble component
   * @param {import('react-native-gifted-chat').BubbleProps<any>} props - Component props
   * @returns {React.ReactNode} Rendered bubble component
   */
  const renderBubble = (props) => (
    <Bubble
      {...props}
      renderTime={renderTime}
      textStyle={{
        left: [Fonts.p1, Fonts.neutral00],
        right: [Fonts.p1, Fonts.neutral00],
      }}
      wrapperStyle={{
        left: {
          backgroundColor: Colors.primary900,
          borderRadius: 12,
          margin: 8,
          padding: 2,
        },
        right: {
          backgroundColor: Colors.primary500,
          borderRadius: 12,
          margin: 8,
          padding: 2,
        },
      }}
    />
  );

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
        ApplicationStyle.borderRadius24,
        Fonts.p2,
        Spaces.paddingHorizontal[24],
        Spaces.paddingVertical[12],
        { color: Colors.neutral900 },
      ]}
    />
  );

  /**
   * Render a custom input toolbar component
   * @param {import('react-native-gifted-chat').InputToolbarProps<any>} props - Component props
   * @returns {React.ReactNode} Rendered input toolbar component
   */
  const renderInputToolbar = (props) => (
    <InputToolbar
      {...props}
      containerStyle={[
        ApplicationStyle.borderRadius32,
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.noBorderTop,
        Spaces.paddingTop[16],
        Spaces.paddingHorizontal[16],
        Spaces.marginTop[12],
        Spaces.gap[8],
        { marginBottom: -32, paddingBottom: 32 + 24 },
      ]}
      renderComposer={renderComposer}
    />
  );

  /**
   * Render a custom send button component
   * @param {import('react-native-gifted-chat').SendProps<any>} props - Component props
   * @returns {React.ReactNode} Rendered send button component
   */
  const renderSend = (props) => {
    if (!props.text) return null;
    return (
      <Button
        icon="send"
        onPress={() => {
          if (props.onSend) {
            props.onSend({ text: props.text }, true);
          }
        }}
        style={Spaces.marginLeft[16]}
        variant="PrimaryLight"
      />
    );
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
      style={[Spaces.paddingHorizontal[0]]}
    >
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
        onPressAvatar={handleAvatarPress}
        onSend={onSend}
        placeholder={t('conversation.messagePlaceholder')}
        renderAvatarOnTop
        renderBubble={renderBubble}
        renderInputToolbar={renderInputToolbar}
        renderSend={renderSend}
        renderUsernameOnMessage={canShowUsernameOnMessage}
        timeFormat="HH:mm"
        timeTextStyle={{
          left: { ...Fonts.p3, color: Colors.neutral500 },
          right: { ...Fonts.p3, color: Colors.neutral500 },
        }}
        user={{
          _id: userData?.documentId || '',
          avatar: userData?.avatar?.url,
          name: `${userData?.firstname} ${userData?.lastname}`,
        }}
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
    </ScreenContainer>
  );
}

export default Conversation;
