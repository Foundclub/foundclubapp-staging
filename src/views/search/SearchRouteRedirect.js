import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';

import { remplacerParLOnglet } from '@/navigation/allerDansLOnglet';
import { RouteNames } from '@/navigation/routeNames';

import { getSearchTypeFromRouteName } from './searchRouteHelpers';

const SEARCH_ROUTES = new Set([
  RouteNames.SearchClubs,
  RouteNames.SearchEvents,
  RouteNames.SearchRecruitment,
  RouteNames.SearchReservations,
]);

/**
 * Redirects stack-level search routes to tab-level search routes
 * so the bottom tab bar stays visible.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function SearchRouteRedirect({ navigation, route }) {
  const { Alignments, Colors } = useTheme();

  useEffect(() => {
    const targetRoute = route?.name;
    // RETOUR-ONGLET-2 : revenir au HomeTab deja empile, pas en poser un second
    // (le pourquoi de `popTo` est ecrit sur `remplacerParLOnglet`).
    if (!SEARCH_ROUTES.has(targetRoute)) {
      remplacerParLOnglet(navigation, RouteNames.SearchHome);
      return;
    }

    remplacerParLOnglet(navigation, RouteNames.SearchHub, {
      ...(route?.params || {}),
      activeType: getSearchTypeFromRouteName(targetRoute),
    });
  }, [navigation, route?.name, route?.params]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Alignments.mainCenter]}
    >
      <ActivityIndicator color={Colors.primary500} size="large" />
    </ScreenContainer>
  );
}

export default SearchRouteRedirect;
