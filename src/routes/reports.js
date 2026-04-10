const express = require('express');
const { Evaluation, Conversation, Agent, Message } = require('../models');

const router = express.Router();

/**
 * GET /api/reports/agent-daily
 * Reporte completo de un agente en un día o rango
 */
router.get('/agent-daily', async (req, res) => {
  const { agentId, dateFrom, dateTo, instance, channel } = req.query;

  if (!agentId || !dateFrom) {
    return res.status(400).json({ error: 'agentId and dateFrom are required' });
  }

  const match = {
    agentId,
    status: 'scored',
  };
  if (instance) match.instance = instance;

  // Date range - filter by conversation date
  const convIds = await getConvIdsForFilters(dateFrom, dateTo || dateFrom, instance, channel);
  if (convIds !== null) match.conversationId = { $in: convIds };

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
    period: { from: dateFrom, to: dateTo || dateFrom },
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
 * Helper: get conversation IDs matching filters (date range, instance, channel)
 */
async function getConvIdsForFilters(dateFrom, dateTo, instance, channel) {
  const query = {};
  let hasFilter = false;

  if (dateFrom || dateTo) {
    query.startedAt = {};
    if (dateFrom) { query.startedAt.$gte = new Date(dateFrom); hasFilter = true; }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query.startedAt.$lte = end;
      hasFilter = true;
    }
  }
  if (instance) { query.instance = instance; hasFilter = true; }
  if (channel) { query.openedByChannel = channel; hasFilter = true; }

  if (!hasFilter) return null; // null = no filter
  const convs = await Conversation.find(query, { conversationId: 1 });
  return convs.map(c => c.conversationId);
}

/**
 * GET /api/reports/agents-summary
 * Resumen de todos los agentes para un período (para la lista de reportes)
 */
router.get('/agents-summary', async (req, res) => {
  const { dateFrom, dateTo, instance, channel } = req.query;

  const match = { status: 'scored' };
  if (instance) match.instance = instance;

  // Filter by conversation date, not evaluation date
  const convIds = await getConvIdsForFilters(dateFrom, dateTo, instance, channel);
  if (convIds !== null) match.conversationId = { $in: convIds };

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

/**
 * GET /api/reports/categories
 */
router.get('/categories', async (req, res) => {
  const { dateFrom, dateTo, instance, channel } = req.query;
  const match = { status: 'scored' };
  if (instance) match.instance = instance;
  const convIds = await getConvIdsForFilters(dateFrom, dateTo, instance, channel);
  if (convIds !== null) match.conversationId = { $in: convIds };

  const stats = await Evaluation.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$aiCategory',
        count: { $sum: 1 },
        avgScore: { $avg: '$finalScore' },
        avgSentiment: { $avg: '$sentiment.score' },
        alertCount: { $sum: { $cond: ['$needsAttention', 1, 0] } },
        gradeA: { $sum: { $cond: [{ $eq: ['$grade', 'A'] }, 1, 0] } },
        gradeB: { $sum: { $cond: [{ $eq: ['$grade', 'B'] }, 1, 0] } },
        gradeC: { $sum: { $cond: [{ $eq: ['$grade', 'C'] }, 1, 0] } },
        gradeD: { $sum: { $cond: [{ $eq: ['$grade', 'D'] }, 1, 0] } },
        gradeF: { $sum: { $cond: [{ $eq: ['$grade', 'F'] }, 1, 0] } },
      },
    },
    { $sort: { count: -1 } },
  ]);

  res.json(stats);
});

/**
 * GET /api/reports/sentiment
 */
router.get('/sentiment', async (req, res) => {
  const { dateFrom, dateTo, instance, channel } = req.query;
  const match = { status: 'scored' };
  if (instance) match.instance = instance;
  const convIds = await getConvIdsForFilters(dateFrom, dateTo, instance, channel);
  if (convIds !== null) match.conversationId = { $in: convIds };

  const [distribution, byAgent, timeline] = await Promise.all([
    // Overall distribution
    Evaluation.aggregate([
      { $match: match },
      { $group: { _id: '$sentiment.label', count: { $sum: 1 }, avgScore: { $avg: '$finalScore' } } },
      { $sort: { count: -1 } },
    ]),
    // By agent
    Evaluation.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$agentId',
          avgSentiment: { $avg: '$sentiment.score' },
          totalEvals: { $sum: 1 },
          positive: { $sum: { $cond: [{ $in: ['$sentiment.label', ['positivo', 'muy_positivo']] }, 1, 0] } },
          negative: { $sum: { $cond: [{ $in: ['$sentiment.label', ['negativo', 'muy_negativo']] }, 1, 0] } },
        },
      },
      { $sort: { avgSentiment: -1 } },
    ]),
    // By day
    Evaluation.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$evaluatedAt' } },
          avgSentiment: { $avg: '$sentiment.score' },
          count: { $sum: 1 },
          positive: { $sum: { $cond: [{ $in: ['$sentiment.label', ['positivo', 'muy_positivo']] }, 1, 0] } },
          negative: { $sum: { $cond: [{ $in: ['$sentiment.label', ['negativo', 'muy_negativo']] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const agents = await Agent.find({});
  const agentMap = {};
  agents.forEach(a => { agentMap[a.respondioId] = a.name; });

  res.json({
    distribution,
    byAgent: byAgent.map(a => ({ ...a, agentName: agentMap[a._id] || `Agente ${a._id}` })),
    timeline,
  });
});

/**
 * GET /api/reports/incidents
 */
router.get('/incidents', async (req, res) => {
  const { dateFrom, dateTo, instance, channel } = req.query;
  const Incident = require('../models/Incident');

  const incidentQuery = { active: true };
  if (instance) incidentQuery.$or = [{ instance }, { instance: 'all' }];
  if (dateFrom || dateTo) {
    incidentQuery.startedAt = {};
    if (dateFrom) incidentQuery.startedAt.$gte = new Date(dateFrom);
    if (dateTo) incidentQuery.startedAt.$lte = new Date(dateTo);
  }

  const incidents = await Incident.find(incidentQuery).sort({ startedAt: -1 });

  // For each incident, count affected evaluations
  const enriched = await Promise.all(incidents.map(async (inc) => {
    const evalCount = await Evaluation.countDocuments({
      affectedByIncident: true,
      incidentId: inc._id,
      status: 'scored',
    });
    const avgScore = await Evaluation.aggregate([
      { $match: { incidentId: inc._id, status: 'scored' } },
      { $group: { _id: null, avg: { $avg: '$finalScore' } } },
    ]);

    return {
      ...inc.toObject(),
      affectedEvaluations: evalCount,
      avgScore: avgScore[0]?.avg ? Math.round(avgScore[0].avg) : null,
    };
  }));

  res.json(enriched);
});

/**
 * GET /api/reports/channels
 * Report by channel with country info
 */
router.get('/channels', async (req, res) => {
  const { dateFrom, dateTo, instance, channel, country } = req.query;
  const { Channel } = require('../models');

  const match = { status: 'scored' };
  if (instance) match.instance = instance;
  const convIds = await getConvIdsForFilters(dateFrom, dateTo, instance, channel);
  if (convIds !== null) match.conversationId = { $in: convIds };

  // Get conversations grouped by channel
  const convMatch = {};
  if (instance) convMatch.instance = instance;
  if (dateFrom || dateTo) {
    convMatch.startedAt = {};
    if (dateFrom) convMatch.startedAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      convMatch.startedAt.$lte = end;
    }
  }

  const channelVolume = await Conversation.aggregate([
    { $match: convMatch },
    { $group: { _id: '$openedByChannel', conversations: { $sum: 1 } } },
  ]);

  // Get eval stats by looking up conversation channel
  const evalsByChannel = await Evaluation.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'conversations',
        localField: 'conversationId',
        foreignField: 'conversationId',
        as: 'conv',
      },
    },
    { $unwind: '$conv' },
    {
      $group: {
        _id: '$conv.openedByChannel',
        evaluated: { $sum: 1 },
        avgScore: { $avg: '$finalScore' },
        avgSentiment: { $avg: '$sentiment.score' },
        alertCount: { $sum: { $cond: ['$needsAttention', 1, 0] } },
        gradeA: { $sum: { $cond: [{ $eq: ['$grade', 'A'] }, 1, 0] } },
        gradeB: { $sum: { $cond: [{ $eq: ['$grade', 'B'] }, 1, 0] } },
        gradeC: { $sum: { $cond: [{ $eq: ['$grade', 'C'] }, 1, 0] } },
        gradeD: { $sum: { $cond: [{ $eq: ['$grade', 'D'] }, 1, 0] } },
        gradeF: { $sum: { $cond: [{ $eq: ['$grade', 'F'] }, 1, 0] } },
      },
    },
  ]);

  // Enrich with channel info
  const channels = await Channel.find({});
  const channelMap = {};
  channels.forEach(c => { channelMap[c.channelId] = c; });

  const volumeMap = {};
  channelVolume.forEach(v => { volumeMap[v._id] = v.conversations; });

  let result = evalsByChannel.map(e => {
    const ch = channelMap[e._id] || {};
    return {
      channelId: e._id,
      channelName: ch.name || `Canal ${e._id}`,
      country: ch.country || '??',
      type: ch.type || 'unknown',
      instance: ch.instance || '',
      conversations: volumeMap[e._id] || 0,
      evaluated: e.evaluated,
      avgScore: Math.round(e.avgScore || 0),
      avgSentiment: Math.round(e.avgSentiment || 0),
      alertCount: e.alertCount,
      grades: { A: e.gradeA, B: e.gradeB, C: e.gradeC, D: e.gradeD, F: e.gradeF },
    };
  });

  if (country) result = result.filter(r => r.country === country);

  result.sort((a, b) => b.conversations - a.conversations);
  res.json(result);
});

/**
 * GET /api/reports/agent-pdf
 * Genera PDF del reporte de un agente
 */
router.get('/agent-pdf', async (req, res) => {
  const PDFDocument = require('pdfkit');
  const { agentId, dateFrom, dateTo, instance, channel } = req.query;

  if (!agentId) return res.status(400).json({ error: 'agentId required' });

  const match = { agentId, status: 'scored' };
  if (instance) match.instance = instance;
  const convIds = await getConvIdsForFilters(dateFrom || '2020-01-01', dateTo, instance, channel);
  if (convIds !== null) match.conversationId = { $in: convIds };
  const from = new Date(dateFrom || '2020-01-01');
  const to = dateTo ? new Date(dateTo) : new Date();

  const evaluations = await Evaluation.find(match).sort({ finalScore: -1 });
  const agent = await Agent.findOne({ respondioId: agentId });
  const agentName = agent?.name || `Agente ${agentId}`;

  if (evaluations.length === 0) {
    return res.status(404).json({ error: 'No evaluations found' });
  }

  const totalEvals = evaluations.length;
  const avg = (field) => Math.round(evaluations.reduce((s, e) => s + (field(e) || 0), 0) / totalEvals);
  const avgFinal = avg(e => e.finalScore);
  const avgQuant = avg(e => e.quantitative?.totalScore);
  const avgQual = avg(e => e.qualitative?.totalScore);
  const avgTone = avg(e => e.qualitative?.toneScore);
  const avgEmpathy = avg(e => e.qualitative?.empathyScore);
  const avgResolution = avg(e => e.qualitative?.resolutionScore);
  const avgProf = avg(e => e.qualitative?.professionalismScore);

  const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  evaluations.forEach(e => { if (e.grade) grades[e.grade]++; });

  // Build PDF
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=reporte-${agentName.replace(/\s+/g, '-')}.pdf`);
  doc.pipe(res);

  const orange = '#F97316';
  const navy = '#0F172A';

  // Header
  doc.rect(0, 0, doc.page.width, 80).fill(navy);
  doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('JEL QA Platform', 50, 25);
  doc.fontSize(11).font('Helvetica').text('Reporte de calidad por operador', 50, 50);

  doc.moveDown(2);
  doc.fillColor(navy).fontSize(16).font('Helvetica-Bold').text(agentName, 50, 100);
  doc.fontSize(10).font('Helvetica').fillColor('#64748B')
    .text(`Período: ${from.toLocaleDateString('es-CL')} - ${to.toLocaleDateString('es-CL')} · ${totalEvals} evaluaciones`, 50, 120);

  // KPIs
  const kpiY = 155;
  const kpiW = 120;
  const drawKPI = (x, label, value, color) => {
    doc.rect(x, kpiY, kpiW, 55).lineWidth(1).strokeColor('#E2E8F0').stroke();
    doc.fillColor('#64748B').fontSize(8).font('Helvetica').text(label, x + 10, kpiY + 10, { width: kpiW - 20 });
    doc.fillColor(color || navy).fontSize(22).font('Helvetica-Bold').text(String(value), x + 10, kpiY + 25, { width: kpiW - 20 });
  };
  drawKPI(50, 'Score Final', avgFinal, avgFinal >= 75 ? '#059669' : avgFinal >= 50 ? '#D97706' : '#DC2626');
  drawKPI(180, 'Cuantitativo', avgQuant, '#2563EB');
  drawKPI(310, 'Cualitativo', avgQual, '#7C3AED');
  drawKPI(440, 'Evaluaciones', totalEvals);

  // Scores detail
  let y = kpiY + 75;
  doc.fillColor(navy).fontSize(12).font('Helvetica-Bold').text('Scores detallados', 50, y);
  y += 20;
  const scores = [
    { label: 'Tono', val: avgTone }, { label: 'Empatía', val: avgEmpathy },
    { label: 'Resolución', val: avgResolution }, { label: 'Profesionalismo', val: avgProf },
  ];
  scores.forEach(s => {
    doc.fillColor('#64748B').fontSize(9).font('Helvetica').text(s.label, 50, y, { width: 80 });
    // Bar background
    doc.rect(140, y + 2, 300, 8).fill('#F1F5F9');
    // Bar fill
    const color = s.val >= 75 ? '#059669' : s.val >= 50 ? '#D97706' : '#DC2626';
    doc.rect(140, y + 2, (s.val / 100) * 300, 8).fill(color);
    doc.fillColor(color).fontSize(9).font('Helvetica-Bold').text(String(s.val), 450, y, { width: 40 });
    y += 18;
  });

  // Grade distribution
  y += 10;
  doc.fillColor(navy).fontSize(12).font('Helvetica-Bold').text('Distribución de notas', 50, y);
  y += 20;
  const gradeColors = { A: '#059669', B: '#2563EB', C: '#D97706', D: '#EA580C', F: '#DC2626' };
  Object.entries(grades).forEach(([g, count]) => {
    if (count > 0) {
      doc.rect(50, y, 12, 12).fill(gradeColors[g]);
      doc.fillColor(navy).fontSize(9).font('Helvetica').text(`${g}: ${count} (${Math.round(count / totalEvals * 100)}%)`, 70, y + 1);
      y += 18;
    }
  });

  // Coaching
  const allImprovements = evaluations.flatMap(e => e.qualitative?.improvements || []);
  const impCounts = {};
  allImprovements.forEach(imp => { const k = imp.toLowerCase().trim(); impCounts[k] = (impCounts[k] || 0) + 1; });
  const topImp = Object.entries(impCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const allStrengths = evaluations.flatMap(e => e.qualitative?.strengths || []);
  const strCounts = {};
  allStrengths.forEach(s => { const k = s.toLowerCase().trim(); strCounts[k] = (strCounts[k] || 0) + 1; });
  const topStr = Object.entries(strCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  y += 15;
  if (topStr.length > 0) {
    doc.fillColor('#059669').fontSize(11).font('Helvetica-Bold').text('Fortalezas recurrentes', 50, y);
    y += 16;
    topStr.forEach(([text, count]) => {
      doc.fillColor('#334155').fontSize(9).font('Helvetica').text(`✓ ${text} (${count}x)`, 60, y, { width: 450 });
      y += doc.heightOfString(`✓ ${text} (${count}x)`, { width: 450 }) + 4;
    });
  }

  y += 10;
  if (topImp.length > 0) {
    doc.fillColor('#D97706').fontSize(11).font('Helvetica-Bold').text('Áreas de mejora', 50, y);
    y += 16;
    topImp.forEach(([text, count]) => {
      doc.fillColor('#334155').fontSize(9).font('Helvetica').text(`→ ${text} (${count}x)`, 60, y, { width: 450 });
      y += doc.heightOfString(`→ ${text} (${count}x)`, { width: 450 }) + 4;
    });
  }

  // Evaluation list on page 2
  doc.addPage();
  doc.fillColor(navy).fontSize(14).font('Helvetica-Bold').text('Detalle de evaluaciones', 50, 50);

  y = 75;
  doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold');
  doc.text('Conv ID', 50, y, { width: 70 });
  doc.text('Score', 130, y, { width: 40 });
  doc.text('Nota', 175, y, { width: 30 });
  doc.text('Sent.', 210, y, { width: 30 });
  doc.text('Categoría', 250, y, { width: 140 });
  doc.text('Coaching', 395, y, { width: 160 });
  y += 14;
  doc.moveTo(50, y).lineTo(555, y).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
  y += 4;

  evaluations.slice(0, 40).forEach(e => {
    if (y > 760) { doc.addPage(); y = 50; }
    doc.fillColor('#334155').fontSize(8).font('Helvetica');
    doc.text(String(e.conversationId).slice(-10), 50, y, { width: 70 });
    const scoreColor = e.finalScore >= 75 ? '#059669' : e.finalScore >= 50 ? '#D97706' : '#DC2626';
    doc.fillColor(scoreColor).font('Helvetica-Bold').text(String(e.finalScore), 130, y, { width: 40 });
    doc.fillColor(gradeColors[e.grade] || '#334155').text(e.grade, 175, y, { width: 30 });
    const sentEmoji = { muy_positivo: '+', positivo: '+', neutral: '=', negativo: '-', muy_negativo: '--' };
    doc.fillColor('#64748B').font('Helvetica').text(sentEmoji[e.sentiment?.label] || '=', 210, y, { width: 30 });
    doc.fillColor('#64748B').text((e.aiCategory || '—').slice(0, 35), 250, y, { width: 140 });
    doc.fillColor('#64748B').text((e.coachingTip || '—').slice(0, 50), 395, y, { width: 160 });
    y += 14;
  });

  // Footer
  doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
    .text(`Generado por JEL QA Platform · ${new Date().toLocaleString('es-CL')}`, 50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });

  doc.end();
});

module.exports = router;
