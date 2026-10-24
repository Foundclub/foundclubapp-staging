import { FlashList } from '@shopify/flash-list';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  CANAL_VILLE, estMineurConnu, filsDeLaMessagerie, titreDuFil,
} from '@/domains/collectivite/collectiviteCanaux';
import { separerLeFilDAssistance } from '@/domains/messaging/assistance';
import { estUnTeteATete, extraitDuMessageCite } from '@/domains/messaging/habillageDuFil';
import {
  estArchivePourMoi,
  filtrerLesFils,
  formatChatTimestamp,
  getChatLastMessage,
  getChatMessagePreview,
  isLeagueChat,
  trierLesFils,
} from '@/domains/messaging/messagingUseCases';
import { texteDeLaNotice } from '@/domains/messaging/noticesDeGroupe';
import {
  estUneRouteAbsente,
  noterRouteNonLuAbsente,
  routeNonLuAbsente,
} from '@/domains/messaging/routesDuServeur1B';
import useMessaging from '@/domains/messaging/useMessaging';
import { formatThreadUnreadBadge } from '@/domains/messaging/useUnreadMessages';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import {
  hideBlockedChats,
  peutBloquer,
  toBlockedUserIdSet,
} from '@/domains/userBlock/userBlockFilters';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import WebFloatingOverlay from '@/components/atoms/webFloatingOverlay/WebFloatingOverlay';
import { etatDEnvoi } from '@/components/molecules/bulleDuFil/MetaDuMessage';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ApercuDuFil from '@/views/chat/ApercuDuFil';
// IPH09 — les canaux de la Ville appartiennent au contenu defilant de la messagerie.
import AvatarDuFil from '@/views/chat/AvatarDuFil';
import BoiteAssistanceDansMessages from '@/views/chat/BoiteAssistanceDansMessages';
import LigneAssistance from '@/views/chat/LigneAssistance';
import CanauxDeLaVille from '@/views/collectivite/components/CanauxDeLaVille';

import { getFloatingActionContainerStyle } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { useGetChats } from '@/services/chat/chatQueriesCompat';
import { useGetMyBlockedUsers } from '@/services/userBlock/userBlockQueries';

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
  // SUPADM (23/10) — un super-admin lit aussi la boîte commune de l'assistance, ici.
  const estSuperAdmin = getUserRoleKey(userData?.role?.type || userData?.role?.name)
    === 'superAdmin';
  const routeChatScope = route?.params?.chatScope || route?.params?.initialChatScope;
  // COLL-C4A2 (02/10) — l'onglet « Messages » de la Ville (`espace: 'ville'`) ne montre que SES
  // fils : depuis R17-CANAUX (19/10), son canal des dirigeants y est une ligne comme les autres,
  // avec ses conversations privées ; ailleurs, le canal des dirigeants est épinglé en tête.
  const espaceVille = route?.params?.espace === 'ville';
  const villeId = route?.params?.collectiviteId || null;
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
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetChats({
    currentUserClubId: userData?.club?.documentId,
    currentUserId: userData?.documentId,
    currentUserTeamIds: safeTeamIds,
  });

  // MSG2 — l indicateur « tirer pour rafraichir » ne suit QUE le geste de tirer.
  // Branche sur `isFetching`, il s allumait a chaque chargement de fond (page
  // suivante, relecture apres lecture d un fil, retour au premier plan) et
  // poussait la liste sans que personne n ait tire.
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refetch]);
  // Jamais une page de plus pendant qu une page charge : react-query annulerait
  // l appel en vol pour en relancer un.
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const {
    archiveChatAsync, getConversationName, getUnreadStatus,
    joinChat, markChatUnread, pinChatAsync, sendReadReceipt, unarchiveChatAsync, unpinChatAsync,
    updateLastReadMessage,
  } = useMessaging();
  // 👁️ MSG1BA (§3.14) — l'apercu ouvert par un appui long : la ligne, son titre, ses non-lus.
  const [apercu, setApercu] = useState(
    /** @type {{ chat: Chat, epingle: boolean, nonLu: boolean, titre: string } | null} */ (null),
  );
  // Serveur d'avant 1B : « Marquer comme non lu » a deja repondu 404, on ne le propose plus.
  const [nonLuAbsent, setNonLuAbsent] = useState(routeNonLuAbsente);
  const { floatingActionBottomOffset, sceneBottomInset } = useBottomDockLayout();
  const isWeb = Platform.OS === 'web';
  // MSG-VILLE-NOUVELLE (20/10, décisions d’Adel « 1- B » / « 2- A ») — dans l’espace de
  // la Ville, le bouton rond ouvre « Nouvelle conversation » AU NOM DE LA VILLE (ses contacts :
  // membres majeurs de ses clubs et autres gestionnaires), quel que soit le rôle du compte ;
  // ailleurs, la règle d’avant (entraîneur, dirigeant, super-admin).
  const roleQuiOuvreUneConversation = userData?.role?.name === 'Entraîneur'
    || userData?.role?.name === 'Dirigeant'
    || userData?.role?.name === 'SuperAdmin';
  const canCreateConversation = espaceVille ? Boolean(villeId) : roleQuiOuvreUneConversation;
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

  // 🙈 BLOQUER (K4) — les personnes que j ai bloquees, pour retirer leur
  // tete-a-tete de la liste. Une seule requete, partagee avec la fiche d une
  // personne et le menu d une conversation (meme clef react-query).
  const { data: myBlockedRows } = useGetMyBlockedUsers({
    // VILLE-NOTIFS — pas d'appel (403) pour un compte sans role de club.
    enabled: peutBloquer(userData),
  });
  const blockedUserIds = useMemo(() => toBlockedUserIdSet(myBlockedRows), [myBlockedRows]);

  const filsTries = useMemo(() => {
    const chats = chatsData?.pages ? chatsData?.pages?.reduce(
      (acc, page) => acc.concat(page.data || []),
      /** @type {Chat[]} */([]),
    ) : [];

    // 🙈 BLOQUER (K4) — un tete-a-tete avec une personne bloquee quitte la
    // liste. Ce n est pas la barriere (le serveur REFUSE deja d ouvrir ce fil) :
    // sans ca, la ligne resterait affichee et mener a une erreur au premier
    // appui. 🧒 K5 : seuls les fils STRICTEMENT a deux disparaissent — un
    // groupe, un club, une equipe et la discussion a trois du mineur avec son
    // parent restent en place.
    // IPH09 — l ordre (mes epingles, club, dernier message) est partage avec la colonne du
    // site : messagingUseCases.trierLesFils.
    return trierLesFils(
      hideBlockedChats(chats, userData?.documentId, blockedUserIds),
      userData?.documentId,
    );
  }, [blockedUserIds, chatsData?.pages, userData]);
  // 🛟 MSG-SUPPORT (20/10) — la conversation « Assistance FoundClub » quitte les lignes : elle est
  // épinglée à part, en tête, pour tout le monde (LigneAssistance), même avant d'exister.
  const { autres: filsSansAssistance, filDAssistance } = useMemo(
    () => separerLeFilDAssistance(filsTries),
    [filsTries],
  );
  // 🗂️ ARCHIVEES (08/10, « archivées A ») — mes fils archives quittent la liste ; la ligne
  // « Archivées » (README §3.14, prototype `p1a-app.jsx`) les retrouve, et on les y desarchive.
  const allChats = useMemo(
    () => filsSansAssistance.filter((chat) => !estArchivePourMoi(chat, userData?.documentId)),
    [filsSansAssistance, userData?.documentId],
  );
  const filsArchives = useMemo(
    () => filsSansAssistance.filter((chat) => estArchivePourMoi(chat, userData?.documentId)),
    [filsSansAssistance, userData?.documentId],
  );
  const [afficheArchivees, setAfficheArchivees] = useState(false);
  // R17-CANAUX (décision d'Adel « B ») — « Toute la ville » n'est pas montré à un mineur connu.
  const mineur = estMineurConnu(userData);
  const nombreArchivees = useMemo(() => filsDeLaMessagerie(filsArchives, {
    collectiviteId: villeId,
    espaceVille,
    mineur,
    monClubId: userData?.club?.documentId || null,
  }).length, [espaceVille, filsArchives, mineur, userData?.club?.documentId, villeId]);
  // Le dernier fil desarchive : la liste ordinaire revient seule (prototype : `showArch`).
  const enModeArchivees = afficheArchivees && nombreArchivees > 0;
  useEffect(() => {
    if (nombreArchivees === 0) setAfficheArchivees(false);
  }, [nombreArchivees]);
  // La liste arrive par pages de 20, archives melees : la page des archives lit les suivantes.
  useEffect(() => {
    if (enModeArchivees && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [enModeArchivees, fetchNextPage, hasNextPage, isFetchingNextPage]);

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

    const title = titreDuFil(t, { chat, espaceVille }) || getConversationName({
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
      chatType: chat?.type,
      title,
      ...(espaceVille ? { espace: 'ville' } : {}),
    });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [pendingChatAction, setPendingChatAction] = useState({ chatId: '', type: '' });
  const genericErrorMessage = t('APIerrors.generic', 'Une erreur est survenue. Merci de réessayer plus tard.');

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
    const filsAffiches = filsDeLaMessagerie(enModeArchivees ? filsArchives : allChats, {
      collectiviteId: villeId,
      espaceVille,
      mineur,
      monClubId: userData?.club?.documentId || null,
    });
    // SMF — portee puis recherche : regle partagee avec la colonne du site (filtrerLesFils).
    return filtrerLesFils(filsAffiches, {
      nomDuFil: (chat) => titreDuFil(t, { chat, espaceVille }) || getConversationName({
        chatClub: chat.club,
        chatGroupName: chat.groupName,
        chatLeagueMatch: chat.league_match,
        chatMultisportClub: chat.multisportClub,
        chatParticipants: chat.participants,
        chatTeam: chat.team,
        chatType: chat.type,
        meId: userData?.documentId,
      }),
      portee: chatScopeFilter,
      recherche: searchQuery,
    });
  }, [
    allChats, chatScopeFilter, enModeArchivees, espaceVille, filsArchives, searchQuery,
    getConversationName, t, userData, villeId,
  ]);

  const getEmptyListMessage = () => {
    if (searchQuery.trim()) {
      return t('messaging.noSearchResults', 'Aucune conversation trouvée.');
    }

    if (espaceVille) {
      return t(
        'collectiviteCanaux.conversationsVides',
        'Aucune conversation. Un dirigeant qui vous écrit apparaîtra ici.',
      );
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

  // 🗂️ ARCHIVEES (§3.14, prototype `p1a-app.jsx`) — la ligne « Archivées » en tete de liste, des
  // qu un fil est archive : elle bascule la liste sur les archives (« Retour aux discussions »).
  // Son icone tient dans la colonne des avatars (52), son libelle s aligne sur les titres.
  const renderLigneArchivees = () => (nombreArchivees > 0 ? (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => setAfficheArchivees(!enModeArchivees)}
      style={stylesDeLaListe.ligneArchivees}
      testID="liste-archivees"
    >
      <View style={stylesDeLaListe.iconeArchivees}>
        <GlyphIcon color={withAlpha(Colors.neutral00, 0.7)} name="boxArchive" size={20} />
      </View>
      <Text style={[stylesDeLaListe.libelleArchivees, { color: Colors.neutral00 }]}>
        {enModeArchivees
          ? t('messaging.archivedBack', 'Retour aux discussions')
          : t('messaging.archived', 'Archivées')}
      </Text>
      <Text
        style={[stylesDeLaListe.heure, { color: withAlpha(Colors.neutral00, 0.5) }]}
        testID="liste-archivees-compte"
      >
        {String(nombreArchivees)}
      </Text>
    </TouchableOpacity>
  ) : null);

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

  // ARCHIVEES — « Archiver » sur un fil ordinaire, « Désarchiver » sur un fil archive.
  const libelleArchive = (/** @type {Chat} */ chat) => (estArchivePourMoi(chat, userData?.documentId)
    ? t('messaging.unarchive', 'Désarchiver')
    : t('messaging.archive', 'Archiver'));

  const renderRightActions = (/** @type {any} */ progress, /** @type {any} */ dragX, /** @type {Chat} */ chat) => (
    <TouchableOpacity
      onPress={() => handleArchive(chat)}
      style={{
        alignItems: 'center',
        backgroundColor: estArchivePourMoi(chat, userData?.documentId)
          ? Colors.primary700
          : Colors.error500, // Or warning color
        borderRadius: 2,
        justifyContent: 'center',
        marginBottom: 8,
        width: 80,
      }}
      testID={`liste-fil-${chat.documentId}-glisser`}
    >
      <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
        {libelleArchive(chat)}
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
          ? t('messaging.unpinError', 'Impossible de désépingler cette conversation.')
          : t('messaging.pinError', "Impossible d'épingler cette conversation."),
      );
    } finally {
      setPendingChatAction({ chatId: '', type: '' });
    }
  };

  // ARCHIVEES — le meme geste archive un fil ordinaire et desarchive un fil archive.
  const handleArchive = async (/** @type {Chat} */ chat) => {
    const chatId = String(chat?.documentId || '').trim();
    if (!chatId) return;

    const archive = estArchivePourMoi(chat, userData?.documentId);
    setPendingChatAction({ chatId, type: 'archive' });

    try {
      if (archive) await unarchiveChatAsync(chatId);
      else await archiveChatAsync(chatId);
    } catch (actionError) {
      showMessagingAlert(actionError, archive
        ? t('messaging.unarchiveError', 'Impossible de désarchiver cette conversation.')
        : t('messaging.archiveError', "Impossible d'archiver cette conversation."));
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
    let pinActionLabel = t('messaging.pin', 'Épingler');
    if (isPinned) {
      pinActionLabel = t('messaging.unpin', 'Désépingler');
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
              backgroundColor: estArchivePourMoi(chat, userData?.documentId)
                ? Colors.primary700
                : Colors.error500,
              opacity: isPendingAction ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
            {isArchivePending ? t('common.loading', 'Chargement...') : libelleArchive(chat)}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * MSG1BA (§3.14) — le menu de l'apercu : « Marquer comme lu / non lu », « Épingler »,
   * « Archiver » (ces deux-la sont les gestes deja proposes en glissant la ligne).
   * @param {{ chat: Chat, epingle: boolean, nonLu: boolean }} ligne
   * @returns {import('@/views/chat/ApercuDuFil').EntreeDeLApercu[]}
   */
  const entreesDeLApercu = ({ chat, epingle, nonLu }) => {
    const chatId = String(chat?.documentId || '').trim();
    /** @type {import('@/views/chat/ApercuDuFil').EntreeDeLApercu[]} */
    const entrees = [];
    if (nonLu) {
      entrees.push({
        cle: 'marquer-lu',
        icone: 'checkDouble',
        libelle: t('messaging.preview.markRead', 'Marquer comme lu'),
        // Le « lu » local (pastille immediate) ET le curseur du serveur (`read-message`).
        onPress: () => {
          updateLastReadMessage(chatId);
          sendReadReceipt(chatId);
        },
      });
    } else if (!nonLuAbsent) {
      entrees.push({
        cle: 'marquer-non-lu',
        icone: 'envelope',
        libelle: t('messaging.preview.markUnread', 'Marquer comme non lu'),
        onPress: async () => {
          try {
            await markChatUnread(chatId);
          } catch (actionError) {
            if (estUneRouteAbsente(actionError)) {
              // Serveur d'avant 1B : pas d'erreur rouge, le geste disparait.
              noterRouteNonLuAbsente();
              setNonLuAbsent(true);
              return;
            }
            showMessagingAlert(actionError, t(
              'messaging.preview.markUnreadError',
              'Impossible de marquer cette conversation comme non lue.',
            ));
          }
        },
      });
    }
    // R17-CANAUX — « Toute la ville » : ni épingler ni archiver (le serveur ne rend à personne
    // qui l'a fait : ce serait la liste de ses lecteurs).
    if (chat?.type === CANAL_VILLE) return entrees;
    entrees.push({
      cle: 'epingler',
      icone: 'thumbtack',
      libelle: epingle ? t('messaging.unpin', 'Désépingler') : t('messaging.pin', 'Épingler'),
      onPress: () => handleTogglePin(chat),
    });
    entrees.push({
      cle: estArchivePourMoi(chat, userData?.documentId) ? 'desarchiver' : 'archiver',
      icone: 'boxArchive',
      libelle: libelleArchive(chat),
      onPress: () => handleArchive(chat),
    });
    return entrees;
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
        testID="messaging-retry"
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>
          {t('common.retry', 'Réessayer')}
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
    // AC05 — le message le PLUS RÉCENT, choisi sur sa date : `messages[0]`
    // supposait un ordre que le contrat serveur ne promet pas.
    const lastMessage = getChatLastMessage(chat);
    const isMyMessage = lastMessage?.sender?.documentId === userData?.documentId;
    // AE06 — le serveur sait combien de MESSAGES sont non lus (il relit le
    // curseur de lecture). Quand il le dit, il gagne sur le « lu » garde en
    // local, qui ne connait que le dernier message.
    // P6-09 : `Number(null)` vaut 0 ; un compteur absent laisse décider le « lu » local.
    const serverUnreadCount = chat?.unreadCount == null ? NaN : Number(chat.unreadCount);
    const hasServerUnreadCount = Number.isFinite(serverUnreadCount);
    const unreadBadge = formatThreadUnreadBadge(serverUnreadCount);
    const hasUnread = hasServerUnreadCount
      ? serverUnreadCount > 0
      : !isMyMessage && (lastMessage && getUnreadStatus(
        chat.documentId,
        new Date(lastMessage.createdAt).toISOString(),
      ));

    const isPinned = chat.pinnedBy?.some((u) => u.documentId === userData?.documentId);
    // 🗂️ MSG1A (§3.13) — la ligne du pack : avatar 52, titre 16, heure (cyan si non lu),
    // apercu 14 avec « Prenom : » dans les fils a plusieurs, coches si c'est moi, icone du
    // contenu riche, epingle et pastille de non-lus cyan. Un SEUL bouton par ligne (l'avatar
    // n'en est plus un second, imbrique).
    const extrait = lastMessage ? extraitDuMessageCite(lastMessage, t) : { icone: '', texte: '' };
    const auteurDuDernier = lastMessage && !isMyMessage && !estUnTeteATete(chat?.type)
      ? String(lastMessage?.sender?.firstname || '').trim()
      : '';
    const sourdine = withAlpha(Colors.neutral00, 0.58);
    const titreDeLaLigne = titreDuFil(t, { chat, espaceVille }) || getConversationName({
      chatClub: chat.club,
      chatGroupName: chat.groupName,
      chatLeagueMatch: chat.league_match,
      chatMultisportClub: chat.multisportClub,
      chatParticipants: chat.participants,
      chatTeam: chat.team,
      chatType: chat.type,
      meId: userData?.documentId,
    });

    // R17-CANAUX — « Toute la ville » : ni glisser pour épingler, ni glisser pour archiver.
    const avecGestes = chat?.type !== CANAL_VILLE;

    return (
      <Swipeable
        renderLeftActions={avecGestes ? (p, d) => renderLeftActions(p, d, chat) : undefined}
        renderRightActions={avecGestes ? (p, d) => renderRightActions(p, d, chat) : undefined}
      >
        <TouchableOpacity
          delayLongPress={450}
          // 👁️ MSG1BA (§3.14) — appui long (450 ms, le pack) : l'apercu, sans marquer comme lu.
          // Au telephone seulement : la liste du site appartient a MESSAGERIE-1W.
          onLongPress={isWeb ? undefined : () => setApercu({
            chat,
            epingle: Boolean(isPinned),
            nonLu: Boolean(hasUnread),
            titre: String(titreDeLaLigne || ''),
          })}
          onPress={() => handleChatPress(chat)}
          style={stylesDeLaListe.ligne}
          testID={`liste-fil-${chat.documentId}`}
        >
          <AvatarDuFil
            chat={chat}
            espaceVille={espaceVille}
            meId={userData?.documentId}
            myTeams={allMyTeams}
            size={52}
          />
          <View
            style={[
              stylesDeLaListe.corps,
              { borderBottomColor: withAlpha(Colors.neutral00, 0.07) },
            ]}
          >
            <View style={stylesDeLaListe.rangee}>
              {/*
                MARQUEE — le nom de la conversation (club, équipe, groupe) se
                lit en entier : c'est lui qui dit à qui on parle.
              */}
              <MarqueeText
                containerStyle={{ flex: 1 }}
                style={[stylesDeLaListe.titre, { color: Colors.neutral00 }]}
                text={titreDeLaLigne}
              />
              {chatIsLeague && (
              <View style={[stylesDeLaListe.puceLigue, { backgroundColor: Colors.gold500 }]}>
                <Text style={[Fonts.p4Bold, { color: Colors.neutral900, fontSize: 10 }]}>LIGUE</Text>
              </View>
              )}
              {/* AC05 — l'heure quand c'est aujourd'hui, le jour sinon. En cyan tant que la
                  conversation n'est pas lue. */}
              {lastMessage ? (
                <Text
                  style={[
                    stylesDeLaListe.heure,
                    hasUnread
                      ? { color: Colors.primary500, fontFamily: 'Montserrat-Bold' }
                      : { color: withAlpha(Colors.neutral00, 0.5) },
                  ]}
                >
                  {formatChatTimestamp(lastMessage.createdAt)}
                </Text>
              ) : null}
            </View>

            {/* Sans dernier message, ni punaise, ni non-lu : pas de seconde ligne vide, le titre
                se centre dans la ligne de 72 (constate sur l'emulateur, 07/10). */}
            {lastMessage || isPinned || hasUnread ? (
              <View style={stylesDeLaListe.rangee}>
                <View style={stylesDeLaListe.apercu}>
                  {lastMessage && isMyMessage ? (
                  // Coches cyan si le serveur dit « lu » (meme regle que la bulle : `etatDEnvoi`).
                    <GlyphIcon
                      color={etatDEnvoi(lastMessage) === 'lu' ? Colors.primary500 : sourdine}
                      name="checkDouble"
                      size={16}
                    />
                  ) : null}
                  {auteurDuDernier ? (
                    <Text
                      style={[
                        stylesDeLaListe.apercuTexte,
                        { color: withAlpha(Colors.neutral00, 0.8) },
                      ]}
                    >
                      {`${auteurDuDernier}\u00A0:`}
                    </Text>
                  ) : null}
                  {extrait.icone ? (
                    <GlyphIcon color={sourdine} name={extrait.icone} size={15} />
                  ) : null}
                  <Text
                    numberOfLines={1}
                    style={[
                      stylesDeLaListe.apercuTexte,
                      stylesDeLaListe.apercuFin,
                      { color: sourdine },
                    ]}
                  >
                    {/* 🔔 MSG1BA (§3.17) — une notice de groupe en apercu : « Vous avez… ». */}
                    {lastMessage?.systemNotice
                      ? texteDeLaNotice(
                        lastMessage.systemNotice,
                        String(userData?.documentId || ''),
                        t,
                        lastMessage.message,
                      )
                      : null}
                    {lastMessage && !lastMessage.systemNotice
                      ? getChatMessagePreview(lastMessage, t)
                      : null}
                  </Text>
                </View>
                {isPinned ? (
                  <View accessibilityLabel={t('messaging.pinnedBadge', 'ÉPINGLÉ')} accessible>
                    <GlyphIcon
                      color={withAlpha(Colors.neutral00, 0.45)}
                      name="thumbtack"
                      size={15}
                    />
                  </View>
                ) : null}
                {hasUnread ? (
                  <View
                    accessibilityLabel={unreadBadge
                      ? `${unreadBadge} ${t('messaging.unread.badge', 'Non lu')}`
                      : t('messaging.unread.badge', 'Non lu')}
                    accessible
                    style={[stylesDeLaListe.pastille, { backgroundColor: Colors.primary500 }]}
                  >
                    {unreadBadge ? (
                      <Text style={[stylesDeLaListe.pastilleTexte, { color: Colors.primary900 }]}>
                        {unreadBadge}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
          {avecGestes ? renderWebChatActions(chat) : null}
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
        <OnboardingWrapper
          description={t(
            'messaging.onboarding.main',
            'Recherche une conversation, ouvre un chat et utilise les actions rapides.',
          )}
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
            {/* IPH09 — un seul defilement : Ville, archives et fils dans la meme FlashList.
                COL-007 (D6 A, pack MSG1A `p1a-app.jsx:83-104`) — le titre, les puces et la
                recherche y defilent aussi ; seule la rangee FOUNDCLUB reste fixe. L en-tete est
                passe en ELEMENT : en fonction, FlashList remonterait le champ a chaque lettre. */}
            <WithDataWrapper isLoading={isLoading} wrapperStyle={[Alignments.fill]}>
              <View style={[Alignments.fill, ApplicationStyle.borderRadius2]}>
                <FlashList
                  contentContainerStyle={{ paddingBottom: chatListBottomInset }}
                  data={error ? [] : filteredChats}
                  keyboardShouldPersistTaps="handled"
                  keyExtractor={(item) => item.documentId}
                  ListEmptyComponent={error ? renderErrorState : renderEmptyList}
                  ListHeaderComponent={(
                    <>
                      {/* MSG1A (§3.13, decision d'Adel « titre Messages ») — 28 en gras. */}
                      <Text
                        style={[
                          stylesDeLaListe.titreDeLaPage,
                          Fonts.neutral00,
                          Spaces.marginTop[16],
                          Spaces.marginBottom[24],
                        ]}
                      >
                        {t('messaging.title')}
                      </Text>
                      {espaceVille ? null : renderChatScopeFilter()}
                      {renderSearch()}
                      <CanauxDeLaVille
                        chats={allChats}
                        collectiviteId={villeId}
                        espaceVille={espaceVille}
                        mineur={mineur}
                        navigation={navigation}
                      />
                      {renderLigneArchivees()}
                      {enModeArchivees ? null : (
                        <LigneAssistance
                          espaceVille={espaceVille}
                          fil={filDAssistance}
                          meId={userData?.documentId}
                          navigation={navigation}
                          onFilCree={() => { refetch(); }}
                        />
                      )}
                      {enModeArchivees || espaceVille || !estSuperAdmin ? null : (
                        <BoiteAssistanceDansMessages navigation={navigation} />
                      )}
                    </>
                  )}
                  onEndReached={error ? undefined : handleEndReached}
                  onEndReachedThreshold={0.5}
                  onRefresh={handlePullRefresh}
                  refreshing={isPullRefreshing}
                  renderItem={renderChat}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </WithDataWrapper>
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
                ...(espaceVille ? { collectiviteId: villeId, espace: 'ville' } : {}),
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
              testID="messaging-nouvelle-conversation"
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
        {apercu ? (
          <ApercuDuFil
            chat={apercu.chat}
            entrees={entreesDeLApercu(apercu)}
            espaceVille={espaceVille}
            meId={String(userData?.documentId || '')}
            myTeams={allMyTeams}
            nonLu={apercu.nonLu}
            onClose={() => setApercu(null)}
            onOuvrir={() => {
              const { chat } = apercu;
              setApercu(null);
              handleChatPress(chat);
            }}
            titre={apercu.titre}
            visible
          />
        ) : null}
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}
const stylesDeLaListe = StyleSheet.create({
  apercu: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
  },
  apercuFin: {
    flexShrink: 1,
  },
  apercuTexte: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    lineHeight: 19,
  },
  corps: {
    alignSelf: 'stretch',
    borderBottomWidth: 1,
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minWidth: 0,
  },
  heure: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12.5,
    lineHeight: 17,
  },
  iconeArchivees: {
    alignItems: 'center',
    width: 52,
  },
  libelleArchivees: {
    flex: 1,
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
    lineHeight: 20,
  },
  ligne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingVertical: 8,
  },
  ligneArchivees: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
  },
  pastille: {
    alignItems: 'center',
    borderRadius: 999,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 6,
  },
  pastilleTexte: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 11.5,
    lineHeight: 14,
  },
  puceLigue: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rangee: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  titre: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
    lineHeight: 21,
  },
  titreDeLaPage: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 28,
    lineHeight: 34,
  },
});

export default Messaging;
