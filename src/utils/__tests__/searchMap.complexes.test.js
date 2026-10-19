import {
  getSearchMapEmptyMessage,
  getSearchMapNoCoordinatesMessage,
  getSearchMapResultLabel,
} from '@/utils/searchMap';

// RESA-CARTE (20/10/2026) — LES MOTS DE LA CARTE DE RECHERCHE, PAR PORTÉE (« 3 clubs », « Aucun
// événement géolocalisable… »). Fichier sans témoin (E6) : les trois premiers blocs décrivent les
// mots de l'annuaire AUJOURD'HUI (clubs, événements, réservations), qui ne doivent pas bouger.
// La recherche de terrains (E-P01, planche EP01 état 2) pose sur la carte des COMPLEXES : sa portée
// `complexes` dit « 3 complexes », jamais « 3 réservations » ni « 3 clubs » (A-G05 : un complexe
// n'est pas un club).

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

describe('RESA-CARTE — les mots de la carte, portée par portée', () => {
  it('l’annuaire, inchangé : le nombre de résultats', () => {
    expect([
      getSearchMapResultLabel('clubs', 1), getSearchMapResultLabel('clubs', 3),
      getSearchMapResultLabel('events', 1), getSearchMapResultLabel('events', 3),
      getSearchMapResultLabel('reservations', 1), getSearchMapResultLabel('reservations', 3),
    ]).toEqual(['club', 'clubs', 'événement', 'événements', 'réservation', 'réservations']);
  });

  it('l’annuaire, inchangé : rien à placer', () => {
    expect([
      getSearchMapEmptyMessage('clubs'),
      getSearchMapEmptyMessage('events'),
      getSearchMapEmptyMessage('reservations'),
    ]).toEqual([
      'Aucun club géolocalisable pour le moment.',
      'Aucun événement géolocalisable pour le moment.',
      'Aucune réservation géolocalisable pour le moment.',
    ]);
  });

  it('l’annuaire, inchangé : des résultats sans position', () => {
    expect(getSearchMapNoCoordinatesMessage('clubs', 2))
      .toBe("2 clubs trouvés, mais aucun n'a de position exploitable sur la carte.");
    expect(getSearchMapNoCoordinatesMessage('events', 1))
      .toBe("1 événement trouvé, mais aucun n'a de position exploitable sur la carte.");
  });

  it('les complexes : « 1 complexe », « 3 complexes »', () => {
    expect([getSearchMapResultLabel('complexes', 1), getSearchMapResultLabel('complexes', 3)])
      .toEqual(['complexe', 'complexes']);
  });

  it('les complexes : rien à placer, ou des complexes sans position', () => {
    expect(getSearchMapEmptyMessage('complexes')).toBe('Aucun complexe à placer sur la carte.');
    expect(getSearchMapNoCoordinatesMessage('complexes', 2))
      .toBe("2 complexes trouvés, mais aucun n'a de position exploitable sur la carte.");
    expect(getSearchMapNoCoordinatesMessage('complexes', 1))
      .toBe("1 complexe trouvé, mais il n'a pas de position exploitable sur la carte.");
  });
});
