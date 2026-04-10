const mongoose = require('mongoose');

// ─── Agentes ───
const agentSchema = new mongoose.Schema({
  respondioId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String },
  instance: { type: String, enum: ['venezuela', 'internacional'], required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

// ─── Categorías ───
const categorySchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  group: { type: String }, // "General", "Usuarios", "CLP", "PEN", "MEX"
  active: { type: Boolean, default: true },
}, { timestamps: true });

// ─── Contactos ───
const contactSchema = new mongoose.Schema({
  respondioId: { type: String, required: true, unique: true },
  name: { type: String },
  phone: { type: String },
  email: { type: String },
  country: { type: String },
  username: { type: String }, // usuario en JEL
  tags: [String],
  notes: { type: String },
}, { timestamps: true });

// ─── Conversaciones ───
const conversationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true },
  instance: { type: String, enum: ['venezuela', 'internacional'], required: true },
  contactId: { type: String, required: true, index: true },
  assigneeId: { type: String, index: true },
  startedAt: { type: Date, required: true },
  resolvedAt: { type: Date },
  firstResponseAt: { type: Date },

  // Métricas de Respond.io
  outgoingMessages: { type: Number, default: 0 },
  incomingMessages: { type: Number, default: 0 },
  firstResponseTime: { type: String }, // "HH:MM:SS" original
  firstResponseSeconds: { type: Number }, // convertido a segundos
  resolutionTime: { type: String },
  resolutionSeconds: { type: Number },
  averageResponseTime: { type: String },
  averageResponseSeconds: { type: Number },
  numberOfAssignments: { type: Number, default: 1 },
  numberOfResponses: { type: Number, default: 0 },

  // Categoría de Respond.io
  respondioCategory: { type: String },
  closingNoteSummary: { type: String },
  closedBy: { type: String },
  openedByChannel: { type: String },

  // Campos extra de respond.io
  firstAssignee: { type: String },
  lastAssignee: { type: String },
  closedBySource: { type: String },

  // Upload batch tracking
  uploadBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadBatch' },
}, { timestamps: true });

conversationSchema.index({ instance: 1, startedAt: -1 });
conversationSchema.index({ assigneeId: 1, startedAt: -1 });

// ─── Mensajes ───
const messageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  conversationId: { type: String, index: true }, // linked after matching
  contactId: { type: String, required: true, index: true },
  senderId: { type: String },
  senderType: { type: String, enum: ['contact', 'user', 'workflow', 'echo'] },
  contentType: { type: String }, // text, attachment, etc
  messageType: { type: String, enum: ['incoming', 'outgoing'] },
  content: { type: mongoose.Schema.Types.Mixed }, // parsed JSON content
  rawContent: { type: String }, // original string
  channelId: { type: String },
  timestamp: { type: Date, required: true },
  uploadBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadBatch' },
}, { timestamps: true });

messageSchema.index({ conversationId: 1, timestamp: 1 });

// ─── Evaluaciones ───
const evaluationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  instance: { type: String, enum: ['venezuela', 'internacional'] },
  agentId: { type: String },
  contactId: { type: String },
  evaluatedAt: { type: Date, default: Date.now },

  // ── Score cuantitativo (reglas fijas) ──
  quantitative: {
    firstResponseScore: { type: Number }, // 0-100 basado en tiempo
    resolutionTimeScore: { type: Number }, // 0-100
    responseRatioScore: { type: Number }, // balance mensajes agente/cliente
    messageCountScore: { type: Number }, // penalizar pocas o excesivas respuestas
    totalScore: { type: Number }, // promedio ponderado
    details: { type: mongoose.Schema.Types.Mixed }, // detalles del cálculo
  },

  // ── Score cualitativo (DeepSeek) ──
  qualitative: {
    toneScore: { type: Number },
    empathyScore: { type: Number },
    resolutionScore: { type: Number },
    professionalismScore: { type: Number },
    totalScore: { type: Number },
    summary: { type: String },
    strengths: [String],
    improvements: [String],
    rawResponse: { type: String },
  },

  // ── Sentimiento del cliente ──
  sentiment: {
    label: { type: String, enum: ['muy_positivo', 'positivo', 'neutral', 'negativo', 'muy_negativo'], default: 'neutral' },
    score: { type: Number, default: 0 }, // -100 a 100
    detail: { type: String },
  },

  // ── Categorización IA ──
  aiCategories: [String],
  aiCategory: { type: String }, // categoría principal asignada por IA
  aiCategoryConfidence: { type: Number },
  aiSubCategory: { type: String },

  // ── Alertas y coaching ──
  needsAttention: { type: Boolean, default: false },
  attentionReason: { type: String },
  coachingTip: { type: String },

  // ── Incidentes ──
  affectedByIncident: { type: Boolean, default: false },
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident' },
  incidentTitle: { type: String },
  relaxFactor: { type: Number, default: 1 },

  // ── Score final combinado ──
  finalScore: { type: Number }, // 60% cuantitativo + 40% cualitativo
  grade: { type: String, enum: ['A', 'B', 'C', 'D', 'F'] },

  status: { type: String, enum: ['pending', 'scored', 'reviewed', 'error'], default: 'pending' },
  errorMessage: { type: String },
}, { timestamps: true });

evaluationSchema.index({ agentId: 1, evaluatedAt: -1 });
evaluationSchema.index({ instance: 1, evaluatedAt: -1 });
evaluationSchema.index({ finalScore: 1 });

// ─── Upload Batches ───
const uploadBatchSchema = new mongoose.Schema({
  instance: { type: String, enum: ['venezuela', 'internacional'], required: true },
  date: { type: Date, required: true }, // fecha que se está evaluando
  conversationsFile: { type: String },
  messagesFile: { type: String },
  totalConversations: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  evaluatedCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  status: { type: String, enum: ['uploading', 'parsing', 'evaluating', 'completed', 'error'], default: 'uploading' },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
}, { timestamps: true });

// ─── Canales ───
const channelSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = {
  Agent: mongoose.model('Agent', agentSchema),
  Category: mongoose.model('Category', categorySchema),
  Contact: mongoose.model('Contact', contactSchema),
  Conversation: mongoose.model('Conversation', conversationSchema),
  Message: mongoose.model('Message', messageSchema),
  Evaluation: mongoose.model('Evaluation', evaluationSchema),
  UploadBatch: mongoose.model('UploadBatch', uploadBatchSchema),
  Channel: mongoose.model('Channel', channelSchema),
};
