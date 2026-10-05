import renderer, { act } from 'react-test-renderer';

// 🐞 FINITIONS15 point 6 (tournée T14, S03c) — LA CARTE « COMPOSITION PUBLIÉE » DU FIL GARDAIT
// « PAUL VEUILLET » (Hugo, compte 130, renommé le 29/09) dans les ANCIENNES cartes.
//
// FINITIONS13-STATS avait donné à la carte les participants du fil (`chatData.participants`) par
// ses PROPS, et son témoin montait la carte SEULE : vert. Mais dans l'écran, GiftedChat mémorise
// chaque bulle et ne la redessine que si l'objet message change (mémoire
// piege-giftedchat-memo-ignore-etat-externe). Les messages et la fiche du fil se lisent en
// parallèle : quand les messages arrivent les premiers, la carte est dessinée SANS participants,
// et l'arrivée de la fiche ne la redessine jamais. ⇒ ancien nom figé.
//
// Règle retenue (même règle que « bulle A », 29/09) : la carte s'abonne ELLE-MÊME à la lecture
// du fil, déjà faite par l'écran (aucune requête de plus). Quand la fiche arrive, elle se
// redessine, sans que GiftedChat ait à le décider.
//
// ⛔ CE TÉMOIN NE TESTE PAS UNE COPIE : il monte le VRAI écran (harnais du témoin TRIO), fait
// rendre UNE fois la bulle d'un message de composition, puis pose la fiche du fil dans le cache —
// sans redemander la bulle à l'écran, comme GiftedChat. ROUGE avant le lot.

const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockBullesCompo = /** @type {any[]} */ ([]);

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
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  // 🎯 LA COUTURE DU LOT : la VRAIE lecture react-query du fil. Elle n'arrive pas
  // tout de suite : le témoin la pose lui-même, APRÈS le premier dessin des bulles.
  useGetChatById: (/** @type {string} */ chatId, /** @type {any} */ options = {}) => (
    jest.requireActual('@tanstack/react-query').useQuery({
      enabled: Boolean(chatId) && options?.enabled !== false,
      queryFn: () => new Promise(() => {}),
      queryKey: ['chat', chatId],
    })
  ),
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
// 🎣 LE CAPTEUR : la carte « Composition publiée ». On garde ce qu'elle reçoit.
jest.mock(
  '@/components/molecules/compositionMessageBubble/CompositionMessageBubble',
  () => (/** @type {any} */ props) => { mockBullesCompo.push(props); return null; },
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

const HUGO = { documentId: 'compte-130', firstname: 'Hugo', lastname: 'Lemaire' };
const COMPOSITION = {
  eventId: 'match-3-oct',
  placements: [{ playerId: 'compte-130', x: 0.5, y: 0.5 }],
  schemaVersion: 3,
  snapshotPlayers: [{ documentId: 'compte-130', firstname: 'Paul', lastname: 'Veuillet' }],
  teamId: 'u15',
  type: 'lineup_share',
};

describe('FINITIONS15 point 6 — la carte de composition prend le nom du jour', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockBullesCompo.length = 0;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('la fiche du fil arrive APRÈS le dessin : la carte reçoit ses participants', async () => {
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

    // Premier (et seul) dessin de la bulle, comme GiftedChat : la fiche du fil n'est pas là.
    const propsGifted = mockGiftedRenders[mockGiftedRenders.length - 1];
    const bulle = propsGifted.renderBubble({
      currentMessage: { _id: 'msg-compo', composition: COMPOSITION, user: { _id: 'coach' } },
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
    aDemonter.push(() => {
      act(() => { arbreBulle.unmount(); });
      act(() => { ecran.unmount(); });
      clientRequetes.clear();
    });

    // La fiche du fil arrive : Hugo y porte son nom du jour. react-query prévient ses abonnés
    // au tour suivant (notifyManager) : on lui laisse ce tour.
    await act(async () => {
      clientRequetes.setQueryData(['chat', 'chat-1'], {
        documentId: 'chat-1',
        participants: [HUGO],
        type: 'team',
      });
      await new Promise((fini) => { setTimeout(fini, 20); });
    });

    const derniere = mockBullesCompo[mockBullesCompo.length - 1];
    expect(derniere.composition).toBe(COMPOSITION);
    expect(derniere.currentPeople).toEqual([HUGO]);
  });
});
