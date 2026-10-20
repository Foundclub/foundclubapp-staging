import renderer, { act } from 'react-test-renderer';

// ============================================================================
// MSG-SUPPORT (20/10/2026) — LA CONVERSATION « ASSISTANCE FOUNDCLUB » DANS LA VRAIE
// CONVERSATION DU TÉLÉPHONE. Le montage est celui du témoin COLL-C4A2
// (ConversationCOLLC4A2.filDeLaVille), recopié à l'identique : mêmes doublures ; seule
// l'identité change (titulaire, super-admin).
//
// Ce que le témoin tient :
//   · titulaire : titre « Assistance FoundClub », ligne « L'équipe FoundClub te répond ici »,
//     chaque réponse signée « Assistance FoundClub » (jamais le nom de l'admin), la saisie
//     OUVERTE (un mineur écrit), le vide qui invite à écrire ;
//   · super-admin (console) : le nom du titulaire en titre, les réponses de l'équipe À DROITE
//     (« notre » côté) et signées « Assistance FoundClub · Sophie A. » (qui a répondu) ;
//   · un fil ordinaire ne change pas.
// ============================================================================
const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockBoutons = /** @type {any[]} */ ([]);
let mockChatData;
let mockMessagesError;
let mockMembres;
const mockSendMessage = jest.fn(() => 'temp-1');
// COLL-C4A3 point 4 — « Réessayer » un message en échec.
const mockRetry = jest.fn();
let mockMessagesPage;
let mockBlockedRows;
const mockBlockMutate = jest.fn();
const mockUnblockMutate = jest.fn();

// VOCAL — la barre de saisie porte la zone vocale (Reanimated + Gesture Handler) :
// doublures partagées, qui gardent `Swipeable` et enregistrent les gestes.
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
    // MSG1A — la bulle de texte rend le `MessageText` de GiftedChat dans son propre cadre,
    // et la puce de date son `Day`.
    Day: VueRN,
    GiftedChat: (/** @type {any} */ props) => { mockGiftedRenders.push(props); return null; },
    InputToolbar: VueRN,
    MessageText: VueRN,
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

// MSG-SUPPORT — deux regards : le titulaire (Lina, 15 ans) et un super-admin de l'équipe.
let mockUserData = { documentId: 'lina', firstname: 'Lina', role: { name: 'Joueur' } };
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [],
    hasClubAccess: true,
    userData: mockUserData,
  }),
}));
jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => Promise.resolve({ jwt: 'jwt' }),
  getManagedMultisportIds: () => [],
  getUserRoleKey: (/** @type {any} */ role) => (/super/i.test(String(role || ''))
    ? 'superAdmin'
    : 'player'),
}));
jest.mock('@/theme/strings', () => ({
  __esModule: true,
  // I18N-4 : l ecran lit ses textes par i18n.t(clef, repli) ; la doublure rend le repli.
  default: {
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => (
      typeof repli === 'string'
        ? repli.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ m, /** @type {string} */ nom) => (
          valeurs && valeurs[nom] !== undefined ? String(valeurs[nom]) : m))
        : cle
    ),
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {},
    // COLL-C4A2 : la doublure INTERPOLE (les fils de la Ville nomment la Ville et les clubs).
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => (
      typeof repli === 'string'
        ? repli.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ m, /** @type {string} */ nom) => (
          valeurs && valeurs[nom] !== undefined ? String(valeurs[nom]) : m))
        : cle
    ),
  }),
}));
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

// 🎯 LA COUTURE DU LOT : la liste des personnes que J'AI bloquees, et les deux
// gestes. On ne double PAS le module par `requireActual` — il importe le client
// HTTP, qui refuse de se charger sans `.env`.
jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: mockBlockMutate }),
  useGetMyBlockedUsers: () => ({ data: mockBlockedRows, refetch: jest.fn() }),
  useUnblockUser: () => ({ isPending: false, mutate: mockUnblockMutate }),
}));

// COLL-C4A2 — la liste calculee du fil (le serveur la rend) : 2 clubs.
jest.mock('@/services/collectivite/collectiviteCanauxQueries', () => ({
  useMembresDuFil: () => ({ data: mockMembres }),
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
    retryFailedMessage: mockRetry,
    retryMessage: jest.fn(),
    sendMessage: mockSendMessage,
    sendReadReceipt: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: jest.fn(),
    socket: { emit: jest.fn(), off: jest.fn(), on: jest.fn() },
    typingUsers: [],
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  // MSGREACT — les reactions emoji du fil. Aucune par defaut : les temoins de
  // cet ecran ne parlent pas de reactions, et une rangee vide ne se dessine pas.
  useGetChatById: () => ({ data: mockChatData, isLoading: false }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({
    data: { pages: [mockMessagesPage] },
    error: mockMessagesError,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isError: Boolean(mockMessagesError),
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

const PAGE = {
  data: [
    {
      createdAt: '2026-10-02T08:00:00.000Z',
      documentId: 'm-systeme',
      message: 'Club D a rejoint le canal : il est rattaché à la Ville depuis aujourd’hui.',
      sender: null,
      updatedAt: '2026-10-02T08:00:00.000Z',
    },
    {
      createdAt: '2026-10-02T09:00:00.000Z',
      documentId: 'm-karim',
      message: 'Pour le 8, nos U15 peuvent passer à 19:00.',
      sender: { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' },
      senderSignature: { nom: 'AS Ville A', voix: 'club' },
      updatedAt: '2026-10-02T09:00:00.000Z',
    },
    {
      createdAt: '2026-10-02T10:00:00.000Z',
      documentId: 'm-ville',
      message: 'Merci. Faites chacun votre demande.',
      sender: { documentId: 'agent', firstname: 'Sophie', lastname: 'Leroy' },
      senderSignature: { nom: 'Ville de Demo', voix: 'ville' },
      updatedAt: '2026-10-02T10:00:00.000Z',
    },
  ],
  meta: { pagination: { page: 1, pageCount: 1, total: 3 } },
};

/**
 * Monte la VRAIE conversation.
 * @param {Record<string, unknown>} params - Les parametres de route.
 * @returns {{ arbre: any, navigation: any, props: any }} L arbre, la navigation, les props de
 *   GiftedChat.
 */
const monter = (params = {}) => {
  // eslint-disable-next-line global-require
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  // eslint-disable-next-line global-require
  const { createElement } = require('react');
  // eslint-disable-next-line global-require
  const Conversation = require('../Conversation').default;
  const clientRequetes = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  const navigation = {
    addListener: () => () => {}, goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn(),
  };
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client: clientRequetes },
      createElement(Conversation, {
        navigation,
        route: { params: { chatId: 'chat-1', ...params } },
      }),
    ));
  });
  aDemonter.push(() => {
    act(() => { arbre.unmount(); });
    clientRequetes.clear();
  });
  return { arbre, navigation, props: mockGiftedRenders[mockGiftedRenders.length - 1] };
};

const textes = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.props?.children === 'string')
  .map((/** @type {any} */ n) => n.props.children);

// MSG-SUPPORT — « qui a répondu », côté console (route réservée aux super-admins).
const mockRepondants = jest.fn(async () => ({
  'm-reponse': { firstname: 'Sophie', lastname: 'Admin' },
}));
jest.mock('@/services/chat/assistanceService', () => ({
  getBoiteAssistance: jest.fn(),
  getRepondantsAssistance: (/** @type {any[]} */ ...args) => mockRepondants(...args),
  ouvrirMaConversationAssistance: jest.fn(),
}));

const SUPER_ADMIN = {
  documentId: 'sophie', firstname: 'Sophie', role: { name: 'SuperAdmin', type: 'superadmin' },
};
const FIL_ASSISTANCE = {
  documentId: 'chat-1',
  participants: [{ documentId: 'lina', firstname: 'Lina', lastname: 'Moreau' }],
  type: 'assistance',
};
const PAGE_ASSISTANCE = {
  data: [
    {
      createdAt: '2026-10-20T15:05:00.000Z',
      documentId: 'm-reponse',
      message: 'Bonjour Lina, on a remis ton équipe.',
      sender: {
        avatar: null,
        documentId: 'assistance-foundclub',
        firstname: 'Assistance',
        lastname: 'FoundClub',
      },
      senderSignature: { nom: 'Assistance FoundClub', voix: 'assistance' },
      updatedAt: '2026-10-20T15:05:00.000Z',
    },
    {
      createdAt: '2026-10-20T15:00:00.000Z',
      documentId: 'm-demande',
      message: 'Bonjour, je ne vois plus mon équipe.',
      sender: { documentId: 'lina', firstname: 'Lina', lastname: 'Moreau' },
      updatedAt: '2026-10-20T15:00:00.000Z',
    },
  ],
  meta: { pagination: { page: 1, pageCount: 1, total: 2 } },
};

// GiftedChat range une bulle à droite quand l'identifiant de son auteur est le mien.
const CLE_DU_COTE = '_id';
const cote = (/** @type {any} */ message) => message.user[CLE_DU_COTE];
const parId = (/** @type {any} */ props) => Object.fromEntries(
  props.messages.map((/** @type {any} */ m) => [m.documentId, m]),
);

/**
 * Laisse se poser les lectures asynchrones (« qui a répondu »).
 * @returns {Promise<void>}
 */
const laisserSePoser = async () => {
  for (let tour = 0; tour < 10; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fin) => { setTimeout(fin, 0); }); });
  }
};

describe('MSG-SUPPORT — la conversation d\'assistance sur le téléphone', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockBoutons.length = 0;
    mockChatData = FIL_ASSISTANCE;
    mockMessagesPage = PAGE_ASSISTANCE;
    mockMessagesError = undefined;
    mockMembres = null;
    mockBlockedRows = [];
    mockUserData = { documentId: 'lina', firstname: 'Lina', role: { name: 'Joueur' } };
    mockSendMessage.mockClear();
    mockRepondants.mockClear();
  });

  afterEach(() => {
    while (aDemonter.length) aDemonter.pop()();
  });

  it('titulaire : « Assistance FoundClub », « L’équipe FoundClub te répond ici »', () => {
    const { arbre } = monter({ chatType: 'assistance' });
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Assistance FoundClub',
      'L’équipe FoundClub te répond ici',
    ]));
  });

  it('titulaire : la réponse est signée « Assistance FoundClub », jamais du nom de l’admin', () => {
    const { props } = monter({ chatType: 'assistance' });
    const messages = parId(props);
    expect(messages['m-reponse'].user.name).toBe('Assistance FoundClub');
    expect(cote(messages['m-reponse'])).not.toBe('lina');
    expect(cote(messages['m-demande'])).toBe('lina');
    expect(JSON.stringify(props.messages)).not.toContain('Sophie');
    expect(mockRepondants).not.toHaveBeenCalled();
  });

  it('titulaire mineur : la saisie est OUVERTE, l’envoi part dans SA conversation', () => {
    const { props } = monter({ chatType: 'assistance' });
    expect(props.renderInputToolbar).toBeDefined();
    act(() => { props.onSend([{ text: 'Merci !' }]); });
    expect(mockSendMessage).toHaveBeenCalledWith('chat-1', 'Merci !', expect.anything());
    expect(mockSendMessage.mock.calls[0][2]).not.toHaveProperty('senderSignature');
  });

  it('super-admin : le titulaire en titre ; l’équipe à DROITE, signée de qui', async () => {
    mockUserData = SUPER_ADMIN;
    const { arbre } = monter({ chatType: 'assistance' });
    await laisserSePoser();
    expect(textes(arbre)).toContain('Lina Moreau');
    expect(textes(arbre)).not.toContain('L’équipe FoundClub te répond ici');
    const messages = parId(mockGiftedRenders[mockGiftedRenders.length - 1]);
    expect(mockRepondants).toHaveBeenCalledWith('chat-1');
    expect(cote(messages['m-reponse'])).toBe('sophie');
    expect(messages['m-reponse'].user.name).toBe('Assistance FoundClub · Sophie A.');
    expect(cote(messages['m-demande'])).toBe('lina');
    expect(messages['m-demande'].user.name).toBe('Lina Moreau');
  });

  it('titulaire, conversation encore vide : elle invite à écrire et dit qui lit', () => {
    mockMessagesPage = { data: [], meta: { pagination: { page: 1, pageCount: 1, total: 0 } } };
    const { props } = monter({ chatType: 'assistance' });
    /** @type {any} */
    let vide;
    act(() => { vide = renderer.create(props.renderChatEmpty()); });
    expect(textes(vide)).toEqual(expect.arrayContaining([
      'Une question ? Écris-nous.',
      'Seule l’équipe FoundClub lit ici. Une notification t’annonce notre réponse.',
    ]));
    act(() => { vide.unmount(); });
  });

  it('un fil ordinaire ne change pas (aucune lecture de « qui a répondu »)', () => {
    mockChatData = {
      documentId: 'chat-1', groupName: 'Les U13', participants: [], type: 'group',
    };
    mockMessagesPage = PAGE;
    mockUserData = SUPER_ADMIN;
    const { arbre } = monter({});
    expect(textes(arbre)).not.toContain('Assistance FoundClub');
    expect(mockRepondants).not.toHaveBeenCalled();
  });
});
