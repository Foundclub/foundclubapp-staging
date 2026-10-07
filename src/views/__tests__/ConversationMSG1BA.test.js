import renderer, { act } from 'react-test-renderer';

// MSG1BA — LE FIL BRANCHE SUR LE SERVEUR MESSAGERIE-1B (contrat
// admin/docs/CONTRAT_MESSAGERIE_1B.md) : role des membres (§3.1), photo et autorisations
// du groupe (§3.16), « Vous » dans les notices (§3.17), et ce que voit l'app quand le
// serveur ne sait encore rien de tout ca (la prod du 07/10).
//
// Meme banc que `ConversationMSG1A.fil.test.js` (le VRAI ecran, GiftedChat double) :
// on lit ce que l'ecran donne a GiftedChat et a « Infos du groupe ».

const mockLeaveGroupChat = jest.fn();
const mockSetGroupPhoto = jest.fn();
const mockRemoveGroupPhoto = jest.fn();
const mockChoisirLaPhoto = jest.fn();
jest.mock('@/services/chat/chatService', () => ({
  ...jest.requireActual('@/services/chat/chatService'),
  leaveGroupChat: (/** @type {any[]} */ ...args) => mockLeaveGroupChat(...args),
}));
jest.mock('@/services/chat/groupPhotoService', () => ({
  removeGroupPhoto: (/** @type {any[]} */ ...args) => mockRemoveGroupPhoto(...args),
  setGroupPhoto: (/** @type {any[]} */ ...args) => mockSetGroupPhoto(...args),
}));
jest.mock('@/domains/messaging/photoDuGroupe', () => ({
  __esModule: true,
  choisirLaPhotoDuGroupe: (/** @type {any[]} */ ...args) => mockChoisirLaPhoto(...args),
  default: (/** @type {any[]} */ ...args) => mockChoisirLaPhoto(...args),
}));
const mockGetUserRolesByIds = jest.fn();
jest.mock('@/services/user/userService', () => ({
  getUserRolesByIds: (/** @type {any[]} */ ...args) => mockGetUserRolesByIds(...args),
}));
const mockUpdateGroupMeta = jest.fn();
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
    GiftedChat: (/** @type {any} */ props) => {
      mockGiftedRenders.push(props);
      return null;
    },
    InputToolbar: VueRN,
    MessageText: VueRN,
    Time: VueRN,
  };
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34,
    left: 0,
    right: 0,
    top: 47,
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
  () => function SkeletonLoaderMock() {
    return null;
  },
);

// `.env` est gitignore, donc absent de toute copie de travail : sans ces
// doublures c'est la SUITE ENTIERE qui meurt au chargement.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
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
        ? repli.replace(
          /\{\{(\w+)\}\}/g,
          (/** @type {string} */ m, /** @type {string} */ nom) => (
            valeurs && valeurs[nom] !== undefined ? String(valeurs[nom]) : m
          ),
        )
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
  cancelMatch: jest.fn(),
  createLeagueProposal: jest.fn(),
  respondToLeagueProposal: jest.fn(),
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
    removeGroupMember: jest.fn(),
    retryMessage: jest.fn(),
    sendMessage: jest.fn(),
    sendReadReceipt: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: jest.fn(),
    socket: { emit: jest.fn(), off: jest.fn(), on: jest.fn() },
    typingUsers: [],
    updateGroupMeta: (/** @type {any[]} */ ...args) => mockUpdateGroupMeta(...args),
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
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => (/** @type {any} */ { children }) => children,
);
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
    ecran = renderer.create(
      createElement(
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
      ),
    );
  });

  aDemonter.push(() => {
    act(() => {
      ecran.unmount();
    });
    clientRequetes.clear();
  });

  return { ecran, gifted: mockGiftedRenders[mockGiftedRenders.length - 1] };
};

// Le premier montage transpile tout l'ecran (plus de 7 000 lignes) : ~25 s seul.
jest.setTimeout(60000);

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

/**
 * Laisse partir les promesses en attente (requetes doublees).
 * @returns {Promise<void>}
 */
const laisserFiler = async () => {
  // La lecture part a l'abonnement, puis react-query previent ses abonnes au tour suivant.
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 20); });
  });
};

afterEach(() => {
  while (aDemonter.length) {
    /** @type {any} */ (aDemonter.pop())();
  }
});

beforeEach(() => {
  mockGiftedRenders.length = 0;
  mockChatData = GROUPE_NOMME;
  mockMessagesPage = PAGE_VIDE;
  mockGetUserRolesByIds.mockReset();
  mockGetUserRolesByIds.mockResolvedValue({});
  mockUpdateGroupMeta.mockReset();
  mockUpdateGroupMeta.mockResolvedValue({});
  mockSetGroupPhoto.mockReset();
  mockSetGroupPhoto.mockResolvedValue({});
  mockRemoveGroupPhoto.mockReset();
  mockRemoveGroupPhoto.mockResolvedValue({});
  mockChoisirLaPhoto.mockReset();
});

describe('MSG1BA — §3.1 le role des membres dans « Infos du groupe »', () => {
  /* eslint-disable global-require */
  const InfosDuGroupe = require('@/views/chat/InfosDuGroupe').default;
  /* eslint-enable global-require */

  test('BR1 — rien n est lu page fermee ; a l ouverture, les roles arrivent', async () => {
    mockGetUserRolesByIds.mockResolvedValue({ karim: 'Entraîneur', lea: 'Joueur' });
    const { ecran } = monterLaConversation();
    await laisserFiler();
    expect(mockGetUserRolesByIds).not.toHaveBeenCalled();

    act(() => {
      ecran.root.findByType(InfosDuGroupe).props.onClose();
    });
    const titre = ecran.root.findAll(
      (n) => n.props?.accessibilityHint === 'Ouvre les infos du groupe'
        && typeof n.props?.onPress === 'function',
    )[0];
    act(() => {
      titre.props.onPress();
    });
    await laisserFiler();

    expect(mockGetUserRolesByIds).toHaveBeenCalledWith(['karim', 'lea', 'moi']);
    expect(ecran.root.findByType(InfosDuGroupe).props.roles).toEqual({
      karim: 'Entraîneur',
      lea: 'Joueur',
    });
  });

  test('BR2 — lecture refusee : la page s ouvre quand meme, chacun reste « Membre »', async () => {
    mockGetUserRolesByIds.mockRejectedValue(new Error('403'));
    const { ecran } = monterLaConversation();
    const titre = ecran.root.findAll(
      (n) => n.props?.accessibilityHint === 'Ouvre les infos du groupe'
        && typeof n.props?.onPress === 'function',
    )[0];
    act(() => {
      titre.props.onPress();
    });
    await laisserFiler();

    const infos = ecran.root.findByType(InfosDuGroupe);
    expect(infos.props.visible).toBe(true);
    expect(infos.props.roles).toEqual({});
  });
});

/**
 * Cherche un texte dans un ELEMENT React, sans le rendre.
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

const SEULS_LES_ADMINS = 'Seuls les admins peuvent envoyer des messages.';
const AUTORISATIONS = {
  membersCanAddMembers: false,
  membersCanEditName: false,
  membersCanEditPhoto: false,
  membersCanSendMessages: true,
};

describe('MSG1BA — §3.16 « Seuls les admins peuvent envoyer des messages »', () => {
  test('SA1 — envoi coupe pour les membres : la barre remplace la saisie', () => {
    mockChatData = {
      ...GROUPE_NOMME,
      groupPermissions: { ...AUTORISATIONS, membersCanSendMessages: false },
    };
    const { gifted } = monterLaConversation();
    const barre = gifted.renderInputToolbar({ text: '' });
    expect(contientLeTexte(barre, SEULS_LES_ADMINS)).toBe(true);
  });

  test('SA2 — envoi coupe, mais je suis admin : la saisie reste', () => {
    mockChatData = {
      ...GROUPE_NOMME,
      groupAdmins: [{ documentId: 'moi' }],
      groupPermissions: { ...AUTORISATIONS, membersCanSendMessages: false },
    };
    const { gifted } = monterLaConversation();
    const barre = gifted.renderInputToolbar({ text: '' });
    expect(contientLeTexte(barre, SEULS_LES_ADMINS)).toBe(false);
    expect(contientLeTexte(barre, "Canal d'annonce (lecture seule)")).toBe(false);
  });

  test('SA3 — serveur d avant 1B (pas d autorisations) : tout membre ecrit, comme avant', () => {
    const { gifted } = monterLaConversation();
    const barre = gifted.renderInputToolbar({ text: '' });
    expect(contientLeTexte(barre, SEULS_LES_ADMINS)).toBe(false);
    expect(contientLeTexte(barre, "Canal d'annonce (lecture seule)")).toBe(false);
  });
});

describe('MSG1BA — §3.16 les gestes d « Infos du groupe » partent au serveur', () => {
  /* eslint-disable global-require */
  const InfosDuGroupe = require('@/views/chat/InfosDuGroupe').default;
  /* eslint-enable global-require */

  const MOI_ADMIN = {
    ...GROUPE_NOMME,
    groupAdmins: [{ documentId: 'moi' }, { documentId: 'karim' }],
    groupPermissions: AUTORISATIONS,
  };

  test('IG1 — les autorisations du serveur arrivent a la page ; sans elles, null', () => {
    mockChatData = MOI_ADMIN;
    let { ecran } = monterLaConversation();
    expect(ecran.root.findByType(InfosDuGroupe).props.autorisations).toEqual(AUTORISATIONS);
    while (aDemonter.length) /** @type {any} */ (aDemonter.pop())();
    mockChatData = GROUPE_NOMME;
    ({ ecran } = monterLaConversation());
    expect(ecran.root.findByType(InfosDuGroupe).props.autorisations).toBeNull();
  });

  test('IG2 — un interrupteur : PATCH group-meta { permissions }, la seule clef', async () => {
    mockChatData = MOI_ADMIN;
    const { ecran } = monterLaConversation();
    await act(async () => {
      await ecran.root.findByType(InfosDuGroupe).props
        .onChangerAutorisation('membersCanEditName', true);
    });
    expect(mockUpdateGroupMeta).toHaveBeenCalledWith({
      chatId: 'chat-1',
      data: { permissions: { membersCanEditName: true } },
    });
  });

  test('IG3 — « Valider » les admins : UNE requete, ajouts et retraits', async () => {
    mockChatData = MOI_ADMIN;
    const { ecran } = monterLaConversation();
    await act(async () => {
      await ecran.root.findByType(InfosDuGroupe).props.onValiderAdmins(['moi', 'lea']);
    });
    expect(mockUpdateGroupMeta).toHaveBeenCalledTimes(1);
    expect(mockUpdateGroupMeta).toHaveBeenCalledWith({
      chatId: 'chat-1',
      data: { addAdminIds: ['lea'], removeAdminIds: ['karim'] },
    });
  });

  test('IG4 — la photo : choisie, puis envoyee au groupe ; « Supprimer » la retire', async () => {
    const fichier = { name: 'g.jpg', type: 'image/jpeg', uri: 'file:///g.jpg' };
    mockChoisirLaPhoto.mockResolvedValue({ apercu: fichier.uri, fichier });
    mockChatData = MOI_ADMIN;
    const { ecran } = monterLaConversation();
    await act(async () => {
      await ecran.root.findByType(InfosDuGroupe).props.onChoisirPhoto('camera');
    });
    expect(mockChoisirLaPhoto).toHaveBeenCalledWith('camera', expect.any(Function));
    expect(mockSetGroupPhoto).toHaveBeenCalledWith('chat-1', fichier);
    await act(async () => {
      await ecran.root.findByType(InfosDuGroupe).props.onSupprimerPhoto();
    });
    expect(mockRemoveGroupPhoto).toHaveBeenCalledWith('chat-1');
  });

  test('IG5 — photo annulee : rien ne part', async () => {
    mockChoisirLaPhoto.mockResolvedValue(null);
    mockChatData = MOI_ADMIN;
    const { ecran } = monterLaConversation();
    await act(async () => {
      await ecran.root.findByType(InfosDuGroupe).props.onChoisirPhoto('galerie');
    });
    expect(mockSetGroupPhoto).not.toHaveBeenCalled();
  });
});
