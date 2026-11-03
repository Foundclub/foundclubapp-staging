import {
  datesAVenirDesReservations,
  dansLaPlage,
  versElementsDePlanning,
} from '@/domains/complexe/reservationsAuPlanning';

import { getPlanningItemWindow, normalizePlanningItems } from '@/utils/planning/planningSlots';

// T3-RESA-PLANNING (03/11/2026, Adel « 9- A ») — une réservation de terrain devient une ligne du
// planning du joueur. Rouge avant : le module n'existait pas.

const CONFIRMEE = {
  complexe: { name: 'Le Five' },
  date: '2026-11-05',
  documentId: 'r-1',
  endsAt: '2026-11-05T21:00:00.000Z',
  from: '21:00',
  role: 'reserveur',
  startsAt: '2026-11-05T20:00:00.000Z',
  status: 'confirmee',
  terrain: { name: 'Terrain 1' },
  to: '22:00',
};

describe('versElementsDePlanning', () => {
  test('une réservation confirmée : son terrain, son complexe, son heure, son identifiant', () => {
    const [element] = normalizePlanningItems(versElementsDePlanning([CONFIRMEE]));

    expect(element).toMatchObject({
      documentId: 'r-1',
      kind: 'reservation',
      startTime: '21:00',
      title: 'Terrain 1 · Le Five',
    });
    expect(element.raw.reservationTerrain).toEqual({ documentId: 'r-1' });
    const fenetre = getPlanningItemWindow(element);
    expect(fenetre?.endAt.getTime()).toBeGreaterThan(fenetre?.startAt.getTime() ?? Infinity);
  });

  test('une demande en attente reste au planning : le créneau est gardé pour lui', () => {
    expect(versElementsDePlanning([{ ...CONFIRMEE, status: 'en_attente' }])).toHaveLength(1);
  });

  test.each([
    ['une collecte : rien n’est réservé', { status: 'en_collecte' }],
    ['une annulée', { status: 'annulee' }],
    ['une refusée', { status: 'refusee' }],
    ['un participant qui a dit non', { myResponse: 'absent', role: 'participant' }],
    ['sans heure de début', { startsAt: null }],
  ])('%s n’y est pas', (_nom, changement) => {
    expect(versElementsDePlanning([{ ...CONFIRMEE, ...changement }])).toEqual([]);
  });

  test('un participant présent y est ; un doublon entre deux lectures ne compte qu’une fois', () => {
    const present = { ...CONFIRMEE, myResponse: 'present', role: 'participant' };
    expect(versElementsDePlanning([present, present])).toHaveLength(1);
  });

  test('sans terrain lu : le complexe seul ; une réponse illisible ne casse rien', () => {
    expect(versElementsDePlanning([{ ...CONFIRMEE, terrain: null }])[0].title).toBe('Le Five');
    expect(versElementsDePlanning(/** @type {any} */ (null))).toEqual([]);
  });
});

describe('dansLaPlage', () => {
  const elements = versElementsDePlanning([CONFIRMEE]);

  test('dedans, oui ; à côté, non', () => {
    expect(dansLaPlage(elements, {
      from: '2026-11-05T00:00:00.000Z', to: '2026-11-06T00:00:00.000Z',
    })).toHaveLength(1);
    expect(dansLaPlage(elements, {
      from: '2026-11-06T00:00:00.000Z', to: '2026-11-07T00:00:00.000Z',
    })).toEqual([]);
  });
});

describe('datesAVenirDesReservations', () => {
  test('les dates à venir, dans l’ordre, jamais les passées', () => {
    const elements = versElementsDePlanning([
      { ...CONFIRMEE, documentId: 'r-2', startsAt: '2026-11-20T20:00:00.000Z' },
      CONFIRMEE,
      { ...CONFIRMEE, documentId: 'r-3', startsAt: '2026-10-01T20:00:00.000Z' },
    ]);

    const dates = datesAVenirDesReservations(elements, new Date('2026-11-03T00:00:00.000Z'));

    expect(dates.map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-11-05', '2026-11-20']);
  });
});
