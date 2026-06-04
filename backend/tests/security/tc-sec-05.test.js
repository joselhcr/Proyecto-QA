/**
 * TC-SEC-05 — Contraseña sin cumplir requisitos mínimos de seguridad
 * Verifica que POST /auth/register rechace contraseñas débiles.
 *
 * RESULTADO ESPERADO: FALLO en todos los casos de contraseña débil.
 * DEFECTO: DEF-SEC-02 — no existe validación de política de contraseñas en auth.js.
 */

const request = require('supertest');
const { createApp } = require('../../app');
const { connectTestDB, disconnectTestDB, clearCollections } = require('../setup/testHelper');

describe('TC-SEC-05 — Contraseña sin cumplir requisitos mínimos de seguridad', () => {
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key';
    await connectTestDB();
    app = createApp();
  });

  afterEach(async () => await clearCollections());
  afterAll(async () => await disconnectTestDB());

  const weakPasswords = [
    { label: '3 caracteres numéricos',       value: '123' },
    { label: 'Solo minúsculas (sin símbolo)', value: 'password' },
    { label: 'Solo números 8 chars',          value: '12345678' },
    { label: 'Contraseña vacía',              value: '' },
    { label: 'Espacios en blanco',            value: '        ' },
    { label: 'Sin mayúscula ni símbolo',      value: 'abcdefgh' },
  ];

  weakPasswords.forEach(({ label, value }) => {
    // FALLARÁ: el servidor actualmente acepta cualquier contraseña — DEF-SEC-02
    it(`[DEF-SEC-02] Debe rechazar contraseña débil: "${label}"`, async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          username: `weakuser_${Date.now()}`,
          email:    `weak_${Date.now()}@test.com`,
          password: value,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/contraseña|password/i);
    });
  });

  it('[CONTROL] Acepta contraseña fuerte (>=8 chars, mayúscula, símbolo)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        username: 'stronguser',
        email:    'strong@test.com',
        password: 'StrongPass123!',
      });
    expect(res.status).toBe(201);
  });
});
