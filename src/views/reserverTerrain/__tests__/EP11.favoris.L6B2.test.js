import renderer, { act } from 'react-test-renderer';

import ReserverFavoris from '@/views/reserverTerrain/ReserverFavoris';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';

// RESA-L6B-2 (20/10/2026) — E-P11 « Mes complexes favoris » (serveur RESA-L4 ; planche EP11 ; plan
// E-P11 ; A-G06, A-G08, Q5, AT-11 A, AT-15 A) : « MES COMPLEXES FAVORIS » et leur nombre, une carte
// par complexe (logo, nom, ville, sports, cœur plein, « Canal du complexe » s'il en est membre) ⇒
// E-P02 ; le cœur ⇒ « Retirer des favoris ? Tu resteras dans le canal. » avec la case « Quitter
// aussi le canal » ; un complexe parti : « n'est plus disponible », « Retirer » ; vide : ce que le
// favori apporte, « Réserver un terrain » ; chargement, erreur.

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: {} }),
}));

let mockFavoris = /** @type {any} */ ({});
let mockRelations = /** @type {Record<string, any>} */ ({});
const mockRetirer = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useMesFavoris: () => mockFavoris,
  useRelationsAuxComplexes: () => ({ relations: mockRelations }),
  useRetirerDesFavoris: () => ({ isPending: false, mutateAsync: mockRetirer }),
}));
const mockVersLaRecherche = jest.fn();
jest.mock('@/views/search/searchRouteHelpers', () => ({
  navigateToSearchHub: (...args) => mockVersLaRecherche(...args),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/navigation/useBottomDockLayout', () => () => ({ dockClearance: 0 }));
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const FAVORIS = [
  {
    complexe: {
      city: 'Montrivage',
      disponible: true,
      logo: null,
      name: 'Le Five de Montrivage',
      slug: 'le-five-de-montrivage',
      sports: [
        { documentId: 'a-five', name: 'Football à 5' },
        { documentId: 'a-padel', name: 'Padel' },
      ],
    },
    origin: 'bouton',
    since: '2026-10-10T10:00:00.000Z',
  },
  {
    complexe: {
      city: 'Valbrune',
      disponible: true,
      logo: null,
      name: 'Padel Club Valbrune',
      slug: 'padel-club-valbrune',
      sports: [{ documentId: 'a-padel', name: 'Padel' }],
    },
    origin: 'affiche',
    since: '2026-10-09T10:00:00.000Z',
  },
  {
    complexe: { disponible: false, name: 'Urban Soccer Rivelac', slug: 'urban-soccer-rivelac' },
    origin: 'bouton',
    since: '2026-09-01T10:00:00.000Z',
  },
];

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverFavoris />);
  });
  return arbre;
};

/**
 * Appuie sur un nœud.
 * @param {any} noeud - Le nœud.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (noeud) => {
  await act(async () => {
    await noeud.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFavoris = {
    data: FAVORIS, error: null, isLoading: false, refetch: jest.fn(),
  };
  mockRelations = {
    'le-five-de-montrivage': { canal: { chatId: 'chat-canal', membre: true, membres: 214 } },
  };
  mockRetirer.mockResolvedValue({ favori: false });
});

it('le titre et le nombre, une carte par complexe (ville, sports), le cœur plein', async () => {
  const arbre = await monter();
  expect(lisibles(arbre)).toEqual(expect.arrayContaining([
    'MES COMPLEXES FAVORIS',
    '3 complexes',
    'Le Five de Montrivage',
    'Montrivage · Foot à 5, Padel',
    'Padel Club Valbrune',
    'Valbrune · Padel',
  ]));
  expect(parRepere(arbre, 'favori-coeur-le-five-de-montrivage').props.accessibilityLabel)
    .toBe('Dans tes favoris : retirer');
});

it('une carte ouvre le complexe (E-P02) ; « Canal du complexe », le canal (E-P12)', async () => {
  const arbre = await monter();
  await toucher(parRepere(arbre, 'favori-le-five-de-montrivage'));
  expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverComplexe, {
    slug: 'le-five-de-montrivage',
  });
  await toucher(pressable(arbre, 'Canal du complexe'));
  expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.Conversation, { chatId: 'chat-canal' });
});

it('le cœur : « Retirer des favoris ? », le canal gardé, la case, « Retirer »', async () => {
  const arbre = await monter();
  await toucher(parRepere(arbre, 'favori-coeur-le-five-de-montrivage'));
  expect(lisibles(arbre)).toEqual(expect.arrayContaining([
    'Retirer des favoris ?',
    'Tu resteras dans le canal.',
    'Quitter aussi le canal',
    'Garder',
  ]));
  await toucher(parRepere(arbre, 'favori-quitter-canal'));
  await toucher(parRepere(arbre, 'favori-retirer-confirme'));
  expect(mockRetirer).toHaveBeenCalledWith({ quitterCanal: true, slug: 'le-five-de-montrivage' });
});

it('un complexe parti : « n’est plus disponible », « Retirer »', async () => {
  const arbre = await monter();
  expect(lisibles(arbre)).toContain('Urban Soccer Rivelac n’est plus disponible');
  await toucher(parRepere(arbre, 'favori-retirer-urban-soccer-rivelac'));
  expect(mockRetirer).toHaveBeenCalledWith({ quitterCanal: false, slug: 'urban-soccer-rivelac' });
});

it('vide : ce que le favori apporte, « Réserver un terrain » (E-P01)', async () => {
  mockFavoris = { data: [], error: null, isLoading: false };
  const arbre = await monter();
  expect(lisibles(arbre)).toContain(
    'Ajoute tes complexes préférés pour les retrouver ici et recevoir leurs nouvelles.',
  );
  await toucher(pressable(arbre, 'Réserver un terrain'));
  expect(mockVersLaRecherche).toHaveBeenCalledWith(expect.anything(), 'reservations');
});

it('chargement : le squelette ; erreur : « Impossible de charger tes favoris. »', async () => {
  mockFavoris = { data: undefined, error: null, isLoading: true };
  expect(parRepere(await monter(), 'favoris-squelette')).not.toBeNull();
  mockFavoris = {
    data: undefined, error: { status: 500 }, isLoading: false, refetch: jest.fn(),
  };
  const arbre = await monter();
  expect(lisibles(arbre)).toEqual(expect.arrayContaining([
    'Impossible de charger tes favoris.', 'Réessayer',
  ]));
});
