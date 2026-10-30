import { RouteNames } from '@/navigation/routeNames';

// RESA-L6B-1 (19/10/2026) — N-20 « Tu confirmes ta réservation de demain ? » (serveur RESA-L2B :
// type `complexeReservationJoueur`, `data.change: 'veille'`, `data.reservationId`, sans ctaRoute) :
// toucher la notification, ou la retrouver dans la cloche, ouvre E-P14 « Demain, tu joues ? ».
// Les autres `change` gardent leur destination (E-P07, témoin EP07.notification.test.js).
// Interrupteur `COMPLEXES_JOUEUR` éteint : l'écran n'est pas déclaré, l'appui ne mène nulle part.

const ETIQUETTE_SERVEUR = 'complexeReservationJoueur';

/**
 * L'aiguillage, l'interrupteur à la valeur voulue.
 * @param {boolean} allume - `COMPLEXES_JOUEUR`.
 * @returns {any} Le module.
 */
const charger = (allume) => {
  let module;
  jest.isolateModules(() => {
    jest.doMock('@/config/fonctionsMasquees', () => ({
      ...jest.requireActual('@/config/fonctionsMasquees'),
      COMPLEXES_JOUEUR: allume,
    }));
    // eslint-disable-next-line global-require -- chargé APRÈS la doublure de l'interrupteur
    module = require('@/utils/notifications/notificationNavigation');
  });
  return module;
};

afterEach(() => {
  jest.resetModules();
});

describe('RESA-L6B-1 — N-20 mène à E-P14 « Demain, tu joues ? »', () => {
  it('le nom de l’écran existe', () => {
    expect(RouteNames.ReserverVeille).toBe('ReserverVeille');
  });

  it('allumé : la question de la veille ouvre E-P14 sur SA réservation', () => {
    const { resolveNotificationDestination } = charger(true);
    expect(resolveNotificationDestination({
      data: { change: 'veille', hourLabel: '19 h', reservationId: 'r-1' },
      type: ETIQUETTE_SERVEUR,
    })).toEqual({
      params: { reservationId: 'r-1' },
      route: RouteNames.ReserverVeille,
    });
  });

  it('les autres changements gardent « Ma réservation » (E-P07)', () => {
    const { resolveNotificationDestination } = charger(true);
    expect(resolveNotificationDestination({
      data: { change: 'acceptee', reservationId: 'r-1' }, type: ETIQUETTE_SERVEUR,
    })).toEqual({
      params: { change: 'acceptee', reservationId: 'r-1' },
      route: RouteNames.ReserverMaReservation,
    });
  });

  // CORR-CHEMINS (30/10, point 48, Adel « A ») : plus jamais « nulle part » ; le détail de la notification.
  it('éteint, ou sans réservation : l’appui ouvre le détail de la notification', () => {
    expect(charger(false).resolveNotificationDestination({
      data: { change: 'veille', reservationId: 'r-1' }, type: ETIQUETTE_SERVEUR,
    })?.route).toBe(RouteNames.NotificationDetails);
    expect(charger(true).resolveNotificationDestination({
      data: { change: 'veille' }, type: ETIQUETTE_SERVEUR,
    })?.route).toBe(RouteNames.NotificationDetails);
  });
});
