import renderer, { act } from 'react-test-renderer';

import FriendlyMatchListContent from '../FriendlyMatchListContent';

// Filet du lot L4 (spec docs/SPEC_ONGLET_MATCHS_AMICAUX_2026_07_31.md, §4.2 et
// Q12) : la LISTE doit s'afficher pour un visiteur NON CONNECTE comme pour un
// entraineur ou un dirigeant, et seuls ces derniers voient les sous-onglets de
// gestion. C'est le « fini quand » du lot, verifie par un rendu reel.

const mockUseAuth = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
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

jest.mock('@/services/category/categoryQueries', () => ({ useGetCategories: () => ({ data: [] }) }));
jest.mock('@/services/level/levelQueries', () => ({ useGetLevels: () => ({ data: [] }) }));

jest.mock('@/utils/performance/searchPerformance', () => ({ markSearchPerf: jest.fn() }));
jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));

// La barre de recherche partagee n'est pas l'objet de ce test : la garder ferait
// dependre le filet du theme complet de composants tiers.
jest.mock('@/components/organisms/searchComponent/searchComponent', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="search-bar" /> };
});

// Chaines opaques volontairement non-hex : le contrat de theme interdit les
// litteraux hex hors allowlist, et un mock n'a pas besoin de vraies couleurs.
jest.mock('@/theme/colors', () => ({ withAlpha: (/** @type {any} */ color) => color }));
jest.mock('@/theme/themeContext', () => {
  // Echelles de style tolerantes : un composant enfant qui demande une valeur
  // d'espacement ou de police inattendue ne doit pas faire tomber le filet.
  /**
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

const AD = {
  candidateDates: [{ date: '2027-05-15' }],
  category: { name: 'U15' },
  city: 'Marseille',
  documentId: 'ad-1',
  format: '11v11',
  hostingPreference: 'BOTH',
  isActive: true,
  status: 'open',
  team: { club: { name: 'Club des Annonceurs' }, name: 'FC Annonceurs U15' },
};

/**
 * Rend la liste pour un utilisateur donne et rend l arbre produit.
 * @param {any} userData
 * @returns {Promise<any>}
 */
const renderFor = async (userData) => {
  mockUseAuth.mockReturnValue({ userData });
  let tree;
  await act(async () => {
    tree = renderer.create(<FriendlyMatchListContent />);
  });
  return tree;
};

/**
 * Tous les textes rendus, aplatis. On parcourt les enfants plutot que de
 * serialiser l'arbre : les props d'une FlatList sont circulaires.
 * @param {any} node
 * @returns {string[]}
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

/**
 * Le texte visible du rendu, en une seule chaine cherchable.
 * @param {any} tree
 * @returns {string}
 */
const allText = (tree) => collectText(tree.toJSON()).join(' | ');

describe('FriendlyMatchListContent — qui voit quoi (Q12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFriendlyMatchAds.mockResolvedValue({ data: [AD], meta: {} });
    mockGetMyFriendlyMatchAds.mockResolvedValue([]);
    mockGetMyFriendlyMatchApplications.mockResolvedValue([]);
  });

  it('affiche la liste a un VISITEUR NON CONNECTE, sans sous-onglets ni publication', async () => {
    const tree = await renderFor(undefined);
    const rendered = allText(tree);

    expect(mockGetFriendlyMatchAds).toHaveBeenCalled();
    expect(rendered).toContain('Trouver un adversaire');
    expect(rendered).toContain('Club des Annonceurs');
    // Reserve au staff : ni sous-onglets de gestion, ni bouton de publication.
    expect(rendered).not.toContain('Mes annonces');
    expect(rendered).not.toContain('+ Publier une annonce');
    // La carte le dit en toutes lettres au lieu de laisser un bouton mort.
    expect(rendered).toContain('Réservé aux entraîneurs et dirigeants');
  });

  it('affiche la liste ET les 3 sous-onglets a un ENTRAINEUR', async () => {
    const tree = await renderFor({ documentId: 'u-1', role: { name: 'Entraineur' } });
    const rendered = allText(tree);

    expect(rendered).toContain('Club des Annonceurs');
    expect(rendered).toContain('Annonces');
    expect(rendered).toContain('Mes annonces');
    expect(rendered).toContain('Mes propositions');
    expect(rendered).toContain('+ Publier une annonce');
    expect(rendered).toContain('Proposer un match');
  });

  it('affiche la liste ET les 3 sous-onglets a un DIRIGEANT', async () => {
    const tree = await renderFor({ documentId: 'u-2', role: { name: 'Dirigeant' } });
    const rendered = allText(tree);

    expect(rendered).toContain('Mes annonces');
    expect(rendered).toContain('Mes propositions');
    expect(rendered).toContain('+ Publier une annonce');
  });

  it('traite un JOUEUR connecte comme un visiteur : il lit, il ne repond pas', async () => {
    const tree = await renderFor({ documentId: 'u-3', role: { name: 'Joueur' } });
    const rendered = allText(tree);

    expect(rendered).toContain('Club des Annonceurs');
    expect(rendered).not.toContain('Mes propositions');
    expect(rendered).toContain('Réservé aux entraîneurs et dirigeants');
  });

  it('dit quoi faire quand il n y a aucune annonce, au lieu d une page vide', async () => {
    mockGetFriendlyMatchAds.mockResolvedValue({ data: [], meta: {} });
    const tree = await renderFor(undefined);

    expect(allText(tree)).toContain('Aucune annonce de match amical pour le moment.');
  });
});
