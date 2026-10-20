import renderer, { act } from 'react-test-renderer';

// MSGIMG — L'IMAGE OUVERTE EN GRAND DANS UNE CONVERSATION (constat d'Adel, 20/10/2026).
//
// « Quand on envoie une image, il faut que la croix en haut à gauche, elle soit toujours
// visible. […] sur une image blanche, vu que la croix elle est blanche, on ne voit pas la
// croix. […] il faut qu'on puisse swiper vers le bas, pour enlever l'image. Et il faut
// qu'on puisse l'enregistrer dans sa galerie. »
//
// Ce temoin monte le VRAI ecran `Conversation.js` (memes doublures que `ConversationMSG1A`),
// appuie sur la photo d'une bulle et interroge l'apercu plein ecran qui s'ouvre.
// CAR — caracterisation (E6) : ce que l'apercu faisait AVANT le lot, et qui doit tenir.

const mockGiftedRenders = /** @type {any[]} */ ([]);
let mockChatData;

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
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
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
  () => (/** @type {any} */ { children }) => children,
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
jest.mock('@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet', () => () => null);
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

const ADRESSE_DE_LA_PHOTO = 'https://cdn.example.test/uploads/photo-blanche.png';

/** Une photo envoyee par Karim, sans texte. */
const PHOTO = {
  _id: 'p1',
  createdAt: new Date('2026-10-20T15:30:00'),
  documentId: 'p1',
  image: ADRESSE_DE_LA_PHOTO,
  text: '',
  user: { _id: 'karim', name: 'Karim Benali' },
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

/**
 * Rend la bulle de la photo, puis appuie dessus : l'ecran ouvre son apercu.
 * @param {any} gifted Les props de GiftedChat.
 */
const ouvrirLaPhoto = (gifted) => {
  /** @type {any} */
  let bulle;
  act(() => {
    bulle = renderer.create(gifted.renderBubble({ currentMessage: PHOTO, position: 'left' }));
  });
  aDemonter.push(() => {
    act(() => {
      bulle.unmount();
    });
  });
  const vignette = bulle.root.find((/** @type {any} */ noeud) => (
    typeof noeud.type !== 'string'
    && noeud.props?.accessibilityRole === 'imagebutton'
    && typeof noeud.props?.onPress === 'function'
  ));
  act(() => {
    vignette.props.onPress();
  });
};

/**
 * L'image plein ecran de l'apercu (la seule Image de l'ecran qui montre la photo).
 * @param {any} ecran L'arbre de l'ecran.
 * @returns {any[]} Les images trouvees.
 */
const imagesPleinEcran = (ecran) => {
  // eslint-disable-next-line global-require
  const { Image } = require('react-native');
  return ecran.root.findAll((/** @type {any} */ noeud) => (
    noeud.type === Image && noeud.props?.source?.uri === ADRESSE_DE_LA_PHOTO
  ));
};

/**
 * La fenetre de l'apercu (le Modal qui contient l'image plein ecran).
 * @param {any} ecran L'arbre de l'ecran.
 * @returns {any} Le Modal.
 */
const fenetreDeLApercu = (ecran) => {
  // eslint-disable-next-line global-require
  const { Modal } = require('react-native');
  return ecran.root.findAll((/** @type {any} */ noeud) => noeud.type === Modal)
    .find((/** @type {any} */ modal) => modal.findAll((/** @type {any} */ noeud) => (
      noeud.props?.source?.uri === ADRESSE_DE_LA_PHOTO
    )).length > 0);
};

describe('MSGIMG — CAR : ce que l apercu d une photo faisait avant le lot', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockChatData = TETE_A_TETE;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('CAR-1 — appuyer sur la photo ouvre l apercu plein ecran de CETTE image', () => {
    const { ecran, gifted } = monterLaConversation();
    expect(imagesPleinEcran(ecran)).toHaveLength(0);

    ouvrirLaPhoto(gifted);

    const images = imagesPleinEcran(ecran);
    expect(images).toHaveLength(1);
    expect(images[0].props.resizeMode).toBe('contain');
  });

  test('CAR-2 — le bouton retour d Android (onRequestClose) referme l apercu', () => {
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);
    const fenetre = fenetreDeLApercu(ecran);
    expect(fenetre).toBeTruthy();

    act(() => {
      fenetre.props.onRequestClose();
    });

    expect(imagesPleinEcran(ecran)).toHaveLength(0);
  });
});
