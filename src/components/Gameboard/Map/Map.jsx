import React, { useEffect, useRef, useState, useContext } from 'react';
import { PlayerDataContext, SocketContext } from '../../../App';

import mapImage from '../../../images/map.jpg';
import positionMapCoords from '../positions';
import pawnImages from '../../../constants/pawnImages';
import canPawnMove from './canPawnMove';
import getPositionAfterMove from './getPositionAfterMove';

const getVisualPosition = (backendPos, localPlayerColor) => {
    if (!localPlayerColor) return backendPos;
    if (localPlayerColor === 'blue') return backendPos;

    const colorMap = {
        'red':   { 'red': 'blue',   'yellow': 'red',    'green': 'yellow', 'blue': 'green' }, 
        'yellow':{ 'red': 'green',  'yellow': 'blue',   'green': 'red',    'blue': 'yellow' },
        'green': { 'red': 'yellow', 'yellow': 'green',  'green': 'blue',   'blue': 'red' }
    };
    
    // 1. Map Bases (0-15)
    if (backendPos >= 0 && backendPos <= 15) {
        let originalColor;
        if (backendPos >= 0 && backendPos <= 3) originalColor = 'red';
        else if (backendPos >= 4 && backendPos <= 7) originalColor = 'blue';
        else if (backendPos >= 8 && backendPos <= 11) originalColor = 'green';
        else originalColor = 'yellow';

        const visualColor = colorMap[localPlayerColor][originalColor];

        let newBaseStart;
        if (visualColor === 'red') newBaseStart = 0;
        else if (visualColor === 'blue') newBaseStart = 4;
        else if (visualColor === 'green') newBaseStart = 8;
        else newBaseStart = 12;

        return newBaseStart + (backendPos % 4);
    }

    // 2. Map Outer Ring (16-67)
    if (backendPos >= 16 && backendPos <= 67) {
        let originalColor;
        let offsetInQuad;
        if (backendPos >= 16 && backendPos <= 28) { originalColor = 'red'; offsetInQuad = backendPos - 16; }
        else if (backendPos >= 29 && backendPos <= 41) { originalColor = 'yellow'; offsetInQuad = backendPos - 29; }
        else if (backendPos >= 42 && backendPos <= 54) { originalColor = 'green'; offsetInQuad = backendPos - 42; }
        else { originalColor = 'blue'; offsetInQuad = backendPos - 55; }

        const visualColor = colorMap[localPlayerColor][originalColor];

        let newQuadStart;
        if (visualColor === 'red') newQuadStart = 16;
        else if (visualColor === 'yellow') newQuadStart = 29;
        else if (visualColor === 'green') newQuadStart = 42;
        else newQuadStart = 55;

        return newQuadStart + offsetInQuad;
    }

    // 3. Map Home Runs (68-91)
    if (backendPos >= 68 && backendPos <= 91) {
        let homeColor;
        if (backendPos >= 68 && backendPos <= 73) homeColor = 'red';
        else if (backendPos >= 74 && backendPos <= 79) homeColor = 'blue';
        else if (backendPos >= 80 && backendPos <= 85) homeColor = 'green';
        else homeColor = 'yellow';
        
        const visualColor = colorMap[localPlayerColor][homeColor];
        
        let startIdx;
        if (visualColor === 'red') startIdx = 68;
        else if (visualColor === 'blue') startIdx = 74;
        else if (visualColor === 'green') startIdx = 80;
        else startIdx = 86;
        
        const homeStart = (homeColor === 'red') ? 68 : (homeColor === 'blue') ? 74 : (homeColor === 'green') ? 80 : 86;
        const offset = backendPos - homeStart;
        
        return startIdx + offset;
    }
    
    return backendPos;
};

const Map = ({ pawns, nowMoving, rolledNumber }) => {
    const player = useContext(PlayerDataContext);
    const socket = useContext(SocketContext);
    const canvasRef = useRef(null);

    const [hintPawn, setHintPawn] = useState();

    const paintPawn = (context, pawn, isValidToMove = false) => {
        const visualPos = getVisualPosition(pawn.position, player.color);
        const { x, y } = positionMapCoords[visualPos];
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

        const image = new Image();
        image.src = pawnImages[pawn.color];
        image.onload = function () {
            context.drawImage(image, x - 17, y - 15, 35, 30);
        };
        return touchableArea;
    };

    const handleCanvasClick = event => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect(),
            cursorX = event.clientX - rect.left,
            cursorY = event.clientY - rect.top;
        for (const pawn of pawns) {
            if (ctx.isPointInPath(pawn.touchableArea, cursorX, cursorY)) {
                if (canPawnMove(pawn, rolledNumber) && player.color === pawn.color && nowMoving) socket.emit('game:move', pawn._id);
            }
        }
        setHintPawn(null);
    };

    const handleMouseMove = event => {
        if (!nowMoving || !rolledNumber) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect(),
            x = event.clientX - rect.left,
            y = event.clientY - rect.top;
        canvas.style.cursor = 'default';
        for (const pawn of pawns) {
            if (
                ctx.isPointInPath(pawn.touchableArea, x, y) &&
                player.color === pawn.color &&
                canPawnMove(pawn, rolledNumber)
            ) {
                const pawnPosition = getPositionAfterMove(pawn, rolledNumber);
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
        const rerenderCanvas = () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const image = new Image();
            image.src = mapImage;
            image.onload = function () {
                ctx.drawImage(image, 0, 0);

                const safePositions = [16, 24, 29, 37, 42, 50, 55, 63];
                safePositions.forEach(pos => {
                    // Safe areas can also be remapped so they visually match perfectly if the board ever shifts.
                    const visualSafePos = getVisualPosition(pos, player.color);
                    const { x, y } = positionMapCoords[visualSafePos];
                    ctx.beginPath();
                    ctx.arc(x, y, 16, 0, 2 * Math.PI);
                    ctx.fillStyle = 'rgba(128, 128, 128, 0.6)';
                    ctx.fill();
                });

                pawns.forEach((pawn, index) => {
                    const isValidToMove = nowMoving && rolledNumber && player.color === pawn.color && canPawnMove(pawn, rolledNumber);
                    pawns[index].touchableArea = paintPawn(ctx, pawn, isValidToMove);
                });
                if (hintPawn) {
                    paintPawn(ctx, hintPawn);
                }
            };
        };
        rerenderCanvas();
    }, [hintPawn, pawns, nowMoving, rolledNumber, player.color]);

    return (
        <canvas
            className='canvas-container'
            width={460}
            height={460}
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
        />
    );
};
export default Map;
