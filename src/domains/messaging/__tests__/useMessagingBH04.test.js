/* eslint-disable max-len, jsdoc/require-description, jsdoc/require-returns -- témoin BH04 : entrées du rapport gardées sur une ligne */
import { QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  emettreDuServeur,
  reinitialiserSocketDeTest,
} from '@/testSupport/msgliveSocketDouble';
import { creerQueryClientDeTest } from '@/testSupport/queryClientDeTest';

// BH04 — P1-10, P1-12, P1-15 : le vrai crochet sur un vrai cache.

let mockMessaging;
let mockChats = [];
const mockDeleteMessage = jest.fn();
const mockGetChatMessages = jest.fn();

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
  createClubChat: jest.fn(() => Promise.resolve({ documentId: 'club-neuf' })),
  createGroupChat: jest.fn(),
  createTeamChat: jest.fn(),
  createWhisperChat: jest.fn(() => Promise.resolve({ documentId: 'prive-neuf' })),
  deleteMessage: mockDeleteMessage,
  editMessage: jest.fn(),
  // C'est CE compteur qui dit si un message est arrivé par le fil ou par le
  // réseau : s'il bouge, ce n'est plus du direct.
  getChatMessages: (/** @type {any[]} */ ...args) => mockGetChatMessages(...args),
  getChats: jest.fn(() => Promise.resolve({ data: mockChats })),
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

const monter = (clientRequetes) => {
  // eslint-disable-next-line global-require
  const useMessaging = require('@/domains/messaging/useMessaging').default;
  /**
   *
   */
  function Sonde() {
    mockMessaging = useMessaging('chat-1');
    return null;
  }
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(QueryClientProvider, { client: clientRequetes }, createElement(Sonde)));
  });
  return arbre;
};

describe('BH04 — useMessaging', () => {
  let clientRequetes;
  let arbre;
  beforeEach(() => {
    reinitialiserSocketDeTest();
    clientRequetes = creerQueryClientDeTest();
    mockChats = [];
    arbre = monter(clientRequetes);
  });
  afterEach(() => {
    act(() => { arbre.unmount(); });
    clientRequetes.clear();
  });

  test('P1-10 : la discussion du club n’est pas une discussion d’équipe du même club', async () => {
    mockChats = [
      {
        club: { documentId: 'c1' }, documentId: 'equipe', participants: [], type: 'team',
      },
      {
        club: { documentId: 'c1' }, documentId: 'leclub', participants: [], type: 'club',
      },
    ];
    let chat;
    await act(async () => { chat = await mockMessaging.startClubChat('c1'); });
    expect(chat.documentId).toBe('leclub');
  });

  test('P1-12 : un message privé ne réutilise pas un groupe aux mêmes participants', async () => {
    mockChats = [
      { documentId: 'groupe', participants: [{ documentId: 'moi' }, { documentId: 'marc' }], type: 'group' },
    ];
    let chat;
    await act(async () => { chat = await mockMessaging.startWhisperChat(['marc']); });
    expect(chat?.documentId).not.toBe('groupe');
  });

  test('P1-15 : un accusé vers un message absent du cache ne marque rien comme lu', () => {
    clientRequetes.setQueryData(CLEF_MESSAGES, {
      pageParams: [1],
      pages: [{
        data: [{
          chat: { documentId: 'chat-1' },
          createdAt: new Date().toISOString(),
          documentId: 'm1',
          id: 'm1',
          message: 'Salut',
          readBy: [],
          sender: { documentId: 'moi' },
        }],
      }],
    });
    act(() => {
      emettreDuServeur('message-read', { chatDocumentId: 'chat-1', lastSeenMessageId: 'inconnu', userDocumentId: 'marc' });
    });
    const donnees = clientRequetes.getQueryData(CLEF_MESSAGES);
    expect(donnees.pages[0].data[0].readBy).toEqual([]);
  });
});
