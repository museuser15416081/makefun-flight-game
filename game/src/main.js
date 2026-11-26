// Boot and the one loop. The world advances in fixed sixtieths, the renderer paints whatever
// state comes out of it, and the screens change on the events the step returns: title, flying,
// paused, crashed, complete. ?shot=start|play|end paints a staged frame for screenshots.

import { BEST_KEY, EV, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createInput, ACT } from './input.js';
import { createRenderer, SCREEN } from './render.js';
import { stageShot } from './shots.js';
import {
  chime, crash, ensureAudio, fuelSputter, isMuted, missBuzz, stallHorn,
  toggleMute, touchdown, updateEngine,
} from './audio.js';

const MAX_FRAME = 0.12;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Private windows: the best score lasts for the visit.
  }
}

function say(message) {
  status.textContent = message;
}

function runShot() {
  const staged = stageShot(shotName, world);
  const best = Math.max(readBest(), world.state.mission.breakdown.total || 0);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, staged.screen, { best, muted: false });
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN.TITLE;
  let best = readBest();
  let muted = isMuted();
  let accumulator = 0;
  let last = performance.now();

  function startSortie() {
    ensureAudio();
    world.reset();
    accumulator = 0;
    screen = SCREEN.PLAY;
    say('Airborne soon. Throttle up, then ease back at one hundred knots.');
  }

  function handleEvents(events) {
    const mission = world.state.mission;
    if (events & EV.RING) chime(mission.breakdown.ringCount);
    if (events & EV.MISS) missBuzz();
    if (events & EV.STALL) stallHorn();
    if (events & EV.FUEL_OUT) fuelSputter();
    if (events & EV.TOUCHDOWN) {
      const sink = world.state.plane.touchdown ? world.state.plane.touchdown.sink : 2;
      touchdown(Math.min(1, sink / 6.2));
    }
    if (events & EV.CRASH) {
      screen = SCREEN.CRASH;
      crash();
      say(`${mission.failTitle}. ${mission.crashReason}`);
    } else if (events & EV.LAND) {
      screen = SCREEN.COMPLETE;
      if (mission.score > best) {
        best = mission.score;
        saveBest(best);
      }
      chime(3);
      say(`Mission complete. Score ${mission.score}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACT.MUTE) {
      muted = toggleMute();
      ensureAudio();
    }
    if (actions & ACT.PAUSE) {
      if (screen === SCREEN.PLAY) {
        screen = SCREEN.PAUSED;
        say('Paused.');
      } else if (screen === SCREEN.PAUSED) {
        screen = SCREEN.PLAY;
        say('Flying.');
      }
    }
    if (actions & ACT.CONFIRM) {
      if (screen === SCREEN.TITLE || screen === SCREEN.CRASH || screen === SCREEN.COMPLETE) {
        startSortie();
      } else if (screen === SCREEN.PAUSED) {
        screen = SCREEN.PLAY;
        say('Flying.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000));
    last = now;
    world.tickVisual(dt);

    handleActions();

    if (screen === SCREEN.PLAY) {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= STEP && screen === SCREEN.PLAY && steps < 6) {
        const events = world.step(STEP, input.controls());
        accumulator -= STEP;
        steps += 1;
        handleEvents(events);
      }
    } else {
      accumulator = 0;
    }

    if (screen === SCREEN.TITLE) {
      world.state.plane.prop += dt * 5;
      world.state.camera.alt += (world.state.plane.alt - world.state.camera.alt) * Math.min(1, dt * 3);
    }

    updateEngine(world.state.plane, screen === SCREEN.PLAY);
    renderer.draw(world.state, screen, { best, muted });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN.PLAY) {
      screen = SCREEN.PAUSED;
      say('Paused.');
    }
  });

  // Browsers only allow an AudioContext to start inside a gesture: open it on the first one.
  window.addEventListener('keydown', ensureAudio, { once: true });
  window.addEventListener('pointerdown', ensureAudio, { once: true });

  say('Dawn Patrol: Island Run. Press Enter to fly.');
  requestAnimationFrame(frame);
}

if (shotName) runShot();
else runGame();
