/**
 * TC-SEC-09 — Exposición de datos sensibles en respuesta API
 * Verifica que ningún endpoint retorne campos sensibles: password, __v, tokens internos.
 *
 * RESULTADO: Mayoría PASA. FALLA en header X-Powered-By.
 * DEFECTO: DEF-SEC-05 — Express inyecta X-Powered-By: Express por defecto (info leakage).
 */

const request = require('supertest');
const { createApp } = require('../../app');
const { connectTestDB, disconnectTestDB } = require('../setup/testHelper');

describe('TC-SEC-09 — Exposición de datos sensibles en respuesta API', () => {
  let app;
  let token;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key';
    await connectTestDB();
    app = createApp();

    await request(app).post('/auth/register')
      .send({ username: 'sensitiveuser', email: 'sensitive@test.com', password: 'Pass123!' });

    const login = await request(app).post('/auth/login')
      .send({ email: 'sensitive@test.com', password: 'Pass123!' });
    token = login.body.token;
  });

  afterAll(async () => await disconnectTestDB());

  it('GET /profile no retorna campo password ni __v', async () => {
    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('__v');
  });

  it('POST /auth/login no retorna campo password en el body', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'sensitive@test.com', password: 'Pass123!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('username');
    expect(res.body).not.toHaveProperty('password');
  });

  it('POST /auth/register no retorna password ni _id en el body', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ username: 'senstest2', email: 'senstest2@test.com', password: 'Pass123!' });

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('_id');
  });

  it('GET /profile/search no retorna campo password en los resultados', async () => {
    const res = await request(app)
      .get('/profile/search?username=sensitiveuser')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    res.body.results?.forEach((u) => {
      expect(u).not.toHaveProperty('password');
    });
  });

  // FALLARÁ: Express añade X-Powered-By por defecto — DEF-SEC-05
  it('[DEF-SEC-05] Header X-Powered-By no debe estar presente (info leakage de stack)', async () => {
    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('Endpoint inexistente no retorna stack trace interno', async () => {
    const res = await request(app).get('/ruta-inexistente-404');

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/at Object\./);
    expect(body).not.toMatch(/node_modules/);
  });
});
