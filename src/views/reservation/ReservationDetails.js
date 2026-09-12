import { useLayoutEffect } from 'react';

import EventDetails from '@/views/event/EventDetails';

import { hasRouteInNavigationTree } from '@/navigation/navigationAvailability';
import { RouteNames } from '@/navigation/routeNames';

/**
 * Native reservation details reuse the event details screen while keeping
 * a dedicated route for reservation-specific navigation.
 *
 * NAVMORTE2 (2026-09-11) -- cette route est montee sur la pile RACINE. Rendre
 * EventDetails ICI lui donnait la navigation de la racine : ses boutons vers les
 * ecrans de la pile Evenement (faire l appel, convocation, composition) visaient
 * des routes que la racine ne porte pas, et ne faisaient RIEN. L ecran ne sert
 * qu a renommer l identifiant (reservationId -> eventId) : quand la pile Evenement
 * est a portee, on lui passe donc la main, avec les memes parametres.
 * Sans elle (navigateur public), le rendu reste celui d avant.
 * Temoin : src/views/reservation/__tests__/ReservationDetails.gestesMorts.test.js.
 * @param {object} props
 * @param {any} props.navigation
 * @param {any} props.route
 * @returns {import('react').ReactElement | null}
 */
function ReservationDetails({ navigation, route }) {
  const reservationId = route?.params?.reservationId || route?.params?.eventId;
  const pileEvenementAPortee = hasRouteInNavigationTree(navigation, RouteNames.EventStack);

  useLayoutEffect(() => {
    if (!pileEvenementAPortee) return;
    navigation.replace(RouteNames.EventStack, {
      params: {
        ...(route?.params || {}),
        eventId: reservationId,
        reservationId,
      },
      screen: RouteNames.EventDetails,
    });
  }, [navigation, pileEvenementAPortee, reservationId, route?.params]);

  if (pileEvenementAPortee) return null;

  return (
    <EventDetails
      navigation={navigation}
      route={{
        ...route,
        params: {
          ...(route?.params || {}),
          eventId: reservationId,
          reservationId,
        },
      }}
    />
  );
}

export default ReservationDetails;
