"use client";
import { useEffect, useState, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface Obstacle {
  id: string;
  type: 'bicycle' | 'scooter' | 'car' | 'rollingStone' | 'tree' | 'wall';
  pos: Position;
  direction: Position;
  speed: number;
  isMoving: boolean;
  emoji: string;
  color: string;
}

interface GameState {
  strollerPos: Position;
  goalPos: Position;
  obstacles: Obstacle[];
  gameWon: boolean;
  gameStarted: boolean;
  gameOver: boolean;
  score: number;
  gameTime: number;
  strollerMoving: boolean;
}

const GAME_SIZE = 20;
const CELL_SIZE = 25;
const GAME_SPEED = 100; // ms between moves

export default function StrollerGame() {
  const [gameState, setGameState] = useState<GameState>({
    strollerPos: { x: 1, y: GAME_SIZE - 2 },
    goalPos: { x: GAME_SIZE - 2, y: 1 },
    obstacles: [],
    gameWon: false,
    gameStarted: false,
    gameOver: false,
    score: 0,
    gameTime: 0,
    strollerMoving: false
  });

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const strollerMoveRef = useRef<NodeJS.Timeout | null>(null);

  // Generate realistic obstacles for parents
  const generateObstacles = useCallback(() => {
    const obstacles: Obstacle[] = [];
    
    // Moving obstacles (dangerous for children)
    const movingObstacles = [
      { type: 'bicycle' as const, count: 3, emoji: '🚲', color: 'bg-blue-500' },
      { type: 'scooter' as const, count: 2, emoji: '🛴', color: 'bg-orange-500' },
      { type: 'car' as const, count: 2, emoji: '🚗', color: 'bg-red-500' },
      { type: 'rollingStone' as const, count: 2, emoji: '🪨', color: 'bg-gray-500' }
    ];

    // Static obstacles (safe but blocking)
    const staticObstacles = [
      { type: 'tree' as const, count: 4, emoji: '🌳', color: 'bg-green-600' },
      { type: 'wall' as const, count: 3, emoji: '🧱', color: 'bg-gray-700' }
    ];

    // Add moving obstacles
    movingObstacles.forEach(({ type, count, emoji, color }) => {
      for (let i = 0; i < count; i++) {
        let pos: Position;
        let direction: Position;
        
        do {
          pos = {
            x: Math.floor(Math.random() * (GAME_SIZE - 2)) + 1,
            y: Math.floor(Math.random() * (GAME_SIZE - 2)) + 1
          };
          direction = {
            x: Math.random() > 0.5 ? 1 : -1,
            y: Math.random() > 0.5 ? 1 : -1
          };
        } while (
          (pos.x === gameState.strollerPos.x && pos.y === gameState.strollerPos.y) ||
          (pos.x === gameState.goalPos.x && pos.y === gameState.goalPos.y) ||
          obstacles.some(obs => obs.pos.x === pos.x && obs.pos.y === pos.y)
        );

        obstacles.push({
          id: `${type}-${i}`,
          type,
          pos,
          direction,
          speed: Math.random() * 2 + 1,
          isMoving: true,
          emoji,
          color
        });
      }
    });

    // Add static obstacles
    staticObstacles.forEach(({ type, count, emoji, color }) => {
      for (let i = 0; i < count; i++) {
        let pos: Position;
        
        do {
          pos = {
            x: Math.floor(Math.random() * (GAME_SIZE - 2)) + 1,
            y: Math.floor(Math.random() * (GAME_SIZE - 2)) + 1
          };
        } while (
          (pos.x === gameState.strollerPos.x && pos.y === gameState.strollerPos.y) ||
          (pos.x === gameState.goalPos.x && pos.y === gameState.goalPos.y) ||
          obstacles.some(obs => obs.pos.x === pos.x && obs.pos.y === pos.y)
        );

        obstacles.push({
          id: `${type}-${i}`,
          type,
          pos,
          direction: { x: 0, y: 0 },
          speed: 0,
          isMoving: false,
          emoji,
          color
        });
      }
    });
    
    return obstacles;
  }, [gameState.strollerPos, gameState.goalPos]);

  // Move obstacles automatically
  const moveObstacles = useCallback(() => {
    setGameState(prev => {
      const newObstacles = prev.obstacles.map(obstacle => {
        if (!obstacle.isMoving) return obstacle;

        const newPos = {
          x: obstacle.pos.x + obstacle.direction.x,
          y: obstacle.pos.y + obstacle.direction.y
        };

        // Bounce off walls
        if (newPos.x <= 0 || newPos.x >= GAME_SIZE - 1) {
          obstacle.direction.x *= -1;
          newPos.x = obstacle.pos.x;
        }
        if (newPos.y <= 0 || newPos.y >= GAME_SIZE - 1) {
          obstacle.direction.y *= -1;
          newPos.y = obstacle.pos.y;
        }

        // Avoid other obstacles
        if (prev.obstacles.some(other => 
          other.id !== obstacle.id && 
          other.pos.x === newPos.x && 
          other.pos.y === newPos.y
        )) {
          return obstacle;
        }

        return {
          ...obstacle,
          pos: newPos
        };
      });

      return {
        ...prev,
        obstacles: newObstacles
      };
    });
  }, []);

  // Move stroller automatically when game starts
  const moveStrollerAutomatically = useCallback(() => {
    if (!gameState.gameStarted || gameState.gameWon || gameState.gameOver) return;

    setGameState(prev => {
      // Move stroller towards goal with some randomness
      const dx = prev.goalPos.x - prev.strollerPos.x;
      const dy = prev.goalPos.y - prev.strollerPos.y;
      
      let newX = prev.strollerPos.x;
      let newY = prev.strollerPos.y;

      // Add some randomness to make it challenging
      if (Math.abs(dx) > Math.abs(dy)) {
        newX += dx > 0 ? 1 : -1;
        if (Math.random() > 0.7) newY += dy > 0 ? 1 : -1;
      } else {
        newY += dy > 0 ? 1 : -1;
        if (Math.random() > 0.7) newX += dx > 0 ? 1 : -1;
      }

      // Keep within bounds
      newX = Math.max(0, Math.min(GAME_SIZE - 1, newX));
      newY = Math.max(0, Math.min(GAME_SIZE - 1, newY));

      return {
        ...prev,
        strollerPos: { x: newX, y: newY }
      };
    });
  }, [gameState.gameStarted, gameState.gameWon, gameState.gameOver]);

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
      gameTime: 0,
      gameStarted: true,
      strollerMoving: true
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
      gameTime: 0,
      gameStarted: false,
      strollerMoving: false
    }));
  }, []);

  // Handle keyboard input to control stroller
  const handleStrollerControl = useCallback((dx: number, dy: number) => {
    if (!gameState.gameStarted || gameState.gameWon || gameState.gameOver) return;

    setGameState(prev => {
      const newPos = {
        x: prev.strollerPos.x + dx,
        y: prev.strollerPos.y + dy
      };

      // Check boundaries
      if (newPos.x < 0 || newPos.x >= GAME_SIZE || newPos.y < 0 || newPos.y >= GAME_SIZE) {
        return prev;
      }

      // Check obstacles
      if (prev.obstacles.some(obs => obs.pos.x === newPos.x && obs.pos.y === newPos.y)) {
        return { ...prev, gameOver: true };
      }

      // Check if reached goal
      if (newPos.x === prev.goalPos.x && newPos.y === prev.goalPos.y) {
        return { 
          ...prev, 
          gameWon: true, 
          score: Math.max(prev.score, 100 - Math.floor(prev.gameTime / 1000))
        };
      }

      // Move stroller
      return {
        ...prev,
        strollerPos: newPos,
        score: prev.score + 1
      };
    });
  }, [gameState.gameStarted, gameState.gameWon, gameState.gameOver]);

  // Game loop
  useEffect(() => {
    if (gameState.gameStarted && !gameState.gameWon && !gameState.gameOver) {
      gameLoopRef.current = setInterval(() => {
        moveObstacles();
        setGameState(prev => ({ ...prev, gameTime: prev.gameTime + GAME_SPEED }));
      }, GAME_SPEED);

      strollerMoveRef.current = setInterval(() => {
        moveStrollerAutomatically();
      }, GAME_SPEED * 2);
    }

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (strollerMoveRef.current) clearInterval(strollerMoveRef.current);
    };
  }, [gameState.gameStarted, gameState.gameWon, gameState.gameOver, moveObstacles, moveStrollerAutomatically]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameState.gameStarted || gameState.gameWon || gameState.gameOver) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleStrollerControl(0, -1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleStrollerControl(0, 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleStrollerControl(-1, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleStrollerControl(1, 0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleStrollerControl, gameState.gameStarted, gameState.gameWon, gameState.gameOver]);

  // Check collision with moving obstacles
  useEffect(() => {
    if (!gameState.gameStarted || gameState.gameWon || gameState.gameOver) return;

    const collision = gameState.obstacles.some(obs => 
      obs.pos.x === gameState.strollerPos.x && 
      obs.pos.y === gameState.strollerPos.y
    );

    if (collision) {
      setGameState(prev => ({ ...prev, gameOver: true }));
    }
  }, [gameState.strollerPos, gameState.obstacles, gameState.gameStarted, gameState.gameWon, gameState.gameOver]);

  // Render game cell
  const renderCell = (x: number, y: number) => {
    const isStroller = x === gameState.strollerPos.x && y === gameState.strollerPos.y;
    const isGoal = x === gameState.goalPos.x && y === gameState.goalPos.y;
    const obstacle = gameState.obstacles.find(obs => obs.pos.x === x && obs.pos.y === y);

    let cellContent = '';
    let cellClass = 'border border-slate-300';

    if (isStroller) {
      cellContent = '🛒'; // Stroller emoji
      cellClass = 'bg-blue-500 text-white border-blue-600 animate-pulse';
    } else if (isGoal) {
      cellContent = '🏠'; // Home emoji for goal
      cellClass = 'bg-green-500 text-white border-green-600 animate-bounce';
    } else if (obstacle) {
      cellContent = obstacle.emoji;
      cellClass = `${obstacle.color} text-white border-slate-600 ${obstacle.isMoving ? 'animate-pulse' : ''}`;
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
          🛒 Kinderwagen-Spiel
        </h2>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
          Der Kinderwagen bewegt sich automatisch! Führe ihn mit den Pfeiltasten sicher durch den Verkehr zum Zuhause! 
          Vermeide bewegende Hindernisse wie Fahrräder, Scooter und Autos.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 mb-2">🎯 Spielregeln:</h3>
          <ul className="text-sm text-blue-700 text-left space-y-1">
            <li>• 🛒 Kinderwagen bewegt sich automatisch</li>
            <li>• ⬆️⬇️⬅️➡️ Pfeiltasten zum Steuern</li>
            <li>• 🚲🛴🚗 Bewegende Hindernisse (gefährlich!)</li>
            <li>• 🌳🧱 Statische Hindernisse (blockieren)</li>
            <li>• 🏠 Ziel: Sicher nach Hause kommen</li>
          </ul>
        </div>
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
          🛒 Kinderwagen-Spiel
        </h2>
        <div className="flex items-center justify-center gap-6 text-lg">
          <span className="text-slate-600">Punkte: <span className="font-bold text-indigo-600">{gameState.score}</span></span>
          <span className="text-slate-600">Zeit: <span className="font-bold text-orange-600">{Math.floor(gameState.gameTime / 1000)}s</span></span>
          <span className="text-slate-600">Ziel: <span className="font-bold text-green-600">🏠</span></span>
        </div>
      </div>

      {/* Game Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800 text-center font-medium">
          🎯 Der Kinderwagen (🛒) bewegt sich automatisch! Steuere ihn mit den Pfeiltasten sicher zum Zuhause (🏠)!
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
          <p className="text-slate-600 mb-4">Du hast den Kinderwagen erfolgreich sicher nach Hause geführt!</p>
          <p className="text-lg font-semibold text-indigo-600 mb-6">Punkte: {gameState.score} | Zeit: {Math.floor(gameState.gameTime / 1000)}s</p>
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
          <p className="text-slate-600 mb-4">Der Kinderwagen ist mit einem Hindernis kollidiert!</p>
          <p className="text-lg font-semibold text-indigo-600 mb-6">Punkte: {gameState.score} | Zeit: {Math.floor(gameState.gameTime / 1000)}s</p>
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
            <p className="text-xs text-slate-500 mt-2">Der Kinderwagen bewegt sich automatisch!</p>
          </div>
        </div>
      )}
    </div>
  );
}
