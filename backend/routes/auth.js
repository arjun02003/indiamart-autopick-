const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');

const JWT_SECRET = process.env.SESSION_SECRET || 'super-secret-jwt-key-9988';

// JWT authentication middleware
function authenticateToken(req, res, next) {
  let token = req.headers['authorization'];
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  } else {
    // Fallback for SSE / query parameter
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

// Get current authenticated user status
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, role, subscription_status FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Signup route - Restricted to Admin
router.post('/signup', authenticateToken, (req, res) => {
  const admin = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Only administrators can register new users.' });
  }

  const { email, password, role = 'viewer', subscription_status = 'inactive' } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // Begin transaction to ensure user and default config are created together
    const registerTx = db.transaction(() => {
      const userResult = db.prepare("INSERT INTO users (email, password, role, subscription_status) VALUES (?, ?, ?, ?)").run(
        email.toLowerCase(),
        hashedPassword,
        role,
        subscription_status
      );
      
      const userId = userResult.lastInsertRowid;
      
      // Initialize default config for the user
      db.prepare(`
        INSERT INTO config
          (user_id, keywords, countries, priority_keywords, interval, is_running, cookies,
           auto_reply_msg, telegram_token, telegram_chat_id, proxy_url, min_quantity, reply_enabled,
           accept_limit, current_accepted_count)
        VALUES (?, '[]', '[]', '[]', 30, 0, '[]',
          'Thank you for your inquiry about {product}. We will get back to you shortly.',
          '', '', '', 0, 1, 600, 0)
      `).run(userId);

      return userId;
    });

    const userId = registerTx();
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: userId,
        email: email.toLowerCase(),
        role,
        subscription_status
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login route
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const validPass = bcrypt.compareSync(password, user.password);
    if (!validPass) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        subscription_status: user.subscription_status
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mock upgrade to premium
router.post('/subscription/upgrade', authenticateToken, (req, res) => {
  try {
    db.prepare("UPDATE users SET subscription_status = 'active' WHERE id = ?").run(req.user.id);
    res.json({ success: true, message: 'Successfully upgraded to Premium!', subscription_status: 'active' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mock cancel premium
router.post('/subscription/cancel', authenticateToken, (req, res) => {
  try {
    // When cancelling premium, we should also stop auto-mode for safety
    db.transaction(() => {
      db.prepare("UPDATE users SET subscription_status = 'inactive' WHERE id = ?").run(req.user.id);
      db.prepare("UPDATE config SET is_running = 0 WHERE user_id = ?").run(req.user.id);
    })();
    res.json({ success: true, message: 'Subscription cancelled.', subscription_status: 'inactive' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin Middleware & Endpoints ─────────────────────────────────────

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
  if (user && user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Administrator role required.' });
  }
}

// GET all users details (with leads count and worker status)
router.get('/admin/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT 
        u.id, 
        u.email, 
        u.role, 
        u.subscription_status, 
        u.created_at,
        (SELECT COUNT(*) FROM leads l WHERE l.user_id = u.id) as leads_count,
        COALESCE((SELECT is_running FROM config c WHERE c.user_id = u.id), 0) as is_running
      FROM users u
      ORDER BY u.id DESC
    `).all();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST toggle premium subscription status for a user
router.post('/admin/users/:id/toggle-premium', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  try {
    const user = db.prepare('SELECT subscription_status FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const newStatus = user.subscription_status === 'active' ? 'inactive' : 'active';
    
    db.transaction(() => {
      db.prepare("UPDATE users SET subscription_status = ? WHERE id = ?").run(newStatus, id);
      if (newStatus === 'inactive') {
        db.prepare("UPDATE config SET is_running = 0 WHERE user_id = ?").run(id);
      }
    })();
    
    res.json({ success: true, subscription_status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a user
router.delete('/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own admin account.' });
  }
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;

