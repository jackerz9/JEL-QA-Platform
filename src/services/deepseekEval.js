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

function buildTranscript(messages) {
  return messages
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .filter(m => m.senderType !== 'echo')
    .map(m => {
      const role = m.senderType === 'contact' ? 'CLIENTE' :
                   m.senderType === 'user' ? 'AGENTE' :
                   m.senderType === 'workflow' ? 'BOT' : 'SISTEMA';
      const text = m.content?.text || m.rawContent || '[contenido no disponible]';
      // Timestamps from Respond.io CSV are already in local time (UTC-4)
      // Extract HH:MM directly without timezone conversion
      const d = new Date(m.timestamp);
      const time = `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
      return `[${time}] ${role}: ${text}`;
    })
    .join('\n');
}

async function evaluateQualitative(messages, conversation, categories = [], aiConfig = null) {
  const transcript = buildTranscript(messages);

  if (!transcript.trim() || transcript.length < 20) {
    return {
      toneScore: 0, empathyScore: 0, resolutionScore: 0, professionalismScore: 0, totalScore: 0,
      summary: 'Conversación vacía o sin contenido evaluable',
      strengths: [], improvements: [],
      sentiment: { label: 'neutral', score: 0, detail: '' },
      aiCategory: null, aiCategoryConfidence: 0, aiSubCategory: '',
      needsAttention: false, attentionReason: '', coachingTip: '',
      rawResponse: '',
    };
  }

  // AI config from Settings or defaults
  const ai = aiConfig || {};
  const companyContext = ai.companyContext || 'JuegaEnLínea (JEL) es una plataforma de juegos en línea y apuestas deportivas que opera en Venezuela, Chile, Perú y México. Los agentes atienden consultas sobre depósitos, retiros, transferencias, verificación de cuenta, bonos, promociones, bloqueos y juego responsable.';
  const treatmentRules = ai.treatmentRules || 'El agente DEBE usar "usted" (no tutear). Debe saludar al inicio y despedirse al cerrar. Debe ser cordial, claro y resolutivo.';
  const penalize = ai.penalize || 'Respuestas copypaste sin personalizar. Cerrar sin confirmar resolución. Compartir información sensible. Jerga inapropiada.';
  const reward = ai.reward || 'Empatía proactiva. Ofrecer ayuda adicional antes de cerrar. Personalizar respuesta. Seguimiento claro.';
  const attentionCriteria = ai.attentionCriteria || 'Cliente muy molesto. Agente cometió error grave. Información sensible expuesta. Problema sin resolver.';
  const model = ai.model || 'deepseek-chat';
  const maxTokens = ai.maxTokens || 1000;
  const temperature = ai.temperature || 0.3;

  // Build compact category list grouped - compress payment categories
  let categoryList;
  if (categories.length > 0) {
    const grouped = {};
    categories.forEach(c => {
      const g = c.group || 'Otro';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(c.name || c.code);
    });

    // Compress payment groups (CLP, PEN, MEX, ECU share same sub-types)
    const paymentGroups = ['CLP', 'PEN', 'MEX', 'ECU'];
    const hasPayment = paymentGroups.filter(g => grouped[g]);
    if (hasPayment.length > 1) {
      // Take one as template, list countries
      const template = grouped[hasPayment[0]];
      const subTypes = template.map(n => n.replace(new RegExp(`^${hasPayment[0]} - `), ''));
      const compressed = `[Pagos por país (${hasPayment.join(', ')})]: Para cada país: ${subTypes.join(' | ')}`;
      hasPayment.forEach(g => delete grouped[g]);
      categoryList = Object.entries(grouped)
        .map(([group, names]) => `[${group}]: ${names.join(' | ')}`)
        .join('\n') + '\n' + compressed;
    } else {
      categoryList = Object.entries(grouped)
        .map(([group, names]) => `[${group}]: ${names.join(' | ')}`)
        .join('\n');
    }
  } else {
    categoryList = 'Sin categorías disponibles.';
  }

  const prompt = `Eres un evaluador de calidad de atención al cliente.

CONTEXTO DE LA EMPRESA:
${companyContext}

REGLAS DE TRATO:
${treatmentRules}

Los mensajes marcados como BOT son respuestas automáticas del sistema y NO deben evaluarse como si fueran del agente.

Evalúa la siguiente conversación y responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks, sin texto adicional).

TRANSCRIPCIÓN:
${transcript}

DATOS DE LA CONVERSACIÓN:
- Categoría asignada por el agente: ${conversation.respondioCategory || 'No asignada'}
- Tiempo primera respuesta: ${conversation.firstResponseTime || 'N/A'}
- Tiempo resolución: ${conversation.resolutionTime || 'N/A'}
- Mensajes del agente: ${conversation.outgoingMessages}
- Mensajes del cliente: ${conversation.incomingMessages}

CATÁLOGO DE CATEGORÍAS (OBLIGATORIO usar una de estas, NO inventar nuevas):
${categoryList}

EVALÚA ESTOS ASPECTOS:

1. CALIDAD DEL AGENTE (cada uno 0-100):
- toneScore: Tono — ¿Amable, cálido, genera confianza? ¿Saluda y se despide?
- empathyScore: Empatía — ¿Reconoce la situación? ¿Valida frustración antes de dar soluciones?
- resolutionScore: Resolución — ¿Resolvió o dio pasos claros? Si cerró sin resolver, penalizar fuerte.
- professionalismScore: Profesionalismo — ¿Ortografía, claridad, usa "usted", no comparte info sensible?

2. SENTIMIENTO DEL CLIENTE:
Analiza cómo se siente el cliente durante y al final de la conversación.
- sentiment_label: "muy_positivo", "positivo", "neutral", "negativo", "muy_negativo"
- sentiment_score: -100 a 100 (donde -100 es furioso, 0 neutral, 100 encantado)
- sentiment_detail: Breve descripción del estado emocional del cliente

3. CATEGORIZACIÓN (IMPORTANTE):
- aiCategory: DEBES elegir la categoría EXACTA del catálogo de arriba que mejor aplique. Copia el nombre exacto tal como aparece. NO inventes categorías nuevas.
- aiCategoryConfidence: 0.0 a 1.0
- aiSubCategory: Solo si necesitas especificar algo más dentro de la categoría (texto libre, 3-5 palabras)

4. ALERTAS Y COACHING:
- needsAttention: true/false — Criterios: ${attentionCriteria}
- attentionReason: Si needsAttention=true, explica por qué en 1 oración
- coachingTip: Sugerencia específica y accionable para el agente (1-2 oraciones)

PENALIZAR:
${penalize}

PREMIAR:
${reward}

REGLAS:
- Conversaciones cortas (1-2 intercambios): no penalices empatía si se resolvió rápido
- Score 100 = excepcional, 70-80 = buen estándar, <50 = problema serio
- needsAttention=true solo para casos que realmente necesiten escalamiento

RESPONDE SOLO CON ESTE JSON:
{
  "toneScore": 0,
  "empathyScore": 0,
  "resolutionScore": 0,
  "professionalismScore": 0,
  "summary": "",
  "strengths": [],
  "improvements": [],
  "sentiment_label": "",
  "sentiment_score": 0,
  "sentiment_detail": "",
  "aiCategory": "",
  "aiCategoryConfidence": 0,
  "aiSubCategory": "",
  "needsAttention": false,
  "attentionReason": "",
  "coachingTip": ""
}`;

  try {
    const response = await getClient().chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temperature,
    });

    const raw = response.choices[0]?.message?.content || '';
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
      sentiment: {
        label: parsed.sentiment_label || 'neutral',
        score: parsed.sentiment_score || 0,
        detail: parsed.sentiment_detail || '',
      },
      aiCategory: parsed.aiCategory || null,
      aiCategoryConfidence: parsed.aiCategoryConfidence || 0,
      aiSubCategory: parsed.aiSubCategory || '',
      needsAttention: parsed.needsAttention || false,
      attentionReason: parsed.attentionReason || '',
      coachingTip: parsed.coachingTip || '',
      rawResponse: raw,
    };
  } catch (err) {
    console.error('DeepSeek evaluation error:', err.message);
    return {
      toneScore: 0, empathyScore: 0, resolutionScore: 0, professionalismScore: 0, totalScore: 0,
      summary: `Error en evaluación: ${err.message}`,
      strengths: [], improvements: [],
      sentiment: { label: 'neutral', score: 0, detail: '' },
      aiCategory: null, aiCategoryConfidence: 0, aiSubCategory: '',
      needsAttention: false, attentionReason: '', coachingTip: '',
      rawResponse: err.message,
    };
  }
}

function calculateFinalScore(quantitativeTotal, qualitativeTotal) {
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
