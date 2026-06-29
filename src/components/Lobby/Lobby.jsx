import React, { useContext } from 'react';
import { PlayerDataContext, SocketContext } from '../../App';
import styles from './Lobby.module.css';

const ALL_COLORS = ['red', 'blue', 'green', 'yellow'];

const Lobby = ({ players, adminId }) => {
    const context = useContext(PlayerDataContext);
    const socket = useContext(SocketContext);

    const isAdmin = context.playerId === adminId;


    const handleChangeColor = (playerId, newColor) => {
        socket.emit('room:changeColor', { targetPlayerId: playerId, newColor });
    };

    return (
        <div className={styles.lobbyContainer}>
            <h1 className={styles.title}>Waiting Room</h1>
            
            <div className={styles.playersList}>
                {players.map((player, index) => {
                    const isEmpty = player.name === '...';
                    const isMe = context.playerId === player._id;
                    const isLocal = player.name.startsWith('Local Player');

                    return (
                        <div key={index} className={`${styles.playerCard} ${styles[player.color || 'empty']}`}>
                            <div className={styles.playerInfo}>
                                {isEmpty ? (
                                    <span className={styles.emptyText}>Empty Slot</span>
                                ) : (
                                    <>
                                        <span className={styles.playerName}>
                                            {player.name} {isMe && '(You)'}
                                        </span>
                                        {/* Ready Status */}
                                        <span className={player.ready ? styles.statusReady : styles.statusWait}>
                                            {player.ready ? 'Ready' : 'Waiting...'}
                                        </span>
                                    </>
                                )}
                            </div>

                            <div className={styles.adminControls}>
                                {isEmpty && isAdmin && (
                                    <button className={styles.btn} onClick={() => socket.emit('room:addLocalPlayer')}>
                                        + Local Player
                                    </button>
                                )}

                                {!isEmpty && isAdmin && (() => {
                                    const activePlayers = players.filter(p => p.name !== '...');
                                    const numPlayers = activePlayers.length;
                                    const usedColors = activePlayers.map(p => p.color);
                                    
                                    if (numPlayers === 2) {
                                        // Case B: 2 players logic
                                        // We restrict the dropdown to only the allowed valid choices, it makes it foolproof.
                                        // The user specifically asked to "Force lock Player 2". Let's lock players who are NOT the Admin.
                                        const isLocked = player._id !== adminId;
                                        
                                        return (
                                            <select
                                                className={styles.colorSelect}
                                                value={player.color}
                                                onChange={(e) => handleChangeColor(player._id, e.target.value)}
                                                disabled={isLocked}
                                            >
                                                {ALL_COLORS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                                            </select>
                                        );
                                    } else {
                                        // Case A: 3 or 4 players logic
                                        // Gray out colors taken by other players
                                        return (
                                            <select
                                                className={styles.colorSelect}
                                                value={player.color}
                                                onChange={(e) => handleChangeColor(player._id, e.target.value)}
                                            >
                                                {ALL_COLORS.map(c => {
                                                    const isTakenByOther = usedColors.includes(c) && c !== player.color;
                                                    return (
                                                        <option key={c} value={c} disabled={isTakenByOther}>
                                                            {c.toUpperCase()} {isTakenByOther ? '(Taken)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        );
                                    }
                                })()}

                                {!isEmpty && isAdmin && !isMe && (
                                    <button className={styles.kickBtn} onClick={() => socket.emit('game:kick', player._id)}>
                                        Kick
                                    </button>
                                )}
                            </div>

                            {/* Ready Button for self, or Admin can ready local players */}
                            {!isEmpty && !player.ready && (isMe || (isAdmin && isLocal)) && (
                                <button className={styles.readyBtn} onClick={() => socket.emit('player:ready')}>
                                    {isMe ? "I'm Ready!" : "Ready Local"}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
            
            <p className={styles.instruction}>
                {isAdmin ? "Wait for players to join, assign colors, and ensure everyone is ready!" : "Wait for the host to start the game."}
            </p>
        </div>
    );
};

export default Lobby;
