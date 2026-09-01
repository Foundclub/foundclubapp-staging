import { io } from 'socket.io-client';

import { createLogger } from '@/utils/logger/logger';

import { getSocketBaseUrl } from '@/config/runtimeUrls';

const socketLogger = createLogger('socket');

/** @type {import('socket.io-client').Socket | null} */
let sharedSocket = null;
/** @type {string | null} */
let sharedToken = null;
/** @type {Set<(isConnected: boolean) => void>} */
const connectionSubscribers = new Set();

const getSocketUrl = () => getSocketBaseUrl();

const shouldEnableSocketPollingFallback = () => {
  const rawValue = String(process.env.FC_ENABLE_SOCKET_POLLING_FALLBACK || '').trim().toLowerCase();
  return rawValue === '1' || rawValue === 'true' || rawValue === 'yes';
};

const notifyConnectionSubscribers = (isConnected) => {
  connectionSubscribers.forEach((subscriber) => {
    try {
      subscriber(isConnected);
    } catch (_error) {
      // No-op: subscriber cleanup is handled by hooks.
    }
  });
};

/**
 * PERF1 - l'abandon de reconnexion est un evenement de MANAGER, pas de socket.
 *
 * Apres `reconnectionAttempts: 5`, le Manager emet `reconnect_failed`, met
 * `_reconnecting = false` et ne replanifie AUCUN minuteur (socket.io-client
 * `manager.js:365-369`). Et la socket ne relaie que `open/packet/error/close`
 * (`socket.js:152-162`) : un `socket.on('reconnect_failed')` ne se
 * declencherait JAMAIS. D'ou l'ecoute sur `socket.io`, et le reveil dedie
 * `reviveSharedSocket` branche sur le retour au premier plan.
 * @returns {void}
 */
const handleManagerReconnectFailed = () => {
  socketLogger.warn('Reconnection abandoned after max attempts');
  notifyConnectionSubscribers(false);
};

const removeInternalListeners = (socket) => {
  socket.off('connect');
  socket.off('connect_error');
  socket.off('disconnect');
  // L'ecouteur du Manager se retire PAR REFERENCE : un off par nom seul
  // retirerait aussi tout autre ecouteur pose sur cet evenement.
  socket.io?.off?.('reconnect_failed', handleManagerReconnectFailed);
};

const attachInternalListeners = (socket) => {
  socket.on('connect', () => {
    socketLogger.debug('Connected');
    notifyConnectionSubscribers(true);
  });

  // La raison repond a « le serveur ferme-t-il en io server disconnect pendant
  // un deploiement ? » - si oui, socket.io ne retente meme pas les 5 fois.
  socket.on('disconnect', (reason) => {
    socketLogger.debug('Disconnected', { reason });
    notifyConnectionSubscribers(false);
  });

  socket.on('connect_error', (error) => {
    socketLogger.warn('Connection error', { message: error?.message });
    notifyConnectionSubscribers(false);
  });

  // Se (re)pose PAR SOCKET : un changement de jeton construit un Manager NEUF
  // (socket.io-client index.js:31-39), un ecouteur pose une fois au chargement
  // du module serait perdu.
  socket.io?.on?.('reconnect_failed', handleManagerReconnectFailed);
};

/**
 * @returns {import('socket.io-client').Socket | null}
 */
export const getSharedSocket = () => sharedSocket;

/**
 * @param {(isConnected: boolean) => void} subscriber
 * @returns {() => void}
 */
export const subscribeSocketConnection = (subscriber) => {
  connectionSubscribers.add(subscriber);
  subscriber(Boolean(sharedSocket?.connected));

  return () => {
    connectionSubscribers.delete(subscriber);
  };
};

/**
 * @param {string | undefined | null} token
 * @returns {import('socket.io-client').Socket | null}
 */
export const connectSharedSocket = (token) => {
  if (!token) {
    return null;
  }

  if (sharedSocket && sharedToken === token) {
    return sharedSocket;
  }

  if (sharedSocket && sharedToken !== token) {
    removeInternalListeners(sharedSocket);
    sharedSocket.disconnect();
    sharedSocket = null;
    sharedToken = null;
    notifyConnectionSubscribers(false);
  }

  const socketUrl = getSocketUrl();
  socketLogger.debug('Initializing socket', { socketUrl });

  sharedSocket = io(socketUrl, {
    auth: { token },
    extraHeaders: {
      'User-Agent': 'react-native',
    },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    secure: false,
    timeout: 20000,
    transports: shouldEnableSocketPollingFallback()
      ? ['websocket', 'polling']
      : ['websocket'],
  });
  sharedToken = token;
  attachInternalListeners(sharedSocket);
  return sharedSocket;
};

/**
 * PERF1 - reveille une socket abandonnee par socket.io.
 *
 * Apres la 5e tentative (~34 s a ~134 s selon le timeout par tentative), la
 * socket reste morte pour toujours alors que le serveur met 60 a 150 s a
 * redemarrer. `connectSharedSocket(memeJeton)` ne la ranime pas (elle est
 * rendue telle quelle) : ce reveil est le seul chemin, et il est branche sur
 * le retour au premier plan (`queryRefreshOnReturn`) - le seul moment utile,
 * iOS suspendant les minuteurs en arriere-plan.
 *
 * Sans danger si une reconnexion est encore en vol : `socket.connect()` ne
 * rouvre pas quand le Manager est deja en `_reconnecting` (socket.io-client
 * `socket.js:193-198`).
 * @returns {boolean} Vrai si un reveil a ete tente, faux sinon.
 */
export const reviveSharedSocket = () => {
  if (!sharedSocket || sharedSocket.connected) {
    return false;
  }
  socketLogger.debug('Reviving abandoned socket');
  sharedSocket.connect();
  return true;
};

export const disconnectSharedSocket = () => {
  if (!sharedSocket) {
    sharedToken = null;
    notifyConnectionSubscribers(false);
    return;
  }

  removeInternalListeners(sharedSocket);
  sharedSocket.disconnect();
  sharedSocket = null;
  sharedToken = null;
  notifyConnectionSubscribers(false);
};
