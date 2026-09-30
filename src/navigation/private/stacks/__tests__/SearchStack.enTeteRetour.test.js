import fs from 'fs';
import path from 'path';

import { NavigationContainer } from '@react-navigation/native';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';

import { RouteNames } from '@/navigation/routeNames';

import SearchStack from '../SearchStack';

/**
 * RETOUR-ONGLET (b) — A06 et A12 de l'audit V1 (30/09) : « JE N'AI PAS DE RETOUR ».
 *
 * 🔴 LE GESTE, photographie sur l'emulateur : la case « Evenement » de l'accueil
 * ouvre la recherche (`HomeHub.js` -> `SearchEvents` -> `SearchHubRouteAlias` ->
 * `SearchHub`), DANS la pile de l'onglet. « Accueil » y ramene bien — mais rien a
 * l'ecran ne dit comment sortir : `SearchStack.js` monte tout `headerShown: false`,
 * et la fleche de la recherche a ete retiree par D07 le 06/08, au motif que l'icone
 * d'onglet suffisait. L'audit dit le contraire : personne ne la devine. Memes
 * symptomes sur « Mes activites » et sur les ecrans d'entrainement.
 *
 * ✅ CE QUE CE FILET EXIGE, pour CHAQUE ecran non racine de la pile, relu dans
 * `SearchStack.js` (un ecran ajoute demain est couvert sans que personne n'y pense) :
 *   · la fleche « Retour » de la maison, UNE fois (ni zero, ni deux) ;
 *   · un appui ramene a l'ecran d'AVANT ;
 *   · la racine (l'accueil, son en-tete League + cloche + avatar) n'en montre PAS : D07.
 *
 * ⚠️ POURQUOI LA VRAIE PILE : l'en-tete est une option du NAVIGATEUR, pas un
 * morceau d'ecran. Seul le vrai `@react-navigation/stack` dit s'il est dessine et
 * sur quel ecran. Les ecrans sont des doublures : ce qu'on mesure, c'est la pile.
 */

// Le paquet de gestes est publie en TypeScript brut, que ce depot ne transpile pas
// (jest.config.js) : la pile n'en lit que le glisser-retour, sans objet ici.
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  return {
    GestureHandlerRootView: View,
    PanGestureHandler: ({ children }) => children,
    State: {
      ACTIVE: 4, BEGAN: 2, CANCELLED: 3, END: 5, FAILED: 1, UNDETERMINED: 0,
    },
  };
});

// La doublure du paquet (jest/mock.tsx) n'est pas transpilee par ce depot : on sert
// la meme surface, a la main — un telephone sans encoche.
jest.mock('react-native-safe-area-context', () => {
  const reactActuel = jest.requireActual('react');
  const zero = {
    bottom: 0, left: 0, right: 0, top: 0,
  };
  const cadre = {
    height: 812, width: 375, x: 0, y: 0,
  };
  const SafeAreaInsetsContext = reactActuel.createContext(zero);
  const SafeAreaFrameContext = reactActuel.createContext(cadre);
  return {
    initialWindowMetrics: { frame: cadre, insets: zero },
    SafeAreaFrameContext,
    SafeAreaInsetsContext,
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaFrame: () => cadre,
    useSafeAreaInsets: () => zero,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ clef, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : clef
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();
  const theme = {
    Alignments,
    ApplicationStyle: genererStyle(Colors),
    Colors,
    Fonts: genererPolices(Colors),
    Images: { arrowLeft: 1 },
    Spaces,
  };
  return { __esModule: true, default: () => theme };
});

// `commonOptions` tire le verre depoli et le bouton d'onglet anime (modules natifs) :
// ils ne servent qu'a la barre d'onglets, jamais a l'en-tete mesure ici.
jest.mock('@/components/atoms/glassSurface/GlassSurface', () => 'GlassSurface');
jest.mock(
  '@/components/atoms/animatedTabBarButton/AnimatedTabBarButton',
  () => 'AnimatedTabBarButton',
);

/** @type {Record<string, any>} La navigation de chaque ecran, capturee au rendu. */
const mockNavigations = {};

/**
 * Une doublure d'ecran : elle affiche son nom et capture sa navigation.
 * ⚠️ Une DECLARATION de fonction, pas une constante : `HomeHub` est importe en tete
 * de SearchStack.js, donc sa fabrique tourne AVANT que les constantes existent.
 * @param {string} nom le nom de la route
 * @returns {any} le module double
 */
function mockEcran(nom) {
  const { Text } = jest.requireActual('react-native');
  const reactActuel = jest.requireActual('react');
  return {
    __esModule: true,
    default: function EcranTemoin({ navigation }) {
      mockNavigations[nom] = navigation;
      return reactActuel.createElement(Text, null, `ecran:${nom}`);
    },
  };
}

jest.mock('@/views/home/HomeHub', () => mockEcran('SearchHome'));
jest.mock('@/views/search/SearchHubScreen', () => mockEcran('SearchHub'));
jest.mock('@/views/license/MyLicenses', () => mockEcran('MyLicenses'));
jest.mock('@/views/license/MyLicensesArchive', () => mockEcran('MyLicensesArchive'));
jest.mock('@/views/license/LicenseCheckoutStatus', () => mockEcran('LicenseCheckoutStatus'));
jest.mock('@/views/search/MyActivitiesScreen', () => mockEcran('MyActivities'));
jest.mock('@/views/training/TrainingPlan', () => mockEcran('TrainingPlan'));
jest.mock('@/views/training/TrainingCatalog', () => mockEcran('TrainingCatalog'));
jest.mock('@/views/training/TrainingProgramDetail', () => mockEcran('TrainingProgramDetail'));
jest.mock('@/views/training/TrainingDay', () => mockEcran('TrainingDay'));
jest.mock('@/views/training/TrainingLogbook', () => mockEcran('TrainingLogbook'));
jest.mock('@/views/training/TrainingSessions', () => mockEcran('TrainingSessions'));
jest.mock('@/views/training/TrainingSessionNow', () => mockEcran('TrainingSessionNow'));
jest.mock('@/views/training/TrainingVideoQueue', () => mockEcran('TrainingVideoQueue'));

const FICHIER_PILE = path.join(__dirname, '..', 'SearchStack.js');
const SOURCES_VUES = path.join(__dirname, '..', '..', '..', '..', 'views');
const ROUTES = [
  ...fs.readFileSync(FICHIER_PILE, 'utf8').matchAll(/name=\{RouteNames\.(\w+)\}/g),
].map((m) => m[1]);

// Les ALIAS (`SearchHubRouteAlias`) ne s'affichent jamais : ils se remplacent par la
// recherche au premier rendu. On les mesure par le chemin d'A06, pas un par un.
const ALIAS = [
  RouteNames.SearchEvents, RouteNames.SearchClubs,
  RouteNames.SearchReservations, RouteNames.SearchRecruitment,
];

/**
 * Les ecrans qui dessinent DEJA leur barre « fleche + titre » (`MemberTopBar`,
 * cotisations S9-bis) : la pile ne doit pas en poser une seconde. Relus dans les
 * sources, pour que la liste ne mente pas.
 * @returns {string[]} les routes concernees
 */
const avecLeurPropreBarre = () => [RouteNames.MyLicenses, RouteNames.MyLicensesArchive]
  .filter((nom) => /<MemberTopBar\s+onBack=/.test(
    fs.readFileSync(path.join(SOURCES_VUES, 'license', `${nom}.js`), 'utf8'),
  ));

const NON_RACINES = ROUTES
  .filter((nom) => nom !== RouteNames.SearchHome)
  .filter((nom) => !ALIAS.includes(nom))
  .filter((nom) => !avecLeurPropreBarre().includes(nom));

/** @type {any} */
let conteneur = null;
/** @type {any} */
let arbre = null;

/**
 * Monte la VRAIE pile de l'onglet d'accueil.
 * @returns {void}
 */
const monter = () => {
  act(() => {
    arbre = renderer.create(createElement(
      NavigationContainer,
      { ref: (/** @type {any} */ reference) => { if (reference) conteneur = reference; } },
      createElement(SearchStack),
    ));
  });
};

/**
 * Les fleches « Retour » dessinees par la pile : la fleche de la MAISON
 * (`HeaderBackButton`), comptee par composant — un `TouchableOpacity` expose deux
 * noeuds `onPress`, les compter doublerait tout.
 * @returns {any[]} les fleches
 */
const fleches = () => arbre.root.findAllByType(HeaderBackButton);

/**
 * Les routes de la pile, dans l'ordre.
 * @returns {string[]} les noms
 */
const pile = () => conteneur.getRootState().routes.map((/** @type {any} */ r) => r.name);

/**
 * Les fleches de l'ecran AU-DESSUS : la pile garde les ecrans du dessous montes, et
 * leur en-tete avec — c'est la derniere fleche qui est sous le doigt.
 * @returns {any | undefined} la fleche de l'ecran visible
 */
const flecheVisible = () => fleches().pop();

beforeEach(() => {
  Object.keys(mockNavigations).forEach((cle) => { delete mockNavigations[cle]; });
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  conteneur = null;
});

describe('RETOUR-ONGLET (b) — la pile de l onglet d accueil', () => {
  it('la pile est bien lue (sinon ce filet ne mesure rien)', () => {
    expect(ROUTES[0]).toBe(RouteNames.SearchHome);
    expect(NON_RACINES).toEqual(expect.arrayContaining([
      RouteNames.SearchHub,
      RouteNames.MyActivities,
      RouteNames.TrainingPlan,
      RouteNames.TrainingDay,
      RouteNames.TrainingSessions,
      RouteNames.TrainingLogbook,
      RouteNames.TrainingSessionNow,
    ]));
    expect(avecLeurPropreBarre()).toEqual([RouteNames.MyLicenses, RouteNames.MyLicensesArchive]);
  });

  it('D07 respectee : l accueil (la racine) ne montre AUCUNE fleche', () => {
    monter();

    expect(pile()).toEqual([RouteNames.SearchHome]);
    expect(fleches()).toHaveLength(0);
  });

  it('A06 — « Evenement » depuis l accueil : la recherche a sa fleche vers l accueil', () => {
    monter();
    act(() => { mockNavigations[RouteNames.SearchHome].navigate(RouteNames.SearchEvents); });
    expect(pile()).toEqual([RouteNames.SearchHome, RouteNames.SearchHub]);

    expect(flecheVisible()).toBeDefined();
    // Le titre : la recherche est le seul ecran qui n'ecrit pas le sien en tete.
    expect(arbre.root.findAll(
      (/** @type {any} */ n) => typeof n.type === 'string' && n.props?.children === 'Rechercher',
    ).length).toBeGreaterThan(0);
    // Ce que lit le lecteur d'ecran : un BOUTON « Retour » (clef common.back, fr.js
    // « Retour », en.js « Back »), cible de 44 pt (32 visibles + la marge tactile).
    const pressable = flecheVisible().findAll(
      (/** @type {any} */ n) => n.props?.accessibilityRole === 'button' && n.props?.hitSlop,
    )[0];
    expect(pressable.props.accessibilityLabel).toBe('common.back');
    const {
      bottom, left, right, top,
    } = pressable.props.hitSlop;
    expect([32 + top + bottom, 32 + left + right]).toEqual([44, 44]);
    act(() => { flecheVisible().props.onPress(); });

    expect(pile()).toEqual([RouteNames.SearchHome]);
  });

  it.each(NON_RACINES)('%s montre UNE fleche, et elle revient a l ecran d avant', (nom) => {
    monter();
    act(() => { mockNavigations[RouteNames.SearchHome].navigate(RouteNames.TrainingPlan); });
    if (nom !== RouteNames.TrainingPlan) {
      act(() => { mockNavigations[RouteNames.TrainingPlan].navigate(nom); });
    }
    const avant = nom === RouteNames.TrainingPlan
      ? [RouteNames.SearchHome]
      : [RouteNames.SearchHome, RouteNames.TrainingPlan];
    expect(pile()).toEqual([...avant, nom]);

    // UNE : l'ecran du dessus a sa fleche ; celle du dessous (s'il y en a) reste
    // montee mais cachee. Jamais deux fleches pour le meme ecran.
    expect(fleches()).toHaveLength(avant.length);
    act(() => { flecheVisible().props.onPress(); });

    expect(pile()).toEqual(avant);
  });

  it.each(avecLeurPropreBarre())('%s garde SA barre : la pile n en pose pas une seconde', (nom) => {
    monter();
    act(() => { mockNavigations[RouteNames.SearchHome].navigate(nom); });

    expect(pile()).toEqual([RouteNames.SearchHome, nom]);
    expect(fleches()).toHaveLength(0);
  });

  it('un ecran ouvert SANS rien dessous (lien, pile reconstruite) ramene a l accueil', () => {
    act(() => {
      arbre = renderer.create(createElement(
        NavigationContainer,
        {
          initialState: { index: 0, routes: [{ name: RouteNames.TrainingSessionNow }] },
          ref: (/** @type {any} */ reference) => { if (reference) conteneur = reference; },
        },
        createElement(SearchStack),
      ));
    });
    expect(pile()).toEqual([RouteNames.TrainingSessionNow]);

    act(() => { flecheVisible().props.onPress(); });

    expect(pile()).toEqual([RouteNames.SearchHome]);
  });
});
