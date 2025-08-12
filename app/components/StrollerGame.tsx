"use client";
import { useEffect, useState, useCallback } from 'react';

interface Position {
  x: number;
  y: number;
}

interface GameState {
  strollerPos: Position;
  goalPos: Position;
  obstacles: Position[];
  gameWon: boolean;
  gameStarted: boolean;
  gameOver: boolean;
  score: number;
}

const GAME_SIZE = 20;
const CELL_SIZE = 25;

export default function StrollerGame() {
  const [gameState, setGameState] = useState<GameState>({
    strollerPos: { x: 1, y: GAME_SIZE - 2 },
    goalPos: { x: GAME_SIZE - 2, y: 1 },
    obstacles: [],
    gameWon: false,
    gameStarted: false,
    gameOver: false,
    score: 0
  });

  // Generate random obstacles
  const generateObstacles = useCallback(() => {
    const obstacles: Position[] = [];
    const numObstacles = Math.floor(GAME_SIZE * GAME_SIZE * 0.15); // 15% of cells are obstacles
    
    for (let i = 0; i < numObstacles; i++) {
      let pos: Position;
      do {
        pos = {
          x: Math.floor(Math.random() * GAME_SIZE),
          y: Math.floor(Math.random() * GAME_SIZE)
        };
      } while (
        (pos.x === gameState.strollerPos.x && pos.y === gameState.strollerPos.y) ||
        (pos.x === gameState.goalPos.x && pos.y === gameState.goalPos.y) ||
        obstacles.some(obs => obs.x === pos.x && obs.y === pos.y)
      );
      obstacles.push(pos);
    }
    
    return obstacles;
  }, [gameState.strollerPos, gameState.goalPos]);

  // Initialize game
  const startGame = useCallback(() => {
    const obstacles = generateObstacles();
    setGameState(prev => ({
      ...prev,
      strollerPos: { x: 1, y: GAME_SIZE - 2 },
      obstacles,
      gameWon: false,
      gameOver: false,
      score: 0,
      gameStarted: true
    }));
  }, [generateObstacles]);

  // Reset game
  const resetGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      strollerPos: { x: 1, y: GAME_SIZE - 2 },
      obstacles: [],
      gameWon: false,
      gameOver: false,
      score: 0,
      gameStarted: false
    }));
  }, []);

  // Move stroller
  const moveStroller = useCallback((dx: number, dy: number) => {
    if (gameState.gameWon || gameState.gameOver) return;

    const newPos = {
      x: gameState.strollerPos.x + dx,
      y: gameState.strollerPos.y + dy
    };

    // Check boundaries
    if (newPos.x < 0 || newPos.x >= GAME_SIZE || newPos.y < 0 || newPos.y >= GAME_SIZE) {
      return;
    }

    // Check obstacles
    if (gameState.obstacles.some(obs => obs.x === newPos.x && obs.y === newPos.y)) {
      setGameState(prev => ({ ...prev, gameOver: true }));
      return;
    }

    // Check if reached goal
    if (newPos.x === gameState.goalPos.x && newPos.y === gameState.goalPos.y) {
      setGameState(prev => ({ 
        ...prev, 
        gameWon: true, 
        score: Math.max(prev.score, 100 - Math.floor((Date.now() - Date.now()) / 1000))
      }));
      return;
    }

    // Move stroller
    setGameState(prev => ({
      ...prev,
      strollerPos: newPos,
      score: prev.score + 1
    }));
  }, [gameState]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameState.gameStarted || gameState.gameWon || gameState.gameOver) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveStroller(0, -1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveStroller(0, 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          moveStroller(-1, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveStroller(1, 0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveStroller, gameState.gameStarted, gameState.gameWon, gameState.gameOver]);

  // Render game cell
  const renderCell = (x: number, y: number) => {
    const isStroller = x === gameState.strollerPos.x && y === gameState.strollerPos.y;
    const isGoal = x === gameState.goalPos.x && y === gameState.goalPos.y;
    const isObstacle = gameState.obstacles.some(obs => obs.x === x && obs.y === y);

    let cellContent = '';
    let cellClass = 'border border-slate-300';

    if (isStroller) {
      cellContent = '👶';
      cellClass = 'bg-blue-500 text-white border-blue-600';
    } else if (isGoal) {
      cellContent = '🎯';
      cellClass = 'bg-green-500 text-white border-green-600';
    } else if (isObstacle) {
      cellContent = '🪨';
      cellClass = 'bg-red-500 text-white border-red-600';
    }

    return (
      <div
        key={`${x}-${y}`}
        className={`${cellClass} flex items-center justify-center text-sm font-bold transition-all duration-200`}
        style={{ width: CELL_SIZE, height: CELL_SIZE }}
      >
        {cellContent}
      </div>
    );
  };

  if (!gameState.gameStarted) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200 text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-4 flex items-center justify-center gap-3">
          🎮 Kinderwagen-Spiel
        </h2>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
          Führe den Kinderwagen mit den Pfeiltasten durch das Labyrinth zum Ziel! 
          Vermeide die roten Hindernisse.
        </p>
        <button
          onClick={startGame}
          className="px-8 py-4 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
        >
          🚀 Spiel starten
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-slate-800 mb-2 flex items-center justify-center gap-3">
          🎮 Kinderwagen-Spiel
        </h2>
        <div className="flex items-center justify-center gap-6 text-lg">
          <span className="text-slate-600">Punkte: <span className="font-bold text-indigo-600">{gameState.score}</span></span>
          <span className="text-slate-600">Ziel: <span className="font-bold text-green-600">🎯</span></span>
        </div>
      </div>

      {/* Game Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800 text-center font-medium">
          🎯 Verwende die Pfeiltasten um den Kinderwagen (👶) zum Ziel (🎯) zu führen!
        </p>
      </div>

      {/* Game Grid */}
      <div className="flex justify-center mb-6">
        <div 
          className="grid gap-0 border-2 border-slate-400 rounded-lg overflow-hidden"
          style={{ 
            gridTemplateColumns: `repeat(${GAME_SIZE}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${GAME_SIZE}, ${CELL_SIZE}px)`
          }}
        >
          {Array.from({ length: GAME_SIZE }, (_, y) =>
            Array.from({ length: GAME_SIZE }, (_, x) => renderCell(x, y))
          )}
        </div>
      </div>

      {/* Game Status */}
      {gameState.gameWon && (
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-green-600 mb-2">Gewonnen!</h3>
          <p className="text-slate-600 mb-4">Du hast den Kinderwagen erfolgreich zum Ziel geführt!</p>
          <p className="text-lg font-semibold text-indigo-600 mb-6">Punkte: {gameState.score}</p>
          <button
            onClick={resetGame}
            className="px-6 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300"
          >
            🔄 Nochmal spielen
          </button>
        </div>
      )}

      {gameState.gameOver && (
        <div className="text-center">
          <div className="text-6xl mb-4">💥</div>
          <h3 className="text-2xl font-bold text-red-600 mb-2">Game Over!</h3>
          <p className="text-slate-600 mb-4">Du bist gegen ein Hindernis gefahren!</p>
          <p className="text-lg font-semibold text-indigo-600 mb-6">Punkte: {gameState.score}</p>
          <button
            onClick={resetGame}
            className="px-6 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300"
          >
            🔄 Nochmal versuchen
          </button>
        </div>
      )}

      {/* Game Controls */}
      {!gameState.gameWon && !gameState.gameOver && (
        <div className="text-center">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 inline-block">
            <p className="text-slate-600 font-medium mb-2">Steuerung:</p>
            <div className="flex items-center justify-center gap-2 text-2xl">
              <span>⬆️</span>
              <span>⬅️</span>
              <span>⬇️</span>
              <span>➡️</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
