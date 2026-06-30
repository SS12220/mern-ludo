module.exports = socket => {
    const handleAudioJoin = (peerId) => {
        const req = socket.request;
        const roomId = req.session && req.session.roomId;
        if (roomId) {
            socket.to(roomId.toString()).emit('audio:user-joined', peerId);
        }
    };

    socket.on('audio:join', handleAudioJoin);
};
