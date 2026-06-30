const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PlayerSchema = new Schema({
    sessionID: String,
    name: String,
    color: String,
    ready: { type: Boolean, default: false },
    nowMoving: { type: Boolean, default: false },
    consecutiveSixes: { type: Number, default: 0 },
});

PlayerSchema.methods.changeReadyStatus = function () {
    this.ready = !this.ready;
};

PlayerSchema.methods.canMove = function (room, rolledNumber) {
    let playerPawns = room.getPlayerPawns(this.color);

    if (room.teamMode) {
        const isRed = this.color === 'red';
        const isBlue = this.color === 'blue';
        const isGreen = this.color === 'green';
        const isYellow = this.color === 'yellow';

        const homePos = isRed ? 73 : isBlue ? 79 : isGreen ? 91 : 85;
        const allHome = playerPawns.filter(p => p.position === homePos).length === 4;

        if (allHome) {
            const pairs = { red: 'yellow', yellow: 'red', blue: 'green', green: 'blue' };
            const teammateColor = pairs[this.color];
            playerPawns = room.getPlayerPawns(teammateColor);
        }
    }

    for (const pawn of playerPawns) {
        if (pawn.canMove(rolledNumber)) return true;
    }
    return false;
};

module.exports = PlayerSchema;
