(() => {
  function requireElement(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing required game element: #${id}`);
    return element;
  }

  const canvas = requireElement("game-board");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D rendering is unavailable");
  const nextCanvas = requireElement("next-piece");
  const nextContext = nextCanvas.getContext("2d");
  if (!nextContext) throw new Error("Canvas 2D rendering is unavailable");
  const overlay = requireElement("screen-overlay");
  const overlayTitle = requireElement("overlay-title");
  const overlayCaption = requireElement("overlay-caption");
  const scoreValue = requireElement("score-value");
  const levelValue = requireElement("level-value");
  const linesValue = requireElement("lines-value");
  const playButton = requireElement("play-button");
  const gameStatus = requireElement("game-status");
  const recordNote = requireElement("record-note");
  const topScoreName = requireElement("top-score-name");
  const topScoreValue = requireElement("top-score-value");
  const topScoreMessage = requireElement("top-score-message");
  const viewHighScoresButton = requireElement("view-high-scores");
  const highScoresDialog = requireElement("high-scores-dialog");
  const highScoresList = requireElement("high-scores-list");
  const loadMoreScoresButton = requireElement("load-more-scores");
  const closeHighScoresButton = requireElement("close-high-scores");
  const scoreSubmitDialog = requireElement("score-submit-dialog");
  const scoreSubmitForm = requireElement("score-submit-form");
  const playerNameInput = requireElement("player-name");
  const gameOverScore = requireElement("game-over-score");
  const scoreSubmitError = requireElement("score-submit-error");
  const saveScoreButton = requireElement("save-score");
  const cancelScoreSubmitButton = requireElement("cancel-score-submit");

  const COLS = 10;
  const ROWS = 20;
  const CELL_SIZE = 30;
  const POINTS_PER_LEVEL = 500;
  const TETRIS_GAME_ID = import.meta.env?.VITE_TITLE_GAME_ID;
  const API_BASE_URL = import.meta.env?.DEV
    ? window.location.origin
    : import.meta.env?.VITE_API_BASE_URL || window.location.origin;
  const COLORS = {
    I: "#007c83",
    J: "#3047a3",
    L: "#b45309",
    O: "#8a6d00",
    S: "#3c7a36",
    T: "#713b8e",
    Z: "#b73535"
  };
  const SHAPES = {
    I: [[1, 1, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    T: [[0, 1, 0], [1, 1, 1]],
    Z: [[1, 1, 0], [0, 1, 1]]
  };
  const LINE_POINTS = [0, 10, 20, 30, 50];

  let board;
  let currentPiece;
  let nextType;
  let pieceBag = [];
  let score = 0;
  let lines = 0;
  let level = 1;
  let state = "ready";
  let previousFrame = 0;
  let dropElapsed = 0;
  let animationFrame = 0;
  let highScoresCursor = "";
  let highScoresLoaded = 0;
  let highScoresLoading = false;
  let highScoresHasMore = true;

  function makeScoresUrl(limit, cursor = "") {
    if (!TETRIS_GAME_ID) throw new Error("Set VITE_TITLE_GAME_ID in .env");
    const url = new URL("/api/scores", API_BASE_URL);
    url.searchParams.set("title_game_id", TETRIS_GAME_ID);
    url.searchParams.set("limit", String(limit));
    if (cursor) url.searchParams.set("cursor", cursor);
    return url;
  }

  async function fetchScores(limit, cursor = "") {
    const response = await fetch(makeScoresUrl(limit, cursor));
    if (!response.ok) throw new Error(`Unable to load scores (${response.status})`);
    const page = await response.json();
    if (
      !page ||
      !Array.isArray(page.scores) ||
      typeof page.nextCursor !== "string" ||
      page.scores.some((entry) =>
        !entry || typeof entry.name !== "string" || !Number.isSafeInteger(entry.score)
      )
    ) {
      throw new Error("The score server returned invalid data");
    }
    return page;
  }

  async function loadTopScore() {
    try {
      const page = await fetchScores(1);
      topScoreMessage.textContent = "";
      const [topScore] = page.scores;
      if (!topScore) {
        topScoreName.textContent = "NO RECORDS";
        topScoreValue.textContent = "------";
        return;
      }
      topScoreName.textContent = topScore.name;
      topScoreValue.textContent = String(topScore.score).padStart(6, "0");
    } catch (error) {
      console.error("Unable to load top score", error);
      topScoreName.textContent = "NO RECORDS";
      topScoreValue.textContent = "------";
      topScoreMessage.textContent = "";
    }
  }

  function openScoreSubmitDialog() {
    scoreSubmitForm.reset();
    gameOverScore.value = String(score).padStart(6, "0");
    gameOverScore.textContent = String(score).padStart(6, "0");
    playerNameInput.setCustomValidity("");
    scoreSubmitError.hidden = true;
    scoreSubmitError.textContent = "";
    scoreSubmitDialog.showModal();
    playerNameInput.focus();
  }

  async function submitGameOverScore(event) {
    event.preventDefault();
    const name = playerNameInput.value.trim();
    if (!name || name.length > 30) {
      playerNameInput.setCustomValidity("Enter a name with 1 to 30 characters.");
      playerNameInput.reportValidity();
      return;
    }

    playerNameInput.setCustomValidity("");
    saveScoreButton.disabled = true;
    cancelScoreSubmitButton.disabled = true;
    scoreSubmitError.hidden = true;
    try {
      if (!TETRIS_GAME_ID) throw new Error("Set VITE_TITLE_GAME_ID in .env");
      const response = await fetch(new URL("/api/scores", API_BASE_URL), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, score, game_id: TETRIS_GAME_ID })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result && typeof result.error === "string"
          ? result.error
          : `Unable to save score (${response.status})`;
        throw new Error(message);
      }

      gameStatus.textContent = `Score ${score} saved for ${
        result && typeof result.name === "string" ? result.name : name
      }.`;
      scoreSubmitDialog.close();
      void loadTopScore();
    } catch (error) {
      scoreSubmitError.textContent = `Unable to save score: ${error.message}`;
      scoreSubmitError.hidden = false;
    } finally {
      saveScoreButton.disabled = false;
      cancelScoreSubmitButton.disabled = false;
    }
  }

  function appendHighScores(scores) {
    for (const [index, entry] of scores.entries()) {
      const row = document.createElement("li");
      const rank = document.createElement("span");
      const name = document.createElement("span");
      const value = document.createElement("span");
      rank.className = "high-score-rank";
      name.className = "high-score-player";
      value.className = "high-score-points";
      rank.textContent = `${String(highScoresLoaded + index + 1).padStart(2, "0")}.`;
      name.textContent = entry.name;
      value.textContent = String(entry.score).padStart(6, "0");
      row.append(rank, name, value);
      highScoresList.append(row);
    }
    highScoresLoaded += scores.length;
  }

  async function loadHighScores(reset = false) {
    if (highScoresLoading || (!reset && !highScoresHasMore)) return;
    if (reset) {
      highScoresCursor = "";
      highScoresLoaded = 0;
      highScoresHasMore = true;
      highScoresList.replaceChildren();
      const message = document.createElement("li");
      message.className = "high-scores-message";
      message.textContent = "Loading scores...";
      highScoresList.append(message);
    }

    highScoresLoading = true;
    loadMoreScoresButton.disabled = true;
    try {
      const page = await fetchScores(10, highScoresCursor);
      if (highScoresLoaded === 0) highScoresList.replaceChildren();
      appendHighScores(page.scores);
      if (highScoresLoaded === 0) {
        const message = document.createElement("li");
        message.className = "high-scores-message";
        message.textContent = "NO RECORDS";
        highScoresList.append(message);
      }
      highScoresCursor = page.nextCursor;
      highScoresHasMore = Boolean(page.nextCursor);
    } catch (error) {
      console.error("Unable to load high scores", error);
      if (highScoresLoaded === 0) highScoresList.replaceChildren();
      const message = document.createElement("li");
      message.className = "high-scores-message";
      message.textContent = highScoresLoaded === 0 ? "NO RECORDS" : "Unable to load more scores.";
      highScoresList.append(message);
    } finally {
      highScoresLoading = false;
      loadMoreScoresButton.disabled = !highScoresHasMore;
      loadMoreScoresButton.hidden = !highScoresHasMore;
    }
  }

  viewHighScoresButton.addEventListener("click", () => {
    highScoresDialog.showModal();
    void loadHighScores(true);
  });
  loadMoreScoresButton.addEventListener("click", () => void loadHighScores());
  closeHighScoresButton.addEventListener("click", () => highScoresDialog.close());
  scoreSubmitForm.addEventListener("submit", (event) => {
    void submitGameOverScore(event);
  });
  playerNameInput.addEventListener("input", () => playerNameInput.setCustomValidity(""));
  cancelScoreSubmitButton.addEventListener("click", () => {
    scoreSubmitDialog.close();
    gameStatus.textContent = "Score not saved.";
  });
  scoreSubmitDialog.addEventListener("cancel", () => {
    gameStatus.textContent = "Score not saved.";
  });
  scoreSubmitDialog.addEventListener("close", () => playButton.focus());

  function refillBag() {
    pieceBag = Object.keys(SHAPES);
    for (let index = pieceBag.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [pieceBag[index], pieceBag[swapIndex]] = [pieceBag[swapIndex], pieceBag[index]];
    }
  }

  function takePieceType() {
    if (pieceBag.length === 0) refillBag();
    return pieceBag.pop();
  }

  function makePiece(type) {
    const shape = SHAPES[type].map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor((COLS - shape[0].length) / 2),
      y: -1
    };
  }

  function spawnPiece() {
    currentPiece = makePiece(nextType);
    nextType = takePieceType();
    drawNextPiece();
    if (collides(currentPiece, 0, 0, currentPiece.shape)) endGame();
  }

  function resetGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    pieceBag = [];
    score = 0;
    lines = 0;
    level = 1;
    dropElapsed = 0;
    nextType = takePieceType();
    spawnPiece();
    state = "ready";
    recordNote.textContent = "";
    updateStats();
    updateControls();
    draw();
  }

  function updateStats() {
    scoreValue.textContent = String(score).padStart(6, "0");
    levelValue.textContent = String(level).padStart(2, "0");
    linesValue.textContent = String(lines).padStart(2, "0");
  }

  function updateControls() {
    if (state === "running") {
      playButton.textContent = "PAUSE";
      setOverlay("", "");
      gameStatus.textContent = "Game started";
    } else if (state === "paused") {
      playButton.textContent = "RESUME";
      setOverlay("PAUSED", "PRESS P TO RESUME");
      gameStatus.textContent = "Game paused";
    } else if (state === "over") {
      playButton.textContent = "PLAY AGAIN";
      setOverlay("GAME OVER", `SCORE ${String(score).padStart(6, "0")}`);
      gameStatus.textContent = `Game over. Score ${score}`;
    } else {
      playButton.textContent = "START";
      setOverlay("READY?", "STACK THE BLOCKS");
      gameStatus.textContent = "Ready to play";
    }
  }

  function setOverlay(title, caption) {
    overlayTitle.textContent = title;
    overlayCaption.textContent = caption;
    overlay.hidden = !title;
  }

  function startGame() {
    if (state === "over") resetGame();
    state = "running";
    previousFrame = 0;
    dropElapsed = 0;
    updateControls();
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      updateControls();
    } else if (state === "paused") {
      startGame();
    }
  }

  function collides(piece, offsetX, offsetY, shape) {
    for (let row = 0; row < shape.length; row += 1) {
      for (let col = 0; col < shape[row].length; col += 1) {
        if (!shape[row][col]) continue;
        const x = piece.x + offsetX + col;
        const y = piece.y + offsetY + row;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && board[y][x]) return true;
      }
    }
    return false;
  }

  function movePiece(offsetX, offsetY) {
    if (!currentPiece || collides(currentPiece, offsetX, offsetY, currentPiece.shape)) return false;
    currentPiece.x += offsetX;
    currentPiece.y += offsetY;
    draw();
    return true;
  }

  function rotateShape(shape) {
    return shape[0].map((_, column) =>
      shape.map((row) => row[column]).reverse()
    );
  }

  function rotatePiece() {
    if (!currentPiece) return;
    const rotated = rotateShape(currentPiece.shape);
    for (const offset of [0, -1, 1, -2, 2]) {
      if (!collides(currentPiece, offset, 0, rotated)) {
        currentPiece.x += offset;
        currentPiece.shape = rotated;
        draw();
        return;
      }
    }
  }

  function hardDrop() {
    if (state !== "running" || !currentPiece) return;
    while (movePiece(0, 1)) {}
    lockPiece();
  }

  function addScore(amount) {
    score += amount;
    level = Math.floor(score / POINTS_PER_LEVEL) + 1;
    updateStats();
  }

  function lockPiece() {
    for (let row = 0; row < currentPiece.shape.length; row += 1) {
      for (let col = 0; col < currentPiece.shape[row].length; col += 1) {
        if (!currentPiece.shape[row][col]) continue;
        const x = currentPiece.x + col;
        const y = currentPiece.y + row;
        if (y < 0) {
          endGame();
          return;
        }
        board[y][x] = currentPiece.type;
      }
    }

    clearLines();
    spawnPiece();
    draw();
  }

  function clearLines() {
    let cleared = 0;
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      if (board[row].every(Boolean)) {
        board.splice(row, 1);
        board.unshift(Array(COLS).fill(null));
        cleared += 1;
        row += 1;
      }
    }
    if (cleared === 0) return;
    lines += cleared;
    addScore(LINE_POINTS[cleared]);
    updateStats();
  }

  function endGame() {
    state = "over";
    updateControls();
    openScoreSubmitDialog();
  }

  function dropInterval() {
    return Math.max(80, 850 * Math.pow(0.82, level - 1));
  }

  function gameLoop(timestamp) {
    if (state === "running") {
      if (previousFrame === 0) previousFrame = timestamp;
      const elapsed = Math.min(timestamp - previousFrame, 100);
      previousFrame = timestamp;
      dropElapsed += elapsed;
      if (dropElapsed >= dropInterval()) {
        dropElapsed = 0;
        if (!movePiece(0, 1)) lockPiece();
      }
    } else {
      previousFrame = timestamp;
    }
    animationFrame = window.requestAnimationFrame(gameLoop);
  }

  function drawCell(target, x, y, type, size, alpha = 1) {
    target.globalAlpha = alpha;
    target.fillStyle = COLORS[type];
    target.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    target.fillStyle = "rgba(255, 255, 255, 0.28)";
    target.fillRect(x * size + 2, y * size + 2, size - 4, Math.max(2, size * 0.12));
    target.globalAlpha = 1;
  }

  function draw() {
    context.fillStyle = "#bacd92";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(37, 54, 38, 0.11)";
    context.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 1) {
      context.beginPath();
      context.moveTo(x * CELL_SIZE + 0.5, 0);
      context.lineTo(x * CELL_SIZE + 0.5, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= ROWS; y += 1) {
      context.beginPath();
      context.moveTo(0, y * CELL_SIZE + 0.5);
      context.lineTo(canvas.width, y * CELL_SIZE + 0.5);
      context.stroke();
    }

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (board[y][x]) drawCell(context, x, y, board[y][x], CELL_SIZE);
      }
    }

    if (!currentPiece) return;
    const ghost = { ...currentPiece, shape: currentPiece.shape };
    while (!collides(ghost, 0, 1, ghost.shape)) ghost.y += 1;
    drawPiece(ghost, 0.28);
    drawPiece(currentPiece);
  }

  function drawPiece(piece, alpha = 1) {
    for (let row = 0; row < piece.shape.length; row += 1) {
      for (let col = 0; col < piece.shape[row].length; col += 1) {
        const x = piece.x + col;
        const y = piece.y + row;
        if (piece.shape[row][col] && y >= 0) {
          drawCell(context, x, y, piece.type, CELL_SIZE, alpha);
        }
      }
    }
  }

  function drawNextPiece() {
    nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextType) return;
    const shape = SHAPES[nextType];
    const size = 18;
    const offsetX = (nextCanvas.width - shape[0].length * size) / 2;
    const offsetY = (nextCanvas.height - shape.length * size) / 2;
    for (let row = 0; row < shape.length; row += 1) {
      for (let col = 0; col < shape[row].length; col += 1) {
        if (!shape[row][col]) continue;
        nextContext.save();
        nextContext.translate(offsetX, offsetY);
        drawCell(nextContext, col, row, nextType, size);
        nextContext.restore();
      }
    }
  }

  function performAction(action) {
    if (action === "pause") {
      togglePause();
      return;
    }
    if (state === "over") {
      if (action === "start") {
        resetGame();
        startGame();
      }
      return;
    }
    if (state === "paused") {
      if (action === "start") startGame();
      return;
    }
    if (state === "ready") startGame();
    if (state !== "running") return;

    if (action === "left") movePiece(-1, 0);
    else if (action === "right") movePiece(1, 0);
    else if (action === "rotate") rotatePiece();
    else if (action === "down") {
      if (!movePiece(0, 1)) lockPiece();
    } else if (action === "drop") hardDrop();
  }

  playButton.addEventListener("click", () => {
    if (state === "running") togglePause();
    else performAction("start");
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => performAction(button.dataset.action));
  });

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, select, [contenteditable='true']")) return;

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const actions = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowDown: "down",
      ArrowUp: "rotate",
      a: "left",
      d: "right",
      s: "down",
      w: "rotate",
      j: "rotate",
      l: "drop",
      " ": "drop"
    };
    const action = actions[key];
    if (action) {
      event.preventDefault();
      if (!event.repeat || action === "left" || action === "right" || action === "down") {
        performAction(action);
      }
    } else if (key === "p" && !event.repeat) {
      event.preventDefault();
      togglePause();
    }
  });

  window.addEventListener("blur", () => {
    if (state === "running") togglePause();
  });

  resetGame();
  void loadTopScore();
  animationFrame = window.requestAnimationFrame(gameLoop);
  window.addEventListener("beforeunload", () => window.cancelAnimationFrame(animationFrame), { once: true });
})();
