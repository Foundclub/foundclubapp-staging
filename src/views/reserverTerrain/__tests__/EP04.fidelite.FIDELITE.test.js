/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import ReserverRecapitulatif from '@/views/reserverTerrain/ReserverRecapitulatif';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { maReservation, recapitulatif } from '@/testSupport/temoinReserver';

// FIDELITE (12/11/2026, D63, maquette « 237- ok ») — E-P04 : « Ton bonus fidélité ». Le joueur
// choisit de l'utiliser sur cette réservation (par défaut) ou de le garder ; le prix barré puis
// remisé ; « Réserver » envoie `useLoyalty`. Sans bonus : l'écran et le corps d'avant.

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

const BONUS = {
  percent: null, remise: 15, restant: 1, rewardType: 'partie', scope: 'joueur',
};

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverRecapitulatif />);
  });
  return arbre;
};
const toucher = async (/** @type {any} */ arbre, /** @type {string} */ repere) => {
  const noeud = parRepere(arbre, repere);
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
  // La maquette : 15 € par joueur, 10 joueurs ; une partie offerte, sa part (15 €).
  mockParams = {
    apercu: { ...recapitulatif({ options: [], price: { amount: 15, perPlayer: 15, unit: 'joueur' } }), fidelite: { bonus: BONUS } },
    date: '2026-10-16',
    from: '18:00',
    slug: 'le-five-de-montrivage',
    terrainId: 't-1',
  };
  mockReserver.mockResolvedValue(maReservation());
});

describe('FIDELITE — E-P04, « Ton bonus fidélité » (D63, précision 2)', () => {
  it('avec un bonus : le bloc, « L’utiliser » choisi ; le terrain, « − 15 € », 150 € barré puis 135 € ; « Réserver » envoie useLoyalty', async () => {
    const arbre = await monter();
    expect(parRepere(arbre, 'bloc-bonus-fidelite')).toBeTruthy();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'TON BONUS FIDÉLITÉ', 'Partie offerte (ta part) à Le Five de Montrivage', 'L’utiliser sur cette réservation',
      'Le garder pour plus tard', 'Si cette réservation est annulée, ton bonus te revient.',
      'Terrain · 10 joueurs', '150 €', 'Partie offerte (ta part)', '− 15 €', '135 €',
    ]));
    expect(parRepere(arbre, 'bonus-utiliser').props.accessibilityState).toEqual({ checked: true });
    await reserver(arbre);
    expect(mockReserver).toHaveBeenCalledWith(expect.objectContaining({ terrain: 't-1', useLoyalty: true }));
  });

  it('« Le garder pour plus tard » : plus de remise, et « Réserver » n’envoie pas useLoyalty', async () => {
    const arbre = await monter();
    await toucher(arbre, 'bonus-garder');
    expect(parRepere(arbre, 'bloc-regler-sur-place')).toBeNull();
    await reserver(arbre);
    expect(Object.keys(mockReserver.mock.calls[0][0])).not.toContain('useLoyalty');
  });

  it('SANS bonus : ni bloc, ni clé useLoyalty (l’écran d’avant)', async () => {
    mockParams.apercu = recapitulatif({ options: [], price: { amount: 15, perPlayer: 15, unit: 'joueur' } });
    const arbre = await monter();
    expect(parRepere(arbre, 'bloc-bonus-fidelite')).toBeNull();
    await reserver(arbre);
    expect(Object.keys(mockReserver.mock.calls[0][0])).not.toContain('useLoyalty');
  });
});
