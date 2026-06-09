'use client';

import { useEffect, useState, useRef } from 'react';
import socketManager from '@/lib/socket';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  serverId?: number;
  type?: string;
}

interface LogViewerProps {
  serverId?: number | string;
  autoJoin?: boolean;
  maxLines?: number;
}

export default function LogViewer({ serverId, autoJoin = false, maxLines = 500 }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socketManager.connect();
    setConnected(socketManager.isConnected());

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socketManager.on('connected', handleConnect);
    socketManager.on('disconnected', handleDisconnect);

    return () => {
      socketManager.off('connected', handleConnect);
      socketManager.off('disconnected', handleDisconnect);
    };
  }, []);

  useEffect(() => {
    if (!serverId) return;

    if (autoJoin) {
      socketManager.joinAdminLogs();
    } else {
      socketManager.joinServerLogs(serverId);
    }

    const handleLog = (data: any) => {
      setLogs(prev => {
        const newLogs = [...prev, {
          timestamp: data.timestamp || new Date().toISOString(),
          level: data.level || 'info',
          message: data.message,
          serverId: data.serverId,
          type: data.type,
        }];
        // Keep only last maxLines
        return newLogs.slice(-maxLines);
      });
    };

    socketManager.on('server-log', handleLog);
    socketManager.on('log-line', handleLog);

    return () => {
      if (serverId) {
        socketManager.leaveServerLogs(serverId);
      }
      socketManager.off('server-log', handleLog);
      socketManager.off('log-line', handleLog);
    };
  }, [serverId, autoJoin, maxLines]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'text-red-400';
      case 'warn':
      case 'warning':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="bg-roblox-darker rounded-lg border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-roblox-primary/50 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
          <span className="text-sm text-gray-400">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {logs.length} lines
        </span>
      </div>

      {/* Log content */}
      <div className="h-96 overflow-y-auto p-4 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            Waiting for logs...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`${getLevelColor(log.level)} py-0.5`}>
              <span className="text-gray-500 text-xs">
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </span>{' '}
              <span className="uppercase text-xs mr-2">[{log.level}]</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Clear button */}
      <div className="px-4 py-2 border-t border-white/10">
        <button
          onClick={() => setLogs([])}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Clear logs
        </button>
      </div>
    </div>
  );
}