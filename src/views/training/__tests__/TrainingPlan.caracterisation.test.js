import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubCardSurface from '@/components/molecules/clubCard/ClubCardSurface';

import TrainingPlan from '../TrainingPlan';

/**
 * « MON ENTRAINEMENT » — FILET DE CARACTERISATION (E6).
 *
 * 🔎 POURQUOI CE FICHIER EXISTE : les six ecrans de la section n'avaient AUCUN
 * test, et le pack de design les reecrit tous les six. La regle du projet est
 * mecanique : sur un fichier sans filet, on ecrit d'abord un temoin qui decrit
 * le comportement ACTUEL, ensuite on touche. Sans lui, rien ne dirait qu'une
 * branche retiree servait.
 *
 * CE QUE CE TEMOIN FIGE, et qui ne doit PAS bouger quand la peinture change :
 *   1. une rangee par seance, dans l'ordre rendu par le serveur ;
 *   2. le code de la journee, son titre, sa date, son lieu, sa duree, son statut ;
 *   3. la prochaine seance est distinguee des autres ;
 *   4. appuyer sur une rangee ouvre CETTE journee-la ;
 *   5. sans inscription, l'ecran propose de choisir un entrainement.
 *
 * 🎨 Le 7e temoin est le seul qui parle d'apparence, et c'est voulu : il dit que
 * la carte d'une seance passe par la surface PARTAGEE de l'app plutot que par un
 * fond gris ecrit a la main. C'est la seule chose que le changement de peinture
 * doit modifier ici.
 */

/** @type {any} */
let mockEntrainement;

jest.mock('@/hooks/useTraining', () => ({
  useMyTraining: () => mockEntrainement,
}));

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();

  // Le vrai theme rend cinq objets, pas trois : `Button` lit `ApplicationStyle`
  // et tombe sans lui. On sert donc le theme REEL, pas une version amputee.
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyle(Colors),
      Colors,
      Fonts: genererPolices(Colors),
      Spaces,
    }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ clef, /** @type {any} */ options) => (
      options ? `${clef}|${JSON.stringify(options)}` : clef
    ),
  }),
}));

// Le degrade natif n'est pas transforme par Jest (il vit hors de la liste des
// paquets transpiles). `ClubCardSurface` s'en sert : on le remplace par une vue.
jest.mock('react-native-linear-gradient', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => reactActuel.createElement(VueRN, props),
  };
});

// Le gabarit d'ecran pose un fond et des marges : il n'apporte rien a observer
// ici, et il tire des dependances natives (degrade, image de fond).
jest.mock('@/components/templates/ScreenContainer', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

// L'enveloppe de chargement rend ses enfants des que ni erreur ni attente.
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

const SEANCES = [
  {
    day: {
      code: 'T', documentId: 'jour-t', durationMinutes: 160, place: 'terrain', title: 'Jour T — Technique et calibrations',
    },
    documentId: 'seance-1',
    plannedDate: '2026-09-06',
    status: 'done',
  },
  {
    day: {
      code: 'A', documentId: 'jour-a', durationMinutes: 75, place: 'salle', title: 'Jour A — Structure et mobilité',
    },
    documentId: 'seance-2',
    plannedDate: '2026-09-07',
    status: 'planned',
  },
  {
    day: {
      code: 'B', documentId: 'jour-b', durationMinutes: 120, place: 'salle', title: 'Jour B — Détente',
    },
    documentId: 'seance-3',
    plannedDate: '2026-09-08',
    status: 'planned',
  },
];

const INSCRIT = {
  enrollment: { documentId: 'insc-1', program: { title: 'Football haut niveau' } },
  error: null,
  isLoading: false,
  nextSession: SEANCES[1],
  progress: { done: 1, total: 8 },
  refetch: () => {},
  sessions: SEANCES,
};

/**
 * Monte l'ecran et rend l'arbre de test.
 * @param {any} [etat] ce que rend le crochet `useMyTraining`
 * @param {any} [navigation] la navigation moquee
 * @returns {any} l'arbre react-test-renderer
 */
const rendre = (etat = INSCRIT, navigation = { navigate: () => {} }) => {
  mockEntrainement = etat;
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TrainingPlan navigation={navigation} />);
  });
  return arbre;
};

/**
 * Tout le texte affiche par un arbre, mis a plat.
 * @param {any} arbre l'arbre rendu
 * @returns {string[]} les chaines reellement rendues
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  /**
   * Descend dans un noeud rendu et empile chaque chaine rencontree.
   * @param {any} noeud un noeud de l'arbre rendu
   * @returns {void} rien : la sortie est empilee dans `sortie`
   */
  const parcourir = (noeud) => {
    if (typeof noeud === 'string') { sortie.push(noeud); return; }
    if (Array.isArray(noeud)) { noeud.forEach(parcourir); return; }
    if (noeud && noeud.children) noeud.children.forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

describe('le planning affiche les seances telles que le serveur les rend', () => {
  it('rend UNE rangee par seance, plus le bouton du carnet', () => {
    // 3 seances + 1 bouton « Mon carnet » en pied d'ecran = 4 zones cliquables.
    expect(rendre().root.findAllByType(TouchableOpacity))
      .toHaveLength(SEANCES.length + 1);
  });

  it('affiche le code, le titre, le lieu et la duree de chaque journee', () => {
    const vus = textes(rendre());

    expect(vus).toEqual(expect.arrayContaining([
      'T', 'A', 'B',
      'Jour T — Technique et calibrations',
      'Jour A — Structure et mobilité',
      'terrain', 'salle',
      // Rendues en TEXTE par JSX, jamais en nombre.
      '160', '75', '120',
    ]));
  });

  it('garde l ordre rendu par le serveur, jamais l ordre des dates', () => {
    const codes = textes(rendre()).filter((v) => ['A', 'B', 'T'].includes(v));

    expect(codes).toEqual(['T', 'A', 'B']);
  });

  it('affiche le titre du programme et la progression', () => {
    const vus = textes(rendre());

    expect(vus).toContain('Football haut niveau');
    expect(vus.some((v) => String(v).startsWith('training.plan.progress'))).toBe(true);
  });
});

/**
 * Toutes les epaisseurs de liseré RENDUES, dans l'ordre de l'ecran.
 *
 * On lit l'arbre rendu plutot que les props d'un composant precis : le liseré
 * peut demenager d'une vue a l'autre quand la peinture change, ce que le joueur
 * VOIT ne doit pas bouger pour autant.
 * @param {any} arbre l'arbre rendu
 * @returns {number[]} une entree par element qui porte une epaisseur
 */
const bordures = (arbre) => {
  /** @type {number[]} */
  const sortie = [];
  /**
   * Descend dans un noeud rendu et empile son epaisseur de liseré s'il en a une.
   * @param {any} noeud un noeud de l'arbre rendu
   * @returns {void} rien : la sortie est empilee dans `sortie`
   */
  const parcourir = (noeud) => {
    if (!noeud || typeof noeud !== 'object') return;
    const styles = [].concat(noeud.props?.style ?? []).flat(4).filter(Boolean);
    const epaisseur = styles.reduce(
      (/** @type {number|null} */ garde, /** @type {any} */ style) => (
        style && typeof style.borderWidth === 'number' ? style.borderWidth : garde
      ),
      null,
    );
    if (epaisseur !== null) sortie.push(epaisseur);
    (noeud.children || []).forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

describe('la prochaine seance se distingue des autres', () => {
  it('UNE SEULE rangee porte le liseré appuyé, et c est la prochaine', () => {
    const appuyees = bordures(rendre()).filter((e) => e === 2);

    expect(appuyees).toHaveLength(1);
  });

  it('n en appuie AUCUNE quand il n y a pas de prochaine seance', () => {
    const sansSuite = { ...INSCRIT, nextSession: null };

    expect(bordures(rendre(sansSuite)).filter((e) => e === 2)).toHaveLength(0);
  });
});

describe('appuyer sur une rangee ouvre CETTE journee', () => {
  it('passe l identifiant de la journee ET celui de la seance', () => {
    const navigate = jest.fn();
    const arbre = rendre(INSCRIT, { navigate });

    act(() => { arbre.root.findAllByType(TouchableOpacity)[2].props.onPress(); });

    expect(navigate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      dayId: 'jour-b', sessionId: 'seance-3', title: 'Jour B — Détente',
    }));
  });
});

describe('sans inscription, l ecran ne reste pas vide', () => {
  it('propose de choisir un entrainement', () => {
    const arbre = rendre({
      enrollment: null,
      error: null,
      isLoading: false,
      nextSession: null,
      progress: { done: 0, total: 0 },
      refetch: () => {},
      sessions: [],
    });

    // Aucune rangee de seance, mais UN bouton : l'ecran ne laisse jamais
    // quelqu'un devant une page vide sans porte de sortie.
    expect(arbre.root.findAllByType(TouchableOpacity)).toHaveLength(1);
    expect(textes(arbre)).toEqual(
      expect.arrayContaining(['training.plan.empty.action']),
    );
  });
});

describe('🎨 la carte d une seance parle la langue visuelle de l app', () => {
  it('passe par la surface PARTAGEE, pas par un fond gris ecrit a la main', () => {
    // 🪤 Avant le 2026-09-08, chaque rangee posait `backgroundColor: neutral800`
    // — un gris que PLUS AUCUN autre ecran de l app n'emploie comme surface de
    // carte. `ClubCardSurface` est le point de verite unique : degrade
    // primary700 -> primary900 et liseré cyan. Le pack de design demandait ce
    // changement ; il n'y avait rien a inventer, seulement a s'en servir.
    expect(rendre().root.findAllByType(ClubCardSurface)).toHaveLength(SEANCES.length);
  });
});
