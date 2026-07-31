import { useNavigation } from '@react-navigation/native';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  canApplyToFriendlyMatchAd,
  canPublishFriendlyMatchAd,
  filterFriendlyMatchAds,
  getDistanceKm,
  getFriendlyMatchRoleMode,
  sanitizeFriendlyMatchTabForRole,
} from '@/domains/search/friendlyMatchFlow';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';
import FriendlyMatchAdCard from '@/components/molecules/friendlyMatchAdCard/FriendlyMatchAdCard';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';

import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';

import {
  getFriendlyMatchAds,
  getMyFriendlyMatchAds,
  getMyFriendlyMatchApplications,
} from '@/services/friendlyMatch/friendlyMatchService';

import { createLogger } from '@/utils/logger/logger';
import { markSearchPerf } from '@/utils/performance/searchPerformance';

import FriendlyMatchFiltersSheet, {
  countFriendlyMatchFilters,
  EMPTY_FRIENDLY_MATCH_FILTERS,
} from './FriendlyMatchFiltersSheet';

const PAGE_SIZE = 10;
const logger = createLogger('friendly-match-list');

/**
 * La cle d une equipe geree par le lecteur.
 * @param {any} team
 * @returns {string}
 */
const getTeamKey = (team) => String(team?.documentId || team?.id || '').trim();

/**
 * La cle d une annonce, pour la deduplication et le rendu de liste.
 * @param {any} ad
 * @returns {string}
 */
const getAdKey = (ad) => String(ad?.documentId || ad?.id || '').trim();

/**
 * La liste des annonces de matchs amicaux (spec §4.2).
 *
 * COPIE SEPAREE de RecrutementListContent, jamais une extension : les deux
 * parcours n ont ni les memes onglets, ni la meme population, ni les memes
 * donnees. Le mecanisme des sous-onglets par role vient de friendlyMatchFlow.js.
 * @param {{
 *  initialTab?: string;
 *  refreshSignal?: number;
 *  screenActive?: boolean;
 * }} props
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchListContent({
  initialTab,
  refreshSignal = 0,
  screenActive = true,
}) {
  const isWeb = Platform.OS === 'web';
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const navigation = /** @type {any} */ (useNavigation());
  const { userData } = /** @type {any} */ (useAuth());

  const isAuthenticated = Boolean(userData?.documentId);
  const isStaff = getFriendlyMatchRoleMode(userData) === 'staff';
  const canApply = canApplyToFriendlyMatchAd(userData);
  const canPublish = canPublishFriendlyMatchAd(userData);

  const surface = `${Colors.primary900}F0`;
  const surfaceSoft = `${Colors.primary500}14`;
  const surfaceStrong = `${Colors.primary700}70`;
  const borderSoft = `${Colors.primary500}26`;
  const mutedText = `${Colors.neutral100}C4`;

  const managedTeamIds = useMemo(() => Array.from(new Set([
    ...(userData?.myTeams || []),
    ...(userData?.trainedTeams || []),
  ].map(getTeamKey).filter(Boolean))), [userData?.myTeams, userData?.trainedTeams]);

  const [activeTab, setActiveTab] = useState(
    () => sanitizeFriendlyMatchTabForRole(initialTab, userData),
  );
  const [ads, setAds] = useState(/** @type {any[]} */ ([]));
  const [myAds, setMyAds] = useState(/** @type {any[]} */ ([]));
  const [myApplications, setMyApplications] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [filters, setFilters] = useState(/** @type {any} */ (EMPTY_FRIENDLY_MATCH_FILTERS));
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);
  const perfSignatureRef = useRef('');

  const filtersCount = useMemo(() => countFriendlyMatchFilters(filters), [filters]);
  // La position du lecteur sert la distance affichee et le filtre de rayon.
  // Absente, la distance ne s affiche pas et le filtre ne masque rien (§4.2).
  const viewerLocation = userData?.homeBase || userData?.location || userData?.address || null;

  // Un onglet interdit au role ne doit jamais rester affiche : un joueur qui
  // arrive avec ?tab=candidatures retombe sur la liste publique.
  useEffect(() => {
    setActiveTab((previousTab) => sanitizeFriendlyMatchTabForRole(previousTab, userData));
  }, [userData]);

  useEffect(() => {
    if (!screenActive) return;
    setActiveTab(sanitizeFriendlyMatchTabForRole(initialTab, userData));
  }, [initialTab, screenActive, userData]);

  const fetchAds = useCallback(async (nextPage = 1, append = false, isRefresh = false) => {
    if (nextPage === 1 && !isRefresh) setLoading(true);
    else if (nextPage > 1) setLoadingMore(true);

    try {
      const response = await getFriendlyMatchAds({
        page: nextPage,
        pageSize: PAGE_SIZE,
        search: searchValue.trim(),
      });
      const received = response.data || [];

      setAds((previous) => {
        if (!append) return received;
        const seen = new Set(previous.map(getAdKey));
        return [...previous, ...received.filter((ad) => !seen.has(getAdKey(ad)))];
      });
      setHasMore(response.meta?.pagination
        ? nextPage < response.meta.pagination.pageCount
        : false);
      setPage(nextPage);
    } catch (error) {
      logger.error('Erreur de chargement des annonces', { error });
    } finally {
      if (nextPage === 1 && !isRefresh) setLoading(false);
      else if (nextPage > 1) setLoadingMore(false);
    }
  }, [searchValue]);

  const fetchMyAds = useCallback(async (isRefresh = false) => {
    if (!isStaff) return;
    if (!isRefresh) setLoading(true);
    try {
      setMyAds(await getMyFriendlyMatchAds({
        authorDocumentId: userData?.documentId,
        teamIds: managedTeamIds,
      }));
    } catch (error) {
      logger.error('Erreur de chargement de mes annonces', { error });
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, [isStaff, managedTeamIds, userData?.documentId]);

  const fetchMyApplications = useCallback(async (isRefresh = false) => {
    if (!isStaff) return;
    if (!isRefresh) setLoading(true);
    try {
      setMyApplications(await getMyFriendlyMatchApplications(managedTeamIds));
    } catch (error) {
      logger.error('Erreur de chargement des candidatures', { error });
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, [isStaff, managedTeamIds]);

  useEffect(() => {
    if (!screenActive) return;
    if (activeTab === 'mes-annonces') fetchMyAds();
    else if (activeTab === 'candidatures') fetchMyApplications();
    else fetchAds(1, false);
  }, [activeTab, fetchAds, fetchMyAds, fetchMyApplications, refreshSignal, screenActive]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeTab === 'mes-annonces') await fetchMyAds(true);
      else if (activeTab === 'candidatures') await fetchMyApplications(true);
      else await fetchAds(1, false, true);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, fetchAds, fetchMyAds, fetchMyApplications]);

  const handleLoadMore = useCallback(() => {
    if (activeTab !== 'annonces' || loadingMore || !hasMore) return;
    fetchAds(page + 1, true);
  }, [activeTab, fetchAds, hasMore, loadingMore, page]);

  const withDistance = useCallback((/** @type {any[]} */ items) => items.map((ad) => ({
    ...ad,
    distanceKm: getDistanceKm(viewerLocation, ad?.location),
  })), [viewerLocation]);

  const visibleAds = useMemo(() => withDistance(
    filterFriendlyMatchAds(ads, { ...filters, viewerLocation }),
  ), [ads, filters, viewerLocation, withDistance]);

  const visibleMyAds = useMemo(() => withDistance(myAds), [myAds, withDistance]);
  const visibleMyApplications = useMemo(
    () => withDistance(myApplications),
    [myApplications, withDistance],
  );

  const activeResultCount = useMemo(() => {
    if (activeTab === 'mes-annonces') return visibleMyAds.length;
    if (activeTab === 'candidatures') return visibleMyApplications.length;
    return visibleAds.length;
  }, [activeTab, visibleAds.length, visibleMyAds.length, visibleMyApplications.length]);

  useEffect(() => {
    if (!screenActive || loading) return;
    const signature = `${activeTab}:${activeResultCount}:${searchValue}:${filtersCount}`;
    if (perfSignatureRef.current === signature) return;
    perfSignatureRef.current = signature;
    markSearchPerf('search_first_results_rendered', {
      fromCache: false,
      mode: `${isStaff ? 'staff' : 'visitor'}-${activeTab}`,
      networkCount: 1,
      resultCount: activeResultCount,
      type: 'amicaux',
    });
  }, [activeResultCount, activeTab, filtersCount, isStaff, loading, screenActive, searchValue]);

  const handleAdPress = useCallback(() => {
    // ponytail: L4 livre la LISTE. Le detail, l assistant de publication et le
    // fil de discussion sont le lot L5 : tant qu ils n existent pas, on le dit
    // au lieu d ouvrir un ecran vide. A remplacer par la navigation en L5.
    Alert.alert(
      'Matchs amicaux',
      "Le détail d'une annonce et la réponse aux annonces arrivent très vite.",
    );
  }, []);

  const handleApplyPress = useCallback(() => {
    if (!isAuthenticated) {
      openPublicAuthFlow(navigation, {
        origin: 'friendly-match-list',
        source: 'friendly-match-apply',
      });
      return;
    }
    handleAdPress();
  }, [handleAdPress, isAuthenticated, navigation]);

  /**
   * Un sous-onglet du staff, haut de 44 pt et annonce comme onglet selectionne.
   * @param {string} key
   * @param {string} label
   * @returns {import('react').ReactElement}
   */
  const renderTab = (key, label) => {
    const isActive = activeTab === key;
    return (
      <TouchableOpacity
        accessibilityLabel={label}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        key={key}
        onPress={() => setActiveTab(key)}
        style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          {
            backgroundColor: isActive ? surfaceStrong : withAlpha(Colors.neutral00, 0.02),
            borderColor: isActive ? borderSoft : 'transparent',
            borderRadius: 12,
            borderWidth: 1,
            flex: 1,
            minHeight: isWeb ? 46 : 44,
            paddingHorizontal: 8,
            paddingVertical: isWeb ? 10 : 8,
          },
        ]}
      >
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.7}
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

  /**
   * Un etat vide qui dit quoi faire, pas seulement qu il n y a rien.
   * @param {string} title
   * @param {string} hint
   * @returns {import('react').ReactElement}
   */
  const renderEmptyState = (title, hint) => (
    <View style={[Spaces.padding[24], {
      alignItems: 'center',
      backgroundColor: surface,
      borderColor: borderSoft,
      borderRadius: 18,
      borderWidth: 1,
    }]}
    >
      <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[Fonts.p2, { color: mutedText, marginTop: 8, textAlign: 'center' }]}>
        {hint}
      </Text>
    </View>
  );

  const listHeader = (
    <View style={[Spaces.gap[12], Spaces.marginBottom[4]]}>
      <View style={{
        backgroundColor: surface,
        borderColor: borderSoft,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
      >
        <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
          {activeTab === 'mes-annonces' ? 'Mes annonces' : 'Trouver un adversaire'}
        </Text>
        <Text style={[Fonts.p3, { color: mutedText, marginTop: 4 }]}>
          {activeTab === 'mes-annonces'
            ? 'Les annonces publiées pour tes équipes et les propositions reçues.'
            : 'Les équipes qui cherchent un match amical près de chez toi.'}
        </Text>
      </View>

      {canPublish && activeTab !== 'candidatures' ? (
        <TouchableOpacity
          accessibilityLabel="Publier une annonce de match amical"
          accessibilityRole="button"
          onPress={handleAdPress}
          style={[Spaces.padding[16], {
            alignItems: 'center',
            backgroundColor: Colors.primary500,
            borderRadius: 12,
            minHeight: 44,
          }]}
        >
          <Text style={[Fonts.p1Bold, { color: Colors.neutral900 }]}>
            + Publier une annonce
          </Text>
        </TouchableOpacity>
      ) : null}

      {activeTab === 'annonces' ? (
        <View style={[Spaces.marginTop[8]]}>
          <SearchComponent
            filterNumber={filtersCount}
            handleSearchField={setSearchValue}
            openFilters={() => setIsFiltersVisible(true)}
            placeholder="Rechercher une équipe, une ville..."
            searchDefaultValue={searchValue}
          />
        </View>
      ) : null}
    </View>
  );

  let data = visibleAds;
  let emptyState = renderEmptyState(
    'Aucune annonce de match amical pour le moment.',
    filtersCount > 0
      ? 'Élargis tes filtres : la distance et « je veux recevoir » en masquent peut-être.'
      : 'Reviens un peu plus tard, ou publie la tienne si tu encadres une équipe.',
  );

  if (activeTab === 'mes-annonces') {
    data = visibleMyAds;
    emptyState = renderEmptyState(
      'Tu n’as encore publié aucune annonce.',
      'Publie une annonce pour que d’autres équipes te proposent un match.',
    );
  } else if (activeTab === 'candidatures') {
    data = visibleMyApplications;
    emptyState = renderEmptyState(
      'Tu n’as encore proposé aucun match.',
      'Ouvre une annonce et propose un match : une conversation s’ouvrira avec le staff.',
    );
  }

  return (
    <View style={[Alignments.fill, { width: '100%' }]}>
      {isStaff ? (
        <View style={[
          Alignments.row,
          Alignments.justifyCenter,
          Spaces.gap[8],
          Spaces.marginBottom[24],
          {
            backgroundColor: surfaceSoft,
            borderColor: borderSoft,
            borderRadius: 16,
            borderWidth: 1,
            padding: isWeb ? 6 : 5,
          },
        ]}
        >
          {renderTab('annonces', 'Annonces')}
          {renderTab('mes-annonces', 'Mes annonces')}
          {renderTab('candidatures', 'Mes propositions')}
        </View>
      ) : null}

      {loading ? <Loader /> : (
        <FlatList
          contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[128], { flexGrow: 1 }]}
          data={data}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item, index) => getAdKey(item) || String(index)}
          ListEmptyComponent={emptyState}
          ListHeaderComponent={listHeader}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          renderItem={({ item }) => (
            <FriendlyMatchAdCard
              ad={item}
              canApply={canApply}
              distanceKm={item.distanceKm}
              isOwner={activeTab === 'mes-annonces'}
              myApplicationStatus={item.applicationStatus || null}
              onApply={handleApplyPress}
              onPress={handleAdPress}
            />
          )}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        />
      )}

      <FriendlyMatchFiltersSheet
        filters={filters}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
          setIsFiltersVisible(false);
        }}
        onClose={() => setIsFiltersVisible(false)}
        visible={isFiltersVisible}
      />
    </View>
  );
}

export default FriendlyMatchListContent;
