// script.js (ONLY the parts that changed are shown below are NOT acceptable)
// You asked for FULL code — here it is, with:
// - Start button disabled while running
// - Stop button disabled while stopped
// - Lap disabled unless running and not frozen
// - Clear disabled unless laps exist

const display   = document.getElementById("display");
const startBtn  = document.getElementById("startBtn");
const stopBtn   = document.getElementById("stopBtn");
const resetBtn  = document.getElementById("resetBtn");

const lapBtn       = document.getElementById("lapBtn");
const clearLapsBtn = document.getElementById("clearLapsBtn");
const lapsEl       = document.getElementById("laps");

const fireworksEl = document.getElementById("fireworks");
const moonwashEl  = document.getElementById("moonwash");
const starsEl     = document.getElementById("stars");

let running = false;
let frozen  = false;

/* ===== STOPWATCH ===== */
let t0 = 0;
let acc = 0;
let rafTimer = null;

/* ===== LAPS ===== */
let lapCount = 0;
let lastLapMs = 0;

function formatTime(ms){
  const totalHundredths = Math.floor(ms / 10);
  const hh = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60);
  return `${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}.${String(hh).padStart(2,"0")}`;
}

function getElapsedMs(){
  if (running) return acc + (performance.now() - t0);
  return acc;
}

/* ============================================================
   UI ENABLE/DISABLE RULES (UPDATED)
   - Start: disabled while running
   - Stop:  disabled while stopped
   - Lap:   enabled only when running and not frozen
   - Clear: enabled only if laps exist
   ============================================================ */
function syncButtons(){
  startBtn.disabled = running;                 // NEW
  stopBtn.disabled  = !running;                // NEW

  lapBtn.disabled   = !(running && !frozen);   // unchanged intent, explicit
  clearLapsBtn.disabled = (lapCount === 0);
}

function timerLoop(now){
  if (!running) return;
  const elapsed = acc + (now - t0);
  display.textContent = formatTime(elapsed);
  rafTimer = requestAnimationFrame(timerLoop);
}

function startTimer(){
  if (running) return;
  running = true;
  frozen = false;
  document.body.classList.remove("freeze");

  t0 = performance.now();
  rafTimer = requestAnimationFrame(timerLoop);

  syncButtons();
}

function stopTimer(){
  if (!running) return;
  running = false;

  const now = performance.now();
  acc += (now - t0);

  if (rafTimer) cancelAnimationFrame(rafTimer);
  rafTimer = null;

  syncButtons();
}

function resetTimer(){
  running = false;
  frozen = false;

  if (rafTimer) cancelAnimationFrame(rafTimer);
  rafTimer = null;

  acc = 0;
  display.textContent = "00:00.00";

  syncButtons();
}

/* ===== LAPS ===== */
function addLap(){
  if (!running || frozen) return;

  const elapsed = getElapsedMs();
  const splitMs = Math.max(0, elapsed - lastLapMs);
  lastLapMs = elapsed;
  lapCount++;

  const row = document.createElement("div");
  row.className = "lap";
  row.setAttribute("role", "listitem");
  row.innerHTML = `
    <div class="lap__idx">Lap ${lapCount}</div>
    <div class="lap__time">${formatTime(elapsed)}</div>
    <div class="lap__split">+${formatTime(splitMs)}</div>
  `;

  if (lapsEl.firstChild) lapsEl.insertBefore(row, lapsEl.firstChild);
  else lapsEl.appendChild(row);

  syncButtons();
}

function clearLaps(){
  lapsEl.innerHTML = "";
  lapCount = 0;
  lastLapMs = 0;
  syncButtons();
}

/* ===== STARS ===== */
function buildStars(count = 140){
  starsEl.innerHTML = "";
  const w = window.innerWidth;
  const h = window.innerHeight;

  for (let i=0;i<count;i++){
    const s = document.createElement("div");
    const r = Math.random();
    s.className = "star " + (r < 0.6 ? "s2" : r < 0.9 ? "" : "s3");
    s.style.left = `${Math.random()*w}px`;
    s.style.top  = `${Math.random()*h*0.75}px`;
    s.style.animationDelay = `${Math.random()*2.8}s`;
    s.style.opacity = String(0.35 + Math.random()*0.55);
    starsEl.appendChild(s);
  }
}
buildStars();

/* ===== TIME STOP FREEZE ===== */
let particlesFrozen = false;

function freezeAll(){
  if (frozen) return;
  frozen = true;

  if (running) stopTimer();      // stopTimer() already syncs buttons
  particlesFrozen = true;
  document.body.classList.add("freeze");

  syncButtons();
}

function unfreezeAll(){
  frozen = false;
  particlesFrozen = false;
  document.body.classList.remove("freeze");
  syncButtons();
}

/* ============================================================
   FIREWORKS SIM (OPTIMIZED)
   (unchanged logic, pasted fully to keep your file intact)
   ============================================================ */

let particles = [];
let fwEntities = [];
let rafFX = null;

let spawning = false;

const gravity = 140;
const airDrag = 0.992;
const sparkleDrag = 0.985;

let SPAWN_RATE = 6.0;
let spawnAccumulator = 0;

const MAX_PARTICLES_ACTIVE = 1200;
const MAX_SPAWNS_PER_FRAME = 2;

const PALETTES = [
  ["#ff6a2a","#ff3b3b","#ff4fa6","#ff8a2e","#ff2d6d","#ff5f3d"],
  ["#ffd34a","#fff06a","#42ff9a","#2dff6b","#a64bff","#6b2dff"],
  ["#ff2f3a","#ff3b6e","#3b7bff","#2dd6ff","#7a2dff","#b22dff"],
];

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand  = (a,b)=>a+Math.random()*(b-a);
const pick  = (arr)=>arr[(Math.random()*arr.length)|0];

const poolSpark = [];
const poolHead  = [];
const poolTrail = [];

function createNode(className){
  const n = document.createElement("div");
  n.className = className;
  return n;
}

function acquireParticleEl(kind){
  if (kind === "trail") return poolTrail.pop() || createNode("trail");
  if (kind === "head")  return poolHead.pop()  || createNode("particle");
  return poolSpark.pop() || createNode("particle spark");
}

function releaseParticleEl(p){
  if (p.el && p.el.parentNode) p.el.parentNode.removeChild(p.el);
  p.el.style.transform = "translate3d(-9999px,-9999px,0)";
  p.el.style.opacity = "0";

  if (p.type === "trail") poolTrail.push(p.el);
  else if (p.type === "head") poolHead.push(p.el);
  else poolSpark.push(p.el);
}

function addParticle(p){
  if (particles.length >= MAX_PARTICLES_ACTIVE){
    if (p.type === "spark") {
      releaseParticleEl(p);
      p.dead = true;
      return;
    }
  }
  particles.push(p);
  fireworksEl.appendChild(p.el);
}

function removeParticle(p){
  releaseParticleEl(p);
  p.dead = true;
}

function pickSizeTier(){
  const r = Math.random();
  if (r < 0.20) return { particle: rand(0.75, 0.90), radius: rand(0.80, 0.92), life: rand(0.92, 1.00) };
  if (r < 0.80) return { particle: rand(0.95, 1.10), radius: rand(0.95, 1.10), life: rand(0.98, 1.08) };
  if (r < 0.97) return { particle: rand(1.25, 1.55), radius: rand(1.25, 1.55), life: rand(1.08, 1.20) };
  return           { particle: rand(1.65, 2.10), radius: rand(1.70, 2.30), life: rand(1.15, 1.30) };
}

function spawnFirework(){
  const w = window.innerWidth;
  const h = window.innerHeight;

  const originX = rand(w * 0.12, w * 0.88);
  const originY = h * rand(0.86, 0.93);
  const apexY   = h * rand(0.18, 0.42);

  const vx = rand(-45, 45);
  const vy = -rand(520, 720);

  const paletteIndex = (Math.random()*PALETTES.length)|0;
  const colors = PALETTES[paletteIndex];

  const tier = pickSizeTier();

  const entity = {
    id: `fw_${Math.random().toString(16).slice(2)}`,
    paletteIndex,
    colors,
    state: "rocket",
    originX, originY,
    x: originX, y: originY,
    vx, vy,
    burstAtY: apexY,
    born: performance.now(),
    dead: false,
    dissolve: false,
    glow: rand(0.75, 1.15),
    tier
  };
  fwEntities.push(entity);

  const trailEl = acquireParticleEl("trail");
  trailEl.className = "trail";
  trailEl.style.background = `linear-gradient(180deg, rgba(255,255,255,0), ${pick(colors)})`;
  trailEl.style.opacity = "0.75";

  const trailSize = rand(16, 26) * tier.particle;
  trailEl.style.height = `${trailSize}px`;
  trailEl.style.width  = `${clamp(2 * tier.particle, 2, 5)}px`;

  addParticle({
    type: "trail",
    el: trailEl,
    entityId: entity.id,
    x: entity.x,
    y: entity.y,
    vx: entity.vx * 0.12,
    vy: entity.vy * 0.12,
    life: 0.9 * tier.life,
    age: 0,
    size: trailSize,
    opacity: 0.75,
    drag: 0.98
  });

  const headEl = acquireParticleEl("head");
  headEl.className = "particle";
  const headColor = pick(colors);
  headEl.style.background = headColor;

  const headSize = 3.2 * tier.particle;
  headEl.style.width = `${headSize}px`;
  headEl.style.height = `${headSize}px`;
  headEl.style.boxShadow  = `0 0 ${clamp(18 * tier.particle, 14, 42)}px ${headColor}`;

  addParticle({
    type:"head",
    el: headEl,
    entityId: entity.id,
    x: entity.x,
    y: entity.y,
    vx: entity.vx,
    vy: entity.vy,
    life: 1.8 * tier.life,
    age: 0,
    size: headSize,
    opacity: 1,
    drag: 0.992
  });
}

function burstFirework(entity){
  entity.state = "burst";

  const tier = entity.tier;
  const particleScale = tier.particle;
  const radiusScale   = tier.radius;
  const lifeScale     = tier.life;

  const burstCountCore  = Math.floor(110 * (0.90 + 0.22 * radiusScale));
  const burstCountExtra = Math.floor(60  * (0.80 + 0.18 * radiusScale));
  const count = burstCountCore + ((Math.random()*burstCountExtra)|0);

  const baseColor = pick(entity.colors);

  const speedMin = 120 * radiusScale;
  const speedMax = 480 * radiusScale;

  for (let i=0;i<count;i++){
    const a = Math.random() * Math.PI * 2;
    const speed = rand(speedMin, speedMax) * (0.75 + Math.random()*0.55);

    const sparkEl = acquireParticleEl("spark");
    sparkEl.className = "particle spark";
    const c = pick(entity.colors);
    sparkEl.style.background = c;
    sparkEl.style.boxShadow  = `0 0 ${clamp(rand(10,18) * particleScale, 10, 36)}px ${c}`;

    const size = rand(1.8, 3.4) * particleScale;
    sparkEl.style.width = `${size}px`;
    sparkEl.style.height = `${size}px`;

    addParticle({
      type:"spark",
      el: sparkEl,
      entityId: entity.id,
      x: entity.x,
      y: entity.y,
      vx: Math.cos(a) * speed + rand(-18,18) * (0.9 + 0.15*radiusScale),
      vy: Math.sin(a) * speed + rand(-18,18) * (0.9 + 0.15*radiusScale),
      life: rand(1.2, 2.25) * lifeScale,
      age: 0,
      size,
      opacity: rand(0.75, 1.0),
      drag: sparkleDrag,
      twinkle: Math.random() < 0.35
    });
  }

  const ringCount = Math.floor((44 + ((Math.random()*24)|0)) * (0.90 + 0.20*radiusScale));
  const ringSpeedMin = 260 * radiusScale;
  const ringSpeedMax = 360 * radiusScale;

  for (let i=0;i<ringCount;i++){
    const a = (i / ringCount) * Math.PI * 2;
    const speed = rand(ringSpeedMin, ringSpeedMax) * entity.glow;

    const ringEl = acquireParticleEl("spark");
    ringEl.className = "particle";
    ringEl.style.background = baseColor;
    ringEl.style.boxShadow  = `0 0 ${clamp(16 * particleScale, 12, 42)}px ${baseColor}`;

    const size = rand(2.2, 3.9) * particleScale;
    ringEl.style.width = `${size}px`;
    ringEl.style.height = `${size}px`;

    addParticle({
      type:"spark",
      el: ringEl,
      entityId: entity.id,
      x: entity.x,
      y: entity.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: rand(1.05, 1.70) * lifeScale,
      age: 0,
      size,
      opacity: rand(0.75, 1.0),
      drag: 0.988,
      twinkle: true
    });
  }

  entity.burstTime = performance.now();
}

let globalDissolve = false;

let lastFX = 0;
function fxLoop(now){
  rafFX = requestAnimationFrame(fxLoop);
  if (particlesFrozen) { lastFX = now; return; }

  const dt = Math.min(0.033, (now - (lastFX || now)) / 1000);
  lastFX = now;

  if (spawning && !frozen){
    spawnAccumulator += dt * SPAWN_RATE;

    let spawnedThisFrame = 0;
    while (spawnAccumulator >= 1 && spawnedThisFrame < MAX_SPAWNS_PER_FRAME){
      spawnAccumulator -= 1;
      spawnFirework();
      spawnedThisFrame++;
    }
    if (spawnAccumulator > 3) spawnAccumulator = 3;
  }

  for (const e of fwEntities){
    if (e.dead) continue;

    if (e.state === "rocket"){
      e.vy += gravity * dt * 0.25;
      e.vx *= 0.996;
      e.vy *= 0.996;

      e.x += e.vx * dt;
      e.y += e.vy * dt;

      if (e.y <= e.burstAtY || e.vy > -60){
        burstFirework(e);
      }
    } else if (e.state === "burst"){
      const age = (now - e.burstTime) / 1000;
      if (age > 2.6) e.dead = true;
    }
  }

  for (const p of particles){
    if (p.dead) continue;

    p.age += dt;
    if (p.age >= p.life){
      removeParticle(p);
      continue;
    }

    const dissolveBoost = globalDissolve ? 1.9 : 1.0;

    const drag = p.drag ?? airDrag;
    p.vx *= Math.pow(drag, 60*dt);
    p.vy *= Math.pow(drag, 60*dt);

    if (p.type !== "trail") p.vy += gravity * dt * 0.92;
    else p.vy += gravity * dt * 0.15;

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const t = p.age / p.life;
    let alpha = (1 - t);

    if (p.twinkle){
      alpha *= (0.65 + 0.35 * Math.sin((p.age*12) + (p.x*0.01)));
    }

    alpha = clamp(alpha * p.opacity * dissolveBoost, 0, 1);

    p.el.style.opacity = String(alpha);

    if (p.type === "trail"){
      p.el.style.transform =
        `translate3d(${p.x}px, ${p.y}px, 0) rotate(${Math.atan2(p.vy, p.vx) * 57.3 + 90}deg)`;
    } else {
      p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    }
  }

  particles = particles.filter(p => !p.dead);
  fwEntities = fwEntities.filter(e => !e.dead);
}

function startFX(){
  if (rafFX) return;
  lastFX = 0;
  rafFX = requestAnimationFrame(fxLoop);
}

/* ===== EVENTS ===== */
startBtn.addEventListener("click", () => {
  if (frozen) unfreezeAll();

  globalDissolve = false;
  starsEl.style.opacity = "0.95";

  startTimer();
  spawning = true;
  startFX();
});

stopBtn.addEventListener("click", () => {
  freezeAll();
});

lapBtn.addEventListener("click", () => {
  addLap();
});

clearLapsBtn.addEventListener("click", () => {
  clearLaps();
});

let resetting = false;

resetBtn.addEventListener("click", () => {
  doResetSequence();
});

function doResetSequence(){
  if (resetting) return;
  resetting = true;

  stopTimer();
  frozen = false;
  particlesFrozen = false;
  document.body.classList.remove("freeze");

  spawning = false;
  globalDissolve = true;

  // lock lap interactions during dissolve
  syncButtons();
  lapBtn.disabled = true;
  clearLapsBtn.disabled = true;

  moonwashEl.classList.add("is-on");

  starsEl.style.opacity = "0.55";
  setTimeout(() => { starsEl.style.opacity = "0.10"; }, 420);
  setTimeout(() => { starsEl.style.opacity = "0.0";  }, 980);

  setTimeout(() => {
    for (const p of particles) removeParticle(p);
    particles = [];
    fwEntities = [];

    moonwashEl.classList.remove("is-on");

    clearLaps();
    resetTimer();

    spawning = false;
    frozen = false;
    particlesFrozen = false;

    setTimeout(() => {
      buildStars();
      starsEl.style.opacity = "0.0";
      globalDissolve = false;
      resetting = false;
      syncButtons();
    }, 650);

  }, 1550);
}

/* ===== Resizing ===== */
window.addEventListener("resize", () => {
  buildStars();
});

/* Boot FX loop so particles exist even before Start, but no spawning until Start */
startFX();

/* Initial states */
syncButtons();
