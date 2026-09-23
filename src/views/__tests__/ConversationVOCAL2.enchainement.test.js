import renderer, { act } from 'react-test-renderer';

// VOCAL2 — L'ENCHAÎNEMENT DES VOCAUX, CÔTÉ ÉCRAN (décision d'Adel, 23/09 ~17h50).
//
// À la fin d'un vocal, le suivant NON ÉCOUTÉ du même fil démarre tout seul.
// C'est l'écran qui sait qui SUIT (la liste des messages) : il le dit à chaque
// bulle vocale par `nextVoiceMessageId`. Règle choisie : on n'enchaîne que sur
// le message IMMÉDIATEMENT en dessous, s'il est un vocal reçu — un texte, une
// photo ou un de mes vocaux entre les deux arrête la chaîne.
//
// ⛔ Comme TRIO, ce témoin monte le VRAI écran, récupère le `renderBubble` que
// GiftedChat reçoit réellement, et lit les propriétés que la bulle reçoit.

const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockBullesVocales = /** @type {any[]} */ ([]);
const mockMissingEvent = jest.fn(() => Promise.resolve({}));
const mockRespondToEventRsvp = jest.fn(() => Promise.resolve({}));

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

// `.env` est gitignore, donc absent de toute copie de travail : sans ces
// doublures c'est la SUITE ENTIERE qui meurt au chargement.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

// 🎯 LA COUTURE DU LOT : ce sont ces deux appels-la que « Absent » doit
// atteindre. Ils vivent dans le service que `useEventAnswerMutations` appelle,
// le meme hook que les deux autres ecrans qui repondent depuis une carte.
jest.mock('@/services/event/eventService', () => ({
  missingEvent: (/** @type {any[]} */ ...args) => mockMissingEvent(...args),
  respondToEventRsvp: (/** @type {any[]} */ ...args) => mockRespondToEventRsvp(...args),
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

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  // MSGREACT — les reactions emoji du fil. Aucune par defaut : les temoins de
  // cet ecran ne parlent pas de reactions, et une rangee vide ne se dessine pas.
  useGetChatById: () => ({
    data: { documentId: 'chat-1', participants: [], type: 'group' },
    isLoading: false,
  }),
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

// 🎣 LE CAPTEUR : la carte d'evenement du fil. On garde ce qu'elle recoit.
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
jest.mock('@/components/molecules/pollMessageBubble/PollMessageBubble', () => () => null);
jest.mock('@/components/molecules/proposalMessageBubble/ProposalMessageBubble', () => () => null);
jest.mock('@/components/molecules/voiceNoteBubble/VoiceNoteBubble', () => (
  (/** @type {any} */ props) => { mockBullesVocales.push(props); return null; }
));
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => () => null,
);
jest.mock('@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet', () => () => null);
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);
jest.mock('@/components/organisms/pollCreationModal/PollCreationModal', () => () => null);
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => () => null);
jest.mock('@/components/organisms/venueProposalModal/VenueProposalModal', () => () => null);

/**
 * Les demontages en attente. ⛔ Ils sont joues dans `afterEach`, JAMAIS a la
 * main en fin de test : un test qui echoue n'atteint pas sa derniere ligne, et
 * l'arbre reste alors vivant avec ses minuteries — Jest sort en erreur
 * « environnement demoli », ce qui masque le vrai echec.
 * @type {Array<() => void>}
 */
const aDemonter = [];

/**
 * Monte le vrai écran, fait rendre la bulle d'un vocal, et rend les props que
 * la bulle a réellement reçues.
 * @param {any} suivant - Le message juste en dessous (plus récent), ou {}.
 * @returns {any} Les props de la bulle vocale.
 */
const bulleVocale = (suivant) => {
  // eslint-disable-next-line global-require
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  // eslint-disable-next-line global-require
  const { createElement } = require('react');
  // eslint-disable-next-line global-require
  const Conversation = require('../Conversation').default;

  // 🧨 `gcTime: 0` N'EST PAS COSMETIQUE. Au demontage, react-query arme un
  // ramasse-miettes de 5 MINUTES par mutation (`Mutation.scheduleGc`) : ce
  // minuteur survit a la suite et Jest ne s'eteint plus — code de sortie 1 en
  // CI, SANS un seul test rouge. Mesure avec `--detectOpenHandles`.
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

  const propsGifted = mockGiftedRenders[mockGiftedRenders.length - 1];
  const bulle = propsGifted.renderBubble({
    currentMessage: {
      _id: 'vocal-1',
      composition: { durationMs: 8000, type: 'voice_note', waveform: [4, 20] },
      documentId: 'vocal-1',
      user: { _id: 'lui', name: 'Karim' },
    },
    nextMessage: suivant,
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

  // Demonter les DEUX arbres, dans l'ordre inverse du montage.
  aDemonter.push(() => {
    act(() => { arbreBulle.unmount(); });
    act(() => { ecran.unmount(); });
    clientRequetes.clear();
  });

  return mockBullesVocales[mockBullesVocales.length - 1];
};

const vocal = (/** @type {string} */ id, /** @type {string} */ auteur) => ({
  _id: id,
  composition: { durationMs: 5000, type: 'voice_note', waveform: [4, 12] },
  documentId: id,
  user: { _id: auteur },
});

describe('VOCAL2 — l\'écran dit à chaque vocal lequel enchaîner', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockBullesVocales.length = 0;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('le message juste en dessous est un vocal REÇU : il est désigné pour enchaîner', () => {
    expect(bulleVocale(vocal('vocal-2', 'lui')).nextVoiceMessageId).toBe('vocal-2');
  });

  test('un TEXTE s\'intercale : la chaîne s\'arrête là', () => {
    const texte = {
      _id: 'txt-1', documentId: 'txt-1', text: 'ok', user: { _id: 'lui' },
    };
    expect(bulleVocale(texte).nextVoiceMessageId).toBe('');
  });

  test('le suivant est UN DE MES vocaux : on n\'enchaîne pas sur soi', () => {
    expect(bulleVocale(vocal('vocal-3', 'moi')).nextVoiceMessageId).toBe('');
  });

  test('dernier message du fil : rien à enchaîner', () => {
    expect(bulleVocale({}).nextVoiceMessageId).toBe('');
  });
});
