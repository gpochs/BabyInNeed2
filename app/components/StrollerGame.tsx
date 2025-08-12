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

const GAME_SIZE = 20; // 20x20 for mobile compatibility
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

  // Create path for vehicles - MUST BE DEFINED FIRST
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
          id: `hstreet-${street.y}-${x}`,
          type: 'street',
          pos: { x, y: street.y },
          size: { width: 1, height: 1 },
          emoji: '🛣️',
          color: 'bg-yellow-100',
          isStreet: true
        });
      }
    });

    // Add vertical streets
    verticalStreets.forEach(street => {
      for (let y = street.startY; y <= street.endY; y++) {
        obstacles.push({
          id: `vstreet-${street.x}-${y}`,
          type: 'street',
          pos: { x: street.x, y },
          size: { width: 1, height: 1 },
          emoji: '🛣️',
          color: 'bg-yellow-100',
          isStreet: true
        });
      }
    });

    // Add static obstacles (houses, trees, etc.)
    const staticObstacles: Array<{
      type: 'house' | 'skyscraper' | 'tree' | 'trafficLight' | 'bikeRack' | 'wall' | 'hedge' | 'school' | 'hospital' | 'mall' | 'forest';
      emoji: string;
      color: string;
      count: number;
    }> = [
      // Houses
      { type: 'house', emoji: '🏠', color: 'bg-red-200', count: 8 },
      { type: 'skyscraper', emoji: '🏢', color: 'bg-blue-200', count: 6 },
      { type: 'tree', emoji: '🌳', color: 'bg-green-200', count: 12 },
      { type: 'trafficLight', emoji: '🚦', color: 'bg-yellow-200', count: 4 },
      { type: 'bikeRack', emoji: '🚲', color: 'bg-gray-200', count: 3 },
      { type: 'wall', emoji: '🧱', color: 'bg-gray-300', count: 6 },
      { type: 'hedge', emoji: '🌿', color: 'bg-green-300', count: 8 },
      { type: 'school', emoji: '🏫', color: 'bg-purple-200', count: 1 },
      { type: 'hospital', emoji: '🏥', color: 'bg-red-300', count: 1 },
      { type: 'mall', emoji: '🏬', color: 'bg-pink-200', count: 1 },
      { type: 'forest', emoji: '🌲', color: 'bg-green-400', count: 1 }
    ];

    staticObstacles.forEach(obstacle => {
      for (let i = 0; i < obstacle.count; i++) {
        let pos: Position;
        let attempts = 0;
        
        do {
          pos = {
            x: Math.floor(Math.random() * GAME_SIZE),
            y: Math.floor(Math.random() * GAME_SIZE)
          };
          attempts++;
        } while (
          attempts < 50 && (
            // Don't place on streets
            obstacles.some(obs => obs.pos.x === pos.x && obs.pos.y === pos.y) ||
            // Don't place on stroller start area
            (pos.x >= GAME_SIZE - 4 && pos.y >= GAME_SIZE - 4) ||
            // Don't place on goal area
            (pos.x <= 2 && pos.y <= 2)
          )
        );

        if (attempts < 50) {
          if (obstacle.type === 'forest') {
            // 2x2 forest
            for (let dx = 0; dx < 2; dx++) {
              for (let dy = 0; dy < 2; dy++) {
                const forestPos = { x: pos.x + dx, y: pos.y + dy };
                if (forestPos.x < GAME_SIZE && forestPos.y < GAME_SIZE) {
                  obstacles.push({
                    id: `forest-${forestPos.x}-${forestPos.y}`,
                    type: obstacle.type,
                    pos: forestPos,
                    size: { width: 2, height: 2 },
                    emoji: obstacle.emoji,
                    color: obstacle.color,
                    isStreet: false
                  });
                }
              }
            }
          } else {
            obstacles.push({
              id: `${obstacle.type}-${i}-${pos.x}-${pos.y}`,
              type: obstacle.type,
              pos,
              size: { width: 1, height: 1 },
              emoji: obstacle.emoji,
              color: obstacle.color,
              isStreet: false
            });
          }
        }
      }
    });

    // Add vehicles
    const vehicleTypes = [
      { type: 'car', emoji: '🚗', color: 'bg-blue-500', speed: 4, count: 2 },
      { type: 'motorcycle', emoji: '🏍️', color: 'bg-green-500', speed: 3, count: 2 },
      { type: 'scooter', emoji: '🛵', color: 'bg-green-500', speed: 2, count: 2 },
      { type: 'bicycle', emoji: '🚲', color: 'bg-yellow-500', speed: 2, count: 2 }
    ];

    vehicleTypes.forEach(vehicleType => {
      for (let i = 0; i < vehicleType.count; i++) {
        let pos: Position;
        let attempts = 0;
        
        do {
          pos = {
            x: Math.floor(Math.random() * GAME_SIZE),
            y: Math.floor(Math.random() * GAME_SIZE)
          };
          attempts++;
        } while (
          attempts < 50 && (
            // Only place on streets
            !obstacles.some(obs => obs.pos.x === pos.x && obs.pos.y === pos.y && obs.isStreet) ||
            // Don't place on stroller start area
            (pos.x >= GAME_SIZE - 4 && pos.y >= GAME_SIZE - 4) ||
            // Don't place on goal area
            (pos.x <= 2 && pos.y <= 2)
          )
        );

        if (attempts < 50) {
          const path = createVehiclePath(pos, obstacles);
          vehicles.push({
            id: `${vehicleType.type}-${i}`,
            type: vehicleType.type as 'car' | 'motorcycle' | 'scooter' | 'bicycle',
            pos,
            direction: { x: 0, y: 0 },
            speed: vehicleType.speed,
            emoji: vehicleType.emoji,
            color: vehicleType.color,
            currentPath: path,
            pathIndex: 0
          });
        }
      }
    });
    
    return { obstacles, vehicles };
  }, [createVehiclePath]);

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
    if (gameState.gameOver || gameState.gameWon) return;

    const newPos = {
      x: gameState.strollerPos.x + dx,
      y: gameState.strollerPos.y + dy
    };

    // Check boundaries
    if (newPos.x < 0 || newPos.x >= GAME_SIZE || newPos.y < 0 || newPos.y >= GAME_SIZE) {
      return;
    }

    // Check collision with obstacles
    const isCollision = gameState.obstacles.some(obs => {
      if (obs.isStreet || obs.isGoal) return false;
      return obs.pos.x === newPos.x && obs.pos.y === newPos.y;
    });

    // Check collision with vehicles
    const isVehicleCollision = gameState.vehicles.some(vehicle => 
      vehicle.pos.x === newPos.x && vehicle.pos.y === newPos.y
    );

    if (isCollision || isVehicleCollision) {
      setGameState(prev => ({ ...prev, gameOver: true }));
      return;
    }

    // Check if reached goal
    if (newPos.x <= 1 && newPos.y <= 1) {
      setGameState(prev => ({ ...prev, gameWon: true }));
      return;
    }

    // Move stroller
    setGameState(prev => ({
      ...prev,
      strollerPos: newPos
    }));
  }, [gameState]);

  // Game loop
  useEffect(() => {
    if (!gameState.gameStarted || gameState.gameOver || gameState.gameWon) return;

    const gameLoop = setInterval(() => {
      setGameState(prev => ({
        ...prev,
        gameTime: prev.gameTime + GAME_SPEED
      }));
      moveVehicles();
    }, GAME_SPEED);

    gameLoopRef.current = gameLoop;

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameState.gameStarted, gameState.gameOver, gameState.gameWon, moveVehicles]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameState.gameStarted || gameState.gameOver || gameState.gameWon) return;

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
  }, [gameState.gameStarted, gameState.gameOver, gameState.gameWon, handleStrollerControl]);

  // Render game cell
  const renderCell = (x: number, y: number) => {
    const isStroller = gameState.strollerPos.x === x && gameState.strollerPos.y === y;
    const isInGoal = x <= 1 && y <= 1;
    const obstacle = gameState.obstacles.find(obs => obs.pos.x === x && obs.pos.y === y);
    const vehicle = gameState.vehicles.find(v => v.pos.x === x && v.pos.y === y);

    let cellContent = '';
    let cellClass = 'w-7 h-7 border border-gray-300 flex items-center justify-center text-xs';

    if (isStroller) {
      cellContent = '🛒👶';
      cellClass = 'w-7 h-7 border border-pink-500 bg-pink-400 text-white animate-pulse text-xs shadow-lg shadow-pink-500/50';
    } else if (isInGoal) {
      if (x === 0 && y === 0) {
        cellContent = '🏠';
        cellClass = 'w-7 h-7 border border-green-600 bg-green-500 text-white animate-bounce text-xs font-bold';
      } else if (x === 1 && y === 0) {
        cellContent = 'ZIEL';
        cellClass = 'w-7 h-7 border border-green-600 bg-green-500 text-white animate-pulse text-xs font-bold';
      } else if (x === 0 && y === 1) {
        cellContent = '🏠';
        cellClass = 'w-7 h-7 border border-green-600 bg-green-500 text-white animate-bounce text-xs';
      } else { // x === 1 && y === 1
        cellContent = '🏠';
        cellClass = 'w-7 h-7 border border-green-600 bg-green-500 text-white animate-bounce text-xs';
      }
    } else if (vehicle) {
      cellContent = vehicle.emoji;
      cellClass = `w-7 h-7 border border-gray-600 ${vehicle.color} text-white text-xs`;
    } else if (obstacle) {
      cellContent = obstacle.emoji;
      cellClass = `w-7 h-7 border border-gray-600 ${obstacle.color} text-xs`;
    } else {
      cellContent = '';
      cellClass = 'w-7 h-7 border border-gray-300 bg-gray-100';
    }

    return (
      <div key={`${x}-${y}`} className={cellClass}>
        {cellContent}
      </div>
    );
  };

  // Render game grid
  const renderGameGrid = () => {
    const grid = [];
    for (let y = 0; y < GAME_SIZE; y++) {
      const row = [];
      for (let x = 0; x < GAME_SIZE; x++) {
        row.push(renderCell(x, y));
      }
      grid.push(
        <div key={y} className="flex">
          {row}
        </div>
      );
    }
    return grid;
  };

  // Touch controls for mobile
  const TouchControls = () => (
    <div className="grid grid-cols-3 gap-2 mt-4">
      <div></div>
      <button
        onClick={() => handleStrollerControl(0, -1)}
        className="p-3 bg-indigo-500 text-white rounded-lg text-xl"
      >
        ⬆️
      </button>
      <div></div>
      <button
        onClick={() => handleStrollerControl(-1, 0)}
        className="p-3 bg-indigo-500 text-white rounded-lg text-xl"
      >
        ⬅️
      </button>
      <button
        onClick={() => handleStrollerControl(0, 1)}
        className="p-3 bg-indigo-500 text-white rounded-lg text-xl"
      >
        ⬇️
      </button>
      <button
        onClick={() => handleStrollerControl(1, 0)}
        className="p-3 bg-indigo-500 text-white rounded-lg text-xl"
      >
        ➡️
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-slate-800 mb-2">🏙️ Stadt-Labyrinth</h3>
        <p className="text-slate-600">
          Führe den Kinderwagen 🛒👶 zum Ziel 🏠!
        </p>
      </div>

      {/* Game Status */}
      <div className="text-center mb-4">
        {gameState.gameWon && (
          <div className="text-green-600 font-bold text-lg mb-2">
            🎉 Gewonnen! Du hast das Ziel erreicht!
          </div>
        )}
        {gameState.gameOver && (
          <div className="text-red-600 font-bold text-lg mb-2">
            💥 Game Over! Du bist gestoßen!
          </div>
        )}
                 {!gameState.gameStarted && !gameState.gameWon && !gameState.gameOver && (
           <div className="text-slate-600 mb-2">
             Klicke &quot;Spiel starten&quot; um zu beginnen!
           </div>
         )}
      </div>

      {/* Game Controls */}
      <div className="text-center mb-4 space-x-4">
        {!gameState.gameStarted && (
          <button
            onClick={startGame}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
          >
            🎮 Spiel starten
          </button>
        )}
        {(gameState.gameWon || gameState.gameOver) && (
          <button
            onClick={resetGame}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            🔄 Nochmal spielen
          </button>
        )}
      </div>

      {/* Game Grid */}
      <div className="flex justify-center mb-4">
        <div className="border-2 border-gray-400 rounded-lg overflow-hidden">
          {renderGameGrid()}
        </div>
      </div>

      {/* Mobile Touch Controls */}
      {isMobile && <TouchControls />}

      {/* Game Instructions */}
      <div className="text-center text-sm text-slate-600">
        <p>Verwende die Pfeiltasten oder tippe auf die Buttons (Mobile)</p>
        <p>Vermeide Hindernisse und Fahrzeuge!</p>
      </div>
    </div>
  );
}
