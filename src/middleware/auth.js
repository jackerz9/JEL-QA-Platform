const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'jel-qa-default-secret-change-me';
const JWT_EXPIRES = '7d';

/**
 * Generate JWT token
 */
function generateToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/**
 * Auth middleware - verifies JWT token
 * Attaches req.user = { id, username, role }
 */
async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists and is active
    const user = await User.findById(decoded.id);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuario inactivo o eliminado' });
    }

    req.user = { id: user._id, username: user.username, role: user.role, name: user.name };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Role middleware - checks if user has required role
 * Usage: requireRole('admin') or requireRole('admin', 'supervisor')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

module.exports = { auth, requireRole, generateToken, JWT_SECRET };
