import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import MyLicenses from '../MyLicenses';
import MyLicensesArchive from '../MyLicensesArchive';

// REPRISE-TEXTES, point 25 (contre-recette du parent, 01/11) — un parent qui ouvre
// « Mes cotisations » reçoit un refus du serveur (403) : l'écran disait « Impossible de charger
// tes cotisations pour le moment » et proposait « Réessayer », comme une panne passagère.
// ROUGE avant : un refus dit « Cette page n’est pas ouverte à ton profil. », sans bouton qui ne
// mènerait nulle part ; une vraie panne garde son message et son « Réessayer ».

/** @type {any} */
let mockMesCotisations;

jest.mock('@/services/license/licenseQueries', () => ({
  useMyLicenses: () => mockMesCotisations,
}));

// FIN-PARENT (02/11) : l ecran lit le role du compte, et sa branche Parent ses enfants ; ce temoin
// parle d un compte qui n est pas Parent.
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ accountRoleKey: 'player' }),
}));
jest.mock('@/services/parentLink/parentLinkQueries', () => ({}));
jest.mock('@/services/declaredChild/declaredChildQueries', () => ({}));

const mockNavigationContexte = { goBack: jest.fn(), navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigationContexte,
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock(
  /** @type {any} */ { children },
) {
  return children;
});

// PERF2 — l ecran importe desormais WithDataWrapper → SkeletonLoader, qui tire
// MaskedView / LinearGradient / Reanimated : hors sujet ici (cette suite ne
// monte que des etats charges). Meme mock que les suites EventPublishedShowcase.
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

/** @type {any} */
let arbre = null;

afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
    arbre = null;
  }
});

/**
 * Monte un écran avec une requête en erreur.
 * @param {any} Ecran l'écran
 * @param {any} erreur l'erreur rendue par `/licenses/me`
 * @returns {string} le texte rendu, mis à plat
 */
const monter = (Ecran, erreur) => {
  mockMesCotisations = {
    data: undefined, error: erreur, isError: true, isLoading: false, refetch: jest.fn(),
  };
  act(() => {
    arbre = renderer.create(
      <Ecran
        navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }}
        route={{ params: {} }}
      />,
    );
  });
  return JSON.stringify(arbre.toJSON());
};

const refus = Object.assign(new Error('Forbidden'), { response: { status: 403 }, status: 403 });
const panne = Object.assign(new Error('Network Error'), { response: { status: 503 }, status: 503 });

test.each([['Mes cotisations', MyLicenses], ['Saisons passées', MyLicensesArchive]])(
  'REPRISE-25 🔴 %s : un refus du serveur dit que la page n’est pas ouverte au profil',
  (_nom, Ecran) => {
    const texte = monter(Ecran, refus);
    expect(texte).toContain('Cette page n’est pas ouverte à ton profil.');
    expect(texte).not.toContain('Impossible de charger tes cotisations');
    expect(texte).not.toContain('Réessayer');
  },
);

test.each([['Mes cotisations', MyLicenses], ['Saisons passées', MyLicensesArchive]])(
  'REPRISE-25 %s : une vraie panne garde son message et son « Réessayer »',
  (_nom, Ecran) => {
    const texte = monter(Ecran, panne);
    expect(texte).toContain('Impossible de charger tes cotisations pour le moment.');
    expect(texte).toContain('Réessayer');
  },
);
