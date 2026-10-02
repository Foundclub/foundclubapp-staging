import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// 🏛️ COLL-C3B (02/10/2026) — design HY521H1, P8v2-demande-ordi (« La place demandée s'affiche en
// pointillé orange dans la grille ») et point 4 du lot : le planning affiche la place DEMANDÉE à
// la Ville et en attente de sa décision (contrat C2A §7 : `origin: 'request'`, `pending`) en
// pointillés orange. Un autre bloc garde son trait plein.
// ROUGE avant le lot : la place en attente avait le trait plein des autres.

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

const COULEURS = jest.requireActual('@/theme/colors').colors;
// Mercredi 7 octobre 2026.
const MERCREDI = new Date(2026, 9, 7, 12, 0, 0);
const bloc = (/** @type {any} */ champs) => ({
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: null,
  endAt: '2026-10-07T17:30:00.000Z',
  endTime: '19:30:00.000',
  facility: { documentId: 'gym-ville', name: 'Gymnase de la Ville', planningColor: null },
  hasExplicitTime: true,
  kind: 'event',
  startAt: '2026-10-07T16:00:00.000Z',
  startTime: '18:00:00.000',
  team: { name: 'U13' },
  title: 'AS Ville A · U13',
  ...champs,
});
const DEMANDE_EN_ATTENTE = bloc({ origin: 'request', pending: true });
const SEANCE_DU_CLUB = bloc({
  club: { documentId: 'club-B', name: 'Montrivage FC' },
  origin: 'club',
  pending: false,
  team: { name: 'Senior B' },
  title: 'Montrivage FC · Senior B',
});

/** @type {any[]} */
const arbresMontes = [];
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});
const monter = async (/** @type {any[]} */ blocs) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningWeekTimelineView
        cardDisplayProfile="clubFocused"
        compactFullscreen
        currentDate={MERCREDI}
        events={normalizePlanningItems(blocs)}
        mode="day"
        showHeader={false}
        showUntimedSection={false}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
const styleDuBloc = (/** @type {any} */ arbre, /** @type {string} */ debutDuLibelle) => {
  const noeud = arbre.root.findAll((/** @type {any} */ n) => (
    // eslint-disable-next-line max-len
    typeof n.type === 'string' && String(n.props.accessibilityLabel || '').startsWith(debutDuLibelle)
  ))[0];
  return StyleSheet.flatten(noeud.props.style);
};

// eslint-disable-next-line max-len
describe('COLL-C3B — point 4 : la place demandée, en attente de la mairie, en pointillés orange', () => {
  // eslint-disable-next-line max-len
  it('la demande en attente : bordure en pointillés, orange ; la séance d’un club : trait plein', async () => {
    const arbre = await monter([DEMANDE_EN_ATTENTE, SEANCE_DU_CLUB]);
    const attente = styleDuBloc(arbre, 'AS Ville A');
    expect(attente.borderStyle).toBe('dashed');
    expect(attente.borderColor).toBe(COULEURS.warning500);
    const seance = styleDuBloc(arbre, 'Montrivage FC');
    expect(seance.borderStyle).not.toBe('dashed');
  });
});
