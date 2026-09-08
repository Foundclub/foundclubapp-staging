import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import TrainingDay from '../TrainingDay';

/**
 * « LA FICHE D UNE JOURNEE » — FILET DE CARACTERISATION (E6).
 *
 * 🔎 POURQUOI CE FICHIER EXISTE : `TrainingDay.js` n'avait AUCUN test, et le pack
 * de design va le reecrire. La regle du projet est mecanique : sur un fichier sans
 * filet, on ecrit d'abord un temoin qui decrit le comportement ACTUEL, ensuite
 * seulement on touche. Sans lui, rien ne dirait qu'une branche retiree servait.
 *
 * CE QUE CE FILET FIGE — le COMPORTEMENT, jamais la peinture :
 *   1. l'ordre des blocs de l'ecran et la condition d'affichage de chacun ;
 *   2. une ligne par test du jour, et ou mene l'appui dessus ;
 *   3. quel bouton apparait selon l'etat de la seance, et ce qu'il envoie ;
 *   4. quelles sections sont dépliées d'entree et lesquelles sont fermees ;
 *   5. les vides et les absences que l'ecran traverse aujourd'hui SANS rien dire.
 *
 * ⚠️ Deux temoins disent une ABSENCE (pas d'etat vide, pas de message quand la
 * journee est introuvable). Ce n'est pas un oubli du filet : c'est l'information
 * la plus utile a la refonte, parce que l'ecran affiche alors une page blanche.
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

// L'enveloppe de chargement rend ses enfants des que ni erreur ni attente. On la
// double pour observer le CONTENU de l'ecran : c'est elle, et elle seule, qui
// porte le chargement et l'erreur — l'ecran n'en dessine aucun lui-meme.
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

const JOURNEE = {
  documentId: 'jour-b',
  kicker: 'Jour B',
  lead: 'Detente et remise en route',
  logbook: [{ text: 'Note ta sensation du jour', type: 'p' }],
  markers: [
    { label: 'Sommeil', value: 'au moins 7 h' },
    { label: 'Cafe', value: 'aucun le matin' },
  ],
  requiresFreshnessCheck: true,
  tests: [
    {
      code: 'S10', documentId: 't-1', estimatedMinutes: 12, name: 'Sprint 10 metres',
    },
    {
      code: 'CMJ',
      documentId: 't-2',
      estimatedMinutes: 8,
      isOptional: true,
      name: 'Detente verticale',
    },
    { code: 'YOYO', documentId: 't-3', name: 'Yo-Yo intermittent' },
  ],
  timeline: [{ text: 'Echauffement puis blocs', type: 'p' }],
  title: 'Jour B - Detente',
  warmup: [{ text: 'Mobilite des hanches', type: 'p' }],
};

const SEANCE = {
  day: { documentId: 'jour-b' },
  documentId: 'seance-9',
  results: [{ test: { code: 'S10' } }],
  status: 'planned',
};

const INSCRIT = {
  enrollment: { program: { days: [JOURNEE] } },
  error: null,
  isLoading: false,
  refetch: () => {},
  sessions: [SEANCE],
};

const ROUTE = { params: { sessionId: 'seance-9' } };

/**
 * L'etat du crochet pour une journee de catalogue donnee.
 * @param {any} journee la journee que le programme doit contenir
 * @returns {any} ce que rend `useMyTraining`
 */
const avecJournee = (journee) => ({ ...INSCRIT, enrollment: { program: { days: [journee] } } });

// Le signe rendu par une section DEPLIEE est un vrai signe moins mathematique
// (U+2212), pas un tiret d'ecriture : on l'ecrit en code d'echappement pour que
// ce fichier reste lisible et comparable octet pour octet.
const REPLIER = '−';
const DEPLIER = '+';

/**
 * Monte l'ecran et rend l'arbre de test.
 * @param {object} [options] ce qu'on veut faire varier pour ce temoin
 * @param {any} [options.etat] ce que rend le crochet `useMyTraining`
 * @param {any} [options.miseAJour] ce que rend `useUpdateTrainingSession`
 * @param {any} [options.navigation] la navigation moquee
 * @param {any} [options.route] la route et ses parametres
 * @returns {any} l'arbre react-test-renderer
 */
const rendre = ({
  etat = INSCRIT,
  miseAJour = {},
  navigation = {},
  route = ROUTE,
} = {}) => {
  mockEntrainement = etat;
  mockMiseAJour = {
    isPending: false,
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    ...miseAJour,
  };
  const nav = { goBack: jest.fn(), navigate: jest.fn(), ...navigation };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TrainingDay navigation={nav} route={route} />);
  });
  return arbre;
};

/**
 * Tout le texte affiche par un arbre, mis a plat, dans l'ordre de l'ecran.
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

describe('les blocs du haut de la fiche, dans l ordre de l ecran', () => {
  it('rend le chapeau, le titre, l accroche puis la progression, dans CET ordre', () => {
    const vus = textes(rendre());

    // On compare des RANGS, pas des marges : l'ordre est le seul element de
    // presentation qui porte du sens ici (voir l'entete de TrainingDay.js).
    const rang = (/** @type {string} */ debut) => vus.findIndex((v) => v.startsWith(debut));
    expect(rang('Jour B')).toBeGreaterThanOrEqual(0);
    expect(rang('Jour B')).toBeLessThan(rang('Jour B - Detente'));
    expect(rang('Jour B - Detente')).toBeLessThan(rang('Detente et remise'));
    expect(rang('Detente et remise')).toBeLessThan(rang('training.day.progress'));
  });

  it('n affiche NI chapeau NI accroche quand le serveur ne les donne pas', () => {
    const nue = { ...JOURNEE, kicker: '', lead: '' };
    const vus = textes(rendre({ etat: avecJournee(nue) }));

    expect(vus).not.toContain('Jour B');
    expect(vus).not.toContain('Detente et remise en route');
    // Le titre, lui, n'est jamais conditionne : il reste meme vide.
    expect(vus).toContain('Jour B - Detente');
  });

  it('compte dans la progression les tests DEJA faits de la seance', () => {
    // La seance porte un resultat pour S10 : 1 fait sur 3 tests du catalogue.
    expect(textes(rendre())).toContain('training.day.progress|{"count":1,"done":1,"total":3}');
  });

  it('compte ZERO quand la seance n a pas de tableau de resultats', () => {
    const sansResultats = { ...INSCRIT, sessions: [{ ...SEANCE, results: undefined }] };

    expect(textes(rendre({ etat: sansResultats })))
      .toContain('training.day.progress|{"count":0,"done":0,"total":3}');
  });
});

describe('l encart de controle de fraicheur', () => {
  it('apparait quand la journee l exige', () => {
    expect(textes(rendre())).toContain('training.day.freshnessRequired');
  });

  it('disparait completement quand la journee ne l exige pas', () => {
    const sansControle = { ...JOURNEE, requiresFreshnessCheck: false };

    expect(textes(rendre({ etat: avecJournee(sansControle) })))
      .not.toContain('training.day.freshnessRequired');
  });
});

describe('la liste des tests du jour', () => {
  it('rend UNE ligne par test, avec son code, son nom et sa duree', () => {
    const vus = textes(rendre());

    expect(vus).toEqual(expect.arrayContaining([
      'training.day.testsTitle',
      'S10', 'CMJ', 'YOYO',
      'Sprint 10 metres', 'Detente verticale', 'Yo-Yo intermittent',
      // Les durees sont rendues en TEXTE par JSX, jamais en nombre.
      '12', '8',
    ]));
  });

  it('ne marque « facultatif » que le test qui l est', () => {
    expect(textes(rendre()).filter((v) => v === 'training.test.optional')).toHaveLength(1);
  });

  it('n affiche aucune duree quand elle est absente ou vaut zero', () => {
    const aZero = {
      ...JOURNEE,
      tests: [{ code: 'S10', documentId: 't-1', estimatedMinutes: 0 }],
    };
    const vus = textes(rendre({ etat: avecJournee(aZero) }));

    // `Boolean(0)` est faux : ni le nombre ni son unite ne sont rendus.
    expect(vus).not.toContain('0');
    expect(vus).not.toContain(' min');
  });

  it('garde son titre mais reste MUET quand la journee n a aucun test', () => {
    const vide = { ...JOURNEE, tests: [] };
    const arbre = rendre({ etat: avecJournee(vide) });

    // ⚠️ Aucun message d'etat vide : le titre surplombe le neant. C'est le
    // comportement d'AUJOURD HUI, et c'est exactement ce que la refonte devra
    // decider de garder ou de combler.
    expect(textes(arbre)).toContain('training.day.testsTitle');
    expect(textes(arbre)).not.toContain('S10');
  });
});

describe('appuyer sur un test ouvre CE test', () => {
  it('passe le rang du test, l identifiant du jour et celui de la seance', () => {
    const navigate = jest.fn();
    const arbre = rendre({ navigation: { navigate } });

    // Les lignes de test sont les premieres zones cliquables de l'ecran : les
    // entetes de section et le bouton viennent apres.
    act(() => { arbre.root.findAllByType(TouchableOpacity)[1].props.onPress(); });

    expect(navigate).toHaveBeenCalledWith('TrainingTest', {
      dayId: 'jour-b',
      sessionId: 'seance-9',
      testIndex: 1,
    });
  });
});

describe('les sections repliables', () => {
  it('n ouvre d entree QUE les reperes : les trois autres restent fermees', () => {
    const vus = textes(rendre());

    expect(vus.filter((v) => v === REPLIER)).toHaveLength(1);
    expect(vus.filter((v) => v === DEPLIER)).toHaveLength(3);
    // Les reperes sont lisibles tout de suite, la chronologie non.
    expect(vus).toContain('au moins 7 h');
    expect(vus).not.toContain('Echauffement puis blocs');
  });

  it('appuyer sur l entete d une section montre son contenu', () => {
    const arbre = rendre();
    const entetes = arbre.root.findAllByType(TouchableOpacity).slice(JOURNEE.tests.length);

    act(() => { entetes[1].props.onPress(); });

    expect(textes(arbre)).toContain('Echauffement puis blocs');
  });

  it('retire la section des reperes quand la liste est vide, mais garde les trois autres', () => {
    const sansReperes = { ...JOURNEE, markers: [] };
    const vus = textes(rendre({
      etat: avecJournee(sansReperes),
    }));

    expect(vus).not.toContain('training.day.markers');
    expect(vus).toEqual(expect.arrayContaining([
      'training.day.timeline', 'training.day.warmup', 'training.day.logbook',
    ]));
  });

  it('affiche les trois sections MEME sans aucun contenu a y montrer', () => {
    // ⚠️ Piege pour la refonte : `TrainingBlocks` rend `null` sur une liste
    // vide, mais la section, elle, s'affiche quand meme. On peut donc ouvrir
    // un accordeon sur du vide, sans le moindre message.
    const creuse = {
      ...JOURNEE, logbook: [], timeline: undefined, warmup: null,
    };
    const arbre = rendre({ etat: avecJournee(creuse) });
    const entetes = arbre.root.findAllByType(TouchableOpacity).slice(JOURNEE.tests.length);

    act(() => { entetes[1].props.onPress(); });

    expect(textes(arbre)).toContain('training.day.timeline');
  });
});

describe('les boutons de seance', () => {
  it('propose de DEMARRER quand la seance est planifiee', () => {
    const boutons = rendre().root.findAllByType(Button);

    expect(boutons).toHaveLength(1);
    expect(boutons[0].props.title).toBe('training.actions.startDay');
  });

  it('envoie « en cours » au serveur quand on demarre', async () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    const arbre = rendre({ miseAJour: { mutateAsync } });

    await act(async () => { await arbre.root.findAllByType(Button)[0].props.onPress(); });

    expect(mutateAsync).toHaveBeenCalledWith({
      payload: { status: 'in_progress' },
      sessionDocumentId: 'seance-9',
    });
  });

  it('propose de TERMINER quand la seance est en cours, et revient en arriere', async () => {
    const goBack = jest.fn();
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    const enCours = { ...INSCRIT, sessions: [{ ...SEANCE, status: 'in_progress' }] };
    const arbre = rendre({ etat: enCours, miseAJour: { mutateAsync }, navigation: { goBack } });
    const bouton = arbre.root.findAllByType(Button)[0];

    expect(bouton.props.title).toBe('training.actions.finishDay');
    await act(async () => { await bouton.props.onPress(); });

    expect(mutateAsync).toHaveBeenCalledWith({
      payload: { status: 'done' },
      sessionDocumentId: 'seance-9',
    });
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('remplace tout bouton par une phrase quand la seance est deja faite', () => {
    const faite = { ...INSCRIT, sessions: [{ ...SEANCE, status: 'done' }] };
    const arbre = rendre({ etat: faite });

    expect(arbre.root.findAllByType(Button)).toHaveLength(0);
    expect(textes(arbre)).toContain('training.day.alreadyDone');
  });

  it('fait tourner le bouton pendant l envoi', () => {
    const arbre = rendre({ miseAJour: { isPending: true } });

    expect(arbre.root.findAllByType(Button)[0].props.isLoading).toBe(true);
  });

  it('affiche quand meme « demarrer » SANS aucune seance — et il ne fait alors RIEN', async () => {
    // 🪤 Defaut fige tel quel : quand on arrive par `dayId` seul (depuis le
    // catalogue), aucune seance n'existe, le bouton s'affiche pourtant, et
    // `start` sort immediatement faute de `documentId`. Un bouton visible qui
    // n'envoie rien : a trancher a la refonte, pas a corriger ici.
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    const arbre = rendre({
      etat: { ...INSCRIT, sessions: [] },
      miseAJour: { mutateAsync },
      route: { params: { dayId: 'jour-b' } },
    });
    const boutons = arbre.root.findAllByType(Button);

    expect(boutons[0].props.title).toBe('training.actions.startDay');
    await act(async () => { await boutons[0].props.onPress(); });

    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

describe('d ou vient la journee affichee', () => {
  it('suit le `dayId` de la route quand aucune seance ne correspond', () => {
    const arbre = rendre({
      etat: { ...INSCRIT, sessions: [] },
      route: { params: { dayId: 'jour-b' } },
    });

    expect(textes(arbre)).toContain('Jour B - Detente');
  });

  it('retombe sur la journee PORTEE PAR LA SEANCE quand le catalogue ne l a pas', () => {
    // Le programme ne contient pas cette journee : c'est la copie embarquee
    // dans la seance qui sert de secours.
    const secours = {
      ...INSCRIT,
      enrollment: { program: { days: [] } },
      sessions: [{ ...SEANCE, day: { documentId: 'jour-b', title: 'Copie de secours' } }],
    };

    expect(textes(rendre({ etat: secours }))).toContain('Copie de secours');
  });
});

describe('les vides que l ecran traverse sans rien dire', () => {
  it('n affiche ABSOLUMENT RIEN quand la journee est introuvable', () => {
    // ⚠️ Il n'y a NI etat vide NI message d'erreur propre a l'ecran : le
    // contenu vaut `null`, donc l'utilisateur voit une page blanche. Ce temoin
    // existe pour que la refonte sache qu'elle comble un trou, pas qu'elle
    // remplace un message.
    const arbre = rendre({ etat: { ...INSCRIT, enrollment: null, sessions: [] } });

    expect(textes(arbre)).toEqual([]);
    expect(arbre.root.findAllByType(TouchableOpacity)).toHaveLength(0);
    expect(arbre.root.findAllByType(Button)).toHaveLength(0);
  });

  it('tient debout sans route, sans parametres et sans programme', () => {
    const arbre = rendre({
      etat: {
        enrollment: undefined, error: null, isLoading: false, refetch: () => {}, sessions: [],
      },
      route: undefined,
    });

    expect(textes(arbre)).toEqual([]);
  });

  it('tient debout quand le programme rend autre chose qu une liste de journees', () => {
    // 🪤 Mesure du 2026-09-08 : l'ecran ne tombe pas, mais il ne montre pas non
    // plus une page blanche — il retombe sur la copie de journee portee par la
    // seance, qui n'a QUE son identifiant. On obtient une fiche sans titre,
    // avec ses trois sections vides et son bouton « demarrer ». C'est le pire
    // des deux mondes, et la refonte doit le savoir.
    const casse = { ...INSCRIT, enrollment: { program: { days: 'pas-une-liste' } } };
    const vus = textes(rendre({ etat: casse }));

    expect(vus).not.toContain('Jour B - Detente');
    expect(vus).toEqual(expect.arrayContaining([
      'training.day.testsTitle', 'training.actions.startDay',
    ]));
  });

  it('tient debout quand la journee n a aucun tableau de tests', () => {
    const sansTests = { ...JOURNEE, tests: undefined };
    const arbre = rendre({
      etat: avecJournee(sansTests),
    });

    expect(textes(arbre)).toContain('training.day.progress|{"count":1,"done":1,"total":0}');
  });
});

describe('ce que l ecran ne dessine PAS lui-meme', () => {
  it('delegue chargement et erreur a l enveloppe, sans les traiter', () => {
    // Le crochet est en attente ET en erreur : l'ecran rend malgre tout son
    // contenu, parce qu'il ne regarde jamais `isLoading` ni `error`. Ces deux
    // etats appartiennent entierement a `WithDataWrapper`, qui recoit aussi
    // `refetch` pour son bouton de reprise.
    const enPanne = { ...INSCRIT, error: new Error('reseau'), isLoading: true };

    expect(textes(rendre({ etat: enPanne }))).toContain('Jour B - Detente');
  });
});
