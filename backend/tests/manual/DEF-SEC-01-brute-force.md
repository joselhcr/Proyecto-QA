# Reporte de Defecto DEF-SEC-01

---

| Campo | Detalle |
|---|---|
| **Código** | DEF-SEC-01 |
| **Hardware y software** | PC, 16GB RAM, Intel Core i5 · Node.js 18 · Postman v11 |
| **Sistema operativo** | Windows 11 |
| **Navegador** | Google Chrome |
| **Resolución** | 1920x1080 |
| **Comentarios** | Detectado durante ejecución de TC-SEC-07 — Seguridad / OWASP A07 (Fallos de Identificación y Autenticación) |
| **Nombre** | Ausencia de límite de intentos fallidos de login (sin protección brute force) |
| **Descripción** | El endpoint `POST /auth/login` no implementa ningún mecanismo de limitación de tasa (rate limiting) ni bloqueo de cuenta tras múltiples intentos fallidos consecutivos. Un atacante puede realizar intentos ilimitados de login sin ninguna penalización, lo que expone el sistema a ataques de fuerza bruta para adivinar contraseñas. |
| **Encargado** | Andrés Gustavo Arias Ruiz |

---

## Precondiciones

1. Backend corriendo en `http://localhost:4000`.
2. Usuario registrado: `email: test@correo.com`, `password: Pass123!`.
3. Sin ningún bloqueo activo sobre la cuenta.

---

## Pasos para reproducir

| # | Acción |
|---|---|
| 1 | Abrir Postman y crear petición `POST http://localhost:4000/auth/login`. |
| 2 | Body → raw → JSON: `{"email": "test@correo.com", "password": "CONTRASEÑA_INCORRECTA"}`. |
| 3 | Ejecutar la petición 10 veces consecutivas sin pausa. |
| 4 | Observar el código HTTP en cada intento (especialmente a partir del intento #5 o #6). |
| 5 | En el intento #11, enviar las credenciales correctas y verificar que el acceso sigue funcionando. |

---

## Resultado esperado

El sistema debe retornar **HTTP 429 Too Many Requests** a partir del quinto intento fallido consecutivo, indicando que la cuenta o la IP ha sido temporalmente bloqueada. El login correcto posterior debe ser rechazado o requerir una espera.

---

## Resultado obtenido

El sistema retorna **HTTP 401** en los **10 intentos fallidos consecutivos** sin ninguna restricción. El login correcto con `Pass123!` funciona inmediatamente después de los 10 fallos, sin ningún tipo de bloqueo ni retraso adicional.

| Intento | Código HTTP | Tiempo (ms) | Observación |
|---|---|---|---|
| 1 | 401 | 4 | Sin bloqueo |
| 2 | 401 | 3 | Sin bloqueo |
| 3 | 401 | 4 | Sin bloqueo |
| 4 | 401 | 2 | Sin bloqueo |
| 5 | 401 | 4 | Sin bloqueo — debería ser 429 |
| 6 | 401 | 3 | Sin bloqueo — debería ser 429 |
| 7 | 401 | 2 | Sin bloqueo |
| 8 | 401 | 2 | Sin bloqueo |
| 9 | 401 | 4 | Sin bloqueo |
| 10 | 401 | 2 | Sin bloqueo |
| Login correcto | 200 | 6 | Acceso concedido sin restricción tras 10 fallos |

---

## Prioridad

**Alta**

---

## Severidad

**Alta** — Permite ataques de fuerza bruta automatizados que pueden comprometer cualquier cuenta de usuario con contraseña débil. Dado que las contraseñas tampoco están hasheadas (ver DEF-SEC-02), el impacto combinado es crítico.

---

## Notas

**Causa raíz:** El archivo `backend/app.js` no registra el middleware `express-rate-limit` ni ninguna alternativa de throttling. La ruta `POST /auth/login` en `backend/routes/auth.js` no tiene ninguna verificación de intentos previos.

**Corrección sugerida:** Instalar `express-rate-limit` y agregar en `backend/app.js`:
```javascript
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,                    // máximo 5 intentos por ventana
  message: { error: 'Demasiados intentos. Intente en 15 minutos.' },
});
app.use('/auth/login', loginLimiter);
```

**Casos de prueba relacionados:** TC-SEC-07

**Defectos relacionados:** DEF-SEC-02 (contraseñas en texto plano agrava el riesgo)
