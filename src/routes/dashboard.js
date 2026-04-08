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
        avgSentiment: { $avg: '$sentiment.score' },
        sentimentPositive: { $sum: { $cond: [{ $in: ['$sentiment.label', ['positivo', 'muy_positivo']] }, 1, 0] } },
        sentimentNeutral: { $sum: { $cond: [{ $eq: ['$sentiment.label', 'neutral'] }, 1, 0] } },
        sentimentNegative: { $sum: { $cond: [{ $in: ['$sentiment.label', ['negativo', 'muy_negativo']] }, 1, 0] } },
        alertCount: { $sum: { $cond: ['$needsAttention', 1, 0] } },
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

module.exports = router;
