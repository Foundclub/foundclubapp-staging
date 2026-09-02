import renderer, { act } from 'react-test-renderer';

// TRIO / POINT 3 — DANS LA MESSAGERIE, « ABSENT » NE FAISAIT RIEN.
//
// `Conversation.js` passait `onDecline={() => {}}` a la carte d'evenement du
// fil. Le bouton s'enfoncait, et il ne se passait RIEN : ni appel, ni message,
// ni changement a l'ecran. La preuve que c'est un oubli est dans le meme
// fichier — les bulles « proposition amicale » et « proposition de match »
// branchent le meme bouton, correctement, quarante lignes plus bas.
//
// ⛔ CE TEMOIN NE TESTE PAS UNE COPIE : il monte le VRAI ecran, recupere le
// `renderBubble` que GiftedChat recoit reellement, le fait rendre une bulle
// d'evenement, et appuie sur ce que la carte a recu. Si le fil est rebranche
// ailleurs, ce temoin suit ; s'il est debranche, il redevient rouge.

const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockBullesEvenement = /** @type {any[]} */ ([]);
const mockMissingEvent = jest.fn(() => Promise.resolve({}));
const mockRespondToEventRsvp = jest.fn(() => Promise.resolve({}));

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
jest.mock('@/components/molecules/eventMessageBubble/EventMessageBubble', () => (
  (/** @type {any} */ props) => { mockBullesEvenement.push(props); return null; }
));

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

/**
 * Les demontages en attente. ⛔ Ils sont joues dans `afterEach`, JAMAIS a la
 * main en fin de test : un test qui echoue n'atteint pas sa derniere ligne, et
 * l'arbre reste alors vivant avec ses minuteries — Jest sort en erreur
 * « environnement demoli », ce qui masque le vrai echec.
 * @type {Array<() => void>}
 */
const aDemonter = [];

/**
 * Monte le vrai ecran, fait rendre la bulle d'un evenement, et rend les props
 * que la carte a reellement recues.
 * @param {any} evenement - L'evenement porte par le message.
 * @returns {any} Les props de la carte.
 */
const bulleDeLEvenement = (evenement) => {
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
    currentMessage: { _id: 'msg-1', event: evenement, user: { _id: 'lui' } },
    nextMessage: {},
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

  return mockBullesEvenement[mockBullesEvenement.length - 1];
};

describe('messagerie — la carte d\'evenement d\'un fil', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockBullesEvenement.length = 0;
    mockMissingEvent.mockClear();
    mockRespondToEventRsvp.mockClear();
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('« Absent » appelle bien le refus, avec l\'evenement de la bulle', async () => {
    const props = bulleDeLEvenement({
      documentId: 'ev-1',
      name: 'Entrainement',
      type: { name: 'Entrainement' },
    });

    // `mutate()` n'appelle sa fonction qu'apres une micro-tache : sans ce
    // `await`, on mesurerait avant que l'appel soit parti.
    await act(async () => { props.onDecline(); });

    expect(mockMissingEvent).toHaveBeenCalledTimes(1);
    expect(mockMissingEvent).toHaveBeenCalledWith('ev-1');
  });

  test('une seance de stage passe par la porte des reponses, comme ses freres', async () => {
    // Meme regle que `EventListContent` et `ParticipantEventList` : une seance
    // d'un stage se repond par `rsvp`, tout le reste par `missing`.
    const props = bulleDeLEvenement({
      documentId: 'ev-2',
      eventFormat: 'stage_day',
      name: 'Jour 2',
      type: { name: 'Stage' },
    });

    await act(async () => { props.onDecline(); });

    expect(mockRespondToEventRsvp).toHaveBeenCalledWith('ev-2', 'absent');
    expect(mockMissingEvent).not.toHaveBeenCalled();
  });

  test('les deux autres boutons de la meme carte restent branches', () => {
    // Non-regression : `onJoin` et `onParticipate` etaient deja corrects, ce
    // sont eux qui prouvaient que `onDecline` etait un OUBLI, pas un choix.
    const props = bulleDeLEvenement({ documentId: 'ev-3', name: 'Match' });

    expect(typeof props.onJoin).toBe('function');
    expect(typeof props.onParticipate).toBe('function');
    expect(typeof props.onDecline).toBe('function');
  });
});
