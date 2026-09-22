import renderer, { act } from 'react-test-renderer';

import {
  abonnes,
  emettreDuServeur,
  reinitialiserSocketDeTest,
} from '@/testSupport/msgliveSocketDouble';

// MSGLIVE — LE FILET D'ABORD (E6), SUR « UNTEL EST EN TRAIN D'ÉCRIRE ».
//
// Demande d'Adel (22/09) : « voir quand quelqu'un est en train d'écrire, comme
// dans les messageries, avec les trois petits points ».
//
// ✅ CE QUI EXISTAIT DÉJÀ, ET QU'ON NE RÉÉCRIT PAS : le fil téléphonique en
// entier. Le serveur diffuse `typing-started` / `typing-stopped`
// (admin/src/socket/index.ts:427 et :451), l'écran s'y abonne
// (Conversation.js:1453) et tient un ensemble `typingUsers`. Le témoin n°1
// PROUVE ce tuyau : si un jour quelqu'un le coupe, c'est lui qui rougira.
//
// 🎯 CE QUI MANQUAIT, et que ce fichier attrape :
//   · LA FORME. L'écran affichait une ligne de texte nue en pied de liste.
//     Adel demande la bulle à trois points des messageries connues.
//   · LE PLUS GRAVE, et personne ne l'avait vu : L'INDICATEUR NE S'ÉTEIGNAIT
//     JAMAIS TOUT SEUL. `typing-stop` n'est émis QUE si l'autre vide son champ
//     ou envoie (Conversation.js:1497-1506). Quelqu'un qui tape trois lettres
//     puis pose son téléphone laissait un « … » allumé CHEZ MOI, pour toujours.
//     C'est un mensonge affiché à l'écran — c'est le témoin n°4.
//
// 🧵 LA COUTURE : le pied de liste est une PROP de GiftedChat (`renderFooter`,
// Conversation.js:6595). La doublure ci-dessous le RENVOIE dans l'arbre monté,
// exactement comme GiftedChat le ferait. Ce qu'on lit ici est donc ce qui
// s'affiche — pas une copie de la logique.

const mockGiftedRenders = /** @type {any[]} */ ([]);

jest.mock('react-native-gesture-handler', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return { Swipeable: VueRN };
});

// La doublure RENVOIE le pied de liste : c'est lui qu'on mesure.
jest.mock('react-native-gifted-chat', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    Bubble: VueRN,
    Composer: VueRN,
    GiftedChat: (/** @type {any} */ props) => {
      mockGiftedRenders.push(props);
      return typeof props.renderFooter === 'function' ? props.renderFooter() : null;
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
    __esModule: true, default: VueRN, Path: VueRN, Rect: VueRN,
  };
});
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

// Sans cette doublure la SUITE ENTIÈRE meurt au CHARGEMENT : `client` lit
// `.env`, qui est gitignoré donc absent de toute copie de travail.
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

// I18N — cette doublure-ci sait faire le PLURIEL et l'interpolation. Sans ça,
// « Marc Durand écrit… » sortirait comme la clef nue et le témoin ne
// prouverait RIEN du nom réellement affiché.
jest.mock('@/theme/strings', () => ({
  __esModule: true,
  default: {
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const options = (repli && typeof repli === 'object') ? repli : (valeurs || {});
      const compte = Number(options?.count);
      let modele = typeof repli === 'string' ? repli : '';
      if (!modele && options) {
        if (Number.isFinite(compte) && compte <= 1 && options.defaultValue_one) {
          modele = String(options.defaultValue_one);
        } else if (options.defaultValue_other) {
          modele = String(options.defaultValue_other);
        } else if (options.defaultValue) {
          modele = String(options.defaultValue);
        }
      }
      if (!modele) return cle;
      return modele.replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ trouve, /** @type {string} */ nom) => (
          options && options[nom] !== undefined ? String(options[nom]) : trouve
        ),
      );
    },
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
    data: {
      documentId: 'chat-1',
      participants: [
        { documentId: 'moi', firstname: 'Adel', lastname: 'F' },
        { documentId: 'marc', firstname: 'Marc', lastname: 'Durand' },
        { documentId: 'lea', firstname: 'Lea', lastname: 'Petit' },
      ],
      type: 'group',
    },
    isLoading: false,
  }),
  useGetChatMessageReactions: () => ({ data: { data: [] }, isLoading: false }),
  useGetChatMessages: () => ({
    data: { pages: [{ data: [], meta: { pagination: { page: 1, pageCount: 1, total: 0 } } }] },
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetching: false,
    isLoading: false,
  }),
}));

// Le VRAI thème, jamais un Proxy : un faux thème rend les échecs Jest illisibles.
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
  const clientRequetes = creerQueryClientDeTest();
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
  return { arbre };
};

/**
 * Tout ce qui est réellement rendu, en texte, pour y chercher un nom.
 * @param {any} arbre - Arbre monté.
 * @returns {string} Le rendu sérialisé.
 */
const renduComplet = (arbre) => JSON.stringify(arbre.toJSON() || {});

/**
 * Les nœuds RÉELLEMENT rendus qui portent un testID donné.
 *
 * ⚠️ Le filtre `typeof type === 'string'` n'est pas un détail : sans lui,
 * `findAll` compte DEUX fois chaque élément — le composant React (`View`,
 * `Animated.View`) ET le nœud natif qu'il rend, tous deux porteurs du même
 * testID. On compterait six points là où l'écran en affiche trois.
 * @param {any} arbre - Arbre monté.
 * @param {string} testID - Identifiant cherché.
 * @returns {any[]} Les nœuds natifs trouvés.
 */
const noeuds = (arbre, testID) => arbre.root.findAll(
  (/** @type {any} */ noeud) => noeud.props?.testID === testID && typeof noeud.type === 'string',
  { deep: true },
);

describe('MSGLIVE — « untel est en train d\'écrire » dans une conversation', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    reinitialiserSocketDeTest();
  });

  it('1. LE TUYAU EXISTE DÉJÀ : l\'écran s\'abonne aux deux événements de frappe', () => {
    monterConversation();

    expect(abonnes.get('typing-started')?.length).toBeGreaterThan(0);
    expect(abonnes.get('typing-stopped')?.length).toBeGreaterThan(0);
  });

  it('2. LA FORME : « typing-started » ouvre la bulle à TROIS points, avec le nom', () => {
    const { arbre } = monterConversation();

    // Avant : personne n'écrit, rien au pied de la liste.
    expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(0);

    emettreDuServeur('typing-started', { chatDocumentId: 'chat-1', userDocumentId: 'marc' });

    // La bulle est là…
    expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(1);
    // …avec EXACTEMENT trois points…
    expect(noeuds(arbre, 'conversation-typing-dot')).toHaveLength(3);
    // …et le texte RESTE. L'animation ne doit jamais être le seul signal :
    // quelqu'un qui a coupé les animations doit lire la même chose.
    expect(renduComplet(arbre)).toContain('Marc Durand');
  });

  it('3. « typing-stopped » éteint la bulle', () => {
    const { arbre } = monterConversation();

    emettreDuServeur('typing-started', { chatDocumentId: 'chat-1', userDocumentId: 'marc' });
    expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(1);

    emettreDuServeur('typing-stopped', { chatDocumentId: 'chat-1', userDocumentId: 'marc' });
    expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(0);
  });

  it('4. LE MENSONGE QUI DURE : sans nouvelles, la bulle s\'éteint TOUTE SEULE', () => {
    // Marc tape trois lettres, puis pose son téléphone. Il n'a rien envoyé et
    // n'a pas vidé son champ : son téléphone n'émettra JAMAIS « typing-stop ».
    // Avant ce lot, « Marc Durand écrit… » restait affiché indéfiniment.
    jest.useFakeTimers();
    try {
      const { arbre } = monterConversation();

      emettreDuServeur('typing-started', { chatDocumentId: 'chat-1', userDocumentId: 'marc' });
      expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(1);

      act(() => { jest.advanceTimersByTime(8000); });

      expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('5. TANT QUE L\'AUTRE TAPE, la bulle RESTE allumée', () => {
    // Le garde-fou du témoin n°4 : la minuterie ne doit pas éteindre quelqu'un
    // qui écrit vraiment. Le téléphone de l'autre re-signale sa frappe au plus
    // une fois par seconde (TYPING_START_THROTTLE_MS) ; chaque signal doit
    // remettre la minuterie à zéro.
    jest.useFakeTimers();
    try {
      const { arbre } = monterConversation();

      emettreDuServeur('typing-started', { chatDocumentId: 'chat-1', userDocumentId: 'marc' });
      for (let tour = 0; tour < 6; tour += 1) {
        act(() => { jest.advanceTimersByTime(2000); });
        emettreDuServeur('typing-started', { chatDocumentId: 'chat-1', userDocumentId: 'marc' });
      }

      expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('6. UN AUTRE FIL N\'ALLUME PAS CELUI-CI, et moi non plus', () => {
    const { arbre } = monterConversation();

    emettreDuServeur('typing-started', { chatDocumentId: 'autre-fil', userDocumentId: 'marc' });
    expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(0);

    emettreDuServeur('typing-started', { chatDocumentId: 'chat-1', userDocumentId: 'moi' });
    expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(0);
  });

  it('7. À PLUSIEURS : deux personnes qui écrivent donnent UNE bulle et le pluriel', () => {
    const { arbre } = monterConversation();

    emettreDuServeur('typing-started', { chatDocumentId: 'chat-1', userDocumentId: 'marc' });
    emettreDuServeur('typing-started', { chatDocumentId: 'chat-1', userDocumentId: 'lea' });

    expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(1);
    expect(noeuds(arbre, 'conversation-typing-dot')).toHaveLength(3);
    const rendu = renduComplet(arbre);
    expect(rendu).toContain('Marc Durand');
    expect(rendu).toContain('Lea Petit');
    expect(rendu).toContain('écrivent');
  });
});
