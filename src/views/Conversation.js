/* eslint-disable react/jsx-props-no-spreading */
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetChatById, useGetChatMessages } from '@/services/chat/chatQueries';

/**
 * Chat conversation screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Conversation screen component
 */
function Conversation({ navigation, route }) {
  const { chatId } = route.params ?? {};
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { sendMessage, updateLastReadMessage } = useMessaging(chatId);
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

  const headerLeft = useMemo(() => (
    <HeaderBackButton
      onPress={() => {
        navigation.navigate(RouteNames.HomeTab, {
          screen: RouteNames.Chat,
        });
      }}
    />
  ), [navigation]);

  const headerTitle = useMemo(() => {
    if (chatData && userData) {
      const otherParticipant = chatData.participants.find(
        (participant) => participant.documentId !== userData.documentId,
      );
      if (otherParticipant) {
        return `${otherParticipant.firstname} ${otherParticipant.lastname}`;
      }
    }
    return '';
  }, [chatData, userData]);

  // Set navigation options
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => headerLeft,
      headerTitle,
    });
  }, [navigation, headerLeft, headerTitle]);

  const messages = useMemo(() => (messagesPages ? messagesPages?.pages?.reduce((acc, page) => {
    const formattedMessages = page.data.map((msg) => ({
      _id: msg.id,
      createdAt: new Date(msg.createdAt),
      text: msg.message,
      user: {
        _id: msg.sender.documentId || '',
        avatar: msg.sender.avatar?.url,
        name: `${msg.sender.firstname} ${msg.sender.lastname}`,
      },
    }));
    return [...acc, ...formattedMessages];
  }, /** @type {import('react-native-gifted-chat').IMessage[]} */ ([])) : []), [messagesPages]);

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
    // eslint-disable-next-line no-underscore-dangle
    if (user._id !== userData?.documentId) {
      navigation.navigate(RouteNames.Profile, {
        // eslint-disable-next-line no-underscore-dangle
        userId: user._id,
      });
    }
  };

  /**
   * Render a custom day component
   * @param {import('react-native-gifted-chat').TimeProps<any>} props - Component props
   * @returns {React.ReactNode} Rendered day component
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
        dateFormat="dd MMMM yyyy"
        dateFormatCalendar={{
          lastDay: '[Hier à] h:mm',
          lastWeek: '[La semaine dernière] dddd [à] h:mm',
          nextDay: '[Demain à] h:mm',
          nextWeek: 'dddd [à] h:mm',
          sameDay: '[Aujourd\'hui à] h:mm',
          sameElse: 'DD/MM/YYYY',
        }}
        focusOnInputWhenOpeningKeyboard
        infiniteScroll
        inverted
        loadEarlier={hasNextPage}
        locale="fr"
        messages={messages}
        onLoadEarlier={() => fetchNextPage()}
        onPressAvatar={handleAvatarPress}
        onSend={onSend}
        placeholder={t('conversation.messagePlaceholder')}
        renderAvatarOnTop
        renderBubble={renderBubble}
        renderInputToolbar={renderInputToolbar}
        renderSend={renderSend}
        renderUsernameOnMessage={chatData?.participants && chatData?.participants.length > 2}
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
    </ScreenContainer>
  );
}

export default Conversation;
