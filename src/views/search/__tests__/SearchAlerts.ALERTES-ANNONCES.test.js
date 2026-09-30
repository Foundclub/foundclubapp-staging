import renderer, { act } from 'react-test-renderer';

import { deleteSearchAlert, updateSearchAlert } from '@/services/searchAlert/searchAlertService';

// ALERTES-ANNONCES (30/09) — « GÉRER MES ALERTES » LISTE ET SUPPRIME AUSSI LES
// ALERTES D'ANNONCES.
//
// Décision d'Adel : « je veux que les joueurs soient prévenus [des annonces], même
// les entraîneurs ». Une alerte d'annonces (`type: 'recruitment'`, créée depuis
// Rechercher › Recrutement) doit se reconnaître, se relancer, se couper et se
// supprimer ici. Elle n'a PAS d'écran de modification (les écrans pleins
// `EventFilters` / `MercatoFilters` ne savent pas la lire) : le crayon disparaît,
// on la relance et on la recrée depuis la recherche.
//
// Harnais repris à l'identique de `SearchAlerts.ALERTES.test.js`.

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

/** L'alerte telle que le serveur la rend (filtres NORMALISÉS, filter-normalizer.ts). */
const ALERTE_ANNONCES = {
  documentId: 'al-ann',
  filters: {
    activityNames: ['Football'],
    audienceType: 'player',
    categoryIds: ['c-u17'],
    city: { label: 'Lyon', value: 'Lyon' },
  },
  isActive: true,
  label: 'Annonces · Football · Lyon',
  type: 'recruitment',
};

/**
 * Les boutons d'une icône donnée (crayon, poubelle).
 * @param {any} tree L'arbre.
 * @param {string} icone Le nom de l'icône.
 * @returns {any[]} Les boutons.
 */
const boutonsIcone = (tree, icone) => tree.root.findAll(
  (/** @type {any} */ n) => n.props?.icon === icone
    && typeof n.props?.onPress === 'function',
);

describe('ALERTES-ANNONCES — « Gérer mes alertes » connaît les alertes d annonces', () => {
  afterEach(() => {
    mockAuth.userData = { documentId: 'u-1', role: { name: 'Joueur' } };
  });

  it('l alerte d annonces se reconnaît : « Alerte annonces », son nom, sa ville', async () => {
    const tree = await monter([ALERTE_ANNONCES]);
    const texte = texteVisible(tree);
    expect(texte).toContain('Alerte annonces');
    expect(texte).not.toContain('Alerte événements');
    expect(texte).toContain('Annonces · Football · Lyon');
    expect(texte).toContain('Lyon');
  });

  it('« Rechercher » la relance dans Rechercher › Recrutement, avec ses filtres', async () => {
    const tree = await monter([ALERTE_ANNONCES]);
    await appuyerSur(tree, 'Rechercher');

    expect(mockDispatch).toHaveBeenCalledWith({
      payload: {
        category: ['c-u17'], city: 'Lyon', level: [], sport: 'Football',
      },
      type: 'SET_RECRUITMENT_AD_FILTERS',
    });
    expect(navigation.navigate).toHaveBeenCalledWith(
      'SearchRecruitment',
      { initialRecruitmentTab: 'annonces' },
    );
  });

  it('pour un entraîneur, elle s ouvre sur l onglet « opportunités » du staff', async () => {
    mockAuth.userData = { documentId: 'u-2', role: { name: 'Entraineur' } };
    const tree = await monter([ALERTE_ANNONCES]);
    await appuyerSur(tree, 'Rechercher');
    expect(navigation.navigate).toHaveBeenCalledWith(
      'SearchRecruitment',
      { initialRecruitmentTab: 'opportunites' },
    );
  });

  it('pas de crayon pour une alerte d annonces ; il reste pour les événements', async () => {
    // Aucun écran ne sait modifier une alerte d'annonces.
    const tree = await monter([ALERTE_ANNONCES, ALERTE_FOOT]);
    expect(boutonsIcone(tree, 'edit')).toHaveLength(1);
    expect(boutonsIcone(tree, 'trash')).toHaveLength(2);
  });

  it('LE TEMOIN : elle se supprime', async () => {
    const tree = await monter([ALERTE_ANNONCES]);
    await act(async () => { boutonsIcone(tree, 'trash')[0].props.onPress(); });
    await laisserFiler();
    await appuyerSur(tree, 'Supprimer');
    expect(deleteSearchAlert).toHaveBeenCalledWith('al-ann');
  });

  it('LE TEMOIN : elle se coupe et se rallume', async () => {
    const tree = await monter([ALERTE_ANNONCES]);
    const interrupteur = tree.root.findAll(
      (/** @type {any} */ n) => typeof n.props?.onValueChange === 'function',
    )[0];
    await act(async () => { await interrupteur.props.onValueChange(false); });
    expect(updateSearchAlert).toHaveBeenCalledWith('al-ann', { isActive: false });
  });
});
