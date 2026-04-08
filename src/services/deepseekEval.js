const OpenAI = require('openai');

let client = null;

function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    });
  }
  return client;
}

/**
 * Build conversation transcript from messages
 */
function buildTranscript(messages) {
  return messages
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .filter(m => m.senderType !== 'echo') // skip echo messages
    .map(m => {
      const role = m.senderType === 'contact' ? 'CLIENTE' :
                   m.senderType === 'user' ? 'AGENTE' :
                   m.senderType === 'workflow' ? 'BOT' : 'SISTEMA';
      const text = m.content?.text || m.rawContent || '[contenido no disponible]';
      const time = new Date(m.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      return `[${time}] ${role}: ${text}`;
    })
    .join('\n');
}

/**
 * Evaluate conversation quality using DeepSeek
 */
async function evaluateQualitative(messages, conversation, categories = []) {
  const transcript = buildTranscript(messages);

  if (!transcript.trim() || transcript.length < 20) {
    return {
      toneScore: 0,
      empathyScore: 0,
      resolutionScore: 0,
      professionalismScore: 0,
      totalScore: 0,
      summary: 'Conversación vacía o sin contenido evaluable',
      strengths: [],
      improvements: [],
      rawResponse: '',
    };
  }

  const categoryList = categories.length > 0
    ? `\nCategorías disponibles para clasificar:\n${categories.map(c => `- ${c.code}: ${c.name}`).join('\n')}`
    : '';

  const prompt = `Eres un evaluador de calidad de atención al cliente para JuegaEnLínea (JEL), una plataforma de juegos en línea y apuestas deportivas que opera en Venezuela, Chile, Perú y México.

CONTEXTO DE LA EMPRESA:
- Los agentes atienden consultas sobre: depósitos, retiros, transferencias, verificación de cuenta, bonos, promociones, bloqueos, juego responsable
- Los clientes contactan principalmente por WhatsApp
- Se espera que los agentes sean cordiales, usen "usted" (no tutear), sean claros y resolutivos
- Los mensajes marcados como BOT son respuestas automáticas del sistema y NO deben evaluarse como si fueran del agente

Evalúa la siguiente conversación de soporte y responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks, sin texto adicional).

TRANSCRIPCIÓN:
${transcript}

DATOS DE LA CONVERSACIÓN:
- Categoría asignada por el agente: ${conversation.respondioCategory || 'No asignada'}
- Tiempo primera respuesta: ${conversation.firstResponseTime || 'N/A'}
- Tiempo resolución: ${conversation.resolutionTime || 'N/A'}
- Mensajes del agente: ${conversation.outgoingMessages}
- Mensajes del cliente: ${conversation.incomingMessages}
${categoryList}

CRITERIOS DE EVALUACIÓN (cada uno 0-100):
1. **toneScore**: Tono del agente — ¿Es amable y cálido sin ser robótico? ¿Saluda y se despide? ¿Usa un tono que genera confianza?
2. **empathyScore**: Empatía — ¿Reconoce la situación del cliente? ¿Valida su frustración antes de dar soluciones? ¿O es frío y transaccional?
3. **resolutionScore**: Resolución — ¿Resolvió el problema o dio pasos claros para resolverlo? ¿Dejó al cliente con una acción clara? Si cerró sin resolver, penalizar fuerte.
4. **professionalismScore**: Profesionalismo — ¿Buena ortografía y redacción? ¿Usa "usted"? ¿No comparte información sensible? ¿Mensajes claros y estructurados?

IMPORTANTE:
- Si la conversación es muy corta (1-2 intercambios simples), ajusta los scores proporcionalmente — no penalices por falta de empatía si la consulta se resolvió en 1 mensaje.
- Si el agente usó respuestas que parecen templates/copypaste, penaliza ligeramente en tono pero no en resolución si la respuesta fue correcta.
- Sé justo pero crítico. Un score de 100 es excepcional, 70-80 es buen servicio estándar.

RESPONDE SOLO CON ESTE JSON:
{
  "toneScore": <number>,
  "empathyScore": <number>,
  "resolutionScore": <number>,
  "professionalismScore": <number>,
  "summary": "<resumen en 1-2 oraciones de la conversación>",
  "strengths": ["<fortaleza1>", "<fortaleza2>"],
  "improvements": ["<mejora1>", "<mejora2>"],
  "suggestedCategories": ["<código categoría más apropiada>"],
  "categoryConfidence": <0-1>
}`;

  try {
    const response = await getClient().chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content || '';
    // Clean potential markdown fences
    const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(clean);

    const totalScore = Math.round(
      (parsed.toneScore + parsed.empathyScore + parsed.resolutionScore + parsed.professionalismScore) / 4
    );

    return {
      toneScore: parsed.toneScore,
      empathyScore: parsed.empathyScore,
      resolutionScore: parsed.resolutionScore,
      professionalismScore: parsed.professionalismScore,
      totalScore,
      summary: parsed.summary || '',
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      suggestedCategories: parsed.suggestedCategories || [],
      categoryConfidence: parsed.categoryConfidence || 0,
      rawResponse: raw,
    };
  } catch (err) {
    console.error('DeepSeek evaluation error:', err.message);
    return {
      toneScore: 0,
      empathyScore: 0,
      resolutionScore: 0,
      professionalismScore: 0,
      totalScore: 0,
      summary: `Error en evaluación: ${err.message}`,
      strengths: [],
      improvements: [],
      rawResponse: err.message,
    };
  }
}

/**
 * Calculate final combined score
 */
function calculateFinalScore(quantitativeTotal, qualitativeTotal) {
  // 60% cuantitativo, 40% cualitativo
  const final = Math.round(quantitativeTotal * 0.6 + qualitativeTotal * 0.4);

  let grade;
  if (final >= 90) grade = 'A';
  else if (final >= 75) grade = 'B';
  else if (final >= 60) grade = 'C';
  else if (final >= 40) grade = 'D';
  else grade = 'F';

  return { finalScore: final, grade };
}

module.exports = { evaluateQualitative, calculateFinalScore, buildTranscript };
