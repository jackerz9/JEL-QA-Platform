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
  upload.fields([
    { name: 'conversations', maxCount: 1 },
    { name: 'messages', maxCount: 1 },
  ]),
  async (req, res) => {
    const { instance, date } = req.body;

    if (!instance || !date) {
      return res.status(400).json({ error: 'instance and date are required' });
    }
    if (!req.files?.conversations?.[0] || !req.files?.messages?.[0]) {
      return res.status(400).json({ error: 'Both conversations and messages CSV files are required' });
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

    // Create batch
    const batch = await UploadBatch.create({
      instance,
      date: new Date(date),
      conversationsFile: req.files.conversations[0].filename,
      messagesFile: req.files.messages[0].filename,
      status: 'parsing',
    });

    // Start async processing
    processUpload(batch, req.files.conversations[0].path, req.files.messages[0].path, instance)
      .catch(err => {
        console.error('Upload processing error:', err);
        UploadBatch.findByIdAndUpdate(batch._id, { status: 'error' }).catch(() => {});
      });

    res.json({
      batchId: batch._id,
      status: 'parsing',
      message: 'Files uploaded, processing started',
    });
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

    // Load settings
    const Settings = require('../models/Settings');
    const settings = await Settings.getSettings();
    const filters = settings.filters || {};
    const weights = settings.weights || {};
    const aiConfig = settings.ai || {};

    const categories = await Category.find({ active: true });
    let evaluated = 0;
    let errors = 0;
    let skipped = 0;

    for (const conv of conversations) {
      try {
        // Get messages for this conversation
        const convMessages = matched.filter(m => m.conversationId === conv.conversationId);

        // ── Apply configurable filters ──
        const totalMsgs = convMessages.length;
        const agentMessages = convMessages.filter(m => m.senderType === 'user');
        const minTotal = filters.minTotalMessages || 3;
        const minAgent = filters.minAgentMessages || 1;

        if (totalMsgs < minTotal) { skipped++; continue; }
        if (agentMessages.length < minAgent) { skipped++; continue; }
        if (filters.excludeBotOnly && agentMessages.length === 0) { skipped++; continue; }
        if (filters.excludeUnresolved && !conv.resolvedAt) { skipped++; continue; }

        // Quantitative scoring (with configurable weights)
        const quantitative = evaluateQuantitative(conv, weights);

        // Qualitative scoring (DeepSeek with configurable AI params)
        const qualitative = await evaluateQualitative(convMessages, conv, categories, aiConfig);

        // Combined score (configurable weights)
        const qWeight = (weights.quantitativeWeight || 60) / 100;
        const cWeight = (weights.qualitativeWeight || 40) / 100;
        const finalScore = Math.round(quantitative.totalScore * qWeight + qualitative.totalScore * cWeight);

        // Grade (configurable thresholds)
        const g = weights.grades || { A: 90, B: 75, C: 60, D: 40 };
        let grade;
        if (finalScore >= g.A) grade = 'A';
        else if (finalScore >= g.B) grade = 'B';
        else if (finalScore >= g.C) grade = 'C';
        else if (finalScore >= g.D) grade = 'D';
        else grade = 'F';

        // Store evaluation
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
            finalScore,
            grade,
            status: 'scored',
          },
          { upsert: true, new: true }
        );

        evaluated++;

        // Update batch progress every 5 evaluations
        if (evaluated % 5 === 0 || evaluated === 1) {
          await UploadBatch.findByIdAndUpdate(batch._id, {
            evaluatedCount: evaluated,
            errorCount: errors,
          });
        }

        // Small delay to avoid rate limiting DeepSeek
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`Error evaluating ${conv.conversationId}:`, err.message);
        errors++;

        // Update error count too
        if (errors % 3 === 0 || errors === 1) {
          await UploadBatch.findByIdAndUpdate(batch._id, {
            evaluatedCount: evaluated,
            errorCount: errors,
          });
        }

        await Evaluation.findOneAndUpdate(
          { conversationId: conv.conversationId },
          {
            conversationId: conv.conversationId,
            instance,
            agentId: conv.assigneeId,
            contactId: conv.contactId,
            status: 'error',
            errorMessage: err.message,
          },
          { upsert: true, new: true }
        );
      }
    }

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
