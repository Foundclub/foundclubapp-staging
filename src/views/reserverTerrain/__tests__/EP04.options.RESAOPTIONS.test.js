/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import ReserverRecapitulatif from '@/views/reserverTerrain/ReserverRecapitulatif';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { maReservation, recapitulatif } from '@/testSupport/temoinReserver';

// RESA-OPTIONS (12/11/2026) — E-P04, le bloc « Options » (D61, maquette section 4 bis) : sous « Ton
// groupe », un compteur par option proposée (0 à 9 par unité, 0 ou 1 par réservation, une
// obligatoire part à 1) ; « À régler sur place » : le terrain, une ligne par option, le total ;
// « Réserver » envoie le choix. Sans option, l'écran et le corps restent ceux d'avant.

const mockReplace = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: mockReplace }),
  useRoute: () => ({ params: mockParams }),
}));
const mockReserver = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useApercuDeReservation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useComplexePublic: () => ({ data: null }),
  usePublierUneAnnonce: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useReserverUnCreneau: () => ({ isPending: false, mutateAsync: mockReserver }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { birthdate: '1990-05-02', documentId: 'u-1' } }),
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/components/templates/ScreenContainer', () => function FauxConteneur(/** @type {any} */ { children }) {
  return children;
});
jest.mock('react-i18next', () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next);
jest.mock('@/theme/themeContext', () => jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin());

const OPTIONS = [
  {
    id: 'o-chas', name: 'Location de chasubles', price: 5, required: false, unit: 'reservation',
  },
  {
    id: 'o-ball', name: 'Ballon de match', price: 3, required: false, unit: 'unite',
  },
];

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverRecapitulatif />);
  });
  return arbre;
};
const toucherLibelle = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const [noeud] = arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === libelle && typeof n.props?.onPress === 'function');
  await act(async () => {
    noeud.props.onPress();
  });
};
const reserver = async (/** @type {any} */ arbre) => {
  const [noeud] = arbre.root.findAll((/** @type {any} */ n) => n.props?.title === 'Réserver' && typeof n.props?.onPress === 'function');
  await act(async () => {
    await noeud.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  // Le terrain de la maquette : 15 € par joueur, 10 joueurs.
  mockParams = {
    apercu: recapitulatif({ options: OPTIONS, price: { amount: 15, perPlayer: 15, unit: 'joueur' } }),
    date: '2026-10-16',
    from: '18:00',
    slug: 'le-five-de-montrivage',
    terrainId: 't-1',
  };
  mockReserver.mockResolvedValue(maReservation());
});

describe('RESA-OPTIONS — E-P04, le bloc « Options »', () => {
  it('un compteur par option ; le total « à régler sur place » se met à jour (150 + 5 + 6 = 161 €) ; « Réserver » envoie le choix', async () => {
    const arbre = await monter();
    expect(parRepere(arbre, 'recap-options')).toBeTruthy();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'OPTIONS', 'Location de chasubles', '5 € par réservation', 'Ballon de match', '3 € par unité',
    ]));
    // Rien de choisi : pas encore de détail.
    expect(parRepere(arbre, 'bloc-regler-sur-place')).toBeNull();

    await toucherLibelle(arbre, 'Un de plus : Location de chasubles');
    await toucherLibelle(arbre, 'Un de plus : Location de chasubles');
    await toucherLibelle(arbre, 'Un de plus : Ballon de match');
    await toucherLibelle(arbre, 'Un de plus : Ballon de match');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'À RÉGLER SUR PLACE', 'Terrain · 10 joueurs', '150 €', 'Location de chasubles × 1', '5 €',
      'Ballon de match × 2', '6 €', 'Total', '161 €',
      'Indicatif : le complexe encaisse sur place. L’app n’encaisse rien.',
    ]));
    await reserver(arbre);
    expect(mockReserver).toHaveBeenCalledWith(expect.objectContaining({
      options: [{ id: 'o-chas', quantity: 1 }, { id: 'o-ball', quantity: 2 }],
      terrain: 't-1',
    }));
  });

  it('une option obligatoire part à 1 et ne descend pas sous 1', async () => {
    mockParams.apercu = recapitulatif({
      options: [{
        id: 'o-arb', name: 'Arbitre', price: 20, required: true, unit: 'reservation',
      }],
    });
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining(['20 € par réservation · obligatoire', 'Arbitre × 1', '80 €']));
    await toucherLibelle(arbre, 'Un de moins : Arbitre');
    expect(lisibles(arbre)).toContain('Arbitre × 1');
    await reserver(arbre);
    expect(mockReserver.mock.calls[0][0].options).toEqual([{ id: 'o-arb', quantity: 1 }]);
  });

  it('SANS option : ni bloc, ni ligne de plus ; le corps de « Réserver » est celui d’avant (pas de clé `options`)', async () => {
    mockParams.apercu = recapitulatif({ options: [] });
    const arbre = await monter();
    expect(parRepere(arbre, 'recap-options')).toBeNull();
    expect(parRepere(arbre, 'bloc-regler-sur-place')).toBeNull();
    await reserver(arbre);
    expect(Object.keys(mockReserver.mock.calls[0][0])).not.toContain('options');
  });
});
