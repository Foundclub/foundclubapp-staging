import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getOnboardingViews } from '@/domains/auth/authUseCases';

import { RouteNames } from '@/navigation/routeNames';

import UserSport from '../UserSport';

// D23 — defaut (2) : « choisir Rugby puis avancer, l'etape Poste ne s'affiche
// pas ». Ce filet reproduit la chaine COMPLETE, y compris le maillon qui
// manquait a tous les tests precedents : `PrivateNavigator` ne monte que les
// ecrans dont `canShow` est vrai, donc `navigation.getState().routeNames` ne
// contient QUE ceux-la. `UserSport` filtre sa destination sur cette liste
// (`resolveAvailableRoute`) : une etape non montee est silencieusement
// remplacee par la suivante.
//
// Avant le correctif : sport encore vide ⇒ `UserPosition.canShow` faux ⇒ pas
// dans `routeNames` ⇒ le joueur atterrissait sur « Physique ». Pour les 5
// sports a postes, pas seulement le rugby.

const mockUserData = { current: /** @type {any} */ (null) };
const mockUpdateMe = jest.fn(() => Promise.resolve({}));
const mockActivities = { current: /** @type {any[]} */ ([]) };

jest.mock('../../../store/appContext', () => ({
  storage: {
    getBoolean: () => false,
    getString: () => null,
    set: () => {},
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve(options.mutationFn(variables))
      .then((data) => options.onSuccess?.(data))
      .catch((error) => options.onError?.(error)),
  }),
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

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

// INSCRIPTION-CODE-2 (19/11) — Avant : un thème en Proxy (chaque style = {}). Le premier écran
// rend désormais le VRAI choix du sport (`ChoixDuSport`), qui lit des clés précises du thème
// (`Images.search`…) : le vrai thème, comme UserRole.RESAINSCR.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});

// La VRAIE machine a etapes, pas une doublure : c'est elle qu'on met en cause.
jest.mock('@/domains/auth/useAuth', () => {
  const { getOnboardingViews: build } = jest.requireActual('@/domains/auth/authUseCases');
  return {
    __esModule: true,
    default: () => ({
      getNextOnboardingRoute: (/** @type {string} */ current) => {
        const { views } = build(mockUserData.current);
        const currentIndex = views.find((view) => view.route === current)?.index || 0;
        return views.find((view) => view.canShow && view.index > currentIndex)?.route;
      },
      getPostOnboardingHomeRoute: () => 'HomeTab',
      refetchUserData: jest.fn(),
      userData: mockUserData.current,
      userDataError: null,
      userDataLoading: false,
    }),
  };
});

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({
    data: mockActivities.current,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: (/** @type {any} */ payload) => mockUpdateMe(payload),
}));

// INSCRIPTION-CODE-3 : le filet « Ville seule » du site (useFiletVilleSeule) lit les Villes et les
// demandes du compte ; ici, au téléphone, il ne joue pas (témoin : UserSport.PORTEMAIRIE).
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useMyCollectivites: () => ({ data: [] }),
  useMyManagerRequests: () => ({ data: [] }),
}));

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ disabled, onPress, title }) => (
      <RNTouchable accessibilityRole="button" disabled={disabled} onPress={onPress}>
        <RNText>{title}</RNText>
      </RNTouchable>
    ),
  };
});

jest.mock('@/components/templates/FormScreenContainer', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <RNView>{children}</RNView> };
});

jest.mock('@/views/onboarding/components/OnboardingStickyFooter', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <RNView>{children}</RNView> };
});

jest.mock('@/views/onboarding/components/OnboardingStateView', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ title }) => <RNText>{title}</RNText> };
});

jest.mock('@/views/onboarding/components/OnboardingSkipLink', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress }) => (
      <RNTouchable accessibilityRole="button" onPress={onPress}>
        <RNText>Passer</RNText>
      </RNTouchable>
    ),
  };
});

const SPORTS = [
  { documentId: 'act-foot', name: 'Football' },
  { documentId: 'act-rugby', name: 'Rugby' },
  { documentId: 'act-basket', name: 'Basketball' },
  { documentId: 'act-hand', name: 'Handball' },
  { documentId: 'act-volley', name: 'Volleyball' },
  { documentId: 'act-tennis', name: 'Tennis' },
];

const joueur = () => ({
  birthdate: '2000-01-01',
  documentId: 'user-d23',
  firstname: 'Ada',
  lastname: 'Test',
  role: { name: 'Joueur' },
});

// LE MAILLON MANQUANT : `PrivateNavigator` monte ses ecrans sur `canShow`.
// `routeNames` reproduit donc exactement ce que le navigateur contient.
const routeNamesMontes = () => getOnboardingViews(mockUserData.current)
  .views
  .filter((view) => view.canShow)
  .map((view) => view.route);

const rendre = () => {
  const navigation = {
    getState: () => ({ routeNames: routeNamesMontes() }),
    navigate: jest.fn(),
  };
  let arbre;
  act(() => {
    arbre = renderer.create(<UserSport navigation={/** @type {any} */ (navigation)} />);
  });
  return { navigation, tree: /** @type {any} */ (arbre) };
};

const pressable = (tree, libelle) => tree.root
  .findAllByType(TouchableOpacity)
  .find((node) => node.findAllByType(Text)
    .some((texte) => String(texte.props.children) === libelle));

const choisirPuisContinuer = async (tree, sport) => {
  await act(async () => { pressable(tree, sport).props.onPress(); });
  await act(async () => { pressable(tree, 'Continuer').props.onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockActivities.current = SPORTS;
  mockUserData.current = joueur();
});

// INSCRIPTION-CODE-2 (19/11/2026) — L'ACTIVITÉ EST LE PREMIER ÉCRAN (INSCRIPTION-CODE (a),
// 0e24eef92, V1 3.5 + v2_01). Avant : le sport venait juste avant le poste, et ces témoins
// disaient « la suite est l'étape Poste ». Le poste est maintenant plus loin (après section,
// ville, photo) : ce qui reste à garantir de D23 (2), c'est que la suite se calcule sur le sport
// NEUF, et que le poste est bien dans le parcours de ce sport-là (canShow vrai).
const parcoursAvec = (/** @type {string} */ sport) => getOnboardingViews({
  ...mockUserData.current, preferredSport: sport,
}).views;
const posteMonte = (/** @type {string} */ sport) => parcoursAvec(sport)
  .find((view) => view.route === RouteNames.UserPosition)?.canShow;

describe('UserSport — le sport choisi met l`etape Poste dans le parcours (D23 (2))', () => {
  // Avant : expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.UserPosition, {
  // selectedSport: sport })
  it.each(['Rugby', 'Football', 'Basketball', 'Handball', 'Volleyball'])(
    '%s : enregistré, l`etape Poste est dans son parcours, la suite est la Section',
    async (sport) => {
      const { navigation, tree } = rendre();
      await choisirPuisContinuer(tree, sport);

      expect(mockUpdateMe).toHaveBeenCalledWith({ preferredSport: sport });
      expect(posteMonte(sport)).toBe(true);
      expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.UserSection, undefined);
    },
  );

  // Avant : « le sport voyage en parametre » vers Poste. Le paramètre ne sert que si Poste suit
  // IMMÉDIATEMENT (UserSport.js, `nextRoute === RouteNames.UserPosition`) : la règle est gardée.
  it('compte neuf : la suite est « Qui es-tu ? », sans parametre', async () => {
    mockUserData.current = { documentId: 'user-neuf', role: { type: 'authenticated' } };
    const { navigation, tree } = rendre();
    await choisirPuisContinuer(tree, 'Rugby');

    expect(mockUpdateMe).toHaveBeenCalledWith({ preferredSport: 'Rugby' });
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.UserName, undefined);
  });

  // Avant : « un sport sans postes va directement a l`etape Physique ».
  it('un sport sans postes : pas d`etape Poste dans son parcours', async () => {
    const { navigation, tree } = rendre();
    await act(async () => { pressable(tree, 'Toutes les activités, de A à Z').props.onPress(); });
    await choisirPuisContinuer(tree, 'Tennis');

    expect(mockUpdateMe).toHaveBeenCalledWith({ preferredSport: 'Tennis' });
    expect(posteMonte('Tennis')).toBe(false);
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.UserSection, undefined);
  });
});

// Avant : « Passer » (bandeau Facultatif) sautait le sport ET le poste, vers Physique. V01 : plus
// de
// « Passer » ; « Je ne trouve pas mon activité » (V02) prend son chemin : rien d'enregistré, et
// jamais l'écran Poste (D23 : sans sport, Poste n'a rien à proposer).
describe('UserSport — « Je ne trouve pas mon activité » saute aussi l`etape Poste (D23)', () => {
  it('pas de « Passer » a l`ecran', () => {
    const { tree } = rendre();
    expect(pressable(tree, 'Passer')).toBeUndefined();
  });

  it('sans sport, rien n`est enregistre et on ne traverse pas l`ecran Poste', async () => {
    const { navigation, tree } = rendre();
    await act(async () => { pressable(tree, 'Je ne trouve pas mon activité').props.onPress(); });

    expect(mockUpdateMe).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.UserSection);
    expect(navigation.navigate)
      .not.toHaveBeenCalledWith(RouteNames.UserPosition, expect.anything());
  });
});

// INSCRIPTION-PARCOURS (D245, 18/11) — « la recherche est trop stricte » (un vrai inscrit). Le
// filtre ignorait la casse, pas les accents : « speleo » ne trouvait pas « Spéléologie », ni
// « petanque » « Pétanque ». Sur 132 sports de la recette, 37 portent un accent (compté le 18/11).
describe('UserSport — la recherche ignore la casse et les accents (D245)', () => {
  const taper = async (tree, texte) => {
    const { TextInput } = jest.requireActual('react-native');
    await act(async () => { tree.root.findByType(TextInput).props.onChangeText(texte); });
  };

  it.each([
    ['speleo', 'Spéléologie'],
    ['petanque', 'Pétanque'],
    ['EQUITATION', 'Équitation'],
    ['karate', 'Karaté'],
    ['FOOT', 'Football'],
  ])('« %s » trouve « %s »', async (texte, sport) => {
    mockActivities.current = [
      ...SPORTS,
      { documentId: 'act-speleo', name: 'Spéléologie' },
      { documentId: 'act-petanque', name: 'Pétanque' },
      { documentId: 'act-equitation', name: 'Équitation' },
      { documentId: 'act-karate', name: 'Karaté' },
    ];
    const { tree } = rendre();
    await taper(tree, texte);

    expect(pressable(tree, sport)).toBeDefined();
    expect(pressable(tree, 'Tennis')).toBeUndefined();
  });
});
