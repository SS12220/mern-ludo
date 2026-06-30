import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnimatedOverlay from './AnimatedOverlay';

describe('AnimatedOverlay component', () => {
    it('renders without crashing', () => {
        render(<AnimatedOverlay time={0} />);
    });

    it('applies animation delay based on time prop', () => {
        const mockTime = 1620000000000;
        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(mockTime);
        const time = mockTime + 5000;
        render(<AnimatedOverlay time={time} />);
        const overlay = screen.getByTestId('animated-overlay');
        const rect = overlay.querySelector('rect');

        expect(rect).toHaveStyle({ animationDelay: '-10s' });
        dateSpy.mockRestore();
    });
});
