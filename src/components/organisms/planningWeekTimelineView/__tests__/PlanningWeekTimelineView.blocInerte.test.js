import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// FINITIONS2 (recette emulateur du 29/09, tournee 4, COLL1B etape 5) — le
// planning d'une installation partagee : le bloc d'un AUTRE club (« Test Fc ·
// Senior B ») ne fait rien quand on le touche — voulu, le serveur ne donne pas
// son identifiant — mais il etait declare « cliquable » : TalkBack l'annonce
// comme un bouton qui ne mene nulle part.
//
// 📏 La regle : un bloc qu'aucun appui ne peut ouvrir n'est pas un bouton.
// Les QUATRE ecrans qui montent cette vue (plein ecran, planning perso, planning
// du club, planning omnisport) ouvrent un bloc par son `documentId` et ne font
// RIEN sans lui : la vue partagee le sait donc une fois pour toutes.

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
 * Monte la vue semaine avec les deux blocs.
 * @param {Function} onEventPress
 * @returns {Promise<any>}
 */
const monter = async (onEventPress) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningWeekTimelineView
        compactFullscreen
        currentDate={LUNDI}
        events={normalizePlanningItems([BLOC_DE_MON_CLUB, BLOC_D_UN_AUTRE_CLUB])}
        mode="week"
        onEventPress={onEventPress}
        showHeader={false}
        showUntimedSection={false}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};

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

const estAppuyable = (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
  || typeof noeud.props?.onClick === 'function'
  || noeud.props?.accessibilityRole === 'button'
  || noeud.type === TouchableOpacity;

// Un noeud decrit en une ligne : comparer les noeuds eux-memes ferait imprimer a
// Jest tout l'arbre (chaque noeud tient son parent) et epuiserait la memoire.
const decrire = (/** @type {any} */ noeud) => [
  typeof noeud.type === 'string' ? noeud.type : (noeud.type?.displayName || noeud.type?.name),
  noeud.props?.accessibilityRole || '',
].join(':');

describe('FINITIONS2 3 — le bloc d un autre club n est pas un bouton', () => {
  test('« US Ville B » : aucun appui, aucun role de bouton dans sa lignee', async () => {
    const arbre = await monter(jest.fn());

    expect(lignee(arbre, 'Ville B').filter(estAppuyable).map(decrire)).toEqual([]);
  });

  test('🔒 le bloc de MON club reste un bouton, et il ouvre SON evenement', async () => {
    const ouvrir = jest.fn();
    const arbre = await monter(ouvrir);

    const bouton = lignee(arbre, 'Ville A')
      .find((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function');
    expect(bouton).toBeTruthy();
    await act(async () => { bouton.props.onPress(); });
    expect(ouvrir).toHaveBeenCalledTimes(1);
    expect(ouvrir.mock.calls[0][0]).toEqual(expect.objectContaining({ documentId: 'evt-A' }));
  });
});
