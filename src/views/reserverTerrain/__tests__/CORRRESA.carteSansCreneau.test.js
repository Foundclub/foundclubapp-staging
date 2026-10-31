import renderer, { act } from 'react-test-renderer';

import CarteComplexeRecherche from '@/views/reserverTerrain/components/CarteComplexeRecherche';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { carteDeRecherche } from '@/testSupport/temoinReserver';

// CORR-RESA (70 B, 82 B) — une carte de la recherche SANS créneau dit pourquoi : « Bientôt
// réservable » (aucun terrain encore ouvert), ou « Aucun créneau pour ces filtres ». Une carte
// avec des créneaux ne dit ni l'un ni l'autre. Mêmes doublures que EP01.carte.test.js.

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

describe('CORR-RESA (70 B, 82 B) — la carte sans créneau dit pourquoi', () => {
  it('sans créneau et bientotReservable : « Bientôt réservable »', () => {
    const arbre = monter(carteDeRecherche({
      bientotReservable: true, freeSlotsCount: 0, phoneOnly: false, slots: [],
    }));
    expect(parRepere(arbre, 'carte-bientot-reservable')).not.toBeNull();
    expect(lisibles(arbre)).toContain('Bientôt réservable');
    expect(parRepere(arbre, 'carte-aucun-creneau')).toBeNull();
  });

  it('sans créneau, ni bientotReservable ni téléphone : « Aucun créneau pour ces filtres »', () => {
    const arbre = monter(carteDeRecherche({
      bientotReservable: false, freeSlotsCount: 0, phoneOnly: false, slots: [],
    }));
    expect(parRepere(arbre, 'carte-aucun-creneau')).not.toBeNull();
    expect(lisibles(arbre)).toContain('Aucun créneau pour ces filtres');
    expect(parRepere(arbre, 'carte-bientot-reservable')).toBeNull();
  });

  it('avec des créneaux : ni l’un ni l’autre', () => {
    const arbre = monter(carteDeRecherche({ bientotReservable: true }));
    expect(parRepere(arbre, 'carte-bientot-reservable')).toBeNull();
    expect(parRepere(arbre, 'carte-aucun-creneau')).toBeNull();
    expect(lisibles(arbre)).not.toContain('Bientôt réservable');
    expect(lisibles(arbre)).not.toContain('Aucun créneau pour ces filtres');
  });
});
