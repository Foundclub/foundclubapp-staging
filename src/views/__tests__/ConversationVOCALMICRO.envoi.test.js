import renderer, { act } from 'react-test-renderer';

// VOCAL-MICRO — CE QUE LE VOCAL DIT DE SON MICRO, JUSQU'EN BASE (23/09).
//
// Le 23/09, on a dû DEVINER, depuis une onde en forme de sinus, que le micro
// d'Adel ne mesurait rien. Désormais chaque vocal emporte dans sa
// `composition` le diagnostic de sa prise : d'où vient l'onde (`metering` ou
// `fallback`), combien de niveaux le micro a transmis, quel démarrage a pris
// et pourquoi le premier a raté. Le serveur garde tels quels les champs de
// `composition` (`normalizeVoiceNoteComposition`, `...source`) : le prochain
// essai se LIRA en base au lieu de se deviner.
//
// ⛔ Comme VOCAL2, ce témoin monte le VRAI écran : il récupère la barre de
// saisie que GiftedChat reçoit, la zone vocale qu'elle porte, et appelle son
// `onSend` comme le ferait un doigt levé.

const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockBullesVocales = /** @type {any[]} */ ([]);
const mockZonesVocales = /** @type {any[]} */ ([]);
const mockEnvoyer = jest.fn(() => 'file-1');
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
    delete: jest.fn(),
    get: jest.fn(),
    // L'envoi du fichier : le serveur rend le fichier rangé.
    post: jest.fn(() => Promise.resolve({
      data: [{
        id: 7, mime: 'audio/mp4', size: 4096, url: '/uploads/voice-note.m4a',
      }],
    })),
    put: jest.fn(),
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
  deleteVoiceNoteFile: jest.fn(() => Promise.resolve()),
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
    isSocketConnected: true,
    joinChat: jest.fn(),
    leaveChat: jest.fn(),
    markMessagesAsRead: jest.fn(),
    retryMessage: jest.fn(),
    sendMessage: (/** @type {any[]} */ ...args) => mockEnvoyer(...args),
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
    data: { documentId: 'chat-1', participants: [], type: 'team' },
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
// 🎣 LE CAPTEUR : la zone vocale de la barre de saisie. On garde ce qu'elle reçoit.
jest.mock('@/components/organisms/voiceComposer/VoiceComposerZone', () => {
  const { createElement, Fragment } = jest.requireActual('react');
  const passe = (/** @type {any} */ { children }) => createElement(Fragment, null, children);
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => { mockZonesVocales.push(props); return null; },
    VoiceRestFade: passe,
    VoiceSendAppear: passe,
  };
});
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);
jest.mock('@/components/organisms/pollCreationModal/PollCreationModal', () => () => null);
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => () => null);
jest.mock('@/components/organisms/venueProposalModal/VenueProposalModal', () => () => null);

/**
 * Les demontages en attente, joues dans `afterEach` (jamais en fin de test :
 * un test qui echoue n'atteint pas sa derniere ligne).
 * @type {Array<() => void>}
 */
const aDemonter = [];

/**
 * Monte le vrai écran et rend le `onSend` que la zone vocale reçoit vraiment.
 * @returns {(brouillon: any) => Promise<boolean>} L'envoi d'un vocal.
 */
const envoiDuVocal = () => {
  // eslint-disable-next-line global-require
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  // eslint-disable-next-line global-require
  const { createElement } = require('react');
  // eslint-disable-next-line global-require
  const Conversation = require('../Conversation').default;

  // `gcTime: 0` : sans lui, react-query arme un ramasse-miettes de 5 minutes
  // qui survit a la suite (voir ConversationVOCAL2).
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
  /** @type {any} */
  let barre = null;
  act(() => {
    barre = renderer.create(createElement(
      QueryClientProvider,
      { client: clientRequetes },
      propsGifted.renderInputToolbar({ text: '' }),
    ));
  });

  aDemonter.push(() => {
    act(() => { barre.unmount(); });
    act(() => { ecran.unmount(); });
    clientRequetes.clear();
  });

  return mockZonesVocales[mockZonesVocales.length - 1].onSend;
};

/** Le brouillon que rend `stopRecording`, avec le diagnostic de sa prise. */
const BROUILLON = {
  diagnostics: {
    maxDb: -14,
    minDb: -44,
    rangeDb: 30,
    recorderStart: 'noIosMode',
    recorderStartError: 'Audio session setup failed: (OSStatus error 561017449.)',
    sampleCount: 40,
    waveformSource: 'metering',
  },
  durationMs: 2000,
  fileName: 'voice-note-1.m4a',
  levels: [0.1, 0.8],
  mime: 'audio/mp4',
  size: 4096,
  uri: 'file:///cache/voice-note-1.m4a',
  waveform: [4, 20, 12],
};

describe('VOCAL-MICRO — le vocal emporte le diagnostic de son micro jusqu\'en base', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockZonesVocales.length = 0;
    mockEnvoyer.mockClear();
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('le vocal envoyé porte son diagnostic : onde, niveaux, démarrage', async () => {
    const envoyer = envoiDuVocal();
    /** @type {any} */
    let resultat = null;
    await act(async () => { resultat = await envoyer(BROUILLON); });

    expect(resultat).toBe(true);
    expect(mockEnvoyer).toHaveBeenCalledTimes(1);
    const { composition } = /** @type {any} */ (mockEnvoyer.mock.calls[0])[2];
    expect(composition).toMatchObject({
      durationMs: 2000,
      type: 'voice_note',
      waveform: [4, 20, 12],
    });
    expect(composition.diagnostics).toEqual(BROUILLON.diagnostics);
  });

  test('un brouillon sans diagnostic part comme avant, sans champ vide', async () => {
    const envoyer = envoiDuVocal();
    const { diagnostics, ...sansDiagnostic } = BROUILLON;
    await act(async () => { await envoyer(sansDiagnostic); });

    const { composition } = /** @type {any} */ (mockEnvoyer.mock.calls[0])[2];
    expect(composition).not.toHaveProperty('diagnostics');
    expect(composition.type).toBe('voice_note');
  });
});
