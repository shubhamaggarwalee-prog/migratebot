/**
 * frontend/hooks/useSocket.js
 * Socket.io connection hook
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../lib/auth';

export default function useSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    const token = getToken();
    socketRef.current = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      auth: { token },
      transports: ['websocket'],
    });
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  return socketRef.current;
}
