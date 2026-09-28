import renderer, { act } from 'react-test-renderer';

// COLLAUDIT B5 - PAROLE, COTE APP : qui voit la barre de saisie ?
//
// TEMOIN DE CARACTERISATION (lot 0 AUDIT Collectivites, 2026-09-27).
// Il decrit le comportement ACTUEL de l'ecran natif `Conversation.js` et doit
// etre VERT. Il ne corrige rien.
//
// CE QUE LA COLLECTIVITE EXIGERA (SPEC_COLLECTIVITES_2026-09.md, section 2 F, D6) :
//   1. Canal de la collectivite : les membres le LISENT, seuls les
//      gestionnaires y ecrivent (quel que soit leur role de compte).
//   2. Canal des dirigeants : TOUT le monde y ecrit.
//
// LA COUTURE : on monte le VRAI ecran (doublures reprises de
// ConversationMSG1.test.js) et on appelle la prop `renderInputToolbar` que
// GiftedChat recoit reellement. Elle rend soit le bandeau
// « Canal d'annonce (lecture seule) » (Conversation.js:5845-5860), soit la
// barre de saisie (InputToolbar, Conversation.js:5895). Les vraies fonctions de
// role (`getUserRoleKey`, `getManagedMultisportIds`) sont gardees.

const mockGiftedRenders = /** @type {any[]} */ ([]);
/** @type {any} */
let mockChat = null;
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

// Sans cette doublure la SUITE ENTIERE meurt au CHARGEMENT : `client` lit
// `.env`, absent de toute copie de travail.
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
    hasClubAccess: () => false,
    userData: mockUtilisateur,
  }),
}));
// Les VRAIES regles de role : c'est elles que ce temoin caracterise.
jest.mock('@/domains/auth/authUseCases', () => {
  const vrai = jest.requireActual('@/domains/auth/authUseCases');
  return {
    ...vrai,
    getAuthTokens: () => Promise.resolve({ jwt: 'jwt' }),
  };
});
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
jest.mock('@/services/event/eventService', () => ({
  missingEvent: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({
    showBanner: () => 'banniere',
  }),
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
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatById: () => ({
    data: mockChat,
    isLoading: false,
  }),
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

const BANDEAU_LECTURE_SEULE = 'Canal d\'annonce (lecture seule)';

/**
 * Parcourt un arbre d'ELEMENTS React (non montes) et rend vrai si l'un d'eux
 * satisfait le critere.
 * @param {any} noeud - Un element, un tableau ou une feuille.
 * @param {(n: any) => boolean} critere - Le test.
 * @returns {boolean}
 */
const contient = (noeud, critere) => {
  if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return false;
  if (Array.isArray(noeud)) return noeud.some((enfant) => contient(enfant, critere));
  if (critere(noeud)) return true;
  if (typeof noeud === 'object' && noeud.props) return contient(noeud.props.children, critere);
  return false;
};

/**
 * Monte le vrai ecran, appelle la barre de saisie que GiftedChat recevrait,
 * puis demonte.
 * @returns {{ lectureSeule: boolean, barreDeSaisie: boolean }}
 */
const lireBarreDeSaisie = () => {
  // eslint-disable-next-line global-require
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  // eslint-disable-next-line global-require
  const { createElement } = require('react');
  // eslint-disable-next-line global-require
  const Conversation = require('../Conversation').default;
  const clientRequetes = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;
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
        route: { params: { chatId: mockChat.documentId } },
      }),
    ));
  });
  const props = mockGiftedRenders[mockGiftedRenders.length - 1];
  const barre = props.renderInputToolbar({ text: '' });
  act(() => { arbre.unmount(); });
  return {
    barreDeSaisie: contient(barre, (n) => typeof n === 'object' && typeof n.props?.renderComposer === 'function'),
    lectureSeule: contient(barre, (n) => n === BANDEAU_LECTURE_SEULE),
  };
};

const STRUCTURE = { documentId: 'ville-demo', name: 'Ville de Demo' };

beforeEach(() => {
  mockGiftedRenders.length = 0;
  mockChat = null;
  mockUtilisateur = null;
});

describe('COLLAUDIT B5 - la barre de saisie de Conversation.js', () => {
  it("AUJOURD'HUI : temoin de couture, un fil a deux (whisper) montre la barre de saisie", () => {
    mockUtilisateur = { documentId: 'moi', firstname: 'Adel', role: { name: 'Joueur', type: 'joueur' } };
    mockChat = {
      documentId: 'chat-whisper',
      participants: [{ documentId: 'moi' }, { documentId: 'autre' }],
      type: 'whisper',
    };

    expect(lireBarreDeSaisie()).toEqual({ barreDeSaisie: true, lectureSeule: false });
  });

  it("AUJOURD'HUI : un joueur voit le chat multisport en lecture seule (bandeau, pas de barre)", () => {
    mockUtilisateur = { documentId: 'moi', firstname: 'Adel', role: { name: 'Joueur', type: 'joueur' } };
    mockChat = {
      documentId: 'chat-ville',
      multisportClub: { ...STRUCTURE, admins: [{ documentId: 'gestionnaire' }] },
      participants: [],
      type: 'multisport',
    };

    expect(lireBarreDeSaisie()).toEqual({ barreDeSaisie: false, lectureSeule: true });
  });

  it("AUJOURD'HUI : un compte au role Dirigeant declare admin de la structure voit la barre de saisie", () => {
    mockUtilisateur = { documentId: 'moi', firstname: 'Adel', role: { name: 'Dirigeant', type: 'dirigeant' } };
    mockChat = {
      documentId: 'chat-ville',
      multisportClub: { ...STRUCTURE, admins: [{ documentId: 'moi' }] },
      participants: [],
      type: 'multisport',
    };

    expect(lireBarreDeSaisie()).toEqual({ barreDeSaisie: true, lectureSeule: false });
  });

  it("AUJOURD'HUI : un admin de la structure au role Entraineur reste en lecture seule dans l'app (le serveur, lui, l'accepterait)", () => {
    mockUtilisateur = {
      documentId: 'moi',
      firstname: 'Adel',
      multisportClubs: [{ documentId: 'ville-demo' }],
      role: { name: 'Entraineur', type: 'entraineur' },
    };
    mockChat = {
      documentId: 'chat-ville',
      multisportClub: { ...STRUCTURE, admins: [{ documentId: 'moi' }] },
      participants: [],
      type: 'multisport',
    };

    expect(lireBarreDeSaisie()).toEqual({ barreDeSaisie: false, lectureSeule: true });
  });

  it("AUJOURD'HUI : un groupe s'ouvre en lecture seule, meme pour son createur et administrateur", () => {
    mockUtilisateur = { documentId: 'moi', firstname: 'Adel', role: { name: 'Dirigeant', type: 'dirigeant' } };
    mockChat = {
      documentId: 'chat-groupe',
      groupAdmins: [{ documentId: 'moi' }],
      groupName: 'Dirigeants Ville de Demo',
      participants: [{ documentId: 'moi' }, { documentId: 'dirigeant-a' }, { documentId: 'dirigeant-b' }],
      type: 'group',
    };

    expect(lireBarreDeSaisie()).toEqual({ barreDeSaisie: false, lectureSeule: true });
  });
});
