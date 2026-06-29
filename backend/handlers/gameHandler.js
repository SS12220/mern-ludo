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
            const movingPlayer = room.getCurrentlyMovingPlayer();
            const cut = room.beatPawns(newPositionOfMovedPawn, movingPlayer.color);
            
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
        const room = await getRoom(req.session.roomId);
        const movingPlayer = room.getCurrentlyMovingPlayer();

        let rolledNumber = rollDice();
        
        // Prevent rolling three 6s in a row
        if (movingPlayer.consecutiveSixes >= 2) {
            while (rolledNumber === 6) {
                rolledNumber = rollDice();
            }
        }
        
        if (rolledNumber === 6) {
            movingPlayer.consecutiveSixes += 1;
        } else {
            movingPlayer.consecutiveSixes = 0;
        }

        sendToPlayersRolledNumber(req.session.roomId, rolledNumber);
        room.rolledNumber = rolledNumber;
        await updateRoom(room);
        
        if (!movingPlayer.canMove(room, rolledNumber)) {
            setTimeout(async () => {
                const latestRoom = await getRoom(req.session.roomId);
                if (latestRoom && latestRoom.rolledNumber === rolledNumber) {
                    latestRoom.changeMovingPlayer();
                    await updateRoom(latestRoom);
                }
            }, 1000);
        }
    };

    const handlePauseGame = async () => {
        const room = await getRoom(req.session.roomId);
        if (room.adminId !== req.session.playerId) return;
        room.isPaused = !room.isPaused;
        if (room.isPaused) {
            timeoutManager.clear(room._id.toString());
        } else if (room.timerEnabled && room.nextMoveTime) {
            room.nextMoveTime = Date.now() + MOVE_TIME;
            timeoutManager.set(makeRandomMove, MOVE_TIME, room._id.toString());
        }
        await updateRoom(room);
    };

    const handleToggleTimer = async () => {
        const room = await getRoom(req.session.roomId);
        if (room.adminId !== req.session.playerId) return;
        room.timerEnabled = !room.timerEnabled;
        if (!room.timerEnabled) {
            timeoutManager.clear(room._id.toString());
            room.nextMoveTime = null;
        } else if (!room.isPaused && room.started) {
            room.nextMoveTime = Date.now() + MOVE_TIME;
            timeoutManager.set(makeRandomMove, MOVE_TIME, room._id.toString());
        }
        await updateRoom(room);
    };

    const handleKickPlayer = async (playerIdToKick) => {
        const room = await getRoom(req.session.roomId);
        if (room.adminId !== req.session.playerId) return;
        if (room.adminId === playerIdToKick) return; // Cannot kick self
        
        // Find player and replace with a local bot or just disconnect them
        const playerIndex = room.players.findIndex(p => p._id.toString() === playerIdToKick);
        if (playerIndex !== -1) {
            // Re-assign this player to the admin's session ID, making them a local player
            room.players[playerIndex].sessionID = req.sessionID;
            room.players[playerIndex].name = `Local Player ${playerIndex + 1}`;
            await updateRoom(room);
        }
    };

    const handleResetGame = async () => {
        const room = await getRoom(req.session.roomId);
        if (!room || room.adminId !== req.session.playerId) return;

        // Reset to lobby
        room.started = false;
        room.winner = null;
        room.rolledNumber = null;
        room.nextMoveTime = null;
        room.players.forEach(p => {
            p.ready = false;
            p.nowMoving = false;
        });
        timeoutManager.clear(room._id.toString());
        await updateRoom(room);
    };

    const handleStopHosting = async () => {
        const room = await getRoom(req.session.roomId);
        if (!room || room.adminId !== req.session.playerId) return;

        timeoutManager.clear(room._id.toString());
        
        // Notify everyone to exit properly, which destroys their individual sessions
        socket.to(room._id.toString()).emit('game:stopped');
        socket.emit('game:stopped');

        // Optional: delete room from DB if we want, but for now we just redirect them, which will naturally clear their sessions on reload if room is handled.
        // Assuming there's a Room.findByIdAndDelete, but let's just use redirect for now.
    };

    socket.on('game:roll', handleRollDice);
    socket.on('game:move', handleMovePawn);
    socket.on('game:pause', handlePauseGame);
    socket.on('game:toggleTimer', handleToggleTimer);
    socket.on('game:kick', handleKickPlayer);
    socket.on('game:reset', handleResetGame);
    socket.on('game:stopHosting', handleStopHosting);
};
