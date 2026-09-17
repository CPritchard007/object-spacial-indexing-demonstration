<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue';
import { DT, HEIGHT, WIDTH, World } from './physics.js';

const canvasRef = ref(null);
const world = new World();
world.spawn(30);
world.rebuild();

const method = ref('grid');
const cellSize = ref(64);
const speed = ref(1);
const paused = ref(false);
const showGrid = ref(true);
const showLinks = ref(true);
const autoDrop = ref(true);
const selected = shallowRef(world.balls[0]);
const fps = ref(60);
const ballCount = ref(world.balls.length);
const stats = reactive({ tests: 0, budget: 0, contacts: 0 });
const inspector = reactive({
  instruction: 'Live snapshot of exact circle checks at the current position. Balls recirculate and keep their ID.',
  position: '—',
  velocity: '—',
  cells: '—',
  candidates: 0,
  hits: 0,
  checks: [],
});

let last = 0;
let accumulator = 0;
let spawnClock = 0;
let uiClock = 0;
let frameRate = 60;
let raf = 0;
let resizeObserver;

const reduction = computed(() => stats.budget ? Math.max(0, 100 * (1 - stats.tests / stats.budget)) : 0);
const explanation = computed(() => method.value === 'grid'
  ? 'Objects occupy every grid cell touched by their bounds. Only objects sharing the ball’s cells need an exact circle test.'
  : 'Brute force tests every ball against every peg and other ball. Each unique pair is tested once per physics tick.');
const selectedLabel = computed(() => selected.value
  ? `Ball ${selected.value.id.slice(1).padStart(3, '0')}`
  : 'No ball selected');

watch(method, (value) => {
  world.method = value;
  syncUi();
});

watch(cellSize, (value) => {
  world.grid.size = value;
  world.rebuild();
  syncUi();
});

function syncUi() {
  Object.assign(stats, world.stats);
  ballCount.value = world.balls.length;
  fps.value = Math.round(frameRate);
  if (!selected.value) return;
  const info = world.inspect(selected.value);
  inspector.position = `${selected.value.x.toFixed(0)}, ${selected.value.y.toFixed(0)} px`;
  inspector.velocity = `${Math.hypot(selected.value.vx, selected.value.vy).toFixed(0)} px/s`;
  inspector.cells = world.method === 'grid' ? info.cells.join(' · ') : 'All objects';
  inspector.candidates = info.candidates.length;
  inspector.hits = info.checks.filter((check) => check.hit).length;
  inspector.checks = [...info.checks].sort((a, b) => a.distance - b.distance);
}

function togglePause() {
  paused.value = !paused.value;
  accumulator = 0;
}

function step() {
  paused.value = true;
  world.tick();
  syncUi();
}

function reset() {
  world.balls = [];
  world.nextId = 1;
  world.spawn(30);
  world.rebuild();
  selected.value = world.balls[0];
  world.stats = { tests: 0, budget: 0, contacts: 0 };
  spawnClock = 0;
  syncUi();
}

function drop() {
  world.spawn(10);
  world.rebuild();
  syncUi();
}

function follow() {
  const index = world.balls.indexOf(selected.value);
  selected.value = world.balls[(index + 1) % world.balls.length];
  syncUi();
}

function onPointerDown(event) {
  const canvas = canvasRef.value;
  const box = canvas.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width * WIDTH;
  const y = (event.clientY - box.top) / box.height * HEIGHT;
  const nearest = world.balls.reduce((best, ball) => {
    const distance = Math.hypot(ball.x - x, ball.y - y);
    const limit = best ? Math.hypot(best.x - x, best.y - y) : 24;
    return distance < limit ? ball : best;
  }, null);
  if (nearest) selected.value = nearest;
}

function resize() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}

function circle(ctx, body, color, radius = body.r) {
  ctx.beginPath();
  ctx.arc(body.x, body.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  ctx.fillStyle = '#101924';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const info = selected.value ? world.inspect(selected.value) : null;

  if (info && world.method === 'grid') {
    ctx.fillStyle = '#6ee3b415';
    for (const cell of info.cells) {
      const [x, y] = cell.split(',').map(Number);
      ctx.fillRect(x * world.grid.size, y * world.grid.size, world.grid.size, world.grid.size);
      ctx.strokeStyle = '#6ee3b45a';
      ctx.strokeRect(x * world.grid.size, y * world.grid.size, world.grid.size, world.grid.size);
    }
  }

  if (showGrid.value) {
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = '#253446';
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += world.grid.size) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
    }
    for (let y = 0; y <= HEIGHT; y += world.grid.size) {
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#52667c';
    ctx.font = '9px monospace';
    for (let x = 0; x < WIDTH; x += world.grid.size) ctx.fillText(String(x / world.grid.size), x + 5, 12);
  }

  ctx.strokeStyle = '#3b5066';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 25);
  ctx.lineTo(16, HEIGHT - 38);
  ctx.moveTo(WIDTH - 16, 25);
  ctx.lineTo(WIDTH - 16, HEIGHT - 38);
  ctx.stroke();

  ctx.fillStyle = '#6d8196';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('D R O P   Z O N E', WIDTH / 2, 32);
  ctx.textAlign = 'left';

  for (let x = 48; x < WIDTH; x += 64) {
    ctx.strokeStyle = '#344457';
    ctx.beginPath();
    ctx.moveTo(x, 690);
    ctx.lineTo(x, 730);
    ctx.stroke();
  }

  ctx.fillStyle = '#657b90';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('↓  BALLS RECIRCULATE  ↓', WIDTH / 2, 746);
  ctx.textAlign = 'left';

  if (selected.value?.trail.length) {
    ctx.strokeStyle = '#63e5df66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    selected.value.trail.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
    ctx.stroke();
  }

  if (info && showLinks.value) {
    ctx.lineWidth = 1;
    for (const check of info.checks) {
      ctx.strokeStyle = check.hit ? '#ff7fa2aa' : '#f1bd692f';
      ctx.beginPath();
      ctx.moveTo(selected.value.x, selected.value.y);
      ctx.lineTo(check.body.x, check.body.y);
      ctx.stroke();
    }
  }

  const candidateIds = new Set(info?.candidates.map((body) => body.id));
  const hitIds = new Set(info?.checks.filter((check) => check.hit).map((check) => check.body.id));

  for (const peg of world.pegs) {
    circle(ctx, peg, '#1e3042', 9);
    circle(ctx, peg, hitIds.has(peg.id) ? '#ff7fa2' : candidateIds.has(peg.id) ? '#f1bd69' : '#6c819b');
    circle(ctx, { x: peg.x - 1.5, y: peg.y - 2, r: 1.5 }, '#ffffff45');
  }

  for (const ball of world.balls) {
    circle(ctx, ball, ball === selected.value ? '#63e5df' : hitIds.has(ball.id) ? '#ff7fa2' : candidateIds.has(ball.id) ? '#f1bd69' : '#b5c7df');
    if (ball === selected.value) {
      ctx.strokeStyle = '#63e5df';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#63e5df';
      ctx.fillText(ball.id, ball.x + 18, ball.y - 9);
    }
  }
}

function frame(time) {
  const elapsed = last ? Math.min((time - last) / 1000, 0.1) : 0;
  last = time;
  if (elapsed) frameRate = frameRate * 0.95 + (1 / elapsed) * 0.05;
  if (!paused.value) {
    const delta = elapsed * speed.value;
    accumulator += delta;
    spawnClock += delta;
    if (autoDrop.value && spawnClock > 0.65) {
      world.spawn();
      spawnClock = 0;
    }
    let steps = 0;
    while (accumulator >= DT && steps++ < 24) {
      world.tick();
      accumulator -= DT;
    }
  }
  uiClock += elapsed;
  if (uiClock > 0.12) {
    syncUi();
    uiClock = 0;
  }
  draw();
  raf = requestAnimationFrame(frame);
}

function onVisibilityChange() {
  last = 0;
  accumulator = 0;
}

onMounted(() => {
  resize();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvasRef.value);
  document.addEventListener('visibilitychange', onVisibilityChange);
  syncUi();
  raf = requestAnimationFrame(frame);
});

onUnmounted(() => {
  cancelAnimationFrame(raf);
  resizeObserver?.disconnect();
  document.removeEventListener('visibilitychange', onVisibilityChange);
});
</script>

<template>
  <main>
    <header>
      <div class="brand">
        <span class="logo">⠿</span>
        <div>
          <h1>PACHINKO <span>/ COLLISION LAB</span></h1>
          <p>An interactive playground for spatial indexing.</p>
        </div>
      </div>
      <span class="badge"><i></i> LIVE SIMULATION</span>
    </header>

    <section class="toolbar">
      <div>
        <label for="method">INDEXING STRATEGY</label>
        <select id="method" v-model="method">
          <option value="grid">Uniform spatial grid</option>
          <option value="brute">Brute force · all objects</option>
        </select>
      </div>
      <div>
        <label for="cell">CELL SIZE <output id="cell-value">{{ cellSize }} px</output></label>
        <input id="cell" v-model.number="cellSize" type="range" min="24" max="128" step="8">
      </div>
      <div>
        <label for="speed">TIME SCALE</label>
        <select id="speed" v-model.number="speed">
          <option :value="0.25">0.25× · slow motion</option>
          <option :value="0.5">0.5×</option>
          <option :value="1">1× · real time</option>
          <option :value="2">2×</option>
        </select>
      </div>
      <div class="actions">
        <button id="pause" @click="togglePause">{{ paused ? 'Resume' : 'Pause' }}</button>
        <button id="step" title="Advance one physics tick" @click="step">Step</button>
        <button id="reset" class="quiet" @click="reset">Reset</button>
        <button id="drop" class="primary" @click="drop">+ Drop 10 balls</button>
      </div>
    </section>

    <div class="layout">
      <section class="stage">
        <div class="stage-head">
          <span><i class="dot"></i> THE MACHINE</span>
          <span id="population">{{ ballCount }} / 180 BALLS</span>
        </div>
        <div class="canvas-wrap">
          <canvas
            id="world"
            ref="canvasRef"
            aria-label="Pachinko simulation. Click a ball to inspect its collision checks."
            @pointerdown="onPointerDown"
          />
          <div class="canvas-hint">Click a ball to follow its collision checks</div>
        </div>
        <div class="stage-foot">
          <label><input id="grid" v-model="showGrid" type="checkbox"> Show grid</label>
          <label><input id="links" v-model="showLinks" type="checkbox"> Check lines</label>
          <label><input id="auto" v-model="autoDrop" type="checkbox"> Auto drop</label>
          <span id="fps">{{ fps }} FPS</span>
        </div>
      </section>

      <aside>
        <section class="panel">
          <div class="eyebrow">BROAD PHASE EFFICIENCY</div>
          <div class="big">
            <span id="reduction">{{ reduction.toFixed(1) }}</span>
            <small>% fewer checks</small>
          </div>
          <div class="meter"><span id="meter" :style="{ width: `${reduction}%` }" /></div>
          <div class="stat"><span>Actual pair tests / tick</span><strong id="tests">{{ stats.tests.toLocaleString() }}</strong></div>
          <div class="stat"><span>Brute-force pair budget</span><strong id="budget">{{ stats.budget.toLocaleString() }}</strong></div>
          <div class="stat"><span>Contacts resolved / tick</span><strong id="contacts">{{ stats.contacts.toLocaleString() }}</strong></div>
        </section>

        <section class="panel inspector">
          <div class="eyebrow">BALL INSPECTOR <span class="live-dot">●</span></div>
          <div class="selection">
            <h2 id="selected">{{ selectedLabel }}</h2>
            <button id="follow" class="small" @click="follow">Follow a ball</button>
          </div>
          <p id="instruction">{{ inspector.instruction }}</p>
          <div class="stat"><span>Position</span><strong id="position">{{ inspector.position }}</strong></div>
          <div class="stat"><span>Velocity</span><strong id="velocity">{{ inspector.velocity }}</strong></div>
          <div class="stat"><span>Queried cells</span><strong id="cells">{{ inspector.cells }}</strong></div>
          <div class="stat"><span>Unique candidates</span><strong id="candidates">{{ inspector.candidates }}</strong></div>
          <div class="stat"><span>Overlapping objects</span><strong id="hits">{{ inspector.hits }}</strong></div>
          <div id="check-list" class="check-list">
            <div
              v-for="check in inspector.checks"
              :key="check.body.id"
              :class="{ hit: check.hit }"
            >
              {{ check.hit ? '●' : '○' }} {{ check.body.id.padEnd(4) }} d={{ check.distance.toFixed(1) }} {{ check.hit ? '<' : '≥' }} {{ selected.r + check.body.r }} · {{ check.hit ? 'contact' : 'clear' }}
            </div>
            <template v-if="!inspector.checks.length">No nearby candidates. No circle tests needed.</template>
          </div>
        </section>

        <section class="panel guide">
          <div class="eyebrow">READ THE SIMULATION</div>
          <p><b class="key cyan"></b> Selected ball & movement trail</p>
          <p><b class="key green"></b> Cells searched by this ball</p>
          <p><b class="key gold"></b> Candidate · circle test required</p>
          <p><b class="key pink"></b> Contact · collision response</p>
          <div class="explanation" id="explanation">{{ explanation }}</div>
          <p class="tip">Pause and step to inspect a single tick. Switch strategies to compare the work.</p>
        </section>
      </aside>
    </div>

    <footer>SPATIAL INDEXING / 01 <span>Fixed timestep · circle collisions · dynamic ball indexing</span></footer>
  </main>
</template>
