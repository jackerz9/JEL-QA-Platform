const express = require('express');
const { Evaluation, Conversation, Message, Agent } = require('../models');

const router = express.Router();

/**
 * GET /api/dashboard/summary
 * KPIs globales o filtrados por instancia/fecha
 */
router.get('/summary', async (req, res) => {
  const { instance, dateFrom, dateTo } = req.query;

  const match = {};
  if (instance) match.instance = instance;
  if (dateFrom || dateTo) {
    match.evaluatedAt = {};
    if (dateFrom) match.evaluatedAt.$gte = new Date(dateFrom);
    if (dateTo) match.evaluatedAt.$lte = new Date(dateTo);
  }

  const [stats] = await Evaluation.aggregate([
    { $match: { ...match, status: 'scored' } },
    {
      $group: {
        _id: null,
        totalEvaluations: { $sum: 1 },
        avgFinalScore: { $avg: '$finalScore' },
        avgQuantitative: { $avg: '$quantitative.totalScore' },
        avgQualitative: { $avg: '$qualitative.totalScore' },
        avgFirstResponse: { $avg: '$quantitative.firstResponseScore' },
        avgResolution: { $avg: '$quantitative.resolutionTimeScore' },
        avgTone: { $avg: '$qualitative.toneScore' },
        avgEmpathy: { $avg: '$qualitative.empathyScore' },
        avgProfessionalism: { $avg: '$qualitative.professionalismScore' },
        avgResolutionQual: { $avg: '$qualitative.resolutionScore' },
        gradeA: { $sum: { $cond: [{ $eq: ['$grade', 'A'] }, 1, 0] } },
        gradeB: { $sum: { $cond: [{ $eq: ['$grade', 'B'] }, 1, 0] } },
        gradeC: { $sum: { $cond: [{ $eq: ['$grade', 'C'] }, 1, 0] } },
        gradeD: { $sum: { $cond: [{ $eq: ['$grade', 'D'] }, 1, 0] } },
        gradeF: { $sum: { $cond: [{ $eq: ['$grade', 'F'] }, 1, 0] } },
      },
    },
  ]);

  res.json(stats || {
    totalEvaluations: 0,
    avgFinalScore: 0,
    avgQuantitative: 0,
    avgQualitative: 0,
  });
});

/**
 * GET /api/dashboard/agents
 * Ranking de agentes
 */
router.get('/agents', async (req, res) => {
  const { instance, dateFrom, dateTo } = req.query;

  const match = { status: 'scored' };
  if (instance) match.instance = instance;
  if (dateFrom || dateTo) {
    match.evaluatedAt = {};
    if (dateFrom) match.evaluatedAt.$gte = new Date(dateFrom);
    if (dateTo) match.evaluatedAt.$lte = new Date(dateTo);
  }

  const agentStats = await Evaluation.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$agentId',
        totalEvals: { $sum: 1 },
        avgFinalScore: { $avg: '$finalScore' },
        avgQuantitative: { $avg: '$quantitative.totalScore' },
        avgQualitative: { $avg: '$qualitative.totalScore' },
        avgFirstResponse: { $avg: '$quantitative.firstResponseScore' },
        avgTone: { $avg: '$qualitative.toneScore' },
        avgEmpathy: { $avg: '$qualitative.empathyScore' },
        gradeA: { $sum: { $cond: [{ $eq: ['$grade', 'A'] }, 1, 0] } },
        gradeB: { $sum: { $cond: [{ $eq: ['$grade', 'B'] }, 1, 0] } },
        gradeC: { $sum: { $cond: [{ $eq: ['$grade', 'C'] }, 1, 0] } },
        gradeD: { $sum: { $cond: [{ $eq: ['$grade', 'D'] }, 1, 0] } },
        gradeF: { $sum: { $cond: [{ $eq: ['$grade', 'F'] }, 1, 0] } },
      },
    },
    { $sort: { avgFinalScore: -1 } },
  ]);

  // Enrich with agent names
  const agents = await Agent.find({});
  const agentMap = {};
  agents.forEach(a => { agentMap[a.respondioId] = a.name; });

  const enriched = agentStats.map(s => ({
    ...s,
    agentName: agentMap[s._id] || `Agente ${s._id}`,
  }));

  res.json(enriched);
});

/**
 * GET /api/dashboard/categories
 * Distribución de categorías
 */
router.get('/categories', async (req, res) => {
  const { instance, dateFrom, dateTo } = req.query;

  const match = {};
  if (instance) match.instance = instance;
  if (dateFrom || dateTo) {
    match.startedAt = {};
    if (dateFrom) match.startedAt.$gte = new Date(dateFrom);
    if (dateTo) match.startedAt.$lte = new Date(dateTo);
  }

  const cats = await Conversation.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$respondioCategory',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  res.json(cats);
});

/**
 * GET /api/dashboard/timeline
 * Score promedio por día
 */
router.get('/timeline', async (req, res) => {
  const { instance, dateFrom, dateTo } = req.query;

  const match = { status: 'scored' };
  if (instance) match.instance = instance;
  if (dateFrom || dateTo) {
    match.evaluatedAt = {};
    if (dateFrom) match.evaluatedAt.$gte = new Date(dateFrom);
    if (dateTo) match.evaluatedAt.$lte = new Date(dateTo);
  }

  const timeline = await Evaluation.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$evaluatedAt' } },
        avgScore: { $avg: '$finalScore' },
        count: { $sum: 1 },
        avgQuantitative: { $avg: '$quantitative.totalScore' },
        avgQualitative: { $avg: '$qualitative.totalScore' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json(timeline);
});

/**
 * GET /api/evaluations
 * Lista de evaluaciones con paginación y filtros
 */
router.get('/evaluations', async (req, res) => {
  const { instance, agentId, grade, dateFrom, dateTo, limit = 50, skip = 0, sort = '-finalScore' } = req.query;

  const query = { status: 'scored' };
  if (instance) query.instance = instance;
  if (agentId) query.agentId = agentId;
  if (grade) query.grade = grade;
  if (dateFrom || dateTo) {
    query.evaluatedAt = {};
    if (dateFrom) query.evaluatedAt.$gte = new Date(dateFrom);
    if (dateTo) query.evaluatedAt.$lte = new Date(dateTo);
  }

  const [evaluations, total] = await Promise.all([
    Evaluation.find(query).sort(sort).limit(parseInt(limit)).skip(parseInt(skip)),
    Evaluation.countDocuments(query),
  ]);

  // Enrich with agent names
  const agents = await Agent.find({});
  const agentMap = {};
  agents.forEach(a => { agentMap[a.respondioId] = a.name; });

  const enriched = evaluations.map(e => ({
    ...e.toObject(),
    agentName: agentMap[e.agentId] || `Agente ${e.agentId}`,
  }));

  res.json({ evaluations: enriched, total });
});

/**
 * GET /api/evaluations/:conversationId
 * Detalle completo de una evaluación + mensajes
 */
router.get('/evaluations/:conversationId', async (req, res) => {
  const { conversationId } = req.params;

  const [evaluation, conversation, messages] = await Promise.all([
    Evaluation.findOne({ conversationId }),
    Conversation.findOne({ conversationId }),
    Message.find({ conversationId }).sort({ timestamp: 1 }),
  ]);

  if (!evaluation) return res.status(404).json({ error: 'Evaluation not found' });

  // Agent name
  const agent = await Agent.findOne({ respondioId: evaluation.agentId });

  res.json({
    evaluation,
    conversation,
    messages,
    agentName: agent?.name || `Agente ${evaluation.agentId}`,
  });
});

/**
 * POST /api/evaluations/:conversationId/reevaluate
 * Re-evaluar una conversación con DeepSeek
 */
router.post('/evaluations/:conversationId/reevaluate', async (req, res) => {
  const { conversationId } = req.params;
  const { Category } = require('../models');
  const { evaluateQuantitative } = require('../services/scoreEngine');
  const { evaluateQualitative, calculateFinalScore } = require('../services/deepseekEval');

  const conversation = await Conversation.findOne({ conversationId });
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const messages = await Message.find({ conversationId }).sort({ timestamp: 1 });
  const categories = await Category.find({ active: true });

  try {
    const quantitative = evaluateQuantitative(conversation);
    const qualitative = await evaluateQualitative(messages, conversation, categories);
    const { finalScore, grade } = calculateFinalScore(quantitative.totalScore, qualitative.totalScore);

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
        aiCategories: qualitative.suggestedCategories || [],
        aiCategoryConfidence: qualitative.categoryConfidence || 0,
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

/**
 * GET /api/evaluations/export/csv
 * Exportar evaluaciones como CSV
 */
router.get('/evaluations/export/csv', async (req, res) => {
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
  res.send('\ufeff' + header + rows); // BOM for Excel
});

module.exports = router;
