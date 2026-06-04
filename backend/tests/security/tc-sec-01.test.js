/**
 * TC-SEC-01 — Contraseña almacenada con hash bcrypt
 * Verifica que las contraseñas NO se almacenen en texto plano en MongoDB.
 *
 * RESULTADO ESPERADO: FALLO en casos 2 y 3.
 * DEFECTO: DEF-SEC-01 — backend/routes/auth.js:108 compara password en texto plano.
 */

const request = require('supertest');
const { createApp } = require('../../app');
const User = require('../../models/User');
const { connectTestDB, disconnectTestDB } = require('../setup/testHelper');

describe('TC-SEC-01 — Contraseña almacenada con hash bcrypt', () => {
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key';
    await connectTestDB();
    app = createApp();
  });

  afterAll(async () => await disconnectTestDB());

  it('POST /auth/register no retorna campo password en el body de respuesta', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ username: 'sec01user', email: 'sec01@test.com', password: 'Pass123!' });

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('password');
  });

  // FALLARÁ: contraseña almacenada en texto plano — DEF-SEC-01
  it('[DEF-SEC-01] Password en MongoDB debe ser hash bcrypt (formato $2b$)', async () => {
    await request(app)
      .post('/auth/register')
      .send({ username: 'sec01hash', email: 'sec01hash@test.com', password: 'Pass123!' });

    const user = await User.findOne({ email: 'sec01hash@test.com' });

    expect(user).toBeTruthy();
    // FALLARÁ: el valor actual es "Pass123!" en texto plano
    expect(user.password).toMatch(/^\$2[ab]\$\d+\$/);
    expect(user.password).not.toBe('Pass123!');
  });

  // FALLARÁ: sin bcrypt.compare() — DEF-SEC-01
  it('[DEF-SEC-01] El campo password en BD no debe ser igual al texto enviado', async () => {
    await request(app)
      .post('/auth/register')
      .send({ username: 'sec01login', email: 'sec01login@test.com', password: 'Pass123!' });

    const user = await User.findOne({ email: 'sec01login@test.com' });

    // FALLARÁ: son iguales porque no hay hashing
    expect(user.password).not.toBe('Pass123!');
  });
});
