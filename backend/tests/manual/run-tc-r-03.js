/**
 * Ejecución automática de TC-R-03 — Concurrencia WebSocket: 50 partidas simultáneas
 * Simula 100 clientes WebSocket (2 por sala = 50 partidas activas).
 * Ejecutar: node tests/manual/run-tc-r-03.js
 */
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs   = require('fs');

const NUM_SALAS     = 50;   // 50 partidas = 100 clientes
const UMBRAL_P95_MS = 500;
const UMBRAL_ERROR  = 0.01; // 1%

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongoose = require('mongoose');

  console.log('\n====================================================');
  console.log(' TC-R-03 — Concurrencia WebSocket: 50 partidas simultáneas');
  console.log('====================================================\n');

  process.env.JWT_SECRET = 'test-secret-key';
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());

  const { createApp }           = require('../../app');
  const { attachWebsocketServer } = require('../../realtime/websocket');

  const app    = createApp();
  const server = http.createServer(app);
  attachWebsocketServer(server);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const WS_URL = `ws://localhost:${port}/ws`;

  console.log(`Servidor WebSocket escuchando en puerto ${port}`);
  console.log(`Conectando ${NUM_SALAS * 2} clientes (${NUM_SALAS} salas)...\n`);

  const latencias  = [];
  const errores    = [];
  const conexiones = [];
  let completados  = 0;

  // Conectar NUM_SALAS * 2 clientes en grupos de 2 (para emparejar)
  const conectarPar = (idx) => new Promise((resolve) => {
    const wsA = new WebSocket(WS_URL);
    const wsB = new WebSocket(WS_URL);
    const pair = { wsA, wsB, emparejado: false, movidas: 0, erroresPar: 0 };
    conexiones.push(pair);

    const enviarMov = (ws, idx_) => {
      const t0 = Date.now();
      ws.send(JSON.stringify({ type: 'move', index: idx_ % 9 }));
      ws.once('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'state' || msg.type === 'error') {
          latencias.push(Date.now() - t0);
          if (msg.type === 'error') pair.erroresPar++;
        }
      });
    };

    let timeout = setTimeout(() => {
      pair.wsA.close(); pair.wsB.close();
      errores.push(`Par ${idx}: timeout`);
      resolve();
    }, 10000);

    wsA.on('open', () => wsA.send(JSON.stringify({ type: 'join', username: `playerA_${idx}` })));
    wsB.on('open', () => wsB.send(JSON.stringify({ type: 'join', username: `playerB_${idx}` })));

    wsA.on('message', async (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'match' && !pair.emparejado) {
        pair.emparejado = true;
        clearTimeout(timeout);
        // Simular 3 movidas por cada jugador con delay
        for (let m = 0; m < 3; m++) {
          await sleep(100);
          if (wsA.readyState === WebSocket.OPEN) enviarMov(wsA, m * 2);
          await sleep(100);
          if (wsB.readyState === WebSocket.OPEN) enviarMov(wsB, m * 2 + 1);
        }
        await sleep(500);
        wsA.close(); wsB.close();
        completados++;
        resolve();
      }
    });

    wsA.on('error', (e) => { pair.erroresPar++; errores.push(e.message); });
    wsB.on('error', (e) => { pair.erroresPar++; errores.push(e.message); });
  });

  // Conectar en lotes de 10 pares para evitar saturar el event loop
  const LOTE = 10;
  for (let i = 0; i < NUM_SALAS; i += LOTE) {
    const lote = Array.from({ length: Math.min(LOTE, NUM_SALAS - i) }, (_, j) => conectarPar(i + j));
    await Promise.all(lote);
    process.stdout.write(`\r  Progreso: ${Math.min(i + LOTE, NUM_SALAS)}/${NUM_SALAS} salas`);
    await sleep(200);
  }
  console.log('\n');

  // Calcular métricas
  latencias.sort((a, b) => a - b);
  const n       = latencias.length;
  const p50     = n ? latencias[Math.floor(n * 0.50)] : 0;
  const p95     = n ? latencias[Math.floor(n * 0.95)] : 0;
  const p99     = n ? latencias[Math.floor(n * 0.99)] : 0;
  const promedio = n ? Math.round(latencias.reduce((s, v) => s + v, 0) / n) : 0;
  const maximo  = n ? latencias[n - 1] : 0;
  const tasaError = errores.length / (NUM_SALAS * 2);

  console.log('--- MÉTRICAS ---');
  console.log(`  Total latencias registradas : ${n}`);
  console.log(`  VUs completados             : ${completados}/${NUM_SALAS}`);
  console.log(`  Promedio latencia           : ${promedio}ms`);
  console.log(`  P50                         : ${p50}ms`);
  console.log(`  P95                         : ${p95}ms  (umbral: ${UMBRAL_P95_MS}ms)`);
  console.log(`  P99                         : ${p99}ms`);
  console.log(`  Máximo                      : ${maximo}ms`);
  console.log(`  Errores                     : ${errores.length} (tasa: ${(tasaError * 100).toFixed(2)}%)`);

  const pasa = p95 <= UMBRAL_P95_MS && tasaError < UMBRAL_ERROR;
  console.log(`\n  Resultado: ${pasa ? 'PASA ✅' : 'FALLA ❌ — ' + (p95 > UMBRAL_P95_MS ? 'P95 excede umbral' : 'Tasa de error alta')}\n`);

  // Actualizar el markdown
  const mdPath = path.join(__dirname, 'TC-R-03-ws-concurrencia.md');
  let md = fs.readFileSync(mdPath, 'utf8');

  const tabla = `| Métrica | Valor Obtenido | Umbral | Cumple |
|---|---|---|---|
| Latencia p50 | ${p50}ms | ≤ 200ms | ${p50 <= 200 ? 'SÍ ✅' : 'NO ❌'} |
| Latencia p95 | ${p95}ms | ≤ 500ms | ${p95 <= UMBRAL_P95_MS ? 'SÍ ✅' : 'NO ❌'} |
| Latencia p99 | ${p99}ms | ≤ 1000ms | ${p99 <= 1000 ? 'SÍ ✅' : 'NO ❌'} |
| Tasa de error | ${(tasaError * 100).toFixed(2)}% | < 1% | ${tasaError < UMBRAL_ERROR ? 'SÍ ✅' : 'NO ❌'} |
| VUs completados | ${completados} | 50 | ${completados >= NUM_SALAS * 0.95 ? 'SÍ ✅' : 'NO ❌'} |`;

  md = md.replace(
    /\| Métrica \| Valor Obtenido \| Umbral \| Cumple \|[\s\S]*?\| VUs completados \|.*\|/,
    tabla
  );

  if (pasa) {
    md = md.replace('- [ ] PASA', `- [x] PASA — P95: ${p95}ms, Error: ${(tasaError*100).toFixed(2)}%`);
  } else {
    md = md.replace('- [ ] FALLA (documentar defecto con métricas observadas)',
      `- [x] FALLA — P95: ${p95}ms (umbral ${UMBRAL_P95_MS}ms), Error: ${(tasaError*100).toFixed(2)}%`);
  }
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log('Markdown TC-R-03 actualizado con resultados reales.\n');

  server.close();
  await mongoose.disconnect();
  await mongod.stop();
}

run().catch(e => { console.error(e); process.exit(1); });
