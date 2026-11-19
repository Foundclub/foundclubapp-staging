import { isValidElement } from 'react';

import { RouteNames } from '@/navigation/routeNames';

import { optionsDeLaPileAccueil, revenirDansLaPile } from '../enTeteRetourAccueil';

// IMPL-4-ACCUEIL (18/11, E6) — témoin DIRECT de enTeteRetourAccueil.js, qui n'en avait pas (le
// filet SearchStack.enTeteRetour.test.js monte la vraie pile ; celui-ci lit les options). Les
// trois premiers blocs décrivent le comportement d'avant le lot ; le dernier, la page 7 de la
// planche T-DESIGN-TOURNOI (« Rechercher » collé à la flèche, à gauche).

// Le paquet de gestes est publié en TypeScript brut, que ce dépôt ne transpile pas (même doublure
// que SearchStack.enTeteRetour.test.js) : `commonOptions` l'atteint par la pile.
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

// `commonOptions` tire aussi le verre dépoli et le bouton d'onglet animé (modules natifs), qui ne
// servent qu'à la barre d'onglets.
jest.mock('@/components/atoms/glassSurface/GlassSurface', () => 'GlassSurface');
jest.mock(
  '@/components/atoms/animatedTabBarButton/AnimatedTabBarButton',
  () => 'AnimatedTabBarButton',
);

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => function RetourMock() {
  return null;
});

const navigation = (/** @type {number} */ index) => ({
  getState: () => ({ index }),
  goBack: jest.fn(),
  popTo: jest.fn(),
});

describe('enTeteRetourAccueil — les écrans sans en-tête', () => {
  it.each([
    RouteNames.SearchHome,
    RouteNames.SearchEvents,
    RouteNames.SearchClubs,
    RouteNames.SearchRecruitment,
    RouteNames.SearchReservations,
    RouteNames.MyLicenses,
    RouteNames.MyLicensesArchive,
  ])('%s : aucun en-tête', (name) => {
    expect(optionsDeLaPileAccueil({ navigation: navigation(1), route: { name } }))
      .toEqual({ headerShown: false });
  });
});

describe('enTeteRetourAccueil — les autres écrans de la pile', () => {
  it('portent l en-tête de la maison, transparent, avec la flèche', () => {
    const options = optionsDeLaPileAccueil({
      navigation: navigation(1), route: { name: RouteNames.MyActivities },
    });
    expect(options.headerShown).toBe(true);
    expect(options.headerTransparent).toBe(true);
    expect(options.headerShadowVisible).toBe(false);
    expect(isValidElement(options.headerLeft())).toBe(true);
  });

  it('sans titre donné, le titre est vide (l écran écrit déjà le sien)', () => {
    const options = optionsDeLaPileAccueil({
      navigation: navigation(1), route: { name: RouteNames.MyActivities },
    }, { [RouteNames.SearchHub]: 'Rechercher' });
    expect(options.headerTitle).toBe('');
  });

  it('avec un titre donné, il le porte', () => {
    const options = optionsDeLaPileAccueil({
      navigation: navigation(1), route: { name: RouteNames.SearchHub },
    }, { [RouteNames.SearchHub]: 'Rechercher' });
    expect(options.headerTitle).toBe('Rechercher');
  });
});

describe('enTeteRetourAccueil — le geste de la flèche', () => {
  it('revient à l écran d avant quand il y en a un', () => {
    const nav = navigation(2);
    revenirDansLaPile(nav);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(nav.popTo).not.toHaveBeenCalled();
  });

  it('revient à l accueil quand rien n est dessous', () => {
    const nav = navigation(0);
    revenirDansLaPile(nav);
    expect(nav.popTo).toHaveBeenCalledWith(RouteNames.SearchHome);
    expect(nav.goBack).not.toHaveBeenCalled();
  });
});

describe('IMPL-4 page 7 — « Rechercher » à gauche, collé à la flèche (planche 7a-7c)', () => {
  it('un écran qui porte un titre l aligne à gauche', () => {
    const options = optionsDeLaPileAccueil({
      navigation: navigation(1), route: { name: RouteNames.SearchHub },
    }, { [RouteNames.SearchHub]: 'Rechercher' });
    expect(options.headerTitleAlign).toBe('left');
  });

  it('📌 un écran sans titre garde l alignement de la maison', () => {
    const options = optionsDeLaPileAccueil({
      navigation: navigation(1), route: { name: RouteNames.MyActivities },
    });
    expect(options.headerTitleAlign).toBe('center');
  });
});
