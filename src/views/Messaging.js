import { FlashList } from '@shopify/flash-list';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, Platform, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import useAuth from '@/domains/auth/useAuth';
import {
  getChatMessagePreview,
  isLeagueChat,
} from '@/domains/messaging/messagingUseCases';
import useMessaging from '@/domains/messaging/useMessaging';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import WebFloatingOverlay from '@/components/atoms/webFloatingOverlay/WebFloatingOverlay';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { getFloatingActionContainerStyle } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { useGetChats } from '@/services/chat/chatQueriesCompat';

import { getErrorMessage } from '@/utils/errors/displayError';
import { markMessagingPerf } from '@/utils/performance/messagingPerformance';

const CHAT_SCOPE_VALUES = new Set(['all', 'classic', 'league']);

const normalizeChatScopeFilter = (value) => {
  const safeValue = String(value || '').trim().toLowerCase();
  return CHAT_SCOPE_VALUES.has(safeValue) ? safeValue : 'all';
};

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
  const routeChatScope = route?.params?.chatScope || route?.params?.initialChatScope;
  const [chatScopeFilter, setChatScopeFilter] = useState(
    () => normalizeChatScopeFilter(routeChatScope),
  );
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
    isFetching,
    isLoading,
    refetch,
  } = useGetChats({
    chatScope: chatScopeFilter,
    currentUserClubId: userData?.club?.documentId,
    currentUserId: userData?.documentId,
    currentUserTeamIds: safeTeamIds,
  });

  const {
    archiveChatAsync, getConversationName, getUnreadStatus,
    joinChat, pinChatAsync, unpinChatAsync,
  } = useMessaging();
  const { floatingActionBottomOffset, sceneBottomInset } = useBottomDockLayout();
  const isWeb = Platform.OS === 'web';
  const canCreateConversation = userData?.role?.name === 'Entraîneur'
    || userData?.role?.name === 'Dirigeant'
    || userData?.role?.name === 'SuperAdmin';
  const floatingButtonBottom = floatingActionBottomOffset;
  const chatListBottomInset = canCreateConversation
    ? Math.max(sceneBottomInset, floatingButtonBottom + 84)
    : sceneBottomInset;
  const listOpenLoggedRef = useRef(false);
  const listPrimaryLoggedRef = useRef(false);
  const listFirstRenderedLoggedRef = useRef(false);
  const chatScopeOptions = useMemo(() => [
    {
      label: t('messaging.filters.all', 'Toutes'),
      value: 'all',
    },
    {
      label: t('messaging.filters.classic', 'Classique'),
      value: 'classic',
    },
    {
      label: t('messaging.filters.league', 'League'),
      value: 'league',
    },
  ], [t]);
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

  useEffect(() => {
    if (routeChatScope == null) return;
    setChatScopeFilter(normalizeChatScopeFilter(routeChatScope));
  }, [routeChatScope]);

  useEffect(() => {
    if (listOpenLoggedRef.current) return;
    listOpenLoggedRef.current = true;
    markMessagingPerf('messaging_list_open_started', {
      hasUser: Boolean(userData?.documentId),
    });
  }, [userData?.documentId]);

  useEffect(() => {
    if (!chatsData?.pages || isLoading || listPrimaryLoggedRef.current) return;
    listPrimaryLoggedRef.current = true;
    markMessagingPerf('messaging_list_primary_query_completed', {
      fromCache: !isFetching,
      resultCount: allChats.length,
    });
  }, [allChats.length, chatsData?.pages, isFetching, isLoading]);

  useEffect(() => {
    if (!chatsData?.pages || isLoading || listFirstRenderedLoggedRef.current) return undefined;

    const frameId = requestAnimationFrame(() => {
      listFirstRenderedLoggedRef.current = true;
      markMessagingPerf('messaging_list_first_results_rendered', {
        resultCount: allChats.length,
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [allChats.length, chatsData?.pages, isLoading]);

  /**
   * Handle chat press event
   * @param {Chat} chat
   */
  const handleChatPress = (chat) => {
    const chatId = chat?.documentId;
    if (!chatId) return;

    const title = getConversationName({
      chatClub: chat?.club,
      chatGroupName: chat?.groupName,
      chatLeagueMatch: chat?.league_match,
      chatMultisportClub: chat?.multisportClub,
      chatParticipants: chat?.participants,
      chatTeam: chat?.team,
      chatType: chat?.type,
      meId: userData?.documentId,
    }) || t('common.chat', 'Conversation');

    joinChat(chatId);
    navigation.navigate(RouteNames.Conversation, {
      chatId,
      chatScope: chatScopeFilter,
      title,
    });
  };

  /**
   * Render the avatar for a conversation
   * @param {Chat} chat
   * @returns {import('react').ReactElement} The rendered avatar
   */
  const renderConversationAvatar = (chat) => {
    switch (chat.type) {
      case 'club':
        return (
          <ClubLogoMark
            club={chat?.club}
            isNeutral
            size={48}
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
            <Text style={{ fontSize: 20 }}>{'\uD83C\uDFC6'}</Text>
          </View>
        );
      case 'multisport':
        return (
          <ClubLogoMark
            club={chat?.multisportClub}
            isNeutral
            size={48}
          />
        );
      case 'team':
        return (
          <ClubLogoMark
            club={chat?.team}
            name={chat?.team?.club?.name || chat?.team?.name}
            size={48}
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
  const [pendingChatAction, setPendingChatAction] = useState({ chatId: '', type: '' });
  const genericErrorMessage = t('APIerrors.generic', 'Une erreur est survenue. Veuillez reessayer plus tard.');

  const resolveMessagingErrorMessage = (sourceError, fallbackMessage = '') => {
    const resolvedMessage = getErrorMessage(sourceError, 'generic');
    if (fallbackMessage && resolvedMessage === genericErrorMessage) {
      return fallbackMessage;
    }
    return resolvedMessage || fallbackMessage || genericErrorMessage;
  };

  const showMessagingAlert = (message, fallbackMessage = '') => {
    const safeMessage = String(resolveMessagingErrorMessage(message, fallbackMessage) || '').trim();
    if (!safeMessage) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(safeMessage);
      return;
    }

    Alert.alert(t('messaging.title', 'Messagerie'), safeMessage);
  };

  const filteredChats = useMemo(() => {
    const scopeFilteredChats = allChats.filter((chat) => {
      if (chatScopeFilter === 'league') return isLeagueChat(chat);
      if (chatScopeFilter === 'classic') return !isLeagueChat(chat);
      return true;
    });

    if (!searchQuery) return scopeFilteredChats;
    const lowerQuery = searchQuery.toLowerCase();

    return scopeFilteredChats.filter((chat) => {
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
  }, [allChats, chatScopeFilter, searchQuery, getConversationName, userData]);

  const getEmptyListMessage = () => {
    if (searchQuery.trim()) {
      return t('messaging.noSearchResults', 'Aucune conversation trouvee.');
    }

    if (chatScopeFilter === 'league') {
      return t('messaging.noLeagueData', 'Aucune conversation League.');
    }

    if (chatScopeFilter === 'classic') {
      return t('messaging.noClassicData', 'Aucune conversation classique.');
    }

    return t('messaging.noData');
  };

  const renderChatScopeFilter = () => (
    <View
      style={[Alignments.alignCenter, Alignments.fullWidth, Spaces.marginBottom[16]]}
    >
      <SegmentedControl
        onChange={setChatScopeFilter}
        options={chatScopeOptions}
        value={chatScopeFilter}
      />
    </View>
  );

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
          if (isPinned) {
            unpinChatAsync(chat.documentId).catch((actionError) => {
              showMessagingAlert(actionError, t('messaging.unpinError', 'Impossible de désépingler cette conversation.'));
            });
          } else {
            pinChatAsync(chat.documentId).catch((actionError) => {
              showMessagingAlert(actionError, t('messaging.pinError', "Impossible d'épingler cette conversation."));
            });
          }
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
      onPress={() => archiveChatAsync(chat.documentId).catch((actionError) => {
        showMessagingAlert(actionError, t('messaging.archiveError', "Impossible d'archiver cette conversation."));
      })}
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

  const handleTogglePin = async (/** @type {Chat} */ chat) => {
    const chatId = String(chat?.documentId || '').trim();
    if (!chatId) return;

    const isPinned = chat.pinnedBy?.some((u) => u.documentId === userData?.documentId);
    setPendingChatAction({ chatId, type: 'pin' });

    try {
      if (isPinned) {
        await unpinChatAsync(chatId);
      } else {
        await pinChatAsync(chatId);
      }
    } catch (actionError) {
      showMessagingAlert(
        actionError,
        isPinned
          ? t('messaging.unpinError', 'Impossible de desepingler cette conversation.')
          : t('messaging.pinError', "Impossible d'epingler cette conversation."),
      );
    } finally {
      setPendingChatAction({ chatId: '', type: '' });
    }
  };

  const handleArchive = async (/** @type {Chat} */ chat) => {
    const chatId = String(chat?.documentId || '').trim();
    if (!chatId) return;

    setPendingChatAction({ chatId, type: 'archive' });

    try {
      await archiveChatAsync(chatId);
    } catch (actionError) {
      showMessagingAlert(actionError, t('messaging.archiveError', "Impossible d'archiver cette conversation."));
    } finally {
      setPendingChatAction({ chatId: '', type: '' });
    }
  };

  const renderWebChatActions = (/** @type {Chat} */ chat) => {
    if (!isWeb) return null;

    const chatId = String(chat?.documentId || '').trim();
    const isPinned = chat.pinnedBy?.some((u) => u.documentId === userData?.documentId);
    const isPendingAction = pendingChatAction.chatId === chatId;
    const isPinPending = isPendingAction && pendingChatAction.type === 'pin';
    const isArchivePending = isPendingAction && pendingChatAction.type === 'archive';
    let pinActionLabel = t('messaging.pin', 'Epingler');
    if (isPinned) {
      pinActionLabel = t('messaging.unpin', 'Desepingler');
    }
    if (isPinPending) {
      pinActionLabel = t('common.loading', 'Chargement...');
    }

    return (
      <View
        style={[
          Alignments.row,
          Alignments.justifyEnd,
          Alignments.alignCenter,
          Spaces.gap[8],
          Spaces.marginTop[12],
        ]}
      >
        <TouchableOpacity
          disabled={isPendingAction}
          onPress={() => handleTogglePin(chat)}
          style={[
            ApplicationStyle.borderRadius16,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            {
              backgroundColor: Colors.primary700,
              opacity: isPendingAction ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
            {pinActionLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={isPendingAction}
          onPress={() => handleArchive(chat)}
          style={[
            ApplicationStyle.borderRadius16,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            {
              backgroundColor: Colors.error500,
              opacity: isPendingAction ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
            {isArchivePending ? t('common.loading', 'Chargement...') : t('messaging.archive', 'Archiver')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderErrorState = () => (
    <View style={[
      ApplicationStyle.backgroundColor.primary900,
      ApplicationStyle.borderRadius32,
      Alignments.alignCenter,
      Spaces.gap[16],
      Spaces.paddingHorizontal[16],
      Spaces.paddingVertical[24],
      Spaces.marginVertical[24],
    ]}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter]}>
        {resolveMessagingErrorMessage(error, t('messaging.loadError', 'Impossible de charger les conversations.'))}
      </Text>
      <TouchableOpacity
        disabled={isLoading}
        onPress={() => refetch()}
        style={[
          ApplicationStyle.borderRadius24,
          Spaces.paddingHorizontal[16],
          Spaces.paddingVertical[8],
          {
            backgroundColor: Colors.primary500,
            opacity: isLoading ? 0.6 : 1,
          },
        ]}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>
          {t('common.retry', 'R\u00E9essayer')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render a chat item
   * @param {{ item: Chat }} param - The chat item
   * @returns {import('react').ReactElement} The rendered chat item
   */
  const renderChat = ({ item: chat }) => {
    const chatIsLeague = isLeagueChat(chat);
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
    } else if (chatIsLeague) {
      chatBackgroundStyle = { backgroundColor: 'rgba(212, 175, 55, 0.1)' };
    }

    return (
      <Swipeable
        renderLeftActions={(p, d) => renderLeftActions(p, d, chat)}
        renderRightActions={(p, d) => renderRightActions(p, d, chat)}
      >
        <TouchableOpacity
          onPress={() => handleChatPress(chat)}
          style={[
            ApplicationStyle.borderRadius2,
            Spaces.padding[16],
            Spaces.marginBottom[8],
            chatBackgroundStyle,
            isPinned && { borderLeftColor: Colors.primary500, borderLeftWidth: 4 },
            chatIsLeague && { borderLeftColor: Colors.gold500, borderLeftWidth: 4 },
          ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
            <TouchableOpacity
              onPress={() => handleChatPress(chat)}
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
                {chatIsLeague && (
                <View style={{
                  backgroundColor: Colors.gold500,
                  borderRadius: 4,
                  marginLeft: 8,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
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
                  <Text style={[Fonts.p4Bold, { color: Colors.neutral900, fontSize: 10 }]}>ÉPINGLÉ</Text>
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
          {renderWebChatActions(chat)}
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
        {getEmptyListMessage()}
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
            {renderChatScopeFilter()}
            {renderSearch()}
            {isLoading && (
              <WithDataWrapper
                isLoading
                wrapperStyle={[Alignments.fill]}
              >
                <View style={[
                  Alignments.fill,
                  ApplicationStyle.borderRadius2]}
                >
                  <FlashList
                    contentContainerStyle={{ paddingBottom: chatListBottomInset }}
                    data={filteredChats}
                    estimatedItemSize={92}
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
            )}
            {!isLoading && error && renderErrorState()}
            {!isLoading && !error && (
              <View style={[
                Alignments.fill,
                ApplicationStyle.borderRadius2]}
              >
                <FlashList
                  contentContainerStyle={{ paddingBottom: chatListBottomInset }}
                  data={filteredChats}
                  estimatedItemSize={92}
                  keyExtractor={(item) => item.documentId}
                  ListEmptyComponent={renderEmptyList}
                  onEndReached={() => hasNextPage && fetchNextPage()}
                  onEndReachedThreshold={0.5}
                  onRefresh={refetch}
                  refreshing={isFetching && !isLoading}
                  renderItem={renderChat}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}
          </View>
        </OnboardingWrapper>

        {canCreateConversation ? (
          <WebFloatingOverlay
            style={getFloatingActionContainerStyle(floatingButtonBottom, { zIndex: 1100 })}
          >
            <TouchableOpacity
              accessibilityLabel={t('messaging.newConversation', 'Nouvelle conversation')}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(RouteNames.NewConversation, {
                chatScope: chatScopeFilter,
              })}
              style={[
                ApplicationStyle.shadow200,
                {
                  alignItems: 'center',
                  backgroundColor: Colors.primary500,
                  borderColor: 'rgba(255,255,255,0.18)',
                  borderRadius: 32,
                  borderWidth: 1,
                  elevation: 8,
                  height: 64,
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: {
                    height: 6,
                    width: 0,
                  },
                  shadowOpacity: 0.32,
                  shadowRadius: 12,
                  width: 64,
                },
              ]}
            >
              <Image
                resizeMode="contain"
                source={Images.envelope}
                style={{
                  // Icone sur fond primary500 : encre primary900 (cf. THEME.md).
                  height: 24,
                  tintColor: Colors.primary900,
                  width: 24,
                }}
              />
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: Colors.primary200,
                  borderColor: 'rgba(255,255,255,0.36)',
                  borderRadius: 999,
                  borderWidth: 1,
                  height: 20,
                  justifyContent: 'center',
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  width: 20,
                }}
              >
                <Image
                  resizeMode="contain"
                  source={Images.plus}
                  style={{
                    height: 10,
                    tintColor: Colors.primary900,
                    width: 10,
                  }}
                />
              </View>
            </TouchableOpacity>
          </WebFloatingOverlay>
        ) : null}
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}
export default Messaging;
