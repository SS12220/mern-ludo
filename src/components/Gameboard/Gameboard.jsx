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
import audioManager from '../../utils/audioManager';

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
    const [scale, setScale] = useState(1);
    
    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log("Error attempting to enable fullscreen:", err);
                });
            } else if (document.documentElement.webkitRequestFullscreen) { /* Safari */
                document.documentElement.webkitRequestFullscreen();
            } else if (document.documentElement.msRequestFullscreen) { /* IE11 */
                document.documentElement.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { /* Safari */
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE11 */
                document.msExitFullscreen();
            }
        }
    };

    const calculateScale = () => {
        const padding = 20;
        const availableWidth = window.innerWidth - padding;
        const availableHeight = window.innerHeight - padding;
        
        // Base dimensions: 500 width, 690 height (500 board + 2x 80 dice rows + gap)
        const scaleX = availableWidth / 500;
        const scaleY = availableHeight / 690;
        
        const minScale = Math.min(scaleX, scaleY);
        setScale(Math.min(minScale, 1.5)); // Cap scale at 1.5 for very large screens
    };

    useEffect(() => {
        calculateScale();
        window.addEventListener('resize', calculateScale);
        return () => window.removeEventListener('resize', calculateScale);
    }, []);
    
    // Admin state
    const [adminId, setAdminId] = useState(null);
    const [isPaused, setIsPaused] = useState(false);
    const [timerEnabled, setTimerEnabled] = useState(true);
    const [teamMode, setTeamMode] = useState(false);
    const [showAdminMenu, setShowAdminMenu] = useState(false);

    const isAdmin = !!(adminId && context && context.playerId && context.playerId === adminId);

    const handleReset = () => {
        if (window.confirm("Are you sure you want to reset the game back to the Lobby?")) {
            socket.emit('game:reset');
        }
    };

    const handleStopHosting = () => {
        if (window.confirm("Are you sure you want to stop hosting? Everyone will be disconnected.")) {
            socket.emit('game:stopHosting');
        }
    };

    useEffect(() => {
        if (!socket) return;
        socket.emit('room:data', context.roomId);

        const handleRoomData = data => {
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
            if (currentPlayer) {
                setIsReady(currentPlayer.ready);
            }
            setRolledNumber(data.rolledNumber);
            setPlayers(data.players);
            setPawns(data.pawns);
            setTime(data.nextMoveTime);
            setStarted(data.started);
            setAdminId(data.adminId);
            setIsPaused(data.isPaused);
            setTimerEnabled(data.timerEnabled);
            setTeamMode(data.teamMode);
        };

        const handleWinner = winner => {
            setWinner(winner);
        };

        const handleRedirect = () => {
            window.location.reload();
        };

        const handleStopped = () => {
            socket.emit('player:exit');
        };

        const handleKicked = kickedPlayerId => {
            if (context.playerId === kickedPlayerId) {
                alert("You have been kicked from the lobby.");
                socket.emit('player:exit');
            }
        };

        socket.on('room:data', handleRoomData);
        socket.on('game:winner', handleWinner);
        socket.on('redirect', handleRedirect);
        socket.on('game:stopped', handleStopped);
        socket.on('room:kicked', handleKicked);

        return () => {
            socket.off('room:data', handleRoomData);
            socket.off('game:winner', handleWinner);
            socket.off('redirect', handleRedirect);
            socket.off('game:stopped', handleStopped);
            socket.off('room:kicked', handleKicked);
        };

    }, [socket, context.playerId, context.roomId, setRolledNumber]);

    useEffect(() => {
        if (started) {
            audioManager.play('gamestart');
        }
    }, [started]);

    useEffect(() => {
        if (winner) {
            audioManager.play('congratulations');
        }
    }, [winner]);

    const myPlayer = players.find(p => p._id === context.playerId);
    const myColor = myPlayer ? myPlayer.color : context.color;

    return (
        <>
            {/* Global Controls */}
            <div style={{ position: 'fixed', right: '10px', top: '10px', zIndex: 9999, display: 'flex', gap: '10px' }}>
                <button 
                    onClick={calculateScale} 
                    title="Recalibrate Board Size"
                    style={{ padding: '8px 12px', cursor: 'pointer', background: 'rgba(0, 0, 0, 0.5)', color: '#fff', border: '1px solid #555', borderRadius: '8px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>
                    ⟲
                </button>
                <button 
                    onClick={toggleFullScreen} 
                    title="Toggle Fullscreen"
                    style={{ padding: '8px 12px', cursor: 'pointer', background: 'rgba(0, 0, 0, 0.5)', color: '#fff', border: '1px solid #555', borderRadius: '8px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>
                    ⛶ 
                </button>
            </div>

            {/* Admin Controls Menu (Viewport Anchored) */}
            {isAdmin && (
                <div style={{ position: 'fixed', left: '10px', top: '10px', zIndex: 9999 }}>
                    <button 
                        onClick={() => setShowAdminMenu(!showAdminMenu)} 
                        style={{ padding: '8px 12px', cursor: 'pointer', background: 'rgba(0, 0, 0, 0.5)', color: '#fff', border: '1px solid #555', borderRadius: '8px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', backdropFilter: 'blur(5px)' }}>
                        ☰
                    </button>
                    {showAdminMenu && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: '#222', border: '1px solid #444', borderRadius: '8px', display: 'flex', flexDirection: 'column', width: '180px', zIndex: 10000, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                            {!started && players.filter(p => p.name !== '...').length > 1 && (
                                <button onClick={() => { socket.emit('game:start'); setShowAdminMenu(false); }} style={{ padding: '12px', cursor: 'pointer', background: '#28a745', color: '#fff', border: 'none', textAlign: 'left', borderBottom: '1px solid #444', fontWeight: 'bold' }}>
                                    Start Game
                                </button>
                            )}
                            {started && !winner && (
                                <>
                                    <button onClick={() => { socket.emit('game:pause'); setShowAdminMenu(false); }} style={{ padding: '12px', cursor: 'pointer', background: 'none', color: '#fff', border: 'none', textAlign: 'left', borderBottom: '1px solid #444' }}>
                                        {isPaused ? '▶ Resume Game' : '⏸ Pause Game'}
                                    </button>
                                    <button onClick={() => { socket.emit('game:toggleTimer'); setShowAdminMenu(false); }} style={{ padding: '12px', cursor: 'pointer', background: 'none', color: '#fff', border: 'none', textAlign: 'left', borderBottom: '1px solid #444' }}>
                                        {timerEnabled ? '⏱ Disable Timer' : '⏱ Enable Timer'}
                                    </button>
                                    <button onClick={() => { handleReset(); setShowAdminMenu(false); }} style={{ padding: '12px', cursor: 'pointer', background: 'none', color: '#fff', border: 'none', textAlign: 'left', borderBottom: '1px solid #444' }}>
                                        ↺ Reset to Lobby
                                    </button>
                                    <button onClick={() => { handleStopHosting(); setShowAdminMenu(false); }} style={{ padding: '12px', cursor: 'pointer', background: 'none', color: '#ff4444', border: 'none', textAlign: 'left' }}>
                                        ⏹ Stop Hosting
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {pawns.length === 16 ? (
                <div className='container' style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
                    {!started ? (
                        <Lobby players={players} adminId={adminId} teamMode={teamMode} />
                    ) : (
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
                        >
                            <Map pawns={pawns} nowMoving={nowMoving} rolledNumber={rolledNumber} localColor={myColor} players={players} />
                        </Navbar>
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
