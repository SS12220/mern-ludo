import React, { useEffect, useRef, useState, useContext } from 'react';
import { PlayerDataContext, SocketContext } from '../../../App';

import mapImageSrc from '../../../images/New-UI/Board/Board.svg';
import positionMapCoords from '../positions';
import pawnImagesSrc from '../../../constants/pawnImages';
import pawnRingSrc from '../../../images/New-UI/Pawns/Pawn Bottom Ring.svg';
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

            // We can remove the safe position grey circles since the new board SVG has stars on safe spots natively, 
            // but let's keep them very faint just in case they are useful for hitboxes visually.
            // Actually, the new SVG has beautiful stars, let's not draw ugly grey circles over them!
            // safePositions drawing removed for new UI.

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
