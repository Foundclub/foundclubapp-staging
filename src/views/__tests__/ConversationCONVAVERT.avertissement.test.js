import renderer, { act } from 'react-test-renderer';

// CONVAVERT (C4) — L'AVERTISSEMENT DOIT ETRE VU, SINON IL NE VAUT RIEN.
//
// 🎯 LA CONDITION POSEE PAR ADEL LE 2026-09-02 : « un message pour avertir que
// n'importe quelle conversation peut être vue par le dirigeant ». C'est la
// phrase qui rend la lecture par le dirigeant acceptable — donc elle doit vivre
// DANS la conversation, en permanence, pas dans un réglage ni dans les CGU.
//
// ⛔ ET ELLE NE DOIT PAS MENTIR : un fil qui n'est rattaché à AUCUN club (un
// tête-à-tête entre deux personnes sans club commun, un fil de groupe libre)
// n'a pas de dirigeant pour le lire. Y afficher l'avertissement serait faux.
//
// 🔴 ROUGE avant ce lot : C4-1 et C4-2 (le bandeau n'existe pas).
// 🟢 VERT des deux côtés : C4-3, C4-4, C4-5 — ils tiennent la porte fermée là
//    où la phrase serait fausse.
//
// ⛔ CE TEMOIN NE TESTE PAS UNE COPIE : il monte le VRAI écran.

const mockGiftedRenders = /** @type {any[]} */ ([]);
let mockChatData;
let mockMessagesPage;

jest.mock('react-native-gesture-handler', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return { Swipeable: VueRN };
});

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
    __esModule: true, default: VueRN, Path: VueRN, Rect: VueRN,
  };
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

// `.env` est gitignore, donc absent de toute copie de travail : sans ces
// doublures c'est la SUITE ENTIERE qui meurt au chargement.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
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
  default: { t: (/** @type {string} */ cle) => cle },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {},
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));
jest.mock('@/hooks/useAudioPlayback', () => ({ __esModule: true, default: () => ({}) }));
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

jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: jest.fn() }),
  useGetMyBlockedUsers: () => ({ data: [], refetch: jest.fn() }),
  useUnblockUser: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    getConversationName: () => 'Fil',
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

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({ data: mockChatData, isLoading: false }),
  useGetChatMessages: () => ({
    data: { pages: [mockMessagesPage] },
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

jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  (/** @type {any} */ { children }) => children
));
jest.mock('@/components/molecules/eventMessageBubble/EventMessageBubble', () => () => null);
jest.mock('@/components/atoms/errorWrapper/ErrorWrapper', () => () => null);
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock(
  '@/components/molecules/compositionMessageBubble/CompositionMessageBubble',
  () => () => null,
);
jest.mock('@/components/molecules/contactShareBubble/ContactShareBubble', () => () => null);
jest.mock('@/components/molecules/documentMessageBubble/DocumentMessageBubble', () => () => null);
jest.mock('@/components/molecules/eventCard/EventCardNew', () => () => null);
jest.mock('@/components/molecules/eventShareBubble/EventShareBubble', () => () => null);
jest.mock('@/components/molecules/locationShareBubble/LocationShareBubble', () => () => null);
jest.mock('@/components/molecules/pollMessageBubble/PollMessageBubble', () => () => null);
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

const TEST_ID = 'conversation-club-read-notice';
const PHRASE = 'Les conversations de ce club peuvent être consultées par son dirigeant.';

/** @type {Array<() => void>} */
const aDemonter = [];

const PAGE_VIDE = { data: [], meta: { pagination: { page: 1, pageCount: 1, total: 0 } } };

const FIL_DE_CLUB = {
  club: { documentId: 'club-1', name: 'AS Marseille' },
  documentId: 'chat-1',
  participants: [{ documentId: 'moi' }, { documentId: 'lui' }],
  type: 'club',
};

const FIL_D_EQUIPE = {
  documentId: 'chat-1',
  participants: [{ documentId: 'moi' }, { documentId: 'lui' }],
  team: { club: { documentId: 'club-1', name: 'AS Marseille' }, documentId: 'equipe-1', name: 'U15' },
  type: 'team',
};

const FIL_A_DEUX_SANS_CLUB = {
  documentId: 'chat-1',
  participants: [{ documentId: 'moi' }, { documentId: 'lui' }],
  type: 'whisper',
};

const FIL_DE_GROUPE_SANS_CLUB = {
  documentId: 'chat-1',
  groupName: 'Les copains',
  participants: [{ documentId: 'moi' }, { documentId: 'lui' }, { documentId: 'toi' }],
  type: 'group',
};

const FIL_D_EQUIPE_SANS_CLUB = {
  documentId: 'chat-1',
  participants: [{ documentId: 'moi' }, { documentId: 'lui' }],
  team: { documentId: 'equipe-league', name: 'Les Titans' },
  type: 'team',
};

/**
 * Monte le VRAI écran et rend ce qu'il a construit.
 * @returns {{avertissements: any[]}} Les bandeaux trouvés.
 */
const monterLaConversation = () => {
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
        route: { params: { chatId: 'chat-1' } },
      }),
    ));
  });

  aDemonter.push(() => {
    act(() => { ecran.unmount(); });
    clientRequetes.clear();
  });

  return {
    avertissements: ecran.root.findAll(
      (/** @type {any} */ noeud) => noeud?.props?.testID === TEST_ID,
      { deep: true },
    ),
  };
};

describe("CONVAVERT — l'avertissement en tête de conversation", () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockChatData = FIL_DE_CLUB;
    mockMessagesPage = PAGE_VIDE;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('C4-1 — sur un fil de CLUB, la phrase est là, en toutes lettres', () => {
    const { avertissements } = monterLaConversation();

    expect(avertissements.length).toBeGreaterThan(0);
    expect(avertissements[0].props.children).toBe(PHRASE);
  });

  test("C4-2 — sur un fil d'EQUIPE, elle est là aussi : l'équipe appartient à un club", () => {
    mockChatData = FIL_D_EQUIPE;

    const { avertissements } = monterLaConversation();

    expect(avertissements.length).toBeGreaterThan(0);
    expect(avertissements[0].props.children).toBe(PHRASE);
  });

  test("C4-3 — sur un tête-à-tête SANS club, aucune phrase : elle serait fausse", () => {
    mockChatData = FIL_A_DEUX_SANS_CLUB;

    const { avertissements } = monterLaConversation();

    expect(avertissements).toHaveLength(0);
  });

  test('C4-4 — sur un fil de GROUPE sans club, aucune phrase non plus', () => {
    mockChatData = FIL_DE_GROUPE_SANS_CLUB;

    const { avertissements } = monterLaConversation();

    expect(avertissements).toHaveLength(0);
  });

  test("C4-5 — une équipe SANS club (championnat libre) n'a pas de dirigeant : aucune phrase", () => {
    mockChatData = FIL_D_EQUIPE_SANS_CLUB;

    const { avertissements } = monterLaConversation();

    expect(avertissements).toHaveLength(0);
  });
});
