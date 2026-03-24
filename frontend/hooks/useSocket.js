/**
 * frontend/hooks/useSocket.js
 * Socket.io connection hook + useMigrationSocket
 *
 * Event names emitted by backend/services/migrationRunner.js:
 *   task-start   → { taskId, title }
 *   task-done    → { taskId, result }
 *   complete     → { status, deployedUrls }
 *   error        → { error }
 *   log          → { level, message, timestamp }
 *   status       → { status }
 *   refund       → { message }
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
  const { setCurrentTask, setCompletedTasks, completedTasks, setDeployedUrls, setStep } = useWizardStore();

  useEffect(() => {
    if (!migrationId) return;

    const token  = getToken();
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.emit('subscribe', { migrationId });

    // ‘task-start’ — backend broadcasts { type: 'task-start', taskId, title }
    socket.on('migration:progress', (data) => {
      if (data.type === 'task-start') {
        setCurrentTask(data.taskId);
      }
      if (data.type === 'task-done') {
        // append taskId to completedTasks; read latest value from store
        const current = useWizardStore.getState().completedTasks || [];
        if (!current.includes(data.taskId)) {
          setCompletedTasks([...current, data.taskId]);
        }
        setCurrentTask(null);
      }
      if (data.type === 'complete') {
        setDeployedUrls(data.deployedUrls);
        setCurrentTask(null);
        setStep(4);
      }
      if (data.type === 'error') {
        setCurrentTask(null);
      }
    });

    // Queue-level events (from queue.js)
    socket.on('migration:complete', (data) => {
      if (data.deployedUrls) setDeployedUrls(data.deployedUrls);
      setCurrentTask(null);
      setStep(4);
    });

    socket.on('migration:error', () => {
      setCurrentTask(null);
    });

    return () => socket.disconnect();
  }, [migrationId]);
}
