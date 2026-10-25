import renderer, { act } from 'react-test-renderer';

import FriendlyMatchListContent from '../FriendlyMatchListContent';

// C07 / Q2-16 (d apres le prouveur hunt/Q2/prover-16) : le Loader
// remplacait la FlatList, dont l en-tete porte le champ de recherche, donc le
// clavier se fermait a chaque frappe ; et une reponse en retard ecrasait la
// plus recente.

const mockUseAuth = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

// Cette suite monte la VRAIE carte d'annonce dans une VRAIE FlatList — c'est
// voulu, c'est elle qu'on verifie. Le premier rendu coute ~4 s seul, mais frole
// les 5 s par defaut quand toute la base de tests tourne en parallele : mesure
// du 31/07, `--maxWorkers=4` passe, la valeur par defaut echoue. Le plafond est
// donc explicite plutot que subi — un filet qui tombe une fois sur deux ne
// protege rien, et personne ne saurait dire si c'est le code ou la machine.
jest.setTimeout(30000);

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

// react-native-reanimated est publie en ESM pur et n'est pas dans
// transformIgnorePatterns (jest.config.js) : sans ce mock, importer la carte
// suffit a faire tomber la suite. On le remplace par une View inerte pour
// garder la VRAIE carte dans le rendu — c'est elle qu'on veut verifier.
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: () => ({}),
    useSharedValue: (/** @type {any} */ value) => ({ value }),
    withTiming: (/** @type {any} */ value) => value,
  };
});

const mockGetFriendlyMatchAds = jest.fn();
const mockGetMyFriendlyMatchAds = jest.fn();
const mockGetMyFriendlyMatchApplications = jest.fn();
jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  getFriendlyMatchAds: (/** @type {any} */ params) => mockGetFriendlyMatchAds(params),
  getMyFriendlyMatchAds: (/** @type {any} */ params) => mockGetMyFriendlyMatchAds(params),
  getMyFriendlyMatchApplications: (
    /** @type {any} */ params,
  ) => mockGetMyFriendlyMatchApplications(params),
}));

jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [] }),
}));
jest.mock('@/services/level/levelQueries', () => ({ useGetLevels: () => ({ data: [] }) }));

jest.mock('@/utils/performance/searchPerformance', () => ({ markSearchPerf: jest.fn() }));
jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));

// La barre de recherche partagee n'est pas l'objet de ce test : la garder ferait
// dependre le filet du theme complet de composants tiers.

// Chaines opaques volontairement non-hex : le contrat de theme interdit les
// litteraux hex hors allowlist, et un mock n'a pas besoin de vraies couleurs.
jest.mock('@/theme/colors', () => ({ withAlpha: (/** @type {any} */ color) => color }));
jest.mock('@/theme/themeContext', () => {
  // Echelles de style tolerantes : un composant enfant qui demande une valeur
  // d'espacement ou de police inattendue ne doit pas faire tomber le filet.
  /**
   * Une echelle qui rend toujours une echelle.
   * @returns {any}
   */
  const anyScale = () => new Proxy({}, {
    get: (/** @type {any} */ _target, /** @type {any} */ key) => (
      typeof key === 'symbol' ? undefined : anyScale()
    ),
  });

  return {
    __esModule: true,
    default: () => ({
      Alignments: anyScale(),
      ApplicationStyle: anyScale(),
      Colors: {
        neutral00: 'encre-claire',
        neutral100: 'neutre-100',
        neutral200: 'neutre-200',
        neutral300: 'neutre-300',
        neutral500: 'neutre-500',
        neutral900: 'encre-sombre',
        primary100: 'primaire-100',
        primary500: 'couleur-primaire',
        primary700: 'couleur-surface',
        primary900: 'couleur-fond',
        transparent: 'transparent',
      },
      Fonts: anyScale(),
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

// Barre de recherche doublure : compte ses montages et expose handleSearchField.
let mockMounts = 0;
/** @type {any} */
let mockHandler = null;
jest.mock('@/components/organisms/searchComponent/searchComponent', () => {
  // eslint-disable-next-line global-require
  const { useEffect: mockUseEffect } = require('react');
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: function SearchBarMock(/** @type {any} */ props) {
      mockUseEffect(() => { mockMounts += 1; }, []);
      mockHandler = props.handleSearchField;
      return <View testID="search-bar" />;
    },
  };
});

/**
 * Une annonce ouverte, nommee d apres sa ville.
 * @param {string} id
 * @param {string} city
 * @returns {any}
 */
const ad = (id, city) => ({
  candidateDates: [],
  category: { name: 'U15' },
  city,
  documentId: id,
  format: '11v11',
  hostingPreference: 'BOTH',
  isActive: true,
  status: 'open',
  team: { club: { name: `Club ${city}` }, name: `Equipe ${city}` },
});

/**
 * Une promesse et sa resolution, pour choisir l ordre des reponses.
 * @returns {{ p: Promise<any>, r: (value: any) => void }}
 */
const deferred = () => {
  /** @type {any} */
  let r;
  const p = new Promise((res) => { r = res; });
  return { p, r };
};

/**
 * La barre de recherche est-elle montee ?
 * @param {any} tree
 * @returns {boolean}
 */
const hasBar = (tree) => tree.root.findAll((/** @type {any} */ n) => (
  n.props?.testID === 'search-bar' && typeof n.type !== 'string'
)).length > 0;

describe('FriendlyMatchListContent — recherche (Q2-16)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFriendlyMatchAds.mockReset();
    mockMounts = 0;
    mockHandler = null;
    mockUseAuth.mockReturnValue({ userData: undefined });
  });

  it('la barre de recherche reste montee pendant une recherche', async () => {
    const pending = deferred();
    mockGetFriendlyMatchAds.mockResolvedValueOnce({ data: [ad('a0', 'Paris')], meta: {} });
    /** @type {any} */
    let tree;
    await act(async () => { tree = renderer.create(<FriendlyMatchListContent />); });
    expect(hasBar(tree)).toBe(true);
    mockGetFriendlyMatchAds.mockImplementation(({ search }) => (
      search === 'ly' ? pending.p : Promise.resolve({ data: [], meta: {} })
    ));
    await act(async () => { mockHandler('ly'); });
    const barDuring = hasBar(tree);
    await act(async () => { pending.r({ data: [ad('a1', 'Lyon')], meta: {} }); });
    expect(barDuring).toBe(true);
    expect(mockMounts).toBe(1);
  }, 90000);

  it('une reponse en retard (ly) n ecrase pas la plus recente (lyon)', async () => {
    mockGetFriendlyMatchAds.mockResolvedValueOnce({ data: [], meta: {} });
    /** @type {any} */
    let tree;
    await act(async () => { tree = renderer.create(<FriendlyMatchListContent />); });
    const slowLy = deferred();
    const fastLyon = deferred();
    mockGetFriendlyMatchAds.mockImplementation(({ search }) => (
      search === 'ly' ? slowLy.p : fastLyon.p
    ));
    const setSearch = mockHandler;
    await act(async () => { setSearch('ly'); });
    await act(async () => { setSearch('lyon'); });
    await act(async () => { fastLyon.r({ data: [ad('lyon-1', 'LyonOK')], meta: {} }); });
    await act(async () => { slowLy.r({ data: [ad('ly-1', 'LyStale')], meta: {} }); });
    const txt = tree.root.findAll((/** @type {any} */ n) => typeof n.props?.children === 'string')
      .map((/** @type {any} */ n) => n.props.children).join('|');
    expect(txt).toContain('LyonOK');
    expect(txt).not.toContain('LyStale');
  }, 90000);
});
