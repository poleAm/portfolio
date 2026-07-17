// Jeu secret "Cap au 220" — runner façon dino de Chrome, version voilier.
(function () {
  const canvas = document.getElementById("game");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // ---- Constantes ----
  const W = 720;
  const H = 240;
  const GROUND_Y = 190;          // ligne de flottaison
  const GRAVITY = 2200;          // px/s²
  const JUMP_VY = -680;          // px/s
  const SPEED_START = 260;       // px/s
  const SPEED_MAX = 560;
  const SPEED_GAIN = 6;          // px/s gagnés par seconde
  const RESTART_DELAY = 400;     // ms avant de pouvoir relancer après un game over
  const STORAGE_KEY = "portfolio-runner-best";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Palette lue depuis les variables CSS du site (fallbacks en dur)
  const rootStyle = getComputedStyle(document.documentElement);
  const color = (name, fallback) => (rootStyle.getPropertyValue(name) || "").trim() || fallback;
  const C = {
    cream: color("--cream", "#faf9f4"),
    sea: color("--olive-200", "#c9d4ac"),
    wave: color("--olive-600", "#556b2f"),
    cloud: color("--olive-100", "#e9edda"),
    hull: color("--olive-800", "#33421c"),
    sailMain: color("--olive-600", "#556b2f"),
    sailJib: color("--olive-500", "#6b8e23"),
    rock: color("--olive-700", "#3d4f1f"),
    buoy: color("--olive-500", "#6b8e23"),
    dark: color("--olive-900", "#263013"),
    text: color("--text-soft", "#5a604d")
  };

  // ---- État ----
  let state = "ready";           // "ready" | "playing" | "over"
  let score = 0;
  let best = 0;
  try {
    best = parseInt(localStorage.getItem(STORAGE_KEY), 10) || 0;
  } catch (e) { /* stockage indisponible (navigation privée) */ }

  let speed = SPEED_START;
  let boat = { x: 90, y: GROUND_Y, vy: 0 };   // y = bas de la coque
  let obstacles = [];
  let clouds = [];
  let wavePhase = 0;
  let spawnTimer = 0;
  let overAt = 0;
  let last = 0;
  let running = false;           // la boucle rAF n'est lancée qu'au premier input

  const rand = (min, max) => min + Math.random() * (max - min);

  function initClouds() {
    clouds = [];
    for (let i = 0; i < 3; i++) {
      clouds.push({ x: rand(0, W), y: rand(24, 80), s: rand(0.7, 1.2) });
    }
  }

  // ---- Netteté : gestion du devicePixelRatio (la taille affichée reste au CSS) ----
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  // ---- Logique ----
  function reset() {
    state = "playing";
    score = 0;
    speed = SPEED_START;
    boat.y = GROUND_Y;
    boat.vy = 0;
    obstacles = [];
    spawnTimer = rand(0.9, 1.4);
  }

  function jump() {
    if (state === "ready") {
      reset();
      startLoop();
      return;
    }
    if (state === "over") {
      if (performance.now() - overAt > RESTART_DELAY) reset();
      return;
    }
    if (boat.y >= GROUND_Y) boat.vy = JUMP_VY;
  }

  function spawnObstacle() {
    const roll = Math.random();
    let type;
    if (roll < 0.45) type = "buoy";
    else if (roll < 0.75) type = "rock";
    else type = "buoy-double";
    const dims = {
      "buoy": { w: 22, h: 34 },
      "rock": { w: 38, h: 24 },
      "buoy-double": { w: 52, h: 34 }
    }[type];
    obstacles.push({ x: W + 40, w: dims.w, h: dims.h, type: type });
  }

  function update(dt) {
    speed = Math.min(SPEED_MAX, speed + SPEED_GAIN * dt);
    score += speed * dt * 0.02;

    // Physique du bateau
    if (boat.y < GROUND_Y || boat.vy < 0) {
      boat.vy += GRAVITY * dt;
      boat.y += boat.vy * dt;
      if (boat.y > GROUND_Y) { boat.y = GROUND_Y; boat.vy = 0; }
    }

    // Obstacles
    for (const o of obstacles) o.x -= speed * dt;
    obstacles = obstacles.filter((o) => o.x + o.w > -20);

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      // Écart minimal en pixels pour que le saut reste toujours possible
      const lastObs = obstacles[obstacles.length - 1];
      if (!lastObs || W + 40 - (lastObs.x + lastObs.w) > speed * 0.55) {
        spawnObstacle();
        spawnTimer = rand(0.9, 1.8) * Math.min(1, 340 / speed + 0.35);
      } else {
        spawnTimer = 0.15;
      }
    }

    // Décor
    if (!reducedMotion) wavePhase += dt * 3;
    for (const c of clouds) {
      c.x -= speed * 0.15 * c.s * dt;
      if (c.x < -80) { c.x = W + rand(20, 120); c.y = rand(24, 80); }
    }

    checkCollision();
  }

  function checkCollision() {
    // Hitbox indulgente : la coque seule, avec 6 px de marge
    const m = 6;
    const bx1 = boat.x - 28 + m;
    const bx2 = boat.x + 28 - m;
    const by1 = boat.y - 16 + m;
    const by2 = boat.y - 2;
    for (const o of obstacles) {
      const ox1 = o.x + m;
      const ox2 = o.x + o.w - m;
      const oy1 = GROUND_Y - o.h + m;
      if (bx1 < ox2 && bx2 > ox1 && by2 > oy1 && by1 < GROUND_Y) {
        gameOver();
        return;
      }
    }
  }

  function gameOver() {
    state = "over";
    overAt = performance.now();
    if (score > best) {
      best = Math.floor(score);
      try { localStorage.setItem(STORAGE_KEY, String(best)); } catch (e) { /* ignoré */ }
    }
  }

  // ---- Dessin ----
  function drawClouds() {
    ctx.fillStyle = C.cloud;
    for (const c of clouds) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 26 * c.s, 10 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 18 * c.s, c.y + 3 * c.s, 18 * c.s, 8 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSea() {
    ctx.fillStyle = C.sea;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.strokeStyle = C.wave;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = GROUND_Y + Math.sin(x * 0.05 + wavePhase) * 3;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawBoat() {
    ctx.save();
    const rocking = !reducedMotion && boat.y >= GROUND_Y && state !== "over";
    ctx.translate(boat.x, boat.y);
    if (rocking) ctx.rotate(Math.sin(wavePhase) * 0.03);
    if (state === "over") ctx.rotate(0.18);

    // Coque (trapèze)
    ctx.fillStyle = C.hull;
    ctx.beginPath();
    ctx.moveTo(-30, -16);
    ctx.lineTo(30, -16);
    ctx.lineTo(20, 0);
    ctx.lineTo(-24, 0);
    ctx.closePath();
    ctx.fill();

    // Mât
    ctx.strokeStyle = C.hull;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, -16);
    ctx.lineTo(2, -74);
    ctx.stroke();

    // Grand-voile (affalée si game over)
    const sailH = state === "over" ? 20 : 54;
    ctx.fillStyle = C.sailMain;
    ctx.beginPath();
    ctx.moveTo(4, -16 - 2);
    ctx.lineTo(4, -18 - sailH);
    ctx.lineTo(4 + sailH * 0.52, -18);
    ctx.closePath();
    ctx.fill();

    // Foc
    if (state !== "over") {
      ctx.fillStyle = C.sailJib;
      ctx.beginPath();
      ctx.moveTo(-1, -22);
      ctx.lineTo(-1, -66);
      ctx.lineTo(-26, -20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawObstacle(o) {
    const baseY = GROUND_Y;
    if (o.type === "rock") {
      ctx.fillStyle = C.rock;
      ctx.beginPath();
      ctx.moveTo(o.x, baseY + 4);
      ctx.lineTo(o.x + o.w * 0.2, baseY - o.h);
      ctx.lineTo(o.x + o.w * 0.55, baseY - o.h * 0.7);
      ctx.lineTo(o.x + o.w * 0.8, baseY - o.h * 0.95);
      ctx.lineTo(o.x + o.w, baseY + 4);
      ctx.closePath();
      ctx.fill();
    } else {
      const count = o.type === "buoy-double" ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const cx = o.x + 11 + i * 30;
        // Flotteur
        ctx.fillStyle = C.buoy;
        ctx.beginPath();
        ctx.arc(cx, baseY - 8, 9, 0, Math.PI * 2);
        ctx.fill();
        // Mâtereau + fanion
        ctx.strokeStyle = C.dark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, baseY - 16);
        ctx.lineTo(cx, baseY - 32);
        ctx.stroke();
        ctx.fillStyle = C.dark;
        ctx.beginPath();
        ctx.moveTo(cx, baseY - 32);
        ctx.lineTo(cx + 10, baseY - 28);
        ctx.lineTo(cx, baseY - 24);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawHUD() {
    ctx.fillStyle = C.text;
    ctx.font = "bold 14px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "right";
    const s = String(Math.floor(score)).padStart(5, "0");
    const b = String(best).padStart(5, "0");
    ctx.fillText("MAX " + b + "   " + s, W - 16, 26);
  }

  function drawCenteredText(title, sub) {
    ctx.textAlign = "center";
    ctx.fillStyle = C.dark;
    ctx.font = "bold 22px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(title, W / 2, 92);
    ctx.fillStyle = C.text;
    ctx.font = "15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(sub, W / 2, 118);
  }

  function draw() {
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, 0, W, H);
    drawClouds();
    drawSea();
    for (const o of obstacles) drawObstacle(o);
    drawBoat();
    drawHUD();
    if (state === "ready") {
      drawCenteredText("Cap au 220", "Espace ou tap pour larguer les amarres");
    } else if (state === "over") {
      drawCenteredText("À l'eau !", "Score " + Math.floor(score) + " — Espace pour repartir");
    }
  }

  // ---- Boucle ----
  function loop(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    if (state === "playing") update(dt);
    else if (!reducedMotion) wavePhase += dt * 3;  // la mer vit aussi sur l'écran game over
    draw();
    requestAnimationFrame(loop);
  }

  function startLoop() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  // ---- Entrées ----
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      jump();
    }
  });
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    jump();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) last = performance.now();
  });
  window.addEventListener("resize", resizeCanvas);

  // ---- Démarrage : une frame fixe, la rAF ne tourne qu'après le premier input ----
  initClouds();
  resizeCanvas();
})();
