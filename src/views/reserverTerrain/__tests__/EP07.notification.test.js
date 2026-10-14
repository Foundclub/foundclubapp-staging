import { RouteNames } from '@/navigation/routeNames';

// RESA-L6A (14/10/2026) — l'aiguillage des notifications `complexeReservationJoueur` (RESA-L2A,
// N-14 à N-19 : acceptée, refusée, sans réponse, annulée, fermeture ; `data.change`) vers « Ma
// réservation » (E-P07), qui porte l'en-tête d'échec (E-P13) d'une réservation refusée ou annulée.
// Le serveur n'envoie AUCUN ctaRoute (contrat L2A) : l'app aiguille par le type, `change` et
// `reservationId`. Interrupteur `COMPLEXES_JOUEUR` éteint : l'écran n'est pas déclaré, l'appui ne
// mène nulle part (plutôt qu'à un écran inconnu).
//
// 🪤 L'étiquette est écrite À LA MAIN des deux côtés : serveur
// (`admin/src/api/user-fcm-token/types/index.ts`, COMPLEXE_RESERVATION_JOUEUR, branche
// feat/RESAL2A-admin) et app (`authUseCases.js`).

const ETIQUETTE_SERVEUR = 'complexeReservationJoueur';

/**
 * Les modules de l'aiguillage, l'interrupteur à la valeur voulue.
 * @param {boolean} allume - `COMPLEXES_JOUEUR`.
 * @returns {any} Les modules.
 */
const charger = (allume) => {
  let modules;
  jest.isolateModules(() => {
    jest.doMock('@/config/fonctionsMasquees', () => ({
      ...jest.requireActual('@/config/fonctionsMasquees'),
      COMPLEXES_JOUEUR: allume,
    }));
    // Chargés DANS le bac isolé, après la doublure de l'interrupteur.
    /* eslint-disable global-require */
    modules = {
      ...require('@/utils/notifications/notificationNavigation'),
      ...require('@/utils/notifications/notificationPresentation'),
      ...require('@/utils/notifications/notificationTypes'),
    };
    /* eslint-enable global-require */
  });
  return modules;
};

afterEach(() => {
  jest.resetModules();
});

describe('RESA-L6A — la notification du joueur mène à « Ma réservation »', () => {
  it('l’étiquette du serveur est connue de l’app, au caractère près', () => {
    const { NOTIFICATION_TYPES } = charger(false);
    expect(NOTIFICATION_TYPES.COMPLEXE_RESERVATION_JOUEUR).toBe(ETIQUETTE_SERVEUR);
  });

  it('allumé : l’appui ouvre la réservation, avec ce qui a changé', () => {
    const { resolveNotificationDestination } = charger(true);
    const destination = resolveNotificationDestination({
      data: { change: 'refusee', reservationId: 'r-1' },
      type: ETIQUETTE_SERVEUR,
    });
    expect(destination).toEqual({
      params: { change: 'refusee', reservationId: 'r-1' },
      route: RouteNames.ReserverMaReservation,
    });
  });

  it('une fermeture porte son libellé jusqu’à l’écran', () => {
    const { resolveNotificationDestination } = charger(true);
    expect(resolveNotificationDestination({
      data: { change: 'fermeture', closureLabel: 'le 25/10 (travaux)', reservationId: 'r-1' },
      type: ETIQUETTE_SERVEUR,
    })).toEqual({
      params: { change: 'fermeture', fermeture: 'le 25/10 (travaux)', reservationId: 'r-1' },
      route: RouteNames.ReserverMaReservation,
    });
  });

  it('sans réservation, ou interrupteur éteint : l’appui ne mène nulle part', () => {
    expect(charger(true).resolveNotificationDestination({
      data: { change: 'acceptee' }, type: ETIQUETTE_SERVEUR,
    })).toBeNull();
    expect(charger(false).resolveNotificationDestination({
      data: { change: 'acceptee', reservationId: 'r-1' }, type: ETIQUETTE_SERVEUR,
    })).toBeNull();
  });

  it('l’icône du stade ; acceptée en vert, refusée ou annulée en rouge', () => {
    const { getNotificationIcon, getNotificationTone } = charger(true);
    expect(getNotificationIcon(ETIQUETTE_SERVEUR, { change: 'acceptee' })).toBe('stadium');
    expect(getNotificationTone(ETIQUETTE_SERVEUR, { change: 'acceptee' })).toBe('succes');
    expect(getNotificationTone(ETIQUETTE_SERVEUR, { change: 'refusee' })).toBe('refus');
    expect(getNotificationTone(ETIQUETTE_SERVEUR, { change: 'annulee' })).toBe('refus');
  });
});
