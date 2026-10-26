import renderer, { act } from 'react-test-renderer';

// IPH09 — monte le vrai écran et ses callbacks pour vérifier les réponses
// événement, la fermeture des actions avant confirmation et le menu Ajouter.
// Le menu monte aussi le vrai BottomModal, avec les seules primitives natives
// doublées : ces contraintes de disposition ne prouvent pas le rendu iPhone.

const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockBullesEvenement = /** @type {any[]} */ ([]);
const mockDeleteMessage = jest.fn();
const mockBanner = jest.fn();
const mockPrompts = [];
const mockOverlays = [];
const mockSheets = [];
const mockMissingEvent = jest.fn(() => Promise.resolve({}));
const mockRespondToEventRsvp = jest.fn(() => Promise.resolve({}));

jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));
jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { SCREEN_LOCAL_PROMPTS: 'SCREEN_LOCAL_PROMPTS', STEADY_STATE: 'STEADY_STATE' },
  useStartupPhase: () => ({ phase: 'STEADY_STATE' }),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({ dismiss: jest.fn(), present: jest.fn() }));
      return React.createElement(View, { ...props, testID: 'iph09-sheet' }, props.children);
    }),
    BottomSheetScrollView: ({ children, ...props }) => React.createElement(View, { ...props, testID: 'iph09-scroll' }, children),
    BottomSheetView: View,
    useBottomSheetInternal: () => null, // CLAVREGLE : lu par BottomModal
  };
});

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
  // MSG1A — `onParticipate` lit le role (`resolveParticipationFlow`).
  USER_ROLES: { player: 'Joueur' },
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
  useAppFeedback: () => ({ showBanner: mockBanner }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    deleteMessage: mockDeleteMessage,
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
jest.mock('@/components/molecules/eventMessageBubble/EventMessageBubble', () => (
  (/** @type {any} */ props) => { mockBullesEvenement.push(props); return null; }
));

jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/atoms/errorWrapper/ErrorWrapper', () => () => null);
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (props) => { mockSheets.push(props); return null; });
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
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => (props) => { mockPrompts.push(props); return null; });
jest.mock('@/components/molecules/messageReactionOverlay/MessageReactionOverlay', () => (props) => { mockOverlays.push(props); return null; });
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

// ⏱️ MSG1A — le PREMIER cas charge tout l'ecran de conversation (plus de 7 000 lignes et la
// messagerie) dans son budget de temps : de 5,5 s (machine calme) a 28 s (deux autres lots en
// portes) mesures le 07/10, au-dela des 5 s par defaut. Meme regle que ConversationWebCOMPOCARTE
// et ConversationWebCOLLC4A3, avec la marge de la mesure la plus lente.
jest.setTimeout(60000);

const last = (items) => items[items.length - 1];
const futureEvent = (overrides = {}) => ({
  date: '2099-01-01T18:00:00Z',
  documentId: 'ev-complet',
  team: { documentId: 'equipe', players: [{ documentId: 'moi' }] },
  type: { name: 'Entrainement' },
  ...overrides,
});

describe('IPH09 — actions du vrai écran de conversation', () => {
  beforeEach(() => {
    [mockGiftedRenders, mockBullesEvenement, mockPrompts, mockOverlays, mockSheets]
      .forEach((items) => { items.splice(0); });
    jest.clearAllMocks();
    mockDeleteMessage.mockResolvedValue(undefined);
  });
  afterEach(() => {
    while (aDemonter.length) aDemonter.pop()();
  });

  test('la carte transmet au parent les données hydratées autorisées', async () => {
    const props = bulleDeLEvenement({ documentId: 'ev-complet', id: 71 });
    await act(async () => { await props.onParticipate(futureEvent()); });
    expect(mockRespondToEventRsvp).toHaveBeenCalledWith('ev-complet', 'present');
  });

  test('un participant déjà présent peut redevenir présent après son absence', async () => {
    const event = futureEvent({ participations: [{ documentId: 'moi' }] });
    const props = bulleDeLEvenement(event);
    await act(async () => { await props.onDecline(event); });
    expect(mockMissingEvent).toHaveBeenCalledWith('ev-complet');
    await act(async () => { await props.onParticipate(event); });
    expect(mockRespondToEventRsvp).toHaveBeenCalledWith('ev-complet', 'present');
  });

  test('un non-participant à un événement fermé reste refusé', async () => {
    const event = futureEvent({ sessionStatus: 'closed', team: { documentId: 'ailleurs' } });
    const props = bulleDeLEvenement(event);
    await act(async () => { await props.onParticipate(event); });
    expect(mockRespondToEventRsvp).not.toHaveBeenCalled();
    expect(mockBanner).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }));
  });

  const selectOwnMessage = () => {
    bulleDeLEvenement(futureEvent());
    act(() => last(mockGiftedRenders).onLongPress(null, {
      _id: 'message-propre', documentId: 'message-propre', text: 'Bonjour', user: { _id: 'moi' },
    }));
    expect(last(mockOverlays).visible).toBe(true);
    act(() => last(mockOverlays).onAction('delete'));
  };

  test('supprimer ferme le calque avant d’ouvrir la confirmation', () => {
    selectOwnMessage();
    expect(last(mockOverlays).visible).toBe(false);
    expect(last(mockPrompts).visible).toBe(true);
    expect(mockDeleteMessage).not.toHaveBeenCalled();
    act(() => last(mockPrompts).secondaryAction.onPress());
    expect(last(mockPrompts).visible).toBe(false);
    expect(last(mockOverlays).visible).toBe(false);
  });

  test.each(['success', 'error'])('après %s la suppression rend les touches', async (outcome) => {
    if (outcome === 'error') mockDeleteMessage.mockRejectedValue(new Error('refus'));
    selectOwnMessage();
    await act(async () => { await last(mockPrompts).primaryAction.onPress(); });
    expect(mockDeleteMessage).toHaveBeenCalledWith('message-propre');
    expect(last(mockPrompts).visible).toBe(false);
    expect(last(mockOverlays).visible).toBe(false);
    if (outcome === 'error') expect(mockBanner).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }));
    // Un autre appui long fonctionne après succès comme après refus.
    act(() => last(mockGiftedRenders).onLongPress(null, { _id: 'autre', user: { _id: 'moi' } }));
    expect(last(mockOverlays).visible).toBe(true);
  });

  // RECETTEWEB retour 5 (26/10, « réduis le panneau Ajouter ») : plus de 70 % fixes. La feuille se
  // dimensionne sur son contenu, titre compris (BottomModal le place dans la zone mesurée), bornée
  // par le plafond de la zone qui défile. Témoin de la règle : BottomModal.RECETTEWEB.enTeteMesure.
  test('Ajouter se dimensionne sur son contenu, bornée, et défile au-delà', () => {
    bulleDeLEvenement(futureEvent());
    const sheet = mockSheets.find((props) => props.onDismissed);
    // Monter le vrai composant avec les props que le vrai écran lui a passées.
    // Jest vérifie les contraintes, sans prétendre mesurer un rendu iPhone.
    const { createElement } = jest.requireActual('react');
    const { StyleSheet } = jest.requireActual('react-native');
    const BottomModal = jest.requireActual('@/components/molecules/bottomModal/BottomModal').default;
    let tree;
    act(() => {
      tree = renderer.create(createElement(BottomModal, { ...sheet, isVisible: true }));
    });
    aDemonter.push(() => { act(() => tree.unmount()); });
    expect(sheet.snapPoints).toBeUndefined();
    const scroll = tree.root.findAllByProps({ testID: 'iph09-scroll' }).pop();
    expect(StyleSheet.flatten(scroll.props.style).maxHeight).toBeGreaterThan(0);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBeGreaterThanOrEqual(34);
    expect(tree.root.findAllByProps({ testID: 'iph09-sheet' }).pop().props.topInset).toBeGreaterThanOrEqual(47);
    expect(scroll.findAll((node) => node.props.children === 'Ajouter').length).toBeGreaterThan(0);
    expect(sheet.keyboardBehavior).toBe('interactive');
  });
});
