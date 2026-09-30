import renderer, { act } from 'react-test-renderer';

// ALERTES (audit V1, A20) — « GÉRER MES ALERTES » (Mon compte).
//
// E6 : cet écran n'avait AUCUN test. Le premier bloc caractérise ce qu'il fait
// déjà (liste, état vide, création, relance d'une recherche) : il passe sur le
// code d'avant le lot. Le second porte l'élément 3 de la décision d'Adel : le
// guide « comment créer une alerte », accessible à chaque fois — y compris ici,
// là où l'on vient justement gérer ses alertes.

jest.setTimeout(30000);

const mockDispatch = jest.fn();
const mockContexte = [{}, mockDispatch];
const mockAuth = { userData: { documentId: 'u-1', role: { name: 'Joueur' } } };
const mockAlertes = { valeur: /** @type {any[]} */ ([]) };

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  const theme = {
    Alignments,
    ApplicationStyle: generateApplicationStyle(Colors),
    Colors,
    Fonts: generateFonts(Colors),
    Images: new Proxy({}, { get: () => 1 }),
    scheme: 'dark',
    Spaces,
  };
  return { __esModule: true, default: () => theme };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => mockContexte,
}));

jest.mock('@/services/searchAlert/searchAlertService', () => ({
  deleteSearchAlert: jest.fn(() => Promise.resolve({})),
  getSearchAlerts: jest.fn(() => Promise.resolve({ data: mockAlertes.valeur })),
  updateSearchAlert: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      children, footerComponent, headerComponent, isVisible,
    }) => (
      isVisible ? (
        <View>
          {headerComponent}
          {children}
          {footerComponent}
        </View>
      ) : null
    ),
  };
});

const SearchAlerts = require('../SearchAlerts').default;

const ALERTE_FOOT = {
  documentId: 'al-1',
  filters: {
    activityIds: ['a-foot'],
    city: { label: 'Montrivage', value: '5.37|43.29' },
    radius: 20,
  },
  isActive: true,
  label: 'Football · Montrivage',
  type: 'event',
};

/**
 * Ramasse les chaînes d'un arbre rendu.
 * @param {any} node Le noeud.
 * @returns {string[]} Ses chaînes.
 */
const collecterTexte = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collecterTexte);
  return collecterTexte(node.children);
};
const texteVisible = (/** @type {any} */ tree) => collecterTexte(tree.toJSON()).join(' | ');

/**
 * Recolle le texte d'un noeud et de ses descendants.
 * @param {any} node Le noeud.
 * @returns {string} Son texte recollé.
 */
const texteDuNoeud = (node) => {
  if (typeof node === 'string') return node;
  if (!node || !Array.isArray(node.children)) return '';
  return node.children.map(texteDuNoeud).join('');
};

const laisserFiler = async () => {
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
};

/**
 * Appuie sur le premier élément pressable qui porte exactement ce libellé.
 * @param {any} tree L'arbre.
 * @param {string} libelle Le texte du bouton.
 */
const appuyerSur = async (tree, libelle) => {
  const cibles = tree.root.findAll(
    (/** @type {any} */ node) => (
      typeof node.props?.onPress === 'function' && texteDuNoeud(node).trim() === libelle
    ),
    { deep: true },
  );
  if (cibles.length === 0) throw new Error(`Aucun bouton « ${libelle} »`);
  await act(async () => { await cibles[0].props.onPress(); });
  await laisserFiler();
};

/** @type {any} */
let monte = null;
const navigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };

const monter = async (/** @type {any[]} */ alertes) => {
  mockAlertes.valeur = alertes;
  await act(async () => {
    monte = renderer.create(<SearchAlerts navigation={navigation} />);
  });
  await laisserFiler();
  return monte;
};

beforeEach(() => {
  navigation.navigate.mockClear();
  mockDispatch.mockClear();
});

afterEach(async () => {
  if (monte) await act(async () => { monte.unmount(); });
  monte = null;
});

describe('E6 — « Gérer mes alertes » tel qu il était (caractérisation)', () => {
  it('liste une alerte : son type, son nom, sa ville et son rayon', async () => {
    const tree = await monter([ALERTE_FOOT]);
    const texte = texteVisible(tree);

    expect(texte).toContain('Mes Alertes');
    expect(texte).toContain('Alerte événements');
    expect(texte).toContain('Football · Montrivage');
    expect(texte).toContain('Montrivage • 20km');
  });

  it('sans alerte, l état vide renvoie vers les filtres de recherche', async () => {
    const tree = await monter([]);
    expect(texteVisible(tree)).toContain('Crée une alerte depuis les filtres de recherche.');
  });

  it('pour un joueur, « Créer une alerte » ouvre l écran d alerte des événements', async () => {
    const tree = await monter([]);
    await appuyerSur(tree, 'Créer une alerte');
    expect(navigation.navigate).toHaveBeenCalledWith('EventFilters', { createAlertMode: true });
  });

  it('« Rechercher » relance la recherche de l alerte dans Rechercher › Événement', async () => {
    const tree = await monter([ALERTE_FOOT]);
    await appuyerSur(tree, 'Rechercher');

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ activity: ['a-foot'] }),
      type: 'SET_EVENT_FILTERS',
    }));
    expect(navigation.navigate).toHaveBeenCalledWith('SearchEvents');
  });
});

describe('A20.3 — le guide est aussi là où l on gère ses alertes', () => {
  it('« Comment créer une alerte ? » ouvre le guide, « J ai compris » le ferme', async () => {
    const tree = await monter([]);
    expect(texteVisible(tree)).not.toContain('Choisis tes critères');

    await appuyerSur(tree, 'Comment créer une alerte ?');

    const texte = texteVisible(tree);
    expect(texte).toContain('Choisis tes critères');
    expect(texte).toContain('Touche ★ ou « Créer l\'alerte »');
    expect(texte).toContain('Reçois une notification');

    await appuyerSur(tree, 'J\'ai compris');
    expect(texteVisible(tree)).not.toContain('Choisis tes critères');
  });

  it('il reste accessible quand la liste est pleine', async () => {
    const tree = await monter([ALERTE_FOOT]);
    await appuyerSur(tree, 'Comment créer une alerte ?');
    expect(texteVisible(tree)).toContain('Choisis tes critères');
  });
});
