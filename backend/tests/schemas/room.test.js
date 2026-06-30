const { expect } = require('chai');
const RoomModel = require('../../models/room');
describe('Testing room model methods', function () {
    const room = new RoomModel();

    beforeEach(function () {
        room.players = [];
        room.pawns.forEach(pawn => {
            pawn.position = pawn.basePos;
        });
    });
    it('should correctly beat pawn', function () {
        room.addPlayer('test1', 'player1-session-id');
        room.addPlayer('test2', 'player2-session-id');
        // Place one red pawn on a non-safe spot (e.g. 20)
        room.pawns[0].position = 20;
        room.beatPawns(20, 'green');
        expect(room.pawns[0].position).to.equal(room.pawns[0].basePos);
    });

    it('should correctly beat multiple pawns of different colors', function () {
        // Place a red pawn and a blue pawn on the same non-safe spot (e.g. 20)
        room.pawns[0].position = 20; // red
        room.pawns[4].position = 20; // blue
        room.beatPawns(20, 'green');
        expect(room.pawns[0].position).to.equal(room.pawns[0].basePos);
        expect(room.pawns[4].position).to.equal(room.pawns[4].basePos);
    });

    it('should correctly change moving player from last to first', function () {
        room.addPlayer('test1', 'red');
        room.addPlayer('test2', 'blue');
        room.players[1].nowMoving = true;
        room.changeMovingPlayer();
        expect(room.players[0].nowMoving).to.equal(true);
    });

    it('should correctly change moving player from first to second', function () {
        room.addPlayer('test1', 'red');
        room.addPlayer('test2', 'blue');
        room.players[0].nowMoving = true;
        room.changeMovingPlayer();
        expect(room.players[1].nowMoving).to.equal(true);
    });

    it('should correctly returns pawns that can move', function () {
        room.addPlayer('test1', 'red');
        room.addPlayer('test2', 'blue');
        room.players[0].nowMoving = true;
        room.pawns[0].position = 16;
        room.rolledNumber = 2;
        const pawnsThatCanMove = room.getPawnsThatCanMove();
        expect(pawnsThatCanMove.length).to.equal(1);
    });

    it('should given rolled 6 correctly returns pawns that can move', function () {
        room.addPlayer('test1', 'red');
        room.addPlayer('test2', 'blue');
        room.players[0].nowMoving = true;
        room.pawns[0].position = 16;
        room.rolledNumber = 6;
        const pawnsThatCanMove = room.getPawnsThatCanMove();
        expect(pawnsThatCanMove.length).to.equal(4);
    });
});
