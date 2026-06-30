const { sendToPlayersRolledNumber, sendWinner } = require('../socket/emits');

const rollDice = () => {
    const rolledNumber = Math.ceil(Math.random() * 6);
    return rolledNumber;
};

const makeRandomMove = async roomId => {
    const { updateRoom, getRoom } = require('../services/roomService');
    const room = await getRoom(roomId);
    if (room.winner) return;
    if (room.rolledNumber === null) {
        room.rolledNumber = rollDice();
        sendToPlayersRolledNumber(room._id.toString(), room.rolledNumber);
    }

    const pawnsThatCanMove = room.getPawnsThatCanMove();
    let cut = false;
    let isHome = false;
    const rolledSix = room.rolledNumber === 6;

    if (pawnsThatCanMove.length > 0) {
        const randomPawn = pawnsThatCanMove[Math.floor(Math.random() * pawnsThatCanMove.length)];
        const newPositionOfMovedPawn = randomPawn.getPositionAfterMove(room.rolledNumber);
        room.changePositionOfPawn(randomPawn, newPositionOfMovedPawn);
        cut = room.beatPawns(newPositionOfMovedPawn, randomPawn.color);
        isHome = [73, 79, 85, 91].includes(newPositionOfMovedPawn);
    }
    
    if (pawnsThatCanMove.length > 0 && (cut || isHome || rolledSix)) {
        room.rolledNumber = null;
        const timeoutManager = require('../models/timeoutManager');
        const { MOVE_TIME } = require('../utils/constants');
        timeoutManager.clear(room._id.toString());
        timeoutManager.set(makeRandomMove, MOVE_TIME, room._id.toString());
    } else {
        room.changeMovingPlayer();
    }
    const winner = room.getWinner();
    if (winner) {
        room.endGame(winner);
        sendWinner(room._id.toString(), winner);
    }
    await updateRoom(room);
};

const isMoveValid = (session, pawn, room) => {
    const movingPlayer = room.getCurrentlyMovingPlayer();
    let allowedColor = movingPlayer.color;

    if (room.teamMode) {
        const isRed = movingPlayer.color === 'red';
        const isBlue = movingPlayer.color === 'blue';
        const isGreen = movingPlayer.color === 'green';
        
        const homePos = isRed ? 73 : isBlue ? 79 : isGreen ? 91 : 85;
        const playerPawns = room.getPlayerPawns(movingPlayer.color);
        const allHome = playerPawns.filter(p => p.position === homePos).length === 4;

        if (allHome) {
            const pairs = { red: 'yellow', yellow: 'red', blue: 'green', green: 'blue' };
            allowedColor = pairs[movingPlayer.color];
        }
    }
    
    // Check if the sender is exactly the moving player
    if (session.playerId === movingPlayer._id.toString()) {
        return pawn.color === allowedColor;
    }
    
    // Check if the sender is the Admin and the moving player is a Local Player
    if (room.adminId === session.playerId && movingPlayer.name.startsWith('Local Player')) {
        return pawn.color === allowedColor;
    }
    
    return false;
};

module.exports = { rollDice, makeRandomMove, isMoveValid };
