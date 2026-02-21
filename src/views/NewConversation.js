import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, SectionList, Text, TextInput, TouchableOpacity, View, FlatList,
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

/**
 * @typedef {import('@/domains/auth/types').User} User
 * @typedef {import('@/domains/team/types').Team} Team
 * @typedef {{ documentId?: string; name?: string }} TeamFilter
 */

// Simple service to search users
/**
 * @param {{ query: string; clubId?: string; multisportId?: string }} params
 * @returns {Promise<User[]>}
 */
const searchUsers = async ({ query, clubId, multisportId }) => {
  // Strict scope check: Must have at least one scope to search
  if (!clubId && !multisportId) {
      return [];
  }

  const nameFilters = [
        { firstname: { $containsi: query } },
        { lastname: { $containsi: query } },
        { username: { $containsi: query } },
  ];

  let filters = {};

  if (multisportId) {
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
                       { trainedTeams: { club: { parentMultisport: { documentId: { $eq: multisportId } } } } }
                   ]
               }
           ]
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
                       { trainedTeams: { club: { documentId: { $eq: clubId } } } }
                   ]
               }
           ]
       };
  }

  const { data } = await client.get('/users', {
    params: {
      filters,
      populate: ['avatar', 'club', 'role', 'myTeams', 'trainedTeams'],
      start: 0,
      limit: 100,
    },
  });
  return /** @type {User[]} */ (data || []);
};

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any> }} props
 */
const NewConversation = ({ navigation }) => {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { userData, allMyTeams } = useAuth();
  const { startWhisperChat } = useMessaging();
  
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
    // Combine myTeams (active player) and trainedTeams (coach)
    // Assuming userData is populated with these, or useAuth provides them.
    // 'allMyTeams' from useAuth is a good candidate if available.
    return /** @type {TeamFilter[]} */ (allMyTeams || []);
  }, [allMyTeams]);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', 'search', searchQuery, clubId],
    queryFn: async () => {
        const res = await searchUsers({ query: searchQuery, clubId, multisportId });
        console.log('[NewConversation] searchUsers result count:', res?.length);
        console.log('[NewConversation] multisportId used:', multisportId);
        return res;
    },
    enabled: true,
  });

  const processedSections = useMemo(() => {
     if (!users) return [];
     
     // 1. Filter out self
     let filtered = users.filter((/** @type {User} */ u) => u.documentId !== userData?.documentId);

     // 2. Filter by Team if selected
     if (selectedTeamId) {
         filtered = filtered.filter((/** @type {User} */ u) => {
             const userTeams = [...(u.myTeams || []), ...(u.trainedTeams || [])];
             return userTeams.some((/** @type {Team} */ team) => team.documentId === selectedTeamId);
         });
     }

     // 3. Group by Role
     const sectionsObj = {
         'Dirigeant': [],
         'Entraineur': [],
         'Joueur': [],
         'Autre': []
     };

     filtered.forEach((/** @type {User} */ u) => {
         const roleName = u.role?.name;
         // Map API roles to Display Sections
         if (roleName === 'Dirigeant' || roleName === 'President' || roleName === 'ClubAdmin') {
             sectionsObj['Dirigeant'].push(u);
         } else if (roleName === 'Entraineur' || roleName === 'Coach') {
             sectionsObj['Entraineur'].push(u);
         } else if (roleName === 'Joueur' || roleName === 'Player') {
             sectionsObj['Joueur'].push(u);
         } else {
             sectionsObj['Autre'].push(u);
         }
     });

     // Convert to SectionList format
     const sections = [
         { title: 'Dirigeants', data: sectionsObj['Dirigeant'] },
         { title: 'Entraîneurs', data: sectionsObj['Entraineur'] },
         { title: 'Joueurs', data: sectionsObj['Joueur'] },
         { title: 'Autres', data: sectionsObj['Autre'] }
     ].filter(s => s.data.length > 0);

     return sections;
  }, [users, userData, selectedTeamId]);

  const toggleSelection = (/** @type {User} */ user) => {
      const userId = user.documentId || '';
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
        const participants = [userData.documentId, ...Array.from(selectedUserIds)];
        const chat = await startWhisperChat(participants);
        if (chat) {
            navigation.replace(RouteNames.Conversation, { chatId: chat.documentId });
        }
    } catch (error) {
        console.error("Failed to create chat", error);
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
     const isSelected = selectedUserIds.has(item.documentId || '');
     return (
        <TouchableOpacity 
           onPress={() => toggleSelection(item)}
           style={[
              Alignments.row, 
              Alignments.alignCenter, 
              Spaces.padding[12], 
              ApplicationStyle.borderRadius16,
              Spaces.marginBottom[8],
              isSelected ? { backgroundColor: 'rgba(255, 255, 255, 0.1)' } : {}
           ]}
        >
            <ProfileAvatar imageUrl={item.avatar?.url} size={48} />
            <View style={[Spaces.marginLeft[12], Alignments.fill]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {item.firstname} {item.lastname}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                    {item.role?.name || t('common.member')}
                </Text>
            </View>
            <View style={{ 
                width: 24, height: 24, borderRadius: 12, 
                backgroundColor: isSelected ? Colors.primary500 : 'transparent', 
                borderWidth: isSelected ? 0 : 2,
                borderColor: isSelected ? 'transparent' : Colors.neutral500,
                alignItems: 'center', justifyContent: 'center' 
            }}>
                {isSelected && <Text style={{ color: 'white', fontSize: 14 }}>✓</Text>}
            </View>
        </TouchableOpacity>
     );
  };

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
                {t('messaging.newConversation', 'Nouvelle discussion')}
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
            Spaces.gap[12]
        ]}>
            <Image 
                source={Images.search} 
                style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral300]} 
            />
            <TextInput
                placeholder={t('messaging.searchUserPlaceholder', 'Rechercher un membre...')}
                placeholderTextColor={Colors.neutral300}
                style={[Fonts.p2, { flex: 1, color: Colors.neutral00, padding: 0 }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
        </View>

        {/* Team Filters */}
        {accessibleTeams.length > 0 && (
             <View>
                 <FlatList
                    horizontal
                    data={[{ documentId: null, name: 'Tous' }, ...accessibleTeams]}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={Spaces.gap[8]}
                    keyExtractor={(item) => item.documentId || item.name || 'all'}
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
                                        borderWidth: 1,
                                        borderColor: isSelected ? Colors.primary500 : Colors.neutral700
                                    }
                                ]}
                            >
                                <Text style={[
                                    Fonts.p3Bold, 
                                    { color: isSelected ? Colors.neutral900 : Colors.neutral00 }
                                ]}>
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    }}
                 />
             </View>
        )}

        {/* User List */}
        <View style={Alignments.fill}>
            {isLoading ? (
                <Loader />
            ) : (
                <SectionList
                    sections={processedSections}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    keyExtractor={(item) => item.documentId || Math.random().toString()}
                    contentContainerStyle={Spaces.paddingBottom[80]}
                    stickySectionHeadersEnabled={false}
                    ListEmptyComponent={
                        <Text style={[Fonts.p2, Fonts.neutral500, Fonts.textCenter, Spaces.marginTop[32]]}>
                            {t('common.noResults', 'Aucun membre trouvé')}
                        </Text>
                    }
                />
            )}
        </View>

        {/* Create Button */}
        {selectedUserIds.size > 0 && (
            <View style={{
                position: 'absolute',
                bottom: 20,
                left: 20,
                right: 20,
            }}>
                <Button 
                    variant="Primary" 
                    title={selectedUserIds.size > 1 
                        ? t('messaging.createGroup', `Créer un groupe (${selectedUserIds.size})`) 
                        : t('common.start', 'Démarrer la discussion')}
                    onPress={handleCreate}
                    isLoading={isCreating}
                />
            </View>
        )}

    </ScreenContainer>
  );
};

export default NewConversation;
