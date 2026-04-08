require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const uploadRouter = require('./routes/upload');
const dashboardRouter = require('./routes/dashboard');
const reportsRouter = require('./routes/reports');
const settingsRouter = require('./routes/settings');
const authRouter = require('./routes/auth');
const { agentsRouter, categoriesRouter, contactsRouter } = require('./routes/crud');
const { errorHandler } = require('./middleware/errorHandler');
const { auth, requireRole } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      if (ms > 1000 || res.statusCode >= 400) {
        console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
      }
    });
  }
  next();
});

// ── Public routes (no auth) ──
app.use('/api/auth', authRouter);
app.get('/api/health', async (req, res) => {
  const { Evaluation, Conversation } = require('./models');
  const [evalCount, convCount] = await Promise.all([
    Evaluation.countDocuments({ status: 'scored' }),
    Conversation.countDocuments(),
  ]);
  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    stats: { evaluations: evalCount, conversations: convCount },
  });
});

// ── Protected routes ──
// All roles: dashboard, evaluations, reports (read only)
app.use('/api/dashboard', auth, dashboardRouter);
app.use('/api', auth, dashboardRouter); // evaluations routes
app.use('/api/reports', auth, reportsRouter);

// Admin + Supervisor: upload, contacts, agents, categories
app.use('/api/upload', auth, requireRole('admin', 'supervisor'), uploadRouter);
app.use('/api/contacts', auth, requireRole('admin', 'supervisor'), contactsRouter);
app.use('/api/agents', auth, requireRole('admin', 'supervisor'), agentsRouter);
app.use('/api/categories', auth, requireRole('admin', 'supervisor'), categoriesRouter);

// Admin only: settings
app.use('/api/settings', auth, requireRole('admin'), settingsRouter);

// Error handler for API routes
app.use('/api', errorHandler);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Connect to MongoDB and start
async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`JEL QA Platform running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
