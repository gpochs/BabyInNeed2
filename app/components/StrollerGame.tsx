"use client";
import { useEffect, useState, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface Obstacle {
  id: string;
  type: 'house' | 'skyscraper' | 'tree' | 'trafficLight' | 'bikeRack' | 'wall' | 'hedge' | 'street';
  pos: Position;
  emoji: string;
  color: string;
  isStreet: boolean;
}

interface Vehicle {
  id: string;
  type: 'car' | 'motorcycle' | 'scooter' | 'bicycle';
  pos: Position;
  direction: Position;
  speed: number; // fields per second
  emoji: string;
  color: string;
  currentPath: Position[];
  pathIndex: number;
}

interface GameState {
  strollerPos: Position;
  goalPos: Position;
  obstacles: Obstacle[];
  vehicles: Vehicle[];
  gameWon: boolean;
  gameStarted: boolean;
  gameOver: boolean;
  score: number;
  gameTime: number;
}

const GAME_SIZE = 30;
const CELL_SIZE = 20; // Smaller cells for 30x30 grid
const GAME_SPEED = 50; // ms between updates

export default function StrollerGame() {
  const [gameState, setGameState] = useState<GameState>({
    strollerPos: { x: 1, y: GAME_SIZE - 2 },
    goalPos: { x: GAME_SIZE - 2, y: 1 },
    obstacles: [],
    vehicles: [],
    gameWon: false,
    gameStarted: false,
    gameOver: false,
    score: 0,
    gameTime: 0
  });

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  // Generate city layout with streets and obstacles
  const generateCityLayout = useCallback(() => {
    const obstacles: Obstacle[] = [];
    const vehicles: Vehicle[] = [];
    
    // Create street network (main streets)
    const horizontalStreets = [
      { y: 5, startX: 0, endX: GAME_SIZE - 1 },
      { y: 15, startX: 0, endX: GAME_SIZE - 1 },
      { y: 25, startX: 0, endX: GAME_SIZE - 1 }
    ];
    
    const verticalStreets = [
      { x: 5, startY: 0, endY: GAME_SIZE - 1 },
      { x: 15, startY: 0, endY: GAME_SIZE - 1 },
      { x: 25, startY: 0, endY: GAME_SIZE - 1 }
    ];

    // Add horizontal streets
    horizontalStreets.forEach(street => {
      for (let x = street.startX; x <= street.endX; x++) {
        obstacles.push({
          id: `street-h-${x}-${street.y}`,
          type: 'street',
          pos: { x, y: street.y },
          emoji: '⬜',
          color: 'bg-gray-300',
          isStreet: true
        });
      }
    });

    // Add vertical streets
    verticalStreets.forEach(street => {
      for (let y = street.startY; y <= street.endY; y++) {
        obstacles.push({
          id: `street-v-${street.x}-${y}`,
          type: 'street',
          pos: { x: street.x, y },
          emoji: '⬜',
          color: 'bg-gray-300',
          isStreet: true
        });
      }
    });

    // Add buildings and obstacles (avoiding streets)
    const buildingTypes = [
      { type: 'house' as const, count: 8, emoji: '🏠', color: 'bg-red-600' },
      { type: 'skyscraper' as const, count: 6, emoji: '🏢', color: 'bg-blue-600' },
      { type: 'tree' as const, count: 12, emoji: '🌳', color: 'bg-green-600' },
      { type: 'trafficLight' as const, count: 4, emoji: '🚦', color: 'bg-yellow-500' },
      { type: 'bikeRack' as const, count: 3, emoji: '🚲', color: 'bg-gray-500' },
      { type: 'wall' as const, count: 5, emoji: '🧱', color: 'bg-gray-700' },
      { type: 'hedge' as const, count: 7, emoji: '🌿', color: 'bg-green-500' }
    ];

    buildingTypes.forEach(({ type, count, emoji, color }) => {
      for (let i = 0; i < count; i++) {
        let pos: Position;
        let attempts = 0;
        
        do {
          pos = {
            x: Math.floor(Math.random() * GAME_SIZE),
            y: Math.floor(Math.random() * GAME_SIZE)
          };
          attempts++;
        } while (
          attempts < 100 && (
            (pos.x === gameState.strollerPos.x && pos.y === gameState.strollerPos.y) ||
            (pos.x === gameState.goalPos.x && pos.y === gameState.goalPos.y) ||
            obstacles.some(obs => obs.pos.x === pos.x && obs.pos.y === pos.y) ||
            // Don't place buildings on streets
            obstacles.some(obs => obs.isStreet && obs.pos.x === pos.x && obs.pos.y === pos.y)
          )
        );

        if (attempts < 100) {
          obstacles.push({
            id: `${type}-${i}`,
            type,
            pos,
            emoji,
            color,
            isStreet: false
          });
        }
      }
    });

    // Add vehicles that move on streets
    const vehicleTypes = [
      { type: 'car' as const, count: 2, speed: 4, emoji: '🚗', color: 'bg-red-500' },
      { type: 'motorcycle' as const, count: 2, speed: 3, emoji: '🏍️', color: 'bg-orange-500' },
      { type: 'scooter' as const, count: 2, speed: 2, emoji: '🛴', color: 'bg-blue-500' },
      { type: 'bicycle' as const, count: 2, speed: 2, emoji: '🚲', color: 'bg-green-500' }
    ];

    vehicleTypes.forEach(({ type, count, speed, emoji, color }) => {
      for (let i = 0; i < count; i++) {
        // Find a street position
        const streetPositions = obstacles.filter(obs => obs.isStreet);
        if (streetPositions.length === 0) continue;

        const randomStreet = streetPositions[Math.floor(Math.random() * streetPositions.length)];
        const pos = { ...randomStreet.pos };

        // Create path along streets
        const path = createVehiclePath(pos, obstacles);
        
        vehicles.push({
          id: `${type}-${i}`,
          type,
          pos,
          direction: { x: 0, y: 0 },
          speed,
          emoji,
          color,
          currentPath: path,
          pathIndex: 0
        });
      }
    });
    
    return { obstacles, vehicles };
  }, [gameState.strollerPos, gameState.goalPos]);

  // Create path for vehicles to follow along streets
  const createVehiclePath = useCallback((startPos: Position, obstacles: Obstacle[]): Position[] => {
    const path: Position[] = [startPos];
    const streets = obstacles.filter(obs => obs.isStreet);
    
    // Simple path: move along streets in a pattern
    let currentPos = { ...startPos };
    let direction = { x: 1, y: 0 }; // Start moving right
    
    for (let i = 0; i < 20; i++) {
      const nextPos = {
        x: currentPos.x + direction.x,
        y: currentPos.y + direction.y
      };
      
      // Check if next position is a street
      const isStreet = streets.some(street => 
        street.pos.x === nextPos.x && street.pos.y === nextPos.y
      );
      
      if (isStreet && nextPos.x >= 0 && nextPos.x < GAME_SIZE && nextPos.y >= 0 && nextPos.y < GAME_SIZE) {
        path.push(nextPos);
        currentPos = nextPos;
      } else {
        // Change direction
        if (direction.x !== 0) {
          direction = { x: 0, y: 1 };
        } else {
          direction = { x: 1, y: 0 };
        }
      }
    }
    
    return path;
  }, []);

  // Move vehicles along their paths
  const moveVehicles = useCallback(() => {
    setGameState(prev => {
      const newVehicles = prev.vehicles.map(vehicle => {
        if (vehicle.currentPath.length <= 1) return vehicle;
        
        // Move vehicle along path based on speed
        const moveInterval = 1000 / vehicle.speed; // ms between moves
        const shouldMove = (prev.gameTime % moveInterval) < GAME_SPEED;
        
        if (!shouldMove) return vehicle;
        
        let newPathIndex = vehicle.pathIndex + 1;
        if (newPathIndex >= vehicle.currentPath.length) {
          newPathIndex = 0; // Loop back to start
        }
        
        const newPos = vehicle.currentPath[newPathIndex];
        
        return {
          ...vehicle,
          pos: newPos,
          pathIndex: newPathIndex
        };
      });

      return {
        ...prev,
        vehicles: newVehicles
      };
    });
  }, []);

  // Initialize game
  const startGame = useCallback(() => {
    const { obstacles, vehicles } = generateCityLayout();
    setGameState(prev => ({
      ...prev,
      strollerPos: { x: 1, y: GAME_SIZE - 2 },
      obstacles,
      vehicles,
      gameWon: false,
      gameOver: false,
      score: 0,
      gameTime: 0,
      gameStarted: true
    }));
  }, [generateCityLayout]);

  // Reset game
  const resetGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      strollerPos: { x: 1, y: GAME_SIZE - 2 },
      obstacles: [],
      vehicles: [],
      gameWon: false,
      gameOver: false,
      score: 0,
      gameTime: 0,
      gameStarted: false
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

      // Check if new position is blocked by obstacle
      const isBlocked = prev.obstacles.some(obs => 
        !obs.isStreet && obs.pos.x === newPos.x && obs.pos.y === newPos.y
      );

      if (isBlocked) {
        return prev;
      }

      // Check collision with vehicles
      const vehicleCollision = prev.vehicles.some(vehicle => 
        vehicle.pos.x === newPos.x && vehicle.pos.y === newPos.y
      );

      if (vehicleCollision) {
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
        moveVehicles();
        setGameState(prev => ({ ...prev, gameTime: prev.gameTime + GAME_SPEED }));
      }, GAME_SPEED);
    }

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState.gameStarted, gameState.gameWon, gameState.gameOver, moveVehicles]);

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

  // Render game cell
  const renderCell = (x: number, y: number) => {
    const isStroller = x === gameState.strollerPos.x && y === gameState.strollerPos.y;
    const isGoal = x === gameState.goalPos.x && y === gameState.goalPos.y;
    const obstacle = gameState.obstacles.find(obs => obs.pos.x === x && obs.pos.y === y);
    const vehicle = gameState.vehicles.find(v => v.pos.x === x && v.pos.y === y);

    let cellContent = '';
    let cellClass = 'border border-slate-300';

    if (isStroller) {
      cellContent = '🛒👶'; // Stroller with baby
      cellClass = 'bg-blue-500 text-white border-blue-600 animate-pulse text-xs';
    } else if (isGoal) {
      cellContent = '🏠'; // House as goal
      cellClass = 'bg-green-500 text-white border-green-600 animate-bounce text-xs';
    } else if (vehicle) {
      cellContent = vehicle.emoji;
      cellClass = `${vehicle.color} text-white border-slate-600 animate-pulse text-xs`;
    } else if (obstacle) {
      cellContent = obstacle.emoji;
      cellClass = `${obstacle.color} text-white border-slate-600 text-xs`;
    }

    return (
      <div
        key={`${x}-${y}`}
        className={`${cellClass} flex items-center justify-center font-bold transition-all duration-200`}
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
          🏙️ Stadt-Labyrinth
        </h2>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
          Führe den Kinderwagen mit dem Baby sicher durch die Stadt zum Zuhause! 
          Bewege dich auf den Straßen und vermeide den Verkehr.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 mb-2">🎯 Spielregeln:</h3>
          <ul className="text-sm text-blue-700 text-left space-y-1">
            <li>• 🛒👶 Kinderwagen mit Baby steuern</li>
            <li>• ⬆️⬇️⬅️➡️ Pfeiltasten zum Bewegen</li>
            <li>• 🛣️ Bewege dich nur auf den Straßen</li>
            <li>• 🚗🏍️🛴🚲 Vermeide den Verkehr</li>
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
          🏙️ Stadt-Labyrinth
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
          🎯 Bewege den Kinderwagen (🛒👶) mit den Pfeiltasten sicher durch die Stadt zum Zuhause (🏠)!
        </p>
      </div>

      {/* Game Grid */}
      <div className="flex justify-center mb-6 overflow-auto">
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
          <p className="text-slate-600 mb-4">Der Kinderwagen ist mit einem Fahrzeug kollidiert!</p>
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
            <p className="text-xs text-slate-500 mt-2">Bewege dich auf den Straßen!</p>
          </div>
        </div>
      )}
    </div>
  );
}
