import renderer, { act } from 'react-test-renderer';

// MSG1A — LE FIL DE MESSAGERIE, MODELE WHATSAPP (pack d'Adel du 07/10).
//
// Ce temoin monte le VRAI ecran `Conversation.js` (memes doublures que
// `ConversationCONVAVERT`) et interroge ce que GiftedChat recoit vraiment :
// `renderInputToolbar`, `renderBubble`, `renderDay`... Chaque section du pack
// qui touche la logique du fil y pose son controle, AVANT d'etre restylee (E6).
//
// 🐛 G1 — UN GROUPE ETAIT UN « CANAL D'ANNONCE ». `canWrite` listait les fils
// ou tout le monde ecrit (tete-a-tete, equipe, League, amical) et OUBLIAIT
// `group` : tout groupe cree depuis « Nouvelle discussion » s'affichait
// « Canal d'annonce (lecture seule) » sur le telephone, alors que le serveur
// accepte les messages (`chat-message.ts` ne restreint pas les groupes).
// 🔴 ROUGE avant MSG1A : G1-1. 🟢 G1-2 tient la porte d'un vrai canal fermee.

const mockGiftedRenders = /** @type {any[]} */ ([]);
let mockChatData;
let mockMessagesPage;

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

jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: jest.fn() }),
  useGetMyBlockedUsers: () => ({ data: [], refetch: jest.fn() }),
  useUnblockUser: () => ({ isPending: false, mutate: jest.fn() }),
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
  useGetChatById: () => ({ data: mockChatData, isLoading: false }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({
    data: { pages: [mockMessagesPage] },
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

const PAGE_VIDE = { data: [], meta: { pagination: { page: 1, pageCount: 1, total: 0 } } };

const LECTURE_SEULE = 'Canal d\'annonce (lecture seule)';

const FIL_DE_GROUPE = {
  documentId: 'chat-1',
  groupAdmins: [{ documentId: 'lui' }],
  groupName: 'Les copains',
  participants: [{ documentId: 'moi' }, { documentId: 'lui' }, { documentId: 'toi' }],
  type: 'group',
};

const FIL_DE_CLUB = {
  club: { documentId: 'club-1', name: 'AS Marseille' },
  documentId: 'chat-1',
  participants: [{ documentId: 'moi' }, { documentId: 'lui' }],
  type: 'club',
};

/**
 * Monte le VRAI écran.
 * @returns {{ecran: any, gifted: any}} L'arbre rendu et les dernières props de GiftedChat.
 */
const monterLaConversation = () => {
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

  aDemonter.push(() => {
    act(() => { ecran.unmount(); });
    clientRequetes.clear();
  });

  return { ecran, gifted: mockGiftedRenders[mockGiftedRenders.length - 1] };
};

/**
 * Cherche un texte dans un ELEMENT React, sans le rendre : on descend dans les
 * `children` tels que l'ecran les a construits.
 * @param {any} noeud L'element (ou une chaine, un tableau).
 * @param {string} texte Le texte cherche.
 * @returns {boolean} Vrai s'il y figure.
 */
const contientLeTexte = (noeud, texte) => {
  if (noeud == null || typeof noeud === 'boolean') return false;
  if (typeof noeud === 'string' || typeof noeud === 'number') return String(noeud) === texte;
  if (Array.isArray(noeud)) return noeud.some((enfant) => contientLeTexte(enfant, texte));
  return contientLeTexte(noeud?.props?.children, texte);
};

describe('MSG1A — G1 : on écrit dans un groupe', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockChatData = FIL_DE_GROUPE;
    mockMessagesPage = PAGE_VIDE;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test("G1-1 — un GROUPE n'est pas un canal d'annonce : la saisie est là", () => {
    const { gifted } = monterLaConversation();

    const barre = gifted.renderInputToolbar({ text: '' });

    expect(contientLeTexte(barre, LECTURE_SEULE)).toBe(false);
  });

  test('G1-2 — un fil de CLUB lu par un joueur reste en lecture seule', () => {
    mockChatData = FIL_DE_CLUB;
    const { gifted } = monterLaConversation();

    const barre = gifted.renderInputToolbar({ text: '' });

    expect(contientLeTexte(barre, LECTURE_SEULE)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MSG1A §3.1 — L'HABILLAGE DU FIL (SPECS.md §1), lu sur ce que GiftedChat recoit.
// ─────────────────────────────────────────────────────────────────────────────

const GROUPE_NOMME = {
  documentId: 'chat-1',
  groupAdmins: [{ documentId: 'karim' }],
  groupName: 'Seniors 1',
  participants: [
    { documentId: 'moi', firstname: 'Adel' },
    { documentId: 'karim', firstname: 'Karim' },
    { documentId: 'lea', firstname: 'Léa' },
  ],
  type: 'group',
};

const TETE_A_TETE = {
  documentId: 'chat-1',
  participants: [{ documentId: 'moi', firstname: 'Adel' }, { documentId: 'karim', firstname: 'Karim' }],
  type: 'whisper',
};

/**
 * Un message au format GiftedChat.
 * @param {string} id
 * @param {string} auteur
 * @param {string} quand
 * @param {Record<string, any>} [extra]
 * @returns {any} Le message.
 */
const msg = (id, auteur, quand, extra = {}) => ({
  _id: id,
  createdAt: new Date(quand),
  documentId: id,
  text: `Texte ${id}`,
  user: { _id: auteur, name: auteur === 'karim' ? 'Karim Benali' : 'Adel F' },
  ...extra,
});

/**
 * Rend la bulle que l'ecran fabrique pour ce message.
 * @param {any} gifted Les props de GiftedChat.
 * @param {any} props Les props de bulle (currentMessage, voisins, position).
 * @returns {any} L'arbre rendu.
 */
const rendreLaBulle = (gifted, props) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(gifted.renderBubble(props)); });
  aDemonter.push(() => { act(() => { arbre.unmount(); }); });
  return arbre;
};

describe('MSG1A — §3.1 habillage du fil', () => {
  /* eslint-disable global-require */
  const BulleDuFil = require('@/components/molecules/bulleDuFil/BulleDuFil').default;
  const MetaDuMessage = require('@/components/molecules/bulleDuFil/MetaDuMessage').default;
  /* eslint-enable global-require */

  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockChatData = GROUPE_NOMME;
    mockMessagesPage = PAGE_VIDE;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('H1 — groupe : la 1re bulle porte le NOM, la derniere la QUEUE', () => {
    const { gifted } = monterLaConversation();
    const a1 = msg('a1', 'karim', '2026-10-07T10:00:00');
    const a2 = msg('a2', 'karim', '2026-10-07T10:01:00');

    const premiere = rendreLaBulle(gifted, { currentMessage: a1, nextMessage: a2, position: 'left' });
    const derniere = rendreLaBulle(gifted, { currentMessage: a2, position: 'left', previousMessage: a1 });

    const cadre1 = premiere.root.findByType(BulleDuFil).props;
    const cadre2 = derniere.root.findByType(BulleDuFil).props;
    expect(cadre1.nom).toBe('Karim Benali');
    expect(cadre1.estDernier).toBe(false);
    expect(cadre2.nom).toBe('');
    expect(cadre2.estDernier).toBe(true);
  });

  test('H2 — le texte garde le moteur de liens de GiftedChat, avec la place de l heure', () => {
    const { gifted } = monterLaConversation();
    const arbre = rendreLaBulle(gifted, {
      currentMessage: msg('a1', 'karim', '2026-10-07T10:00:00'), position: 'left',
    });

    const texte = arbre.root.findAll((n) => n.props?.currentMessage && n.props?.textStyle)[0];
    expect(texte.props.currentMessage.text).toMatch(/^Texte a1\u00A0+$/);
  });

  test('H3 — heure et coches DANS la bulle ; mon message en cours d envoi le dit', () => {
    const { gifted } = monterLaConversation();
    const arbre = rendreLaBulle(gifted, {
      currentMessage: msg('m1', 'moi', '2026-10-07T10:02:00', { pending: true }), position: 'right',
    });

    const meta = arbre.root.findByType(MetaDuMessage).props;
    expect(meta.estAMoi).toBe(true);
    expect(meta.etat).toBe('enCours');
    expect(meta.heure).toBe('10:02');
  });

  test('H4 — tete-a-tete : ni nom au-dessus des bulles, ni avatar', () => {
    mockChatData = TETE_A_TETE;
    const { gifted } = monterLaConversation();
    const arbre = rendreLaBulle(gifted, {
      currentMessage: msg('a1', 'karim', '2026-10-07T10:00:00'), position: 'left',
    });

    expect(arbre.root.findByType(BulleDuFil).props.nom).toBe('');
    expect(gifted.renderAvatar).toBeNull();
  });

  test('H5 — groupe : avatar de 28, puces de date, notices, « revenir en bas » au-dela de 160', () => {
    const { gifted } = monterLaConversation();

    expect(typeof gifted.renderAvatar).toBe('function');
    expect(typeof gifted.renderDay).toBe('function');
    expect(gifted.isScrollToBottomEnabled).toBe(true);
    expect(gifted.scrollToBottomOffset).toBe(160);
    expect(gifted.imageStyle.left).toEqual(expect.objectContaining({ height: 28, width: 28 }));
  });

  test('H6 — une ligne sans auteur devient une notice discrete', () => {
    const { gifted } = monterLaConversation();
    const notice = gifted.renderSystemMessage({ currentMessage: { text: 'Karim a rejoint le canal' } });

    expect(contientLeTexte(notice, 'Karim a rejoint le canal')).toBe(true);
    expect(gifted.renderSystemMessage({ currentMessage: { text: '  ' } })).toBeNull();
  });

  test('H7 — l en-tete d un groupe nomme ses membres, puis « Vous »', () => {
    const { ecran } = monterLaConversation();

    const sousTitre = ecran.root.findAll(
      (n) => n.props?.testID === 'conversation-sous-titre' && typeof n.type === 'string',
    )[0];
    expect(sousTitre.props.children).toBe('Karim, Léa, Vous');
  });
});

describe('MSG1A — §3.2 appui long', () => {
  /* eslint-disable global-require */
  const MessageReactionOverlay = require(
    '@/components/molecules/messageReactionOverlay/MessageReactionOverlay',
  ).default;
  /* eslint-enable global-require */

  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockMessagesPage = PAGE_VIDE;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('L1 — dans un canal d annonce (on ne peut pas ecrire), le menu ne propose pas « Repondre »', () => {
    mockChatData = FIL_DE_CLUB;
    const { ecran } = monterLaConversation();

    expect(ecran.root.findByType(MessageReactionOverlay).props.canReply).toBe(false);
  });

  test('L2 — dans un groupe, « Repondre » reste propose', () => {
    mockChatData = GROUPE_NOMME;
    const { ecran } = monterLaConversation();

    expect(ecran.root.findByType(MessageReactionOverlay).props.canReply).toBe(true);
  });
});

describe('MSG1A — §3.3 glisser pour repondre', () => {
  /* eslint-disable global-require */
  const BarreDeReponse = require('@/components/molecules/bulleDuFil/BarreDeReponse').default;
  const BulleDuFil = require('@/components/molecules/bulleDuFil/BulleDuFil').default;
  const CitationDansLaBulle = require('@/components/molecules/bulleDuFil/CitationDansLaBulle').default;
  const { View: VueRN } = require('react-native');
  /* eslint-enable global-require */

  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockChatData = GROUPE_NOMME;
    mockMessagesPage = PAGE_VIDE;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('R1 — la citation est DANS la bulle : nom de l auteur cite et extrait', () => {
    const { gifted } = monterLaConversation();
    const reponse = msg('r1', 'karim', '2026-10-07T10:05:00', {
      replyTo: { documentId: 'm0', message: 'Quelqu un peut me deposer ?', sender: { documentId: 'moi', firstname: 'Adel' } },
    });

    const arbre = rendreLaBulle(gifted, { currentMessage: reponse, position: 'left' });
    const citation = arbre.root.findByType(BulleDuFil).findByType(CitationDansLaBulle).props;

    expect(citation.nom).toBe('Vous');
    expect(citation.texte).toBe('Quelqu un peut me deposer ?');
  });

  test('R2 — glisser une bulle ouvre la barre « reponse en cours » au-dessus de la saisie', () => {
    const { gifted } = monterLaConversation();
    const cible = msg('a1', 'karim', '2026-10-07T10:00:00');
    const arbre = rendreLaBulle(gifted, { currentMessage: cible, position: 'left' });

    // La doublure de Swipeable est une View : on declenche son ouverture a la main.
    const glisser = arbre.root.findAll((n) => typeof n.props?.onSwipeableOpen === 'function')[0];
    act(() => { glisser.props.onSwipeableOpen(); });

    const giftedApres = mockGiftedRenders[mockGiftedRenders.length - 1];
    /** @type {any} */
    let barre;
    act(() => { barre = renderer.create(giftedApres.renderInputToolbar({ text: '' })); });
    aDemonter.push(() => { act(() => { barre.unmount(); }); });

    const props = barre.root.findByType(BarreDeReponse).props;
    expect(props.nom).toBe('Karim Benali');
    expect(props.texte).toBe('Texte a1');
    expect(VueRN).toBeDefined();
  });

  test('R3 — dans un canal d annonce, le geste est coupe ; dans un groupe, il marche', () => {
    mockChatData = FIL_DE_CLUB;
    const club = monterLaConversation();
    const bulleClub = rendreLaBulle(club.gifted, {
      currentMessage: msg('a1', 'karim', '2026-10-07T10:00:00'), position: 'left',
    });
    const enabledClub = bulleClub.root.findAll((n) => typeof n.props?.onSwipeableOpen === 'function')[0]
      .props.enabled;

    mockChatData = GROUPE_NOMME;
    const groupe = monterLaConversation();
    const bulleGroupe = rendreLaBulle(groupe.gifted, {
      currentMessage: msg('a2', 'karim', '2026-10-07T10:00:00'), position: 'left',
    });
    const enabledGroupe = bulleGroupe.root.findAll((n) => typeof n.props?.onSwipeableOpen === 'function')[0]
      .props.enabled;

    expect(enabledClub).toBe(false);
    expect(enabledGroupe).toBe(true);
  });
});

describe('MSG1A — §3.5 feuille « Ajouter »', () => {
  // eslint-disable-next-line global-require
  const ChatAttachmentSheet = require('@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet');

  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockChatData = GROUPE_NOMME;
    mockMessagesPage = PAGE_VIDE;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('F1 — les entrees dans l ordre du pack', () => {
    const { ecran } = monterLaConversation();
    const feuille = ecran.root.findByType(ChatAttachmentSheet.default || ChatAttachmentSheet);

    expect(feuille.props.actions.map((action) => action.key))
      .toEqual(['photos', 'camera', 'document', 'poll', 'event', 'location', 'contact']);
  });
});

describe('MSG1A — §3.18 adresses cliquables', () => {
  // eslint-disable-next-line global-require
  const FeuilleDAdresse = require('@/components/organisms/feuilleDAdresse/FeuilleDAdresse').default;

  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockChatData = GROUPE_NOMME;
    mockMessagesPage = PAGE_VIDE;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('AD1 — une adresse ecrite dans un texte est un lien qui ouvre la feuille d adresse', () => {
    const { ecran, gifted } = monterLaConversation();
    const arbre = rendreLaBulle(gifted, {
      currentMessage: msg('a1', 'karim', '2026-10-07T10:00:00', { text: 'RDV 12 rue Pasteur a 18h' }),
      position: 'left',
    });
    const texte = arbre.root.findAll((n) => n.props?.currentMessage && n.props?.textStyle)[0];
    const [motif] = texte.props.parsePatterns({});

    expect('RDV 12 rue Pasteur a 18h'.match(motif.pattern)).toEqual(['12 rue Pasteur']);
    expect(ecran.root.findByType(FeuilleDAdresse).props.adresse).toBeNull();

    act(() => { motif.onPress('12 rue Pasteur'); });
    expect(ecran.root.findByType(FeuilleDAdresse).props.adresse).toEqual({ label: '12 rue Pasteur' });
  });
});

describe('MSG1A — §3.11 canal d annonce en lecture seule', () => {
  // eslint-disable-next-line global-require
  const GlyphIcon = require('@/components/atoms/glyphIcon/GlyphIcon').default;

  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockChatData = FIL_DE_CLUB;
    mockMessagesPage = PAGE_VIDE;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('LS1 — la saisie est remplacee par une barre opaque avec un cadenas et le libelle existant', () => {
    const { gifted } = monterLaConversation();
    /** @type {any} */
    let barre;
    act(() => { barre = renderer.create(gifted.renderInputToolbar({ text: '' })); });
    aDemonter.push(() => { act(() => { barre.unmount(); }); });

    const conteneur = barre.root.findAll((n) => n.props?.testID === 'conversation-lecture-seule')[0];
    expect(conteneur).toBeDefined();
    expect(conteneur.findByType(GlyphIcon).props.name).toBe('lock');
    expect(contientLeTexte(gifted.renderInputToolbar({ text: '' }), LECTURE_SEULE)).toBe(true);
  });
});
