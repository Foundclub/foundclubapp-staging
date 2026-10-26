/* eslint-disable max-len, jsdoc/require-param-type -- témoin BH04 : entrées du rapport gardées sur une ligne */
import renderer, { act } from 'react-test-renderer';

// BH04 — P6-04, P6-05, P6-08 : copie du banc MSG1 (vrai écran, GiftedChat doublé).

const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockBanners = /** @type {any[]} */ ([]);
const mockSendMessage = jest.fn();
const mockSendTypingStart = jest.fn();
const mockSendTypingStop = jest.fn();
const mockRepondre = jest.fn();
const mockVoter = jest.fn(() => Promise.resolve({}));
const mockNavigate = jest.fn();
let mockMessagesDuFil = /** @type {any[]} */ ([]);
// FINITIONS12-COLL : le fil doublé se règle (un fil de la Ville pour le témoin du canal vide).
const FIL_ORDINAIRE = { documentId: 'chat-1', participants: [], type: 'group' };
let mockChat = /** @type {any} */ (FIL_ORDINAIRE);

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

// LA COUTURE : on capture les props a CHAQUE rendu, pas seulement au dernier.
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

// PERF2 — l ecran importe desormais WithDataWrapper → SkeletonLoader, qui tire
// MaskedView / LinearGradient / Reanimated : hors sujet ici (cette suite ne
// monte que des fils charges). Meme mock que les suites EventPublishedShowcase.
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

// Sans cette doublure la SUITE ENTIERE meurt au CHARGEMENT : `client` lit
// `.env`, qui est gitignore donc absent de toute copie de travail.
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
  cancelMatch: jest.fn(),
  createLeagueProposal: jest.fn(),
  respondToLeagueProposal: (/** @type {any[]} */ ...args) => mockRepondre(...args),
}));
jest.mock('@/services/messageReport/messageReportService', () => ({
  createMessageReport: jest.fn(),
}));
jest.mock('@/services/reservation/reservationService', () => ({ joinReservation: jest.fn() }));
jest.mock('@/services/event/eventQueries', () => ({ useGetEvents: () => ({ data: null }) }));
// TRIO — l'ecran repond desormais « Absent » sur la carte d'evenement du fil, via
// `useEventAnswerMutations`. Ce hook importe `eventService`, qui charge
// `react-native-blob-util` (module ESM que Jest ne transforme pas) : sans cette
// doublure c'est la SUITE ENTIERE qui meurt au chargement, sans un seul test rouge.
// Meme motif que la ligne du dessus : ce fil-la ne mesure pas les evenements.
jest.mock('@/services/event/eventService', () => ({
  missingEvent: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

// LA BANNIERE, celle qui existe deja dans l'ecran. On capture ce qu'elle recoit.
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({
    showBanner: (/** @type {any} */ charge) => { mockBanners.push(charge); return 'banniere'; },
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    getConversationName: () => 'Fil',
    joinChat: jest.fn(),
    leaveChat: jest.fn(),
    markMessagesAsRead: jest.fn(),
    retryMessage: jest.fn(),
    sendMessage: (/** @type {any[]} */ ...args) => mockSendMessage(...args),
    sendReadReceipt: jest.fn(),
    sendTypingStart: (/** @type {any[]} */ ...args) => mockSendTypingStart(...args),
    sendTypingStop: (/** @type {any[]} */ ...args) => mockSendTypingStop(...args),
    socket: { emit: jest.fn(), off: jest.fn(), on: jest.fn() },
    typingUsers: [],
    votePoll: (/** @type {any[]} */ ...args) => mockVoter(...args),
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  // MSGREACT — les reactions emoji du fil. Aucune par defaut : les temoins de
  // cet ecran ne parlent pas de reactions, et une rangee vide ne se dessine pas.
  useGetChatById: () => ({
    data: mockChat,
    isLoading: false,
  }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({
    data: { pages: [{ data: mockMessagesDuFil, meta: { pagination: { page: 1, pageCount: 1, total: 0 } } }] },
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetching: false,
    isLoading: false,
  }),
}));

// Le VRAI theme, jamais un Proxy : un faux theme rend les echecs Jest illisibles.
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
/** @type {any[]} */
const mockFeuilles = [];
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (/** @type {any} */ props) => {
  mockFeuilles.push(props);
  return null;
});
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
 * Les props du DERNIER rendu de GiftedChat — l'etat reel de l'ecran.
 * @returns {any} Les props.
 */
const dernieresProps = () => mockGiftedRenders[mockGiftedRenders.length - 1];

/**
 * Monte le vrai ecran Conversation.
 * @param params
 * @returns {{ arbre: any }} L'arbre monte.
 */
const monterConversation = (/** @type {Record<string, any>} */ params = {}) => {
  // eslint-disable-next-line global-require
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  // eslint-disable-next-line global-require
  const { createElement } = require('react');
  // eslint-disable-next-line global-require
  const Conversation = require('../Conversation').default;
  const clientRequetes = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client: clientRequetes },
      createElement(Conversation, {
        navigation: {
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: jest.fn(),
          setParams: jest.fn(),
        },
        route: { params: { chatId: 'chat-1', ...params } },
      }),
    ));
  });
  return { arbre };
};

beforeEach(() => {
  mockChat = FIL_ORDINAIRE;
  mockGiftedRenders.length = 0;
  mockBanners.length = 0;
  mockSendMessage.mockReset();
  mockSendTypingStart.mockReset();
  mockSendTypingStop.mockReset();
  mockRepondre.mockReset();
  mockNavigate.mockReset();
  mockMessagesDuFil = [];
});

const FIL_DE_LIGUE = {
  documentId: 'chat-1',
  league_match: { date: '2099-06-10T16:00:00.000Z', documentId: 'match-1' },
  myTeamMembers: [],
  participants: [],
  type: 'league_match',
};

describe('BH04 — messagerie du téléphone', () => {
  it('P6-04 : un refus en échec redemande les messages (la bulle ne reste pas « refusée »)', async () => {
    // eslint-disable-next-line global-require
    const { QueryClient } = require('@tanstack/react-query');
    const espion = jest.spyOn(QueryClient.prototype, 'invalidateQueries');
    mockChat = FIL_DE_LIGUE;
    mockRepondre.mockRejectedValue(new Error('500'));
    monterConversation();
    const bulle = dernieresProps().renderBubble({
      currentMessage: {
        _id: 'prop-1',
        composition: { matchId: 'match-1', status: 'pending', type: 'proposal' },
        createdAt: new Date(),
        documentId: 'prop-1',
        user: { _id: 'adverse' },
      },
      position: 'left',
    });
    let rendu;
    act(() => { rendu = renderer.create(bulle); });
    // eslint-disable-next-line global-require
    const Proposition = require('@/components/molecules/proposalMessageBubble/ProposalMessageBubble');
    const { props } = rendu.root.findByType(Proposition.default || Proposition);
    espion.mockClear();
    await act(async () => { await props.onDecline(); });
    expect(espion).toHaveBeenCalledWith({ queryKey: ['chat-messages', 'chat-1'] });
    espion.mockRestore();
  });

  it('P6-05 : l adversaire anonymisé n a ni photo ni profil ouvrable', () => {
    mockChat = FIL_DE_LIGUE;
    mockMessagesDuFil = [{
      createdAt: '2026-10-07T08:00:00.000Z',
      documentId: 'm1',
      id: 'm1',
      message: 'Salut',
      sender: {
        avatar: { url: 'https://cdn.example/vraie-photo.jpg' }, documentId: 'adverse', firstname: 'Vrai', lastname: 'Nom',
      },
    }];
    monterConversation();
    const message = dernieresProps().messages.find((/** @type {any} */ m) => m.text === 'Salut');
    expect(message.user.name).toBe('Joueur Adverse');
    expect(message.user.avatar || '').toBe('');
    const avatar = dernieresProps().renderAvatar?.({ currentMessage: message });
    if (avatar) {
      let rendu;
      act(() => { rendu = renderer.create(avatar); });
      act(() => { rendu.root.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0].props.onPress(); });
    }
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('P6-08 : partager un événement hors connexion le dit au lieu de le perdre', () => {
    mockSendMessage.mockReturnValue(null);
    monterConversation({ sharedEventFromPicker: { documentId: 'evt-9', name: 'Tournoi' } });
    expect(mockSendMessage).toHaveBeenCalled();
    expect(mockBanners.some((/** @type {any} */ b) => b.tone === 'error')).toBe(true);
  });

  it('Q4-20 (P6-15) : voter sur un sondage pas encore confirmé (temp-) n appelle pas le serveur', async () => {
    mockVoter.mockClear();
    monterConversation();
    const bulle = dernieresProps().renderBubble({
      currentMessage: {
        _id: 'temp-123',
        composition: { options: [{ id: 'o1', text: 'Oui', votes: [] }], question: 'On joue ?', type: 'poll' },
        createdAt: new Date(),
        documentId: 'temp-123',
        user: { _id: 'moi' },
      },
      position: 'right',
    });
    let rendu;
    act(() => { rendu = renderer.create(bulle); });
    // eslint-disable-next-line global-require
    const Sondage = require('@/components/molecules/pollMessageBubble/PollMessageBubble');
    const { props } = rendu.root.findByType(Sondage.default || Sondage);
    await act(async () => { await props.onVote('o1'); });
    expect(mockVoter).not.toHaveBeenCalled();
    expect(mockBanners.some((/** @type {any} */ b) => JSON.stringify(b).includes('en cours de synchronisation'))).toBe(true);
  });

  describe('Q4-06 (P6-05 persistant) : l adversaire reste anonyme hors de sa bulle', () => {
    const ADVERSE = {
      avatar: { url: 'https://cdn.example/vraie-photo.jpg' }, documentId: 'adverse', firstname: 'Karim', lastname: 'Benali',
    };
    const filAvecAdversaire = () => ({ ...FIL_DE_LIGUE, participants: [{ documentId: 'moi', firstname: 'Adel' }, ADVERSE] });

    it('votant d un sondage (et « écrit… », même annuaire) : « Joueur Adverse », sans photo', () => {
      mockChat = filAvecAdversaire();
      monterConversation();
      const bulle = dernieresProps().renderBubble({
        currentMessage: {
          _id: 'p1', composition: { options: [], question: 'On joue ?', type: 'poll' }, createdAt: new Date(), documentId: 'p1', user: { _id: 'moi' },
        },
        position: 'right',
      });
      let rendu;
      act(() => { rendu = renderer.create(bulle); });
      // eslint-disable-next-line global-require
      const Sondage = require('@/components/molecules/pollMessageBubble/PollMessageBubble');
      const { props } = rendu.root.findByType(Sondage.default || Sondage);
      expect(props.resolveVoterName('adverse')).toBe('Joueur Adverse');
      expect(props.resolveVoterAvatar('adverse')).toBe('');
      expect(props.resolveVoterName('moi')).toContain('Adel');
      // ANONSITE — la bulle lit les votants au serveur, qui donne le vrai nom : le masque passe devant.
      expect(props.nomMasqueDuVotant('adverse')).toBe('Joueur Adverse');
      expect(props.nomMasqueDuVotant('moi')).toBe('');
    });

    it('ANONSERVEUR — « Partager un contact » ne propose pas l adversaire avant le match', () => {
      mockChat = {
        ...filAvecAdversaire(),
        myTeamMembers: [{ documentId: 'lea' }],
        participants: [{ documentId: 'moi', firstname: 'Adel' }, ADVERSE, { documentId: 'lea', firstname: 'Léa' }],
      };
      mockFeuilles.length = 0;
      monterConversation();
      /** @type {any} */
      let rendu;
      const textes = [...mockFeuilles].reverse().map((/** @type {any} */ p) => {
        act(() => { rendu = renderer.create(<>{p.children}</>); });
        const t = JSON.stringify(rendu.toJSON());
        act(() => { rendu.unmount(); });
        return t;
      });
      const texte = textes.find((t) => t.includes('Partager un contact') || t.includes('shareContact.title'));
      expect(texte).toBeDefined();
      expect(texte).not.toMatch(/Karim|Benali/);
      expect(texte).toContain('Léa');
    });

    it('citation d un message de l adversaire : son nom ne sort pas', () => {
      mockChat = filAvecAdversaire();
      monterConversation();
      const bulle = dernieresProps().renderBubble({
        currentMessage: {
          _id: 'r1',
          createdAt: new Date(),
          documentId: 'r1',
          replyTo: { documentId: 'm1', message: 'Salut', sender: ADVERSE },
          text: 'Réponse',
          user: { _id: 'moi' },
        },
        position: 'right',
      });
      // La citation est un élément passé en prop : on la cherche dans l arbre des éléments.
      /** @type {any[]} */
      const citations = [];
      const fouiller = (/** @type {any} */ noeud) => {
        if (!noeud || typeof noeud !== 'object') return;
        if (Array.isArray(noeud)) { noeud.forEach(fouiller); return; }
        if (noeud.props && typeof noeud.props.nom === 'string' && 'icone' in noeud.props && 'couleur' in noeud.props) citations.push(noeud.props);
        if (noeud.props) Object.values(noeud.props).forEach(fouiller);
      };
      fouiller(bulle);
      expect(citations.length).toBeGreaterThan(0);
      citations.forEach((c) => expect(c.nom).toBe('Joueur Adverse'));
    });
  });
});
