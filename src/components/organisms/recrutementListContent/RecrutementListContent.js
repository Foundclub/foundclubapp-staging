import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';

import useTheme from '@/theme/themeContext';
import useAuth from '@/domains/auth/useAuth';
import { USER_ROLES } from '@/domains/auth/authUseCases';
import { RouteNames } from '@/navigation/routeNames';

// Components
import Loader from '@/components/atoms/loader/Loader';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';
import MercatoCard from '@/components/molecules/mercatoCard/MercatoCard';
import RecruitmentAdCard from '@/components/molecules/recruitmentAdCard/RecruitmentAdCard';
// Services
import { searchUsers } from '@/services/user/userService';
import { getRecruitmentAds, getMyRecruitmentAds, getMyApplications } from '@/services/recruitment/recruitmentService';
import { searchRecruitment, mapSearchPayload, getMatchReasonLabel } from '@/services/search/searchService';

import { useAppContext } from '@/store/appContext';

/**
 * @typedef {{ id?: string | number; documentId?: string; [key: string]: any }} MercatoUser
 * @typedef {{ documentId?: string | number; id?: string | number; name?: string }} LevelRef
 * @typedef {{ id?: string | number; level?: LevelRef; [key: string]: any }} RecruitmentAdItem
 */

/**
 * Recrutement List Content - Main component for recruitment marketplace
 * Shows different content based on user role:
 * - Coach/Dirigeant: TopTabs with "Profils" (search players) and "Annonces" (manage ads)
 * - Joueur: Smart feed of recruitment ads matching their profile
 * @param {{ initialTab?: 'profils' | 'annonces' | 'candidatures'; timestamp?: number | string }} props
 */
const RecrutementListContent = ({ initialTab, timestamp }) => {
  const { t } = useTranslation();
  const { Spaces, Fonts, Alignments, Colors } = useTheme();
  const navigation = useNavigation();
  const nav = /** @type {any} */ (navigation);
  const { userData } = useAuth();
  const [{ mercatoFilters }] = useAppContext();
  const roleName = userData?.role?.name;
  const isCoachOrAdmin = roleName === USER_ROLES.coach
    || roleName === USER_ROLES.president
    || roleName === USER_ROLES.superAdmin;
  
  // State
  const [activeTab, setActiveTab] = useState(initialTab || 'profils'); // 'profils' or 'annonces'
  const [users, setUsers] = useState(/** @type {MercatoUser[]} */ ([]));
  const [ads, setAds] = useState(/** @type {RecruitmentAdItem[]} */ ([]));
  const [myAds, setMyAds] = useState(/** @type {RecruitmentAdItem[]} */ ([]));
  const [myApplications, setMyApplications] = useState(/** @type {RecruitmentAdItem[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [adSearchValue, setAdSearchValue] = useState('');

  // Handle external tab switching (e.g. from creation wizard)
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      console.log('[RecrutementListContent] initialTab changed to:', initialTab);
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Handle forced refresh from navigation params (timestamp)
  useEffect(() => {
    if (timestamp) {
      console.log('[RecrutementListContent] Forced refresh triggered by timestamp:', timestamp);
      if (isCoachOrAdmin) {
        if (activeTab === 'annonces') fetchMyAds(true);
        // If activeTab is 'profils', we probably don't need to refresh profiles if coming from ad creation
        // But if user meant to switch tab, the above useEffect handles the switch, 
        // and then the useEffect on [activeTab] handles the fetch.
        // However, if we were ALREADY on 'annonces', useEffect[activeTab] won't fire.
        // So we strictly refresh 'annonces' here if active.
      } else {
         // Player logic if needed
      }
    }
  }, [timestamp, isCoachOrAdmin, activeTab]); // Dependencies: timestamp changes, so it runs.

  // Modal state
  const [selectedTeam, setSelectedTeam] = useState(/** @type {Team | null} */ (null));

  // Gatekeeper: Check if player has required profile fields
  useEffect(() => {
    if (!isCoachOrAdmin && userData) {
      if (!userData.bestLevel || !userData.category) {
        Alert.alert(
          'Profil incomplet',
          'Pour accéder aux annonces de recrutement, renseigne ton meilleur niveau et ta catégorie.',
          [
            { text: 'Plus tard', style: 'cancel' },
            { 
              text: 'Compléter', 
              onPress: () => nav.navigate(RouteNames.ProfileStack, {
                screen: RouteNames.Profile,
              })
            }
          ]
        );
      }
    }
  }, [userData, isCoachOrAdmin, navigation]);

  // Fetch users (for coaches searching players)
  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (!isCoachOrAdmin) return;
    if (!isRefresh) setLoading(true);
    try {
      const data = await searchUsers({
        isLookingForClub: true,
        q: searchValue,
        ...mercatoFilters,
      });
      setUsers(data || []);
    } catch (error) {
      console.error('[RecrutementListContent] Error fetching users:', error);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, [searchValue, mercatoFilters, isCoachOrAdmin]);

  // State for pagination (ads)
  const [adsPage, setAdsPage] = useState(1);
  const [adsHasMore, setAdsHasMore] = useState(true);
  const [adsLoadingMore, setAdsLoadingMore] = useState(false);

  // Fetch ads for players (smart feed)
  const fetchAdsForPlayer = useCallback(async (page = 1, append = false, isRefresh = false) => {
    if (isCoachOrAdmin) return;
    if (page === 1 && !isRefresh) setLoading(true);
    else if (page > 1) setAdsLoadingMore(true);

    try {
      const searchTerm = adSearchValue?.trim();
      let newAds = [];
      let meta = {};
      if (searchTerm && searchTerm.length >= 2) {
        const response = await searchRecruitment({
          category: userData?.category,
          level: userData?.bestLevel,
          page,
          pageSize: 10,
          q: searchTerm,
          section: userData?.section?.name,
          sort: 'relevance',
          sport: userData?.preferredSport,
        });
        newAds = mapSearchPayload(response);
        meta = response.meta || {};
      } else {
        const response = await getRecruitmentAds({
          category: userData?.category,
          isActive: true,
          minLevel: userData?.bestLevel,
          page,
          pageSize: 10,
          section: userData?.section?.name,
          sport: userData?.preferredSport,
        });
        newAds = response.data || [];
        meta = response.meta || {};
      }

      if (append) {
        setAds((prev) => [...prev, ...newAds]);
      } else {
        setAds(newAds);
      }

      setAdsHasMore(meta.pagination ? page < meta.pagination.pageCount : false);
      setAdsPage(page);

    } catch (error) {
      console.error('[RecrutementListContent] Error fetching ads:', error);
    } finally {
      if (page === 1 && !isRefresh) setLoading(false);
      else if (page > 1) setAdsLoadingMore(false);
    }
  }, [adSearchValue, isCoachOrAdmin, userData]);

  // Load more ads Handler
  const handleLoadMoreAds = () => {
    if (!adsLoadingMore && adsHasMore) {
        fetchAdsForPlayer(adsPage + 1, true);
    }
  };

  // Fetch my ads (for coaches)
  const fetchMyAds = useCallback(async (isRefresh = false) => {
    if (!isCoachOrAdmin) return;
    if (!isRefresh) setLoading(true);
    try {
      const searchTerm = adSearchValue?.trim();
      let data = [];
      if (searchTerm && searchTerm.length >= 2) {
        const response = await searchRecruitment({
          authorDocumentId: userData?.documentId,
          includeInactive: true,
          page: 1,
          pageSize: 30,
          q: searchTerm,
          sort: 'relevance',
        });
        data = mapSearchPayload(response);
      } else {
        data = await getMyRecruitmentAds();
      }
      setMyAds(data || []);
    } catch (error) {
      console.error('[RecrutementListContent] Error fetching my ads:', error);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, [adSearchValue, isCoachOrAdmin, userData?.documentId]);

  // Fetch my applications (for players)
   const fetchMyApplications = useCallback(async (isRefresh = false) => {
     if (isCoachOrAdmin) return;
     if (!isRefresh) setLoading(true);
     try {
       const data = await getMyApplications(String(userData?.documentId || userData?.id || ''));
       setMyApplications(data || []);
     } catch (error) {
       console.error('[RecrutementListContent] Error fetching applications:', error);
     } finally {
       if (!isRefresh) setLoading(false);
     }
   }, [userData, isCoachOrAdmin]);

  // Effect to fetch data based on tab
  useEffect(() => {
    if (isCoachOrAdmin) {
      if (activeTab === 'profils') {
        fetchUsers();
      } else {
        fetchMyAds();
      }
    } else {
      if (activeTab === 'candidatures') {
        fetchMyApplications();
      } else {
        fetchAdsForPlayer(1, false);
      }
    }
  }, [activeTab, fetchAdsForPlayer, fetchMyAds, fetchMyApplications, fetchUsers, isCoachOrAdmin]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isCoachOrAdmin) {
        if (activeTab === 'profils') {
          await fetchUsers(true);
        } else {
          await fetchMyAds(true);
        }
      } else {
        if (activeTab === 'candidatures') {
          await fetchMyApplications(true);
        } else {
          await fetchAdsForPlayer(1, false, true);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, isCoachOrAdmin, fetchUsers, fetchMyAds, fetchMyApplications, fetchAdsForPlayer]);

  // Handle card press (navigate to user details)
  const handleUserCardPress = (/** @type {MercatoUser} */ user) => {
    nav.navigate(RouteNames.ProfileStack, {
      screen: RouteNames.UserDetails,
      params: { userId: user.documentId || user.id },
    });
  };

  // Handle ad card press
  const handleAdCardPress = (/** @type {RecruitmentAdItem} */ ad, isOwnerContext = false) => {
    nav.navigate(RouteNames.RecruitmentAdDetails, { ad, isOwner: isOwnerContext });
  };

  // Filters count
  const activeMercatoFilters = /** @type {Record<string, any>} */ (mercatoFilters || {});
  const filtersCount = Object.keys(activeMercatoFilters).filter((key) => {
    const value = activeMercatoFilters[key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) return !!value.value;
    return !!value;
  }).length;

  // Render Coach TopTabs - Centered with underline indicator
  const renderCoachTabs = () => (
    <View style={[
      Alignments.row, 
      Alignments.justifyCenter,
      Spaces.marginBottom[16], 
      { 
        backgroundColor: Colors.neutral800 + '80',
        borderRadius: 12,
        padding: 4,
      }
    ]}>
      <TouchableOpacity
        onPress={() => setActiveTab('profils')}
        style={[
          Alignments.alignCenter,
          Spaces.paddingVertical[12],
          Spaces.paddingHorizontal[24],
          {
            flex: 1,
            borderRadius: 10,
            backgroundColor: activeTab === 'profils' ? Colors.neutral800 : 'transparent',
          },
        ]}
      >
        <Text style={[
          Fonts.p2Bold, 
          { 
            color: activeTab === 'profils' ? Colors.primary500 : Colors.neutral500,
          }
        ]}>
          Profils
        </Text>
        {activeTab === 'profils' && (
          <View style={{
            position: 'absolute',
            bottom: 4,
            width: 24,
            height: 3,
            backgroundColor: Colors.primary500,
            borderRadius: 2,
          }} />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setActiveTab('annonces')}
        style={[
          Alignments.alignCenter,
          Spaces.paddingVertical[12],
          Spaces.paddingHorizontal[24],
          {
            flex: 1,
            borderRadius: 10,
            backgroundColor: activeTab === 'annonces' ? Colors.neutral800 : 'transparent',
          },
        ]}
      >
        <Text style={[
          Fonts.p2Bold, 
          { 
            color: activeTab === 'annonces' ? Colors.primary500 : Colors.neutral500,
          }
        ]}>
          Mes Annonces
        </Text>
        {activeTab === 'annonces' && (
          <View style={{
            position: 'absolute',
            bottom: 4,
            width: 24,
            height: 3,
            backgroundColor: Colors.primary500,
            borderRadius: 2,
          }} />
        )}
      </TouchableOpacity>
    </View>
  );

  // Render content for Coach - Profils tab
  const renderProfilsContent = () => (
    <>
      <View style={[Spaces.marginBottom[16], Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
        <View style={{ flex: 1 }}>
          <SearchComponent
            filterNumber={filtersCount}
            handleSearchField={setSearchValue}
            placeholder="Rechercher un profil..."
            searchDefaultValue={searchValue}
            openFilters={() => nav.navigate(RouteNames.MercatoFilters)}
          />
        </View>
      </View>
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[40]]}
          data={users}
          keyExtractor={(item) => String(item.id || Math.random())}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={(
            <Text style={[Fonts.p1, Fonts.neutral500, { textAlign: 'center' }, Spaces.marginTop[24]]}>
              Aucun profil trouvé
            </Text>
          )}
          renderItem={({ item }) => (
            <MercatoCard user={item} onPress={handleUserCardPress} />
          )}
        />
      )}
    </>
  );

  // Render content for Coach - Annonces tab
  const renderAnnoncesContent = () => {
    // Get teams from both myTeams and trainedTeams (coaches have teams in trainedTeams)
    const userTeams = [
      ...(userData?.myTeams || []),
      ...(userData?.trainedTeams || []),
    ];
    const firstTeam = userTeams[0] || null;
    console.log('[CreateAd] Available teams:', userTeams.map(t => t?.name));
    
    return (
    <>
      <TouchableOpacity
        onPress={() => {
          console.log('[CreateAd] Button pressed, navigating to AdWizardStack');
          nav.navigate('AdWizardStack');
        }}
        style={[
          Spaces.padding[16],
          Spaces.marginBottom[16],
          {
            backgroundColor: Colors.primary500,
            borderRadius: 12,
            alignItems: 'center',
          },
        ]}
      >
        <Text style={[Fonts.p1Bold, { color: Colors.neutral900 }]}>
          + Créer une annonce
        </Text>
      </TouchableOpacity>
      <View style={[Spaces.marginBottom[12]]}>
        <SearchComponent
          filterNumber={filtersCount}
          handleSearchField={setAdSearchValue}
          placeholder="Rechercher une annonce..."
          searchDefaultValue={adSearchValue}
          openFilters={() => nav.navigate(RouteNames.MercatoFilters)}
        />
      </View>
      {adSearchValue?.trim()?.length >= 2 ? (
        <Text style={[Fonts.p3, { color: Colors.primary500 }, Spaces.marginBottom[12]]}>
          Trie par pertinence
        </Text>
      ) : null}
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[40]]}
          data={myAds}
          keyExtractor={(item) => String(item.documentId || item.id || Math.random())}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={(
            <Text style={[Fonts.p1, Fonts.neutral500, { textAlign: 'center' }, Spaces.marginTop[24]]}>
              Aucune annonce créée
            </Text>
          )}
          renderItem={({ item }) => {
            const primaryReasonLabel = getMatchReasonLabel(item?.__search?.matchReasons?.[0]);
            return (
              <View style={[Spaces.gap[8]]}>
                {primaryReasonLabel ? (
                  <Text style={[Fonts.p3, { color: Colors.primary500 }]}>
                    {`Tri pertinence: ${primaryReasonLabel}`}
                  </Text>
                ) : null}
                <RecruitmentAdCard ad={item} onPress={(/** @type {RecruitmentAdItem} */ ad) => handleAdCardPress(ad, true)} isOwner />
              </View>
            );
          }}
        />
      )}
    </>
  )};

  // State for filtering
  const [filterByLevel, setFilterByLevel] = useState(false);

  // Filter ads client-side based on level preference
  const filteredAds = React.useMemo(() => {
    if (!filterByLevel) return ads;
    
    if (!userData?.bestLevel) return ads;

    // Filter to keep ads that match user's level
    // Note: Ideally we want ">= Level", but without numeric rank, we do Exact Match or Name Match
    // For now, doing simple name matching or ID matching
    return ads.filter((ad) => {
       const adLevelId = ad.level?.documentId || ad.level?.id;
       const bestLevel = /** @type {any} */ (userData?.bestLevel);
       const userLevelId = (bestLevel && typeof bestLevel === 'object')
         ? (bestLevel.documentId || bestLevel.id)
         : undefined;
       
       // Try ID match
       if (adLevelId && userLevelId && adLevelId === userLevelId) return true;
       
       // Try Name match
       const adLevelName = ad.level?.name;
       const userLevelName = (bestLevel && typeof bestLevel === 'object')
         ? bestLevel.name
         : bestLevel;
       if (adLevelName && userLevelName && adLevelName === userLevelName) return true;

       return false;
    });
  }, [ads, filterByLevel, userData]);

  // Render content for Player - Smart Feed
  const renderPlayerContent = () => (
    <>
      <View style={[Spaces.marginBottom[16], { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={[Fonts.h4, Fonts.neutral100]}>
          Annonces pour toi
        </Text>
        
        {/* Level Filter Toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginRight: 8 }]}>
            Mon niveau uniquement
          </Text>
          <TouchableOpacity 
             onPress={() => setFilterByLevel(!filterByLevel)}
             style={{
               width: 44,
               height: 24,
               borderRadius: 12,
               backgroundColor: filterByLevel ? Colors.primary500 : Colors.neutral700,
               justifyContent: 'center',
               paddingHorizontal: 2,
             }}
          >
            <View style={{
               width: 20,
               height: 20,
               borderRadius: 10,
               backgroundColor: Colors.neutral00,
               alignSelf: filterByLevel ? 'flex-end' : 'flex-start',
            }} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={[Spaces.marginBottom[12]]}>
        <SearchComponent
          filterNumber={filtersCount}
          handleSearchField={setAdSearchValue}
          placeholder="Rechercher une annonce..."
          searchDefaultValue={adSearchValue}
          openFilters={() => nav.navigate(RouteNames.MercatoFilters)}
        />
      </View>
      {adSearchValue?.trim()?.length >= 2 ? (
        <Text style={[Fonts.p3, { color: Colors.primary500 }, Spaces.marginBottom[12]]}>
          Trie par pertinence
        </Text>
      ) : null}

      {loading ? (
        <Loader />
      ) : (
        <FlatList
          contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[40]]}
          data={filteredAds}
          keyExtractor={(item) => String(item.documentId || item.id || Math.random())}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={(
            <View style={[Spaces.padding[24], { alignItems: 'center' }]}>
              <Text style={[Fonts.p1, Fonts.neutral500, { textAlign: 'center' }]}>
                {filterByLevel 
                  ? "Aucune annonce ne correspond exactement à ton niveau." 
                  : "Aucune annonce ne correspond à ton profil pour le moment."}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral600, { textAlign: 'center', marginTop: 8 }]}>
                {filterByLevel 
                   ? "Désactive le filtre pour voir plus large."
                   : "Complète ton profil pour voir plus d'annonces !"}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const primaryReasonLabel = getMatchReasonLabel(item?.__search?.matchReasons?.[0]);
            return (
              <View style={[Spaces.gap[8]]}>
                {primaryReasonLabel ? (
                  <Text style={[Fonts.p3, { color: Colors.primary500 }]}>
                    {`Tri pertinence: ${primaryReasonLabel}`}
                  </Text>
                ) : null}
                <RecruitmentAdCard ad={item} onPress={handleAdCardPress} />
              </View>
            );
          }}
        />
      )}
    </>
  );

  // Render Player Tabs
  const renderPlayerTabs = () => (
    <View style={[
      Alignments.row, 
      Alignments.justifyCenter,
      Spaces.marginBottom[16], 
      { 
        backgroundColor: Colors.neutral800 + '80',
        borderRadius: 12,
        padding: 4,
      }
    ]}>
      <TouchableOpacity
        onPress={() => setActiveTab('annonces')}
        style={[
          Alignments.alignCenter,
          Spaces.paddingVertical[12],
          Spaces.paddingHorizontal[24],
          {
            flex: 1,
            borderRadius: 10,
            backgroundColor: activeTab === 'annonces' || activeTab === 'profils' ? Colors.neutral800 : 'transparent', 
          },
        ]}
      >
        <Text style={[
          Fonts.p2Bold, 
          { 
            color: activeTab === 'annonces' || activeTab === 'profils' ? Colors.primary500 : Colors.neutral500,
          }
        ]}>
          Annonces
        </Text>
        {(activeTab === 'annonces' || activeTab === 'profils') && (
          <View style={{
            position: 'absolute',
            bottom: 4,
            width: 24,
            height: 3,
            backgroundColor: Colors.primary500,
            borderRadius: 2,
          }} />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setActiveTab('candidatures')}
        style={[
          Alignments.alignCenter,
          Spaces.paddingVertical[12],
          Spaces.paddingHorizontal[24],
          {
            flex: 1,
            borderRadius: 10,
            backgroundColor: activeTab === 'candidatures' ? Colors.neutral800 : 'transparent',
          },
        ]}
      >
        <Text style={[
          Fonts.p2Bold, 
          { 
            color: activeTab === 'candidatures' ? Colors.primary500 : Colors.neutral500,
          }
        ]}>
          Mes Candidatures
        </Text>
        {activeTab === 'candidatures' && (
          <View style={{
            position: 'absolute',
            bottom: 4,
            width: 24,
            height: 3,
            backgroundColor: Colors.primary500,
            borderRadius: 2,
          }} />
        )}
      </TouchableOpacity>
    </View>
  );

  // Render Applications Content
  const renderApplicationsContent = () => (
    <>
      <Text style={[Fonts.h4, Fonts.neutral100, Spaces.marginBottom[16]]}>
        Suivi de tes candidatures
      </Text>
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[40]]}
          data={myApplications}
          keyExtractor={(item) => String(item.documentId || item.id || Math.random())}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={(
            <View style={[Spaces.padding[24], { alignItems: 'center' }]}>
              <Text style={[Fonts.p1, Fonts.neutral500, { textAlign: 'center' }]}>
                Tu n'as pas encore postulé à une annonce.
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <RecruitmentAdCard ad={item} onPress={handleAdCardPress} />
          )}
        />
      )}
    </>
  );

  return (
    <View style={[Alignments.fill, Spaces.paddingHorizontal[16]]}>
      {isCoachOrAdmin ? (
        <>
          {renderCoachTabs()}
          {activeTab === 'profils' ? renderProfilsContent() : renderAnnoncesContent()}
        </>
      ) : (
        <>
           {renderPlayerTabs()}
           {activeTab === 'candidatures' ? renderApplicationsContent() : renderPlayerContent()}
        </>
      )}
      
    </View>
  );
};

export default RecrutementListContent;
