'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

export interface Game {
  id: number;
  title: string;
  description: string;
  creator: string;
  rbxl_path: string;
  thumbnail: string;
  default_port: number;
  created_at: string;
  serverCount?: number;
  runningServers?: number;
  servers?: any[];
}

export function useGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getGames();
      setGames(res.games);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  return { games, loading, error, refetch: fetchGames };
}

export function useGame(id: string | number) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGame = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getGame(id);
      setGame(res.game);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  return { game, loading, error, refetch: fetchGame };
}