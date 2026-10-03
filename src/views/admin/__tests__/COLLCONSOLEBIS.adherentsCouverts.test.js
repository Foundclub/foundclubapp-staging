import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { toAdminCollectiviteRow } from '@/domains/collectivite/collectiviteDisplay';

import AdminCollectiviteList from '../AdminCollectiviteList';

// 🏛️ COLL-CONSOLE-BIS (03/10/2026), point 3 — « ADHÉRENTS COUVERTS » (planche 13, le tableau du
// site) : la somme des membres des clubs rattachés, calculée par le serveur dans la lecture de la
// liste (admin COLL-CONSOLE-BIS (3)). ROUGE avant le lot : la colonne n'existait pas.
//   - la ligne lit `membersCount` (un nombre, ou null : compteur en panne, serveur ancien) ;
//   - le tableau a sa colonne « Adhérents couverts » : le nombre, ou « — » (jamais un faux 0).

const mockPost = jest.fn();
let mockLargeur = 1280;

jest.setTimeout(30000);

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(async () => ({ data: { data: [] } })),
    post: (/** @type {any[]} */ ...args) => mockPost(...args),
    put: jest.fn(),
  },
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 800, scale: 1, width: mockLargeur,
  }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SegmentedControlMock() { return null; },
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const attendre = async (/** @type {() => boolean} */ condition) => {
  const fin = Date.now() + 5000;
  while (!condition() && Date.now() < fin) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((suite) => { setTimeout(suite, 10); }); });
  }
};
const monter = async (/** @type {any} */ element) => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  });
  return arbre;
};
const ligne = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === `admin-collectivite-${id}`)[0];

const VILLES = [
  {
    clubs: [{ documentId: 'a' }, { documentId: 'b' }],
    documentId: 'ville-a',
    isActive: true,
    membersCount: 50,
    name: 'Ville d’Aix',
    type: 'commune',
  },
  {
    clubs: [],
    documentId: 'ville-b',
    isActive: false,
    membersCount: 0,
    name: 'Ville de Bram',
    type: 'commune',
  },
  {
    clubs: [{ documentId: 'c' }],
    documentId: 'ville-c',
    isActive: true,
    name: 'Ville de Cassis',
    type: 'commune',
  },
];

beforeEach(() => {
  mockPost.mockReset();
  mockLargeur = 1280;
});

describe('COLL-CONSOLE-BIS — les adhérents couverts, de la lecture au tableau', () => {
  it('la ligne lit le nombre du serveur ; sans nombre, null (jamais un faux 0)', () => {
    expect(toAdminCollectiviteRow(VILLES[0]).membersCount).toBe(50);
    expect(toAdminCollectiviteRow(VILLES[1]).membersCount).toBe(0);
    expect(toAdminCollectiviteRow(VILLES[2]).membersCount).toBeNull();
    expect(toAdminCollectiviteRow({ ...VILLES[0], membersCount: '12' }).membersCount).toBeNull();
  });

  it('planche 13 : la colonne « Adhérents couverts » du tableau ; « — » sans nombre', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: VILLES,
        meta: {
          pagination: {
            page: 1, pageCount: 1, pageSize: 100, total: 3,
          },
        },
      },
    });
    const arbre = await monter(<AdminCollectiviteList />);
    await attendre(() => Boolean(ligne(arbre, 'ville-a')));
    expect(textes(arbre.root)).toContain('Adhérents couverts');
    expect(textes(ligne(arbre, 'ville-a'))).toEqual(expect.arrayContaining(['2', '50']));
    expect(textes(ligne(arbre, 'ville-b'))).toEqual(expect.arrayContaining(['0']));
    expect(textes(ligne(arbre, 'ville-c'))).toEqual(expect.arrayContaining(['1', '—']));
  });
});
