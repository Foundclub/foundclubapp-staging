/* eslint-disable max-len -- des libelles entiers de la grille, compares tels quels */
import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// 🚧 COLL-C4B (02/10/2026) — design HY521H1, P4v3-fermer-tel ecran 4 (« La plage fermee est hachuree ;
// les seances touchees gardent leur place, cernees de pointilles orange ») : la GRILLE dessine une plage
// fermee ou bloquee (`raw.closureBand`, posee par l ecran) en orange et pointilles, que seule la
// mairie touche ; et une seance touchee (`raw.closure`, rendu par le serveur) « a deplacer ».
// ROUGE avant le lot : la plage etait un bloc comme un autre (ouvrable), la seance n etait pas cernee.
// Harnais repris de PlanningWeekTimelineView.COLL-C3B.test.js.

// Une grille montee tourne en ~1 s ; sous la charge d autres suites, 5 s ne suffisent pas.
jest.setTimeout(30000);

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
/** @type {any[]} */
const arbresMontes = [];
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});
const monter = async (/** @type {any[]} */ blocs, /** @type {any} */ props = {}) => {
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
        onEventPress={props.onEventPress}
        onReadOnlyEventPress={props.onReadOnlyEventPress}
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
    typeof n.type === 'string' && String(n.props.accessibilityLabel || '').startsWith(debutDuLibelle)
  ))[0];
  return StyleSheet.flatten(noeud.props.style);
};

const TOUCHEE = bloc({
  closure: { documentId: 'f1', kind: 'closure' },
  documentId: 'evt-touche',
  title: 'AS Ville A · U13',
});
const AUTRE = bloc({
  closure: null,
  club: { documentId: 'club-B', name: 'Montrivage FC' },
  endAt: '2026-10-07T19:00:00.000Z',
  endTime: '21:00:00.000',
  startAt: '2026-10-07T17:30:00.000Z',
  startTime: '19:30:00.000',
  team: { name: 'Senior B' },
  title: 'Montrivage FC · Senior B',
});
// La plage, telle que l ecran la pose (closureBandsForRange) : aucun id, aucun documentId.
const PLAGE = {
  closureBand: { documentId: 'f1', kind: 'closure', reason: 'travaux' },
  documentId: null,
  endAt: new Date(2026, 9, 7, 22, 0).toISOString(),
  hasExplicitTime: true,
  startAt: new Date(2026, 9, 7, 8, 0).toISOString(),
  title: 'Fermé · travaux',
};

describe('COLL-C4B — la plage fermee et la seance « a deplacer » dans la grille', () => {
  it('la plage : orange, en pointilles, son libelle ; seule la mairie la touche, jamais comme une seance', async () => {
    const onEventPress = jest.fn();
    const onReadOnlyEventPress = jest.fn();
    const arbre = await monter([PLAGE, TOUCHEE, AUTRE], { onEventPress, onReadOnlyEventPress });
    const plage = styleDuBloc(arbre, 'Fermé · travaux');
    expect(plage.borderStyle).toBe('dashed');
    expect(String(plage.borderColor).startsWith('rgba(')).toBe(true);
    const noeud = arbre.root.findAll((/** @type {any} */ n) => (
      typeof n.props.onPress === 'function' && String(n.props.accessibilityLabel || '').startsWith('Fermé · travaux')
    ))[0];
    await act(async () => { noeud.props.onPress(); });
    expect(onReadOnlyEventPress).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fermé · travaux' }));
    expect(onEventPress).not.toHaveBeenCalled();
  });

  it('un membre (sans geste de lecture) ne peut pas toucher la plage', async () => {
    const arbre = await monter([PLAGE]);
    const pressables = arbre.root.findAll((/** @type {any} */ n) => (
      typeof n.props.onPress === 'function' && String(n.props.accessibilityLabel || '').startsWith('Fermé · travaux')
    ));
    expect(pressables).toHaveLength(0);
  });

  it('la seance touchee : cernee de pointilles orange, « a deplacer » ; l autre garde son trait plein', async () => {
    const arbre = await monter([TOUCHEE, AUTRE]);
    const touchee = styleDuBloc(arbre, 'AS Ville A');
    expect(touchee.borderStyle).toBe('dashed');
    expect(touchee.borderColor).toBe(COULEURS.warning500);
    expect(touchee.borderWidth).toBe(2);
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'a-deplacer' && typeof n.type === 'string')).toHaveLength(1);
    expect(styleDuBloc(arbre, 'Montrivage FC').borderStyle).not.toBe('dashed');
  });
});
