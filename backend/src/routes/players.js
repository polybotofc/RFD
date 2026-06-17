/**
 * Players Routes
 * 
 * Handles player management, friends, messages, and avatars.
 */

const express = require('express');
const { authenticate, optionalAuth, sanitizeInput, getClientIP } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/players
 * Get online players
 */
router.get('/', authenticate, (req, res) => {
  const db = req.app.get('db');
  const { serverId } = req.query;
  
  const players = db.getOnlinePlayers(serverId ? parseInt(serverId) : null);
  
  res.json({ 
    success: true, 
    players,
    count: players.length
  });
});

/**
 * GET /api/players/search
 * Search players
 */
router.get('/search', authenticate, (req, res) => {
  const db = req.app.get('db');
  const { q, limit = 20 } = req.query;
  
  if (!q || q.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Search query must be at least 2 characters',
      code: 'INVALID_QUERY'
    });
  }
  
  const players = db.searchUsers(q, parseInt(limit));
  
  res.json({ 
    success: true, 
    players,
    count: players.length
  });
});

/**
 * GET /api/players/:id
 * Get player details
 */
router.get('/:id', authenticate, (req, res) => {
  const db = req.app.get('db');
  const userId = parseInt(req.params.id);
  
  const user = db.getUserById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'Player not found',
      code: 'PLAYER_NOT_FOUND'
    });
  }
  
  // Get activity
  const activity = db.getUserActivity(userId, 20);
  
  // Get friends
  const friends = db.getFriends(userId);
  
  res.json({
    success: true,
    player: {
      id: user.id,
      username: user.username,
      userCode: user.userCode,
      avatar: user.avatarThumbnail,
      description: user.description,
      membership: user.membership,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      isOnline: user.isOnline,
      friendsCount: user.friendsCount,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      activity,
      friends: friends.slice(0, 10) // Just first 10 for preview
    }
  });
});

// ==================== Friends ====================

/**
 * GET /api/players/:id/friends
 * Get player's friends
 */
router.get('/:id/friends', authenticate, (req, res) => {
  const db = req.app.get('db');
  const userId = parseInt(req.params.id);
  
  const friends = db.getFriends(userId);
  
  res.json({
    success: true,
    friends,
    count: friends.length
  });
});

/**
 * POST /api/players/:id/friend
 * Send friend request
 */
router.post('/:id/friend', authenticate, (req, res) => {
  const db = req.app.get('db');
  const friendId = parseInt(req.params.id);
  
  if (friendId === req.user.id) {
    return res.status(400).json({
      success: false,
      error: 'Cannot add yourself as friend',
      code: 'SELF_FRIEND'
    });
  }
  
  const friend = db.getUserById(friendId);
  if (!friend) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }
  
  // Check if already friends
  const friends = db.getFriends(req.user.id);
  if (friends.some(f => f.id === friendId)) {
    return res.status(400).json({
      success: false,
      error: 'Already friends',
      code: 'ALREADY_FRIENDS'
    });
  }
  
  db.addFriend(req.user.id, friendId);
  
  db.createAuditLog(
    req.user.id,
    'friend_request_sent',
    `Sent friend request to ${friend.username}`,
    getClientIP(req),
    'user',
    friendId
  );
  
  res.json({
    success: true,
    message: 'Friend request sent'
  });
});

/**
 * DELETE /api/players/:id/friend
 * Remove friend
 */
router.delete('/:id/friend', authenticate, (req, res) => {
  const db = req.app.get('db');
  const friendId = parseInt(req.params.id);
  
  db.removeFriend(req.user.id, friendId);
  
  res.json({
    success: true,
    message: 'Friend removed'
  });
});

/**
 * GET /api/players/friend-requests
 * Get pending friend requests
 */
router.get('/me/friend-requests', authenticate, (req, res) => {
  const db = req.app.get('db');
  
  const requests = db.getPendingFriendRequests(req.user.id);
  
  res.json({
    success: true,
    requests,
    count: requests.length
  });
});

/**
 * POST /api/players/friend-requests/:requestId/accept
 * Accept friend request
 */
router.post('/friend-requests/:requestId/accept', authenticate, (req, res) => {
  const db = req.app.get('db');
  const requestId = parseInt(req.params.requestId);
  
  db.acceptFriend(requestId);
  
  res.json({
    success: true,
    message: 'Friend request accepted'
  });
});

// ==================== Messages ====================

/**
 * GET /api/players/:id/messages
 * Get messages with player
 */
router.get('/:id/messages', authenticate, (req, res) => {
  const db = req.app.get('db');
  const otherUserId = parseInt(req.params.id);
  const { limit = 50 } = req.query;
  
  const messages = db.getMessages(req.user.id, otherUserId, parseInt(limit));
  
  // Mark as read
  db.markMessagesRead(req.user.id, otherUserId);
  
  res.json({
    success: true,
    messages,
    count: messages.length
  });
});

/**
 * POST /api/players/:id/messages
 * Send message to player
 */
router.post('/:id/messages', authenticate, sanitizeInput, (req, res) => {
  const db = req.app.get('db');
  const receiverId = parseInt(req.params.id);
  const { content } = req.body;
  
  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message cannot be empty',
      code: 'EMPTY_MESSAGE'
    });
  }
  
  if (content.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Message too long (max 2000 characters)',
      code: 'MESSAGE_TOO_LONG'
    });
  }
  
  const message = db.sendMessage(req.user.id, receiverId, content.trim());
  
  res.json({
    success: true,
    message
  });
});

/**
 * GET /api/players/conversations
 * Get all conversations
 */
router.get('/me/conversations', authenticate, (req, res) => {
  const db = req.app.get('db');
  
  // Get unique conversations from messages
  const messages = db.query(`
    SELECT DISTINCT 
      CASE 
        WHEN senderId = ? THEN receiverId 
        ELSE senderId 
      END as otherUserId,
      (SELECT content FROM messages m2 
       WHERE (m2.senderId = ? AND m2.receiverId = otherUserId) 
          OR (m2.senderId = otherUserId AND m2.receiverId = ?) 
       ORDER BY createdAt DESC LIMIT 1) as lastMessage,
      (SELECT createdAt FROM messages m2 
       WHERE (m2.senderId = ? AND m2.receiverId = otherUserId) 
          OR (m2.senderId = otherUserId AND m2.receiverId = ?) 
       ORDER BY createdAt DESC LIMIT 1) as lastMessageAt,
      (SELECT COUNT(*) FROM messages m2 
       WHERE m2.senderId = otherUserId AND m2.receiverId = ? AND m2.isRead = 0) as unreadCount
    FROM messages
    WHERE senderId = ? OR receiverId = ?
    ORDER BY lastMessageAt DESC
  `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);
  
  // Get user info for each conversation
  const conversations = messages.map(m => {
    const user = db.getUserById(m.otherUserId);
    return {
      user: user ? {
        id: user.id,
        username: user.username,
        avatar: user.avatarThumbnail,
        isOnline: user.isOnline
      } : null,
      lastMessage: m.lastMessage,
      lastMessageAt: m.lastMessageAt,
      unreadCount: m.unreadCount
    };
  }).filter(c => c.user);
  
  res.json({
    success: true,
    conversations
  });
});

// ==================== Avatar ====================

/**
 * GET /api/players/:id/avatar
 * Get player avatar
 */
router.get('/:id/avatar', optionalAuth, (req, res) => {
  const db = req.app.get('db');
  const userId = parseInt(req.params.id);
  
  let avatar = db.getAvatar(userId);
  
  if (!avatar) {
    // Return default avatar
    avatar = {
      userId,
      rigType: 'R15',
      bodyColors: {
        headColor3: 194,
        torsoColor3: 194,
        leftArmColor3: 194,
        rightArmColor3: 194,
        leftLegColor3: 194,
        rightLegColor3: 194
      },
      assets: [],
      animations: []
    };
  } else {
    // Parse JSON fields
    avatar.bodyColors = JSON.parse(avatar.bodyColors);
    avatar.assets = JSON.parse(avatar.assets);
    avatar.animations = JSON.parse(avatar.animations);
  }
  
  res.json({
    success: true,
    avatar
  });
});

/**
 * PUT /api/players/:id/avatar
 * Update player avatar
 */
router.put('/:id/avatar', authenticate, sanitizeInput, (req, res) => {
  const userId = parseInt(req.params.id);
  
  // Can only update own avatar
  if (userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: 'Cannot update another user\'s avatar',
      code: 'UNAUTHORIZED'
    });
  }
  
  const db = req.app.get('db');
  const { rigType, bodyColors, assets, animations } = req.body;
  
  const avatarData = {};
  if (rigType !== undefined) avatarData.rigType = rigType;
  if (bodyColors !== undefined) avatarData.bodyColors = bodyColors;
  if (assets !== undefined) avatarData.assets = assets;
  if (animations !== undefined) avatarData.animations = animations;
  
  db.updateAvatar(userId, avatarData);
  
  res.json({
    success: true,
    message: 'Avatar updated'
  });
});

/**
 * GET /api/players/:id/inventory
 * Get player inventory (simplified)
 */
router.get('/:id/inventory', authenticate, (req, res) => {
  const db = req.app.get('db');
  const userId = parseInt(req.params.id);
  
  // For now, return empty inventory
  // In full implementation, would integrate with Roblox API
  const inventory = {
    items: [],
    bundles: [],
    animations: []
  };
  
  res.json({
    success: true,
    inventory
  });
});

module.exports = router;
