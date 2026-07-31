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
  const requestedType = coerceSearchHubType(route?.params?.activeType);
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
    if (sanitizedType === activeType) return;

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
  }, [activeType, initialRecruitmentTab, navigation, route?.params]);

  const renderPanel = useCallback((type) => {
    if (type === 'events') {
      return (
        <EventListContent
          additionalFilters={DEFAULT_EVENT_FILTERS}
          enableMapMode
          refreshSignal={refreshSignals.events}
          screenActive={activeType === 'events'}
          showFilters
        />
      );
    }

    if (type === 'clubs') {
      return (
        <ClubListContent
          enableMapMode
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
            Bientôt disponible
          </Text>
          <Text style={{
            color: Colors.neutral300, fontSize: 14, lineHeight: 22, marginTop: 12, textAlign: 'center',
          }}
          >
            La réservation de terrains et d&apos;installations arrive très vite.
            Reste connecté, on te préviendra dès son ouverture.
          </Text>
        </View>
      );
    }

    return (
      <RecrutementListContent
        initialTab={initialRecruitmentTab}
        refreshSignal={refreshSignals.recruitment}
        screenActive={activeType === 'recruitment'}
        timestamp={route?.params?.timestamp}
      />
    );
  }, [
    Colors,
    activeType,
    initialRecruitmentTab,
    refreshSignals,
    route?.params?.initialFriendlyMatchTab,
    route?.params?.timestamp,
  ]);

  return (
    <SearchScreenShell
      activeType={activeType}
      navigation={navigation}
      onTypeChange={handleTypeChange}
    >
      <View style={{ flex: 1 }}>
        {SEARCH_TAB_TYPES.map((type) => {
          if (!visitedTypes.has(type)) return null;

          return (
            <View
              key={type}
              pointerEvents={activeType === type ? 'auto' : 'none'}
              style={[
                { flex: 1 },
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
