import renderer, { act } from 'react-test-renderer';

import Messaging from '../Messaging';

// MSG2 — « l animation de rechargement de la messagerie bugge enormement »
// (Adel, 15/09).
//
// 📏 CE QUI EST LU DANS LE CODE (Messaging.js, avant correctif) :
// la liste branchait l indicateur « tirer pour rafraichir » sur
// `refreshing={isFetching && !isLoading}`. Or `isFetching` est vrai pour TOUT
// chargement de fond de la meme requete : la page suivante demandee en
// defilant, la relecture declenchee par l echo de lecture d un fil, le retour au
// premier plan. Chaque fois, l indicateur descend, pousse la liste, puis
// remonte — sans que personne n ait tire. Et `onEndReached` redemandait une
// page PENDANT qu une autre chargeait : react-query v5 annule alors l appel en
// vol et en relance un (cancelRefetch vaut true par defaut sur fetchNextPage).
//
// Messaging.js n avait AUCUN test (E6) : le premier bloc fige ce que l ecran
// fait deja et doit passer avant ET apres ; le second decrit le defaut.

/** @type {any[]} */
const mockListProps = [];
/** @type {any} */
let mockChatsQuery;
const mockNavigate = jest.fn();
const mockJoinChat = jest.fn();

// FlashList ne rend rien sous `react-test-renderer` : la doublure deroule
// `data` et garde les props pour qu on lise `refreshing` et `onEndReached`.
jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    FlashList: function FlashListMock(/** @type {any} */ props) {
      mockListProps.push(props);
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

// Le VRAI theme, jamais un Proxy : un Proxy rend les echecs Jest illisibles.
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

// Identite STABLE : un `userData` neuf a chaque rendu reconstruirait la liste.
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
    joinChat: mockJoinChat,
    pinChatAsync: jest.fn(() => Promise.resolve()),
    unpinChatAsync: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
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

const CHATS = [
  {
    documentId: 'chat-1',
    groupName: 'Les U13',
    messages: [],
    participants: [],
    type: 'group',
    unreadCount: 0,
    updatedAt: '2026-09-15T10:00:00.000Z',
  },
];

/**
 * Etat de la requete de liste, fige par defaut sur « page chargee, rien en vol ».
 * @param {Record<string, any>} [surcharge] Les champs a changer.
 * @returns {any} L etat de `useGetChats`.
 */
const etatListe = (surcharge = {}) => ({
  data: { pages: [{ data: CHATS, meta: { pagination: { page: 1, pageCount: 3, total: 50 } } }] },
  error: null,
  fetchNextPage: jest.fn(() => Promise.resolve()),
  hasNextPage: true,
  isFetching: false,
  isFetchingNextPage: false,
  isLoading: false,
  refetch: jest.fn(() => Promise.resolve()),
  ...surcharge,
});

/**
 * Monte l ecran Messages sous ses doublures.
 * @returns {Promise<any>} L ecran monte.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Messaging
        navigation={{ navigate: mockNavigate, setParams: jest.fn() }}
        route={{ params: {} }}
      />,
    );
  });
  return arbre;
};

const dernieresProps = () => mockListProps[mockListProps.length - 1];

beforeEach(() => {
  mockListProps.length = 0;
  mockNavigate.mockClear();
  mockJoinChat.mockClear();
});

describe('MSG2 caracterisation — ce que la liste des conversations fait deja', () => {
  test('la liste deroule les conversations de la requete', async () => {
    mockChatsQuery = etatListe();
    const arbre = await monter();

    const identifiants = dernieresProps().data.map((/** @type {any} */ chat) => chat.documentId);
    expect(identifiants).toEqual(['chat-1']);
    expect(JSON.stringify(arbre.toJSON())).toContain('Les U13');
  });

  test('tirer pour rafraichir relit la liste une fois', async () => {
    mockChatsQuery = etatListe();
    await monter();

    await act(async () => {
      await dernieresProps().onRefresh();
    });

    expect(mockChatsQuery.refetch).toHaveBeenCalledTimes(1);
  });

  test('arriver en bas de liste demande la page suivante quand il y en a une', async () => {
    mockChatsQuery = etatListe();
    await monter();

    act(() => {
      dernieresProps().onEndReached();
    });

    expect(mockChatsQuery.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  test('sans page suivante, arriver en bas ne demande rien', async () => {
    mockChatsQuery = etatListe({ hasNextPage: false });
    await monter();

    act(() => {
      dernieresProps().onEndReached();
    });

    expect(mockChatsQuery.fetchNextPage).not.toHaveBeenCalled();
  });
});

describe('MSG2 — l indicateur de rechargement ne s allume QUE si on tire', () => {
  test('un chargement de fond (relecture apres lecture) n allume pas l indicateur', async () => {
    mockChatsQuery = etatListe({ isFetching: true });
    await monter();

    expect(dernieresProps().refreshing).toBe(false);
  });

  test('charger la page suivante n allume pas l indicateur du HAUT de la liste', async () => {
    mockChatsQuery = etatListe({ isFetching: true, isFetchingNextPage: true });
    await monter();

    expect(dernieresProps().refreshing).toBe(false);
  });

  test('pendant qu une page charge, arriver en bas ne relance AUCUN appel', async () => {
    mockChatsQuery = etatListe({ isFetching: true, isFetchingNextPage: true });
    await monter();

    act(() => {
      dernieresProps().onEndReached();
      dernieresProps().onEndReached();
      dernieresProps().onEndReached();
    });

    expect(mockChatsQuery.fetchNextPage).toHaveBeenCalledTimes(0);
  });

  test('tirer allume l indicateur pendant la relecture, puis l eteint', async () => {
    let terminerRelecture = () => {};
    mockChatsQuery = etatListe({
      refetch: jest.fn(() => new Promise((resolve) => {
        terminerRelecture = () => resolve(undefined);
      })),
    });
    await monter();

    /** @type {Promise<any>} */
    let relecture = Promise.resolve();
    act(() => {
      relecture = dernieresProps().onRefresh();
    });
    expect(dernieresProps().refreshing).toBe(true);

    await act(async () => {
      terminerRelecture();
      await relecture;
    });
    expect(dernieresProps().refreshing).toBe(false);
  });
});
