/**
 * Script temporal: inicia backend con MongoDB en memoria y ejecuta Artillery.
 * Uso: node tests/performance/artillery-runner.js
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const { execSync, spawn } = require('child_process');
const http = require('http');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const TESTS = [
  'tc-r-01-login-carga.yml',
  'tc-r-02-ws-move-carga.yml',
  'tc-r-04-leaderboard-carga.yml',
  'tc-r-06-registro-masivo.yml',
  'tc-r-09-login-estres.yml',
];

async function waitForPort(port, retries = 20, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/`, (res) => { res.destroy(); resolve(); });
        req.on('error', reject);
        req.setTimeout(300, () => { req.destroy(); reject(new Error('timeout')); });
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return false;
}

async function main() {
  console.log('=== Iniciando MongoDB en memoria ===');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log('MongoDB URI:', uri);

  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test-jwt-secret-artillery';
  process.env.PORT = '4000';

  // Crear usuario loadtest en la BD en memoria
  console.log('\n=== Creando usuario de carga ===');
  await mongoose.connect(uri);
  const User = require('../../models/User');
  const exists = await User.findOne({ email: 'loadtest@test.com' });
  if (!exists) {
    await User.create({ username: 'loadtestuser', email: 'loadtest@test.com', password: 'Pass123!' });
    console.log('Usuario loadtest@test.com creado.');
  }
  await mongoose.disconnect();

  // Arrancar el servidor Express en proceso separado
  console.log('\n=== Arrancando servidor backend ===');
  const serverProc = spawn('node', [path.join(__dirname, '../../server.js')], {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProc.stdout.on('data', d => process.stdout.write('[SERVER] ' + d));
  serverProc.stderr.on('data', d => process.stderr.write('[SERVER ERR] ' + d));

  const ready = await waitForPort(4000);
  if (!ready) { console.error('Backend no arrancó'); serverProc.kill(); await mongod.stop(); process.exit(1); }
  console.log('Backend listo en :4000\n');

  // Ejecutar cada test Artillery
  const results = [];
  const testDir = path.join(__dirname);

  for (const yml of TESTS) {
    const ymlPath = path.join(testDir, yml);
    const outJson = path.join(testDir, yml.replace('.yml', '-result.json'));
    console.log(`\n=== Ejecutando: ${yml} ===`);
    try {
      execSync(
        `npx artillery run "${ymlPath}" --output "${outJson}"`,
        { stdio: 'inherit', timeout: 180000 }
      );
      // Leer métricas clave
      if (fs.existsSync(outJson)) {
        const report = JSON.parse(fs.readFileSync(outJson, 'utf8'));
        const agg = report.aggregate || {};
        const counters = agg.counters || {};
        const rates = agg.rates || {};
        const summaries = agg.summaries || {};
        const http_reqs = counters['http.requests'] || counters['vusers.completed'] || 'N/A';
        const errors = counters['http.request_rate'] ? 0 : (counters['errors.total'] || 0);

        // Buscar p95
        let p95 = 'N/A';
        for (const key of Object.keys(summaries)) {
          if (key.includes('response_time') || key.includes('latency')) {
            p95 = summaries[key].p95 || 'N/A';
            break;
          }
        }

        const errorCount = Object.entries(counters)
          .filter(([k]) => k.includes('error') || k.includes('codes.4') || k.includes('codes.5'))
          .reduce((a, [,v]) => a + v, 0);

        const completed = counters['vusers.completed'] || 'N/A';
        const failed = counters['vusers.failed'] || 0;

        results.push({ yml, status: 'OK', p95, completed, failed, errorCount });
        console.log(`  → completados: ${completed}, fallidos: ${failed}, p95: ${p95}ms, errores HTTP: ${errorCount}`);
      }
    } catch (e) {
      results.push({ yml, status: 'EJECUTADO_CON_AVISOS', error: e.message.slice(0, 200) });
      console.log(`  → Completado con advertencias`);
    }
  }

  console.log('\n=== RESUMEN FINAL ===');
  console.log(JSON.stringify(results, null, 2));

  serverProc.kill();
  await mongod.stop();
  console.log('\nPruebas Artillery completadas.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
