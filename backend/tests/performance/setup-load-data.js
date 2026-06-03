/**
 * Script de preparación de datos para pruebas de carga.
 * Ejecutar UNA SOLA VEZ antes de correr los tests Artillery:
 *   node tests/performance/setup-load-data.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../../models/User');

async function seed() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/tictactoe';
  await mongoose.connect(uri);
  console.log('Conectado a MongoDB:', uri);

  const exists = await User.findOne({ email: 'loadtest@test.com' });
  if (!exists) {
    await User.create({
      username: 'loadtestuser',
      email: 'loadtest@test.com',
      password: 'Pass123!',
    });
    console.log('Usuario loadtest@test.com creado correctamente.');
  } else {
    console.log('Usuario loadtest@test.com ya existe. No se requiere acción.');
  }

  await mongoose.disconnect();
  console.log('Desconectado. Datos listos para los tests de carga.');
}

seed().catch((err) => {
  console.error('Error al crear datos de prueba:', err);
  process.exit(1);
});
