import { io } from 'socket.io-client';

import {
  connectSharedSocket,
  disconnectSharedSocket,
  getSharedSocket,
  reviveSharedSocket,
  subscribeSocketConnection,
} from '@/services/socket/socketManager';

/**
 * PERF1 - LE TEMPS REEL QUI NE REVIENT PAS APRES UN DEPLOIEMENT.
 *
 * `socketManager.js` n'avait AUCUN temoin (E6). Ceux-ci font deux choses :
 *  1. CARACTERISER le comportement du 33d8ef5f : la socket partagee, ses
 *     abonnes, et le fait que `connectSharedSocket(memeJeton)` rend une socket
 *     morte TELLE QUELLE - le reveil est un export dedie, pas un effet de bord ;
 *  2. PROUVER le correctif : l'abandon (`reconnect_failed`) est un evenement de
 *     MANAGER (`socket.io`), jamais relaye a la socket. Verifie dans
 *     socket.io-client `socket.js:152-162` : `subEvents()` ne relaie que
 *     `open`, `packet`, `error`, `close`. Un `socket.on('reconnect_failed')`
 *     ne se declencherait JAMAIS - c'est le piege qui a produit les 4 lots
 *     EVEDIT verts sur un defaut vivant.
 *
 * Le faux `io` separe donc VRAIMENT les deux etages d'ecouteurs : ceux de la
 * socket (`on`/`off`) et ceux du Manager (`io.on`/`io.off`). Un correctif pose
 * au mauvais etage reste rouge ici.
 */

jest.mock('socket.io-client', () => {
  /**
   * Fabrique une fausse socket avec ses deux etages d'ecouteurs, comme la vraie.
   * @returns {any} La fausse socket pilotable depuis les temoins.
   */
  const buildFakeSocket = () => {
    /** @type {Map<string, Set<any>>} */
    const managerListeners = new Map();
    /** @type {Map<string, Set<any>>} */
    const socketListeners = new Map();

    /**
     * Rend (en le creant au besoin) le jeu d'ecouteurs d'un evenement.
     * @param {Map<string, Set<any>>} registry L'etage vise (socket ou Manager).
     * @param {string} event Le nom de l'evenement.
     * @returns {Set<any>} Les ecouteurs de cet evenement.
     */
    const listenersOf = (registry, event) => {
      if (!registry.has(event)) registry.set(event, new Set());
      return registry.get(event);
    };

    const fakeSocket = {
      connect: jest.fn(),
      connected: false,
      disconnect: jest.fn(),
      fireManagerEvent: (event, ...args) => {
        [...listenersOf(managerListeners, event)].forEach((listener) => listener(...args));
      },
      fireSocketEvent: (event, ...args) => {
        [...listenersOf(socketListeners, event)].forEach((listener) => listener(...args));
      },
      io: {
        managerListenerCount: (event) => listenersOf(managerListeners, event).size,
        off: (event, listener) => {
          if (listener) listenersOf(managerListeners, event).delete(listener);
          else managerListeners.delete(event);
        },
        on: (event, listener) => {
          listenersOf(managerListeners, event).add(listener);
        },
      },
      off: (event, listener) => {
        if (listener) listenersOf(socketListeners, event).delete(listener);
        else socketListeners.delete(event);
      },
      on: (event, listener) => {
        listenersOf(socketListeners, event).add(listener);
      },
    };
    return fakeSocket;
  };

  return { io: jest.fn(() => buildFakeSocket()) };
});

describe('PERF1 - socketManager : la socket partagee et l\'abandon de reconnexion', () => {
  afterEach(() => {
    // L'etat de module (sharedSocket, sharedToken) survit entre les temoins :
    // sans ce demontage, le 2e temoin lirait la socket du 1er.
    disconnectSharedSocket();
    jest.clearAllMocks();
  });

  describe('caracterisation du comportement actuel', () => {
    it('cree la socket avec une reconnexion bornee a 5 tentatives', () => {
      connectSharedSocket('jeton-a');

      expect(io).toHaveBeenCalledTimes(1);
      expect(io.mock.calls[0][1]).toMatchObject({
        reconnection: true,
        reconnectionAttempts: 5,
      });
    });

    it('rend une socket morte TELLE QUELLE au meme jeton, sans la reveiller', () => {
      const socket = connectSharedSocket('jeton-a');

      const again = connectSharedSocket('jeton-a');

      expect(again).toBe(socket);
      expect(io).toHaveBeenCalledTimes(1);
      // Le defaut P4, assume : le reveil passe par reviveSharedSocket, jamais
      // par un effet de bord de connectSharedSocket.
      expect(socket.connect).not.toHaveBeenCalled();
    });

    it('previent les abonnes a la connexion et a la deconnexion', () => {
      connectSharedSocket('jeton-a');
      const socket = getSharedSocket();
      const subscriber = jest.fn();
      const unsubscribe = subscribeSocketConnection(subscriber);

      expect(subscriber).toHaveBeenLastCalledWith(false);

      socket.fireSocketEvent('connect');
      expect(subscriber).toHaveBeenLastCalledWith(true);

      socket.fireSocketEvent('disconnect', 'transport close');
      expect(subscriber).toHaveBeenLastCalledWith(false);

      unsubscribe();
    });
  });

  describe('le correctif : ecouter l\'abandon sur le MANAGER (rouge avant)', () => {
    it('pose un ecouteur reconnect_failed sur le Manager, pas sur la socket', () => {
      const socket = connectSharedSocket('jeton-a');

      expect(socket.io.managerListenerCount('reconnect_failed')).toBe(1);
    });

    it('previent les abonnes (false) quand le Manager abandonne', () => {
      const socket = connectSharedSocket('jeton-a');
      const subscriber = jest.fn();
      const unsubscribe = subscribeSocketConnection(subscriber);
      subscriber.mockClear();

      socket.fireManagerEvent('reconnect_failed');

      expect(subscriber).toHaveBeenCalledWith(false);
      unsubscribe();
    });

    it('repose l\'ecouteur sur le NOUVEAU Manager au changement de jeton', () => {
      // P5 : au 2e io(memeUrl), socket.io-client construit un Manager NEUF
      // (index.js:31-39) - un ecouteur pose une seule fois au chargement du
      // module serait perdu ici.
      const first = connectSharedSocket('jeton-a');
      const second = connectSharedSocket('jeton-b');

      expect(second).not.toBe(first);
      expect(first.io.managerListenerCount('reconnect_failed')).toBe(0);
      expect(second.io.managerListenerCount('reconnect_failed')).toBe(1);
    });

    it('garde-fou : apres disconnectSharedSocket, l\'abandon ne previent personne', () => {
      const socket = connectSharedSocket('jeton-a');
      const subscriber = jest.fn();
      const unsubscribe = subscribeSocketConnection(subscriber);
      disconnectSharedSocket();
      subscriber.mockClear();

      socket.fireManagerEvent('reconnect_failed');

      expect(subscriber).not.toHaveBeenCalled();
      unsubscribe();
    });
  });

  describe('le reveil dedie reviveSharedSocket (rouge avant)', () => {
    it('rappelle .connect() sur une socket morte - pas seulement un appel de facade', () => {
      const socket = connectSharedSocket('jeton-a');

      expect(reviveSharedSocket()).toBe(true);

      expect(socket.connect).toHaveBeenCalledTimes(1);
    });

    it('ne touche pas une socket deja connectee', () => {
      const socket = connectSharedSocket('jeton-a');
      socket.connected = true;

      expect(reviveSharedSocket()).toBe(false);

      expect(socket.connect).not.toHaveBeenCalled();
    });

    it('ne jette pas quand aucune socket n\'existe', () => {
      expect(reviveSharedSocket()).toBe(false);
    });
  });
});
