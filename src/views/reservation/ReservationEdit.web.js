import EventEdit from '@/views/event/EventEdit';

function ReservationEdit(props) {
  const route = props?.route || {};
  const reservationId = route?.params?.reservationId || route?.params?.eventId;

  return (
    <EventEdit
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

export default ReservationEdit;
