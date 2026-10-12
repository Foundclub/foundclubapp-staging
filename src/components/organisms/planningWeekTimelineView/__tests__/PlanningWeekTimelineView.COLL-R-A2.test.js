import { format } from 'date-fns';
import { StyleSheet, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// 📱 COLL-R-APP-PLANNING (12/10/2026) — la grille du planning d une installation, recette du
// compte collectivite du 11/10 (suivi docs/RECETTE_COLLECTIVITES_2026-10-12_SUIVI.md) :
//   - COL-009 : en plein ecran sur telephone, le cadre de la grille ne depasse jamais la place
//     qui reste (c est la grille qui defile dedans) ; hors plein ecran, rien ne change.
//   - COL-012 : des fleches pour changer de semaine AUSSI dans la rangee des jours (‹ dans la case
//     vide a gauche de LUN, › apres DIM), avec les fonctions et les noms qui existent deja.
// Doublures reprises de PlanningWeekTimelineView.COLL-C3B.test.js.

jest.mock('@/theme/themeContext', () => {
  const { colors: vraiesCouleurs } = jest.requireActual('@/theme/colors');
  const feuille = {};
  const rampe = () => new Proxy({}, { get: () => feuille });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => rampe() }),
      Colors: vraiesCouleurs,
      Fonts: rampe(),
      Images: new Proxy({}, {
        get: (/** @type {any} */ _c, /** @type {any} */ k) => `image-${String(k)}`,
      }),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});
jest.mock('@/theme/images', () => ({
  __esModule: true,
  images: new Proxy({}, {
    get: (/** @type {any} */ _c, /** @type {any} */ k) => ({ testUri: `image-${String(k)}` }),
  }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  runOnJS: (/** @type {any} */ fonction) => fonction,
}));
jest.mock('react-native-gesture-handler', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const geste = () => {
    /** @type {any} */
    const g = {};
    g.direction = () => g;
    g.onEnd = () => g;
    g.onStart = () => g;
    return g;
  };
  return {
    Directions: { LEFT: 'gauche', RIGHT: 'droite' },
    Gesture: { Fling: geste, Simultaneous: () => ({}) },
    GestureDetector: function GestureDetectorMock(/** @type {any} */ { children }) {
      return reactActuel.createElement(VueRN, null, children);
    },
  };
});

// Mercredi 7 octobre 2026 ; seul `Date` est fige, au 07/10 10:00 UTC (motif FIGER_LA_DATE).
const MERCREDI = new Date(2026, 9, 7, 12, 0, 0);
const FIGER_LA_DATE = {
  doNotFake: [
    'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
    'clearInterval', 'setTimeout', 'clearTimeout',
  ],
  now: new Date('2026-10-07T10:00:00.000Z'),
};
beforeEach(() => { jest.useFakeTimers(FIGER_LA_DATE); });
afterEach(() => { jest.useRealTimers(); });
const bloc = (/** @type {any} */ champs) => ({
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: null,
  endAt: '2026-10-07T17:30:00.000Z',
  endTime: '19:30:00.000',
  facility: { documentId: 'gym-ville', name: 'Gymnase de la Ville', planningColor: null },
  hasExplicitTime: true,
  kind: 'event',
  origin: 'club',
  pending: false,
  startAt: '2026-10-07T16:00:00.000Z',
  startTime: '18:00:00.000',
  team: { name: 'U13' },
  title: 'AS Ville A · U13',
  ...champs,
});

/** @type {any[]} */
const arbresMontes = [];
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});
const monter = async ({
  compactFullscreen = true,
  events = [bloc({})],
  flechesDesJours = false,
  mode = 'week',
  nomsDesFleches = /** @type {string[] | undefined} */ (undefined),
  onDateChange = /** @type {any} */ (undefined),
} = {}) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningWeekTimelineView
        cardDisplayProfile="clubFocused"
        compactFullscreen={compactFullscreen}
        currentDate={MERCREDI}
        events={normalizePlanningItems(events)}
        flechesDesJours={flechesDesJours}
        mode={mode}
        nomsDesFleches={nomsDesFleches}
        onDateChange={onDateChange}
        showHeader={false}
        showUntimedSection={false}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
const parId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.testID === id);
const styleDe = (/** @type {any} */ arbre, /** @type {string} */ id) => StyleSheet.flatten(
  parId(arbre, id)[0].props.style,
);

describe('COL-009 — le cadre de la grille, en plein ecran sur telephone', () => {
  it('plein ecran : le cadre se borne a la place restante (la grille defile dedans)', async () => {
    const arbre = await monter();
    expect(styleDe(arbre, 'planning-cadre').flexShrink).toBe(1);
  });

  it('hors plein ecran (onglet Planning) : rien ne change', async () => {
    const arbre = await monter({ compactFullscreen: false });
    expect(styleDe(arbre, 'planning-cadre').flexShrink).toBeUndefined();
  });
});

const fleche = (/** @type {any} */ arbre, /** @type {string} */ nom) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === nom);
const SEMAINE = ['Semaine précédente', 'Semaine suivante'];

// ROUGE avant le lot : la rangee des jours n avait aucune fleche.
describe('COL-012 — des fleches aussi dans la rangee des jours', () => {
  it('› apres DIM : la semaine suivante ; ‹ avant LUN : la precedente', async () => {
    const onDateChange = jest.fn();
    const arbre = await monter({ flechesDesJours: true, nomsDesFleches: SEMAINE, onDateChange });
    await act(async () => { fleche(arbre, 'Semaine suivante').props.onPress(); });
    expect(format(onDateChange.mock.calls[0][0], 'yyyy-MM-dd')).toBe('2026-10-14');
    await act(async () => { fleche(arbre, 'Semaine précédente').props.onPress(); });
    expect(format(onDateChange.mock.calls[1][0], 'yyyy-MM-dd')).toBe('2026-09-30');
  });

  it('elles sont DANS la rangee des jours, et se touchent (44 points au moins)', async () => {
    const arbre = await monter({ flechesDesJours: true, nomsDesFleches: SEMAINE });
    const rangee = parId(arbre, 'rangee-des-jours')[0];
    const noms = rangee.findAllByType(TouchableOpacity)
      .map((/** @type {any} */ noeud) => noeud.props.accessibilityLabel);
    expect(noms).toEqual(['Semaine précédente', 'Semaine suivante']);
    rangee.findAllByType(TouchableOpacity).forEach((/** @type {any} */ noeud) => {
      const { height, width } = StyleSheet.flatten(noeud.props.style);
      const marge = noeud.props.hitSlop;
      expect(width + marge.left + marge.right).toBeGreaterThanOrEqual(44);
      expect(height + marge.top + marge.bottom).toBeGreaterThanOrEqual(44);
    });
  });

  it('en vue Jour aussi, avec le nom de la vue', async () => {
    const onDateChange = jest.fn();
    const arbre = await monter({
      flechesDesJours: true,
      mode: 'day',
      nomsDesFleches: ['Jour précédent', 'Jour suivant'],
      onDateChange,
    });
    await act(async () => { fleche(arbre, 'Jour suivant').props.onPress(); });
    expect(format(onDateChange.mock.calls[0][0], 'yyyy-MM-dd')).toBe('2026-10-08');
  });

  it('sans la demande (les autres plannings) : aucune fleche dans la rangee', async () => {
    const arbre = await monter();
    expect(parId(arbre, 'rangee-des-jours')[0].findAllByType(TouchableOpacity)).toHaveLength(0);
  });
});
