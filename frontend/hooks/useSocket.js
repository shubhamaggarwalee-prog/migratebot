/**
 * frontend/hooks/useSocket.js
 * Socket.io connection hook + useMigrationSocket
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../lib/auth';
import { useWizardStore } from '../lib/store';

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

export function useMigrationSocket(migrationId) {
  const { setCurrentTask, setCompletedTasks, setDeployedUrls, setStep } = useWizardStore();

  useEffect(() => {
    if (!migrationId) return;
    const token = getToken();
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.emit('subscribe', { migrationId });

    socket.on('task:start', (task) => setCurrentTask(task));
    socket.on('task:complete', ({ id }) =>
      setCompletedTasks((prev) => [...(prev || []), id])
    );
    socket.on('migration:complete', ({ deployedUrls }) => {
      setDeployedUrls(deployedUrls);
      setStep(4);
    });

    return () => socket.disconnect();
  }, [migrationId]);
}
