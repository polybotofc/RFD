'use client';

import { useEffect, useRef, useState } from 'react';
import socketManager from '@/lib/socket';

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef<Map<string, Set<Function>>>(new Map());

  useEffect(() => {
    socketManager.connect();

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socketManager.on('connected', handleConnect);
    socketManager.on('disconnected', handleDisconnect);

    return () => {
      socketManager.off('connected', handleConnect);
      socketManager.off('disconnected', handleDisconnect);
    };
  }, []);

  const subscribe = (event: string, callback: Function) => {
    socketManager.on(event, callback);
    
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)?.add(callback);

    return () => {
      socketManager.off(event, callback);
      listenersRef.current.get(event)?.delete(callback);
    };
  };

  return {
    connected,
    subscribe,
    joinServerLogs: (serverId: string | number) => socketManager.joinServerLogs(serverId),
    leaveServerLogs: (serverId: string | number) => socketManager.leaveServerLogs(serverId),
    joinAdminLogs: () => socketManager.joinAdminLogs(),
  };
}