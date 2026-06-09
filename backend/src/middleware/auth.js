const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rfd-secret-key-change-in-production';

// Rate limiting store (in-memory)
const loginAttempts = new Map();

function rateLimit(req, res, next, maxAttempts = 5, windowMs = 60000) {
  const ip = req.ip || req.connection.remoteAddress;
  const key = `login:${ip}`;
  const now = Date.now();
  
  let attempts = loginAttempts.get(key) || { count: 0, firstAttempt: now };
  
  // Reset if window has passed
  if (now - attempts.firstAttempt > windowMs) {
    attempts = { count: 0, firstAttempt: now };
  }
  
  attempts.count++;
  loginAttempts.set(key, attempts);
  
  if (attempts.count > maxAttempts) {
    const waitTime = Math.ceil((windowMs - (now - attempts.firstAttempt)) / 1000);
    return res.status(429).json({ 
      success: false, 
      error: 'Too many attempts. Please try again later.',
      retryAfter: waitTime
    });
  }
  
  next();
}

// JWT authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// Admin only middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

// CSRF protection (simple implementation)
function csrfProtection(req, res, next) {
  // Skip for GET requests and some safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const token = req.headers['x-csrf-token'];
  const sessionToken = req.session?.csrfToken;
  
  // In production, validate the token
  if (!token) {
    console.warn('Missing CSRF token');
    // For development, allow requests without token
    // In production: return res.status(403).json({ error: 'CSRF token required' });
  }
  
  next();
}

// Input validation
function validateInput(req, res, next) {
  const { username, password } = req.body;
  
  // Username validation
  if (username) {
    if (typeof username !== 'string' || username.length < 3 || username.length > 32) {
      return res.status(400).json({ success: false, error: 'Username must be 3-32 characters' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ success: false, error: 'Username can only contain letters, numbers, and underscores' });
    }
  }
  
  // Password validation
  if (password) {
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ success: false, error: 'Password must be 6-128 characters' });
    }
  }
  
  next();
}

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, userCode: user.userCode, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Generate refresh token
function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = {
  authenticate,
  requireAdmin,
  rateLimit,
  csrfProtection,
  validateInput,
  generateToken,
  generateRefreshToken,
  JWT_SECRET
};
