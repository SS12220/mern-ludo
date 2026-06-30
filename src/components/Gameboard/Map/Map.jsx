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

const getCoordsForPawn = (pawnId, targetPosition, allPawns, isFinalDestination) => {
    const baseCoords = positionMapCoords[targetPosition];
    if (!baseCoords) return { x: 0, y: 0 };
    
    let x = baseCoords.x + 20; // 20px padding for 500x500 canvas
    let y = baseCoords.y + 20;

    if (isFinalDestination && targetPosition > 15) {
        const pawnsAtPos = allPawns.filter(p => p.position === targetPosition);
        if (pawnsAtPos.length > 1) {
            pawnsAtPos.sort((a, b) => a._id.localeCompare(b._id));
            const index = pawnsAtPos.findIndex(p => p._id === pawnId);
            
            const offsets = [
                { dx: -7, dy: -7 },
                { dx: 7, dy: 7 },
                { dx: -7, dy: 7 },
                { dx: 7, dy: -7 }
            ];
            
            if (index >= 0 && index < offsets.length) {
                x += offsets[index].dx;
                y += offsets[index].dy;
            }
        }
    }
    return { x, y };
};

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
            const targetCoords = getCoordsForPawn(p._id, p.position, pawns, true);
            
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
                const isFinal = (path.length <= 2);
                const nextCoords = getCoordsForPawn(p._id, nextPos, pawns, isFinal);

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
                const targetCoords = getCoordsForPawn(p._id, p.position, pawns, true);
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
            const width = isValidToMove ? 27.5 : 22;
            const height = isValidToMove ? 37.5 : 30;
            const offsetX = -width / 2;
            const offsetY = -height * 0.8;
            
            context.save();
            context.translate(x, y);
            context.rotate(-rotationAngle * Math.PI / 180);
            context.drawImage(image, offsetX, offsetY, width, height);
            context.restore();
        }
        return touchableArea;
    };

    const handleCanvasClick = event => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const scaleX = 500 / rect.width;
        const scaleY = 500 / rect.height;
        const cursorX_screen = (event.clientX - rect.left) * scaleX;
        const cursorY_screen = (event.clientY - rect.top) * scaleY;

        const angleRad = -(rotationAngle * Math.PI) / 180;
        const dx = cursorX_screen - 250;
        const dy = cursorY_screen - 250;
        
        const cursorX = 250 + dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
        const cursorY = 250 + dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        
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
        const scaleX = 500 / rect.width;
        const scaleY = 500 / rect.height;
        const cursorX_screen = (event.clientX - rect.left) * scaleX;
        const cursorY_screen = (event.clientY - rect.top) * scaleY;

        const angleRad = -(rotationAngle * Math.PI) / 180;
        const dx = cursorX_screen - 230;
        const dy = cursorY_screen - 230;
        
        const x = 230 + dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
        const y = 230 + dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        canvas.style.cursor = 'default';
        for (const pawn of visualPawnsRef.current) {
            if (pawn.touchableArea && ctx.isPointInPath(pawn.touchableArea, x, y) && canInteractWithColor(pawn.color)) {
                if (canPawnMove(pawn, effectiveRolledNumber)) {
                    const pawnPosition = getPositionAfterMove(pawn, effectiveRolledNumber);
                    if (pawnPosition) {
                        canvas.style.cursor = 'pointer';
                        return;
                    }
                }
            }
        }
    };

    useEffect(() => {
        const renderLoop = (time) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            // Clear canvas and apply high DPI scaling
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(2, 2);

            if (mapImage.complete) {
                ctx.drawImage(mapImage, 20, 20, 460, 460);
            }

            // Draw Team Markers
            if (players.length === 4) {
                const drawBadge = (x, y, text, color) => {
                    ctx.save();
                    // Since the canvas is rotated by rotationAngle, we need to counter-rotate the text so it's always upright!
                    // Wait, the canvas itself is rotated via CSS! Not via context.
                    // The context is NOT rotated, so text is drawn upright.
                    ctx.beginPath();
                    ctx.arc(x, y, 12, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#fff';
                    ctx.stroke();
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 14px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(text, x, y + 1); // +1 for visual alignment
                    ctx.restore();
                };

                // Red (TL) - Team B
                drawBadge(192, 192, 'B', '#ff4444');
                // Green (TR) - Team A
                drawBadge(308, 192, 'A', '#28a745');
                // Blue (BL) - Team A
                drawBadge(192, 308, 'A', '#007bff');
                // Yellow (BR) - Team B
                drawBadge(308, 308, 'B', '#ffc107');
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
                                const isFinal = (pawn.pathIndex === pawn.path.length - 1);
                                const targetCoords = getCoordsForPawn(pawn._id, nextPos, visualPawnsRef.current, isFinal);
                                
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

            ctx.restore();
            animationFrameRef.current = requestAnimationFrame(renderLoop);
        };

        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [hintPawn, nowMoving, effectiveRolledNumber, localColor, rotationAngle, players, playerContext.playerId]);

    return (
        <canvas
            className='canvas-container'
            style={{ transform: `rotate(${rotationAngle}deg)`, transition: 'transform 0.5s ease', width: '500px', height: '500px' }}
            width={1000}
            height={1000}
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
        />
    );
};
export default Map;
