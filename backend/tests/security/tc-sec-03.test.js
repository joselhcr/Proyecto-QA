/**
 * TC-SEC-03 — Acceso a datos de otro usuario vía ID manipulado
 * Verifica que un usuario autenticado no pueda acceder a datos privados de otro
 * manipulando el JWT o parámetros de URL.
 */

const request = require('supertest');
const { createApp } = require('../../app');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const { connectTestDB, disconnectTestDB } = require('../setup/testHelper');

describe('TC-SEC-03 — Acceso a datos de otro usuario vía ID manipulado', () => {
  let app;
  let tokenUserA;
  let userBId;
  const SECRET = 'test-secret-key';

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    await connectTestDB();
    app = createApp();

    await request(app).post('/auth/register')
      .send({ username: 'userA', email: 'userA@test.com', password: 'PassA123!' });
    await request(app).post('/auth/register')
      .send({ username: 'userB', email: 'userB@test.com', password: 'PassB123!' });

    const loginA = await request(app).post('/auth/login')
      .send({ email: 'userA@test.com', password: 'PassA123!' });
    tokenUserA = loginA.body.token;

    const userB = await User.findOne({ email: 'userB@test.com' });
    userBId = userB._id.toString();
  });

  afterAll(async () => await disconnectTestDB());

  it('GET /profile sin Authorization retorna HTTP 401', async () => {
    const res = await request(app).get('/profile');
    expect(res.status).toBe(401);
  });

  it('Token de UserA solo retorna sus propios datos, no los de UserB', async () => {
    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${tokenUserA}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('userA@test.com');
    expect(res.body.email).not.toBe('userB@test.com');
    expect(res.body).not.toHaveProperty('password');
  });

  it('JWT forjado con userId de UserB retorna datos de UserB (riesgo si JWT_SECRET se filtra)', async () => {
    const forgedToken = jwt.sign({ userId: userBId }, SECRET, { expiresIn: '1h' });

    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${forgedToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('userB@test.com');
  });

  it('GET /profile/search no retorna campo password de usuarios encontrados', async () => {
    const res = await request(app)
      .get('/profile/search?username=userB&exact=true')
      .set('Authorization', `Bearer ${tokenUserA}`);

    expect(res.status).toBe(200);
    if (res.body.results?.length > 0) {
      res.body.results.forEach((u) => {
        expect(u).not.toHaveProperty('password');
      });
    }
  });
});
