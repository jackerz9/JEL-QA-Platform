/**
 * Seed script - Pre-carga agentes reales y categorías
 * Ejecutar: node src/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Agent, Category } = require('./models');

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

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Agents - upsert all
  for (const agent of AGENTS) {
    await Agent.findOneAndUpdate(
      { respondioId: agent.respondioId },
      { $set: { ...agent, active: true } },
      { upsert: true }
    );
  }
  console.log(`✅ Seeded ${AGENTS.length} agents`);

  // Import categories from existing conversations if any
  const { Conversation } = require('./models');
  const cats = await Conversation.distinct('respondioCategory');
  const validCats = cats.filter(c => c && c.trim());

  if (validCats.length > 0) {
    for (const cat of validCats) {
      const match = cat.match(/^(\d+\.\s*)?([^-]+)\s*-\s*(.+)$/);
      const group = match ? match[2].trim() : 'General';
      const name = match ? match[3].trim() : cat;
      await Category.findOneAndUpdate(
        { code: cat },
        { $set: { code: cat, name, group, active: true } },
        { upsert: true }
      );
    }
    console.log(`✅ Seeded ${validCats.length} categories from conversations`);
  }

  console.log('\n🎉 Seed complete!');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
