import { QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { creerQueryClientDeTest } from '../../testSupport/queryClientDeTest';

// ==========================================================================
// 💬 MESSAGERIE-1W (07/10/2026) — LA MESSAGERIE DU SITE AU MEME HABILLAGE QUE LE TELEPHONE
// (pack « modele WhatsApp » d Adel). Les temoins Playwright (`web/tests/components/
// msg1w-fil.spec.ts`) verifient la page dans un vrai navigateur ; ceux-ci verifient ce que le
// banc du navigateur ne sait pas simuler : la socket (« … écrit »), et les regles lues dans la
// fiche du fil. Chaque bloc est ROUGE avant sa section.
// ==========================================================================

const CHAT_ID = 'fil-equipe';
const MOI = { documentId: 'moi', firstname: 'Adel', lastname: 'Ferchichi' };
const BRUNO = { documentId: 'bruno', firstname: 'Bruno', lastname: 'Dupont' };
const FRAPPE_DE_BRUNO = { chatDocumentId: CHAT_ID, userDocumentId: BRUNO.documentId };

let mockLargeur = 1280;
/** @type {any[]} */
let mockMessagesDuFil = [];
/** @type {any} */
let mockFil = null;
/** @type {any} */
let mockSocket = null;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: mockLargeur,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => ({ auth: { user: { documentId: 'moi' } } }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: new Proxy({}, { get: () => 1 }),
    scheme: 'dark',
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

/** @type {any} */
let mockMoi = null;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [],
    hasClubAccess: (/** @type {string} */ clubId) => clubId === 'club-1',
    userData: mockMoi,
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    isSocketConnected: true,
    joinChat: jest.fn(),
    leaveChat: jest.fn(),
    reactToMessage: jest.fn(),
    respondToProposal: jest.fn(),
    retryFailedMessage: jest.fn(),
    sendMessage: jest.fn(() => 'temp-1'),
    sendReadReceipt: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: jest.fn(),
    socket: mockSocket,
    votePoll: jest.fn(),
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({
    data: mockFil, error: null, isLoading: false, refetch: jest.fn(),
  }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({
    data: { pages: [{ data: mockMessagesDuFil }] },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetChats: () => ({ data: { pages: [{ data: [] }] }, isLoading: false }),
}));

jest.mock('@/services/collectivite/collectiviteCanauxQueries', () => ({
  useMembresDuFil: () => ({ data: null }),
  useMesCanauxDeLaVille: () => ({ data: [] }),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => ({ data: [] }),
  useMyCollectivites: () => ({ data: [] }),
}));
jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useMesActualitesDeLaVille: () => ({ data: undefined }),
}));

// Le client HTTP lit ses adresses au CHARGEMENT du module : `.env` est absent d'une copie.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock('@/services/chat/chatService', () => ({ createChatMessage: jest.fn() }));
jest.mock('@/services/league/leagueMatchService', () => ({
  createLeagueProposal: jest.fn(),
  respondToLeagueProposal: jest.fn(),
}));
jest.mock('@/services/messageReport/messageReportService', () => ({
  createMessageReport: jest.fn(),
}));
const mockAbsent = jest.fn(() => Promise.resolve({}));
jest.mock('@/services/event/eventService', () => ({
  getEventConvocation: jest.fn(),
  getEvents: jest.fn(() => Promise.resolve({
    data: [], meta: { pagination: { page: 1, pageCount: 1 } },
  })),
  missingEvent: (/** @type {any} */ id) => mockAbsent(id),
  respondToEventRsvp: jest.fn(() => Promise.resolve({})),
}));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: {} }));
// MSG1W §3.5 — les fenetres du « + » (grande carte d evenement, sondage du telephone) : leurs
// modules natifs ne se chargent pas dans ce banc, et ce temoin ne les regarde pas.
jest.mock('@/components/molecules/eventCard/EventCardNew', () => () => null);
// §3.8 — la bulle d evenement du telephone : le banc la remplace par une doublure qui expose
// ses gestes (Présent / Absent / Rejoindre), pour verifier QUI le site appelle.
jest.mock('@/components/molecules/eventMessageBubble/EventMessageBubble', () => {
  const react = jest.requireActual('react');
  return function BulleEvenementDouble(/** @type {any} */ props) {
    return react.createElement('div', {
      'data-testid': 'MSG1W-bulle-evenement-double',
      onDecline: props.onDecline,
      onJoin: props.onJoin,
      onParticipate: props.onParticipate,
    }, String(props.event?.name || ''));
  };
});
const mockParticipation = jest.fn(() => Promise.resolve({ data: {} }));
// §3.16 — les personnes que J AI bloquees (K3, K4).
/** @type {any[]} */
let mockBloques = [];
jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: jest.fn() }),
  useGetMyBlockedUsers: () => ({ data: mockBloques }),
  useUnblockUser: () => ({ isPending: false, mutate: jest.fn() }),
}));
jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: (/** @type {any} */ donnees) => mockParticipation(donnees),
}));
jest.mock('@/components/organisms/pollCreationModal/PollCreationModal', () => () => null);

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

// eslint-disable-next-line import/first
import ConversationWeb from '../Conversation.web';

// Les noms d evenements de la socket, ceux que l ecran ecoute.
const { EVENTS } = jest.requireActual('@/hooks/useSocket');

jest.setTimeout(30000);

/**
 * Une socket de banc : `on` / `off` comme socket.io, et `emettre` pour jouer le serveur.
 * @returns {any} La socket.
 */
const fausseSocket = () => {
  /** @type {Map<string, Set<Function>>} */
  const ecoutes = new Map();
  return {
    emettre: (/** @type {string} */ evenement, /** @type {any} */ charge) => (
      ecoutes.get(evenement) || new Set()
    ).forEach((f) => f(charge)),
    emit: jest.fn(),
    off: jest.fn((/** @type {string} */ evenement, /** @type {Function} */ f) => {
      ecoutes.get(evenement)?.delete(f);
    }),
    on: jest.fn((/** @type {string} */ evenement, /** @type {Function} */ f) => {
      if (!ecoutes.has(evenement)) ecoutes.set(evenement, new Set());
      ecoutes.get(evenement)?.add(f);
    }),
  };
};

/** @type {any} */
let queryClient;
/** @type {any[]} */
const montes = [];

/**
 * Tout le texte rendu sous un nœud, colle comme le navigateur le colle.
 * @param {any} noeud - Le nœud.
 * @returns {string} Le texte.
 */
const texteDe = (noeud) => {
  /** @type {string[]} */
  const morceaux = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    (enfant.children || []).forEach(parcourir);
  };
  parcourir(noeud);
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
};

const parTestId = (/** @type {any} */ arbre, /** @type {string} */ testId) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.type === 'string' && n.props?.['data-testid'] === testId,
);

/**
 * Monte la messagerie du site.
 * @param {Record<string, unknown>} [params] - Les parametres de route.
 * @returns {Promise<{ arbre: any, navigation: any }>} L arbre et la navigation.
 */
const monter = async (params = {}) => {
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <ConversationWeb
          navigation={navigation}
          route={{ params: { chatId: CHAT_ID, ...params } }}
        />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return { arbre, navigation };
};

beforeEach(() => {
  queryClient = creerQueryClientDeTest();
  mockLargeur = 1280;
  mockSocket = fausseSocket();
  mockBloques = [];
  mockMoi = {
    documentId: 'moi', firstname: 'Adel', lastname: 'Ferchichi', role: { type: 'coach' },
  };
  mockFil = {
    documentId: CHAT_ID,
    name: 'Seniors A',
    participants: [MOI, BRUNO],
    team: {
      club: { documentId: 'club-1', name: 'Aix-Perd en Buvette' },
      documentId: 'team-1',
      name: 'Seniors A',
    },
    type: 'team',
  };
  mockMessagesDuFil = [{
    createdAt: '2026-10-07T08:00:00.000Z',
    documentId: 'm1',
    message: 'On se retrouve a 18h',
    sender: BRUNO,
  }];
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
  queryClient.clear();
});

// 📐 §3.1 — « … écrit ». Le site envoyait ses signaux de frappe, sans en afficher aucun.
describe('MSG1W §3.1 — « Bruno écrit… » sur le site', () => {
  test('un signal de Bruno affiche « Bruno écrit... » sous le titre, puis s eteint', async () => {
    const { arbre } = await monter();
    expect(parTestId(arbre, 'MSG1W-qui-ecrit')).toHaveLength(0);

    await act(async () => {
      mockSocket.emettre(EVENTS.TYPING_STARTED, FRAPPE_DE_BRUNO);
    });
    const [ligne] = parTestId(arbre, 'MSG1W-qui-ecrit');
    expect(ligne).toBeDefined();
    expect(texteDe(ligne)).toContain('Bruno');

    await act(async () => {
      mockSocket.emettre(EVENTS.TYPING_STOPPED, FRAPPE_DE_BRUNO);
    });
    expect(parTestId(arbre, 'MSG1W-qui-ecrit')).toHaveLength(0);
  });

  test('ma propre frappe ne s affiche pas chez moi', async () => {
    const { arbre } = await monter();
    await act(async () => {
      mockSocket.emettre(EVENTS.TYPING_STARTED, { ...FRAPPE_DE_BRUNO, userDocumentId: 'moi' });
    });
    expect(parTestId(arbre, 'MSG1W-qui-ecrit')).toHaveLength(0);
  });
});

// 📐 §3.10 — L AVERTISSEMENT DU DIRIGEANT (decision d Adel du 07/10 : « avertissement B »). Le
// telephone l affichait en bandeau fixe ; le site ne l affichait PAS DU TOUT. Il devient une
// notice centree EN TETE DU FIL, qui defile avec lui, comme la mention de chiffrement de WhatsApp.
describe('MSG1W §3.10 — « consultées par son dirigeant », en tête du fil', () => {
  const NOTICE = 'Les conversations de ce club peuvent être consultées par son dirigeant.';

  test('un fil d equipe rattache a un club porte la notice, DANS le fil qui defile', async () => {
    const { arbre } = await monter();
    const [fil] = parTestId(arbre, 'MSG1W-fil');
    const notices = fil.findAll(
      (/** @type {any} */ n) => n.props?.['data-testid'] === 'conversation-club-read-notice',
    );
    expect(notices.length).toBeGreaterThan(0);
    expect(texteDe(notices[0])).toContain(NOTICE);
  });

  test('un tete-a-tete (aucun club) ne la porte pas : la phrase y serait fausse', async () => {
    mockFil = { ...mockFil, team: null, type: 'whisper' };
    const { arbre } = await monter();
    expect(texteDe(arbre.root)).not.toContain(NOTICE);
  });
});

// 📐 §3.11 — LE CANAL EN LECTURE SEULE. Le site offrait la saisie partout ; le serveur refusait
// ensuite l envoi dans un canal de club. La regle est celle du telephone (canWriteInChat.js).
describe('MSG1W §3.11 — « Canal d annonce (lecture seule) »', () => {
  const champDeSaisie = (/** @type {any} */ arbre) => arbre.root.findAll(
    (/** @type {any} */ n) => n.type === 'textarea',
  );

  test('un joueur dans le canal de son club : pas de saisie, la barre au cadenas', async () => {
    mockFil = {
      club: { documentId: 'club-1', name: 'Aix-Perd en Buvette' },
      documentId: CHAT_ID,
      participants: [MOI],
      type: 'club',
    };
    mockMoi = { ...mockMoi, role: { type: 'player' } };
    const { arbre } = await monter();
    expect(champDeSaisie(arbre)).toHaveLength(0);
    const [barre] = parTestId(arbre, 'MSG1W-lecture-seule');
    expect(barre).toBeDefined();
    expect(texteDe(barre)).toContain("Canal d'annonce (lecture seule)");
  });

  test('le dirigeant de ce club y ecrit ; dans un fil d equipe, tout le monde ecrit', async () => {
    mockFil = {
      club: { documentId: 'club-1', name: 'Aix-Perd en Buvette' },
      documentId: CHAT_ID,
      participants: [MOI],
      type: 'club',
    };
    mockMoi = { ...mockMoi, role: { type: 'president' } };
    expect(champDeSaisie((await monter()).arbre)).toHaveLength(1);

    mockFil = { ...mockFil, club: null, type: 'team' };
    mockMoi = { ...mockMoi, role: { type: 'player' } };
    const { arbre } = await monter();
    expect(champDeSaisie(arbre)).toHaveLength(1);
    expect(parTestId(arbre, 'MSG1W-lecture-seule')).toHaveLength(0);
  });
});

// 📐 §3.8 — L EVENEMENT PARTAGE : la bulle du telephone, et ses reponses branchees sur les MEMES
// routes que le telephone (Conversation.js : participation, `missing`, reponse de stage).
describe('MSG1W §3.8 — Présent / Absent depuis la bulle d un événement', () => {
  const PARTAGE = {
    composition: {
      eventDocumentId: 'evt-1',
      eventName: 'Entraînement du jeudi',
      eventPreview: { documentId: 'evt-1', name: 'Entraînement du jeudi', rsvpEnabled: true },
      type: 'event_share',
    },
    createdAt: '2026-10-07T09:00:00.000Z',
    documentId: 'm-evt',
    event: { documentId: 'evt-1', name: 'Entraînement du jeudi' },
    message: 'Partage',
    sender: BRUNO,
  };

  test('la bulle du telephone recoit l evenement ; « Partage » ne s affiche plus', async () => {
    mockMessagesDuFil = [PARTAGE];
    const { arbre } = await monter();
    const [bulle] = parTestId(arbre, 'MSG1W-bulle-evenement-double');
    expect(bulle).toBeDefined();
    expect(texteDe(bulle)).toBe('Entraînement du jeudi');
    expect(texteDe(arbre.root).split(' ')).not.toContain('Partage');
  });

  test('« Absent » appelle POST /events/:id/missing, la route du telephone', async () => {
    mockMessagesDuFil = [PARTAGE];
    mockAbsent.mockClear();
    mockParticipation.mockClear();
    const { arbre } = await monter();
    const [bulle] = parTestId(arbre, 'MSG1W-bulle-evenement-double');

    await act(async () => { bulle.props.onDecline({ documentId: 'evt-1' }); });
    expect(mockAbsent).toHaveBeenCalledWith('evt-1');
  });
});

// 📐 §3.16 (K4, ce que le pack oublie) — LES MESSAGES D UNE PERSONNE BLOQUEE. Le telephone les cache
// (`hideBlockedMessages`) ; le site les montrait. Ils restent en base (signalement possible).
describe('MSG1W §3.16 — une personne bloquée ne s affiche plus dans le fil du site', () => {
  test('les messages de Bruno disparaissent une fois bloque ; les autres restent', async () => {
    mockMessagesDuFil = [
      {
        createdAt: '2026-10-07T08:00:00.000Z',
        documentId: 'm-bruno',
        message: 'Message de Bruno',
        sender: BRUNO,
      },
      {
        createdAt: '2026-10-07T08:01:00.000Z',
        documentId: 'm-moi',
        message: 'Mon message',
        sender: MOI,
      },
    ];
    mockBloques = [{ user: { documentId: BRUNO.documentId } }];
    const { arbre } = await monter();
    const texte = texteDe(arbre.root);
    expect(texte).not.toContain('Message de Bruno');
    expect(texte).toContain('Mon message');
  });
});
