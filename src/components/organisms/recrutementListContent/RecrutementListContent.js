import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  getAppliedFilterCount,
  getRecruitmentRoleMode,
  sanitizeRecruitmentTabForRole,
} from '@/domains/search/recruitmentFlow';
import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

// Components
import Loader from '@/components/atoms/loader/Loader';
import RecruitmentAdCard from '@/components/molecules/recruitmentAdCard/RecruitmentAdCard';
import RecruitmentProfilesList from '@/components/organisms/recruitmentProfilesList/RecruitmentProfilesList';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';
// Services
import { useAppContext } from '@/store/appContext';

import {
  applyToRecruitmentAd,
  buildDetectionApplicationStatusMap,
  getMyApplications,
  getMyRecruitmentAds,
  getRecruitmentAds,
  resolveRecruitmentAdApplicationState,
} from '@/services/recruitment/recruitmentService';
import { getMatchReasonLabel, mapSearchPayload, searchRecruitment } from '@/services/search/searchService';

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
const normalizeAudienceType = (value) => (
  String(value || '').trim().toLowerCase() === 'coach' ? 'coach' : 'player'
);

const getManagedTeamKey = (team) => String(team?.documentId || team?.id || '').trim();
const getRecruitmentAdKey = (ad) => String(ad?.documentId || ad?.id || '').trim();
const normalizeTypeLabel = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const mergeManagedTeamSummary = (previousTeam, nextTeam) => ({
  ...previousTeam,
  ...nextTeam,
  activities: nextTeam?.activities?.length ? nextTeam.activities : previousTeam?.activities,
  category: nextTeam?.category || previousTeam?.category,
  club: nextTeam?.club || previousTeam?.club,
  level: nextTeam?.level || previousTeam?.level,
  section: nextTeam?.section || previousTeam?.section,
});

const dedupeManagedTeams = (teams) => {
  const teamsByKey = new Map();

  teams.forEach((team) => {
    const teamKey = getManagedTeamKey(team);
    if (!teamKey) return;

    const previousTeam = teamsByKey.get(teamKey);
    teamsByKey.set(teamKey, previousTeam ? mergeManagedTeamSummary(previousTeam, team) : team);
  });

  return Array.from(teamsByKey.values());
};

/**
 * Recrutement List Content - Main component for recruitment marketplace
 * Shows different content based on user role:
 * - Coach/Dirigeant: TopTabs with "Profils" (search players) and "Annonces" (manage ads)
 * - Joueur: Smart feed of recruitment ads matching their profile
 * @param {{ initialTab?: 'profils' | 'annonces' | 'opportunites' | 'candidatures'; timestamp?: number | string }} props
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
  const [{ recruitmentAdFilters }] = useAppContext();
  const recruitmentMode = getRecruitmentRoleMode(userData);
  const isCoachOrAdmin = recruitmentMode === 'staff';
  const managedTeams = React.useMemo(() => dedupeManagedTeams([
    ...(userData?.myTeams || []),
    ...(userData?.trainedTeams || []),
  ]), [userData?.myTeams, userData?.trainedTeams]);
  const managedTeamIds = React.useMemo(
    () => managedTeams.map((team) => getManagedTeamKey(team)).filter(Boolean),
    [managedTeams],
  );

  // State
  const [activeTab, setActiveTab] = useState(
    sanitizeRecruitmentTabForRole(initialTab, userData),
  );
  const [ads, setAds] = useState(/** @type {RecruitmentAdItem[]} */ ([]));
  const [myAds, setMyAds] = useState(/** @type {RecruitmentAdItem[]} */ ([]));
  const [myApplications, setMyApplications] = useState(/** @type {RecruitmentAdItem[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [applyingAdId, setApplyingAdId] = useState('');
  const [adSearchValue, setAdSearchValue] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [showProfileMatchesOnly, setShowProfileMatchesOnly] = useState(false);
  const adFiltersCount = React.useMemo(
    () => getAppliedFilterCount(recruitmentAdFilters, ['q']),
    [recruitmentAdFilters],
  );
  const hasAdFilters = adFiltersCount > 0;

  // Handle external tab switching (e.g. from creation wizard)
  useEffect(() => {
    const nextTab = sanitizeRecruitmentTabForRole(initialTab, userData);
    setActiveTab((previousTab) => (
      previousTab === nextTab ? previousTab : nextTab
    ));
  }, [initialTab, userData]);

  // State for pagination (ads)
  const [adsPage, setAdsPage] = useState(1);
  const [adsHasMore, setAdsHasMore] = useState(true);
  const [adsLoadingMore, setAdsLoadingMore] = useState(false);

  // Fetch ads for players (smart feed)
  const fetchAdsForPlayer = useCallback(async (page = 1, append = false, isRefresh = false) => {
    if (page === 1 && !isRefresh) setLoading(true);
    else if (page > 1) setAdsLoadingMore(true);

    try {
      const searchTerm = adSearchValue?.trim();
      let newAds = [];
      let meta = {};
      if ((searchTerm && searchTerm.length >= 2) || hasAdFilters) {
        const response = await searchRecruitment({
          ...recruitmentAdFilters,
          page,
          pageSize: 10,
          ...(searchTerm && searchTerm.length >= 2 ? { q: searchTerm, sort: 'relevance' } : { sort: 'date' }),
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
  }, [adSearchValue, hasAdFilters, recruitmentAdFilters]);

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
      const ownerFilters = managedTeamIds.length > 0
        ? { teamIds: managedTeamIds }
        : { authorDocumentId: userData?.documentId };
      let data = [];
      if ((searchTerm && searchTerm.length >= 2) || hasAdFilters) {
        const response = await searchRecruitment({
          ...ownerFilters,
          ...recruitmentAdFilters,
          includeInactive: true,
          page: 1,
          pageSize: 30,
          ...(searchTerm && searchTerm.length >= 2 ? { q: searchTerm, sort: 'relevance' } : { sort: 'date' }),
        });
        data = mapSearchPayload(response);
      } else {
        data = await getMyRecruitmentAds(ownerFilters);
      }
      setMyAds(data || []);
    } catch (error) {
      console.error('[RecrutementListContent] Error fetching my ads:', error);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, [adSearchValue, hasAdFilters, isCoachOrAdmin, managedTeamIds, recruitmentAdFilters, userData?.documentId]);

  // Handle forced refresh from navigation params (timestamp)
  useEffect(() => {
    if (!timestamp) return;
    console.log('[RecrutementListContent] Forced refresh triggered by timestamp:', timestamp);
    if (isCoachOrAdmin && activeTab === 'annonces') {
      fetchMyAds(true);
    }
  }, [activeTab, fetchMyAds, isCoachOrAdmin, timestamp]);

  // Fetch my applications (for players)
  const fetchMyApplications = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await getMyApplications(userData);
      setMyApplications(data || []);
    } catch (error) {
      console.error('[RecrutementListContent] Error fetching applications:', error);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, [userData]);

  const fetchMyApplicationsSilently = useCallback(async () => {
    try {
      const data = await getMyApplications(userData);
      setMyApplications(data || []);
    } catch (error) {
      console.error('[RecrutementListContent] Error silently fetching applications:', error);
    }
  }, [userData]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'profils') {
        return undefined;
      }

      if (activeTab === 'annonces' && isCoachOrAdmin) {
        fetchMyAds(true);
      } else if (activeTab === 'candidatures') {
        fetchMyApplications(true);
      } else {
        fetchAdsForPlayer(1, false, true);
      }

      fetchMyApplicationsSilently();
      return undefined;
    }, [
      activeTab,
      fetchAdsForPlayer,
      fetchMyAds,
      fetchMyApplications,
      fetchMyApplicationsSilently,
      isCoachOrAdmin,
    ]),
  );

  const detectionApplicationStatusByEvent = useMemo(
    () => buildDetectionApplicationStatusMap(myApplications, userData),
    [myApplications, userData],
  );

  const matchesAudienceFilter = useCallback((ad) => (
    audienceFilter === 'all' || normalizeAudienceType(ad?.audienceType) === audienceFilter
  ), [audienceFilter]);

  const filteredMyAds = useMemo(
    () => myAds.filter((ad) => matchesAudienceFilter(ad)),
    [matchesAudienceFilter, myAds],
  );
  const filteredMyApplications = useMemo(
    () => myApplications.filter((ad) => matchesAudienceFilter(ad)),
    [matchesAudienceFilter, myApplications],
  );

  // Effect to fetch data based on tab
  useEffect(() => {
    if (activeTab === 'profils') return;

    if (activeTab === 'annonces' && isCoachOrAdmin) {
      fetchMyAds();
      return;
    }

    if (activeTab === 'candidatures') {
      fetchMyApplications();
      return;
    }

    fetchAdsForPlayer(1, false);
  }, [activeTab, fetchAdsForPlayer, fetchMyAds, fetchMyApplications, isCoachOrAdmin]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeTab === 'profils') return;

      if (activeTab === 'annonces' && isCoachOrAdmin) {
        await fetchMyAds(true);
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
  }, [activeTab, isCoachOrAdmin, fetchMyAds, fetchMyApplications, fetchAdsForPlayer]);

  // Handle card press (navigate to user details)
  const handleUserCardPress = (/** @type {MercatoUser} */ user) => {
    nav.navigate(RouteNames.ProfileStack, {
      params: { userId: user.documentId || user.id },
      screen: RouteNames.UserDetails,
    });
  };

  // Handle ad card press
  const handleAdCardPress = useCallback((/** @type {RecruitmentAdItem} */ ad, isOwnerContext = false) => {
    nav.navigate(RouteNames.RecruitmentAdDetails, { ad, isOwner: isOwnerContext });
  }, [nav]);

  const handleAdApply = useCallback(async (/** @type {RecruitmentAdItem} */ ad) => {
    const adId = getRecruitmentAdKey(ad);
    if (!adId) return;

    if (!ad?.isActive) {
      Alert.alert('Candidature', 'Cette annonce n est plus active.');
      return;
    }

    const applicationState = resolveRecruitmentAdApplicationState(
      ad,
      userData,
      detectionApplicationStatusByEvent,
    );
    const isDetectionLinked = normalizeTypeLabel(ad?.event?.type?.name).includes('detection');

    if (applicationState.hasApplied) {
      let alreadyAppliedMessage = 'Tu as deja postule a cette annonce.';

      if (applicationState.status === 'accepted') {
        alreadyAppliedMessage = isDetectionLinked
          ? 'Tu participes deja a cette detection.'
          : 'Ta candidature est deja validee pour cette annonce.';
      } else if (isDetectionLinked) {
        alreadyAppliedMessage = 'Tu as deja une candidature en attente sur cette detection.';
      }

      Alert.alert(
        'Candidature',
        alreadyAppliedMessage,
      );
      return;
    }

    if (isDetectionLinked) {
      handleAdCardPress(ad);
      return;
    }

    if (normalizeAudienceType(ad?.audienceType) === 'coach') {
      handleAdCardPress(ad);
      return;
    }

    setApplyingAdId(adId);

    try {
      const result = await applyToRecruitmentAd(adId, {});
      await Promise.all([
        fetchAdsForPlayer(1, false, true),
        fetchMyApplicationsSilently(),
      ]);
      Alert.alert(
        'Candidature envoyee',
        result?.message || 'Ta candidature a bien ete envoyee.',
      );
    } catch (error) {
      const message = error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.message
        || 'Impossible d envoyer la candidature pour le moment.';
      Alert.alert('Candidature', message);
    } finally {
      setApplyingAdId((currentAdId) => (currentAdId === adId ? '' : currentAdId));
    }
  }, [
    detectionApplicationStatusByEvent,
    fetchAdsForPlayer,
    fetchMyApplicationsSilently,
    handleAdCardPress,
    userData,
  ]);

  const renderSegmentedTab = (key, label) => {
    const isActive = activeTab === key;

    return (
      <TouchableOpacity
        key={key}
        onPress={() => setActiveTab(key)}
        style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          {
            backgroundColor: isActive ? recruitmentSurfaceStrong : 'rgba(255,255,255,0.02)',
            borderColor: isActive ? recruitmentBorderSoft : 'transparent',
            borderRadius: 12,
            borderWidth: 1,
            flex: 1,
            minHeight: 42,
            paddingHorizontal: 12,
            paddingVertical: 8,
          },
        ]}
      >
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          numberOfLines={1}
          style={[
            Fonts.p3Bold,
            {
              color: isActive ? Colors.neutral100 : Colors.neutral500,
              textAlign: 'center',
            },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderAudienceTypeTabs = () => {
    const options = [
      { key: 'all', label: 'Toutes' },
      { key: 'player', label: 'Joueurs' },
      { key: 'coach', label: 'Entraineurs' },
    ];

    return (
      <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
        {options.map((option) => {
          const isActive = audienceFilter === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => setAudienceFilter(option.key)}
              style={{
                backgroundColor: isActive ? recruitmentSurfaceStrong : recruitmentSurface,
                borderColor: isActive ? recruitmentBorder : recruitmentBorderSoft,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text
                style={[
                  Fonts.p4Bold,
                  { color: isActive ? Colors.primary500 : Colors.neutral200 },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Render Coach TopTabs
  const renderCoachTabs = () => (
    <View style={[
      Alignments.row,
      Alignments.justifyCenter,
      Spaces.gap[8],
      {
        backgroundColor: recruitmentSurfaceSoft,
        borderColor: recruitmentBorderSoft,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 32,
        padding: 5,
      },
    ]}
    >
      {renderSegmentedTab('profils', 'Profils')}
      {renderSegmentedTab('opportunites', 'Opportunites')}
      {renderSegmentedTab('annonces', 'Mes annonces')}
      {renderSegmentedTab('candidatures', 'Mes candidatures')}
    </View>
  );

  // Render content for Coach - Annonces tab
  const renderAnnoncesContent = () => {
    const annoncesHeader = (
      <View style={[Spaces.gap[12], Spaces.marginBottom[4]]}>
        <View style={{
          backgroundColor: recruitmentSurface,
          borderColor: recruitmentBorderSoft,
          borderRadius: 16,
          borderWidth: 1,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
            Mes annonces
          </Text>
          <Text style={[Fonts.p3, { color: recruitmentMutedText, marginTop: 4 }]}>
            Consultez et gérez les annonces publiées pour vos équipes.
          </Text>
        </View>
        {renderAudienceTypeTabs()}
        <TouchableOpacity
          onPress={() => {
            nav.navigate(RouteNames.AdWizardStack);
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
        <View style={[Spaces.marginTop[14]]}>
          <SearchComponent
            filterNumber={adFiltersCount}
            handleSearchField={setAdSearchValue}
            openFilters={() => nav.navigate(RouteNames.RecruitmentAdFilters)}
            placeholder="Rechercher dans mes annonces..."
            searchDefaultValue={adSearchValue}
          />
          {adSearchValue?.trim()?.length >= 2 ? (
            <Text style={[Fonts.p3, { color: Colors.primary500 }, Spaces.marginTop[8]]}>
              Trie par pertinence
            </Text>
          ) : null}
        </View>
      </View>
    );

    return loading ? (
      <Loader />
    ) : (
      <FlatList
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[140], { flexGrow: 1 }]}
        data={filteredMyAds}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => String(item.documentId || item.id || Math.random())}
        ListEmptyComponent={(
          <Text style={[Fonts.p1, Fonts.neutral500, { textAlign: 'center' }, Spaces.marginTop[24]]}>
            {managedTeamIds.length > 0
              ? 'Aucune annonce publi\u00E9e pour vos \u00E9quipes sur ce filtre'
              : 'Aucune annonce cr\u00E9\u00E9e sur ce filtre'}
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
                detectionApplicationStatusByEvent={detectionApplicationStatusByEvent}
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
  const rankedPlayerAds = React.useMemo(() => ads
    .filter((ad) => matchesAudienceFilter(ad))
    .map((ad) => {
      const { __search: searchMeta, ...rest } = ad;
      return {
        ...rest,
        profileMatchMeta: getProfileMatchInfo(ad, userData),
        searchMeta,
      };
    }), [ads, matchesAudienceFilter, userData]);
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

  const playerFilterHelperText = React.useMemo(() => {
    if (!hasProfileSignals) {
      return 'Compl\u00E8te ton profil pour activer un tri personnalis\u00E9.';
    }
    if (showProfileMatchesOnly) {
      return 'Le flux affiche uniquement les annonces compatibles.';
    }
    return 'Les annonces compatibles restent affich\u00E9es en t\u00EAte.';
  }, [hasProfileSignals, showProfileMatchesOnly]);

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
              ? 'Aucune annonce ne correspond exactement \u00E0 ton profil pour le moment.'
              : 'Compl\u00E8te ton profil pour activer le tri personnalis\u00E9 des annonces.'}
          </Text>
          <Text style={[Fonts.p2, { color: recruitmentMutedText, marginTop: 8, textAlign: 'center' }]}>
            {hasProfileSignals
              ? 'D\u00E9sactive le filtre pour afficher toutes les annonces disponibles.'
              : 'Tu peux d\u00E9j\u00E0 consulter toutes les annonces publi\u00E9es sur l\'application.'}
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
        style={[Spaces.marginTop[2], {
          alignItems: 'center',
          backgroundColor: recruitmentSurface,
          borderColor: isMatching ? recruitmentBorder : recruitmentBorderSoft,
          borderRadius: 16,
          borderWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 10,
        }]}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
            {title}
          </Text>
        </View>
        <View style={{ alignItems: 'center', flexDirection: 'row' }}>
          {isMatching ? (
            <Text style={[Fonts.p4Bold, { color: Colors.primary500, marginRight: 8 }]}>
              Prioritaires
            </Text>
          ) : null}
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
      </View>
    );
  };

  const renderPlayerListHeader = () => (
    <View style={[Spaces.gap[18], Spaces.marginBottom[14]]}>
      {renderAudienceTypeTabs()}
      <View style={{
        backgroundColor: recruitmentSurfaceStrong,
        borderColor: recruitmentBorderSoft,
        borderRadius: 18,
        borderWidth: 1,
        paddingHorizontal: 18,
        paddingVertical: 20,
      }}
      >
        <View style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
        >
          <View style={{ flex: 1, paddingRight: 14 }}>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
              Compatibles avec mon profil
            </Text>
            <Text style={[Fonts.p4, { color: recruitmentMutedText, marginTop: 8 }]}>
              {playerFilterHelperText}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityState={{ checked: showProfileMatchesOnly }}
            onPress={() => setShowProfileMatchesOnly(!showProfileMatchesOnly)}
            style={{
              backgroundColor: showProfileMatchesOnly ? Colors.primary500 : recruitmentToggleOff,
              borderRadius: 14,
              height: 28,
              justifyContent: 'center',
              paddingHorizontal: 2,
              width: 50,
            }}
          >
            <View style={{
              alignSelf: showProfileMatchesOnly ? 'flex-end' : 'flex-start',
              backgroundColor: Colors.neutral00,
              borderRadius: 12,
              height: 24,
              width: 24,
            }}
            />
          </TouchableOpacity>
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
            borderRadius: 16,
            borderWidth: 1,
            paddingHorizontal: 18,
            paddingVertical: 16,
          }}
        >
          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
                Compléter mon profil
              </Text>
              <Text style={[Fonts.p4, { color: recruitmentMutedText, marginTop: 8 }]}>
                Sport, section, catégorie, niveau.
              </Text>
            </View>
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
              Ouvrir
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}
      <View style={[Spaces.marginTop[14]]}>
        <SearchComponent
          filterNumber={adFiltersCount}
          handleSearchField={setAdSearchValue}
          openFilters={() => nav.navigate(RouteNames.RecruitmentAdFilters)}
          placeholder="Rechercher une annonce..."
          searchDefaultValue={adSearchValue}
        />
        {adSearchValue?.trim()?.length >= 2 ? (
          <Text style={[Fonts.p3, { color: Colors.primary500 }, Spaces.marginTop[8]]}>
            Trie par pertinence
          </Text>
        ) : null}
      </View>
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
              <RecruitmentAdCard
                ad={ad}
                detectionApplicationStatusByEvent={detectionApplicationStatusByEvent}
                isApplying={applyingAdId === getRecruitmentAdKey(ad)}
                onApply={handleAdApply}
                onPress={handleAdCardPress}
              />
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
      Spaces.marginBottom[20],
      Spaces.gap[8],
      {
        backgroundColor: recruitmentSurfaceSoft,
        borderColor: recruitmentBorderSoft,
        borderRadius: 16,
        borderWidth: 1,
        padding: 5,
      },
    ]}
    >
      {renderSegmentedTab('annonces', 'Annonces')}
      {renderSegmentedTab('candidatures', 'Mes candidatures')}
    </View>
  );

  // Render Applications Content
  const renderApplicationsContent = () => (
    loading ? (
      <Loader />
    ) : (
      <FlatList
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[140], { flexGrow: 1 }]}
        data={filteredMyApplications}
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
          <View style={[Spaces.gap[12], Spaces.marginBottom[16]]}>
            <Text style={[Fonts.h4, Fonts.neutral100]}>
              Suivi de tes candidatures
            </Text>
            {renderAudienceTypeTabs()}
          </View>
        )}
        onRefresh={onRefresh}
        refreshing={refreshing}
        renderItem={({ item }) => (
          <RecruitmentAdCard
            ad={item}
            detectionApplicationStatusByEvent={detectionApplicationStatusByEvent}
            onPress={handleAdCardPress}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />
    )
  );

  return (
    <View style={[Alignments.fill, { width: '100%' }]}>
      {isCoachOrAdmin ? (
        <View style={{ flex: 1 }}>
          {renderCoachTabs()}
          {activeTab === 'profils' ? (
            <RecruitmentProfilesList
              bottomPadding={140}
              onUserPress={handleUserCardPress}
            />
          ) : null}
          {activeTab === 'annonces' ? renderAnnoncesContent() : null}
          {activeTab === 'opportunites' ? renderPlayerContent() : null}
          {activeTab === 'candidatures' ? renderApplicationsContent() : null}
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
