const express = require('express');
const { Evaluation, Conversation, Message, Agent } = require('../models');

const router = express.Router();

/**
 * Helper: get conversation IDs matching a date range (by conversation startedAt)
 */
async function getConvIdsForDateRange(dateFrom, dateTo, instance) {
  if (!dateFrom && !dateTo) return null;
  const query = {};
  query.startedAt = {};
  if (dateFrom) query.startedAt.$gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    query.startedAt.$lte = end;
  }
  if (instance) query.instance = instance;
  const convs = await Conversation.find(query, { conversationId: 1 });
  return convs.map(c => c.conversationId);
}

/**
 * GET /api/dashboard/summary
 */
router.get('/summary', async (req, res) => {
  const { instance, dateFrom, dateTo } = req.query;

  const match = { status: 'scored' };
  if (instance) match.instance = instance;
  const convIds = await getConvIdsForDateRange(dateFrom, dateTo, instance);
  if (convIds !== null) match.conversationId = { $in: convIds };

  const [stats] = await Evaluation.aggregate([
    { $match: match },
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
    totalEvaluations: 0, avgFinalScore: 0, avgQuantitative: 0, avgQualitative: 0,
    avgFirstResponse: 0, gradeA: 0, gradeB: 0, gradeC: 0, gradeD: 0, gradeF: 0,
  });
});

/**
 * GET /api/dashboard/agents
 */
router.get('/agents', async (req, res) => {
  const { instance, dateFrom, dateTo } = req.query;

  const match = { status: 'scored' };
  if (instance) match.instance = instance;
  const convIds = await getConvIdsForDateRange(dateFrom, dateTo, instance);
  if (convIds !== null) match.conversationId = { $in: convIds };

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

  const agents = await Agent.find({});
  const agentMap = {};
  agents.forEach(a => { agentMap[a.respondioId] = a.name; });

  const enriched = agentStats.map(s => ({
    ...s,
    agentName: agentMap[s._id] || (s._id ? `Agente ${s._id}` : 'Sin asignar'),
  }));

  res.json(enriched);
});

/**
 * GET /api/dashboard/categories
 */
router.get('/categories', async (req, res) => {
  const { instance, dateFrom, dateTo } = req.query;

  const match = { status: 'scored' };
  if (instance) match.instance = instance;
  const convIds = await getConvIdsForDateRange(dateFrom, dateTo, instance);
  if (convIds !== null) match.conversationId = { $in: convIds };

  const cats = await Evaluation.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$aiCategory',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  res.json(cats);
});

/**
 * GET /api/dashboard/timeline
 */
router.get('/timeline', async (req, res) => {
  const { instance, dateFrom, dateTo } = req.query;

  const match = { status: 'scored' };
  if (instance) match.instance = instance;
  const convIds = await getConvIdsForDateRange(dateFrom, dateTo, instance);
  if (convIds !== null) match.conversationId = { $in: convIds };

  const timeline = await Evaluation.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'conversations',
        localField: 'conversationId',
        foreignField: 'conversationId',
        as: 'conv',
      },
    },
    { $unwind: { path: '$conv', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: { $ifNull: ['$conv.startedAt', '$evaluatedAt'] } } },
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
