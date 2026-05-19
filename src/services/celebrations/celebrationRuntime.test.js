const { NOTIFICATION_TYPES } = require('@/utils/notifications/notificationTypes');

const {
  celebrate,
  emitCelebrationFromNotificationPayload,
  subscribeToCelebrations,
} = require('./celebrationRuntime');

describe('celebrationRuntime', () => {
  test('celebrate emits a local success banner payload', () => {
    const received = [];
    const unsubscribe = subscribeToCelebrations((payload) => {
      received.push(payload);
    });

    const payload = celebrate('event_created', {
      eventId: 'event-doc-1',
      eventName: 'Match amical',
    });

    unsubscribe();

    expect(payload).toEqual(expect.objectContaining({
      actionKey: 'event_created',
      body: 'Match amical est bien enregistre.',
      title: 'Evenement cree',
      variant: 'banner',
    }));
    expect(received).toEqual([payload]);
  });

  test('emitCelebrationFromNotificationPayload infers the action from an accepted participation request', () => {
    const received = [];
    const unsubscribe = subscribeToCelebrations((payload) => {
      received.push(payload);
    });

    const payload = emitCelebrationFromNotificationPayload({
      eventDocumentId: 'event-doc-2',
      eventName: 'Detection U20',
      status: 'accepted',
      type: NOTIFICATION_TYPES.PARTICIPATION_REQUEST,
    });

    unsubscribe();

    expect(payload).toEqual(expect.objectContaining({
      actionKey: 'event_participation_confirmed',
      title: 'Participation confirmee',
      variant: 'celebration',
    }));
    expect(received).toEqual([payload]);
  });
});
