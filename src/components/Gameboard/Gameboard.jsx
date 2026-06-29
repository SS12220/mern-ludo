import React, { useState, useEffect, useContext } from 'react';
import ReactLoading from 'react-loading';
import { PlayerDataContext, SocketContext } from '../../App';
import useSocketData from '../../hooks/useSocketData';
import Map from './Map/Map';
import Navbar from '../Navbar/Navbar';
import Lobby from '../Lobby/Lobby';
import Overlay from '../Overlay/Overlay';
import styles from './Gameboard.module.css';
import trophyImage from '../../images/trophy.webp';

const Gameboard = () => {
    const socket = useContext(SocketContext);
    const context = useContext(PlayerDataContext);
    const [pawns, setPawns] = useState([]);
    const [players, setPlayers] = useState([]);

    const [rolledNumber, setRolledNumber] = useSocketData('game:roll');
    const [time, setTime] = useState();
    const [isReady, setIsReady] = useState();
    const [nowMoving, setNowMoving] = useState(false);
    const [started, setStarted] = useState(false);

    const [movingPlayer, setMovingPlayer] = useState('red');

    const [winner, setWinner] = useState(null);
    
    // Admin state
    const [adminId, setAdminId] = useState(null);
    const [isPaused, setIsPaused] = useState(false);
    const [timerEnabled, setTimerEnabled] = useState(true);
    const [teamMode, setTeamMode] = useState(false);

    useEffect(() => {
        socket.emit('room:data', context.roomId);
        socket.on('room:data', data => {
            data = JSON.parse(data);
            if (data.players == null) return;
            // Filling navbar with empty player nick container
            while (data.players.length !== 4) {
                data.players.push({ name: '...' });
            }
            // Checks if client is currently moving player by session ID
            const nowMovingPlayer = data.players.find(player => player.nowMoving === true);
            if (nowMovingPlayer) {
                if (nowMovingPlayer._id === context.playerId || (data.adminId === context.playerId && nowMovingPlayer.name.startsWith('Local Player'))) {
                    setNowMoving(true);
                } else {
                    setNowMoving(false);
                }
                setMovingPlayer(nowMovingPlayer.color);
            }
            const currentPlayer = data.players.find(player => player._id === context.playerId);
            setIsReady(currentPlayer.ready);
            setRolledNumber(data.rolledNumber);
            setPlayers(data.players);
            setPawns(data.pawns);
            setTime(data.nextMoveTime);
            setStarted(data.started);
            setAdminId(data.adminId);
            setIsPaused(data.isPaused);
            setTimerEnabled(data.timerEnabled);
            setTeamMode(data.teamMode);
        });

        socket.on('game:winner', winner => {
            setWinner(winner);
        });
        socket.on('redirect', () => {
            window.location.reload();
        });
        socket.on('game:stopped', () => {
            socket.emit('player:exit');
        });

    }, [socket, context.playerId, context.roomId, setRolledNumber]);

    const myPlayer = players.find(p => p._id === context.playerId);
    const myColor = myPlayer ? myPlayer.color : context.color;

    return (
        <>
            {pawns.length === 16 ? (
                <div className='container'>
                    {!started ? (
                        <Lobby players={players} adminId={adminId} teamMode={teamMode} />
                    ) : (
                        <>
                            <Navbar
                                players={players}
                                started={started}
                                time={time}
                                isReady={isReady}
                                movingPlayer={movingPlayer}
                                rolledNumber={rolledNumber}
                                nowMoving={nowMoving}
                                ended={winner !== null}
                                adminId={adminId}
                                isPaused={isPaused}
                                timerEnabled={timerEnabled}
                                localColor={myColor}
                            />
                            <Map pawns={pawns} nowMoving={nowMoving} rolledNumber={rolledNumber} localColor={myColor} players={players} />
                        </>
                    )}
                </div>
            ) : (
                <ReactLoading type='spinningBubbles' color='white' height={667} width={375} />
            )}
            {winner ? (
                <Overlay>
                    <div className={styles.winnerContainer}>
                        <img src={trophyImage} alt='winner' />
                        <h1>
                            1st: <span style={{ color: winner }}>{winner}</span>
                        </h1>
                        <button onClick={() => socket.emit('player:exit')}>Play again</button>
                    </div>
                </Overlay>
            ) : null}
        </>
    );
};

export default Gameboard;
