import * as fs from 'fs';
import * as path from 'path';
import { calculateWinner, isBoardFull } from '../frontend/src/utils/helpers';
import { getAIMove, calculateWinner as calculateWinnerAI } from '../frontend/src/utils/ai';

// Extract non-exported backend functions safely without triggering Mongoose or Express
const realtimeFilePath = path.join(__dirname, '../backend/routes/realtime.js');
const realtimeCode = fs.readFileSync(realtimeFilePath, 'utf-8');

const extractBackendFunctions = () => {
    const script = `
        const require = (mod) => {
            if (mod === 'express') return { Router: () => ({ post: () => {} }) };
            return {};
        };
        const module = { exports: {} };
        ${realtimeCode}
        return { buildBoardFromMoves, winnerFromBoard };
    `;
    return new Function(script)();
};

const { buildBoardFromMoves, winnerFromBoard } = extractBackendFunctions();

describe("Pruebas Unitarias Tic Tac Toe", () => {
    
    // Casos de pruebas unitarias:
    
    it("calculateWinner detecta victoria en fila superior - tablero 3x3", () => {
        const board = [
            ['X', 'X', 'X'],
            ['', '', ''],
            ['', '', '']
        ];
        expect(calculateWinner(board)).toBe('X');
    });

    it("calculateWinner detecta victoria en columna izquierda — tablero 3x3", () => {
        const board = [
            ['O', '', ''],
            ['O', '', ''],
            ['O', '', '']
        ];
        expect(calculateWinner(board)).toBe('O');
    });

    it("calculateWinner detecta victoria en diagonal principal — tablero 3x3", () => {
        const board = [
            ['X', '', ''],
            ['', 'X', ''],
            ['', '', 'X']
        ];
        expect(calculateWinner(board)).toBe('X');
    });

    it("isBoardFull detecta empate en tablero 3x3 lleno", () => {
        const board = [
            ['X', 'O', 'X'],
            ['X', 'O', 'O'],
            ['O', 'X', 'X']
        ];
        expect(isBoardFull(board)).toBe(true);
    });

    it("calculateWinner retorna null en tablero vacío", () => {
        const board = [
            ['', '', ''],
            ['', '', ''],
            ['', '', '']
        ];
        expect(calculateWinner(board)).toBeNull();
    });

    it("isBoardFull retorna false en tablero con celdas libres", () => {
        const board = [
            ['X', 'O', ''],
            ['X', '', ''],
            ['', '', '']
        ];
        expect(isBoardFull(board)).toBe(false);
    });

    it("calculateWinner detecta victoria en diagonal, tablero 3x3", () => {
        const board = [
            ['', '', 'O'],
            ['', 'O', ''],
            ['O', '', '']
        ];
        expect(calculateWinner(board)).toBe('O');
    });

    it("getAIMove no selecciona celda ocupada", () => {
        const board = [
            ['X', 'O', 'X'],
            ['O', '', 'X'],
            ['X', 'O', '']
        ];
        const move = getAIMove(board, 'easy');
        const validMoves = [
            { row: 1, col: 1 },
            { row: 2, col: 2 }
        ];
        expect(validMoves).toContainEqual(move);
    });

    it("findBestMove bloquea jugada ganadora del oponente", () => {
        // En ai.ts, findBestMove es interno pero getAIMove('impossible') lo llama directamente.
        const board = [
            ['X', 'X', ''],
            ['', 'O', ''],
            ['', '', '']
        ];
        const move = getAIMove(board, 'impossible');
        expect(move).toEqual({ row: 0, col: 2 });
    });

    it("calculateWinner detecta victoria", () => {
        const board = [
            ['X', 'X', 'X'],
            ['', '', ''],
            ['', '', '']
        ];
        expect(calculateWinner(board)).toEqual(calculateWinnerAI(board));
    });

    it("getAIMove en dificultad hard, elige jugada ganadora disponible", () => {
        const board = [
            ['O', 'O', ''],
            ['X', 'X', ''],
            ['', '', '']
        ];
        const move = getAIMove(board, 'hard');
        expect(move).toEqual({ row: 0, col: 2 });
    });

    it("winnerFromBoard detecta victoria en servidor", () => {
        const board = ['X', 'X', 'X', null, null, null, null, null, null];
        expect(winnerFromBoard(board)).toBe('X');
    });

    it("winnerFromBoard retorna 'draw' cuando tablero está lleno sin ganador", () => {
        const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
        expect(winnerFromBoard(board)).toBe('draw');
    });

    it("buildBoardFromMoves reconstruye tablero correctamente", () => {
        const match = {
            moves: [
                { player: 'X', index: 0 },
                { player: 'O', index: 4 },
                { player: 'X', index: 8 }
            ]
        };
        const expectedBoard = ['X', null, null, null, 'O', null, null, null, 'X'];
        expect(buildBoardFromMoves(match)).toEqual(expectedBoard);
    });

});
