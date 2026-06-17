import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

class SocketManager {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.emit('connected', {});
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.emit('disconnected', {});
    });

    this.socket.on('server-started', (data) => {
      this.emit('server-started', data);
    });

    this.socket.on('server-stopped', (data) => {
      this.emit('server-stopped', data);
    });

    this.socket.on('server-log', (data) => {
      this.emit('server-log', data);
    });

    this.socket.on('player-update', (data) => {
      this.emit('player-update', data);
    });

    this.socket.on('server-discovered', (data) => {
      this.emit('server-discovered', data);
    });

    this.socket.on('log-line', (data) => {
      this.emit('log-line', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Subscribe to server logs
  joinServerLogs(serverId: string | number) {
    this.socket?.emit('join-server-logs', serverId);
  }

  leaveServerLogs(serverId: string | number) {
    this.socket?.emit('leave-server-logs', serverId);
  }

  // Subscribe to admin logs
  joinAdminLogs() {
    this.socket?.emit('join-admin-logs');
  }

  // Event handling
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error('Socket callback error:', e);
      }
    });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketManager = new SocketManager();
export default socketManager;