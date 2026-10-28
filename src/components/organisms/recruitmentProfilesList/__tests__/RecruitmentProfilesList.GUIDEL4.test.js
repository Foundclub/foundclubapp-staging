import { View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TourTarget from '@/components/molecules/tour/TourTarget';

import RecruitmentProfilesList from '../RecruitmentProfilesList';

// GUIDE-RECUL (28/10, lot L4, constat de FINITIONS-GUIDE) : petit écran
// (720x1440), mission 4, après défilement, le cadre de `search.filters` restait
// dessiné sur l'onglet « Candidatures » : le bouton était passé sous l'en-tête
// de l'écran, hors de la liste. Les ancres de la liste sont coupées à sa zone
// visible, comme celles des tunnels (`teamWizard.viewport`).

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ mercatoFilters: {} }, jest.fn()],
}));
jest.mock('@/theme/themeContext', () => {
  const deep = new Proxy(() => {}, {
    get: (target, prop) => {
      if (prop === Symbol.toPrimitive || prop === 'toString') return () => 'couleur';
      return deep;
    },
  });
  return { __esModule: true, default: () => deep };
});
jest.mock('@/domains/search/recruitmentFlow', () => ({
  getProfileFilterCount: () => 0,
  parametresDeRechercheDeProfils: () => ({}),
}));
let mockQuery;
jest.mock('@/services/search/searchQueries', () => ({ useSearchProfiles: () => mockQuery }));
jest.mock('@/services/search/searchService', () => ({ mapSearchPayload: (page) => page.data }));
jest.mock('@/components/atoms/loader/Loader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/organisms/filtersSheet/ProfileFiltersSheet', () => ({
  __esModule: true, default: () => null,
}));
jest.mock('@/components/molecules/mercatoCard/MercatoCard', () => {
  const { View: MockView } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ user }) => <MockView testID={`card.${user.documentId}`} />,
  };
});
jest.mock('@/components/organisms/searchComponent/searchComponent', () => {
  const { View: MockView } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <MockView testID="search-component" /> };
});

const query = (overrides) => ({
  data: { pages: [{ data: [{ documentId: 'u1' }, { documentId: 'u2' }], meta: {} }] },
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  isRefetching: false,
  refetch: jest.fn(),
  ...overrides,
});

const render = () => {
  let tree;
  act(() => { tree = renderer.create(<RecruitmentProfilesList />); });
  return tree;
};

const byTestId = (tree, id) => tree.root.findAll((node) => node.props.testID === id
  && node.type === View)[0];

/**
 * Ancres du guide qui contiennent ce nœud, de la plus proche à la plus lointaine.
 * @param {any} node - Nœud du rendu.
 * @returns {any[]} Ancres.
 */
const anchorsAbove = (node) => {
  const found = [];
  let { parent } = node;
  while (parent) {
    if (parent.type === TourTarget) found.push(parent.props);
    ({ parent } = parent);
  }
  return found;
};

beforeEach(() => {
  mockQuery = query();
});

describe('RecruitmentProfilesList — comportement actuel', () => {
  it('montre la recherche puis les profils, le premier ancré pour le guide', () => {
    const tree = render();
    expect(byTestId(tree, 'search-component')).toBeTruthy();
    expect(anchorsAbove(byTestId(tree, 'card.u1')).map((props) => props.id))
      .toContain('search.result.0');
    expect(anchorsAbove(byTestId(tree, 'card.u2')).map((props) => props.id))
      .not.toContain('search.result.0');
  });

  it('en chargement : ni recherche ni profils', () => {
    mockQuery = query({ isLoading: true });
    const tree = render();
    expect(byTestId(tree, 'search-component')).toBeUndefined();
    expect(byTestId(tree, 'card.u1')).toBeUndefined();
  });
});

describe('L4 — les ancres de la liste sont coupées à sa zone visible', () => {
  it('la recherche (bouton Filtrer) et la 1ʳᵉ carte sont dans une zone de découpe', () => {
    const tree = render();
    ['search-component', 'card.u1'].forEach((id) => {
      expect(anchorsAbove(byTestId(tree, id)).some((props) => props.clipChildren)).toBe(true);
    });
  });
});
