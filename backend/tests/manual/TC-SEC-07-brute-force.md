# Caso de Prueba TC-SEC-07 — Fuerza Bruta: Límite de Intentos de Login

---

| Campo | Detalle |
|---|---|
| **Código** | TC-SEC-07 |
| **Hardware y software** | PC, 16GB RAM, Intel Core i5 · Postman v11 |
| **Sistema operativo** | Windows 11 |
| **Navegador** | Google Chrome |
| **Resolución** | 1920x1080 |
| **Comentarios** | Seguridad — protección brute force / OWASP A07 — Prueba manual |
| **Nombre** | Fuerza bruta — límite de intentos de login |
| **Descripción** | Verificar que el endpoint POST /auth/login bloquea o devuelve HTTP 429 tras múltiples intentos de login fallidos consecutivos con credenciales incorrectas. |
| **Encargado** | Andrés Gustavo Arias Ruiz |

---

## Precondiciones

1. Backend corriendo en `http://localhost:4000` (ejecutar `npm start` en `/backend`).
2. Usuario registrado en la base de datos:
   - **Email:** `test@correo.com`
   - **Password:** `Pass123!`
3. Postman instalado y abierto.
4. Sin bloqueo activo en la cuenta de prueba.
5. Verificar que el servidor responde correctamente antes de empezar: `GET http://localhost:4000/` debe retornar 200.

---

## Pasos

| # | Acción |
|---|---|
| 1 | Abrir Postman y crear nueva petición `POST http://localhost:4000/auth/login`. |
| 2 | En la pestaña **Body → raw → JSON** ingresar: `{"email": "test@correo.com", "password": "CONTRASEÑA_INCORRECTA"}`. |
| 3 | Ejecutar la petición. Verificar que retorna **HTTP 401**. Registrar el código y tiempo de respuesta del **intento #1**. |
| 4 | Sin cambiar el body, volver a ejecutar la petición. Registrar **intento #2**. |
| 5 | Repetir el paso 4 hasta completar **10 intentos consecutivos**, anotando el código HTTP de cada uno. |
| 6 | En el **intento #6**, verificar si la respuesta cambia a **HTTP 429 Too Many Requests**. |
| 7 | Después del intento #10, modificar el body con la contraseña correcta: `{"email": "test@correo.com", "password": "Pass123!"}`. |
| 8 | Ejecutar y registrar si el login legítimo es **permitido** o **bloqueado**. |

---

## Resultados Esperados

| Resultado | Descripción |
|---|---|
| **Éxito** | El sistema retorna HTTP **429 Too Many Requests** a partir del intento #5 o #6. El login correcto queda temporalmente bloqueado o se solicita captcha. |
| **Fracaso** | El sistema retorna HTTP **401** en todos los intentos sin ningún tipo de límite. El login correcto funciona sin restricción después de 10 fallos. |

---

## Prioridad

**Alta**

---

## Notas

> **DEFECTO CONOCIDO — DEF-SEC-01:**
> El archivo `backend/app.js` no implementa `express-rate-limit` ni ningún middleware de throttling.
> **Esta prueba FALLARÁ** — el sistema permitirá los 10 intentos sin bloqueo.
> Documentar como defecto con los datos observados al ejecutarla.

---

## Registro de Ejecución

| Intento | Código HTTP | Tiempo (ms) | Observación |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |
| Login correcto | | | |

**Resultado final:**
- [ ] PASA — Sistema bloquea tras 5 intentos
- [ ] FALLA — Sistema no limita intentos (documentar defecto DEF-SEC-01)
