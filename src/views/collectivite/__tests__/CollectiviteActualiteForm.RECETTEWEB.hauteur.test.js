import renderer, { act } from 'react-test-renderer';

import { mesurerLaFeuille, textesDe } from '../../../testSupport/feuilleMesuree';
import CollectiviteActualiteForm from '../CollectiviteActualiteForm';

// RECETTEWEB retour 5 (26/10) — la feuille « Ajouter » de l'actualite de la Ville
// (la meme grille que la messagerie) se dimensionne sur son contenu (pas de snapPoints) :
// sa hauteur doit compter son titre. Avant le correctif de BottomModal, le titre etait pose
// au-dessus de la zone mesuree :
// la feuille etait trop courte de sa hauteur.
// Regle et limites : src/testSupport/feuilleMesuree.js.
// Harnais repris de CollectiviteActualiteForm.C05.

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setOptions: jest.fn(),
  }),
  useRoute: () => ({ params: { collectiviteId: 'ville-de-recette' } }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
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
      Images: { arrowLeft: 'image-fleche', close: 'image-croix', plus: 'image-plus' },
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useActualiteMutations: () => ({
    modifier: { isPending: false, mutateAsync: jest.fn() },
    publier: { isPending: false, mutateAsync: jest.fn() },
  }),
  useActualiteRecipients: () => ({ data: { audience: 'all', clubsCount: 3 } }),
  useCollectiviteActualites: () => ({ data: [], isLoading: false }),
}));
jest.mock('@/services/collectivite/collectiviteActualiteService', () => ({
  uploadActualiteFile: jest.fn(),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => ({ data: [] }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
  }),
}));
jest.mock('@/platform/media', () => ({
  __esModule: true,
  default: { capturePhoto: jest.fn(), pickDocument: jest.fn(), pickImage: jest.fn() },
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/platform/media/depotDeFichiers', () => ({ ecouterLeDepot: () => () => {} }));
jest.mock('@/components/molecules/input/Input', () => () => null);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/organisms/chatAttachmentSheet/ChatAttachmentActionIcon', () => () => null);

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

test('RECETTEWEB retour 5 — « Ajouter » de l actualite : le titre compte', async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteActualiteForm />);
  });
  const props = mockFeuilles.filter((/** @type {any} */ p) => p.headerComponent).pop();
  act(() => arbre.unmount());

  expect(props.snapPoints).toBeUndefined();
  const enTete = textesDe(props.headerComponent);
  expect(enTete).toEqual(['Ajouter']);
  const mesure = mesurerLaFeuille(
    jest.requireActual('@/components/molecules/bottomModal/BottomModal').default,
    props,
  );
  expect(mesure.dynamique).toBe(true);
  expect(mesure.textesHorsMesure).toEqual([]);
  expect(mesure.textesDansLaMesure).toEqual(expect.arrayContaining(enTete));
});
