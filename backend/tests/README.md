# Guía de Ejecución de Pruebas — Tic Tac Toe QA

**Responsable:** Andrés Gustavo Arias Ruiz  
**Curso:** Aseguramiento de Calidad de Software — TEC, Grupo 50

---

## Estructura de carpetas

```
backend/tests/
├── setup/
│   └── testHelper.js          # Helper: MongoDB in-memory para Jest
├── security/
│   ├── tc-sec-01.test.js      # Contraseña con hash bcrypt
│   ├── tc-sec-02.test.js      # Inyección NoSQL en login
│   ├── tc-sec-03.test.js      # Acceso a datos de otro usuario
│   ├── tc-sec-04.test.js      # JWT con firma manipulada
│   ├── tc-sec-05.test.js      # Política de contraseñas débiles
│   ├── tc-sec-06.test.js      # XSS en campos de texto
│   ├── tc-sec-08.test.js      # WebSocket sin autenticación
│   └── tc-sec-09.test.js      # Exposición de datos sensibles
├── performance/
│   ├── setup-load-data.js     # Crea usuarios de prueba en MongoDB
│   ├── tc-r-01-login-carga.yml
│   ├── tc-r-02-ws-move-carga.yml
│   ├── tc-r-03-websocket.yml  # Artillery — TC-R-03 (manual con script)
│   ├── tc-r-04-leaderboard-carga.yml
│   ├── tc-r-06-registro-masivo.yml
│   ├── tc-r-07.test.js        # Jest — checkWinner timing
│   ├── tc-r-09-login-estres.yml
│   └── tc-r-10.test.js        # Jest — AI response time
└── manual/
    ├── TC-SEC-07-brute-force.md
    ├── TC-R-03-ws-concurrencia.md
    ├── TC-R-05-carga-frontend.md
    └── TC-R-08-ws-reconexion.md
```

---

## Instalación (una sola vez)

```powershell
cd backend
npm install
```

---

## Pruebas Automatizadas de Seguridad (Jest + Supertest)

### Instalar dependencias de prueba

```powershell
npm install --save-dev jest supertest mongodb-memory-server@10
```

### Ejecutar todas las pruebas de seguridad

```powershell
npm run test:security
```

### Ejecutar una prueba específica

```powershell
npm run test:security -- --testPathPattern=tc-sec-04
```

### Pruebas que se esperan PASAR

| Test | Descripción |
|---|---|
| TC-SEC-03 | IDOR — acceso horizontal |
| TC-SEC-04 | JWT manipulado |
| TC-SEC-09 (parcial) | Exposición de datos sensibles |

### Pruebas que revelarán DEFECTOS (esperado FALLAR)

| Test | Defecto documentado |
|---|---|
| TC-SEC-01 | DEF-SEC-01: Contraseñas en texto plano |
| TC-SEC-02 | DEF potencial: Falta express-mongo-sanitize |
| TC-SEC-05 | DEF-SEC-02: Sin política de contraseñas |
| TC-SEC-06 | DEF-SEC-03: Sin sanitización XSS |
| TC-SEC-08 | DEF-SEC-04: WebSocket sin autenticación |
| TC-SEC-09 (X-Powered-By) | DEF-SEC-05: Header tecnológico expuesto |

---

## Pruebas de Rendimiento con Jest

```powershell
npm run test:perf
```

---

## Pruebas de Rendimiento con Artillery

### Paso 1: Preparar datos de prueba (una sola vez)

```powershell
node tests/performance/setup-load-data.js
```

### Paso 2: Ejecutar tests de carga HTTP

```powershell
# TC-R-01: Login 10 usuarios concurrentes
npx artillery run tests/performance/tc-r-01-login-carga.yml --output reporte-tc-r-01.json

# TC-R-04: Leaderboard 100 peticiones
npx artillery run tests/performance/tc-r-04-leaderboard-carga.yml --output reporte-tc-r-04.json

# TC-R-06: Registro masivo 200 usuarios
npx artillery run tests/performance/tc-r-06-registro-masivo.yml --output reporte-tc-r-06.json
```

### Paso 3: Ejecutar tests WebSocket

```powershell
# TC-R-02: Movidas WS (20 concurrentes)
npx artillery run tests/performance/tc-r-02-ws-move-carga.yml --output reporte-tc-r-02.json

# TC-R-03: Concurrencia 50 salas (prueba manual guiada)
npx artillery run tests/performance/tc-r-03-websocket.yml --output reporte-tc-r-03.json
```

### Paso 4: Estrés (ejecutar al final)

```powershell
# TC-R-09: 500 usuarios en login
npx artillery run tests/performance/tc-r-09-login-estres.yml --output reporte-tc-r-09.json
```

### Generar reportes HTML

```powershell
npx artillery report reporte-tc-r-01.json
npx artillery report reporte-tc-r-02.json
npx artillery report reporte-tc-r-03.json
npx artillery report reporte-tc-r-04.json
npx artillery report reporte-tc-r-06.json
npx artillery report reporte-tc-r-09.json
```

---

## Pruebas Manuales

Ver los documentos en `backend/tests/manual/`:

| Archivo | Prueba |
|---|---|
| `TC-SEC-07-brute-force.md` | Fuerza bruta — límite de intentos de login |
| `TC-R-03-ws-concurrencia.md` | Concurrencia WebSocket — 50 partidas simultáneas |
| `TC-R-05-carga-frontend.md` | Tiempo de carga inicial del frontend |
| `TC-R-08-ws-reconexion.md` | Reconexión WebSocket tras pérdida de red |

---

## Defectos identificados en el código

| Código | Severidad | Descripción | Archivo |
|---|---|---|---|
| DEF-SEC-01 | Crítica | Contraseñas almacenadas en texto plano | `routes/auth.js:108` |
| DEF-SEC-02 | Alta | Sin validación de política de contraseñas | `routes/auth.js:45` |
| DEF-SEC-03 | Alta | Sin sanitización XSS en campos de entrada | `routes/auth.js`, `routes/profile.js` |
| DEF-SEC-04 | Crítica | WebSocket acepta conexiones sin autenticación | `realtime/websocket.js:725` |
| DEF-SEC-05 | Media | Header `X-Powered-By: Express` expuesto | `app.js` |
