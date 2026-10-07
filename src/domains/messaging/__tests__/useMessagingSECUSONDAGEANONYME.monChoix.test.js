import { QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  emettreDuServeur,
  reinitialiserSocketDeTest,
} from '@/testSupport/msgliveSocketDouble';
import { creerQueryClientDeTest } from '@/testSupport/queryClientDeTest';

// SECU-SONDAGE-ANONYME (07/10) — « MON CHOIX » DANS UN SONDAGE ANONYME, À LA COUCHE DONNÉES.
//
// Décision d'Adel « anonyme A » : le serveur ne met plus les votants d'un sondage anonyme dans
// sa composition (elle part à tout le fil). Il n'y a plus que les compteurs. Mon choix m'arrive
// À MOI SEUL : `myOptionIds`, dans la réponse de MON vote et dans GET /poll-voters.
//
// 📏 CE QUE CE FICHIER MESURE, sur le VRAI crochet `useMessaging` et un VRAI cache react-query :
// l'app garde mon choix dans la composition en cache, sous la forme que les écrans lisent déjà
// (`voters: [moi]` sur mes options) — à l'ouverture du fil, à chaque diffusion d'un vote des
// autres, et après mon propre vote. Les écrans (bulle, détail), eux, ne changent pas :
// MESSAGERIE-1A les redessine en ce moment.

const mockGetPollVoterProfiles = jest.fn();
const mockVotePollMessage = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

jest.mock('@/hooks/useSocket', () => ({
  __esModule: true,
  default: () => ({
    isConnected: true,
    // eslint-disable-next-line global-require
    socket: require('@/testSupport/msgliveSocketDouble').socketDeTest,
  }),
  EVENTS: jest.requireActual('@/hooks/useSocket').EVENTS,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    userData: { documentId: 'moi', firstname: 'Adel' },
  }),
}));

jest.mock('@/services/chat/chatService', () => ({
  addGroupMembers: jest.fn(),
  archiveChat: jest.fn(),
  createClubChat: jest.fn(),
  createGroupChat: jest.fn(),
  createTeamChat: jest.fn(),
  createWhisperChat: jest.fn(),
  deleteMessage: jest.fn(),
  editMessage: jest.fn(),
  getChatMessages: jest.fn(),
  getChats: jest.fn(() => Promise.resolve({ data: [] })),
  getPollVoterProfiles: (/** @type {any[]} */ ...args) => mockGetPollVoterProfiles(...args),
  pinChat: jest.fn(),
  removeGroupMember: jest.fn(),
  respondProposalMessage: jest.fn(),
  unarchiveChat: jest.fn(),
  unpinChat: jest.fn(),
  updateGroupMeta: jest.fn(),
  votePollMessage: (/** @type {any[]} */ ...args) => mockVotePollMessage(...args),
}));

jest.mock('@/store/appContext', () => ({
  storage: { getString: () => undefined, set: () => {} },
  useAppContext: () => [{ auth: { token: 'jwt' } }, jest.fn()],
}));

// Le premier montage transpile tout le graphe de `useMessaging` : au-delà des 5 s par défaut
// sur un poste froid, sans que rien ne soit cassé (mesuré : ~4 s au 1er témoin, < 0,3 s ensuite).
jest.setTimeout(30000);

const CLEF_MESSAGES = buildNormalizedQueryKey(['chat-messages', 'chat-1'], {
  pageSize: undefined,
  payload: 'light',
});

// Une option : un compteur, des votants (aucun pour un sondage anonyme du serveur neuf).
const option = (/** @type {number} */ voteCount, /** @type {string[]} */ voters = []) => (
  { voteCount, voters }
);

// Un sondage tel que le serveur le rend.
const sondage = (/** @type {any} */ {
  isAnonymous = true,
  o1 = option(3),
  o2 = option(1),
} = {}) => ({
  allowMultipleVotes: false,
  isAnonymous,
  options: [{ id: 'o1', label: 'Samedi', ...o1 }, { id: 'o2', label: 'Dimanche', ...o2 }],
  question: 'Quel créneau ?',
  type: 'poll',
});

// Un message du fil, porteur d'une composition.
const unMessage = (/** @type {string} */ documentId, /** @type {any} */ composition) => ({
  chat: { documentId: 'chat-1' },
  composition,
  createdAt: '2026-10-07T18:00:00.000Z',
  documentId,
  id: documentId,
  message: '',
  readBy: [],
  sender: { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' },
});

// Le vrai crochet, branché sur un vrai cache ; rend ses fonctions (dont `votePoll`).
const monterMessagerie = (/** @type {any} */ clientRequetes) => {
  // eslint-disable-next-line global-require
  const useMessaging = require('@/domains/messaging/useMessaging').default;
  const sortie = /** @type {{ current: any }} */ ({ current: null });
  /**
   * Sonde minimale : elle allume le crochet et garde ce qu'il rend.
   * @returns {null} Rien à l'écran.
   */
  function Sonde() {
    sortie.current = useMessaging('chat-1');
    return null;
  }
  act(() => {
    renderer.create(createElement(
      QueryClientProvider,
      { client: clientRequetes },
      createElement(Sonde),
    ));
  });
  return sortie;
};

// La composition du message `id`, telle qu'en cache.
const compositionEnCache = (/** @type {any} */ clientRequetes, /** @type {string} */ id) => {
  const donnees = /** @type {any} */ (clientRequetes.getQueryData(CLEF_MESSAGES));
  return (donnees?.pages || [])
    .flatMap((/** @type {any} */ page) => page?.data || [])
    .find((/** @type {any} */ message) => message.documentId === id)?.composition;
};

// [identifiant, compteur, votants] de chaque option du message `id`.
const etat = (/** @type {any} */ clientRequetes, /** @type {string} */ id) => (
  compositionEnCache(clientRequetes, id).options
    .map((/** @type {any} */ o) => [o.id, o.voteCount, o.voters])
);

// Un tour de boucle d'événements.
const unTour = () => new Promise((resoudre) => { setTimeout(resoudre, 0); });

// Laisse filer les promesses (la lecture de mon choix) puis les écritures de cache qui suivent.
const laisserFiler = async () => {
  await act(async () => {
    await [1, 2, 3, 4, 5].reduce((avant) => avant.then(unTour), Promise.resolve());
  });
};

// Une diffusion « message-updated » du serveur pour le sondage `id`.
const diffuser = (/** @type {string} */ id, /** @type {any} */ composition) => {
  emettreDuServeur('message-updated', {
    chatDocumentId: 'chat-1',
    message: { composition, documentId: id },
  });
};

describe('SECU-SONDAGE-ANONYME — mon choix, à la couche données', () => {
  /** @type {any} */
  let clientRequetes;

  const remplirLeFil = (/** @type {any[]} */ messages) => {
    clientRequetes.setQueryData(CLEF_MESSAGES, {
      pageParams: [1],
      pages: [{
        data: messages,
        meta: { pagination: { page: 1, pageCount: 1, total: messages.length } },
      }],
    });
  };

  beforeEach(() => {
    reinitialiserSocketDeTest();
    mockGetPollVoterProfiles.mockReset();
    mockVotePollMessage.mockReset();
    clientRequetes = creerQueryClientDeTest();
  });

  afterEach(() => {
    clientRequetes.clear();
  });

  it('1. À L\'OUVERTURE DU FIL : mon choix est lu au serveur et posé dans le sondage', async () => {
    remplirLeFil([unMessage('sondage-1', sondage())]);
    mockGetPollVoterProfiles.mockResolvedValue({
      chatDocumentId: 'chat-1',
      data: [],
      messageDocumentId: 'sondage-1',
      myOptionIds: ['o2'],
    });

    monterMessagerie(clientRequetes);
    await laisserFiler();

    expect(mockGetPollVoterProfiles).toHaveBeenCalledTimes(1);
    expect(mockGetPollVoterProfiles).toHaveBeenCalledWith('sondage-1');
    expect(etat(clientRequetes, 'sondage-1')).toEqual([['o1', 3, []], ['o2', 1, ['moi']]]);
  });

  it('2. UN AUTRE VOTE EN DIRECT : les compteurs bougent, mon choix reste surligné', async () => {
    remplirLeFil([unMessage('sondage-1', sondage())]);
    mockGetPollVoterProfiles.mockResolvedValue({ data: [], myOptionIds: ['o2'] });
    monterMessagerie(clientRequetes);
    await laisserFiler();

    diffuser('sondage-1', sondage({ o1: option(4) }));

    expect(etat(clientRequetes, 'sondage-1')).toEqual([['o1', 4, []], ['o2', 1, ['moi']]]);
    expect(mockGetPollVoterProfiles).toHaveBeenCalledTimes(1);
  });

  it('3. MON VOTE : la réponse (compteurs + myOptionIds) pose mon NOUVEAU choix', async () => {
    remplirLeFil([unMessage('sondage-1', sondage())]);
    mockGetPollVoterProfiles.mockResolvedValue({ data: [], myOptionIds: ['o2'] });
    mockVotePollMessage.mockResolvedValue({
      changed: true,
      chatDocumentId: 'chat-1',
      composition: sondage({ o1: option(4), o2: option(0) }),
      messageDocumentId: 'sondage-1',
      myOptionIds: ['o1'],
      success: true,
    });
    const messagerie = monterMessagerie(clientRequetes);
    await laisserFiler();

    await act(async () => { await messagerie.current.votePoll('sondage-1', 'o1'); });
    await laisserFiler();

    expect(etat(clientRequetes, 'sondage-1')).toEqual([['o1', 4, ['moi']], ['o2', 0, []]]);
    // Une page relue (compteurs seuls) ne fait pas revenir l'ancien choix.
    remplirLeFil([unMessage('sondage-1', sondage({ o1: option(4), o2: option(0) }))]);
    await laisserFiler();
    expect(etat(clientRequetes, 'sondage-1')).toEqual([['o1', 4, ['moi']], ['o2', 0, []]]);
  });

  it('4. GARDE-FOU : un sondage VISIBLE ne lit rien, la diffusion fait foi', async () => {
    const visible = sondage({ isAnonymous: false, o1: option(1, ['karim']) });
    remplirLeFil([unMessage('sondage-v', visible)]);
    monterMessagerie(clientRequetes);
    await laisserFiler();

    diffuser('sondage-v', sondage({ isAnonymous: false, o1: option(2, ['karim', 'lea']) }));

    expect(mockGetPollVoterProfiles).not.toHaveBeenCalled();
    expect(etat(clientRequetes, 'sondage-v')).toEqual([['o1', 2, ['karim', 'lea']], ['o2', 1, []]]);
  });

  it('5. SERVEUR ANCIEN (votants dans la composition) : aucune lecture, il fait foi', async () => {
    remplirLeFil([unMessage('sondage-1', sondage({ o1: option(2, ['karim', 'moi']) }))]);
    monterMessagerie(clientRequetes);
    await laisserFiler();

    expect(mockGetPollVoterProfiles).not.toHaveBeenCalled();
    expect(etat(clientRequetes, 'sondage-1')).toEqual([['o1', 2, ['karim', 'moi']], ['o2', 1, []]]);
  });

  it('6. LECTURE IMPOSSIBLE (route absente, réseau) : une tentative, rien d\'inventé', async () => {
    remplirLeFil([unMessage('sondage-1', sondage())]);
    mockGetPollVoterProfiles.mockRejectedValue(new Error('404'));
    monterMessagerie(clientRequetes);
    await laisserFiler();

    diffuser('sondage-1', sondage({ o1: option(4) }));
    await laisserFiler();

    expect(mockGetPollVoterProfiles).toHaveBeenCalledTimes(1);
    expect(etat(clientRequetes, 'sondage-1')).toEqual([['o1', 4, []], ['o2', 1, []]]);
  });
});
