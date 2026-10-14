/* eslint-disable max-len -- des libelles entiers de la grille, compares tels quels */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// 🚚 COLL-R-DEPLACER (14/10/2026, COL-013) — CE QUE LA GRILLE DIT D'UNE SÉANCE TOUCHÉE PAR UNE FERMETURE :
//   - la Ville a proposé une place (`raw.relocationProposal` en attente, posé par le serveur pour la
//     Ville qui gère) : « proposition envoyée » au lieu de « à déplacer » (planche P5v4-deplacer-ville-tel
//     écran 6 b) ;
//   - un créneau de SAISON touché, sans séance posée : « n'a pas lieu » (prompt du lot, point 5 ; la
//     notification au club dit déjà « Ton créneau … n'a pas lieu ») ;
//   - une séance touchée sans proposition : « à déplacer », inchangé.
// ROUGES avant le lot : la grille disait « à déplacer » partout.
// Harnais repris de PlanningWeekTimelineView.COLL-C4B.test.js.

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
const aplatir = (/** @type {any} */ e) => {
  if (Array.isArray(e)) return e.map(aplatir).join('');
  if (e === null || e === undefined || typeof e === 'boolean') return '';
  if (typeof e === 'object') return aplatir(e?.props?.children);
  return String(e);
};
const lignes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((n) => aplatir(n.props.children).trim());

const TOUCHEE = bloc({ closure: { documentId: 'f1', kind: 'closure' }, documentId: null });
const PROPOSITION = {
  date: '2026-10-07', documentId: 'prop-1', endTime: '19:30', facility: { documentId: 'stade', name: 'Stade municipal' }, startTime: '18:00', status: 'pending',
};
const CRENEAU = bloc({
  closure: { documentId: 'f1', kind: 'closure' },
  documentId: null,
  kind: 'slot',
  origin: 'slot',
  slot: { documentId: 'creneau-1' },
  team: { name: 'U15' },
  title: 'AS Ville A · U15',
});

describe('CRDEP — la grille dit ce qui arrive à la séance touchée', () => {
  it('la Ville a proposé une place : « proposition envoyée », plus « à déplacer »', async () => {
    const arbre = await monter([{ ...TOUCHEE, relocationProposal: PROPOSITION }]);
    const lu = lignes(arbre);
    expect(lu.some((ligne) => /U13.*proposition envoyée/.test(ligne))).toBe(true);
    expect(lu.some((ligne) => /à déplacer/.test(ligne))).toBe(false);
  });

  it('un créneau de saison touché : « n’a pas lieu »', async () => {
    const arbre = await monter([CRENEAU]);
    const lu = lignes(arbre);
    expect(lu.some((ligne) => /U15.*n’a pas lieu/.test(ligne))).toBe(true);
    expect(lu.some((ligne) => /à déplacer/.test(ligne))).toBe(false);
  });

  it('une séance touchée sans proposition : « à déplacer », comme avant ; une proposition tombée ne compte pas', async () => {
    const arbre = await monter([TOUCHEE]);
    expect(lignes(arbre).some((ligne) => /U13.*à déplacer/.test(ligne))).toBe(true);
    const tombee = await monter([{ ...TOUCHEE, relocationProposal: { ...PROPOSITION, status: 'lapsed' } }]);
    expect(lignes(tombee).some((ligne) => /U13.*à déplacer/.test(ligne))).toBe(true);
  });
});
