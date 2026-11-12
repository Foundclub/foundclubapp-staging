/* eslint-disable max-len -- témoin : les doublures et les assertions se lisent mieux sur une ligne */
import {
  Platform, ScrollView, StyleSheet, Text,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ReserverVeille from '@/views/reserverTerrain/ReserverVeille';

import { maReservation } from '@/testSupport/temoinReserver';

// DEFILEMENT-LOT2 (11/11/2026, décision d'Adel « 244- A », relevé D03b ligne 3). « Demain, tu
// joues ? » : sur iPhone, le pied de deux boutons restait hors du défilement, au-dessus d'une
// bande de 46 px gardée par le cadre (`screen`), ~160 px figés.
// Règle B : « Je confirme », la réponse que l'écran attend, reste visible dans un pied flottant ;
// « J'annule » et « Voir ma réservation » viennent au bout du défilement. Règle A : le cadre ne
// garde rien en bas. Un lien seul (états déjà répondus) n'a pas de fond : il vient au bout du
// défilement, sans flotter. Sur le site (REPRISE-PLACE, 01/11), tout vient au bout du défilement.

/** @type {any[]} */
const mockCadres = [];
let mockLecture = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), replace: jest.fn() }),
  useRoute: () => ({ params: { reservationId: 'r-1' } }),
}));
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useMaReservation: () => mockLecture,
  useRepondreALaVeille: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/navigation/useBottomDockLayout', () => () => ({ dockClearance: 0 }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ props) {
    mockCadres.push(props);
    return props.children;
  }
));
// iPhone : barre du téléphone 34 + marge 12.
jest.mock('@/components/templates/useRetraitBasDuDefilement', () => ({ __esModule: true, default: () => 46 }));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const lue = (/** @type {Record<string, any>} */ autres = {}) => ({
  data: maReservation({
    canAnswerDayBefore: true,
    cancellableUntil: '2026-10-16T14:00:00.000Z',
    dayBeforeAskedAt: '2026-10-15T16:00:00.000Z',
    dayBeforeConfirmedAt: null,
    ...autres,
  }),
  error: null,
  isLoading: false,
  refetch: jest.fn(),
});

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
  await act(async () => {
    arbre = renderer.create(<ReserverVeille />);
  });
  return { arbre, defilement: arbre.root.findByType(ScrollView), racine: arbre.root };
};

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-15T16:30:00Z') });
  mockLecture = lue();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('DEFILEMENT-LOT2 — ReserverVeille : tout défile, sauf « Je confirme »', () => {
  const osAvant = Platform.OS;
  afterEach(() => { Platform.OS = osAvant; });

  test('B : « Je confirme » flotte dans le pied, hors du défilement, au bord bas', async () => {
    const { defilement, racine } = await monter();
    const pied = parId(racine, 'reserver-veille-pied');
    expect(sous(parTexte(racine, 'Je confirme'), pied)).toBe(true);
    expect(sous(pied, defilement)).toBe(false);
    const style = StyleSheet.flatten(pied.props.style);
    expect(style).toEqual(expect.objectContaining({ bottom: 0, position: 'absolute' }));
    expect(style.paddingBottom).toBeGreaterThanOrEqual(46);
  });

  test('rien ne disparaît : « J annule » et « Voir ma réservation » viennent au bout du défilement', async () => {
    const { defilement, racine } = await monter();
    expect(sous(parTexte(racine, 'J’annule'), defilement)).toBe(true);
    expect(sous(parTexte(racine, 'Voir ma réservation'), defilement)).toBe(true);
    expect(sous(parTexte(racine, 'Demain, tu joues ?'), defilement)).toBe(true);
  });

  test('A : le cadre ne garde rien en bas ; la fin du défilement laisse la place du pied', async () => {
    const { arbre, racine } = await monter();
    expect(mockCadres.at(-1).bottomInsetMode).toBe('scroll-edge');
    act(() => {
      parId(racine, 'reserver-veille-pied').props.onLayout({ nativeEvent: { layout: { height: 106 } } });
    });
    const fin = StyleSheet.flatten(arbre.root.findByType(ScrollView).props.contentContainerStyle);
    expect(fin.paddingBottom).toBeGreaterThanOrEqual(106 + 12);
  });

  test('déjà confirmée : pas de pied flottant, le lien au bout du défilement, le retrait commun', async () => {
    mockLecture = lue({ canAnswerDayBefore: false, dayBeforeConfirmedAt: '2026-10-15T16:10:00.000Z' });
    const { defilement, racine } = await monter();
    expect(mockCadres.at(-1).bottomInsetMode).toBe('scroll-edge');
    expect(parId(racine, 'reserver-veille-pied')).toBeUndefined();
    expect(sous(parTexte(racine, 'Voir ma réservation'), defilement)).toBe(true);
    expect(StyleSheet.flatten(defilement.props.contentContainerStyle).paddingBottom).toBe(24 + 46);
  });

  test('site : « Je confirme » vient au bout du défilement (REPRISE-PLACE)', async () => {
    Platform.OS = 'web';
    const { defilement, racine } = await monter();
    expect(sous(parTexte(racine, 'Je confirme'), defilement)).toBe(true);
    expect(sous(parTexte(racine, 'J’annule'), defilement)).toBe(true);
  });
});
