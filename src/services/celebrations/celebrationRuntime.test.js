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
      title: 'Événement crée',
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
      eventName: 'Détection U20',
      status: 'accepted',
      type: NOTIFICATION_TYPES.PARTICIPATION_REQUEST,
    });

    unsubscribe();

    expect(payload).toEqual(expect.objectContaining({
      actionKey: 'event_participation_confirmed',
      title: 'Participation confirmée',
      variant: 'celebration',
    }));
    expect(received).toEqual([payload]);
  });
  // S12-B/D7 — LA BANNIERE DE QUOTA EST JETEE EN SILENCE SANS ENTREE AU CATALOGUE.
  //
  // Le serveur (S12-A) envoie deja les deux notifications, avec leur `celebrationKey`.
  // Cote app, `buildCelebrationPayload` rend `null` pour tout actionKey absent du
  // catalogue (celebrationCatalog.js:543-545) et `celebrate` s'arrete la
  // (celebrationRuntime.js:39-42) : AUCUN ecran, AUCUNE erreur, rien. Le dirigeant
  // ne sait jamais que son club est plein.
  test.each([
    ['club_licensee_quota_approaching', 'Bientot au complet', 'info'],
    ['club_licensee_quota_reached', 'Plafond de licencies atteint', 'warning'],
  ])('la notification de quota %s s affiche vraiment', (celebrationKey, titreServeur, tonAttendu) => {
    const recues = [];
    const desabonner = subscribeToCelebrations((payload) => {
      recues.push(payload);
    });

    const payload = emitCelebrationFromNotificationPayload({
      body: 'Ton club a atteint le nombre de licencies couverts par son abonnement.',
      celebrationKey,
      celebrationTone: tonAttendu,
      celebrationVariant: 'banner',
      clubId: 'club-doc-1',
      clubName: 'AS Test',
      licenseeCount: 120,
      memberCount: 120,
      remaining: 0,
      title: titreServeur,
      type: NOTIFICATION_TYPES.CELEBRATION,
    });

    desabonner();

    expect(payload).not.toBeNull();
    expect(payload).toEqual(expect.objectContaining({
      actionKey: celebrationKey,
      title: titreServeur,
      tone: tonAttendu,
      variant: 'banner',
    }));
    expect(recues).toEqual([payload]);
  });
});
