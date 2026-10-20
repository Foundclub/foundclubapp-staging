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

// 📐 §3.1 — LA COULEUR D UN NOM. Le pack : une couleur par personne, la MEME partout. Le site
// hachait l identifiant a sa facon : Bruno n avait pas la couleur que le telephone lui donne
// (habillageDuFil.couleurDuNom, MSG1A 273e6a17).
describe('MSG1W §3.1 — la couleur d un nom, la même que sur le téléphone', () => {
  test('le nom de Bruno prend la couleur que le telephone lui donne', async () => {
    const karim = { documentId: 'karim', firstname: 'Karim' };
    mockFil = { ...mockFil, participants: [MOI, BRUNO, karim] };
    const { arbre } = await monter();
    const [nom] = parTestId(arbre, 'MSG1W-nom-m1');
    const [libelle] = nom.findAll((/** @type {any} */ n) => n.type === 'span');
    const { colors } = jest.requireActual('@/theme/colors');
    const { couleurDuNom } = jest.requireActual('@/domains/messaging/habillageDuFil');
    expect(libelle.props.style.color).toBe(couleurDuNom(colors, BRUNO.documentId));
  });
});

// 📐 §3.1 — « genre A » (Adel, 07/10) : « Dirigeant » / « Entraîneur » a cote du nom. Le contrat
// 1B §2.3 porte la clef sur `sender.staffRole`, et en repli sur `chat.staffRoles[expediteur]` : le
// telephone lit les deux (MSG1A f2a86c52) ; le site ne lisait que la premiere.
describe('MSG1W §3.1 — le rôle du staff à côté du nom (« genre A »)', () => {
  test('sans staffRole, le repli chat.staffRoles nomme Bruno « Coach / Prof »', async () => {
    mockFil = { ...mockFil, staffRoles: { bruno: 'entraineur' } };
    const { arbre } = await monter();
    const [nom] = parTestId(arbre, 'MSG1W-nom-m1');
    expect(texteDe(nom)).toBe('Bruno Dupont Coach / Prof');
  });

  test('sans aucune clef (serveur d avant 1B), rien ne s ajoute au nom', async () => {
    const { arbre } = await monter();
    const [nom] = parTestId(arbre, 'MSG1W-nom-m1');
    expect(texteDe(nom)).toBe('Bruno Dupont');
  });
});

// 📐 §3.17 — LES NOTICES DE GROUPE (contrat MESSAGERIE-1B §6) : un message SANS expediteur qui
// porte `systemNotice` se rend comme une notice discrete avec sa phrase, jamais comme une bulle.
// Le telephone le fait depuis MSG1A f2a86c52 ; le site en faisait une bulle anonyme.
describe('MSG1W §3.17 — une notice de groupe est une notice, pas une bulle', () => {
  test('« Bruno Dupont a renommé le groupe… » : centree, sans bulle ni nom', async () => {
    const phrase = 'Bruno Dupont a renommé le groupe en « Les U13 bis ».';
    mockMessagesDuFil = [...mockMessagesDuFil, {
      createdAt: '2026-10-07T08:05:00.000Z',
      documentId: 'n1',
      message: phrase,
      sender: null,
      systemNotice: {
        actor: BRUNO, groupName: 'Les U13 bis', kind: 'group_renamed', targets: [], version: 1,
      },
    }];
    const { arbre } = await monter();
    const [notice] = parTestId(arbre, 'MSG1W-notice-n1');
    expect(notice).toBeDefined();
    expect(texteDe(notice)).toBe(phrase);
    expect(parTestId(arbre, 'MSG1W-meta-n1')).toHaveLength(0);
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
// 📐 §3.16 — « Quitter le groupe » passe par la fonction de service PARTAGEE avec le telephone
// (chatService.leaveGroupChat, MSG1A), plus par un appel ecrit dans l ecran (decision `1-A`).
describe('MSG1W §3.16 — « Quitter le groupe » appelle la fonction partagée', () => {
  test('un simple membre confirme : leaveGroupChat(id du fil), puis la liste', async () => {
    mockQuitterLeGroupe.mockClear();
    mockFil = {
      documentId: CHAT_ID,
      groupAdmins: [BRUNO],
      groupName: 'Covoiturage du jeudi',
      name: 'Covoiturage du jeudi',
      participants: [MOI, BRUNO],
      type: 'group',
    };
    const { arbre, navigation } = await monter();
    const cliquer = async (/** @type {any} */ noeud) => {
      await act(async () => { await noeud.props.onClick(); });
    };
    const boutonDeTexte = (/** @type {string} */ texte) => arbre.root.findAll(
      (/** @type {any} */ n) => n.type === 'button' && texteDe(n) === texte,
    )[0];
    await cliquer(parTestId(arbre, 'MSG1W-titre-du-fil')[0]);
    await cliquer(boutonDeTexte('Quitter le groupe'));
    await cliquer(boutonDeTexte('Quitter'));
    expect(mockQuitterLeGroupe).toHaveBeenCalledWith(CHAT_ID);
    const { default: client } = jest.requireMock('@/services/client');
    expect(client.post).not.toHaveBeenCalledWith(`/chats/${CHAT_ID}/leave`);
    expect(navigation.navigate).toHaveBeenCalledWith('Chat');
  });
});

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

// 🐞 T19-RESTES (08/10, recette) — LA BULLE DE SONDAGE DU SITE NOMMAIT MAL LES VOTANTS : « Oui, 1
// vote, mouri nio » (c'était Karim) et « Non, 1 vote, Membre » (c'était Hugo). Deux causes :
// (1) le site ne demandait jamais les noms au serveur (`poll-voters`) pour un sondage visible —
// la bulle ne le fait que si on lui donne le message ; (2) son annuaire inscrivait les auteurs
// du PLUS VIEUX au plus récent, le premier inscrit gagnant : la copie FIGÉE du nom de Karim dans
// ses messages du 29/09 (« mouri nio ») passait devant son compte. ROUGE avant le lot.
describe('T19R — la bulle de sondage du site nomme les votants comme le téléphone', () => {
  const KARIM = { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' };
  const HUGO = { documentId: 'hugo', firstname: 'Hugo', lastname: 'Lemaire' };
  const etiquettes = (/** @type {any} */ arbre) => arbre.root
    .findAll((/** @type {any} */ n) => typeof n.props?.accessibilityLabel === 'string')
    .map((/** @type {any} */ n) => n.props.accessibilityLabel)
    .join(' | ');

  beforeEach(() => {
    mockLireLesVotants.mockReset();
    mockLireLesVotants.mockImplementation(() => new Promise(() => {}));
    mockMoi = { ...KARIM, role: { type: 'coach' } };
    // Le fil d'equipe U15 de la recette : aucun participant (le serveur ne les remplit pas).
    mockFil = { ...mockFil, participants: [] };
    mockMessagesDuFil = [
      {
        createdAt: '2026-09-29T19:14:15.726Z',
        documentId: 'vieux-message',
        message: 'Composition du samedi',
        sender: { documentId: 'karim', firstname: 'mouri', lastname: 'nio' },
      },
      {
        composition: {
          allowMultipleVotes: false,
          createdBy: 'karim',
          isAnonymous: false,
          options: [
            { id: 'opt-1', label: 'Oui', voters: ['karim'] },
            { id: 'opt-2', label: 'Non', voters: ['hugo'] },
          ],
          pollId: 'poll-1',
          question: 'T19 sondage noms',
          type: 'poll',
        },
        createdAt: '2026-10-08T00:06:24.241Z',
        documentId: 'msg-sondage',
        message: '',
        sender: KARIM,
      },
    ];
  });

  test('la bulle demande les noms au serveur, et les affiche', async () => {
    mockLireLesVotants.mockImplementation(() => Promise.resolve({
      chatDocumentId: CHAT_ID, data: [KARIM, HUGO], messageDocumentId: 'msg-sondage',
    }));
    const { arbre } = await monter();
    await act(async () => {
      await new Promise((fini) => { setTimeout(fini, 20); });
    });

    expect(mockLireLesVotants).toHaveBeenCalledWith('msg-sondage');
    const lu = etiquettes(arbre);
    expect(lu).toContain('Karim Benali');
    expect(lu).toContain('Hugo Lemaire');
    expect(lu).not.toContain('mouri nio');
    expect(lu).not.toContain('Membre');
  });

  test('avant la reponse du serveur : Karim garde son nom d aujourd hui', async () => {
    const { arbre } = await monter();

    const lu = etiquettes(arbre);
    expect(lu).toContain('Karim Benali');
    expect(lu).not.toContain('mouri nio');
  });
});

// IPH09 — le vrai appelant web conserve archives et epingles, et melange tous les autres types.
describe('IPH09 — ordre de la colonne Messages du site', () => {
  test('club/epingles puis dernier message ; le groupe renomme ne depasse pas le prive', async () => {
    const fil = (documentId, type, createdAt, extra = {}) => ({
      documentId,
      groupName: documentId,
      messages: createdAt ? [{ createdAt, message: 'Message de test', sender: BRUNO }] : [],
      participants: [MOI, BRUNO],
      type,
      updatedAt: '2026-10-09T23:00:00Z',
      ...extra,
    });
    mockListeIPH09 = [
      fil('equipe', 'team', '2026-10-01T10:00:00Z'),
      fil('groupe-renomme', 'group', '2026-10-08T10:00:00Z'),
      fil('prive', 'whisper', '2026-10-09T10:00:00Z'),
      fil('club', 'club', '', { club: { documentId: 'club-1', name: 'Club de test' } }),
      fil('epingle', 'whisper', '', { pinnedBy: [{ documentId: 'moi' }] }),
      fil('archive', 'group', '2026-10-09T11:00:00Z', { archivedBy: [{ documentId: 'moi' }] }),
    ];
    const { arbre } = await monter();
    const lignes = () => arbre.root.findAll((n) => n.type === 'button'
      && String(n.props['data-testid'] || '').startsWith('MSG1W-ligne-'))
      .map((n) => n.props['data-testid']);
    expect(lignes()).toEqual([
      'MSG1W-ligne-epingle', 'MSG1W-ligne-club', 'MSG1W-ligne-prive',
      'MSG1W-ligne-groupe-renomme', 'MSG1W-ligne-equipe',
    ]);
    await act(async () => { parTestId(arbre, 'ARCH-colonne-archivees')[0].props.onClick(); });
    expect(lignes()).toEqual(['MSG1W-ligne-archive']);
  });
});

// RESA-L6B-2 (20/10/2026) — E-P12, LE CANAL D'UN COMPLEXE SUR LE SITE (planche EP12 ; serveur
// RESA-L4) : comme sur le téléphone, la ligne sous le titre dit le NOMBRE de membres, et le panneau
// du groupe ne montre jamais la liste à un membre ; « Quitter le canal » et sa confirmation (Q5).
describe('RESA-L6B-2 — E-P12, le canal d’un complexe sur le site', () => {
  test('« Canal du complexe · 214 membres », pas de liste, « Quitter le canal »', async () => {
    mockFil = {
      documentId: CHAT_ID,
      groupAdmins: [BRUNO],
      groupName: 'Le Five de Montrivage',
      groupPermissions: { membersCanSendMessages: false },
      name: 'Le Five de Montrivage',
      participants: [MOI, BRUNO],
      participantsCount: 214,
      type: 'group',
    };
    const { arbre } = await monter();
    expect(texteDe(arbre.root)).toContain('Canal du complexe · 214 membres');
    expect(texteDe(arbre.root)).not.toContain('Bruno, Vous');
    const cliquer = async (/** @type {any} */ noeud) => {
      await act(async () => { await noeud.props.onClick(); });
    };
    const boutonDeTexte = (/** @type {string} */ texte) => arbre.root.findAll(
      (/** @type {any} */ n) => n.type === 'button' && texteDe(n) === texte,
    )[0];
    await cliquer(parTestId(arbre, 'MSG1W-titre-du-fil')[0]);
    expect(arbre.root.findAll((/** @type {any} */ n) => (
      String(n.props?.['data-testid'] || '').startsWith('MSG1W-membre-')
    ))).toHaveLength(0);
    await cliquer(boutonDeTexte('Quitter le canal'));
    expect(texteDe(arbre.root)).toContain('Quitter le canal « Le Five de Montrivage » ? Tu ne '
      + 'recevras plus ses nouvelles. Tu y reviendras en le remettant en favori.');
  });

  // Seuls ses gérants (administrateurs du fil) y publient : le serveur ferme l'envoi aux membres
  // (PERMISSIONS_DU_CANAL). Le téléphone le dit déjà ; le site offrait la saisie, puis un refus.
  test('un membre : pas de saisie, la barre « lecture seule » ; le gérant y écrit', async () => {
    const canal = {
      documentId: CHAT_ID,
      groupAdmins: [BRUNO],
      groupName: 'Le Five de Montrivage',
      name: 'Le Five de Montrivage',
      participants: [MOI, BRUNO],
      participantsCount: 214,
      type: 'group',
    };
    const saisies = (/** @type {any} */ arbre) => arbre.root.findAll(
      (/** @type {any} */ n) => n.type === 'textarea',
    );
    mockFil = canal;
    const { arbre } = await monter();
    expect(saisies(arbre)).toHaveLength(0);
    expect(texteDe(parTestId(arbre, 'MSG1W-lecture-seule')[0])).toContain(
      "Canal d'annonce (lecture seule)",
    );
    mockFil = { ...canal, groupAdmins: [MOI, BRUNO] };
    expect(saisies((await monter()).arbre)).toHaveLength(1);
  });

  test('vide, vu d’un membre : « Le complexe n’a encore rien publié. »', async () => {
    mockMessagesDuFil = [];
    mockFil = {
      documentId: CHAT_ID,
      groupAdmins: [BRUNO],
      groupName: 'Le Five de Montrivage',
      name: 'Le Five de Montrivage',
      participants: [MOI, BRUNO],
      participantsCount: 214,
      type: 'group',
    };
    const { arbre } = await monter();
    expect(texteDe(arbre.root)).toContain('Le complexe n’a encore rien publié.');
    expect(texteDe(arbre.root)).not.toContain('Aucun message pour le moment.');
  });
});
