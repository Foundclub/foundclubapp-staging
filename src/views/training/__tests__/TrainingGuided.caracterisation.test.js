import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';
import TrainingStepRail from '@/components/organisms/training/TrainingStepRail';

import TrainingGuided from '../TrainingGuided';

/**
 * « LE PARCOURS GUIDE D UN TEST » — LE FILET DES CINQ ARRETS.
 *
 * 🔎 CE QU IL PROTEGE, ARRET PAR ARRET :
 *   · AVANT DE COMMENCER : les lignes de mise en place se COCHENT, et l encart or
 *     dit ce qui annule un essai AVANT qu on le fasse ;
 *   · L ECHAUFFEMENT : il vient de la JOURNEE, faute de champ sur le test ;
 *   · UN ESSAI : seulement les mesures du TERRAIN — une case qu on ne peut pas
 *     remplir fait croire qu on a rate quelque chose ;
 *   · LA RECUPERATION : le compte a rebours TOURNE DEJA. C est la seule difference
 *     qui compte entre un chronometre et une recuperation ;
 *   · LA FIN : la validation est un vrai geste, rangee sur la seance.
 *
 * 🪤 ET LE BOUTON UNIQUE CHANGE DE MOT A CHAQUE ARRET. Un « Suivant » generique ne
 * dit pas ou l on va — sur un terrain, c est exactement ce qu on a besoin de savoir.
 */

/** @type {any} */
let mockEntrainement;
/** @type {any} */
let mockCarnet;
/** @type {any} */
let mockMaj;

jest.mock('@/hooks/useTraining', () => ({
  useMyTraining: () => mockEntrainement,
  useTrainingResults: () => mockCarnet,
  useUpdateTrainingSession: () => mockMaj,
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

const TEST = {
  code: 'B1',
  documentId: 'test-b1',
  estimatedMinutes: 9,
  invalidIf: [{ text: 'Talons decolles', type: 'p' }],
  measures: [
    {
      attempts: 2, key: 'haut', label: 'Hauteur', moment: 'terrain',
    },
    {
      attempts: 2, key: 'images', label: 'Images', moment: 'differe',
    },
  ],
  name: 'Squat Jump',
  setup: [{ items: ['Box a 40 cm', 'Ruban a 5 m'], type: 'ul' }],
  why: [{ text: 'Mesurer la force explosive', type: 'p' }],
};

const SUIVANT = {
  code: 'B2', documentId: 'test-b2', estimatedMinutes: 6, measures: [], name: 'CMJ',
};

const JOURNEE = {
  code: 'B', documentId: 'jour-b', tests: [TEST, SUIVANT], warmup: [{ text: 'RAMP', type: 'p' }],
};

const SEANCE = {
  conditions: {}, day: { documentId: 'jour-b' }, documentId: 'seance-9', results: [],
};

/**
 * Monte l ecran sur un arret donne.
 * @param {object} [options] ce qu on fait varier
 * @param {any} [options.navigation] la navigation moquee
 * @param {any} [options.seance] la seance affichee
 * @param {string} [options.step] l arret ouvert
 * @returns {any} l arbre rendu
 */
/** Les arbres montes par ce fichier, demontes apres chaque temoin. */
/** @type {any[]} */
const montes = [];

const rendre = ({ navigation = {}, seance = SEANCE, step = 'prep' } = {}) => {
  mockEntrainement = {
    enrollment: { program: { days: [JOURNEE] } },
    error: null,
    isLoading: false,
    refetch: () => {},
    sessions: [seance],
  };
  mockCarnet = {
    merge: jest.fn(() => ({})),
    pendingCount: jest.fn(() => 0),
    record: jest.fn(),
    sync: { isPending: false, mutateAsync: jest.fn() },
  };
  mockMaj = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };
  const nav = {
    goBack: jest.fn(), navigate: jest.fn(), push: jest.fn(), ...navigation,
  };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <TrainingGuided
        navigation={nav}
        route={{ params: { sessionId: 'seance-9', step, testIndex: 0 } }}
      />,
    );
  });
  montes.push(arbre);
  return arbre;
};

/*
 * 🧨 ON DEMONTE CE QU ON A MONTE, et ce n est pas de la coquetterie.
 *
 * Des qu un temoin avance jusqu a la RECUPERATION, le chronometre demarre tout
 * seul. L arbre reste monte apres la fin du test, jest demonte son environnement,
 * et la minuterie qui se reveille rend « You are trying to import a file after
 * the Jest environment has been torn down » : la SUITE sort en code 1 alors que
 * tous ses temoins sont VERTS. C est exactement le defaut deja consigne dans ce
 * depot — une CI rouge sans un seul test rouge, et introuvable si on ne lit que
 * la ligne « Tests: ».
 */
afterEach(() => {
  montes.splice(0).forEach((arbre) => {
    try {
      act(() => { arbre.unmount(); });
    } catch {
      // Un arbre deja demonte n est pas une erreur : on nettoie, on ne verifie pas.
    }
  });
});

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
 * Le bouton principal du pied.
 * @param {any} arbre l arbre rendu
 * @returns {any} le premier bouton du pied
 */
const principal = (arbre) => arbre.root.findAllByType(Button)[0];

describe('le cadre commun aux cinq arrets', () => {
  it('pose le ruban d etapes, avec UN seul arret en cours', () => {
    const arbre = rendre({ step: 'attempt-1' });
    const rail = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityState?.selected !== undefined
      && n.props.accessibilityState?.disabled !== undefined);

    expect(rail.filter((p) => p.props.accessibilityState.selected)).toHaveLength(1);
  });

  it('🪤 le ruban ne laisse revenir QUE sur ce qui est deja passe', () => {
    // Sauter vers un essai qu on n a pas fait laisserait un trou dans la serie
    // sans que rien ne le signale.
    const arbre = rendre({ step: 'attempt-1' });
    const rail = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityState?.disabled !== undefined);

    // prep et warmup sont passes : ouverts. Le reste est ferme.
    expect(rail.map((p) => !p.props.accessibilityState.disabled))
      .toEqual([true, true, false, false, false, false]);
  });

  it('sort le protocole du parcours derriere un bouton « Pourquoi ? »', () => {
    const navigate = jest.fn();
    const arbre = rendre({ navigation: { navigate } });
    const bouton = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityLabel === 'training.guided.why')[0];

    act(() => { bouton.props.onPress(); });

    expect(navigate).toHaveBeenCalledWith('TrainingTest', expect.objectContaining({
      tab: 'learn', testIndex: 0,
    }));
  });
});

describe('AVANT DE COMMENCER', () => {
  it('dit EN UNE LIGNE ce qu on mesure', () => {
    expect(textes(rendre())).toContain('training.guided.whatWeMeasure');
  });

  it('rend les lignes de mise en place COCHABLES, avec leur compte', () => {
    const arbre = rendre();
    const cases = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityRole === 'checkbox');

    expect(cases).toHaveLength(2);
    // 🔤 `count` porte le compte RÉEL. Depuis le 2026-09-08, l app embarque
    // `intl-pluralrules` : le moteur du telephone connait enfin la regle du
    // francais, ou ZERO prend le singulier. Il n y a plus d adaptateur.
    expect(textes(arbre)).toContain('training.day.prepared|{"count":0,"done":0,"total":2}');

    act(() => { cases[0].props.onPress(); });
    expect(textes(arbre)).toContain('training.day.prepared|{"count":1,"done":1,"total":2}');
  });

  it('encadre en OR ce qui annule un essai, AVANT qu on le fasse', () => {
    const vus = textes(rendre());

    expect(vus).toContain('training.test.invalidIf');
    expect(vus).toContain('Talons decolles');
    expect(vus).toContain('training.guided.judgedLater');
  });

  it('offre les deux sorties : « tout est en place » et « passer ce test »', () => {
    const boutons = rendre().root.findAllByType(Button).map((b) => b.props.title);

    expect(boutons).toEqual([
      'training.guided.go.prep|{"count":1}',
      'training.guided.skipTest',
    ]);
  });
});

describe('L ECHAUFFEMENT', () => {
  it('montre celui de la JOURNEE : aucun test n en porte', () => {
    const vus = textes(rendre({ step: 'warmup' }));

    expect(vus).toContain('RAMP');
    expect(vus).toContain('training.guided.warmupHint');
  });

  it('mene a l essai 1', () => {
    expect(principal(rendre({ step: 'warmup' })).props.title)
      .toBe('training.guided.go.warmup|{"count":1}');
  });
});

describe('UN ESSAI', () => {
  it('🪤 ne montre QUE les mesures du terrain', () => {
    // Une case qu on ne peut pas remplir maintenant fait croire qu on a rate
    // quelque chose : les mesures qui se lisent sur la video attendent le soir.
    const arbre = rendre({ step: 'attempt-1' });
    const vus = textes(arbre);

    expect(vus).toContain('Hauteur');
    expect(vus).not.toContain('Images');
    expect(vus).toContain('training.guided.videoLater|{"count":2}');
  });

  it('porte sa bascule « essai nul », et une sortie de secours', () => {
    const arbre = rendre({ step: 'attempt-1' });

    expect(arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityRole === 'switch')).toHaveLength(1);
    expect(textes(arbre)).toContain('training.guided.stopHere');
  });
});

describe('LA RECUPERATION', () => {
  it('⏱️ le compte a rebours TOURNE DEJA', () => {
    // C est la seule difference qui compte entre un chronometre et une
    // recuperation : une recuperation qu il faut penser a lancer ne se lance pas.
    // 🪤 `TrainingTimer` est enveloppee dans `memo` : `findByType` sur l import
    // ne la trouve pas. On la vise par la prop qu elle seule porte.
    const minuteries = rendre({ step: 'recovery-1' }).root
      .findAll((n) => n.props?.autoStart !== undefined);

    expect(minuteries.length).toBeGreaterThan(0);
    expect(minuteries[0].props.autoStart).toBe(true);
  });

  it('confirme l essai enregistre ET annonce le suivant', () => {
    const vus = textes(rendre({ step: 'recovery-1' }));

    expect(vus).toContain('training.guided.saved|{"current":1}');
    expect(vus).toContain('training.guided.next');
    expect(vus).toContain('training.attempt.title|{"current":2,"total":2}');
  });

  it('laisse refaire l essai qu on vient de faire', () => {
    expect(textes(rendre({ step: 'recovery-1' })))
      .toContain('training.guided.redo|{"count":1}');
  });

  it('mene a l essai suivant, en le nommant', () => {
    expect(principal(rendre({ step: 'recovery-1' })).props.title)
      .toBe('training.guided.go.recovery|{"count":2}');
  });
});

describe('LA FIN DU TEST', () => {
  it('resume les essais, et propose de VALIDER', () => {
    const arbre = rendre({ step: 'end' });
    const vus = textes(arbre);

    expect(vus).toContain('training.guided.checkTest|{"test":"B1"}');
    expect(principal(arbre).props.title).toBe('training.guided.validate|{"test":"B1"}');
  });

  it('la validation est un VRAI geste, range sur la seance', () => {
    // 🔎 Dans `conditions`, le champ JSON que la seance porte deja : aucune
    // migration, et la validation survit au changement de telephone.
    const arbre = rendre({ step: 'end' });

    act(() => { principal(arbre).props.onPress(); });

    expect(mockMaj.mutate).toHaveBeenCalledWith({
      payload: { conditions: { validatedTests: ['B1'] } },
      sessionDocumentId: 'seance-9',
    });
  });

  it('une fois valide, le bouton s eteint et le test SUIVANT se presente', () => {
    const arbre = rendre({
      seance: { ...SEANCE, conditions: { validatedTests: ['B1'] } },
      step: 'end',
    });
    const vus = textes(arbre);

    expect(principal(arbre).props.disabled).toBe(true);
    expect(vus).toContain('training.guided.nextTest');
    expect(vus).toContain('CMJ');
  });

  it('renvoie vers les releves video quand il en reste', () => {
    const arbre = rendre({ step: 'end' });

    expect(textes(arbre)).toContain('training.guided.videoQueue|{"count":2}');
  });

  it('garde le bandeau d envoi visible, en vert quand tout est parti', () => {
    // 🪤 Il disparaissait purement et simplement : on ne savait pas si le carnet
    // etait a jour ou si quelque chose n etait pas parti.
    expect(textes(rendre({ step: 'end' }))).toContain('training.sync.allSent');
  });
});

describe('le bouton ETEINT qui DIT POURQUOI', () => {
  it('🪤 refuse d avancer tant qu une case du terrain est vide, ET l explique', () => {
    // Un bouton eteint qui ne dit pas pourquoi est pire qu un bouton qui echoue :
    // on appuie trois fois, on croit l app cassee, et on quitte l ecran en
    // perdant ce qu on venait de faire.
    const arbre = rendre({ step: 'attempt-1' });

    expect(principal(arbre).props.disabled).toBe(true);
    expect(textes(arbre)).toContain('training.guided.missing|{"count":1}');
  });

  it('⚠️ mais laisse passer un essai declare NUL : il n a AUCUNE valeur', () => {
    // Exiger un chiffre pour avancer bloquerait exactement le cas que la
    // bascule « essai nul » sert a traiter.
    const arbre = rendre({ step: 'attempt-1' });
    const bascule = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityRole === 'switch')[0];

    act(() => { bascule.props.onPress(); });

    expect(principal(arbre).props.disabled).toBe(false);
  });
});

describe('ce qui ne doit rien faire tomber', () => {
  it('traverse un test introuvable', () => {
    expect(() => rendre({ seance: { documentId: 'seance-9' } })).not.toThrow();
  });
});

describe('🔴 CE QUI EST FRANCHI EST NOTE SUR LA SEANCE', () => {
  /*
   * DEFAUT MESURE A L ECRAN LE 2026-09-08 : on faisait la mise en place,
   * l echauffement, l essai 1, la recuperation — on sortait du parcours, et le
   * tableau de bord affichait toujours « 0 test fait, etape 0 ». L avancement se
   * deduisait UNIQUEMENT des mesures enregistrees, or 9 tests sur 33 n ecrivent
   * rien sur le terrain. Journees E et D3 : 100 % de leurs etapes.
   */

  /**
   * Le bouton du pied qui fait avancer, trouve par son libelle.
   * @param {any} arbre l arbre rendu
   * @param {string} type le type d arret quitte
   * @returns {any} le bouton
   */
  const bouton = (arbre, type) => arbre.root.findAllByType(Button)
    .find((b) => String(b.props.title).startsWith(`training.guided.go.${type}`));

  it('quitter la MISE EN PLACE note l etape sur la seance', () => {
    const arbre = rendre({ step: 'prep' });

    act(() => { bouton(arbre, 'prep').props.onPress(); });

    expect(mockMaj.mutate).toHaveBeenCalledWith({
      payload: { conditions: { stepsDone: ['B1-prep'] } },
      sessionDocumentId: 'seance-9',
    });
  });

  it('valider un ESSAI note l essai, avec son numero', () => {
    const arbre = rendre({ step: 'attempt-2' });

    act(() => { bouton(arbre, 'attempt').props.onPress(); });

    expect(mockMaj.mutate).toHaveBeenCalledWith({
      payload: { conditions: { stepsDone: ['B1-e2'] } },
      sessionDocumentId: 'seance-9',
    });
  });

  it('n ecrase JAMAIS ce que la seance porte deja', () => {
    // `conditions` porte aussi les reperes coches et les tests valides : ecrire la
    // liste seule les effacerait tous.
    const arbre = rendre({
      seance: { ...SEANCE, conditions: { prepared: ['Avant'], stepsDone: ['B1-prep'] } },
      step: 'attempt-1',
    });

    act(() => { bouton(arbre, 'attempt').props.onPress(); });

    expect(mockMaj.mutate).toHaveBeenCalledWith({
      payload: { conditions: { prepared: ['Avant'], stepsDone: ['B1-prep', 'B1-e1'] } },
      sessionDocumentId: 'seance-9',
    });
  });

  it('ne note pas deux fois la meme etape', () => {
    const arbre = rendre({
      seance: { ...SEANCE, conditions: { stepsDone: ['B1-prep'] } },
      step: 'prep',
    });

    act(() => { bouton(arbre, 'prep').props.onPress(); });

    expect(mockMaj.mutate).not.toHaveBeenCalled();
  });

  it('🪤 REVENIR EN ARRIERE PAR LE RUBAN N ECRIT RIEN', () => {
    // Le ruban permet de relire un essai deja passe. Marquer la l arret qu on
    // quitte declarerait fait un essai qu on n a pas termine.
    const arbre = rendre({ step: 'attempt-2' });
    const ruban = arbre.root.findByType(TrainingStepRail);

    act(() => { ruban.props.onPress({ cle: 'prep' }); });

    expect(mockMaj.mutate).not.toHaveBeenCalled();
  });
});

describe('🧑‍⚖️ LA BASCULE DU TERRAIN SIGNE SON VERDICT', () => {
  /*
   * Decision d Adel du 2026-09-08 (« 1- ok B »). Un essai a deux juges possibles, et
   * ils ne jugent pas au meme moment : le terrain voit un plot touche, la video lit
   * un ballon hors image. Sur 22 des 33 tests, les deux criteres coexistent.
   * ⚠️ Leur PORTEE differe aussi : sur le terrain, un plot touche annule TOUT
   * l essai ; a la lecture, « le score reste, la vitesse est notee — ».
   */

  /**
   * La carte d essai, et sa bascule.
   * @param {any} arbre l arbre rendu
   * @returns {any} la bascule
   */
  const bascule = (arbre) => arbre.root.findAll(
    (n) => n.props?.accessibilityRole === 'switch' && typeof n.props?.onPress === 'function',
  )[0];

  it('marque TOUT l essai, et signe « terrain »', () => {
    const arbre = rendre({ step: 'attempt-1' });

    act(() => { bascule(arbre).props.onPress(); });

    expect(mockCarnet.record).toHaveBeenCalledWith(expect.objectContaining({
      invalidatedBy: 'terrain',
      isValid: false,
    }));
  });

  it('efface la signature quand on decoche', () => {
    // 🪤 On fait l ALLER-RETOUR reel plutot que de forcer un etat de depart : le
    // double de `merge` rend un objet vide, une seance montee avec une ligne nulle
    // n arriverait donc jamais jusqu au calcul.
    const arbre = rendre({ step: 'attempt-1' });

    act(() => { bascule(arbre).props.onPress(); });
    act(() => { bascule(arbre).props.onPress(); });

    expect(mockCarnet.record).toHaveBeenLastCalledWith(expect.objectContaining({
      invalidatedBy: null,
      isValid: true,
    }));
  });
});
