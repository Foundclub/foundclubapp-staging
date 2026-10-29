import renderer, { act } from 'react-test-renderer';

// MSG-MEDIA (29/10) — « Média » = photo OU vidéo dans la messagerie (demande d'Adel).
// Ce témoin monte le VRAI écran `Conversation.js` (mêmes doublures que MSGIMG) et vérifie :
// 1. la tuile de la feuille s'appelle « Médias » et ouvre la galerie en photo + vidéo ;
// 2. une vidéo de 42 s part avec son type et le texte « Vidéo · 0:42 » ;
// 3. une vidéo de 160 Mo est refusée AVANT l'envoi, avec un message en français (la durée,
//    elle, ne refuse rien : décision d'Adel du 29/10) ;
// 4. la bulle d'une vidéo est une tuile « Vidéo · 0:42 », et l'appui ouvre le lecteur.

const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockSheets = /** @type {any[]} */ ([]);
const mockBottomModals = /** @type {any[]} */ ([]);
const mockLecteurs = /** @type {any[]} */ ([]);
const mockLaunchCamera = jest.fn();
const mockLaunchImageLibrary = jest.fn();
const mockPost = jest.fn();
const mockShowBanner = jest.fn();
const mockSendMessage = jest.fn(() => 'opt-1');
let mockChatData;

// Le premier montage de l'écran entier prend jusqu'à 35 s à froid.
jest.setTimeout(60000);

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
    Day: VueRN,
    GiftedChat: (/** @type {any} */ props) => {
      mockGiftedRenders.push(props);
      return null;
    },
    InputToolbar: VueRN,
    MessageText: VueRN,
    Time: VueRN,
  };
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: (/** @type {any[]} */ ...args) => mockLaunchCamera(...args),
  launchImageLibrary: (/** @type {any[]} */ ...args) => mockLaunchImageLibrary(...args),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34,
    left: 0,
    right: 0,
    top: 47,
  }),
}));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    // La photo du fil porte un degrade en bas (`DegradeDePhoto`).
    Defs: VueRN,
    Line: VueRN,
    LinearGradient: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Stop: VueRN,
    Svg: VueRN,
  };
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() {
    return null;
  },
);

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: (/** @type {any[]} */ ...args) => mockPost(...args),
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
// La doublure qui se comporte comme l'app en français (interpolation comprise).
jest.mock('@/theme/strings', () => ({
  __esModule: true,
  default: jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next,
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
  cancelMatch: jest.fn(),
  createLeagueProposal: jest.fn(),
  respondToLeagueProposal: jest.fn(),
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
  useAppFeedback: () => ({ showBanner: mockShowBanner }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    getConversationName: () => 'Fil',
    joinChat: jest.fn(),
    leaveChat: jest.fn(),
    markMessagesAsRead: jest.fn(),
    retryMessage: jest.fn(),
    sendMessage: (/** @type {any[]} */ ...args) => mockSendMessage(...args),
    sendReadReceipt: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: jest.fn(),
    socket: { emit: jest.fn(), off: jest.fn(), on: jest.fn() },
    typingUsers: [],
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({ data: mockChatData, isLoading: false }),
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

jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => (/** @type {any} */ props) => {
    mockBottomModals.push(props);
    return props.children;
  },
);
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
jest.mock('@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet', () => (
  /** @type {any} */ props,
) => {
  mockSheets.push(props);
  return null;
});
jest.mock('@/components/molecules/videoMessage/VideoMessagePlayer', () => (
  /** @type {any} */ props,
) => {
  mockLecteurs.push(props);
  return null;
});
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);
jest.mock('@/components/organisms/pollCreationModal/PollCreationModal', () => () => null);
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => () => null);
jest.mock('@/components/organisms/venueProposalModal/VenueProposalModal', () => () => null);

/** @type {Array<() => void>} */
const aDemonter = [];

const TETE_A_TETE = {
  documentId: 'chat-1',
  participants: [
    { documentId: 'moi', firstname: 'Adel' },
    { documentId: 'karim', firstname: 'Karim' },
  ],
  type: 'whisper',
};

/**
 * Monte le VRAI ecran.
 * @returns {{ecran: any, gifted: any}} L'arbre rendu et les dernieres props de GiftedChat.
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
    ecran = renderer.create(
      createElement(
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
      ),
    );
  });

  aDemonter.push(() => {
    act(() => {
      ecran.unmount();
    });
    clientRequetes.clear();
  });

  return { ecran, gifted: mockGiftedRenders[mockGiftedRenders.length - 1] };
};

const ADRESSE_VIDEO = 'https://cdn.example.test/uploads/but_de_karim.mp4';

/** Une vidéo envoyée par Karim, au format GiftedChat. */
const VIDEO = {
  _id: 'v1',
  attachments: [{
    id: 9, mime: 'video/mp4', name: 'but_de_karim.mp4', url: ADRESSE_VIDEO,
  }],
  createdAt: new Date('2026-10-29T15:30:00'),
  documentId: 'v1',
  text: 'Vidéo · 0:42',
  user: { _id: 'karim', name: 'Karim Benali' },
};

/**
 * La feuille des pièces jointes, telle que l'écran l'a rendue en dernier.
 * @returns {any} Ses props.
 */
const derniereFeuille = () => mockSheets[mockSheets.length - 1];

/**
 * Appuie sur une tuile de la feuille, puis laisse la feuille se refermer (l'action part à la
 * fermeture, comme sur le téléphone).
 * @param {string} cle - La tuile.
 */
const appuyerSurLaTuile = async (cle) => {
  act(() => {
    derniereFeuille().onActionPress(cle);
  });
  const feuille = mockBottomModals.filter((props) => props.onDismissed).pop();
  await act(async () => {
    feuille.onDismissed();
  });
};

/**
 * Ce que les bandeaux ont affiché.
 * @returns {string} Tous leurs textes.
 */
const textesDesBandeaux = () => JSON.stringify(mockShowBanner.mock.calls);

describe('MSG-MEDIA — photo OU vidéo dans la messagerie', () => {
  const vraiFormData = global.FormData;
  beforeAll(() => {
    // Le FormData de React Native, réduit à ce que l'écran en fait : il retient les fichiers.
    global.FormData = /** @type {any} */ (class {
      constructor() {
        /** @type {any[]} */
        this.fichiers = [];
      }

      append(/** @type {string} */ _nom, /** @type {any} */ valeur) {
        this.fichiers.push(valeur);
      }
    });
  });
  afterAll(() => {
    global.FormData = vraiFormData;
  });

  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockSheets.length = 0;
    mockBottomModals.length = 0;
    mockLecteurs.length = 0;
    mockChatData = TETE_A_TETE;
    mockLaunchImageLibrary.mockReset();
    mockPost.mockReset();
    mockShowBanner.mockReset();
    mockSendMessage.mockClear();
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('1 — la tuile « Médias » ouvre la galerie en photo ET vidéo', async () => {
    mockLaunchImageLibrary.mockResolvedValue({ didCancel: true });
    monterLaConversation();
    const tuile = derniereFeuille().actions.find((/** @type {any} */ a) => a.key === 'photos');
    expect(tuile.label).toBe('Médias');

    await appuyerSurLaTuile('photos');

    expect(mockLaunchImageLibrary).toHaveBeenCalledTimes(1);
    expect(mockLaunchImageLibrary.mock.calls[0][0].mediaType).toBe('mixed');
  });

  test('2 — une vidéo de 42 s part avec son type et « Vidéo · 0:42 »', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{
        duration: 42.3,
        fileName: 'but.mp4',
        fileSize: 9000000,
        type: 'video/mp4',
        uri: 'file:///but.mp4',
      }],
    });
    mockPost.mockResolvedValue({
      data: [{
        id: 9, mime: 'video/mp4', name: 'but.mp4', url: '/uploads/but.mp4',
      }],
    });
    monterLaConversation();

    await appuyerSurLaTuile('photos');

    expect(mockPost).toHaveBeenCalledTimes(1);
    const formulaire = mockPost.mock.calls[0][1];
    expect(formulaire.fichiers.map((/** @type {any} */ f) => f.type)).toEqual(['video/mp4']);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const [fil, texte, extra] = /** @type {any} */ (mockSendMessage.mock.calls[0]);
    expect(fil).toBe('chat-1');
    expect(texte).toBe('Vidéo · 0:42');
    expect(extra.attachments[0].mime).toBe('video/mp4');
  });

  test('3 — une vidéo de 160 Mo est refusée avant l envoi, en français', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{
        duration: 75,
        fileName: 'lourde.mp4',
        fileSize: 160 * 1024 * 1024,
        type: 'video/mp4',
        uri: 'file:///long.mp4',
      }],
    });
    monterLaConversation();

    await appuyerSurLaTuile('photos');

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(textesDesBandeaux()).toContain('Vidéo trop lourde : 150 Mo maximum.');
  });

  test('4 — la bulle d une vidéo est une tuile « Vidéo · 0:42 » ; l appui ouvre le lecteur', () => {
    const { gifted } = monterLaConversation();
    /** @type {any} */
    let bulle;
    act(() => {
      bulle = renderer.create(gifted.renderBubble({ currentMessage: VIDEO, position: 'left' }));
    });
    aDemonter.push(() => act(() => bulle.unmount()));

    const tuile = bulle.root.findByProps({ testID: 'video-message-tile' });
    const libelle = bulle.root.findByProps({ testID: 'video-message-tile-label' });
    expect(libelle.props.children).toBe('Vidéo · 0:42');
    expect(mockLecteurs[mockLecteurs.length - 1].url).toBeFalsy();

    act(() => {
      tuile.props.onPress();
    });

    expect(mockLecteurs[mockLecteurs.length - 1].url).toBe(ADRESSE_VIDEO);
  });
});
