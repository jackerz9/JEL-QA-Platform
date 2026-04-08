const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },

  // ── Filtros de evaluación ──
  filters: {
    minTotalMessages: { type: Number, default: 3 },
    minAgentMessages: { type: Number, default: 1 },
    excludeBotOnly: { type: Boolean, default: true },
    excludeUnresolved: { type: Boolean, default: false },
    excludeSenderTypes: { type: [String], default: ['echo'] },
  },

  // ── Ponderaciones ──
  weights: {
    quantitativeWeight: { type: Number, default: 60 },
    qualitativeWeight: { type: Number, default: 40 },
    // Sub-pesos cuantitativos (deben sumar 100)
    firstResponseWeight: { type: Number, default: 30 },
    resolutionTimeWeight: { type: Number, default: 25 },
    responseRatioWeight: { type: Number, default: 20 },
    avgResponseTimeWeight: { type: Number, default: 15 },
    messageEfficiencyWeight: { type: Number, default: 10 },
    // Umbrales primera respuesta (segundos)
    firstResponse: {
      excellent: { type: Number, default: 30 },
      good: { type: Number, default: 60 },
      acceptable: { type: Number, default: 120 },
      slow: { type: Number, default: 300 },
      verySlow: { type: Number, default: 600 },
    },
    // Umbrales resolución (segundos)
    resolution: {
      excellent: { type: Number, default: 300 },
      good: { type: Number, default: 600 },
      acceptable: { type: Number, default: 1200 },
      slow: { type: Number, default: 1800 },
      verySlow: { type: Number, default: 3600 },
    },
    // Umbrales de notas
    grades: {
      A: { type: Number, default: 90 },
      B: { type: Number, default: 75 },
      C: { type: Number, default: 60 },
      D: { type: Number, default: 40 },
    },
  },

  // ── Configuración de IA ──
  ai: {
    model: { type: String, default: 'deepseek-chat' },
    maxTokens: { type: Number, default: 1000 },
    temperature: { type: Number, default: 0.3 },
    companyContext: { type: String, default: 'JuegaEnLínea (JEL) es una plataforma de juegos en línea y apuestas deportivas que opera en Venezuela, Chile, Perú y México. Los agentes atienden consultas sobre depósitos, retiros, transferencias, verificación de cuenta, bonos, promociones, bloqueos y juego responsable.' },
    treatmentRules: { type: String, default: 'El agente DEBE usar "usted" (no tutear). Debe saludar al inicio y despedirse al cerrar. Debe ser cordial, claro y resolutivo.' },
    penalize: { type: String, default: 'Respuestas copypaste sin personalizar. Cerrar sin confirmar resolución. Compartir información sensible. Jerga inapropiada. Repetir el mismo mensaje varias veces.' },
    reward: { type: String, default: 'Empatía proactiva (reconocer frustración antes de dar solución). Ofrecer ayuda adicional antes de cerrar. Personalizar respuesta al caso específico. Seguimiento claro de pasos.' },
    attentionCriteria: { type: String, default: 'Cliente muy molesto/furioso. Agente cometió error grave. Información sensible expuesta. Problema quedó sin resolver. Cliente amenaza con irse o hacer reclamo público.' },
  },
}, { timestamps: true });

// Always return a settings document (create default if not exists)
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findById('global');
  if (!settings) {
    settings = await this.create({ _id: 'global' });
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
