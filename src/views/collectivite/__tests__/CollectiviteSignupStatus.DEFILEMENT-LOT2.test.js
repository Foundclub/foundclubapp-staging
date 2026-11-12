/* eslint-disable max-len -- témoin : les doublures et les assertions se lisent mieux sur une ligne */
import {
  Image, Platform, ScrollView, StyleSheet, Text,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteSignupStatus from '../CollectiviteSignupStatus';

// DEFILEMENT-LOT2 (11/11/2026, décision d'Adel « 244- A », relevé D03b ligne 4). Mairie en
// attente : sur iPhone, le logo et le bouton du profil restaient figés en haut (~56 px) ; en bas,
// « Compris » (état « Demande envoyée ») + 24 + la barre du téléphone (~106 px).
// Règle C : le haut défile avec le contenu. Règle B : « Compris » reste visible, dans un pied
// flottant, toujours hors de la zone qui défile (planche FIN14, `pied-fixe`). Règle A : le cadre
// ne garde rien en bas. Le site n'a ni logo ni profil ici, et garde son pied (planche FIN14).

/** @type {any[]} */
const mockCadres = [];
/** @type {any} */
let mockDemandes;
/** @type {any} */
let mockVilles;
/** @type {any} */
let mockParams;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), reset: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => String(
      typeof repli === 'string' ? repli : cle,
    ).replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? '')),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: { logo: 7 },
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/services/collectivite/collectiviteService', () => ({ cancelManagerRequest: jest.fn() }));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useMyCollectivites: () => mockVilles,
  useMyManagerRequests: () => mockDemandes,
}));
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock(/** @type {any} */ props) {
  mockCadres.push(props);
  return props.children;
});
// iPhone : barre du téléphone 34 + marge 12.
jest.mock('@/components/templates/useRetraitBasDuDefilement', () => ({ __esModule: true, default: () => 46 }));
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/molecules/profileButton/ProfileButton', () => function ProfileButtonMock() {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return <TexteRN>profil</TexteRN>;
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(PressableRN, { onPress: props.onPress }, reactActuel.createElement(TexteRN, null, props.title));
  };
});

const EN_ATTENTE = {
  collectivite: { documentId: 'ville-montrivage', name: 'Ville de Montrivage', type: 'commune' },
  createdAt: '2026-10-01T09:00:00.000Z',
  decidedAt: null,
  documentId: 'dm-1',
  refusalReason: null,
  status: 'pending',
};

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

const monter = async () => {
  mockCadres.length = 0;
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<CollectiviteSignupStatus />); });
  return { arbre, defilement: arbre.root.findByType(ScrollView), racine: arbre.root };
};

beforeEach(() => {
  mockParams = { justSent: true };
  mockDemandes = { data: [EN_ATTENTE], isLoading: false, refetch: jest.fn() };
  mockVilles = { data: [], isLoading: false, refetch: jest.fn() };
});

describe('DEFILEMENT-LOT2 — CollectiviteSignupStatus : tout défile, sauf « Compris »', () => {
  const osAvant = Platform.OS;
  afterEach(() => { Platform.OS = osAvant; });

  test('C : le logo et le bouton du profil défilent avec le contenu', async () => {
    const { defilement, racine } = await monter();
    expect(sous(racine.findAll((/** @type {any} */ n) => n.type === Image && n.props.accessibilityLabel === 'FoundClub')[0], defilement)).toBe(true);
    expect(sous(parTexte(racine, 'profil'), defilement)).toBe(true);
    expect(sous(parTexte(racine, 'Demande envoyée'), defilement)).toBe(true);
  });

  test('B : « Compris » flotte dans le pied, hors du défilement, au bord bas', async () => {
    const { defilement, racine } = await monter();
    const pied = parId(racine, 'collectivite-demande-envoyee-pied');
    expect(sous(parTexte(racine, 'Compris'), pied)).toBe(true);
    expect(sous(pied, defilement)).toBe(false);
    const style = StyleSheet.flatten(pied.props.style);
    expect(style).toEqual(expect.objectContaining({ bottom: 0, position: 'absolute' }));
    expect(style.paddingBottom).toBeGreaterThanOrEqual(46);
  });

  test('A : le cadre ne garde rien en bas ; la fin du défilement laisse la place du pied', async () => {
    const { arbre, racine } = await monter();
    expect(mockCadres.at(-1).bottomInsetMode).toBe('scroll-edge');
    act(() => {
      parId(racine, 'collectivite-demande-envoyee-pied').props.onLayout({ nativeEvent: { layout: { height: 106 } } });
    });
    const fin = StyleSheet.flatten(arbre.root.findByType(ScrollView).props.contentContainerStyle);
    expect(fin.paddingBottom).toBeGreaterThanOrEqual(106 + 12);
  });

  test('en attente (sans pied) : la fin du défilement garde 24 + le retrait commun', async () => {
    mockParams = {};
    const { defilement, racine } = await monter();
    expect(mockCadres.at(-1).bottomInsetMode).toBe('scroll-edge');
    expect(parId(racine, 'collectivite-demande-envoyee-pied')).toBeUndefined();
    expect(StyleSheet.flatten(defilement.props.contentContainerStyle).paddingBottom).toBe(24 + 46);
  });

  test('site : « Compris » garde son pied hors du défilement (planche FIN14)', async () => {
    Platform.OS = 'web';
    const { defilement, racine } = await monter();
    const pied = parId(racine, 'collectivite-demande-envoyee-pied');
    expect(sous(parTexte(racine, 'Compris'), pied)).toBe(true);
    expect(sous(pied, defilement)).toBe(false);
  });
});
