# Tetris

A browser-based Tetris game built with JavaScript and Vite.

## Run locally

Use Node.js 20.19 or newer:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Build production assets with `npm run build`.

## Controls

- Left / Right arrows: move the piece
- Up arrow: rotate
- Down arrow: soft drop
- Space: hard drop
- P: pause or resume
- WASD: directional controls (W rotates, A/D move, S soft-drops)
- J: rotate
- L: hard drop

Touch-friendly controls are available below the game statistics.

The game starts at level 1 and advances one level for every 500 points.

Soft and hard drops both award 1 point per row. Clearing 1, 2, or 3 lines
awards 10 points per line; clearing 4 lines at once awards 50 points. The
line counter increases once for each cleared line.
# tetris-game
