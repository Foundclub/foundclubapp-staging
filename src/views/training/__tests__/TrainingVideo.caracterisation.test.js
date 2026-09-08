import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import TrainingVideoEntry from '../TrainingVideoEntry';
import TrainingVideoQueue from '../TrainingVideoQueue';

/**
 * « RELEVES VIDEO » — LE FILET DES DEUX ECRANS DU SOIR.
 *
 * 🔎 CE QU ILS PROTEGENT : cinquante-huit des six cent dix-neuf mesures du programme
 * ne se prennent PAS sur le terrain. Elles se lisent image par image, sur un logiciel,
 * le soir. Sans liste, on les oublie — et un test dont il manque la moitie des mesures
 * ne vaut rien, alors que le terrain a bien ete fait.
 *
 * ⌨️ ET LE PAVE NUMERIQUE EST A NOUS, DELIBEREMENT : le clavier du systeme s ouvre, se
 * ferme, cache le champ, et propose des lettres dont personne n a besoin ici. Un pave
 * pose en bas ne bouge jamais.
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
  code: 'T2',
  documentId: 'test-t2',
  measures: [
    {
      attempts: 3, key: 'haut', label: 'Hauteur', moment: 'terrain',
    },
    {
      attempts: 3,
      helper: 'a lire image par image dans Kinovea',
      key: 'images',
      label: 'Images entre lacher et impact',
      moment: 'differe',
      unit: 'images',
    },
    // 🚨 UNE SECONDE MESURE VIDEO, ET ELLE EST LA RAISON D ETRE DE CE JEU
    // D ESSAI. Il n en avait qu UNE — et l ecran n affichait que la premiere
    // mesure de chaque essai. Sur le test T1 du vrai programme, qui en porte
    // QUATRE, trois valeurs n avaient AUCUN chemin. Vu a l ecran le 2026-09-08,
    // jamais par une porte.
    {
      attempts: 3,
      helper: 'angle mesure dans Kinovea',
      key: 'angle',
      label: 'Angle du genou',
      moment: 'differe',
      unit: 'deg',
    },
  ],
  name: 'Tir cadre',
};

const JOURNEE = {
  code: 'T', documentId: 'jour-t', tests: [TEST], title: 'Jour T',
};

/**
 * Une ligne de resultat de terrain.
 * @param {number} essai le numero d essai
 * @returns {Record<string, any>} la ligne
 */
const terrain = (essai) => ({
  attempt: essai, measureKey: 'haut', test: { code: 'T2' }, value: 1,
});

const SEANCE = {
  day: { documentId: 'jour-t' },
  documentId: 'seance-1',
  plannedDate: '2026-09-06',
  results: [terrain(1), terrain(2), terrain(3)],
};

/**
 * Prépare les crochets moqués.
 * @param {any[]} [resultats] les lignes de la séance
 * @returns {void} rien
 */
const preparer = (resultats = SEANCE.results) => {
  mockEntrainement = {
    enrollment: { program: { days: [JOURNEE] } },
    error: null,
    isLoading: false,
    refetch: () => {},
    sessions: [{ ...SEANCE, results: resultats }],
  };
  mockCarnet = {
    merge: jest.fn(() => ({})),
    pendingCount: jest.fn(() => 0),
    record: jest.fn(),
    sync: { isPending: false, mutateAsync: jest.fn() },
  };
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

describe('LA FILE — « Relevés vidéo »', () => {
  /**
   * Monte la file.
   * @param {any[]} [resultats] les lignes de la seance
   * @param {any} [navigation] la navigation moquee
   * @returns {any} l arbre rendu
   */
  const rendre = (resultats, navigation = {}) => {
    preparer(resultats);
    const nav = { navigate: jest.fn(), ...navigation };
    /** @type {any} */
    let arbre;
    act(() => { arbre = renderer.create(<TrainingVideoQueue navigation={nav} />); });
    return arbre;
  };

  it('annonce le COMPTE en gros chiffre : c est la seule chose qu on veut savoir', () => {
    const vus = textes(rendre());

    // 3 essais faits × 2 mesures differees = 6 valeurs a relever.
    expect(vus).toContain('6');
    expect(vus.some((v) => String(v).startsWith('training.video.lead'))).toBe(true);
  });

  it('range par journee, puis par test, avec le logiciel a ouvrir', () => {
    const vus = textes(rendre());

    expect(vus).toContain('T');
    expect(vus).toContain('Tir cadre');
    expect(vus).toContain('Kinovea');
    // 3 essais faits × 2 mesures video = 6 valeurs a relever.
    // 🐞 LA LIGNE DIT MAINTENANT LES DEUX NOMBRES. Elle annoncait le TOTAL pendant
    // que l entete comptait ce qui RESTE : « 3 mesures a relever » en haut,
    // « 4 mesures a lire » juste en dessous, et une barre a 25 %. Vu le 2026-09-08.
    expect(vus).toContain(
      'training.video.testLine|{"attempts":3,"count":3,"done":0,"measures":6}',
    );
  });

  it('ouvre le releve du bon test', () => {
    const navigate = jest.fn();
    const arbre = rendre(undefined, { navigate });
    const carte = arbre.root.findAll((n) => n.type === TouchableOpacity)[0];

    act(() => { carte.props.onPress(); });

    expect(navigate).toHaveBeenCalledWith('TrainingVideoEntry', expect.objectContaining({
      sessionId: 'seance-1', testIndex: 0,
    }));
  });

  it('🪤 une journee PAS COMMENCEE garde son cadre, au lieu d un trou', () => {
    // Sans lui, elle disparaissait de la liste et on croyait avoir tout releve
    // — alors qu on n avait simplement rien filme.
    const vus = textes(rendre([]));

    expect(vus).toContain('training.video.notStarted');
    expect(vus).toContain('0');
  });

  it('dit ou part ce qu on releve', () => {
    expect(textes(rendre())).toContain('training.video.hint');
  });
});

describe('UN ESSAI A LA FOIS', () => {
  /**
   * Monte l ecran d un essai.
   * @param {any} [navigation] la navigation moquee
   * @returns {any} l arbre rendu
   */
  const rendre = (navigation = {}) => {
    preparer();
    const nav = { goBack: jest.fn(), navigate: jest.fn(), ...navigation };
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <TrainingVideoEntry
          navigation={nav}
          route={{ params: { sessionId: 'seance-1', testIndex: 0 } }}
        />,
      );
    });
    return arbre;
  };

  it('dit QUELLE video ouvrir, et sur quel logiciel', () => {
    const vus = textes(rendre());

    // 🪤 Deux chiffres : « essai10 » se rangerait avant « essai2 » dans un
    // dossier trie par nom.
    expect(vus).toContain('T2_essai01.mp4');
    expect(vus).toContain('Kinovea');
    // Le repere compte les VALEURS, pas les essais : 6 a relever en tout.
    expect(vus).toContain('T2 · 1/6');
  });

  it('pose UN SEUL gros champ, avec son intitule et son unite', () => {
    const vus = textes(rendre());

    expect(vus).toContain('Images entre lacher et impact');
    expect(vus).toContain('images');
    // Le champ est vide : un tiret, pas un zero qui ressemble a une valeur.
    expect(vus).toContain('—');
  });

  it('⌨️ le pave numerique est TOUJOURS la, et il ecrit dans le champ', () => {
    const arbre = rendre();
    const touche = (libelle) => arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityLabel === libelle)[0];

    act(() => { touche('1').props.onPress(); });
    act(() => { touche('4').props.onPress(); });

    expect(textes(arbre)).toContain('14');
  });

  it('🪤 refuse une DEUXIEME virgule : « 1,2,3 » n est pas un nombre', () => {
    // Le serveur le refuserait apres coup, quand la video n est plus ouverte.
    const arbre = rendre();
    const touche = (libelle) => arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityLabel === libelle)[0];

    act(() => { touche('1').props.onPress(); });
    act(() => { touche(',').props.onPress(); });
    act(() => { touche('5').props.onPress(); });
    act(() => { touche(',').props.onPress(); });

    expect(textes(arbre)).toContain('1,5');
  });

  it('efface le dernier caractere', () => {
    const arbre = rendre();
    const touche = (libelle) => arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityLabel === libelle)[0];

    act(() => { touche('1').props.onPress(); });
    act(() => { touche('4').props.onPress(); });
    act(() => { touche('⌫').props.onPress(); });

    expect(textes(arbre)).toContain('1');
  });

  it('garde le bouton d enregistrement ETEINT tant que rien n est tape', () => {
    const arbre = rendre();
    const enregistrer = arbre.root.findAllByType(Button)
      .find((b) => b.props.title === 'training.video.save');

    expect(enregistrer.props.disabled).toBe(true);
  });

  it('enregistre la valeur sur le BON essai, et passe au suivant', () => {
    const arbre = rendre();
    const touche = (libelle) => arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityLabel === libelle)[0];
    act(() => { touche('1').props.onPress(); });
    act(() => { touche('4').props.onPress(); });

    const enregistrer = arbre.root.findAllByType(Button)
      .find((b) => b.props.title === 'training.video.save');
    act(() => { enregistrer.props.onPress(); });

    expect(mockCarnet.record).toHaveBeenCalledWith(expect.objectContaining({
      attempt: 1, measureKey: 'images', testDocumentId: 'test-t2', unit: 'images', value: 14,
    }));
    expect(textes(arbre)).toContain('T2 · 2/6');
  });

  it('🚨 atteint TOUTES les mesures d un essai, pas seulement la premiere', () => {
    // LE DEFAUT QUE CE TEMOIN FERME, vu a l ecran le 2026-09-08 : l ecran
    // n affichait que `mesures[0]`. Sur le test T1 du vrai programme, qui porte
    // QUATRE mesures a lire sur la video, trois n avaient AUCUN chemin — et
    // aucune porte ne pouvait le dire, parce que ce jeu d essai n avait qu une
    // seule mesure differee.
    const arbre = rendre();
    const vus = textes(arbre);

    expect(vus).toContain('Images entre lacher et impact');
    expect(vus).toContain('training.video.measureOf|{"current":1,"total":2}');

    // Enregistrer passe a la MESURE SUIVANTE du meme essai, pas a l essai suivant.
    const touche = (libelle) => arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityLabel === libelle)[0];
    act(() => { touche('9').props.onPress(); });
    act(() => {
      arbre.root.findAllByType(Button)
        .find((b) => b.props.title === 'training.video.save').props.onPress();
    });

    const apres = textes(arbre);
    expect(apres).toContain('Angle du genou');
    expect(apres).toContain('training.video.measureOf|{"current":2,"total":2}');
    // On est TOUJOURS sur l essai 1 : c est la mesure qui a avance.
    expect(apres).toContain('T2_essai01.mp4');
  });

  it('le rail compte ce qui est FAIT, pas ce que le programme prevoit', () => {
    // 🪤 Un essai qui n a pas ete filme n a pas de video : le proposer ferait
    // chercher un fichier qui n existe pas.
    const arbre = rendre();
    const traits = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityState?.selected !== undefined);

    expect(traits).toHaveLength(3);
  });

  it('la fleche du haut referme l ecran', () => {
    const goBack = jest.fn();
    const arbre = rendre({ goBack });
    const retour = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityLabel === 'training.actions.back')[0];

    act(() => { retour.props.onPress(); });

    expect(goBack).toHaveBeenCalled();
  });
});
