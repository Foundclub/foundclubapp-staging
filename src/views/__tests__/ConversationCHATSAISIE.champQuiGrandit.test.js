import { Platform, StyleSheet, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ✍️ CHAT-SAISIE (18/11, Adel D262) — « Il faut augmenter le champ quand on écrit, comme sur
// WhatsApp […] 5 de hauteur c'est bien, donc 5 lignes. » Sa capture (iPhone, fil d'assistance) :
// le champ reste à une ligne et demie (44 dp) et le texte tapé y est coupé.
//
// Cause lue dans React Native 0.81 (nouvelle architecture) : sur iPhone, `onContentSizeChange`
// ne part QUE de `updateLayoutMetrics` (RCTTextInputComponentView.mm:365), donc seulement quand
// la boîte du champ change de taille. Or le `Composer` de GiftedChat pose `height: composerHeight`
// en DERNIER : la boîte ne change jamais, l'événement ne part jamais, la hauteur reste au minimum.
// Sur Android l'événement part, mais le plafond par défaut est 200 dp (≈ 8 lignes).
//
// Le contrat : le champ prend sa hauteur NATURELLE, entre 44 dp (une ligne) et 5 lignes, puis
// défile en lui-même ; les boutons restent en bas de la rangée (comme WhatsApp).
//
// Le harnais (doublures, montage du VRAI écran) est celui de ConversationANDROIDBAR ; seule
// différence : le `Composer` de GiftedChat est répliqué, pour lire le style que reçoit le champ.

const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockChat = /** @type {any} */ ({ documentId: 'chat-1', participants: [], type: 'group' });
let mockInsets = {
  bottom: 34, left: 0, right: 0, top: 47,
};

jest.mock('react-native-gesture-handler', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').gestureHandler()
));
jest.mock('react-native-reanimated', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').reanimated()
));

// LA COUTURE : GiftedChat ne dessine rien, on lit les props qu'il reçoit à chaque rendu.
// Le `Composer` est la RÉPLIQUE de lib/Composer.js (2.8.1, non compilé par jest) : même ordre
// des styles — `textInputStyle`, PUIS `{ height: composerHeight }` — et `textInputProps` en
// dernier.
jest.mock('react-native-gifted-chat', () => {
  const { createElement } = jest.requireActual('react');
  const { TextInput: ChampRN, View: VueRN } = jest.requireActual('react-native');
  return {
    Bubble: VueRN,
    Composer: (/** @type {any} */ {
      composerHeight = 33, multiline = true, onTextChanged, text = '', textInputProps,
      textInputStyle,
    }) => createElement(ChampRN, {
      multiline,
      onChangeText: onTextChanged,
      style: [
        { fontSize: 16, lineHeight: 22, marginLeft: 10 },
        textInputStyle,
        { height: composerHeight },
      ],
      value: text,
      ...textInputProps,
    }),
    GiftedChat: (/** @type {any} */ props) => { mockGiftedRenders.push(props); return null; },
    InputToolbar: VueRN,
    Time: VueRN,
  };
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(), launchImageLibrary: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
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
// `client` lit `.env`, absent de toute copie de travail.
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
    userData: { documentId: 'moi', firstname: 'Adel', role: { name: 'Dirigeant' } },
  }),
}));
jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => Promise.resolve({ jwt: 'jwt' }),
  getManagedMultisportIds: () => new Set(),
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
    socket: { emit: jest.fn(), off: jest.fn(), on: jest.fn() },
    typingUsers: [],
  }),
}));
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({
    data: mockChat,
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
// Le VRAI thème, jamais un Proxy.
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

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = /** @type {PropertyDescriptor} */ (
  Object.getOwnPropertyDescriptor(Platform, 'Version')
);

/**
 * Joue un téléphone : système, version d'Android et barres système.
 * @param {'android' | 'ios'} systeme Le système joué.
 * @param {number | string} version `Platform.Version` (35 = Android 15).
 * @param {{ bottom: number, top: number }} barres Les insets que le système donne.
 * @returns {void}
 */
const jouerLeTelephone = (systeme, version, barres) => {
  Platform.OS = /** @type {any} */ (systeme);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
  mockInsets = {
    bottom: barres.bottom, left: 0, right: 0, top: barres.top,
  };
};

const aDemonter = /** @type {Array<() => void>} */ ([]);

afterEach(() => {
  while (aDemonter.length) {
    /** @type {() => void} */ (aDemonter.pop())();
  }
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
  mockGiftedRenders.length = 0;
});

/**
 * Les props du DERNIER rendu de GiftedChat.
 * @returns {any} Les props.
 */
const dernieresProps = () => mockGiftedRenders[mockGiftedRenders.length - 1];

/**
 * Monte le VRAI écran Conversation.
 * @returns {any} L'arbre monté.
 */
const monterConversation = () => {
  /* eslint-disable global-require */
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  const { createElement } = require('react');
  const Conversation = require('../Conversation').default;
  /* eslint-enable global-require */
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
        route: { params: { chatId: 'chat-1' } },
      }),
    ));
  });
  aDemonter.push(() => { act(() => { arbre.unmount(); }); });
  return arbre;
};

// Le VRAI thème : la hauteur d'une ligne du champ (Fonts.p1).
const LIGNE = jest.requireActual('@/theme/fonts').default(
  jest.requireActual('@/theme/colors').default(),
).p1.lineHeight;
// 5 lignes + la marge interne (8 en haut, 8 en bas) + le bord (1 + 1).
const CINQ_LIGNES = (5 * LIGNE) + 16 + 2;

/**
 * La rangée de saisie (InputToolbar) telle que l'écran la construit.
 * @returns {any} Le nœud qui porte `renderComposer`.
 */
const rangeeDeSaisie = () => {
  /** @type {any} */
  let barre;
  act(() => { barre = renderer.create(dernieresProps().renderInputToolbar({ text: '' })); });
  aDemonter.push(() => { act(() => { barre.unmount(); }); });
  return barre.root.find((/** @type {any} */ n) => typeof n.props?.renderComposer === 'function');
};

/**
 * Le style APLATI du vrai champ, pour une hauteur que GiftedChat croit savoir.
 * @param {number} hauteurDeGiftedChat Le `composerHeight` que GiftedChat transmet.
 * @param {string} texte Le texte du champ.
 * @returns {{ style: any, props: any }} Le style et les props du TextInput.
 */
const champ = (hauteurDeGiftedChat, texte) => {
  const saisie = rangeeDeSaisie();
  /** @type {any} */
  let rendu;
  act(() => {
    rendu = renderer.create(saisie.props.renderComposer({
      composerHeight: hauteurDeGiftedChat,
      onInputSizeChanged: () => {},
      onTextChanged: () => {},
      text: texte,
      textInputProps: {},
    }));
  });
  aDemonter.push(() => { act(() => { rendu.unmount(); }); });
  const entree = rendu.root.findByType(TextInput);
  return { props: entree.props, style: StyleSheet.flatten(entree.props.style) };
};

describe('CHAT-SAISIE — le champ des conversations grandit avec le texte, jusqu’à 5 lignes', () => {
  beforeEach(() => {
    jouerLeTelephone('ios', '18.0', { bottom: 34, top: 47 });
  });

  it.each([
    ['iPhone : GiftedChat reste au minimum (événement jamais reçu)', 33],
    ['Android : GiftedChat croit 8 lignes (200 dp, son plafond)', 200],
  ])('S1 — %s : la hauteur n\'est pas figée, elle suit le texte', (_cas, hauteur) => {
    monterConversation();

    const { style } = champ(hauteur, 'une ligne\ndeux\ntrois');

    expect(style.height == null).toBe(true);
  });

  it('S2 — une ligne au repos (44 dp), 5 lignes au plus', () => {
    monterConversation();

    const { style } = champ(33, '');

    expect(style.minHeight).toBe(44);
    expect(style.maxHeight).toBe(CINQ_LIGNES);
  });

  it('S3 — au-delà de 5 lignes, le champ défile en lui-même', () => {
    monterConversation();

    const huitLignes = Array.from({ length: 8 }, (_v, i) => `ligne ${i}`).join('\n');
    const { props, style } = champ(200, huitLignes);

    expect(props.multiline).toBe(true);
    expect(props.scrollEnabled).not.toBe(false);
    expect(style.maxHeight).toBe(CINQ_LIGNES);
  });

  it('S4 — après l\'envoi (texte vidé), le champ redescend : aucune hauteur héritée', () => {
    monterConversation();

    // L'envoi passe `false` à GiftedChat (FINITIONS12-COLL) : il ne remet PAS sa hauteur à zéro.
    const { style } = champ(CINQ_LIGNES, '');

    expect(style.height == null).toBe(true);
    expect(style.minHeight).toBe(44);
  });

  it('S5 — « + » et « Envoyer » restent en bas de la rangée quand le champ grandit', () => {
    monterConversation();

    expect(rangeeDeSaisie().props.primaryStyle.alignItems).toBe('flex-end');
  });
});
