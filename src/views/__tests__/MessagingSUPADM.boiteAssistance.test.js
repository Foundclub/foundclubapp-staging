import renderer, { act } from 'react-test-renderer';

import Messaging from '../Messaging';

// ==========================================================================
// SUPADM (recette iPhone d'Adel du 23/10, point 2) — « J'ai envoyé un message à l'assistance et
// le compte SuperAdmin n'a rien reçu dans sa messagerie ; il voit la notif et peut ouvrir la
// conversation en cliquant dessus, mais dans l'onglet Messages il ne voit pas la conversation. »
//
// 🧨 LA CAUSE : un super-admin n'est JAMAIS participant d'une conversation d'assistance (MSGSUP,
// boîte commune) ; l'onglet Messages ne liste que SES conversations. La boîte ne vivait que dans
// la console (Administration → Assistance).
// Ce que le témoin tient :
//   1. un SuperAdmin voit la boîte commune en tête de Messages, chaque conversation avec le nom
//      de qui a écrit ; un appui l'ouvre comme la console (type `assistance`, titre = son nom) ;
//   2. au-delà de 5 conversations, un lien ouvre la boîte entière de la console ;
//   3. un autre compte ne la voit pas (et ne la lit pas).
// Doublures : celles de `MessagingMSGSUP.ligneAssistance.test.js`.
// ==========================================================================

const mockNavigate = jest.fn();
const mockBoite = jest.fn();
/** @type {any} */
let mockChatsQuery;

jest.mock('@/services/chat/assistanceService', () => ({
  ouvrirMaConversationAssistance: jest.fn(),
}));
jest.mock('@/services/chat/assistanceQueries', () => ({
  useBoiteAssistance: (/** @type {any} */ options) => mockBoite(options),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: () => {},
}));
jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    FlashList: function FlashListMock(/** @type {any} */ props) {
      return reactActuel.createElement(VueRN, null, [
        reactActuel.createElement(VueRN, { key: 'entete' }, props.ListHeaderComponent),
        ...(props.data || []).map((/** @type {any} */ element, /** @type {number} */ index) => (
          reactActuel.createElement(
            VueRN,
            { key: element?.documentId || index },
            props.renderItem({ item: element }),
          )
        )),
      ]);
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

const mockAuth = { allMyTeams: [], userData: { documentId: 'moi', role: { name: 'SuperAdmin', type: 'superadmin' } } };
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
jest.mock('@/utils/errors/displayError', () => ({ getErrorMessage: () => 'erreur' }));
jest.mock('@/utils/performance/messagingPerformance', () => ({ markMessagingPerf: jest.fn() }));
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));
jest.mock('@/navigation/commonOptions', () => ({ getFloatingActionContainerStyle: () => ({}) }));
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

const conversation = (/** @type {number} */ n) => ({
  dernierMessage: { apercu: `Message ${n}`, createdAt: '2026-10-23T10:00:00.000Z', deLAssistance: false },
  documentId: `c${n}`,
  enAttente: true,
  nonLus: n === 1 ? 2 : 0,
  titulaire: {
    avatar: null, firstname: 'Léa', lastname: `Martin${n}`, supprime: false,
  },
});

const monter = async (/** @type {number} */ nombre) => {
  mockChatsQuery = {
    data: { pages: [{ data: [], meta: { pagination: { page: 1, pageCount: 1, total: 0 } } }] },
    error: null,
    fetchNextPage: jest.fn(() => Promise.resolve()),
    hasNextPage: false,
    isFetching: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(() => Promise.resolve()),
  };
  mockBoite.mockReturnValue({
    data: {
      conversations: Array.from({ length: nombre }, (_, i) => conversation(i + 1)),
      enAttenteTotal: nombre,
      nonLusTotal: 2,
    },
    refetch: jest.fn(),
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Messaging navigation={{ navigate: mockNavigate, setParams: jest.fn() }} route={{ params: {} }} />,
    );
  });
  return arbre;
};

const parTestId = (/** @type {any} */ arbre, /** @type {string} */ id) => (
  arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id)[0] || null
);
const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());

beforeEach(() => {
  mockNavigate.mockClear();
  mockBoite.mockReset();
  mockAuth.userData.role = { name: 'SuperAdmin', type: 'superadmin' };
});

describe('SUPADM — la boîte de l’assistance dans l’onglet Messages du SuperAdmin', () => {
  test('1. elle est là, et un appui ouvre la conversation comme la console', async () => {
    const arbre = await monter(2);
    expect(parTestId(arbre, 'messages-boite-assistance')).not.toBeNull();
    expect(texte(arbre)).toContain('Léa Martin1');
    expect(texte(arbre)).toContain('Message 2');
    expect(parTestId(arbre, 'boite-assistance-non-lus-c1')).not.toBeNull();
    await act(async () => { parTestId(arbre, 'boite-assistance-ligne-c1').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
      chatId: 'c1', chatType: 'assistance', title: 'Léa Martin1',
    });
  });

  test('2. au-delà de 5, les 5 premières, et un lien vers la boîte entière', async () => {
    const arbre = await monter(7);
    expect(parTestId(arbre, 'boite-assistance-ligne-c5')).not.toBeNull();
    expect(parTestId(arbre, 'boite-assistance-ligne-c6')).toBeNull();
    await act(async () => { parTestId(arbre, 'messages-boite-assistance-tout').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('AdminStack', { screen: 'AdminAssistance' });
  });

  test('3. un autre compte ne la voit pas, et ne la lit pas', async () => {
    mockAuth.userData.role = { name: 'Joueur', type: 'joueur' };
    const arbre = await monter(2);
    expect(parTestId(arbre, 'messages-boite-assistance')).toBeNull();
    expect(mockBoite).not.toHaveBeenCalled();
  });
});
