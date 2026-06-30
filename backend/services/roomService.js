const Room = require('../models/room');
const { sendToPlayersData } = require('../socket/emits');

const getRoom = async roomId => {
    return await Room.findOne({ _id: roomId }).exec();
};

const getRooms = async () => {
    return await Room.find().exec();
};

const updateRoom = async room => {
    const updatedRoom = await Room.findOneAndUpdate({ _id: room._id }, room, { new: true }).exec();
    sendToPlayersData(updatedRoom);
    return updatedRoom;
};

const getJoinableRoom = async () => {
    return await Room.findOne({ full: false, started: false }).exec();
};

const createNewRoom = async data => {
    const room = new Room(data);
    await room.save();
    sendToPlayersData(room);
    return room;
};

module.exports = { getRoom, getRooms, updateRoom, getJoinableRoom, createNewRoom };
