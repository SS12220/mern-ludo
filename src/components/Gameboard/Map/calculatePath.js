const buildRange = (start, end) => {
    const result = [];
    for (let i = start; i <= end; i++) result.push(i);
    return result;
};

// 67 is skipped on the board path, it acts as a connection but 66 goes to 16
const routes = {
    red: [...buildRange(16, 66), ...buildRange(68, 73)],
    blue: [...buildRange(55, 67), ...buildRange(16, 53), ...buildRange(74, 79)],
    yellow: [...buildRange(42, 67), ...buildRange(16, 40), ...buildRange(80, 85)],
    green: [...buildRange(29, 67), ...buildRange(16, 27), ...buildRange(86, 91)]
};

const getPath = (color, fromPos, toPos) => {
    // If returning to base (capture)
    if (toPos >= 0 && toPos <= 15) {
        // Find the reverse path from where they are, back to their start position
        // This makes it slide linearly
        const route = routes[color];
        const fromIndex = route.indexOf(fromPos);
        if (fromIndex !== -1) {
            // Path backwards to the start of the route, then to base
            const path = route.slice(0, fromIndex + 1).reverse();
            path.push(toPos);
            return path;
        }
        return [fromPos, toPos];
    }

    // If leaving base
    if (fromPos >= 0 && fromPos <= 15) {
        return [fromPos, toPos]; // direct jump from base to first cell
    }

    // Normal forward path
    const route = routes[color];
    const fromIndex = route.indexOf(fromPos);
    const toIndex = route.indexOf(toPos);

    if (fromIndex !== -1 && toIndex !== -1 && toIndex > fromIndex) {
        return route.slice(fromIndex, toIndex + 1);
    }

    // Fallback if something is wrong
    return [fromPos, toPos];
};

export default getPath;
