const express = require('express');
const Incident = require('../models/Incident');

const router = express.Router();

// GET /api/incidents
router.get('/', async (req, res) => {
  const { instance, active, limit = 50 } = req.query;
  const query = {};
  if (instance) query.$or = [{ instance }, { instance: 'all' }];
  if (active !== undefined) query.active = active === 'true';
  const incidents = await Incident.find(query).sort({ startedAt: -1 }).limit(parseInt(limit));
  res.json(incidents);
});

// POST /api/incidents
router.post('/', async (req, res) => {
  try {
    const incident = await Incident.create({
      ...req.body,
      createdBy: req.user?.name || 'unknown',
    });
    res.status(201).json(incident);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/incidents/:id
router.put('/:id', async (req, res) => {
  try {
    const incident = await Incident.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!incident) return res.status(404).json({ error: 'Not found' });
    res.json(incident);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/incidents/:id
router.delete('/:id', async (req, res) => {
  await Incident.findByIdAndUpdate(req.params.id, { active: false });
  res.json({ ok: true });
});

module.exports = router;
