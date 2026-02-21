import { RouteNames } from '@/navigation/routeNames';

export const REQUESTS_HUB_LEGACY_REDIRECT = false;

/**
 * @param {any} navigation
 * @param {{ initialFilter?: 'all' | 'team' | 'club' | 'event' | 'featured'; source?: 'home' | 'profile' | 'notification' | 'cm_dashboard' }} [params]
 */
export const navigateToRequestsHub = (navigation, params = {}) => {
  navigation.navigate(RouteNames.HomeTab, {
    params,
    screen: RouteNames.RequestsTab,
  });
};

