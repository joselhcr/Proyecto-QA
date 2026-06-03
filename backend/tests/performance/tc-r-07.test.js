/**
 * TC-R-07 — Tiempo de procesamiento de checkWinner (winnerFromBoard) en 1000 iteraciones
 * Objetivo: La función checkWinner ejecuta en promedio <= 100ms por llamada.
 * Herramienta: Jest + performance.now()
 *
 * NOTA: checkWinner no está exportada en websocket.js — se usa la misma lógica inline.
 * Recomendación: exportar la función para facilitar su testabilidad directa.
 */

// Réplica exacta de checkWinner en backend/realtime/websocket.js:92-111
function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every(Boolean)) return 'draw';
  return null;
}

const BOARDS = {
  vacio:         Array(9).fill(null),
  medio_lleno:   ['X', 'O', 'X', null, 'O', null, null, null, 'X'],
  lleno_empate:  ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'],
  ganador_fila:  ['X', 'X', 'X', 'O', 'O', null, null, null, null],
  ganador_diag:  ['O', null, 'X', null, 'O', null, 'X', null, 'O'],
};

const ITERATIONS = 1000;
const UMBRAL_MS  = 100;

describe('TC-R-07 — Rendimiento de checkWinner (winnerFromBoard) — 1000 iteraciones', () => {

  Object.entries(BOARDS).forEach(([nombre, board]) => {
    it(`[${nombre}] promedio y p95 <= ${UMBRAL_MS}ms en ${ITERATIONS} iteraciones`, () => {
      const tiempos = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const inicio = performance.now();
        checkWinner(board);
        tiempos.push(performance.now() - inicio);
      }

      tiempos.sort((a, b) => a - b);
      const promedio = tiempos.reduce((s, t) => s + t, 0) / ITERATIONS;
      const p95      = tiempos[Math.floor(ITERATIONS * 0.95)];
      const p99      = tiempos[Math.floor(ITERATIONS * 0.99)];
      const maximo   = tiempos[ITERATIONS - 1];

      console.log(`\n  [${nombre}]`);
      console.log(`  Promedio : ${promedio.toFixed(4)} ms`);
      console.log(`  P95      : ${p95.toFixed(4)} ms`);
      console.log(`  P99      : ${p99.toFixed(4)} ms`);
      console.log(`  Máximo   : ${maximo.toFixed(4)} ms`);

      expect(promedio).toBeLessThanOrEqual(UMBRAL_MS);
      expect(p95).toBeLessThanOrEqual(UMBRAL_MS);
    });
  });

  it('Función es determinista: mismo tablero produce el mismo resultado siempre', () => {
    const board = ['X', 'X', 'X', 'O', 'O', null, null, null, null];
    const resultados = new Set();

    for (let i = 0; i < ITERATIONS; i++) {
      resultados.add(checkWinner(board));
    }

    expect(resultados.size).toBe(1);
    expect(resultados.has('X')).toBe(true);
  });

  it('checkWinner retorna null en tablero vacío (no hay ganador)', () => {
    expect(checkWinner(Array(9).fill(null))).toBeNull();
  });

  it('checkWinner retorna "draw" en tablero lleno sin ganador', () => {
    expect(checkWinner(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'])).toBe('draw');
  });
});
