import { RouteNames } from '@/navigation/routeNames';

export const REQUESTS_HUB_LEGACY_REDIRECT = false;

/**
 * @param {any} navigation
 * @param {{ initialFilter?: 'all' | 'team' | 'club' | 'event' | 'featured' | 'installation'; source?: 'home' | 'profile' | 'notification' | 'cm_dashboard' }} [params]
 * @param {{ remplacer?: boolean }} [options] - `remplacer` : l'écran courant cède sa place (une
 *   ancienne page qui renvoie à Demandes ; le retour ne la rouvre pas).
 */
export const navigateToRequestsHub = (navigation, params = {}, { remplacer = false } = {}) => {
  if (remplacer && typeof navigation?.replace === 'function') {
    navigation.replace(RouteNames.RequestsHub, params);
    return;
  }
  navigation.navigate(RouteNames.RequestsHub, params);
};
