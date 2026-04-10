/**
 * Seed script - Pre-carga agentes, canales y categorías oficiales JEL
 * Ejecutar: node src/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Agent, Category, Channel } = require('./models');

// ═══════════════════════════════════════
//  AGENTS
// ═══════════════════════════════════════
const AGENTS = [
  { respondioId: '34301', name: 'Jhorvis Perez', email: 'jhorvisperez@gmail.com', instance: 'venezuela' },
  { respondioId: '34305', name: 'Luis Raga', email: 'luis.juegaenlinea@gmail.com', instance: 'venezuela' },
  { respondioId: '34306', name: 'Marvin J', email: 'marvin@juegaenlinea.com', instance: 'venezuela' },
  { respondioId: '41551', name: 'Rafael Sanchez', email: 'rafasans.juegaenlinea@gmail.com', instance: 'venezuela' },
  { respondioId: '55440', name: 'Neiker Piñero', email: 'neiker.pinero@juegaenlinea.com', instance: 'venezuela' },
  { respondioId: '65899', name: 'Jesus Alvarez', email: 'jesus.juegaenlinea@gmail.com', instance: 'venezuela' },
  { respondioId: '81055', name: 'Gabriela Dorante', email: 'gabriela.juegaenlinea@gmail.com', instance: 'venezuela' },
  { respondioId: '91348', name: 'Anthony Teran', email: 'anthony.juegaenlinea@gmail.com', instance: 'venezuela' },
  { respondioId: '91349', name: 'Operador JEL', email: 'vlexin.juegaenlinea@gmail.com', instance: 'venezuela' },
  { respondioId: '114354', name: 'Jenifer Sánchez', email: 'jenifer.juegaenlinea@gmail.com', instance: 'venezuela' },
  { respondioId: '305683', name: 'Helver Duran', email: 'helver.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '324354', name: 'Xavier Rodríguez', email: 'xavier.rodriguez.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '324377', name: 'Darvin Melendez', email: 'darvinmelenedez@gmail.com', instance: 'internacional' },
  { respondioId: '324384', name: 'Ivan Juegaenlinea', email: 'ielias.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '324467', name: 'Jesus M', email: 'jesusmoreno.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '324495', name: 'Elena', email: 'mariaperz.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '324823', name: 'Stephanie', email: 'stephanie.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '324838', name: 'Samuel Guarecuco', email: 'samueljatar.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '324869', name: 'Johander Goyo', email: 'johandergoyo.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '325409', name: 'Gabriel Amariscua', email: 'gabriel.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '420861', name: 'Elias Gomez', email: 'elias.gomez@juegaenlinea.com', instance: 'internacional' },
  { respondioId: '439578', name: 'Ignacio Rosendo', email: 'ignacio.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '439579', name: 'Sebastian Raga', email: 'sebastian.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '439580', name: 'Egly Torres', email: 'egly.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '439581', name: 'Wilmer Alejandro', email: 'wilme.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '439583', name: 'Mariam Martinez', email: 'mariam.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '468587', name: 'Natalia', email: 'natalia.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '468589', name: 'Darvelis Ocanto', email: 'darvelis.juegaenlinea@gmail.com', instance: 'internacional' },
  { respondioId: '800206', name: 'Jenny Martinez', email: 'martinezjenny.jel@gmail.com', instance: 'internacional' },
  { respondioId: '814727', name: 'Wendary Garcia', email: 'wendarygarciajel@gmail.com', instance: 'internacional' },
];

// ═══════════════════════════════════════
//  CHANNELS
// ═══════════════════════════════════════
const CHANNELS = [
  // Venezuela
  { channelId: '168028', name: 'Google Business', country: 'VE', type: 'google', instance: 'venezuela' },
  { channelId: '171364', name: 'Soporte JuegaEnLínea VE', country: 'VE', type: 'website_chat', instance: 'venezuela' },
  { channelId: '328853', name: 'Facebook Messenger (VE)', country: 'VE', type: 'facebook', instance: 'venezuela' },
  { channelId: '328854', name: 'Instagram (VE)', country: 'VE', type: 'instagram', instance: 'venezuela' },
  { channelId: '346122', name: 'Telegram VE', country: 'VE', type: 'telegram', instance: 'venezuela' },
  // Chile
  { channelId: '41619', name: 'JEL CLP', country: 'CL', type: 'website_chat', instance: 'internacional' },
  { channelId: '129635', name: 'Instagram Chile', country: 'CL', type: 'instagram', instance: 'internacional' },
  { channelId: '129636', name: 'Facebook Chile', country: 'CL', type: 'facebook', instance: 'internacional' },
  // Ecuador
  { channelId: '174498', name: 'JEL EC', country: 'EC', type: 'website_chat', instance: 'internacional' },
  { channelId: '326788', name: 'Facebook Ecuador', country: 'EC', type: 'facebook', instance: 'internacional' },
  { channelId: '326791', name: 'Instagram Ecuador', country: 'EC', type: 'instagram', instance: 'internacional' },
  // México
  { channelId: '324856', name: 'JEL MEX', country: 'MX', type: 'website_chat', instance: 'internacional' },
  { channelId: '434925', name: 'Instagram México', country: 'MX', type: 'instagram', instance: 'internacional' },
  { channelId: '434926', name: 'Facebook México', country: 'MX', type: 'facebook', instance: 'internacional' },
  // Perú
  { channelId: '326777', name: 'JEL PEN', country: 'PE', type: 'website_chat', instance: 'internacional' },
  { channelId: '347216', name: 'Facebook Peru (Nuevo)', country: 'PE', type: 'facebook', instance: 'internacional' },
  { channelId: '347217', name: 'Instagram Peru (Nuevo)', country: 'PE', type: 'instagram', instance: 'internacional' },
  // Internacional / Multi
  { channelId: '346123', name: 'Telegram Internacional', country: 'INT', type: 'telegram', instance: 'internacional' },
  { channelId: '346480', name: 'JEL USD', country: 'INT', type: 'website_chat', instance: 'internacional' },
  { channelId: '412154', name: 'Custom Channel', country: 'INT', type: 'custom', instance: 'internacional' },
];

// ═══════════════════════════════════════
//  CATEGORIES (catálogo oficial JEL)
// ═══════════════════════════════════════
const CATEGORIES = [
  // General
  { group: 'General', name: 'General - Soporte Gral Juegos/ Poker/ Caballos/ Parlay' },
  { group: 'General', name: 'General - Quejas y sugerencias' },
  { group: 'General', name: 'General - Máximos/Mínimos' },
  { group: 'General', name: 'General - Devoluciones: solicitud/ proceso/ espera de aprobacion' },
  { group: 'General', name: 'General - Información sobre tienda' },
  { group: 'General', name: 'General - Depositos desde cuentas de terceros' },
  // Usuarios
  { group: 'Usuarios', name: 'Usuarios - Como realizar un registro de usuario' },
  { group: 'Usuarios', name: 'Usuarios - Activación-Bloqueo de usuarios' },
  { group: 'Usuarios', name: 'Usuarios - Solicitud de desbloqueo de Juego Responsable' },
  { group: 'Usuarios', name: 'Usuarios - Activación-Bloqueo de usuarios / Multicuenta' },
  { group: 'Usuarios', name: 'Usuarios - Modificación de datos/ Reseteo de contraseña' },
  { group: 'Usuarios', name: 'Usuarios - Nivel de usuario / Club VIP JEL' },
  { group: 'Usuarios', name: 'Usuarios - Inconveniente con cuenta' },
  { group: 'Usuarios', name: 'Codigos de Registro - Dudas' },
  { group: 'Usuarios', name: 'Codigos de Registro - Inconvenientes' },
  { group: 'Usuarios', name: 'Codigos de Registro - Bono no otorgado' },
  // Promociones
  { group: 'Promociones', name: 'Promociones - Dudas sobre torneos / promoción' },
  { group: 'Promociones', name: 'Promociones - Inconveniente con promoción' },
  { group: 'Promociones', name: 'Promociones - Inconveniente con torneo' },
  { group: 'Promociones', name: 'Promociones - Premio no acreditado' },
  { group: 'Promociones', name: 'Promociones - Bono CashBack: información y acreditación' },
  { group: 'Promociones', name: 'Promociones - Inconveniente con Promociones Post-Venta / OPTM' },
  { group: 'Promociones', name: 'Promociones - Promo RRSS' },
  // Hipismo
  { group: 'Hipismo', name: 'Hipismo - Cómo Jugar Hipismo / Calculo de pago' },
  { group: 'Hipismo', name: 'Hipismo - Retrospectos: asesoría e inconvenientes' },
  { group: 'Hipismo', name: 'Hipismo - Retraso en acreditación de premio' },
  { group: 'Hipismo', name: 'Hipismo - Reclamo premio de consolación' },
  { group: 'Hipismo', name: 'Hipismo - Reclamo de ticket ganados dado por perdido' },
  { group: 'Hipismo', name: 'Hipismo - Mantenimiento Hipismo / Inconveniente' },
  { group: 'Hipismo', name: 'Hipismo - Ticket no generado / Duplicado' },
  { group: 'Hipismo', name: 'Hipismo - Caballo Retirado o Carrera Suspendida' },
  // E-Sports
  { group: 'E-Sports', name: 'E-Sports - Mantenimiento plataforma de E-Sports' },
  { group: 'E-Sports', name: 'E-Sports - Como jugar E-Sports' },
  { group: 'E-Sports', name: 'E-Sports - Reclamo de apuestas ganadas dado por perdida' },
  { group: 'E-Sports', name: 'E-Sports - Error de tickets(Duplicado) o no Generados' },
  // Deportes
  { group: 'Deportes', name: 'Deportes - Reclamo de apuestas ganadas dado por perdida' },
  { group: 'Deportes', name: 'Deportes - Retraso en pago de ticket /Actualizar Logros' },
  { group: 'Deportes', name: 'Deportes - Error de tickets(Duplicado) o no Generados' },
  { group: 'Deportes', name: 'Deportes - Juego suspendido' },
  { group: 'Deportes', name: 'Deportes - Eliminación de ticket' },
  { group: 'Deportes', name: 'Deportes - Reglamento' },
  { group: 'Deportes', name: 'Deportes - Solicitud de logros' },
  { group: 'Deportes', name: 'Deportes - Calculo de ganancia' },
  { group: 'Deportes', name: 'Deportes - Mantenimiento plataforma' },
  { group: 'Deportes', name: 'Deportes - Inconveniente' },
  { group: 'Deportes', name: 'Deportes - Quejas del sistema Deportes' },
  // Casino
  { group: 'Casino', name: 'Casino - Mantenimiento Slots' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Lucky Spins' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Mascot' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Belatra' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Rubyplay' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas VibraGaming' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Pragmatic' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Virtuales' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Dragongaming' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Igrosoft' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Playtech' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Evolution' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Mabadoo' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Evoplay' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Endorphina' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Onetouch' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Ezugi' },
  { group: 'Casino', name: 'Casino - Inconvenientes con máquinas Irondog' },
  // Casino en Vivo
  { group: 'Live', name: 'Live - Mantenimiento Casino en Vivo Pragmatic' },
  { group: 'Live', name: 'Live - Inconvenientes en casino en vivo Pragmatic' },
  { group: 'Live', name: 'Live - Error apuesta(Duplicado) o no Generados Pragmatic' },
  { group: 'Live', name: 'Live - Mantenimiento Casino en Vivo Playtech' },
  { group: 'Live', name: 'Live - Inconvenientes en casino en vivo Playtech' },
  { group: 'Live', name: 'Live - Error apuesta(Duplicado) o no Generados Playtech' },
  { group: 'Live', name: 'Live - Mantenimiento Casino en Vivo Evolution' },
  { group: 'Live', name: 'Live - Inconvenientes en casino en vivo Evolution' },
  { group: 'Live', name: 'Live - Error apuesta(Duplicado) o no Generados Evolution' },
  { group: 'Live', name: 'Live - Mantenimiento Casino en Vivo Ezugi' },
  { group: 'Live', name: 'Live - Inconvenientes en casino en vivo Ezugi' },
  { group: 'Live', name: 'Live - Error apuesta(Duplicado) o no Generados Ezugi' },
  { group: 'Live', name: 'Live - Mantenimiento Casino en Vivo Sprintgaming' },
  { group: 'Live', name: 'Live - Inconvenientes en casino en vivo Sprintgaming' },
  { group: 'Live', name: 'Live - Error apuesta(Duplicado) o no Generados Sprintgaming' },
  { group: 'Live', name: 'Live - Mantenimiento Casino en Vivo TV BET' },
  { group: 'Live', name: 'Live - Inconvenientes en casino en vivo TV BET' },
  { group: 'Live', name: 'Live - Error apuesta(Duplicado) o no Generados TV BET' },
  { group: 'Live', name: 'Live - Mantenimiento Casino en Vivo Bombay' },
  { group: 'Live', name: 'Live - Inconvenientes en casino en vivo Bombay' },
  { group: 'Live', name: 'Live - Error apuesta(Duplicado) o no Generados Bombay' },
  { group: 'Live', name: 'Live - Mantenimiento Casino en Live Solutions' },
  { group: 'Live', name: 'Live - Inconvenientes en casino en vivo Live Solutions' },
  { group: 'Live', name: 'Live - Error apuesta(Duplicado) o no Generados Live Solutions' },
  { group: 'Live', name: 'Live - Mantenimiento Casino en Atmosfera' },
  { group: 'Live', name: 'Live - Inconvenientes en casino en vivo Atmosfera' },
  { group: 'Live', name: 'Live - Error apuesta(Duplicado) o no Generados Atmosfera' },
  // Virtuales
  { group: 'Virtuales', name: 'Virtuales - Mantenimiento plataforma de Virtuales' },
  { group: 'Virtuales', name: 'Virtuales - Como jugar Virtuales' },
  { group: 'Virtuales', name: 'Virtuales - Reclamo de apuestas ganadas dado por perdida' },
  { group: 'Virtuales', name: 'Virtuales - Error de tickets(Duplicado) o no Generados' },
  // Animalitos
  { group: 'Animalitos', name: 'Animalitos - Mantenimiento plataforma de Animalitos' },
  { group: 'Animalitos', name: 'Animalitos - Como jugar Animalitos' },
  { group: 'Animalitos', name: 'Animalitos - Reclamo de apuestas ganadas dado por perdida' },
  { group: 'Animalitos', name: 'Animalitos - Error de tickets(Duplicado) o no Generados' },
  // Productos JEL
  { group: 'Productos JEL', name: 'Ruleta - Dudas' },
  { group: 'Productos JEL', name: 'Ruleta - Inconvenientes / No activado' },
  { group: 'Productos JEL', name: 'Ruleta - Premio no acreditado' },
  { group: 'Productos JEL', name: 'Memoria - Dudas' },
  { group: 'Productos JEL', name: 'Memoria - Inconvenientes / No activado' },
  { group: 'Productos JEL', name: 'Memoria - Premio no acreditado' },
  { group: 'Productos JEL', name: 'Quiniela - Dudas' },
  { group: 'Productos JEL', name: 'Quiniela - Inconvenientes / No activado' },
  { group: 'Productos JEL', name: 'Quiniela - Premio no acreditado' },
  { group: 'Productos JEL', name: 'Recompensa Diaria - Dudas' },
  { group: 'Productos JEL', name: 'Recompensa Diaria - Inconveniente / No activado' },
  { group: 'Productos JEL', name: 'Recompensa Diaria - Premio no acreditado' },
  // Pago Móvil (Venezuela)
  { group: 'Pago Móvil', name: 'PM - Problemas en la plataforma' },
  { group: 'Pago Móvil', name: 'PM - Retraso en acreditación' },
  { group: 'Pago Móvil', name: 'PM - Información sobre sistema' },
  { group: 'Pago Móvil', name: 'PM - Cambiar número registrado' },
  { group: 'Pago Móvil', name: 'PM - No recibe el código de registro' },
  { group: 'Pago Móvil', name: 'PM - Información sobre retiro' },
  // TDC / Zelle (Venezuela)
  { group: 'TDC/Zelle', name: 'TDC - Información General' },
  { group: 'TDC/Zelle', name: 'TDC - Información como tramitar retiros y transferencias' },
  { group: 'TDC/Zelle', name: 'TDC - Estatus de Transferencias' },
  { group: 'TDC/Zelle', name: 'TDC - Inconveniente con transferencia' },
  { group: 'TDC/Zelle', name: 'Zelle - Estatus de Retiro' },
  { group: 'TDC/Zelle', name: 'Zelle - Inconveniente con Retiro' },
  // Pagos Internacional (unificado - antes CLP/PEN/ECU/MEX)
  { group: 'Pagos', name: 'Pagos - Información General' },
  { group: 'Pagos', name: 'Pagos - Información como tramitar retiros y transferencias' },
  { group: 'Pagos', name: 'Pagos - Estatus de Transferencias' },
  { group: 'Pagos', name: 'Pagos - Estatus de Retiro' },
  { group: 'Pagos', name: 'Pagos - Inconveniente con transferencia' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Agents
  for (const agent of AGENTS) {
    await Agent.findOneAndUpdate(
      { respondioId: agent.respondioId },
      { $set: { ...agent, active: true } },
      { upsert: true }
    );
  }
  console.log(`✅ ${AGENTS.length} agents`);

  // Channels
  for (const ch of CHANNELS) {
    await Channel.findOneAndUpdate(
      { channelId: ch.channelId },
      { $set: { ...ch, active: true } },
      { upsert: true }
    );
  }
  console.log(`✅ ${CHANNELS.length} channels`);

  // Categories — use name as code for simplicity
  for (const cat of CATEGORIES) {
    await Category.findOneAndUpdate(
      { code: cat.name },
      { $set: { code: cat.name, name: cat.name, group: cat.group, active: true } },
      { upsert: true }
    );
  }
  // Delete old country-specific payment categories
  const deleted = await Category.deleteMany({
    $or: [
      { code: /^CLP - / }, { code: /^PEN - / }, { code: /^ECU - / }, { code: /^MEX - / },
      { name: /^CLP - / }, { name: /^PEN - / }, { name: /^ECU - / }, { name: /^MEX - / },
      { group: { $in: ['CLP', 'PEN', 'ECU', 'MEX'] } },
      { code: /^\d+\./ }, // old format "0. General - ..."
    ],
  });
  if (deleted.deletedCount > 0) console.log(`🗑️  Deleted ${deleted.deletedCount} old/duplicate categories`);
  const remaining = await Category.countDocuments({ active: true });
  console.log(`✅ ${remaining} active categories (${CATEGORIES.length} in seed)`);

  console.log('\n🎉 Seed complete!');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
