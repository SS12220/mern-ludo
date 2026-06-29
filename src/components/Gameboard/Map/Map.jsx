import React, { useEffect, useRef, useState, useContext } from 'react';
import { PlayerDataContext, SocketContext } from '../../../App';

import mapImageSrc from '../../../images/map.jpg';
import positionMapCoords from '../positions';
import pawnImagesSrc from '../../../constants/pawnImages';
import canPawnMove from './canPawnMove';
import getPositionAfterMove from './getPositionAfterMove';

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
        const newVisualPawns = pawns.map(p => {
            const existing = visualPawnsRef.current.find(vp => vp._id === p._id);
            const targetCoords = positionMapCoords[p.position];
            
            if (existing && existing.position !== p.position) {
                // Pawn moved, start animation
                return {
                    ...p,
                    startX: existing.x,
                    startY: existing.y,
                    targetX: targetCoords.x,
                    targetY: targetCoords.y,
                    x: existing.x,
                    y: existing.y,
                    animStartTime: performance.now(),
                    isAnimating: true
                };
            } else if (existing) {
                // No movement
                return { ...p, x: existing.x, y: existing.y, isAnimating: existing.isAnimating, animStartTime: existing.animStartTime, startX: existing.startX, startY: existing.startY, targetX: existing.targetX, targetY: existing.targetY };
            } else {
                // Initial load
                return { ...p, x: targetCoords.x, y: targetCoords.y, isAnimating: false };
            }
        });
        visualPawnsRef.current = newVisualPawns;
    }, [pawns]);

    const paintPawn = (context, pawn, x, y, isValidToMove = false) => {
        const touchableArea = new Path2D();
        touchableArea.arc(x, y, 12, 0, 2 * Math.PI);

        if (isValidToMove) {
            context.beginPath();
            context.arc(x, y, 18, 0, 2 * Math.PI);
            context.fillStyle = 'rgba(255, 255, 0, 0.6)';
            context.shadowBlur = 15;
            context.shadowColor = 'yellow';
            context.fill();
            context.shadowBlur = 0;
        }

        const image = loadedPawnImages[pawn.color];
        if (image && image.complete) {
            context.save();
            context.translate(x, y);
            context.rotate(-rotationAngle * Math.PI / 180);
            context.drawImage(image, -17, -15, 35, 30);
            context.restore();
        }
        return touchableArea;
    };

    const handleCanvasClick = event => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const cursorX = event.nativeEvent.offsetX;
        const cursorY = event.nativeEvent.offsetY;
        
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
        const x = event.nativeEvent.offsetX;
        const y = event.nativeEvent.offsetY;
        
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

            // Draw Map with swapped Green/Yellow houses
            if (mapImage.complete) {
                // 1. Draw the left half normally (Red TL, Blue BL)
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, 230, 460); 
                ctx.clip();
                ctx.drawImage(mapImage, 0, 0);
                ctx.restore();

                // 2. Draw TR quadrant using the BR (Green) quadrant rotated -90 deg
                ctx.save();
                ctx.beginPath();
                ctx.rect(230, 0, 230, 230);
                ctx.clip();
                ctx.translate(230, 230);
                ctx.rotate(-90 * Math.PI / 180);
                ctx.translate(-230, -230);
                ctx.drawImage(mapImage, 0, 0);
                ctx.restore();

                // 3. Draw BR quadrant using the TR (Yellow) quadrant rotated +90 deg
                ctx.save();
                ctx.beginPath();
                ctx.rect(230, 230, 230, 230);
                ctx.clip();
                ctx.translate(230, 230);
                ctx.rotate(90 * Math.PI / 180);
                ctx.translate(-230, -230);
                ctx.drawImage(mapImage, 0, 0);
                ctx.restore();
            }

            // Draw safe positions
            const safePositions = [16, 24, 29, 37, 42, 50, 55, 63];
            safePositions.forEach(pos => {
                const { x, y } = positionMapCoords[pos];
                ctx.beginPath();
                ctx.arc(x, y, 16, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(128, 128, 128, 0.6)';
                ctx.fill();
            });

            // Update & Draw Pawns
            visualPawnsRef.current.forEach((pawn, index) => {
                let currentX = pawn.x;
                let currentY = pawn.y;

                if (pawn.isAnimating) {
                    const elapsed = time - pawn.animStartTime;
                    const duration = 400; // ms
                    const progress = Math.min(elapsed / duration, 1);
                    
                    // Easing (ease-out cubic)
                    const easeOut = 1 - Math.pow(1 - progress, 3);
                    
                    currentX = pawn.startX + (pawn.targetX - pawn.startX) * easeOut;
                    currentY = pawn.startY + (pawn.targetY - pawn.startY) * easeOut;

                    if (progress === 1) {
                        pawn.isAnimating = false;
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
