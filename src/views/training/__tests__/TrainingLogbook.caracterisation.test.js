import { ScrollView, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import genererCouleurs from '@/theme/colors';

import Button from '@/components/atoms/button/Button';

import TrainingLogbook from '../TrainingLogbook';

/**
 * « MON CARNET » — LE FILET DES DEUX VUES.
 *
 * 🔎 CE QU IL PROTEGE, ET POURQUOI :
 *   1. LE CARNET BRUT NE CHANGE PAS D UN CARACTERE. C est un format d echange :
 *      on le colle ailleurs, on l analyse, on le reimporte. Un espace ajoute par
 *      l ecran casserait la reimportation sans que rien ne le dise.
 *   2. LA VUE LISIBLE NE LE REMPLACE PAS, elle le double. Les deux existent, et
 *      le bouton de copie reste attache au BRUT.
 *   3. LA PAGE DEFILE. Elle ne defilait pas : sur un carnet de huit journees,
 *      tout ce qui depassait l ecran — le bouton « Copier » compris — etait
 *      simplement inatteignable.
 *   4. L ECRAN VIDE A UNE PORTE DE SORTIE. C etait un cul-de-sac.
 *   5. LE CHARGEMENT ET L ERREUR SONT DELEGUES, jamais redessines.
 */

/** @type {any} */
let mockCarnet;
/** @type {any[]} */
let mockOptionsCrochet;
/** @type {any[]} */
let mockPressePapiers;
/** @type {any[]} */
let mockPropsEnveloppe;
/** @type {any} */
let mockEntrainement;

// ⚠️ Jest refuse toute variable citee dans une doublure qui ne commence pas par
// « mock ». Les cinq ci-dessus portent donc ce prefixe.
jest.mock('@/hooks/useTraining', () => ({
  // La vue LISIBLE recolle les codes du carnet avec les noms du programme : elle
  // a donc besoin du programme, que seul ce crochet-la porte.
  useMyTraining: () => mockEntrainement,
  useTrainingExport: (/** @type {any} */ options) => {
    mockOptionsCrochet.push(options);
    return mockCarnet;
  },
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

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {
    setString: (/** @type {string} */ texte) => {
      mockPressePapiers.push(texte);
    },
  },
}));

// La rangee de seance tire un degrade natif : il n a rien a dire ici.
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
    default: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      { bgImage: props.bgImage, bottomInsetMode: props.bottomInsetMode },
      props.children,
    ),
  };
});

// L'enveloppe de donnees porte a elle seule le chargement et l'erreur. On la
// remplace par une vue qui rend toujours ses enfants ET journalise ses props :
// c'est le seul moyen d'affirmer que l'ecran DELEGUE au lieu de decider.
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockPropsEnveloppe.push(props);
      return reactActuel.createElement(VueRN, null, props.children);
    },
  };
});

const Colors = genererCouleurs();

// Le format exact decrit par le guide de terrain : un en-tete, puis une mesure
// par ligne. Il est fige tel quel parce que l'ecran ne doit RIEN en changer.
// ⚠️ La NEUVIEME colonne est « valide » : elle vaut V ou N, et c est elle qui
// colore une ligne nulle en or dans la vue brute.
const CSV = [
  'date;jour;test;mesure;unite;cote;essai;valeur;valide;motif_nul;commentaire',
  '2026-09-06;T;T1;temps;s;;1;1.72;V;;',
  '2026-09-06;T;T0;hauteur;m;;1;0.4;V;;',
  '2026-09-07;A;T1;temps;s;;2;1.90;N;faux depart;',
].join('\n');

const PROGRAMME = {
  program: {
    days: [{
      code: 'T',
      tests: [
        {
          code: 'T0',
          measures: [{
            computed: true, key: 'hauteur', label: 'Hauteur de chute', unit: 'm',
          }],
          name: 'Calibrations camera',
        },
        {
          code: 'T1',
          measures: [{ key: 'temps', label: 'Temps sur 10 m', unit: 's' }],
          name: 'Sprint 10 metres',
        },
      ],
    }],
  },
};

const SEANCES = [
  {
    day: { code: 'T', title: 'Jour T' },
    documentId: 's1',
    plannedDate: '2026-09-06',
    results: [
      {
        attempt: 1,
        isValid: true,
        measureKey: 'temps',
        side: 'none',
        test: { code: 'T1' },
        value: 1.72,
      },
      {
        attempt: 1,
        isValid: true,
        measureKey: 'hauteur',
        side: 'none',
        test: { code: 'T0' },
        value: 0.4,
      },
    ],
  },
  {
    day: { code: 'A', title: 'Jour A' },
    documentId: 's2',
    plannedDate: '2026-09-07',
    results: [{
      attempt: 2,
      invalidReason: 'faux depart',
      isValid: false,
      measureKey: 'temps',
      side: 'none',
      test: { code: 'T1' },
      value: 1.9,
    }],
  },
];

const REMPLI = {
  data: { csv: CSV, rows: 3 },
  error: null,
  isLoading: false,
  refetch: () => {},
};

const VIDE = {
  data: { csv: '', rows: 0 },
  error: null,
  isLoading: false,
  refetch: () => {},
};

/**
 * Monte l'ecran et rend l'arbre de test.
 * @param {any} [etat] ce que rend le crochet `useTrainingExport`
 * @param {any} [navigation] la navigation moquee
 * @returns {any} l'arbre react-test-renderer
 */
const rendre = (etat = REMPLI, navigation = {}) => {
  mockCarnet = etat;
  mockEntrainement = { enrollment: PROGRAMME, sessions: SEANCES };
  const nav = { navigate: jest.fn(), ...navigation };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TrainingLogbook navigation={nav} />);
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
 * Les deux onglets de l ecran.
 * @param {any} arbre l arbre rendu
 * @returns {any[]} les onglets, « Lisible » puis « Brut »
 */
const onglets = (arbre) => arbre.root.findAll((n) => n.type === TouchableOpacity
  && n.props.accessibilityState?.selected !== undefined);

/**
 * Les styles a plat d un noeud rendu.
 * @param {any} noeud un noeud
 * @returns {any[]} ses styles, aplatis
 */
const styles = (noeud) => [].concat(noeud.props?.style || []).flat(3).filter(Boolean);

/**
 * Les noeuds RENDUS qui portent un style donne.
 *
 * 🪤 On ne garde que les noeuds HOTES : chaque `<Text>` de React Native apparait
 * deux fois dans l arbre — le composant et l element rendu — et compter les deux
 * double tous les resultats.
 * @param {any} arbre l arbre rendu
 * @param {(style: any) => boolean} test ce qu on cherche dans le style
 * @returns {any[]} les noeuds hotes qui correspondent
 */
const hotesAvec = (arbre, test) => arbre.root.findAll(
  (n) => typeof n.type === 'string' && styles(n).some((s) => s && test(s)),
);

beforeEach(() => {
  mockOptionsCrochet = [];
  mockPressePapiers = [];
  mockPropsEnveloppe = [];
});

describe('l entete', () => {
  it('met le compte A COTE du titre, pas sur sa propre ligne', () => {
    const arbre = rendre();
    const vus = textes(arbre);

    expect(vus).toContain('training.logbook.title');
    expect(vus).toContain('3');
    // 🔊 Le chiffre nu ne dit rien a la voix : la phrase entiere vit dans l etiquette.
    expect(arbre.root.findAllByProps({
      accessibilityLabel: 'training.logbook.rows|{"count":3}',
    }).length).toBeGreaterThan(0);
  });

  it('demande le carnet des l ouverture, sans condition', () => {
    rendre();

    expect(mockOptionsCrochet[0]).toEqual({ enabled: true });
  });
});

describe('la vue LISIBLE, celle qui s ouvre en premier', () => {
  it('s ouvre sur elle : on relit avant de copier', () => {
    const arbre = rendre();

    expect(onglets(arbre)[0].props.accessibilityState.selected).toBe(true);
    expect(textes(arbre)).toContain('Sprint 10 metres');
  });

  it('remplace les CODES du carnet par les vrais noms', () => {
    const vus = textes(rendre());

    expect(vus).toContain('Jour T');
    expect(vus).toContain('Sprint 10 metres');
    expect(vus).toContain('Temps sur 10 m · training.logbook.attempt|{"count":1}');
    // Et le code brut n apparait plus tel quel.
    expect(vus).not.toContain('T1');
  });

  it('ecrit la valeur AVEC son unite', () => {
    expect(textes(rendre())).toContain('1.72 s');
  });

  it('pose « calculé » sur la mesure que l app calcule, et sur elle seule', () => {
    const vus = textes(rendre());

    expect(vus.filter((v) => v === 'training.logbook.computed')).toHaveLength(1);
  });

  it('BARRE un essai nul et le marque, au lieu de le cacher', () => {
    const arbre = rendre();
    const barres = arbre.root.findAll(
      (n) => styles(n).some((s) => s && s.textDecorationLine === 'line-through'),
    );

    expect(barres.length).toBeGreaterThan(0);
    expect(textes(arbre)).toContain('training.logbook.void');
  });

  it('dit qu elle NE REMPLACE PAS le carnet brut', () => {
    expect(textes(rendre())).toContain('training.logbook.readableHint');
  });

  it('ne montre AUCUN bouton de copie : la copie appartient au brut', () => {
    expect(rendre().root.findAllByType(Button)).toHaveLength(0);
  });
});

describe('la vue BRUTE, celle qui se colle ailleurs', () => {
  /**
   * Bascule sur l onglet brut.
   * @param {any} arbre l arbre rendu
   * @returns {void} rien
   */
  const versLeBrut = (arbre) => {
    act(() => { onglets(arbre)[1].props.onPress(); });
  };

  it('rend le texte brut LIGNE POUR LIGNE, sans en changer un caractere', () => {
    const arbre = rendre();
    versLeBrut(arbre);
    const vus = textes(arbre);

    CSV.split('\n').forEach((ligne) => expect(vus).toContain(ligne));
  });

  it('detache la ligne des TITRES DE COLONNES, en cyan et soulignee', () => {
    const arbre = rendre();
    versLeBrut(arbre);
    const entete = hotesAvec(
      arbre,
      (s) => s.borderBottomWidth === 1 && s.fontFamily === 'monospace',
    );

    expect(entete).toHaveLength(1);
  });

  it('teinte en OR la ligne dont la neuvieme colonne dit « nul »', () => {
    const arbre = rendre();
    versLeBrut(arbre);
    const ors = hotesAvec(
      arbre,
      (s) => s.fontFamily === 'monospace' && s.color === Colors.gold500,
    );

    // Une seule des trois lignes porte « N » en neuvieme colonne.
    expect(ors).toHaveLength(1);
  });

  it('laisse le texte selectionnable a la main', () => {
    const arbre = rendre();
    versLeBrut(arbre);

    expect(arbre.root.findAllByProps({ selectable: true }).length).toBeGreaterThan(0);
  });

  it('pousse le carnet EXACT dans le presse-papiers et bascule le libelle', () => {
    const arbre = rendre();
    versLeBrut(arbre);
    act(() => { arbre.root.findByType(Button).props.onPress(); });

    expect(mockPressePapiers).toEqual([CSV]);
    expect(arbre.root.findByType(Button).props.title).toBe('training.logbook.copied');
  });

  it('explique a quoi sert le brut', () => {
    const arbre = rendre();
    versLeBrut(arbre);

    expect(textes(arbre)).toContain('training.logbook.rawHint');
  });
});

describe('la page defile, et elle reserve la place de la barre du bas', () => {
  it('pose un defilement de PAGE, et pas seulement autour du carnet', () => {
    const arbre = rendre();

    expect(arbre.root.findAllByType(ScrollView)[0].props.style).toEqual({ flex: 1 });
  });

  it('reserve la place de la barre du bas', () => {
    expect(rendre().root.findAllByProps({ bottomInsetMode: 'tab-scene' }).length)
      .toBeGreaterThan(0);
  });
});

describe('l etat vide', () => {
  it('a son PROPRE titre : il ne redit pas « Mon carnet »', () => {
    const vus = textes(rendre(VIDE));

    expect(vus).toContain('training.logbook.emptyTitle');
    expect(vus.filter((v) => v === 'training.logbook.title')).toHaveLength(1);
  });

  it('a une porte de sortie, et elle mene au planning', () => {
    const navigate = jest.fn();
    const arbre = rendre(VIDE, { navigate });

    const bouton = arbre.root.findByType(Button);
    expect(bouton.props.title).toBe('training.logbook.emptyAction');
    act(() => { bouton.props.onPress(); });
    expect(navigate).toHaveBeenCalledWith('TrainingPlan');
  });

  it('ne montre NI onglets NI carnet quand il n y a rien a montrer', () => {
    const arbre = rendre(VIDE);

    expect(onglets(arbre)).toHaveLength(0);
    expect(textes(arbre)).not.toContain('training.logbook.view.raw');
  });
});

describe('chargement et erreur : l ecran ne les dessine pas, il les delegue', () => {
  it('passe l erreur, l attente et la relance a l enveloppe', () => {
    const relire = jest.fn();
    rendre({
      data: null, error: new Error('reseau'), isLoading: true, refetch: relire,
    });

    expect(mockPropsEnveloppe[0].isLoading).toBe(true);
    expect(mockPropsEnveloppe[0].error).toBeInstanceOf(Error);
    expect(mockPropsEnveloppe[0].onRetry).toBe(relire);
  });
});

describe('ce qui ne doit pas faire tomber l ecran', () => {
  it('traverse un programme absent : la vue lisible se vide, le brut reste', () => {
    mockCarnet = REMPLI;
    mockEntrainement = { enrollment: null, sessions: [] };
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(<TrainingLogbook navigation={{ navigate: jest.fn() }} />);
    });

    expect(textes(arbre)).toContain('training.logbook.readableHint');
    act(() => { onglets(arbre)[1].props.onPress(); });
    expect(textes(arbre)).toContain(CSV.split('\n')[0]);
  });

  it('traverse des donnees absentes', () => {
    expect(() => rendre({
      data: null, error: null, isLoading: false, refetch: () => {},
    })).not.toThrow();
  });
});
