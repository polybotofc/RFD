'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Stats {
  totalGames: number;
  totalServers: number;
  runningServers: number;
  totalUsers: number;
  totalPlayers: number;
}

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.getStats();
        setStats(res.stats);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-5 gap-4">
      <StatCard 
        icon="🎮" 
        label="Games" 
        value={stats.totalGames} 
      />
      <StatCard 
        icon="🖥️" 
        label="Servers" 
        value={stats.totalServers} 
        subValue={`${stats.runningServers} running`}
      />
      <StatCard 
        icon="👥" 
        label="Players" 
        value={stats.totalPlayers} 
      />
      <StatCard 
        icon="📊" 
        label="Online" 
        value={stats.runningServers} 
        suffix="servers"
      />
      <StatCard 
        icon="👤" 
        label="Users" 
        value={stats.totalUsers} 
      />
    </div>
  );
}

interface StatCardProps {
  icon: string;
  label: string;
  value: number;
  subValue?: string;
  suffix?: string;
}

function StatCard({ icon, label, value, subValue, suffix }: StatCardProps) {
  return (
    <div className="card text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-400">
        {label}
        {subValue && <span className="block text-xs mt-1">{subValue}</span>}
        {suffix && <span className="text-xs ml-1">({suffix})</span>}
      </div>
    </div>
  );
}