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
    
    it("TC-U-01 calculateWinner detecta victoria en fila superior - tablero 3x3", () => {
        const board = [
            ['X', 'X', 'X'],
            ['', '', ''],
            ['', '', '']
        ];
        expect(calculateWinner(board)).toBe('X');
    });

    it("TC-U-02 calculateWinner detecta victoria en columna izquierda — tablero 3x3", () => {
        const board = [
            ['O', '', ''],
            ['O', '', ''],
            ['O', '', '']
        ];
        expect(calculateWinner(board)).toBe('O');
    });

    it("TC-U-03 calculateWinner detecta victoria en diagonal principal — tablero 3x3", () => {
        const board = [
            ['X', '', ''],
            ['', 'X', ''],
            ['', '', 'X']
        ];
        expect(calculateWinner(board)).toBe('X');
    });

    it("TC-U-04 isBoardFull detecta empate en tablero 3x3 lleno", () => {
        const board = [
            ['X', 'O', 'X'],
            ['X', 'O', 'O'],
            ['O', 'X', 'X']
        ];
        expect(isBoardFull(board)).toBe(true);
    });

    it("TC-U-05 calculateWinner retorna null en tablero vacío", () => {
        const board = [
            ['', '', ''],
            ['', '', ''],
            ['', '', '']
        ];
        expect(calculateWinner(board)).toBeNull();
    });

    it("TC-U-06 isBoardFull retorna false en tablero con celdas libres", () => {
        const board = [
            ['X', 'O', ''],
            ['X', '', ''],
            ['', '', '']
        ];
        expect(isBoardFull(board)).toBe(false);
    });

    it("TC-U-07 calculateWinner detecta victoria en diagonal, tablero 3x3", () => {
        const board = [
            ['', '', 'O'],
            ['', 'O', ''],
            ['O', '', '']
        ];
        expect(calculateWinner(board)).toBe('O');
    });

    it("TC-U-08 getAIMove no selecciona celda ocupada", () => {
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

    it("TC-U-09 findBestMove bloquea jugada ganadora del oponente", () => {
        // En ai.ts, findBestMove es interno pero getAIMove('impossible') lo llama directamente.
        const board = [
            ['X', 'X', ''],
            ['', 'O', ''],
            ['', '', '']
        ];
        const move = getAIMove(board, 'impossible');
        expect(move).toEqual({ row: 0, col: 2 });
    });

    it("TC-U-10 calculateWinner detecta victoria", () => {
        const board = [
            ['X', 'X', 'X'],
            ['', '', ''],
            ['', '', '']
        ];
        expect(calculateWinner(board)).toEqual(calculateWinnerAI(board));
    });

    it("TC-U-11 getAIMove en dificultad hard, elige jugada ganadora disponible", () => {
        const board = [
            ['O', 'O', ''],
            ['X', 'X', ''],
            ['', '', '']
        ];
        const move = getAIMove(board, 'hard');
        expect(move).toEqual({ row: 0, col: 2 });
    });

    it("TC-U-12 winnerFromBoard detecta victoria en servidor", () => {
        const board = ['X', 'X', 'X', null, null, null, null, null, null];
        expect(winnerFromBoard(board)).toBe('X');
    });

    it("TC-U-13 winnerFromBoard retorna 'draw' cuando tablero está lleno sin ganador", () => {
        const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
        expect(winnerFromBoard(board)).toBe('draw');
    });

    it("TC-U-14 buildBoardFromMoves reconstruye tablero correctamente", () => {
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
