import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeClients from '@/views/complexe/ComplexeClients';

import { RouteNames } from '@/navigation/routeNames';

import {
  COMPLEXE_FIVE,
  lisibles,
  parRepere,
  pressable,
} from '@/testSupport/temoinComplexe';

// RESA-L5B-2 (20/10/2026) — E-G15 « Les clients », LA LISTE (planche EG15 états 1, 6, 7, 8 ; plan
// :970-1010) : « Clients », la recherche par nom, les onglets Tous · Habitués · Bannis, une ligne
// par client (« 12 parties · 1 non honorée · fidélité 8/10 », la pastille « Banni »),
// « Voir plus »,
// toucher un client ouvre SA fiche (RESA-L5B-1). Les états : vide, recherche sans résultat,
// chargement, erreur. Doublure : `GET /complexes/:id/clients?onglet&recherche&page` (RESA-L4).

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

/** @type {any[]} */
const mockFiltresLus = [];
let mockLecture = /** @type {any} */ ({});
jest.mock('@/services/complexe/complexeQueries', () => ({
  useClientsDuComplexe: (/** @type {any} */ complexeId, /** @type {any} */ filtres) => {
    mockFiltresLus.push({ complexeId, ...filtres });
    return mockLecture;
  },
  useComplexeChoisi: (/** @type {any} */ complexeId) => ({
    complexe: { documentId: complexeId || 'cx-five', name: 'Le Five de Montrivage' },
    complexeId: complexeId || 'cx-five',
    mes: { data: [], isLoading: false },
  }),
}));

jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => (
  jest.requireActual('@/testSupport/temoinComplexe').ongletsDeTemoin()
));
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
// RESA-FIN-APP : la liste lit la largeur (volet de la fiche sur ordinateur) ; ici, le téléphone.
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
// La fiche (volet de l'ordinateur) a son propre témoin : ici, la liste seule.
jest.mock('@/views/complexe/ComplexeClient', () => function FausseFiche() { return null; });
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Un client de la liste (`listerClients`, RESA-L4).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} Le client.
 */
const client = (autres = {}) => ({
  avatar: null,
  banni: false,
  derniereReservation: '2026-10-16T17:00:00.000Z',
  documentId: 'u-julien',
  fidelite: { count: 8, threshold: 10 },
  firstname: 'Julien',
  habitue: true,
  lastname: 'Marchal',
  lateCancellations: 0,
  noShows: 1,
  parties: 12,
  reservations: 14,
  ...autres,
});

/**
 * Une lecture par pages.
 * @param {any[]} items - Les clients.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {any} La lecture.
 */
const pages = (items, autres = {}) => ({
  data: {
    pages: [{
      compteurs: { bannis: 1, habitues: 2, tous: items.length },
      items,
      pagination: { page: 1, pageSize: 20, total: items.length },
    }],
  },
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isLoading: false,
  refetch: jest.fn(),
  ...autres,
});

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeClients />);
  });
  return arbre;
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockFiltresLus.length = 0;
  mockParams = { complexeId: COMPLEXE_FIVE.documentId };
  mockLecture = pages([
    client(),
    client({
      banni: true,
      documentId: 'u-karim',
      fidelite: null,
      firstname: 'Karim',
      lastname: 'B.',
      noShows: 3,
      parties: 7,
    }),
  ]);
});

describe('E-G15 — la liste des clients', () => {
  it('« Clients », la recherche, les onglets, une ligne par client (planche état 1)', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toContain('CLIENTS');
    expect(vus).toEqual(expect.arrayContaining(['Tous', 'Habitués', 'Bannis']));
    expect(vus).toContain('Julien Marchal');
    expect(vus).toContain('12 parties · 1 non honorée · fidélité 8/10');
    expect(vus).toContain('Karim B.');
    expect(vus).toContain('7 parties · 3 non honorées');
    expect(parRepere(arbre, 'client-ligne-u-karim-banni')).not.toBeNull();
    expect(parRepere(arbre, 'client-ligne-u-julien-banni')).toBeNull();
    const recherche = arbre.root.findAllByType(TextInput)[0];
    expect(recherche.props.placeholder).toBe('Chercher un client');
    expect(mockFiltresLus.at(-1)).toEqual({ complexeId: 'cx-five', onglet: 'tous', recherche: '' });
  });

  it('un onglet relit la liste avec son nom ; la recherche avec le nom tapé', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Bannis').props.onPress();
    });
    expect(mockFiltresLus.at(-1)).toMatchObject({ onglet: 'bannis' });
    await act(async () => {
      arbre.root.findAllByType(TextInput)[0].props.onChangeText('  Dup ');
    });
    expect(mockFiltresLus.at(-1)).toMatchObject({ onglet: 'bannis', recherche: 'Dup' });
  });

  it('toucher un client ouvre SA fiche (RESA-L5B-1)', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Julien Marchal').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeClient, {
      complexeId: 'cx-five', joueurId: 'u-julien',
    });
  });

  it('pages de 20 : « Voir plus » lit la suivante', async () => {
    mockLecture = pages([client()], { hasNextPage: true });
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Voir plus').props.onPress();
    });
    expect(mockLecture.fetchNextPage).toHaveBeenCalled();
  });

  it('vide : « Tes clients apparaîtront après leur première réservation. » (état 6)', async () => {
    mockLecture = pages([]);
    const arbre = await monter();
    expect(lisibles(arbre))
      .toContain('Tes clients apparaîtront après leur première réservation.');
  });

  it('recherche sans résultat : le nom tapé, et pourquoi il peut manquer (état 7)', async () => {
    const arbre = await monter();
    mockLecture = pages([]);
    await act(async () => {
      arbre.root.findAllByType(TextInput)[0].props.onChangeText('Dupont');
    });
    expect(lisibles(arbre)).toContain(
      'Aucun client « Dupont ». Une réservation à l’extérieur n’a pas de fiche client.',
    );
  });

  it('chargement : le squelette ; erreur : le message et « Réessayer »', async () => {
    mockLecture = { data: undefined, isLoading: true };
    let arbre = await monter();
    expect(parRepere(arbre, 'clients-squelette')).not.toBeNull();
    mockLecture = {
      data: undefined, error: new Error('panne'), isLoading: false, refetch: jest.fn(),
    };
    arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger tes clients.');
    await act(async () => {
      pressable(arbre, 'Réessayer').props.onPress();
    });
    expect(mockLecture.refetch).toHaveBeenCalled();
  });
});

// RESA-FIN-APP (20/10/2026) — tournées 1 et 2 (Android) : le bloc « Aucun client « … » » (et, sur la console, la
// fiche chargée) était annoncé « occupé » par le lecteur d'écran. React réutilise la vue du squelette
// (`accessibilityState: { busy: true }`) pour le bloc qui le remplace, et Android ne remet pas l'état à zéro
// quand la propriété disparaît (BaseViewManager.setViewState). Le bloc qui remplace un squelette le DIT : busy false.
describe('RESA-FIN-APP (5) E-G15 — le bloc qui remplace le squelette n’est plus « occupé »', () => {
  it('recherche sans résultat : busy false, posé', async () => {
    const arbre = await monter();
    mockLecture = pages([]);
    await act(async () => {
      arbre.root.findAllByType(TextInput)[0].props.onChangeText('Dupont');
    });
    expect(parRepere(arbre, 'clients-recherche-vide')?.props.accessibilityState).toEqual({ busy: false });
  });
});
