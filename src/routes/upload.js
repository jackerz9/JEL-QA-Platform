const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Conversation, Message, Evaluation, UploadBatch, Category } = require('../models');
const { parseConversationsCSV, parseMessagesCSV, matchMessagesToConversations } = require('../services/csvParser');
const { evaluateQuantitative } = require('../services/scoreEngine');
const { evaluateQualitative, calculateFinalScore } = require('../services/deepseekEval');

const router = express.Router();

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

/**
 * POST /api/upload
 * Upload conversations + messages CSVs for a specific date/instance
 */
router.post('/',
  upload.array('files', 2),
  async (req, res) => {
    const { instance, date } = req.body;

    if (!instance || !date) {
      return res.status(400).json({ error: 'instance and date are required' });
    }
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ error: 'Se requieren 2 archivos CSV (conversaciones y mensajes)' });
    }

    // Auto-detect which file is conversations and which is messages
    // by reading the first line of each file
    function readFirstLine(filePath) {
      const content = fs.readFileSync(filePath, 'utf8');
      return content.split('\n')[0] || '';
    }

    let convsFile = null;
    let msgsFile = null;

    for (const file of req.files) {
      try {
        const header = readFirstLine(file.path);
        if (header.includes('Conversation ID') && header.includes('DateTime Conversation Started')) {
          convsFile = file;
        } else if (header.includes('Message ID') && header.includes('Sender Type')) {
          msgsFile = file;
        }
      } catch (e) {
        console.error('Error reading file header:', e.message);
      }
    }

    if (!convsFile || !msgsFile) {
      return res.status(400).json({
        error: 'No se pudieron identificar los archivos. Asegúrate de subir el CSV de conversaciones y el de mensajes de Respond.io.',
      });
    }

    // Check if there's already a batch in progress
    const activeBatch = await UploadBatch.findOne({
      status: { $in: ['uploading', 'parsing', 'evaluating'] },
    });
    if (activeBatch) {
      return res.status(409).json({
        error: `Ya hay una evaluación en curso (${activeBatch.instance}, ${new Date(activeBatch.date).toLocaleDateString('es-CL')}). Espera a que termine o elimínala.`,
        activeBatchId: activeBatch._id,
      });
    }

    // Create batch - append T12:00:00 to avoid timezone shift
    const batch = await UploadBatch.create({
      instance,
      date: new Date(date + 'T12:00:00Z'),
      conversationsFile: convsFile.filename,
      messagesFile: msgsFile.filename,
      status: 'parsing',
    });

    // Start async processing
    processUpload(batch, convsFile.path, msgsFile.path, instance)
      .catch(err => {
        console.error('Upload processing error:', err);
        UploadBatch.findByIdAndUpdate(batch._id, { status: 'error' }).catch(() => {});
      });

    res.json(batch);
  }
);

/**
 * GET /api/upload/:batchId/status
 */
router.get('/:batchId/status', async (req, res) => {
  const { batchId } = req.params;
  if (!batchId || batchId === 'undefined' || batchId.length !== 24) {
    return res.status(400).json({ error: 'Invalid batch ID' });
  }
  try {
    const batch = await UploadBatch.findById(batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json(batch);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid batch ID format' });
  }
});

/**
 * GET /api/upload/batches
 */
router.get('/', async (req, res) => {
  const { instance, limit = 20 } = req.query;
  const query = instance ? { instance } : {};
  const batches = await UploadBatch.find(query).sort({ createdAt: -1 }).limit(parseInt(limit));
  res.json(batches);
});

/**
 * DELETE /api/upload/:batchId
 * Eliminar un batch completo: evaluaciones, mensajes, conversaciones y el batch
 */
router.delete('/:batchId', async (req, res) => {
  const { batchId } = req.params;
  if (!batchId || batchId === 'undefined' || batchId.length !== 24) {
    return res.status(400).json({ error: 'Invalid batch ID' });
  }

  try {
    const batch = await UploadBatch.findById(batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    // Get all conversation IDs from this batch
    const conversations = await Conversation.find({ uploadBatchId: batch._id }, { conversationId: 1 });
    const convIds = conversations.map(c => c.conversationId);

    // Delete evaluations for these conversations
    const evalResult = await Evaluation.deleteMany({ conversationId: { $in: convIds } });

    // Delete messages from this batch
    const msgResult = await Message.deleteMany({ uploadBatchId: batch._id });

    // Delete conversations from this batch
    const convResult = await Conversation.deleteMany({ uploadBatchId: batch._id });

    // Delete the batch itself
    await UploadBatch.findByIdAndDelete(batchId);

    res.json({
      ok: true,
      deleted: {
        evaluations: evalResult.deletedCount,
        messages: msgResult.deletedCount,
        conversations: convResult.deletedCount,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Process upload: parse CSVs, match, store, evaluate
 */
async function processUpload(batch, convsPath, msgsPath, instance) {
  try {
    // 1. Parse CSVs
    const conversations = await parseConversationsCSV(convsPath, instance);
    const messages = await parseMessagesCSV(msgsPath);

    await UploadBatch.findByIdAndUpdate(batch._id, {
      totalConversations: conversations.length,
      totalMessages: messages.length,
    });

    // 2. Match messages to conversations
    const { matched, unmatched } = matchMessagesToConversations(messages, conversations);
    console.log(`Matched: ${matched.length}/${messages.length}, Unmatched: ${unmatched.length}`);

    // 3. Store conversations (upsert)
    for (const conv of conversations) {
      await Conversation.findOneAndUpdate(
        { conversationId: conv.conversationId },
        { ...conv, uploadBatchId: batch._id },
        { upsert: true, new: true }
      );
    }

    // 4. Store messages (upsert)
    for (const msg of matched) {
      await Message.findOneAndUpdate(
        { messageId: msg.messageId },
        { ...msg, uploadBatchId: batch._id },
        { upsert: true, new: true }
      );
    }
    // Also store unmatched messages without conversationId
    for (const msg of unmatched) {
      await Message.findOneAndUpdate(
        { messageId: msg.messageId },
        { ...msg, conversationId: null, uploadBatchId: batch._id },
        { upsert: true, new: true }
      );
    }

    // 5. Evaluate each conversation
    await UploadBatch.findByIdAndUpdate(batch._id, { status: 'evaluating' });

    // Load settings (cached for entire batch)
    const Settings = require('../models/Settings');
    const Incident = require('../models/Incident');
    const settings = await Settings.getSettings();
    const filters = settings.filters || {};
    const weights = settings.weights || {};
    const aiConfig = settings.ai || {};

    // Cache categories
    const categories = await Category.find({ active: true });

    // Load active incidents for this instance
    const activeIncidents = await Incident.find({
      active: true,
      $or: [{ instance: 'all' }, { instance }],
    }).sort({ startedAt: 1 });

    let evaluated = 0;
    let errors = 0;
    let skipped = 0;
    const CONCURRENCY = 5;

    // Pre-calculate grade thresholds
    const qWeight = (weights.quantitativeWeight || 60) / 100;
    const cWeight = (weights.qualitativeWeight || 40) / 100;
    const gradeThresholds = weights.grades || { A: 90, B: 75, C: 60, D: 40 };

    // Filter conversations that qualify for evaluation
    const toEvaluate = [];
    for (const conv of conversations) {
      const convMessages = matched.filter(m => m.conversationId === conv.conversationId);
      const agentMessages = convMessages.filter(m => m.senderType === 'user');
      const minTotal = filters.minTotalMessages || 3;
      const minAgent = filters.minAgentMessages || 1;

      if (convMessages.length < minTotal) { skipped++; continue; }
      if (agentMessages.length < minAgent) { skipped++; continue; }
      if (filters.excludeBotOnly && agentMessages.length === 0) { skipped++; continue; }
      if (filters.excludeUnresolved && !conv.resolvedAt) { skipped++; continue; }
      if (!conv.assigneeId) {
        // Try to detect agent from messages (senderType = 'user' means agent in Respond.io)
        const agentMsg = convMessages.find(m => m.senderType === 'user' && m.senderId);
        if (agentMsg?.senderId) {
          conv.assigneeId = agentMsg.senderId;
        } else {
          skipped++; continue; // No agent at all
        }
      }

      toEvaluate.push({ conv, convMessages });
    }

    console.log(`Batch ${batch._id}: ${toEvaluate.length} to evaluate, ${skipped} skipped (of ${conversations.length})`);

    // Process in parallel batches of CONCURRENCY
    async function evaluateOne({ conv, convMessages }) {
      // Check if conversation falls within any incident
      const convStart = conv.startedAt;
      const incident = activeIncidents.find(inc =>
        convStart >= inc.startedAt && convStart <= inc.endedAt
      );
      const relaxFactor = incident ? (incident.relaxFactor || 2) : 1;

      // If incident active, relax quantitative thresholds
      let adjustedWeights = weights;
      if (relaxFactor > 1) {
        adjustedWeights = {
          ...weights,
          firstResponse: {
            ...(weights.firstResponse || {}),
            excellent: ((weights.firstResponse?.excellent) || 30) * relaxFactor,
            good: ((weights.firstResponse?.good) || 60) * relaxFactor,
            acceptable: ((weights.firstResponse?.acceptable) || 120) * relaxFactor,
            slow: ((weights.firstResponse?.slow) || 300) * relaxFactor,
            verySlow: ((weights.firstResponse?.verySlow) || 600) * relaxFactor,
          },
          resolution: {
            ...(weights.resolution || {}),
            excellent: ((weights.resolution?.excellent) || 300) * relaxFactor,
            good: ((weights.resolution?.good) || 600) * relaxFactor,
            acceptable: ((weights.resolution?.acceptable) || 1200) * relaxFactor,
            slow: ((weights.resolution?.slow) || 1800) * relaxFactor,
            verySlow: ((weights.resolution?.verySlow) || 3600) * relaxFactor,
          },
        };
      }

      const quantitative = evaluateQuantitative(conv, adjustedWeights);

      // Pass incident context to AI
      const aiConfigWithIncident = incident
        ? { ...aiConfig, _incidentContext: `IMPORTANTE: Durante esta conversación hubo un incidente operativo activo: "${incident.title}" (${incident.description || ''}). Sé más tolerante con tiempos de respuesta y resolución. No penalices al agente por demoras si el volumen era alto.` }
        : aiConfig;

      const qualitative = await evaluateQualitative(convMessages, conv, categories, aiConfigWithIncident);

      const finalScore = Math.round(quantitative.totalScore * qWeight + qualitative.totalScore * cWeight);
      let grade;
      if (finalScore >= gradeThresholds.A) grade = 'A';
      else if (finalScore >= gradeThresholds.B) grade = 'B';
      else if (finalScore >= gradeThresholds.C) grade = 'C';
      else if (finalScore >= gradeThresholds.D) grade = 'D';
      else grade = 'F';

      await Evaluation.findOneAndUpdate(
        { conversationId: conv.conversationId },
        {
          conversationId: conv.conversationId,
          instance,
          agentId: conv.assigneeId,
          contactId: conv.contactId,
          quantitative,
          qualitative: {
            toneScore: qualitative.toneScore,
            empathyScore: qualitative.empathyScore,
            resolutionScore: qualitative.resolutionScore,
            professionalismScore: qualitative.professionalismScore,
            totalScore: qualitative.totalScore,
            summary: qualitative.summary,
            strengths: qualitative.strengths,
            improvements: qualitative.improvements,
            rawResponse: qualitative.rawResponse,
          },
          sentiment: qualitative.sentiment || { label: 'neutral', score: 0 },
          aiCategory: qualitative.aiCategory || null,
          aiCategories: qualitative.aiCategory ? [qualitative.aiCategory] : [],
          aiCategoryConfidence: qualitative.aiCategoryConfidence || 0,
          aiSubCategory: qualitative.aiSubCategory || '',
          needsAttention: qualitative.needsAttention || false,
          attentionReason: qualitative.attentionReason || '',
          coachingTip: qualitative.coachingTip || '',
          affectedByIncident: !!incident,
          incidentId: incident?._id || null,
          incidentTitle: incident?.title || null,
          relaxFactor,
          finalScore,
          grade,
          status: 'scored',
        },
        { upsert: true, new: true }
      );
    }

    // Parallel execution with concurrency limit
    for (let i = 0; i < toEvaluate.length; i += CONCURRENCY) {
      const chunk = toEvaluate.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(chunk.map(item => evaluateOne(item)));

      for (const r of results) {
        if (r.status === 'fulfilled') {
          evaluated++;
        } else {
          errors++;
          console.error('Evaluation error:', r.reason?.message);
        }
      }

      // Update progress after each parallel chunk
      await UploadBatch.findByIdAndUpdate(batch._id, {
        evaluatedCount: evaluated,
        errorCount: errors,
      });
    }

    // Handle errors individually for retry info
    // (errors already counted above via allSettled)

    await UploadBatch.findByIdAndUpdate(batch._id, {
      status: 'completed',
      evaluatedCount: evaluated,
      errorCount: errors,
      completedAt: new Date(),
    });

    console.log(`Batch ${batch._id} completed: ${evaluated} evaluated, ${errors} errors`);
  } catch (err) {
    console.error('processUpload fatal error:', err);
    await UploadBatch.findByIdAndUpdate(batch._id, {
      status: 'error',
    });
    throw err;
  }
}

module.exports = router;
