import renderer, { act } from 'react-test-renderer';

import ReserverComplexe from '@/views/reserverTerrain/ReserverComplexe';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';

// T-COMPLEXE (14/11/2026, décision d'Adel D13 B) — E-P02, la fiche publique du complexe : la
// section « Tournois et événements » liste les événements publics à venir d'un terrain du
// complexe (`GET /public-complexes/:slug/evenements`), chacun ouvre sa fiche (EventDetails).
// Sans événement : aucune section, la fiche est celle d'avant. Rien n'est retiré (identité,
// terrains, infos, partenaires).

jest.setTimeout(30000);

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({ slug: 'le-five-de-montrivage' });
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

const mockRelation = /** @type {any} */ ({});
const mockLireLaRelation = jest.fn().mockImplementation(() => mockRelation);
let mockUtilisateur = /** @type {any} */ (null);
let mockPartenaires = /** @type {any} */ ({});
let mockEvenements = /** @type {any} */ ({ data: [] });
let mockSurOrdinateur = false;
const mockAjouter = jest.fn();
const mockRetirer = jest.fn();
const mockSignaler = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAjouterAuxFavoris: () => ({ isPending: false, mutateAsync: mockAjouter }),
  // RESA-JOUEUR (D51) : les annonces du complexe (aucune ici).
  useAnnoncesOuvertes: () => ({ data: [] }),
  useComplexePublic: () => ({
    data: jest.requireActual('@/testSupport/temoinReserver').complexePublic(),
  }),
  useCreneauxDuJour: () => ({ data: { slots: [] } }),
  useEvenementsPublics: () => mockEvenements,
  useMaRelationAuComplexe: (/** @type {any[]} */ ...args) => mockLireLaRelation(...args),
  usePartenairesPublics: () => mockPartenaires,
  useRetirerDesFavoris: () => ({ isPending: false, mutateAsync: mockRetirer }),
  useSignalerUnComplexe: () => ({ isPending: false, mutateAsync: mockSignaler }),
  useTerrainsPublics: () => ({
    data: [jest.requireActual('@/testSupport/temoinReserver').terrainPublic()],
  }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUtilisateur }),
}));
jest.mock('@/platform/maps/externalMap', () => ({ openExternalMap: jest.fn() }));
jest.mock('@/views/search/searchRouteHelpers', () => ({ navigateToSearchHub: jest.fn() }));
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockSurOrdinateur }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => (
  function FauxSegments(/** @type {any} */ { onChange, options, value }) {
    const { Text: Texte, TouchableOpacity: Touche, View: Vue } = jest.requireActual('react-native');
    return (
      <Vue>
        {options.map((/** @type {any} */ option) => (
          <Touche
            accessibilityState={{ selected: option.value === value }}
            key={option.value}
            onPress={() => onChange(option.value)}
          >
            <Texte>{option.label}</Texte>
          </Touche>
        ))}
      </Vue>
    );
  }
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

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverComplexe />);
  });
  return arbre;
};

const EVENEMENTS = [
  {
    date: '2026-12-19T18:00:00.000Z',
    documentId: 'evt-ar',
    facility: 'Terrain 1',
    name: 'FoundClub x AR Soccer',
    startTime: '19:00',
    type: 'Tournoi',
  },
  {
    date: '2026-12-05T18:00:00.000Z',
    documentId: 'evt-jeudi',
    facility: null,
    name: 'Tournoi du jeudi',
    startTime: null,
    type: 'Tournoi',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { slug: 'le-five-de-montrivage' };
  mockUtilisateur = null;
  mockPartenaires = { data: [] };
  mockEvenements = { data: [] };
  mockSurOrdinateur = false;
});

/**
 * Les nœuds d'un repère (un nœud composé et son nœud hôte comptent une fois, par libellé).
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère.
 * @returns {any[]} Les nœuds.
 */
const touches = (arbre, testID) => [...new Map(arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.props?.onPress === 'function')
  .map((/** @type {any} */ n) => [n.props.accessibilityLabel, n])).values()];

const MISES_EN_PAGE = [['téléphone', false], ['ordinateur', true]];

describe.each(MISES_EN_PAGE)('T-COMPLEXE, fiche du complexe (%s)', (_nom, ordinateur) => {
  test('la section liste les événements publics, chacun ouvre sa fiche', async () => {
    mockSurOrdinateur = ordinateur;
    mockEvenements = { data: EVENEMENTS };
    const arbre = await monter();
    const section = parRepere(arbre, 'complexe-evenements');
    const textes = lisibles({ root: section });
    expect(textes).toEqual(expect.arrayContaining([
      'Tournois et événements', 'FoundClub x AR Soccer', 'Tournoi du jeudi',
    ]));
    expect(textes.join(' | ')).toMatch(/19 décembre · 19:00 · Terrain 1/);
    const lignes = touches(arbre, 'complexe-evenement');
    expect(lignes).toHaveLength(2);
    expect(lignes[0].props.accessibilityLabel).toBe('Voir FoundClub x AR Soccer');
    await act(async () => { lignes[0].props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.EventDetails, { eventId: 'evt-ar' });
    // Rien n'est retiré : l'identité du complexe est toujours là.
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'LE FIVE DE MONTRIVAGE', 'Montrivage',
    ]));
  });

  test('sans événement : aucune section', async () => {
    mockSurOrdinateur = ordinateur;
    const arbre = await monter();
    const sections = arbre.root
      .findAll((/** @type {any} */ n) => n.props?.testID === 'complexe-evenements');
    expect(sections).toHaveLength(0);
  });
});
