import React, { useContext, useState, useEffect } from 'react';
import { SocketContext } from '../../../App';
import images from '../../../constants/diceImages';
import AnimatedOverlay from '../NameContainer/AnimatedOverlay/AnimatedOverlay';
import audioManager from '../../../utils/audioManager';
import styles from './Dice.module.css';

const Dice = ({ rolledNumber, nowMoving, playerColor, movingPlayer, time }) => {
    const socket = useContext(SocketContext);
    const [displayNumber, setDisplayNumber] = useState(rolledNumber || null);
    const [isRolling, setIsRolling] = useState(false);

    useEffect(() => {
        if (rolledNumber) {
            audioManager.play('diceroll');
            setIsRolling(true);
            let cycles = 0;
            const maxCycles = 8; // 8 cycles * 60ms = 480ms
            const interval = setInterval(() => {
                setDisplayNumber(prev => {
                    let next;
                    do {
                        next = Math.floor(Math.random() * 6) + 1;
                    } while (next === prev); // Ensure it changes face each tick
                    return next;
                });
                cycles++;
                if (cycles >= maxCycles) {
                    clearInterval(interval);
                    setDisplayNumber(rolledNumber);
                    setIsRolling(false);
                }
            }, 60);
            return () => clearInterval(interval);
        } else {
            setDisplayNumber(null);
        }
    }, [rolledNumber]);

    const handleClick = () => {
        audioManager.play('click');
        socket.emit('game:roll');
    };

    const isCurrentPlayer = movingPlayer === playerColor;

    let activeState = 'none';
    if (isCurrentPlayer) {
        if (displayNumber !== null && displayNumber !== undefined) {
            activeState = 'rolling';
        } else if (nowMoving) {
            activeState = 'clickable';
        } else {
            activeState = 'waiting';
        }
    }

    return (
        <div className={styles.container}>
            {isCurrentPlayer ? <AnimatedOverlay time={time} /> : null}
            
            {/* 1. Placeholder (when it is not this player's turn) */}
            {activeState === 'none' && <div className={styles.placeholder} />}

            {/* 2. Pre-rendered dice faces (1 to 6) to ensure zero loading lag */}
            {isCurrentPlayer && images.slice(0, 6).map((imgSrc, index) => {
                const isVisible = activeState === 'rolling' && displayNumber === (index + 1);
                return (
                    <img
                        key={index}
                        src={imgSrc}
                        alt={index + 1}
                        className={isVisible && isRolling ? styles.rolling : ''}
                        style={{
                            display: isVisible ? 'block' : 'none',
                        }}
                    />
                );
            })}

            {/* 3. Clickable dice to roll */}
            {activeState === 'clickable' && (
                <img
                    src={images[6]}
                    className={styles.clickToRoll}
                    alt='roll'
                    onClick={handleClick}
                />
            )}

            {/* 4. Waiting state dice */}
            {activeState === 'waiting' && (
                <img
                    src={images[6]}
                    alt='waiting'
                    style={{ opacity: 0.5, cursor: 'default' }}
                />
            )}
        </div>
    );
};

export default Dice;
