const express = require('express');
const { Evaluation, Conversation, Message, Agent } = require('../models');

const router = express.Router();

/**
 * GET /api/evaluations
 */
router.get('/', async (req, res) => {
  const { instance, agentId, grade, dateFrom, dateTo, limit = 50, skip = 0, sort = '-finalScore' } = req.query;

  // If filtering by date, we need to find matching conversation IDs first
  let conversationIdFilter = null;
  if (dateFrom || dateTo) {
    const convQuery = {};
    convQuery.startedAt = {};
    if (dateFrom) convQuery.startedAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      convQuery.startedAt.$lte = endDate;
    }
    if (instance) convQuery.instance = instance;
    const convIds = await Conversation.find(convQuery, { conversationId: 1 });
    conversationIdFilter = convIds.map(c => c.conversationId);
  }

  const query = { status: 'scored' };
  if (instance) query.instance = instance;
  if (agentId) query.agentId = agentId;
  if (grade) query.grade = grade;
  if (conversationIdFilter !== null) {
    query.conversationId = { $in: conversationIdFilter };
  }

  const [evaluations, total] = await Promise.all([
    Evaluation.find(query).sort(sort).limit(parseInt(limit)).skip(parseInt(skip)),
    Evaluation.countDocuments(query),
  ]);

  const agents = await Agent.find({});
  const agentMap = {};
  agents.forEach(a => { agentMap[a.respondioId] = a.name; });

  const enriched = evaluations.map(e => ({
    ...e.toObject(),
    agentName: agentMap[e.agentId] || (e.agentId ? `Agente ${e.agentId}` : 'Sin asignar'),
  }));

  res.json({ evaluations: enriched, total });
});

/**
 * GET /api/evaluations/export/csv
 */
router.get('/export/csv', async (req, res) => {
  const { instance, dateFrom, dateTo } = req.query;

  const query = { status: 'scored' };
  if (instance) query.instance = instance;
  if (dateFrom || dateTo) {
    query.evaluatedAt = {};
    if (dateFrom) query.evaluatedAt.$gte = new Date(dateFrom);
    if (dateTo) query.evaluatedAt.$lte = new Date(dateTo);
  }

  const evaluations = await Evaluation.find(query).sort({ evaluatedAt: -1 });
  const agents = await Agent.find({});
  const agentMap = {};
  agents.forEach(a => { agentMap[a.respondioId] = a.name; });

  const header = 'Conversation ID,Agente,Instancia,Score Cuantitativo,Score Cualitativo,Score Final,Nota,Tono,Empatía,Resolución,Profesionalismo,1ra Respuesta,Categoría IA,Resumen\n';
  const rows = evaluations.map(e => {
    const fields = [
      e.conversationId,
      `"${agentMap[e.agentId] || e.agentId}"`,
      e.instance,
      e.quantitative?.totalScore || 0,
      e.qualitative?.totalScore || 0,
      e.finalScore,
      e.grade,
      e.qualitative?.toneScore || 0,
      e.qualitative?.empathyScore || 0,
      e.qualitative?.resolutionScore || 0,
      e.qualitative?.professionalismScore || 0,
      e.quantitative?.firstResponseScore || 0,
      `"${(e.aiCategories || []).join('; ')}"`,
      `"${(e.qualitative?.summary || '').replace(/"/g, '""')}"`,
    ];
    return fields.join(',');
  }).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=jel-qa-export-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send('\ufeff' + header + rows);
});

/**
 * GET /api/evaluations/:conversationId
 */
router.get('/:conversationId', async (req, res) => {
  const { conversationId } = req.params;

  const [evaluation, conversation, messages] = await Promise.all([
    Evaluation.findOne({ conversationId }),
    Conversation.findOne({ conversationId }),
    Message.find({ conversationId }).sort({ timestamp: 1 }),
  ]);

  if (!evaluation) return res.status(404).json({ error: 'Evaluation not found' });

  const agent = await Agent.findOne({ respondioId: evaluation.agentId });
  const { Channel } = require('../models');
  const channel = conversation?.openedByChannel
    ? await Channel.findOne({ channelId: conversation.openedByChannel })
    : null;

  res.json({
    evaluation,
    conversation,
    messages,
    agentName: agent?.name || (evaluation.agentId ? `Agente ${evaluation.agentId}` : 'Sin asignar'),
    channelName: channel?.name || conversation?.openedByChannel || 'Desconocido',
  });
});

/**
 * POST /api/evaluations/:conversationId/reevaluate
 */
router.post('/:conversationId/reevaluate', async (req, res) => {
  const { conversationId } = req.params;
  const { Category } = require('../models');
  const Settings = require('../models/Settings');
  const { evaluateQuantitative } = require('../services/scoreEngine');
  const { evaluateQualitative, calculateFinalScore } = require('../services/deepseekEval');

  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const messages = await Message.find({ conversationId }).sort({ timestamp: 1 });
  const categories = await Category.find({ active: true });
  const settings = await Settings.getSettings();

  try {
    const quantitative = evaluateQuantitative(conversation, settings.weights);
    const qualitative = await evaluateQualitative(messages, conversation, categories, settings.ai);

    const qWeight = (settings.weights?.quantitativeWeight || 60) / 100;
    const cWeight = (settings.weights?.qualitativeWeight || 40) / 100;
    const finalScore = Math.round(quantitative.totalScore * qWeight + qualitative.totalScore * cWeight);

    const g = settings.weights?.grades || { A: 90, B: 75, C: 60, D: 40 };
    let grade;
    if (finalScore >= g.A) grade = 'A';
    else if (finalScore >= g.B) grade = 'B';
    else if (finalScore >= g.C) grade = 'C';
    else if (finalScore >= g.D) grade = 'D';
    else grade = 'F';

    const evaluation = await Evaluation.findOneAndUpdate(
      { conversationId },
      {
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
        evaluatedAt: new Date(),
      },
      { new: true }
    );

    res.json({ ok: true, evaluation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
