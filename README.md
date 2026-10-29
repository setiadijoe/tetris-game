# Tetris

A browser-based Tetris game built with JavaScript and Vite.

## Run locally

Use Node.js 20.19 or newer:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Build production assets with `npm run build`.

## High scores

The page fetches the top Tetris score and a paginated score list from
`/api/scores`, filtered by `VITE_TITLE_GAME_ID`. Set `VITE_API_BASE_URL` and
`VITE_TITLE_GAME_ID` in `.env`; `.env.example` shows the required variables.
During local development, Vite proxies `/api` requests to `VITE_API_BASE_URL`
to avoid browser CORS errors. Production builds call that API URL directly.
The API base defaults to the current origin if `VITE_API_BASE_URL` is unset.
These Vite variables are compiled into browser code, so they are public
configuration; never put secrets in them. At game over, enter a player name to
submit the score to the leaderboard.

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

Scores are awarded only for clearing lines: clearing 1, 2, or 3 lines awards
10 points per line; clearing 4 lines at once awards 50 points. Soft and hard
drops do not award points. The line counter increases once for each cleared
line.
# tetris-game
