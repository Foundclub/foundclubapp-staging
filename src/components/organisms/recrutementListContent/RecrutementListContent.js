import { useFocusEffect, useNavigation } from '@react-navigation/native';
import i18next from 'i18next';
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Alert, FlatList, Platform, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  criteresPourMoi,
  requetePourMoi,
  totalDuServeur,
} from '@/domains/search/pourMoiAnnonces';
import {
  getAppliedFilterCount,
  getRecruitmentRoleMode,
  sanitizeRecruitmentTabForRole,
} from '@/domains/search/recruitmentFlow';
import {
  filtresDeLAlerteAnnonce,
  resumeDeLAlerteAnnonce,
} from '@/domains/searchAlert/alerteAnnonce';
import { SorteAlerte, StatutAlerte } from '@/domains/searchAlert/alerteEvenement';
import useAlerteRecherche from '@/domains/searchAlert/useAlerteRecherche';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

// Components
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import RecruitmentAdCard from '@/components/molecules/recruitmentAdCard/RecruitmentAdCard';
import {
  CarteMePrevenir,
  GuideAlertes,
} from '@/components/organisms/alerteEvenements/AlerteEvenements';
import RecruitmentFiltersSheet from '@/components/organisms/recruitmentFiltersSheet/RecruitmentFiltersSheet';
import RecruitmentProfilesList from '@/components/organisms/recruitmentProfilesList/RecruitmentProfilesList';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';
// Services
import { useAppContext } from '@/store/appContext';

import { useGetCategories } from '@/services/category/categoryQueries';
import {
  applyToRecruitmentAd,
  buildDetectionApplicationStatusMap,
  buildOwnApplicationStatusMap,
  filterVisibleRecruitmentAds,
  getMyApplications,
  getRecruitmentAds,
  resolveRecruitmentAdApplicationState,
} from '@/services/recruitment/recruitmentService';
import { getMatchReasonLabel, mapSearchPayload, searchRecruitment } from '@/services/search/searchService';

import { getApiErrorTranslation } from '@/utils/errors/displayError';
import { markSearchPerf } from '@/utils/performance/searchPerformance';
import texteInsecable from '@/utils/texteInsecable';

/**
 * @typedef {{ id?: string | number; documentId?: string; [key: string]: any }} MercatoUser
 * @typedef {{ documentId?: string | number; id?: string | number; name?: string }} LevelRef
 * @typedef {{ id?: string | number; level?: LevelRef; [key: string]: any }} RecruitmentAdItem
 */

// LISTE-ANNONCES (A08) — le tri « compatibles avec mon profil » qui vivait ici
// (`getProfileMatchInfo`, `sortPlayerAds`) comparait DANS LE TELEPHONE les 10
// annonces chargees. Il est remplace par la recherche du serveur, avec les
// criteres du profil : `domains/search/pourMoiAnnonces.js`.

/**
 * Une rubrique de la liste : son titre et son compte, deja ecrit.
 * @param {string} key La clef de l'element.
 * @param {string} title Le titre.
 * @param {string} countLabel Le compte, tel qu'il s'affiche.
 * @param {'default' | 'matching'} [variant] La rubrique « Pour moi » est soulignee.
 * @returns {any} L'element de liste.
 */
const rubrique = (key, title, countLabel, variant = 'default') => ({
  countLabel,
  key,
  title,
  type: 'section',
  variant,
});

/**
 * Les annonces d'une rubrique, en elements de liste.
 * @param {string} rubriqueCle Le prefixe des clefs.
 * @param {any[]} annonces Les annonces.
 * @returns {any[]} Les elements.
 */
const elementsDAnnonces = (rubriqueCle, annonces) => annonces.map((ad) => ({
  ad,
  key: `ad-${rubriqueCle}-${String(ad.documentId || ad.id)}`,
  type: 'ad',
}));

/**
 * Ajoute une page a une liste deja chargee, sans doublon.
 * @param {any[]} precedentes Ce qui est deja la.
 * @param {any[]} nouvelles La page qui arrive.
 * @returns {any[]} La liste complete.
 */
const fusionnerSansDoublon = (precedentes, nouvelles) => {
  const vues = new Set(precedentes.map((item) => String(item.documentId || item.id)));
  const fusion = [...precedentes];
  nouvelles.forEach((item) => {
    const cle = String(item.documentId || item.id);
    if (!vues.has(cle)) {
      vues.add(cle);
      fusion.push(item);
    }
  });
  return fusion;
};

const formatAdsCountLabel = (/** @type {number} */ count) => i18next.t(
  'recrutementListContent.adsCount',
  {
    count,
    defaultValue_one: '{{count}} annonce',
    defaultValue_other: '{{count}} annonces',
  },
);
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
  const { t } = useTranslation();
  const UNREACHABLE_TITLE = t(
    'recrutementListContent.unreachable.title',
    'On n’arrive pas à joindre le serveur.',
  );
  const UNREACHABLE_DESCRIPTION = t(
    'recrutementListContent.unreachable.description',
    'Vérifie ta connexion, puis réessaie.',
  );
  const UNREACHABLE_ACTION = t('recrutementListContent.unreachable.retry', 'Réessayer');
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
  // 🔔 ALERTES-ANNONCES (30/09) — « je veux que les joueurs soient prevenus [des
  // annonces], meme les entraineurs » (Adel). La MEME carte « Me prevenir » que
  // sous les evenements (lot ALERTES) se pose sous les annonces, pour tout compte
  // connecte : joueur (onglet unique) comme staff (« Opportunites »). Une alerte
  // appartient a un compte : pas de carte pour un visiteur.
  // Ouverte POUR une alerte, la feuille s'ouvre sur la rangee Ville.
  const [feuillePourAlerte, setFeuillePourAlerte] = useState(false);
  const [guideAlertesVisible, setGuideAlertesVisible] = useState(false);
  const {
    creer: creerAlerteAnnonce,
    enCours: alerteEnCours,
    estDejaCreee: alerteDejaCreee,
  } = useAlerteRecherche(SorteAlerte.annonce);
  // 🎯 A08 — « POUR MOI » (ex « Compatibles avec mon profil »). Le tri est fait
  // par le SERVEUR, avec les criteres du profil ecrits a l'ecran, et « Autres
  // annonces » suit en bas : « la liste ne doit jamais etre vide » (Adel, 30/09).
  // Allume par defaut des que le profil porte un sport : c'etait deja la vue par
  // defaut (les compatibles en tete), mais calculee sur les 10 annonces chargees.
  const { data: categories } = useGetCategories();
  // Par sa SIGNATURE : une liste de categories rendue sous une nouvelle reference
  // ne doit pas relancer la recherche.
  const signatureCriteres = JSON.stringify(criteresPourMoi(userData, categories));
  const criteres = useMemo(() => JSON.parse(signatureCriteres), [signatureCriteres]);
  const [pourMoiChoisi, setPourMoiChoisi] = useState(/** @type {boolean | null} */ (null));
  const pourMoiActif = Boolean(criteres) && pourMoiChoisi !== false;
  const requeteDuProfil = useMemo(
    () => (criteres ? requetePourMoi(recruitmentAdFilters, criteres) : null),
    [criteres, recruitmentAdFilters],
  );
  const primaryQuerySignatureRef = useRef('');
  const firstResultsSignatureRef = useRef('');
  const adFiltersCount = React.useMemo(
    () => getAppliedFilterCount(recruitmentAdFilters, ['q']),
    [recruitmentAdFilters],
  );
  const hasAdFilters = adFiltersCount > 0;
  // D57 — ce que la PASTILLE annonce, profil compris. Volontairement separe de
  // `adFiltersCount`, qui ne compte que les filtres de la feuille. Le profil
  // (public joueurs / entraineurs) part lui aussi au serveur, par `audienceType`
  // (A11) : voir `chargerUnePage`.
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
  // A11 — le TOTAL annonce par le serveur (`meta.pagination.total`). Avant, l'ecran
  // comptait les annonces deja chargees : 10, puis 20, puis 30 en descendant.
  const [adsTotal, setAdsTotal] = useState(0);
  // A08 — « Pour moi » a sa propre liste, son propre total et sa pagination.
  const [adsPourMoi, setAdsPourMoi] = useState(/** @type {RecruitmentAdItem[]} */ ([]));
  const [adsPourMoiTotal, setAdsPourMoiTotal] = useState(0);
  const [pourMoiPage, setPourMoiPage] = useState(1);
  const [pourMoiHasMore, setPourMoiHasMore] = useState(false);

  // Une page d'annonces. La recherche du serveur des qu'il y a quelque chose a
  // chercher (texte, filtres, public choisi, criteres « Pour moi ») ; la liste
  // simple sinon. Le public part au serveur (`audienceType`) : filtre dans le
  // telephone, il faisait mentir le total (A11).
  const chargerUnePage = useCallback(async (
    /** @type {number} */ page,
    /** @type {Record<string, any> | null | undefined} */ filtresDuProfil,
  ) => {
    const searchTerm = adSearchValue?.trim();
    const avecTexte = Boolean(searchTerm && searchTerm.length >= 2);
    const audienceType = audienceFilter === 'all' ? undefined : audienceFilter;
    if (filtresDuProfil || avecTexte || hasAdFilters || audienceType) {
      const response = await searchRecruitment({
        ...(filtresDuProfil || recruitmentAdFilters),
        ...(audienceType ? { audienceType } : {}),
        page,
        pageSize: 10,
        ...(avecTexte ? { q: searchTerm, sort: 'relevance' } : { sort: 'date' }),
      });
      return {
        annonces: filterVisibleRecruitmentAds(mapSearchPayload(response)),
        meta: response.meta || {},
      };
    }
    const response = await getRecruitmentAds({
      isActive: true,
      page,
      pageSize: 10,
    });
    return { annonces: response.data || [], meta: response.meta || {} };
  }, [adSearchValue, audienceFilter, hasAdFilters, recruitmentAdFilters]);

  // Fetch ads for players (smart feed)
  const fetchAdsForPlayer = useCallback(async (page = 1, append = false, isRefresh = false) => {
    if (page === 1 && !isRefresh) setLoading(true);
    else if (page > 1) setAdsLoadingMore(true);

    try {
      // A08 — a la premiere page, « Pour moi » part EN MEME TEMPS que la liste
      // complete : la rubrique « Autres annonces » a besoin du total complet.
      const filtresDuProfil = page === 1 && pourMoiActif ? requeteDuProfil?.params : null;
      const [base, pourMoi] = await Promise.all([
        chargerUnePage(page, null),
        filtresDuProfil ? chargerUnePage(1, filtresDuProfil) : Promise.resolve(null),
      ]);

      setAds((prev) => (append ? fusionnerSansDoublon(prev, base.annonces) : base.annonces));
      setAdsTotal((prev) => totalDuServeur(
        base.meta,
        append ? prev + base.annonces.length : base.annonces.length,
      ));
      if (page === 1) {
        setAdsPourMoi(pourMoi ? pourMoi.annonces : []);
        setAdsPourMoiTotal(pourMoi ? totalDuServeur(pourMoi.meta, pourMoi.annonces.length) : 0);
        setPourMoiHasMore(Number(pourMoi?.meta?.pagination?.pageCount) > 1);
        setPourMoiPage(1);
      }

      setAdsUnreachable(false);
      setAdsHasMore(base.meta.pagination ? page < base.meta.pagination.pageCount : false);
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
  }, [chargerUnePage, pourMoiActif, requeteDuProfil]);

  // 🔔 « Me prevenir » cree l'alerte avec les filtres AFFICHES et le profil
  // choisi. Sans ville, le serveur la refuserait : on ouvre les filtres sur la
  // rangee Ville, ou l'etoile attend.
  const creerAlerteDepuisLaRecherche = useCallback(async () => {
    const statut = await creerAlerteAnnonce(recruitmentAdFilters, audienceFilter);
    if (statut === StatutAlerte.villeManquante) {
      setFeuillePourAlerte(true);
      setFiltersSheetVisible(true);
    }
  }, [audienceFilter, creerAlerteAnnonce, recruitmentAdFilters]);

  // La page suivante de « Pour moi ».
  const chargerPlusPourMoi = useCallback(async () => {
    if (!requeteDuProfil) return;
    const page = pourMoiPage + 1;
    setAdsLoadingMore(true);
    try {
      const { annonces, meta } = await chargerUnePage(page, requeteDuProfil.params);
      setAdsPourMoi((prev) => fusionnerSansDoublon(prev, annonces));
      setPourMoiHasMore(meta.pagination ? page < meta.pagination.pageCount : false);
      setPourMoiPage(page);
    } catch (error) {
      // Comme la liste complete : une page suivante ratee ne condamne pas celles
      // deja affichees. Elle reste « a charger » : un nouveau defilement la redemande.
      console.error('[RecrutementListContent] Error fetching more ads for me:', error);
    } finally {
      setAdsLoadingMore(false);
    }
  }, [chargerUnePage, pourMoiPage, requeteDuProfil]);

  // Load more ads Handler
  // « Pour moi » d'abord, jusqu'au bout ; la liste complete (« Autres annonces »)
  // ensuite : la rubrique reste EN BAS.
  const handleLoadMoreAds = useCallback(() => {
    if (adsLoadingMore) return;
    if (pourMoiActif && pourMoiHasMore) {
      chargerPlusPourMoi();
      return;
    }
    if (adsHasMore) {
      fetchAdsForPlayer(adsPage + 1, true);
    }
  }, [
    adsHasMore,
    adsLoadingMore,
    adsPage,
    chargerPlusPourMoi,
    fetchAdsForPlayer,
    pourMoiActif,
    pourMoiHasMore,
  ]);

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
  // FINITIONS8 (tournee 9, point 6) — « Postuler » restait apres l'envoi : la carte cherchait
  // « ai-je postule ? » dans l'annonce (`applications`, retire depuis D10, puis `candidates`,
  // absent des annonces de la recherche). « Mes candidatures », relue apres l'envoi, fait foi.
  // Test : __tests__/RecrutementListContent.FINITIONS8.postuler.test.js.
  const ownApplicationStatusByAd = useMemo(
    () => buildOwnApplicationStatusMap(myApplications),
    [myApplications],
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
    // FINITIONS18 · POINT 5 (T16, SITE_A7) — sans `adId`, l'adresse du site gardait `:adId` en clair
    // (« Chargement impossible · Not Found ») : l'annonce entiere ne voyage pas dans une adresse.
    nav.navigate(RouteNames.RecruitmentAdDetails, { ad, adId: ad?.documentId, isOwner: isOwnerContext });
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
      Alert.alert(i18next.t('recrutementListContent.apply.title', 'Candidature'), i18next.t(
        'recrutementListContent.apply.inactive',
        'Cette annonce n est plus active.',
      ));
      return;
    }

    const applicationState = resolveRecruitmentAdApplicationState(
      ad,
      userData,
      detectionApplicationStatusByEvent,
      ownApplicationStatusByAd,
    );
    const isDetectionLinked = normalizeTypeLabel(ad?.event?.type?.name).includes('detection');

    if (applicationState.hasApplied) {
      let alreadyAppliedMessage = i18next.t(
        'recrutementListContent.apply.already',
        'Tu as déjà postule à cette annonce.',
      );

      if (applicationState.status === 'accepted') {
        alreadyAppliedMessage = isDetectionLinked
          ? i18next.t(
            'recrutementListContent.apply.alreadyInDetection',
            'Tu participes déjà à cette détection.',
          )
          : i18next.t(
            'recrutementListContent.apply.alreadyAccepted',
            'Ta candidature est déjà validée pour cette annonce.',
          );
      } else if (isDetectionLinked) {
        alreadyAppliedMessage = i18next.t(
          'recrutementListContent.apply.pendingDetection',
          'Tu as déjà une candidature en attente sur cette détection.',
        );
      }

      Alert.alert(
        i18next.t('recrutementListContent.apply.title', 'Candidature'),
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
        i18next.t('recrutementListContent.apply.sentTitle', 'Candidature envoyée'),
        result?.message || i18next.t(
          'recrutementListContent.apply.sent',
          'Ta candidature a bien été envoyée.',
        ),
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
        || i18next.t(
          'recrutementListContent.apply.error',
          'Impossible d envoyer la candidature pour le moment.',
        );
      Alert.alert(i18next.t('recrutementListContent.apply.title', 'Candidature'), message);
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
    ownApplicationStatusByAd,
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
      { key: 'all', label: t('recrutementListContent.audience.all', 'Toutes') },
      {
        key: 'player',
        label: t('recrutementListContent.audience.player', 'Pratiquants / Joueurs'),
      },
      { key: 'coach', label: t('recrutementListContent.audience.coach', 'Coachs / Profs') },
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
      {renderSegmentedTab('profils', t('recrutementListContent.tabs.profiles', 'Profils'))}
      {renderSegmentedTab('opportunites', t(
        'recrutementListContent.tabs.opportunities',
        'Opportunités',
      ))}
      {renderSegmentedTab('candidatures', t(
        'recrutementListContent.tabs.applications',
        'Candidatures',
      ))}
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
      accessibilityLabel={t(
        'recrutementListContent.publishOffer.label',
        'Publier une offre de recrutement',
      )}
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
        {t('recrutementListContent.publishOffer.cta', '+ Publier une offre')}
      </Text>
    </TouchableOpacity>
  );

  const playerFeedItems = React.useMemo(() => {
    const visibles = (/** @type {any[]} */ liste) => liste
      .filter((ad) => matchesAudienceFilter(ad))
      .map((ad) => {
        const { __search: searchMeta, ...rest } = ad;
        return { ...rest, searchMeta };
      });
    const toutes = visibles(ads);

    if (!pourMoiActif) {
      if (toutes.length === 0) return [];
      return [
        rubrique(
          'section-all',
          t('recrutementListContent.sections.all', 'Toutes les annonces'),
          formatAdsCountLabel(adsTotal),
        ),
        ...elementsDAnnonces('all', toutes),
      ];
    }

    const pourMoi = visibles(adsPourMoi);
    const dejaPourMoi = new Set(pourMoi.map(getRecruitmentAdKey));
    // « Autres annonces » n'arrive qu'une fois « Pour moi » charge jusqu'au bout :
    // la rubrique reste en bas, et une annonce « pour moi » pas encore chargee ne
    // peut pas s'y glisser.
    const autres = pourMoiHasMore
      ? []
      : toutes.filter((ad) => !dejaPourMoi.has(getRecruitmentAdKey(ad)));
    if (pourMoi.length === 0 && autres.length === 0) return [];

    const items = [
      rubrique(
        'section-matching',
        t('recrutementListContent.sections.matching', 'Correspondent à ton profil'),
        t('recrutementListContent.pourMoi.count', '{{matching}} sur {{total}}', {
          matching: adsPourMoiTotal,
          total: adsTotal,
        }),
        'matching',
      ),
      // Aucune annonce pour moi : on le DIT, et les autres suivent.
      ...(pourMoi.length > 0
        ? elementsDAnnonces('matching', pourMoi)
        : [{ key: 'pour-moi-aucune', type: 'aucune' }]),
    ];
    if (autres.length > 0) {
      items.push(
        rubrique(
          'section-other',
          t('recrutementListContent.sections.other', 'Autres annonces'),
          formatAdsCountLabel(Math.max(0, adsTotal - adsPourMoiTotal)),
        ),
        ...elementsDAnnonces('other', autres),
      );
    }
    return items;
  }, [
    ads,
    adsPourMoi,
    adsPourMoiTotal,
    adsTotal,
    matchesAudienceFilter,
    pourMoiActif,
    pourMoiHasMore,
    t,
  ]);
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

  const renderPlayerEmptyState = () => {
    // La panne passe AVANT le filtre : sans ca, un serveur muet renverrait
    // l'utilisateur ajuster une recherche qui n'y est pour rien.
    if (adsUnreachable) {
      return renderUnreachableState(() => fetchAdsForPlayer(1, false));
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
          {t('recrutementListContent.empty.none', 'Aucune annonce disponible pour le moment.')}
        </Text>
        <Text style={[Fonts.p2, { color: recruitmentMutedText, marginTop: 8, textAlign: 'center' }]}>
          {t(
            'recrutementListContent.empty.comeBack',
            'Reviens un peu plus tard ou ajuste ta recherche.',
          )}
        </Text>
      </View>
    );
  };

  const renderPlayerSectionHeader = (
    /** @type {string} */ title,
    /** @type {string} */ countLabel,
    variant = 'default',
  ) => {
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
              {/* Une pastille epouse son texte : gras, plusieurs mots, Android 16
                  en perd le dernier (« 2 SUR »). Espaces insecables. */}
              {texteInsecable(countLabel)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // A08 — « Aucune annonce ne correspond » : dit a sa place, sous « Pour moi » ;
  // « Autres annonces » suit juste dessous.
  const renderAucunePourMoi = () => (
    <View
      style={[Spaces.padding[16], {
        backgroundColor: recruitmentSurface,
        borderColor: recruitmentBorderSoft,
        borderRadius: 16,
        borderWidth: 1,
      }]}
    >
      <Text style={[Fonts.p2, { color: recruitmentMutedText, textAlign: 'center' }]}>
        {t(
          'recrutementListContent.empty.noMatch',
          'Aucune annonce ne correspond exactement à ton profil pour le moment.',
        )}
      </Text>
    </View>
  );

  // A08 — l'interrupteur « Pour moi » et ses criteres ECRITS. Sans sport au
  // profil (ou sans compte), il ne s'allume plus — il vidait la liste — et il
  // dit quoi faire.
  const renderPourMoi = () => {
    const desactive = !criteres;
    let explication = t(
      'recrutementListContent.pourMoi.criteria',
      'Selon ton profil. Touche un critère pour le changer.',
    );
    if (!isAuthenticated) {
      explication = t(
        'recrutementListContent.pourMoi.signIn',
        'Connecte-toi pour voir les annonces faites pour toi.',
      );
    } else if (desactive) {
      explication = t(
        'recrutementListContent.pourMoi.addSport',
        'Ajoute ton sport à ton profil pour voir les annonces faites pour toi.',
      );
    }
    const titrePourMoi = t('recrutementListContent.matchesOnlyToggle', 'Pour moi');
    return (
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
              {titrePourMoi}
            </Text>
            <Text style={[Fonts.p4, { color: recruitmentMutedText, marginTop: 8 }]}>
              {explication}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel={titrePourMoi}
            accessibilityRole="switch"
            accessibilityState={{ checked: pourMoiActif, disabled: desactive }}
            disabled={desactive}
            onPress={() => {
              if (!desactive) setPourMoiChoisi(!pourMoiActif);
            }}
            style={{
              backgroundColor: pourMoiActif ? Colors.primary500 : recruitmentToggleOff,
              borderRadius: 14,
              height: 28,
              justifyContent: 'center',
              opacity: desactive ? 0.5 : 1,
              paddingHorizontal: 2,
              width: 50,
            }}
          >
            <View style={{
              alignSelf: pourMoiActif ? 'flex-end' : 'flex-start',
              backgroundColor: Colors.neutral00,
              borderRadius: 12,
              height: 24,
              width: 24,
            }}
            />
          </TouchableOpacity>
        </View>
        {requeteDuProfil?.libelles.length ? (
          <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[12], { flexWrap: 'wrap' }]}>
            {requeteDuProfil.libelles.map((libelle) => (
              <TouchableOpacity
                accessibilityLabel={t(
                  'recrutementListContent.pourMoi.changeCriterion',
                  'Changer ce critère : {{criterion}}',
                  { criterion: libelle, ...SANS_ECHAPPEMENT },
                )}
                accessibilityRole="button"
                key={libelle}
                onPress={() => nav.navigate(RouteNames.ProfileStack, {
                  screen: RouteNames.ProfileEdit,
                })}
                style={{
                  backgroundColor: recruitmentSurfaceSoft,
                  borderColor: recruitmentBorder,
                  borderRadius: 999,
                  borderWidth: 1,
                  justifyContent: 'center',
                  minHeight: 36,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                  {texteInsecable(libelle)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderPlayerListHeader = () => (
    <View style={[Spaces.gap[16], Spaces.marginBottom[16]]}>
      {renderAudienceTypeTabs()}
      {renderPourMoi()}
      {isAuthenticated && !criteres ? (
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
                {t('recrutementListContent.completeProfile.title', 'Compléter mon profil')}
              </Text>
              <Text style={[Fonts.p4, { color: recruitmentMutedText, marginTop: 8 }]}>
                {t(
                  'recrutementListContent.completeProfile.fields',
                  'Sport, section, catégorie, niveau.',
                )}
              </Text>
            </View>
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
              {t('recrutementListContent.completeProfile.open', 'Ouvrir')}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}
      <View style={[Spaces.marginTop[16]]}>
        <SearchComponent
          filterNumber={badgeFiltersCount}
          handleSearchField={setAdSearchValue}
          openFilters={() => {
            setFeuillePourAlerte(false);
            setFiltersSheetVisible(true);
          }}
          placeholder={t('recrutementListContent.searchPlaceholder', 'Rechercher une annonce...')}
          searchDefaultValue={adSearchValue}
        />
        {adSearchValue?.trim()?.length >= 2 ? (
          <Text style={[Fonts.p3, { color: Colors.primary500 }, Spaces.marginTop[8]]}>
            {t('recrutementListContent.sortedByRelevance', 'Trie par pertinence')}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const PUBLICS = {
    coach: t('recruitmentFiltersSheet.audience.coach', 'Coachs / Profs'),
    player: t('recruitmentFiltersSheet.audience.player', 'Pratiquant·e·s / Joueur·se·s'),
  };
  // 🔔 SOUS les annonces (et sous l'etat vide : c'est la qu'on veut etre prevenu
  // de la prochaine), apres le chargement de la page suivante.
  const piedDeListe = (
    <>
      {adsLoadingMore ? (
        <View style={[Spaces.paddingVertical[16], { alignItems: 'center' }]}>
          <ActivityIndicator color={Colors.primary500} />
        </View>
      ) : null}
      {isAuthenticated ? (
        <CarteMePrevenir
          dejaCreee={alerteDejaCreee(recruitmentAdFilters, audienceFilter)}
          enCours={alerteEnCours}
          onCreer={creerAlerteDepuisLaRecherche}
          onGerer={() => nav.navigate(RouteNames.SearchAlerts)}
          onGuide={() => setGuideAlertesVisible(true)}
          resume={resumeDeLAlerteAnnonce(
            filtresDeLAlerteAnnonce(recruitmentAdFilters, audienceFilter),
            t('recruitmentFiltersSheet.allSports', 'Tous les sports'),
            PUBLICS[/** @type {'coach' | 'player'} */ (audienceFilter)] || '',
          )}
          sorte={SorteAlerte.annonce}
        />
      ) : null}
    </>
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
        ListFooterComponent={piedDeListe}
        ListHeaderComponent={renderPlayerListHeader()}
        nestedScrollEnabled
        onEndReached={handleLoadMoreAds}
        onEndReachedThreshold={0.35}
        onRefresh={onRefresh}
        refreshing={refreshing}
        renderItem={({ item }) => {
          if (item.type === 'section') {
            return renderPlayerSectionHeader(item.title, item.countLabel, item.variant);
          }
          if (item.type === 'aucune') {
            return renderAucunePourMoi();
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
                    {t(
                      'recrutementListContent.relevanceReason',
                      'Pertinence : {{reason}}',
                      { reason: primaryReasonLabel, ...SANS_ECHAPPEMENT },
                    )}
                  </Text>
                </View>
              ) : null}
              <RecruitmentAdCard
                ad={ad}
                detectionApplicationStatusByEvent={detectionApplicationStatusByEvent}
                isApplying={applyingAdId === getRecruitmentAdKey(ad)}
                onApply={handleAdApply}
                onPress={handleAdCardPress}
                ownApplicationStatusByAd={ownApplicationStatusByAd}
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
              {t(
                'recrutementListContent.applications.empty',
                'Tu n\u2019as pas encore postulé à une annonce.',
              )}
            </Text>
          </View>
        )}
        ListHeaderComponent={(
          <View style={[Spaces.gap[12], Spaces.marginBottom[16]]}>
            <Text style={[Fonts.h4, Fonts.neutral100]}>
              {t('recrutementListContent.applications.title', 'Suivi de tes candidatures')}
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
            ownApplicationStatusByAd={ownApplicationStatusByAd}
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
        onCreateAlert={isAuthenticated ? creerAlerteAnnonce : undefined}
        pourUneAlerte={feuillePourAlerte}
      />

      {isAuthenticated ? (
        <GuideAlertes
          isVisible={guideAlertesVisible}
          onClose={() => setGuideAlertesVisible(false)}
          sorte={SorteAlerte.annonce}
        />
      ) : null}
    </View>
  );
}
export default RecrutementListContent;
