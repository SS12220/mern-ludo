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
                x="3" y="3" width="calc(100% - 6px)" height="calc(100% - 6px)"
                rx="10" ry="10"
                pathLength="100"
                className={styles.timerStroke}
                style={{ animationDelay }}
            />
        </svg>
    );
};

export default AnimatedOverlay;
