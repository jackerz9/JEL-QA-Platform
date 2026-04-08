require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const uploadRouter = require('./routes/upload');
const dashboardRouter = require('./routes/dashboard');
const { agentsRouter, categoriesRouter, contactsRouter } = require('./routes/crud');
const { errorHandler } = require('./middleware/errorHandler');

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

// API routes
app.use('/api/upload', uploadRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/contacts', contactsRouter);

// Evaluations routes (from dashboard router)
app.use('/api', dashboardRouter);

// Health check
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

// Error handler
app.use(errorHandler);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    }
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
