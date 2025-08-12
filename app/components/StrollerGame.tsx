"use client";
import { useEffect, useState, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface Obstacle {
  id: string;
  type: 'house' | 'skyscraper' | 'tree' | 'trafficLight' | 'bikeRack' | 'wall' | 'hedge' | 'street' | 'school' | 'hospital' | 'mall' | 'forest';
  pos: Position;
  size: { width: number; height: number }; // New: support for larger obstacles
  emoji: string;
  color: string;
  isStreet: boolean;
  isGoal?: boolean; // New: mark goal house
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
    strollerPos: { x: GAME_SIZE - 3, y: GAME_SIZE - 3 }, // Start far from goal
    goalPos: { x: 1, y: 1 }, // Goal in top-left corner
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
    
    // Create expanded street network (more streets for better connectivity)
    const horizontalStreets = [
      { y: 3, startX: 0, endX: GAME_SIZE - 1 },
      { y: 8, startX: 0, endX: GAME_SIZE - 1 },
      { y: 13, startX: 0, endX: GAME_SIZE - 1 },
      { y: 18, startX: 0, endX: GAME_SIZE - 1 },
      { y: 23, startX: 0, endX: GAME_SIZE - 1 },
      { y: 28, startX: 0, endX: GAME_SIZE - 1 }
    ];
    
    const verticalStreets = [
      { x: 3, startY: 0, endY: GAME_SIZE - 1 },
      { x: 8, startY: 0, endY: GAME_SIZE - 1 },
      { x: 13, startY: 0, endY: GAME_SIZE - 1 },
      { x: 18, startY: 0, endY: GAME_SIZE - 1 },
      { x: 23, startY: 0, endY: GAME_SIZE - 1 },
      { x: 28, startY: 0, endY: GAME_SIZE - 1 }
    ];

    // Add horizontal streets
    horizontalStreets.forEach(street => {
      for (let x = street.startX; x <= street.endX; x++) {
        obstacles.push({
          id: `street-h-${x}-${street.y}`,
          type: 'street',
          pos: { x, y: street.y },
          size: { width: 1, height: 1 },
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
          size: { width: 1, height: 1 },
          emoji: '⬜',
          color: 'bg-gray-300',
          isStreet: true
        });
      }
    });

    // Add GOAL HOUSE (2x2) in top-left corner
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        obstacles.push({
          id: `goal-${x}-${y}`,
          type: 'house',
          pos: { x, y },
          size: { width: 2, height: 2 },
          emoji: x === 0 && y === 0 ? '🏠' : '', // Only show emoji on first cell
          color: 'bg-green-500',
          isStreet: false,
          isGoal: true
        });
      }
    }

    // Add buildings and obstacles (avoiding streets and goal area)
    const buildingTypes = [
      { type: 'house' as const, count: 16, emoji: '🏠', color: 'bg-red-600' }, // Doubled
      { type: 'skyscraper' as const, count: 12, emoji: '🏢', color: 'bg-blue-600' }, // Doubled
      { type: 'tree' as const, count: 24, emoji: '🌳', color: 'bg-green-600' }, // Doubled
      { type: 'trafficLight' as const, count: 8, emoji: '🚦', color: 'bg-yellow-500' }, // Doubled
      { type: 'bikeRack' as const, count: 6, emoji: '🚲', color: 'bg-gray-500' }, // Doubled
      { type: 'wall' as const, count: 10, emoji: '🧱', color: 'bg-gray-700' }, // Doubled
      { type: 'hedge' as const, count: 14, emoji: '🌿', color: 'bg-green-500' }, // Doubled
      { type: 'school' as const, count: 1, emoji: '🏫', color: 'bg-purple-600' }, // New
      { type: 'hospital' as const, count: 1, emoji: '🏥', color: 'bg-red-500' }, // New
      { type: 'mall' as const, count: 1, emoji: '🏬', color: 'bg-pink-500' }, // New
    ];

    buildingTypes.forEach(({ type, count, emoji, color }) => {
      for (let i = 0; i < count; i++) {
        let pos: Position;
        let attempts = 0;
        
        do {
          pos = {
            x: Math.floor(Math.random() * (GAME_SIZE - 1)),
            y: Math.floor(Math.random() * (GAME_SIZE - 1))
          };
          attempts++;
        } while (
          attempts < 100 && (
            // Don't place on stroller start position
            (pos.x >= GAME_SIZE - 3 && pos.y >= GAME_SIZE - 3) ||
            // Don't place on goal area
            (pos.x < 2 && pos.y < 2) ||
            // Don't place on existing obstacles
            obstacles.some(obs => obs.pos.x === pos.x && obs.pos.y === pos.y) ||
            // Don't place on streets
            obstacles.some(obs => obs.isStreet && obs.pos.x === pos.x && obs.pos.y === pos.y)
          )
        );

        if (attempts < 100) {
          obstacles.push({
            id: `${type}-${i}`,
            type,
            pos,
            size: { width: 1, height: 1 },
            emoji,
            color,
            isStreet: false
          });
        }
      }
    });

    // Add FOREST (2x2) - find suitable location
    let forestPos: Position;
    let forestAttempts = 0;
    do {
      forestPos = {
        x: Math.floor(Math.random() * (GAME_SIZE - 2)),
        y: Math.floor(Math.random() * (GAME_SIZE - 2))
      };
      forestAttempts++;
    } while (
      forestAttempts < 100 && (
        // Don't place on stroller start position
        (forestPos.x >= GAME_SIZE - 3 && forestPos.y >= GAME_SIZE - 3) ||
        // Don't place on goal area
        (forestPos.x < 2 && forestPos.y < 2) ||
        // Don't place on existing obstacles or streets
        obstacles.some(obs => 
          (obs.pos.x === forestPos.x && obs.pos.y === forestPos.y) ||
          (obs.pos.x === forestPos.x + 1 && obs.pos.y === forestPos.y) ||
          (obs.pos.x === forestPos.x && obs.pos.y === forestPos.y + 1) ||
          (obs.pos.x === forestPos.x + 1 && obs.pos.y === forestPos.y + 1)
        )
      )
    );

    if (forestAttempts < 100) {
      // Add forest as 2x2 obstacle
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          obstacles.push({
            id: `forest-${forestPos.x + x}-${forestPos.y + y}`,
            type: 'forest',
            pos: { x: forestPos.x + x, y: forestPos.y + y },
            size: { width: 2, height: 2 },
            emoji: x === 0 && y === 0 ? '🌲' : '', // Only show emoji on first cell
            color: 'bg-green-700',
            isStreet: false
          });
        }
      }
    }

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
  }, []);

  // Create path for vehicles to follow along streets
  const createVehiclePath = useCallback((startPos: Position, obstacles: Obstacle[]): Position[] => {
    const path: Position[] = [startPos];
    const streets = obstacles.filter(obs => obs.isStreet);
    
    // Simple path: move along streets in a pattern
    let currentPos = { ...startPos };
    let direction = { x: 1, y: 0 }; // Start moving right
    
    for (let i = 0; i < 30; i++) { // Longer paths
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
      strollerPos: { x: GAME_SIZE - 3, y: GAME_SIZE - 3 }, // Start far from goal
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
      strollerPos: { x: GAME_SIZE - 3, y: GAME_SIZE - 3 },
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

      // Check if new position is blocked by obstacle (EXCEPT goal house and streets)
      const isBlocked = prev.obstacles.some(obs => 
        !obs.isStreet && !obs.isGoal && obs.pos.x === newPos.x && obs.pos.y === newPos.y
      );

      if (isBlocked) {
        return { ...prev, gameOver: true }; // Game over if hitting obstacle
      }

      // Check collision with vehicles
      const vehicleCollision = prev.vehicles.some(vehicle => 
        vehicle.pos.x === newPos.x && vehicle.pos.y === newPos.y
      );

      if (vehicleCollision) {
        return { ...prev, gameOver: true };
      }

      // Check if reached goal (any part of the 2x2 goal house)
      const isInGoal = newPos.x < 2 && newPos.y < 2;
      if (isInGoal) {
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
    const isInGoal = x < 2 && y < 2;
    const obstacle = gameState.obstacles.find(obs => obs.pos.x === x && obs.pos.y === y);
    const vehicle = gameState.vehicles.find(v => v.pos.x === x && v.pos.y === y);

    let cellContent = '';
    let cellClass = 'border border-slate-300';

    if (isStroller) {
      cellContent = '🛒👶'; // Stroller with baby
      cellClass = 'bg-blue-500 text-white border-blue-600 animate-pulse text-xs';
    } else if (isInGoal) {
      // Goal house with "ZIEL" label and sparkle animation
      if (x === 0 && y === 0) {
        cellContent = '🏠';
        cellClass = 'bg-green-500 text-white border-green-600 animate-bounce text-xs font-bold';
      } else if (x === 1 && y === 0) {
        cellContent = 'ZIEL';
        cellClass = 'bg-green-500 text-white border-green-600 animate-pulse text-xs font-bold';
      } else if (x === 0 && y === 1) {
        cellContent = '🏠';
        cellClass = 'bg-green-500 text-white border-green-600 animate-bounce text-xs';
      } else {
        cellContent = '🏠';
        cellClass = 'bg-green-500 text-white border-green-600 animate-bounce text-xs';
      }
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
          Führe den Kinderwagen mit dem Baby sicher durch die Stadt zum ZIEL-Haus! 
          Bewege dich auf den Straßen und vermeide den Verkehr.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 mb-2">🎯 Spielregeln:</h3>
          <ul className="text-sm text-blue-700 text-left space-y-1">
            <li>• 🛒👶 Kinderwagen mit Baby steuern</li>
            <li>• ⬆️⬇️⬅️➡️ Pfeiltasten zum Bewegen</li>
            <li>• 🛣️ Bewege dich auf Straßen und in freien Bereichen</li>
            <li>• 🚗🏍️🛴🚲 Vermeide den Verkehr</li>
            <li>• 🏠🏠 Ziel: Das grüne ZIEL-Haus erreichen</li>
            <li>• 🏫🏥🏬 Neue Gebäude: Schule, Krankenhaus, Einkaufszentrum</li>
            <li>• 🌲🌲 Wald als 2x2 Hindernis</li>
            <li>• ⚠️ Berühre KEINE Hindernisse - nur das Zielhaus!</li>
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
          <span className="text-slate-600">Ziel: <span className="font-bold text-green-600">🏠 ZIEL</span></span>
        </div>
      </div>

      {/* Game Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800 text-center font-medium">
          🎯 Bewege den Kinderwagen (🛒👶) mit den Pfeiltasten sicher durch die Stadt zum ZIEL-Haus (🏠)!
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
          <p className="text-slate-600 mb-4">Du hast den Kinderwagen erfolgreich sicher zum ZIEL-Haus geführt!</p>
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
                         <p className="text-xs text-slate-500 mt-2">Bewege dich auf Straßen und in freien Bereichen!</p>
          </div>
        </div>
      )}
    </div>
  );
}
