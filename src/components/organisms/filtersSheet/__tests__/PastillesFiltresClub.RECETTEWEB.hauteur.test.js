import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { mesurerLaFeuille, textesDe } from '../../../../testSupport/feuilleMesuree';
import PastillesFiltresClub from '../PastillesFiltresClub';

// RECETTEWEB retour 5 (26/10) — le panneau du bas des pastilles de la recherche de clubs (au
// telephone) se dimensionne sur son contenu (pas de snapPoints) : sa hauteur doit compter son
// en-tete (le titre et la croix). Avant le correctif de BottomModal, l'en-tete etait pose au-dessus
// de la zone mesuree : le panneau etait trop court de sa hauteur.
// Regle et limites : src/testSupport/feuilleMesuree.js.
// Harnais repris de PastillesFiltresClub.test.

jest.mock('@/components/molecules/input/Input', () => () => null);
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => () => null,
);
jest.mock('@react-native-community/slider', () => () => null);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle,
  }),
}));
jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => 'gh' }),
}));
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({
    data: [
      { documentId: 'sport-foot', name: 'Football' },
      { documentId: 'sport-basket', name: 'Basketball' },
    ],
  }),
}));
jest.mock('@/services/annuaire/annuaireQueries', () => ({
  useGetTerritoires: () => ({ data: { departments: [], regions: [] } }),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ height: 812, width: 375 }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { close: 'image-croix' },
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

// La feuille : le VRAI BottomModal, monte par `mesurerLaFeuille` avec les props recues.
/** @type {any[]} */
const mockFeuilles = [];
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (/** @type {any} */ props) => {
  mockFeuilles.push(props);
  return null;
});
jest.mock('@gorhom/bottom-sheet', () => (
  jest.requireActual('@/testSupport/feuilleMesuree').gorhomQuiMesure()));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));
jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));
jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { SCREEN_LOCAL_PROMPTS: 'SCREEN_LOCAL_PROMPTS', STEADY_STATE: 'STEADY_STATE' },
  useStartupPhase: () => ({ phase: 'STEADY_STATE' }),
}));

beforeEach(() => {
  Platform.OS = 'ios';
});

test('RECETTEWEB retour 5 — le choix du sport : l en-tete compte', () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<PastillesFiltresClub filters={{}} onApply={jest.fn()} />);
  });
  const pastille = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.accessibilityRole === 'button'
      && typeof n.props?.onPress === 'function'
      && String(n.props?.accessibilityLabel || '').startsWith('Filtrer par sport — '),
  )[0];
  act(() => { pastille.props.onPress(); });
  const props = mockFeuilles[mockFeuilles.length - 1];
  act(() => arbre.unmount());

  expect(props.isVisible).toBe(true);
  expect(props.snapPoints).toBeUndefined();
  const enTete = textesDe(props.headerComponent);
  expect(enTete.length).toBeGreaterThan(0);
  const mesure = mesurerLaFeuille(
    jest.requireActual('@/components/molecules/bottomModal/BottomModal').default,
    props,
  );
  expect(mesure.dynamique).toBe(true);
  expect(mesure.textesHorsMesure).toEqual([]);
  expect(mesure.textesDansLaMesure).toEqual(expect.arrayContaining(enTete));
});
