import React, { useState, useEffect, useImperativeHandle } from 'react';

const FlipbookAvatar = ({ customAvatarRef }) => {
  const [currentFolder, setCurrentFolder] = useState('Entrance');
  const [frameIndex, setFrameIndex] = useState(1);
  const [lastRandom, setLastRandom] = useState('');

  // ---------------------------------------------------------
  // 🛠️ LAB CONTROLS
  // ---------------------------------------------------------
  // Switched to FALSE to power up the animation engine!
  const DEBUG_OVERLAY = false; 

  // Your perfectly calibrated lab numbers
  const ENTRANCE_SCALE = 'scale(2.8)';
  const ENTRANCE_FLOOR = 'translateY(27.9%)';

  const CHIBI_SCALE = 'scale(2)';
  const CHIBI_FLOOR = 'translateY(25%)';
  // ---------------------------------------------------------

  const isEntrance = currentFolder === 'Entrance';
  const zoomLevel = isEntrance ? ENTRANCE_SCALE : CHIBI_SCALE;
  const floorShift = isEntrance ? ENTRANCE_FLOOR : CHIBI_FLOOR;

  const animationConfig = {
    "Entrance": { total: 210, fps: 24 },
    "Idle": { total: 221, fps: 24 },
    "ChickenDance": { total: 116, fps: 24 },
    "LookAround": { total: 116, fps: 24 },
    "LookAround1": { total: 215, fps: 24 },
    "MacarenaDance": { total: 201, fps: 24 },
  };

  const getNextRandomMovement = () => {
    const movements = Object.keys(animationConfig).filter(
      (key) => key !== "Idle" && key !== "Entrance" && key !== lastRandom
    );
    const pick = movements[Math.floor(Math.random() * movements.length)];
    setLastRandom(pick);
    return pick;
  };

  useImperativeHandle(customAvatarRef, () => ({
    switchGesture: (gestureName) => {
      if (animationConfig[gestureName]) {
        setCurrentFolder(gestureName);
        setFrameIndex(1);
      }
    },
  }));

  const generatePath = (folder, frame) => {
    const paddedIndex = folder === 'Entrance' 
      ? frame.toString().padStart(4, '0') 
      : frame.toString().padStart(3, '0');
      
    const folderPath = folder === 'Entrance' 
      ? `/assets/Entrance/` 
      : `/assets/ChibiModel_animation/${folder}/`;
      
    return `${folderPath}frame_${paddedIndex}.webp`;
  };

  // --- PRODUCTION LOOP LOGIC ---
  useEffect(() => {
    if (DEBUG_OVERLAY) return;

    const conf = animationConfig[currentFolder];
    if (!conf) return;

    const interval = setInterval(() => {
      setFrameIndex((prev) => {
        if (prev < conf.total) {
          return prev + 1;
        } else {
          if (currentFolder === 'Idle') {
            setCurrentFolder(getNextRandomMovement());
          } else {
            setCurrentFolder('Idle');
          }
          return 1; 
        }
      });
    }, 1000 / conf.fps);

    return () => clearInterval(interval);
  }, [currentFolder, lastRandom, DEBUG_OVERLAY]);

  // --- PRODUCTION PRELOADER BUFFER ---
  useEffect(() => {
    if (DEBUG_OVERLAY) return; 

    const conf = animationConfig[currentFolder];
    if (!conf) return;

    if (frameIndex + 1 <= conf.total) {
      const img1 = new Image();
      img1.src = generatePath(currentFolder, frameIndex + 1);
    }
    if (frameIndex + 2 <= conf.total) {
      const img2 = new Image();
      img2.src = generatePath(currentFolder, frameIndex + 2);
    }
  }, [frameIndex, currentFolder, DEBUG_OVERLAY]);


  // =========================================================
  // 📐 RENDER BLOCK
  // =========================================================

  // If we are calibrating, show the overlapped Ghost layout
  if (DEBUG_OVERLAY) {
    return (
      <div className="w-full h-full flex flex-col justify-end items-center pb-10">
        <div className="relative w-full max-w-[850px] h-full max-h-[850px] flex justify-center items-end border-b-4 border-blue-500">
          
          <img
            src="/assets/ChibiModel_animation/Idle/frame_001.webp"
            alt="Idle Test"
            className="absolute bottom-0 w-full h-full object-contain border-2 border-dashed border-green-500"
            style={{ 
              transform: `${CHIBI_SCALE} ${CHIBI_FLOOR}`,
              transformOrigin: 'bottom center' 
            }}
          />

          <img
            src="/assets/Entrance/frame_0074.webp"
            alt="Entrance Test"
            className="absolute bottom-0 w-full h-full object-contain opacity-50 border-2 border-dashed border-red-500"
            style={{ 
              transform: `${ENTRANCE_SCALE} ${ENTRANCE_FLOOR}`,
              transformOrigin: 'bottom center' 
            }}
          />
        </div>
      </div>
    );
  }

  // Normal Production Model
// Normal Production Model
  return (
    <div className="w-full h-full flex justify-center items-end overflow-visible">
      <img
        src={generatePath(currentFolder, frameIndex)}
        alt={currentFolder}
        // 👇 ADDED: pointer-events-none prevents her transparent box from stealing clicks!
        className="w-full h-full max-h-[850px] object-contain transition-all duration-300 ease-in-out pointer-events-none"
        style={{ 
          // 👇 ADDED: translateX(-5%) slides her slightly to the left to give the buttons breathing room.
          // (You can change -5% to -10% if she needs to move further left, or 0% to keep her centered)
          transform: `${zoomLevel} ${floorShift} translateX(-5%)`,
          transformOrigin: 'bottom center' 
        }}
      />
    </div>
  );
};

export default FlipbookAvatar;