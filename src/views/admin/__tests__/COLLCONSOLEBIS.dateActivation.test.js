import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  ADMIN_COLLECTIVITES_LIST_PAYLOAD,
  getAdminCollectivite,
} from '@/services/collectivite/collectiviteService';

import AdminCollectiviteList from '../AdminCollectiviteList';
import CollectiviteActivation from '../components/CollectiviteActivation';

// 🏛️ COLL-CONSOLE-BIS (03/10/2026), point 2 — « ACTIVÉE LE » (planche 13, le tableau du site) et
// « DEPUIS LE … » (planche 15, le bandeau d'une Ville active). ROUGE avant le lot : le serveur ne
// gardait aucune date, la console ne la demandait ni ne l'affichait.
//   - la liste et la fiche demandent `activatedAt` à l'explorateur ;
//   - le tableau du site a sa colonne « Activée le » : la date, ou « — » (une Ville activée
//     avant ce lot, ou inactive) ;
//   - le bandeau d'une Ville active commence par « Depuis le … » (« — » sans date).

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

const ACTIVEE_LE_1ER = '2026-10-01T10:00:00.000Z';
const VILLES = [
  {
    activatedAt: ACTIVEE_LE_1ER,
    clubs: [],
    documentId: 'ville-a',
    isActive: true,
    name: 'Ville d’Aix',
    type: 'commune',
  },
  {
    activatedAt: null,
    clubs: [],
    documentId: 'ville-b',
    isActive: true,
    name: 'Ville de Bram',
    type: 'commune',
  },
  {
    activatedAt: null,
    clubs: [],
    documentId: 'ville-c',
    isActive: false,
    name: 'Ville de Cassis',
    type: 'commune',
  },
];

beforeEach(() => {
  mockPost.mockReset();
  mockLargeur = 1280;
});

describe('COLL-CONSOLE-BIS — la date d activation, de la lecture à l écran', () => {
  it('la liste et la fiche demandent `activatedAt` à l explorateur', async () => {
    expect(ADMIN_COLLECTIVITES_LIST_PAYLOAD.fields).toContain('activatedAt');
    mockPost.mockResolvedValue({ data: { data: [] } });
    await getAdminCollectivite('ville-a');
    expect(mockPost.mock.calls[0][1].fields).toContain('activatedAt');
  });

  it('planche 13 : le tableau du site a sa colonne « Activée le » ; « — » sans date', async () => {
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
    expect(textes(arbre.root)).toContain('Activée le');
    expect(textes(ligne(arbre, 'ville-a'))).toContain('jeu 01/10/2026');
    expect(textes(ligne(arbre, 'ville-b'))).toContain('—');
    expect(textes(ligne(arbre, 'ville-c'))).toContain('—');
  });

  it('planche 15 : le bandeau d une Ville active commence par « Depuis le … »', async () => {
    const base = {
      clubs: [], clubsCount: 0, documentId: 'ville-a', isActive: true, name: 'Ville d’Aix',
    };
    const avecDate = await monter(
      <CollectiviteActivation collectivite={{ ...base, activatedAt: ACTIVEE_LE_1ER }} />,
    );
    expect(textes(avecDate.root).some((texte) => texte.startsWith('Depuis le jeu 01/10/2026 · ')))
      .toBe(true);
    const sansDate = await monter(
      <CollectiviteActivation collectivite={{ ...base, activatedAt: null }} />,
    );
    expect(textes(sansDate.root).some((texte) => texte.startsWith('Depuis le — · '))).toBe(true);
    const inactive = await monter(
      <CollectiviteActivation collectivite={{ ...base, activatedAt: null, isActive: false }} />,
    );
    expect(textes(inactive.root).some((texte) => texte.startsWith('Depuis'))).toBe(false);
  });
});
