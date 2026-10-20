import renderer, { act } from 'react-test-renderer';

import AdminComplexeList from '@/views/admin/AdminComplexeList';
import FicheComplexeConsole from '@/views/admin/components/FicheComplexeConsole';

import { RouteNames } from '@/navigation/routeNames';

import {
  dessins, enUnMot, lisibles, parRepere, pressable,
} from '@/testSupport/temoinComplexe';

// L'interrupteur des écrans du JOUEUR allumé : « Voir la page » n'existe que s'il l'est.
jest.mock('@/config/fonctionsMasquees', () => ({
  ...jest.requireActual('@/config/fonctionsMasquees'),
  COMPLEXES_JOUEUR: true,
}));

// RESA-L5B-2 (20/10/2026) — E-S01, LA CONSOLE DES COMPLEXES DU SUPERADMIN (planche ES01, plan
// :1806-1850, serveur RESA-L4 /superadmin/complexes) : la liste (onglets « À traiter (2) » ·
// « Tous » · « Suspendus », pastilles, « Rien à traiter. »), la fiche (identité, gérant et son
// compte, terrains et réservations, signalements, journal) et ses gestes : « Signalement traité »,
// « Marquer vérifié », « Suspendre » (motif obligatoire), « Réactiver », « Retirer » (définitif,
// réservations à venir annulées). Sur ordinateur, la fiche s'ouvre dans le volet de droite.

jest.setTimeout(30000);

let mockLargeur = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: mockLargeur,
  }),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));

/** @type {any[]} */
const mockListes = [];
let mockListe = /** @type {any} */ ({});
let mockFiche = /** @type {any} */ ({});
/** @type {any[]} */
const mockFiches = [];
const mockGeste = jest.fn();
// La liste lit par pages (« Voir plus ») : la première est `mockListe`, les suivantes ici.
/** @type {any[]} */
const mockPagesSuivantes = [];
let mockEncore = false;
const mockPageSuivante = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useComplexeDeLaConsole: (/** @type {string} */ complexeId) => {
    mockFiches.push(complexeId);
    return mockFiche;
  },
  useConsoleDesComplexes: (/** @type {string} */ onglet, /** @type {string} */ recherche) => {
    mockListes.push([onglet, recherche]);
    return mockListe;
  },
  useGesteDeLaConsole: () => ({ isPending: false, mutateAsync: mockGeste }),
  usePagesDeLaConsole: (/** @type {string} */ onglet, /** @type {string} */ recherche) => {
    mockListes.push([onglet, recherche]);
    return {
      ...mockListe,
      data: mockListe.data ? { pages: [mockListe.data, ...mockPagesSuivantes] } : undefined,
      fetchNextPage: mockPageSuivante,
      hasNextPage: mockEncore,
    };
  },
}));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
  };
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => (
  jest.requireActual('@/testSupport/temoinComplexe').ongletsDeTemoin()
));
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

const LISTE = {
  compteurs: { aTraiter: 2, suspendus: 0, tous: 3 },
  items: [
    {
      city: 'Montrivage',
      createdAt: '2026-10-13T08:00:00.000Z',
      documentId: 'cx-five',
      logo: null,
      name: 'Le Five de Montrivage',
      nouveau: true,
      signalementsATraiter: 2,
      status: 'actif',
    },
    {
      city: 'Valbrune',
      createdAt: '2026-10-12T08:00:00.000Z',
      documentId: 'cx-padel',
      logo: null,
      name: 'Padel Club Valbrune',
      nouveau: true,
      signalementsATraiter: 0,
      status: 'actif',
    },
  ],
  pagination: { page: 1, pageSize: 20, total: 2 },
};

const FICHE = {
  complexe: {
    city: 'Montrivage',
    createdAt: '2026-10-13T08:00:00.000Z',
    documentId: 'cx-five',
    logo: null,
    name: 'Le Five de Montrivage',
    slug: 'le-five-de-montrivage',
    status: 'actif',
    verified: false,
  },
  gerants: [{
    bloque: false, documentId: 'u-sofia', firstname: 'Sofia', lastname: 'Leroy',
  }],
  journal: [],
  reservations: { aVenir: 12, total: 164 },
  signalements: [
    {
      auteur: { documentId: 'u-noah', firstname: 'Noah', lastname: 'Roux' },
      createdAt: '2026-10-13T19:10:00.000Z',
      details: null,
      documentId: 's-1',
      motif: 'inexistant',
      motifLabel: 'Ce complexe n\'existe pas',
      status: 'a_traiter',
    },
    {
      auteur: { documentId: 'u-theo', firstname: 'Théo', lastname: 'Lenoir' },
      createdAt: '2026-10-13T20:40:00.000Z',
      details: null,
      documentId: 's-2',
      motif: 'informations-fausses',
      motifLabel: 'Informations fausses',
      status: 'traite',
    },
  ],
  terrains: [{ documentId: 't-1' }, { documentId: 't-2' }, { documentId: 't-3' }],
};

const monter = async (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  return arbre;
};

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  await act(async () => {
    await pressable(arbre, libelle).props.onPress();
  });
};

const ecrireLeMotif = async (/** @type {any} */ arbre, /** @type {string} */ motif) => {
  const saisie = arbre.root.find((/** @type {any} */ noeud) => (
    noeud.props?.accessibilityLabel === 'Motif' && typeof noeud.props?.onChangeText === 'function'
  ));
  await act(async () => {
    saisie.props.onChangeText(motif);
  });
};

/**
 * Le bouton de confirmation, dans sa boîte repérée (le bouton de l'app ne porte pas de repère).
 * @param {any} arbre - L'arbre.
 * @returns {any} Le bouton.
 */
const confirmer = (arbre) => parRepere(arbre, 'console-confirmer-geste').findAll(
  (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function' && noeud.props?.title,
)[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockLargeur = 390;
  mockListes.length = 0;
  mockFiches.length = 0;
  mockPagesSuivantes.length = 0;
  mockEncore = false;
  mockListe = { data: LISTE, isLoading: false, refetch: jest.fn() };
  mockFiche = { data: FICHE, isLoading: false, refetch: jest.fn() };
  mockGeste.mockResolvedValue({ data: {} });
});

// RESA-FIN-APP (20/10/2026) — tournée 2 (Android 16) : sur la fiche d'un complexe de la console,
// « voir le [compte] » et « Voir la [page] » perdaient leur dernier mot (lien gras dans une boîte
// qui épouse sa largeur). Dessinés en un seul mot (`texteInsecable`).
describe('RESA-FIN-APP (1) E-S01 — les liens de la fiche dessinés en un seul mot', () => {
  it('« voir le compte » et « Voir la page »', async () => {
    const arbre = await monter(<FicheComplexeConsole complexeId="cx-five" />);
    expect(dessins(arbre, 'voir le compte')).toEqual([enUnMot('voir le compte')]);
    expect(dessins(arbre, 'Voir la page')).toEqual([enUnMot('Voir la page')]);
  });
});

// RESA-FIN-APP (20/10/2026) — tournée 1 : la fiche chargée était annoncée « busy » (la vue du squelette réutilisée ;
// Android ne remet pas l'état à zéro quand la propriété disparaît). La fiche chargée le dit : busy false.
describe('RESA-FIN-APP (5) E-S01 — la fiche chargée n’est plus « occupée »', () => {
  it('« console-fiche » : busy false, posé', async () => {
    const arbre = await monter(<FicheComplexeConsole complexeId="cx-five" />);
    expect(parRepere(arbre, 'console-fiche')?.props.accessibilityState).toEqual({ busy: false });
  });
});
