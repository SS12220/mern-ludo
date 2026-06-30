import React from 'react';
import PropTypes from 'prop-types';
import { NOT_READY_COLOR } from '../../../constants/colors';
import styles from './NameContainer.module.css';

const NameContainer = ({ player, started, position }) => {
    return (
        <div className={`${styles.container} ${styles[position]}`}>
            <span>{player ? player.name : ''}</span>
        </div>
    );
};

NameContainer.propTypes = {
    player: PropTypes.object,
    started: PropTypes.bool,
    position: PropTypes.string,
};

export default NameContainer;
