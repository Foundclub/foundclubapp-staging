import { useEffect, useState } from 'react';

import { useAppContext } from '@/store/appContext';

import {
  connectSharedSocket,
  disconnectSharedSocket,
  getSharedSocket,
  subscribeSocketConnection,
} from '@/services/socket/socketManager';

export const EVENTS = {
  // MSG1BA — contrat MESSAGERIE-1B §7 : « marquer non lu » / depart, vus des autres appareils
  // du compte ; et les notices de groupe (jamais par `message-received`).
  CHAT_UNREAD_UPDATED: 'chat-unread-updated',
  ERROR: 'error',
  GROUP_NOTICE: 'group-notice',
  JOIN_CHAT: 'join-chat',
  JOINED: 'joined',
  LEAVE_CHAT: 'leave-chat',
  LEFT: 'left',
  MESSAGE_DELETED: 'message-deleted',
  MESSAGE_READ: 'message-read',
  // MSGREACT — le canal des reactions emoji. Jumeau de
  // admin/src/socket/constants.ts : les deux chaines doivent rester identiques.
  MESSAGE_REACTION_UPDATED: 'message-reaction-updated',
  MESSAGE_RECEIVED: 'message-received',
  MESSAGE_UPDATED: 'message-updated',
  READ_MESSAGE: 'read-message',
  SEND_MESSAGE: 'send-message',
  TYPING_START: 'typing-start',
  TYPING_STARTED: 'typing-started',
  TYPING_STOP: 'typing-stop',
  TYPING_STOPPED: 'typing-stopped',
};

/**
 * Hook to manage socket.io connection and events
 * @returns {{
 *   socket: import('socket.io-client').Socket | null,
 *   isConnected: boolean
 * }} Socket instance and connection status
 */
const useSocket = () => {
  const [socket, setSocket] = useState(() => getSharedSocket());
  const [isConnected, setIsConnected] = useState(() => Boolean(getSharedSocket()?.connected));
  const [{ auth }] = useAppContext();

  useEffect(() => {
    if (!auth?.token) {
      disconnectSharedSocket();
      setSocket(null);
      setIsConnected(false);
      return undefined;
    }

    const nextSocket = connectSharedSocket(auth.token);
    setSocket(nextSocket);
    setIsConnected(Boolean(nextSocket?.connected));

    const unsubscribe = subscribeSocketConnection((connected) => {
      setIsConnected(connected);
      setSocket(getSharedSocket());
    });

    return () => {
      unsubscribe();
    };
  }, [auth?.token]);

  return { isConnected, socket };
};

export default useSocket;
