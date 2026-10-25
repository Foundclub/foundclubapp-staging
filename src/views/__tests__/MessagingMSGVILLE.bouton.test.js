import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Messaging from '../Messaging';

// MSG-VILLE-NOUVELLE (20/10/2026, REC17-004 ter) — LE BOUTON ROND « NOUVELLE CONVERSATION » DANS
// L'ESPACE DE LA VILLE. Capture d'Adel du 20/10 16:14 (site en production, Ville de Démouville →
// Messages) : « il manque un bouton pour créer des conversations avec qui je veux ». Avant ce lot,
// le bouton n'existait que pour les rôles Entraîneur, Dirigeant et SuperAdmin : un compte « Ville
// seule » (rôle Authenticated) ne l'avait pas, et un compte mixte ouvrait l'écran de SON club.
// Les doublures sont celles de `MessagingMSG1A.liste.test.js` (même écran, même montage).

const mockNavigate = jest.fn();
let mockChatsQuery;

jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    FlashList: function FlashListMock(/** @type {any} */ props) {
      return reactActuel.createElement(
        VueRN,
        null,
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

/**
 * Le bouton rond, s'il est là.
 * @param {any} arbre - L'arbre rendu.
 * @returns {any[]} Les boutons trouvés (0 ou 1).
 */
const bouton = (arbre) => arbre.root.findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ n) => n.props?.accessibilityLabel === 'Nouvelle conversation');

const ESPACE_VILLE = { chatScope: 'classic', collectiviteId: 'ville-demouville', espace: 'ville' };

beforeEach(() => {
  mockNavigate.mockClear();
});

afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => {
    arbre.unmount();
  }));
});

describe('MSG-VILLE-NOUVELLE — le bouton « Nouvelle conversation » de la Ville', () => {
  test('V1 — un compte « Ville seule » (Authenticated) a le bouton dans « Messages »', async () => {
    mockAuth.userData = { documentId: 'moi', role: { name: 'Authenticated' } };
    const arbre = await monter(ESPACE_VILLE);
    expect(bouton(arbre)).toHaveLength(1);
    // Le site et l'émulateur le trouvent par son identifiant.
    expect(bouton(arbre)[0].props.testID).toBe('messaging-nouvelle-conversation');
  });

  test('V2 — le bouton ouvre « Nouvelle conversation » AU NOM de cette Ville', async () => {
    mockAuth.userData = { documentId: 'moi', role: { name: 'Authenticated' } };
    const arbre = await monter(ESPACE_VILLE);
    await act(async () => {
      bouton(arbre)[0].props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('NewConversation', expect.objectContaining({
      collectiviteId: 'ville-demouville',
      espace: 'ville',
    }));
  });

  test('V3 — un compte mixte (dirigeant et gérant) : l’écran de la Ville', async () => {
    mockAuth.userData = { documentId: 'moi', role: { name: 'Dirigeant' } };
    const arbre = await monter(ESPACE_VILLE);
    await act(async () => {
      bouton(arbre)[0].props.onPress();
    });
    expect(mockNavigate.mock.calls[0][1]).toEqual(expect.objectContaining({ espace: 'ville' }));
  });

  test('V4 — les autres rôles ne voient aucun changement hors de la Ville', async () => {
    mockAuth.userData = { documentId: 'moi', role: { name: 'Joueur' } };
    expect(bouton(await monter({}))).toHaveLength(0);
    mockAuth.userData = { documentId: 'moi', role: { name: 'Authenticated' } };
    expect(bouton(await monter({}))).toHaveLength(0);
    mockAuth.userData = { documentId: 'moi', role: { name: 'Entraîneur' } };
    const arbre = await monter({ chatScope: 'classic' });
    await act(async () => {
      bouton(arbre)[0].props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('NewConversation', { chatScope: 'classic' });
  });

  test('Q4-17 — le rôle réel du serveur s écrit « Entraineur » (sans accent) : le bouton est là', async () => {
    mockAuth.userData = { documentId: 'moi', role: { name: 'Entraineur' } };
    expect(bouton(await monter({ chatScope: 'classic' }))).toHaveLength(1);
  });
});
