import EventDetails from '@/views/event/EventDetails';

function ReservationDetails(props) {
  const route = props?.route || {};
  const reservationId = route?.params?.reservationId || route?.params?.eventId;

  return (
    <EventDetails
      {...props}
      route={{
        ...route,
        params: {
          ...(route?.params || {}),
          eventId: reservationId,
        },
      }}
    />
  );
}

export default ReservationDetails;
