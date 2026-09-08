import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubCardSurface from '@/components/molecules/clubCard/ClubCardSurface';

import TrainingPlan from '../TrainingPlan';

/**
 * « MON ENTRAINEMENT » — TROIS CHOSES, ET RIEN D AUTRE.
 *
 * 🔎 CE QUE CET ECRAN MONTRAIT AVANT, et pourquoi ca ne marchait pas : la liste
 * des huit journees, du haut en bas. Le seul geste qui compte — commencer la
 * seance du jour — s y noyait, et l ecran n avait AUCUN bouton d action : la
 * seule facon d avancer etait de deviner qu il fallait toucher la bonne rangee.
 *
 * ⚠️ LA LISTE N A PAS ETE PERDUE, ELLE A DEMENAGE. Les temoins qui la
 * protegeaient vivent maintenant dans `TrainingSessions.caracterisation.test.js`,
 * a l identique : un comportement qu on deplace doit rester protege pendant le
 * voyage, sinon le demenagement devient une perte silencieuse.
 *
 * CE QUE CE FILET FIGE MAINTENANT :
 *   1. la prochaine seance, en grand, avec SON bouton — et le mot qui change le jour J ;
 *   2. la progression, avec la date de fin CALCULEE sur le telephone ;
 *   3. les portes, et ou elles menent ;
 *   4. le bandeau qui rassure quand des mesures attendent d etre envoyees ;
 *   5. l etat vide, qui garde sa porte de sortie.
 */

/** @type {any} */
let mockEntrainement;
/** @type {any} */
let mockEnAttente = [];

jest.mock('@/hooks/useTraining', () => ({
  useMyTraining: () => mockEntrainement,
}));

jest.mock('@/services/training/trainingLocalStore', () => ({
  getPendingSessions: () => mockEnAttente,
}));

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();

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

jest.mock('react-native-linear-gradient', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => reactActuel.createElement(VueRN, props),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

/** Une date bien dans le futur, pour que le jour J ne se declenche pas tout seul. */
const PLUS_TARD = '2099-09-09';

const SEANCES = [
  {
    day: { code: 'T', title: 'Jour T' },
    documentId: 's1',
    plannedDate: '2026-09-06',
    results: [1, 2, 3],
  },
  {
    day: {
      code: 'A',
      documentId: 'jour-a',
      durationMinutes: 75,
      place: 'salle',
      title: 'Jour A — Structure',
    },
    documentId: 's2',
    plannedDate: PLUS_TARD,
    results: [],
  },
  {
    day: { code: 'B', title: 'Jour B' },
    documentId: 's3',
    plannedDate: '2099-09-20',
    results: [4, 5],
  },
];

const INSCRIT = {
  enrollment: { documentId: 'insc-1', program: { title: 'Football haut niveau' } },
  error: null,
  isLoading: false,
  nextSession: SEANCES[1],
  progress: { done: 1, ratio: 0.125, total: 8 },
  refetch: () => {},
  sessions: SEANCES,
};

/**
 * Monte l ecran et rend l arbre de test.
 * @param {any} [etat] ce que rend le crochet `useMyTraining`
 * @param {any} [navigation] la navigation moquee
 * @param {string[]} [enAttente] les seances qui ont des mesures a envoyer
 * @returns {any} l arbre react-test-renderer
 */
const rendre = (etat = INSCRIT, navigation = { navigate: () => {} }, enAttente = []) => {
  mockEntrainement = etat;
  mockEnAttente = enAttente;
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TrainingPlan navigation={navigation} />);
  });
  return arbre;
};

/**
 * Tout le texte affiche par un arbre, mis a plat.
 * @param {any} arbre l arbre rendu
 * @returns {string[]} les chaines reellement rendues
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  /**
   * Descend dans un noeud rendu et empile chaque chaine rencontree.
   * @param {any} noeud un noeud de l arbre rendu
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

describe('1 — la prochaine seance, en grand, avec son bouton', () => {
  it('annonce QUAND elle est, et de quoi elle parle', () => {
    const vus = textes(rendre());

    expect(vus.some((v) => v.startsWith('training.plan.nextUp'))).toBe(true);
    expect(vus).toContain('Jour A — Structure');
  });

  it('dit le lieu ET la duree — un joueur doit savoir ou aller', () => {
    expect(textes(rendre())).toContain('salle · 75 min');
  });

  it('porte un vrai BOUTON : on ne devine plus quelle rangee toucher', () => {
    expect(textes(rendre())).toContain('training.actions.prepare');
  });

  it('LE JOUR MEME, le mot change : on ne prepare plus, on commence', () => {
    const aujourdHui = new Date();
    const iso = [
      aujourdHui.getFullYear(),
      String(aujourdHui.getMonth() + 1).padStart(2, '0'),
      String(aujourdHui.getDate()).padStart(2, '0'),
    ].join('-');
    const vus = textes(rendre({ ...INSCRIT, nextSession: { ...SEANCES[1], plannedDate: iso } }));

    expect(vus).toContain('training.plan.today');
    expect(vus).toContain('training.actions.startSession');
    // Le raccourci « commencer maintenant » n a plus de sens le jour meme.
    expect(vus).not.toContain('training.actions.startNow');
  });

  it('offre « commencer maintenant » les autres jours', () => {
    expect(textes(rendre())).toContain('training.actions.startNow');
  });

  it('enleve la pression : la date est indicative', () => {
    expect(textes(rendre())).toContain('training.plan.dateHint');
  });

  it('le bouton ouvre LA journee de cette seance, avec ses deux identifiants', () => {
    const navigate = jest.fn();
    const arbre = rendre(INSCRIT, { navigate });
    const boutons = arbre.root.findAllByProps({ title: 'training.actions.prepare' })
      .filter((n) => typeof n.props.onPress === 'function');

    act(() => { boutons[0].props.onPress(); });

    expect(navigate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      dayId: 'jour-a', sessionId: 's2',
    }));
  });
});

describe('2 — ou j en suis', () => {
  it('compte les SEANCES FAITES, et le dit avec le bon mot', () => {
    expect(textes(rendre()).some((v) => v.startsWith('training.plan.progress'))).toBe(true);
  });

  it('annonce la date de FIN, calculee sur le telephone sans rien demander au serveur', () => {
    expect(textes(rendre()).some((v) => v.startsWith('training.plan.endsOn'))).toBe(true);
  });

  it('ne promet aucune fin quand aucune seance n a de date', () => {
    const sansDates = rendre({
      ...INSCRIT,
      sessions: [{ day: { code: 'T' }, documentId: 's1' }],
    });

    expect(textes(sansDates).some((v) => v.startsWith('training.plan.endsOn'))).toBe(false);
  });
});

describe('3 — les portes, et ou elles menent', () => {
  it('la liste des seances est derriere UNE PORTE, plus etalee sur l ecran', () => {
    const vus = textes(rendre());

    expect(vus).toContain('training.plan.days');
    // ⛔ Aucune rangee de journee ne doit rester ici : c est tout l objet du pack.
    expect(vus).not.toContain('Jour T');
    expect(vus).not.toContain('Jour B');
  });

  it('le carnet annonce COMBIEN de mesures il contient', () => {
    // 3 + 0 + 2 = 5 resultats sur les trois seances.
    expect(textes(rendre())).toContain('training.plan.doors.logbookSubtitle|{"count":5}');
  });

  it('chaque porte mene ou elle dit', () => {
    const navigate = jest.fn();
    const arbre = rendre(INSCRIT, { navigate });
    const portes = arbre.root.findAllByType(TouchableOpacity);

    act(() => { portes[portes.length - 2].props.onPress(); });
    act(() => { portes[portes.length - 1].props.onPress(); });

    expect(navigate.mock.calls.map((appel) => appel[0]))
      .toEqual(['TrainingSessions', 'TrainingLogbook']);
  });
});

describe('4 — le bandeau qui rassure', () => {
  it('reste MUET quand rien n attend', () => {
    expect(textes(rendre())).not.toContain('training.plan.offline');
  });

  it('previent des que des mesures attendent d etre envoyees', () => {
    expect(textes(rendre(INSCRIT, { navigate: () => {} }, ['s1'])))
      .toContain('training.plan.offline');
  });
});

describe('5 — sans inscription, l ecran garde une porte de sortie', () => {
  it('propose de choisir un entrainement', () => {
    const arbre = rendre({
      enrollment: null,
      error: null,
      isLoading: false,
      nextSession: null,
      progress: { done: 0, ratio: 0, total: 0 },
      refetch: () => {},
      sessions: [],
    });

    expect(textes(arbre)).toContain('training.plan.empty.action');
    expect(arbre.root.findAllByType(ClubCardSurface)).toHaveLength(0);
  });
});

describe('6 — le squelette de chargement garde la FORME de l ecran', () => {
  it('rend la carcasse pendant le chargement, pas l etat vide', () => {
    // 🪤 `SkeletonLoader` fait scintiller SES ENFANTS. Tant que l ecran ne rendait
    // sa carcasse qu avec une inscription en main, le chargement montrait l etat
    // VIDE en train de scintiller : le squelette ne ressemblait pas a l ecran.
    const arbre = rendre({
      enrollment: null,
      error: null,
      isLoading: true,
      nextSession: null,
      progress: { done: 0, ratio: 0, total: 0 },
      refetch: () => {},
      sessions: [],
    });

    const vus = textes(arbre);
    expect(vus).toContain('training.plan.title');
    expect(vus).toContain('training.plan.days');
    expect(vus).not.toContain('training.plan.empty.action');
  });
});
