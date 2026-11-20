import renderer, { act } from 'react-test-renderer';

import CarteComplexeRecherche from '@/views/reserverTerrain/components/CarteComplexeRecherche';

import { lisibles } from '@/testSupport/temoinComplexe';
import { carteDeRecherche } from '@/testSupport/temoinReserver';

// FC-4 PAGE (20/11/2026, planche FICHES-COMPLEXES 5b, validée par Adel) — la carte de la recherche
// d'une page créée par FoundClub (`pageFoundclub: true`, serveur FC-1) : « Réserver sur son site »
// (elle a un lien de réservation), sinon « Réserver auprès du complexe », à la place de « Bientôt
// réservable » ; pastille « Complexe ». Une carte de complexe réservable ne change pas.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const montes = /** @type {any[]} */ ([]);

/**
 * Monte une carte.
 * @param {any} carte - La carte de `GET /public-complexes`.
 * @returns {any} L'arbre.
 */
const monter = (carte) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <CarteComplexeRecherche carte={carte} onCreneau={jest.fn()} onOuvrir={jest.fn()} />,
    );
  });
  montes.push(arbre);
  return arbre;
};

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

const PAGE = {
  bientotReservable: true,
  externalBookingUrl: 'https://lefive-montrivage.fr/reserver',
  freeSlotsCount: 0,
  pageFoundclub: true,
  slots: [],
};

describe('FC-4 — la carte d’une page FoundClub dans la recherche (5b)', () => {
  it('avec un lien : « Réserver sur son site », pastille « Complexe », plus de « Bientôt réservable »', () => {
    const textes = lisibles(monter(carteDeRecherche(PAGE)));
    expect(textes).toEqual(expect.arrayContaining(['Réserver sur son site', 'Complexe']));
    expect(textes).not.toContain('Bientôt réservable');
    expect(textes).not.toContain('Complexe de réservation');
    expect(textes).not.toContain('Aucun créneau pour ces filtres');
  });

  it('sans lien : « Réserver auprès du complexe »', () => {
    const textes = lisibles(monter(carteDeRecherche({ ...PAGE, externalBookingUrl: null })));
    expect(textes).toContain('Réserver auprès du complexe');
    expect(textes).not.toContain('Bientôt réservable');
  });

  it('E6 — un complexe d’avant (sans `pageFoundclub`) : « Bientôt réservable », comme aujourd’hui', () => {
    const textes = lisibles(monter(carteDeRecherche({ bientotReservable: true, freeSlotsCount: 0, slots: [] })));
    expect(textes).toEqual(expect.arrayContaining(['Bientôt réservable', 'Complexe de réservation']));
    expect(textes).not.toContain('Réserver sur son site');
  });
});
