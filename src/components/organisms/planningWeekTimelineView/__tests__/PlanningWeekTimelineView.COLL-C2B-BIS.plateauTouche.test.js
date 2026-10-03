/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// 📐 COLL-C2B-BIS (03/10) — planches 24 et 29 : en mode « jour » avec des colonnes de plateaux
// (D66), une heure libre se touche DANS SA COLONNE : la grille dit le jour, l heure ET la colonne
// (0 = premier plateau). Sans colonnes, le geste est celui d avant (jour, heure), inchangé.
// ROUGE avant le lot : une seule case par heure, sur toute la largeur du jour ; aucune colonne.
// Harnais repris du témoin C2B (PlanningWeekTimelineView.COLL-C2B.test.js), avec le vrai i18next
// (la phrase lue par le lecteur d écran nomme le plateau).

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

describe('COLL-C2B-BIS — l heure libre se touche dans la colonne de son plateau', () => {
  const lanes = [{ key: 'a', label: 'Plateau A' }, { key: 'b', label: 'Plateau B' }];
  const laneOf = (/** @type {any} */ evenement) => Number(evenement.raw?.plateau?.number) - 1;

  it('une case par plateau et par heure, chacune dans sa colonne', async () => {
    const touche = jest.fn();
    const arbre = await monter({
      firstHour: 8, laneOf, lanes, onFreeSlotPress: touche,
    });
    const ids = casesLibres(arbre).map((/** @type {any} */ noeud) => noeud.props.testID);
    expect(ids).toEqual(expect.arrayContaining(['heure-libre-2026-10-07-8-a', 'heure-libre-2026-10-07-8-b']));
    const caseB = casesLibres(arbre)
      .find((/** @type {any} */ noeud) => noeud.props.testID === 'heure-libre-2026-10-07-8-b');
    const style = StyleSheet.flatten(caseB.props.style);
    expect([style.left, style.width]).toEqual(['50%', '50%']);
    expect(caseB.props.accessibilityLabel).toContain('Plateau B');
    act(() => { caseB.props.onPress(); });
    expect(touche).toHaveBeenCalledWith(MERCREDI, 8, 1);
  });

  it('sans colonnes (semaine, ou pas de plateaux) : une case par jour, le geste d avant', async () => {
    const touche = jest.fn();
    const arbre = await monter({
      firstHour: 8, laneOf, lanes, mode: 'week', onFreeSlotPress: touche,
    });
    const ids = casesLibres(arbre).map((/** @type {any} */ noeud) => noeud.props.testID);
    expect(ids.some((id) => id.endsWith('-a') || id.endsWith('-b'))).toBe(false);
    expect(textes(arbre)).not.toContain('Plateau A');
  });
});
