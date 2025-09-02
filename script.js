(() => {
  // DOM Elements
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const levelEl = document.getElementById("level");
  const livesEl = document.getElementById("lives");
  const bestEl = document.getElementById("best");
  const pauseBtn = document.getElementById("pauseBtn");
  const restartBtn = document.getElementById("restartBtn");

  // Constants
  const BEST_KEY = "mirror_maze_best_level_v1";
  let best = parseInt(localStorage.getItem(BEST_KEY)) || 1;
  bestEl.textContent = best;

  // Device Pixel Ratio (for crisp rendering)
  let DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const maxWidth = 960;
    const w = Math.min(window.innerWidth - 32, maxWidth);
    const h = Math.round(w * 9 / 16);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
  }
  window.addEventListener("resize", resize);
  resize();

  // Game state
  let playerTop, playerBottom;
  let keys = {};
  let level = 1;
  let lives = 3;
  let obstaclesTop = [];
  let obstaclesBottom = [];
  let goalTop, goalBottom;
  let running = false;
  let paused = false;
  const gravity = 1600 * DPR; // px/s²
  let lastTime = 0;
  let spawnTimer = 0;

  // Helper functions
  const W = () => canvas.width;
  const H = () => canvas.height;
  const halfH = () => Math.floor(H() / 2);
  const randRange = (a, b) => a + Math.random() * (b - a);
  const mirrorX = (x, w) => W() - x - w;
  const mirrorBottomY = (y, h) => {
    const mid = halfH();
    const dist = mid - y;
    return mid + dist - h;
  };

  // Create player
  function makePlayer(yTop) {
    return {
      x: Math.floor(W() * 0.25),
      y: yTop,
      w: 28 * DPR,
      h: 36 * DPR,
      vx: 0,
      vy: 0,
      onGround: false,
      color: "#7ce7ff",
    };
  }

  // Reset world for current level
  function resetWorld() {
    const mid = halfH();
    playerTop = makePlayer(mid - 110 * DPR);
    playerBottom = makePlayer(mid + 40 * DPR);
    playerBottom.x = mirrorX(playerTop.x, playerTop.w);

    obstaclesTop = [];
    obstaclesBottom = [];

    goalTop = {
      x: Math.floor(W() * 0.9),
      y: playerTop.y,
      w: 40 * DPR,
      h: playerTop.h,
    };
    goalBottom = {
      x: mirrorX(goalTop.x, goalTop.w),
      y: playerBottom.y,
      w: goalTop.w,
      h: goalTop.h,
    };

    spawnTimer = Math.max(0.6, 1.5 - level * 0.08);
    updateHUD();
  }

  // Update HUD
  function updateHUD() {
    levelEl.textContent = level;
    livesEl.textContent = lives;
    bestEl.textContent = best;
  }

  // Start game
  function start() {
    resetWorld();
    running = true;
    paused = false;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // End game
  function gameOver() {
    running = false;
    paused = true;
    level = 1;
    lives = 3;
    best = Math.max(best, level);
    localStorage.setItem(BEST_KEY, best);
    updateHUD();

    // Show modal
    const template = document.getElementById("game-over-template");
    const frag = document.importNode(template.content, true);
    frag.getElementById("final-level").textContent = level;
    frag.getElementById("restart-final").onclick = () => {
      document.body.removeChild(modal);
      start();
    };
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.appendChild(frag);
    document.body.appendChild(modal);
  }

  // Advance to next level
  function advanceLevel() {
    level++;
    best = Math.max(best, level);
    localStorage.setItem(BEST_KEY, best);
    updateHUD();

    // Small heal
    lives = Math.min(5, lives + 1);
    updateHUD();

    setTimeout(resetWorld, 200);
  }

  // Input handling
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      jumpBoth();
    }
    if (e.code === "KeyP") togglePause();
  });

  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  // Touch controls
  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * canvas.width;
    const y = (e.clientY - rect.top) / rect.height * canvas.height;
    const mid = halfH();

    if (y < mid * 0.5) {
      jumpBoth();
    } else if (y < mid) {
      keys["TOUCH_LEFT"] = x < W() / 2;
      keys["TOUCH_RIGHT"] = x >= W() / 2;
    } else if (y > mid + mid * 0.25) {
      jumpBoth();
    } else {
      keys["TOUCH_LEFT"] = x < W() / 2;
      keys["TOUCH_RIGHT"] = x >= W() / 2;
    }
  });

  canvas.addEventListener("pointerup", () => {
    keys["TOUCH_LEFT"] = false;
    keys["TOUCH_RIGHT"] = false;
  });

  // Actions
  function jumpBoth() {
    if (playerTop.onGround) {
      playerTop.vy = -720 * DPR;
      playerTop.onGround = false;
    }
    if (playerBottom.onGround) {
      playerBottom.vy = -720 * DPR;
      playerBottom.onGround = false;
    }
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
    if (!paused) {
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  }

  // Obstacle spawning
  function spawnObstaclePair() {
    const w = randRange(40 * DPR, 80 * DPR);
    const h = randRange(20 * DPR, 90 * DPR);
    const x = W() + w + randRange(0, 220 * DPR);
    const topFromTop = Math.random() < 0.5;

    let topObs;
    if (topFromTop) {
      topObs = {
        x,
        y: halfH() - playerTop.h - h - randRange(10 * DPR, 40 * DPR),
        w,
        h,
        vx: -(150 + level * 16) * DPR,
      };
    } else {
      topObs = {
        x,
        y: halfH() - playerTop.h + randRange(40 * DPR, 120 * DPR),
        w,
        h,
        vx: -(150 + level * 16) * DPR,
      };
    }

    obstaclesTop.push(topObs);
    obstaclesBottom.push({
      x: mirrorX(topObs.x, topObs.w),
      y: mirrorBottomY(topObs.y, topObs.h),
      w: topObs.w,
      h: topObs.h,
      vx: topObs.vx,
    });
  }

  // Collision detection
  function rectOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function checkCollisions() {
    for (const obs of obstaclesTop) {
      if (rectOverlap(playerTop, obs)) return true;
    }
    for (const obs of obstaclesBottom) {
      if (rectOverlap(playerBottom, obs)) return true;
    }
    return false;
  }

  function hitPlayer() {
    lives--;
    updateHUD();

    if (lives <= 0) {
      gameOver();
    } else {
      resetWorld();
    }
  }

  // Physics step
  function step(dt) {
    // Movement input
    let move = 0;
    if (keys["ArrowLeft"] || keys["KeyA"] || keys["TOUCH_LEFT"]) move = -1;
    if (keys["ArrowRight"] || keys["KeyD"] || keys["TOUCH_RIGHT"]) move = 1;
    const speed = 260 * DPR;

    playerTop.vx = move * speed;
    playerBottom.vx = -move * speed; // mirrored

    playerTop.x += playerTop.vx * dt;
    playerBottom.x += playerBottom.vx * dt;

    // Gravity
    playerTop.vy += gravity * dt;
    playerTop.y += playerTop.vy * dt;
    playerBottom.vy += gravity * dt;
    playerBottom.y += playerBottom.vy * dt;

    // Floor/ceiling collisions
    const topGroundY = halfH() - playerTop.h;
    const topCeilY = 20 * DPR;
    if (playerTop.y > topGroundY) {
      playerTop.y = topGroundY;
      playerTop.vy = 0;
      playerTop.onGround = true;
    } else if (playerTop.y < topCeilY) {
      playerTop.y = topCeilY;
      playerTop.vy = 0;
    } else {
      playerTop.onGround = false;
    }

    const bottomGroundY = H() - playerBottom.h - 20 * DPR;
    const bottomCeilY = halfH() + 20 * DPR;
    if (playerBottom.y > bottomGroundY) {
      playerBottom.y = bottomGroundY;
      playerBottom.vy = 0;
      playerBottom.onGround = true;
    } else if (playerBottom.y < bottomCeilY) {
      playerBottom.y = bottomCeilY;
      playerBottom.vy = 0;
    } else {
      playerBottom.onGround = false;
    }

    // Move obstacles
    for (let i = obstaclesTop.length - 1; i >= 0; i--) {
      obstaclesTop[i].x += obstaclesTop[i].vx * dt;
      obstaclesBottom[i].x = mirrorX(obstaclesTop[i].x, obstaclesTop[i].w);
      if (obstaclesTop[i].x + obstaclesTop[i].w < -50 * DPR) {
        obstaclesTop.splice(i, 1);
        obstaclesBottom.splice(i, 1);
      }
    }

    // Spawning
    spawnTimer -= dt;
    const spawnInterval = Math.max(0.35, 1.2 - level * 0.06);
    if (spawnTimer <= 0) {
      spawnObstaclePair();
      spawnTimer = spawnInterval;
    }

    // Collisions
    if (checkCollisions()) {
      hitPlayer();
      return;
    }

    // Goal check
    if (rectOverlap(playerTop, goalTop) && rectOverlap(playerBottom, goalBottom)) {
      advanceLevel();
    }
  }

  // Render
  function render() {
    const w = W();
    const h = H();
    const mid = halfH();

    ctx.clearRect(0, 0, w, h);

    // Divider line
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(0, mid - 2, w, 4);

    // Draw both worlds
    drawWorld(0, 0, w, mid, playerTop, obstaclesTop, goalTop, false);
    drawWorld(0, mid, w, mid, playerBottom, obstaclesBottom, goalBottom, true);

    // HUD overlay
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(12 * DPR, 12 * DPR, 220 * DPR, 28 * DPR);
    ctx.fillStyle = "rgba(124,231,255,0.95)";
    ctx.font = `${14 * DPR}px monospace`;
    ctx.fillText(`Level ${level} · Lives ${lives}`, 18 * DPR, 34 * DPR);
  }

  function drawWorld(x, y, w, h, player, obstacles, goal, isMirrored) {
    // Background gradient
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(124,231,255,0.02)");
    g.addColorStop(1, "rgba(255,111,180,0.02)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    // Ground line
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h - 10 * DPR);
    ctx.lineTo(x + w, y + h - 10 * DPR);
    ctx.stroke();

    // Goal
    ctx.fillStyle = "rgba(124,231,255,0.14)";
    ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
    ctx.strokeStyle = "rgba(124,231,255,0.6)";
    ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);

    // Obstacles
    for (const o of obstacles) {
      ctx.fillStyle = "rgba(255,111,180,0.9)";
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.strokeRect(o.x, o.y, o.w, o.h);
    }

    // Player
    ctx.save();
    ctx.fillStyle = player.color;
    ctx.shadowBlur = 18 * DPR;
    ctx.shadowColor = "#7ce7ff";
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.restore();

    // Mirror indicator
    if (isMirrored) {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(x + 6 * DPR, y + 6 * DPR, 90 * DPR, 20 * DPR);
      ctx.fillStyle = "rgba(124,231,255,0.6)";
      ctx.font = `${12 * DPR}px monospace`;
      ctx.fillText("Mirrored World", x + 10 * DPR, y + 20 * DPR);
    }
  }

  // Game loop
  function loop(timestamp) {
    if (!running) return;
    if (paused) {
      lastTime = timestamp;
      requestAnimationFrame(loop);
      return;
    }

    const dt = Math.min(0.034, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    step(dt);
    render();

    requestAnimationFrame(loop);
  }

  // Event listeners
  pauseBtn.addEventListener("click", togglePause);
  restartBtn.addEventListener("click", () => {
    level = 1;
    lives = 3;
    best = Math.max(best, level);
    localStorage.setItem(BEST_KEY, best);
    updateHUD();
    resetWorld();
  });

  // Start game
  start();
})();
