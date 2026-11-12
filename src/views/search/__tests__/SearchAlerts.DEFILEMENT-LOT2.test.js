/* eslint-disable max-len -- témoin : les doublures et les assertions se lisent mieux sur une ligne */
import {
  FlatList, Platform, StyleSheet, Text,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

// DEFILEMENT-LOT2 (11/11/2026, décision d'Adel « 244- A », relevé D03b ligne 2). Sur iPhone, le
// titre « Mes Alertes » et le lien du guide restaient figés en haut (~130 px) ; en bas, le bouton
// « Créer une alerte » était posé sur la liste, plus la barre du téléphone (~114 px).
// Règle C : le haut défile avec la liste. Règle B : « Créer une alerte » reste visible dans un
// pied flottant (PiedFlottant). Règle A : le cadre ne garde rien en bas. Sur le site
// (REPRISE-PLACE, 01/11), le pied vient au bout du défilement.

jest.setTimeout(30000);

/** @type {any[]} */
const mockCadres = [];
const mockAlertes = { enAttente: false, valeur: /** @type {any[]} */ ([]) };

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const Colors = jest.requireActual('@/theme/colors').default();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
    Colors,
    Fonts: jest.requireActual('@/theme/fonts').default(Colors),
    Images: new Proxy({}, { get: () => 1 }),
    scheme: 'dark',
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'u-1', role: { name: 'Joueur' } } }),
}));
jest.mock('@/store/appContext', () => ({ useAppContext: () => [{}, jest.fn()] }));
jest.mock('@/services/searchAlert/searchAlertService', () => ({
  deleteSearchAlert: jest.fn(() => Promise.resolve({})),
  getSearchAlerts: jest.fn(() => (mockAlertes.enAttente
    ? new Promise(() => {})
    : Promise.resolve({ data: mockAlertes.valeur }))),
  updateSearchAlert: jest.fn(() => Promise.resolve({})),
}));
jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockCadres.push(props);
      return <View>{props.children}</View>;
    },
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => ({
  __esModule: true,
  default: () => null,
}));
// iPhone : barre du téléphone 34 + marge 12.
jest.mock('@/components/templates/useRetraitBasDuDefilement', () => ({ __esModule: true, default: () => 46 }));

const SearchAlerts = require('../SearchAlerts').default;

const ALERTE = {
  documentId: 'al-1',
  filters: { radius: 20 },
  isActive: true,
  label: 'Football · Montrivage',
  type: 'event',
};
const TITRE = 'Mes Alertes';
const GUIDE = 'Comment créer une alerte ?';
const CREER = 'Créer une alerte';

const texteDe = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(texteDe).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  return String(enfants);
};
const parTexte = (/** @type {any} */ racine, /** @type {string} */ texte) => racine
  .findAll((/** @type {any} */ n) => n.type === Text && texteDe(n.props.children) === texte)[0];
// Un composant et sa vue portent le même testID : on garde le plus profond (la vue).
const parId = (/** @type {any} */ racine, /** @type {string} */ id) => racine
  .findAll((/** @type {any} */ n) => n.props?.testID === id).at(-1);
const sous = (/** @type {any} */ noeud, /** @type {any} */ parent) => {
  if (!noeud || !parent) throw new Error('élément introuvable à l écran');
  let n = noeud?.parent;
  while (n) {
    if (n === parent) return true;
    n = n.parent;
  }
  return false;
};

const monter = async (/** @type {any[]} */ alertes = [ALERTE]) => {
  mockCadres.length = 0;
  mockAlertes.valeur = alertes;
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<SearchAlerts navigation={/** @type {any} */ ({ navigate: jest.fn() })} />);
  });
  await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
  return { arbre, defilement: arbre.root.findByType(FlatList), racine: arbre.root };
};

describe('DEFILEMENT-LOT2 — SearchAlerts : tout défile, sauf « Créer une alerte »', () => {
  const osAvant = Platform.OS;
  afterEach(() => {
    Platform.OS = osAvant;
    mockAlertes.enAttente = false;
  });

  test('C : le titre et le lien du guide défilent avec la liste', async () => {
    const { defilement, racine } = await monter();
    expect(sous(parTexte(racine, TITRE), defilement)).toBe(true);
    expect(sous(parTexte(racine, GUIDE), defilement)).toBe(true);
  });

  test('C : liste vide, le titre et le message du vide restent tous les deux', async () => {
    const { defilement, racine } = await monter([]);
    expect(sous(parTexte(racine, TITRE), defilement)).toBe(true);
    expect(racine.findAll((/** @type {any} */ n) => n.type === Text
      && texteDe(n.props.children).startsWith('Aucune alerte enregistrée.')).length).toBe(1);
  });

  test('pendant le chargement, le titre reste affiché', async () => {
    mockAlertes.enAttente = true;
    mockCadres.length = 0;
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<SearchAlerts navigation={/** @type {any} */ ({ navigate: jest.fn() })} />);
    });
    expect(parTexte(arbre.root, TITRE)).toBeTruthy();
    expect(parTexte(arbre.root, CREER)).toBeTruthy();
  });

  test('B : « Créer une alerte » flotte dans le pied, hors du défilement, au bord bas', async () => {
    const { defilement, racine } = await monter();
    const pied = parId(racine, 'search-alerts-pied');
    expect(sous(parTexte(racine, CREER), pied)).toBe(true);
    expect(sous(pied, defilement)).toBe(false);
    const style = StyleSheet.flatten(pied.props.style);
    expect(style).toEqual(expect.objectContaining({ bottom: 0, position: 'absolute' }));
    expect(style.paddingBottom).toBeGreaterThanOrEqual(46);
  });

  test('A : le cadre ne garde rien en bas ; la fin de la liste laisse la place du pied', async () => {
    const { arbre, racine } = await monter();
    expect(mockCadres.at(-1).bottomInsetMode).toBe('scroll-edge');
    act(() => {
      parId(racine, 'search-alerts-pied').props.onLayout({ nativeEvent: { layout: { height: 110 } } });
    });
    const fin = StyleSheet.flatten(arbre.root.findByType(FlatList).props.contentContainerStyle);
    expect(fin.paddingBottom).toBeGreaterThanOrEqual(110 + 12);
  });

  test('site : le pied vient au bout du défilement (REPRISE-PLACE)', async () => {
    Platform.OS = 'web';
    const { defilement, racine } = await monter();
    expect(sous(parId(racine, 'search-alerts-pied'), defilement)).toBe(true);
    expect(sous(parTexte(racine, CREER), defilement)).toBe(true);
  });
});
