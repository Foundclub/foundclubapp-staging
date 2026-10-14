import i18next from 'i18next';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import useAuth from '@/domains/auth/useAuth';
import { emitGuidanceInteraction } from '@/domains/guidance/guidanceRuntime';
import {
  getDefaultRecruitmentTab,
  sanitizeRecruitmentTabForRole,
} from '@/domains/search/recruitmentFlow';

import ClubListContent from '@/components/organisms/clubListContent/ClubListContent';
import EventListContent from '@/components/organisms/eventListContent/EventListContent';
import FriendlyMatchListContent from '@/components/organisms/friendlyMatchListContent/FriendlyMatchListContent';
import RecrutementListContent from '@/components/organisms/recrutementListContent/RecrutementListContent';

import { markSearchPerf } from '@/utils/performance/searchPerformance';

import SearchScreenShell from './components/SearchScreenShell';
import { coerceSearchHubType, consumeSearchHubGuidanceSignal } from './searchRouteHelpers';

const SEARCH_TAB_TYPES = /** @type {const} */ ([
  'events',
  'clubs',
  'reservations',
  'recruitment',
  'amicaux',
]);
const SEARCH_STALE_WINDOW_MS = 30_000;

/**
 * RECHERCHE-UNIQUE (25/09) — l'annuaire du site sert CET ecran, mais n'en ouvre
 * que deux marches (Club, Evenement). `route.params.types` les nomme ; absent,
 * vide ou sans marche connu, les cinq restent la : le telephone ne change pas.
 * @param {unknown} rawTypes
 * @returns {ReadonlyArray<typeof SEARCH_TAB_TYPES[number]>}
 */
const resolveAllowedTypes = (rawTypes) => {
  const requested = Array.isArray(rawTypes) ? rawTypes : String(rawTypes || '').split(',');
  const allowed = SEARCH_TAB_TYPES.filter((type) => requested.includes(type));
  return allowed.length ? allowed : SEARCH_TAB_TYPES;
};
const DEFAULT_EVENT_FILTERS = Object.freeze({
  excludeType: 'Réservation',
  sessionStatus: 'open',
});

/**
 * Canonical retained search hub used by all search entry routes.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function SearchHubScreen({ navigation, route }) {
  const { userData } = useAuth();
  const { Colors } = useTheme();
  const allowedTypes = useMemo(
    () => resolveAllowedTypes(route?.params?.types),
    [route?.params?.types],
  );
  const isRestricted = allowedTypes.length < SEARCH_TAB_TYPES.length;
  const coercedType = coerceSearchHubType(route?.params?.activeType);
  const requestedType = allowedTypes.includes(coercedType) ? coercedType : allowedTypes[0];
  // Le site n'a pas de carte publique : il eteint le bouton carte (Home.js natif
  // anonyme fait de meme). Absent, rien ne change.
  const enableMapMode = route?.params?.enableMapMode !== false;
  // ANNUAIRE-E1 (29/09) — l'annuaire du site pose `annuaire: true` : pas d'en-tête de l'app, et
  // une liste qui défile avec la page. Absent, rien ne change (le téléphone ne le pose jamais).
  const annuaire = route?.params?.annuaire === true;
  // PAR-L4 (recette PAR-009) — « Chercher un club pour Anissa » : l'enfant venu de SA fiche
  // (`MyChildren`) traverse la recherche jusqu'a la fiche club. Absent, rien ne change.
  const childDocumentId = String(route?.params?.childDocumentId || '').trim() || undefined;
  const [activeType, setActiveType] = useState(requestedType);
  const [visitedTypes, setVisitedTypes] = useState(() => new Set([requestedType]));
  const [refreshSignals, setRefreshSignals] = useState({
    amicaux: 0,
    clubs: 0,
    events: 0,
    recruitment: 0,
    reservations: 0,
  });
  const appStateRef = useRef(AppState.currentState);
  const backgroundedAtRef = useRef(0);
  const activeTypeRef = useRef(requestedType);
  const guidanceTabsRef = useRef(new Set());
  const loggedTabsRef = useRef(new Set());

  const initialRecruitmentTab = useMemo(
    () => sanitizeRecruitmentTabForRole(
      route?.params?.initialRecruitmentTab || getDefaultRecruitmentTab(userData),
      userData,
    ),
    [route?.params?.initialRecruitmentTab, userData],
  );

  useEffect(() => {
    activeTypeRef.current = activeType;
  }, [activeType]);

  useEffect(() => {
    setActiveType((currentType) => (currentType === requestedType ? currentType : requestedType));
    setVisitedTypes((previousVisited) => {
      if (previousVisited.has(requestedType)) return previousVisited;
      const nextVisited = new Set(previousVisited);
      nextVisited.add(requestedType);
      return nextVisited;
    });
  }, [requestedType]);

  useEffect(() => {
    const hasBeenLogged = loggedTabsRef.current.has(activeType);
    markSearchPerf(hasBeenLogged ? 'search_tab_switch_restored' : 'search_tab_open_started', {
      fromCache: hasBeenLogged,
      mode: 'list',
      type: activeType,
    });
    loggedTabsRef.current.add(activeType);
  }, [activeType]);

  useEffect(() => {
    const guidanceSignalKey = consumeSearchHubGuidanceSignal(activeType, guidanceTabsRef.current);
    if (!guidanceSignalKey) return;
    emitGuidanceInteraction(guidanceSignalKey);
  }, [activeType]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current === nextAppState) {
        return;
      }

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        backgroundedAtRef.current = Date.now();
      }

      if (
        nextAppState === 'active'
        && backgroundedAtRef.current > 0
        && Date.now() - backgroundedAtRef.current >= SEARCH_STALE_WINDOW_MS
      ) {
        const currentType = activeTypeRef.current;
        setRefreshSignals((previousSignals) => ({
          ...previousSignals,
          [currentType]: previousSignals[currentType] + 1,
        }));
      }

      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  const handleTypeChange = useCallback((nextType) => {
    const sanitizedType = coerceSearchHubType(nextType);
    if (sanitizedType === activeType || !allowedTypes.includes(sanitizedType)) return;

    setVisitedTypes((previousVisited) => {
      const nextVisited = new Set(previousVisited);
      nextVisited.add(sanitizedType);
      return nextVisited;
    });
    setActiveType(sanitizedType);
    navigation.setParams({
      ...(route?.params || {}),
      activeType: sanitizedType,
      ...(sanitizedType === 'recruitment'
        ? { initialRecruitmentTab }
        : {}),
    });
  }, [activeType, allowedTypes, initialRecruitmentTab, navigation, route?.params]);

  const renderPanel = useCallback((type) => {
    if (type === 'events') {
      return (
        <EventListContent
          additionalFilters={DEFAULT_EVENT_FILTERS}
          annuaire={annuaire}
          enableMapMode={enableMapMode}
          refreshSignal={refreshSignals.events}
          screenActive={activeType === 'events'}
          showFilters
        />
      );
    }

    if (type === 'clubs') {
      return (
        <ClubListContent
          annuaire={annuaire}
          childDocumentId={childDocumentId}
          enableMapMode={enableMapMode}
          refreshSignal={refreshSignals.clubs}
          screenActive={activeType === 'clubs'}
        />
      );
    }

    if (type === 'amicaux') {
      return (
        <FriendlyMatchListContent
          initialTab={route?.params?.initialFriendlyMatchTab}
          refreshSignal={refreshSignals.amicaux}
          screenActive={activeType === 'amicaux'}
        />
      );
    }

    if (type === 'reservations') {
      // C30 (décision D5) : l'onglet reste, mais la réservation n'est pas encore
      // ouverte -> écran « Bientôt disponible » au lieu de la liste.
      return (
        <View style={{
          alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 24,
        }}
        >
          <Text style={{
            color: Colors.neutral00, fontSize: 20, fontWeight: '700', textAlign: 'center',
          }}
          >
            {i18next.t('searchHubScreen.reservations.comingSoonTitle', 'Bientôt disponible')}
          </Text>
          <Text style={{
            color: Colors.neutral300, fontSize: 14, lineHeight: 22, marginTop: 12, textAlign: 'center',
          }}
          >
            {i18next.t(
              'searchHubScreen.reservations.comingSoonBody',
              "La réservation de terrains et d'installations arrive très vite. Reste connecté, on te préviendra dès son ouverture.", // eslint-disable-line max-len
            )}
          </Text>
        </View>
      );
    }

    return (
      <RecrutementListContent
        initialTab={initialRecruitmentTab}
        refreshSignal={refreshSignals.recruitment}
        screenActive={activeType === 'recruitment'}
      />
    );
  }, [
    Colors,
    activeType,
    annuaire,
    childDocumentId,
    enableMapMode,
    initialRecruitmentTab,
    refreshSignals,
    route?.params?.initialFriendlyMatchTab,
  ]);

  return (
    <SearchScreenShell
      activeType={activeType}
      annuaire={annuaire}
      navigation={navigation}
      onTypeChange={handleTypeChange}
      types={isRestricted ? allowedTypes : undefined}
    >
      {/* Sur l'annuaire, la hauteur suit le contenu (la page défile) : pas de `flex: 1`. */}
      <View style={annuaire ? null : { flex: 1 }}>
        {SEARCH_TAB_TYPES.map((type) => {
          if (!visitedTypes.has(type)) return null;

          return (
            <View
              key={type}
              pointerEvents={activeType === type ? 'auto' : 'none'}
              style={[
                annuaire ? null : { flex: 1 },
                activeType === type ? null : { display: 'none' },
              ]}
            >
              {renderPanel(type)}
            </View>
          );
        })}
      </View>
    </SearchScreenShell>
  );
}

export default SearchHubScreen;
