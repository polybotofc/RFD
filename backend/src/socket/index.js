/**
 * Socket.IO Handlers
 * 
 * Manages all WebSocket connections and events.
 */

function setupSocketHandlers(io, db, rfdManager) {
  // Track connected clients
  const clients = new Map();
  const adminClients = new Set();

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    clients.set(socket.id, { connectedAt: Date.now() });

    // ==================== Authentication ====================

    socket.on('authenticate', (data) => {
      const { token } = data;
      const { verifyToken } = require('../middleware/auth');
      const decoded = verifyToken(token);

      if (decoded) {
        socket.userId = decoded.id;
        socket.username = decoded.username;
        socket.role = decoded.role;
        socket.authenticated = true;

        // Update user online status
        db.setUserOnline(decoded.id, true);

        socket.emit('authenticated', {
          success: true,
          user: { id: decoded.id, username: decoded.username, role: decoded.role }
        });

        // Notify admins of new user online
        adminClients.forEach(adminSocket => {
          adminSocket.emit('user-online', { id: decoded.id, username: decoded.username });
        });

        console.log(`User authenticated: ${decoded.username}`);
      } else {
        socket.emit('authenticated', { success: false, error: 'Invalid token' });
      }
    });

    // ==================== Server Events ====================

    socket.on('join-server-logs', (serverId) => {
      socket.join(`server-${serverId}`);
      socket.emit('console-history', rfdManager.getConsoleBuffer(serverId, 100));
    });

    socket.on('leave-server-logs', (serverId) => {
      socket.leave(`server-${serverId}`);
    });

    socket.on('subscribe-stats', () => {
      socket.join('stats-room');
      // Send initial stats
      socket.emit('stats-update', db.getStats());
    });

    socket.on('unsubscribe-stats', () => {
      socket.leave('stats-room');
    });

    socket.on('subscribe-servers', () => {
      socket.join('servers-room');
      socket.emit('servers-update', db.getServers());
    });

    socket.on('subscribe-players', (serverId) => {
      if (serverId) {
        socket.join(`players-${serverId}`);
      } else {
        socket.join('all-players');
      }
      socket.emit('players-update', db.getOnlinePlayers(serverId));
    });

    // ==================== Admin Events ====================

    socket.on('admin-subscribe', () => {
      if (socket.role === 'admin') {
        socket.join('admin-room');
        adminClients.add(socket.id);
        socket.emit('admin-subscribed', { success: true });
      }
    });

    socket.on('admin-unsubscribe', () => {
      socket.leave('admin-room');
      adminClients.delete(socket.id);
    });

    // ==================== Console Commands ====================

    socket.on('send-command', async (data) => {
      if (!socket.authenticated) {
        socket.emit('command-result', { success: false, error: 'Not authenticated' });
        return;
      }

      const { serverId, command } = data;

      try {
        await rfdManager.sendCommand(serverId, command);
        socket.emit('command-result', { success: true });
      } catch (error) {
        socket.emit('command-result', { success: false, error: error.message });
      }
    });

    socket.on('clear-console', (serverId) => {
      rfdManager.clearConsole(serverId);
      socket.emit('console-cleared', { serverId });
    });

    // ==================== Player Events ====================

    socket.on('player-joined', (data) => {
      const { serverId, player } = data;
      
      // Add to database
      if (socket.userId) {
        db.addOnlinePlayer({
          odId: player.odId || Date.now(),
          odusername: player.username,
          userCode: player.userCode,
          userId: socket.userId,
          serverId,
          ipAddress: socket.handshake?.address
        });
      }

      // Update server player count
      const server = db.getServerById(serverId);
      if (server) {
        const players = db.getOnlinePlayers(serverId);
        db.updateServerPlayerCount(serverId, players.length);
      }

      // Broadcast to server room
      io.to(`players-${serverId}`).emit('player-joined', { serverId, player });
      io.to('all-players').emit('player-joined', { serverId, player });
      io.to('stats-room').emit('stats-update', db.getStats());
    });

    socket.on('player-left', (data) => {
      const { serverId, player } = data;
      
      // Remove from database
      db.removeOnlinePlayer(player.odId);

      // Update server player count
      const server = db.getServerById(serverId);
      if (server) {
        const players = db.getOnlinePlayers(serverId);
        db.updateServerPlayerCount(serverId, players.length);
      }

      // Broadcast to server room
      io.to(`players-${serverId}`).emit('player-left', { serverId, player });
      io.to('all-players').emit('player-left', { serverId, player });
      io.to('stats-room').emit('stats-update', db.getStats());
    });

    // ==================== Notifications ====================

    socket.on('get-notifications', () => {
      if (socket.userId) {
        const notifications = db.getUserNotifications(socket.userId);
        const unreadCount = db.getUnreadNotificationCount(socket.userId);
        socket.emit('notifications', { notifications, unreadCount });
      }
    });

    socket.on('mark-notification-read', (notificationId) => {
      if (socket.userId) {
        db.markNotificationRead(notificationId);
      }
    });

    socket.on('mark-all-notifications-read', () => {
      if (socket.userId) {
        db.markAllNotificationsRead(socket.userId);
      }
    });

    // ==================== Messages ====================

    socket.on('send-message', (data) => {
      if (!socket.userId) return;

      const { receiverId, content } = data;
      const message = db.sendMessage(socket.userId, receiverId, content);

      // Send to receiver if online
      const receiverSocket = [...io.sockets.sockets.values()]
        .find(s => s.userId === receiverId);
      
      if (receiverSocket) {
        receiverSocket.emit('new-message', message);
      }
    });

    socket.on('get-conversation', (data) => {
      if (!socket.userId) return;

      const { otherUserId } = data;
      const messages = db.getMessages(socket.userId, otherUserId);
      db.markMessagesRead(socket.userId, otherUserId);
      socket.emit('conversation', { messages });
    });

    // ==================== Friends ====================

    socket.on('send-friend-request', (data) => {
      if (!socket.userId) return;

      const { friendId } = data;
      db.addFriend(socket.userId, friendId);

      // Notify receiver
      const friendSocket = [...io.sockets.sockets.values()]
        .find(s => s.userId === friendId);
      
      if (friendSocket) {
        friendSocket.emit('friend-request-received', { from: socket.userId, username: socket.username });
      }
    });

    socket.on('accept-friend-request', (data) => {
      if (!socket.userId) return;

      const { requestId } = data;
      db.acceptFriend(requestId);

      socket.emit('friend-request-accepted', { requestId });
    });

    // ==================== Activity Feed ====================

    socket.on('get-activity', () => {
      if (socket.userId) {
        const activity = db.getUserActivity(socket.userId);
        socket.emit('activity-feed', { activity });
      }
    });

    // ==================== Ping/Pong ====================

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // ==================== Disconnect ====================

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      clients.delete(socket.id);
      adminClients.delete(socket.id);

      // Update user online status
      if (socket.userId) {
        db.setUserOnline(socket.userId, false);

        // Remove from online players
        const onlinePlayers = db.getOnlinePlayers();
        const player = onlinePlayers.find(p => p.userId === socket.userId);
        if (player) {
          db.removeOnlinePlayer(player.odId);
        }

        // Notify admins
        adminClients.forEach(adminSocket => {
          adminSocket.emit('user-offline', { id: socket.userId, username: socket.username });
        });
      }
    });
  });

  // ==================== Broadcast Methods ====================

  /**
   * Broadcast message to all connected clients
   */
  io.broadcast = (event, data) => {
    io.emit(event, data);
  };

  /**
   * Broadcast to admins only
   */
  io.broadcastToAdmins = (event, data) => {
    io.to('admin-room').emit(event, data);
  };

  /**
   * Broadcast to specific server room
   */
  io.broadcastToServer = (serverId, event, data) => {
    io.to(`server-${serverId}`).emit(event, data);
  };

  /**
   * Broadcast stats update
   */
  io.broadcastStats = () => {
    io.to('stats-room').emit('stats-update', db.getStats());
  };

  /**
   * Broadcast server update
   */
  io.broadcastServerUpdate = (serverId, data) => {
    io.to('servers-room').emit('server-updated', { serverId, ...data });
    io.to('stats-room').emit('stats-update', db.getStats());
  };

  return {
    io,
    clients,
    adminClients,
    broadcast: io.broadcast,
    broadcastToAdmins: io.broadcastToAdmins,
    broadcastToServer: io.broadcastToServer,
    broadcastStats: io.broadcastStats,
    broadcastServerUpdate: io.broadcastServerUpdate
  };
}

module.exports = { setupSocketHandlers };
