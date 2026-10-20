import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import { getNotificationIcon } from '@/utils/notifications/notificationPresentation';

// RESA-L5B-1 (20/10/2026) — E-G19 « Notifications du gestionnaire » (plan :1119-1149, planche
// EG19 ; serveur RESA-L2B : `complexeReservationGerant`, `data.change` + `reservationId`, AUCUN
// `ctaRoute`) : chaque ligne ouvre son écran — N-01 (« nouvelle ») et N-04 (« annulee ») la fiche
// (E-G05), N-02 et N-03 « Demandes » (E-G06), N-05 (« resume-matin ») et N-11 l'accueil (E-G02),
// N-12 (« bannissement-auto ») la FICHE DU CLIENT (E-G15) — et porte l'icône de la planche
// (calendrier, croix, drapeau, stade…), dans le jeu d'icônes de l'app. Éteint : rien ne change.

let mockAllume = true;
jest.mock('@/config/fonctionsMasquees', () => {
  const doublure = { ...jest.requireActual('@/config/fonctionsMasquees') };
  Object.defineProperty(doublure, 'COMPLEXES_GERANT', { enumerable: true, get: () => mockAllume });
  return doublure;
});

const GERANT = 'complexeReservationGerant';
const NOTIF = (/** @type {Record<string, any>} */ data) => ({
  complexeId: 'cx-five', reservationId: 'r-1', type: GERANT, ...data,
});
const ACCUEIL = {
  params: { params: { complexeId: 'cx-five' }, screen: RouteNames.ComplexeAccueil },
  route: RouteNames.ComplexeEspace,
};

describe('RESA-L5B-1 E-G19 — l’aiguillage, interrupteur allumé', () => {
  beforeEach(() => {
    mockAllume = true;
  });

  it('N-12, le bannissement automatique : la fiche du client (par sa réservation)', () => {
    expect(resolveNotificationDestination(NOTIF({ change: 'bannissement-auto' }))).toEqual({
      params: { complexeId: 'cx-five', reservationId: 'r-1' },
      route: RouteNames.ComplexeClient,
    });
  });

  it('N-05, le résumé du matin : l’accueil, même si une réservation était nommée', () => {
    const sansReservation = NOTIF({ change: 'resume-matin', reservationId: undefined });
    expect(resolveNotificationDestination(sansReservation)).toEqual(ACCUEIL);
    expect(resolveNotificationDestination(NOTIF({ change: 'resume-matin' }))).toEqual(ACCUEIL);
  });

  it('N-11 : l’accueil ; N-01 et N-04 : la fiche ; N-02 et N-03 : Demandes', () => {
    const suspension = NOTIF({ change: 'suspension', reservationId: undefined });
    expect(resolveNotificationDestination(suspension)).toEqual(ACCUEIL);
    ['nouvelle', 'annulee'].forEach((change) => {
      expect(resolveNotificationDestination(NOTIF({ change }))?.route)
        .toBe(RouteNames.ComplexeReservation);
    });
    ['demande', 'expire-bientot'].forEach((change) => {
      expect(resolveNotificationDestination(NOTIF({ change }))?.params?.screen)
        .toBe(RouteNames.ComplexeDemandes);
    });
  });

  it('l’icône de chaque ligne (planche EG19)', () => {
    const icone = (/** @type {string} */ change) => getNotificationIcon(GERANT, { change });
    expect({
      annulee: icone('annulee'),
      'bannissement-auto': icone('bannissement-auto'),
      demande: icone('demande'),
      'expire-bientot': icone('expire-bientot'),
      nouvelle: icone('nouvelle'),
      'resume-matin': icone('resume-matin'),
      suspension: icone('suspension'),
    }).toEqual({
      annulee: 'close',
      'bannissement-auto': 'shield',
      demande: 'calendar-days',
      'expire-bientot': 'clock-two-thirty',
      nouvelle: 'calendar',
      'resume-matin': 'stadium',
      suspension: 'stadium',
    });
  });
});

describe('RESA-L5B-1 E-G19 — interrupteur éteint (staging)', () => {
  beforeEach(() => {
    mockAllume = false;
  });

  it('aucune destination ; la cloche de toujours', () => {
    expect(resolveNotificationDestination(NOTIF({ change: 'bannissement-auto' }))).toBeNull();
    expect(getNotificationIcon(GERANT, { change: 'bannissement-auto' })).toBe('bell');
  });
});
