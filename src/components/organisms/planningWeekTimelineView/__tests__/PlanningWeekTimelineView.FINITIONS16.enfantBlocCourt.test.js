import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { withViewerChildrenTitles } from '@/domains/event/viewerChildren';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// FINITIONS16 · POINT 22 (tournee T15, photo SITE_P1 ; planche Statistiques P1) — le planning du
// PARENT ecrit le prenom de l'enfant sur chaque creneau qui le concerne (« Hugo · … »,
// PARENT-PLANNING). Deux seances d'UNE heure du mercredi 7 (« Entraînement 18:00 - 19:00 » et
// « 19:00 - 20:00 ») ne le disaient pas : un bloc court (60 px) n'affiche pas la ligne du titre,
// ou le prenom est ecrit. Le parent ne savait plus pour quel enfant. ROUGE avant.

// Le repli, interpole comme i18next (le gabarit « {{names}} · {{title}} » de l'app).
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => (
      typeof repli === 'string'
        ? repli.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''))
        : cle
    ),
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
  const enchainable = () => {
    /** @type {any} */
    const geste = {};
    ['direction', 'onEnd', 'onStart'].forEach((nom) => {
      geste[nom] = () => geste;
    });
    return geste;
  };
  return {
    Directions: { LEFT: 1, RIGHT: 2 },
    Gesture: { Fling: enchainable, Simultaneous: enchainable },
    GestureDetector: function GestureDetectorMock(/** @type {any} */ { children }) {
      return reactActuel.createElement(VueRN, null, children);
    },
  };
});

// Lundi 5 octobre 2026, fige : la semaine du mercredi 7.
const LUNDI = new Date(2026, 9, 5, 12, 0, 0);

/**
 * Une seance de l'enfant, telle que `getMyPlanning` l'a rendue au parent pendant la T15
 * (relay_corps.log, U15 du mercredi 7 : `endAt` nul, `typeLabel` « Entraînement »).
 * @param {string} id
 * @param {string} debut - « HH:MM ».
 * @param {string} fin - « HH:MM ».
 * @returns {any} La seance.
 */
const seanceDeHugo = (id, debut, fin) => ({
  club: { documentId: 'as-montrivage', name: 'AS Montrivage' },
  documentId: id,
  endAt: null,
  endTime: `${fin}:00`,
  facility: { documentId: 'tilleuls', name: 'Gymnase des Tilleuls' },
  hasExplicitTime: true,
  kind: 'event',
  startAt: `2026-10-07T${debut}:00.000+02:00`,
  startTime: `${debut}:00`,
  team: { documentId: 'u15', name: 'U15' },
  title: 'Entraînement - 07/10/2026 - U15',
  typeLabel: 'Entraînement',
  viewerChildren: [{ documentId: 'hugo', firstname: 'Hugo' }],
  viewerChildrenOnly: true,
});

/** @type {any[]} */
const arbresMontes = [];
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

const traduire = (/** @type {string} */ cle, /** @type {string} */ repli, /** @type {any} */ o) => (
  String(repli).replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(o?.[nom] ?? ''))
);

/**
 * Monte la vue semaine du parent avec une seance.
 * @param {any} seance
 * @returns {Promise<string[]>} Les textes du bloc.
 */
const textesDuBloc = async (seance) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningWeekTimelineView
        currentDate={LUNDI}
        events={withViewerChildrenTitles(normalizePlanningItems([seance]), traduire)}
        mode="week"
        onEventPress={jest.fn()}
        showHeader={false}
        showUntimedSection={false}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre.root.findAllByType(Text)
    .map((/** @type {any} */ n) => [n.props.children].flat(Infinity).join(''));
};

describe('FINITIONS16 22 — le prénom de l’enfant, même sur un bloc d’une heure', () => {
  it('🔒 caractérisation : une séance de deux heures le dit déjà', async () => {
    const lus = await textesDuBloc(seanceDeHugo('longue', '18:00', '20:00'));
    expect(lus.some((texte) => texte.includes('Hugo'))).toBe(true);
  });

  it('🔴 une séance d’une heure le dit aussi', async () => {
    const lus = await textesDuBloc(seanceDeHugo('courte', '18:00', '19:00'));
    expect(lus.some((texte) => texte.includes('Hugo'))).toBe(true);
  });
});
