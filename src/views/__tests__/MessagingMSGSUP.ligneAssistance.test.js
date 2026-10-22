import renderer, { act } from 'react-test-renderer';

import Messaging from '../Messaging';

// ==========================================================================
// MSG-SUPPORT (20/10/2026) — LA LIGNE ÉPINGLÉE « ASSISTANCE FOUNDCLUB » EN TÊTE DE MESSAGES.
//
// « Tous les utilisateurs dans la messagerie, ils ont une conversation contact support ou
// assistance » (Adel, 20/10). Ce que le témoin tient :
//   1. la ligne est là pour TOUT LE MONDE, même sans aucun message ni conversation, avec son
//      invitation (« Une question ? Écris-nous. ») ;
//   2. la conversation d'assistance quitte les lignes ordinaires (pas de doublon) et la ligne
//      épinglée porte son dernier message et ses non-lus ;
//   3. un appui sans conversation : le serveur la crée, la liste se relit, la conversation
//      s'ouvre (type `assistance`, titre « Assistance FoundClub ») ;
//   4. un appui quand elle existe : elle s'ouvre, sans rien créer ;
//   5. le serveur refuse : un message le dit, rien ne s'ouvre ;
//   6. dans l'espace de la Ville, l'invitation vouvoie.
// Doublures : celles de `MessagingMSG1A.liste.test.js`, la liste rend aussi son EN-TÊTE.
// ==========================================================================

const mockNavigate = jest.fn();
const mockOuvrir = jest.fn();
/** @type {any} */
let mockChatsQuery;

jest.mock('@/services/chat/assistanceService', () => ({
  ouvrirMaConversationAssistance: (...args) => mockOuvrir(...args),
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

const mockAuth = { allMyTeams: [], userData: { documentId: 'moi', role: { name: 'Joueur' } } };
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

const UN_GROUPE = {
  documentId: 'chat-groupe',
  groupName: 'Les U13',
  messages: [],
  participants: [],
  type: 'group',
  unreadCount: 0,
};
const ASSISTANCE = {
  documentId: 'fil-assistance',
  messages: [{
    createdAt: '2026-10-20T15:00:00.000Z',
    documentId: 'm-2',
    message: 'On a remis ton équipe.',
    sender: { documentId: 'assistance-foundclub', firstname: 'Assistance', lastname: 'FoundClub' },
    senderSignature: { nom: 'Assistance FoundClub', voix: 'assistance' },
  }],
  participants: [],
  type: 'assistance',
  unreadCount: 2,
};

const etatListe = (/** @type {any[]} */ fils) => ({
  data: {
    pages: [{ data: fils, meta: { pagination: { page: 1, pageCount: 1, total: fils.length } } }],
  },
  error: null,
  fetchNextPage: jest.fn(() => Promise.resolve()),
  hasNextPage: false,
  isFetching: false,
  isFetchingNextPage: false,
  isLoading: false,
  refetch: jest.fn(() => Promise.resolve()),
});

const monter = async (/** @type {any[]} */ fils, params = {}) => {
  mockChatsQuery = etatListe(fils);
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
  return arbre;
};

// Le PREMIER nœud qui porte ce testID (un bouton en compte plusieurs couches), ou null.
const parTestId = (/** @type {any} */ arbre, /** @type {string} */ id) => (
  arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id)[0] || null
);
const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());

beforeEach(() => {
  mockNavigate.mockClear();
  mockOuvrir.mockReset();
});

describe('MSG-SUPPORT — la ligne épinglée « Assistance FoundClub »', () => {
  test('1. là pour tout le monde, même SANS aucune conversation, avec son invitation', async () => {
    const arbre = await monter([]);
    expect(parTestId(arbre, 'ligne-assistance')).not.toBeNull();
    expect(texte(arbre)).toContain('Assistance FoundClub');
    expect(texte(arbre)).toContain('Une question ? Écris-nous.');
  });

  test('2. quitte les lignes ordinaires ; la ligne porte dernier message et non-lus', async () => {
    const arbre = await monter([UN_GROUPE, ASSISTANCE]);
    expect(parTestId(arbre, 'liste-fil-fil-assistance')).toBeNull();
    expect(parTestId(arbre, 'liste-fil-chat-groupe')).not.toBeNull();
    expect(parTestId(arbre, 'ligne-assistance')).not.toBeNull();
    const apercu = parTestId(arbre, 'ligne-assistance-apercu');
    expect(apercu.props.children).toBe('On a remis ton équipe.');
    expect(parTestId(arbre, 'ligne-assistance-non-lus')).not.toBeNull();
  });

  test('3. un appui SANS conversation : créée, liste relue, ouverte', async () => {
    mockOuvrir.mockResolvedValueOnce({ documentId: 'fil-neuf' });
    const arbre = await monter([UN_GROUPE]);
    await act(async () => { parTestId(arbre, 'ligne-assistance').props.onPress(); });
    expect(mockOuvrir).toHaveBeenCalledTimes(1);
    expect(mockChatsQuery.refetch).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
      chatId: 'fil-neuf', chatType: 'assistance', title: 'Assistance FoundClub',
    });
  });

  test('4. un appui quand elle existe : elle s\'ouvre, rien n\'est créé', async () => {
    const arbre = await monter([ASSISTANCE]);
    await act(async () => { parTestId(arbre, 'ligne-assistance').props.onPress(); });
    expect(mockOuvrir).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', expect.objectContaining({
      chatId: 'fil-assistance', chatType: 'assistance',
    }));
  });

  test('5. le serveur refuse : un message le dit, rien ne s\'ouvre', async () => {
    mockOuvrir.mockRejectedValueOnce(new Error('panne'));
    const arbre = await monter([]);
    await act(async () => { parTestId(arbre, 'ligne-assistance').props.onPress(); });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(parTestId(arbre, 'ligne-assistance-erreur')).not.toBeNull();
  });

  test('6. espace de la Ville : l’invitation vouvoie, la conversation s’y ouvre', async () => {
    mockOuvrir.mockResolvedValueOnce({ documentId: 'fil-ville' });
    const arbre = await monter([], { espace: 'ville' });
    expect(texte(arbre)).toContain('Une question ? Écrivez-nous.');
    await act(async () => { parTestId(arbre, 'ligne-assistance').props.onPress(); });
    expect(mockNavigate)
      .toHaveBeenCalledWith('Conversation', expect.objectContaining({ espace: 'ville' }));
  });
});
