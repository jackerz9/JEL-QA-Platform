/**
 * Quantitative Scoring Engine (configurable via Settings)
 */

const DEFAULT_WEIGHTS = {
  firstResponse: 0.30,
  resolutionTime: 0.25,
  responseRatio: 0.20,
  avgResponseTime: 0.15,
  messageEfficiency: 0.10,
};

function scoreFirstResponse(seconds, thresholds = {}) {
  const t = { excellent: 30, good: 60, acceptable: 120, slow: 300, verySlow: 600, ...thresholds };
  if (seconds === null || seconds === undefined) return { score: 0, detail: 'Sin datos' };

  let score, detail;
  if (seconds <= t.excellent) { score = 100; detail = `${seconds}s - Excelente`; }
  else if (seconds <= t.good) { score = 90; detail = `${seconds}s - Muy bueno`; }
  else if (seconds <= t.acceptable) { score = 75; detail = `${Math.round(seconds / 60 * 10) / 10}min - Bueno`; }
  else if (seconds <= t.slow) { score = 50; detail = `${Math.round(seconds / 60 * 10) / 10}min - Regular`; }
  else if (seconds <= t.verySlow) { score = 25; detail = `${Math.round(seconds / 60 * 10) / 10}min - Lento`; }
  else { score = 10; detail = `${Math.round(seconds / 60)}min - Muy lento`; }
  return { score, detail };
}

function scoreResolutionTime(seconds, thresholds = {}) {
  const t = { excellent: 300, good: 600, acceptable: 1200, slow: 1800, verySlow: 3600, ...thresholds };
  if (seconds === null || seconds === undefined) return { score: 0, detail: 'Sin datos' };

  let score, detail;
  if (seconds <= t.excellent) { score = 100; detail = `${Math.round(seconds / 60 * 10) / 10}min - Excelente`; }
  else if (seconds <= t.good) { score = 85; detail = `${Math.round(seconds / 60 * 10) / 10}min - Muy bueno`; }
  else if (seconds <= t.acceptable) { score = 70; detail = `${Math.round(seconds / 60)}min - Bueno`; }
  else if (seconds <= t.slow) { score = 50; detail = `${Math.round(seconds / 60)}min - Regular`; }
  else if (seconds <= t.verySlow) { score = 30; detail = `${Math.round(seconds / 60)}min - Lento`; }
  else { score = 10; detail = `${Math.round(seconds / 3600 * 10) / 10}hr - Muy lento`; }
  return { score, detail };
}

function scoreResponseRatio(outgoing, incoming) {
  if (!incoming || incoming === 0) return { score: 50, detail: 'Sin mensajes entrantes' };
  const ratio = outgoing / incoming;
  let score;
  let detail = `Ratio ${ratio.toFixed(2)} (${outgoing} out / ${incoming} in)`;
  if (ratio >= 1.0 && ratio <= 3.0) { score = 100; detail += ' - Ideal'; }
  else if (ratio >= 0.5 && ratio < 1.0) { score = 70; detail += ' - Pocas respuestas'; }
  else if (ratio > 3.0 && ratio <= 5.0) { score = 70; detail += ' - Muchas respuestas'; }
  else if (ratio < 0.5) { score = 30; detail += ' - Muy pocas respuestas'; }
  else { score = 40; detail += ' - Demasiadas respuestas'; }
  return { score, detail };
}

function scoreAvgResponseTime(seconds) {
  if (seconds === null || seconds === undefined) return { score: 50, detail: 'Sin datos' };
  let score, detail;
  if (seconds <= 60) { score = 100; detail = `${seconds}s - Excelente`; }
  else if (seconds <= 120) { score = 85; detail = `${Math.round(seconds / 60 * 10) / 10}min - Muy bueno`; }
  else if (seconds <= 300) { score = 65; detail = `${Math.round(seconds / 60 * 10) / 10}min - Bueno`; }
  else if (seconds <= 600) { score = 40; detail = `${Math.round(seconds / 60)}min - Lento`; }
  else { score = 15; detail = `${Math.round(seconds / 60)}min - Muy lento`; }
  return { score, detail };
}

function scoreMessageEfficiency(outgoing, incoming) {
  const total = outgoing + incoming;
  let score, detail;
  if (outgoing === 0) { score = 0; detail = 'Sin respuestas del agente'; }
  else if (outgoing <= 2 && incoming <= 2) { score = 85; detail = `${total} msgs - Breve`; }
  else if (total <= 10) { score = 100; detail = `${total} msgs - Ideal`; }
  else if (total <= 20) { score = 70; detail = `${total} msgs - Algo extensa`; }
  else { score = 40; detail = `${total} msgs - Muy extensa`; }
  return { score, detail };
}

/**
 * Calculate full quantitative evaluation
 * @param {Object} conversation - conversation document
 * @param {Object} settingsWeights - weights from Settings (optional)
 */
function evaluateQuantitative(conversation, settingsWeights = null) {
  const w = settingsWeights ? {
    firstResponse: (settingsWeights.firstResponseWeight || 30) / 100,
    resolutionTime: (settingsWeights.resolutionTimeWeight || 25) / 100,
    responseRatio: (settingsWeights.responseRatioWeight || 20) / 100,
    avgResponseTime: (settingsWeights.avgResponseTimeWeight || 15) / 100,
    messageEfficiency: (settingsWeights.messageEfficiencyWeight || 10) / 100,
  } : DEFAULT_WEIGHTS;

  const frThresholds = settingsWeights?.firstResponse || {};
  const rtThresholds = settingsWeights?.resolution || {};

  const fr = scoreFirstResponse(conversation.firstResponseSeconds, frThresholds);
  const rt = scoreResolutionTime(conversation.resolutionSeconds, rtThresholds);
  const rr = scoreResponseRatio(conversation.outgoingMessages, conversation.incomingMessages);
  const avg = scoreAvgResponseTime(conversation.averageResponseSeconds);
  const eff = scoreMessageEfficiency(conversation.outgoingMessages, conversation.incomingMessages);

  const totalScore = Math.round(
    fr.score * w.firstResponse +
    rt.score * w.resolutionTime +
    rr.score * w.responseRatio +
    avg.score * w.avgResponseTime +
    eff.score * w.messageEfficiency
  );

  return {
    firstResponseScore: fr.score,
    resolutionTimeScore: rt.score,
    responseRatioScore: rr.score,
    avgResponseTimeScore: avg.score,
    messageCountScore: eff.score,
    totalScore,
    details: {
      firstResponse: fr, resolutionTime: rt, responseRatio: rr,
      avgResponseTime: avg, messageEfficiency: eff, weights: w,
    },
  };
}

module.exports = { evaluateQuantitative };
