import { FlashList } from '@shopify/flash-list';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { getChatMessagePreview } from '@/domains/messaging/messagingUseCases';
import useMessaging from '@/domains/messaging/useMessaging';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetChats } from '@/services/chat/chatQueriesCompat';

/**
 * Main messaging screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Home screen component
 */
function Messaging({ navigation, route }) {
  // hooks
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { allMyTeams, userData } = useAuth();
  const { getClubInitials } = useClub();
  const safeTeamIds = useMemo(
    () => (Array.isArray(allMyTeams)
      ? Array.from(new Set(
        allMyTeams
          .map((team) => String(team?.documentId || '').trim())
          .filter(Boolean),
      ))
      : []),
    [allMyTeams],
  );

  const {
    data: chatsData,
    error,
    fetchNextPage,
    hasNextPage,
    isLoading,
    refetch,
  } = useGetChats({
    currentUserClubId: userData?.club?.documentId,
    currentUserId: userData?.documentId,
    currentUserTeamIds: safeTeamIds,
  });

  const {
    archiveChat, getConversationName, getUnreadStatus,
    joinChat, pinChat, unpinChat,
  } = useMessaging();

  const allChats = useMemo(() => {
    const chats = chatsData?.pages ? chatsData?.pages?.reduce(
      (acc, page) => acc.concat(page.data || []),
      /** @type {Chat[]} */([]),
    ) : [];

    // Sort: Multisport > Club > Team > Whisper
    // We want Multisport (m) at top, then Club (c)
    // Map types to priority
    /** @type {Record<'multisport' | 'club' | 'league_match' | 'group' | 'team' | 'whisper', number>} */
    const priority = {
      club: 1,
      group: 2.5,
      league_match: 1.5, // High priority but after club/multisport? Or top? Let's put it high.
      multisport: 0,
      team: 2,
      whisper: 3,
    };

    return chats
      .filter((chat) => !chat.archivedBy?.some((u) => u.documentId === userData?.documentId))
      .sort((a, b) => {
        const isPinnedA = a.pinnedBy?.some((u) => u.documentId === userData?.documentId);
        const isPinnedB = b.pinnedBy?.some((u) => u.documentId === userData?.documentId);

        if (isPinnedA && !isPinnedB) return -1;
        if (!isPinnedA && isPinnedB) return 1;

        const pA = priority[/** @type {'multisport' | 'club' | 'league_match' | 'group' | 'team' | 'whisper'} */ (a.type)] ?? 99;
        const pB = priority[/** @type {'multisport' | 'club' | 'league_match' | 'group' | 'team' | 'whisper'} */ (b.type)] ?? 99;

        if (pA !== pB) return pA - pB;

        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [chatsData?.pages, userData]);

  /**
   * Handle chat press event
   * @param {string} chatId
   */
  const handleChatPress = (chatId) => {
    joinChat(chatId);
    navigation.navigate(RouteNames.Conversation, { chatId });
  };

  /**
   * Render the avatar for a conversation
   * @param {Chat} chat
   * @returns {import('react').ReactElement} The rendered avatar
   */
  const renderConversationAvatar = (chat) => {
    switch (chat.type) {
      case 'club':
        if (chat?.club?.logo?.url) {
          return (
            <ProfileAvatar
              enablePreview={false}
              imageUrl={chat.club.logo.url}
              size={48}
            />
          );
        }
        return (
          <TeamShield
            initials={chat?.club?.name ? getClubInitials(chat?.club?.name) : ''}
            isNeutral
            isSmall
          />
        );
      case 'group':
      case 'whisper': {
        const participant = chat.participants?.find(
          (p) => p.documentId !== userData?.documentId,
        ) || chat.participants?.[0];
        return (
          <ProfileAvatar
            imageStyle={{ borderRadius: 40 }}
            imageUrl={participant?.avatar?.url}
            size={40}
            style={[
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.neutral00,
              { borderRadius: 40 },
            ]}
          />
        );
      }
      case 'league_match':
        return (
          <View style={{
            alignItems: 'center',
            backgroundColor: Colors.neutral900,
            borderColor: Colors.gold500,
            borderRadius: 24,
            borderWidth: 2,
            height: 48,
            justifyContent: 'center',
            width: 48,
          }}
          >
            <Text style={{ fontSize: 20 }}>🏆</Text>
          </View>
        );
      case 'multisport':
        if (chat?.multisportClub?.logo?.url) {
          return (
            <ProfileAvatar
              enablePreview={false}
              imageUrl={chat.multisportClub.logo.url}
              size={48}
            />
          );
        }
        return (
          <TeamShield
            initials={chat?.multisportClub?.name ? getClubInitials(chat?.multisportClub?.name) : ''}
            isNeutral
            isSmall
          />
        );
      case 'team':
        if (chat?.team?.logo?.url) {
          return (
            <ProfileAvatar
              enablePreview={false}
              imageUrl={chat.team.logo.url}
              size={48}
            />
          );
        }
        return (
          <TeamShield
            initials={chat?.team?.name ? getClubInitials(chat?.team?.name) : ''}
            isSmall
          />
        );
      default:
        return (
          <Image
            source={Images.roundAvatar}
            style={[
              ApplicationStyle.borderRadius24,
              { height: 48, width: 48 },
            ]}
          />
        );
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = useMemo(() => {
    if (!searchQuery) return allChats;
    const lowerQuery = searchQuery.toLowerCase();

    return allChats.filter((chat) => {
      const name = getConversationName({
        chatClub: chat.club,
        chatGroupName: chat.groupName,
        chatLeagueMatch: chat.league_match,
        chatMultisportClub: chat.multisportClub,
        chatParticipants: chat.participants,
        chatTeam: chat.team,
        chatType: chat.type,
        meId: userData?.documentId,
      });
      return name?.toLowerCase()?.includes(lowerQuery);
    });
  }, [allChats, searchQuery, getConversationName, userData]);

  const renderSearch = () => (
    <View style={[Spaces.paddingHorizontal[0], Spaces.marginBottom[16]]}>
      <View style={[
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius24,
        Alignments.row,
        Alignments.alignCenter,
        Spaces.paddingHorizontal[16],
        Spaces.paddingVertical[8],
        Spaces.gap[8],
      ]}
      >
        <Image
          source={Images.search}
          style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral300]}
        />
        <TextInput
          onChangeText={setSearchQuery}
          placeholder={t('messaging.searchPlaceholder', 'Rechercher une conversation...')}
          placeholderTextColor={Colors.neutral300}
          style={[Fonts.p2, { color: Colors.neutral00, flex: 1, padding: 0 }]}
          value={searchQuery}
        />
      </View>
    </View>
  );

  const renderLeftActions = (/** @type {any} */ progress, /** @type {any} */ dragX, /** @type {Chat} */ chat) => {
    const isPinned = chat.pinnedBy?.some((u) => u.documentId === userData?.documentId);
    return (
      <TouchableOpacity
        onPress={() => {
          if (isPinned) unpinChat(chat.documentId);
          else pinChat(chat.documentId);
        }}
        style={{
          alignItems: 'center',
          backgroundColor: Colors.primary500,
          borderRadius: 2,
          justifyContent: 'center',
          marginBottom: 8,
          width: 80,
        }}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>
          {isPinned ? t('messaging.unpin', 'Désépingler') : t('messaging.pin', 'Épingler')}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderRightActions = (/** @type {any} */ progress, /** @type {any} */ dragX, /** @type {Chat} */ chat) => (
    <TouchableOpacity
      onPress={() => archiveChat(chat.documentId)}
      style={{
        alignItems: 'center',
        backgroundColor: Colors.error500, // Or warning color
        borderRadius: 2,
        justifyContent: 'center',
        marginBottom: 8,
        width: 80,
      }}
    >
      <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
        {t('messaging.archive', 'Archiver')}
      </Text>
    </TouchableOpacity>
  );

  /**
   * Render a chat item
   * @param {{ item: Chat }} param - The chat item
   * @returns {import('react').ReactElement} The rendered chat item
   */
  const renderChat = ({ item: chat }) => {
    const lastMessage = chat.messages?.[0];
    const isMyMessage = lastMessage?.sender?.documentId === userData?.documentId;
    const hasUnread = !isMyMessage && (lastMessage && getUnreadStatus(
      chat.documentId,
      new Date(lastMessage.createdAt).toISOString(),
    ));

    const isPinned = chat.pinnedBy?.some((u) => u.documentId === userData?.documentId);
    let chatBackgroundStyle = ApplicationStyle.backgroundColor.transparent;
    if (hasUnread) {
      chatBackgroundStyle = ApplicationStyle.backgroundColor.primary700;
    } else if (chat.type === 'league_match') {
      chatBackgroundStyle = 'rgba(212, 175, 55, 0.1)';
    }

    return (
      <Swipeable
        renderLeftActions={(p, d) => renderLeftActions(p, d, chat)}
        renderRightActions={(p, d) => renderRightActions(p, d, chat)}
      >
        <TouchableOpacity
          onPress={() => handleChatPress(chat.documentId)}
          style={[
            ApplicationStyle.borderRadius2,
            Spaces.padding[16],
            Spaces.marginBottom[8],
            chatBackgroundStyle,
            isPinned && { borderLeftColor: Colors.primary500, borderLeftWidth: 4 },
            chat.type === 'league_match' && { borderLeftColor: Colors.gold500, borderLeftWidth: 4 },
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
              {renderConversationAvatar(chat)}
            </TouchableOpacity>
            <View style={[Alignments.fill, Alignments.column]}>
              <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text
                  numberOfLines={1}
                  style={[
                    Fonts.p2Bold,
                    Fonts.neutral00,
                    hasUnread && Fonts.neutral00,
                    { flex: 1 },
                  ]}
                >
                  {getConversationName({
                    chatClub: chat.club,
                    chatGroupName: chat.groupName,
                    chatLeagueMatch: chat.league_match,
                    chatMultisportClub: chat.multisportClub,
                    chatParticipants: chat.participants,
                    chatTeam: chat.team,
                    chatType: chat.type,
                    meId: userData?.documentId,
                  })}
                </Text>
                {chat.type === 'league_match' && (
                <View style={{
                  backgroundColor: Colors.gold500, borderRadius: 4, marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2,
                }}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.neutral900, fontSize: 10 }]}>LIGUE</Text>
                </View>
                )}
                {isPinned && (
                <View style={{
                  backgroundColor: Colors.primary500, borderRadius: 4, marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2,
                }}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.neutral900, fontSize: 10 }]}>EPINGLÉ</Text>
                </View>
                )}
              </View>

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
                    {getChatMessagePreview(lastMessage)}
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
      </Swipeable>
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
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.MESSAGING}
      userId={userData?.documentId}
    >
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
          <LeagueHeaderSwitch />
          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
            <NotificationBadge />
            <ProfileButton />
          </View>
        </View>
        <Text style={[Fonts.p1Black, Fonts.neutral00, Spaces.marginTop[16]]}>
          {t('messaging.title')}
        </Text>
        <OnboardingWrapper
          description="Recherchez une conversation, ouvrez un chat et utilisez les actions rapides."
          id="messaging-main-content"
          order={1}
          spotlight={{
            borderRadius: 16,
            maxHeight: 280,
            overlayOpacity: 0.4,
            paddingX: 2,
            paddingY: 2,
          }}
          style={{ flex: 1 }}
          title="Messagerie"
        >
          <View style={[Alignments.fill]}>
            {renderSearch()}
            <WithDataWrapper
              error={error?.message}
              isLoading={isLoading}
              wrapperStyle={[Alignments.fill]}
            >
              <View style={[
                Alignments.fill,
                ApplicationStyle.borderRadius2]}
              >
                <FlashList
                  data={filteredChats}
                  keyExtractor={(item) => item.documentId}
                  ListEmptyComponent={renderEmptyList}
                  onEndReached={() => hasNextPage && fetchNextPage()}
                  onEndReachedThreshold={0.5}
                  onRefresh={refetch}
                  refreshing={isLoading}
                  renderItem={renderChat}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </WithDataWrapper>
          </View>
        </OnboardingWrapper>

        {(userData?.role?.name === 'Entraineur' || userData?.role?.name === 'Dirigeant' || userData?.role?.name === 'SuperAdmin') && (
          <View style={{
            bottom: 20,
            left: 20,
            position: 'absolute',
            right: 20,
          }}
          >
            <TouchableOpacity
              onPress={() => navigation.navigate('NewConversation')}
              style={{
                alignItems: 'center',
                backgroundColor: Colors.primary500,
                borderRadius: 25,
                elevation: 5,
                justifyContent: 'center',
                paddingVertical: 16,
                shadowColor: '#000',
                shadowOffset: {
                  height: 2,
                  width: 0,
                },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
              }}
            >
              <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                +
                {' '}
                {t('messaging.newConversation', 'Nouvelle conversation')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default Messaging;
