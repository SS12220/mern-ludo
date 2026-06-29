const { getRoom, updateRoom } = require('../services/roomService');
const { sendToPlayersRolledNumber, sendWinner } = require('../socket/emits');
const { rollDice, isMoveValid, makeRandomMove } = require('./handlersFunctions');
const timeoutManager = require('../models/timeoutManager');
const { MOVE_TIME } = require('../utils/constants');

module.exports = socket => {
    const req = socket.request;

    const handleMovePawn = async pawnId => {
        const room = await getRoom(req.session.roomId);
        if (room.winner) return;
        const pawn = room.getPawn(pawnId);
        if (isMoveValid(req.session, pawn, room)) {
            const newPositionOfMovedPawn = pawn.getPositionAfterMove(room.rolledNumber);
            room.changePositionOfPawn(pawn, newPositionOfMovedPawn);
            const cut = room.beatPawns(newPositionOfMovedPawn, req.session.color);
            
            const isHome = [73, 79, 85, 91].includes(newPositionOfMovedPawn);
            const rolledSix = room.rolledNumber === 6;

            if (cut || isHome || rolledSix) {
                room.rolledNumber = null;
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
        }
    };

    const handleRollDice = async () => {
        const rolledNumber = rollDice();
        sendToPlayersRolledNumber(req.session.roomId, rolledNumber);
        const room = await updateRoom({ _id: req.session.roomId, rolledNumber: rolledNumber });
        const player = room.getPlayer(req.session.playerId);
        if (!player.canMove(room, rolledNumber)) {
            room.changeMovingPlayer();
            await updateRoom(room);
        }
    };

    socket.on('game:roll', handleRollDice);
    socket.on('game:move', handleMovePawn);
};
