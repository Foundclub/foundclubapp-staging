import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList, Image, SectionList, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import Loader from '@/components/atoms/loader/Loader';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import client from '@/services/client';

import { createLogger } from '@/utils/logger/logger';

const newConversationLogger = createLogger('new-conversation');
const isFlagEnabled = (rawValue, defaultValue = false) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') return defaultValue;
  const normalized = String(rawValue).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};
const isGroupChatEnabled = isFlagEnabled(process.env.FC_CHAT_GROUP_V1, false);

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
  const { allMyTeams, userData } = useAuth();
  const {
    addGroupMembers,
    startGroupChat,
    startWhisperChat,
  } = useMessaging();
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
        name: teamName || t('common.team', 'Equipe'),
      });
    });

    return uniqueTeams;
  }, [allMyTeams, t]);

  const teamFilters = useMemo(
    () => [{ documentId: null, name: t('common.all', 'Tous') }, ...accessibleTeams],
    [accessibleTeams, t],
  );

  const { data: users, isLoading } = useQuery({
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
      } else if (userRoleName === 'Entraineur' || userRoleName === 'Coach') {
        sectionsObj.Entraineur.push(u);
      } else if (userRoleName === 'Joueur' || userRoleName === 'Player') {
        sectionsObj.Joueur.push(u);
      } else {
        sectionsObj.Autre.push(u);
      }
    });

    // Convert to SectionList format
    const sections = [
      { data: sectionsObj.Dirigeant, title: 'Dirigeants' },
      { data: sectionsObj.Entraineur, title: 'Entraîneurs' },
      { data: sectionsObj.Joueur, title: 'Joueurs' },
      { data: sectionsObj.Autre, title: 'Autres' },
    ].filter((s) => s.data.length > 0);

    return sections;
  }, [users, userData, selectedTeamId]);

  const toggleSelection = (/** @type {User} */ user) => {
    const userId = getUserIdentifier(user);
    if (!userId) return;
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
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
        const chat = shouldCreateGroup
          ? await startGroupChat({
            groupName: `Groupe (${participants.length + 1})`,
            participants,
          })
          : await startWhisperChat(participants);
        if (chat) {
          navigation.replace(RouteNames.Conversation, { chatId: chat.documentId });
        }
      }
    } catch (error) {
      newConversationLogger.error('Failed to create chat', error?.message || error);
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
    return (
      <TouchableOpacity
        onPress={() => toggleSelection(item)}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.padding[12],
          ApplicationStyle.borderRadius16,
          Spaces.marginBottom[8],
          isSelected ? { backgroundColor: 'rgba(255, 255, 255, 0.1)' } : {},
        ]}
      >
        <ProfileAvatar imageUrl={item.avatar?.url} size={48} />
        <View style={[Spaces.marginLeft[12], Alignments.fill]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {item.firstname}
            {' '}
            {item.lastname}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {item.role?.name || t('common.member')}
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
          {isSelected && <Text style={{ color: 'white', fontSize: 14 }}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  let createButtonTitle = t('common.start', 'Démarrer la discussion');
  if (isAddMembersMode) {
    createButtonTitle = t('messaging.addMembersCta', `Ajouter (${selectedUserIds.size})`);
  } else if (selectedUserIds.size > 1) {
    createButtonTitle = t('messaging.createGroup', `Créer un groupe (${selectedUserIds.size})`);
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
      {/* Header */}
      <View style={[Spaces.marginTop[16], Alignments.row, Alignments.alignCenter]}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginLeft[16]]}>
          {isAddMembersMode
            ? t('messaging.addGroupMembers', 'Ajouter des membres')
            : t('messaging.newConversation', 'Nouvelle discussion')}
        </Text>
      </View>

      {/* Search */}
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

      {/* Team Filters */}
      {accessibleTeams.length > 0 && (
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

      {/* User List */}
      <View style={Alignments.fill}>
        {isLoading ? (
          <Loader />
        ) : (
          <SectionList
            contentContainerStyle={Spaces.paddingBottom[80]}
            keyExtractor={(item, index) => {
              const userId = getUserIdentifier(item);
              return userId ? `user:${userId}` : `user:fallback:${index}`;
            }}
            ListEmptyComponent={(
              <Text style={[Fonts.p2, Fonts.neutral500, Fonts.textCenter, Spaces.marginTop[32]]}>
                {t('common.noResults', 'Aucun membre trouvé')}
              </Text>
                      )}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            sections={processedSections}
            stickySectionHeadersEnabled={false}
          />
        )}
      </View>

      {/* Create Button */}
      {selectedUserIds.size > 0 && (
        <View style={{
          bottom: 20,
          left: 20,
          position: 'absolute',
          right: 20,
        }}
        >
          <Button
            isLoading={isCreating}
            onPress={handleCreate}
            title={createButtonTitle}
            variant="Primary"
          />
        </View>
      )}

    </ScreenContainer>
  );
}

export default NewConversation;
