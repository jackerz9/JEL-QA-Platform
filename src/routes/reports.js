const express = require('express');
const { Evaluation, Conversation, Agent, Message } = require('../models');

const router = express.Router();

/**
 * GET /api/reports/agent-daily
 * Reporte completo de un agente en un día o rango
 */
router.get('/agent-daily', async (req, res) => {
  const { agentId, dateFrom, dateTo, instance } = req.query;

  if (!agentId || !dateFrom) {
    return res.status(400).json({ error: 'agentId and dateFrom are required' });
  }

  const match = {
    agentId,
    status: 'scored',
  };
  if (instance) match.instance = instance;

  // Date range
  const from = new Date(dateFrom);
  const to = dateTo ? new Date(dateTo) : new Date(from.getTime() + 86400000); // default: 1 day
  match.evaluatedAt = { $gte: from, $lt: to };

  const evaluations = await Evaluation.find(match).sort({ finalScore: 1 });

  if (evaluations.length === 0) {
    return res.json({ agent: null, summary: null, evaluations: [], highlights: [] });
  }

  // Agent info
  const agent = await Agent.findOne({ respondioId: agentId });

  // Aggregate stats
  const totalEvals = evaluations.length;
  const avgFinal = Math.round(evaluations.reduce((s, e) => s + e.finalScore, 0) / totalEvals);
  const avgQuant = Math.round(evaluations.reduce((s, e) => s + (e.quantitative?.totalScore || 0), 0) / totalEvals);
  const avgQual = Math.round(evaluations.reduce((s, e) => s + (e.qualitative?.totalScore || 0), 0) / totalEvals);
  const avgTone = Math.round(evaluations.reduce((s, e) => s + (e.qualitative?.toneScore || 0), 0) / totalEvals);
  const avgEmpathy = Math.round(evaluations.reduce((s, e) => s + (e.qualitative?.empathyScore || 0), 0) / totalEvals);
  const avgResolution = Math.round(evaluations.reduce((s, e) => s + (e.qualitative?.resolutionScore || 0), 0) / totalEvals);
  const avgProfessionalism = Math.round(evaluations.reduce((s, e) => s + (e.qualitative?.professionalismScore || 0), 0) / totalEvals);
  const avgSentiment = Math.round(evaluations.reduce((s, e) => s + (e.sentiment?.score || 0), 0) / totalEvals);

  // Grade distribution
  const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  evaluations.forEach(e => { if (e.grade) grades[e.grade]++; });

  // Sentiment distribution
  const sentiments = { muy_positivo: 0, positivo: 0, neutral: 0, negativo: 0, muy_negativo: 0 };
  evaluations.forEach(e => {
    const label = e.sentiment?.label;
    if (label && sentiments[label] !== undefined) sentiments[label]++;
  });

  // Category breakdown
  const catCounts = {};
  evaluations.forEach(e => {
    const cat = e.aiCategory || e.aiCategories?.[0] || 'Sin categoría';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const categoryBreakdown = Object.entries(catCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Alerts
  const alerts = evaluations.filter(e => e.needsAttention);

  // Worst 3 (need most improvement)
  const worst = evaluations.slice(0, 3);

  // Best 3
  const best = [...evaluations].sort((a, b) => b.finalScore - a.finalScore).slice(0, 3);

  // Collect all coaching tips
  const coachingTips = evaluations
    .filter(e => e.coachingTip)
    .map(e => ({
      conversationId: e.conversationId,
      tip: e.coachingTip,
      score: e.finalScore,
      grade: e.grade,
    }));

  // Aggregate common improvement themes
  const allImprovements = evaluations.flatMap(e => e.qualitative?.improvements || []);
  const improvementCounts = {};
  allImprovements.forEach(imp => {
    // Normalize: lowercase, trim
    const key = imp.toLowerCase().trim();
    improvementCounts[key] = (improvementCounts[key] || 0) + 1;
  });
  const topImprovements = Object.entries(improvementCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));

  const allStrengths = evaluations.flatMap(e => e.qualitative?.strengths || []);
  const strengthCounts = {};
  allStrengths.forEach(s => {
    const key = s.toLowerCase().trim();
    strengthCounts[key] = (strengthCounts[key] || 0) + 1;
  });
  const topStrengths = Object.entries(strengthCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));

  res.json({
    agent: {
      id: agentId,
      name: agent?.name || `Agente ${agentId}`,
      instance: agent?.instance || instance,
    },
    period: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      totalEvals,
      avgFinal,
      avgQuant,
      avgQual,
      avgTone,
      avgEmpathy,
      avgResolution,
      avgProfessionalism,
      avgSentiment,
      grades,
      sentiments,
      categoryBreakdown,
      alertCount: alerts.length,
    },
    highlights: {
      best: best.map(e => ({
        conversationId: e.conversationId,
        finalScore: e.finalScore,
        grade: e.grade,
        summary: e.qualitative?.summary,
        sentiment: e.sentiment?.label,
      })),
      worst: worst.map(e => ({
        conversationId: e.conversationId,
        finalScore: e.finalScore,
        grade: e.grade,
        summary: e.qualitative?.summary,
        sentiment: e.sentiment?.label,
        coachingTip: e.coachingTip,
      })),
      alerts: alerts.map(e => ({
        conversationId: e.conversationId,
        finalScore: e.finalScore,
        reason: e.attentionReason,
        sentiment: e.sentiment?.label,
      })),
    },
    coaching: {
      topImprovements,
      topStrengths,
      tips: coachingTips.slice(0, 10),
    },
    evaluations: evaluations.map(e => ({
      conversationId: e.conversationId,
      finalScore: e.finalScore,
      grade: e.grade,
      sentiment: e.sentiment,
      aiCategory: e.aiCategory,
      needsAttention: e.needsAttention,
      coachingTip: e.coachingTip,
      summary: e.qualitative?.summary,
    })),
  });
});

/**
 * GET /api/reports/agents-summary
 * Resumen de todos los agentes para un período (para la lista de reportes)
 */
router.get('/agents-summary', async (req, res) => {
  const { dateFrom, dateTo, instance } = req.query;

  const match = { status: 'scored' };
  if (instance) match.instance = instance;
  if (dateFrom || dateTo) {
    match.evaluatedAt = {};
    if (dateFrom) match.evaluatedAt.$gte = new Date(dateFrom);
    if (dateTo) match.evaluatedAt.$lte = new Date(dateTo);
  }

  const stats = await Evaluation.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$agentId',
        totalEvals: { $sum: 1 },
        avgFinal: { $avg: '$finalScore' },
        avgSentiment: { $avg: '$sentiment.score' },
        alertCount: { $sum: { $cond: ['$needsAttention', 1, 0] } },
        gradeA: { $sum: { $cond: [{ $eq: ['$grade', 'A'] }, 1, 0] } },
        gradeB: { $sum: { $cond: [{ $eq: ['$grade', 'B'] }, 1, 0] } },
        gradeC: { $sum: { $cond: [{ $eq: ['$grade', 'C'] }, 1, 0] } },
        gradeD: { $sum: { $cond: [{ $eq: ['$grade', 'D'] }, 1, 0] } },
        gradeF: { $sum: { $cond: [{ $eq: ['$grade', 'F'] }, 1, 0] } },
      },
    },
    { $sort: { avgFinal: -1 } },
  ]);

  const agents = await Agent.find({});
  const agentMap = {};
  agents.forEach(a => { agentMap[a.respondioId] = a; });

  const enriched = stats.map(s => ({
    ...s,
    agentName: agentMap[s._id]?.name || `Agente ${s._id}`,
    instance: agentMap[s._id]?.instance || '',
  }));

  res.json(enriched);
});

module.exports = router;
