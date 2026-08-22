import fs from 'fs';
import path from 'path';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { getChats } from '@/services/chat/chatService';

import useUnreadMessages from './useUnreadMessages';

// AC05 temoin 7 — « il manque une pastille rouge avec le NOMBRE de messages non
// ouverts sur l'icone Messages. Ca y est partiellement mais ca bugue. »
//
// 📏 CE QUI BUGUAIT, NOMME : la pastille existe bel et bien
// (PrivateTabNavigator.js, `badge: unreadCount`) et elle affiche un nombre.
// Mais `useUnreadMessages` ne lisait QUE le cache react-query `['chats']` —
// « Avoids spinning up extra messaging queries from global navigators », disait
// son commentaire. Or ce cache reste VIDE tant que l'ecran Messagerie n'a pas
// ete ouvert : au demarrage de l'app, la pastille valait donc toujours zero.
//
// Ce temoin monte le compteur SEUL, sans jamais monter l'ecran Messagerie.

jest.mock('@/store/appContext', () => ({
  storage: {
    getString: jest.fn(() => undefined),
    set: jest.fn(),
  },
}));

jest.mock('@/services/chat/chatService', () => ({
  getChats: jest.fn(),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [{ documentId: 't-1', name: 'U15 A' }],
    userData: { club: { documentId: 'c-1' }, documentId: 'moi' },
  }),
}));

const SOURCE_NAVIGATEUR = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'navigation', 'private', 'PrivateTabNavigator.js'),
  'utf8',
);

// AE06 — le serveur compte desormais les MESSAGES : `unreadCount` par fil et
// `meta.unreadTotal` sur TOUS les fils accessibles. Les trois fixtures
// ci-dessous rejouent les trois etats que l app doit savoir traverser, du plus
// riche au plus pauvre.

/** Le serveur d aujourd hui : il dit le total. */
const REPONSE_AVEC_TOTAL = {
  data: [
    { documentId: 'chat-1', messages: [], type: 'team', unreadCount: 5 },
    { documentId: 'chat-2', messages: [], type: 'team', unreadCount: 2 },
  ],
  meta: { pagination: { page: 1, pageCount: 3, total: 42 }, unreadTotal: 7 },
};

/** Un serveur qui compte par fil mais pas au total : on additionne la page. */
const REPONSE_SANS_TOTAL = {
  data: [
    { documentId: 'chat-1', messages: [], type: 'team', unreadCount: 4 },
    { documentId: 'chat-2', messages: [], type: 'team', unreadCount: 2 },
    { documentId: 'chat-3', messages: [], type: 'whisper', unreadCount: 0 },
  ],
  meta: { pagination: { page: 1, pageCount: 1, total: 3 } },
};

const REPONSE_SERVEUR = {
  data: [
    {
      documentId: 'chat-1',
      messages: [{
        createdAt: '2026-08-20T10:00:00.000Z',
        documentId: 'm-1',
        message: 'Salut',
        sender: { documentId: 'quelqu-un-d-autre' },
      }],
      type: 'team',
    },
    {
      documentId: 'chat-2',
      messages: [{
        composition: { teamName: 'U15 A', type: 'lineup_share' },
        createdAt: '2026-08-20T11:00:00.000Z',
        documentId: 'm-2',
        message: '',
        sender: { documentId: 'le-coach' },
      }],
      type: 'team',
    },
    {
      // Mon propre message : il ne compte jamais comme non lu.
      documentId: 'chat-3',
      messages: [{
        createdAt: '2026-08-20T12:00:00.000Z',
        documentId: 'm-3',
        message: 'A samedi',
        sender: { documentId: 'moi' },
      }],
      type: 'whisper',
    },
  ],
  meta: { pagination: { page: 1, pageCount: 1, total: 3 } },
};

/**
 * Monte le compteur seul et rend sa valeur.
 * @returns {Promise<{ valeur: number, arbre: any }>}
 */
const monterLeCompteur = async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  const vu = { valeur: -1 };

  /**
   * Sonde : rejoue exactement ce que fait la barre d'onglets.
   * @returns {null} Rien a peindre.
   */
  function Sonde() {
    const { unreadCount } = useUnreadMessages();
    vu.valeur = unreadCount;
    return null;
  }

  let arbre;
  await act(async () => {
    arbre = renderer.create(
      createElement(QueryClientProvider, { client: queryClient }, createElement(Sonde)),
    );
  });
  await act(async () => {
    await Promise.resolve();
  });

  return { arbre, valeur: vu.valeur };
};

describe('AC05 temoin 7 — la pastille de l icone Messages porte un NOMBRE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('le compteur se remplit SANS que l ecran Messagerie ait ete ouvert', async () => {
    // AE06 — la garantie d origine, RE-EXPRIMEE : le nombre vient du serveur
    // et arrive sans qu on ouvre l ecran. Ce qui change, c est CE qu il compte :
    // 7 MESSAGES sur 42 conversations, la ou l ancien calcul disait « 2 fils »
    // et ne voyait jamais plus loin que la page 1.
    getChats.mockResolvedValue(REPONSE_AVEC_TOTAL);

    const { arbre, valeur } = await monterLeCompteur();

    expect(valeur).toBe(7);
    // Le compteur va CHERCHER la liste : c'est tout le correctif d origine.
    expect(getChats).toHaveBeenCalled();
    arbre.unmount();
  });

  test('AE06 repli 1 — sans total, le compteur additionne les fils de la page', async () => {
    getChats.mockResolvedValue(REPONSE_SANS_TOTAL);

    const { arbre, valeur } = await monterLeCompteur();

    expect(valeur).toBe(6);
    arbre.unmount();
  });

  test('AE06 repli 2 — un serveur qui ne compte pas retombe sur l ancien calcul', async () => {
    // C est le cas si l app est deployee AVANT le serveur : rien ne casse, la
    // pastille compte des conversations comme avant. 2 fils sur 3 : le
    // troisieme est mon propre message.
    getChats.mockResolvedValue(REPONSE_SERVEUR);

    const { arbre, valeur } = await monterLeCompteur();

    expect(valeur).toBe(2);
    arbre.unmount();
  });

  test('AE06 — la pastille de l onglet porte un NOMBRE borne a 99, jamais un texte', async () => {
    // 🧨 PrivateTabNavigator.js n affiche la pastille que si `badge > 0` : une
    // chaine « 99+ » vaudrait false et FERAIT DISPARAITRE la pastille. Le
    // « 99+ » n existe que par conversation, dans la liste.
    getChats.mockResolvedValue({
      ...REPONSE_AVEC_TOTAL,
      meta: { ...REPONSE_AVEC_TOTAL.meta, unreadTotal: 150 },
    });

    const { arbre, valeur } = await monterLeCompteur();

    expect(typeof valeur).toBe('number');
    expect(valeur).toBe(99);
    arbre.unmount();
  });

  test('un serveur muet laisse la pastille eteinte, sans casser la barre', async () => {
    getChats.mockRejectedValue(new Error('reseau coupe'));

    const { arbre, valeur } = await monterLeCompteur();

    expect(valeur).toBe(0);
    arbre.unmount();
  });

  test('la barre d onglets branche bien ce nombre sur l icone Messages', () => {
    expect(SOURCE_NAVIGATEUR).toContain('const { unreadCount } = useUnreadMessages();');
    expect(SOURCE_NAVIGATEUR).toContain('badge: unreadCount,');
    // La pastille affiche le nombre, pas un simple point.
    expect(SOURCE_NAVIGATEUR).toContain('{badge}');
  });
});
