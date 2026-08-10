import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Welcome from '../Welcome';

// D23 — defaut ⑤ de la recette du 2026-08-07 : « l'ecran de bienvenue se saute
// tout seul ».
//
// CAUSE : un `useEffect` de montage lancait le tour guide sans aucun clic
// (decision C10/D2, « le tour se lance automatiquement »). L'ecran partait
// avant d'etre lu. Pire : le meme effet posait `hasSeenWelcome_<id>` au
// passage, et ce drapeau est justement celui qui empeche
// `getNextOnboardingRoute` d'y revenir — l'ecran devenait INJOIGNABLE apres un
// seul montage, pour toujours.
//
// La decision d'Adel du 2026-08-06 dit l'inverse : « Bienvenue sort du COMPTEUR
// mais n'est PAS supprime », il doit arriver a la fin et lancer le tour guide.
// Ces tests figent le fait qu'il ne part QUE sur une action de l'utilisateur.

const mockStartTour = jest.fn(() => true);
const mockStorageSet = jest.fn();
const mockMarkOnboardingComplete = jest.fn();
const mockRole = { current: /** @type {string} */ ('coach') };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  // D59 ② — `Colors` vient du VRAI module : le rail de progression lit des
  // jetons nommes (`violet500` pour l'offre Club, `success500` pour l'etape
  // acquise). Un Proxy rendrait n'importe quelle cle et laisserait passer une
  // faute de frappe ; le vrai objet la fait tomber.
  const { colors } = jest.requireActual('@/theme/colors');
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Colors: colors,
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('@/domains/auth/authUseCases', () => ({
  getUserRoleKey: () => mockRole.current,
  markOnboardingComplete: (/** @type {string} */ id) => mockMarkOnboardingComplete(id),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getPostOnboardingHomeRoute: () => 'HomeTab',
    refetchUserData: jest.fn(),
    userData: { documentId: 'user-d23', role: { name: 'Entraineur' } },
    userDataError: null,
    userDataLoading: false,
  }),
}));

jest.mock('@/store/appContext', () => ({
  storage: {
    getBoolean: () => false,
    set: (/** @type {string} */ key, /** @type {any} */ value) => mockStorageSet(key, value),
  },
  useAppContext: () => [{ auth: { user: { documentId: 'user-d23' } } }, jest.fn()],
}));

jest.mock('@/context/TourContext', () => ({
  useTour: () => ({ startTour: mockStartTour }),
}));

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress, title }) => (
      <RNTouchable accessibilityRole="button" onPress={onPress}>
        <RNText>{title}</RNText>
      </RNTouchable>
    ),
  };
});

jest.mock('@/components/templates/FormScreenContainer', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <RNView>{children}</RNView> };
});

jest.mock('@/views/onboarding/components/OnboardingStateView', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ title }) => <RNText>{title}</RNText> };
});

const rendre = () => {
  const navigation = { navigate: jest.fn(), replace: jest.fn(), reset: jest.fn() };
  let arbre;
  act(() => {
    arbre = renderer.create(<Welcome navigation={/** @type {any} */ (navigation)} />);
  });
  return { navigation, tree: /** @type {any} */ (arbre) };
};

const textes = (tree) => tree.root
  .findAllByType(Text)
  .map((node) => node.props.children)
  .flat()
  .filter((value) => typeof value === 'string');

const pressableParTexte = (tree, libelle) => tree.root
  .findAllByType(TouchableOpacity)
  .find((node) => node.findAllByType(Text)
    .some((texte) => String(texte.props.children) === libelle));

beforeEach(() => {
  jest.clearAllMocks();
  mockStartTour.mockReturnValue(true);
  mockRole.current = 'coach';
});

describe('Welcome — l`ecran ne se saute plus tout seul (D23 ⑤)', () => {
  it.each(['coach', 'president', 'player'])(
    '%s : au montage, le tour guide NE demarre PAS',
    (role) => {
      mockRole.current = role;
      const { navigation } = rendre();

      // C'ETAIT LE DEFAUT : `startTour` partait dans un effet de montage.
      expect(mockStartTour).not.toHaveBeenCalled();
      expect(navigation.reset).not.toHaveBeenCalled();
    },
  );

  it.each(['coach', 'president', 'player'])(
    '%s : au montage, rien n`est ecrit — l`ecran reste joignable',
    (role) => {
      mockRole.current = role;
      rendre();

      // `hasSeenWelcome_` est le drapeau qui empeche `getNextOnboardingRoute`
      // de revenir ici. Le poser au montage rendait l'ecran injoignable.
      expect(mockStorageSet).not.toHaveBeenCalled();
      expect(mockMarkOnboardingComplete).not.toHaveBeenCalled();
    },
  );

  it('l`ecran affiche bien les trois offres au dirigeant', () => {
    mockRole.current = 'president';
    const { tree } = rendre();

    // D59 ② — CE TEST A CHANGE D'ANCRE, PAS D'INTENTION. Il verifiait les
    // libelles « Gratuit / Équipe / Club », qui etaient les surtitres des trois
    // cartes. Le pack les remplace par les etapes d'un chemin (« Aujourd'hui »,
    // « Quand ton équipe grandit », « Quand ton club s'organise »).
    // Les TITRES, eux, sont les memes avant et apres : ils disent « il y a bien
    // trois offres » sans dependre de l'habillage.
    expect(textes(tree)).toEqual(
      expect.arrayContaining([
        'Commence sans payer',
        'Débloque tes équipes',
        'Pilote tout le club',
      ]),
    );
  });
});

describe('Welcome — c`est LUI qui lance le tour guide, sur action (D23 ⑤)', () => {
  it('l`entraineur demarre le tour depuis le bouton', () => {
    const { navigation, tree } = rendre();

    act(() => { pressableParTexte(tree, 'Démarrer le tour guidé').props.onPress(); });

    expect(mockStartTour).toHaveBeenCalledWith('coach');
    expect(mockStorageSet).toHaveBeenCalledWith('hasSeenWelcome_user-d23', true);
    expect(mockMarkOnboardingComplete).toHaveBeenCalledWith('user-d23');
    // Le tour a demarre : il prend la main, on ne repart pas a l'accueil.
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('le dirigeant demarre le tour dirigeant', () => {
    mockRole.current = 'president';
    const { tree } = rendre();

    act(() => { pressableParTexte(tree, 'Démarrer le tour guidé').props.onPress(); });

    expect(mockStartTour).toHaveBeenCalledWith('president');
  });

  it('sans script de tour, le bouton reconduit a l`accueil plutot que nulle part', () => {
    mockStartTour.mockReturnValue(false);
    const { navigation, tree } = rendre();

    act(() => { pressableParTexte(tree, 'Démarrer le tour guidé').props.onPress(); });

    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'HomeTab' }],
    });
  });
});

// D59 ② — le chemin en 3 etapes (pack `pw-welcome2.jsx`, frame 12c).
describe('Welcome — le chemin en 3 etapes remplace les 3 cartes (D59 ②)', () => {
  /**
   * Toutes les couleurs de fond posees par l'ecran, aplaties.
   * @param {any} tree
   * @returns {string[]}
   */
  const couleursDeFond = (tree) => JSON.stringify(tree.toJSON())
    .split('"backgroundColor":"')
    .slice(1)
    .map((/** @type {string} */ morceau) => morceau.split('"')[0]);

  it('les trois etapes sont nommees dans l ordre du chemin', () => {
    mockRole.current = 'president';
    const { tree } = rendre();
    const rendus = textes(tree);

    // C'est la narration du sous-titre qui devient la structure : un point de
    // depart acquis, puis deux jalons.
    expect(rendus).toEqual(expect.arrayContaining([
      "Aujourd'hui",
      'Quand ton équipe grandit',
      "Quand ton club s'organise",
    ]));
    expect(rendus.indexOf("Aujourd'hui")).toBeLessThan(rendus.indexOf('Quand ton équipe grandit'));
    expect(rendus.indexOf('Quand ton équipe grandit'))
      .toBeLessThan(rendus.indexOf("Quand ton club s'organise"));
  });

  it('l etape Club est VIOLETTE, et il ne reste aucun vert d offre', () => {
    const { colors, withAlpha } = jest.requireActual('@/theme/colors');
    const { tree } = rendre();
    const fonds = couleursDeFond(tree);

    // ⛔ LE TEMOIN D'ARRET. Il ne suffit pas de chercher l'ancien vert : ce test
    // exige que CHAQUE fond pose par l'ecran vienne d'un jeton du theme. Un
    // `rgba(16,185,129,…)` — l'emeraude hors palette qui peignait l'offre Club —
    // n'est dans aucune de ces valeurs, donc il tombe, comme tomberait n'importe
    // quelle couleur inventee plus tard.
    //
    // ⚠️ Aucun `#hex` litteral ici : `verify:theme-contract` SCANNE AUSSI LES
    // TESTS, et un hex ecrit en dur fait tomber la porte.
    const fondsAutorises = new Set([
      colors.primary500, // point central de l'etape Equipe
      colors.success500, // pastille de l'etape acquise
      colors.transparent, // pastilles des 2 etapes a venir
      colors.violet500, // point central de l'etape Club
      withAlpha(colors.neutral00, 0.05), // carte Gratuit
      withAlpha(colors.primary500, 0.09), // carte Equipe
      withAlpha(colors.violet500, 0.09), // carte Club
    ]);

    expect(fonds.length).toBeGreaterThan(0);
    fonds.forEach((/** @type {string} */ fond) => {
      expect(fondsAutorises.has(fond)).toBe(true);
    });
    // Et le violet est bien POSE, pas seulement autorise.
    expect(fonds).toContain(withAlpha(colors.violet500, 0.09));
    // Le vert reste, mais a SA place : l'etape deja acquise.
    expect(fonds).toContain(colors.success500);
  });

  it('la coche des puces est l icone du DS, plus le glyphe texte', () => {
    const { tree } = rendre();

    expect(textes(tree)).not.toContain('✓');
  });

  it('la reassurance et le pont encadrent le bouton', () => {
    const reassurance = 'Tu retrouveras les offres à tout moment dans Profil → Mon abonnement.';
    const pont = 'Gratuit · 2 min — tu crées ta 1ʳᵉ équipe en chemin';
    const { tree } = rendre();
    const rendus = textes(tree);

    // La reassurance etait sous le pli : elle doit passer AVANT le bouton.
    expect(rendus).toContain(reassurance);
    expect(rendus).toContain(pont);
    expect(rendus.indexOf(reassurance))
      .toBeLessThan(rendus.indexOf('Démarrer le tour guidé'));
    expect(rendus.indexOf('Démarrer le tour guidé'))
      .toBeLessThan(rendus.indexOf(pont));
  });

  it('le pont parle du CLUB au dirigeant, pas de l equipe', () => {
    mockRole.current = 'president';
    const { tree } = rendre();

    expect(textes(tree)).toContain('Gratuit · 2 min — tu configures ton club en chemin');
  });
});
