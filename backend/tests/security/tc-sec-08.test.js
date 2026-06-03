/**
 * TC-SEC-08 — Emisión de evento WebSocket sin autenticación
 * Verifica que el servidor WebSocket rechace conexiones y mensajes sin JWT.
 *
 * RESULTADO ESPERADO: FALLO — websocket.js:725 acepta cualquier conexión sin JWT.
 * DEFECTO: DEF-SEC-04 — no existe verificación de autenticación en el handshake WebSocket.
 */

const http = require('http');
const WebSocket = require('ws');
const { createApp } = require('../../app');
const { attachWebsocketServer } = require('../../realtime/websocket');
const { connectTestDB, disconnectTestDB } = require('../setup/testHelper');

describe('TC-SEC-08 — Evento WebSocket sin autenticación debe ser rechazado', () => {
  let server;
  let port;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key';
    await connectTestDB();

    const app = createApp();
    server = http.createServer(app);
    attachWebsocketServer(server);

    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectTestDB();
  });

  // FALLARÁ: el servidor acepta la conexión sin autenticación — DEF-SEC-04
  it('[DEF-SEC-04] Servidor NO debe aceptar handshake WebSocket sin JWT', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    ws.on('open', () => {
      ws.close();
      done(new Error('DEFECTO DEF-SEC-04: servidor aceptó conexión WebSocket sin JWT'));
    });

    ws.on('error', () => {
      // Comportamiento CORRECTO: rechaza la conexión no autenticada
      expect(true).toBe(true);
      done();
    });

    setTimeout(() => { ws.terminate(); done(); }, 4000);
  });

  // FALLARÁ: el cliente sin auth puede unirse a matchmaking — DEF-SEC-04
  it('[DEF-SEC-04] Cliente sin JWT no debe poder enviar evento "join" y ser admitido en cola', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'connected') {
        ws.send(JSON.stringify({ type: 'join', username: 'hacker_sin_auth' }));
      }

      if (msg.type === 'waiting') {
        ws.close();
        done(new Error('DEFECTO: cliente sin JWT fue admitido en la cola de matchmaking'));
      }
    });

    ws.on('error', done);
    setTimeout(() => { ws.terminate(); done(); }, 4000);
  });

  it('[CONTROL] Ruta WebSocket incorrecta (/ws-fake) es rechazada', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws-fake`);

    ws.on('open', () => {
      ws.close();
      done(new Error('No debería conectar a ruta incorrecta'));
    });

    ws.on('error', () => {
      expect(true).toBe(true);
      done();
    });

    setTimeout(() => { ws.terminate(); done(); }, 4000);
  });
});
