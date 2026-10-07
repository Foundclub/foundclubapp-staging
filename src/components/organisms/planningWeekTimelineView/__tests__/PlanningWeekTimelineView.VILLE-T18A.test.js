/* eslint-disable max-len -- des libelles entiers de la grille, compares tels quels */
import {
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getPlanningTimeLabel, normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// 📐 VILLE-T18A (07/10/2026), point 5 — LE PLANNING SEMAINE, défauts de la tournée T18
// (captures G56c_apres_blocage, G39_fiche_bloc_planning ; maquettes P5-jour-tel,
// P5-semaine-paysage : « 08:00 », « 18:00 – 19:30 »). ROUGES avant le lot :
//   1. les heures de la règle s écrivaient sans zéro (« 8:00 », « 9:00 ») ;
//   2. la première (« 8:00 ») était coupée en haut de la grille : l étiquette remonte de 8 px
//      pour se centrer sur son trait, et le planning plein écran ne lui laissait aucune marge ;
//   3. une plage horaire s écrivait avec un trait d union (« 18:00 - 19:30 », fiche d un bloc,
//      cartes du planning) au lieu du tiret demi-cadratin du reste de l app.
// Harnais repris de PlanningWeekTimelineView.COLL-C4B-BIS.semaine.test.js.

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

describe('VILLE-T18A point 5 — le planning semaine : des heures entières, à deux chiffres', () => {
  it('1. la règle écrit « 08:00 », « 09:00 »… (HH:MM, comme toute l app)', async () => {
    // Le blocage du jeudi 8, 08:00 – 09:30 (G56c) ouvre les heures du matin.
    const blocage = {
      closureBand: { documentId: 'b1', kind: 'block', reason: null },
      documentId: null,
      endAt: new Date(2026, 9, 8, 9, 30).toISOString(),
      hasExplicitTime: true,
      startAt: new Date(2026, 9, 8, 8, 0).toISOString(),
      title: 'Bloqué par la Ville',
    };
    const arbre = await monter([MARDI, blocage]);
    const heures = regleDesHeures(arbre).map((cellule) => cellule.texte).filter((texte) => texte !== '…');
    expect(heures[0]).toBe('08:00');
    expect(heures).toContain('09:00');
    expect(heures.every((texte) => /^\d{2}:00$/.test(texte))).toBe(true);
  });

  it('2. la première heure n est pas coupée : la marge du haut couvre la remontée de l étiquette', async () => {
    const arbre = await monter([MARDI]);
    const defilement = arbre.root.findAllByType(ScrollView)
      .find((/** @type {any} */ noeud) => noeud.props.contentContainerStyle);
    const margeDuHaut = Number(StyleSheet.flatten(defilement.props.contentContainerStyle).paddingTop) || 0;
    const etiquette = arbre.root.findAllByType(Text)
      .find((/** @type {any} */ noeud) => /^\d{1,2}:00$/.test(String(noeud.props.children)));
    const remontee = Number(StyleSheet.flatten(etiquette.props.style).marginTop) || 0;
    expect(margeDuHaut + remontee).toBeGreaterThanOrEqual(0);
  });

  it('3. une plage horaire s écrit « 18:00 – 19:30 » (tiret demi-cadratin)', () => {
    expect(getPlanningTimeLabel({ endTime: '19:30:00.000', startTime: '18:00:00.000' })).toBe('18:00 – 19:30');
    expect(getPlanningTimeLabel({ endTime: '18:00', startTime: '18:00' })).toBe('18:00');
  });
});

// 🎨 VILLE-T18A (07/10), tournée T18 point 4b (site, captures SITE_G45b, SITE_G58, SITE_G37b) — un
// panneau s ouvre à droite (fiche d un bloc, Attribuer, Fermer) : la grille se tasse, les deux
// créneaux du mardi se regroupent en « 2 créneaux »… et le bloc « AS… U15 » restait dessiné PAR-DESSUS.
// Cause : un créneau n a pas de `documentId` ; sa clé était « jour-hauteur », la MÊME pour deux
// créneaux à la même heure. Clés en double : React ne retire pas l ancien bloc. ROUGE avant le lot.
describe('VILLE-T18A point 4b — la grille se tasse : aucun bloc fantôme sur la grappe', () => {
  const creneau = (/** @type {any} */ champs) => bloc({
    endAt: '2026-10-06T17:30:00.000Z',
    endTime: '19:30:00.000',
    startAt: '2026-10-06T16:00:00.000Z',
    startTime: '18:00:00.000',
    ...champs,
  });
  const AS_U15 = creneau({
    club: { documentId: 'club-as', name: 'AS Montrivage' }, slot: { documentId: 'upk2' }, team: { name: 'U15' }, title: 'AS Montrivage · U15',
  });
  const MFC = creneau({
    club: { documentId: 'club-fc', name: 'Montrivage FC' }, slot: { documentId: 'pt2i' }, team: null, title: 'Montrivage FC',
  });
  const mesurer = async (/** @type {any} */ arbre, /** @type {number} */ largeur) => {
    const grille = arbre.root.findAll((/** @type {any} */ n) => (
      typeof n.type === 'string' && n.props.testID === 'planning-grille'
    ))[0];
    await act(async () => {
      grille.props.onLayout({ nativeEvent: { layout: { height: 600, width: largeur } } });
    });
  };
  const blocsDe = (/** @type {any} */ arbre, /** @type {string} */ debut) => arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.type === 'string' && String(n.props.accessibilityLabel || '').startsWith(debut)
  ));

  it('deux créneaux à la même heure : la grille large les pose côte à côte, la grille tassée n en garde QUE la grappe', async () => {
    const erreurs = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const arbre = await monter([AS_U15, MFC]);
      await mesurer(arbre, 1000);
      expect(blocsDe(arbre, 'AS Montrivage · U15')).toHaveLength(1);
      expect(blocsDe(arbre, 'Montrivage FC')).toHaveLength(1);

      // Un panneau s ouvre : 200 px pour 7 jours, deux colonnes ne tiennent plus.
      await mesurer(arbre, 200);
      const grappes = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.testID === 'planning-grappe');
      expect(grappes).toHaveLength(1);
      expect(blocsDe(arbre, 'AS Montrivage · U15')).toHaveLength(0);
      expect(blocsDe(arbre, 'Montrivage FC')).toHaveLength(0);
      const clesEnDouble = erreurs.mock.calls.filter((appel) => String(appel[0]).includes('same key'));
      expect(clesEnDouble).toHaveLength(0);
    } finally {
      erreurs.mockRestore();
    }
  });
});
