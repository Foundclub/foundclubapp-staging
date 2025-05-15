import { FlashList } from '@shopify/flash-list';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetChats } from '@/services/chat/chatQueries';

/**
 * Main messaging screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Home screen component
 */
function Messaging({ navigation }) {
  // hooks
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { userData } = useAuth();

  const {
    data: chats,
    error,
    isLoading,
    refetch,
  } = useGetChats();

  const { getUnreadStatus, joinChat } = useMessaging();

  /**
   * Handle chat press event
   * @param {string} chatId
   */
  const handleChatPress = (chatId) => {
    joinChat(chatId);
    navigation.navigate(RouteNames.Conversation, { chatId });
  };

  /**
   * Render a chat item
   * @param {{ item: Chat }} param - The chat item
   * @returns {import('react').ReactElement} The rendered chat item
   */
  const renderChat = ({ item: chat }) => {
    const lastMessage = chat.messages?.[0];
    const participant = chat.participants?.find(
      (p) => p.documentId !== userData?.documentId,
    ) || chat.participants?.[0];

    const hasUnread = lastMessage && getUnreadStatus(
      chat.documentId,
      new Date(lastMessage.createdAt).toISOString(),
    );

    return (
      <TouchableOpacity
        onPress={() => handleChatPress(chat.documentId)}
        style={[
          ApplicationStyle.borderRadius2,
          Spaces.padding[16],
          Spaces.marginBottom[8],
          hasUnread
            ? ApplicationStyle.backgroundColor.primary700
            : ApplicationStyle.backgroundColor.transparent,
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
          <TouchableOpacity
            onPress={() => handleChatPress(chat.documentId)}
            style={[
              ApplicationStyle.borderRadius24,
              { height: 48, width: 48 },
            ]}
          >
            <Image
              source={participant?.avatar?.url
                ? { uri: participant.avatar.url } : Images.roundAvatar}
              style={[
                ApplicationStyle.borderRadius24,
                { height: 48, width: 48 },
              ]}
            />
          </TouchableOpacity>
          <View style={[Alignments.fill, Alignments.column]}>
            <Text
              style={[
                Fonts.p2Bold,
                Fonts.neutral00,
                hasUnread && Fonts.neutral00,
              ]}
            >
              {`${participant?.firstname} ${participant?.lastname}`}
            </Text>
            {lastMessage && (
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                <Text
                  numberOfLines={1}
                  style={[
                    Fonts.p3Bold,
                    hasUnread ? Fonts.neutral00 : Fonts.neutral300,
                    Alignments.fill,
                  ]}
                >
                  {lastMessage.message}
                </Text>
                <Text style={[Fonts.p3Bold, hasUnread ? Fonts.neutral00 : Fonts.neutral500]}>
                  {formatDistanceToNow(new Date(lastMessage.createdAt), {
                    addSuffix: false,
                    locale: fr,
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={[
      ApplicationStyle.backgroundColor.primary900,
      ApplicationStyle.borderRadius32,
      Alignments.alignCenter,
      Spaces.gap[32],
      Spaces.paddingHorizontal[12],
      Spaces.paddingVertical[24],
      Spaces.marginVertical[24]]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('messaging.noData')}
      </Text>
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingBottom[24],
        Spaces.gap[24],
        Alignments.column,
        Alignments.fill,
      ]}
    >
      {/* header */}
      <View style={[
        Spaces.marginTop[16],
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween]}
      >
        <Image source={Images.logo} style={{ height: 23, resizeMode: 'cover', width: 222 }} />
        <ProfileButton />
      </View>
      <Text style={[Fonts.p1Black, Fonts.neutral00, Spaces.marginTop[16]]}>
        {t('messaging.title')}
      </Text>
      <WithDataWrapper
        error={error?.message}
        isLoading={isLoading}
      >
        <View style={[
          Alignments.fill,
          ApplicationStyle.borderRadius2,
          { minHeight: 500 }]}
        >
          <FlashList
            contentContainerStyle={Spaces.paddingBottom[64]}
            data={chats}
            estimatedItemSize={80}
            keyExtractor={(item) => item.documentId}
            ListEmptyComponent={renderEmptyList}
            onRefresh={refetch}
            refreshing={isLoading}
            renderItem={renderChat}
            showsVerticalScrollIndicator={false}
            style={Spaces.paddingHorizontal[24]}
          />
        </View>
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default Messaging;
