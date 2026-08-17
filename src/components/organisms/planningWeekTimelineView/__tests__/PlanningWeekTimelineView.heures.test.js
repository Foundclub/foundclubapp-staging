import { Text, TouchableOpacity, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// T06 — LE PLANNING DESSINE LES EVENEMENTS A LA MAUVAISE HEURE.
//
// Constat d'Adel (2026-08-17) : « un evenement va etre de 18h a 19h, et sur le
// planning il va s'afficher de 13h a 19h ». Le DEBUT est faux de 5 h, la FIN est
// juste — donc ce n'est PAS un decalage de fuseau, qui bougerait les deux bouts.
//
// LA CAUSE, MESUREE : un evenement porte DEUX debuts et le code ne lit pas le
// meme selon l'endroit.
//   · le libelle de la carte, l'ecran de l'evenement et la fin lisent les
//     colonnes d'horloge `startTime` / `endTime` (« 18:00 », « 19:00 ») ;
//   · le BLOC dessine lit l'instant `startAt` (la colonne `date`), qui vaut
//     13:00 sur les memes lignes.
// Mesure du 2026-08-17 sur la base de staging : 14 evenements sur 27 ont un
// `start_time` en avance de EXACTEMENT 5 h sur l'heure de Paris de `date`, et
// AUCUN n'a de `end_date` — d'ou une fin qui retombe sur `endTime` et reste
// juste. En production : 89 evenements sur 241 divergent (49 de 2 h, 40 de 1 h).
//
// Les temoins ci-dessous decrivent ce que l'ecran DOIT montrer. Ils se lisent
// sur la regle des heures rendue a gauche : on ne compare jamais des pixels a
// des constantes, on compare la position du bloc a la ligne « 18:00 ».
//
// ⚠️ Toutes les heures sont FIXES : aucun `new Date()` sans arguments, aucune
// dependance a l'instant ou le test tourne.

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

// Les assets ne sont pas resolus par Jest : on ne depend pas d'eux pour mesurer
// une position.
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

// Mercredi 11 mars 2026, fige. Jamais « aujourd'hui » : la ligne de l'heure
// courante ne doit pas entrer dans la mesure.
const MERCREDI = new Date(2026, 2, 11, 12, 0, 0);

/**
 * L'instant tel que le serveur l'envoie : la colonne `date` est un timestamp
 * UTC. En mars, Paris est a UTC+1.
 * @param {number} heureParis
 * @param {number} [minute]
 * @param {number} [jour]
 * @returns {string}
 */
const instantParis = (heureParis, minute = 0, jour = 11) => (
  new Date(Date.UTC(2026, 2, jour, heureParis - 1, minute)).toISOString()
);

/**
 * Une ligne de planning telle que `mapPlanningEventToSlot` la renvoie.
 * @param {Record<string, any>} particularites
 * @returns {Record<string, any>}
 */
const creneau = (particularites) => ({
  endAt: null,
  endTime: null,
  hasExplicitTime: true,
  startAt: null,
  startTime: null,
  title: particularites.documentId,
  ...particularites,
});

/**
 * Monte la vue semaine sur une periode figee.
 * @param {Record<string, any>[]} evenements
 * @returns {Promise<any>}
 */
const monter = async (evenements) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningWeekTimelineView
        currentDate={MERCREDI}
        events={normalizePlanningItems(evenements)}
        mode="3days"
      />,
    );
  });
  return arbre;
};

const EST_UNE_HEURE = /^\d{1,2}:00$/;

/**
 * La regle des heures rendue a gauche, dans l'ordre : [{ hauteur, texte }].
 * C'est elle qui fait foi — pas une constante recopiee du composant.
 * @param {any} arbre
 * @returns {{ hauteur: number, texte: string }[]}
 */
const regleDesHeures = (arbre) => arbre.root.findAllByType(View)
  .filter((/** @type {any} */ noeud) => Array.isArray(noeud.props?.style)
    && noeud.props.style.some((/** @type {any} */ s) => s && typeof s.height === 'number')
    && noeud.findAllByType(Text).length === 1)
  .map((/** @type {any} */ noeud) => ({
    hauteur: noeud.props.style
      .find((/** @type {any} */ s) => s && typeof s.height === 'number').height,
    texte: String(noeud.findAllByType(Text)[0].props.children),
  }))
  .filter((/** @type {any} */ cellule) => EST_UNE_HEURE.test(cellule.texte)
    || cellule.texte === '…');

/**
 * L'ordonnee de la ligne « HH:00 » sur cette regle, et la hauteur de sa case.
 * @param {{ hauteur: number, texte: string }[]} regle
 * @param {string} libelle
 * @returns {{ hauteur: number, y: number }}
 */
const ligne = (regle, libelle) => {
  let y = 0;
  for (let index = 0; index < regle.length; index += 1) {
    if (regle[index].texte === libelle) return { hauteur: regle[index].hauteur, y };
    y += regle[index].hauteur;
  }
  throw new Error(`La regle n'affiche pas « ${libelle} » : ${JSON.stringify(regle)}`);
};

/**
 * Les blocs poses sur la grille : position, hauteur, textes.
 * @param {any} arbre
 * @returns {{ bas: number, hauteur: number, textes: any[], top: number }[]}
 */
const blocs = (arbre) => arbre.root.findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => Array.isArray(noeud.props?.style)
    && noeud.props.style.some((/** @type {any} */ s) => s
      && typeof s.top === 'number' && typeof s.height === 'number'))
  .map((/** @type {any} */ noeud) => {
    const pose = noeud.props.style.find((/** @type {any} */ s) => s && typeof s.top === 'number');
    return {
      bas: pose.top + pose.height,
      hauteur: pose.height,
      textes: noeud.findAllByType(Text).map((/** @type {any} */ t) => t.props.children).flat(),
      top: pose.top,
    };
  });

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte et retient l'arbre pour le demonter apres le temoin.
 * @param {Record<string, any>[]} evenements
 * @returns {Promise<any>}
 */
const monterEtRetenir = async (evenements) => {
  const arbre = await monter(evenements);
  arbresMontes.push(arbre);
  return arbre;
};

afterEach(async () => {
  await act(async () => {
    while (arbresMontes.length) arbresMontes.pop().unmount();
  });
});

describe('T06 — le planning dessine chaque evenement a SON heure', () => {
  it('LE TEMOIN : un evenement de 18h a 19h se dessine de 18h a 19h', async () => {
    // La ligne exacte mesuree en base staging le 2026-08-17 (evenement 29) :
    // date = 2026-08-16 11:00 UTC (13:00 a Paris), start_time = 18:00,
    // end_time = 19:00, end_date = NULL. L'ecran de l'evenement affiche
    // « 18:00 - 19:00 » ; le planning doit dire la meme chose.
    const arbre = await monterEtRetenir([
      creneau({
        documentId: 'entrainement',
        endTime: '19:00:00.000',
        startAt: instantParis(13),
        startTime: '18:00:00.000',
      }),
    ]);

    const regle = regleDesHeures(arbre);
    const dixHuitHeures = ligne(regle, '18:00');
    const poses = blocs(arbre);

    expect(poses).toHaveLength(1);
    // La carte porte bien 18:00 - 19:00 : c'est le libelle qui dit la verite.
    expect(poses[0].textes).toContain('18:00 - 19:00');
    // Elle COMMENCE sur la ligne 18:00 (le +1 est la bordure de la carte)...
    expect(poses[0].top - 1).toBe(dixHuitHeures.y);
    // ... et elle FINIT au bout de cette meme heure, donc a 19:00.
    expect(poses[0].bas + 1).toBe(dixHuitHeures.y + dixHuitHeures.hauteur);
  });

  it('un evenement sans heure de fin ne s etale pas jusqu au bout de la journee', async () => {
    const arbre = await monterEtRetenir([
      creneau({
        documentId: 'sans-fin',
        startAt: instantParis(18),
        startTime: '18:00:00.000',
      }),
    ]);

    const regle = regleDesHeures(arbre);
    const hauteurTotale = regle.reduce((somme, cellule) => somme + cellule.hauteur, 0);
    const dixHuitHeures = ligne(regle, '18:00');
    const poses = blocs(arbre);

    expect(poses).toHaveLength(1);
    expect(poses[0].top - 1).toBe(dixHuitHeures.y);
    // Il occupe au plus deux lignes d'heure, pas toute la colonne.
    expect(poses[0].hauteur).toBeLessThan(hauteurTotale);
    expect(poses[0].hauteur).toBeLessThanOrEqual(dixHuitHeures.hauteur * 2);
  });

  it('deux evenements qui se suivent restent DEUX blocs', async () => {
    const arbre = await monterEtRetenir([
      creneau({
        documentId: 'avant',
        endTime: '19:00:00.000',
        startAt: instantParis(18),
        startTime: '18:00:00.000',
      }),
      creneau({
        documentId: 'apres',
        endTime: '20:00:00.000',
        startAt: instantParis(19),
        startTime: '19:00:00.000',
      }),
    ]);

    const regle = regleDesHeures(arbre);
    const dixHuit = ligne(regle, '18:00');
    const dixNeuf = ligne(regle, '19:00');
    const poses = blocs(arbre).sort((gauche, droite) => gauche.top - droite.top);

    expect(poses).toHaveLength(2);
    expect(poses[0].textes).toContain('18:00 - 19:00');
    expect(poses[1].textes).toContain('19:00 - 20:00');
    expect(poses[0].top - 1).toBe(dixHuit.y);
    expect(poses[1].top - 1).toBe(dixNeuf.y);
    // Le second commence ou le premier finit : ils ne se recouvrent pas.
    expect(poses[1].top).toBeGreaterThanOrEqual(poses[0].bas);
  });

  it('un evenement qui passe minuit ne se replie pas sur lui-meme', async () => {
    const arbre = await monterEtRetenir([
      creneau({
        documentId: 'nocturne',
        endTime: '00:30:00.000',
        startAt: instantParis(23),
        startTime: '23:00:00.000',
      }),
    ]);

    const regle = regleDesHeures(arbre);
    const vingtTroisHeures = ligne(regle, '23:00');
    const poses = blocs(arbre);

    expect(poses).toHaveLength(1);
    expect(poses[0].textes).toContain('23:00 - 00:30');
    expect(poses[0].top - 1).toBe(vingtTroisHeures.y);
    // Une hauteur positive : le bloc ne remonte jamais au-dessus de son debut.
    expect(poses[0].hauteur).toBeGreaterThan(0);
    expect(poses[0].bas).toBeGreaterThan(poses[0].top);
  });

  it('un evenement sans heure du tout ne fait pas planter la vue', async () => {
    const arbre = await monterEtRetenir([
      creneau({
        documentId: 'sans-horaire',
        hasExplicitTime: false,
        startAt: instantParis(0),
      }),
      creneau({
        documentId: 'vide',
        hasExplicitTime: false,
      }),
    ]);

    // Aucune exception au montage, et l'evenement sans date n'invente rien.
    expect(arbre.root.findAllByType(Text).length).toBeGreaterThan(0);
    expect(blocs(arbre).length).toBeLessThanOrEqual(1);
  });
});
