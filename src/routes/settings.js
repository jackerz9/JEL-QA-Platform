const express = require('express');
const Settings = require('../models/Settings');

const router = express.Router();

// GET /api/settings
router.get('/', async (req, res) => {
  const settings = await Settings.getSettings();
  res.json(settings);
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const settings = await Settings.findByIdAndUpdate(
      'global',
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/settings/:section (partial update)
router.put('/:section', async (req, res) => {
  const { section } = req.params;
  if (!['filters', 'weights', 'ai'].includes(section)) {
    return res.status(400).json({ error: 'Invalid section. Use: filters, weights, ai' });
  }
  try {
    const update = {};
    for (const [key, val] of Object.entries(req.body)) {
      update[`${section}.${key}`] = val;
    }
    const settings = await Settings.findByIdAndUpdate(
      'global',
      { $set: update },
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/settings/reset
router.post('/reset', async (req, res) => {
  await Settings.findByIdAndDelete('global');
  const settings = await Settings.getSettings();
  res.json(settings);
});

module.exports = router;
