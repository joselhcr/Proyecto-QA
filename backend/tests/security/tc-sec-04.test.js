/**
 * TC-SEC-04 — Token JWT con firma manipulada es rechazado
 * Verifica que el middleware de autenticación rechace JWTs con:
 * - Firma alterada
 * - Payload modificado
 * - Ataque alg:none
 * - Token vacío o malformado
 */

const request = require('supertest');
const { createApp } = require('../../app');
const mongoose = require('mongoose');
const { connectTestDB, disconnectTestDB } = require('../setup/testHelper');

describe('TC-SEC-04 — Token JWT con firma manipulada es rechazado', () => {
  let app;
  let validToken;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key';
    await connectTestDB();
    app = createApp();

    await request(app).post('/auth/register')
      .send({ username: 'jwtuser', email: 'jwt@test.com', password: 'Pass123!' });

    const login = await request(app).post('/auth/login')
      .send({ email: 'jwt@test.com', password: 'Pass123!' });
    validToken = login.body.token;
  });

  afterAll(async () => await disconnectTestDB());

  it('[CONTROL] Token válido retorna HTTP 200', async () => {
    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
  });

  it('Firma con últimos 5 caracteres alterados retorna HTTP 401', async () => {
    const tampered = validToken.slice(0, -5) + 'XXXXX';
    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('Payload con userId alterado (firma rota) retorna HTTP 401', async () => {
    const [header, , signature] = validToken.split('.');
    const fakePayload = Buffer.from(
      JSON.stringify({ userId: new mongoose.Types.ObjectId().toString(), iat: Date.now() })
    ).toString('base64url');

    const tamperedToken = `${header}.${fakePayload}.${signature}`;
    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${tamperedToken}`);
    expect(res.status).toBe(401);
  });

  it('Ataque alg:none (token sin firma) retorna HTTP 401', async () => {
    const [, payload] = validToken.split('.');
    const noneHeader = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' })
    ).toString('base64url');
    const noneToken = `${noneHeader}.${payload}.`;

    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${noneToken}`);
    expect(res.status).toBe(401);
  });

  it('Authorization con token vacío retorna HTTP 401', async () => {
    const res = await request(app)
      .get('/profile')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('Authorization sin prefijo Bearer retorna HTTP 401', async () => {
    const res = await request(app)
      .get('/profile')
      .set('Authorization', validToken);
    expect(res.status).toBe(401);
  });
});
