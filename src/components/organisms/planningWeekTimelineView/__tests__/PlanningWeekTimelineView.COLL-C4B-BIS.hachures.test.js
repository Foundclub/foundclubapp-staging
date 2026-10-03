/* eslint-disable max-len -- des libelles entiers de la grille, compares tels quels */
import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// 🖥️ COLL-C4B-BIS (03/10/2026), point 3 — planche 25 du plan, design HY521H1 page 4 (P4v3-fermer-tel
// ecran 4, P4v3-fermer-ordi) : DE VRAIES HACHURES. La plage = des rayures a 135 degres (`.ferme-bande` :
// 8 px a 22 %, 8 px a 8 % de l orange) et un bord PLEIN ; la seance touchee = un contour en POINTILLES
// orange (`.a-deplacer` : outline 2px dashed). Sur Android, un bord n est en pointilles que si ses quatre
// cotes ont la meme epaisseur et la meme couleur : la seance de la photo T10_C25_5 etait cernee d un
// trait PLEIN (bord gauche de 3 px a la couleur du club).
// ROUGES avant le lot : plage en pointilles sans motif ; bord gauche 3 px ; « a deplacer » en dernier,
// coupe par le bloc. Harnais de PlanningWeekTimelineView.COLL-C4B-BIS.semaine.test.js.
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
// Vendredi 9, ferme toute la journee : deux seances touchees, l une apres l autre.
const VENDREDI_FC = bloc({
  closure: { documentId: 'f1', kind: 'closure' },
  endAt: '2026-10-09T17:30:00.000Z',
  endTime: '19:30:00.000',
  startAt: '2026-10-09T16:00:00.000Z',
  startTime: '18:00:00.000',
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

const COULEURS = jest.requireActual('@/theme/colors').colors;
const plageDuMercredi = {
  ...PLAGE_VENDREDI,
  endAt: new Date(2026, 9, 7, 22, 0).toISOString(),
  startAt: new Date(2026, 9, 7, 8, 0).toISOString(),
};
const toucheeDuMercredi = {
  ...VENDREDI_FC, endAt: '2026-10-07T17:30:00.000Z', startAt: '2026-10-07T16:00:00.000Z',
};
const noeudDuBloc = (/** @type {any} */ arbre, /** @type {string} */ debutDuLibelle) => arbre.root
  .findAll((/** @type {any} */ n) => (
    typeof n.type === 'string' && String(n.props.accessibilityLabel || '').startsWith(debutDuLibelle)
  ))[0];

describe('COLL-C4B-BIS point 3 — de vraies hachures, et des pointilles qui se voient', () => {
  it('1. la plage : des rayures (motif), un bord PLEIN orange, le libelle en orange clair', async () => {
    const arbre = await monter([plageDuMercredi], { mode: 'day' });
    const plage = noeudDuBloc(arbre, 'Fermé · travaux');
    expect(plage.findAll((/** @type {any} */ n) => n.props.testID === 'hachures' && typeof n.type === 'string')).toHaveLength(1);
    const style = StyleSheet.flatten(plage.props.style);
    expect(style.borderStyle).not.toBe('dashed');
    expect(style.borderWidth).toBe(1);
    const libelle = plage.findAllByType(Text).find((/** @type {any} */ n) => n.props.children === 'Fermé · travaux');
    expect(StyleSheet.flatten(libelle.props.style).color).toBe(COULEURS.warning400);
  });

  it('2. la seance touchee : pointilles sur ses QUATRE bords egaux (Android ne trace des pointilles qu ainsi)', async () => {
    const arbre = await monter([toucheeDuMercredi], { mode: 'day' });
    const style = StyleSheet.flatten(noeudDuBloc(arbre, 'Montrivage FC').props.style);
    expect(style.borderStyle).toBe('dashed');
    expect(style.borderWidth).toBe(2);
    expect(style.borderLeftWidth).toBe(2);
    expect(style.borderLeftColor).toBe(COULEURS.warning500);
    expect(style.borderColor).toBe(COULEURS.warning500);
  });

  it('3. « a deplacer » se lit juste sous le club et l equipe (la planche), avant l heure', async () => {
    const arbre = await monter([toucheeDuMercredi], { mode: 'day' });
    const lignes = noeudDuBloc(arbre, 'Montrivage FC').findAllByType(Text)
      .map((/** @type {any} */ n) => String(n.props.children));
    const aDeplacer = lignes.indexOf('à déplacer');
    expect(aDeplacer).toBeGreaterThan(-1);
    expect(lignes.slice(0, aDeplacer)).toEqual(['Montrivage FC', 'Senior B']);
  });
});

// Point 5 (tournee T10 : « un jour ferme dit 1 place libre ») : sous une plage fermee, aucune
// « heure libre » ne se propose — ni au doigt, ni au lecteur d ecran.
describe('COLL-C4B-BIS point 5 — un jour ferme n a aucune heure libre', () => {
  const casesLibres = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.type === 'string' && String(n.props.testID || '').startsWith('heure-libre-')
  )).map((/** @type {any} */ n) => n.props.testID);

  it('journee fermee : aucune case libre ce jour-la', async () => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <PlanningWeekTimelineView
          cardDisplayProfile="clubFocused"
          compactFullscreen
          currentDate={MERCREDI}
          events={normalizePlanningItems([plageDuMercredi, toucheeDuMercredi])}
          firstHour={8}
          mode="day"
          onFreeSlotPress={jest.fn()}
          showHeader={false}
          showUntimedSection={false}
        />,
      );
    });
    arbresMontes.push(arbre);
    expect(casesLibres(arbre)).toEqual([]);
  });

  it('blocage de 17:00 a 19:00 : ses heures ne sont pas libres, les autres oui', async () => {
    const blocage = {
      closureBand: {
        documentId: 'b1', endTime: '19:00', kind: 'block', label: 'Forum', startTime: '17:00',
      },
      documentId: null,
      endAt: new Date(2026, 9, 7, 19, 0).toISOString(),
      hasExplicitTime: true,
      startAt: new Date(2026, 9, 7, 17, 0).toISOString(),
      title: 'Bloqué par la Ville · Forum',
    };
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <PlanningWeekTimelineView
          cardDisplayProfile="clubFocused"
          compactFullscreen
          currentDate={MERCREDI}
          events={normalizePlanningItems([blocage, toucheeDuMercredi])}
          firstHour={8}
          mode="day"
          onFreeSlotPress={jest.fn()}
          showHeader={false}
          showUntimedSection={false}
        />,
      );
    });
    arbresMontes.push(arbre);
    const cases = casesLibres(arbre);
    expect(cases).not.toContain('heure-libre-2026-10-07-17');
    expect(cases).not.toContain('heure-libre-2026-10-07-18');
    expect(cases).toContain('heure-libre-2026-10-07-19');
  });
});
