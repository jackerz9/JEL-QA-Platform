const express = require('express');
const User = require('../models/User');
const { auth, requireRole, generateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  try {
    const user = await User.findOne({ username: username.toLowerCase(), active: true }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user._id, username: user.username, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me - Get current user info
 */
router.get('/me', auth, (req, res) => {
  res.json(req.user);
});

/**
 * PUT /api/auth/password - Change own password
 */
router.put('/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Contraseña actual y nueva requeridas' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const user = await User.findById(req.user.id).select('+password');
    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ ok: true, message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════
//  USER MANAGEMENT (admin only)
// ═══════════════════════════════════════

/**
 * GET /api/auth/users - List all users
 */
router.get('/users', auth, requireRole('admin'), async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
});

/**
 * POST /api/auth/users - Create user
 */
router.post('/users', auth, requireRole('admin'), async (req, res) => {
  const { username, name, email, password, role } = req.body;
  if (!username || !name || !password) {
    return res.status(400).json({ error: 'username, name y password son requeridos' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const user = await User.create({ username, name, email, password, role: role || 'viewer' });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Ese usuario ya existe' });
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/auth/users/:id - Update user (admin)
 */
router.put('/users/:id', auth, requireRole('admin'), async (req, res) => {
  const { name, email, role, active, password } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (name) user.name = name;
    if (email !== undefined) user.email = email;
    if (role) user.role = role;
    if (active !== undefined) user.active = active;
    if (password && password.length >= 6) user.password = password;

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/auth/users/:id - Deactivate user
 */
router.delete('/users/:id', auth, requireRole('admin'), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  // Don't let admin delete themselves
  if (user._id.toString() === req.user.id.toString()) {
    return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });
  }

  user.active = false;
  await user.save();
  res.json({ ok: true });
});

/**
 * POST /api/auth/setup - Initial admin setup (only works if no users exist)
 */
router.post('/setup', async (req, res) => {
  const count = await User.countDocuments();
  if (count > 0) {
    return res.status(400).json({ error: 'Ya existe al menos un usuario. Usa login.' });
  }

  const { username, name, password } = req.body;
  if (!username || !name || !password) {
    return res.status(400).json({ error: 'username, name y password requeridos' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const user = await User.create({ username, name, password, role: 'admin' });
    const token = generateToken(user);
    res.status(201).json({ token, user: { id: user._id, username: user.username, name: user.name, role: user.role } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
