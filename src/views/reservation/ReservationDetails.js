import EventDetails from '@/views/event/EventDetails';

/**
 * Native reservation details reuse the event details screen while keeping
 * a dedicated route for reservation-specific navigation.
 * @param {object} props
 * @param {any} props.navigation
 * @param {any} props.route
 * @returns {import('react').ReactElement}
 */
function ReservationDetails({ navigation, route }) {
  const reservationId = route?.params?.reservationId || route?.params?.eventId;

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
