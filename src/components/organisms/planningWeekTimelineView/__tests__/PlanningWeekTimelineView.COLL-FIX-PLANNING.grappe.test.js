/* eslint-disable max-len -- des libelles entiers de la grille, compares tels quels */
import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// 🎨 COLL-FIX-PLANNING (02/10/2026), defaut de la tournee T9 (capture T9_C29_2) : la SEMAINE tenue
// droite (7 jours dans la largeur d un telephone, ~50 points par jour) posait deux seances qui se
// chevauchent cote a cote, a ~25 points chacune : « AS / … / 1… » et « Mon / S… / 1… ».
//
// Ce que ce temoin fige (ROUGE avant le correctif) :
//   - la grille MESURE sa largeur ; quand deux blocs ne tiennent pas cote a cote (moins de 44
//     points chacun), la grappe devient UNE carte : la pastille de chaque club et « 2 séances »,
//     et le lecteur d ecran entend chaque seance ; l appui ouvre ce jour ;
//   - une plage fermee (COLL-C4B) ne prend alors pas de place : elle passe en fond ;
//   - telephone tourne (ou largeur pas encore mesuree) : rien ne change, cote a cote.
// Harnais repris de PlanningWeekTimelineView.COLL-C4B.test.js.

// Une grille montee tourne en ~1 s ; sous la charge d autres suites, 5 s ne suffisent pas.
jest.setTimeout(30000);

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
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
        mode={props.mode || 'week'}
        onDateChange={props.onDateChange}
        onEventPress={props.onEventPress}
        onReadOnlyEventPress={props.onReadOnlyEventPress}
        onSummaryPress={props.onSummaryPress}
        showHeader={false}
        showUntimedSection={false}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
// La grille se mesure (onLayout) : on lui donne la largeur d un telephone tenu droit ou tourne.
const mesurer = async (/** @type {any} */ arbre, /** @type {number} */ largeur) => {
  const grille = arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.type === 'string' && n.props.testID === 'planning-grille'
  ))[0];
  await act(async () => {
    grille.props.onLayout({ nativeEvent: { layout: { height: 600, width: largeur } } });
  });
};
const grappes = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => (
  typeof n.type === 'string' && n.props.testID === 'planning-grappe'
));
const blocsQuiCommencentPar = (/** @type {any} */ arbre, /** @type {string} */ debut) => arbre.root
  .findAll((/** @type {any} */ n) => (
    typeof n.type === 'string' && String(n.props.accessibilityLabel || '').startsWith(debut)
  ));
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};

// Jeudi 8 octobre : deux seances qui se chevauchent (18:00 - 19:30 et 18:30 - 20:00).
const SEANCE_A = bloc({
  endAt: '2026-10-08T17:30:00.000Z',
  startAt: '2026-10-08T16:00:00.000Z',
});
const SEANCE_B = bloc({
  club: { documentId: 'club-B', name: 'US Ville B' },
  endAt: '2026-10-08T18:00:00.000Z',
  endTime: '20:00:00.000',
  startAt: '2026-10-08T16:30:00.000Z',
  startTime: '18:30:00.000',
  team: { name: 'Seniors B' },
  title: 'US Ville B · Seniors B',
});
// Une plage « fermee toute la journee » le meme jeudi (posee par l ecran, COLL-C4B).
const PLAGE = {
  closureBand: { documentId: 'f1', kind: 'closure', reason: 'travaux' },
  documentId: null,
  endAt: new Date(2026, 9, 8, 22, 0, 0).toISOString(),
  hasExplicitTime: true,
  startAt: new Date(2026, 9, 8, 8, 0, 0).toISOString(),
  title: 'Fermé · travaux',
};
const UN_JOUR = 100 / 7;

describe('COLL-FIX-PLANNING 3 — la semaine tenue droite ne pose plus des blocs illisibles', () => {
  it('portrait (350 points) : la grappe devient UNE carte « 2 séances », chaque seance dite', async () => {
    const arbre = await monter([SEANCE_A, SEANCE_B]);
    await mesurer(arbre, 350);
    const [grappe] = grappes(arbre);
    expect(grappe).toBeDefined();
    expect(aplatir(grappe.props.children)).toContain('2');
    expect(aplatir(grappe.props.children)).toContain('séances');
    expect(grappe.props.accessibilityLabel).toContain('AS Ville A · U13');
    expect(grappe.props.accessibilityLabel).toContain('US Ville B · Seniors B');
    expect(parseFloat(StyleSheet.flatten(grappe.props.style).width)).toBeCloseTo(UN_JOUR);
    expect(blocsQuiCommencentPar(arbre, 'AS Ville A')).toHaveLength(0);
    expect(blocsQuiCommencentPar(arbre, 'US Ville B')).toHaveLength(0);
  });

  it('l appui sur la grappe ouvre ce jour', async () => {
    const onDateChange = jest.fn();
    const onSummaryPress = jest.fn();
    const arbre = await monter([SEANCE_A, SEANCE_B], { onDateChange, onSummaryPress });
    await mesurer(arbre, 350);
    const appui = arbre.root.findAll((/** @type {any} */ n) => (
      n.props.testID === 'planning-grappe' && typeof n.props.onPress === 'function'
    ))[0];
    await act(async () => { appui.props.onPress(); });
    expect(onDateChange).toHaveBeenCalledWith(new Date(2026, 9, 8));
    expect(onSummaryPress).toHaveBeenCalled();
  });

  it('telephone tourne (860 points) : cote a cote, comme avant', async () => {
    const arbre = await monter([SEANCE_A, SEANCE_B]);
    await mesurer(arbre, 860);
    expect(grappes(arbre)).toHaveLength(0);
    expect(blocsQuiCommencentPar(arbre, 'AS Ville A')).toHaveLength(1);
    expect(blocsQuiCommencentPar(arbre, 'US Ville B')).toHaveLength(1);
  });

  it('largeur pas encore mesuree : rien ne change', async () => {
    const arbre = await monter([SEANCE_A, SEANCE_B]);
    expect(grappes(arbre)).toHaveLength(0);
    expect(blocsQuiCommencentPar(arbre, 'AS Ville A')).toHaveLength(1);
  });

  it('portrait : une plage fermee passe en fond, la seance garde toute la largeur du jour', async () => {
    const arbre = await monter([PLAGE, SEANCE_A]);
    await mesurer(arbre, 350);
    expect(grappes(arbre)).toHaveLength(0);
    const seance = StyleSheet.flatten(blocsQuiCommencentPar(arbre, 'AS Ville A')[0].props.style);
    const plage = StyleSheet.flatten(blocsQuiCommencentPar(arbre, 'Fermé · travaux')[0].props.style);
    expect(parseFloat(seance.width)).toBeCloseTo(UN_JOUR);
    expect(parseFloat(plage.width)).toBeCloseTo(UN_JOUR);
  });
});
