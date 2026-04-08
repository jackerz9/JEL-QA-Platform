/**
 * Quantitative Scoring Engine
 * Reglas fijas para evaluar métricas cuantitativas de conversaciones
 *
 * Cada métrica genera un score de 0-100
 * Score final = promedio ponderado
 */

const WEIGHTS = {
  firstResponse: 0.30,   // 30% - tiempo primera respuesta
  resolutionTime: 0.25,  // 25% - tiempo total resolución
  responseRatio: 0.20,   // 20% - balance respuestas agente/cliente
  avgResponseTime: 0.15, // 15% - tiempo promedio entre respuestas
  messageEfficiency: 0.10, // 10% - eficiencia en cantidad de mensajes
};

/**
 * Score tiempo de primera respuesta
 * < 30s = 100, < 1min = 90, < 2min = 75, < 5min = 50, < 10min = 25, > 10min = 0
 */
function scoreFirstResponse(seconds) {
  if (seconds === null || seconds === undefined) return { score: 0, detail: 'Sin datos' };

  let score;
  let detail;
  if (seconds <= 30) { score = 100; detail = `${seconds}s - Excelente`; }
  else if (seconds <= 60) { score = 90; detail = `${seconds}s - Muy bueno`; }
  else if (seconds <= 120) { score = 75; detail = `${Math.round(seconds / 60 * 10) / 10}min - Bueno`; }
  else if (seconds <= 300) { score = 50; detail = `${Math.round(seconds / 60 * 10) / 10}min - Regular`; }
  else if (seconds <= 600) { score = 25; detail = `${Math.round(seconds / 60 * 10) / 10}min - Lento`; }
  else { score = 10; detail = `${Math.round(seconds / 60)}min - Muy lento`; }

  return { score, detail };
}

/**
 * Score tiempo de resolución
 * < 5min = 100, < 10min = 85, < 20min = 70, < 30min = 50, < 1hr = 30, > 1hr = 10
 */
function scoreResolutionTime(seconds) {
  if (seconds === null || seconds === undefined) return { score: 0, detail: 'Sin datos' };

  let score;
  let detail;
  if (seconds <= 300) { score = 100; detail = `${Math.round(seconds / 60 * 10) / 10}min - Excelente`; }
  else if (seconds <= 600) { score = 85; detail = `${Math.round(seconds / 60 * 10) / 10}min - Muy bueno`; }
  else if (seconds <= 1200) { score = 70; detail = `${Math.round(seconds / 60)}min - Bueno`; }
  else if (seconds <= 1800) { score = 50; detail = `${Math.round(seconds / 60)}min - Regular`; }
  else if (seconds <= 3600) { score = 30; detail = `${Math.round(seconds / 60)}min - Lento`; }
  else { score = 10; detail = `${Math.round(seconds / 3600 * 10) / 10}hr - Muy lento`; }

  return { score, detail };
}

/**
 * Score ratio de respuestas (outgoing / incoming)
 * Ideal: entre 1.0 y 3.0 respuestas por mensaje del cliente
 * Muy bajo (<0.5) = no responde suficiente
 * Muy alto (>5.0) = posible spam o respuestas fragmentadas
 */
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

/**
 * Score tiempo promedio de respuesta
 * < 1min = 100, < 2min = 85, < 5min = 65, < 10min = 40, > 10min = 15
 */
function scoreAvgResponseTime(seconds) {
  if (seconds === null || seconds === undefined) return { score: 50, detail: 'Sin datos' };

  let score;
  let detail;
  if (seconds <= 60) { score = 100; detail = `${seconds}s - Excelente`; }
  else if (seconds <= 120) { score = 85; detail = `${Math.round(seconds / 60 * 10) / 10}min - Muy bueno`; }
  else if (seconds <= 300) { score = 65; detail = `${Math.round(seconds / 60 * 10) / 10}min - Bueno`; }
  else if (seconds <= 600) { score = 40; detail = `${Math.round(seconds / 60)}min - Lento`; }
  else { score = 15; detail = `${Math.round(seconds / 60)}min - Muy lento`; }

  return { score, detail };
}

/**
 * Score eficiencia de mensajes
 * Penaliza conversaciones con muy pocos mensajes del agente (1) o excesivos (>15)
 */
function scoreMessageEfficiency(outgoing, incoming) {
  const total = outgoing + incoming;
  let score;
  let detail;

  if (outgoing === 0) {
    score = 0; detail = 'Sin respuestas del agente';
  } else if (outgoing <= 2 && incoming <= 2) {
    score = 85; detail = `${total} msgs - Conversación breve, eficiente`;
  } else if (total <= 10) {
    score = 100; detail = `${total} msgs - Extensión ideal`;
  } else if (total <= 20) {
    score = 70; detail = `${total} msgs - Algo extensa`;
  } else {
    score = 40; detail = `${total} msgs - Muy extensa`;
  }

  return { score, detail };
}

/**
 * Calculate full quantitative evaluation for a conversation
 */
function evaluateQuantitative(conversation) {
  const fr = scoreFirstResponse(conversation.firstResponseSeconds);
  const rt = scoreResolutionTime(conversation.resolutionSeconds);
  const rr = scoreResponseRatio(conversation.outgoingMessages, conversation.incomingMessages);
  const avg = scoreAvgResponseTime(conversation.averageResponseSeconds);
  const eff = scoreMessageEfficiency(conversation.outgoingMessages, conversation.incomingMessages);

  const totalScore = Math.round(
    fr.score * WEIGHTS.firstResponse +
    rt.score * WEIGHTS.resolutionTime +
    rr.score * WEIGHTS.responseRatio +
    avg.score * WEIGHTS.avgResponseTime +
    eff.score * WEIGHTS.messageEfficiency
  );

  return {
    firstResponseScore: fr.score,
    resolutionTimeScore: rt.score,
    responseRatioScore: rr.score,
    avgResponseTimeScore: avg.score,
    messageCountScore: eff.score,
    totalScore,
    details: {
      firstResponse: fr,
      resolutionTime: rt,
      responseRatio: rr,
      avgResponseTime: avg,
      messageEfficiency: eff,
      weights: WEIGHTS,
    },
  };
}

module.exports = { evaluateQuantitative, WEIGHTS };
