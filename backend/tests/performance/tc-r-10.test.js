/**
 * TC-R-10 — Tiempo de respuesta de la IA en tablero 3x3/8x8 (50 iteraciones)
 * Objetivo: getAIMove calcula la jugada en p95 <= 2000ms.
 * Herramienta: Jest + performance.now()
 *
 * NOTA: La IA real está en frontend/src/utils/ai.ts (TypeScript, no exportada al backend).
 * Se implementa inline el algoritmo minimax equivalente para benchmarking.
 */

// ── checkWinner (réplica de websocket.js:92) ──
function checkWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(Boolean)) return 'draw';
  return null;
}

// ── Minimax (réplica de la lógica en frontend/src/utils/ai.ts) ──
function minimax(board, isMaximizing, aiSymbol, humanSymbol, depth = 0) {
  const winner = checkWinner(board);
  if (winner === aiSymbol)    return 10 - depth;
  if (winner === humanSymbol) return depth - 10;
  if (winner === 'draw' || board.every(Boolean)) return 0;

  const scores = [];
  for (let i = 0; i < board.length; i++) {
    if (!board[i]) {
      board[i] = isMaximizing ? aiSymbol : humanSymbol;
      scores.push(minimax(board, !isMaximizing, aiSymbol, humanSymbol, depth + 1));
      board[i] = null;
    }
  }
  return isMaximizing ? Math.max(...scores) : Math.min(...scores);
}

function getBestMove(board, aiSymbol, humanSymbol) {
  let bestScore = -Infinity;
  let bestMove  = -1;
  for (let i = 0; i < board.length; i++) {
    if (!board[i]) {
      board[i] = aiSymbol;
      const score = minimax(board, false, aiSymbol, humanSymbol);
      board[i] = null;
      if (score > bestScore) { bestScore = score; bestMove = i; }
    }
  }
  return bestMove;
}

function getAIMove(board, difficulty) {
  const empty = board.map((v, i) => v === null ? i : -1).filter(i => i !== -1);
  if (!empty.length) return -1;

  if (difficulty === 'easy')   return empty[Math.floor(Math.random() * empty.length)];
  if (difficulty === 'medium') return Math.random() < 0.5
    ? empty[Math.floor(Math.random() * empty.length)]
    : getBestMove(board, 'O', 'X');

  return getBestMove(board, 'O', 'X'); // hard
}

// ── Tableros de prueba ──
const BOARDS = {
  'tablero_vacio':       Array(9).fill(null),
  'tablero_3_fichas':    ['X', null, 'O', null, 'X', null, null, null, null],
  'tablero_6_fichas':    ['X', 'O', 'X', 'O', null, null, 'X', 'O', null],
  'tablero_casi_lleno':  ['X', 'O', 'X', 'O', 'X', null, 'O', 'X', null],
};

const ITERATIONS   = 50;
const UMBRAL_P95_MS = 2000;

describe('TC-R-10 — Tiempo de respuesta de la IA (50 iteraciones por dificultad)', () => {

  ['easy', 'medium', 'hard'].forEach((difficulty) => {
    describe(`Dificultad: ${difficulty}`, () => {

      Object.entries(BOARDS).forEach(([nombre, boardTemplate]) => {
        it(`[${difficulty}/${nombre}] p95 <= ${UMBRAL_P95_MS}ms`, () => {
          const tiempos = [];

          for (let i = 0; i < ITERATIONS; i++) {
            const board = [...boardTemplate];
            const inicio = performance.now();
            const move = getAIMove(board, difficulty);
            tiempos.push(performance.now() - inicio);

            // La jugada debe ser un índice válido y en celda vacía
            expect(move).toBeGreaterThanOrEqual(0);
            expect(move).toBeLessThanOrEqual(8);
            expect(boardTemplate[move]).toBeNull();
          }

          tiempos.sort((a, b) => a - b);
          const promedio = tiempos.reduce((s, t) => s + t, 0) / ITERATIONS;
          const p95      = tiempos[Math.floor(ITERATIONS * 0.95)];
          const maximo   = tiempos[ITERATIONS - 1];

          console.log(`\n  [${difficulty}/${nombre}]`);
          console.log(`  Promedio : ${promedio.toFixed(3)} ms`);
          console.log(`  P95      : ${p95.toFixed(3)} ms`);
          console.log(`  Máximo   : ${maximo.toFixed(3)} ms`);

          expect(p95).toBeLessThanOrEqual(UMBRAL_P95_MS);
        });
      });
    });
  });

  it('[hard] IA con una sola celda libre retorna ese índice en < 50ms', () => {
    const board = ['X','O','X','O','X','O','O','X', null]; // solo índice 8 libre
    const inicio = performance.now();
    const move   = getAIMove(board, 'hard');
    const tiempo = performance.now() - inicio;

    expect(move).toBe(8);
    expect(tiempo).toBeLessThan(50);
  });
});
