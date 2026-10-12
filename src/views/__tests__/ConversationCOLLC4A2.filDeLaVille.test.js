import renderer, { act } from 'react-test-renderer';

// ============================================================================
// COLL-C4A2 (02/10/2026) — LES FILS DE LA VILLE DANS LA VRAIE CONVERSATION (design HY521H1
// page 3, P3c-canal-tel ecrans 1, 2, 5, 6 et 8). Le montage est celui du temoin BLOQUER
// (ConversationBLOQUER.menu.test.js), recopie a l identique : memes doublures.
//
// Ce que le temoin tient :
//   · le canal porte son titre, sa ligne « Vous et les dirigeants des 2 clubs », et le bouton
//     « Qui est dans ce canal » a la place du menu ⋮ ;
//   · chaque message dit qui ecrit ET pour quel club ; une ligne sans expediteur est une ligne
//     systeme (« … a rejoint le canal ») ;
//   · depuis l espace de la Ville, l envoi DEMANDE la voix de la Ville ; ailleurs, non ;
//   · un club detache lit « Tu ne fais plus partie de ce canal », et plus aucun message ;
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

const VILLE = { documentId: 'ville-1', name: 'Ville de Demo' };
const CANAL = {
  collectivite: VILLE, documentId: 'chat-1', participants: [], type: 'collectivite_dirigeants',
};
const REFUS = {
  response: { data: { error: { details: { code: 'COLLECTIVITE_CANAL_NOT_MEMBER' } } } },
};
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

describe('COLL-C4A2 — les fils de la Ville dans la conversation', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockBoutons.length = 0;
    mockChatData = CANAL;
    mockMessagesPage = PAGE;
    mockMessagesError = undefined;
    mockMembres = {
      chat: { documentId: 'chat-1', type: 'collectivite_dirigeants' }, clubsCount: 2, groupes: [],
    };
    mockBlockedRows = [];
    mockSendMessage.mockClear();
    mockRetry.mockClear();
  });

  afterEach(() => {
    while (aDemonter.length) aDemonter.pop()();
  });

  it('le canal : titre, « Vous et les dirigeants des 2 clubs », « Qui est dans ce canal »', () => {
    const { arbre, navigation } = monter({ espace: 'ville' });
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Dirigeants des clubs',
      'Vous et les dirigeants des 2 clubs',
    ]));
    const bouton = arbre.root.findByProps({ testID: 'fil-de-la-ville-membres' });
    expect(bouton.props.accessibilityLabel).toBe('Qui est dans ce canal');
    expect(textes(arbre)).not.toContain('\u22EE');
    act(() => { bouton.props.onPress(); });
    expect(navigation.navigate)
      .toHaveBeenCalledWith('CollectiviteCanalMembres', { chatId: 'chat-1', espace: 'ville' });
  });

  it('qui ecrit et pour quel club ; une ligne sans expediteur est une ligne systeme', () => {
    const { props } = monter({ espace: 'ville' });
    const parId = Object.fromEntries(
      props.messages.map((/** @type {any} */ m) => [m.documentId, m]),
    );
    expect(parId['m-karim'].user.name).toBe('Karim Benali · AS Ville A');
    expect(parId['m-ville'].user.name).toBe('Ville de Demo · Sophie L.');
    expect(parId['m-systeme'].system).toBe(true);
    expect(parId['m-karim'].system).toBeUndefined();
  });

  it('depuis l espace de la Ville, l envoi DEMANDE la voix de la Ville ; du club, non', () => {
    const ville = monter({ espace: 'ville' });
    act(() => { ville.props.onSend([{ text: 'Bonjour' }]); });
    expect(mockSendMessage).toHaveBeenCalledWith('chat-1', 'Bonjour', expect.objectContaining({
      senderSignature: { voix: 'ville' },
    }));
    mockSendMessage.mockClear();
    const club = monter({});
    act(() => { club.props.onSend([{ text: 'Salut' }]); });
    expect(mockSendMessage.mock.calls[0][2]).not.toHaveProperty('senderSignature');
  });

  it('un club detache lit « Tu ne fais plus partie de ce canal », et plus aucun message', () => {
    mockChatData = undefined;
    mockMessagesPage = { data: [], meta: { pagination: { page: 1, pageCount: 1, total: 0 } } };
    mockMessagesError = REFUS;
    const { arbre, navigation } = monter({ chatType: 'collectivite_dirigeants' });
    expect(arbre.root.findAllByProps({ testID: 'fil-de-la-ville-quitte' }).length)
      .toBeGreaterThan(0);
    expect(textes(arbre)).toContain('Tu ne fais plus partie de ce canal');
    expect(mockGiftedRenders).toHaveLength(0);
    const retour = mockBoutons.find((/** @type {any} */ b) => b.title === 'Retour à la messagerie');
    act(() => { retour.onPress(); });
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('un fil ordinaire ne change pas : menu ⋮, noms, aucune voix demandee', () => {
    mockChatData = {
      documentId: 'chat-1',
      participants: [{ documentId: 'moi' }, { documentId: 'lui' }],
      type: 'whisper',
    };
    mockMessagesPage = {
      data: [{ ...PAGE.data[1], senderSignature: undefined }],
      meta: { pagination: { page: 1, pageCount: 1, total: 1 } },
    };
    const { arbre, props } = monter({ espace: 'ville' });
    expect(arbre.root.findAllByProps({ testID: 'fil-de-la-ville-membres' })).toHaveLength(0);
    expect(props.messages[0].user.name).toBe('Karim Benali');
    act(() => { props.onSend([{ text: 'Coucou' }]); });
    expect(mockSendMessage.mock.calls[0][2]).not.toHaveProperty('senderSignature');
  });

  // COLL-C4A3 (03/10, planche 47) — l'en-tête porte l'icône ou l'écusson du fil (T9 : absent).
  it('COLL-C4A3 — en-tete : la tuile du canal ; conversation privee, l ecusson d en face', () => {
    /* eslint-disable global-require */
    const ClubLogoMark = require('@/components/molecules/clubLogoMark/ClubLogoMark').default;
    const { EcussonVille } = require('@/views/collectivite/components/BlocDeLaVille');
    const { IconeDuCanal } = require('@/views/collectivite/components/FilDeLaVille');
    /* eslint-enable global-require */
    const enTete = (/** @type {any} */ arbre) => arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'fil-de-la-ville-ecusson'
        && typeof n.type !== 'string',
    )[0];

    const canal = monter({ chatType: 'collectivite_dirigeants', espace: 'ville' });
    expect(enTete(canal.arbre).findAllByType(IconeDuCanal)).toHaveLength(1);

    mockChatData = {
      ...CANAL,
      collectiviteClub: { documentId: 'club-a', name: 'AS Ville A' },
      type: 'collectivite_club',
    };
    const cote = monter({ chatType: 'collectivite_club', espace: 'ville' });
    expect(enTete(cote.arbre).findByType(ClubLogoMark).props.club.name).toBe('AS Ville A');
    const club = monter({ chatType: 'collectivite_club' });
    expect(enTete(club.arbre).findByType(EcussonVille).props.nom).toBe('Ville de Demo');

    mockChatData = { documentId: 'chat-1', participants: [], type: 'whisper' };
    const ordinaire = monter({});
    expect(enTete(ordinaire.arbre).findAllByType(IconeDuCanal)).toHaveLength(0);
    expect(enTete(ordinaire.arbre).findAllByType(ClubLogoMark)).toHaveLength(0);
  });

  // COLL-C4A3 point 4 (« voix ok », Adel 02/10) — un message en ÉCHEC qu'on réessaie repart avec
  // la MÊME voix demandée : la Ville depuis l'espace de la Ville, aucune depuis le club. Avant le
  // lot, « Réessayer » renvoyait sans voix : un compte mixte écrivait alors au nom de son club.
  it('COLL-C4A3 — « Reessayer » redemande la meme voix : la Ville ; du club, aucune', () => {
    // eslint-disable-next-line global-require
    const { TouchableOpacity } = require('react-native');
    const echec = {
      _id: 'm-echec', createdAt: new Date(), failed: true, text: 'Bonjour', user: { _id: 'moi' },
    };
    const reessayer = (/** @type {Record<string, unknown>} */ params) => {
      const { props } = monter(params);
      /** @type {any} */
      let bulle;
      act(() => {
        bulle = renderer.create(props.renderBubble({ currentMessage: echec, position: 'right' }));
      });
      // Le bouton le plus INTERIEUR qui porte « Réessayer » (la bulle elle-même est touchable).
      const touchables = bulle.root.findAllByType(TouchableOpacity).reverse();
      const bouton = touchables.find((/** @type {any} */ n) => (
        typeof n.props.onPress === 'function'
        && n.findAll((/** @type {any} */ c) => c.props?.children === 'Réessayer').length > 0
      ));
      act(() => { bouton.props.onPress(); });
      act(() => { bulle.unmount(); });
    };

    reessayer({ espace: 'ville' });
    expect(mockRetry)
      .toHaveBeenLastCalledWith('chat-1', echec, { senderSignature: { voix: 'ville' } });
    reessayer({});
    expect(mockRetry).toHaveBeenCalledTimes(2);
    expect(mockRetry.mock.calls[1][2] || {}).not.toHaveProperty('senderSignature');
  });
});
