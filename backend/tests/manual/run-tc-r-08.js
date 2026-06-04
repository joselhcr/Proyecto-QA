/**
 * Ejecución automática de TC-R-08 — Reconexión WebSocket tras pérdida de conexión
 * Ejecutar: node tests/manual/run-tc-r-08.js
 */
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs   = require('fs');

const UMBRAL_RECONEXION_MS = 5000;
const ESPERA_DESCONEXION_MS = 2000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongoose = require('mongoose');

  console.log('\n====================================================');
  console.log(' TC-R-08 — Reconexión WebSocket tras pérdida de conexión');
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

  // ── FASE 1: Conectar Jugador A y Jugador B ──────────────────────────
  console.log('FASE 1: Conectando jugadores y estableciendo partida...\n');

  let clientIdA = null;
  let gameId    = null;

  const wsA = new WebSocket(WS_URL);
  const wsB = new WebSocket(WS_URL);

  await new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => reject(new Error('Timeout esperando partida')), 8000);

    wsA.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'connected') {
        clientIdA = msg.clientId;
        console.log(`  Jugador A conectado. clientId: ${clientIdA}`);
        wsA.send(JSON.stringify({ type: 'join', username: 'jugador_A' }));
      }
      if (msg.type === 'match') {
        gameId = msg.gameId;
        console.log(`  Partida iniciada. gameId: ${gameId} — Jugador A (${msg.symbol})`);
        if (!resolved) { resolved = true; clearTimeout(timeout); resolve(); }
      }
    });

    wsB.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'connected') {
        console.log(`  Jugador B conectado. clientId: ${msg.clientId}`);
        wsB.send(JSON.stringify({ type: 'join', username: 'jugador_B' }));
      }
    });

    wsA.on('error', reject);
    wsB.on('error', reject);
  });

  // Hacer una jugada para confirmar estado activo
  await sleep(300);
  wsA.send(JSON.stringify({ type: 'move', index: 0 }));
  console.log('  Jugador A realizó jugada en índice 0.\n');
  await sleep(300);

  // ── FASE 2: Simular desconexión ──────────────────────────────────────
  console.log('FASE 2: Simulando desconexión de Jugador A...');
  wsA.close();
  const t_desconexion = Date.now();
  console.log(`  Jugador A desconectado. Esperando ${ESPERA_DESCONEXION_MS}ms...\n`);
  await sleep(ESPERA_DESCONEXION_MS);

  // ── FASE 3: Reconexión ───────────────────────────────────────────────
  console.log('FASE 3: Iniciando reconexión de Jugador A...');
  const t_inicio_reconexion = Date.now();

  const resultado = await new Promise((resolve) => {
    const wsReconect = new WebSocket(WS_URL);
    let estadoPreservado = false;
    let tiempoReconexion = null;
    let notificacionB    = false;

    wsReconect.on('open', () => {
      wsReconect.send(JSON.stringify({
        type: 'reconnect',
        clientId:  clientIdA,
        username:  'jugador_A',
        gameId:    gameId,
      }));
    });

    wsReconect.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      tiempoReconexion = Date.now() - t_inicio_reconexion;

      if (msg.type === 'state' || msg.board) {
        estadoPreservado = Array.isArray(msg.board) && msg.board[0] === 'X';
        console.log(`  Respuesta del servidor (tipo: ${msg.type}): tablero[0]=${msg.board?.[0] || 'N/A'}`);
        setTimeout(() => { wsReconect.close(); resolve({ tiempoReconexion, estadoPreservado, notificacionB }); }, 500);
      } else if (msg.type === 'error') {
        console.log(`  Error del servidor: ${msg.message}`);
        wsReconect.close();
        resolve({ tiempoReconexion, estadoPreservado: false, notificacionB, error: msg.message });
      }
    });

    // Verificar notificación a Jugador B
    wsB.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.message && msg.message.includes('reconnected')) {
        notificacionB = true;
        console.log(`  Jugador B notificado: "${msg.message}"`);
      }
    });

    wsReconect.on('error', (e) => {
      resolve({ tiempoReconexion: Date.now() - t_inicio_reconexion, estadoPreservado: false, notificacionB, error: e.message });
    });

    setTimeout(() => {
      wsReconect.close();
      resolve({ tiempoReconexion: Date.now() - t_inicio_reconexion, estadoPreservado: false, notificacionB, error: 'Timeout' });
    }, UMBRAL_RECONEXION_MS + 2000);
  });

  // ── Resultados ────────────────────────────────────────────────────────
  console.log('\n--- RESULTADOS ---');
  console.log(`  clientId              : ${clientIdA}`);
  console.log(`  gameId                : ${gameId}`);
  console.log(`  Tiempo de reconexión  : ${resultado.tiempoReconexion}ms (umbral: ${UMBRAL_RECONEXION_MS}ms)`);
  console.log(`  Estado preservado     : ${resultado.estadoPreservado ? 'SÍ ✅' : 'NO ❌'}`);
  console.log(`  Notificación a B      : ${resultado.notificacionB ? 'SÍ ✅' : 'NO ❌'}`);
  if (resultado.error) console.log(`  Error                 : ${resultado.error}`);

  const pasa = resultado.tiempoReconexion <= UMBRAL_RECONEXION_MS && resultado.estadoPreservado;
  console.log(`\n  Resultado: ${pasa ? 'PASA ✅' : 'FALLA ❌'}\n`);

  // Actualizar el markdown
  const mdPath = path.join(__dirname, 'TC-R-08-ws-reconexion.md');
  let md = fs.readFileSync(mdPath, 'utf8');

  md = md.replace('| clientId (paso 2) | |', `| clientId (paso 2) | ${clientIdA} |`);
  md = md.replace('| gameId (paso 6) | |',   `| gameId (paso 6) | ${gameId} |`);
  md = md.replace('| Tiempo de desconexión (inicio cronómetro, paso 9) | |',
    `| Tiempo de desconexión (inicio cronómetro, paso 9) | T+0ms |`);
  md = md.replace('| Tiempo de reconexión completada (paso 13) | |',
    `| Tiempo de reconexión completada (paso 13) | T+${resultado.tiempoReconexion}ms |`);
  md = md.replace('| **Tiempo total de reconexión (ms)** | |',
    `| **Tiempo total de reconexión (ms)** | **${resultado.tiempoReconexion}ms** |`);
  md = md.replace('| Estado del tablero preservado (sí/no) | |',
    `| Estado del tablero preservado (sí/no) | ${resultado.estadoPreservado ? 'SÍ' : 'NO'} |`);
  md = md.replace('| Terminal 2 notificó reconexión (sí/no) | |',
    `| Terminal 2 notificó reconexión (sí/no) | ${resultado.notificacionB ? 'SÍ' : 'NO'} |`);

  md = md.replace('| Tiempo de reconexión | | ≤ 5000ms | |',
    `| Tiempo de reconexión | ${resultado.tiempoReconexion}ms | ≤ 5000ms | ${resultado.tiempoReconexion <= UMBRAL_RECONEXION_MS ? 'SÍ ✅' : 'NO ❌'} |`);
  md = md.replace('| Estado del tablero intacto | | Sí | |',
    `| Estado del tablero intacto | ${resultado.estadoPreservado ? 'SÍ' : 'NO'} | Sí | ${resultado.estadoPreservado ? 'SÍ ✅' : 'NO ❌'} |`);
  md = md.replace('| Notificación al otro jugador | | Sí | |',
    `| Notificación al otro jugador | ${resultado.notificacionB ? 'SÍ' : 'NO'} | Sí | ${resultado.notificacionB ? 'SÍ ✅' : 'NO ❌'} |`);

  if (pasa) {
    md = md.replace('- [ ] PASA — Reconexión en ≤ 5000ms con estado preservado',
      `- [x] PASA — Reconexión en ${resultado.tiempoReconexion}ms con estado preservado`);
  } else {
    md = md.replace('- [ ] FALLA — Reconexión fallida o estado perdido (documentar defecto)',
      `- [x] FALLA — Reconexión fallida o estado perdido`);
  }
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log('Markdown TC-R-08 actualizado con resultados reales.\n');

  wsB.close();
  server.close();
  await mongoose.disconnect();
  await mongod.stop();
}

run().catch(e => { console.error(e); process.exit(1); });
