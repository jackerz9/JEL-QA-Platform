/**
 * Seed script - Pre-carga agentes y categorías iniciales
 * Ejecutar una vez: node src/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Agent, Category } = require('./models');

const AGENTS = [
  { respondioId: '324823', name: 'Agente 324823', instance: 'internacional' },
  { respondioId: '34301', name: 'Agente 34301', instance: 'internacional' },
  { respondioId: '439578', name: 'Agente 439578', instance: 'internacional' },
  { respondioId: '439579', name: 'Agente 439579', instance: 'internacional' },
  { respondioId: '439581', name: 'Agente 439581', instance: 'internacional' },
  { respondioId: '439583', name: 'Agente 439583', instance: 'internacional' },
  { respondioId: '468587', name: 'Agente 468587', instance: 'internacional' },
  { respondioId: '468589', name: 'Agente 468589', instance: 'internacional' },
  { respondioId: '814727', name: 'Agente 814727', instance: 'internacional' },
];

const CATEGORIES = [
  { code: '0. General - Bono CashBack: información y acreditación', name: 'Bono CashBack: información y acreditación', group: 'General' },
  { code: '0. General - Devoluciones: solicitud/ proceso/ espera de aprobacion', name: 'Devoluciones: solicitud/proceso/espera', group: 'General' },
  { code: '0. General - Promociones', name: 'Promociones', group: 'General' },
  { code: '0. General - Promociones RRSS', name: 'Promociones RRSS', group: 'General' },
  { code: '0. General - Quejas y sugerencias', name: 'Quejas y sugerencias', group: 'General' },
  { code: '0. General - Soporte Gral Juegos/ Poker/ Caballos/ Parlay', name: 'Soporte Gral Juegos/Poker/Caballos/Parlay', group: 'General' },
  { code: '00. Usuarios - Activación-Bloqueo de usuarios', name: 'Activación-Bloqueo de usuarios', group: 'Usuarios' },
  { code: '00. Usuarios - Dudas e Inconvenientes con Verificación de Perfil', name: 'Verificación de Perfil', group: 'Usuarios' },
  { code: '00. Usuarios - Modificación de datos/ Reseteo de contraseña', name: 'Modificación de datos/Reseteo contraseña', group: 'Usuarios' },
  { code: '00. Usuarios - Solicitud de desbloqueo de Juego Responsable', name: 'Desbloqueo de Juego Responsable', group: 'Usuarios' },
  { code: '8. CLP - Estatus de Retiro', name: 'Estatus de Retiro', group: 'CLP' },
  { code: '8. CLP - Estatus de Transferencias', name: 'Estatus de Transferencias', group: 'CLP' },
  { code: '8. CLP - Inconveniente con transferencia', name: 'Inconveniente con transferencia', group: 'CLP' },
  { code: '8. CLP - Información General', name: 'Información General', group: 'CLP' },
  { code: '8. CLP - Información como tramitar retiros y transferencias', name: 'Cómo tramitar retiros y transferencias', group: 'CLP' },
  { code: '8. MEX - Información General', name: 'Información General', group: 'MEX' },
  { code: '8. PEN - Estatus de Retiro', name: 'Estatus de Retiro', group: 'PEN' },
  { code: '8. PEN - Información General', name: 'Información General', group: 'PEN' },
  { code: '8. PEN - Información como tramitar retiros y transferencias', name: 'Cómo tramitar retiros y transferencias', group: 'PEN' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Agents
  for (const agent of AGENTS) {
    await Agent.findOneAndUpdate(
      { respondioId: agent.respondioId },
      { $set: agent },
      { upsert: true }
    );
  }
  console.log(`Seeded ${AGENTS.length} agents`);

  // Categories
  for (const cat of CATEGORIES) {
    await Category.findOneAndUpdate(
      { code: cat.code },
      { $set: { ...cat, active: true } },
      { upsert: true }
    );
  }
  console.log(`Seeded ${CATEGORIES.length} categories`);

  console.log('\n✅ Seed complete!');
  console.log('⚠️  Recuerda actualizar los nombres reales de los agentes en la UI');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
