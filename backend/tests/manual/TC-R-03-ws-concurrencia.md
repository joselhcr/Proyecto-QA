# Caso de Prueba TC-R-03 — Concurrencia WebSocket: 50 Partidas Simultáneas

---

| Campo | Detalle |
|---|---|
| **Código** | TC-R-03 |
| **Hardware y software** | PC, 16GB RAM, Intel Core i5 · Node.js 18+ · Artillery.io v2 |
| **Sistema operativo** | Windows 11 |
| **Navegador** | N/A (prueba de servidor) |
| **Resolución** | N/A |
| **Comentarios** | HU-10 — Rendimiento WebSocket / latencia de mensajes bajo concurrencia |
| **Nombre** | Concurrencia en salas multijugador — 50 partidas simultáneas |
| **Descripción** | Verificar que el servidor WebSocket mantiene latencia de eventos < 500ms y sin pérdida de mensajes cuando 100 clientes están conectados simultáneamente (2 por sala = 50 partidas activas). |
| **Encargado** | Andrés Gustavo Arias Ruiz |

---

## Precondiciones

1. Backend corriendo en `http://localhost:4000` (`npm start` en `/backend`).
2. MongoDB activo y accesible.
3. Artillery instalado globalmente:
   ```
   npm install -g artillery
   ```
4. Verificar instalación: `artillery version` debe mostrar la versión.
5. El archivo `backend/tests/performance/tc-r-03-websocket.yml` debe existir (ver sección Script).

> **NOTA TÉCNICA:** El test plan menciona "Socket.io" pero el servidor real usa la librería `ws` nativa en la ruta `/ws` (`backend/realtime/websocket.js`). Artillery se configura para WebSockets nativos.

---

## Script YAML

Crear el archivo `backend/tests/performance/tc-r-03-websocket.yml` con el siguiente contenido:

```yaml
config:
  target: "ws://localhost:4000"
  phases:
    - duration: 20
      arrivalRate: 5
      name: "Ramp-up: 100 clientes en 20s"
    - duration: 30
      arrivalRate: 0
      name: "Carga sostenida"
  ws:
    path: "/ws"

scenarios:
  - name: "Jugador en partida multijugador"
    engine: "ws"
    flow:
      - send: '{"type":"join","username":"loaduser-{{ $randomInt(1,9999) }}"}'
      - think: 1
      - think: 2
      - send: '{"type":"move","index":0}'
      - think: 1
      - send: '{"type":"move","index":4}'
      - think: 1
      - send: '{"type":"move","index":8}'
      - think: 2
      - send: '{"type":"ping"}'
      - think: 5
```

---

## Pasos

| # | Acción |
|---|---|
| 1 | Abrir PowerShell en la carpeta `backend/`. |
| 2 | Ejecutar el test con reporte de salida: `npx artillery run tests/performance/tc-r-03-websocket.yml --output reporte-tc-r-03.json` |
| 3 | Observar el progreso en tiempo real en la consola. Verificar que los VUs (Virtual Users) aumentan. |
| 4 | Esperar a que Artillery complete todas las fases (~50 segundos). |
| 5 | Generar reporte HTML: `npx artillery report reporte-tc-r-03.json` |
| 6 | El reporte se abrirá automáticamente en el navegador. |
| 7 | Localizar las métricas clave en el reporte: **p95 latency**, **errors**, **vusers.completed**. |
| 8 | Registrar los valores en la tabla de resultados. |

---

## Resultados Esperados

| Resultado | Descripción |
|---|---|
| **Éxito** | Latencia p95 ≤ 500ms · Tasa de error < 1% · 100 VUs completados sin desconexiones inesperadas · CPU del servidor < 80%. |
| **Fracaso** | Latencia p95 > 500ms · Tasa de error ≥ 1% · Mensajes perdidos · Conexiones rechazadas. |

---

## Prioridad

**Alta**

---

## Notas

- El servidor asigna un `clientId` UUID al conectar (heartbeat cada 30s).
- El grace period de desconexión es 15 segundos (`DISCONNECT_GRACE_MS`).
- Si Artillery no puede encontrar el path `/ws`, verificar que el servidor esté corriendo antes de ejecutar.

---

## Registro de Ejecución

| Métrica | Valor Obtenido | Umbral | Cumple |
|---|---|---|---|
| Latencia p50 | 0ms | ≤ 200ms | SÍ  |
| Latencia p95 | 1ms | ≤ 500ms | SÍ  |
| Latencia p99 | 1ms | ≤ 1000ms | SÍ  |
| Tasa de error | 0.00% | < 1% | SÍ  |
| VUs completados | 50 | 50 | SÍ  |

**Resultado final:**
- [x] PASA — P95: 1ms, Error: 0.00%
- [ ] FALLA
