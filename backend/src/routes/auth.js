const express = require('express');
const bcrypt = require('bcrypt');
const { authenticate, rateLimit, validateInput, generateToken } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', validateInput, async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = req.app.get('db');

    // Check if username exists
    if (db.getUserByUsername(username)) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }

    // Generate unique user code
    const userCount = db.db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const userCode = `U${String(userCount + 1).padStart(5, '0')}`;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = db.createUser(username, hashedPassword, userCode);
    
    // Log the registration
    db.createAuditLog(userId, 'register', `User ${username} registered`, req.ip);

    res.status(201).json({ 
      success: true, 
      message: 'Registration successful',
      userCode 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// Login
router.post('/login', rateLimit, async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = req.app.get('db');

    // Find user
    const user = db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      db.createAuditLog(user.id, 'login-failed', 'Invalid password', req.ip);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Update last login and online status
    db.updateLastLogin(user.id);
    db.setUserOnline(user.id, true);

    // Generate token
    const token = generateToken(user);

    // Log successful login
    db.createAuditLog(user.id, 'login', 'User logged in', req.ip);

    res.json({ 
      success: true, 
      token,
      user: {
        id: user.id,
        username: user.username,
        userCode: user.userCode,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Logout
router.post('/logout', authenticate, (req, res) => {
  const db = req.app.get('db');
  db.setUserOnline(req.user.id, false);
  db.createAuditLog(req.user.id, 'logout', 'User logged out', req.ip);
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get profile
router.get('/profile', authenticate, (req, res) => {
  const db = req.app.get('db');
  const user = db.getUserById(req.user.id);
  
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  // Get join history
  const joinHistory = db.getJoinHistory(req.user.id, 10);

  res.json({ 
    success: true, 
    user: {
      ...user,
      joinHistory
    }
  });
});

// Update profile
router.put('/profile', authenticate, validateInput, (req, res) => {
  const db = req.app.get('db');
  const { username } = req.body;

  if (username && username !== req.user.username) {
    // Check if username is taken
    if (db.getUserByUsername(username)) {
      return res.status(400).json({ success: false, error: 'Username already taken' });
    }
    
    db.updateUsername(req.user.id, username);
    db.createAuditLog(req.user.id, 'profile-update', `Username changed to ${username}`, req.ip);
  }

  const user = db.getUserById(req.user.id);
  res.json({ success: true, user });
});

// Change password
router.put('/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = req.app.get('db');

    const user = db.getUserByUsername(req.user.username);
    
    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    db.db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);
    db.createAuditLog(req.user.id, 'password-change', 'Password changed', req.ip);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

module.exports = router;
