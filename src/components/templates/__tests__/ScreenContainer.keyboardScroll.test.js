import fs from 'fs';
import path from 'path';

import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FormScreenContainer from '../FormScreenContainer';
import ScreenContainer from '../ScreenContainer';

// U02 — « quand on clique sur un champ qui est en bas, il faut qu'il aille
// au-dessus du clavier, au milieu de l'ecran : la on ne voit pas ce qu'on
// ecrit » (constat d'Adel du 2026-08-26, capture iPhone, onboarding 1/5
// « Qui es-tu ? » : la date de naissance est a moitie recouverte et le bouton
// « Continuer » est ecrase sous le clavier).
//
// LA CAUSE, MESUREE : `ScreenContainer` monte bien un KeyboardAvoidingView,
// mais il ne contient AUCUN ScrollView (`grep -c ScrollView` = 0). Quand le
// clavier monte, l'evitement COMPRIME donc le contenu — et comme rien ne
// defile, ce qui depasse devient INATTEIGNABLE. Les temoins D23/D31 voisins
// prouvent que la compression vaut exactement le recouvrement : ils mesurent
// une hauteur qui RESTE, jamais ce qu'on peut encore atteindre dedans.
//
// 🧨 POURQUOI L'OPTION EST OPT-IN, ET C'EST UNE MESURE, PAS UN GOUT :
// `keyboardAvoiding` est actif sur 20 ecrans (19 via FormScreenContainer + 1
// direct), et 13 de ces 20 portent DEJA leur propre ScrollView / FlatList. Un
// ScrollView pose sans condition dans le conteneur partage imbriquerait donc
// deux defilements verticaux sur 13 ecrans — physique de defilement cassee et
// virtualisation des listes perdue. Le balayage du bas fige cette regle.

const HAUTEUR_ENCOCHE_BASSE = 34;
const MARGE_VERTICALE = 24;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    // ⛔ PAS de `{ fill: {}, grow1: {} }` ici : ce lot se joue justement sur la
    // difference entre `flex: 1` et `flexGrow: 1`. Un mock vide rendrait tous
    // les temoins ci-dessous verts sur du code casse.
    Alignments: jest.requireActual('@/theme/alignements').default,
    Images: { bg1: 1, bg2: 2, bg3: 3 },
  }),
}));

jest.mock('@react-navigation/elements', () => ({
  // eslint-disable-next-line global-require
  HeaderHeightContext: require('react').createContext(96),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingTabBarScenePaddingBottom: () => 134,
}));

const originalOS = Platform.OS;

afterEach(() => {
  Platform.OS = originalOS;
});

// Le decor de l'ecran d'Adel, repris tel quel de UserName.js : marge verticale,
// retrait bas pose par l'ecran (D31), et le couple justifySpaceBetween + fill
// qui ecarte le bloc des champs du bloc du bouton.
const styleContenuDeLEcran = () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  return [
    { paddingVertical: MARGE_VERTICALE },
    { marginBottom: HAUTEUR_ENCOCHE_BASSE },
    Alignments.justifySpaceBetween,
    Alignments.fill,
  ];
};

/**
 * Monte un conteneur avec le decor de l'ecran « Qui es-tu ? ».
 * @param {object} props Les options du conteneur.
 * @param {boolean} [props.keyboardAvoiding] Evitement du clavier.
 * @param {boolean} [props.keyboardScroll] Defilement sous le clavier.
 * @returns {any} L'arbre rendu.
 */
const monter = ({ keyboardAvoiding, keyboardScroll } = {}) => {
  /** @type {any} */
  let tree;
  act(() => {
    tree = renderer.create(
      <ScreenContainer
        bottomInsetMode="edge-to-edge"
        contentContainerStyle={styleContenuDeLEcran()}
        keyboardAvoiding={keyboardAvoiding}
        keyboardScroll={keyboardScroll}
      >
        <Text>les champs</Text>
        <Text testID="bouton-continuer">Continuer</Text>
      </ScreenContainer>,
    );
  });
  return tree;
};

const defilements = (tree) => tree.root.findAllByType(ScrollView);
const evitements = (tree) => tree.root.findAllByType(KeyboardAvoidingView);

// ---------------------------------------------------------------------------
// D5 — LE FILET D'ABORD : ce que l'ecran rend AUJOURD'HUI, clavier ferme.
// Ces trois temoins sont VERTS avant le correctif. Ils ne decrivent pas un
// souhait, ils figent l'existant pour que la suite prouve ce qui bouge.
// ---------------------------------------------------------------------------

describe('D5 — caracterisation du rendu actuel, clavier ferme', () => {
  it('l evitement du clavier est bien monte, et il est UNIQUE (D23 protege)', () => {
    Platform.OS = 'ios';
    const tree = monter({ keyboardAvoiding: true });

    expect(evitements(tree)).toHaveLength(1);
    expect(evitements(tree)[0].props.keyboardVerticalOffset).toBe(0);
  });

  it('LE DEFAUT D ADEL : sans option, le contenu ne peut PAS defiler', () => {
    Platform.OS = 'ios';

    // C'est exactement la mesure du prompt : `grep -c ScrollView` = 0.
    expect(defilements(monter({ keyboardAvoiding: true }))).toHaveLength(0);
  });

  it('sans `keyboardAvoiding` : ni evitement, ni defilement', () => {
    const tree = monter({});

    expect(evitements(tree)).toHaveLength(0);
    expect(defilements(tree)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// D1 / D2 / D3 — LE TEMOIN ROUGE : avec l'option, le contenu defile et le bas
// de l'ecran redevient atteignable.
// ---------------------------------------------------------------------------

describe('D1 — le contenu peut defiler quand le clavier est la', () => {
  it('un ScrollView, un seul, et il vit DANS l evitement', () => {
    Platform.OS = 'ios';
    const tree = monter({ keyboardAvoiding: true, keyboardScroll: true });

    expect(defilements(tree)).toHaveLength(1);
    expect(evitements(tree)).toHaveLength(1);
    // Dedans, jamais autour : c'est l'evitement qui retire le recouvrement,
    // et le defilement qui rend atteignable ce qui reste.
    expect(evitements(tree)[0].findAllByType(ScrollView)).toHaveLength(1);
  });

  it('⛔ `keyboardShouldPersistTaps=handled` : le 1er appui sur Continuer AGIT', () => {
    Platform.OS = 'ios';
    const [defilement] = defilements(monter({ keyboardAvoiding: true, keyboardScroll: true }));

    // Sans lui, le premier appui ne fait que refermer le clavier et Adel le
    // verrait tout de suite sur « Continuer » : il faudrait appuyer deux fois.
    expect(defilement.props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('🧨 le contenu ne porte PLUS `flex: 1` — il interdisait tout defilement', () => {
    Platform.OS = 'ios';
    const [defilement] = defilements(monter({ keyboardAvoiding: true, keyboardScroll: true }));
    const style = StyleSheet.flatten(defilement.props.contentContainerStyle);

    // `flex: 1` BORNE le contenu a la hauteur visible : dans un ScrollView il
    // rend le defilement impossible, en silence, et aucun pixel ne le dit.
    expect(style.flex).toBeUndefined();
    // `flexGrow: 1` donne la MEME image quand le contenu tient dans l'ecran,
    // et le laisse depasser quand il deborde. C'est toute la bascule.
    expect(style.flexGrow).toBe(1);
  });

  it('le style de l ecran est conserve mot pour mot (D4)', () => {
    Platform.OS = 'ios';
    const [defilement] = defilements(monter({ keyboardAvoiding: true, keyboardScroll: true }));
    const style = StyleSheet.flatten(defilement.props.contentContainerStyle);

    expect(style.paddingVertical).toBe(MARGE_VERTICALE);
    expect(style.marginBottom).toBe(HAUTEUR_ENCOCHE_BASSE);
    // C'est lui qui ecarte le bloc des champs du bloc du bouton : le perdre
    // ferait remonter « Continuer » contre les champs.
    expect(style.justifyContent).toBe('space-between');
  });
});

describe('D2 — le champ focalise remonte au-dessus du clavier', () => {
  it('`automaticallyAdjustKeyboardInsets` : la remontee est NATIVE, pas calculee', () => {
    Platform.OS = 'ios';
    const [defilement] = defilements(monter({ keyboardAvoiding: true, keyboardScroll: true }));

    // ⛔ Aucune hauteur de clavier calculee a la main, aucune dependance neuve :
    // c'est iOS qui amene le champ actif dans la zone visible, et c'est deja le
    // motif de WizardStepLayout dans ce depot.
    expect(defilement.props.automaticallyAdjustKeyboardInsets).toBe(true);
  });

  it('aucun decalage en dur ne se glisse dans l evitement (D23/D31 protegees)', () => {
    Platform.OS = 'ios';
    const tree = monter({ keyboardAvoiding: true, keyboardScroll: true });

    expect(evitements(tree)).toHaveLength(1);
    expect(evitements(tree)[0].props.keyboardVerticalOffset).toBe(0);
    expect(evitements(tree)[0].props.behavior).toBe('padding');
  });

  it('Android garde son comportement actif', () => {
    Platform.OS = 'android';
    const tree = monter({ keyboardAvoiding: true, keyboardScroll: true });

    expect(evitements(tree)[0].props.behavior).toBe('height');
  });
});

describe('D3 — le bouton d action reste atteignable', () => {
  it('« Continuer » est DANS la zone qui defile, jamais ecrase sous le clavier', () => {
    Platform.OS = 'ios';
    const [defilement] = defilements(monter({ keyboardAvoiding: true, keyboardScroll: true }));

    // S'il etait hors du ScrollView, il resterait sous le clavier : c'est
    // exactement la capture d'Adel.
    expect(defilement.findAllByProps({ testID: 'bouton-continuer' }).length).toBeGreaterThan(0);
  });

  it('la barre de defilement reste invisible : rien de neuf a l ecran (D4)', () => {
    Platform.OS = 'ios';
    const [defilement] = defilements(monter({ keyboardAvoiding: true, keyboardScroll: true }));

    expect(defilement.props.showsVerticalScrollIndicator).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D4 — RIEN NE CHANGE POUR QUI NE DEMANDE RIEN.
// C'est le temoin le plus important du lot : `ScreenContainer` sert 151
// fichiers, l'option doit etre invisible pour tous les autres.
// ---------------------------------------------------------------------------

describe('D4 — sans l option, la structure est celle d avant, a l identique', () => {
  it('le contenu reste une simple View, avec le style de l appelant INTACT', () => {
    Platform.OS = 'ios';
    const tree = monter({ keyboardAvoiding: true });
    // La 1re View est celle que monte l'evitement lui-meme : on cherche celle
    // qui porte le style de l'appelant, pas la premiere venue.
    const contenu = evitements(tree)[0]
      .findAllByType(View)
      .find((vue) => StyleSheet.flatten(vue.props.style)?.paddingVertical === MARGE_VERTICALE);
    const style = StyleSheet.flatten(contenu.props.style);

    // `flex: 1` est CONSERVE ici : hors ScrollView il ne gene rien, et le
    // retirer changerait le rendu des 19 autres ecrans.
    expect(style.flex).toBe(1);
    expect(style.flexGrow).toBe(1);
    expect(style.paddingVertical).toBe(MARGE_VERTICALE);
    expect(style.justifyContent).toBe('space-between');
  });

  it('FormScreenContainer ne fait PAS defiler ses ecrans par surprise', () => {
    Platform.OS = 'ios';
    /** @type {any} */
    let tree;
    act(() => {
      tree = renderer.create(
        <FormScreenContainer>
          <Text>contenu</Text>
        </FormScreenContainer>,
      );
    });

    // Le defilement se demande, il ne se herite pas : les 18 autres ecrans du
    // tunnel gardent exactement le rendu d'aujourd'hui.
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// LA GARDE ANTI-IMBRICATION — la raison meme pour laquelle l'option existe.
// ---------------------------------------------------------------------------

const DOSSIER_ONBOARDING = path.join(__dirname, '..', '..', '..', 'views', 'onboarding');
const ECRANS_AUTH = [
  path.join(__dirname, '..', '..', '..', 'views', 'Login.js'),
  path.join(__dirname, '..', '..', '..', 'views', 'Register.js'),
];

const lireEcrans = () => [
  ...fs.readdirSync(DOSSIER_ONBOARDING)
    .filter((nom) => nom.endsWith('.js'))
    .map((nom) => path.join(DOSSIER_ONBOARDING, nom)),
  ...ECRANS_AUTH,
].map((fichier) => ({
  name: path.basename(fichier),
  source: fs.readFileSync(fichier, 'utf8'),
}));

describe('⛔ Jamais deux defilements verticaux l un dans l autre', () => {
  it('le balayage lit bien tout le tunnel', () => {
    // Temoin anti-faux-vert : un balayage qui ne lit rien passe au vert.
    expect(lireEcrans().length).toBeGreaterThanOrEqual(18);
  });

  it.each(lireEcrans())(
    '$name : s il active `keyboardScroll`, il n a pas deja son propre defilement',
    ({ source }) => {
      if (!source.includes('keyboardScroll')) return;

      // 13 des 20 ecrans a clavier portent deja un ScrollView ou une FlatList.
      // Leur ajouter celui du conteneur casserait la physique du defilement et
      // la virtualisation des listes. C'est pour EUX que l'option est opt-in.
      expect(source).not.toMatch(/<(ScrollView|FlatList|FlashList|SectionList)/);
    },
  );

  it('l ecran d Adel — « Qui es-tu ? » — active bien le defilement', () => {
    const userName = lireEcrans().find(({ name }) => name === 'UserName.js');

    expect(userName?.source).toContain('keyboardScroll');
  });
});
