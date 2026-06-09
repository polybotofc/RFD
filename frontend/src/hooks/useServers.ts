'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

export interface Server {
  id: number;
  game_id: number;
  game_title?: string;
  port: number;
  pid: number | null;
  status: string;
  players: string;
  max_players: number;
  uptime: number;
  started_at: string;
  playerCount?: number;
  playerList?: any[];
}

export function useServers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getServers();
      setServers(res.servers);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  return { servers, loading, error, refetch: fetchServers };
}

export function useGameServers(gameId: string | number) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getGameServers(gameId);
      setServers(res.servers);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  return { servers, loading, error, refetch: fetchServers };
}

export function useServerActions() {
  const startServer = async (serverId: string | number) => {
    const res = await api.startServer(serverId);
    return res;
  };

  const stopServer = async (serverId: string | number) => {
    const res = await api.stopServer(serverId);
    return res;
  };

  const restartServer = async (serverId: string | number) => {
    const res = await api.restartServer(serverId);
    return res;
  };

  const deleteServer = async (serverId: string | number) => {
    const res = await api.deleteServer(serverId);
    return res;
  };

  const joinServer = async (serverId: string | number) => {
    const res = await api.joinServer(serverId);
    return res;
  };

  return { startServer, stopServer, restartServer, deleteServer, joinServer };
}