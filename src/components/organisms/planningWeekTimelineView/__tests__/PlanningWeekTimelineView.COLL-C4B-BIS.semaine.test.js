/* eslint-disable max-len -- des libelles entiers de la grille, compares tels quels */
import { StyleSheet, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// 🖥️ COLL-C4B-BIS (03/10/2026), point 2 — planche 25 du plan, design HY521H1 page 4,
// « P4v3-fermer-ordi » : LA SEMAINE HACHUREE. La plage fermee se pose en FOND, sur toute la
// largeur du jour et toute sa hauteur (`.ferme-bande` : top 0, bottom 0) ; les seances restent
// dessus, a leur largeur ; la journee fermee n ouvre pas les heures creuses (« Libre jusqu a
// 17:30 » reste replie). Une semaine sans seance mais fermee se lit quand meme.
// ROUGES avant le lot : sur une colonne large, la plage prenait une COLONNE a cote des seances
// (elles passaient a demi-largeur), ouvrait toutes les heures de 8:00 a 22:00, et comptait comme
// une seance dans la pastille du jour. Harnais repris de PlanningWeekTimelineView.COLL-C4B.test.js.

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

// Mercredi 7 octobre 2026 : la semaine du lundi 5 au dimanche 11.
const MERCREDI = new Date(2026, 9, 7, 12, 0, 0);
const UN_JOUR = 100 / 7;
// Un pourcentage de la grille, lu en nombre (les calculs de la grille arrondissent au 1e-15 pres).
const pourcent = (/** @type {any} */ valeur) => Number.parseFloat(String(valeur));
const bloc = (/** @type {any} */ champs) => ({
  club: { documentId: 'club-A', name: 'Montrivage FC' },
  documentId: null,
  facility: { documentId: 'gym-ville', name: 'Gymnase des Tilleuls', planningColor: null },
  hasExplicitTime: true,
  kind: 'slot',
  team: { name: 'Senior B' },
  title: 'Montrivage FC · Senior B',
  ...champs,
});
// Mardi 6 : une seance de 17:30 a 19:00.
const MARDI = bloc({
  club: { documentId: 'club-B', name: 'AS Montrivage' },
  endAt: '2026-10-06T17:00:00.000Z',
  endTime: '19:00:00.000',
  startAt: '2026-10-06T15:30:00.000Z',
  startTime: '17:30:00.000',
  team: { name: 'U15' },
  title: 'AS Montrivage · U15',
});
// Vendredi 9, ferme toute la journee : deux seances touchees, l une apres l autre.
const VENDREDI_FC = bloc({
  closure: { documentId: 'f1', kind: 'closure' },
  endAt: '2026-10-09T17:30:00.000Z',
  endTime: '19:30:00.000',
  startAt: '2026-10-09T16:00:00.000Z',
  startTime: '18:00:00.000',
});
const VENDREDI_BASKET = bloc({
  closure: { documentId: 'f1', kind: 'closure' },
  club: { documentId: 'club-C', name: 'Montrivage Basket' },
  endAt: '2026-10-09T19:00:00.000Z',
  endTime: '21:00:00.000',
  startAt: '2026-10-09T17:30:00.000Z',
  startTime: '19:30:00.000',
  team: { name: 'Seniors Basket' },
  title: 'Montrivage Basket · Seniors Basket',
});
// La plage, telle que l ecran la pose (closureBandsForRange) : de l ouverture a la fermeture.
const PLAGE_VENDREDI = {
  closureBand: { documentId: 'f1', kind: 'closure', reason: 'travaux' },
  documentId: null,
  endAt: new Date(2026, 9, 9, 22, 0).toISOString(),
  hasExplicitTime: true,
  startAt: new Date(2026, 9, 9, 8, 0).toISOString(),
  title: 'Fermé · travaux',
};

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
        firstHour={8}
        laneOf={props.laneOf}
        lanes={props.lanes}
        mode={props.mode || 'week'}
        showHeader={false}
        showUntimedSection={false}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
// Un ordinateur : une grille de 1 000 points (plus de 140 par jour).
const mesurer = async (/** @type {any} */ arbre, /** @type {number} */ largeur) => {
  const grille = arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.type === 'string' && n.props.testID === 'planning-grille'
  ))[0];
  await act(async () => {
    grille.props.onLayout({ nativeEvent: { layout: { height: 600, width: largeur } } });
  });
};
const styleDuBloc = (/** @type {any} */ arbre, /** @type {string} */ debutDuLibelle) => {
  const noeud = arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.type === 'string' && String(n.props.accessibilityLabel || '').startsWith(debutDuLibelle)
  ))[0];
  return StyleSheet.flatten(noeud.props.style);
};
// La regle des heures, a gauche (la meme lecture que PlanningWeekTimelineView.heures.test.js).
const regleDesHeures = (/** @type {any} */ arbre) => arbre.root.findAllByType(View)
  .filter((/** @type {any} */ noeud) => Array.isArray(noeud.props?.style)
    && noeud.props.style.some((/** @type {any} */ s) => s && typeof s.height === 'number')
    && noeud.findAllByType(Text).length === 1)
  .map((/** @type {any} */ noeud) => ({
    hauteur: noeud.props.style.find((/** @type {any} */ s) => s && typeof s.height === 'number').height,
    texte: String(noeud.findAllByType(Text)[0].props.children),
  }))
  .filter((/** @type {any} */ cellule) => /^\d{1,2}:00$/.test(cellule.texte) || cellule.texte === '…');

describe('COLL-C4B-BIS point 2 — la semaine hachuree (ordinateur)', () => {
  it('1. la plage du vendredi se pose en fond, toute la largeur du jour ; les seances gardent la leur', async () => {
    const arbre = await monter([MARDI, PLAGE_VENDREDI, VENDREDI_FC, VENDREDI_BASKET]);
    await mesurer(arbre, 1000);
    const plage = styleDuBloc(arbre, 'Fermé · travaux');
    expect(pourcent(plage.left)).toBeCloseTo(4 * UN_JOUR, 6);
    expect(pourcent(plage.width)).toBeCloseTo(UN_JOUR, 6);
    expect(pourcent(styleDuBloc(arbre, 'Montrivage FC').width)).toBeCloseTo(UN_JOUR, 6);
    expect(pourcent(styleDuBloc(arbre, 'Montrivage Basket').width)).toBeCloseTo(UN_JOUR, 6);
  });

  it('2. la journee fermee n ouvre pas les heures creuses ; la plage couvre toute la colonne', async () => {
    const arbre = await monter([MARDI, PLAGE_VENDREDI, VENDREDI_FC, VENDREDI_BASKET]);
    await mesurer(arbre, 1000);
    const regle = regleDesHeures(arbre);
    const heures = regle.map((cellule) => cellule.texte).filter((texte) => texte !== '…');
    expect(heures).toEqual(['17:00', '18:00', '19:00', '20:00']);
    const hauteurTotale = regle.reduce((total, cellule) => total + cellule.hauteur, 0);
    const plage = styleDuBloc(arbre, 'Fermé · travaux');
    expect(plage.top).toBe(1);
    expect(plage.height).toBe(hauteurTotale - 2);
  });

  it('3. une semaine sans seance mais fermee : la plage se lit, de l ouverture a la fermeture', async () => {
    const arbre = await monter([PLAGE_VENDREDI]);
    const heures = regleDesHeures(arbre).map((cellule) => cellule.texte);
    expect(heures[0]).toBe('08:00');
    expect(heures).toContain('21:00');
    expect(styleDuBloc(arbre, 'Fermé · travaux')).toBeDefined();
  });

  it('4. la pastille du jour compte les seances, jamais la plage', async () => {
    const arbre = await monter([MARDI, PLAGE_VENDREDI, VENDREDI_FC, VENDREDI_BASKET]);
    const lus = arbre.root.findAllByType(Text).map((/** @type {any} */ n) => String(n.props.children));
    expect(lus).toContain('2');
    expect(lus).not.toContain('3');
  });

  it('5. vue Jour en colonnes de plateaux : la plage passe sous TOUTES les colonnes', async () => {
    // La vue Jour montre le mercredi : la plage et la seance y sont posees.
    const arbreDuJour = await monter([
      { ...PLAGE_VENDREDI, endAt: new Date(2026, 9, 7, 22, 0).toISOString(), startAt: new Date(2026, 9, 7, 8, 0).toISOString() },
      { ...VENDREDI_FC, endAt: '2026-10-07T17:30:00.000Z', startAt: '2026-10-07T16:00:00.000Z' },
    ], {
      laneOf: () => 1,
      lanes: [{ key: 'plateau-1', label: 'Côté tribune' }, { key: 'indifferent', label: 'Indifférent' }],
      mode: 'day',
    });
    const plage = styleDuBloc(arbreDuJour, 'Fermé · travaux');
    expect(plage.left).toBe('0%');
    expect(plage.width).toBe('100%');
    expect(styleDuBloc(arbreDuJour, 'Montrivage FC').left).toBe('50%');
  });
});
