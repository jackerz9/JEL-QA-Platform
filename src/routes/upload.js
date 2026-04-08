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
  const batch = await UploadBatch.findById(req.params.batchId);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  res.json(batch);
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

    const categories = await Category.find({ active: true });
    let evaluated = 0;
    let errors = 0;

    for (const conv of conversations) {
      try {
        // Get messages for this conversation
        const convMessages = matched.filter(m => m.conversationId === conv.conversationId);

        // Skip conversations with no agent messages
        const agentMessages = convMessages.filter(m => m.senderType === 'user');
        if (agentMessages.length === 0) {
          continue;
        }

        // Quantitative scoring
        const quantitative = evaluateQuantitative(conv);

        // Qualitative scoring (DeepSeek)
        const qualitative = await evaluateQualitative(convMessages, conv, categories);

        // Combined score
        const { finalScore, grade } = calculateFinalScore(
          quantitative.totalScore,
          qualitative.totalScore
        );

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
            aiCategories: qualitative.suggestedCategories || [],
            aiCategoryConfidence: qualitative.categoryConfidence || 0,
            finalScore,
            grade,
            status: 'scored',
          },
          { upsert: true, new: true }
        );

        evaluated++;

        // Small delay to avoid rate limiting DeepSeek
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`Error evaluating ${conv.conversationId}:`, err.message);
        errors++;
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
