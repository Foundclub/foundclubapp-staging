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
      // Les rangees de liens portent desormais un chevron : sans ce jeu
      // d images, l onglet « Comprendre » ne monte meme pas.
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

describe('✅ LE TEST INTROUVABLE A ENFIN UN ETAT VIDE', () => {
  /**
   * Verifie que l ecran DIT ce qui se passe et propose de reessayer.
   *
   * 🚨 CE TEMOIN DISAIT L INVERSE, et c etait le plus important du fichier :
   * l ecran rendait `null` des que `tests[index]` n existait pas. Aucun message,
   * aucun bouton, aucune porte de sortie. Le joueur restait devant un fond vide
   * et devait deviner qu il fallait revenir en arriere — au stade, sans reseau,
   * apres avoir vide le cache ou ouvert un lien depuis une notification.
   * @param {any} arbre l arbre rendu
   * @returns {void} rien : les attentes sont posees ici
   */
  const attendreUnEtatVide = (arbre) => {
    const vus = textes(arbre);
    expect(vus).toContain('training.test.offlineTitle');
    // Et il rappelle ce qui marche QUAND MEME : les mesures deja saisies sont
    // sur le telephone et repartiront toutes seules.
    expect(vus.some((v) => String(v).startsWith('training.test.offlineBody'))).toBe(true);
    expect(bouton(arbre, 'training.actions.retry')).toBeDefined();
  };

  it('la seance est introuvable, ET la journee aussi', () => {
    attendreUnEtatVide(rendre({ params: { sessionId: 'inconnue' } }));
  });

  it('la journee existe mais n a AUCUN test', () => {
    const journeeVide = {
      ...INSCRIT,
      enrollment: { program: { days: [{ documentId: 'jour-t', tests: [] }] } },
    };

    attendreUnEtatVide(rendre({ etat: journeeVide }));
  });

  it('`testIndex` deborde la liste : etat vide, aucun plantage', () => {
    attendreUnEtatVide(rendre({ params: { sessionId: 'seance-1', testIndex: 9 } }));
  });

  it('aucune inscription du tout', () => {
    const sansInscription = {
      enrollment: null, error: null, isLoading: false, refetch: () => {}, sessions: [],
    };

    attendreUnEtatVide(rendre({ etat: sansInscription }));
  });

  it('« Reessayer » relance vraiment la lecture', () => {
    const relire = jest.fn();
    const arbre = rendre({
      etat: {
        enrollment: null, error: null, isLoading: false, refetch: relire, sessions: [],
      },
    });

    act(() => { bouton(arbre, 'training.actions.retry').props.onPress(); });

    expect(relire).toHaveBeenCalled();
  });

  it('⛔ ne montre RIEN pendant le chargement : l attente n est pas une absence', () => {
    // Afficher « ce test n est pas sur ton telephone » pendant qu il arrive
    // ferait fermer l ecran a quelqu un qui n avait qu a attendre deux secondes.
    const enAttente = {
      enrollment: null, error: null, isLoading: true, refetch: () => {}, sessions: [],
    };

    expect(textes(rendre({ etat: enAttente }))).not.toContain('training.test.offlineTitle');
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

/**
 * Passe de la lecture du protocole a la saisie.
 *
 * 🔎 « FAIRE » SE FAIT EN DEUX TEMPS DEPUIS LE 2026-09-08 : on lit le protocole, on
 * appuie, on arrive sur la boucle d essais. Tout sur une seule page obligeait a
 * faire defiler quatre ecrans de texte pour retrouver la case ou taper 31,4 — a
 * chaque essai, huit fois de suite.
 * @param {any} arbre l arbre rendu
 * @returns {void} rien
 */
const ouvrirLaSaisie = (arbre) => {
  act(() => { bouton(arbre, 'training.test.toEntry').props.onPress(); });
};

describe('les deux onglets « Faire » et « Comprendre »', () => {
  it('sont exactement DEUX, et « Faire » est selectionne a l ouverture', () => {
    const [faire, comprendre] = onglets(rendre());

    expect(onglets(rendre())).toHaveLength(2);
    expect(faire.props.accessibilityState).toEqual({ selected: true });
    expect(comprendre.props.accessibilityState).toEqual({ selected: false });
  });

  it('« Faire » ouvre sur le PROTOCOLE, pas sur les cases', () => {
    const arbre = rendre();
    const vus = textes(arbre);

    expect(vus).toContain('Deux essais, 3 minutes de recuperation');
    expect(vus).toContain('Depart anticipe');
    // ⛔ Aucune case a ce stade : on lit avant de saisir.
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(0);
    // Le contenu de l'onglet « Comprendre » n'est PAS monte en meme temps.
    expect(vus).not.toContain('Mesurer l acceleration');
  });

  it('« Passer a la saisie » remplace le protocole par la boucle d essais', () => {
    const arbre = rendre();
    ouvrirLaSaisie(arbre);
    const vus = textes(arbre);

    expect(vus).toContain('training.attempt.title|{"current":1,"total":2}');
    expect(vus).toContain('training.attempt.title|{"current":2,"total":2}');
    // Deux essais (une mesure chacun) + la valeur calculee, qui a enfin sa case.
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(3);
    expect(vus).not.toContain('Deux essais, 3 minutes de recuperation');
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
  it('propose ONZE durees, et le decompte demarre a 2 minutes', () => {
    // 🪤 Les trois plus COURTES manquaient (10, 15, 45 s), et ce sont celles des
    // recuperations entre deux tirs ou deux appuis — exactement les cas ou on
    // n a pas le temps de regler une minuterie a la main.
    const arbre = rendre();
    ouvrirLaSaisie(arbre);
    const vus = textes(arbre);

    expect(vus).toEqual(expect.arrayContaining([
      // 90 s se lit « 1.5 min » : la division est brute, sans mise en forme.
      '10 s', '15 s', '30 s', '45 s',
      '1 min', '1.5 min', '2 min', '3 min', '4 min', '5 min', '8 min',
    ]));
    expect(vus).toContain('2:00');
  });

  it('✅ part sur la duree PRESCRITE par le protocole, plus sur 2:00 en dur', () => {
    // 🪤 La donnee existait deja, mais pas au bon endroit : le tableau du deroule
    // de chaque journee porte une recuperation par BLOC, et chaque ligne commence
    // par le code du test. Le lien n etait jamais fait.
    const avecDuree = {
      ...INSCRIT,
      enrollment: {
        program: {
          days: [{
            documentId: 'jour-t',
            tests: [{ ...TEST_SPRINT, recoverySeconds: 240 }, TEST_NORDIC],
          }],
        },
      },
    };
    const arbre = rendre({ etat: avecDuree });
    ouvrirLaSaisie(arbre);

    expect(textes(arbre)).toContain('4:00');
  });

  it('remet la minuterie en changeant de test : chacun a SA recuperation', () => {
    // Passer au suivant sans la remettre laisserait le chrono du sprint sur un
    // test de force.
    const avecDuree = {
      ...INSCRIT,
      enrollment: {
        program: {
          days: [{
            documentId: 'jour-t',
            tests: [{ ...TEST_SPRINT, recoverySeconds: 240 }, TEST_NORDIC],
          }],
        },
      },
    };
    const arbre = rendre({ etat: avecDuree });
    act(() => { bouton(arbre, 'training.actions.nextTest').props.onPress(); });
    ouvrirLaSaisie(arbre);

    // Le second test n en declare aucune : retour au defaut assume.
    expect(textes(arbre)).toContain('2:00');
  });

  it('appuyer sur une duree change le decompte affiche', () => {
    const arbre = rendre();
    ouvrirLaSaisie(arbre);

    act(() => { pastille(arbre, '5 min').props.onPress(); });

    expect(textes(arbre)).toContain('5:00');
    expect(textes(arbre)).not.toContain('2:00');
  });
});

describe('la boucle d essais, dans le bon sens', () => {
  it('rend UNE CARTE PAR ESSAI, chacune avec ses mesures', () => {
    // 🪤 C etait l inverse : une mesure et tous ses essais. Il fallait remonter
    // et redescendre l ecran entre chaque saut, avec le risque de taper la
    // hauteur du saut 2 dans la case du saut 1.
    const arbre = rendre();
    ouvrirLaSaisie(arbre);
    const cartes = textes(arbre)
      .filter((v) => String(v).startsWith('training.attempt.title'));

    expect(cartes).toHaveLength(2);
  });

  it('donne a chaque carte SA bascule « essai nul », pleine largeur', () => {
    const arbre = rendre();
    ouvrirLaSaisie(arbre);
    const bascules = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityRole === 'switch');

    expect(bascules).toHaveLength(2);
    expect(textes(arbre).filter((v) => v === 'training.attempt.void')).toHaveLength(2);
  });

  it('range « a noter une fois » a part, et REPLIE', () => {
    // Ce sont des cases qu on remplit au debut et qu on ne rouvre plus :
    // deployees, elles separaient les cartes d essai les unes des autres.
    const arbre = rendre();
    ouvrirLaSaisie(arbre);

    expect(textes(arbre)).toContain('training.measures.context');
    // La mesure de contexte reste rangee : seuls les deux essais et la valeur
    // calculee portent une case.
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(3);
  });

  it('🪤 donne enfin une CASE a la valeur calculee, sous sa formule', () => {
    // Elle n affichait que son libelle et sa formule, jamais un chiffre — et
    // l app ne peut pas la calculer : la formule est ecrite en francais, pas en
    // code. On lit le resultat sur le logiciel, on le recopie.
    const arbre = rendre();
    ouvrirLaSaisie(arbre);
    const vus = textes(arbre);

    expect(vus).toContain('training.test.seriesResult');
    expect(vus).toContain('10 / temps10m');
  });

  it('la frise dit combien d essais sont notes et combien restent', () => {
    const arbre = rendre();
    ouvrirLaSaisie(arbre);

    expect(textes(arbre)).toContain('training.test.attemptsDone|{"done":0,"left":2}');
  });
});

describe('la saisie ecrit dans le carnet LOCAL, avec le test en clair', () => {
  it('taper une valeur enregistre l essai, son cote et le test', () => {
    const carnet = carnetNeutre();
    const arbre = rendre({ carnet });
    ouvrirLaSaisie(arbre);
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

  it('🪤 « essai nul » bascule TOUT L ESSAI, pas une mesure', () => {
    // Un faux depart annule le saut entier. Marquer une seule de ses mesures
    // laisserait au carnet un essai a moitie valide, qui fausse toutes les
    // moyennes sans que rien ne le signale.
    const carnet = carnetNeutre();
    const arbre = rendre({ carnet });
    ouvrirLaSaisie(arbre);
    const bascule = arbre.root.findAll((/** @type {any} */ n) => n.type === TouchableOpacity
      && n.props.accessibilityRole === 'switch')[0];

    act(() => { bascule.props.onPress(); });

    expect(carnet.record).toHaveBeenLastCalledWith(expect.objectContaining({
      attempt: 1, isValid: false, measureKey: 'temps10m', testDocumentId: 'test-sprint',
    }));
  });

  it('si le telephone refuse d ecrire, l ecran le DIT au lieu de faire semblant', () => {
    // Un chiffre affiche comme enregistre alors que rien ne l'a ete est le pire
    // cas possible sur un terrain : la mesure est perdue sans que personne le voie.
    const carnet = carnetNeutre();
    const arbre = rendre({ carnet });
    ouvrirLaSaisie(arbre);
    carnet.record = jest.fn(() => { throw new Error('disque plein'); });
    const champ = arbre.root.findAllByType(TextInput)[0];

    expect(textes(arbre)).not.toContain('training.sync.localFailed');

    act(() => { champ.props.onChangeText('1,72'); });

    expect(textes(arbre)).toContain('training.sync.localFailed');
  });
});

describe('l envoi differe des mesures', () => {
  it('dit « tout est envoye » quand rien n attend — et ne propose PAS d envoyer', () => {
    // 🪤 Le bandeau n avait que DEUX etats et melangeait « en attente » et
    // « garde sur le telephone » : on ne savait pas si le carnet etait a jour
    // ou si quelque chose n etait pas parti.
    const arbre = rendre();
    ouvrirLaSaisie(arbre);

    expect(textes(arbre)).toContain('training.sync.allSent');
    expect(bouton(arbre, 'training.actions.sync')).toBeUndefined();
  });

  it('annonce le nombre de mesures en attente et propose de les envoyer', () => {
    const carnet = carnetNeutre();
    carnet.pendingCount = jest.fn(() => 4);
    const arbre = rendre({ carnet });
    ouvrirLaSaisie(arbre);

    expect(textes(arbre)).toContain('training.sync.offline|{"count":4}');
    expect(bouton(arbre, 'training.actions.sync')).toBeDefined();
  });

  it('un envoi reussi ne laisse aucun message d echec', async () => {
    const carnet = carnetNeutre();
    carnet.pendingCount = jest.fn(() => 2);
    const arbre = rendre({ carnet });
    ouvrirLaSaisie(arbre);

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
    ouvrirLaSaisie(arbre);

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

  it('« suivant » change de test, revient a « Faire » ET REFERME la saisie', () => {
    // 🪤 La saisie devait se refermer : rester dans la boucle d essais du test
    // precedent en changeant de test ferait taper les valeurs du T2 dans les
    // cases du T1 — le defaut exact que la refonte cherche a fermer.
    const arbre = rendre();
    ouvrirLaSaisie(arbre);
    act(() => { onglets(arbre)[1].props.onPress(); });
    act(() => { bouton(arbre, 'training.actions.nextTest').props.onPress(); });
    const vus = textes(arbre);

    expect(vus).toContain('Nordic hamstring');
    expect(vus).toContain('training.test.step|{"current":2,"total":2}');
    expect(onglets(arbre)[0].props.accessibilityState).toEqual({ selected: true });
    // On est revenu a la LECTURE du protocole : le bouton d entree est la.
    expect(bouton(arbre, 'training.test.toEntry')).toBeDefined();
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

  it('✅ une valeur DEJA enregistree se reaffiche — le defaut est REPARE', () => {
    // 🪤 CE TEMOIN DISAIT L INVERSE, et il figeait un vrai defaut : la fusion se
    // fait dans un `useEffect`, donc APRES le premier rendu, alors que le champ
    // gardait sa valeur dans un `useState` initialise UNE fois au montage. Le
    // chiffre arrivait trop tard : au retour sur la fiche, le joueur voyait des
    // cases vides et croyait avoir tout perdu.
    //
    // ✅ LA REFONTE L A FERME SANS QU ON LE CHERCHE, et c est instructif : la
    // saisie se monte maintenant APRES un appui sur « Passer a la saisie »,
    // donc apres que la fusion a eu lieu. Le champ nait avec la bonne valeur.
    // Le pack de design a resolu un bug d etat en changeant l ergonomie.
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
    ouvrirLaSaisie(arbre);
    const champs = arbre.root.findAllByType(TextInput)
      .filter((/** @type {any} */ n) => n.props.accessibilityLabel === 'Temps 10 m');

    expect(champs[0].props.value).toBe('1.72');
  });
});

describe('les cas limites ne font pas tomber l ecran', () => {
  it('une route SANS aucun parametre rend l etat vide, sans exception', () => {
    // `route.params` absent est lu partout en chainage optionnel : l'ecran ne
    // leve pas. C'est le cas d'une notification mal formee — et depuis la
    // refonte, il ne laisse plus la personne devant un fond vide.
    expect(() => rendre({ params: null })).not.toThrow();
    expect(textes(rendre({ params: null }))).toContain('training.test.offlineTitle');
  });

  it('une journee dont `tests` n est pas une liste est traitee comme vide', () => {
    const testsCasses = {
      ...INSCRIT,
      enrollment: { program: { days: [{ documentId: 'jour-t', tests: null }] } },
    };

    expect(textes(rendre({ etat: testsCasses }))).toContain('training.test.offlineTitle');
  });

  it('un test sans AUCUNE mesure affiche quand meme sa fiche et sa minuterie', () => {
    const arbre = rendre({ params: { sessionId: 'seance-1', testIndex: 1 } });
    expect(textes(arbre)).toContain('Nordic hamstring');

    ouvrirLaSaisie(arbre);
    const vus = textes(arbre);

    expect(vus).toContain('2:00');
    // Aucune carte d essai, aucune valeur calculee : rien a saisir, et l ecran
    // ne pose donc aucun titre orphelin au-dessus du vide.
    expect(vus.some((v) => String(v).startsWith('training.attempt.title'))).toBe(false);
    expect(vus).not.toContain('training.test.seriesResult');
  });
});
