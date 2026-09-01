import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// PERF2 — LA PREMIERE OUVERTURE D UN FIL : des formes, plus une roue.
//
// 🧨 Le defaut (rapport capacite du 01/09) : pendant le premier chargement des
// messages, l ecran montrait une roue plein ecran + « Chargement des
// messages... ». Une roue ne montre RIEN de ce qui arrive.
//
// ⚖️ LA GARANTIE : la premiere ouverture montre la FORME d un fil (des bulles
// qui balayent, via WithDataWrapper), sans texte sous le squelette. Le fil
// charge, le squelette disparait ; en erreur, il ne s affiche jamais.
//
// 🔬 Meme couture que ConversationMSG1.test.js : on monte le VRAI ecran.
// ⚠️ La requete des messages est PILOTABLE — un mock a forme fixe rendrait ce
// temoin vert par construction (le piege des 4 lots EVEDIT).

const mockGiftedRenders = /** @type {any[]} */ ([]);
/** @type {any} */
let mockMessagesQuery;

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

// SkeletonLoader tire MaskedView / LinearGradient / Reanimated : hors sujet
// ici. Le mock rend les enfants et capture ses props — la preuve que le
// squelette est ENGAGE, pas un simple conteneur decoratif.
/** @type {any[]} */
const mockSkeletonProps = [];
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock(/** @type {any} */ props) {
    mockSkeletonProps.push(props);
    return props.children;
  },
);

// Sans cette doublure la SUITE ENTIERE meurt au CHARGEMENT : `client` lit
// `.env`, qui est gitignore donc absent de toute copie de travail.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [],
    hasClubAccess: true,
    userData: { documentId: 'moi', firstname: 'Adel', role: { name: 'Dirigeant' } },
  }),
}));
jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => Promise.resolve({ jwt: 'jwt' }),
  getManagedMultisportIds: () => [],
  getUserRoleKey: () => 'dirigeant',
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
  useGetChatById: () => ({
    data: { documentId: 'chat-1', participants: [], type: 'group' },
    isLoading: false,
  }),
  // ⚠️ PILOTABLE — c est tout l objet de ce temoin.
  useGetChatMessages: () => mockMessagesQuery,
}));

// Le VRAI theme, jamais un Proxy : un faux theme rend les echecs illisibles.
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
jest.mock('@/components/molecules/eventMessageBubble/EventMessageBubble', () => () => null);
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

/** @type {any} */
let arbre = null;

/**
 * Monte le vrai ecran Conversation avec l etat de requete messages donne.
 * @param {any} etat champs qui remplacent l etat de repos de la requete
 * @returns {string} tout le rendu, mis a plat
 */
const monter = (etat) => {
  mockMessagesQuery = {
    data: undefined,
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
    ...etat,
  };
  // eslint-disable-next-line global-require
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  // eslint-disable-next-line global-require
  const { createElement } = require('react');
  // eslint-disable-next-line global-require
  const Conversation = require('../Conversation').default;
  const clientRequetes = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    arbre = renderer.create(createElement(
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
  return JSON.stringify(arbre.toJSON());
};

afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
    arbre = null;
  }
  mockGiftedRenders.length = 0;
  mockSkeletonProps.length = 0;
  jest.clearAllMocks();
});

describe('PERF2 — la premiere ouverture montre des formes, plus une roue', () => {
  it('premier chargement : le squelette est la, ENGAGE, et la roue a disparu', () => {
    const rendu = monter({ isLoading: true });

    expect(arbre.root.findAllByProps({ testID: 'conversation-messages-skeleton' }).length)
      .toBeGreaterThan(0);
    expect(mockSkeletonProps.length).toBeGreaterThan(0);
    expect(mockSkeletonProps[0].isActive).toBe(true);
    // La roue et sa legende n existent plus sur ce chemin.
    expect(rendu).not.toContain('Chargement des messages');
  });

  it('premier chargement : AUCUN texte sous le squelette', () => {
    monter({ isLoading: true });

    // Piege SkeletonLoader (premier rendu, layout null) : les enfants rendent
    // NUS — du texte factice ferait un eclair de faux contenu.
    const [squelette] = arbre.root.findAllByProps({ testID: 'conversation-messages-skeleton' });
    expect(squelette.findAllByType(Text).length).toBe(0);
  });

  it('fil charge : plus aucun squelette, GiftedChat est monte', () => {
    monter({
      data: { pages: [{ data: [], meta: { pagination: { page: 1, pageCount: 1, total: 0 } } }] },
    });

    expect(arbre.root.findAllByProps({ testID: 'conversation-messages-skeleton' }).length).toBe(0);
    expect(mockGiftedRenders.length).toBeGreaterThan(0);
  });

  it('en erreur : le squelette ne s affiche JAMAIS par-dessus le pave d erreur', () => {
    monter({ error: new Error('reseau'), isError: true });

    expect(arbre.root.findAllByProps({ testID: 'conversation-messages-skeleton' }).length).toBe(0);
  });
});
