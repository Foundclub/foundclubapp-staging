import renderer, { act } from 'react-test-renderer';

// MESSAGERIE-1C — LES POINTS D'ACCROCHE DE LA CONVOCATION DANS LE FIL D'EQUIPE.
//
// Trois portes, et une seule regle pour les trois (« convoquer entraineurs », Adel, 07/10 :
// l'entraineur de l'equipe ou le super-admin, la regle serveur `is-event-trainer`) :
//   · l'entree « Convocation » de la feuille « + » ;
//   · « Modifier » / le terrain sur la carte d'une convocation publiee ;
//   · « Modifier la composition » a l'appui long sur cette carte.
// Un joueur ne voit aucune des trois.
//
// ⛔ CE TEMOIN MONTE LE VRAI ECRAN (harnais du temoin FIN15) ; seuls l'assistant, la carte et
// le menu d'appui long sont doubles, pour lire ce que l'ecran leur passe.

const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockFeuilles = /** @type {any[]} */ ([]);
const mockModales = /** @type {any[]} */ ([]);
const mockAssistants = /** @type {any[]} */ ([]);
const mockCartes = /** @type {any[]} */ ([]);
const mockMenus = /** @type {any[]} */ ([]);
/** @type {any} */
let mockUtilisateur = null;

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

// `.env` est gitignore, donc absent de toute copie de travail : sans ces doublures c'est la
// SUITE ENTIERE qui meurt au chargement.
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
    userData: mockUtilisateur,
  }),
}));
jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => Promise.resolve({ jwt: 'jwt' }),
  getManagedMultisportIds: () => [],
  getUserRoleKey: (/** @type {string} */ role) => (
    String(role || '').toLowerCase().includes('super') ? 'superAdmin' : 'player'
  ),
}));
jest.mock('@/theme/strings', () => ({
  __esModule: true,
  default: {
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {},
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
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

const FIL_EQUIPE = {
  documentId: 'chat-1',
  participants: [],
  team: { documentId: 'u15', name: 'U15' },
  type: 'team',
};

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({ data: FIL_EQUIPE }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({
    data: { pages: [{ data: [], meta: { pagination: { page: 1, pageCount: 1, total: 0 } } }] },
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
// La feuille du bas : on garde ses props (dont `onDismissed`) et on rend son contenu.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (/** @type {any} */ props) => {
  mockModales.push(props);
  return props.children || null;
});
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
jest.mock(
  '@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet',
  () => (/** @type {any} */ props) => { mockFeuilles.push(props); return null; },
);
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);
jest.mock('@/components/organisms/pollCreationModal/PollCreationModal', () => () => null);
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => () => null);
jest.mock('@/components/organisms/venueProposalModal/VenueProposalModal', () => () => null);
jest.mock(
  '@/components/molecules/messageReactionOverlay/MessageReactionOverlay',
  () => (/** @type {any} */ props) => { mockMenus.push(props); return null; },
);
// 🎣 LES CAPTEURS DU LOT : l'assistant et la carte de convocation.
jest.mock('@/views/conversationConvocation/ConvocationWizard', () => ({
  __esModule: true,
  default: (/** @type {any} */ props) => { mockAssistants.push(props); return null; },
}));
jest.mock(
  '@/views/conversationConvocation/ConvocationLineupMessage',
  () => (/** @type {any} */ props) => { mockCartes.push(props); return null; },
);

/** @type {Array<() => void>} */
const aDemonter = [];

const COMPOSITION = {
  eventDisplayName: 'Match vs US Pelican',
  eventId: 'match-samedi',
  publishedVersion: 2,
  schemaVersion: 3,
  snapshotPlayers: [],
  teamId: 'u15',
  type: 'lineup_share',
};
const MESSAGE_COMPO = {
  _id: 'msg-compo', composition: COMPOSITION, user: { _id: 'coach' },
};

const ENTRAINEUR = {
  documentId: 'coach',
  firstname: 'Coach',
  role: { name: 'Entraineur' },
  trainedTeams: [{ documentId: 'u15' }],
};
const JOUEUR = {
  documentId: 'hugo', firstname: 'Hugo', role: { name: 'Joueur' }, trainedTeams: [],
};

/**
 * Monte le vrai fil d'equipe.
 * @returns {any}
 */
const monterLeFil = () => {
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
  return { clientRequetes, ecran };
};

/**
 * Fait dessiner la carte d'une convocation publiee, comme GiftedChat.
 * @param {any} clientRequetes
 * @returns {void}
 */
const dessinerLaCarte = (clientRequetes) => {
  // eslint-disable-next-line global-require
  const { QueryClientProvider } = require('@tanstack/react-query');
  // eslint-disable-next-line global-require
  const { createElement } = require('react');
  const propsGifted = mockGiftedRenders[mockGiftedRenders.length - 1];
  const bulle = propsGifted.renderBubble({
    currentMessage: MESSAGE_COMPO, nextMessage: {}, position: 'left', previousMessage: {},
  });
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(createElement(QueryClientProvider, { client: clientRequetes }, bulle));
  });
  aDemonter.push(() => { act(() => { arbre.unmount(); }); });
};

const derniereFeuille = () => mockFeuilles[mockFeuilles.length - 1];
const dernierAssistant = () => mockAssistants[mockAssistants.length - 1];

beforeEach(() => {
  mockGiftedRenders.length = 0;
  mockFeuilles.length = 0;
  mockModales.length = 0;
  mockAssistants.length = 0;
  mockCartes.length = 0;
  mockMenus.length = 0;
});

afterEach(() => {
  while (aDemonter.length) {
    /** @type {any} */ (aDemonter.pop())();
  }
});

describe('MESSAGERIE-1C · l entree « Convocation » de la feuille « + »', () => {
  test('un joueur ne la voit pas', () => {
    mockUtilisateur = JOUEUR;
    monterLeFil();
    expect(derniereFeuille().actions.map((/** @type {any} */ a) => a.key))
      .not.toContain('convocation');
    expect(mockAssistants).toHaveLength(0);
  });

  test('l entraineur de l equipe la voit, et elle ouvre l assistant de creation', () => {
    mockUtilisateur = ENTRAINEUR;
    monterLeFil();
    const entree = derniereFeuille().actions
      .find((/** @type {any} */ a) => a.key === 'convocation');
    expect(entree).toMatchObject({ key: 'convocation', label: 'Convocation' });

    act(() => { derniereFeuille().onActionPress('convocation'); });
    // L'action part quand la feuille a fini de se fermer (comme les 7 autres entrees).
    const feuilleDuPlus = mockModales.filter((m) => typeof m.onDismissed === 'function').pop();
    act(() => { feuilleDuPlus.onDismissed(); });

    expect(dernierAssistant()).toMatchObject({
      chatId: 'chat-1', mode: 'create', teamId: 'u15', visible: true,
    });
    act(() => { dernierAssistant().onClose(); });
    expect(mockAssistants.length).toBeGreaterThan(0);
  });
});

describe('MESSAGERIE-1C · « Modifier » sur la carte d une convocation publiee', () => {
  test('l entraineur : la carte recoit `onEdit`, qui ouvre l assistant en modification', () => {
    mockUtilisateur = ENTRAINEUR;
    const { clientRequetes } = monterLeFil();
    dessinerLaCarte(clientRequetes);
    const carte = mockCartes[mockCartes.length - 1];
    expect(carte.composition).toBe(COMPOSITION);
    expect(typeof carte.onEdit).toBe('function');

    act(() => { carte.onEdit({ composition: COMPOSITION, startStep: 3 }); });
    expect(dernierAssistant()).toMatchObject({
      initialEventId: 'match-samedi', mode: 'edit', startStep: 3, teamId: 'u15', visible: true,
    });
  });

  test('un joueur : la carte ne recoit pas `onEdit` (lecture seule, comme avant)', () => {
    mockUtilisateur = JOUEUR;
    const { clientRequetes } = monterLeFil();
    dessinerLaCarte(clientRequetes);
    expect(mockCartes[mockCartes.length - 1].onEdit).toBeUndefined();
  });
});

describe('MESSAGERIE-1C · appui long « Modifier la composition »', () => {
  test('l entraineur : l action est proposee et ouvre l assistant aux Joueurs', () => {
    mockUtilisateur = ENTRAINEUR;
    monterLeFil();
    const propsGifted = mockGiftedRenders[mockGiftedRenders.length - 1];
    act(() => { propsGifted.onLongPress(null, MESSAGE_COMPO); });
    const menu = mockMenus[mockMenus.length - 1];
    expect(menu.canEditComposition).toBe(true);

    act(() => { menu.onAction('editComposition'); });
    expect(dernierAssistant()).toMatchObject({
      initialEventId: 'match-samedi', mode: 'edit', startStep: 2,
    });
  });

  test('un joueur : l action n est pas proposee', () => {
    mockUtilisateur = JOUEUR;
    monterLeFil();
    const propsGifted = mockGiftedRenders[mockGiftedRenders.length - 1];
    act(() => { propsGifted.onLongPress(null, MESSAGE_COMPO); });
    expect(mockMenus[mockMenus.length - 1].canEditComposition).toBe(false);
  });
});
