const { expect } = require('chai');
const RoomModel = require('../../models/room');

describe('Ludo Game Rules and Edge Cases', function () {
    let room;

    beforeEach(function () {
        room = new RoomModel();
        room.players = [];
        room.pawns.forEach(pawn => {
            pawn.position = pawn.basePos;
        });
    });

    describe('Pawn Release from Base', function () {
        it('should NOT allow a pawn to leave the base if roll is not 6', function () {
            const redPawn = room.pawns[0]; // Red pawn
            expect(redPawn.canMove(5)).to.be.false;
            expect(redPawn.canMove(1)).to.be.false;
        });

        it('should allow a pawn to leave the base if roll is 6', function () {
            const redPawn = room.pawns[0]; // Red pawn
            expect(redPawn.canMove(6)).to.be.true;
        });

        it('should place pawns on correct starting positions when released with 6', function () {
            const redPawn = room.pawns[0]; // basePos 0
            const bluePawn = room.pawns[4]; // basePos 4
            const yellowPawn = room.pawns[8]; // basePos 8
            const greenPawn = room.pawns[12]; // basePos 12

            expect(redPawn.getPositionAfterMove(6)).to.equal(16);
            expect(bluePawn.getPositionAfterMove(6)).to.equal(55);
            expect(yellowPawn.getPositionAfterMove(6)).to.equal(42);
            expect(greenPawn.getPositionAfterMove(6)).to.equal(29);
        });
    });

    describe('Normal Movement Path & Wrap Around', function () {
        it('should move active pawn forward by rolled number', function () {
            const redPawn = room.pawns[0];
            redPawn.position = 16; // Start position
            expect(redPawn.canMove(4)).to.be.true;
            expect(redPawn.getPositionAfterMove(4)).to.equal(20);
        });

        it('should wrap around the board at tile 67 for blue, yellow, and green pawns', function () {
            const bluePawn = room.pawns[4];
            bluePawn.position = 66;
            // Blue track wraps around from 67 to 16 (since 16 is red start)
            // 66 + 3 -> 67 -> wraps to 16 + 1 = 17
            // getPositionAfterMove(3) for blue:
            // 66 + 3 = 69 > 67 => returns 69 - 52 = 17
            expect(bluePawn.getPositionAfterMove(3)).to.equal(17);
        });
    });

    describe('Safe Zones', function () {
        it('should NOT allow beating a pawn if it is on a safe zone tile', function () {
            // Safe zones: 16, 24, 29, 37, 42, 50, 55, 63
            const redPawn = room.pawns[0];
            redPawn.position = 16; // Safe zone
            const cut = room.beatPawns(16, 'blue');
            expect(cut).to.be.false;
            expect(redPawn.position).to.equal(16); // Remains at 16
        });

        it('should allow beating a pawn if it is on a regular path tile', function () {
            const redPawn = room.pawns[0];
            redPawn.position = 20; // Non-safe zone
            const cut = room.beatPawns(20, 'blue');
            expect(cut).to.be.true;
            expect(redPawn.position).to.equal(redPawn.basePos); // Sent to base
        });
    });

    describe('Blocks Protection', function () {
        it('should NOT beat pawns if they form a same-color block (2+ pawns of same color)', function () {
            room.pawns[0].position = 20; // Red pawn 1
            room.pawns[1].position = 20; // Red pawn 2
            const cut = room.beatPawns(20, 'blue');
            expect(cut).to.be.false;
            expect(room.pawns[0].position).to.equal(20);
            expect(room.pawns[1].position).to.equal(20);
        });

        it('should NOT beat pawns if they form a team block in Team Mode (2+ pawns of same team)', function () {
            room.teamMode = true;
            room.pawns[0].position = 20; // Red pawn
            room.pawns[8].position = 20; // Yellow pawn (Teammate)
            const cut = room.beatPawns(20, 'blue');
            expect(cut).to.be.false;
            expect(room.pawns[0].position).to.equal(20);
            expect(room.pawns[8].position).to.equal(20);
        });
    });

    describe('Team Mode Trap (Shield Loss) Mechanic', function () {
        it('should trigger shield loss (trap) when teammate leaves spot containing opponent', function () {
            room.teamMode = true;
            // Place red pawn (team 1) and yellow pawn (team 1) on tile 20, along with a blue pawn (team 2)
            room.pawns[0].position = 20; // Red (team 1)
            room.pawns[8].position = 20; // Yellow (team 1)
            room.pawns[4].position = 20; // Blue (team 2)

            // Red pawn moves away from 20 to 25
            room.rolledNumber = 5;
            room.movePawn(room.pawns[0]);

            // Yellow pawn should be trapped and sent back to base because it was left alone with the opponent (Blue)
            expect(room.pawns[0].position).to.equal(25);
            expect(room.pawns[8].position).to.equal(room.pawns[8].basePos); // Beaten/Trapped!
            expect(room.pawns[4].position).to.equal(20); // Blue remains
        });
    });

    describe('Home Stretch & Goal protection', function () {
        it('should correctly enter color-specific home stretch and NOT overshoot goal', function () {
            // Red home is 73
            const redPawn = room.pawns[0];
            redPawn.position = 71;
            expect(redPawn.canMove(3)).to.be.false; // 71 + 3 = 74 (overshoot)
            expect(redPawn.getPositionAfterMove(3)).to.equal(71);

            expect(redPawn.canMove(2)).to.be.true; // 71 + 2 = 73 (exact win)
            expect(redPawn.getPositionAfterMove(2)).to.equal(73);
        });

        it('should allow Green pawn to reach its home stretch (86 to 91) and win at 91', function () {
            const greenPawn = room.pawns[12];
            greenPawn.position = 27;
            // Roll 6 from 27 should enter home stretch at 27 + 6 + 58 = 91
            expect(greenPawn.getPositionAfterMove(6)).to.equal(91);

            greenPawn.position = 88;
            expect(greenPawn.canMove(3)).to.be.true; // 88 + 3 = 91
            expect(greenPawn.getPositionAfterMove(3)).to.equal(91);
        });

        it('should allow Yellow pawn to reach its home stretch (80 to 85) and win at 85', function () {
            const yellowPawn = room.pawns[8];
            yellowPawn.position = 40;
            // Roll 5 from 40 should enter home stretch at 40 + 5 + 39 = 84
            expect(yellowPawn.getPositionAfterMove(5)).to.equal(84);

            yellowPawn.position = 84;
            expect(yellowPawn.canMove(1)).to.be.true; // 84 + 1 = 85
            expect(yellowPawn.getPositionAfterMove(1)).to.equal(85);
        });

        it('should determine the winner correctly when all 4 pawns of a color are home', function () {
            // Set all 4 red pawns to 73
            room.pawns[0].position = 73;
            room.pawns[1].position = 73;
            room.pawns[2].position = 73;
            room.pawns[3].position = 73;
            expect(room.getWinner()).to.equal('red');
        });

        it('should determine the team winner correctly when both teammates have all pawns home', function () {
            room.teamMode = true;
            // Set all 4 red pawns to 73
            room.pawns[0].position = 73;
            room.pawns[1].position = 73;
            room.pawns[2].position = 73;
            room.pawns[3].position = 73;

            // Set all 4 yellow pawns to 85 (yellow home is 85)
            room.pawns[8].position = 85;
            room.pawns[9].position = 85;
            room.pawns[10].position = 85;
            room.pawns[11].position = 85;

            expect(room.getWinner()).to.equal('red & yellow');
        });
    });

    describe('Turn Order & Teammate Delegation', function () {
        beforeEach(function () {
            room.addPlayer('Player1', 'p1'); // Red
            room.addPlayer('Player2', 'p2'); // Blue
            room.addPlayer('Player3', 'p3'); // Green
            room.addPlayer('Player4', 'p4'); // Yellow
        });

        it('should rotate turns clockwise (Red -> Green -> Yellow -> Blue)', function () {
            // Red starts moving
            room.players[0].nowMoving = true;
            
            // Red's turn ends -> Green should move
            room.changeMovingPlayer();
            expect(room.players.find(p => p.color === 'green').nowMoving).to.be.true;

            // Green's turn ends -> Yellow should move
            room.changeMovingPlayer();
            expect(room.players.find(p => p.color === 'yellow').nowMoving).to.be.true;

            // Yellow's turn ends -> Blue should move
            room.changeMovingPlayer();
            expect(room.players.find(p => p.color === 'blue').nowMoving).to.be.true;

            // Blue's turn ends -> Red should move
            room.changeMovingPlayer();
            expect(room.players.find(p => p.color === 'red').nowMoving).to.be.true;
        });

        it('should delegate turn to teammate in Team Mode if player pawns are all home', function () {
            room.teamMode = true;
            // Red is now moving
            room.players[0].nowMoving = true;
            
            // Set all 4 red pawns to home (73)
            room.pawns[0].position = 73;
            room.pawns[1].position = 73;
            room.pawns[2].position = 73;
            room.pawns[3].position = 73;

            // Red rolls a 2
            room.rolledNumber = 2;

            // Since all red pawns are home, Red should be able to move Yellow's pawns
            const pawnsThatCanMove = room.getPawnsThatCanMove();
            expect(pawnsThatCanMove.every(p => p.color === 'yellow')).to.be.true;
        });
    });
});
