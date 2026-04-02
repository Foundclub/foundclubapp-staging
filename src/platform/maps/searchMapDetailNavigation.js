import { RouteNames } from '@/navigation/routeNames';

const readDocumentId = (rawItem) => {
  const documentId = String(rawItem?.documentId || rawItem?.id || '').trim();
  return documentId || '';
};

/**
 * @param {object} params
 * @param {boolean} params.isAuthenticated
 * @param {any} params.rawItem
 * @param {'events' | 'clubs' | 'reservations'} params.scope
 * @returns {{ name: string, params?: any, screen?: string } | null}
 */
export const getSearchMapDetailTarget = ({
  isAuthenticated,
  rawItem,
  scope,
}) => {
  if (!rawItem || typeof rawItem !== 'object') {
    return null;
  }

  if (scope === 'clubs') {
    const clubId = readDocumentId(rawItem);
    if (!clubId) {
      return null;
    }

    if (Reflect.get(rawItem || {}, '_type') === 'multisport') {
      return {
        name: RouteNames.MultisportClubDetails,
        params: { cmId: clubId },
      };
    }

    if (isAuthenticated) {
      return {
        name: RouteNames.ClubStack,
        params: {
          params: { clubId },
          screen: RouteNames.Club,
        },
      };
    }

    return {
      name: RouteNames.Club,
      params: { clubId },
    };
  }

  if (scope === 'reservations') {
    const reservationId = readDocumentId(rawItem);
    if (!reservationId) {
      return null;
    }

    return {
      name: RouteNames.ReservationDetails,
      params: { reservationId },
    };
  }

  const eventId = readDocumentId(rawItem);
  if (!eventId) {
    return null;
  }

  if (isAuthenticated) {
    return {
      name: RouteNames.EventStack,
      params: {
        params: { eventId },
        screen: RouteNames.EventDetails,
      },
    };
  }

  return {
    name: RouteNames.EventDetails,
    params: { eventId },
  };
};

/**
 * @param {object} params
 * @param {boolean} params.isAuthenticated
 * @param {any} params.navigation
 * @param {any} params.rawItem
 * @param {'events' | 'clubs' | 'reservations'} params.scope
 * @returns {boolean}
 */
export const navigateToSearchMapDetail = ({
  isAuthenticated,
  navigation,
  rawItem,
  scope,
}) => {
  const target = getSearchMapDetailTarget({
    isAuthenticated,
    rawItem,
    scope,
  });

  if (!target?.name) {
    return false;
  }

  navigation.navigate(target.name, target.params);
  return true;
};

export default {
  getSearchMapDetailTarget,
  navigateToSearchMapDetail,
};
