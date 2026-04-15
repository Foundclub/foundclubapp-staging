import { useEffect } from 'react';

import { RouteNames } from '@/navigation/routeNames';

import { getSearchTypeFromRouteName } from './searchRouteHelpers';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {null}
 */
function SearchHubRouteAlias({ navigation, route }) {
  useEffect(() => {
    navigation.replace(RouteNames.SearchHub, {
      ...(route?.params || {}),
      activeType: getSearchTypeFromRouteName(route?.name),
    });
  }, [navigation, route?.name, route?.params]);

  return null;
}

export default SearchHubRouteAlias;
