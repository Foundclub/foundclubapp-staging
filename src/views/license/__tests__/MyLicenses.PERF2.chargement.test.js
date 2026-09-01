import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MyLicenses from '../MyLicenses';

/**
 * PERF2 — « Mes cotisations » PENDANT le chargement : des formes, pas un mensonge.
 *
 * 🧨 Le defaut mesure (rapport capacite du 01/09) : pendant que la requete vole,
 * l ecran affichait `LicenseEmptyState` — une carte `muted` visuellement
 * IDENTIQUE a « tu n as aucune cotisation ». Le temps d un aller-retour reseau,
 * l utilisateur croyait n avoir rien.
 *
 * ⚖️ LA GARANTIE : en chargement, l ecran montre la FORME de ce qui arrive
 * (des blocs qui balayent, via WithDataWrapper), et n AFFIRME rien — aucun
 * texte sous le squelette. L etat vide, lui, garde le droit d affirmer :
 * il est vrai.
 */

/** @type {any} */
let mockMesCotisations;

jest.mock('@/services/license/licenseQueries', () => ({
  useMyLicenses: () => mockMesCotisations,
}));

// `MemberTopBar` appelle `useNavigation()` en interne — meme mock que la suite
// AA07 de cet ecran.
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

// SkeletonLoader tire MaskedView / LinearGradient / Reanimated : hors sujet ici.
// Le mock REND les enfants (pour inspecter les fausses formes) et capture ses
// props : c est la preuve que le squelette est ENGAGE, pas un simple decor.
// ⚠️ Variable pilotable AVANT toute assertion — un mock a forme fixe rendrait
// ce temoin vert par construction (le piege des 4 lots EVEDIT).
/** @type {any[]} */
const mockSkeletonProps = [];
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonLoaderMock(
  /** @type {any} */ props,
) {
  mockSkeletonProps.push(props);
  return props.children;
});

/** @type {any} */
let arbre = null;

afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
    arbre = null;
  }
  mockSkeletonProps.length = 0;
  jest.clearAllMocks();
});

/**
 * Monte l ecran dans l etat de requete donne.
 * @param {any} etat l etat renvoye par `useMyLicenses`
 * @returns {string} tout le rendu, mis a plat
 */
const monter = (etat) => {
  mockMesCotisations = {
    data: undefined, isError: false, isLoading: false, refetch: jest.fn(), ...etat,
  };

  act(() => {
    arbre = renderer.create(
      <MyLicenses
        navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }}
        route={{ params: {} }}
      />,
    );
  });

  return JSON.stringify(arbre.toJSON());
};

describe('PERF2 — le chargement montre des formes, il n affirme rien', () => {
  it('en chargement : le squelette est la, et il est ENGAGE', () => {
    monter({ isLoading: true });

    expect(arbre.root.findAllByProps({ testID: 'my-licenses-skeleton' }).length)
      .toBeGreaterThan(0);
    // Pas un decor : SkeletonLoader est monte (via WithDataWrapper) et actif.
    expect(mockSkeletonProps.length).toBeGreaterThan(0);
    expect(mockSkeletonProps[0].isActive).toBe(true);
  });

  it('en chargement : AUCUN texte sous le squelette — on n affirme rien', () => {
    const rendu = monter({ isLoading: true });

    // 🧨 L ancien ecran ecrivait « Chargement » dans la MEME carte muted que
    // l etat vide : indiscernables a l oeil.
    expect(rendu).not.toContain('Chargement');
    expect(rendu).not.toContain('Aucune cotisation');

    // Piege SkeletonLoader (premier rendu, layout null) : les enfants rendent
    // NUS. Des fausses formes en TEXTE feraient un eclair de contenu factice —
    // donc uniquement des `View` avec leur propre fond sous le squelette.
    const [squelette] = arbre.root.findAllByProps({ testID: 'my-licenses-skeleton' });
    expect(squelette.findAllByType(Text).length).toBe(0);
  });

  it('une fois charge : plus aucun squelette, l etat vide garde sa carte', () => {
    const rendu = monter({ data: [] });

    expect(arbre.root.findAllByProps({ testID: 'my-licenses-skeleton' }).length).toBe(0);
    expect(rendu).toContain('Aucune cotisation');
  });

  it('en erreur : le chemin existant (Reessayer) n a pas bouge', () => {
    const rendu = monter({ isError: true });

    expect(arbre.root.findAllByProps({ testID: 'my-licenses-skeleton' }).length).toBe(0);
    expect(rendu).toContain('Réessayer');
  });
});
