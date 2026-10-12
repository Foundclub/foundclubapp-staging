import { useQuery, useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, FlatList, Image, Platform, SectionList, StyleSheet, Text, TextInput, TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  AUTORISATIONS_PAR_DEFAUT,
  autorisationsModifiees,
  resumeDesAutorisations,
} from '@/domains/messaging/autorisationsDuGroupe';
import { choisirLaPhotoDuGroupe } from '@/domains/messaging/photoDuGroupe';
import { libelleDuRole } from '@/domains/messaging/roleDuMembre';
import { estUneRouteAbsente } from '@/domains/messaging/routesDuServeur1B';
import useMessaging from '@/domains/messaging/useMessaging';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import Loader from '@/components/atoms/loader/Loader';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminsDuGroupe from '@/views/chat/AdminsDuGroupe';
import AutorisationsDuGroupe from '@/views/chat/AutorisationsDuGroupe';
import FeuillePhotoDuGroupe from '@/views/chat/FeuillePhotoDuGroupe';

import { RouteNames } from '@/navigation/routeNames';

import { useGetChatById } from '@/services/chat/chatQueriesCompat';
import { setGroupPhoto } from '@/services/chat/groupPhotoService';
import client from '@/services/client';

import { getErrorMessage } from '@/utils/errors/displayError';
import { createLogger } from '@/utils/logger/logger';

const newConversationLogger = createLogger('new-conversation');
const isFlagEnabled = (rawValue, defaultValue = false) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') return defaultValue;
  const normalized = String(rawValue).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};
const isGroupChatEnabled = isFlagEnabled(process.env.FC_CHAT_GROUP_V1, true);

/**
 * @typedef {import('@/domains/auth/types').User} User
 * @typedef {import('@/domains/team/types').Team} Team
 * @typedef {{ documentId?: string; name?: string }} TeamFilter
 */

/**
 * @param {TeamFilter & { id?: string | number } | undefined | null} team
 * @returns {string}
 */
const getTeamIdentifier = (team) => {
  const documentId = typeof team?.documentId === 'string' ? team.documentId.trim() : '';
  if (documentId) return documentId;
  if (team?.id !== undefined && team?.id !== null) return String(team.id);
  return '';
};

/**
 * @param {User | undefined | null} user
 * @returns {string}
 */
const getUserIdentifier = (user) => {
  const documentId = typeof user?.documentId === 'string' ? user.documentId.trim() : '';
  if (documentId) return documentId;
  if (user?.id !== undefined && user?.id !== null) return String(user.id);
  return '';
};

// Simple service to search users
/**
 * @param {{ query: string; clubId?: string; multisportId?: string; isSuperAdmin?: boolean }} params
 * @returns {Promise<User[]>}
 */
const searchUsers = async ({
  clubId,
  isSuperAdmin = false,
  multisportId,
  query,
}) => {
  const normalizedQuery = String(query || '').trim();

  // Strict scope check: Must have at least one scope to search
  if (!isSuperAdmin && !clubId && !multisportId) {
    return [];
  }

  const nameFilters = [
    { firstname: { $containsi: normalizedQuery } },
    { lastname: { $containsi: normalizedQuery } },
    { username: { $containsi: normalizedQuery } },
  ];

  let filters = {};

  if (isSuperAdmin) {
    // SuperAdmin can search globally across all users.
    // If query is empty, keep empty filters to retrieve a paginated global list.
    filters = normalizedQuery ? { $or: nameFilters } : {};
  } else if (multisportId) {
    // Multisport Scope:
    // We want to find users who belong to ANY club that is part of this Multisport entity.
    // This includes:
    // 1. Direct Club members where club.parentMultisport matches
    // 2. Team members where team.club.parentMultisport matches (Player)
    // 3. Team trainers where team.club.parentMultisport matches (Coach)

    filters = {
      $and: [
        { $or: nameFilters },
        {
          $or: [
            { club: { parentMultisport: { documentId: { $eq: multisportId } } } },
            { myTeams: { club: { parentMultisport: { documentId: { $eq: multisportId } } } } },
            { trainedTeams: { club: { parentMultisport: { documentId: { $eq: multisportId } } } } },
          ],
        },
      ],
    };
  } else if (clubId) {
    // Single Club Scope
    filters = {
      $and: [
        { $or: nameFilters },
        {
          $or: [
            { club: { documentId: { $eq: clubId } } },
            { myTeams: { club: { documentId: { $eq: clubId } } } },
            { trainedTeams: { club: { documentId: { $eq: clubId } } } },
          ],
        },
      ],
    };
  }

  const { data } = await client.get('/users', {
    params: {
      filters,
      limit: 100,
      populate: ['avatar', 'club', 'role', 'myTeams', 'trainedTeams'],
      start: 0,
    },
  });
  return /** @type {User[]} */ (data || []);
};

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any>; route?: any }} props
 */
function NewConversation({ navigation, route }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { allMyTeams, clubVerificationSummary, userData } = useAuth();
  const {
    addGroupMembers,
    startGroupChat,
    startWhisperChat,
    updateGroupMeta,
  } = useMessaging();
  const queryClient = useQueryClient();
  const roleType = String(userData?.role?.type || '').trim().toLowerCase();
  const currentRoleName = String(userData?.role?.name || '').trim().toLowerCase();
  const isSuperAdminUser = roleType === 'superadmin' || currentRoleName === 'superadmin';
  const mode = String(route?.params?.mode || '').trim();
  const addMembersChatId = String(route?.params?.chatId || '').trim();
  const isAddMembersMode = mode === 'add_group_members' && Boolean(addMembersChatId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState(/** @type {Set<string>} */ (new Set()));
  const [selectedTeamId, setSelectedTeamId] = useState(/** @type {string | null} */ (null));
  const [isCreating, setIsCreating] = useState(false);
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);
  // 🧭 MSG1A (§3.15) — deux etapes : choisir les membres, puis (2 et plus) nommer le groupe.
  const [etape, setEtape] = useState(/** @type {'choix' | 'nom'} */ ('choix'));
  const [nomDuGroupe, setNomDuGroupe] = useState('');
  // Les personnes choisies, gardees meme quand une recherche les sort de la liste.
  const personnesChoisiesRef = useRef(/** @type {Map<string, User>} */ (new Map()));
  // 🖼️ MSG1BA (§3.15) — la photo, les autorisations et les admins, reglables des la creation.
  const [photoDuGroupe, setPhotoDuGroupe] = useState(
    /** @type {import('@/domains/messaging/photoDuGroupe').PhotoChoisie | null} */ (null),
  );
  const [feuillePhotoVisible, setFeuillePhotoVisible] = useState(false);
  const [autorisations, setAutorisations] = useState(
    /** @type {Record<string, boolean>} */ ({ ...AUTORISATIONS_PAR_DEFAUT }),
  );
  const [pageAutorisations, setPageAutorisations] = useState(false);
  const [pageAdmins, setPageAdmins] = useState(false);
  // Les AUTRES admins choisis (le createur l'est d'office, cote serveur).
  const [adminsChoisis, setAdminsChoisis] = useState(/** @type {string[]} */ ([]));
  // Mode ajout : les membres DEJA dans le groupe sont grises (« Deja dans le groupe »).
  const { data: groupeExistant } = useGetChatById(addMembersChatId, { enabled: isAddMembersMode });
  const dejaMembres = useMemo(() => new Set(
    (/** @type {any} */ (groupeExistant)?.participants || [])
      .map((/** @type {User} */ membre) => getUserIdentifier(membre))
      .filter(Boolean),
  ), [groupeExistant]);
  const genericErrorMessage = t('APIerrors.generic', 'Une erreur est survenue. Merci de réessayer plus tard.');

  const resolveConversationErrorMessage = (sourceError, fallbackMessage = '') => {
    const resolvedMessage = getErrorMessage(sourceError, 'generic');
    if (fallbackMessage && resolvedMessage === genericErrorMessage) {
      return fallbackMessage;
    }
    return resolvedMessage || fallbackMessage || genericErrorMessage;
  };

  // Determine scope
  const clubId = userData?.club?.documentId;
  // Multisport ID can come from being an Admin of it, OR being a member of a Club inside it.
  // Note: Backend populates 'club.parentMultisport', not 'club.multisportClub'
  const multisportId = userData?.multisportClubs?.[0]?.documentId || userData?.club?.parentMultisport?.documentId;

  // Get accessible teams for filtering
  const accessibleTeams = useMemo(() => {
    const sourceTeams = /** @type {Array<TeamFilter & { id?: string | number }>} */ (allMyTeams || []);
    const seenTeamKeys = new Set();
    /** @type {TeamFilter[]} */
    const uniqueTeams = [];

    sourceTeams.forEach((team) => {
      const teamId = getTeamIdentifier(team);
      const teamName = typeof team?.name === 'string' ? team.name.trim() : '';
      const fallbackKey = teamName ? `name:${teamName.toLowerCase()}` : '';
      const dedupeKey = teamId || fallbackKey;
      if (!dedupeKey || seenTeamKeys.has(dedupeKey)) return;

      seenTeamKeys.add(dedupeKey);
      uniqueTeams.push({
        documentId: teamId,
        name: teamName || t('common.team', 'Équipe'),
      });
    });

    return uniqueTeams;
  }, [allMyTeams, t]);

  const teamFilters = useMemo(
    () => [{ documentId: null, name: t('common.all', 'Tous') }, ...accessibleTeams],
    [accessibleTeams, t],
  );

  const {
    data: users,
    error: usersError,
    isLoading,
    refetch,
  } = useQuery({
    enabled: true,
    queryFn: async () => {
      const res = await searchUsers({
        clubId,
        isSuperAdmin: isSuperAdminUser,
        multisportId,
        query: searchQuery,
      });
      newConversationLogger.debug('searchUsers result', {
        count: Array.isArray(res) ? res.length : 0,
        hasMultisportScope: Boolean(multisportId),
        isSuperAdmin: isSuperAdminUser,
      });
      return res;
    },
    queryKey: ['users', 'search', searchQuery, clubId, multisportId, isSuperAdminUser],
  });

  const processedSections = useMemo(() => {
    if (!users) return [];

    // 1. Filter out self and dedupe users by stable identifier
    const currentUserId = getUserIdentifier(userData);
    const seenUserIds = new Set();
    let filtered = users.filter((/** @type {User} */ u) => {
      const userId = getUserIdentifier(u);
      if (!userId || userId === currentUserId || seenUserIds.has(userId)) {
        return false;
      }
      seenUserIds.add(userId);
      return true;
    });

    // 2. Filter by Team if selected
    if (selectedTeamId) {
      filtered = filtered.filter((/** @type {User} */ u) => {
        const userTeams = [...(u.myTeams || []), ...(u.trainedTeams || [])];
        return userTeams.some((/** @type {Team} */ team) => getTeamIdentifier(team) === selectedTeamId);
      });
    }

    // 3. Group by Role
    const sectionsObj = {
      Autre: [],
      Dirigeant: [],
      Entraineur: [],
      Joueur: [],
    };

    filtered.forEach((/** @type {User} */ u) => {
      const userRoleName = u.role?.name;
      // Map API roles to Display Sections
      if (userRoleName === 'Dirigeant' || userRoleName === 'President' || userRoleName === 'ClubAdmin') {
        sectionsObj.Dirigeant.push(u);
      } else if (userRoleName === 'Entraîneur' || userRoleName === 'Coach') {
        sectionsObj.Entraineur.push(u);
      } else if (userRoleName === 'Joueur' || userRoleName === 'Player') {
        sectionsObj.Joueur.push(u);
      } else {
        sectionsObj.Autre.push(u);
      }
    });

    // Convert to SectionList format
    const sections = [
      {
        data: sectionsObj.Dirigeant,
        title: i18next.t('newConversation.sections.managers', 'Dirigeants'),
      },
      {
        data: sectionsObj.Entraineur,
        title: i18next.t('newConversation.sections.coaches', 'Entraîneurs'),
      },
      { data: sectionsObj.Joueur, title: i18next.t('newConversation.sections.players', 'Joueurs') },
      { data: sectionsObj.Autre, title: i18next.t('newConversation.sections.others', 'Autres') },
    ].filter((s) => s.data.length > 0);

    return sections;
  }, [users, userData, selectedTeamId]);

  const toggleSelection = (/** @type {User} */ user) => {
    const userId = getUserIdentifier(user);
    if (!userId || dejaMembres.has(userId)) return;
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
      personnesChoisiesRef.current.delete(userId);
      setAdminsChoisis((avant) => avant.filter((id) => id !== userId));
    } else {
      newSet.add(userId);
      personnesChoisiesRef.current.set(userId, user);
    }
    setSelectedUserIds(newSet);
  };
  const personnesChoisies = Array.from(selectedUserIds)
    .map((userId) => personnesChoisiesRef.current.get(userId))
    .filter(Boolean);
  const nomComplet = (/** @type {any} */ personne) => [personne?.firstname, personne?.lastname]
    .filter(Boolean).join(' ');
  const nomParDefaut = `Groupe (${selectedUserIds.size + 1})`;
  const meId = getUserIdentifier(userData);

  /**
   * Une alerte (le site n'a pas d'`Alert`) — la meme que celle de l'echec de creation.
   * @param {string} message
   * @returns {void}
   */
  const prevenir = (message) => {
    const surLeSite = Platform.OS === 'web' && typeof window !== 'undefined';
    if (surLeSite && typeof window.alert === 'function') {
      window.alert(message);
    } else {
      Alert.alert(t('messaging.title', 'Messagerie'), message);
    }
  };

  // 🖼️ MSG1BA (§3.15) — la photo choisie reste locale jusqu'a la creation du groupe.
  const choisirLaPhoto = async (/** @type {'camera' | 'galerie'} */ source) => {
    const choix = await choisirLaPhotoDuGroupe(source, t);
    if (!choix) return;
    if ('erreur' in choix) {
      prevenir(choix.erreur);
      return;
    }
    setPhotoDuGroupe(choix);
  };

  /**
   * MSG1BA (§3.15) — APRES la creation : les admins choisis (`addAdminIds`, une requete) et la
   * photo (`POST …/group-photo`). Aucun des deux ne bloque l'ouverture du groupe ; la photo
   * refusee contre un serveur d'avant 1B (404) se tait, toute autre erreur se dit.
   * @param {string} chatId
   * @returns {Promise<void>}
   */
  const completerLeGroupe = async (chatId) => {
    if (adminsChoisis.length) {
      try {
        await updateGroupMeta({ chatId, data: { addAdminIds: adminsChoisis } });
      } catch (error) {
        newConversationLogger.warn('Failed to name group admins', error?.message || error);
      }
    }
    if (photoDuGroupe) {
      try {
        await setGroupPhoto(chatId, photoDuGroupe.fichier);
        queryClient.invalidateQueries({ queryKey: ['chats'] });
      } catch (error) {
        if (!estUneRouteAbsente(error)) {
          newConversationLogger.warn('Failed to upload group photo', error?.message || error);
          prevenir(t(
            'newConversation.groupPhotoError',
            'Le groupe est créé, mais sa photo n’a pas pu être envoyée.',
          ));
        }
      }
    }
  };

  const handleCreate = async () => {
    if (selectedUserIds.size === 0 || !userData?.documentId) return;
    setIsCreating(true);
    try {
      const participants = Array.from(selectedUserIds);
      if (isAddMembersMode) {
        await addGroupMembers({
          chatId: addMembersChatId,
          memberIds: participants,
        });
        navigation.goBack();
      } else {
        const shouldCreateGroup = isGroupChatEnabled && participants.length > 1;
        // MSG1BA (§3.15) — seulement ce qui differe des defauts : rien de change = la requete
        // garde exactement sa forme d'avant 1B.
        const permissions = autorisationsModifiees(autorisations);
        const chat = shouldCreateGroup
          ? await startGroupChat({
            // MSG1A (§3.15) — le nom tape a l'etape « Nouveau groupe », sinon « Groupe (N) ».
            groupName: nomDuGroupe.trim() || `Groupe (${participants.length + 1})`,
            participants,
            ...(permissions ? { permissions } : {}),
          })
          : await startWhisperChat(participants);
        if (chat && shouldCreateGroup) {
          await completerLeGroupe(chat.documentId);
        }
        if (chat) {
          navigation.replace(RouteNames.Conversation, { chatId: chat.documentId });
        }
      }
    } catch (error) {
      newConversationLogger.error('Failed to create chat', error?.message || error);
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      const safeMessage = resolveConversationErrorMessage(
        error,
        t('messaging.createConversationError', 'Impossible de démarrer cette conversation.'),
      );
      prevenir(safeMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const renderSectionHeader = (/** @type {{ section: { title: string } }} */ { section: { title } }) => (
    <View style={[Spaces.marginTop[16], Spaces.marginBottom[8]]}>
      <Text style={[Fonts.h4Bold, Fonts.primary500]}>{title.toUpperCase()}</Text>
    </View>
  );

  const renderItem = (/** @type {{ item: User }} */ { item }) => {
    const itemId = getUserIdentifier(item);
    const isSelected = itemId ? selectedUserIds.has(itemId) : false;
    const dejaDansLeGroupe = itemId ? dejaMembres.has(itemId) : false;
    // 🧑 MSG1A (§3.15) — ligne de 64 : avatar 44, nom, role (ou « Deja dans le groupe », grise).
    return (
      <TouchableOpacity
        accessibilityState={{ checked: isSelected, disabled: dejaDansLeGroupe }}
        disabled={dejaDansLeGroupe}
        onPress={() => toggleSelection(item)}
        style={[
          stylesDuChoix.ligne,
          isSelected ? { backgroundColor: withAlpha(Colors.primary500, 0.08) } : null,
          dejaDansLeGroupe ? stylesDuChoix.ligneGrisee : null,
        ]}
      >
        <ProfileAvatar
          imageUrl={item.avatar?.url}
          name={nomComplet(item)}
          size={44}
        />
        <View style={stylesDuChoix.ligneTextes}>
          <Text numberOfLines={1} style={[stylesDuChoix.ligneNom, { color: Colors.neutral00 }]}>
            {nomComplet(item)}
          </Text>
          <Text
            numberOfLines={1}
            style={[stylesDuChoix.ligneSous, { color: withAlpha(Colors.neutral00, 0.58) }]}
          >
            {dejaDansLeGroupe
              ? t('newConversation.alreadyInGroup', 'Déjà dans le groupe')
              : item.role?.name || t('common.member')}
          </Text>
        </View>
        <View style={{
          alignItems: 'center',
          backgroundColor: isSelected ? Colors.primary500 : 'transparent',
          borderColor: isSelected ? 'transparent' : Colors.neutral500,
          borderRadius: 12,
          borderWidth: isSelected ? 0 : 2,
          height: 24,
          justifyContent: 'center',
          width: 24,
        }}
        >
          {/* Coche sur fond primary500 : encre primary900 (cf. THEME.md). */}
          {isSelected && <SvgIcon color={Colors.primary900} height={14} name="check" width={14} />}
        </View>
      </TouchableOpacity>
    );
  };

  // 🧾 MSG1A (§3.15) — la barre du bas ANNONCE le resultat avant qu'on appuie.
  const nombreChoisi = selectedUserIds.size;
  const vaVersLeNom = !isAddMembersMode && isGroupChatEnabled && nombreChoisi > 1;
  /** @type {{ titre: string, sous: string, bouton: string, suivant?: boolean } | null} */
  let appelALAction = null;
  if (nombreChoisi > 0) {
    if (isAddMembersMode) {
      appelALAction = {
        bouton: t('messaging.addMembersCta', `Ajouter (${nombreChoisi})`),
        sous: personnesChoisies.map((personne) => personne?.firstname).filter(Boolean).join(', '),
        titre: t('newConversation.cta.addTitle', 'Ajouter au groupe'),
      };
    } else if (nombreChoisi === 1 || !isGroupChatEnabled) {
      appelALAction = {
        bouton: t('newConversation.cta.start', 'Démarrer'),
        sous: t('newConversation.cta.privateWith', {
          defaultValue: 'avec {{name}}',
          ...SANS_ECHAPPEMENT,
          name: personnesChoisies.map(nomComplet).join(', '),
        }),
        titre: t('newConversation.cta.privateTitle', 'Discussion privée'),
      };
    } else {
      appelALAction = {
        bouton: t('newConversation.cta.next', 'Suivant'),
        sous: t('newConversation.membersPlusYou', {
          count: nombreChoisi,
          defaultValue: '{{count}} membres + vous',
        }),
        suivant: true,
        titre: t('newConversation.newGroup', 'Nouveau groupe'),
      };
    }
  }
  let sousTitreDeLEnTete = isAddMembersMode
    ? t('newConversation.subtitle.add', 'Choisis qui ajouter')
    : t('newConversation.subtitle.rule', '1 personne = privé · 2 et plus = groupe');
  if (nombreChoisi > 0) {
    sousTitreDeLEnTete = t('newConversation.subtitle.selected', {
      count: nombreChoisi,
      defaultValue: '{{count}} sélectionnés',
    });
  }
  const headerTitle = isAddMembersMode
    ? t('messaging.addGroupMembers', 'Ajouter des membres')
    : t('messaging.newConversation', 'Nouvelle discussion');

  let userListContent = (
    <SectionList
      contentContainerStyle={Spaces.paddingBottom[80]}
      keyExtractor={(item, index) => {
        const userId = getUserIdentifier(item);
        return userId ? `user:${userId}` : `user:fallback:${index}`;
      }}
      ListEmptyComponent={(
        <Text style={[Fonts.p2, Fonts.neutral500, Fonts.textCenter, Spaces.marginTop[32]]}>
          {t('common.noResults', 'Aucun membre trouve')}
        </Text>
      )}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      sections={processedSections}
      stickySectionHeadersEnabled={false}
    />
  );

  if (isLoading) {
    userListContent = <Loader />;
  } else if (usersError) {
    userListContent = (
      <View style={[Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter, Spaces.gap[16], Spaces.paddingHorizontal[24]]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter]}>
          {resolveConversationErrorMessage(
            usersError,
            t('messaging.loadUsersError', 'Impossible de charger les membres pour cette conversation.'),
          )}
        </Text>
        <Button
          onPress={() => refetch()}
          title={t('common.retry', 'Réessayer')}
          variant="Primary"
        />
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingBottom[24],
        Spaces.gap[16],
        Alignments.column,
        Alignments.fill,
      ]}
    >
      {/* Header — MSG1A (§3.15) : titre et sous-titre qui disent la regle, puis le compte. */}
      <View style={[Spaces.marginTop[16], Alignments.row, Alignments.alignCenter]}>
        <HeaderBackButton
          onPress={() => (etape === 'nom' ? setEtape('choix') : navigation.goBack())}
        />
        <View style={[Spaces.marginLeft[16], Alignments.fill]}>
          <Text numberOfLines={1} style={[Fonts.h3, Fonts.neutral00]}>
            {etape === 'nom' ? t('newConversation.newGroup', 'Nouveau groupe') : headerTitle}
          </Text>
          <Text
            numberOfLines={1}
            style={[stylesDuChoix.sousTitre, { color: withAlpha(Colors.neutral00, 0.6) }]}
          >
            {etape === 'nom'
              ? t('newConversation.membersPlusYou', {
                count: nombreChoisi,
                defaultValue: '{{count}} membres + vous',
              })
              : sousTitreDeLEnTete}
          </Text>
        </View>
      </View>

      {etape === 'nom' ? (
        <View style={Alignments.fill}>
          {/* 🏷️ MSG1A (§3.15) — l'etape « Nouveau groupe » : le nom (facultatif) part dans
              `groupName`, sans nom on garde « Groupe (N) » et on le dit. La photo et les
              autorisations du pack demandent le serveur : lot MESSAGERIE-1B. */}
          <View style={[stylesDuChoix.carteNom, { backgroundColor: Colors.primary800 }]}>
            {/* 🖼️ MSG1BA (§3.15) — la photo du groupe : toucher l'avatar ouvre la feuille. */}
            <TouchableOpacity
              accessibilityLabel={photoDuGroupe
                ? t('newConversation.changeGroupPhoto', 'Changer la photo du groupe')
                : t('newConversation.addGroupPhoto', 'Ajouter une photo de groupe')}
              accessibilityRole="button"
              onPress={() => setFeuillePhotoVisible(true)}
              testID="nouveau-groupe-photo"
            >
              {photoDuGroupe ? (
                <Image
                  source={{ uri: photoDuGroupe.apercu }}
                  style={stylesDuChoix.photo}
                  testID="nouveau-groupe-photo-apercu"
                />
              ) : (
                <ClubLogoMark name={nomDuGroupe.trim() || 'Groupe'} size={58} />
              )}
              <View
                style={[
                  stylesDuChoix.pastillePhoto,
                  { backgroundColor: Colors.primary500, borderColor: Colors.primary800 },
                ]}
              >
                <GlyphIcon color={Colors.primary900} name="camera" size={14} />
              </View>
            </TouchableOpacity>
            <TextInput
              autoFocus
              maxLength={40}
              onChangeText={setNomDuGroupe}
              placeholder={t('newConversation.groupNamePlaceholder', 'Nom du groupe (facultatif)')}
              placeholderTextColor={withAlpha(Colors.neutral00, 0.5)}
              style={[
                stylesDuChoix.champNom,
                { borderBottomColor: Colors.primary500, color: Colors.neutral00 },
              ]}
              testID="nouveau-groupe-nom"
              value={nomDuGroupe}
            />
          </View>
          <Text style={[stylesDuChoix.aide, { color: withAlpha(Colors.neutral00, 0.6) }]}>
            {t('newConversation.groupNameHint', {
              defaultValue:
                'Sans nom, il s’appellera « {{name}} ». Tu pourras le changer plus tard.',
              ...SANS_ECHAPPEMENT,
              name: nomParDefaut,
            })}
          </Text>
          {/* 🛡️ MSG1BA (§3.15) — les autorisations (et les admins), des la creation. */}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setPageAutorisations(true)}
            style={[stylesDuChoix.ligneAutorisations, { backgroundColor: Colors.primary800 }]}
            testID="nouveau-groupe-autorisations"
          >
            <GlyphIcon color={Colors.primary500} name="shieldCheck" size={22} />
            <View style={stylesDuChoix.barreTextes}>
              <Text style={[stylesDuChoix.ligneNom, { color: Colors.neutral00 }]}>
                {t('conversation.groupPermissions.title', 'Autorisations du groupe')}
              </Text>
              <Text
                numberOfLines={1}
                style={[stylesDuChoix.ligneSous, { color: withAlpha(Colors.neutral00, 0.58) }]}
              >
                {`${resumeDesAutorisations(autorisations, t)} · ${t('newConversation.adminsCount', {
                  count: adminsChoisis.length + 1,
                  defaultValue: '{{count}} admins',
                })}`}
              </Text>
            </View>
            <GlyphIcon color={withAlpha(Colors.neutral00, 0.5)} name="chevronRight" size={20} />
          </TouchableOpacity>
          <Text style={[stylesDuChoix.titreDeSection, { color: withAlpha(Colors.neutral00, 0.6) }]}>
            {t('newConversation.membersCount', {
              count: nombreChoisi + 1,
              defaultValue: 'MEMBRES · {{count}}',
            })}
          </Text>
          <View style={stylesDuChoix.grille}>
            <View style={stylesDuChoix.tuile}>
              <ProfileAvatar
                imageUrl={userData?.avatar?.url}
                name={nomComplet(userData)}
                size={56}
              />
              <Text style={[stylesDuChoix.tuileNom, { color: Colors.neutral00 }]}>
                {t('conversation.header.you', 'Vous')}
              </Text>
              <Text style={[stylesDuChoix.tuileRole, { color: Colors.primary500 }]}>
                {t('newConversation.admin', 'Admin')}
              </Text>
            </View>
            {personnesChoisies.map((personne) => {
              const id = getUserIdentifier(personne);
              return (
                <TouchableOpacity
                  accessibilityLabel={t('newConversation.remove', {
                    defaultValue: 'Retirer {{name}}',
                    ...SANS_ECHAPPEMENT,
                    name: nomComplet(personne),
                  })}
                  key={id}
                  onPress={() => toggleSelection(/** @type {User} */ (personne))}
                  style={stylesDuChoix.tuile}
                  testID={`groupe-retirer-${id}`}
                >
                  <View>
                    <ProfileAvatar
                      imageUrl={personne?.avatar?.url}
                      name={nomComplet(personne)}
                      size={56}
                    />
                    <View
                      style={[
                        stylesDuChoix.retirer,
                        { backgroundColor: Colors.neutral500, borderColor: Colors.chatBackground },
                      ]}
                    >
                      <GlyphIcon color={Colors.neutral00} name="xmark" size={12} />
                    </View>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[stylesDuChoix.tuileNom, { color: Colors.neutral00 }]}
                  >
                    {personne?.firstname || nomComplet(personne)}
                  </Text>
                  {adminsChoisis.includes(id) ? (
                    <Text style={[stylesDuChoix.tuileRole, { color: Colors.primary500 }]}>
                      {t('newConversation.admin', 'Admin')}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
          {nombreChoisi < 2 ? (
            <Text style={[stylesDuChoix.alerte, { color: Colors.chatDanger }]}>
              {t('newConversation.atLeastTwo', 'Ajoute au moins 2 membres pour créer un groupe.')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Search */}
      {etape === 'choix' ? (
        <View style={[
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          Alignments.row,
          Alignments.alignCenter,
          Spaces.paddingHorizontal[16],
          Spaces.paddingVertical[12],
          Spaces.gap[12],
        ]}
        >
          <Image
            source={Images.search}
            style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral300]}
          />
          <TextInput
            onChangeText={setSearchQuery}
            placeholder={t('messaging.searchUserPlaceholder', 'Rechercher un membre...')}
            placeholderTextColor={Colors.neutral300}
            style={[Fonts.p2, { color: Colors.neutral00, flex: 1, padding: 0 }]}
            value={searchQuery}
          />
        </View>
      ) : null}

      {/* Team Filters */}
      {etape === 'choix' && accessibleTeams.length > 0 && (
        <View>
          <FlatList
            contentContainerStyle={Spaces.gap[8]}
            data={teamFilters}
            horizontal
            keyExtractor={(item, index) => {
              const teamId = typeof item.documentId === 'string' && item.documentId.length > 0
                ? item.documentId
                : 'all';
              const teamName = typeof item.name === 'string' ? item.name.trim().toLowerCase() : 'unknown';
              return `team-filter:${teamId}:${teamName}:${index}`;
            }}
            renderItem={(/** @type {{ item: TeamFilter & { documentId?: string | null } }} */ { item }) => {
              const isSelected = selectedTeamId === item.documentId;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedTeamId(item.documentId || null)}
                  style={[
                    Spaces.paddingHorizontal[16],
                    Spaces.paddingVertical[8],
                    ApplicationStyle.borderRadius16,
                    {
                      backgroundColor: isSelected ? Colors.primary500 : Colors.primary700,
                      borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[
                    Fonts.p3Bold,
                    { color: isSelected ? Colors.neutral900 : Colors.neutral00 },
                  ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}
      {/* 👥 MSG1A (§3.15) — le bandeau des choisis : toucher une pastille la retire. */}
      {etape === 'choix' && personnesChoisies.length > 0 ? (
        <FlatList
          contentContainerStyle={stylesDuChoix.bandeau}
          data={personnesChoisies}
          horizontal
          keyExtractor={(personne) => `choisi:${getUserIdentifier(personne)}`}
          renderItem={({ item: personne }) => (
            <TouchableOpacity
              accessibilityLabel={t('newConversation.remove', {
                defaultValue: 'Retirer {{name}}',
                ...SANS_ECHAPPEMENT,
                name: nomComplet(personne),
              })}
              onPress={() => toggleSelection(/** @type {User} */ (personne))}
              style={stylesDuChoix.choisi}
              testID={`selection-retirer-${getUserIdentifier(personne)}`}
            >
              <View>
                <ProfileAvatar
                  imageUrl={personne?.avatar?.url}
                  name={nomComplet(personne)}
                  size={48}
                />
                <View
                  style={[
                    stylesDuChoix.retirer,
                    { backgroundColor: Colors.neutral500, borderColor: Colors.chatBackground },
                  ]}
                >
                  <GlyphIcon color={Colors.neutral00} name="xmark" size={12} />
                </View>
              </View>
              <Text
                numberOfLines={1}
                style={[stylesDuChoix.choisiNom, { color: withAlpha(Colors.neutral00, 0.85) }]}
              >
                {personne?.firstname || nomComplet(personne)}
              </Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
          style={[
            stylesDuChoix.bandeauConteneur,
            { borderBottomColor: withAlpha(Colors.neutral00, 0.06) },
          ]}
        />
      ) : null}

      {/* User List */}
      {etape === 'choix' ? (
        <View style={Alignments.fill}>
          {userListContent}
        </View>
      ) : null}

      {/* 🧾 MSG1A (§3.15) — la barre du bas : ce qui va se passer, puis le bouton. */}
      {etape === 'choix' && appelALAction ? (
        <View
          style={[
            stylesDuChoix.barre,
            { backgroundColor: Colors.chatBar, borderTopColor: withAlpha(Colors.neutral00, 0.06) },
          ]}
        >
          <View style={stylesDuChoix.barreTextes}>
            <Text numberOfLines={1} style={[stylesDuChoix.barreTitre, { color: Colors.neutral00 }]}>
              {appelALAction.titre}
            </Text>
            <Text
              numberOfLines={1}
              style={[stylesDuChoix.barreSous, { color: withAlpha(Colors.neutral00, 0.6) }]}
            >
              {appelALAction.sous}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={isCreating}
            onPress={vaVersLeNom ? () => setEtape('nom') : handleCreate}
            style={[
              stylesDuChoix.pilule,
              { backgroundColor: Colors.primary500 },
              isCreating ? stylesDuChoix.piluleEteinte : null,
            ]}
            testID="nouvelle-discussion-valider"
          >
            <Text
              style={[stylesDuChoix.piluleTexte, { color: Colors.primary900 }]}
            >
              {appelALAction.bouton}
            </Text>
            {appelALAction.suivant ? (
              <GlyphIcon color={Colors.primary900} name="chevronRight" size={18} />
            ) : null}
          </TouchableOpacity>
        </View>
      ) : null}
      {etape === 'nom' ? (
        <View
          style={[
            stylesDuChoix.barre,
            { backgroundColor: Colors.chatBar, borderTopColor: withAlpha(Colors.neutral00, 0.06) },
          ]}
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: nombreChoisi < 2 || isCreating }}
            disabled={nombreChoisi < 2 || isCreating}
            onPress={handleCreate}
            style={[
              stylesDuChoix.pilule,
              stylesDuChoix.piluleLarge,
              { backgroundColor: Colors.primary500 },
              nombreChoisi < 2 || isCreating ? stylesDuChoix.piluleEteinte : null,
            ]}
            testID="nouveau-groupe-creer"
          >
            <Text
              style={[
                stylesDuChoix.piluleTexte,
                stylesDuChoix.piluleTexteLarge,
                { color: Colors.primary900 },
              ]}
            >
              {t('newConversation.createGroup', 'Créer le groupe')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 🖼️🛡️ MSG1BA (§3.15) — la feuille photo, les autorisations et les admins (montes
          seulement ouverts : rien ne tourne tant qu'on n'y touche pas). */}
      {feuillePhotoVisible ? (
        <FeuillePhotoDuGroupe
          aPhoto={Boolean(photoDuGroupe)}
          enFenetre
          onChoisir={choisirLaPhoto}
          onClose={() => setFeuillePhotoVisible(false)}
          onSupprimer={() => setPhotoDuGroupe(null)}
          visible
        />
      ) : null}
      {pageAutorisations && !pageAdmins ? (
        <AutorisationsDuGroupe
          admins={[
            {
              avatar: userData?.avatar?.url,
              id: meId,
              nom: t('conversation.header.you', 'Vous'),
              role: libelleDuRole(userData?.role?.name, t),
            },
            ...personnesChoisies
              .filter((personne) => adminsChoisis.includes(getUserIdentifier(personne)))
              .map((personne) => ({
                avatar: personne?.avatar?.url,
                id: getUserIdentifier(personne),
                nom: nomComplet(personne),
                role: libelleDuRole(personne?.role?.name, t),
              })),
          ]}
          enFenetre
          onChanger={(cle, valeur) => setAutorisations((avant) => ({ ...avant, [cle]: valeur }))}
          onClose={() => setPageAutorisations(false)}
          onModifierLesAdmins={() => setPageAdmins(true)}
          valeurs={autorisations}
          visible
        />
      ) : null}
      {pageAdmins ? (
        <AdminsDuGroupe
          adminsInitiaux={[meId, ...adminsChoisis]}
          enFenetre
          meId={meId}
          membres={[
            {
              avatar: userData?.avatar?.url,
              id: meId,
              nom: t('conversation.header.you', 'Vous'),
              role: libelleDuRole(userData?.role?.name, t),
            },
            ...personnesChoisies.map((personne) => ({
              avatar: personne?.avatar?.url,
              id: getUserIdentifier(personne),
              nom: nomComplet(personne),
              role: libelleDuRole(personne?.role?.name, t),
            })),
          ]}
          note={t(
            'newConversation.creatorStaysAdmin',
            'Tu as créé le groupe : tu en restes admin.',
          )}
          onClose={() => setPageAdmins(false)}
          onValider={(admins) => {
            setAdminsChoisis(admins.filter((id) => id !== meId));
            setPageAdmins(false);
          }}
          visible
        />
      ) : null}

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={clubVerificationSummary?.clubDocumentId || userData?.club?.documentId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />

    </ScreenContainer>
  );
}

const stylesDuChoix = StyleSheet.create({
  // MSG1BA (§3.15) — la ligne « Autorisations du groupe » (62 de haut, carte de 18).
  aide: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12.5,
    lineHeight: 18,
    marginHorizontal: 4,
    marginTop: 8,
  },
  alerte: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 18,
    textAlign: 'center',
  },
  bandeau: {
    gap: 12,
    paddingBottom: 12,
    paddingTop: 10,
  },
  bandeauConteneur: {
    borderBottomWidth: 1,
    flexGrow: 0,
  },
  barre: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: -24,
    marginHorizontal: -24,
    paddingBottom: 34,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  barreSous: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
  barreTextes: {
    flex: 1,
    minWidth: 0,
  },
  barreTitre: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
    lineHeight: 20,
  },
  carteNom: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
    padding: 14,
  },
  champNom: {
    borderBottomWidth: 2,
    flex: 1,
    fontFamily: 'Montserrat-Regular',
    fontSize: 16,
    minWidth: 0,
    paddingVertical: 8,
  },
  choisi: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
    width: 58,
  },
  choisiNom: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 11.5,
    lineHeight: 15,
    maxWidth: 58,
  },
  grille: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 18,
  },
  ligne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: 64,
    paddingHorizontal: 8,
  },
  ligneAutorisations: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 14,
    height: 62,
    marginTop: 18,
    paddingHorizontal: 16,
  },
  ligneGrisee: {
    opacity: 0.5,
  },
  ligneNom: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 15.5,
    lineHeight: 20,
  },
  ligneSous: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    lineHeight: 17,
  },
  ligneTextes: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  pastillePhoto: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 2,
    bottom: -2,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    width: 26,
  },
  photo: {
    borderRadius: 29,
    height: 58,
    width: 58,
  },
  pilule: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  piluleEteinte: {
    opacity: 0.4,
  },
  piluleLarge: {
    flex: 1,
    height: 52,
  },
  piluleTexte: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
    lineHeight: 20,
  },
  piluleTexteLarge: {
    fontSize: 16,
  },
  retirer: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: -5,
    top: -3,
    width: 22,
  },
  sousTitre: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12.5,
    lineHeight: 17,
  },
  titreDeSection: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 12,
    letterSpacing: 1,
    lineHeight: 16,
    marginBottom: 14,
    marginHorizontal: 4,
    marginTop: 26,
  },
  tuile: {
    alignItems: 'center',
    gap: 6,
    width: '25%',
  },
  tuileNom: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 12.5,
    lineHeight: 16,
    maxWidth: 76,
  },
  tuileRole: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 11,
    lineHeight: 14,
    marginTop: -4,
  },
});

export default NewConversation;
