import {
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import UserAffiliationGuide, { AFFILIATION_TEST_IDS } from '../UserAffiliationGuide';

// FILET E6 — écrit AVANT la refonte L05 (« Trouve ton club », design 6b).
// Le fichier faisait 1 274 lignes et n'avait AUCUN test : sur une base à 5 424
// erreurs de type gelées, rien n'aurait dit qu'une branche retirée servait.
//
// Ces tests visent des COMPORTEMENTS qui doivent survivre au redesign, pas des
// libellés :
//   1. le titre de l'étape club,
//   2. sauter l'étape passe par getNextOnboardingRoute (« Continuer plus tard »
//      hier, « Passer » dans le header aujourd'hui),
//   3. la saisie arrive filtrée dans la requête clubs après le debounce,
//   4. liste vide => zéro club affiché, mais le chemin « je ne trouve pas mon
//      club » reste offert,
//   5. le joueur ayant choisi un club bascule sur l'étape ÉQUIPE (le redesign
//      ne couvre que l'étape club : cette branche ne doit pas disparaître).

const mockGetNextOnboardingRoute = jest.fn();
const mockUseGetClubs = jest.fn();
const mockUseGetTeams = jest.fn();
const mockRequestLocation = jest.fn();
const mockCanUseGeolocation = jest.fn(() => true);
const mockRoleKey = { current: 'player' };

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // i18next rend le 2e argument chaîne comme defaultValue et interpole {{x}} :
    // le mock fait pareil, sinon les libellés a11y porteraient « {{name}} ».
    t: (
      /** @type {string} */ key,
      /** @type {any} */ fallback,
      /** @type {any} */ options,
    ) => {
      const template = typeof fallback === 'string' ? fallback : key;
      const values = typeof fallback === 'object' && fallback !== null ? fallback : options;
      if (!values) return template;
      return template.replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ whole, /** @type {string} */ name) => (
          values[name] === undefined ? whole : String(values[name])
        ),
      );
    },
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
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('@/domains/auth/authUseCases', () => ({
  getUserRoleKey: () => mockRoleKey.current,
  markOnboardingComplete: jest.fn(),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getNextOnboardingRoute: mockGetNextOnboardingRoute,
    getPostOnboardingHomeRoute: () => 'HomeTab',
    onboardingViews: { totalViews: 4, views: [{ index: 3, route: 'UserAffiliationGuide' }] },
    refetchUserData: jest.fn(),
    userData: { documentId: 'user-1', preferredSport: 'Football', role: { name: 'Joueur' } },
    userDataError: null,
    userDataLoading: false,
  }),
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ getClubFiltersNumber: () => 0 }),
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ clubFilters: {} }, jest.fn()],
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClubs: (/** @type {any} */ params, /** @type {any} */ options) => (
    mockUseGetClubs(params, options)
  ),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: (/** @type {any} */ params, /** @type {any} */ options) => (
    mockUseGetTeams(params, options)
  ),
}));

jest.mock('@/services/clubRequest/clubRequestService', () => ({
  createClubRequest: jest.fn(),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [{ documentId: 'act-foot', name: 'Football' }] }),
}));

// D23 ④ — `canUseSearchMapGeolocation` dit si l'appareil expose seulement une
// API de géolocalisation. Sur natif, React Native 0.78 ne définit PAS
// `navigator.geolocation` (aucun `setUpGeolocation`, aucun paquet installé) :
// elle rend donc `false`, et « Autour de moi » ne peut pas aboutir.
jest.mock('@/platform/maps/searchMapGeolocation', () => ({
  canUseSearchMapGeolocation: () => mockCanUseGeolocation(),
  requestCurrentSearchMapLocation: () => mockRequestLocation(),
}));

// ScreenContainer tire @react-navigation/elements, publié en ESM : hors sujet ici.
// Les props sont reportées sur la vue de remplacement : le retrait bas est un
// RÉGLAGE du conteneur, il ne se lit nulle part ailleurs (L23 / D2).
jest.mock('@/components/templates/FormScreenContainer', () => {
  /* eslint-disable global-require */
  const React = require('react');
  const RN = require('react-native');
  /* eslint-enable global-require */
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, ...props }) => React.createElement(
      RN.View,
      { ...props, testID: 'form-screen-container' },
      children,
    ),
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
jest.mock('@/components/molecules/onboardingOverlay/OnboardingOverlay', () => () => null);

const emptyQuery = {
  data: { pages: [{ data: [] }] },
  error: null,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  isRefetching: false,
  refetch: jest.fn(),
};

const queryWith = (/** @type {any[]} */ data) => ({ ...emptyQuery, data: { pages: [{ data }] } });

const CLUBS = [
  {
    address: { label: '22 Boulevard des dames 13002 Marseille', lat: 43.3, lng: 5.37 },
    addressDetails: '22 Boulevard des dames 13002 Marseille',
    documentId: 'club-1',
    id: 1,
    name: 'FC Fuveau',
  },
  {
    addressDetails: '75001 Paris',
    documentId: 'club-2',
    id: 2,
    name: 'Paris Sportif',
  },
];

/**
 * Rend l'écran avec une navigation espionne.
 * Le header est posé par le navigateur : ses éléments (stepper, « Passer »)
 * ne vivent pas dans l'arbre de l'écran mais dans les options. On les capture
 * pour pouvoir les inspecter comme le reste.
 * @returns {{ tree: any, navigation: any, headerNodes: () => any[] }}
 */
const renderScreen = () => {
  /** @type {Record<string, any>} */
  const headerOptions = {};
  const navigation = {
    navigate: jest.fn(),
    reset: jest.fn(),
    setOptions: (/** @type {Record<string, any>} */ options) => Object.assign(
      headerOptions,
      options,
    ),
  };

  let tree;
  act(() => {
    tree = renderer.create(<UserAffiliationGuide navigation={navigation} />);
  });

  const headerNodes = () => ['headerTitle', 'headerRight', 'headerLeft']
    .map((slot) => (typeof headerOptions[slot] === 'function' ? headerOptions[slot]() : null))
    .filter(Boolean)
    .map((element) => {
      let headerTree;
      act(() => { headerTree = renderer.create(element); });
      return headerTree;
    });

  return { headerNodes, navigation, tree };
};

/**
 * Cherche une poignée de test dans l'écran, puis dans le header.
 * @param {{ tree: any, headerNodes: () => any[] }} rendered - Rendu de l'écran.
 * @param {string} testID - Poignée recherchée.
 * @returns {any} - Le premier nœud portant la poignée.
 */
const findHandle = (rendered, testID) => {
  const inScreen = rendered.tree.root.findAll((node) => node.props?.testID === testID);
  if (inScreen.length > 0) return inScreen[0];

  const found = rendered.headerNodes()
    .flatMap((headerTree) => headerTree.root.findAll((node) => node.props?.testID === testID));
  return found[0];
};

/**
 * Active la première zone tactile sous une poignée de test.
 * @param {{ tree: any, headerNodes: () => any[] }} rendered - Rendu de l'écran.
 * @param {string} testID - Poignée recherchée.
 * @returns {void}
 */
const pressHandle = (rendered, testID) => {
  const handle = findHandle(rendered, testID);
  expect(handle).toBeDefined();
  const touchable = handle.props?.onPress
    ? handle
    : handle.findAllByType(TouchableOpacity)[0];
  act(() => { touchable.props.onPress(); });
};

const collectTexts = (/** @type {any} */ tree) => tree.root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => JSON.stringify(node.props.children))
  .join(' | ');

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockRoleKey.current = 'player';
  mockGetNextOnboardingRoute.mockReturnValue(RouteNames.Welcome);
  mockUseGetClubs.mockReturnValue(queryWith(CLUBS));
  mockUseGetTeams.mockReturnValue(emptyQuery);
  mockRequestLocation.mockResolvedValue(null);
  mockCanUseGeolocation.mockReturnValue(true);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('UserAffiliationGuide — étape club de l\'onboarding', () => {
  it('affiche le titre de l\'étape club', () => {
    const rendered = renderScreen();
    expect(collectTexts(rendered.tree)).toContain('Trouve ton club');
  });

  it('sauter l\'étape emmène à la route rendue par getNextOnboardingRoute', () => {
    const rendered = renderScreen();

    pressHandle(rendered, AFFILIATION_TEST_IDS.skip);

    expect(mockGetNextOnboardingRoute)
      .toHaveBeenCalledWith(RouteNames.UserAffiliationGuide);
    expect(rendered.navigation.navigate).toHaveBeenCalledWith(RouteNames.Welcome);
  });

  it('passe la saisie à la requête clubs une fois le debounce écoulé', () => {
    const rendered = renderScreen();
    const input = findHandle(rendered, AFFILIATION_TEST_IDS.search)
      .findAllByType(TextInput)[0];

    act(() => { input.props.onChangeText('  Fuveau  '); });
    act(() => { jest.advanceTimersByTime(400); });

    const lastCall = mockUseGetClubs.mock.calls.at(-1);
    expect(lastCall[0]).toMatchObject({ name: 'Fuveau' });
  });

  it('liste vide : aucune carte club, mais le chemin « club absent » reste offert', () => {
    mockUseGetClubs.mockReturnValue(queryWith([]));
    const rendered = renderScreen();

    const texts = collectTexts(rendered.tree);
    expect(texts).not.toContain('FC Fuveau');
    expect(findHandle(rendered, AFFILIATION_TEST_IDS.notFound)).toBeDefined();
  });

  it('affiche le nom des clubs trouvés', () => {
    const rendered = renderScreen();
    const texts = collectTexts(rendered.tree);
    expect(texts).toContain('FC Fuveau');
    expect(texts).toContain('Paris Sportif');
  });

  it('ouvre la fiche club quand on touche une carte (dirigeant)', () => {
    mockRoleKey.current = 'president';
    const rendered = renderScreen();

    const card = rendered.tree.root
      .findAll((node) => typeof node.props?.accessibilityLabel === 'string'
        && node.props.accessibilityLabel.includes('FC Fuveau')
        && typeof node.props?.onPress === 'function')[0];
    act(() => { card.props.onPress(); });

    expect(rendered.navigation.navigate).toHaveBeenCalledWith(
      RouteNames.ClubStack,
      expect.objectContaining({ screen: RouteNames.Club }),
    );
  });

  it('le joueur qui choisit un club bascule sur l\'étape ÉQUIPE', () => {
    const rendered = renderScreen();

    const card = rendered.tree.root
      .findAll((node) => typeof node.props?.accessibilityLabel === 'string'
        && node.props.accessibilityLabel.includes('FC Fuveau')
        && typeof node.props?.onPress === 'function')[0];
    act(() => { card.props.onPress(); });

    expect(collectTexts(rendered.tree)).toContain('Trouve ton équipe');
    expect(mockUseGetTeams).toHaveBeenCalled();
  });
});

// Ce qui est NOUVEAU dans le handoff 6b. Le bloc ci-dessus dit « rien n'a été
// cassé » ; celui-ci dit « le design est bien là ».
describe('UserAffiliationGuide — refonte 6b', () => {
  // D15 — l'étape club rejoint la progression COMMUNE. Le stepper segmenté qui
  // ne servait qu'ici a été supprimé : c'est la même barre continue que les 12
  // autres étapes, et le compteur « n/N » revient à l'écran, à côté de « Passer ».
  it('le header porte la barre de progression COMMUNE et « Passer »', () => {
    const rendered = renderScreen();
    const [headerTitleTree, headerRightTree] = rendered.headerNodes();

    const stepper = headerTitleTree.root
      .findAll((node) => node.props?.testID === 'onboarding-stepper')[0];
    expect(stepper).toBeDefined();
    // 4 étapes déclarées par onboardingViews, 3 franchies.
    expect(stepper.props.accessibilityRole).toBe('progressbar');
    expect(stepper.props.accessibilityLabel).toBe('Étape 3 sur 4');
    // Une barre continue : un fond + un remplissage à 75 %, pas 4 segments.
    expect(stepper.findAllByType(View).filter(
      (/** @type {any} */ node) => node.props?.style?.some?.(
        (/** @type {any} */ style) => style?.width === '75%',
      ),
    ).length).toBe(1);

    expect(collectTexts(headerRightTree)).toContain('Passer');
  });

  it('le compteur « 3/4 » est de retour a l\'écran, comme sur les autres étapes', () => {
    const [, headerRightTree] = renderScreen().headerNodes();
    expect(collectTexts(headerRightTree)).toContain('3/4');
  });

  it('sous-titre bénéfice pour le joueur, sous-titre gestion pour le dirigeant', () => {
    expect(collectTexts(renderScreen().tree))
      .toContain('On personnalise ton accueil, ton planning et tes annonces autour de ton club.');

    mockRoleKey.current = 'president';
    expect(collectTexts(renderScreen().tree))
      .toContain('Retrouve ton club pour le gérer sur FoundClub.');
  });

  it('le disclaimer « cette étape n\'est pas obligatoire » a disparu du pied', () => {
    const texts = collectTexts(renderScreen().tree);
    expect(texts).not.toContain('Continuer plus tard');
    expect(texts).toContain('Besoin d\'aide ? Nous contacter');
  });

  it('le champ de recherche cherche par nom OU ville', () => {
    const rendered = renderScreen();
    const input = findHandle(rendered, AFFILIATION_TEST_IDS.search)
      .findAllByType(TextInput)[0];
    expect(input.props.placeholder).toBe('Nom du club ou ville');
  });

  it('sans géoloc : section SUGGESTIONS ; après saisie : RÉSULTATS', () => {
    const rendered = renderScreen();
    expect(collectTexts(rendered.tree)).toContain('SUGGESTIONS');

    const input = findHandle(rendered, AFFILIATION_TEST_IDS.search)
      .findAllByType(TextInput)[0];
    act(() => { input.props.onChangeText('Fuveau'); });
    act(() => { jest.advanceTimersByTime(400); });

    expect(collectTexts(rendered.tree)).toContain('RÉSULTATS');
  });

  it('« Autour de moi » accepté : section PRÈS DE CHEZ TOI et tri par distance', async () => {
    // Paris : « Paris Sportif » (sans coordonnées) doit passer APRÈS Fuveau,
    // qui en a — un club sans coordonnées ne disparaît pas, il finit la liste.
    mockRequestLocation.mockResolvedValue({ lat: 43.3, lng: 5.37 });
    const rendered = renderScreen();

    await act(async () => {
      const chip = rendered.tree.root.findAll(
        (node) => node.props?.accessibilityLabel === 'Autour de moi'
          && typeof node.props?.onPress === 'function',
      )[0];
      await chip.props.onPress();
    });

    const texts = collectTexts(rendered.tree);
    expect(texts).toContain('PRÈS DE CHEZ TOI');
    expect(texts.indexOf('FC Fuveau')).toBeLessThan(texts.indexOf('Paris Sportif'));
    // La distance calculée côté client apparaît sur la carte.
    expect(texts).toMatch(/à \d/);
  });

  it('« Autour de moi » refusé : on reste en SUGGESTIONS, sans planter', async () => {
    mockRequestLocation.mockResolvedValue(null);
    const rendered = renderScreen();

    await act(async () => {
      const chip = rendered.tree.root.findAll(
        (node) => node.props?.accessibilityLabel === 'Autour de moi'
          && typeof node.props?.onPress === 'function',
      )[0];
      await chip.props.onPress();
    });

    const texts = collectTexts(rendered.tree);
    expect(texts).toContain('SUGGESTIONS');
    expect(texts).toContain('FC Fuveau');
  });

  // D23 — défaut ④ de la recette du 2026-08-07 : « le bouton autour de moi ne
  // marche pas ». Il ne plantait pas : il ne DISAIT rien. Le `null` était avalé
  // et l'écran ne bougeait pas d'un pixel — impossible de distinguer « ça
  // charge », « c'est refusé » et « c'est cassé ».
  describe('D23 ④ — « Autour de moi » répond toujours quelque chose', () => {
    const pressNearby = async (rendered) => {
      await act(async () => {
        const chip = rendered.tree.root.findAll(
          (node) => node.props?.accessibilityLabel === 'Autour de moi'
            && typeof node.props?.onPress === 'function',
        )[0];
        await chip.props.onPress();
      });
    };

    const notice = (rendered) => rendered.tree.root
      .findAll((node) => node.props?.testID === AFFILIATION_TEST_IDS.nearbyNotice)[0];

    it('refus : un message le dit, au lieu d`un bouton qui a l`air inerte', async () => {
      mockRequestLocation.mockResolvedValue(null);
      const rendered = renderScreen();
      expect(notice(rendered)).toBeUndefined();

      await pressNearby(rendered);

      expect(collectTexts(rendered.tree)).toMatch(/Localisation refusée/);
      expect(notice(rendered)).toBeDefined();
    });

    it('appareil sans géolocalisation : message dédié, et AUCUNE permission demandée', async () => {
      // Sur natif, React Native 0.78 ne définit pas `navigator.geolocation` :
      // c'est le cas réel de l'application. Réclamer la permission Android
      // qu'on ne saurait pas exploiter serait un second mensonge.
      mockCanUseGeolocation.mockReturnValue(false);
      const rendered = renderScreen();

      await pressNearby(rendered);

      expect(collectTexts(rendered.tree)).toMatch(/n'est pas disponible sur cet appareil/);
      expect(mockRequestLocation).not.toHaveBeenCalled();
    });

    it('position obtenue : aucun message, la liste parle d`elle-même', async () => {
      mockRequestLocation.mockResolvedValue({ lat: 43.3, lng: 5.37 });
      const rendered = renderScreen();

      await pressNearby(rendered);

      expect(notice(rendered)).toBeUndefined();
      expect(collectTexts(rendered.tree)).toContain('PRÈS DE CHEZ TOI');
    });

    it('le message s`efface dès que la position finit par arriver', async () => {
      mockRequestLocation.mockResolvedValue(null);
      const rendered = renderScreen();
      await pressNearby(rendered);
      expect(notice(rendered)).toBeDefined();

      mockRequestLocation.mockResolvedValue({ lat: 43.3, lng: 5.37 });
      await pressNearby(rendered);

      expect(notice(rendered)).toBeUndefined();
    });

    // D30 — LE TÉMOIN D'ARRÊT. Les tests de D23 ci-dessus prouvent que le bouton
    // RÉPOND ; aucun ne prouve qu'il SERT à quelque chose. Celui-ci mesure la
    // seule chose qu'Adel a demandée : « les clubs les plus proches remontent ».
    //
    // Le serveur ne trie pas : `/clubs` filtre par cellule geohash, et l'écran
    // ordonne ensuite sur `address.lat/lng`. C'est donc bien ici que ça se voit.
    const clubOrder = (rendered) => [...new Set(
      rendered.tree.root
        .findAll((node) => typeof node.props?.item?.name === 'string')
        .map((node) => node.props.item.name),
    )];

    const CLUBS_LOIN_D_ABORD = [
      {
        address: { lat: 48.8566, lng: 2.3522 }, documentId: 'c-paris', id: 10, name: 'Paris Nord',
      },
      {
        address: { lat: 43.2965, lng: 5.3698 }, documentId: 'c-mars', id: 11, name: 'Marseille Sud',
      },
    ];

    it('position obtenue : les clubs remontent TRIÉS PAR DISTANCE', async () => {
      mockUseGetClubs.mockReturnValue(queryWith(CLUBS_LOIN_D_ABORD));
      const rendered = renderScreen();
      // Sans position, l'ordre est celui du serveur : Paris d'abord.
      expect(clubOrder(rendered)).toEqual(['Paris Nord', 'Marseille Sud']);

      // Position simulée à Marseille : le plus proche doit passer devant.
      mockRequestLocation.mockResolvedValue({ lat: 43.3, lng: 5.37 });
      await pressNearby(rendered);

      expect(clubOrder(rendered)).toEqual(['Marseille Sud', 'Paris Nord']);
    });

    it('un club sans coordonnées reste affiché, en fin de liste', async () => {
      // Il ne DISPARAÎT pas : un club mal géocodé resterait introuvable, et
      // c'est exactement le bug que « Autour de moi » est censé réparer.
      mockUseGetClubs.mockReturnValue(queryWith([
        {
          address: { lat: 48.8566, lng: 2.3522 }, documentId: 'c-p', id: 20, name: 'Paris Nord',
        },
        {
          addressDetails: 'adresse inconnue', documentId: 'c-x', id: 21, name: 'Club Sans Adresse',
        },
        {
          address: { lat: 43.2965, lng: 5.3698 }, documentId: 'c-m', id: 22, name: 'Marseille Sud',
        },
      ]));
      const rendered = renderScreen();

      mockRequestLocation.mockResolvedValue({ lat: 43.3, lng: 5.37 });
      await pressNearby(rendered);

      expect(clubOrder(rendered)).toEqual(['Marseille Sud', 'Paris Nord', 'Club Sans Adresse']);
    });

    it('la position est envoyée au serveur comme cellule geohash, jamais brute', async () => {
      // Aucune position stockée ni transmise ailleurs que dans la requête de
      // recherche : ce que le serveur reçoit est une CELLULE, pas un point.
      const rendered = renderScreen();
      mockRequestLocation.mockResolvedValue({ lat: 43.3, lng: 5.37 });

      await pressNearby(rendered);

      const derniersParams = mockUseGetClubs.mock.calls.at(-1)[0];
      expect(typeof derniersParams.geohash).toBe('string');
      expect(derniersParams.geohash.length).toBeGreaterThan(0);
      expect(derniersParams.lat).toBeUndefined();
      expect(derniersParams.lng).toBeUndefined();
    });
  });

  it('la chip sport est pré-remplie avec le sport du profil et filtre la requête', () => {
    const rendered = renderScreen();
    expect(collectTexts(rendered.tree)).toContain('Football');
    expect(mockUseGetClubs.mock.calls.at(-1)[0]).toMatchObject({ activity: 'act-foot' });

    const chip = rendered.tree.root.findAll(
      (node) => node.props?.accessibilityLabel === 'Football'
        && typeof node.props?.onPress === 'function',
    )[0];
    act(() => { chip.props.onPress(); });

    expect(mockUseGetClubs.mock.calls.at(-1)[0].activity).toBeUndefined();
  });

  it('carte « Ton club n\'est pas là ? » en fin de liste, pas de gros bouton permanent', () => {
    const rendered = renderScreen();
    const texts = collectTexts(rendered.tree);
    expect(texts).toContain('Ton club n\'est pas là ?');
    expect(texts).toContain('Ajoute-le en 2 minutes, on s\'occupe du reste.');
  });

  it('un dirigeant qui n\'a pas trouvé son club entre dans le tunnel ClubWizardName', () => {
    mockRoleKey.current = 'president';
    const rendered = renderScreen();

    pressHandle(rendered, AFFILIATION_TEST_IDS.notFound);

    expect(rendered.navigation.navigate).toHaveBeenCalledWith(
      RouteNames.ClubStack,
      expect.objectContaining({ screen: RouteNames.ClubWizardName }),
    );
  });

  it('recherche sans résultat : la carte « Ajouter » reste, avec le message vide', () => {
    mockUseGetClubs.mockReturnValue(queryWith([]));
    const rendered = renderScreen();
    const input = findHandle(rendered, AFFILIATION_TEST_IDS.search)
      .findAllByType(TextInput)[0];

    act(() => { input.props.onChangeText('zzzz'); });
    act(() => { jest.advanceTimersByTime(400); });

    const texts = collectTexts(rendered.tree);
    expect(texts).toContain('Aucun club trouvé pour');
    expect(texts).toContain('zzzz');
    expect(texts).toContain('Ton club n\'est pas là ?');
  });

  it('chargement : squelettes affichés, aucune carte club', () => {
    mockUseGetClubs.mockReturnValue({ ...emptyQuery, isLoading: true });
    const rendered = renderScreen();
    const texts = collectTexts(rendered.tree);
    expect(texts).toContain('Recherche en cours...');
    expect(texts).not.toContain('FC Fuveau');
  });

  // L23 / D2 — LA ZONE « RÉSULTATS » ÉCRASÉE SUR IPHONE.
  //
  // ScreenContainer pose TOUJOURS un plancher `insets.bottom` (mode `none`, sa
  // documentation le dit en toutes lettres lignes 26-32). Cet écran applique en
  // plus `insets.bottom + 8` sur son lien d'aide : le retrait système est donc
  // compté DEUX FOIS. Sur iPhone cela retire 34 pt à la colonne de résultats,
  // qui est le seul enfant élastique de la colonne ; sur Android `insets.bottom`
  // vaut le plus souvent 0, ce qui explique que le symptôme soit iPhone.
  // Le remède est nommé par le conteneur lui-même : `edge-to-edge`, « pour les
  // écrans qui appliquent déjà eux-mêmes insets.bottom à leur contenu ».
  it('le retrait bas système n\'est pas compté deux fois', () => {
    const rendered = renderScreen();
    const container = findHandle(rendered, 'form-screen-container');

    expect(container).toBeDefined();
    expect(container.props.bottomInsetMode).toBe('edge-to-edge');
  });

  it('toutes les cartes de résultat gardent la même gouttière', () => {
    const rendered = renderScreen();
    // `AffiliationTutorialStep` rend ses enfants TELS QUELS quand le drapeau du
    // tour guidé est éteint : le `style` qu'on lui passe est perdu, et la carte
    // qui porte l'ancre (index 1) se colle à la suivante.
    const gutters = rendered.tree.root.findAll((node) => (
      typeof node.type === 'string'
      && node.props?.style?.marginBottom === 10
    ));
    expect(gutters).toHaveLength(CLUBS.length);
  });

  it('les 4 ancres du tour guidé restent posées sur les mêmes cibles', () => {
    const rendered = renderScreen();
    // Le drapeau ENABLE_AFFILIATION_ONBOARDING_TUTORIAL est à false : le
    // wrapper rend ses enfants tels quels. Ce test vérifie que les cibles
    // existent toujours, donc que l'ancre a de quoi envelopper.
    expect(findHandle(rendered, AFFILIATION_TEST_IDS.search)).toBeDefined();
    expect(findHandle(rendered, AFFILIATION_TEST_IDS.notFound)).toBeDefined();
    expect(rendered.tree.root.findAll(
      (node) => node.props?.accessibilityLabel === 'Ouvrir les filtres',
    ).length).toBeGreaterThan(0);
  });
});

// D23 — défaut ⑦ de la recette du 2026-08-07, mots d'Adel : « c'est bizarre de
// proposer l'étape trouve ton équipe si on a skip l'étape trouve ton club ».
//
// Ce n'est pas qu'une question de cohérence, et c'est la MESURE qui le dit :
// à ce stade du tunnel le club n'est persisté nulle part, il VOYAGE EN
// PARAMÈTRE (`navigation.navigate(UserTeamAffiliation, { club })`). Sans club,
// l'étape équipe interroge donc `useGetTeams({ clubId: undefined })` — et
// `teamService.buildClubFilter` ne pose alors AUCUN filtre : le serveur renvoie
// TOUTES les équipes. On demanderait au joueur de choisir son équipe parmi
// toutes celles de France. L'étape n'est pas « bizarre », elle est vide de sens.
describe('D23 ⑦ — sauter le club saute l\'équipe', () => {
  const machineAEtapes = () => {
    mockGetNextOnboardingRoute.mockImplementation((/** @type {string} */ route) => {
      if (route === RouteNames.UserAffiliationGuide) return RouteNames.UserTeamAffiliation;
      if (route === RouteNames.UserTeamAffiliation) return RouteNames.Welcome;
      return undefined;
    });
  };

  // Même harnais que `renderScreen`, mais monté SOUS la route « équipe » : cet
  // écran sert les deux étapes, et c'est la route montée qui tranche la phase.
  const renderTeamStep = () => {
    /** @type {Record<string, any>} */
    const headerOptions = {};
    const navigation = {
      navigate: jest.fn(),
      reset: jest.fn(),
      setOptions: (/** @type {Record<string, any>} */ options) => Object.assign(
        headerOptions,
        options,
      ),
    };

    let tree;
    act(() => {
      tree = renderer.create(
        <UserAffiliationGuide
          navigation={/** @type {any} */ (navigation)}
          route={/** @type {any} */ ({ name: RouteNames.UserTeamAffiliation })}
        />,
      );
    });

    const headerNodes = () => ['headerTitle', 'headerRight', 'headerLeft']
      .map((slot) => (typeof headerOptions[slot] === 'function' ? headerOptions[slot]() : null))
      .filter(Boolean)
      .map((element) => {
        let headerTree;
        act(() => { headerTree = renderer.create(element); });
        return headerTree;
      });

    return { headerNodes, navigation, tree };
  };

  it('« Passer » sur le club enjambe l\'étape équipe et va droit au sas', () => {
    machineAEtapes();
    const rendered = renderScreen();

    pressHandle(rendered, AFFILIATION_TEST_IDS.skip);

    expect(rendered.navigation.navigate).not.toHaveBeenCalledWith(RouteNames.UserTeamAffiliation);
    expect(rendered.navigation.navigate).toHaveBeenCalledWith(RouteNames.Welcome);
  });

  it('depuis l\'étape équipe, « Passer » suit la machine à étapes sans rien enjamber', () => {
    machineAEtapes();
    const rendered = renderTeamStep();

    pressHandle(rendered, AFFILIATION_TEST_IDS.skip);

    expect(mockGetNextOnboardingRoute).toHaveBeenCalledWith(RouteNames.UserTeamAffiliation);
    expect(rendered.navigation.navigate).toHaveBeenCalledWith(RouteNames.Welcome);
  });

  it('la mesure qui justifie le saut : sans club, la liste d\'équipes n\'est filtrée par RIEN', () => {
    machineAEtapes();
    renderTeamStep();

    const derniersParametres = mockUseGetTeams.mock.calls.at(-1)[0];
    expect(derniersParametres.clubId).toBeUndefined();
  });
});
