import renderer, { act } from 'react-test-renderer';

import { mesurerLaFeuille, textesDe } from '../../../../testSupport/feuilleMesuree';
import ShareCompositionModal from '../ShareCompositionModal';

// RECETTEWEB retour 5 (26/10) — « Partager la composition » se dimensionne sur son contenu (pas
// de snapPoints) : sa hauteur doit compter son en-tete. Avant le correctif de BottomModal, le
// titre etait pose au-dessus de la zone mesuree : la feuille etait trop courte de sa hauteur.
// Regle et limites : src/testSupport/feuilleMesuree.js. Harnais repris de ShareModalsC06.fils.

jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    FlashList: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      null,
      (props.data || []).map((/** @type {any} */ item) => reactActuel.createElement(
        VueRN,
        { key: item.documentId },
        props.renderItem({ item }),
      )),
    ),
  };
});
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
      Images: { arrowRight: 'image-fleche', close: 'image-croix' },
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [],
    hasClubAccess: () => true,
    userData: { club: { documentId: 'club-foot' }, documentId: 'moi', role: { type: 'dirigeant' } },
  }),
}));
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ getConversationName: () => 'Seniors' }),
}));
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChats: () => ({
    data: { pages: [{ data: [{ documentId: 'equipe', participants: [], type: 'team' }] }] },
    error: null,
    isLoading: false,
  }),
}));
jest.mock('@/platform/share', () => ({
  __esModule: true, default: { share: jest.fn() }, share: jest.fn(),
}));
jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => (/** @type {any} */ props) => props.children || null,
);
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);

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

test('RECETTEWEB retour 5 — « Partager la composition » : l en-tete compte', () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ShareCompositionModal
        composition={{ documentId: 'compo-1' }}
        event={{ documentId: 'ev-1', name: 'Match' }}
        isVisible
        onClose={jest.fn()}
        onSelectChat={jest.fn()}
      />,
    );
  });
  const props = mockFeuilles[mockFeuilles.length - 1];
  act(() => arbre.unmount());

  expect(props.snapPoints).toBeUndefined();
  const enTete = textesDe(props.headerComponent);
  expect(enTete).toEqual(['Partager la composition']);
  const mesure = mesurerLaFeuille(
    jest.requireActual('@/components/molecules/bottomModal/BottomModal').default,
    props,
  );
  expect(mesure.dynamique).toBe(true);
  expect(mesure.textesHorsMesure).toEqual([]);
  expect(mesure.textesDansLaMesure)
    .toEqual(expect.arrayContaining([...enTete, 'Partager dans une conversation']));
});
