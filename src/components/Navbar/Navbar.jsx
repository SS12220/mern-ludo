import React, { useContext } from 'react';
import Dice from './Dice/Dice';
import NameContainer from './NameContainer/NameContainer';
import ReadyButton from './ReadyButton/ReadyButton';
import { PLAYER_COLORS } from '../../constants/colors';
import { PlayerDataContext, SocketContext } from '../../App';
import styles from './Navbar.module.css';

const Navbar = ({ players, started, time, isReady, rolledNumber, nowMoving, movingPlayer, ended, adminId, isPaused, timerEnabled, localColor, children }) => {
    const context = useContext(PlayerDataContext);
    const socket = useContext(SocketContext);

    const diceProps = {
        rolledNumber,
        nowMoving,
        movingPlayer,
    };

    const isAdmin = context.playerId === adminId;
    const [showAdminMenu, setShowAdminMenu] = React.useState(false);

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

    const getPositionalClass = (targetColor, localColor) => {
        const layouts = {
            blue: { red: 'TL', green: 'TR', blue: 'BL', yellow: 'BR' },
            red: { red: 'BL', green: 'TL', blue: 'BR', yellow: 'TR' },
            green: { red: 'BR', green: 'BL', blue: 'TR', yellow: 'TL' },
            yellow: { red: 'TR', green: 'BR', blue: 'TL', yellow: 'BL' }
        };
        const currentLayout = layouts[localColor] || layouts.blue;
        return currentLayout[targetColor] || 'TL';
    };

    // First, determine the assigned colors for all 4 slots safely
    const assignedColors = players.map((p, i) => p.color);
    // Find unused colors to assign to empty slots
    const unusedColors = PLAYER_COLORS.filter(c => !assignedColors.includes(c));
    let unusedIndex = 0;
    const finalColors = players.map((p, i) => {
        if (p.color) return p.color;
        // Assign the next available unused color
        return unusedColors[unusedIndex++];
    });

    const renderDice = (position) => {
        const playerIndex = players.findIndex((p, i) => {
            const assignedColor = finalColors[i];
            return getPositionalClass(assignedColor, localColor) === position;
        });

        if (playerIndex === -1) return <div className={styles.playerContainer}></div>;
        
        const player = players[playerIndex];
        const isLocalSlotEmpty = player.name === '...';
        const assignedColor = finalColors[playerIndex];
        
        return (
            <div className={styles.playerContainer} key={`dice-${position}`}>
                {/* Empty slot in lobby -> Add local player */}
                {isAdmin && !started && isLocalSlotEmpty && (
                    <button onClick={() => socket.emit('room:addLocalPlayer')} style={{ padding: '5px', fontSize: '12px', zIndex: 20 }}>
                        + Local Player
                    </button>
                )}

                {/* Kick Player */}
                {isAdmin && !isLocalSlotEmpty && player._id && player._id !== adminId && (
                    <button onClick={() => socket.emit('game:kick', player._id)} style={{ position: 'absolute', top: -10, right: -10, background: 'red', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '2px 5px', zIndex: 20 }}>
                        Kick
                    </button>
                )}

                {started && !ended && !isLocalSlotEmpty ? <Dice playerColor={assignedColor} {...diceProps} time={time} /> : null}
                {localColor === player.color && !started && !isAdmin && !player.name.startsWith('Local Player') ? <ReadyButton isReady={isReady} /> : null}
            </div>
        );
    };

    const renderName = (position) => {
        const playerIndex = players.findIndex((p, i) => {
            const assignedColor = finalColors[i];
            return getPositionalClass(assignedColor, localColor) === position;
        });

        if (playerIndex === -1) return null;
        
        const player = players[playerIndex];
        const isLocalSlotEmpty = player.name === '...';
        
        if (isLocalSlotEmpty) return null;

        return <NameContainer key={`name-${position}`} player={player} started={started} position={position} />;
    };

    return (
        <div className={styles.gameLayout}>
            {/* Admin Game Controls */}
            {isAdmin && (
                <div className={styles.adminControlsOverlay} style={{ right: '10px', left: 'auto', top: '10px' }}>
                    <button 
                        onClick={() => setShowAdminMenu(!showAdminMenu)} 
                        style={{ padding: '8px 12px', cursor: 'pointer', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '8px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        ☰ 
                    </button>
                    {showAdminMenu && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#222', border: '1px solid #444', borderRadius: '8px', display: 'flex', flexDirection: 'column', width: '180px', zIndex: 1000, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                            {!started && players.length > 1 && (
                                <button onClick={() => { socket.emit('game:start'); setShowAdminMenu(false); }} style={{ padding: '12px', cursor: 'pointer', background: '#28a745', color: '#fff', border: 'none', textAlign: 'left', borderBottom: '1px solid #444', fontWeight: 'bold' }}>
                                    Start Game
                                </button>
                            )}
                            {started && !ended && (
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

            <div className={styles.playersRow}>
                {renderDice('TL')}
                {renderDice('TR')}
            </div>

            <div className={styles.boardWrapper}>
                {renderName('TL')}
                {renderName('TR')}
                {children}
                {renderName('BL')}
                {renderName('BR')}
            </div>

            <div className={styles.playersRow}>
                {renderDice('BL')}
                {renderDice('BR')}
            </div>
        </div>
    );
};

export default Navbar;
