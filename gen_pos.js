const fs = require('fs');

const scale = 460 / 344;
const p = (val) => Number((val * scale).toFixed(1));

// Base circles in SVG:
// Red: (48,48), (48,90), (90,48), (90,90)
// Blue: (48,255), (48,297), (90,255), (90,297)
// Yellow: (255,255), (255,297), (297,255), (297,297)
// Green: (255,48), (255,90), (297,48), (297,90)

const bases = [
    // Red (0-3)
    {x: p(48), y: p(48)}, {x: p(48), y: p(90)}, {x: p(90), y: p(48)}, {x: p(90), y: p(90)},
    // Blue (4-7)
    {x: p(48), y: p(255)}, {x: p(48), y: p(297)}, {x: p(90), y: p(255)}, {x: p(90), y: p(297)},
    // Yellow (8-11) (BR)
    {x: p(255), y: p(255)}, {x: p(255), y: p(297)}, {x: p(297), y: p(255)}, {x: p(297), y: p(297)},
    // Green (12-15) (TR)
    {x: p(255), y: p(48)}, {x: p(255), y: p(90)}, {x: p(297), y: p(48)}, {x: p(297), y: p(90)},
];

// Helper for cell center: col, row (0-14)
const cell = (c, r) => ({ x: p(0.5 + c * 23 + 11.5), y: p(0.5 + r * 23 + 11.5) });

const path = [
    // Left arm (top row) starting from red field
    cell(1, 6), cell(2, 6), cell(3, 6), cell(4, 6), cell(5, 6), // 16-20
    // Top arm (left col)
    cell(6, 5), cell(6, 4), cell(6, 3), cell(6, 2), cell(6, 1), cell(6, 0), // 21-26
    // Top arm (top row)
    cell(7, 0), cell(8, 0), // 27-28
    // Top arm (right col)
    cell(8, 1), cell(8, 2), cell(8, 3), cell(8, 4), cell(8, 5), // 29-33
    // Right arm (top row)
    cell(9, 6), cell(10, 6), cell(11, 6), cell(12, 6), cell(13, 6), cell(14, 6), // 34-39
    // Right arm (right col)
    cell(14, 7), cell(14, 8), // 40-41
    // Right arm (bottom row)
    cell(13, 8), cell(12, 8), cell(11, 8), cell(10, 8), cell(9, 8), // 42-46
    // Bottom arm (right col)
    cell(8, 9), cell(8, 10), cell(8, 11), cell(8, 12), cell(8, 13), cell(8, 14), // 47-52
    // Bottom arm (bottom row)
    cell(7, 14), cell(6, 14), // 53-54
    // Bottom arm (left col)
    cell(6, 13), cell(6, 12), cell(6, 11), cell(6, 10), cell(6, 9), // 55-59
    // Left arm (bottom row)
    cell(5, 8), cell(4, 8), cell(3, 8), cell(2, 8), cell(1, 8), cell(0, 8), // 60-65
    // Left arm (left col)
    cell(0, 7), // 66
    // One behind red base
    cell(0, 6), // 67
    
    // Red end (Left arm middle row)
    cell(1, 7), cell(2, 7), cell(3, 7), cell(4, 7), cell(5, 7), cell(6, 7), // 68-73
    // Blue end (Bottom arm middle col)
    cell(7, 13), cell(7, 12), cell(7, 11), cell(7, 10), cell(7, 9), cell(7, 8), // 74-79
    // Yellow end (Right arm middle row)
    cell(13, 7), cell(12, 7), cell(11, 7), cell(10, 7), cell(9, 7), cell(8, 7), // 80-85
    // Green end (Top arm middle col)
    cell(7, 1), cell(7, 2), cell(7, 3), cell(7, 4), cell(7, 5), cell(7, 6), // 86-91
];

const all = [...bases, ...path];

const content = `const positions = [\n` + all.map(p => `    {x: ${p.x}, y: ${p.y}},`).join('\n') + `\n];\n\nexport default positions;`;

fs.writeFileSync('d:/Web Development/mern-ludo/src/components/Gameboard/positions.js', content);
