import { useGetChatMessages, useGetChats } from '../chatQueries';

// FIN-CLOCHE p64 (récolte train 1, 02/11) — `useUnreadMessages` vit dans la coque du site :
// une réponse de GET /chats sans `meta.pagination` y levait une TypeError qui écrasait TOUT le site
// (« Une erreur est survenue »), 57 rouges à la porte complète.
// Sans pagination : pas de page suivante.

jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (/** @type {any} */ options) => options,
  useQuery: jest.fn(),
}));

jest.mock('../chatService', () => ({
  getChatById: jest.fn(),
  getChatMessageReactions: jest.fn(),
  getChatMessages: jest.fn(),
  getChats: jest.fn(),
}));

const lecteur = (/** @type {any} */ crochet, /** @type {any} */ parametres) => (
  crochet(parametres).getNextPageParam
);

const lecteurs = [
  ['useGetChats', lecteur(useGetChats, { currentUserId: 'u1' })],
  ['useGetChatMessages', lecteur(useGetChatMessages, { chatId: 'c1' })],
];

describe.each(lecteurs)('%s, page suivante', (_nom, pageSuivante) => {
  test.each([
    ['sans meta', { data: [] }],
    ['meta vide', { data: [], meta: {} }],
    ['aucune page', undefined],
  ])('🔴 %s : pas de page suivante, rien ne casse', (_cas, reponse) => {
    expect(pageSuivante(reponse)).toBeUndefined();
  });

  test('🔒 avec la pagination : la page suivante, puis plus rien à la dernière', () => {
    expect(pageSuivante({ meta: { pagination: { page: 1, pageCount: 3 } } })).toBe(2);
    expect(pageSuivante({ meta: { pagination: { page: 3, pageCount: 3 } } })).toBeUndefined();
  });
});
