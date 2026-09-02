import renderer, { act } from 'react-test-renderer';

// BLOQUER (E6) — LE SECOND ENDROIT QU'APPLE REGARDE : LE MENU DE LA CONVERSATION.
//
// 🔴 LA MESURE DU 2026-09-02, avant ce lot : le menu du fil ne portait que
// « Annuler le match », « Gérer le groupe », « Signaler » et « Fermer ». Aucun
// moyen de bloquer la personne d'en face, dans une app avec messagerie 1:1,
// notes vocales et comptes de mineurs. Apple 1.2 exige QUATRE dispositifs
// (filtrage, signalement, BLOCAGE, coordonnées) ; Play écrit « must provide an
// in-app functionality for blocking users ».
//
// 🧒 K5 — LA REGLE, ET ELLE TIENT EN UNE LIGNE : le blocage ne ferme qu'une
// discussion STRICTEMENT A DEUX. Le témoin B2 fige l'autre moitié : dans un fil
// de groupe (le fil « Contact mineur » d'un enfant avec son parent en est un),
// il n'y a personne à bloquer et le bouton n'apparaît pas.
//
// ⛔ CE TEMOIN NE TESTE PAS UNE COPIE : il monte le VRAI écran et lit les
// boutons que le menu construit réellement, plus les messages que GiftedChat
// reçoit réellement.

const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockBoutons = /** @type {any[]} */ ([]);
let mockChatData;
let mockMessagesPage;
let mockBlockedRows;
const mockBlockMutate = jest.fn();
const mockUnblockMutate = jest.fn();

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

// 🎯 LA COUTURE DU LOT : la liste des personnes que J'AI bloquees, et les deux
// gestes. On ne double PAS le module par `requireActual` — il importe le client
// HTTP, qui refuse de se charger sans `.env`.
jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: mockBlockMutate }),
  useGetMyBlockedUsers: () => ({ data: mockBlockedRows, refetch: jest.fn() }),
  useUnblockUser: () => ({ isPending: false, mutate: mockUnblockMutate }),
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

// 🎣 LE CAPTEUR : chaque bouton construit par l'ecran, avec son libelle.
jest.mock('@/components/atoms/button/Button', () => (/** @type {any} */ props) => {
  mockBoutons.push(props);
  return null;
});

// La feuille du menu rend ses enfants : sans ca, ses boutons ne seraient
// jamais construits et le temoin serait vert sur un menu vide.
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

/** @type {Array<() => void>} */
const aDemonter = [];

const FIL_A_DEUX = {
  documentId: 'chat-1',
  participants: [{ documentId: 'moi' }, { documentId: 'lui' }],
  type: 'whisper',
};

const FIL_DE_GROUPE = {
  documentId: 'chat-1',
  groupName: 'Les U15',
  participants: [{ documentId: 'moi' }, { documentId: 'lui' }, { documentId: 'parent' }],
  type: 'group',
};

const PAGE_VIDE = { data: [], meta: { pagination: { page: 1, pageCount: 1, total: 0 } } };

/**
 * Monte le VRAI ecran et rend ce qu'il a construit.
 * @returns {any} { titres, messages }.
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

  const propsGifted = mockGiftedRenders[mockGiftedRenders.length - 1];
  return {
    boutons: mockBoutons,
    messages: propsGifted?.messages || [],
    titres: mockBoutons.map((/** @type {any} */ props) => props?.title).filter(Boolean),
  };
};

describe('BLOQUER — le menu de la conversation', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockBoutons.length = 0;
    mockChatData = FIL_A_DEUX;
    mockMessagesPage = PAGE_VIDE;
    mockBlockedRows = [];
    mockBlockMutate.mockClear();
    mockUnblockMutate.mockClear();
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('B1 — dans un tete-a-tete, le menu porte « Bloquer cette personne »', () => {
    const { titres } = monterLaConversation();

    expect(titres).toContain('Bloquer cette personne');
  });

  test('B2 — K5 : dans un fil de GROUPE, aucun bouton de blocage', () => {
    mockChatData = FIL_DE_GROUPE;

    const { titres } = monterLaConversation();

    expect(titres).not.toContain('Bloquer cette personne');
    expect(titres).not.toContain('Débloquer cette personne');
    // Le menu existe bien : c'est le bouton de blocage qui est absent, pas le menu.
    expect(titres).toContain('Signaler');
  });

  test('B3 — quand la personne est deja bloquee, le menu propose de DEBLOQUER', () => {
    mockBlockedRows = [{ documentId: 'block-1', user: { documentId: 'lui' } }];

    const { boutons, titres } = monterLaConversation();

    expect(titres).toContain('Débloquer cette personne');
    expect(titres).not.toContain('Bloquer cette personne');

    // Debloquer ne demande AUCUNE confirmation : le geste ne detruit rien.
    const boutonDebloquer = boutons.find(
      (/** @type {any} */ props) => props?.title === 'Débloquer cette personne',
    );
    act(() => { boutonDebloquer.onPress(); });
    expect(mockUnblockMutate).toHaveBeenCalledWith('lui');
  });

  test('B4 — K4 : les bulles d\'une personne bloquee ne sont plus affichees', () => {
    mockBlockedRows = [{ documentId: 'block-1', user: { documentId: 'lui' } }];
    mockMessagesPage = {
      data: [
        {
          createdAt: '2026-09-01T10:00:00.000Z',
          documentId: 'm1',
          message: 'de moi',
          sender: { documentId: 'moi', firstname: 'Adel' },
        },
        {
          createdAt: '2026-09-01T10:01:00.000Z',
          documentId: 'm2',
          message: 'de la personne bloquee',
          sender: { documentId: 'lui', firstname: 'Lui' },
        },
      ],
      meta: { pagination: { page: 1, pageCount: 1, total: 2 } },
    };

    const { messages } = monterLaConversation();

    const textes = messages.map((/** @type {any} */ message) => message?.text);
    expect(textes).toContain('de moi');
    expect(textes).not.toContain('de la personne bloquee');
  });

  test('B5 — sans blocage, RIEN ne disparait', () => {
    mockMessagesPage = {
      data: [
        {
          createdAt: '2026-09-01T10:01:00.000Z',
          documentId: 'm2',
          message: 'de la personne',
          sender: { documentId: 'lui', firstname: 'Lui' },
        },
      ],
      meta: { pagination: { page: 1, pageCount: 1, total: 1 } },
    };

    const { messages } = monterLaConversation();

    expect(messages.map((/** @type {any} */ message) => message?.text))
      .toContain('de la personne');
  });
});
