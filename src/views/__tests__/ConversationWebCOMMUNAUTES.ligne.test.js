/* eslint-disable max-len */
import { QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

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
/** @type {any[]} */
let mockListeIPH09 = [];
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
  useGetChats: () => ({ data: { pages: [{ data: mockListeIPH09 }] }, isLoading: false }),
}));

// COMMUNAUTES-L4 : « ma communauté » (GET /communautes/mine), posée par chaque témoin.
const mockGetMesCommunautes = jest.fn();
jest.mock('@/services/chat/communauteService', () => ({
  getMesCommunautes: (...args) => mockGetMesCommunautes(...args),
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

// RECOLTE-T11 K8 (14/11/2026, Adel « 337- B ») : ces témoins décrivent l'interrupteur
// FC_COMMUNAUTES_V1 ALLUMÉ (la recette) ; le bloc « K8 » en fin de fichier, ÉTEINT (la prod).
beforeEach(() => {
  process.env.FC_COMMUNAUTES_V1 = '1';
});
afterEach(() => {
  // `delete` ne retire rien du process.env de jest : on remet la valeur vide.
  process.env.FC_COMMUNAUTES_V1 = '';
});

beforeEach(() => {
  queryClient = creerQueryClientDeTest();
  mockLargeur = 1280;
  mockListeIPH09 = [];
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

// COMMUNAUTES-L4 (14/11/2026, D76, maquette v3 écran 1) — LA COLONNE « MESSAGES » DU SITE : la ligne
// du canal du club devient la ligne de la communauté, à sa place, avec le même identifiant de fil.
// Sans communauté (404 : serveur d'avant le socle), la colonne est celle d'aujourd'hui.
// Montage : celui de `ConversationWebMSG1W.test.js` (même écran).
const filDeTest = (documentId, type, createdAt, extra = {}) => ({
  documentId,
  groupName: documentId,
  messages: [{ createdAt, message: 'Message de test', sender: BRUNO }],
  participants: [MOI, BRUNO],
  type,
  updatedAt: '2026-10-09T23:00:00Z',
  ...extra,
});
const COMMUNAUTE = {
  annonces: 'club',
  documentId: 'club-1',
  genre: 'club',
  groupes: [{ chat: 'equipe', nonLus: 4 }, { chat: 'g2', nonLus: 2 }, { chat: 'g3', nonLus: 0 }],
  groupesAvecDuNouveau: 2,
  nom: 'AS Bellevue',
  nonLus: 7,
};
const lignesDe = (arbre) => arbre.root.findAll((n) => n.type === 'button'
  && String(n.props['data-testid'] || '').startsWith('MSG1W-ligne-'))
  .map((n) => n.props['data-testid']);

describe('COMMUNAUTES-L4 — écran 1 sur le site : la ligne de la communauté', () => {
  beforeEach(() => {
    mockGetMesCommunautes.mockReset();
    mockListeIPH09 = [
      filDeTest('equipe', 'team', '2026-10-01T10:00:00Z'),
      filDeTest('club', 'club', '2026-10-02T10:00:00Z', { club: { documentId: 'club-1', name: 'AS Bellevue' }, unreadCount: 1 }),
    ];
  });

  test('C1 — sans communauté (404) : la ligne du canal ouvre le fil, comme aujourd hui', async () => {
    mockGetMesCommunautes.mockRejectedValue(Object.assign(new Error('Not Found'), { response: { status: 404 } }));
    const { arbre, navigation } = await monter();
    const avant = lignesDe(arbre);
    expect(avant).toEqual(['MSG1W-ligne-club', 'MSG1W-ligne-equipe']);
    expect(parTestId(arbre, 'MSG1W-communaute-club')).toHaveLength(0);
    await act(async () => { parTestId(arbre, 'MSG1W-ligne-club')[0].props.onClick(); });
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.Conversation, expect.objectContaining({ chatId: 'club' }));
  });

  test('C2 — même place, même identifiant ; nom, puce, résumé, total ; ouvre la communauté', async () => {
    mockGetMesCommunautes.mockResolvedValue([COMMUNAUTE]);
    const { arbre, navigation } = await monter();
    expect(lignesDe(arbre)).toEqual(['MSG1W-ligne-club', 'MSG1W-ligne-equipe']);
    const texte = texteDe(parTestId(arbre, 'MSG1W-ligne-club')[0]);
    expect(texte).toContain('AS Bellevue');
    expect(texte).toContain('Communauté');
    expect(texte).toContain('Annonces ·');
    expect(texte).toContain('3 groupes · 2 avec du nouveau');
    expect(texte).toContain('7');
    await act(async () => { parTestId(arbre, 'MSG1W-ligne-club')[0].props.onClick(); });
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.Communautes, { genre: 'club', id: 'club-1' });
    // L'autre fil ne change pas.
    expect(texteDe(parTestId(arbre, 'MSG1W-ligne-equipe')[0])).not.toContain('Communauté');
  });
});

// RECOLTE-T11 K8 — interrupteur ÉTEINT (la prod) : rien des Communautés, et aucun appel au serveur.
describe('K8 — interrupteur FC_COMMUNAUTES_V1 éteint, sur le site', () => {
  beforeEach(() => {
    process.env.FC_COMMUNAUTES_V1 = '0';
    mockGetMesCommunautes.mockReset();
    mockListeIPH09 = [
      filDeTest('equipe', 'team', '2026-10-01T10:00:00Z'),
      filDeTest('club', 'club', '2026-10-02T10:00:00Z', { club: { documentId: 'club-1', name: 'AS Bellevue' }, unreadCount: 1 }),
    ];
  });

  test('K8-C — la ligne du canal ouvre le fil, comme au train 10 ; aucun bouton, aucun appel', async () => {
    mockGetMesCommunautes.mockResolvedValue([COMMUNAUTE]);
    const { arbre, navigation } = await monter();
    expect(lignesDe(arbre)).toEqual(['MSG1W-ligne-club', 'MSG1W-ligne-equipe']);
    expect(parTestId(arbre, 'MSG1W-communaute-club')).toHaveLength(0);
    expect(texteDe(parTestId(arbre, 'MSG1W-ligne-club')[0])).not.toContain('Communauté');
    expect(parTestId(arbre, 'messaging-communautes')).toHaveLength(0);
    await act(async () => { parTestId(arbre, 'MSG1W-ligne-club')[0].props.onClick(); });
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.Conversation, expect.objectContaining({ chatId: 'club' }));
    expect(mockGetMesCommunautes).not.toHaveBeenCalled();
  });
});
