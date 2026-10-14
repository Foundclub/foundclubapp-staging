import { estNotificationDuComplexe } from '@/domains/complexe/notificationsDuComplexe';

import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';

// RESA-L5A2 (14/10/2026) — planche RB état 4 et contrat d'API L2A (« Notifications ») : une
// notification `complexeReservationGerant` n'a PAS de `ctaRoute` ; l'app l'aiguille par son type,
// `data.change` et `reservationId` — une demande (ou son rappel) ouvre « Demandes » (E-G06) dans
// l'espace du complexe, une nouvelle réservation ou une annulation ouvre sa fiche (E-G05). Tout est
// éteint tant que `COMPLEXES_GERANT` l'est : la liste des notifications retombe alors sur son
// comportement d'avant (aucune destination).

let mockAllume = true;
// L'interrupteur lu À L'APPEL (un accesseur : une recopie par Babel figerait sa valeur).
jest.mock('@/config/fonctionsMasquees', () => {
  const doublure = { ...jest.requireActual('@/config/fonctionsMasquees') };
  Object.defineProperty(doublure, 'COMPLEXES_GERANT', { enumerable: true, get: () => mockAllume });
  return doublure;
});

const NOTIF = (/** @type {Record<string, any>} */ data) => ({
  complexeId: 'cx-five',
  reservationId: 'r-1',
  type: 'complexeReservationGerant',
  ...data,
});

describe('RESA-L5A2 RB — l’interrupteur allumé', () => {
  beforeEach(() => {
    mockAllume = true;
  });

  it('une demande, son rappel : « Demandes » dans l’espace du complexe', () => {
    ['demande', 'expire-bientot'].forEach((change) => {
      expect(resolveNotificationDestination(NOTIF({ change }))).toEqual({
        params: { params: { complexeId: 'cx-five' }, screen: RouteNames.ComplexeDemandes },
        route: RouteNames.ComplexeEspace,
      });
    });
  });

  it('une nouvelle réservation, une annulation : sa fiche', () => {
    ['nouvelle', 'annulee'].forEach((change) => {
      expect(resolveNotificationDestination(NOTIF({ change }))).toEqual({
        params: { complexeId: 'cx-five', reservationId: 'r-1' },
        route: RouteNames.ComplexeReservation,
      });
    });
  });

  it('les données arrivent aussi sous `data` (forme du centre de notifications)', () => {
    expect(resolveNotificationDestination({
      data: { change: 'demande', complexeId: 'cx-five' }, type: 'complexeReservationGerant',
    })?.route).toBe(RouteNames.ComplexeEspace);
  });

  it('la pastille « Mode complexe » : seulement pour une notification du complexe', () => {
    expect(estNotificationDuComplexe('complexeReservationGerant')).toBe(true);
    expect(estNotificationDuComplexe('complexeReservationJoueur')).toBe(false);
    expect(estNotificationDuComplexe('newEvent')).toBe(false);
  });
});

describe('RESA-L5A2 RB — l’interrupteur éteint (aujourd’hui)', () => {
  beforeEach(() => {
    mockAllume = false;
  });

  it('aucune destination, aucune pastille : le comportement d’avant', () => {
    expect(resolveNotificationDestination(NOTIF({ change: 'demande' }))).toBeNull();
    expect(estNotificationDuComplexe('complexeReservationGerant')).toBe(false);
  });
});
