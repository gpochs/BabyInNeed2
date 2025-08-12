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
  size: { width: number; height: number };
  emoji: string;
  color: string;
  isStreet: boolean;
  isGoal?: boolean;
}

interface Vehicle {
  id: string;
  type: 'car' | 'motorcycle' | 'scooter' | 'bicycle';
  pos: Position;
  direction: Position;
  speed: number;
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

const GAME_SIZE = 20; // Changed to 20x20 for better mobile compatibility
const CELL_SIZE = 28; // Slightly larger cells for 20x20 grid
const GAME_SPEED = 50;

export default function StrollerGame() {
  const [gameState, setGameState] = useState<GameState>({
    strollerPos: { x: GAME_SIZE - 3, y: GAME_SIZE - 3 },
    goalPos: { x: 1, y: 1 },
    obstacles: [],
    vehicles: [],
    gameWon: false,
    gameStarted: false,
    gameOver: false,
    score: 0,
    gameTime: 0
  });

  const [isMobile, setIsMobile] = useState(false);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Generate city layout with streets and obstacles
  const generateCityLayout = useCallback(() => {
    const obstacles: Obstacle[] = [];
    const vehicles: Vehicle[] = [];
    
    // Create street network (adjusted for 20x20)
    const horizontalStreets = [
      { y: 2, startX: 0, endX: GAME_SIZE - 1 },
      { y: 6, startX: 0, endX: GAME_SIZE - 1 },
      { y: 10, startX: 0, endX: GAME_SIZE - 1 },
      { y: 14, startX: 0, endX: GAME_SIZE - 1 },
      { y: 18, startX: 0, endX: GAME_SIZE - 1 }
    ];
    
    const verticalStreets = [
      { x: 2, startY: 0, endY: GAME_SIZE - 1 },
      { x: 6, startY: 0, endY: GAME_SIZE - 1 },
      { x: 10, startY: 0, endY: GAME_SIZE - 1 },
      { x: 14, startY: 0, endY: GAME_SIZE - 1 },
      { x: 18, startY: 0, endY: GAME_SIZE - 1 }
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
          emoji: x === 0 && y === 0 ? '🏠' : '',
          color: 'bg-green-500',
          isStreet: false,
          isGoal: true
        });
      }
    }

    // Add buildings and obstacles (adjusted counts for 20x20)
    const buildingTypes = [
      { type: 'house' as const, count: 10, emoji: '🏠', color: 'bg-red-600' },
      { type: 'skyscraper' as const, count: 6, emoji: '🏢', color: 'bg-blue-600' },
      { type: 'tree' as const, count: 12, emoji: '🌳', color: 'bg-green-600' },
      { type: 'trafficLight' as const, count: 4, emoji: '🚦', color: 'bg-yellow-500' },
      { type: 'bikeRack' as const, count: 3, emoji: '🚲', color: 'bg-gray-500' },
      { type: 'wall' as const, count: 6, emoji: '🧱', color: 'bg-gray-700' },
      { type: 'hedge' as const, count: 8, emoji: '🌿', color: 'bg-green-500' },
      { type: 'school' as const, count: 1, emoji: '🏫', color: 'bg-purple-600' },
      { type: 'hospital' as const, count: 1, emoji: '🏥', color: 'bg-red-500' },
      { type: 'mall' as const, count: 1, emoji: '🏬', color: 'bg-pink-500' },
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
            (pos.x >= GAME_SIZE - 3 && pos.y >= GAME_SIZE - 3) ||
            (pos.x < 2 && pos.y < 2) ||
            obstacles.some(obs => obs.pos.x === pos.x && obs.pos.y === pos.y) ||
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

    // Add FOREST (2x2)
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
        (forestPos.x >= GAME_SIZE - 3 && forestPos.y >= GAME_SIZE - 3) ||
        (forestPos.x < 2 && forestPos.y < 2) ||
        obstacles.some(obs => 
          (obs.pos.x === forestPos.x && obs.pos.y === forestPos.y) ||
          (obs.pos.x === forestPos.x + 1 && obs.pos.y === forestPos.y) ||
          (obs.pos.x === forestPos.x && obs.pos.y === forestPos.y + 1) ||
          (obs.pos.x === forestPos.x + 1 && obs.pos.y === forestPos.y + 1)
        )
      )
    );

    if (forestAttempts < 100) {
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          obstacles.push({
            id: `forest-${forestPos.x + x}-${forestPos.y + y}`,
            type: 'forest',
            pos: { x: forestPos.x + x, y: forestPos.y + y },
            size: { width: 2, height: 2 },
            emoji: x === 0 && y === 0 ? '🌲' : '',
            color: 'bg-green-700',
            isStreet: false
          });
        }
      }
    }

    // Add vehicles
    const vehicleTypes = [
      { type: 'car' as const, count: 2, speed: 4, emoji: '🚗', color: 'bg-red-500' },
      { type: 'motorcycle' as const, count: 2, speed: 3, emoji: '🏍️', color: 'bg-orange-500' },
      { type: 'scooter' as const, count: 2, speed: 2, emoji: '🛴', color: 'bg-blue-500' },
      { type: 'bicycle' as const, count: 2, speed: 2, emoji: '🚲', color: 'bg-green-500' }
    ];

    vehicleTypes.forEach(({ type, count, speed, emoji, color }) => {
      for (let i = 0; i < count; i++) {
        const streetPositions = obstacles.filter(obs => obs.isStreet);
        if (streetPositions.length === 0) continue;

        const randomStreet = streetPositions[Math.floor(Math.random() * streetPositions.length)];
        const pos = { ...randomStreet.pos };
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

  // Create path for vehicles
  const createVehiclePath = useCallback((startPos: Position, obstacles: Obstacle[]): Position[] => {
    const path: Position[] = [startPos];
    const streets = obstacles.filter(obs => obs.isStreet);
    
    let currentPos = { ...startPos };
    let direction = { x: 1, y: 0 };
    
    for (let i = 0; i < 20; i++) {
      const nextPos = {
        x: currentPos.x + direction.x,
        y: currentPos.y + direction.y
      };
      
      const isStreet = streets.some(street => 
        street.pos.x === nextPos.x && street.pos.y === nextPos.y
      );
      
      if (isStreet && nextPos.x >= 0 && nextPos.x < GAME_SIZE && nextPos.y >= 0 && nextPos.y < GAME_SIZE) {
        path.push(nextPos);
        currentPos = nextPos;
      } else {
        if (direction.x !== 0) {
          direction = { x: 0, y: 1 };
        } else {
          direction = { x: 1, y: 0 };
        }
      }
    }
    
    return path;
  }, []);

  // Move vehicles
  const moveVehicles = useCallback(() => {
    setGameState(prev => {
      const newVehicles = prev.vehicles.map(vehicle => {
        if (vehicle.currentPath.length <= 1) return vehicle;
        
        const moveInterval = 1000 / vehicle.speed;
        const shouldMove = (prev.gameTime % moveInterval) < GAME_SPEED;
        
        if (!shouldMove) return vehicle;
        
        let newPathIndex = vehicle.pathIndex + 1;
        if (newPathIndex >= vehicle.currentPath.length) {
          newPathIndex = 0;
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
      strollerPos: { x: GAME_SIZE - 3, y: GAME_SIZE - 3 },
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

  // Handle stroller control
  const handleStrollerControl = useCallback((dx: number, dy: number) => {
    if (!gameState.gameStarted || gameState.gameWon || gameState.gameOver) return;

    setGameState(prev => {
      const newPos = {
        x: prev.strollerPos.x + dx,
        y: prev.strollerPos.y + dy
      };

      if (newPos.x < 0 || newPos.x >= GAME_SIZE || newPos.y < 0 || newPos.y >= GAME_SIZE) {
        return prev;
      }

      const isBlocked = prev.obstacles.some(obs => 
        !obs.isStreet && !obs.isGoal && obs.pos.x === newPos.x && obs.pos.y === newPos.y
      );

      if (isBlocked) {
        return { ...prev, gameOver: true };
      }

      const vehicleCollision = prev.vehicles.some(vehicle => 
        vehicle.pos.x === newPos.x && vehicle.pos.y === newPos.y
      );

      if (vehicleCollision) {
        return { ...prev, gameOver: true };
      }

      const isInGoal = newPos.x < 2 && newPos.y < 2;
      if (isInGoal) {
        return { 
          ...prev, 
          gameWon: true, 
          score: Math.max(prev.score, 100 - Math.floor(prev.gameTime / 1000))
        };
      }

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

  // Touch controls for mobile
  const handleTouchMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!gameState.gameStarted || gameState.gameWon || gameState.gameOver) return;

    switch (direction) {
      case 'up':
        handleStrollerControl(0, -1);
        break;
      case 'down':
        handleStrollerControl(0, 1);
        break;
      case 'left':
        handleStrollerControl(-1, 0);
        break;
      case 'right':
        handleStrollerControl(1, 0);
        break;
    }
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
      cellContent = '🛒👶';
      // NEON PINK with glow effect and pulse animation
      cellClass = 'bg-pink-400 text-white border-pink-500 animate-pulse text-xs shadow-lg shadow-pink-500/50';
    } else if (isInGoal) {
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
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center justify-center gap-3">
          🏙️ Stadt-Labyrinth (20x20)
        </h2>
        <p className="text-slate-600 mb-4 max-w-md mx-auto text-sm">
          Führe den Kinderwagen mit dem Baby sicher durch die Stadt zum ZIEL-Haus! 
          Bewege dich auf den Straßen und vermeide den Verkehr.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <h3 className="font-semibold text-blue-800 mb-2 text-sm">🎯 Spielregeln:</h3>
          <ul className="text-xs text-blue-700 text-left space-y-1">
            <li>• 🛒👶 Kinderwagen mit Baby steuern</li>
            <li>• ⬆️⬇️⬅️➡️ Pfeiltasten oder Touch-Steuerung</li>
            <li>• 🛣️ Bewege dich auf Straßen und in freien Bereichen</li>
            <li>• 🚗🏍️🛴🚲 Vermeide den Verkehr</li>
            <li>• 🏠🏠 Ziel: Das grüne ZIEL-Haus erreichen</li>
            <li>• ⚠️ Berühre KEINE Hindernisse - nur das Zielhaus!</li>
          </ul>
        </div>
        <button
          onClick={startGame}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all duration-300"
        >
          🚀 Spiel starten
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center justify-center gap-3">
          🏙️ Stadt-Labyrinth (20x20)
        </h2>
        <div className="flex items-center justify-center gap-4 text-base flex-wrap">
          <span className="text-slate-600">Punkte: <span className="font-bold text-indigo-600">{gameState.score}</span></span>
          <span className="text-slate-600">Zeit: <span className="font-bold text-orange-600">{Math.floor(gameState.gameTime / 1000)}s</span></span>
          <span className="text-slate-600">Ziel: <span className="font-bold text-green-600">🏠 ZIEL</span></span>
        </div>
      </div>

      {/* Game Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-blue-800 text-center font-medium text-sm">
          🎯 Bewege den Kinderwagen (🛒👶) sicher durch die Stadt zum ZIEL-Haus (🏠)!
        </p>
      </div>

      {/* Game Grid */}
      <div className="flex justify-center mb-4 overflow-auto">
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

      {/* Mobile Touch Controls */}
      {isMobile && !gameState.gameWon && !gameState.gameOver && (
        <div className="flex justify-center mb-4">
          <div className="grid grid-cols-3 gap-2">
            <div></div>
            <button
              onClick={() => handleTouchMove('up')}
              className="w-12 h-12 bg-indigo-500 text-white rounded-lg flex items-center justify-center text-xl shadow-md hover:bg-indigo-600 transition-colors"
            >
              ⬆️
            </button>
            <div></div>
            <button
              onClick={() => handleTouchMove('left')}
              className="w-12 h-12 bg-indigo-500 text-white rounded-lg flex items-center justify-center text-xl shadow-md hover:bg-indigo-600 transition-colors"
            >
              ⬅️
            </button>
            <button
              onClick={() => handleTouchMove('down')}
              className="w-12 h-12 bg-indigo-500 text-white rounded-lg flex items-center justify-center text-xl shadow-md hover:bg-indigo-600 transition-colors"
            >
              ⬇️
            </button>
            <button
              onClick={() => handleTouchMove('right')}
              className="w-12 h-12 bg-indigo-500 text-white rounded-lg flex items-center justify-center text-xl shadow-md hover:bg-indigo-600 transition-colors"
            >
              ➡️
            </button>
          </div>
        </div>
      )}

      {/* Game Status */}
      {gameState.gameWon && (
        <div className="text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h3 className="text-xl font-bold text-green-600 mb-2">Gewonnen!</h3>
          <p className="text-slate-600 mb-3 text-sm">Du hast den Kinderwagen erfolgreich sicher zum ZIEL-Haus geführt!</p>
          <p className="text-base font-semibold text-indigo-600 mb-4">Punkte: {gameState.score} | Zeit: {Math.floor(gameState.gameTime / 1000)}s</p>
          <button
            onClick={resetGame}
            className="px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300"
          >
            🔄 Nochmal spielen
          </button>
        </div>
      )}

      {gameState.gameOver && (
        <div className="text-center">
          <div className="text-5xl mb-3">💥</div>
          <h3 className="text-xl font-bold text-red-600 mb-2">Game Over!</h3>
          <p className="text-slate-600 mb-3 text-sm">Der Kinderwagen ist mit einem Hindernis oder Fahrzeug kollidiert!</p>
          <p className="text-base font-semibold text-indigo-600 mb-4">Punkte: {gameState.score} | Zeit: {Math.floor(gameState.gameTime / 1000)}s</p>
          <button
            onClick={resetGame}
            className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300"
          >
            🔄 Nochmal versuchen
          </button>
        </div>
      )}

      {/* Game Controls */}
      {!gameState.gameWon && !gameState.gameOver && (
        <div className="text-center">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 inline-block">
            <p className="text-slate-600 font-medium mb-2 text-sm">Steuerung:</p>
            <div className="flex items-center justify-center gap-2 text-xl">
              <span>⬆️</span>
              <span>⬅️</span>
              <span>⬇️</span>
              <span>➡️</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {isMobile ? 'Touch-Buttons oder Pfeiltasten' : 'Pfeiltasten'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
