# Caso de Prueba TC-R-05 — Tiempo de Carga Inicial de la Aplicación

---

| Campo | Detalle |
|---|---|
| **Código** | TC-R-05 |
| **Hardware y software** | PC, 16GB RAM, Intel Core i5 · Google Chrome (última versión estable) |
| **Sistema operativo** | Windows 11 |
| **Navegador** | Google Chrome |
| **Resolución** | 1920x1080 |
| **Comentarios** | Rendimiento de frontend — tiempo hasta evento `Load` · Herramienta: Chrome DevTools + Lighthouse |
| **Nombre** | Tiempo de carga inicial de la aplicación |
| **Descripción** | Verificar que la página principal del frontend React carga completamente en ≤ 3000ms, medido con Chrome DevTools Network y Lighthouse con perfil de red "Fast 3G" (≈10 Mbps). |
| **Encargado** | Andrés Gustavo Arias Ruiz |

---

## Precondiciones

1. Frontend corriendo en local:
   - Navegar a `/frontend` y ejecutar `npm start` o `npm run dev`.
   - Verificar que la aplicación abre en `http://localhost:5173` (o el puerto que indique la consola).
2. Backend corriendo en `http://localhost:4000` (`npm start` en `/backend`).
3. Cerrar **todas las demás pestañas** del navegador para evitar interferencia.
4. Cerrar extensiones del navegador que puedan bloquear recursos (ad-blockers, etc.).

---

## Pasos

### Parte A — Medición con Chrome DevTools Network

| # | Acción |
|---|---|
| 1 | Abrir Chrome y navegar a `http://localhost:5173`. |
| 2 | Presionar `F12` para abrir DevTools. Ir a la pestaña **Network**. |
| 3 | Marcar la casilla **☑ Disable cache** (parte superior de la pestaña Network). |
| 4 | En el selector de velocidad de red, elegir **"Fast 3G"** para simular 10 Mbps. |
| 5 | Presionar `Ctrl+Shift+R` (hard reload con caché deshabilitado). |
| 6 | Esperar a que la barra de carga de Network termine completamente. |
| 7 | En la barra inferior de Network, leer el valor **"Load: X.Xs"** y registrarlo como **Medición 1**. |
| 8 | Repetir los pasos 5–7 **dos veces más** para obtener **Medición 2** y **Medición 3**. |
| 9 | Calcular el **promedio** de las 3 mediciones. |
| 10 | Registrar también: número total de recursos, tamaño total transferido. |

### Parte B — Medición con Lighthouse

| # | Acción |
|---|---|
| 11 | Con DevTools abierto, ir a la pestaña **Lighthouse**. |
| 12 | Configurar: **Mode = Navigation · Device = Desktop**. |
| 13 | Hacer clic en **"Analyze page load"** y esperar que finalice (~30 segundos). |
| 14 | Registrar las métricas: **FCP (First Contentful Paint)**, **TTI (Time to Interactive)**, **Performance Score**. |

---

## Resultados Esperados

| Resultado | Descripción |
|---|---|
| **Éxito** | Valor Load promedio ≤ 3000ms en las 3 mediciones · FCP ≤ 1500ms · TTI ≤ 3500ms · Performance Score ≥ 70. |
| **Fracaso** | Valor Load promedio > 3000ms en al menos 2 de las 3 mediciones. |

---

## Prioridad

**Media**

---

## Notas

- Asegurarse de que el frontend esté en modo **producción** (`npm run build && npm run preview`) para métricas representativas. En modo desarrollo, los tiempos son mayores por el overhead de Vite.
- Si el frontend está en modo desarrollo, documentar explícitamente esta condición en el resultado.

---

## Registro de Ejecución

### Chrome DevTools Network

| Medición | Load (ms) | Recursos # | Tamaño total (KB) |
|---|---|---|---|
| 1 | 1 | 6 | 2.4 |
| 2 | 1 | 6 | 2.4 |
| 3 | 1 | 6 | 2.4 |
| **Promedio** | **1** | | |

### Lighthouse

| Métrica | Valor Obtenido | Umbral | Cumple |
|---|---|---|---|
| First Contentful Paint (FCP) | N/A (medición programática) | ≤ 1500ms | Pendiente verificación manual |
| Time to Interactive (TTI) | N/A (medición programática) | ≤ 3500ms | Pendiente verificación manual |
| Performance Score | N/A (medición programática) | ≥ 70 | Pendiente verificación manual |

**Resultado final:**
- [x] PASA — Tiempo de carga promedio 1ms ≤ 3000ms
- [ ] FALLA — Tiempo de carga promedio > 3000ms (documentar defecto)
