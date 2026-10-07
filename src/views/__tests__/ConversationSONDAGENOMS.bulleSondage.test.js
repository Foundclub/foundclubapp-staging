import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// 🐞 SONDAGE-NOMS (07/10, Adel sur TestFlight 2.6.70) — LA BULLE DU SONDAGE, DANS LE FIL,
// NOMMAIT « Membre » UN VOTANT QUI N'AVAIT RIEN ÉCRIT.
//
// L'écran nomme les votants avec son annuaire : moi, `participants`, et l'auteur de chaque
// message CHARGÉ. Un fil de CLUB est créé avec `participants: []` ⇒ un membre qui a voté sans
// écrire = « Membre ». Le serveur rend désormais les noms (`GET /chat-messages/:id/poll-voters`).
//
// ⛔ LE PIÈGE QUE CE TÉMOIN GARDE (celui de FINITIONS15, mémoire
// piege-giftedchat-memo-ignore-etat-externe) :
// GiftedChat mémorise chaque bulle et ne la redessine que si le MESSAGE change. Des noms qui
// arrivent APRÈS le premier dessin ne la redessinent donc jamais si c'est l'écran qui les lit.
// Ce témoin fait rendre la bulle UNE fois, comme GiftedChat, puis laisse la lecture aboutir :
// la bulle doit se mettre à jour TOUTE SEULE. ROUGE avant le lot.

const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockGet = jest.fn();

jest.mock('react-native-gesture-handler', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').gestureHandler()
));
jest.mock('react-native-reanimated', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').reanimated()
));

jest.mock('react-native-gifted-chat', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    Bubble: VueRN,
    Composer: VueRN,
    GiftedChat: (/** @type {any} */ props) => { mockGiftedRenders.push(props); return null; },
    InputToolbar: VueRN,
    Time: VueRN,
  };
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(), launchImageLibrary: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

// 🎯 LA COUTURE DU LOT : la frontière HTTP. `.env` est gitignore, donc absent de toute copie de
// travail : sans cette doublure c'est la SUITE ENTIÈRE qui meurt au chargement.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: (/** @type {any[]} */ ...args) => mockGet(...args),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('@/services/event/eventService', () => ({
  missingEvent: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [],
    hasClubAccess: true,
    userData: { documentId: 'moi', firstname: 'Adel', role: { name: 'Joueur' } },
  }),
}));
jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => Promise.resolve({ jwt: 'jwt' }),
  getManagedMultisportIds: () => [],
  getUserRoleKey: () => 'player',
}));
jest.mock('@/theme/strings', () => ({
  __esModule: true,
  default: {
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => (
      typeof repli === 'string'
        ? repli.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ m, /** @type {string} */ nom) => (
          valeurs && valeurs[nom] !== undefined ? String(valeurs[nom]) : m))
        : cle
    ),
  },
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/hooks/useAudioPlayback', () => ({
  __esModule: true,
  default: () => ({}),
  pauseActivePlayback: () => {},
}));
jest.mock('@/hooks/useLeagueLegalAcceptance', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('@/services/chat/voiceNoteService', () => ({
  cancelRecording: jest.fn(),
  deleteVoiceNoteFile: jest.fn(),
  isVoiceNoteRecordingSupported: () => false,
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
}));
jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: jest.fn(),
}));
jest.mock('@/services/league/leagueMatchService', () => ({
  cancelMatch: jest.fn(), createLeagueProposal: jest.fn(), respondToLeagueProposal: jest.fn(),
}));
jest.mock('@/services/messageReport/messageReportService', () => ({
  createMessageReport: jest.fn(),
}));
jest.mock('@/services/reservation/reservationService', () => ({ joinReservation: jest.fn() }));
jest.mock('@/services/event/eventQueries', () => ({ useGetEvents: () => ({ data: null }) }));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    getConversationName: () => 'Fil du club',
    joinChat: jest.fn(),
    leaveChat: jest.fn(),
    markMessagesAsRead: jest.fn(),
    retryMessage: jest.fn(),
    sendMessage: jest.fn(),
    sendReadReceipt: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: jest.fn(),
    socket: { emit: jest.fn(), off: jest.fn(), on: jest.fn() },
    typingUsers: [],
  }),
}));

const KARIM = { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' };
const LEO = { documentId: 'leo', firstname: 'Leo', lastname: 'Martin' };
const SONDAGE = {
  allowMultipleVotes: false,
  createdBy: KARIM.documentId,
  isAnonymous: false,
  options: [
    { id: 'opt-1', label: 'Samedi 14h', voters: [LEO.documentId] },
    { id: 'opt-2', label: 'Dimanche 10h', voters: [] },
  ],
  pollId: 'poll-1',
  question: 'Quel creneau ?',
  type: 'poll',
};

// Le fil d'un CLUB, comme le serveur le crée : `participants: []`. Le seul message chargé est
// le sondage, posé par Karim : Léo a voté sans jamais écrire.
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({
    data: { documentId: 'chat-club', participants: [], type: 'club' },
    isLoading: false,
  }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({
    data: {
      pages: [{
        data: [{
          composition: {
            allowMultipleVotes: false,
            createdBy: 'karim',
            isAnonymous: false,
            options: [
              { id: 'opt-1', label: 'Samedi 14h', voters: ['leo'] },
              { id: 'opt-2', label: 'Dimanche 10h', voters: [] },
            ],
            pollId: 'poll-1',
            question: 'Quel creneau ?',
            type: 'poll',
          },
          createdAt: '2026-10-07T09:30:00.000Z',
          documentId: 'msg-sondage',
          message: '',
          sender: { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' },
        }],
        meta: { pagination: { page: 1, pageCount: 1, total: 1 } },
      }],
    },
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetching: false,
    isLoading: false,
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('@/components/molecules/eventMessageBubble/EventMessageBubble', () => () => null);
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/atoms/errorWrapper/ErrorWrapper', () => () => null);
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
jest.mock(
  '@/components/molecules/compositionMessageBubble/CompositionMessageBubble',
  () => () => null,
);
jest.mock('@/components/molecules/contactShareBubble/ContactShareBubble', () => () => null);
jest.mock('@/components/molecules/documentMessageBubble/DocumentMessageBubble', () => () => null);
jest.mock('@/components/molecules/eventCard/EventCardNew', () => () => null);
jest.mock('@/components/molecules/eventShareBubble/EventShareBubble', () => () => null);
jest.mock('@/components/molecules/locationShareBubble/LocationShareBubble', () => () => null);
// ⚠️ PAS de doublure de PollMessageBubble : c'est la bulle VRAIE que ce témoin regarde.
jest.mock('@/components/molecules/proposalMessageBubble/ProposalMessageBubble', () => () => null);
jest.mock('@/components/molecules/voiceNoteBubble/VoiceNoteBubble', () => () => null);
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => () => null,
);
jest.mock('@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet', () => () => null);
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);
jest.mock('@/components/organisms/pollCreationModal/PollCreationModal', () => () => null);
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => () => null);
jest.mock('@/components/organisms/venueProposalModal/VenueProposalModal', () => () => null);

jest.setTimeout(30000);

/** @type {Array<() => void>} */
const aDemonter = [];

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children)
    .filter((x) => typeof x === 'string' || typeof x === 'number').join(''))
  .join(' | ');

describe('SONDAGE-NOMS — la bulle du sondage nomme un votant qui n a rien écrit', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockGet.mockReset();
    mockGet.mockImplementation((/** @type {string} */ url) => (
      url === '/chat-messages/msg-sondage/poll-voters'
        ? Promise.resolve({
          data: { chatDocumentId: 'chat-club', data: [LEO], messageDocumentId: 'msg-sondage' },
        })
        : Promise.resolve({ data: {} })
    ));
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('fil de club : la bulle, dessinée UNE fois, finit par « Leo Martin »', async () => {
    // eslint-disable-next-line global-require
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
    // eslint-disable-next-line global-require
    const { createElement } = require('react');
    // eslint-disable-next-line global-require
    const Conversation = require('../Conversation').default;

    const clientRequetes = new QueryClient({
      defaultOptions: {
        mutations: { gcTime: 0, retry: false },
        queries: { gcTime: 0, retry: false },
      },
    });

    /** @type {any} */
    let ecran = null;
    act(() => {
      ecran = renderer.create(createElement(
        QueryClientProvider,
        { client: clientRequetes },
        createElement(Conversation, {
          navigation: {
            addListener: () => () => {},
            goBack: jest.fn(),
            navigate: jest.fn(),
            setOptions: jest.fn(),
          },
          route: { params: { chatId: 'chat-club' } },
        }),
      ));
    });

    // UN seul dessin de la bulle, comme GiftedChat.
    const propsGifted = mockGiftedRenders[mockGiftedRenders.length - 1];
    const bulle = propsGifted.renderBubble({
      currentMessage: {
        _id: 'msg-sondage',
        composition: SONDAGE,
        documentId: 'msg-sondage',
        user: { _id: KARIM.documentId },
      },
      nextMessage: {},
      position: 'left',
      previousMessage: {},
    });
    /** @type {any} */
    let arbreBulle = null;
    act(() => {
      arbreBulle = renderer.create(createElement(
        QueryClientProvider,
        { client: clientRequetes },
        bulle,
      ));
    });
    // La lecture des noms part à l'abonnement (fin du premier `act`), puis react-query prévient
    // ses abonnés au tour suivant. AUCUN nouveau dessin n'est demandé par l'écran.
    await act(async () => {
      await new Promise((fini) => { setTimeout(fini, 20); });
    });
    aDemonter.push(() => {
      act(() => { arbreBulle.unmount(); });
      act(() => { ecran.unmount(); });
      clientRequetes.clear();
    });

    const rendu = textes(arbreBulle);
    expect(rendu).toContain('Samedi 14h');
    expect(rendu).not.toContain('Membre');
    expect(rendu).toContain('Leo Martin');
    expect(mockGet).toHaveBeenCalledWith('/chat-messages/msg-sondage/poll-voters');
  });
});
