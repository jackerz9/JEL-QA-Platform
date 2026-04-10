const express = require('express');
const { Agent, Category, Contact } = require('../models');

// ═══════════════════════════════════════
//  AGENTS
// ═══════════════════════════════════════
const agentsRouter = express.Router();

agentsRouter.get('/', async (req, res) => {
  const { instance, active } = req.query;
  const query = {};
  if (instance) query.instance = instance;
  if (active !== undefined) query.active = active === 'true';
  const agents = await Agent.find(query).sort({ name: 1 });
  res.json(agents);
});

agentsRouter.post('/', async (req, res) => {
  try {
    const agent = await Agent.create(req.body);
    res.status(201).json(agent);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Agent ID already exists' });
    res.status(400).json({ error: err.message });
  }
});

agentsRouter.post('/bulk', async (req, res) => {
  try {
    const ops = req.body.agents.map(a => ({
      updateOne: {
        filter: { respondioId: a.respondioId },
        update: { $set: a },
        upsert: true,
      },
    }));
    const result = await Agent.bulkWrite(ops);
    res.json({ upserted: result.upsertedCount, modified: result.modifiedCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

agentsRouter.put('/:id', async (req, res) => {
  const agent = await Agent.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!agent) return res.status(404).json({ error: 'Not found' });
  res.json(agent);
});

agentsRouter.delete('/:id', async (req, res) => {
  await Agent.findByIdAndUpdate(req.params.id, { active: false });
  res.json({ ok: true });
});

// ═══════════════════════════════════════
//  CATEGORIES
// ═══════════════════════════════════════
const categoriesRouter = express.Router();

categoriesRouter.get('/', async (req, res) => {
  const { active, group } = req.query;
  const query = {};
  if (active !== undefined) query.active = active === 'true';
  if (group) query.group = group;
  const categories = await Category.find(query).sort({ code: 1 });
  res.json(categories);
});

categoriesRouter.post('/', async (req, res) => {
  try {
    const cat = await Category.create(req.body);
    res.status(201).json(cat);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Category code already exists' });
    res.status(400).json({ error: err.message });
  }
});

categoriesRouter.post('/bulk', async (req, res) => {
  try {
    const ops = req.body.categories.map(c => ({
      updateOne: {
        filter: { code: c.code },
        update: { $set: c },
        upsert: true,
      },
    }));
    const result = await Category.bulkWrite(ops);
    res.json({ upserted: result.upsertedCount, modified: result.modifiedCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

categoriesRouter.post('/import-from-conversations', async (req, res) => {
  // Auto-import categories from existing conversation data
  const { Conversation } = require('../models');
  const cats = await Conversation.distinct('respondioCategory');
  const validCats = cats.filter(c => c && c.trim());

  const ops = validCats.map(cat => {
    // Parse "8. CLP - Estatus de Retiro" → group: "CLP", name: "Estatus de Retiro"
    const match = cat.match(/^(\d+\.\s*)?([^-]+)\s*-\s*(.+)$/);
    const group = match ? match[2].trim() : 'General';
    const name = match ? match[3].trim() : cat;

    return {
      updateOne: {
        filter: { code: cat },
        update: { $set: { code: cat, name, group, active: true } },
        upsert: true,
      },
    };
  });

  if (ops.length > 0) {
    const result = await Category.bulkWrite(ops);
    res.json({ imported: validCats.length, upserted: result.upsertedCount });
  } else {
    res.json({ imported: 0 });
  }
});

categoriesRouter.put('/:id', async (req, res) => {
  const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!cat) return res.status(404).json({ error: 'Not found' });
  res.json(cat);
});

categoriesRouter.delete('/:id', async (req, res) => {
  await Category.findByIdAndUpdate(req.params.id, { active: false });
  res.json({ ok: true });
});

// ═══════════════════════════════════════
//  CONTACTS
// ═══════════════════════════════════════
const contactsRouter = express.Router();

contactsRouter.get('/', async (req, res) => {
  const { search, limit = 50, skip = 0 } = req.query;
  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { respondioId: { $regex: search, $options: 'i' } },
    ];
  }
  const [contacts, total] = await Promise.all([
    Contact.find(query).sort({ updatedAt: -1 }).limit(parseInt(limit)).skip(parseInt(skip)),
    Contact.countDocuments(query),
  ]);
  res.json({ contacts, total });
});

contactsRouter.post('/', async (req, res) => {
  try {
    const contact = await Contact.create(req.body);
    res.status(201).json(contact);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Contact ID already exists' });
    res.status(400).json({ error: err.message });
  }
});

contactsRouter.post('/bulk', async (req, res) => {
  try {
    const ops = req.body.contacts.map(c => ({
      updateOne: {
        filter: { respondioId: c.respondioId },
        update: { $set: c },
        upsert: true,
      },
    }));
    const result = await Contact.bulkWrite(ops);
    res.json({ upserted: result.upsertedCount, modified: result.modifiedCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

contactsRouter.put('/:id', async (req, res) => {
  const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!contact) return res.status(404).json({ error: 'Not found' });
  res.json(contact);
});

contactsRouter.delete('/:id', async (req, res) => {
  await Contact.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

/**
 * POST /api/contacts/import-csv
 * Import contacts from Respond.io CSV export
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse');

const contactUpload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 20 * 1024 * 1024 },
});

contactsRouter.post('/import-csv', contactUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const contacts = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(parse({ columns: true, trim: true, skip_empty_lines: true }))
        .on('data', (row) => {
          // Parse Tags: "username,CURRENCY" or "CURRENCY,username" or just "username"
          const tags = (row['Tags'] || '').split(',').map(t => t.trim()).filter(Boolean);
          const currencies = ['VES', 'VEF', 'CLP', 'PEN', 'MEX', 'USD', 'MXN', 'BRL', 'ARS', 'COP'];
          const username = tags.find(t => !currencies.includes(t.toUpperCase())) || '';
          const tagList = tags.filter(t => currencies.includes(t.toUpperCase()));

          const name = [row['FirstName'] || '', row['LastName'] || ''].filter(Boolean).join(' ').trim();

          contacts.push({
            respondioId: row['ContactID'],
            name: name || undefined,
            phone: row['PhoneNumber'] || undefined,
            email: row['Email'] || undefined,
            country: row['Country'] || undefined,
            username: username || undefined,
            tags: tagList.length > 0 ? tagList : (row['Channels'] ? [row['Channels']] : []),
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Bulk upsert
    const ops = contacts
      .filter(c => c.respondioId)
      .map(c => ({
        updateOne: {
          filter: { respondioId: c.respondioId },
          update: { $set: c },
          upsert: true,
        },
      }));

    const result = await Contact.bulkWrite(ops);

    // Clean up uploaded file
    fs.unlink(req.file.path, () => {});

    res.json({
      total: contacts.length,
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
    });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ error: err.message });
  }
});

// ═══════════════════════════════════════
//  CHANNELS
// ═══════════════════════════════════════
const { Channel } = require('../models');
const channelsRouter = express.Router();

channelsRouter.get('/', async (req, res) => {
  const { instance, country, active } = req.query;
  const query = {};
  if (instance) query.instance = instance;
  if (country) query.country = country;
  if (active !== undefined) query.active = active === 'true';
  const channels = await Channel.find(query).sort({ country: 1, name: 1 });
  res.json(channels);
});

channelsRouter.post('/', async (req, res) => {
  try {
    const channel = await Channel.create(req.body);
    res.status(201).json(channel);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Channel ID already exists' });
    res.status(400).json({ error: err.message });
  }
});

channelsRouter.put('/:id', async (req, res) => {
  const channel = await Channel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!channel) return res.status(404).json({ error: 'Not found' });
  res.json(channel);
});

channelsRouter.delete('/:id', async (req, res) => {
  await Channel.findByIdAndUpdate(req.params.id, { active: false });
  res.json({ ok: true });
});

module.exports = { agentsRouter, categoriesRouter, contactsRouter, channelsRouter };
