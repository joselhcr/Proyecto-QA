/**
 * TC-SEC-02 — Inyección NoSQL en campo email del login
 * Verifica que POST /auth/login rechace operadores MongoDB como valores de campo.
 *
 * NOTA: Los tests retornan 401 pero por mismatch de contraseña, no por sanitización.
 * El operador $gt SÍ se ejecuta en la query MongoDB — DEF potencial sin express-mongo-sanitize.
 */

const request = require('supertest');
const { createApp } = require('../../app');
const { connectTestDB, disconnectTestDB } = require('../setup/testHelper');

describe('TC-SEC-02 — Inyección NoSQL en campo email del login', () => {
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key';
    await connectTestDB();
    app = createApp();

    await request(app)
      .post('/auth/register')
      .send({ username: 'victim', email: 'victim@test.com', password: 'VictimPass123!' });
  });

  afterAll(async () => await disconnectTestDB());

  it('Debe retornar 401 ante operador $gt en campo email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: { $gt: '' }, password: 'cualquiera' });

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('token');
  });

  it('Debe retornar 401 ante operador $ne en email y password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('token');
  });

  it('Debe retornar 401 ante operador $regex como email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: { $regex: '.*' }, password: 'x' });

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('token');
  });

  it('No debe retornar HTTP 500 ante payload MongoDB malicioso (evitar info leakage)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: { $where: 'sleep(1)' }, password: 'x' });

    expect(res.status).not.toBe(500);
  });

  // FALLARÁ si no hay validación de tipo de campo — indica falta de sanitización
  it('[DEF POTENCIAL] El servidor debe validar que email sea tipo string (no objeto MongoDB)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: { $gt: '' }, password: 'x' });

    // Debe retornar 400 (validación de tipo), no 401 (la query MongoDB se ejecutó)
    expect(res.status).toBe(400);
  });
});
