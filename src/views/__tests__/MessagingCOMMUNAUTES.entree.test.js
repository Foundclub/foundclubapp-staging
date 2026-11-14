import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Messaging from '../Messaging';

// COMMUNAUTES-L2 (13/11/2026, D76) — L'ENTRÉE « COMMUNAUTÉS » DE LA MESSAGERIE. Un téléphone 2.6.99
// et les fils
// d'aujourd'hui ne doivent rien voir de changé tant qu'aucune communauté n'existe pour le compte :
// serveur
// d'avant le socle (404), erreur, liste vide => aucun bouton, la liste et le bouton « Nouvelle
// conversation » ne
// bougent pas. Les doublures sont celles de `MessagingMSGVILLE.bouton.test.js` (même écran, même
// montage).

const mockNavigate = jest.fn();
let mockChatsQuery;
const mockGetMesCommunautes = jest.fn();
jest.mock('@/services/chat/communauteService', () => ({
  getMesCommunautes: (...args) => mockGetMesCommunautes(...args),
}));

jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    FlashList: function FlashListMock(/** @type {any} */ props) {
      return reactActuel.createElement(
        VueRN,
        null,
        props.ListHeaderComponent,
        (props.data || []).map((/** @type {any} */ element, /** @type {number} */ index) => (
          reactActuel.createElement(
            VueRN,
            { key: element?.documentId || index },
            props.renderItem({ item: element }),
          )
        )),
      );
    },
  };
});
jest.mock('react-native-gesture-handler', () => ({
  Swipeable: (/** @type {any} */ props) => props.children,
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
// Identité STABLE : un `userData` neuf à chaque rendu reconstruirait la liste.
const mockAuth = {
  allMyTeams: [],
  userData: { documentId: 'moi', role: { name: 'Authenticated' } },
};
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    archiveChatAsync: jest.fn(() => Promise.resolve()),
    getConversationName: (/** @type {any} */ input) => input?.chatGroupName || 'Conversation',
    getUnreadStatus: () => false,
    joinChat: jest.fn(),
    pinChatAsync: jest.fn(() => Promise.resolve()),
    unpinChatAsync: jest.fn(() => Promise.resolve()),
  }),
}));
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChats: () => mockChatsQuery,
}));
jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useGetMyBlockedUsers: () => ({ data: [] }),
}));
jest.mock('@/utils/errors/displayError', () => ({
  getErrorMessage: () => 'erreur',
}));
jest.mock('@/utils/performance/messagingPerformance', () => ({
  markMessagingPerf: jest.fn(),
}));
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));
jest.mock('@/navigation/commonOptions', () => ({
  getFloatingActionContainerStyle: () => ({}),
}));
jest.mock('@/components/atoms/marqueeText/MarqueeText', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  const reactActuel = jest.requireActual('react');
  return (/** @type {any} */ props) => reactActuel.createElement(TexteRN, null, props.text);
});
jest.mock(
  '@/components/atoms/webFloatingOverlay/WebFloatingOverlay',
  () => (/** @type {any} */ props) => props.children || null,
);
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
jest.mock('@/views/collectivite/components/CanauxDeLaVille', () => () => null);
jest.mock('@/components/molecules/header/LeagueHeaderSwitch', () => () => null);
jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => () => null);
jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => (/** @type {any} */ props) => props.children || null,
);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/molecules/profileButton/ProfileButton', () => () => null);
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);
jest.mock(
  '@/components/molecules/tutorial/TutorialFlowBoundary',
  () => (/** @type {any} */ props) => props.children || null,
);
jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => (/** @type {any} */ props) => props.children || null,
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => (/** @type {any} */ props) => props.children || null,
);

const etatListe = () => ({
  data: { pages: [{ data: [], meta: { pagination: { page: 1, pageCount: 1, total: 0 } } }] },
  error: null,
  fetchNextPage: jest.fn(() => Promise.resolve()),
  hasNextPage: false,
  isFetching: false,
  isFetchingNextPage: false,
  isLoading: false,
  refetch: jest.fn(() => Promise.resolve()),
});

/** @type {any[]} */
const montes = [];

/**
 * Monte la messagerie.
 * @param {Record<string, any>} params - Les paramètres de la route.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (params) => {
  mockChatsQuery = etatListe();
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Messaging
        navigation={{ navigate: mockNavigate, setParams: jest.fn() }}
        route={{ params }}
      />,
    );
  });
  montes.push(arbre);
  return arbre;
};

const parLibelle = (arbre, libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ n) => n.props?.accessibilityLabel === libelle);

// RECOLTE-T11 K8 (14/11/2026, Adel « 337- B ») : ces témoins décrivent l'interrupteur
// FC_COMMUNAUTES_V1 ALLUMÉ (la recette) ; le bloc « K8 » en fin de fichier, ÉTEINT (la prod).
beforeEach(() => {
  process.env.FC_COMMUNAUTES_V1 = '1';
});
afterEach(() => {
  // `delete` ne retire rien du process.env de jest : on remet la valeur vide.
  process.env.FC_COMMUNAUTES_V1 = '';
});

beforeEach(() => {
  mockNavigate.mockClear();
  mockGetMesCommunautes.mockReset();
  mockAuth.userData = { documentId: 'moi', role: { name: 'Entraineur', type: 'coach' } };
});

afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => {
    arbre.unmount();
  }));
});

describe('COMMUNAUTES-L2 — l entrée « Communautés » de « Messages »', () => {
  test('E1 — serveur d avant le socle (404) : aucun bouton, le reste inchangé', async () => {
    mockGetMesCommunautes.mockRejectedValue(
      Object.assign(new Error('Not Found'), { response: { status: 404 } }),
    );
    const arbre = await monter({});
    expect(parLibelle(arbre, 'Communautés')).toHaveLength(0);
    expect(parLibelle(arbre, 'Nouvelle conversation')).toHaveLength(1);
  });

  test('E2 — aucune communauté (liste vide) : aucun bouton', async () => {
    mockGetMesCommunautes.mockResolvedValue([]);
    const arbre = await monter({});
    expect(mockGetMesCommunautes).toHaveBeenCalled();
    expect(parLibelle(arbre, 'Communautés')).toHaveLength(0);
  });

  test('E3 — une communauté : le bouton apparaît et ouvre « Communautés »', async () => {
    mockGetMesCommunautes.mockResolvedValue([
      {
        documentId: 'club-1',
        genre: 'club',
        groupes: [],
        nom: 'AS Demo',
      },
    ]);
    const arbre = await monter({});
    const bouton = parLibelle(arbre, 'Communautés');
    expect(bouton).toHaveLength(1);
    act(() => bouton[0].props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('Communautes');
  });
});

// RECOLTE-T11 K8 — interrupteur ÉTEINT (la prod) : rien des Communautés, et aucun appel au serveur.
describe('K8 — interrupteur FC_COMMUNAUTES_V1 éteint', () => {
  beforeEach(() => {
    process.env.FC_COMMUNAUTES_V1 = '0';
  });

  test('K8-E — une communauté rendue par le serveur, mais ni bouton ni appel', async () => {
    mockGetMesCommunautes.mockResolvedValue([
      {
        documentId: 'club-1',
        genre: 'club',
        groupes: [],
        nom: 'AS Demo',
      },
    ]);
    const arbre = await monter({});
    expect(parLibelle(arbre, 'Communautés')).toHaveLength(0);
    expect(mockGetMesCommunautes).not.toHaveBeenCalled();
  });
});
