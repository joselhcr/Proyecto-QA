# Caso de Prueba TC-R-08 — Reconexión de WebSocket tras Pérdida de Conexión

---

| Campo | Detalle |
|---|---|
| **Código** | TC-R-08 |
| **Hardware y software** | PC, 16GB RAM, Intel Core i5 · wscat (npm global) |
| **Sistema operativo** | Windows 11 |
| **Navegador** | Google Chrome |
| **Resolución** | 1920x1080 |
| **Comentarios** | HU-10 — Rendimiento / resiliencia de conexión WebSocket · Herramienta: wscat + cronómetro |
| **Nombre** | Reconexión de WebSocket tras pérdida de conexión |
| **Descripción** | Verificar que el cliente puede reconectarse al servidor WebSocket en ≤ 5000ms usando el mecanismo `{type:"reconnect"}` del protocolo, con el estado de la partida preservado. |
| **Encargado** | Andrés Gustavo Arias Ruiz |

---

## Precondiciones

1. Backend corriendo en `http://localhost:4000` (`npm start` en `/backend`).
2. MongoDB activo y accesible.
3. `wscat` instalado globalmente:
   ```
   npm install -g wscat
   ```
   Verificar: `wscat --version`.
4. **Dos ventanas de PowerShell abiertas** (Terminal 1 = Jugador A, Terminal 2 = Jugador B).
5. Cronómetro disponible (reloj del teléfono o `Measure-Command` en PowerShell).

---

## Pasos

### FASE 1 — Establecer partida activa

| # | Terminal | Acción |
|---|---|---|
| 1 | **Terminal 1** | Ejecutar: `wscat -c ws://localhost:4000/ws` |
| 2 | **Terminal 1** | El servidor responde: `{"type":"connected","clientId":"XXXX-..."}`. **Copiar el `clientId` completo**. |
| 3 | **Terminal 1** | Enviar: `{"type":"join","username":"jugador_A"}` |
| 4 | **Terminal 2** | Ejecutar: `wscat -c ws://localhost:4000/ws` |
| 5 | **Terminal 2** | Enviar: `{"type":"join","username":"jugador_B"}` |
| 6 | **Ambas terminales** | Deben recibir `{"type":"match","gameId":"YYY-...","symbol":"X"}` / `"symbol":"O"`. **Copiar el `gameId`**. |
| 7 | **Terminal 1** | Enviar una jugada para confirmar que la partida está activa: `{"type":"move","index":0}` |

### FASE 2 — Simular pérdida de red y reconexión

| # | Terminal | Acción |
|---|---|---|
| 8 | **Terminal 1** | Cerrar la conexión con `Ctrl+C`. Esto simula la desconexión. |
| 9 | — | **Iniciar cronómetro inmediatamente.** |
| 10 | — | Esperar exactamente **2 segundos**. |
| 11 | **Terminal 1** | Reconectar: `wscat -c ws://localhost:4000/ws` |
| 12 | **Terminal 1** | Enviar mensaje de reconexión (reemplazar XXXX con el clientId del paso 2, YYY con el gameId del paso 6): `{"type":"reconnect","clientId":"XXXX-...","username":"jugador_A","gameId":"YYY-..."}` |
| 13 | — | **Detener el cronómetro** cuando el servidor responda con el estado del juego. |

### FASE 3 — Verificar estado preservado

| # | Terminal | Verificación |
|---|---|---|
| 14 | **Terminal 1** | La respuesta del servidor debe incluir el estado del tablero (`board`) con la jugada del paso 7 en índice 0. |
| 15 | **Terminal 2** | Debe haber recibido automáticamente: `{"type":"state","message":"jugador_A reconnected","board":[...]}`. |
| 16 | — | Registrar el tiempo de reconexión total y si el estado está preservado. |

---

## Resultados Esperados

| Resultado | Descripción |
|---|---|
| **Éxito** | Reconexión completada en ≤ 5000ms · La respuesta incluye `board` con la jugada anterior intacta (índice 0 = "X") · Terminal 2 notifica reconexión del jugador A. |
| **Fracaso** | El servidor devuelve `{"type":"error","message":"Session not found"}`, el tiempo supera 5000ms, o el estado del tablero se pierde. |

---

## Prioridad

**Media**

---

## Notas

- El servidor tiene un **grace period de 15 segundos** (`DISCONNECT_GRACE_MS = 15000` en `websocket.js:10`) antes de finalizar la partida por desconexión. La reconexión debe realizarse dentro de este tiempo.
- Si el servidor fue **reiniciado** entre la conexión y la reconexión, el `clientId` no existirá en memoria y el servidor retornará `{"type":"error","message":"Session not found"}`. Esto es comportamiento esperado y correcto.
- El `clientId` es un UUID generado por el servidor al conectar por primera vez.

---

## Registro de Ejecución

| Dato | Valor Observado |
|---|---|
| clientId (paso 2) | 0842ecaa-6153-40dd-a3f7-96d6c9b7b8a1 |
| gameId (paso 6) | aaecbb94-847f-402e-8da0-8a9349d31d86 |
| Tiempo de desconexión (inicio cronómetro, paso 9) | T+0ms |
| Tiempo de reconexión completada (paso 13) | T+7008ms |
| **Tiempo total de reconexión (ms)** | **7008ms** |
| Estado del tablero preservado (sí/no) | NO |
| Terminal 2 notificó reconexión (sí/no) | NO |

| Métrica | Valor | Umbral | Cumple |
|---|---|---|---|
| Tiempo de reconexión | 7008ms | ≤ 5000ms | NO  |
| Estado del tablero intacto | NO | Sí | NO  |
| Notificación al otro jugador | NO | Sí | NO  |

**Resultado final:**
- [ ] PASA — Reconexión en ≤ 5000ms con estado preservado
- [x] FALLA — Reconexión fallida o estado perdido
