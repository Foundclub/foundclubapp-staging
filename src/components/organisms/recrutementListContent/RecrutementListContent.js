import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, FlatList, Text, TouchableOpacity, View,
} from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

// Components
import Loader from '@/components/atoms/loader/Loader';
import MercatoCard from '@/components/molecules/mercatoCard/MercatoCard';
import RecruitmentAdCard from '@/components/molecules/recruitmentAdCard/RecruitmentAdCard';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';
// Services
import { useAppContext } from '@/store/appContext';

import { getMyApplications, getMyRecruitmentAds, getRecruitmentAds } from '@/services/recruitment/recruitmentService';
import { getMatchReasonLabel, mapSearchPayload, searchRecruitment } from '@/services/search/searchService';
import { searchUsers } from '@/services/user/userService';

/**
 * @typedef {{ id?: string | number; documentId?: string; [key: string]: any }} MercatoUser
 * @typedef {{ documentId?: string | number; id?: string | number; name?: string }} LevelRef
 * @typedef {{ id?: string | number; level?: LevelRef; [key: string]: any }} RecruitmentAdItem
 */

const normalizeComparableValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

const extractComparableValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    return normalizeComparableValue(value);
  }

  if (typeof value === 'object') {
    return normalizeComparableValue(
      value.name
      || value.label
      || value.value
      || value.documentId
      || value.id,
    );
  }

  return '';
};

const getUserCity = (userData) => extractComparableValue(
  userData?.city
  || userData?.address?.city
  || userData?.address?.label,
);

const getProfileMatchInfo = (ad, userData) => {
  if (!ad || !userData) {
    return {
      isMatch: false,
      reasons: [],
      score: 0,
    };
  }

  const userSport = extractComparableValue(userData?.preferredSport);
  const adSport = extractComparableValue(ad?.sport || ad?.team?.sport);
  const userSection = extractComparableValue(userData?.section);
  const adSection = extractComparableValue(ad?.section);
  const userCategory = extractComparableValue(userData?.category);
  const adCategory = extractComparableValue(ad?.category);
  const userLevel = extractComparableValue(userData?.bestLevel);
  const adLevel = extractComparableValue(ad?.level);
  const userCity = getUserCity(userData);
  const adCity = extractComparableValue(ad?.city || ad?.team?.club?.city || ad?.address?.city);

  const reasons = [];
  let score = 0;
  let hardMismatch = false;
  let hardMatches = 0;

  if (userSport && adSport) {
    if (userSport === adSport) {
      hardMatches += 1;
      score += 4;
      reasons.push('Sport compatible');
    } else {
      hardMismatch = true;
    }
  }

  if (userSection && adSection) {
    if (userSection === adSection) {
      hardMatches += 1;
      score += 3;
      reasons.push('Section compatible');
    } else {
      hardMismatch = true;
    }
  }

  if (userCategory && adCategory) {
    if (userCategory === adCategory) {
      hardMatches += 1;
      score += 3;
      reasons.push('Cat\u00e9gorie compatible');
    } else {
      hardMismatch = true;
    }
  }

  if (userLevel && adLevel && userLevel === adLevel) {
    score += 2;
    reasons.push('Niveau compatible');
  }

  if (userCity && adCity && userCity === adCity) {
    score += 1;
    reasons.push('M\u00eame ville');
  }

  return {
    isMatch: !hardMismatch && (hardMatches > 0 || score >= 2),
    reasons,
    score,
  };
};

const getSortTimestamp = (value) => {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const sortPlayerAds = (left, right) => {
  const rightScore = right?.profileMatchMeta?.score || 0;
  const leftScore = left?.profileMatchMeta?.score || 0;
  if (rightScore !== leftScore) return rightScore - leftScore;

  const rightSearchScore = right?.searchMeta?.score || 0;
  const leftSearchScore = left?.searchMeta?.score || 0;
  if (rightSearchScore !== leftSearchScore) return rightSearchScore - leftSearchScore;

  return getSortTimestamp(right?.createdAt || right?.publishedAt) - getSortTimestamp(left?.createdAt || left?.publishedAt);
};

const buildPlayerFeedItems = ({ matchingAds, otherAds, showMatchingOnly }) => {
  /** @type {Array<any>} */
  const items = [];

  if (matchingAds.length > 0) {
    items.push({
      count: matchingAds.length,
      key: 'section-matching',
      title: 'Correspondent \u00e0 ton profil',
      type: 'section',
    });
    matchingAds.forEach((ad) => {
      items.push({
        ad,
        key: `ad-matching-${String(ad.documentId || ad.id)}`,
        type: 'ad',
      });
    });
  }

  if (!showMatchingOnly && otherAds.length > 0) {
    items.push({
      count: otherAds.length,
      key: 'section-other',
      title: matchingAds.length > 0 ? 'Autres annonces' : 'Toutes les annonces',
      type: 'section',
    });
    otherAds.forEach((ad) => {
      items.push({
        ad,
        key: `ad-other-${String(ad.documentId || ad.id)}`,
        type: 'ad',
      });
    });
  }

  return items;
};

const formatAdsCountLabel = (count) => `${count} annonce${count > 1 ? 's' : ''}`;

/**
 * Recrutement List Content - Main component for recruitment marketplace
 * Shows different content based on user role:
 * - Coach/Dirigeant: TopTabs with "Profils" (search players) and "Annonces" (manage ads)
 * - Joueur: Smart feed of recruitment ads matching their profile
 * @param {{ initialTab?: 'profils' | 'annonces' | 'candidatures'; timestamp?: number | string }} props
 */
function RecrutementListContent({ initialTab, timestamp }) {
  useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const recruitmentSurface = `${Colors.primary900}F0`;
  const recruitmentSurfaceStrong = `${Colors.primary700}70`;
  const recruitmentSurfaceSoft = `${Colors.primary500}14`;
  const recruitmentBorder = `${Colors.primary500}45`;
  const recruitmentBorderSoft = `${Colors.primary500}26`;
  const recruitmentToggleOff = `${Colors.primary700}B3`;
  const recruitmentMutedText = `${Colors.neutral100}C4`;
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
  const [showProfileMatchesOnly, setShowProfileMatchesOnly] = useState(false);

  // Handle external tab switching (e.g. from creation wizard)
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      console.log('[RecrutementListContent] initialTab changed to:', initialTab);
      setActiveTab(initialTab);
    }
  }, [activeTab, initialTab]);

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
  }, [timestamp, isCoachOrAdmin, activeTab, fetchMyAds]); // Dependencies: timestamp changes, so it runs.

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
          page,
          pageSize: 10,
          q: searchTerm,
          sort: 'relevance',
        });
        newAds = mapSearchPayload(response);
        meta = response.meta || {};
      } else {
        const response = await getRecruitmentAds({
          isActive: true,
          page,
          pageSize: 10,
        });
        newAds = response.data || [];
        meta = response.meta || {};
      }

      if (append) {
        setAds((prev) => {
          const seen = new Set(prev.map((item) => String(item.documentId || item.id)));
          const merged = [...prev];
          newAds.forEach((item) => {
            const key = String(item.documentId || item.id);
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(item);
            }
          });
          return merged;
        });
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
  }, [adSearchValue, isCoachOrAdmin]);

  // Load more ads Handler
  const handleLoadMoreAds = useCallback(() => {
    if (!adsLoadingMore && adsHasMore) {
      fetchAdsForPlayer(adsPage + 1, true);
    }
  }, [adsHasMore, adsLoadingMore, adsPage, fetchAdsForPlayer]);

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
    } else if (activeTab === 'candidatures') {
      fetchMyApplications();
    } else {
      fetchAdsForPlayer(1, false);
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
      } else if (activeTab === 'candidatures') {
        await fetchMyApplications(true);
      } else {
        await fetchAdsForPlayer(1, false, true);
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
      params: { userId: user.documentId || user.id },
      screen: RouteNames.UserDetails,
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
        backgroundColor: recruitmentSurfaceSoft,
        borderColor: recruitmentBorderSoft,
        borderRadius: 12,
        borderWidth: 1,
        padding: 4,
      },
    ]}
    >
      <TouchableOpacity
        onPress={() => setActiveTab('profils')}
        style={[
          Alignments.alignCenter,
          Spaces.paddingVertical[12],
          Spaces.paddingHorizontal[24],
          {
            backgroundColor: activeTab === 'profils' ? recruitmentSurfaceStrong : 'transparent',
            borderRadius: 10,
            flex: 1,
          },
        ]}
      >
        <Text style={[
          Fonts.p2Bold,
          {
            color: activeTab === 'profils' ? Colors.primary500 : Colors.neutral500,
          },
        ]}
        >
          Profils
        </Text>
        {activeTab === 'profils' && (
          <View style={{
            backgroundColor: Colors.primary500,
            borderRadius: 2,
            bottom: 4,
            height: 3,
            position: 'absolute',
            width: 24,
          }}
          />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setActiveTab('annonces')}
        style={[
          Alignments.alignCenter,
          Spaces.paddingVertical[12],
          Spaces.paddingHorizontal[24],
          {
            backgroundColor: activeTab === 'annonces' ? recruitmentSurfaceStrong : 'transparent',
            borderRadius: 10,
            flex: 1,
          },
        ]}
      >
        <Text style={[
          Fonts.p2Bold,
          {
            color: activeTab === 'annonces' ? Colors.primary500 : Colors.neutral500,
          },
        ]}
        >
          Mes Annonces
        </Text>
        {activeTab === 'annonces' && (
          <View style={{
            backgroundColor: Colors.primary500,
            borderRadius: 2,
            bottom: 4,
            height: 3,
            position: 'absolute',
            width: 24,
          }}
          />
        )}
      </TouchableOpacity>
    </View>
  );

  // Render content for Coach - Profils tab
  const renderProfilsContent = () => (
    <View style={{ flex: 1 }}>
      <View style={[Spaces.marginBottom[16], Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
        <View style={{ flex: 1 }}>
          <SearchComponent
            filterNumber={filtersCount}
            handleSearchField={setSearchValue}
            openFilters={() => nav.navigate(RouteNames.MercatoFilters)}
            placeholder="Rechercher un profil..."
            searchDefaultValue={searchValue}
          />
        </View>
      </View>
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[140], { flexGrow: 1 }]}
          data={users}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => String(item.id || Math.random())}
          ListEmptyComponent={(
            <Text style={[Fonts.p1, Fonts.neutral500, { textAlign: 'center' }, Spaces.marginTop[24]]}>
              Aucun profil trouvé
            </Text>
          )}
          onRefresh={onRefresh}
          refreshing={refreshing}
          renderItem={({ item }) => (
            <MercatoCard onPress={handleUserCardPress} user={item} />
          )}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );

  // Render content for Coach - Annonces tab
  const renderAnnoncesContent = () => {
    const userTeams = [
      ...(userData?.myTeams || []),
      ...(userData?.trainedTeams || []),
    ];
    console.log('[CreateAd] Available teams:', userTeams.map((t) => t?.name));

    const annoncesHeader = (
      <View style={[Spaces.gap[12], Spaces.marginBottom[4]]}>
        <TouchableOpacity
          onPress={() => {
            console.log('[CreateAd] Button pressed, navigating to AdWizardStack');
            nav.navigate('AdWizardStack');
          }}
          style={[
            Spaces.padding[16],
            {
              alignItems: 'center',
              backgroundColor: Colors.primary500,
              borderRadius: 12,
            },
          ]}
        >
          <Text style={[Fonts.p1Bold, { color: Colors.neutral900 }]}>
            + Créer une annonce
          </Text>
        </TouchableOpacity>
        <SearchComponent
          filterNumber={filtersCount}
          handleSearchField={setAdSearchValue}
          openFilters={() => nav.navigate(RouteNames.MercatoFilters)}
          placeholder="Rechercher une annonce..."
          searchDefaultValue={adSearchValue}
        />
        {adSearchValue?.trim()?.length >= 2 ? (
          <Text style={[Fonts.p3, { color: Colors.primary500 }]}>
            Trié par pertinence
          </Text>
        ) : null}
      </View>
    );

    return loading ? (
      <Loader />
    ) : (
      <FlatList
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[140], { flexGrow: 1 }]}
        data={myAds}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => String(item.documentId || item.id || Math.random())}
        ListEmptyComponent={(
          <Text style={[Fonts.p1, Fonts.neutral500, { textAlign: 'center' }, Spaces.marginTop[24]]}>
            Aucune annonce créée
          </Text>
        )}
        ListHeaderComponent={annoncesHeader}
        onRefresh={onRefresh}
        refreshing={refreshing}
        renderItem={({ item }) => {
          const primaryReasonLabel = getMatchReasonLabel(item?.searchMeta?.matchReasons?.[0]);
          return (
            <View style={[Spaces.gap[8]]}>
              {primaryReasonLabel ? (
                <Text style={[Fonts.p3, { color: Colors.primary500 }]}>
                  {`Tri pertinence: ${primaryReasonLabel}`}
                </Text>
              ) : null}
              <RecruitmentAdCard
                ad={item}
                isOwner
                onPress={(ad) => handleAdCardPress(ad, true)}
              />
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />
    );
  };

  const hasProfileSignals = Boolean(
    userData?.preferredSport
    || userData?.section
    || userData?.category
    || userData?.bestLevel,
  );
  const rankedPlayerAds = React.useMemo(() => ads.map((ad) => {
    const { __search: searchMeta, ...rest } = ad;
    return {
      ...rest,
      profileMatchMeta: getProfileMatchInfo(ad, userData),
      searchMeta,
    };
  }), [ads, userData]);
  const matchingAds = React.useMemo(
    () => rankedPlayerAds.filter((ad) => ad.profileMatchMeta?.isMatch).sort(sortPlayerAds),
    [rankedPlayerAds],
  );
  const otherAds = React.useMemo(
    () => rankedPlayerAds.filter((ad) => !ad.profileMatchMeta?.isMatch).sort(sortPlayerAds),
    [rankedPlayerAds],
  );
  const playerFeedItems = React.useMemo(() => buildPlayerFeedItems({
    matchingAds,
    otherAds,
    showMatchingOnly: showProfileMatchesOnly,
  }), [matchingAds, otherAds, showProfileMatchesOnly]);

  const playerIntroText = React.useMemo(() => {
    if (matchingAds.length > 0) {
      return `${String(formatAdsCountLabel(matchingAds.length))} correspondent à ton profil et apparaissent en premier.`;
    }

    if (hasProfileSignals) {
      return "Aucune annonce ne correspond exactement à ton profil pour l'instant, mais toutes les autres restent visibles.";
    }

    return 'Complète ton profil pour mettre en avant les annonces qui te correspondent.';
  }, [hasProfileSignals, matchingAds.length]);

  const renderPlayerEmptyState = () => {
    if (showProfileMatchesOnly) {
      return (
        <View
          style={[Spaces.padding[24], {
            alignItems: 'center',
            backgroundColor: recruitmentSurface,
            borderColor: recruitmentBorderSoft,
            borderRadius: 18,
            borderWidth: 1,
          }]}
        >
          <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
            {hasProfileSignals
              ? 'Aucune annonce ne correspond exactement à ton profil pour le moment.'
              : 'Complète ton profil pour activer le tri personnalisé des annonces.'}
          </Text>
          <Text style={[Fonts.p2, { color: recruitmentMutedText, marginTop: 8, textAlign: 'center' }]}>
            {hasProfileSignals
              ? 'Désactive le filtre pour afficher toutes les annonces disponibles.'
              : "Tu peux déjà consulter toutes les annonces publiées sur l'application."}
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[Spaces.padding[24], {
          alignItems: 'center',
          backgroundColor: recruitmentSurface,
          borderColor: recruitmentBorderSoft,
          borderRadius: 18,
          borderWidth: 1,
        }]}
      >
        <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
          Aucune annonce disponible pour le moment.
        </Text>
        <Text style={[Fonts.p2, { color: recruitmentMutedText, marginTop: 8, textAlign: 'center' }]}>
          Reviens un peu plus tard ou ajuste ta recherche.
        </Text>
      </View>
    );
  };

  const renderPlayerSectionHeader = (title, count, variant = 'default') => {
    const isMatching = variant === 'matching';
    return (
      <View
        style={[Spaces.marginTop[4], {
          alignItems: 'center',
          backgroundColor: recruitmentSurface,
          borderColor: isMatching ? recruitmentBorder : recruitmentBorderSoft,
          borderRadius: 16,
          borderWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 12,
        }]}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
            {title}
          </Text>
          <Text style={[Fonts.p3, { color: recruitmentMutedText, marginTop: 3 }]}>
            {isMatching
              ? 'Affichées en priorité selon ton profil.'
              : 'Toutes les autres opportunités restent visibles.'}
          </Text>
        </View>
        <View style={{
          backgroundColor: isMatching ? recruitmentSurfaceSoft : recruitmentSurfaceStrong,
          borderColor: isMatching ? recruitmentBorder : 'transparent',
          borderRadius: 999,
          borderWidth: isMatching ? 1 : 0,
          paddingHorizontal: 10,
          paddingVertical: 6,
        }}
        >
          <Text style={[
            Fonts.p4Bold,
            {
              color: isMatching ? Colors.primary500 : Colors.neutral200,
              textTransform: 'uppercase',
            },
          ]}
          >
            {formatAdsCountLabel(count)}
          </Text>
        </View>
      </View>
    );
  };

  const renderPlayerListHeader = () => (
    <View style={[Spaces.gap[12], Spaces.marginBottom[4]]}>
      <View style={{
        backgroundColor: recruitmentSurface,
        borderColor: recruitmentBorder,
        borderRadius: 18,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 16,
      }}
      >
        <View style={{
          alignItems: 'flex-start',
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[Fonts.h4, Fonts.neutral100]}>
              Toutes les annonces
            </Text>
            <Text style={[Fonts.p2, { color: recruitmentMutedText, marginTop: 6 }]}>
              {playerIntroText}
            </Text>
          </View>
          <View style={{
            backgroundColor: recruitmentSurfaceSoft,
            borderColor: recruitmentBorder,
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.primary500, textTransform: 'uppercase' }]}>
              {matchingAds.length > 0 ? `${String(matchingAds.length)} pour toi` : 'Feed complet'}
            </Text>
          </View>
        </View>
        <View style={{
          backgroundColor: recruitmentSurfaceStrong,
          borderColor: recruitmentBorderSoft,
          borderRadius: 16,
          borderWidth: 1,
          marginTop: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
        >
          <View style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
                Affichage personnalisé
              </Text>
              <Text style={[Fonts.p3, { color: recruitmentMutedText, marginTop: 4 }]}>
                {hasProfileSignals
                  ? "Les annonces compatibles restent d?j? en t?te. Active le filtre pour n'afficher que celles-ci."
                  : 'Ajoute tes infos sportives pour faire remonter automatiquement les meilleures annonces.'}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="switch"
              accessibilityState={{ checked: showProfileMatchesOnly }}
              onPress={() => setShowProfileMatchesOnly(!showProfileMatchesOnly)}
              style={{
                backgroundColor: showProfileMatchesOnly ? Colors.primary500 : recruitmentToggleOff,
                borderRadius: 12,
                height: 24,
                justifyContent: 'center',
                paddingHorizontal: 2,
                width: 44,
              }}
            >
              <View style={{
                alignSelf: showProfileMatchesOnly ? 'flex-end' : 'flex-start',
                backgroundColor: Colors.neutral00,
                borderRadius: 10,
                height: 20,
                width: 20,
              }}
              />
            </TouchableOpacity>
          </View>
          <Text style={[Fonts.p3, {
            color: showProfileMatchesOnly ? Colors.primary500 : recruitmentMutedText,
            marginTop: 10,
          }]}
          >
            {showProfileMatchesOnly
              ? 'Seules les annonces correspondant à ton profil sont affichées.'
              : 'Toutes les annonces restent visibles, avec les plus pertinentes en premier.'}
          </Text>
        </View>
      </View>
      {!hasProfileSignals ? (
        <TouchableOpacity
          onPress={() => nav.navigate(RouteNames.ProfileStack, {
            screen: RouteNames.Profile,
          })}
          style={{
            backgroundColor: recruitmentSurfaceSoft,
            borderColor: recruitmentBorder,
            borderRadius: 14,
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
            Compléter mon profil
          </Text>
          <Text style={[Fonts.p3, { color: recruitmentMutedText, marginTop: 4 }]}>
            Ajoute ton sport, ta section, ta catégorie et ton niveau pour personnaliser ce flux.
          </Text>
        </TouchableOpacity>
      ) : null}
      <View>
        <Text style={[Fonts.p3, { color: recruitmentMutedText, marginBottom: 8 }]}>
          Recherche et filtres
        </Text>
        <SearchComponent
          filterNumber={filtersCount}
          handleSearchField={setAdSearchValue}
          openFilters={() => nav.navigate(RouteNames.MercatoFilters)}
          placeholder="Rechercher une annonce..."
          searchDefaultValue={adSearchValue}
        />
      </View>
      {adSearchValue?.trim()?.length >= 2 ? (
        <Text style={[Fonts.p3, { color: Colors.primary500 }]}>
          Trié par pertinence
        </Text>
      ) : null}
    </View>
  );

  // Render content for Player - Smart Feed
  const renderPlayerContent = () => (
    loading ? (
      <Loader />
    ) : (
      <FlatList
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[140], { flexGrow: 1 }]}
        data={playerFeedItems}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.key}
        ListEmptyComponent={renderPlayerEmptyState()}
        ListFooterComponent={adsLoadingMore ? (
          <View style={[Spaces.paddingVertical[16], { alignItems: 'center' }]}>
            <ActivityIndicator color={Colors.primary500} />
          </View>
        ) : null}
        ListHeaderComponent={renderPlayerListHeader()}
        nestedScrollEnabled
        onEndReached={handleLoadMoreAds}
        onEndReachedThreshold={0.35}
        onRefresh={onRefresh}
        refreshing={refreshing}
        renderItem={({ item }) => {
          if (item.type === 'section') {
            return renderPlayerSectionHeader(
              item.title,
              item.count,
              item.key === 'section-matching' ? 'matching' : 'default',
            );
          }
          const { ad } = item;
          const primaryReasonLabel = getMatchReasonLabel(ad?.searchMeta?.matchReasons?.[0]);
          return (
            <View style={[Spaces.gap[8]]}>
              {primaryReasonLabel ? (
                <View style={{
                  alignSelf: 'flex-start',
                  backgroundColor: recruitmentSurfaceSoft,
                  borderColor: recruitmentBorderSoft,
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                    {`Pertinence : ${primaryReasonLabel}`}
                  </Text>
                </View>
              ) : null}
              <RecruitmentAdCard ad={ad} onPress={handleAdCardPress} />
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />
    )
  );

  // Render Player Tabs
  const renderPlayerTabs = () => (
    <View style={[
      Alignments.row,
      Alignments.justifyCenter,
      Spaces.marginBottom[16],
      {
        backgroundColor: recruitmentSurfaceSoft,
        borderColor: recruitmentBorderSoft,
        borderRadius: 12,
        borderWidth: 1,
        padding: 4,
      },
    ]}
    >
      <TouchableOpacity
        onPress={() => setActiveTab('annonces')}
        style={[
          Alignments.alignCenter,
          Spaces.paddingVertical[12],
          Spaces.paddingHorizontal[24],
          {
            backgroundColor: activeTab === 'annonces' || activeTab === 'profils' ? recruitmentSurfaceStrong : 'transparent',
            borderRadius: 10,
            flex: 1,
          },
        ]}
      >
        <Text style={[
          Fonts.p2Bold,
          {
            color: activeTab === 'annonces' || activeTab === 'profils' ? Colors.primary500 : Colors.neutral500,
          },
        ]}
        >
          Annonces
        </Text>
        {(activeTab === 'annonces' || activeTab === 'profils') && (
          <View style={{
            backgroundColor: Colors.primary500,
            borderRadius: 2,
            bottom: 4,
            height: 3,
            position: 'absolute',
            width: 24,
          }}
          />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setActiveTab('candidatures')}
        style={[
          Alignments.alignCenter,
          Spaces.paddingVertical[12],
          Spaces.paddingHorizontal[24],
          {
            backgroundColor: activeTab === 'candidatures' ? recruitmentSurfaceStrong : 'transparent',
            borderRadius: 10,
            flex: 1,
          },
        ]}
      >
        <Text style={[
          Fonts.p2Bold,
          {
            color: activeTab === 'candidatures' ? Colors.primary500 : Colors.neutral500,
          },
        ]}
        >
          Mes Candidatures
        </Text>
        {activeTab === 'candidatures' && (
          <View style={{
            backgroundColor: Colors.primary500,
            borderRadius: 2,
            bottom: 4,
            height: 3,
            position: 'absolute',
            width: 24,
          }}
          />
        )}
      </TouchableOpacity>
    </View>
  );

  // Render Applications Content
  const renderApplicationsContent = () => (
    loading ? (
      <Loader />
    ) : (
      <FlatList
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[140], { flexGrow: 1 }]}
        data={myApplications}
        keyExtractor={(item) => String(item.documentId || item.id || Math.random())}
        ListEmptyComponent={(
          <View style={[Spaces.padding[24], {
            alignItems: 'center',
            backgroundColor: recruitmentSurface,
            borderColor: recruitmentBorderSoft,
            borderRadius: 18,
            borderWidth: 1,
          }]}
          >
            <Text style={[Fonts.p1, { color: recruitmentMutedText, textAlign: 'center' }]}>
              {'Tu n\u2019as pas encore postul\u00e9 \u00e0 une annonce.'}
            </Text>
          </View>
        )}
        ListHeaderComponent={(
          <Text style={[Fonts.h4, Fonts.neutral100, Spaces.marginBottom[16]]}>
            Suivi de tes candidatures
          </Text>
        )}
        onRefresh={onRefresh}
        refreshing={refreshing}
        renderItem={({ item }) => (
          <RecruitmentAdCard ad={item} onPress={handleAdCardPress} />
        )}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />
    )
  );

  return (
    <View style={[Alignments.fill, Spaces.paddingHorizontal[16]]}>
      {isCoachOrAdmin ? (
        <View style={{ flex: 1 }}>
          {renderCoachTabs()}
          {activeTab === 'profils' ? renderProfilsContent() : renderAnnoncesContent()}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {renderPlayerTabs()}
          {activeTab === 'candidatures' ? renderApplicationsContent() : renderPlayerContent()}
        </View>
      )}
    </View>
  );
}

export default RecrutementListContent;
