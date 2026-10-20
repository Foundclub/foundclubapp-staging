import { fusionnerLaDernierePage, rattraperLeFil } from '@/domains/messaging/rattrapageDuFil';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import { creerQueryClientDeTest } from '@/testSupport/queryClientDeTest';

// MSGNOTIF (20/10) — la fusion du rattrapage, cas par cas. Le chemin complet
// (notification touchée, socket coupée puis revenue) est verrouillé par
// `__tests__/MSGNOTIF.messageApresNotification.test.js` ; ici, les bords que ce
// chemin ne rencontre pas : plus d'une page manquée, bulle confirmée, taille de
// page du site, serveur muet.

const mockLire = jest.fn();

jest.mock('@/services/chat/chatService', () => ({
  getChatMessages: (/** @type {any[]} */ ...args) => mockLire(...args),
}));

/**
 * Un message du fil.
 * @param {string} id L'identifiant.
 * @param {number} minute La minute d'écriture (plus grand = plus récent).
 * @param {Record<string, any>} [extra] D'autres champs.
 * @returns {any} Le message.
 */
const m = (id, minute, extra = {}) => ({
  createdAt: new Date(Date.UTC(2026, 9, 20, 8, minute)).toISOString(),
  documentId: id,
  id,
  message: id,
  ...extra,
});

/**
 * Une page telle que la rend le serveur.
 * @param {any[]} data Les messages, du plus récent au plus ancien.
 * @param {number} [numero] Le numéro de page.
 * @returns {any} La page.
 */
const page = (data, numero = 1) => ({
  data,
  meta: {
    pagination: {
      page: numero, pageCount: 5, pageSize: 20, total: 100,
    },
  },
});

/**
 * Les identifiants affichés, dans l'ordre.
 * @param {any} donnees Des pages en cache.
 * @returns {string[]} Les identifiants.
 */
const ids = (donnees) => donnees.pages
  .flatMap((/** @type {any} */ p) => p.data)
  .map((/** @type {any} */ x) => x.documentId);

/**
 * Un cache de fil à une page.
 * @param {any[]} data Les messages en cache.
 * @returns {any} Les pages en cache.
 */
const cacheDe = (data) => ({ pageParams: [1], pages: [page(data)] });

const CLEF_APP = buildNormalizedQueryKey(['chat-messages', 'chat-1'], { payload: 'light' });
const CLEF_SITE = buildNormalizedQueryKey(['chat-messages', 'chat-1'], {
  pageSize: 30,
  payload: 'light',
});

describe('fusionnerLaDernierePage', () => {
  test('rien de neuf : les MÊMES données (aucun dessin inutile)', () => {
    const cache = cacheDe([m('b', 2), m('a', 1)]);
    expect(fusionnerLaDernierePage(cache, page([m('b', 2), m('a', 1)]))).toBe(cache);
  });

  test('pas de cache : rien à rattraper', () => {
    expect(fusionnerLaDernierePage(undefined, page([m('a', 1)]))).toBeUndefined();
  });

  test('les manqués entrent en tête, à leur place ; les pages anciennes ne bougent pas', () => {
    const ancienne = page([m('x', 0)], 2);
    const cache = {
      pageParams: [1, 2],
      pages: [page([m('direct', 9), m('b', 2), m('a', 1)]), ancienne],
    };

    const lue = page([m('direct', 9), m('d', 4), m('c', 3), m('b', 2)]);
    const fusion = fusionnerLaDernierePage(cache, lue);

    expect(ids(fusion)).toEqual(['direct', 'd', 'c', 'b', 'a', 'x']);
    expect(fusion.pages[1]).toBe(ancienne);
    expect(fusion.pageParams).toEqual([1, 2]);
  });

  test('plus d\'une page manquée : on repart de la page lue, bulles locales gardées', () => {
    const echec = m('temp-1', 50, { clientMessageId: 'cmid-1', failed: true });
    const cache = { pageParams: [1, 2], pages: [page([echec, m('b', 2)]), page([m('a', 1)], 2)] };

    const fusion = fusionnerLaDernierePage(cache, page([m('z', 40), m('y', 39)]));

    expect(ids(fusion)).toEqual(['temp-1', 'z', 'y']);
    expect(fusion.pageParams).toEqual([1]);
  });

  test('une bulle reçue par le serveur (même clientMessageId) s\'efface ; une autre reste', () => {
    const confirmee = m('temp-1', 5, { clientMessageId: 'cmid-1', pending: true });
    const ratee = m('temp-2', 6, { clientMessageId: 'cmid-2', failed: true });
    const cache = cacheDe([ratee, confirmee, m('a', 1)]);

    const lue = page([m('vrai-1', 5, { clientMessageId: 'cmid-1' }), m('a', 1)]);
    const fusion = fusionnerLaDernierePage(cache, lue);

    expect(ids(fusion)).toEqual(['temp-2', 'vrai-1', 'a']);
  });
});

describe('rattraperLeFil', () => {
  /** @type {any} */
  let client;

  beforeEach(() => {
    mockLire.mockReset();
    mockLire.mockResolvedValue(page([m('neuf', 9), m('a', 1)]));
    client = creerQueryClientDeTest();
  });

  afterEach(() => client.clear());

  test('aucun cache : aucune lecture (l\'écran fera la sienne)', async () => {
    await expect(rattraperLeFil(client, 'chat-1')).resolves.toBe(false);
    expect(mockLire).not.toHaveBeenCalled();
  });

  test('deux demandes en même temps : UNE lecture', async () => {
    client.setQueryData(CLEF_APP, cacheDe([m('a', 1)]));

    await Promise.all([rattraperLeFil(client, 'chat-1'), rattraperLeFil(client, 'chat-1')]);

    expect(mockLire).toHaveBeenCalledTimes(1);
  });

  test('chaque cache est rattrapé avec SA taille de page (le site lit par 30)', async () => {
    client.setQueryData(CLEF_APP, cacheDe([m('a', 1)]));
    client.setQueryData(CLEF_SITE, cacheDe([m('a', 1)]));

    await rattraperLeFil(client, 'chat-1');

    expect(mockLire).toHaveBeenCalledWith('chat-1', 1, undefined);
    expect(mockLire).toHaveBeenCalledWith('chat-1', 1, 30);
    expect(ids(client.getQueryData(CLEF_APP))).toEqual(['neuf', 'a']);
    expect(ids(client.getQueryData(CLEF_SITE))).toEqual(['neuf', 'a']);
  });

  test('un message manquait : la liste est relue (aperçu, non-lus), UNE fois', async () => {
    client.setQueryData(CLEF_APP, cacheDe([m('a', 1)]));
    const relire = jest.spyOn(client, 'refetchQueries');

    await rattraperLeFil(client, 'chat-1');

    expect(relire).toHaveBeenCalledTimes(1);
    expect(relire).toHaveBeenCalledWith(
      { queryKey: ['chats'], type: 'all' },
      { cancelRefetch: false },
    );
  });

  test('rien ne manquait : la liste n\'est PAS relue', async () => {
    mockLire.mockResolvedValueOnce(page([m('a', 1)]));
    client.setQueryData(CLEF_APP, cacheDe([m('a', 1)]));
    const relire = jest.spyOn(client, 'refetchQueries');

    await rattraperLeFil(client, 'chat-1');

    expect(relire).not.toHaveBeenCalled();
  });

  test('le serveur ne répond pas : le cache reste tel quel, rien ne casse', async () => {
    const cache = cacheDe([m('a', 1)]);
    client.setQueryData(CLEF_APP, cache);
    mockLire.mockRejectedValueOnce(new Error('Network Error'));

    await expect(rattraperLeFil(client, 'chat-1')).resolves.toBe(false);
    expect(client.getQueryData(CLEF_APP)).toBe(cache);
  });
});
