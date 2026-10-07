import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// 📐 COLL-C2B (02/10/2026) — la grille partagee du planning gagne TROIS options facultatives,
// pour le planning d une installation (design HY521H1, P5v2-vues et P4v3-plateaux ecran 3) :
//   1. `onFreeSlotPress` : toucher une heure de la grille (la mairie attribue) ;
//   2. `firstHour` : la grille ouvre au plus tard a l ouverture de l installation ;
//   3. `lanes` + `laneOf` : en mode « jour », une colonne par plateau, nommee en tete.
// Sans elles, la grille est celle d avant (les quatre autres plannings ne changent pas).
// ROUGE avant le lot : aucune case libre, la grille commencait au premier bloc, pas de plateau.

/** @type {any[]} */
const mockFlings = [];

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

// Le balayage est garde : `direction` puis `onEnd`, rejouable a la main.
jest.mock('react-native-gesture-handler', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const fling = () => {
    /** @type {any} */
    const geste = {};
    geste.direction = (/** @type {any} */ sens) => { geste.sens = sens; return geste; };
    geste.onEnd = (/** @type {any} */ rappel) => {
      geste.rappel = rappel;
      mockFlings.push(geste);
      return geste;
    };
    geste.onStart = () => geste;
    return geste;
  };
  return {
    Directions: { LEFT: 'gauche', RIGHT: 'droite' },
    Gesture: { Fling: fling, Simultaneous: () => ({}) },
    GestureDetector: function GestureDetectorMock(/** @type {any} */ { children }) {
      return reactActuel.createElement(VueRN, null, children);
    },
  };
});

// Mercredi 7 octobre 2026.
const MERCREDI = new Date(2026, 9, 7, 12, 0, 0);
const bloc = (/** @type {any} */ champs) => ({
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: null,
  endAt: '2026-10-07T17:30:00.000Z',
  endTime: '19:30:00.000',
  facility: { documentId: 'gym-ville', name: 'Gymnase de la Ville', planningColor: null },
  hasExplicitTime: true,
  kind: 'slot',
  startAt: '2026-10-07T16:00:00.000Z',
  startTime: '18:00:00.000',
  team: { name: 'U15' },
  title: 'AS Ville A · U15',
  ...champs,
});
const PLATEAU_A = bloc({ plateau: { name: 'Plateau A', number: 1 } });
const PLATEAU_B = bloc({
  club: { documentId: 'club-B', name: 'Montrivage FC' },
  plateau: { name: 'Plateau B', number: 2 },
  team: { name: 'Senior B' },
  title: 'Montrivage FC · Senior B',
});

/** @type {any[]} */
const arbresMontes = [];
afterEach(async () => {
  mockFlings.length = 0;
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

const monter = async (/** @type {any} */ proprietes) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningWeekTimelineView
        cardDisplayProfile="clubFocused"
        compactFullscreen
        currentDate={MERCREDI}
        events={normalizePlanningItems([PLATEAU_A, PLATEAU_B])}
        firstHour={proprietes.firstHour}
        laneOf={proprietes.laneOf}
        lanes={proprietes.lanes}
        mode={proprietes.mode || 'day'}
        onFreeSlotPress={proprietes.onFreeSlotPress}
        showHeader={false}
        showUntimedSection={false}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
const casesLibres = (/** @type {any} */ arbre) => arbre.root.findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => String(noeud.props.testID || '')
    .startsWith('heure-libre-'));
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));
const blocs = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ noeud) => (
  typeof noeud.type === 'string'
  && String(noeud.props.accessibilityLabel || '').includes('·')
));

describe('COLL-C2B — la grille, sans les options : celle d avant', () => {
  it('aucune case libre, aucune tete de plateau, la grille commence au premier bloc', async () => {
    const arbre = await monter({});
    expect(casesLibres(arbre)).toHaveLength(0);
    expect(textes(arbre)).not.toContain('Plateau A');
    expect(textes(arbre)).not.toContain('08:00');
    expect(textes(arbre)).toContain('18:00');
  });
});

describe('COLL-C2B — une heure libre se touche (la mairie attribue)', () => {
  it('chaque heure du jour est une case ; la toucher donne le jour et l heure', async () => {
    const touche = jest.fn();
    const arbre = await monter({ firstHour: 8, onFreeSlotPress: touche });
    const cases = casesLibres(arbre);
    expect(cases.length).toBeGreaterThan(0);
    const huitHeures = cases
      .find((/** @type {any} */ noeud) => noeud.props.testID === 'heure-libre-2026-10-07-8');
    expect(huitHeures).toBeDefined();
    expect(huitHeures.props.accessibilityLabel).toMatch(/^Heure libre/);
    expect(huitHeures.props.accessibilityRole).toBe('button');
    act(() => { huitHeures.props.onPress(); });
    expect(touche).toHaveBeenCalledWith(MERCREDI, 8);
  });

  it('firstHour ouvre la grille a l ouverture, avant le premier bloc', async () => {
    const sans = await monter({ onFreeSlotPress: jest.fn() });
    const premiere = (/** @type {any} */ arbre) => casesLibres(arbre)[0].props.testID;
    expect(premiere(sans)).toBe('heure-libre-2026-10-07-18');
    const avec = await monter({ firstHour: 8, onFreeSlotPress: jest.fn() });
    expect(premiere(avec)).toBe('heure-libre-2026-10-07-8');
  });
});

describe('COLL-C2B — une colonne par plateau, en mode « jour » (D66)', () => {
  const lanes = [{ key: 'a', label: 'Plateau A' }, { key: 'b', label: 'Plateau B' }];
  const laneOf = (/** @type {any} */ evenement) => Number(evenement.raw?.plateau?.number) - 1;

  it('les plateaux sont nommes en tete ; chaque bloc va dans sa colonne', async () => {
    const arbre = await monter({ laneOf, lanes });
    expect(textes(arbre)).toContain('Plateau A');
    expect(textes(arbre)).toContain('Plateau B');
    const positions = blocs(arbre)
      .map((/** @type {any} */ noeud) => StyleSheet.flatten(noeud.props.style));
    const gauches = positions.map((/** @type {any} */ style) => style.left).sort();
    expect(gauches).toEqual(['0%', '50%']);
    positions.forEach((/** @type {any} */ style) => expect(style.width).toBe('50%'));
  });

  it('en mode « semaine », pas de colonnes de plateaux', async () => {
    const arbre = await monter({ laneOf, lanes, mode: 'week' });
    expect(textes(arbre)).not.toContain('Plateau A');
  });
});
