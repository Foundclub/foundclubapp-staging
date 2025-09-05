import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

import { useAppContext } from '@/store/appContext';

export const EVENTS = {
  ERROR: 'error',
  JOIN_CHAT: 'join-chat',
  JOINED: 'joined',
  LEAVE_CHAT: 'leave-chat',
  LEFT: 'left',
  MESSAGE_DELETED: 'message-deleted',
  MESSAGE_RECEIVED: 'message-received',
  SEND_MESSAGE: 'send-message',
};

/**
 * Hook to manage socket.io connection and events
 * @returns {{
 *   socket: import('socket.io-client').Socket | null,
 *   isConnected: boolean
 * }} Socket instance and connection status
 */
const useSocket = () => {
  const socketRef = useRef(/** @type {import('socket.io-client').Socket | null} */(null));
  const [isConnected, setIsConnected] = useState(false);
  const [{ auth }] = useAppContext();

  useEffect(() => {
    if (!auth?.token) {
      setIsConnected(false);
      return undefined;
    }

    // Create socket connection if it doesn't exist
    if (!socketRef.current) {
      const socket = io(process.env.SOCKET_URL, {
        auth: { token: auth.token },
        extraHeaders: {
          'User-Agent': 'react-native',
        },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        secure: true,
        timeout: 10000,
        transports: ['websocket'],
      });

      socket.on('connect', () => {
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        // eslint-disable-next-line no-console
        console.error('Socket connection error:', error.message);
        setIsConnected(false);
      });

      socketRef.current = socket;
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [auth?.token]);

  return { isConnected, socket: socketRef.current };
};

export default useSocket;
