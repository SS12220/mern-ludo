import React, { useEffect, useRef, useState, useContext } from 'react';
import { PlayerDataContext, SocketContext } from '../../../App';

import mapImageSrc from '../../../images/New-UI/Board/Board.svg';
import positionMapCoords from '../positions';
import pawnImagesSrc from '../../../constants/pawnImages';
import pawnRingSrc from '../../../images/New-UI/Pawns/Pawn Bottom Ring.svg';
import canPawnMove from './canPawnMove';
import getPositionAfterMove from './getPositionAfterMove';
import getPath from './calculatePath';
import audioManager from '../../../utils/audioManager';

const getRotationAngle = (color) => {
    switch (color) {
        case 'red': return -90;
        case 'green': return 90;
        case 'yellow': return 180;
        case 'blue': 
        default: return 0;
    }
};

// Preload images
const mapImage = new Image();
mapImage.src = mapImageSrc;

const pawnRingImage = new Image();
pawnRingImage.src = pawnRingSrc;

const loadedPawnImages = {};
Object.keys(pawnImagesSrc).forEach(color => {
    const img = new Image();
    img.src = pawnImagesSrc[color];
    loadedPawnImages[color] = img;
});

const Map = ({ pawns, nowMoving, rolledNumber, localColor, players }) => {
    const playerContext = useContext(PlayerDataContext);
    const socket = useContext(SocketContext);
    const canvasRef = useRef(null);
    const [hintPawn, setHintPawn] = useState();
    const [effectiveRolledNumber, setEffectiveRolledNumber] = useState(null);

    useEffect(() => {
        if (rolledNumber) {
            const timer = setTimeout(() => {
                setEffectiveRolledNumber(rolledNumber);
            }, 500); // 500ms matches the dice spin animation duration
            return () => clearTimeout(timer);
        } else {
            setEffectiveRolledNumber(null);
        }
    }, [rolledNumber]);
    
    // Store animated positions
    const visualPawnsRef = useRef([]);
    const animationFrameRef = useRef();

    const rotationAngle = getRotationAngle(localColor);

    // Determine if we can interact with a pawn of `targetColor`
    const canInteractWithColor = (targetColor) => {
        if (!nowMoving) return false;
        const movingPlayer = players.find(p => p.nowMoving);
        if (!movingPlayer) return false;
        
        // Is this the moving player's pawn?
        if (movingPlayer.color !== targetColor) return false;

        // Is the current client the moving player?
        if (movingPlayer._id === playerContext.playerId) return true;

        // Is the current client the Admin, and the moving player is a Local Player?
        const isAdmin = players[0] && players[0]._id === playerContext.playerId;
        if (isAdmin && movingPlayer.name.startsWith('Local Player')) return true;

        return false;
    };

    // Sync visual pawns with backend pawns
    useEffect(() => {
        let maxForwardDelay = 0;
        pawns.forEach(p => {
            const existing = visualPawnsRef.current.find(vp => vp._id === p._id);
            if (existing && existing.position !== p.position) {
                const path = getPath(p.color, existing.position, p.position);
                const isBeaten = p.position >= 0 && p.position <= 15 && existing.position > 15;
                if (!isBeaten && path.length > 1) {
                    maxForwardDelay = Math.max(maxForwardDelay, (path.length - 1) * 200);
                }
            }
        });

        const newVisualPawns = pawns.map(p => {
            const existing = visualPawnsRef.current.find(vp => vp._id === p._id);
            const targetCoords = positionMapCoords[p.position];
            
            if (existing && existing.position !== p.position) {
                // Pawn moved, calculate path
                const path = getPath(p.color, existing.position, p.position);
                const isBeaten = p.position >= 0 && p.position <= 15 && existing.position > 15;
                
                // If tab was asleep, the pawn might have moved a huge distance instantly. Skip animation to prevent backlog looping.
                if (!isBeaten && path.length > 7) {
                    return { ...p, x: targetCoords.x, y: targetCoords.y, isAnimating: false };
                }

                const animStartTime = performance.now() + (isBeaten ? maxForwardDelay : 0);
                
                if (!isBeaten && path.length > 1) {
                    // Play step sound for the first move out of base, or first step
                    audioManager.play('step');
                }

                // If path is just one step (direct move or capture), set next target
                const nextPos = path.length > 1 ? path[1] : path[0];
                const nextCoords = positionMapCoords[nextPos];

                let captureDuration = 600;
                if (isBeaten) {
                    const distance = Math.hypot(targetCoords.x - existing.x, targetCoords.y - existing.y);
                    // Constant speed: max 650px in 3000ms => speed = 0.216 px/ms
                    captureDuration = Math.max(300, (distance / 650) * 3000); 
                }

                return {
                    ...p,
                    path: path,
                    pathIndex: 1, // we are moving towards index 1
                    isBeaten: isBeaten,
                    captureDuration: captureDuration,
                    startX: existing.x,
                    startY: existing.y,
                    targetX: nextCoords.x,
                    targetY: nextCoords.y,
                    x: existing.x,
                    y: existing.y,
                    animStartTime: animStartTime,
                    audioPlayed: false,
                    isAnimating: true
                };
            } else if (existing) {
                // No movement
                return { 
                    ...p, 
                    x: existing.x, y: existing.y, 
                    isAnimating: existing.isAnimating, 
                    animStartTime: existing.animStartTime, 
                    startX: existing.startX, startY: existing.startY, 
                    targetX: existing.targetX, targetY: existing.targetY,
                    path: existing.path, pathIndex: existing.pathIndex, isBeaten: existing.isBeaten,
                    captureDuration: existing.captureDuration, audioPlayed: existing.audioPlayed
                };
            } else {
                // Initial load
                const targetCoords = positionMapCoords[p.position];
                return { ...p, x: targetCoords.x, y: targetCoords.y, isAnimating: false };
            }
        });
        visualPawnsRef.current = newVisualPawns;
    }, [pawns]);

    const paintPawn = (context, pawn, x, y, isValidToMove = false) => {
        const touchableArea = new Path2D();
        touchableArea.arc(x, y, 24, 0, 2 * Math.PI);

        if (isValidToMove) {
            if (pawnRingImage.complete) {
                context.save();
                context.translate(x, y);
                context.rotate(-rotationAngle * Math.PI / 180);
                context.drawImage(pawnRingImage, -14, -14, 28, 28);
                context.restore();
            }
        }

        const image = loadedPawnImages[pawn.color];
        if (image && image.complete) {
            context.save();
            context.translate(x, y);
            context.rotate(-rotationAngle * Math.PI / 180);
            context.drawImage(image, -12, -24, 24, 30);
            context.restore();
        }
        return touchableArea;
    };

    const handleCanvasClick = event => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const cursorX_screen = (event.clientX - rect.left) * scaleX;
        const cursorY_screen = (event.clientY - rect.top) * scaleY;

        const angleRad = -(rotationAngle * Math.PI) / 180;
        const dx = cursorX_screen - 230;
        const dy = cursorY_screen - 230;
        
        const cursorX = 230 + dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
        const cursorY = 230 + dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        
        for (const pawn of visualPawnsRef.current) {
            if (ctx.isPointInPath(pawn.touchableArea, cursorX, cursorY)) {
                if (canPawnMove(pawn, effectiveRolledNumber) && canInteractWithColor(pawn.color)) socket.emit('game:move', pawn._id);
            }
        }
        setHintPawn(null);
    };

    const handleMouseMove = event => {
        if (!nowMoving || !effectiveRolledNumber) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const cursorX_screen = (event.clientX - rect.left) * scaleX;
        const cursorY_screen = (event.clientY - rect.top) * scaleY;

        const angleRad = -(rotationAngle * Math.PI) / 180;
        const dx = cursorX_screen - 230;
        const dy = cursorY_screen - 230;
        
        const x = 230 + dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
        const y = 230 + dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        
        canvas.style.cursor = 'default';
        for (const pawn of visualPawnsRef.current) {
            if (
                pawn.touchableArea &&
                ctx.isPointInPath(pawn.touchableArea, x, y) &&
                canInteractWithColor(pawn.color) &&
                canPawnMove(pawn, effectiveRolledNumber)
            ) {
                const pawnPosition = getPositionAfterMove(pawn, effectiveRolledNumber);
                if (pawnPosition) {
                    canvas.style.cursor = 'pointer';
                    if (hintPawn && hintPawn.id === pawn._id) return;
                    setHintPawn({ id: pawn._id, position: pawnPosition, color: 'grey' });
                    return;
                }
            }
        }
        setHintPawn(null);
    };

    useEffect(() => {
        const renderLoop = (time) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (mapImage.complete) {
                ctx.drawImage(mapImage, 0, 0, 460, 460);
            }

            // Update & Draw Pawns
            visualPawnsRef.current.forEach((pawn, index) => {
                let currentX = pawn.x;
                let currentY = pawn.y;

                if (pawn.isAnimating) {
                    const elapsed = time - pawn.animStartTime;

                    if (elapsed < 0) {
                        // Still waiting for delay (e.g. beaten pawn waiting for capturing pawn)
                        currentX = pawn.startX;
                        currentY = pawn.startY;
                    } else {
                        if (pawn.isBeaten && !pawn.audioPlayed) {
                            audioManager.play('death');
                            pawn.audioPlayed = true;
                        }

                        const duration = pawn.isBeaten ? pawn.captureDuration : 200; // Constant speed for capture, 200ms per step otherwise
                        const progress = Math.min(elapsed / duration, 1);
                        
                        // Easing for normal steps, linear for capture
                        const ease = pawn.isBeaten ? progress : 1 - Math.pow(1 - progress, 3);
                        
                        currentX = pawn.startX + (pawn.targetX - pawn.startX) * ease;
                        currentY = pawn.startY + (pawn.targetY - pawn.startY) * ease;

                        if (progress === 1) {
                            // Reached the current cell target
                            if (pawn.path && pawn.pathIndex < pawn.path.length - 1) {
                                // More steps to go!
                                pawn.pathIndex++;
                                const nextPos = pawn.path[pawn.pathIndex];
                                const targetCoords = positionMapCoords[nextPos];
                                
                                pawn.startX = currentX;
                                pawn.startY = currentY;
                                pawn.targetX = targetCoords.x;
                                pawn.targetY = targetCoords.y;
                                pawn.animStartTime = time;
                                
                                if (!pawn.isBeaten) audioManager.play('step');
                            } else {
                                // Final destination reached
                                pawn.isAnimating = false;
                                
                                if (!pawn.isBeaten) {
                                    // Check for safe spot or win
                                    const safeSpots = [16, 24, 29, 37, 42, 50, 55, 63];
                                    const winSpots = { red: 73, blue: 79, yellow: 85, green: 91 };
                                    
                                    if (pawn.position === winSpots[pawn.color]) {
                                        audioManager.play('panta');
                                    } else if (safeSpots.includes(pawn.position)) {
                                        audioManager.play('safe');
                                    }
                                }
                            }
                        }
                    }
                    
                    pawn.x = currentX;
                    pawn.y = currentY;
                }

                const isValidToMove = canInteractWithColor(pawn.color) && effectiveRolledNumber && canPawnMove(pawn, effectiveRolledNumber);
                pawn.touchableArea = paintPawn(ctx, pawn, currentX, currentY, isValidToMove);
            });

            if (hintPawn) {
                const { x, y } = positionMapCoords[hintPawn.position];
                paintPawn(ctx, hintPawn, x, y);
            }

            animationFrameRef.current = requestAnimationFrame(renderLoop);
        };

        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [hintPawn, nowMoving, effectiveRolledNumber, localColor, rotationAngle, players, playerContext.playerId]);

    return (
        <canvas
            className='canvas-container'
            style={{ transform: `rotate(${rotationAngle}deg)`, transition: 'transform 0.5s ease' }}
            width={460}
            height={460}
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
        />
    );
};
export default Map;
