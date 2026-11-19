/* eslint-disable max-len -- harnais copié de ConversationWebBH04 : entrées gardées sur une ligne */
import { QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { creerQueryClientDeTest } from '../../testSupport/queryClientDeTest';

// ✍️ CHAT-SAISIE (18/11, Adel D262) — sur le SITE, le champ des conversations grandit avec le
// texte jusqu'à 5 lignes, puis défile ; quand il grandit, le fil reste collé en bas (le dernier
// message reste visible juste au-dessus du champ). Harnais : copie de ConversationWebBH04.

const CHAT_ID = 'fil-equipe';
const MOI = { documentId: 'moi', firstname: 'Adel', lastname: 'Ferchichi' };
const BRUNO = { documentId: 'bruno', firstname: 'Bruno', lastname: 'Dupont' };

let mockLargeur = 1280;
/** @type {any[]} */
let mockMessagesDuFil = [];
/** @type {any} */
let mockFil = null;
/** @type {any} */
let mockSocket = null;
const mockStopFrappe = jest.fn();
const mockVoter = jest.fn(() => Promise.resolve({}));

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
    sendTypingStop: mockStopFrappe,
    socket: mockSocket,
    votePoll: (/** @type {any[]} */ ...args) => mockVoter(...args),
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
const mockQuitterLeGroupe = jest.fn(() => Promise.resolve({ left: true }));
// T19R — les noms des votants lus au serveur (`GET /chat-messages/:id/poll-voters`).
// (le comportement est posé par chaque témoin qui affiche un sondage)
const mockLireLesVotants = jest.fn();
jest.mock('@/services/chat/chatService', () => ({
  createChatMessage: jest.fn(),
  getPollVoterProfiles: (/** @type {string} */ id) => mockLireLesVotants(id),
  leaveGroupChat: (/** @type {string} */ id) => mockQuitterLeGroupe(id),
}));
jest.mock('@/services/league/leagueMatchService', () => ({
  createLeagueProposal: jest.fn(),
  respondToLeagueProposal: jest.fn(),
}));
jest.mock('@/services/messageReport/messageReportService', () => ({
  createMessageReport: jest.fn(),
}));
const mockRsvp = jest.fn(() => Promise.resolve({}));
const mockAbsent = jest.fn(() => Promise.resolve({}));
jest.mock('@/services/event/eventService', () => ({
  getEventConvocation: jest.fn(),
  getEvents: jest.fn(() => Promise.resolve({
    data: [], meta: { pagination: { page: 1, pageCount: 1 } },
  })),
  missingEvent: (/** @type {any} */ id) => mockAbsent(id),
  respondToEventRsvp: (...args) => mockRsvp(...args),
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
// L assistant de convocation (MESSAGERIE-1C) charge le mur payant et son stockage natif :
// une doublure ici ; les temoins Playwright du site ouvrent le vrai.
jest.mock('@/views/conversationConvocation/ConvocationWizard', () => () => null);

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

// eslint-disable-next-line import/first
import ConversationWeb from '../Conversation.web';

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

// Une ligne du champ : 20 px ; marge interne 11 + 11 ; bord 1 + 1 (box-sizing: border-box).
// `scrollHeight` d'un textarea compte la marge interne, PAS le bord.
const LIGNE = 20;
const scrollHeightPour = (/** @type {number} */ lignes) => (lignes * LIGNE) + 22;
const CINQ_LIGNES = (5 * LIGNE) + 22 + 2;

/** @type {any[]} */
let observes = [];
const ResizeObserverDOrigine = global.window.ResizeObserver;

beforeEach(() => {
  observes = [];
  global.window.ResizeObserver = /** @type {any} */ (class {
    observe(/** @type {any} */ n) { observes.push(n); }

    disconnect() { this.fini = true; }
  });
});

afterEach(() => {
  global.window.ResizeObserver = ResizeObserverDOrigine;
});

/**
 * Monte le VRAI écran du site ; chaque nœud DOM est une boîte qui sait sa hauteur de contenu
 * (`scrollHeight`) : le textarea la tire du nombre de lignes de son texte.
 * @returns {Promise<{ arbre: any, noeuds: any[] }>} L'arbre et les nœuds DOM doublés.
 */
const monterAvecLeDom = async () => {
  /** @type {any[]} */
  const noeuds = [];
  /** @type {{ texte: string }} */
  const etat = { texte: '' };
  const options = {
    createNodeMock: (/** @type {any} */ element) => {
      const noeud = {
        addEventListener: () => {},
        focus: () => {},
        get scrollHeight() {
          return element.type === 'textarea'
            ? scrollHeightPour(Math.max(1, etat.texte.split('\n').length))
            : 1000;
        },
        removeEventListener: () => {},
        scrollTop: 0,
        scrollTo: () => {},
        style: /** @type {Record<string, string>} */ ({}),
        testid: element.props?.['data-testid'],
        type: element.type,
      };
      noeuds.push(noeud);
      return noeud;
    },
  };
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <ConversationWeb navigation={navigation} route={{ params: { chatId: CHAT_ID } }} />
      </QueryClientProvider>,
      options,
    );
  });
  montes.push(arbre);
  await act(async () => { await new Promise((r) => { setTimeout(r, 30); }); });
  const ecrire = async (/** @type {string} */ texte) => {
    etat.texte = texte;
    await act(async () => {
      arbre.root.findAll((/** @type {any} */ n) => n.type === 'textarea')[0]
        .props.onChange({ target: { value: texte } });
    });
  };
  return { arbre, ecrire, noeuds };
};

const lignes = (/** @type {number} */ n) => Array.from({ length: n }, (_v, i) => `ligne ${i + 1}`).join('\n');

describe('CHAT-SAISIE (site) — le champ grandit jusqu\'à 5 lignes, le fil reste collé en bas', () => {
  test.each([
    [1, 44],
    [3, (3 * LIGNE) + 24],
    [5, CINQ_LIGNES],
    [8, CINQ_LIGNES],
  ])('W1 — %i ligne(s) tapée(s) : le champ mesure %i px (bord compris, 5 lignes au plus)', async (n, attendu) => {
    const { ecrire, noeuds } = await monterAvecLeDom();

    await ecrire(lignes(n));

    const champ = noeuds.find((x) => x.type === 'textarea');
    expect(champ.style.height).toBe(`${attendu}px`);
  });

  test('W2 — au-delà de 5 lignes le champ défile en lui-même ; en dessous, pas de barre', async () => {
    const { ecrire, noeuds } = await monterAvecLeDom();
    const champ = noeuds.find((x) => x.type === 'textarea');

    await ecrire(lignes(8));
    expect(champ.style.overflowY).toBe('auto');

    await ecrire(lignes(3));
    expect(champ.style.overflowY).toBe('hidden');
  });

  test('W3 — après l\'envoi (texte vidé), le champ redescend à une ligne', async () => {
    const { ecrire, noeuds } = await monterAvecLeDom();
    const champ = noeuds.find((x) => x.type === 'textarea');

    await ecrire(lignes(5));
    await ecrire('');

    expect(champ.style.height).toBe('44px');
  });

  test('W4 — quand le champ grandit, le FIL lui-même est suivi : il se recolle en bas', async () => {
    const { noeuds } = await monterAvecLeDom();

    const fil = noeuds.find((x) => x.testid === 'MSG1W-fil');
    expect(fil).toBeDefined();
    expect(observes).toContain(fil);
  });
});
