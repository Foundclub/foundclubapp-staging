import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { CLUB_PLANNING_PALETTE, FACILITY_PLANNING_PALETTE } from '@/utils/facilityPlanningColor';
import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// COLL1D (29/09) — « une couleur par club » (SPEC Collectivites §2 C) : la grille de la
// semaine prend la couleur que l ecran pose sur chaque bloc (`displayColor`), avant celle
// de l installation. ROUGE avant le lot : `getEventColor` ne lisait que l installation.
//
// Harnais repris de PlanningWeekTimelineView.blocInerte.test.js (memes doublures).

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

// Lundi 5 octobre 2026, fige : la semaine des deux blocs.
const LUNDI = new Date(2026, 9, 5, 12, 0, 0);

// Ce que rend `GET /facilities/:id/planning` (lot COLL1B) a un membre du club A.
const BLOC_DE_MON_CLUB = {
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: 'evt-A',
  endAt: '2026-10-05T17:30:00.000Z',
  endTime: '19:30:00.000',
  hasExplicitTime: true,
  isOwnClub: true,
  kind: 'event',
  startAt: '2026-10-05T16:00:00.000Z',
  startTime: '18:00:00.000',
  team: { name: 'Seniors A' },
  title: 'AS Ville A · Seniors A',
};
const BLOC_D_UN_AUTRE_CLUB = {
  ...BLOC_DE_MON_CLUB,
  club: { documentId: 'club-B', name: 'US Ville B' },
  documentId: null,
  endAt: '2026-10-05T19:00:00.000Z',
  endTime: '21:00:00.000',
  isOwnClub: false,
  startAt: '2026-10-05T17:30:00.000Z',
  startTime: '19:30:00.000',
  team: { name: 'Seniors B' },
  title: 'US Ville B · Seniors B',
};

/** @type {any[]} */
const arbresMontes = [];

afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

/**
 * Les ancetres (le noeud compris) du premier texte qui contient ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any[]}
 */
const lignee = (arbre, libelle) => {
  const dit = (/** @type {any} */ noeud) => [noeud.props.children].flat(Infinity)
    .some((/** @type {any} */ morceau) => String(morceau ?? '').includes(libelle));
  const texte = arbre.root.findAllByType(Text).find(dit);
  if (!texte) throw new Error(`Aucun bloc ne dit « ${libelle} »`);
  /** @type {any[]} */
  const chaine = [];
  for (let noeud = texte; noeud; noeud = noeud.parent) chaine.push(noeud);
  return chaine;
};

/**
 * L'ecran d'une installation pose sur chaque bloc la couleur de SON club (`displayColor`,
 * assignClubPlanningColors) : la grille doit la prendre, avant celle de l'installation.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {string[]}
 */
const couleursDeLaCarte = (arbre, libelle) => lignee(arbre, libelle)
  .map((/** @type {any} */ noeud) => StyleSheet.flatten(noeud.props?.style)?.borderLeftColor)
  .filter(Boolean);

// Les couleurs de la palette, jamais un hexadecimal en dur (contrat de theme).
const [BLEU, ROUGE] = CLUB_PLANNING_PALETTE;
const VERT = FACILITY_PLANNING_PALETTE[2];

describe('COLL1D — la grille prend la couleur du CLUB quand l ecran la donne', () => {
  test('deux clubs, deux couleurs : chaque bloc garde la sienne', async () => {
    const [a, b] = normalizePlanningItems([BLOC_DE_MON_CLUB, BLOC_D_UN_AUTRE_CLUB]);
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <PlanningWeekTimelineView
          compactFullscreen
          currentDate={LUNDI}
          events={[{ ...a, displayColor: BLEU }, { ...b, displayColor: ROUGE }]}
          mode="week"
          onEventPress={jest.fn()}
          showHeader={false}
          showUntimedSection={false}
        />,
      );
    });
    arbresMontes.push(arbre);

    expect(couleursDeLaCarte(arbre, 'Ville A')).toContain(BLEU);
    expect(couleursDeLaCarte(arbre, 'Ville B')).toContain(ROUGE);
  });

  test('sans couleur de club, rien ne change : la couleur de l installation', async () => {
    const [a] = normalizePlanningItems([{
      ...BLOC_DE_MON_CLUB,
      facility: { documentId: 'gym', name: 'Gymnase', planningColor: VERT },
    }]);
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <PlanningWeekTimelineView
          compactFullscreen
          currentDate={LUNDI}
          events={[a]}
          mode="week"
          onEventPress={jest.fn()}
          showHeader={false}
          showUntimedSection={false}
        />,
      );
    });
    arbresMontes.push(arbre);

    expect(couleursDeLaCarte(arbre, 'Ville A')).toContain(VERT);
  });
});
