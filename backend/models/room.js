const mongoose = require('mongoose');
const { COLORS, MOVE_TIME } = require('../utils/constants');
const { makeRandomMove } = require('../handlers/handlersFunctions');
const timeoutManager = require('./timeoutManager.js');
const PawnSchema = require('./pawn');
const PlayerSchema = require('./player');

const RoomSchema = new mongoose.Schema({
    name: String,
    private: { type: Boolean, default: false },
    password: String,
    createDate: { type: Date, default: Date.now },
    started: { type: Boolean, default: false },
    full: { type: Boolean, default: false },
    nextMoveTime: Number,
    rolledNumber: Number,
    adminId: String,
    isPaused: { type: Boolean, default: false },
    timerEnabled: { type: Boolean, default: false },
    teamMode: { type: Boolean, default: false },
    players: [PlayerSchema],
    winner: { type: String, default: null },
    pawns: {
        type: [PawnSchema],
        default: () => {
            const startPositions = [];
            for (let i = 0; i < 16; i++) {
                let pawn = {};
                pawn.basePos = i;
                pawn.position = i;
                if (i < 4) pawn.color = COLORS[0];
                else if (i < 8) pawn.color = COLORS[1];
                else if (i < 12) pawn.color = COLORS[3];
                else if (i < 16) pawn.color = COLORS[2];
                startPositions.push(pawn);
            }
            return startPositions;
        },
    },
});

RoomSchema.methods.isTeammate = function (color1, color2) {
    if (color1 === color2) return true;
    if (!this.teamMode) return false;
    const pairs = { red: 'yellow', yellow: 'red', blue: 'green', green: 'blue' };
    return pairs[color1] === color2;
};

RoomSchema.methods.beatPawns = function (position, attackingPawnColor) {
    const safeSpots = [16, 24, 29, 37, 42, 50, 55, 63];
    if (safeSpots.includes(position)) return false;

    let cut = false;
    const pawnsOnPosition = this.pawns.filter(pawn => pawn.position === position);

    // Group pawns on this position by team to check for blocks
    const teamCounts = { red_yellow: 0, blue_green: 0 };
    
    pawnsOnPosition.forEach(pawn => {
        if (pawn.color === 'red' || pawn.color === 'yellow') teamCounts.red_yellow++;
        if (pawn.color === 'blue' || pawn.color === 'green') teamCounts.blue_green++;
    });

    pawnsOnPosition.forEach(pawn => {
        if (!this.isTeammate(pawn.color, attackingPawnColor)) {
            const isRedYellow = pawn.color === 'red' || pawn.color === 'yellow';
            const pawnTeamCount = isRedYellow ? teamCounts.red_yellow : teamCounts.blue_green;
            
            // If there are 2 or more pawns of this team (and teamMode is handled correctly), they form a safe block and cannot be killed
            // Wait, if teamMode is OFF, blocks are only formed by EXACT same color.
            let hasBlock = false;
            if (this.teamMode) {
                hasBlock = pawnTeamCount >= 2;
            } else {
                const sameColorCount = pawnsOnPosition.filter(p => p.color === pawn.color).length;
                hasBlock = sameColorCount >= 2;
            }

            if (hasBlock) {
                return; 
            }
            const index = this.getPawnIndex(pawn._id);
            this.pawns[index].position = this.pawns[index].basePos;
            cut = true;
        }
    });
    return cut;
};

RoomSchema.methods.changeMovingPlayer = function (previousColor) {
    if (this.winner) return;
    
    let movingPlayer;
    let playerIndex = -1;
    if (previousColor) {
        movingPlayer = this.players.find(p => p.color === previousColor);
        playerIndex = this.players.findIndex(p => p.color === previousColor);
    } else {
        playerIndex = this.players.findIndex(player => player.nowMoving === true);
        if (playerIndex !== -1) movingPlayer = this.players[playerIndex];
    }
    
    if (movingPlayer) {
        movingPlayer.nowMoving = false;
        movingPlayer.consecutiveSixes = 0;
    } else {
        movingPlayer = this.players[0];
        playerIndex = 0;
    }
    
    const clockwiseOrder = ['red', 'green', 'yellow', 'blue'];
    let currentIndex = clockwiseOrder.indexOf(movingPlayer.color);
    
    let nextPlayer = null;
    let iterations = 0;
    while (!nextPlayer && iterations < 4) {
        currentIndex = (currentIndex + 1) % 4;
        const nextColor = clockwiseOrder[currentIndex];
        nextPlayer = this.players.find(p => p.color === nextColor);
        iterations++;
    }
    
    if (nextPlayer) {
        nextPlayer.nowMoving = true;
    } else {
        if (playerIndex + 1 === this.players.length) {
            this.players[0].nowMoving = true;
        } else {
            this.players[playerIndex + 1].nowMoving = true;
        }
    }
    this.nextMoveTime = this.timerEnabled && !this.isPaused ? Date.now() + MOVE_TIME : null;
    this.rolledNumber = null;
    timeoutManager.clear(this._id.toString());
    if (this.timerEnabled && !this.isPaused) {
        timeoutManager.set(makeRandomMove, MOVE_TIME, this._id.toString());
    }
};

RoomSchema.methods.movePawn = function (pawn) {
    const oldPosition = pawn.position;
    const newPositionOfMovedPawn = pawn.getPositionAfterMove(this.rolledNumber);
    this.changePositionOfPawn(pawn, newPositionOfMovedPawn);
    this.beatPawns(newPositionOfMovedPawn, pawn.color);

    // Team Mode Trap Mechanic
    const safeSpots = [16, 24, 29, 37, 42, 50, 55, 63];
    if (this.teamMode && oldPosition !== pawn.basePos && !safeSpots.includes(oldPosition)) {
        const pawnsOnOld = this.pawns.filter(p => p.position === oldPosition);
        if (pawnsOnOld.length > 0) {
            const teamCounts = { red_yellow: 0, blue_green: 0 };
            pawnsOnOld.forEach(p => {
                if (p.color === 'red' || p.color === 'yellow') teamCounts.red_yellow++;
                if (p.color === 'blue' || p.color === 'green') teamCounts.blue_green++;
            });

            // If there's a mix of teams, someone might have lost their shield
            if (teamCounts.red_yellow > 0 && teamCounts.blue_green > 0) {
                const isMoverRedYellow = pawn.color === 'red' || pawn.color === 'yellow';
                // The team that just moved a pawn away loses their shield if they drop to 1 pawn
                if (isMoverRedYellow && teamCounts.red_yellow === 1) {
                    pawnsOnOld.filter(p => p.color === 'red' || p.color === 'yellow').forEach(p => {
                        const index = this.getPawnIndex(p._id);
                        this.pawns[index].position = this.pawns[index].basePos;
                    });
                } else if (!isMoverRedYellow && teamCounts.blue_green === 1) {
                    pawnsOnOld.filter(p => p.color === 'blue' || p.color === 'green').forEach(p => {
                        const index = this.getPawnIndex(p._id);
                        this.pawns[index].position = this.pawns[index].basePos;
                    });
                }
            }
        }
    }
};

RoomSchema.methods.getPawnsThatCanMove = function () {
    const movingPlayer = this.getCurrentlyMovingPlayer();
    let playerPawns = this.getPlayerPawns(movingPlayer.color);

    if (this.teamMode) {
        const isRed = movingPlayer.color === 'red';
        const isBlue = movingPlayer.color === 'blue';
        const isGreen = movingPlayer.color === 'green';
        const isYellow = movingPlayer.color === 'yellow';

        const homePos = isRed ? 73 : isBlue ? 79 : isGreen ? 91 : 85;
        const allHome = playerPawns.filter(p => p.position === homePos).length === 4;

        if (allHome) {
            const pairs = { red: 'yellow', yellow: 'red', blue: 'green', green: 'blue' };
            const teammateColor = pairs[movingPlayer.color];
            playerPawns = this.getPlayerPawns(teammateColor);
        }
    }

    return playerPawns.filter(pawn => pawn.canMove(this.rolledNumber));
};

RoomSchema.methods.changePositionOfPawn = function (pawn, newPosition) {
    const pawnIndex = this.getPawnIndex(pawn._id);
    this.pawns[pawnIndex].position = newPosition;
};

RoomSchema.methods.canStartGame = function () {
    return this.players.filter(player => player.ready).length >= 2;
};

RoomSchema.methods.startGame = function () {
    this.started = true;
    this.nextMoveTime = this.timerEnabled && !this.isPaused ? Date.now() + MOVE_TIME : null;
    this.players.forEach(player => (player.ready = true));
    this.players[0].nowMoving = true;
    if (this.timerEnabled && !this.isPaused) {
        timeoutManager.set(makeRandomMove, MOVE_TIME, this._id.toString());
    }
};

RoomSchema.methods.endGame = function (winner) {
    timeoutManager.clear(this._id.toString());
    this.rolledNumber = null;
    this.nextMoveTime = null;
    this.players.map(player => (player.nowMoving = false));
    this.winner = winner;
    this.save();
};

RoomSchema.methods.getWinner = function () {
    const redDone = this.pawns.filter(pawn => pawn.color === 'red' && pawn.position === 73).length === 4;
    const blueDone = this.pawns.filter(pawn => pawn.color === 'blue' && pawn.position === 79).length === 4;
    const greenDone = this.pawns.filter(pawn => pawn.color === 'green' && pawn.position === 91).length === 4;
    const yellowDone = this.pawns.filter(pawn => pawn.color === 'yellow' && pawn.position === 85).length === 4;

    if (this.teamMode) {
        if (redDone && yellowDone) return 'red & yellow';
        if (blueDone && greenDone) return 'blue & green';
        return null;
    }

    if (redDone) return 'red';
    if (blueDone) return 'blue';
    if (greenDone) return 'green';
    if (yellowDone) return 'yellow';
    
    return null;
};

RoomSchema.methods.isFull = function () {
    if (this.players.length === 4) {
        this.full = true;
    }
    return this.full;
};

RoomSchema.methods.getPlayer = function (playerId) {
    return this.players.find(player => player._id.toString() === playerId.toString());
};

RoomSchema.methods.addPlayer = function (name, id) {
    if (this.full) return;
    
    let assignedColor;
    if (this.players.length === 1) {
        const firstPlayerColor = this.players[0].color;
        const oppositeColors = { red: 'yellow', yellow: 'red', blue: 'green', green: 'blue' };
        assignedColor = oppositeColors[firstPlayerColor];
    } else {
        const usedColors = this.players.map(p => p.color);
        assignedColor = COLORS.find(c => !usedColors.includes(c));
    }

    this.players.push({
        sessionID: id,
        name: name,
        ready: false,
        color: assignedColor || COLORS[this.players.length],
    });
    if (this.players.length === 1) {
        this.adminId = this.players[0]._id.toString();
    }
};

RoomSchema.methods.getPawnIndex = function (pawnId) {
    return this.pawns.findIndex(pawn => pawn._id.toString() === pawnId.toString());
};

RoomSchema.methods.getPawn = function (pawnId) {
    return this.pawns.find(pawn => pawn._id.toString() === pawnId.toString());
};

RoomSchema.methods.getPlayerPawns = function (color) {
    return this.pawns.filter(pawn => pawn.color === color);
};

RoomSchema.methods.getCurrentlyMovingPlayer = function () {
    return this.players.find(player => player.nowMoving === true);
};

const Room = mongoose.model('Room', RoomSchema);

module.exports = Room;
