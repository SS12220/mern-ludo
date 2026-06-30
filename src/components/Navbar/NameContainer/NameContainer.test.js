import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NameContainer from './NameContainer';
import { NOT_READY_COLOR } from '../../../constants/colors';


describe('NameContainer component', () => {
    let player;
    let time;

    beforeEach(() => {
        player = {
            name: 'TestPlayer',
            ready: false,
            color: 'blue',
            nowMoving: false,
        };
        time = 0;
    });

    it('renders without crashing', () => {
        render(<NameContainer player={player} time={time} />);
    });

    it('renders player name', () => {
        render(<NameContainer player={player} time={time} />);
        expect(screen.getByText(player.name)).toBeInTheDocument();
    });
});
