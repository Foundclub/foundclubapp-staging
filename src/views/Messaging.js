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
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';

import { RouteNames } from '@/navigation/routeNames';

import { useGetChats } from '@/services/chat/chatQueries';

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
    currentUserTeamIds: allMyTeams?.map((team) => team.documentId || ''),
  });

  const { 
    getConversationName, getUnreadStatus, joinChat, 
    pinChat, unpinChat, archiveChat 
  } = useMessaging();

  const allChats = useMemo(() => {
    const chats = chatsData?.pages ? chatsData?.pages?.reduce(
      (acc, page) => acc.concat(page.data || []),
      /** @type {Chat[]} */([]),
    ) : [];
    
    // Sort: Multisport > Club > Team > Whisper
    // We want Multisport (m) at top, then Club (c)
    // Map types to priority
    /** @type {Record<'multisport' | 'club' | 'league_match' | 'team' | 'whisper', number>} */
    const priority = {
        'multisport': 0,
        'club': 1,
        'league_match': 1.5, // High priority but after club/multisport? Or top? Let's put it high.
        'team': 2,
        'whisper': 3
    };
    
    return chats
      .filter((chat) => !chat.archivedBy?.some((u) => u.documentId === userData?.documentId))
      .sort((a, b) => {
        const isPinnedA = a.pinnedBy?.some((u) => u.documentId === userData?.documentId);
        const isPinnedB = b.pinnedBy?.some((u) => u.documentId === userData?.documentId);
        
        if (isPinnedA && !isPinnedB) return -1;
        if (!isPinnedA && isPinnedB) return 1;

        const pA = priority[/** @type {'multisport' | 'club' | 'league_match' | 'team' | 'whisper'} */ (a.type)] ?? 99;
        const pB = priority[/** @type {'multisport' | 'club' | 'league_match' | 'team' | 'whisper'} */ (b.type)] ?? 99;
        
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
              imageUrl={chat.club.logo.url}
              size={48}
              enablePreview={false}
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
      case 'team':
        if (chat?.team?.logo?.url) {
          return (
             <ProfileAvatar
              imageUrl={chat.team.logo.url}
              size={48}
              enablePreview={false}
             />
          );
        }
        return (
          <TeamShield
            initials={chat?.team?.name ? getClubInitials(chat?.team?.name) : ''}
            isSmall
          />
        );
      case 'whisper': {
        const participant = chat.participants?.find(
          (p) => p.documentId !== userData?.documentId,
        ) || chat.participants?.[0];
        return (
          <ProfileAvatar
            imageUrl={participant?.avatar?.url}
            size={40}
            style={[
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.neutral00,
              { borderRadius: 40 },
            ]}
            imageStyle={{ borderRadius: 40 }}
          />
        );
      }
      case 'league_match':
        return (
            <View style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: Colors.neutral900,
                borderWidth: 2, borderColor: Colors.gold500,
                justifyContent: 'center', alignItems: 'center'
            }}>
                <Text style={{ fontSize: 20 }}>🏆</Text>
            </View>
        );
      case 'multisport':
        if (chat?.multisportClub?.logo?.url) {
          return (
            <ProfileAvatar
              imageUrl={chat.multisportClub.logo.url}
              size={48}
              enablePreview={false}
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
          chatMultisportClub: chat.multisportClub,
          chatParticipants: chat.participants,
          chatTeam: chat.team,
          chatType: chat.type,
          chatLeagueMatch: chat.league_match,
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
        Spaces.gap[8]
      ]}>
         <Image 
            source={Images.search} 
            style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral300]} 
         />
         <TextInput
            placeholder={t('messaging.searchPlaceholder', 'Rechercher une conversation...')}
            placeholderTextColor={Colors.neutral300}
            style={[Fonts.p2, { flex: 1, color: Colors.neutral00, padding: 0 }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
         />
      </View>
    </View>
  );

  const renderLeftActions = (/** @type {any} */ progress, /** @type {any} */ dragX, /** @type {Chat} */ chat) => {
    const isPinned = chat.pinnedBy?.some((u) => u.documentId === userData?.documentId);
    return (
      <TouchableOpacity
        style={{
          width: 80,
          backgroundColor: Colors.primary500,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 8,
          borderRadius: 2
        }}
        onPress={() => {
            if (isPinned) unpinChat(chat.documentId);
            else pinChat(chat.documentId);
        }}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>
            {isPinned ? t('messaging.unpin', 'Désépingler') : t('messaging.pin', 'Épingler')}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderRightActions = (/** @type {any} */ progress, /** @type {any} */ dragX, /** @type {Chat} */ chat) => {
    return (
      <TouchableOpacity
        style={{
          width: 80,
          backgroundColor: Colors.error500, // Or warning color
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 8,
          borderRadius: 2
        }}
        onPress={() => archiveChat(chat.documentId)}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
           {t('messaging.archive', 'Supprimer')}
        </Text>
      </TouchableOpacity>
    );
  };

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
            hasUnread
              ? ApplicationStyle.backgroundColor.primary700
              : (chat.type === 'league_match' ? 'rgba(212, 175, 55, 0.1)' : ApplicationStyle.backgroundColor.transparent),
            isPinned && { borderLeftWidth: 4, borderLeftColor: Colors.primary500 },
            chat.type === 'league_match' && { borderLeftWidth: 4, borderLeftColor: Colors.gold500 }
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
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text
                    style={[
                        Fonts.p2Bold,
                        Fonts.neutral00,
                        hasUnread && Fonts.neutral00,
                        { flex: 1} 
                    ]}
                    numberOfLines={1}
                    >
                    {getConversationName({
                        chatClub: chat.club,
                        chatMultisportClub: chat.multisportClub,
                        chatParticipants: chat.participants,
                        chatTeam: chat.team,
                        chatType: chat.type,
                        chatLeagueMatch: chat.league_match,
                        meId: userData?.documentId,
                    })}
                    </Text>
                    {chat.type === 'league_match' && (
                         <View style={{ backgroundColor: Colors.gold500, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                             <Text style={[Fonts.p4Bold, { color: Colors.neutral900, fontSize: 10 }]}>LIGUE</Text>
                         </View>
                    )}
                    {isPinned && (
                         <View style={{ backgroundColor: Colors.primary500, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
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
          tutorialStartToken: undefined,
          tutorialSource: undefined,
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
            position: 'absolute',
            bottom: 20,
            left: 20,
            right: 20,
          }}
          >
            <TouchableOpacity
              onPress={() => navigation.navigate('NewConversation')}
              style={{
                backgroundColor: Colors.primary500,
                borderRadius: 25,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: "#000",
                shadowOffset: {
                  width: 0,
                  height: 2,
                },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
              }}
            >
              <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                + {t('messaging.newConversation', 'Nouvelle conversation')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default Messaging;
