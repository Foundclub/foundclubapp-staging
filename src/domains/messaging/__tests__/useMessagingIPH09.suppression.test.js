import { QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  emettreDuServeur,
  reinitialiserSocketDeTest,
} from '@/testSupport/msgliveSocketDouble';
import { creerQueryClientDeTest } from '@/testSupport/queryClientDeTest';

// IPH09 — HTTP et les deux payloads socket du serveur de production.
// Le vrai hook écrit dans un vrai QueryClient, avec des données fabriquées.

let mockMessaging;
const mockDeleteMessage = jest.fn();
const mockGetChatMessages = jest.fn();
const mockMountedProbes = new Set();

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
  deleteMessage: mockDeleteMessage,
  editMessage: jest.fn(),
  // C'est CE compteur qui dit si un message est arrivé par le fil ou par le
  // réseau : s'il bouge, ce n'est plus du direct.
  getChatMessages: (/** @type {any[]} */ ...args) => mockGetChatMessages(...args),
  getChats: jest.fn(() => Promise.resolve({ data: [] })),
  pinChat: jest.fn(),
  removeGroupMember: jest.fn(),
  respondProposalMessage: jest.fn(),
  unarchiveChat: jest.fn(),
  unpinChat: jest.fn(),
  updateGroupMeta: jest.fn(),
  votePollMessage: jest.fn(),
}));

jest.mock('@/store/appContext', () => ({
  storage: { getString: () => undefined, set: () => {} },
  useAppContext: () => [{ auth: { token: 'jwt' } }, jest.fn()],
}));

const CLEF_MESSAGES = buildNormalizedQueryKey(['chat-messages', 'chat-1'], {
  pageSize: undefined,
  payload: 'light',
});

/**
 * Fabrique un message tel que le serveur le diffuse.
 * @param {string} documentId - Identifiant du message.
 * @param {string} texte - Le texte du message.
 * @returns {any} Le message.
 */
const unMessage = (documentId, texte) => ({
  chat: { documentId: 'chat-1' },
  createdAt: new Date().toISOString(),
  documentId,
  id: documentId,
  message: texte,
  readBy: [],
  sender: { documentId: 'marc', firstname: 'Marc', lastname: 'Durand' },
});

/**
 * Monte le vrai crochet de messagerie sur un vrai cache react-query.
 * @param {any} clientRequetes - Le client react-query du témoin.
 * @returns {{ arbre: any }} L'arbre monté.
 */
const monterMessagerie = (clientRequetes) => {
  // eslint-disable-next-line global-require
  const useMessaging = require('@/domains/messaging/useMessaging').default;
  let messaging;
  /**
   * Sonde minimale : elle ne fait qu'allumer le crochet.
   * @returns {null} Rien à l'écran.
   */
  function Sonde() {
    messaging = useMessaging('chat-1');
    return null;
  }
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client: clientRequetes },
      createElement(Sonde),
    ));
  });
  // Une ancienne sonde qui se réveille ne doit pas remplacer la sonde courante.
  mockMessaging = messaging;
  mockMountedProbes.add(arbre);
  return { arbre, messaging };
};

/**
 * Les messages actuellement dans le cache, du plus récent au plus ancien.
 * @param {any} clientRequetes - Le client react-query du témoin.
 * @returns {any[]} Les messages.
 */
const messagesEnCache = (clientRequetes) => {
  const donnees = /** @type {any} */ (clientRequetes.getQueryData(CLEF_MESSAGES));
  return (donnees?.pages || []).flatMap((/** @type {any} */ page) => page?.data || []);
};

describe('IPH09 — suppression HTTP et socket sur le vrai cache', () => {
  let clientRequetes;
  beforeEach(() => {
    jest.clearAllMocks();
    reinitialiserSocketDeTest();
    clientRequetes = creerQueryClientDeTest();
    clientRequetes.setQueryData(CLEF_MESSAGES, {
      pageParams: [1], pages: [{ data: [unMessage('dernier', 'Nouveau'), unMessage('ancien', 'Salut')] }],
    });
    mockDeleteMessage.mockReset().mockImplementation((messageDocumentId) => Promise.resolve({
      chatDocumentId: 'chat-1', deleted: true, messageDocumentId,
    }));
    monterMessagerie(clientRequetes);
  });
  afterEach(() => {
    act(() => { mockMountedProbes.forEach((arbre) => arbre.unmount()); });
    mockMountedProbes.clear();
    clientRequetes.clear();
    mockMessaging = undefined;
  });

  test('HTTP réussi retire seulement le bon message sans attendre le socket', async () => {
    await act(async () => { await mockMessaging.deleteMessage('dernier'); });
    expect(messagesEnCache(clientRequetes).map((m) => m.documentId)).toEqual(['ancien']);
    expect(mockGetChatMessages).not.toHaveBeenCalled();
  });
  test('HTTP refusé conserve le message et permet une nouvelle tentative', async () => {
    mockDeleteMessage.mockRejectedValueOnce(new Error('403'));
    await act(async () => {
      await expect(mockMessaging.deleteMessage('dernier')).rejects.toThrow('403');
    });
    expect(messagesEnCache(clientRequetes)).toHaveLength(2);
    await act(async () => { await mockMessaging.deleteMessage('dernier'); });
    expect(messagesEnCache(clientRequetes).map((m) => m.documentId)).toEqual(['ancien']);
  });
  test('le payload du lifecycle prod sans chat est accepté, et ses doublons sont idempotents', () => {
    emettreDuServeur('message-deleted', { documentId: 'dernier', message: 'Message removed' });
    expect(messagesEnCache(clientRequetes).map((m) => m.documentId)).toEqual(['ancien']);
    const after = clientRequetes.getQueryData(CLEF_MESSAGES);
    emettreDuServeur('message-deleted', { chatDocumentId: 'chat-1', messageDocumentId: 'dernier' });
    expect(clientRequetes.getQueryData(CLEF_MESSAGES)).toBe(after);
    expect(mockGetChatMessages).not.toHaveBeenCalled();
  });
  test('supprimer le dernier puis le seul message laisse un cache vide stable', async () => {
    await act(async () => { await mockMessaging.deleteMessage('dernier'); });
    await act(async () => { await mockMessaging.deleteMessage('ancien'); });
    const empty = clientRequetes.getQueryData(CLEF_MESSAGES);
    expect(messagesEnCache(clientRequetes)).toEqual([]);
    emettreDuServeur('message-deleted', { chatDocumentId: 'chat-1', documentId: 'ancien' });
    expect(clientRequetes.getQueryData(CLEF_MESSAGES)).toBe(empty);
    expect(mockGetChatMessages).not.toHaveBeenCalled();
  });
  test('un événement d’un autre fil ne retire rien du fil ouvert', () => {
    emettreDuServeur('message-deleted', { chatDocumentId: 'chat-autre', documentId: 'dernier' });
    expect(messagesEnCache(clientRequetes)).toHaveLength(2);
  });
  test('une mutation d’une sonde antérieure ne détourne pas la suppression du cache courant', async () => {
    const previousClient = creerQueryClientDeTest();
    previousClient.setQueryData(CLEF_MESSAGES, { pages: [{ data: [unMessage('ancien', 'Autre cache')] }] });
    const previousProbe = monterMessagerie(previousClient);
    const previousMessaging = mockMessaging;
    const currentProbe = monterMessagerie(clientRequetes);
    const currentMessaging = mockMessaging;
    try {
      await act(async () => { await currentMessaging.deleteMessage('dernier'); });
      // La notification React Query de l'ancien arbre arrive entre deux suppressions.
      await act(async () => {
        await previousMessaging.deleteMessage('ancien');
        await new Promise((resolve) => { setTimeout(resolve, 0); });
      });
      await act(async () => { await mockMessaging.deleteMessage('ancien'); });
      expect(mockDeleteMessage.mock.calls.map(([id]) => id)).toEqual(['dernier', 'ancien', 'ancien']);
      expect(messagesEnCache(clientRequetes)).toEqual([]);
    } finally {
      act(() => { previousProbe.arbre.unmount(); currentProbe.arbre.unmount(); });
      mockMountedProbes.delete(previousProbe.arbre);
      mockMountedProbes.delete(currentProbe.arbre);
      previousClient.clear();
    }
  });
  test('la suppression du dernier remplace son aperçu, avec le contrat lifecycle puis controller', () => {
    const other = { documentId: 'autre-fil', messages: [unMessage('ailleurs', 'Autre')] };
    clientRequetes.setQueryData(['chats', 'page'], {
      pages: [{ data: [{ documentId: 'chat-1', messages: [unMessage('dernier', 'Nouveau')] }, other] }],
    });
    emettreDuServeur('message-deleted', { documentId: 'dernier' });
    const after = clientRequetes.getQueryData(['chats', 'page']);
    expect(after.pages[0].data[0].messages[0].documentId).toBe('ancien');
    expect(after.pages[0].data[1]).toBe(other);
    emettreDuServeur('message-deleted', { chatDocumentId: 'chat-1', documentId: 'dernier' });
    expect(clientRequetes.getQueryData(['chats', 'page'])).toBe(after);
    emettreDuServeur('message-deleted', { chatDocumentId: 'chat-1', documentId: 'ancien' });
    expect(clientRequetes.getQueryData(['chats', 'page']).pages[0].data[0].messages).toEqual([]);
  });
  test('pièces jointes et composition des messages survivants restent intacts', async () => {
    const survivor = {
      ...unMessage('sondage', 'Question'),
      attachments: [{ documentId: 'fichier' }],
      composition: { options: [{ id: 'oui' }], type: 'poll' },
      reactions: [{ emoji: '👍' }],
    };
    clientRequetes.setQueryData(CLEF_MESSAGES, { pages: [{ data: [unMessage('dernier', 'Texte'), survivor] }] });
    const cachedSurvivor = messagesEnCache(clientRequetes)[1];
    await act(async () => { await mockMessaging.deleteMessage('dernier'); });
    // React Query partage les objets par index : déplacer une ligne peut changer
    // sa référence, mais aucun champ du message survivant ne doit changer.
    expect(messagesEnCache(clientRequetes)[0]).toStrictEqual(cachedSurvivor);
    expect(survivor.attachments[0].documentId).toBe('fichier');
    expect(survivor.composition.options[0].id).toBe('oui');
    expect(survivor.reactions[0].emoji).toBe('👍');
  });
});
