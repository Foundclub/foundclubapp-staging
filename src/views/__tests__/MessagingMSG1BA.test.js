import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Messaging from '../Messaging';

// MSG1BA (§3.14) — L'APERÇU PAR APPUI LONG SUR UNE LIGNE DE « MESSAGES » : le fil en lecture
// seule, SANS le marquer comme lu, et le menu dessous (« Marquer comme lu / non lu »,
// « Épingler », « Archiver »). « Marquer comme non lu » est la route du serveur 1B
// (`POST /chats/:id/unread`) : contre un serveur d'avant (404), le geste disparait, sans
// erreur rouge. Doublures de `MessagingMSG1A.liste.test.js` (meme ecran, meme montage).

/** @type {any[]} */
const mockListProps = [];
/** @type {any} */
let mockChatsQuery;
const mockNavigate = jest.fn();
const mockJoinChat = jest.fn();
const mockMarkChatUnread = jest.fn();
const mockSendReadReceipt = jest.fn();
const mockUpdateLastReadMessage = jest.fn();
const mockPinChatAsync = jest.fn(() => Promise.resolve());
const mockArchiveChatAsync = jest.fn(() => Promise.resolve());
/** @type {any} */
let mockMessagesDeLApercu = { pages: [] };
const mockUseGetChatMessages = jest.fn();

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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

jest.mock('react-native-gesture-handler', () => ({
  Swipeable: (/** @type {any} */ props) => props.children,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const gabarit = typeof repli === 'string' ? repli : repli?.defaultValue;
      if (typeof gabarit !== 'string') return cle;
      return gabarit.replace(
        /\{\{(\w+)\}\}/g,
        (m, nom) => (repli?.[nom] !== undefined ? String(repli[nom]) : m),
      );
    },
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
    archiveChatAsync: mockArchiveChatAsync,
    getConversationName: (/** @type {any} */ input) => input?.chatGroupName || 'Conversation',
    getUnreadStatus: () => false,
    joinChat: mockJoinChat,
    markChatUnread: mockMarkChatUnread,
    pinChatAsync: mockPinChatAsync,
    sendReadReceipt: mockSendReadReceipt,
    unpinChatAsync: jest.fn(() => Promise.resolve()),
    updateLastReadMessage: mockUpdateLastReadMessage,
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  // MSGREACT — les reactions emoji du fil. Aucune par defaut : les temoins de
  // cet ecran ne parlent pas de reactions, et une rangee vide ne se dessine pas.
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: (/** @type {any[]} */ ...args) => {
    mockUseGetChatMessages(...args);
    return { data: mockMessagesDeLApercu };
  },
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
// COLL-C4A (02/10) — les canaux de la Ville lisent le serveur : hors du sujet de ce témoin.
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
 * @param {Record<string, any>} [params] Les parametres de la route (l espace, p114).
 * @returns {Promise<any>} L ecran monte.
 */
const monter = async (params = {}) => {
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

beforeEach(() => {
  mockListProps.length = 0;
  mockNavigate.mockClear();
  mockJoinChat.mockClear();
  mockMarkChatUnread.mockReset();
  mockSendReadReceipt.mockClear();
  mockUpdateLastReadMessage.mockClear();
  mockPinChatAsync.mockClear();
  mockArchiveChatAsync.mockClear();
  mockUseGetChatMessages.mockClear();
  mockMessagesDeLApercu = { pages: [] };
});

describe('MSG1BA (§3.14) — l apercu par appui long', () => {
  // eslint-disable-next-line global-require
  const ApercuDuFil = require('@/views/chat/ApercuDuFil').default;

  /**
   * Monte la liste avec ces fils.
   * @param {any[]} fils
   * @returns {Promise<any>}
   */
  const monterAvec = async (fils) => {
    mockChatsQuery = etatListe({
      data: {
        pages: [{
          data: fils,
          meta: { pagination: { page: 1, pageCount: 1, total: fils.length }, unreadTotal: 2 },
        }],
      },
      hasNextPage: false,
    });
    return monter();
  };

  /**
   * Appuie longuement sur la ligne d'un fil.
   * @param {any} arbre
   * @param {string} id
   * @returns {void}
   */
  const appuiLong = (arbre, id) => {
    const ligne = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === `liste-fil-${id}`
        && typeof n.props?.onLongPress === 'function',
    )[0];
    expect(ligne.props.delayLongPress).toBe(450);
    act(() => {
      ligne.props.onLongPress();
    });
  };

  /**
   * Les cles du menu de l'apercu ouvert.
   * @param {any} arbre
   * @returns {string[]}
   */
  const entrees = (arbre) => arbre.root.findByType(ApercuDuFil).props.entrees
    .map((/** @type {any} */ entree) => entree.cle);

  /**
   * Touche une entree du menu.
   * @param {any} arbre
   * @param {string} cle
   * @returns {Promise<void>}
   */
  const toucher = async (arbre, cle) => {
    const entree = arbre.root.findByType(ApercuDuFil).props.entrees
      .find((/** @type {any} */ e) => e.cle === cle);
    await act(async () => {
      await entree.onPress();
    });
  };

  const NON_LU = { ...CHATS[0], unreadCount: 2 };
  const LU = { ...CHATS[0], unreadCount: 0 };

  test('AL1 — appui long : l apercu s ouvre, sans rejoindre le fil ni l ouvrir', async () => {
    const arbre = await monterAvec([NON_LU]);
    expect(arbre.root.findAllByType(ApercuDuFil)).toHaveLength(0);

    appuiLong(arbre, 'chat-1');

    const apercu = arbre.root.findByType(ApercuDuFil);
    expect(apercu.props.visible).toBe(true);
    expect(apercu.props.titre).toBe('Les U13');
    expect(apercu.props.nonLu).toBe(true);
    expect(entrees(arbre)).toEqual(['marquer-lu', 'epingler', 'archiver']);
    expect(mockJoinChat).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSendReadReceipt).not.toHaveBeenCalled();
  });

  test('AL2 — « Marquer comme lu » : le curseur du serveur ET le « lu » local', async () => {
    const arbre = await monterAvec([NON_LU]);
    appuiLong(arbre, 'chat-1');
    await toucher(arbre, 'marquer-lu');
    expect(mockSendReadReceipt).toHaveBeenCalledWith('chat-1');
    expect(mockUpdateLastReadMessage).toHaveBeenCalledWith('chat-1');
  });

  test('AL3 — fil lu : « Marquer comme non lu » appelle la route du serveur 1B', async () => {
    mockMarkChatUnread.mockResolvedValue({ markedUnread: true, unreadCount: 1, unreadTotal: 3 });
    const arbre = await monterAvec([LU]);
    appuiLong(arbre, 'chat-1');
    expect(entrees(arbre)).toEqual(['marquer-non-lu', 'epingler', 'archiver']);
    await toucher(arbre, 'marquer-non-lu');
    expect(mockMarkChatUnread).toHaveBeenCalledWith('chat-1');
  });

  test('AL4 — serveur d avant 1B (404) : aucune erreur, et le geste disparait', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockMarkChatUnread.mockRejectedValue({ response: { status: 404 } });
    const arbre = await monterAvec([LU]);
    appuiLong(arbre, 'chat-1');
    await toucher(arbre, 'marquer-non-lu');
    expect(alerte).not.toHaveBeenCalled();

    appuiLong(arbre, 'chat-1');
    expect(entrees(arbre)).toEqual(['epingler', 'archiver']);
    alerte.mockRestore();
  });

  test('AL5 — toucher l apercu ouvre la conversation (c est la qu elle passe en lu)', async () => {
    const arbre = await monterAvec([NON_LU]);
    appuiLong(arbre, 'chat-1');
    act(() => {
      arbre.root.findByType(ApercuDuFil).props.onOuvrir();
    });
    expect(mockJoinChat).toHaveBeenCalledWith('chat-1');
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', expect.objectContaining({
      chatId: 'chat-1',
    }));
  });

  test('AL6 — « Épingler » et « Archiver » : les gestes existants de la ligne', async () => {
    const arbre = await monterAvec([LU]);
    appuiLong(arbre, 'chat-1');
    await toucher(arbre, 'epingler');
    expect(mockPinChatAsync).toHaveBeenCalledWith('chat-1');
    appuiLong(arbre, 'chat-1');
    await toucher(arbre, 'archiver');
    expect(mockArchiveChatAsync).toHaveBeenCalledWith('chat-1');
  });
});

// CORR-MESSAGERIE p4 (31/10, vu par la récolte) — sur le site à 390 px, « Épingler » et
// « Archiver » restaient visibles sur CHAQUE ligne et coupaient les noms. Un seul bouton ⋮
// ouvre l'apercu existant (MSG1BA), qui porte déjà ces deux gestes.
describe('CORR-MESSAGERIE p4 — les gestes de la ligne derrière un ⋮, sur le site', () => {
  // eslint-disable-next-line global-require
  const ApercuDuFil = require('@/views/chat/ApercuDuFil').default;
  // eslint-disable-next-line global-require
  const { Platform } = require('react-native');
  const osDOrigine = Platform.OS;
  afterEach(() => { Platform.OS = osDOrigine; });

  const textes = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());

  test('site : plus de boutons « Épingler » / « Archiver » sur la ligne ; le ⋮ ouvre l apercu', async () => {
    Platform.OS = 'web';
    mockChatsQuery = etatListe({
      data: {
        pages: [{
          data: [{ ...CHATS[0], unreadCount: 0 }],
          meta: { pagination: { page: 1, pageCount: 1, total: 1 }, unreadTotal: 0 },
        }],
      },
      hasNextPage: false,
    });
    const arbre = await monter();
    expect(textes(arbre)).not.toContain('"Épingler"');
    expect(textes(arbre)).not.toContain('"Archiver"');

    const options = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'liste-fil-options-chat-1'
        && typeof n.props?.onPress === 'function',
    )[0];
    act(() => { options.props.onPress({ stopPropagation: () => {} }); });
    const cles = arbre.root.findByType(ApercuDuFil).props.entrees
      .map((/** @type {any} */ entree) => entree.cle);
    expect(cles).toEqual(expect.arrayContaining(['epingler', 'archiver']));
  });
});

// CORR-MESSAGERIE p114 (31/10, décision d'Adel « B ») — en mode complexe, la messagerie montre
// aussi les conversations du club : chaque ligne porte sa casquette, « Club » ou « Complexe ».
describe('CORR-MESSAGERIE p114 — l étiquette Club / Complexe d un compte à deux casquettes', () => {
  const FIL_EQUIPE = {
    ...CHATS[0], documentId: 'fil-equipe', groupName: 'U11 Tunnel', type: 'team',
  };
  const CANAL_COMPLEXE = {
    ...CHATS[0], documentId: 'fil-canal', groupName: 'Complexe Test', participantsCount: 8, type: 'group',
  };
  const listeDe = (/** @type {any[]} */ fils) => etatListe({
    data: {
      pages: [{ data: fils, meta: { pagination: { page: 1, pageCount: 1, total: fils.length } } }],
    },
    hasNextPage: false,
  });
  const textes = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());

  test('espace du complexe, fils mêlés : « Club » et « Complexe » sur les lignes', async () => {
    mockChatsQuery = listeDe([FIL_EQUIPE, CANAL_COMPLEXE]);
    const arbre = await monter({ chatScope: 'classic', espace: 'complexe' });
    expect(textes(arbre)).toContain('"Club"');
    expect(textes(arbre)).toContain('"Complexe"');
  });

  test('un compte à une casquette ne voit rien de neuf', async () => {
    mockChatsQuery = listeDe([FIL_EQUIPE, { ...FIL_EQUIPE, documentId: 'fil-2' }]);
    const arbre = await monter({ chatScope: 'classic', espace: 'complexe' });
    expect(textes(arbre)).not.toContain('"Club"');
  });
});

describe('MSG1BA (§3.17) — une notice de groupe en apercu de la liste', () => {
  test('NL-1 — ma notice : « Vous avez renommé… », sans « Prénom : »', async () => {
    mockChatsQuery = etatListe({
      data: {
        pages: [{
          data: [{
            ...CHATS[0],
            messages: [{
              createdAt: '2026-10-07T10:00:00.000Z',
              documentId: 'n1',
              message: 'Adel F a renommé le groupe en « Les U13 bis ».',
              sender: null,
              systemNotice: {
                actor: { documentId: 'moi', firstname: 'Adel', lastname: 'F' },
                groupName: 'Les U13 bis',
                kind: 'group_renamed',
                targets: [],
                version: 1,
              },
            }],
          }],
          meta: { pagination: { page: 1, pageCount: 1, total: 1 } },
        }],
      },
      hasNextPage: false,
    });
    const arbre = await monter();
    const tout = JSON.stringify(arbre.toJSON());
    expect(tout).toContain('Vous avez renommé le groupe en « Les U13 bis ».');
    expect(tout).not.toContain('Adel F a renommé');
  });
});
