/**
 * Authentication Routes
 * 
 * Handles user registration, login, logout, and profile management.
 */

const express = require('express');
const bcrypt = require('bcrypt');
const { 
  authenticate, 
  rateLimit, 
  validateInput, 
  generateToken,
  generateRefreshToken,
  sanitizeInput,
  getClientIP,
  getUserAgent
} = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', rateLimit, validateInput, sanitizeInput, async (req, res) => {
  try {
    const { username, password, email } = req.body;
    const db = req.app.get('db');

    // Check if registration is enabled
    if (db.getConfig('registrationEnabled') === false) {
      return res.status(403).json({ 
        success: false, 
        error: 'Registration is currently disabled',
        code: 'REGISTRATION_DISABLED'
      });
    }

    // Check if username exists
    if (db.getUserByUsername(username)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username already exists',
        code: 'USERNAME_EXISTS'
      });
    }

    // Check if email exists (if provided)
    if (email && db.getUserByEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }

    // Generate unique user code
    const userCode = db.generateUserCode();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = db.createUser({ 
      username, 
      password: hashedPassword, 
      email,
      userCode 
    });

    // Log the registration
    db.createAuditLog(
      userId, 
      'register', 
      `User ${username} registered`, 
      getClientIP(req),
      null, null,
      getUserAgent(req)
    );

    // Add activity
    db.addActivity({
      userId,
      type: 'registered',
      targetType: 'user',
      targetId: userId,
      metadata: { username }
    });

    res.status(201).json({ 
      success: true, 
      message: 'Registration successful',
      userCode 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', rateLimit, sanitizeInput, async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;
    const db = req.app.get('db');
    const ip = getClientIP(req);
    const userAgent = getUserAgent(req);

    // Find user
    const user = db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if banned
    if (user.isBanned) {
      return res.status(403).json({ 
        success: false, 
        error: 'Account is banned',
        reason: user.banReason,
        code: 'USER_BANNED'
      });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      db.createAuditLog(
        user.id, 
        'login_failed', 
        'Invalid password', 
        ip, null, null, userAgent
      );
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Update last login and online status
    db.updateLastLogin(user.id);
    db.setUserOnline(user.id, true);

    // Generate tokens
    const token = generateToken(user, rememberMe);
    const refreshToken = rememberMe ? generateRefreshToken(user) : null;

    // Create session record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 7));
    
    db.createSession({
      userId: user.id,
      token,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
      ipAddress: ip,
      userAgent,
      rememberMe: !!rememberMe
    });

    // Log successful login
    db.createAuditLog(
      user.id, 
      'login', 
      'User logged in', 
      ip, null, null, userAgent
    );

    // Add activity
    db.addActivity({
      userId: user.id,
      type: 'login',
      targetType: 'user',
      targetId: user.id,
      metadata: { ip }
    });

    // Get announcements
    const announcements = db.getActiveAnnouncements();

    res.json({ 
      success: true, 
      token,
      refreshToken: rememberMe ? refreshToken : undefined,
      expiresIn: rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60,
      user: {
        id: user.id,
        username: user.username,
        userCode: user.userCode,
        role: user.role,
        avatar: user.avatarThumbnail,
        membership: user.membership
      },
      announcements
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const db = req.app.get('db');
    const { verifyToken } = require('../middleware/auth');

    if (!refreshToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Refresh token required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Get user
    const user = db.getUserById(decoded.id);
    if (!user || user.isBanned) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found or banned',
        code: 'USER_INVALID'
      });
    }

    // Generate new tokens
    const token = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Update session
    db.deleteSession(token);
    db.createSession({
      userId: user.id,
      token,
      refreshToken: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      rememberMe: false
    });

    res.json({ 
      success: true, 
      token,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to refresh token',
      code: 'REFRESH_ERROR'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', authenticate, (req, res) => {
  const db = req.app.get('db');
  
  // Get token from header
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.substring(7) : null;

  // Delete session
  if (token) {
    db.deleteSession(token);
  }

  // Update online status
  db.setUserOnline(req.user.id, false);

  // Log logout
  db.createAuditLog(
    req.user.id, 
    'logout', 
    'User logged out', 
    getClientIP(req), null, null,
    getUserAgent(req)
  );

  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, (req, res) => {
  const db = req.app.get('db');
  const user = db.getUserById(req.user.id);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      error: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }

  // Get additional info
  const stats = {
    friendsCount: user.friendsCount,
    followersCount: user.followersCount,
    followingCount: user.followingCount
  };

  // Get notifications count
  const unreadNotifications = db.getUnreadNotificationCount(user.id);
  const unreadMessages = db.getUnreadMessageCount(user.id);

  // Get join history
  const joinHistory = db.getJoinHistory(user.id, 10);

  // Get activity
  const activity = db.getUserActivity(user.id, 20);

  res.json({ 
    success: true, 
    user: {
      id: user.id,
      username: user.username,
      userCode: user.userCode,
      email: user.email,
      role: user.role,
      avatar: user.avatarThumbnail,
      avatarFull: user.avatar,
      description: user.description,
      membership: user.membership,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      isOnline: user.isOnline,
      preferences: user.preferences,
      stats,
      unreadNotifications,
      unreadMessages,
      joinHistory,
      activity
    }
  });
});

/**
 * GET /api/auth/profile/:id
 * Get user profile by ID
 */
router.get('/profile/:id', authenticate, (req, res) => {
  const db = req.app.get('db');
  const userId = parseInt(req.params.id);
  
  const user = db.getUserById(userId);
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      error: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }

  // Check friendship status
  const friends = db.getFriends(req.user.id);
  const isFriend = friends.some(f => f.id === userId);

  // Get user's activity
  const activity = db.getUserActivity(userId, 10);

  res.json({ 
    success: true, 
    profile: {
      id: user.id,
      username: user.username,
      userCode: user.userCode,
      avatar: user.avatarThumbnail,
      description: user.description,
      membership: user.membership,
      createdAt: user.createdAt,
      isOnline: user.isOnline,
      isFriend,
      friendsCount: user.friendsCount,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      activity
    }
  });
});

/**
 * PUT /api/auth/profile
 * Update current user's profile
 */
router.put('/profile', authenticate, sanitizeInput, (req, res) => {
  const db = req.app.get('db');
  const { username, description, avatar, preferences } = req.body;

  const updates = {};

  if (username && username !== req.user.username) {
    // Check if username is taken
    if (db.getUserByUsername(username)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username already taken',
        code: 'USERNAME_EXISTS'
      });
    }
    updates.username = username;
  }

  if (description !== undefined) {
    updates.description = description.substring(0, 500); // Limit length
  }

  if (avatar !== undefined) {
    updates.avatar = avatar;
    updates.avatarThumbnail = avatar; // Use same for thumbnail
  }

  if (preferences !== undefined) {
    updates.preferences = preferences;
  }

  if (Object.keys(updates).length > 0) {
    db.updateUser(req.user.id, updates);
    
    db.createAuditLog(
      req.user.id, 
      'profile_update', 
      `Profile updated: ${Object.keys(updates).join(', ')}`, 
      getClientIP(req)
    );
  }

  const user = db.getUserById(req.user.id);
  res.json({ 
    success: true, 
    user: {
      id: user.id,
      username: user.username,
      userCode: user.userCode,
      role: user.role,
      avatar: user.avatarThumbnail,
      description: user.description,
      membership: user.membership,
      preferences: user.preferences
    }
  });
});

/**
 * PUT /api/auth/password
 * Change password
 */
router.put('/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = req.app.get('db');

    const user = db.getUserByUsername(req.user.username);
    
    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Current password is incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    db.db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);

    // Invalidate all sessions except current
    const currentToken = req.headers.authorization?.substring(7);
    db.deleteUserSessions(req.user.id);
    
    // Create new session for current token
    if (currentToken) {
      db.createSession({
        userId: req.user.id,
        token: currentToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    db.createAuditLog(
      req.user.id, 
      'password_change', 
      'Password changed', 
      getClientIP(req)
    );

    res.json({ 
      success: true, 
      message: 'Password changed successfully',
      code: 'PASSWORD_CHANGED'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to change password',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
});

module.exports = router;
