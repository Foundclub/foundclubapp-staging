import { DeviceEventEmitter, Platform, StyleSheet } from 'react-native';
import { GiftedChat } from 'react-native-gifted-chat';
import renderer, { act } from 'react-test-renderer';

// 🤖 ANDROIDBAR-1 — signalement d'un VRAI utilisateur (Android, Samsung, navigation à
// 3 boutons, 12/10/2026) : « la barre du bas m'empêche de toucher la zone de saisie, et
// quand j'y arrive je ne vois pas ce que je tape ». Cause prouvée à l'émulateur le 13/10
// (`.tmp/portes/ANDROIDBAR/DIAGNOSTIC.md`) :
// 1. la rangée de saisie avait 10 dp de marge basse FIXES sur Android, quelle que soit la
//    barre système (48 dp en 3 boutons, 24 en gestes) — or Android 15 et 16 dessinent
//    l'écran SOUS cette barre (bord à bord imposé) ;
// 2. le moteur de clavier de GiftedChat n'est pas dans l'app Android (react-native.config.js)
//    et `adjustResize` n'agit plus en bord à bord : clavier ouvert, RIEN ne remonte.
//
// Pourquoi aucun témoin ne l'a vu : les 20 fichiers `Conversation*.test.js` tournent en
// iPhone (marge `bottom: 34`) et aucun n'ouvre de clavier. Ici, on monte le VRAI écran en
// Android, avec les insets et les événements de clavier que le système envoie RÉELLEMENT
// (`ReactRootView.java`, `checkForKeyboardEvents`), mesurés sur le Pixel 9 de recette :
//   écran 2424 px / densité 2,625 = 923,43 dp ; haut du clavier 1541 px = 587,05 dp ;
//   ouverture : `endCoordinates.height` = ime.bottom − systemBars.bottom,
//               `screenY` = haut du clavier ;
//   fermeture : `screenY` = hauteur VISIBLE (écran − barre de navigation − barre d'état),
//               `height` 0.
// 🧨 C'est ce `screenY` de fermeture qui piège un KeyboardAvoidingView posé sur ce fil : le
//    banc du lot l'a mesuré, le corps restait rétréci de la hauteur de la barre d'état après
//    chaque fermeture du clavier — Android ≤ 14 compris. D'où le témoin « clavier refermé ».

const mockGiftedRenders = /** @type {any[]} */ ([]);
const FIL_ORDINAIRE = { documentId: 'chat-1', participants: [], type: 'group' };
// Un fil de club lu par un compte qui n'en est pas le président : la barre au cadenas.
const FIL_EN_LECTURE_SEULE = {
  club: { documentId: 'club-1', name: 'AS Marseille' },
  documentId: 'chat-1',
  participants: [],
  type: 'club',
};
let mockChat = /** @type {any} */ (FIL_ORDINAIRE);
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

// La géométrie du Pixel 9 de recette (`DIAGNOSTIC.md` §4 bis, mesures `dumpsys` du 13/10).
const ECRAN = 2424 / 2.625;
const HAUT_DU_CLAVIER = 1541 / 2.625;
const BARRE_D_ETAT = 24;

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
  // Le clavier de React Native retient son dernier état dans un singleton.
  act(() => { DeviceEventEmitter.emit('keyboardDidHide'); });
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
  mockGiftedRenders.length = 0;
  mockChat = FIL_ORDINAIRE;
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

/**
 * La marge basse de la RANGÉE DE SAISIE : le premier parent de `InputToolbar` qui en porte une.
 * @returns {number} La marge, en dp.
 */
const margeBasseDeLaSaisie = () => {
  /** @type {any} */
  let barre;
  act(() => { barre = renderer.create(dernieresProps().renderInputToolbar({ text: '' })); });
  aDemonter.push(() => { act(() => { barre.unmount(); }); });
  const saisie = barre.root.find(
    (/** @type {any} */ n) => typeof n.props?.renderComposer === 'function',
  );
  for (let noeud = saisie.parent; noeud; noeud = noeud.parent) {
    const marge = StyleSheet.flatten(noeud.props?.style)?.paddingBottom;
    if (typeof marge === 'number') return marge;
  }
  return 0;
};

/**
 * La marge basse de la barre « lecture seule » (au cadenas).
 * @returns {number} La marge, en dp.
 */
const margeBasseDeLaLectureSeule = () => {
  const barre = dernieresProps().renderInputToolbar({ text: '' });
  expect(barre.props.testID).toBe('conversation-lecture-seule');
  return StyleSheet.flatten(barre.props.style).paddingBottom;
};

/**
 * Ce que le CORPS du fil laisse libre en bas : la somme des marges basses des vues qui
 * contiennent GiftedChat (vues natives seulement, pour ne rien compter deux fois).
 * @param {any} arbre L'arbre monté.
 * @returns {number} La place libérée, en dp.
 */
const placeLibereeSousLeFil = (arbre) => {
  let total = 0;
  for (let noeud = arbre.root.findByType(GiftedChat).parent; noeud; noeud = noeud.parent) {
    if (typeof noeud.type === 'string') {
      total += StyleSheet.flatten(noeud.props?.style)?.paddingBottom || 0;
    }
  }
  return total;
};

/**
 * Ouvre le clavier comme Android le dit à React Native (`keyboardDidShow`).
 * @param {number} barreDuBas La barre système du bas (systemBars.bottom), en dp.
 * @returns {void}
 */
const ouvrirLeClavierAndroid = (barreDuBas) => {
  act(() => {
    DeviceEventEmitter.emit('keyboardDidShow', {
      duration: 0,
      easing: 'keyboard',
      endCoordinates: {
        height: ECRAN - HAUT_DU_CLAVIER - barreDuBas,
        screenX: 0,
        screenY: HAUT_DU_CLAVIER,
        width: 411,
      },
    });
  });
};

/**
 * Referme le clavier avec la VRAIE charge d'Android (`screenY` = hauteur visible).
 * @param {number} barreDuBas La barre système du bas, en dp.
 * @returns {void}
 */
const fermerLeClavierAndroid = (barreDuBas) => {
  act(() => {
    DeviceEventEmitter.emit('keyboardDidHide', {
      duration: 0,
      easing: 'keyboard',
      endCoordinates: {
        height: 0,
        screenX: 0,
        screenY: ECRAN - barreDuBas - BARRE_D_ETAT,
        width: 411,
      },
    });
  });
};

describe('ANDROIDBAR-1 — Android 15/16 (bord à bord) : saisie au-dessus barre et clavier', () => {
  it.each([
    ['3 boutons (le téléphone de l\'utilisateur)', 48],
    ['gestes (l\'émulateur de recette)', 24],
  ])('T1 — %s : la rangée de saisie garde au moins la barre système', (_cas, barreDuBas) => {
    jouerLeTelephone('android', 36, { bottom: barreDuBas, top: BARRE_D_ETAT });
    monterConversation();

    expect(margeBasseDeLaSaisie()).toBeGreaterThanOrEqual(barreDuBas);
  });

  it('T2 — la barre « lecture seule » garde ses 16 dp AU-DESSUS de la barre système', () => {
    jouerLeTelephone('android', 36, { bottom: 48, top: BARRE_D_ETAT });
    mockChat = FIL_EN_LECTURE_SEULE;
    monterConversation();

    expect(margeBasseDeLaLectureSeule()).toBeGreaterThanOrEqual(16 + 48);
  });

  it('T3 — clavier ouvert : le bas du champ tombe sur le haut du clavier, pas dessous', () => {
    jouerLeTelephone('android', 36, { bottom: 48, top: BARRE_D_ETAT });
    const arbre = monterConversation();

    ouvrirLeClavierAndroid(48);

    const basDuChamp = ECRAN - placeLibereeSousLeFil(arbre) - margeBasseDeLaSaisie();
    expect(basDuChamp).toBeLessThanOrEqual(HAUT_DU_CLAVIER + 0.5);
    // …et il ne s'envole pas : au plus 16 dp de vide entre le champ et le clavier.
    expect(basDuChamp).toBeGreaterThanOrEqual(HAUT_DU_CLAVIER - 16);
  });

  it('T3 bis — clavier REFERMÉ (vraie charge d\'Android) : plus aucun vide sous la saisie', () => {
    jouerLeTelephone('android', 36, { bottom: 48, top: BARRE_D_ETAT });
    const arbre = monterConversation();

    ouvrirLeClavierAndroid(48);
    fermerLeClavierAndroid(48);

    expect(placeLibereeSousLeFil(arbre)).toBe(0);
    expect(margeBasseDeLaSaisie()).toBe(48);
  });

  it('T3 ter — clavier DÉJÀ ouvert en arrivant sur le fil : la place est faite d\'emblée', () => {
    jouerLeTelephone('android', 36, { bottom: 48, top: BARRE_D_ETAT });
    ouvrirLeClavierAndroid(48);

    const arbre = monterConversation();

    expect(ECRAN - placeLibereeSousLeFil(arbre) - margeBasseDeLaSaisie())
      .toBeLessThanOrEqual(HAUT_DU_CLAVIER + 0.5);
  });

  it('T4 — le moteur de clavier de GiftedChat (absent du binaire Android) est neutralisé', () => {
    jouerLeTelephone('android', 36, { bottom: 48, top: BARRE_D_ETAT });
    monterConversation();

    expect(dernieresProps().isKeyboardInternallyHandled).toBe(false);
  });
});

describe('ANDROIDBAR-1 — non-régression : ce qui marchait ne bouge pas', () => {
  it('T5 — iPhone (bottom 34) : marges inchangées, rien d\'ajouté, moteur GiftedChat actif', () => {
    jouerLeTelephone('ios', '18.0', { bottom: 34, top: 47 });
    const arbre = monterConversation();

    expect(margeBasseDeLaSaisie()).toBe(34);
    expect(dernieresProps().isKeyboardInternallyHandled).not.toBe(false);
    act(() => {
      DeviceEventEmitter.emit('keyboardWillShow', {
        duration: 250,
        easing: 'keyboard',
        endCoordinates: {
          height: 336, screenX: 0, screenY: 596, width: 393,
        },
      });
    });
    expect(placeLibereeSousLeFil(arbre)).toBe(0);
  });

  it('T5 bis — iPhone : la barre « lecture seule » reste à 16 + 34', () => {
    jouerLeTelephone('ios', '18.0', { bottom: 34, top: 47 });
    mockChat = FIL_EN_LECTURE_SEULE;
    monterConversation();

    expect(margeBasseDeLaLectureSeule()).toBe(16 + 34);
  });

  it('T6 — Android ≤ 14 (bottom 0, adjustResize agit) : marge 10, clavier sans ajout', () => {
    jouerLeTelephone('android', 34, { bottom: 0, top: BARRE_D_ETAT });
    const arbre = monterConversation();

    expect(margeBasseDeLaSaisie()).toBe(10);
    ouvrirLeClavierAndroid(0);
    expect(placeLibereeSousLeFil(arbre)).toBe(0);
  });

  it('T6 bis — Android ≤ 14 : la barre « lecture seule » reste à 16 + 10', () => {
    jouerLeTelephone('android', 34, { bottom: 0, top: BARRE_D_ETAT });
    mockChat = FIL_EN_LECTURE_SEULE;
    monterConversation();

    expect(margeBasseDeLaLectureSeule()).toBe(16 + 10);
  });
});
