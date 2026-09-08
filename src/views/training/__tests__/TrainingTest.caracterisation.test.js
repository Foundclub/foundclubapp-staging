import { TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';

import TrainingTest from '../TrainingTest';

/**
 * LA FICHE D'UN TEST — FILET DE CARACTERISATION (E6).
 *
 * POURQUOI CE FICHIER EXISTE : `TrainingTest.js` fait 424 lignes et n'avait
 * AUCUN test. Le pack de design le reecrit. La regle du projet est mecanique :
 * sur un fichier sans filet, on ecrit d'abord un temoin qui decrit le
 * comportement ACTUEL, ensuite seulement on touche. Sans lui, rien ne dira
 * qu'une branche retiree servait.
 *
 * CE QUE CE FILET FIGE — du COMPORTEMENT, jamais de la peinture :
 *   1. la chaine qui mene AU test affiche (seance -> journee -> tests[index]) ;
 *   2. les deux onglets « Faire » / « Comprendre » et ce que chacun montre ;
 *   3. la minuterie de recuperation : 8 durees, 2 min par defaut ;
 *   4. la saisie d'une mesure et le bouton « essai nul » ;
 *   5. l'envoi differe : le bloc « en attente » et ses deux echecs ;
 *   6. la navigation entre tests et la sortie de l'ecran ;
 *   7. LES ETATS — et surtout celui qui MANQUE : quand le test est introuvable,
 *      l'ecran rend une PAGE BLANCHE. C'est le temoin le plus important du
 *      fichier, parce que c'est ce que la refonte doit reparer.
 */

/** @type {any} */
let mockEntrainement;
/** @type {any} */
let mockCarnet;

jest.mock('@/hooks/useTraining', () => ({
  useMyTraining: () => mockEntrainement,
  useTrainingResults: () => mockCarnet,
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
// paquets transpiles) : on le remplace par une vue.
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

// L'enveloppe rend TOUJOURS ses enfants ici, meme en chargement ou en erreur :
// c'est voulu. Les etats de chargement et d'erreur ne sont PAS ecrits par cet
// ecran, il les delegue entierement. On veut donc pouvoir lire ce qu'il lui
// passe (temoin « les etats sont delegues ») sans que l'enveloppe nous cache
// le reste de l'ecran.
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

/**
 * Le test le plus complet du programme : il porte les quatre rubriques de
 * contenu, des liens, et les TROIS familles de mesures.
 *
 * Les mesures sont volontairement dans le DESORDRE (contexte, calcule,
 * performance) : l'ecran doit les reordonner, et c'est ce qu'un temoin verifie.
 */
const TEST_SPRINT = {
  code: 'T1',
  documentId: 'test-sprint',
  invalidIf: [{ text: 'Depart anticipe', type: 'p' }],
  links: [{ title: 'La video du geste', url: 'https://exemple.test/sprint' }],
  measures: [
    {
      group: 'contexte', key: 'surface', label: 'Surface', type: 'text',
    },
    {
      computed: true,
      formula: '10 / temps10m',
      group: 'calcule',
      key: 'vitesse',
      label: 'Vitesse',
      unit: 'm/s',
    },
    {
      attempts: 2,
      group: 'performance',
      key: 'temps10m',
      label: 'Temps 10 m',
      max: 5,
      min: 1,
      type: 'decimal',
      unit: 's',
    },
  ],
  name: 'Sprint 10 metres',
  protocol: [{ text: 'Deux essais, 3 minutes de recuperation', type: 'p' }],
  reading: [{ text: 'Comparer au repere de la categorie', type: 'p' }],
  setup: [{ text: 'Deux plots a 10 metres', type: 'p' }],
  why: [{ text: 'Mesurer l acceleration', type: 'p' }],
};

/** Le test le plus PAUVRE possible : aucune rubrique, aucune mesure, aucun lien. */
const TEST_NORDIC = {
  code: 'T2',
  documentId: 'test-nordic',
  measures: [],
  name: 'Nordic hamstring',
};

const SEANCE = { day: { documentId: 'jour-t' }, documentId: 'seance-1', results: [] };

const INSCRIT = {
  enrollment: {
    program: { days: [{ documentId: 'jour-t', tests: [TEST_SPRINT, TEST_NORDIC] }] },
  },
  error: null,
  isLoading: false,
  refetch: () => {},
  sessions: [SEANCE],
};

/**
 * Un carnet local neutre : rien en attente, rien de deja saisi.
 * @returns {any} le carnet moque, avec ses fonctions espionnees
 */
const carnetNeutre = () => ({
  merge: jest.fn(() => ({})),
  pendingCount: jest.fn(() => 0),
  record: jest.fn(),
  sync: { isPending: false, mutateAsync: jest.fn(async () => ({ rejected: [], saved: 0 })) },
});

/**
 * Monte l'ecran et rend l'arbre de test.
 * @param {object} [options] ce qu'on veut changer du montage par defaut
 * @param {any} [options.carnet] le carnet local moque
 * @param {any} [options.etat] ce que rend le crochet `useMyTraining`
 * @param {any} [options.navigation] la navigation moquee
 * @param {any} [options.params] les parametres de la route
 * @returns {any} l'arbre react-test-renderer
 */
const rendre = ({
  carnet, etat = INSCRIT, navigation = { goBack: () => {} }, params = { sessionId: 'seance-1' },
} = {}) => {
  mockEntrainement = etat;
  mockCarnet = carnet || carnetNeutre();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TrainingTest navigation={navigation} route={{ params }} />);
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

/**
 * Le texte porte par un element JSX et toute sa descendance.
 *
 * On lit les ELEMENTS et pas l'arbre rendu : c'est ce qui permet de retrouver
 * un bouton par son libelle sans dependre de la vue qui l'enveloppe, laquelle
 * va changer avec la peinture.
 * @param {any} element un element JSX, une chaine, ou une liste des deux
 * @returns {string} tout le texte concatene
 */
const libelle = (element) => {
  if (element === null || element === undefined || typeof element === 'boolean') return '';
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  if (Array.isArray(element)) return element.map(libelle).join('');
  return libelle(element.props?.children);
};

/**
 * Retrouve un `Button` maison par le titre qu'il affiche.
 * @param {any} arbre l'arbre rendu
 * @param {string} titre le titre attendu du bouton
 * @returns {any} l'instance du bouton, ou `undefined` s'il n'est pas rendu
 */
const bouton = (arbre, titre) => arbre.root.findAllByType(Button)
  .find((/** @type {any} */ noeud) => noeud.props.title === titre);

/**
 * Retrouve une zone cliquable par le texte qu'elle porte (pastille de duree,
 * onglet...).
 * @param {any} arbre l'arbre rendu
 * @param {string} texte le texte exact affiche par la zone
 * @returns {any} l'instance cliquable, ou `undefined`
 */
const pastille = (arbre, texte) => arbre.root.findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => libelle(noeud.props.children) === texte);

/**
 * Les deux onglets « Faire » et « Comprendre », dans l'ordre de l'ecran.
 * @param {any} arbre l'arbre rendu
 * @returns {any[]} les instances cliquables des onglets
 */
const onglets = (arbre) => arbre.root.findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud.props.accessibilityRole === 'tab');

describe('la chaine qui mene au test affiche', () => {
  it('ouvre le PREMIER test de la journee de la seance quand rien ne le precise', () => {
    const vus = textes(rendre());

    expect(vus).toContain('T1');
    expect(vus).toContain('Sprint 10 metres');
    // Le compteur d'etape est rendu avec ses deux nombres : c'est lui qui dit
    // au joueur combien de tests il lui reste.
    expect(vus).toContain('training.test.step|{"current":1,"total":2}');
  });

  it('ouvre directement le test demande par le lien (`testIndex`)', () => {
    const vus = textes(rendre({ params: { sessionId: 'seance-1', testIndex: 1 } }));

    expect(vus).toContain('Nordic hamstring');
    expect(vus).toContain('training.test.step|{"current":2,"total":2}');
  });

  it('retombe sur `dayId` de la route quand la seance ne porte pas sa journee', () => {
    // Cas reel : on arrive depuis la fiche d'une journee, sans seance connue.
    const sansJournee = { ...INSCRIT, sessions: [{ documentId: 'seance-1', results: [] }] };
    const vus = textes(rendre({
      etat: sansJournee, params: { dayId: 'jour-t', sessionId: 'seance-1' },
    }));

    expect(vus).toContain('Sprint 10 metres');
  });
});

describe('AUCUN ETAT VIDE : le test introuvable rend une PAGE BLANCHE', () => {
  /**
   * Verifie qu'il ne reste RIEN a l'ecran : ni un mot, ni un bouton.
   * @param {any} arbre l'arbre rendu
   * @returns {void} rien : les attentes sont posees ici
   */
  const attendreUnePageBlanche = (arbre) => {
    expect(textes(arbre)).toEqual([]);
    expect(arbre.root.findAllByType(TouchableOpacity)).toHaveLength(0);
  };

  it('la seance est introuvable, ET la journee aussi : page blanche', () => {
    // 🚨 CE TEMOIN EST LE PLUS IMPORTANT DU FICHIER. L'ecran rend `null` des
    // que `tests[index]` n'existe pas : aucun message, aucun bouton, aucune
    // porte de sortie. Le joueur reste devant un fond vide et doit deviner
    // qu'il faut revenir en arriere. La refonte doit lui donner un etat vide.
    attendreUnePageBlanche(rendre({ params: { sessionId: 'inconnue' } }));
  });

  it('la journee existe mais n a AUCUN test : page blanche', () => {
    const journeeVide = {
      ...INSCRIT,
      enrollment: { program: { days: [{ documentId: 'jour-t', tests: [] }] } },
    };

    attendreUnePageBlanche(rendre({ etat: journeeVide }));
  });

  it('`testIndex` deborde la liste : page blanche, mais aucun plantage', () => {
    // `index` n'est jamais borne a la longueur de la liste au montage : un lien
    // qui pointe au-dela vide l'ecran au lieu d'afficher le dernier test.
    attendreUnePageBlanche(rendre({ params: { sessionId: 'seance-1', testIndex: 9 } }));
  });

  it('aucune inscription du tout : page blanche, mais aucun plantage', () => {
    const sansInscription = {
      enrollment: null, error: null, isLoading: false, refetch: () => {}, sessions: [],
    };

    attendreUnePageBlanche(rendre({ etat: sansInscription }));
  });
});

describe('le chargement et l erreur sont DELEGUES, l ecran n en ecrit aucun', () => {
  it('passe l attente, l erreur et la relance a l enveloppe partagee', () => {
    const refetch = jest.fn();
    const erreur = new Error('le reseau a lache');
    const arbre = rendre({
      etat: {
        ...INSCRIT, error: erreur, isLoading: true, refetch,
      },
    });

    const enveloppe = arbre.root.findByType(WithDataWrapper);

    // L'ecran ne sait RIEN afficher de son cru pour ces deux etats : tout ce
    // qui existe est ce qu'il transmet ici. Changer l'enveloppe change donc
    // l'etat de chargement et l'etat d'erreur des six ecrans de la section.
    expect(enveloppe.props.isLoading).toBe(true);
    expect(enveloppe.props.error).toBe(erreur);
    expect(enveloppe.props.onRetry).toBe(refetch);
  });
});

describe('les deux onglets « Faire » et « Comprendre »', () => {
  it('sont exactement DEUX, et « Faire » est selectionne a l ouverture', () => {
    const [faire, comprendre] = onglets(rendre());

    expect(onglets(rendre())).toHaveLength(2);
    expect(faire.props.accessibilityState).toEqual({ selected: true });
    expect(comprendre.props.accessibilityState).toEqual({ selected: false });
  });

  it('« Faire » montre le protocole, la minuterie et la saisie', () => {
    const arbre = rendre();
    const vus = textes(arbre);

    expect(vus).toContain('Deux essais, 3 minutes de recuperation');
    expect(vus).toContain('Depart anticipe');
    expect(vus).toContain('training.test.results');
    // Le contenu de l'onglet « Comprendre » n'est PAS monte en meme temps.
    expect(vus).not.toContain('Mesurer l acceleration');
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(3);
  });

  it('appuyer sur « Comprendre » remplace le contenu, minuterie comprise', () => {
    const arbre = rendre();

    act(() => { onglets(arbre)[1].props.onPress(); });
    const vus = textes(arbre);

    expect(vus).toContain('Mesurer l acceleration');
    expect(vus).toContain('Deux plots a 10 metres');
    expect(vus).toContain('Comparer au repere de la categorie');
    expect(vus).toContain('La video du geste');
    // Plus aucune saisie ni minuterie : les deux onglets sont exclusifs.
    expect(vus).not.toContain('Deux essais, 3 minutes de recuperation');
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('une rubrique sans bloc DISPARAIT au lieu d afficher un titre vide', () => {
    // `Block` rend `null` quand le serveur n'a envoye aucun bloc. Le test
    // « Nordic » n'a ni protocole, ni cas d invalidation, ni liens.
    const arbre = rendre({ params: { sessionId: 'seance-1', testIndex: 1 } });

    expect(textes(arbre)).not.toContain('training.test.invalidIf');

    act(() => { onglets(arbre)[1].props.onPress(); });

    expect(textes(arbre)).not.toContain('training.test.setup');
    expect(textes(arbre)).not.toContain('training.test.links');
  });
});

describe('la minuterie de recuperation', () => {
  it('propose HUIT durees, et le decompte demarre a 2 minutes', () => {
    const vus = textes(rendre());

    expect(vus).toEqual(expect.arrayContaining([
      // 90 s se lit « 1.5 min » : la division est brute, sans mise en forme.
      '30 s', '1 min', '1.5 min', '2 min', '3 min', '4 min', '5 min', '8 min',
    ]));
    expect(vus).toContain('2:00');
  });

  it('appuyer sur une duree change le decompte affiche', () => {
    const arbre = rendre();

    act(() => { pastille(arbre, '5 min').props.onPress(); });

    expect(textes(arbre)).toContain('5:00');
    expect(textes(arbre)).not.toContain('2:00');
  });
});

/** Les trois titres de famille, et EUX SEULS : les essais portent un libelle voisin. */
const TITRES_DE_FAMILLE = [
  'training.measures.computed',
  'training.measures.context',
  'training.measures.performance',
];

/**
 * Les titres de famille de mesures RENDUS, dans l'ordre de l'ecran.
 * @param {any} arbre l'arbre rendu
 * @returns {string[]} une entree par titre affiche
 */
const familles = (arbre) => textes(arbre)
  .filter((v) => TITRES_DE_FAMILLE.includes(String(v)));

describe('les mesures, leur ordre et leurs familles', () => {
  it('range TOUJOURS performance, puis contexte, puis calcule', () => {
    // Le serveur les a envoyees dans l'ordre inverse : c'est l'ecran qui range.
    expect(familles(rendre())).toEqual([
      'training.measures.performance',
      'training.measures.context',
      'training.measures.computed',
    ]);
  });

  it('une famille sans mesure ne laisse aucun titre orphelin', () => {
    const uneSeuleFamille = {
      ...INSCRIT,
      enrollment: {
        program: {
          days: [{
            documentId: 'jour-t',
            tests: [{ ...TEST_SPRINT, measures: [TEST_SPRINT.measures[0]] }],
          }],
        },
      },
    };
    expect(familles(rendre({ etat: uneSeuleFamille }))).toEqual(['training.measures.context']);
  });

  it('une mesure calculee ne se saisit pas : elle montre sa formule', () => {
    const vus = textes(rendre());

    expect(vus).toContain('10 / temps10m');
    // Trois champs pour quatre lignes de mesure : la calculee n'en a pas.
    expect(rendre().root.findAllByType(TextInput)).toHaveLength(3);
  });

  it('deux essais donnent DEUX champs pour la meme mesure', () => {
    const champs = rendre().root.findAllByType(TextInput)
      .filter((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === 'Temps 10 m');

    expect(champs).toHaveLength(2);
  });
});

describe('la saisie ecrit dans le carnet LOCAL, avec le test en clair', () => {
  it('taper une valeur enregistre l essai, son cote et le test', () => {
    const carnet = carnetNeutre();
    const arbre = rendre({ carnet });
    const champ = arbre.root.findAllByType(TextInput)
      .filter((/** @type {any} */ n) => n.props.accessibilityLabel === 'Temps 10 m')[1];

    act(() => { champ.props.onChangeText('1,72'); });

    expect(carnet.record).toHaveBeenCalledWith(expect.objectContaining({
      attempt: 2,
      measureKey: 'temps10m',
      side: 'none',
      testDocumentId: 'test-sprint',
      // La virgule du clavier francais est devenue un point AVANT le carnet.
      value: 1.72,
    }));
  });

  it('« essai nul » bascule l essai en invalide, puis le remet valide', () => {
    const carnet = carnetNeutre();
    const arbre = rendre({ carnet });
    const croix = arbre.root.findAllByType(TouchableOpacity)
      .filter((/** @type {any} */ n) => (
        n.props.accessibilityLabel === 'training.actions.invalidAttempt'
      ))[0];

    act(() => { croix.props.onPress(); });

    expect(carnet.record).toHaveBeenLastCalledWith(expect.objectContaining({
      isValid: false, measureKey: 'temps10m', testDocumentId: 'test-sprint',
    }));

    act(() => { croix.props.onPress(); });

    expect(carnet.record).toHaveBeenLastCalledWith(expect.objectContaining({ isValid: true }));
  });

  it('si le telephone refuse d ecrire, l ecran le DIT au lieu de faire semblant', () => {
    // Un chiffre affiche comme enregistre alors que rien ne l'a ete est le pire
    // cas possible sur un terrain : la mesure est perdue sans que personne le voie.
    const carnet = carnetNeutre();
    carnet.record = jest.fn(() => { throw new Error('disque plein'); });
    const arbre = rendre({ carnet });
    const champ = arbre.root.findAllByType(TextInput)[0];

    expect(textes(arbre)).not.toContain('training.sync.localFailed');

    act(() => { champ.props.onChangeText('1,72'); });

    expect(textes(arbre)).toContain('training.sync.localFailed');
  });
});

describe('l envoi differe des mesures', () => {
  it('ne montre RIEN tant que rien n attend d etre envoye', () => {
    const arbre = rendre();

    expect(textes(arbre)).not.toContain('training.sync.offline|{"count":0}');
    expect(bouton(arbre, 'training.actions.sync')).toBeUndefined();
  });

  it('annonce le nombre de mesures en attente et propose de les envoyer', () => {
    const carnet = carnetNeutre();
    carnet.pendingCount = jest.fn(() => 4);
    const arbre = rendre({ carnet });

    expect(textes(arbre)).toContain('training.sync.offline|{"count":4}');
    expect(bouton(arbre, 'training.actions.sync')).toBeDefined();
  });

  it('un envoi reussi ne laisse aucun message d echec', async () => {
    const carnet = carnetNeutre();
    carnet.pendingCount = jest.fn(() => 2);
    const arbre = rendre({ carnet });

    await act(async () => { await bouton(arbre, 'training.actions.sync').props.onPress(); });

    expect(carnet.sync.mutateAsync).toHaveBeenCalledTimes(1);
    expect(textes(arbre)).not.toContain('training.sync.failed');
  });

  it('un envoi rate le DIT, et le compteur en attente reste affiche', async () => {
    // Rien n'est efface : les mesures repartiront au prochain essai. C'est la
    // promesse du mode hors reseau, et elle se voit a l'ecran.
    const carnet = carnetNeutre();
    carnet.pendingCount = jest.fn(() => 2);
    carnet.sync.mutateAsync = jest.fn(async () => { throw new Error('pas de reseau'); });
    const arbre = rendre({ carnet });

    await act(async () => { await bouton(arbre, 'training.actions.sync').props.onPress(); });
    const vus = textes(arbre);

    expect(vus).toContain('training.sync.failed');
    expect(vus).toContain('training.sync.offline|{"count":2}');
  });
});

describe('la navigation d un test a l autre', () => {
  it('« precedent » est eteint sur le premier test, « suivant » est allume', () => {
    const arbre = rendre();

    expect(bouton(arbre, 'training.actions.previous').props.disabled).toBe(true);
    expect(bouton(arbre, 'training.actions.nextTest').props.disabled).toBe(false);
  });

  it('« suivant » change de test ET revient a l onglet « Faire »', () => {
    const arbre = rendre();

    act(() => { onglets(arbre)[1].props.onPress(); });
    act(() => { bouton(arbre, 'training.actions.nextTest').props.onPress(); });
    const vus = textes(arbre);

    expect(vus).toContain('Nordic hamstring');
    expect(vus).toContain('training.test.step|{"current":2,"total":2}');
    // L'onglet est retombe sur « Faire » : la minuterie est de nouveau la.
    expect(onglets(arbre)[0].props.accessibilityState).toEqual({ selected: true });
    expect(vus).toContain('2:00');
  });

  it('« precedent » revient en arriere et rallume « suivant »', () => {
    const arbre = rendre({ params: { sessionId: 'seance-1', testIndex: 1 } });

    act(() => { bouton(arbre, 'training.actions.previous').props.onPress(); });

    expect(textes(arbre)).toContain('Sprint 10 metres');
    expect(bouton(arbre, 'training.actions.previous').props.disabled).toBe(true);
  });

  it('la SEULE porte de sortie n apparait que sur le DERNIER test', () => {
    const arbre = rendre();

    expect(bouton(arbre, 'training.actions.finishTest')).toBeUndefined();

    act(() => { bouton(arbre, 'training.actions.nextTest').props.onPress(); });

    expect(bouton(arbre, 'training.actions.finishTest')).toBeDefined();
    expect(bouton(arbre, 'training.actions.nextTest').props.disabled).toBe(true);
  });

  it('« terminer » ne fait que revenir en arriere : rien n est envoye', () => {
    const goBack = jest.fn();
    const carnet = carnetNeutre();
    const arbre = rendre({ carnet, navigation: { goBack } });

    act(() => { bouton(arbre, 'training.actions.nextTest').props.onPress(); });
    act(() => { bouton(arbre, 'training.actions.finishTest').props.onPress(); });

    expect(goBack).toHaveBeenCalledTimes(1);
    // 🚨 Quitter la fiche n'envoie RIEN au serveur : les mesures restent dans
    // le carnet local tant que personne n'appuie sur « envoyer ».
    expect(carnet.sync.mutateAsync).not.toHaveBeenCalled();
  });

  it('un test unique eteint les DEUX fleches et montre la sortie tout de suite', () => {
    const unSeulTest = {
      ...INSCRIT,
      enrollment: { program: { days: [{ documentId: 'jour-t', tests: [TEST_SPRINT] }] } },
    };
    const arbre = rendre({ etat: unSeulTest });

    expect(bouton(arbre, 'training.actions.previous').props.disabled).toBe(true);
    expect(bouton(arbre, 'training.actions.nextTest').props.disabled).toBe(true);
    expect(bouton(arbre, 'training.actions.finishTest')).toBeDefined();
  });
});

describe('ce qui a deja ete saisi, au retour sur la fiche', () => {
  it('les valeurs du serveur passent par la fusion du carnet local', () => {
    const carnet = carnetNeutre();
    rendre({ carnet });

    // Le carnet local a le dernier mot sur le serveur : c'est lui qui fusionne.
    expect(carnet.merge).toHaveBeenCalledWith([]);
  });

  it('🚨 une valeur DEJA enregistree ne se reaffiche PAS dans le champ', () => {
    // 🪤 DEFAUT FIGE ICI, ET IL FAUT LE REPARER A LA REFONTE. La fusion se fait
    // dans un `useEffect`, donc APRES le premier rendu ; or le champ garde sa
    // valeur dans un `useState` initialise UNE fois, au montage. Le chiffre
    // arrive donc trop tard et n'est jamais montre : au retour sur la fiche,
    // le joueur voit des cases vides et croit avoir tout perdu.
    const carnet = carnetNeutre();
    carnet.merge = jest.fn(() => ({
      'temps10m|1|none': {
        attempt: 1,
        isValid: true,
        measureKey: 'temps10m',
        side: 'none',
        testDocumentId: 'test-sprint',
        value: 1.72,
      },
    }));
    const arbre = rendre({ carnet });
    const champs = arbre.root.findAllByType(TextInput)
      .filter((/** @type {any} */ n) => n.props.accessibilityLabel === 'Temps 10 m');

    expect(champs[0].props.value).toBe('');
  });
});

describe('les cas limites ne font pas tomber l ecran', () => {
  it('une route SANS aucun parametre rend une page blanche, sans exception', () => {
    // `route.params` absent est lu partout en chainage optionnel : l'ecran ne
    // leve pas, il se vide. C'est le cas d'une notification mal formee.
    expect(() => rendre({ params: null })).not.toThrow();
    expect(textes(rendre({ params: null }))).toEqual([]);
  });

  it('une journee dont `tests` n est pas une liste est traitee comme vide', () => {
    const testsCasses = {
      ...INSCRIT,
      enrollment: { program: { days: [{ documentId: 'jour-t', tests: null }] } },
    };

    expect(textes(rendre({ etat: testsCasses }))).toEqual([]);
  });

  it('un test sans mesures affiche quand meme sa fiche et sa minuterie', () => {
    const vus = textes(rendre({ params: { sessionId: 'seance-1', testIndex: 1 } }));

    expect(vus).toContain('Nordic hamstring');
    expect(vus).toContain('2:00');
    expect(vus).toContain('training.test.results');
  });
});
