/**
 * Authentication Middleware
 * 
 * JWT-based authentication and authorization middleware.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rfd-platform-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REMEMBER_EXPIRES_IN = process.env.JWT_REMEMBER_EXPIRES_IN || '30d';

// Rate limiting store (in-memory)
const loginAttempts = new Map();

/**
 * Generate JWT token
 */
function generateToken(user, rememberMe = false) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  const expiresIn = rememberMe ? JWT_REMEMBER_EXPIRES_IN : JWT_EXPIRES_IN;
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Generate refresh token
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from request
 */
function extractToken(req) {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  // Check query parameter (for special cases)
  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
}

/**
 * Rate limiting for login attempts
 */
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
      code: 'RATE_LIMITED',
      retryAfter: waitTime
    });
  }
  
  next();
}

/**
 * Authentication middleware - requires valid token
 */
function authenticate(req, res, next) {
  const token = extractToken(req);
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }

  // Attach user info to request
  req.user = decoded;
  req.userId = decoded.id;
  req.isAdmin = decoded.role === 'admin';
  
  next();
}

/**
 * Optional authentication - attaches user if token present but doesn't require it
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      req.userId = decoded.id;
      req.isAdmin = decoded.role === 'admin';
    }
  }
  
  next();
}

/**
 * Admin-only middleware
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }

  next();
}

/**
 * Role-based access control middleware
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
}

/**
 * CSRF protection middleware
 */
function csrfProtection(req, res, next) {
  // Skip for GET requests and some safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const token = req.headers['x-csrf-token'];
  
  // In production, validate the token properly
  if (!token) {
    console.warn('Missing CSRF token');
    // For development, allow requests without token
    // In production: return res.status(403).json({ error: 'CSRF token required' });
  }
  
  next();
}

/**
 * Input validation middleware
 */
function validateInput(req, res, next) {
  const { username, password, email } = req.body;
  
  // Username validation
  if (username) {
    if (typeof username !== 'string' || username.length < 3 || username.length > 32) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username must be 3-32 characters',
        code: 'INVALID_USERNAME'
      });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username can only contain letters, numbers, and underscores',
        code: 'INVALID_USERNAME_FORMAT'
      });
    }
  }
  
  // Password validation
  if (password) {
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be 6-128 characters',
        code: 'INVALID_PASSWORD'
      });
    }
  }
  
  // Email validation
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }
  }
  
  next();
}

/**
 * Sanitize user input
 */
function sanitizeInput(req, res, next) {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .trim()
        .replace(/[<>]/g, '') // Remove potential XSS characters
        .substring(0, 10000); // Limit string length
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  
  next();
}

/**
 * Get client IP address
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * Get user agent
 */
function getUserAgent(req) {
  return req.headers['user-agent'] || 'unknown';
}

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  extractToken,
  authenticate,
  optionalAuth,
  requireAdmin,
  requireRole,
  rateLimit,
  csrfProtection,
  validateInput,
  sanitizeInput,
  getClientIP,
  getUserAgent,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_REMEMBER_EXPIRES_IN
};
