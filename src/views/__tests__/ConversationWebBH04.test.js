/* eslint-disable max-len -- témoin BH04 : entrées du rapport gardées sur une ligne */
import { QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { creerQueryClientDeTest } from '../../testSupport/queryClientDeTest';

// BH04 — P6-01, P6-02, P6-03, P6-14 : copie du banc IPH10 (vrai écran web, transports doublés).

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

const texteDe = (/** @type {any} */ noeud) => {
  const morceaux = [];
  const parcourir = (/** @type {any} */ n) => {
    if (n === null || n === undefined || n === false) return;
    if (typeof n === 'string' || typeof n === 'number') { morceaux.push(String(n)); return; }
    (n.children || []).forEach(parcourir);
  };
  parcourir(noeud);
  return morceaux.join('');
};
const boutons = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === 'button' && texteDe(n).trim() === libelle,
);
const saisie = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === 'textarea')[0];
const ecrire = (/** @type {any} */ arbre, /** @type {string} */ texte) => act(() => {
  saisie(arbre).props.onChange({ target: { value: texte } });
});
const rendre = (/** @type {any} */ arbre, /** @type {any} */ navigation, /** @type {any} */ params) => act(async () => {
  arbre.update(
    <QueryClientProvider client={queryClient}>
      <ConversationWeb navigation={navigation} route={{ params }} />
    </QueryClientProvider>,
  );
});

const filDeLigue = (/** @type {Record<string, any>} */ plus = {}) => ({
  documentId: CHAT_ID,
  league_match: { date: '2025-06-10T16:00:00.000Z', documentId: 'match-1' },
  participants: [MOI, BRUNO],
  type: 'league_match',
  ...plus,
});
const proposition = (/** @type {any} */ auteur) => ({
  composition: {
    date: '2025-06-12T16:00:00.000Z', matchId: 'match-1', status: 'pending', type: 'proposal',
  },
  createdAt: '2026-10-07T08:00:00.000Z',
  documentId: `prop-${auteur.documentId}`,
  message: 'Proposition',
  sender: auteur,
});

describe('BH04 — messagerie du site', () => {
  test('P6-03 : l auteur ne peut pas accepter sa propre proposition de ligue', async () => {
    mockFil = filDeLigue();
    mockMessagesDuFil = [proposition(MOI)];
    const { arbre } = await monter();
    expect(boutons(arbre, 'Accepter')).toHaveLength(0);
  });

  test('P6-03 (témoin) : la proposition de l adversaire garde Accepter', async () => {
    mockFil = filDeLigue();
    mockMessagesDuFil = [proposition(BRUNO)];
    const { arbre } = await monter();
    expect(boutons(arbre, 'Accepter')).toHaveLength(1);
  });

  test('P6-01 : la proposition est pré-remplie à l heure LOCALE du match', async () => {
    mockFil = filDeLigue();
    const { arbre } = await monter();
    // Le menu « + » écoute Échap et les clics du document : un document minimal suffit ici.
    global.document = /** @type {any} */ ({ addEventListener: jest.fn(), removeEventListener: jest.fn() });
    await act(async () => { boutons(arbre, 'Ajouter')[0].props.onClick(); });
    await act(async () => { boutons(arbre, 'Proposition de match')[0].props.onClick(); });
    const jour = arbre.root.findAll((/** @type {any} */ n) => n.type === 'input' && n.props.type === 'date')[0];
    const heure = arbre.root.findAll((/** @type {any} */ n) => n.type === 'input' && n.props.type === 'time')[0];
    // Relu comme l envoi le relit (heure locale), le créneau doit retomber sur le match.
    const creneau = `${jour.props.value}T${heure.props.value}:00`;
    act(() => { montes.splice(0).forEach((a) => a.unmount()); });
    delete global.document;
    expect(new Date(creneau).toISOString()).toBe('2025-06-10T16:00:00.000Z');
  });

  test('P6-02 : changer de fil vide le brouillon et arrête la frappe du fil quitté', async () => {
    const { arbre, navigation } = await monter();
    ecrire(arbre, 'brouillon pour A');
    await rendre(arbre, navigation, { chatId: 'fil-b' });
    expect(saisie(arbre).props.value).toBe('');
    expect(mockStopFrappe).toHaveBeenCalledWith(CHAT_ID);
  });

  test('P6-14 : partager un événement garde le brouillon', async () => {
    const { arbre, navigation } = await monter();
    ecrire(arbre, 'mon brouillon');
    await rendre(arbre, navigation, {
      chatId: CHAT_ID,
      sharedEventFromPicker: { documentId: 'evt-9', name: 'Tournoi' },
    });
    expect(saisie(arbre).props.value).toBe('mon brouillon');
  });

  test('P6-07 : charger d anciens messages ne ramène pas tout en bas', async () => {
    /** @type {any[]} */
    const noeuds = [];
    const options = {
      createNodeMock: () => {
        const noeud = { scrollHeight: 1000, scrollTop: 0 };
        noeuds.push(noeud);
        return noeud;
      },
    };
    const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() };
    const ecran = () => (
      <QueryClientProvider client={queryClient}>
        <ConversationWeb navigation={navigation} route={{ params: { chatId: CHAT_ID } }} />
      </QueryClientProvider>
    );
    /** @type {any} */
    let arbre;
    await act(async () => { arbre = renderer.create(ecran(), options); });
    montes.push(arbre);
    await act(async () => { await new Promise((r) => { setTimeout(r, 30); }); });
    noeuds.forEach((n) => { Object.assign(n, { scrollTop: 5 }); });
    mockMessagesDuFil = [
      ...mockMessagesDuFil,
      {
        createdAt: '2026-10-01T08:00:00.000Z', documentId: 'vieux', message: 'Ancien', sender: BRUNO,
      },
    ];
    await act(async () => { arbre.update(ecran()); });
    await act(async () => { await new Promise((r) => { setTimeout(r, 30); }); });
    expect(noeuds.filter((n) => n.scrollTop === 1000)).toHaveLength(0);
  });

  test('Q4-12 (P6-06) : les événements à partager excluent le type « Réservation » (accent)', async () => {
    // eslint-disable-next-line global-require
    const { getEvents } = require('@/services/event/eventService');
    getEvents.mockClear();
    await monter();
    await act(async () => { await new Promise((r) => { setTimeout(r, 10); }); });
    const filtres = getEvents.mock.calls.map((/** @type {any[]} */ c) => c[0]).filter((/** @type {any} */ f) => f?.myTeams);
    expect(filtres.length).toBeGreaterThan(0);
    filtres.forEach((/** @type {any} */ f) => expect(f.excludeType).toBe('Réservation'));
  });

  test('Q4-20 (P6-15) : voter sur un sondage pas encore confirmé (temp-) n appelle pas le serveur', async () => {
    const alerte = jest.fn();
    global.window.alert = alerte;
    mockVoter.mockClear();
    mockMessagesDuFil = [{
      composition: { options: [{ id: 'o1', text: 'Oui', votes: [] }], question: 'On joue ?', type: 'poll' },
      createdAt: '2026-10-07T08:00:00.000Z',
      documentId: 'temp-123',
      id: 'temp-123',
      sender: MOI,
    }];
    const { arbre } = await monter();
    const bulle = arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.onVote === 'function')[0];
    await act(async () => { await bulle.props.onVote('o1'); });
    expect(mockVoter).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalledWith('Le sondage est en cours de synchronisation.');
  });
});
