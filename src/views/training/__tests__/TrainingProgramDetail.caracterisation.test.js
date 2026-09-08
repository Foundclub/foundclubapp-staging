import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import TrainingProgramDetail from '../TrainingProgramDetail';

/**
 * « LA FICHE D'UN PROGRAMME » — FILET DE CARACTERISATION (E6).
 *
 * 🔎 POURQUOI CE FICHIER EXISTE : l'ecran n'avait AUCUN test et le pack de design
 * va le reecrire. La regle du projet est mecanique : sur un fichier sans filet, on
 * ecrit d'abord un temoin qui decrit le comportement ACTUEL, ensuite on touche.
 * Sans lui, rien ne dirait qu'une branche retiree servait.
 *
 * CE QUE CE FILET FIGE — le COMPORTEMENT, jamais la peinture :
 *   1. l'ordre des blocs de la fiche, et la CONDITION qui fait vivre chacun ;
 *   2. les trois valeurs par defaut silencieuses (0 journee, 0 test, niveau
 *      « intermediaire ») : elles evitent une fiche trouee quand le serveur est
 *      avare, et une refonte qui les oublie casserait un cas reel ;
 *   3. la liste des journees, dans l'ordre rendu par le serveur ;
 *   4. le SEUL bouton de l'ecran, et les deux visages qu'il prend : « choisir »
 *      quand on n'est pas inscrit, « reprendre » quand ce programme est deja le
 *      notre ;
 *   5. ou mene ce bouton, et ce qu'il envoie au serveur ;
 *   6. le message d'echec, qui est le seul retour visible quand l'inscription
 *      rate — et le fait qu'un second essai l'efface avant de repartir ;
 *   7. les etats chargement / erreur, qui ne sont PAS ecrits ici : ils sont
 *      DELEGUES a `WithDataWrapper`. Le temoin le prouve en lisant ce qu'on lui
 *      passe, pour qu'une refonte qui reecrirait ces etats a la main se voie.
 *
 * ⛔ CE QUE LE FILET DIT D'ABSENT, et c'est une information, pas un oubli : quand
 * le serveur ne rend AUCUN programme, l'ecran affiche une page BLANCHE — pas de
 * message, pas de bouton, aucune porte de sortie. Un temoin le fige exprès pour
 * que la refonte le corrige sciemment plutot que par hasard.
 */

/** @type {any} */
let mockProgramme;
/** @type {any} */
let mockInscription;
/** @type {any} */
let mockChoix;
/** @type {any} */
let mockDepart = { isError: false, isPending: false, mutate: jest.fn() };
/** @type {any} */
let mockIdentifiantDemande;
/** @type {any} */
let mockPropsEnveloppe;

jest.mock('@/hooks/useTraining', () => ({
  useChooseTrainingProgram: () => mockChoix,
  useLeaveTrainingProgram: () => mockDepart,
  useMyTraining: () => mockInscription,
  useTrainingProgram: (/** @type {any} */ identifiant) => {
    // On garde l'identifiant demande : c'est la SEULE preuve que la fiche lit
    // bien `route.params.programId` et pas autre chose.
    mockIdentifiantDemande = identifiant;
    return mockProgramme;
  },
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
// paquets transpiles) : on le remplace par une vue ordinaire.
jest.mock('react-native-linear-gradient', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => reactActuel.createElement(VueRN, props),
  };
});

// Le gabarit d'ecran pose un fond et des marges : rien a observer ici, et il
// tire des dependances natives (degrade, image de fond).
// La feuille du bas tire le module natif des gestes, que Jest ne transpile pas.
// On la remplace par une vue qui ne rend ses enfants QUE lorsqu elle est visible.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, isVisible }) => (
      isVisible ? reactActuel.createElement(VueRN, { testID: 'feuille' }, children) : null
    ),
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

// L'enveloppe de chargement est REMPLACEE, mais on note ce qu'on lui passe :
// c'est elle qui porte les etats « chargement » et « erreur » de cet ecran, et
// le seul moyen de prouver la delegation est de lire ses props.
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockPropsEnveloppe = props;
      return reactActuel.createElement(VueRN, null, props.children);
    },
  };
});

const JOURNEES = [
  {
    code: 'T',
    documentId: 'jour-t',
    durationMinutes: 160,
    place: 'terrain',
    tests: [{}, {}, {}],
    title: 'Jour T - Technique et calibrations',
  },
  {
    code: 'A',
    documentId: 'jour-a',
    durationMinutes: 75,
    place: 'salle',
    tests: [{}],
    title: 'Jour A - Structure et mobilite',
  },
  {
    code: 'B',
    documentId: 'jour-b',
    durationMinutes: 120,
    place: 'salle',
    tests: [],
    title: 'Jour B - Detente',
  },
];

const PROGRAMME = {
  days: JOURNEES,
  equipmentSummary: 'Un chronometre, 4 plots, un metre',
  level: 'avance',
  sessionsCount: 8,
  subtitle: 'Six semaines, trois seances',
  summary: 'Le programme qui remet en jambes apres la treve',
  testsCount: 12,
  title: 'Football haut niveau',
};

const PROGRAMME_CHARGE = {
  data: PROGRAMME, error: null, isLoading: false, refetch: () => {},
};

/**
 * Monte la fiche et rend l'arbre de test.
 * @param {any} [options] ce qu'on veut faire varier
 * @param {any} [options.choix] la mutation d'inscription moquee
 * @param {any} [options.inscription] ce que rend le crochet `useMyTraining`
 * @param {any} [options.navigation] la navigation moquee
 * @param {any} [options.programme] ce que rend le crochet `useTrainingProgram`
 * @param {any} [options.route] la route et ses parametres
 * @returns {any} l'arbre react-test-renderer
 */
const rendre = ({
  choix = { isPending: false, mutateAsync: async () => ({}) },
  inscription = { enrollment: null },
  navigation = { navigate: () => {} },
  programme = PROGRAMME_CHARGE,
  route = { params: { programId: 'prog-1' } },
} = {}) => {
  mockChoix = choix;
  mockInscription = inscription;
  mockProgramme = programme;
  mockIdentifiantDemande = undefined;
  mockPropsEnveloppe = undefined;
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <TrainingProgramDetail navigation={navigation} route={route} />,
    );
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

describe('la fiche montre le programme designe par la route', () => {
  it('demande au serveur le programme nomme dans les parametres de la route', () => {
    rendre();

    expect(mockIdentifiantDemande).toBe('prog-1');
  });

  it('affiche le titre, le sous-titre et le resume', () => {
    const vus = textes(rendre());

    expect(vus).toEqual(expect.arrayContaining([
      'Football haut niveau',
      'Six semaines, trois seances',
      'Le programme qui remet en jambes apres la treve',
    ]));
  });

  it('affiche les trois chiffres du bandeau : journees, tests, niveau', () => {
    const vus = textes(rendre());

    expect(vus).toEqual(expect.arrayContaining([
      'training.program.days|{"count":8}',
      'training.program.tests|{"count":12}',
      'training.program.level.avance',
    ]));
  });

  it('affiche le materiel exige avec son intitule', () => {
    const vus = textes(rendre());

    expect(vus).toEqual(expect.arrayContaining([
      'training.program.equipment',
      'Un chronometre, 4 plots, un metre',
    ]));
  });
});

describe('les blocs facultatifs disparaissent au lieu d afficher du vide', () => {
  it('sans sous-titre, sans resume et sans materiel, la fiche tient debout', () => {
    // 🪤 Le garde est `Boolean(...)`, pas `&&` nu : une chaine vide ne doit pas
    // laisser une ligne fantome. On monte donc l'avarice MAXIMALE du serveur.
    const maigre = {
      ...PROGRAMME_CHARGE,
      data: { days: [], title: 'Programme nu' },
    };
    const vus = textes(rendre({ programme: maigre }));

    expect(vus).toContain('Programme nu');
    expect(vus).not.toContain('training.program.equipment');
    expect(vus).not.toContain('Six semaines, trois seances');
  });

  it('remplace les chiffres absents par zero et le niveau par « intermediaire »', () => {
    // Ces trois valeurs par defaut sont du comportement, pas de la decoration :
    // sans elles la fiche afficherait « undefined » a trois endroits.
    const maigre = {
      ...PROGRAMME_CHARGE,
      data: { days: [], title: 'Programme nu' },
    };
    const vus = textes(rendre({ programme: maigre }));

    expect(vus).toEqual(expect.arrayContaining([
      'training.program.days|{"count":0}',
      'training.program.tests|{"count":0}',
      'training.program.level.intermediaire',
    ]));
  });

  it('garde le titre « ce que contient le programme » meme sans aucune journee', () => {
    // 🪤 L'intitule n'est PAS conditionne par la liste : un programme sans
    // journee affiche donc un titre de section suivi de rien.
    const maigre = {
      ...PROGRAMME_CHARGE,
      data: { days: [], title: 'Programme nu' },
    };

    expect(textes(rendre({ programme: maigre }))).toContain('training.program.contains');
  });
});

describe('la liste des journees', () => {
  it('rend une ligne par journee, dans l ordre rendu par le serveur', () => {
    const codes = textes(rendre()).filter((v) => ['A', 'B', 'T'].includes(v));

    expect(codes).toEqual(['T', 'A', 'B']);
  });

  it('resume chaque journee en une ligne : lieu, duree, nombre de tests', () => {
    // La ligne est assemblee AVANT le rendu (`join`), elle arrive donc en UNE
    // seule chaine. C'est ce format qu'une refonte en trois pastilles casserait.
    const vus = textes(rendre());

    expect(vus).toContain('terrain · 160 min · training.program.tests|{"count":3}');
    expect(vus).toContain('salle · 120 min · training.program.tests|{"count":0}');
  });

  it('saute les morceaux manquants sans laisser de separateur orphelin', () => {
    const sansLieuNiDuree = {
      ...PROGRAMME_CHARGE,
      data: { ...PROGRAMME, days: [{ code: 'X', documentId: 'jour-x', title: 'Jour X' }] },
    };
    const vus = textes(rendre({ programme: sansLieuNiDuree }));

    expect(vus).toContain('training.program.tests|{"count":0}');
    expect(vus).not.toContain(' · ');
  });

  it('ne tombe pas quand le serveur rend autre chose qu une liste de journees', () => {
    // 🪤 `days` est passe au tamis `Array.isArray` : un objet, une chaine ou
    // l'absence pure donnent une liste vide, jamais une exception.
    const casseur = { ...PROGRAMME_CHARGE, data: { ...PROGRAMME, days: null } };

    expect(textes(rendre({ programme: casseur }))).toContain('Football haut niveau');
  });
});

describe('le bouton : un seul, et deux visages', () => {
  it('sans inscription, propose de choisir ce programme et annonce le depart du jour', () => {
    const arbre = rendre();
    const boutons = arbre.root.findAllByType(Button);

    expect(boutons).toHaveLength(1);
    expect(boutons[0].props.title).toBe('training.actions.choose');
    expect(textes(arbre)).toContain('training.program.startsToday');
  });

  it('quand ce programme est deja le notre, propose de le reprendre', () => {
    const arbre = rendre({
      inscription: { enrollment: { program: { documentId: 'prog-1' } } },
    });
    const boutons = arbre.root.findAllByType(Button);

    // Deux boutons : « Reprendre », puis le depart SOUS lui, en rouge et plus
    // discret — un geste qu on doit pouvoir trouver, jamais faire par erreur.
    expect(boutons.map((b) => b.props.title)).toEqual([
      'training.actions.resume', 'training.actions.abandon',
    ]);
    expect(boutons[1].props.variant).toBe('Danger');
    // La mention « ca commence aujourd hui » n'a plus de sens : elle disparait.
    expect(textes(arbre)).not.toContain('training.program.startsToday');
  });

  it('quand on suit un AUTRE programme, propose quand meme de choisir celui-ci', () => {
    const arbre = rendre({
      inscription: { enrollment: { program: { documentId: 'prog-9' } } },
    });

    expect(arbre.root.findAllByType(Button)[0].props.title).toBe('training.actions.choose');
  });

  it('grise le bouton pendant que l inscription est en vol', () => {
    const arbre = rendre({
      choix: { isPending: true, mutateAsync: async () => ({}) },
    });

    expect(arbre.root.findAllByType(Button)[0].props.isLoading).toBe(true);
  });
});

describe('choisir le programme', () => {
  it('envoie l identifiant du programme au serveur, puis file vers le plan', async () => {
    const mutateAsync = jest.fn(async () => ({}));
    const navigate = jest.fn();
    const arbre = rendre({ choix: { isPending: false, mutateAsync }, navigation: { navigate } });

    await act(async () => { arbre.root.findAllByType(Button)[0].props.onPress(); });

    expect(mutateAsync).toHaveBeenCalledWith({ programDocumentId: 'prog-1' });
    expect(navigate).toHaveBeenCalledWith('TrainingPlan');
  });

  it('affiche un message d echec et NE NAVIGUE PAS quand le serveur refuse', async () => {
    const navigate = jest.fn();
    const arbre = rendre({
      choix: { isPending: false, mutateAsync: async () => { throw new Error('non'); } },
      navigation: { navigate },
    });

    await act(async () => { arbre.root.findAllByType(Button)[0].props.onPress(); });

    expect(textes(arbre)).toContain('training.catalog.error.description');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('efface le message d echec des qu on retente, avant meme la reponse', async () => {
    // 🔎 Le `setFailed(false)` en tete de `onChoose` est la seule chose qui
    // empeche un message rouge de survivre a une reussite. Une refonte qui le
    // deplace laisserait l echec colle a l ecran.
    let doitEchouer = true;
    const mutateAsync = jest.fn(async () => {
      if (doitEchouer) throw new Error('non');
      return {};
    });
    const arbre = rendre({ choix: { isPending: false, mutateAsync } });

    await act(async () => { arbre.root.findAllByType(Button)[0].props.onPress(); });
    expect(textes(arbre)).toContain('training.catalog.error.description');

    doitEchouer = false;
    await act(async () => { arbre.root.findAllByType(Button)[0].props.onPress(); });

    expect(textes(arbre)).not.toContain('training.catalog.error.description');
  });

  it('reprendre mene au plan sans rien demander au serveur', async () => {
    const mutateAsync = jest.fn(async () => ({}));
    const navigate = jest.fn();
    const arbre = rendre({
      choix: { isPending: false, mutateAsync },
      inscription: { enrollment: { program: { documentId: 'prog-1' } } },
      navigation: { navigate },
    });

    await act(async () => { arbre.root.findAllByType(Button)[0].props.onPress(); });

    expect(navigate).toHaveBeenCalledWith('TrainingPlan');
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

describe('chargement, erreur, et le vide qui n a personne pour le remplir', () => {
  it('confie le chargement et l erreur a l enveloppe, avec de quoi reessayer', () => {
    const refetch = jest.fn();
    rendre({
      programme: {
        data: null, error: new Error('reseau'), isLoading: true, refetch,
      },
    });

    // L'ecran n'ecrit AUCUN de ces deux etats lui-meme : il les passe.
    expect(mockPropsEnveloppe.isLoading).toBe(true);
    expect(mockPropsEnveloppe.error).toBeInstanceOf(Error);
    expect(mockPropsEnveloppe.onRetry).toBe(refetch);
  });

  it('⛔ n affiche RIEN quand le serveur ne rend aucun programme : page blanche', () => {
    // Ce temoin fige un MANQUE, et c'est voulu : sans programme, l'ecran rend
    // `null`. Ni message, ni bouton, ni porte de sortie. C'est le defaut le plus
    // cher a corriger dans la refonte, et le seul que rien ne signalait.
    const arbre = rendre({
      programme: {
        data: null, error: null, isLoading: false, refetch: () => {},
      },
    });

    expect(textes(arbre)).toEqual([]);
    expect(arbre.root.findAllByType(Button)).toHaveLength(0);
  });

  it('ne tombe pas quand la route est absente : rien n est demande au serveur', () => {
    const arbre = rendre({
      programme: {
        data: null, error: null, isLoading: false, refetch: () => {},
      },
      route: null,
    });

    expect(mockIdentifiantDemande).toBeUndefined();
    expect(textes(arbre)).toEqual([]);
  });

  it('🪤 sans identifiant de route, une fiche chargee se croit DEJA choisie', () => {
    // Piege latent, fige tel quel : la comparaison est `enrollment?.program
    // ?.documentId === programId`. Les deux valant `undefined`, l'egalite est
    // VRAIE, et l'ecran propose « reprendre » a quelqu'un qui n'est inscrit a
    // rien. Aujourd hui la requete est desactivee sans identifiant, donc le cas
    // reste hors d atteinte — mais toute refonte qui alimente la fiche autrement
    // (cache, donnee passee en parametre) le rendrait visible.
    const arbre = rendre({ inscription: { enrollment: null }, route: {} });

    expect(arbre.root.findAllByType(Button)[0].props.title).toBe('training.actions.resume');
  });
});

/**
 * 🔴 QUITTER UN ENTRAINEMENT — le geste qu on doit pouvoir trouver, et jamais
 * faire par erreur.
 *
 * 🪤 CE QUI EXISTAIT AVANT : la commande de depart attendait dans les crochets,
 * SANS AUCUN APPELANT, et les trois phrases de la feuille etaient ecrites dans
 * le fichier des mots depuis le debut — titre, phrase qui rassure, deux boutons
 * — sans qu aucun ecran ne les affiche jamais.
 */
describe('quitter cet entrainement', () => {
  /** L ecran, avec ce programme deja suivi. */
  const suivi = () => rendre({
    inscription: { enrollment: { program: { documentId: 'prog-1' } } },
  });

  it('la feuille reste FERMEE tant qu on ne la demande pas', () => {
    expect(suivi().root.findAllByProps({ testID: 'feuille' })).toHaveLength(0);
  });

  it('elle s ouvre sur le bouton rouge, et RASSURE avant tout', () => {
    const arbre = suivi();
    const depart = arbre.root.findAllByType(Button)
      .find((b) => b.props.title === 'training.actions.abandon');

    act(() => { depart.props.onPress(); });

    const vus = textes(arbre);
    expect(vus).toContain('training.plan.abandonConfirm.title');
    // C est LE role de cet ecran : personne ne quitte s il craint de perdre
    // ce qu il a deja mesure.
    expect(vus).toContain('training.plan.abandonConfirm.description');
    expect(vus).toContain('training.plan.abandonConfirm.confirm');
    expect(vus).toContain('training.plan.abandonConfirm.cancel');
  });

  it('« Non, je continue » referme la feuille et ne touche a rien', () => {
    const arbre = suivi();
    act(() => {
      arbre.root.findAllByType(Button)
        .find((b) => b.props.title === 'training.actions.abandon').props.onPress();
    });
    act(() => {
      arbre.root.findAllByType(Button)
        .find((b) => b.props.title === 'training.plan.abandonConfirm.cancel').props.onPress();
    });

    expect(arbre.root.findAllByProps({ testID: 'feuille' })).toHaveLength(0);
    expect(mockDepart.mutate).not.toHaveBeenCalled();
  });

  it('« Oui, quitter » BRANCHE enfin la commande qui attendait sans appelant', () => {
    const arbre = suivi();
    act(() => {
      arbre.root.findAllByType(Button)
        .find((b) => b.props.title === 'training.actions.abandon').props.onPress();
    });
    act(() => {
      arbre.root.findAllByType(Button)
        .find((b) => b.props.title === 'training.plan.abandonConfirm.confirm').props.onPress();
    });

    expect(mockDepart.mutate).toHaveBeenCalled();
  });

  it('si le serveur refuse, une ligne rouge le DIT', () => {
    mockDepart = { isError: true, isPending: false, mutate: jest.fn() };
    const arbre = suivi();
    act(() => {
      arbre.root.findAllByType(Button)
        .find((b) => b.props.title === 'training.actions.abandon').props.onPress();
    });

    expect(textes(arbre)).toContain('training.plan.abandonConfirm.failed');
    mockDepart = { isError: false, isPending: false, mutate: jest.fn() };
  });
});
