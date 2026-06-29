import React, { useMemo } from 'react';
import styles from './AnimatedOverlay.module.css';

const AnimatedOverlay = ({ time }) => {
    // Calculate how many seconds have elapsed from the 15s timer
    const elapsedSeconds = Math.max(0, 15 - Math.ceil((time - Date.now()) / 1000));
    // SVG animations handle delay negatively
    const animationDelay = `-${elapsedSeconds}s`;

    return (
        <svg className={styles.overlaySvg} data-testid='animated-overlay'>
            <rect
                x="0" y="0" width="100%" height="100%"
                rx="5" ry="5"
                pathLength="100"
                className={styles.timerStroke}
                style={{ animationDelay }}
            />
        </svg>
    );
};

export default AnimatedOverlay;
