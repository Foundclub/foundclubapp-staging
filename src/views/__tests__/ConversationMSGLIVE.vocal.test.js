import renderer, { act } from 'react-test-renderer';

// MSGLIVE — LE VOCAL : « le son qui bouge », et surtout QUI NE COÛTE PAS CHER.
//
// Demande d'Adel (22/09) : « l'animation du vocal plus fluide, avec le son qui
// bouge ». Avant de toucher quoi que ce soit, il fallait mesurer DEUX choses.
//
// 📏 CE QUI A ÉTÉ MESURÉ, et c'est le chiffre qui explique la mollesse :
// le micro rend compte TOUTES LES 100 ms — dix fois par seconde, pas plus
// (voiceNoteService.js, `setSubscriptionDuration(0.1)`). Et chacun de ces dix
// comptes rendus par seconde redessinait DEUX FOIS l'écran de conversation, qui
// fait 7 400 lignes :
//   · une fois pour le CHRONOMÈTRE (`onProgress`), alors que le libellé
//     n'affiche que des secondes entières : neuf rendus sur dix pour afficher
//     exactement le même « 00:03 » ;
//   · une fois pour les BARRES (`onMetering`), dont le frein réglé à 80 ms ne
//     freinait rien puisque le micro ne parle que toutes les 100 ms.
// ⇒ une vingtaine de rendus complets par seconde, pour une animation qui ne
// peut de toute façon pas dépasser dix images par seconde.
//
// 🧵 LA COUTURE (VOCAL, 23/09) : le micro est posé par la zone vocale
// (`VoiceComposerZone`) que `renderInputToolbar` monte autour de la barre. Son
// geste passe par Gesture Handler, dont la doublure partagée
// (`testSupport/animationDouble`) RETIENT les rappels : on joue `onBegin` puis
// `onStart` comme un doigt qui reste 200 ms. Le service vocal est doublé : c'est
// lui qui nous rend le rappel `onMetering`, et on lui joue les niveaux qu'on veut.

const mockGiftedRenders = /** @type {any[]} */ ([]);
/** Ce que l'écran a passé à `startRecording` : c'est notre prise sur le micro. */
const mockRappelsDuMicro = /** @type {any[]} */ ([]);

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

// 🧵 LA DOUBLURE MONTE LA BARRE DE SAISIE, et c'est indispensable ici : c'est
// elle qui porte le bloc du vocal, donc les barres de niveau ET la poignée par
// laquelle l'écran leur pousse le son. Sans ça, les barres ne seraient jamais
// montées, la poignée resterait vide, et on mesurerait un écran qui ne fait
// rien — le plus beau des faux verts.
jest.mock('react-native-gifted-chat', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    Bubble: VueRN,
    Composer: VueRN,
    GiftedChat: (/** @type {any} */ props) => {
      mockGiftedRenders.push(props);
      return typeof props.renderInputToolbar === 'function'
        ? props.renderInputToolbar({ text: '' })
        : null;
    },
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

// LE MICRO DE DOUBLURE. `isVoiceNoteRecordingSupported` rend VRAI, sinon
// l'écran n'affiche même pas le bouton, et `startRecording` retient les
// rappels : c'est par eux qu'on jouera les niveaux sonores.
jest.mock('@/services/chat/voiceNoteService', () => ({
  cancelRecording: jest.fn(() => Promise.resolve()),
  deleteVoiceNoteFile: jest.fn(() => Promise.resolve()),
  isVoiceNoteRecordingSupported: () => true,
  startRecording: (/** @type {any} */ params) => {
    mockRappelsDuMicro.push(params);
    return Promise.resolve({ filePath: '/tmp/vocal.m4a' });
  },
  stopRecording: jest.fn(() => Promise.resolve({
    durationMs: 1000,
    fileName: 'v.m4a',
    mime: 'audio/m4a',
    size: 1,
    uri: '/tmp/v.m4a',
    waveform: [],
  })),
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
  useAppFeedback: () => ({ showBanner: () => 'banniere' }),
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
    // eslint-disable-next-line global-require
    socket: require('@/testSupport/msgliveSocketDouble').socketDeTest,
    typingUsers: [],
  }),
}));
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({
    // Un fil d EQUIPE : c est le cas ou l on peut ecrire. Sur un fil de type
    // « group », `canWrite` est faux et la barre de saisie passe en lecture
    // seule — il n y aurait ni micro ni barres a mesurer.
    data: { documentId: 'chat-1', participants: [], type: 'team' },
    isLoading: false,
  }),
  // MSGREACT — les reactions emoji du fil. Aucune par defaut : les temoins de
  // cet ecran ne parlent pas de reactions, et une rangee vide ne se dessine pas.
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

/**
 * Monte le vrai écran Conversation.
 * @returns {{ arbre: any }} L'arbre monté.
 */
const monterConversation = () => {
  // eslint-disable-next-line global-require
  const { QueryClientProvider } = require('@tanstack/react-query');
  // eslint-disable-next-line global-require
  const { createElement } = require('react');

  // eslint-disable-next-line global-require
  const { creerQueryClientDeTest } = require('@/testSupport/queryClientDeTest');
  // eslint-disable-next-line global-require
  const Conversation = require('../Conversation').default;
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client: creerQueryClientDeTest() },
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
  return { arbre };
};

/**
 * Le geste d'appui du micro, tel que la zone vocale l'a donné à Gesture Handler.
 * @param {any} arbre - L'arbre monté.
 * @returns {any} Le geste `Pan` (appui long), avec ses rappels enregistrés.
 */
const gesteDuMicro = (arbre) => {
  const detecteur = arbre.root.find(
    (/** @type {any} */ noeud) => noeud.props?.testID === 'gesture-detector'
      && typeof noeud.type === 'string',
  );
  return detecteur.props.gesture.gestes.find((/** @type {any} */ g) => g.type === 'Pan');
};

/**
 * Pose le doigt sur le micro et le garde 200 ms, comme Gesture Handler le
 * raconterait : `onBegin` au toucher, `onStart` quand l'appui long est acquis.
 * @param {any} arbre - L'arbre monté.
 * @returns {Promise<any>} Le geste, pour la suite.
 */
const maintenirLeMicro = async (arbre) => {
  const appui = gesteDuMicro(arbre);
  await act(async () => { appui.rappels.onBegin(); });
  await act(async () => { appui.rappels.onStart(); });
  return appui;
};

/**
 * Joue une suite de niveaux sonores, comme le micro le ferait.
 *
 * ⚠️ UN `act()` PAR COMPTE RENDU DU MICRO : React regroupe tout ce qui se
 * passe dans un même `act()` en UN SEUL rendu — jouer cent niveaux d'un coup
 * mesurerait « 1 rendu ». Sur un téléphone, chaque compte rendu arrive dans
 * son propre tour de boucle.
 * @param {number[]} niveaux - Les niveaux, en décibels (-160 à 0).
 * @param {number} [pasMs] - L'écart entre deux comptes rendus (50 ms : le rythme du micro).
 * @returns {void}
 */
const jouerLeSon = (niveaux, pasMs = 50) => {
  const rappels = mockRappelsDuMicro[mockRappelsDuMicro.length - 1];
  niveaux.forEach((niveau, rang) => {
    const dureeMs = (rang + 1) * pasMs;
    act(() => { rappels.onProgress?.(dureeMs); });
    act(() => { rappels.onMetering?.(niveau, dureeMs); });
  });
};

// ⏱️ MSG1A — le PREMIER cas charge tout l'ecran de conversation (plus de 7 000 lignes et la
// messagerie) dans son budget de temps : de 5,5 s (machine calme) a 28 s (deux autres lots en
// portes) mesures le 07/10, au-dela des 5 s par defaut. Meme regle que ConversationWebCOMPOCARTE
// et ConversationWebCOLLC4A3, avec la marge de la mesure la plus lente.
jest.setTimeout(60000);

describe('MSGLIVE — le vocal : le son bouge, et il ne coûte pas cher', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockRappelsDuMicro.length = 0;
  });

  it('1. LE MICRO EST BRANCHÉ : poser le doigt dessus ouvre le micro et demande le niveau sonore', async () => {
    const { arbre } = monterConversation();
    await maintenirLeMicro(arbre);

    expect(mockRappelsDuMicro).toHaveLength(1);
    // Ces deux rappels-là sont tout le sujet : l'un donne le temps, l'autre le
    // niveau sonore. S'ils disparaissaient, l'affichage ne bougerait plus.
    expect(typeof mockRappelsDuMicro[0].onMetering).toBe('function');
    expect(typeof mockRappelsDuMicro[0].onProgress).toBe('function');
  });

  it('3. LE PRIX DU VOCAL : 5 secondes d\'enregistrement ne redessinent plus l\'écran', async () => {
    // 📏 HISTORIQUE DE CE CHIFFRE. Avant MSGLIVE (22/09) : 105 rendus complets
    // de l'écran de conversation — 7 400 lignes — pour CINQ SECONDES de vocal.
    // Après MSGLIVE : 6 (plafond posé à 10). Après VOCAL (23/09) : le micro,
    // ses niveaux, son chronomètre et ses animations vivent dans la zone
    // vocale (`VoiceComposerZone`) — l'écran ne sait même plus qu'un vocal est
    // en cours. Mesuré : 0 rendu. Le plafond est resserré à 2 (cliquet dans le
    // bon sens) : une marge pour un état légitime, jamais un rendu par niveau.
    const { arbre } = monterConversation();
    await maintenirLeMicro(arbre);
    const avant = mockGiftedRenders.length;

    jouerLeSon(Array.from({ length: 100 }, (_, rang) => -100 + ((rang % 10) * 8)));

    const rendus = mockGiftedRenders.length - avant;
    expect(rendus).toBeLessThanOrEqual(2);
  });
});
