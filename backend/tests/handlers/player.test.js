const { io } = require('socket.io-client');
const { expect } = require('chai');
const { server, getHttpServer } = require('../../server');
const mongoose = require('mongoose');

const socketURL = `http://localhost:${process.env.PORT || 8080}`;
const options = {
    transports: ['websocket'],
    'force new connection': true,
};

describe('Testing player socket handlers', function () {
    let firstPlayer, secondPlayer;

    before(async function () {
        // Wait for mongoose connection from server.js
        while (mongoose.connection.readyState !== 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        firstPlayer = io.connect(socketURL, options);
        secondPlayer = io.connect(socketURL, options);

        // Wait for socket connections
        await new Promise((resolve) => {
            const check = () => {
                if (firstPlayer.connected && secondPlayer.connected) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });

        await assertDatabaseIsClear();
    });
    const assertDatabaseIsClear = async () => {
        const collectionInfo = await mongoose.connection.db.listCollections({ name: 'rooms' }).next();
        if (collectionInfo) await mongoose.connection.collections.rooms.drop();
    };
    beforeEach(function (done) {
        firstPlayer.off('room:data');
        secondPlayer.off('room:data');
        firstPlayer.off('player:data');
        secondPlayer.off('player:data');
        done();
    });

    after(async function () {
        if (firstPlayer.connected) {
            firstPlayer.disconnect();
        }
        if (secondPlayer.connected) {
            secondPlayer.disconnect();
        }
        const httpServer = getHttpServer();
        if (httpServer) {
            httpServer.close();
        }
        await assertDatabaseIsClear();
        await mongoose.connection.close();
    });

    it('should return credentials when joining room', function (done) {
        firstPlayer.emit('player:login', { name: 'test1' });
        firstPlayer.on('player:data', data => {
            data = JSON.parse(data);
            expect(data).to.have.property('roomId');
            expect(data).to.have.property('playerId');
            expect(data).to.have.property('color');
            expect(data.color).to.equal('red');
            done();
        });
    });

    it('should correctly join player to room', function (done) {
        firstPlayer.emit('room:data');
        firstPlayer.on('room:data', data => {
            data = JSON.parse(data);
            expect(data.players[0].name).to.equal('test1');
            done();
        });
    });

    it('should correctly join player to existing room', function (done) {
        secondPlayer.emit('player:login', { name: 'test2' });
        secondPlayer.on('player:data', data => {
            data = JSON.parse(data);
            expect(data.color).to.equal('blue');
            secondPlayer.emit('room:data');
        });
        secondPlayer.on('room:data', data => {
            data = JSON.parse(data);
            expect(data.players[1].name).to.equal('test2');
            done();
        });
    });

    it('should correctly change player ready status to true', function (done) {
        firstPlayer.emit('player:ready');
        firstPlayer.on('room:data', data => {
            data = JSON.parse(data);
            const player = data.players.find(player => player.name === 'test1');
            expect(player.ready).to.equal(true);
            done();
        });
    });

    it('should correctly change player ready status to false', function (done) {
        firstPlayer.emit('player:ready');
        firstPlayer.on('room:data', data => {
            data = JSON.parse(data);
            const player = data.players.find(player => player.name === 'test1');
            expect(player.ready).to.equal(false);
            done();
        });
    });

    it('should correctly change second player ready status to true', function (done) {
        secondPlayer.emit('player:ready');
        secondPlayer.on('room:data', data => {
            data = JSON.parse(data);
            const player = data.players.find(player => player.name === 'test2');
            expect(player.ready).to.equal(true);
            done();
        });
    });

    it('should start game', function (done) {
        firstPlayer.emit('player:ready');
        firstPlayer.on('room:data', data => {
            data = JSON.parse(data);
            expect(data.started).to.equal(true);
            done();
        });
    });
});
