import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';
import TrainingProgressBar from '@/components/organisms/training/TrainingProgressBar';

import TrainingSessionNow from '../TrainingSessionNow';

/**
 * « MAINTENANT » — LE FILET DE LA PLACE DU VILLAGE.
 *
 * 🔎 CE QU IL PROTEGE, ET POURQUOI C EST LE PLUS SENSIBLE DE LA SECTION : cet ecran
 * porte UN bouton qui decide tout seul ou reprendre. S il se trompe d une etape, la
 * personne refait un essai deja valide — et ecrase une mesure prise dans de bonnes
 * conditions par une mesure prise fatiguee. C est une perte de donnee silencieuse.
 *
 * 🔎 CE QU IL FIGE :
 *   1. la carte « Maintenant » dit l etape en cours, avec son numero d essai ;
 *   2. l avancement se compte en ETAPES, pas en tests — un test de douze essais
 *      resterait « pas fait » pendant quarante minutes ;
 *   3. la frise porte un fil, trois etats, et chaque pastille mene ailleurs SELON
 *      son etat ;
 *   4. le pied ne quitte jamais le defilement, et « Terminer » ramene a la fiche.
 */

/** @type {any} */
let mockEntrainement;
/** @type {any} */
let mockMiseAJour;

jest.mock('@/hooks/useTraining', () => ({
  useMyTraining: () => mockEntrainement,
  useUpdateTrainingSession: () => mockMiseAJour,
}));

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = couleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyle(Colors),
      Colors,
      Fonts: genererPolices(Colors),
      Images: { chevronDown: 1 },
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

const JOURNEE = {
  code: 'B',
  documentId: 'jour-b',
  place: 'SALLE',
  tests: [
    {
      code: 'B1',
      measures: [
        { attempts: 2, key: 'haut', moment: 'terrain' },
        { attempts: 1, key: 'masse', moment: 'terrain' },
      ],
      name: 'Squat Jump',
    },
    {
      code: 'B2',
      measures: [{ attempts: 1, key: 'temps', moment: 'terrain' }],
      name: 'CMJ',
    },
  ],
  title: 'Jour B',
};

const SEANCE = {
  day: { documentId: 'jour-b' },
  documentId: 'seance-9',
  plannedDate: '2026-09-09',
  results: [],
  status: 'in_progress',
};

const INSCRIT = {
  enrollment: { program: { days: [JOURNEE] } },
  error: null,
  isLoading: false,
  refetch: () => {},
  sessions: [SEANCE],
};

/**
 * Monte l ecran.
 * @param {object} [options] ce qu on fait varier
 * @param {any} [options.miseAJour] ce que rend `useUpdateTrainingSession`
 * @param {any} [options.navigation] la navigation moquee
 * @param {any} [options.seance] la seance affichee
 * @returns {any} l arbre rendu
 */
const rendre = ({ miseAJour = {}, navigation = {}, seance = SEANCE } = {}) => {
  mockEntrainement = { ...INSCRIT, sessions: [seance] };
  mockMiseAJour = {
    isPending: false,
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    ...miseAJour,
  };
  const nav = { goBack: jest.fn(), navigate: jest.fn(), ...navigation };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <TrainingSessionNow navigation={nav} route={{ params: { sessionId: 'seance-9' } }} />,
    );
  });
  return arbre;
};

/**
 * Tout le texte affiche, a plat.
 * @param {any} arbre l arbre rendu
 * @returns {string[]} les chaines rendues
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  /**
   * Descend dans un noeud et empile ses chaines.
   * @param {any} noeud un noeud rendu
   * @returns {void} rien
   */
  const parcourir = (noeud) => {
    if (typeof noeud === 'string') { sortie.push(noeud); return; }
    if (Array.isArray(noeud)) { noeud.forEach(parcourir); return; }
    if (noeud && noeud.children) noeud.children.forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

/**
 * Les pastilles de la frise.
 * @param {any} arbre l arbre rendu
 * @returns {any[]} les pastilles, dans l ordre
 */
const pastilles = (arbre) => arbre.root.findAll((n) => n.type === TouchableOpacity
  && n.props.accessibilityState?.selected !== undefined);

/**
 * Une ligne de resultat.
 * @param {string} code le code du test
 * @param {number} essai le numero d essai
 * @param {string} clef la mesure
 * @returns {Record<string, any>} la ligne
 */
const ligne = (code, essai, clef) => ({ attempt: essai, measureKey: clef, test: { code } });

describe('la carte « Maintenant »', () => {
  it('dit l etape en cours, avec son numero d essai', () => {
    const arbre = rendre({
      seance: { ...SEANCE, results: [ligne('B1', 1, 'haut'), ligne('B1', 1, 'masse')] },
    });
    const vus = textes(arbre);

    expect(vus).toContain('training.now.label');
    // 🐞 LE CODE DU TEST, PAS SON TITRE — defaut vu a l ecran le 2026-09-08. La ligne
    // etant coupee a UNE ligne, un titre long noyait le suffixe qui distingue les
    // etapes : « Calibrations camera — 10 min, pendant ton echauffement — mise en
    // place » et « … — essai 1 sur 3 » s affichaient RIGOUREUSEMENT identiques. Le
    // titre est desormais rendu tel quel sur une SECONDE ligne.
    expect(vus).toContain('training.now.step.attempt|{"current":2,"test":"B1","total":2}');
    expect(vus).toContain('Squat Jump');
  });

  it('commence par la MISE EN PLACE quand rien n a ete saisi', () => {
    const vus = textes(rendre());

    expect(vus).toContain('training.now.step.prep|{"test":"B1"}');
    expect(vus).toContain('Squat Jump');
  });

  it('dit que tout est fait quand il ne reste rien', () => {
    const arbre = rendre({
      seance: {
        ...SEANCE,
        results: [
          ligne('B1', 1, 'haut'), ligne('B1', 1, 'masse'), ligne('B1', 2, 'haut'),
          ligne('B2', 1, 'temps'),
        ],
      },
    });

    expect(textes(arbre)).toContain('training.now.allDone');
  });
});

describe('l avancement se compte en ETAPES', () => {
  it('annonce les etapes ET les tests entierement finis, separement', () => {
    // 🪤 Un test de douze essais reste « pas fait » pendant quarante minutes : un
    // compteur en tests laisserait la barre a plat pendant qu on travaille.
    const arbre = rendre({
      seance: { ...SEANCE, results: [ligne('B1', 1, 'haut'), ligne('B1', 1, 'masse')] },
    });

    // 5 etapes en tout (B1 : prep + 2 essais ; B2 : prep + 1 essai), 2 faites.
    // 🐞 `count` vaut 1 quand rien n est fait : en francais zero prend le SINGULIER,
    // et le moteur du telephone applique la regle anglaise. Cf. `accordFrancais`.
    expect(textes(arbre)).toContain(
      'training.now.progress|{"count":1,"done":2,"tests":0,"total":5}',
    );
  });

  it('dessine la barre a la meme hauteur', () => {
    const arbre = rendre({
      seance: { ...SEANCE, results: [ligne('B1', 1, 'haut'), ligne('B1', 1, 'masse')] },
    });

    expect(arbre.root.findByType(TrainingProgressBar).props.ratio).toBeCloseTo(2 / 5);
  });
});

describe('la frise « La suite, dans l ordre »', () => {
  it('porte une pastille par etape, dans l ordre', () => {
    expect(pastilles(rendre())).toHaveLength(5);
  });

  it('marque EN COURS une seule pastille, jamais deux', () => {
    const arbre = rendre({ seance: { ...SEANCE, results: [ligne('B1', 1, 'haut')] } });
    const enCours = pastilles(arbre).filter((p) => p.props.accessibilityState.selected);

    expect(enCours).toHaveLength(1);
  });

  it('ouvre une etape FAITE sur son explication, les autres sur le PARCOURS', () => {
    // On revient sur un essai deja fait pour COMPRENDRE un resultat, pas pour le
    // refaire : l ouvrir sur la saisie inviterait a ecraser une mesure valide.
    // Le reste passe par le parcours guide, qui enchaine la mise en place,
    // l echauffement, l essai et sa recuperation sans demander « et maintenant ? ».
    const navigate = jest.fn();
    const arbre = rendre({
      navigation: { navigate },
      seance: { ...SEANCE, results: [ligne('B1', 1, 'haut'), ligne('B1', 1, 'masse')] },
    });

    act(() => { pastilles(arbre)[1].props.onPress(); });
    expect(navigate).toHaveBeenCalledWith('TrainingTest', expect.objectContaining({
      tab: 'learn',
      testIndex: 0,
    }));

    act(() => { pastilles(arbre)[4].props.onPress(); });
    expect(navigate).toHaveBeenCalledWith('TrainingGuided', expect.objectContaining({
      step: 'attempt-1',
      testIndex: 1,
    }));
  });
});

describe('l unique bouton qui sait ou reprendre', () => {
  it('nomme le test ET l essai a reprendre', () => {
    const arbre = rendre({
      seance: { ...SEANCE, results: [ligne('B1', 1, 'haut'), ligne('B1', 1, 'masse')] },
    });

    expect(arbre.root.findAllByType(Button)[0].props.title)
      .toBe('training.now.resume|{"test":"B1","what":'
        + '"training.now.resumeAttempt|{\\"count\\":2}"}');
  });

  it('mene EXACTEMENT a l etape en cours', () => {
    const navigate = jest.fn();
    const arbre = rendre({
      navigation: { navigate },
      seance: { ...SEANCE, results: [ligne('B1', 1, 'haut'), ligne('B1', 1, 'masse')] },
    });

    act(() => { arbre.root.findAllByType(Button)[0].props.onPress(); });

    expect(navigate).toHaveBeenCalledWith('TrainingGuided', expect.objectContaining({
      step: 'attempt-2',
      testIndex: 0,
    }));
  });

  it('s eteint quand il n y a plus rien a reprendre', () => {
    const arbre = rendre({
      seance: {
        ...SEANCE,
        results: [
          ligne('B1', 1, 'haut'), ligne('B1', 1, 'masse'), ligne('B1', 2, 'haut'),
          ligne('B2', 1, 'temps'),
        ],
      },
    });

    expect(arbre.root.findAllByType(Button)[0].props.disabled).toBe(true);
  });
});

describe('l entete et le pied', () => {
  it('donne la date, le lieu en minuscules, et le temps ECOULE', () => {
    const arbre = rendre({
      seance: { ...SEANCE, startedAt: new Date(Date.now() - 33 * 60000).toISOString() },
    });
    const vus = textes(arbre);

    expect(vus.some((v) => String(v).includes('9 sept.'))).toBe(true);
    expect(vus.some((v) => String(v).includes('salle'))).toBe(true);
    expect(vus).toContain('training.now.elapsed|{"count":33}');
  });

  it('se tait sur le temps ecoule quand la seance n a pas d heure de depart', () => {
    const vus = textes(rendre());

    expect(vus.some((v) => String(v).startsWith('training.now.elapsed'))).toBe(false);
  });

  it('« Terminer » enregistre ET ramene a la fiche de la journee', async () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    const navigate = jest.fn();
    const arbre = rendre({ miseAJour: { mutateAsync }, navigation: { navigate } });

    await act(async () => { arbre.root.findAllByType(Button)[1].props.onPress(); });

    expect(mutateAsync).toHaveBeenCalledWith({
      payload: { status: 'done' },
      sessionDocumentId: 'seance-9',
    });
    expect(navigate).toHaveBeenCalledWith('TrainingDay', { sessionId: 'seance-9' });
  });

  it('pose la phrase qui dit a quoi sert l ecran', () => {
    expect(textes(rendre())).toContain('training.now.hint');
  });
});

describe('ce qui ne doit rien faire tomber', () => {
  it('traverse une journee introuvable', () => {
    expect(() => rendre({
      seance: { documentId: 'seance-9' },
    })).not.toThrow();
  });
});
