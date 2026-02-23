import { io } from 'socket.io-client';

import { createLogger } from '@/utils/logger/logger';

const socketLogger = createLogger('socket');

/** @type {import('socket.io-client').Socket | null} */
let sharedSocket = null;
/** @type {string | null} */
let sharedToken = null;
/** @type {Set<(isConnected: boolean) => void>} */
const connectionSubscribers = new Set();

const getSocketUrl = () => process.env.SOCKET_URL || process.env.API_URL?.replace('/api', '') || 'http://10.0.2.2:1337';

const notifyConnectionSubscribers = (isConnected) => {
  connectionSubscribers.forEach((subscriber) => {
    try {
      subscriber(isConnected);
    } catch (_error) {
      // No-op: subscriber cleanup is handled by hooks.
    }
  });
};

const removeInternalListeners = (socket) => {
  socket.off('connect');
  socket.off('connect_error');
  socket.off('disconnect');
};

const attachInternalListeners = (socket) => {
  socket.on('connect', () => {
    socketLogger.debug('Connected');
    notifyConnectionSubscribers(true);
  });

  socket.on('disconnect', () => {
    socketLogger.debug('Disconnected');
    notifyConnectionSubscribers(false);
  });

  socket.on('connect_error', (error) => {
    socketLogger.error('Connection error', { message: error?.message });
    notifyConnectionSubscribers(false);
  });
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
    transports: ['websocket'],
  });
  sharedToken = token;
  attachInternalListeners(sharedSocket);
  return sharedSocket;
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
