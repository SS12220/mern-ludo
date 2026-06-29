const { getRoom, updateRoom } = require('../services/roomService');
const { COLORS } = require('../utils/constants');

module.exports = socket => {
    const req = socket.request;

    const handleLogin = async data => {
        const room = await getRoom(data.roomId);
        if (room.isFull()) return socket.emit('error:changeRoom');
        if (room.started) return socket.emit('error:changeRoom');
        if (room.private && room.password !== data.password) return socket.emit('error:wrongPassword');
        addPlayerToExistingRoom(room, data);
    };

    const handleExit = async () => {
        req.session.reload(err => {
            if (err) return socket.disconnect();
            req.session.destroy();
            socket.emit('redirect');
        });
    };

    const handleReady = async () => {
        const room = await getRoom(req.session.roomId);
        room.getPlayer(req.session.playerId).changeReadyStatus();
        if (room.canStartGame()) {
            room.startGame();
        }
        await updateRoom(room);
    };

    const addPlayerToExistingRoom = async (room, data) => {
        room.addPlayer(data.name);
        if (room.isFull()) {
            room.startGame();
        }
        await updateRoom(room);
        reloadSession(room);
    };

    const reloadSession = room => {
        req.session.reload(err => {
            if (err) return socket.disconnect();
            req.session.roomId = room._id.toString();
            req.session.playerId = room.players[room.players.length - 1]._id.toString();
            req.session.color = COLORS[room.players.length - 1];
            req.session.save();
            socket.join(room._id.toString());
            socket.emit('player:data', JSON.stringify(req.session));
        });
    };

    const handleAddLocalPlayer = async () => {
        const room = await getRoom(req.session.roomId);
        if (!room || room.isFull() || room.started) return;
        if (room.adminId !== req.session.playerId) return;
        
        // Use the admin's session ID but a generated name
        room.addPlayer(`Local Player ${room.players.length}`, req.sessionID);
        if (room.isFull()) {
            room.startGame();
        }
        await updateRoom(room);
        socket.to(room._id.toString()).emit('room:data', JSON.stringify(room));
    };

    const handleChangeColor = async ({ targetPlayerId, newColor }) => {
        const room = await getRoom(req.session.roomId);
        if (!room || room.started) return;
        if (room.adminId !== req.session.playerId) return;

        const targetPlayer = room.players.find(p => p._id.toString() === targetPlayerId);
        if (!targetPlayer) return;

        const oldColor = targetPlayer.color;
        if (oldColor === newColor) return;

        // Find who currently has the newColor and swap with them
        const otherPlayer = room.players.find(p => p.color === newColor);
        if (otherPlayer) {
            otherPlayer.color = oldColor;
        }
        targetPlayer.color = newColor;

        await updateRoom(room);
        
        // Broadcast the update to others
        socket.to(room._id.toString()).emit('room:data', JSON.stringify(room));
        // Emit to the sender as well so their UI immediately reflects the new room data
        socket.emit('room:data', JSON.stringify(room));

        // Update the session safely if the admin's own color changed
        if (targetPlayerId === req.session.playerId || (otherPlayer && otherPlayer._id.toString() === req.session.playerId)) {
            if (targetPlayerId === req.session.playerId) {
                req.session.color = newColor;
            } else {
                req.session.color = oldColor;
            }
            req.session.save(() => {
                socket.emit('player:data', JSON.stringify(req.session));
            });
        }
    };

    socket.on('player:login', handleLogin);
    socket.on('player:ready', handleReady);
    socket.on('player:exit', handleExit);
    socket.on('room:addLocalPlayer', handleAddLocalPlayer);
    socket.on('room:changeColor', handleChangeColor);
};
