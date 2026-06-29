import React, { useContext, useState, useEffect } from 'react';
import { SocketContext } from '../../../App';
import images from '../../../constants/diceImages';
import styles from './Dice.module.css';

const Dice = ({ rolledNumber, nowMoving, playerColor, movingPlayer }) => {
    const socket = useContext(SocketContext);
    const [displayNumber, setDisplayNumber] = useState(null);
    const [isRolling, setIsRolling] = useState(false);

    useEffect(() => {
        if (rolledNumber) {
            setIsRolling(true);
            let cycles = 0;
            const interval = setInterval(() => {
                setDisplayNumber(Math.floor(Math.random() * 6) + 1);
                cycles++;
                if (cycles > 10) { // 10 cycles * 50ms = 500ms
                    clearInterval(interval);
                    setDisplayNumber(rolledNumber);
                    setIsRolling(false);
                }
            }, 50);
            return () => clearInterval(interval);
        } else {
            setDisplayNumber(null);
        }
    }, [rolledNumber]);

    const handleClick = () => {
        socket.emit('game:roll');
    };

    const isCurrentPlayer = movingPlayer === playerColor;
    const hasRolledNumber = displayNumber !== null && displayNumber !== undefined;

    return (
        <div className={styles.container}>
            {isCurrentPlayer ? (
                hasRolledNumber ? (
                    <img src={images[displayNumber - 1]} alt={displayNumber} style={isRolling ? { transform: 'scale(1.1)' } : {}} />
                ) : nowMoving ? (
                    <img src={images[6]} className='roll' alt='roll' onClick={handleClick} />
                ) : null
            ) : null}
        </div>
    );
};

export default Dice;
