import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { getChats } from '@/services/chat/chatService';

import { applyOptimisticChatRead, applyServerChatReadCounts } from './useMessaging';
import useUnreadMessages from './useUnreadMessages';

// T3-PASTILLE (03/11, Adel « 8- A ») — le compteur monté comme dans les onglets et le menu.

jest.mock('@/store/appContext', () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
}));
jest.mock('@/services/chat/chatService', () => ({ getChats: jest.fn() }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [],
    userData: { club: { documentId: 'c-a' }, documentId: 'moi' },
  }),
}));

const CANAL = {
  collectivite: { documentId: 'v1' },
  collectiviteClub: null,
  documentId: 'canal',
  type: 'collectivite_dirigeants',
  unreadCount: 1,
};
const page = (meta) => ({
  data: [],
  meta: { pagination: { page: 1, pageCount: 1, total: 0 }, ...meta },
});

/**
 * Monte le compteur et attend la réponse de la liste.
 * @param {any} reponse - La réponse de GET /chats.
 * @returns {Promise<{ client: QueryClient, lire: () => any }>} Le cache et la dernière valeur.
 */
const monter = async (reponse) => {
  /** @type {any} */ let valeur = null;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */ (getChats).mockResolvedValue(reponse);
  const Sonde = () => {
    valeur = useUnreadMessages();
    return null;
  };
  await act(async () => {
    renderer.create(createElement(QueryClientProvider, { client }, createElement(Sonde)));
    await new Promise((fin) => { setTimeout(fin, 20); });
  });
  return { client, lire: () => valeur };
};

describe('useUnreadMessages — la pastille de chaque espace', () => {
  test('19 au total, 1 dans la Ville : 19 côté club, 1 côté Ville', async () => {
    const { lire } = await monter(page({ unreadTotal: 19, unreadVille: [CANAL] }));

    expect(lire().unreadCount).toBe(19);
    expect(lire().nonLusDeLaVille('v1')).toBe(1);
  });

  test('aucun non-lu dans la Ville : 0 sur son menu', async () => {
    const { lire } = await monter(page({ unreadTotal: 19, unreadVille: [] }));

    expect(lire().nonLusDeLaVille('v1')).toBe(0);
  });

  test('un serveur sans le détail : la Ville garde le total, elle compte trop mais ne rate rien', async () => {
    const { lire } = await monter(page({ unreadTotal: 19 }));

    expect(lire().nonLusDeLaVille('v1')).toBe(19);
  });

  test('lire le fil de la Ville fait tomber sa pastille', async () => {
    const { client, lire } = await monter(page({ unreadTotal: 19, unreadVille: [CANAL] }));

    await act(async () => {
      client.setQueriesData(
        { queryKey: ['chats'] },
        (/** @type {any} */ avant) => applyOptimisticChatRead(avant, 'canal'),
      );
    });
    expect(lire().nonLusDeLaVille('v1')).toBe(0);
  });

  test('l accusé du serveur met le détail à jour', async () => {
    const { client, lire } = await monter(page({ unreadTotal: 19, unreadVille: [CANAL] }));

    await act(async () => {
      client.setQueriesData(
        { queryKey: ['chats'] },
        (/** @type {any} */ avant) => applyServerChatReadCounts(avant, 'canal', {
          ok: true, unreadCount: 0, unreadTotal: 18,
        }),
      );
    });
    expect(lire().unreadCount).toBe(18);
    expect(lire().nonLusDeLaVille('v1')).toBe(0);
  });
});
