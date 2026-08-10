import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Alert, FlatList, Platform, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  getAppliedFilterCount,
  getRecruitmentRoleMode,
  sanitizeRecruitmentTabForRole,
} from '@/domains/search/recruitmentFlow';
import useTheme from '@/theme/themeContext';

import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

// Components
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import RecruitmentAdCard from '@/components/molecules/recruitmentAdCard/RecruitmentAdCard';
import RecruitmentFiltersSheet from '@/components/organisms/recruitmentFiltersSheet/RecruitmentFiltersSheet';
import RecruitmentProfilesList from '@/components/organisms/recruitmentProfilesList/RecruitmentProfilesList';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';
// Services
import { useAppContext } from '@/store/appContext';

import {
  applyToRecruitmentAd,
  buildDetectionApplicationStatusMap,
  filterVisibleRecruitmentAds,
  getMyApplications,
  getRecruitmentAds,
  resolveRecruitmentAdApplicationState,
} from '@/services/recruitment/recruitmentService';
import { getMatchReasonLabel, mapSearchPayload, searchRecruitment } from '@/services/search/searchService';

import { getApiErrorTranslation } from '@/utils/errors/displayError';
import { markSearchPerf } from '@/utils/performance/searchPerformance';

/**
 * @typedef {{ id?: string | number; documentId?: string; [key: string]: any }} MercatoUser
 * @typedef {{ documentId?: string | number; id?: string | number; name?: string }} LevelRef
 * @typedef {{ id?: string | number; level?: LevelRef; [key: string]: any }} RecruitmentAdItem
 */

const normalizeComparableValue = (/** @type {any} */ value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

const extractComparableValue = (/** @type {any} */ value) => {
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

const getUserCity = (/** @type {any} */ userData) => extractComparableValue(
  userData?.city
  || userData?.address?.city
  || userData?.address?.label,
);

const getProfileMatchInfo = (/** @type {any} */ ad, /** @type {any} */ userData) => {
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

  const reasons = /** @type {string[]} */ ([]);
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
      reasons.push('Catégorie compatible');
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
    reasons.push('Même ville');
  }

  return {
    isMatch: !hardMismatch && (hardMatches > 0 || score >= 2),
    reasons,
    score,
  };
};

const getSortTimestamp = (/** @type {any} */ value) => {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const sortPlayerAds = (/** @type {any} */ left, /** @type {any} */ right) => {
  const rightScore = right?.profileMatchMeta?.score || 0;
  const leftScore = left?.profileMatchMeta?.score || 0;
  if (rightScore !== leftScore) return rightScore - leftScore;

  const rightSearchScore = right?.searchMeta?.score || 0;
  const leftSearchScore = left?.searchMeta?.score || 0;
  if (rightSearchScore !== leftSearchScore) return rightSearchScore - leftSearchScore;

  return getSortTimestamp(right?.createdAt || right?.publishedAt) - getSortTimestamp(left?.createdAt || left?.publishedAt);
};

/**
 * @param {{ matchingAds: Array<any>, otherAds: Array<any>, showMatchingOnly: boolean }} args
 */
const buildPlayerFeedItems = ({ matchingAds, otherAds, showMatchingOnly }) => {
  /** @type {Array<any>} */
  const items = [];

  if (matchingAds.length > 0) {
    items.push({
      count: matchingAds.length,
      key: 'section-matching',
      title: 'Correspondent à ton profil',
      type: 'section',
    });
    matchingAds.forEach((/** @type {any} */ ad) => {
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
    otherAds.forEach((/** @type {any} */ ad) => {
      items.push({
        ad,
        key: `ad-other-${String(ad.documentId || ad.id)}`,
        type: 'ad',
      });
    });
  }

  return items;
};

const formatAdsCountLabel = (/** @type {number} */ count) => `${count} annonce${count > 1 ? 's' : ''}`;
const normalizeAudienceType = (/** @type {any} */ value) => (
  String(value || '').trim().toLowerCase() === 'coach' ? 'coach' : 'player'
);

const getRecruitmentAdKey = (/** @type {any} */ ad) => String(ad?.documentId || ad?.id || '').trim();
const normalizeTypeLabel = (/** @type {any} */ value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

// Ce que l'utilisateur lit quand une liste n'a PAS PU etre chargee — a ne pas
// confondre avec « il n'y a rien a afficher ». Ecrit ici une seule fois : les
// trois listes de l'ecran partagent ces mots.
const UNREACHABLE_TITLE = 'On n’arrive pas à joindre le serveur.';
const UNREACHABLE_DESCRIPTION = 'Vérifie ta connexion, puis réessaie.';
const UNREACHABLE_ACTION = 'Réessayer';

/**
 * Recrutement List Content - Main component for recruitment marketplace
 * Shows different content based on user role:
 * - Coach/Dirigeant: TopTabs with "Profils", "Opportunites" and "Candidatures"
 * - Joueur: Smart feed of recruitment ads matching their profile
 * D57 : ce composant EXPLORE. Ce qu'on gere (mes offres publiees, mes
 * candidatures envoyees cote joueur) vit dans « Mes activites ».
 * @param {{
 *  initialTab?: 'profils' | 'annonces' | 'opportunites' | 'candidatures';
 *  refreshSignal?: number;
 *  screenActive?: boolean;
 * }} props
 */
function RecrutementListContent({
  initialTab,
  refreshSignal = 0,
  screenActive = true,
}) {
  const isWeb = Platform.OS === 'web';
  useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const recruitmentSurface = `${Colors.primary900}F0`;
  const recruitmentSurfaceStrong = `${Colors.primary700}70`;
  const recruitmentSurfaceSoft = `${Colors.primary500}14`;
  const recruitmentBorder = `${Colors.primary500}45`;
  const recruitmentBorderSoft = `${Colors.primary500}26`;
  const recruitmentToggleOff = `${Colors.primary700}B3`;
  const recruitmentMutedText = `${Colors.neutral100}C4`;
  const navigation = useNavigation();
  const nav = /** @type {any} */ (navigation);
  const { userData } = /** @type {any} */ (useAuth());
  const isAuthenticated = Boolean(userData?.documentId);
  const [{ recruitmentAdFilters }, appDispatch] = /** @type {any} */ (useAppContext());
  const recruitmentMode = getRecruitmentRoleMode(userData);
  const isCoachOrAdmin = recruitmentMode === 'staff';

  // State
  const [activeTab, setActiveTab] = useState(
    sanitizeRecruitmentTabForRole(initialTab, userData),
  );
  // L'onglet demande de l'exterieur qu'on a deja applique. Amorce a la valeur
  // du montage : elle vient d'etre honoree par l'etat initial ci-dessus.
  const honoredInitialTabRef = useRef(initialTab);
  const [ads, setAds] = useState(/** @type {RecruitmentAdItem[]} */ ([]));
  const [myApplications, setMyApplications] = useState(/** @type {RecruitmentAdItem[]} */ ([]));
  // Un drapeau par liste, et rien de plus : « je n'ai pas pu charger » n'est pas
  // « il n'y a rien », et les deux listes tombent en panne separement.
  const [adsUnreachable, setAdsUnreachable] = useState(false);
  const [myApplicationsUnreachable, setMyApplicationsUnreachable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [applyingAdId, setApplyingAdId] = useState('');
  const [adSearchValue, setAdSearchValue] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [filtersSheetVisible, setFiltersSheetVisible] = useState(false);
  const [showProfileMatchesOnly, setShowProfileMatchesOnly] = useState(false);
  const primaryQuerySignatureRef = useRef('');
  const firstResultsSignatureRef = useRef('');
  const adFiltersCount = React.useMemo(
    () => getAppliedFilterCount(recruitmentAdFilters, ['q']),
    [recruitmentAdFilters],
  );
  const hasAdFilters = adFiltersCount > 0;
  // D57 — ce que la PASTILLE annonce, profil compris. Volontairement separe de
  // `adFiltersCount` : celui-la decide d'aller interroger la recherche serveur,
  // or le profil se filtre cote client. Les confondre ferait partir une requete
  // de recherche pour un filtre que le serveur ne connait pas.
  const badgeFiltersCount = adFiltersCount + (audienceFilter === 'all' ? 0 : 1);

  // La regle « quel onglet a-t-on le droit d'afficher », en UN SEUL endroit :
  // un visiteur non connecte n'a acces qu'aux annonces, un compte connecte a ce
  // que son role autorise.
  const resolveAllowedTab = useCallback((/** @type {any} */ tab) => (
    isAuthenticated ? sanitizeRecruitmentTabForRole(tab, userData) : 'annonces'
  ), [isAuthenticated, userData]);

  // Garde-fou de role : un onglet interdit ne doit jamais RESTER affiche (perte
  // du staff, deconnexion). Il ne lit pas `activeTab` — forme « updater » — donc
  // il ne peut pas se battre avec le geste de l'utilisateur.
  useEffect(() => {
    setActiveTab((previousTab) => resolveAllowedTab(previousTab));
  }, [resolveAllowedTab]);

  // Handle external tab switching (e.g. from creation wizard)
  // Une demande venue de l'exterieur n'est honoree QU'UNE FOIS. La rejouer a
  // chaque rendu clouerait l'onglet : `initialTab` ne bouge pas quand
  // l'utilisateur appuie sur un onglet, il ramenerait donc toujours au depart.
  // L'ecran inactif ne consomme pas la demande : elle l'attend au retour.
  useEffect(() => {
    if (!screenActive) return;
    if (honoredInitialTabRef.current === initialTab) return;
    honoredInitialTabRef.current = initialTab;
    setActiveTab(resolveAllowedTab(initialTab));
  }, [initialTab, resolveAllowedTab, screenActive]);

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
      let newAds = /** @type {RecruitmentAdItem[]} */ ([]);
      let meta = /** @type {any} */ ({});
      if ((searchTerm && searchTerm.length >= 2) || hasAdFilters) {
        const response = await searchRecruitment({
          ...recruitmentAdFilters,
          page,
          pageSize: 10,
          ...(searchTerm && searchTerm.length >= 2 ? { q: searchTerm, sort: 'relevance' } : { sort: 'date' }),
        });
        newAds = filterVisibleRecruitmentAds(mapSearchPayload(response));
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
          newAds.forEach((/** @type {RecruitmentAdItem} */ item) => {
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

      setAdsUnreachable(false);
      setAdsHasMore(meta.pagination ? page < meta.pagination.pageCount : false);
      setAdsPage(page);
    } catch (error) {
      console.error('[RecrutementListContent] Error fetching ads:', error);
      // Une page suivante ratee ne condamne pas les pages deja affichees :
      // seule la premiere page decide de l'etat « injoignable ».
      if (!append) setAdsUnreachable(true);
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

  // Fetch my applications (for players)
  const fetchMyApplications = useCallback(async (isRefresh = false) => {
    if (!userData?.documentId) {
      setMyApplications([]);
      return;
    }
    if (!isRefresh) setLoading(true);
    try {
      const data = await getMyApplications(userData);
      setMyApplications(data || []);
      setMyApplicationsUnreachable(false);
    } catch (error) {
      console.error('[RecrutementListContent] Error fetching applications:', error);
      setMyApplicationsUnreachable(true);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, [userData]);

  const fetchMyApplicationsSilently = useCallback(async () => {
    if (!userData?.documentId) {
      setMyApplications([]);
      return;
    }
    try {
      const data = await getMyApplications(userData);
      setMyApplications(data || []);
      setMyApplicationsUnreachable(false);
    } catch (error) {
      console.error('[RecrutementListContent] Error silently fetching applications:', error);
      // Volontairement SANS drapeau : ce rafraichissement de fond tourne sur
      // tous les onglets. Le lever remplacerait une liste parfaitement valide,
      // deja a l'ecran, par un ecran de panne.
    }
  }, [userData]);

  useFocusEffect(
    useCallback(() => {
      if (!screenActive) {
        return undefined;
      }
      if (activeTab === 'profils') {
        return undefined;
      }

      if (activeTab === 'candidatures') {
        fetchMyApplications(true);
      } else {
        fetchAdsForPlayer(1, false, true);
      }

      fetchMyApplicationsSilently();
      return undefined;
    }, [
      activeTab,
      fetchAdsForPlayer,
      fetchMyApplications,
      fetchMyApplicationsSilently,
      screenActive,
    ]),
  );

  const detectionApplicationStatusByEvent = useMemo(
    () => buildDetectionApplicationStatusMap(myApplications, userData),
    [myApplications, userData],
  );

  const matchesAudienceFilter = useCallback((/** @type {any} */ ad) => (
    audienceFilter === 'all' || normalizeAudienceType(ad?.audienceType) === audienceFilter
  ), [audienceFilter]);

  const filteredMyApplications = useMemo(
    () => myApplications.filter((ad) => matchesAudienceFilter(ad)),
    [matchesAudienceFilter, myApplications],
  );

  // Effect to fetch data based on tab
  useEffect(() => {
    if (!screenActive) return;
    if (activeTab === 'profils') return;

    if (activeTab === 'candidatures') {
      fetchMyApplications();
      return;
    }

    fetchAdsForPlayer(1, false);
  }, [activeTab, fetchAdsForPlayer, fetchMyApplications, screenActive]);

  const onRefresh = useCallback(async () => {
    if (!screenActive) return;
    setRefreshing(true);
    try {
      if (activeTab === 'profils') return;

      if (activeTab === 'candidatures') {
        await fetchMyApplications(true);
      } else {
        await fetchAdsForPlayer(1, false, true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, fetchMyApplications, fetchAdsForPlayer, screenActive]);

  useEffect(() => {
    if (!screenActive || !refreshSignal) return;
    onRefresh();
  }, [onRefresh, refreshSignal, screenActive]);

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

  const openRecruitmentAuthFlow = useCallback((/** @type {string} */ source, /** @type {RecruitmentAdItem} */ ad) => {
    openPublicAuthFlow(nav, {
      adId: getRecruitmentAdKey(ad),
      origin: RouteNames.RecruitmentAdDetails,
      source,
    });
  }, [nav]);

  const handleAdApply = useCallback(async (/** @type {RecruitmentAdItem} */ ad) => {
    const adId = getRecruitmentAdKey(ad);
    if (!adId) return;

    if (!isAuthenticated) {
      openRecruitmentAuthFlow('recruitment-apply-login', ad);
      return;
    }

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
      let alreadyAppliedMessage = 'Tu as déjà postule à cette annonce.';

      if (applicationState.status === 'accepted') {
        alreadyAppliedMessage = isDetectionLinked
          ? 'Tu participes déjà à cette détection.'
          : 'Ta candidature est déjà validée pour cette annonce.';
      } else if (isDetectionLinked) {
        alreadyAppliedMessage = 'Tu as déjà une candidature en attente sur cette détection.';
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
      const result = /** @type {any} */ (await applyToRecruitmentAd(adId, {}));
      await Promise.all([
        fetchAdsForPlayer(1, false, true),
        fetchMyApplicationsSilently(),
      ]);
      Alert.alert(
        'Candidature envoyée',
        result?.message || 'Ta candidature a bien été envoyée.',
      );
    } catch (error) {
      // Les deux lectures `error.response.data...` qui ouvraient cette chaine
      // etaient MORTES : l'intercepteur HTTP rejette la charge Strapi DEBALLEE
      // (`services/client.native.js:87-93`), donc `error.response` n'existe
      // jamais ici. Seul `error.message` travaillait — par accident du repli.
      // `getApiErrorTranslation` passe devant pour traduire ce qu'on sait
      // traduire (401, 403, 5xx, codes connus) ; en dessous, le message du
      // serveur reste, parce qu'il porte de VRAIS motifs metier rediges en
      // francais (« Ce poste est deja complet. ») qu'aucune cle ne remplace.
      const requestError = /** @type {any} */ (error);
      const message = getApiErrorTranslation(error)
        || requestError?.message
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
    isAuthenticated,
    openRecruitmentAuthFlow,
    userData,
  ]);

  const renderSegmentedTab = (/** @type {string} */ key, /** @type {string} */ label) => {
    const isActive = activeTab === key;

    return (
      <TouchableOpacity
        key={key}
        onPress={() => setActiveTab(/** @type {any} */ (key))}
        style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          {
            backgroundColor: isActive ? recruitmentSurfaceStrong : 'rgba(255,255,255,0.02)',
            borderColor: isActive ? recruitmentBorderSoft : 'transparent',
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
              lineHeight: isWeb ? 19 : Fonts.p3Bold.lineHeight,
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
                paddingVertical: isWeb ? 10 : 8,
              }}
            >
              <Text
                style={[
                  Fonts.p4Bold,
                  {
                    color: isActive ? Colors.primary500 : Colors.neutral200,
                    lineHeight: isWeb ? 17 : Fonts.p4Bold.lineHeight,
                  },
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
        padding: isWeb ? 6 : 5,
      },
    ]}
    >
      {renderSegmentedTab('profils', 'Profils')}
      {renderSegmentedTab('opportunites', 'Opportunités')}
      {renderSegmentedTab('candidatures', 'Candidatures')}
    </View>
  );

  // Le repli « je n'ai pas pu charger », ecrit UNE fois et partage par les trois
  // listes. On reutilise EmptyState (deja en service dans ClubListContent et
  // EventListContent) plutot que de recopier un bloc de JSX par liste.
  // Le rappel est enveloppe : sans ca, Button passerait son evenement de
  // pression en premier argument, et `fetchMyAds(event)` partirait en
  // rafraichissement silencieux, sans jamais montrer le chargement.
  const renderUnreachableState = (/** @type {() => void} */ onRetry) => (
    <EmptyState
      actionLabel={UNREACHABLE_ACTION}
      description={UNREACHABLE_DESCRIPTION}
      onAction={onRetry}
      title={UNREACHABLE_TITLE}
    />
  );

  // Le bouton de publication, ecrit UNE fois et pose a DEUX endroits : sur
  // l onglet d exploration (« Profils »), ou le pack le veut — on publie depuis
  // Rechercher — et dans l en-tete de « Mes annonces », ou il vivait seul.
  // Les mots viennent du pack : dans ce lot on publie une OFFRE, jamais une
  // « annonce » (le meme mot couvrait trois objets differents).
  const renderPublishOfferCta = () => (
    <TouchableOpacity
      accessibilityLabel="Publier une offre de recrutement"
      accessibilityRole="button"
      onPress={() => {
        nav.navigate(RouteNames.AdWizardStack);
      }}
      style={[
        Spaces.padding[16],
        {
          alignItems: 'center',
          backgroundColor: Colors.primary500,
          borderRadius: 12,
          minHeight: 44,
        },
      ]}
    >
      <Text style={[Fonts.p1Bold, { color: Colors.neutral900 }]}>
        + Publier une offre
      </Text>
    </TouchableOpacity>
  );

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
  const activeMode = isCoachOrAdmin ? `staff-${activeTab}` : `player-${activeTab}`;
  const activeResultCount = useMemo(() => {
    if (activeTab === 'profils') return 0;
    if (activeTab === 'candidatures') return filteredMyApplications.length;
    return playerFeedItems.filter((item) => item.type === 'ad').length;
  }, [activeTab, filteredMyApplications.length, playerFeedItems]);

  useEffect(() => {
    if (!screenActive) return;

    const signature = `${activeMode}:${adSearchValue}:${adFiltersCount}`;
    if (primaryQuerySignatureRef.current === signature) return;
    primaryQuerySignatureRef.current = signature;
    markSearchPerf('search_primary_query_started', {
      fromCache: activeResultCount > 0,
      mode: activeMode,
      networkCount: 1,
      type: 'recruitment',
    });
  }, [activeMode, activeResultCount, adFiltersCount, adSearchValue, screenActive]);

  useEffect(() => {
    if (!screenActive || loading) return;

    const signature = `${activeMode}:${activeResultCount}`;
    if (firstResultsSignatureRef.current === signature) return;
    firstResultsSignatureRef.current = signature;
    markSearchPerf('search_primary_query_completed', {
      fromCache: activeResultCount > 0,
      mode: activeMode,
      networkCount: 1,
      resultCount: activeResultCount,
      type: 'recruitment',
    });
    markSearchPerf('search_first_results_rendered', {
      fromCache: activeResultCount > 0,
      mode: activeMode,
      networkCount: 1,
      resultCount: activeResultCount,
      type: 'recruitment',
    });
  }, [activeMode, activeResultCount, loading, screenActive]);

  const playerFilterHelperText = React.useMemo(() => {
    if (!hasProfileSignals) {
      return 'Complète ton profil pour activer un tri personnalisé.';
    }
    if (showProfileMatchesOnly) {
      return 'Le flux affiche uniquement les annonces compatibles.';
    }
    return 'Les annonces compatibles restent affichées en tête.';
  }, [hasProfileSignals, showProfileMatchesOnly]);

  const renderPlayerEmptyState = () => {
    // La panne passe AVANT le filtre : sans ca, un serveur muet renverrait
    // l'utilisateur ajuster une recherche qui n'y est pour rien.
    if (adsUnreachable) {
      return renderUnreachableState(() => fetchAdsForPlayer(1, false));
    }

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
              : 'Tu peux déjà consulter toutes les annonces publiées sur l\'application.'}
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

  const renderPlayerSectionHeader = (/** @type {string} */ title, /** @type {number} */ count, variant = 'default') => {
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
    <View style={[Spaces.gap[16], Spaces.marginBottom[16]]}>
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
      {isAuthenticated && !hasProfileSignals ? (
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
      <View style={[Spaces.marginTop[16]]}>
        <SearchComponent
          filterNumber={badgeFiltersCount}
          handleSearchField={setAdSearchValue}
          openFilters={() => setFiltersSheetVisible(true)}
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
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[160], { flexGrow: 1 }]}
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

  // Render Applications Content
  const renderApplicationsContent = () => (
    loading ? (
      <Loader />
    ) : (
      <FlatList
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[160], { flexGrow: 1 }]}
        data={filteredMyApplications}
        keyExtractor={(item) => String(item.documentId || item.id || Math.random())}
        ListEmptyComponent={myApplicationsUnreachable ? renderUnreachableState(
          () => fetchMyApplications(),
        ) : (
          <View style={[Spaces.padding[24], {
            alignItems: 'center',
            backgroundColor: recruitmentSurface,
            borderColor: recruitmentBorderSoft,
            borderRadius: 18,
            borderWidth: 1,
          }]}
          >
            <Text style={[Fonts.p1, { color: recruitmentMutedText, textAlign: 'center' }]}>
              {'Tu n\u2019as pas encore postulé à une annonce.'}
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
            // Le pack pose le CTA SOUS la liste (capture 01). Il n y montre que
            // deux profils ; avec une vraie liste, un bouton place a la fin du
            // defilement serait introuvable. Il est donc pose sous la liste
            // mais HORS d elle : toujours a l ecran, a la place dessinee.
            <View style={{ flex: 1 }}>
              <RecruitmentProfilesList
                bottomPadding={140}
                onUserPress={handleUserCardPress}
                refreshSignal={refreshSignal}
                screenActive={screenActive && activeTab === 'profils'}
              />
              {renderPublishOfferCta()}
            </View>
          ) : null}
          {activeTab === 'opportunites' ? renderPlayerContent() : null}
          {activeTab === 'candidatures' ? renderApplicationsContent() : null}
        </View>
      ) : (
        // D57 — le joueur n'a plus qu'un seul marche a explorer ici : ses
        // candidatures ont demenage dans « Mes activites › Mes reponses ». Un
        // segmente a un seul bouton ne choisit rien, il a donc disparu avec
        // l'onglet.
        <View style={{ flex: 1 }}>
          {renderPlayerContent()}
        </View>
      )}

      {/* D57 — la feuille que le bouton de filtres ouvre desormais. Le bouton et
          sa pastille, eux, n'ont pas bouge : ils marchaient deja. */}
      <RecruitmentFiltersSheet
        audienceFilter={audienceFilter}
        filters={recruitmentAdFilters}
        isVisible={filtersSheetVisible}
        onApply={(filtresChoisis, profilChoisi) => {
          appDispatch({ payload: filtresChoisis, type: 'SET_RECRUITMENT_AD_FILTERS' });
          setAudienceFilter(profilChoisi);
        }}
        onClose={() => setFiltersSheetVisible(false)}
      />
    </View>
  );
}
export default RecrutementListContent;
