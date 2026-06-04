/**
 * Ejecución automática de TC-SEC-07 — Fuerza bruta: límite de intentos de login
 * Ejecutar: node tests/manual/run-tc-sec-07.js
 */
const http = require('http');
const path = require('path');
const fs   = require('fs');

async function makeRequest(port, method, path_, body) {
  return new Promise((resolve) => {
    const data    = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost', port,
      path: path_, method,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
    };
    const t0  = Date.now();
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(raw || '{}'), ms: Date.now() - t0 });
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: {}, ms: Date.now() - t0, error: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongoose = require('mongoose');

  console.log('\n====================================================');
  console.log(' TC-SEC-07 — Fuerza bruta: límite de intentos de login');
  console.log('====================================================\n');

  process.env.JWT_SECRET = 'test-secret-key';
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());

  const { createApp } = require('../../app');
  const app    = createApp();
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;

  // Crear usuario de prueba
  await makeRequest(port, 'POST', '/auth/register',
    { username: 'testuser', email: 'test@correo.com', password: 'Pass123!' });
  console.log('Usuario test@correo.com creado.\n');
  console.log(` #  | HTTP | Tiempo(ms) | Observación`);
  console.log(`----+------+------------+----------------------------`);

  const rows = [];
  let blocked = false;

  for (let i = 1; i <= 10; i++) {
    const r = await makeRequest(port, 'POST', '/auth/login',
      { email: 'test@correo.com', password: 'CONTRASEÑA_INCORRECTA' });
    const obs = r.status === 429 ? 'BLOQUEADO ✅' : r.status === 401 ? 'Sin bloqueo' : r.status.toString();
    console.log(` ${String(i).padStart(2)} | ${r.status} | ${String(r.ms).padEnd(10)} | ${obs}`);
    rows.push({ i, status: r.status, ms: r.ms, obs });
    if (r.status === 429) blocked = true;
    await new Promise(r => setTimeout(r, 100));
  }

  // Login correcto al final
  const correct = await makeRequest(port, 'POST', '/auth/login',
    { email: 'test@correo.com', password: 'Pass123!' });
  const correctObs = correct.status === 200 ? 'Acceso concedido sin restricción' : `HTTP ${correct.status}`;
  console.log(`----+------+------------+----------------------------`);
  console.log(` OK | ${correct.status} | ${String(correct.ms).padEnd(10)} | Login correcto → ${correctObs}`);

  const resultado = blocked
    ? 'PASA ✅ — Sistema bloqueó tras 5 intentos'
    : 'FALLA ❌ — Sistema permite intentos ilimitados (DEF-SEC-01)';
  console.log(`\nResultado: ${resultado}\n`);

  // Actualizar el markdown
  const mdPath = path.join(__dirname, 'TC-SEC-07-brute-force.md');
  let md = fs.readFileSync(mdPath, 'utf8');

  // Reemplazar tabla de registro
  let tabla = '| # | Acción |\n';
  tabla = '| Intento | Código HTTP | Tiempo (ms) | Observación |\n|---|---|---|---|\n';
  for (const row of rows) {
    tabla += `| ${row.i} | ${row.status} | ${row.ms} | ${row.obs} |\n`;
  }
  tabla += `| Login correcto | ${correct.status} | ${correct.ms} | ${correctObs} |\n`;

  // Reemplazar sección de tabla de registro
  md = md.replace(
    /\| Intento \| Código HTTP \| Tiempo \(ms\) \| Observación \|[\s\S]*?\| Login correcto \|.*\n/,
    tabla
  );

  // Marcar checkbox
  if (blocked) {
    md = md.replace('- [ ] PASA — Sistema bloquea tras 5 intentos', '- [x] PASA — Sistema bloquea tras 5 intentos');
  } else {
    md = md.replace('- [ ] FALLA — Sistema no limita intentos (documentar defecto DEF-SEC-01)', '- [x] FALLA — Sistema no limita intentos (DEF-SEC-01 confirmado)');
  }
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log('Markdown TC-SEC-07 actualizado con resultados reales.\n');

  server.close();
  await mongoose.disconnect();
  await mongod.stop();
}

run().catch(e => { console.error(e); process.exit(1); });
