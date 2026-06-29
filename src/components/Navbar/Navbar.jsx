import React, { useContext } from 'react';
import Dice from './Dice/Dice';
import NameContainer from './NameContainer/NameContainer';
import ReadyButton from './ReadyButton/ReadyButton';
import { PLAYER_COLORS } from '../../constants/colors';
import { PlayerDataContext, SocketContext } from '../../App';
import styles from './Navbar.module.css';

const Navbar = ({ players, started, time, isReady, rolledNumber, nowMoving, movingPlayer, ended, adminId, isPaused, timerEnabled, localColor }) => {
    const context = useContext(PlayerDataContext);
    const socket = useContext(SocketContext);

    const diceProps = {
        rolledNumber,
        nowMoving,
        movingPlayer,
    };

    const isAdmin = context.playerId === adminId;
    const [showEndMenu, setShowEndMenu] = React.useState(false);

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
            blue: { red: 'posTL', yellow: 'posTR', blue: 'posBL', green: 'posBR' }, // 0 deg
            red: { red: 'posBL', yellow: 'posTL', blue: 'posBR', green: 'posTR' }, // -90 deg
            green: { red: 'posTR', yellow: 'posBR', blue: 'posTL', green: 'posBL' }, // +90 deg
            yellow: { red: 'posBR', yellow: 'posBL', blue: 'posTR', green: 'posTL' } // 180 deg
        };
        const currentLayout = layouts[localColor] || layouts.blue;
        return currentLayout[targetColor] || 'posTL';
    };

    return (
        <>
            {/* Admin Game Controls Overlay */}
            {isAdmin && started && !ended && (
                <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', gap: '10px' }}>
                    <button onClick={() => socket.emit('game:pause')} style={{ padding: '5px 10px', cursor: 'pointer', background: '#333', color: '#fff', border: 'none', borderRadius: '4px' }}>
                        {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button onClick={() => socket.emit('game:toggleTimer')} style={{ padding: '5px 10px', cursor: 'pointer', background: '#333', color: '#fff', border: 'none', borderRadius: '4px' }}>
                        {timerEnabled ? 'Disable Timer' : 'Enable Timer'}
                    </button>
                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowEndMenu(!showEndMenu)} style={{ padding: '5px 10px', cursor: 'pointer', background: '#cc3333', color: '#fff', border: 'none', borderRadius: '4px' }}>
                            End Game...
                        </button>
                        {showEndMenu && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '5px', background: '#222', border: '1px solid #444', borderRadius: '4px', display: 'flex', flexDirection: 'column', width: '150px' }}>
                                <button onClick={handleReset} style={{ padding: '8px', cursor: 'pointer', background: 'none', color: '#fff', border: 'none', textAlign: 'left', borderBottom: '1px solid #444' }}>
                                    Reset to Lobby
                                </button>
                                <button onClick={handleStopHosting} style={{ padding: '8px', cursor: 'pointer', background: 'none', color: '#ff4444', border: 'none', textAlign: 'left' }}>
                                    Stop Hosting
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {players.map((player, index) => {
                const isLocalSlotEmpty = player.name === '...';
                const assignedColor = player.color || PLAYER_COLORS[index];
                
                return (
                    <div className={`${styles.playerContainer} ${styles[assignedColor]} ${styles[getPositionalClass(assignedColor, localColor)]}`} key={index}>
                        {!isLocalSlotEmpty && <NameContainer player={player} time={time} isPaused={isPaused} timerEnabled={timerEnabled} />}
                        
                        {/* Empty slot in lobby -> Add local player */}
                        {isAdmin && !started && isLocalSlotEmpty && (
                            <button onClick={() => socket.emit('room:addLocalPlayer')} style={{ marginTop: '10px', padding: '5px', fontSize: '12px' }}>
                                + Local Player
                            </button>
                        )}

                        {/* Kick Player */}
                        {isAdmin && !isLocalSlotEmpty && player._id && player._id !== adminId && (
                            <button onClick={() => socket.emit('game:kick', player._id)} style={{ position: 'absolute', top: 5, right: 5, background: 'red', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '2px 5px' }}>
                                Kick
                            </button>
                        )}

                        {started && !ended && !isLocalSlotEmpty ? <Dice playerColor={assignedColor} {...diceProps} /> : null}
                        {localColor === player.color && !started ? <ReadyButton isReady={isReady} /> : null}
                    </div>
                );
            })}
        </>
    );
};

export default Navbar;
