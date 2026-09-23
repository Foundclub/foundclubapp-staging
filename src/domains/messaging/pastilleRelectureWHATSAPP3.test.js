import fs from 'fs';
import path from 'path';

import {
  shouldRefetchUnreadOnMessage,
  UNREAD_REFETCH_COOLDOWN_MS,
} from './messagingUseCases';

// WHATSAPP3 / PASTILLE — 🔴 LE COMPTEUR DE NON-LUS SE RELIT, IL NE S INVENTE PAS.
//
// Decision du chef d orchestre (23/09, « option D ») : quand un message d AUTRUI
// arrive pour un fil qui N EST PAS ouvert, on RELIT le compteur du serveur au
// lieu de l incrementer a la main.
//
// 🧮 POURQUOI ON NE COMPTE PAS SOI-MEME. Ce compteur se calcule cote serveur en
// comparant des COUPLES (message, lecture), avec un plafond a 100, sur deux
// repliques (memoire `piege-pastille-messages-lignes-vs-lectures-et-repliques`).
// Un « +1 » local paraitrait juste et divergerait en silence — et un chiffre faux
// s affiche a tout le monde. Relire est idempotent : deux ecouteurs qui relisent
// donnent le meme chiffre.
//
// ⏱️ ET UN FREIN. Dix messages qui arrivent en rafale ne doivent declencher
// qu UNE lecture, pas dix : c est tout l objet de `UNREAD_REFETCH_COOLDOWN_MS`.
//
// Ce fichier fige les quatre cas demandes, plus les cas limites.

const MOI = 'moi-1';
const AUTRE = 'lui-2';

/**
 * Un message recu, au format de la socket.
 * @param auteur
 * @param chatId
 */
const message = (/** @type {string} */ auteur, /** @type {string} */ chatId) => ({
  chat: { documentId: chatId },
  documentId: `msg-${Math.random()}`,
  sender: { documentId: auteur },
});

describe('WHATSAPP3 — quand relire le compteur de non-lus', () => {
  it('✅ un message d AUTRUI dans un fil NON ouvert : on relit', () => {
    expect(shouldRefetchUnreadOnMessage({
      currentChatId: 'chat-ouvert',
      lastRefetchAt: 0,
      message: message(AUTRE, 'chat-autre'),
      myUserId: MOI,
      now: 10_000,
    })).toBe(true);
  });

  it('⛔ MON propre message : jamais — je viens de l ecrire, il est lu', () => {
    expect(shouldRefetchUnreadOnMessage({
      currentChatId: 'chat-ouvert',
      lastRefetchAt: 0,
      message: message(MOI, 'chat-autre'),
      myUserId: MOI,
      now: 10_000,
    })).toBe(false);
  });

  it('⛔ un message dans le fil OUVERT : jamais — je suis en train de le lire', () => {
    expect(shouldRefetchUnreadOnMessage({
      currentChatId: 'chat-ouvert',
      lastRefetchAt: 0,
      message: message(AUTRE, 'chat-ouvert'),
      myUserId: MOI,
      now: 10_000,
    })).toBe(false);
  });

  it('⏱️ dix messages en rafale : UNE seule relecture', () => {
    let derniere = 0;
    let relectures = 0;

    for (let i = 0; i < 10; i += 1) {
      // Dix messages en 900 ms, soit moins que le frein.
      const now = 1_000 + (i * 100);
      if (shouldRefetchUnreadOnMessage({
        currentChatId: 'chat-ouvert',
        lastRefetchAt: derniere,
        message: message(AUTRE, 'chat-autre'),
        myUserId: MOI,
        now,
      })) {
        relectures += 1;
        derniere = now;
      }
    }

    expect(relectures).toBe(1);
  });

  it('⏱️ mais passe le frein, on relit de nouveau', () => {
    const premiere = 1_000;

    expect(shouldRefetchUnreadOnMessage({
      currentChatId: 'chat-ouvert',
      lastRefetchAt: premiere,
      message: message(AUTRE, 'chat-autre'),
      myUserId: MOI,
      now: premiere + UNREAD_REFETCH_COOLDOWN_MS + 1,
    })).toBe(true);
  });

  it('le frein dure environ deux secondes : assez pour une rafale, pas plus', () => {
    expect(UNREAD_REFETCH_COOLDOWN_MS).toBeGreaterThanOrEqual(1_000);
    expect(UNREAD_REFETCH_COOLDOWN_MS).toBeLessThanOrEqual(5_000);
  });

  it('sans fil ouvert (on regarde la LISTE), un message d autrui fait relire', () => {
    expect(shouldRefetchUnreadOnMessage({
      currentChatId: undefined,
      lastRefetchAt: 0,
      message: message(AUTRE, 'chat-autre'),
      myUserId: MOI,
      now: 10_000,
    })).toBe(true);
  });

  it('un expediteur inconnu est traite comme AUTRUI : on prefere relire pour rien', () => {
    expect(shouldRefetchUnreadOnMessage({
      currentChatId: 'chat-ouvert',
      lastRefetchAt: 0,
      message: { chat: { documentId: 'chat-autre' } },
      myUserId: MOI,
      now: 10_000,
    })).toBe(true);
  });

  it('sans mon identifiant, on ne devine pas : on relit', () => {
    expect(shouldRefetchUnreadOnMessage({
      lastRefetchAt: 0,
      message: message(AUTRE, 'chat-autre'),
      now: 10_000,
    })).toBe(true);
  });

  it('ne rend jamais rien d absurde quand on ne lui donne rien', () => {
    expect(typeof shouldRefetchUnreadOnMessage({})).toBe('boolean');
    expect(typeof shouldRefetchUnreadOnMessage()).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP3 — 🔁 DEUX ECOUTEURS, UN MESSAGE, UNE SEULE INSERTION.
//
// Depuis que la LISTE ecoute la socket elle aussi, le cas « deux ecouteurs
// montes en meme temps » (la liste ET une conversation) devient COURANT — il
// etait rare avant. Le meme message arrive alors deux fois dans le cache.
//
// ✅ `handleNewMessage` s en protege deja : il cherche le message dans la
// premiere page avant d inserer (`messageExists`). Ce temoin fige cette
// garantie, parce que c est mon changement qui rend le cas frequent : si un
// jour quelqu un retire ce controle, ce sont des messages en double a l ecran.
// ─────────────────────────────────────────────────────────────────────────────

/** Le cache d une conversation, tel que react-query le range. */
const cacheAvecMessages = (/** @type {any[]} */ messages) => ({
  pageParams: [null],
  pages: [{
    data: messages,
    meta: { pagination: { page: 1, pageCount: 1, total: messages.length } },
  }],
});

/**
 * Rejoue l insertion telle que `handleNewMessage` la fait : on n ajoute que si
 * le message n est pas deja dans la premiere page.
 * @param {any} cache Le cache courant.
 * @param {any} recu Le message recu.
 * @returns {any} Le cache apres coup.
 */
const insererCommeLEcran = (cache, recu) => {
  const premierePage = cache.pages[0]?.data ?? [];
  const dejaLa = premierePage.some(
    (/** @type {any} */ m) => m.documentId === recu.documentId
      || (recu.clientMessageId && m.clientMessageId === recu.clientMessageId),
  );
  if (dejaLa) return cache;
  return {
    ...cache,
    pages: [{ ...cache.pages[0], data: [recu, ...premierePage] }, ...cache.pages.slice(1)],
  };
};

describe('WHATSAPP3 — un message recu deux fois n apparait qu une fois', () => {
  it('deux ecouteurs, un message : UNE seule insertion', () => {
    const recu = { clientMessageId: '', documentId: 'msg-1', message: 'Salut' };
    let cache = cacheAvecMessages([]);

    // L ecouteur de la liste, puis celui de la conversation ouverte.
    cache = insererCommeLEcran(cache, recu);
    cache = insererCommeLEcran(cache, recu);

    expect(cache.pages[0].data).toHaveLength(1);
    expect(cache.pages[0].data[0].documentId).toBe('msg-1');
  });

  it('deux messages DIFFERENTS entrent bien tous les deux', () => {
    let cache = cacheAvecMessages([]);

    cache = insererCommeLEcran(cache, { documentId: 'msg-1', message: 'Un' });
    cache = insererCommeLEcran(cache, { documentId: 'msg-2', message: 'Deux' });

    expect(cache.pages[0].data.map((/** @type {any} */ m) => m.documentId))
      .toEqual(['msg-2', 'msg-1']);
  });

  it('🔒 et le controle existe TOUJOURS dans l ecran : sinon ce temoin ne prouve rien', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'useMessaging.js'),
      'utf8',
    );

    expect(source).toMatch(/const messageExists = firstPageData\.some\(/);
  });
});
