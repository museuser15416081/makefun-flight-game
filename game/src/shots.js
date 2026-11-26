// The three deterministic frames used for the entry's screenshots. Each one puts the real world
// into a hand-placed state — same aeroplane, same island, same instruments — and returns the
// screen to draw over it. No simulation is run, so ?seed=1 always looks the same.

import { RINGS, WORLD } from './config.js';
import { SCREEN } from './render.js';
import { STAGE } from './mission.js';

function ringScore(count) {
  let total = 0;
  for (let i = 0; i < count; i += 1) total += 200 + 46 + i * 4;
  return total;
}

export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  state.visualTime = 2.2;
  state.shake = 0;
  state.effects.length = 0;
  state.toast = null;

  if (name === 'play') {
    const plane = state.plane;
    const mission = state.mission;
    const ring = RINGS[1];
    plane.x = ring.x - 360;
    plane.alt = ring.alt;
    plane.speed = 86;
    plane.vs = 6;
    plane.pitch = 0.1;
    plane.bank = 0.44;
    plane.throttle = 0.72;
    plane.throttleTarget = 0.72;
    plane.fuel = 61;
    plane.onGround = false;
    plane.prop = 3.4;

    mission.stage = STAGE.RINGS;
    mission.active = 1;
    mission.time = 34;
    mission.rings[0].state = 'passed';
    mission.breakdown.takeoff = 100;
    mission.breakdown.ringCount = 1;
    mission.breakdown.rings = 246;
    mission.score = 346;

    state.camera.x = plane.x;
    state.camera.alt = plane.alt;
    state.tod = 0.28;
    state.visualTime = 5.4;
    return { screen: SCREEN.PLAY };
  }

  if (name === 'end') {
    const plane = state.plane;
    const mission = state.mission;
    plane.x = WORLD.length - 380;
    plane.alt = WORLD.runwayAlt;
    plane.speed = 34;
    plane.vs = 0;
    plane.pitch = 0;
    plane.bank = 0;
    plane.throttle = 0.06;
    plane.throttleTarget = 0.06;
    plane.fuel = 41;
    plane.onGround = true;
    plane.prop = 1.2;

    mission.stage = STAGE.DONE;
    mission.active = mission.rings.length;
    mission.time = 97;
    mission.rings.forEach((ring) => { ring.state = 'passed'; });
    mission.breakdown = {
      takeoff: 100,
      rings: 1262,
      ringCount: 5,
      time: 107,
      landing: 287,
      fuel: 123,
      total: 1879,
    };
    mission.score = 1879;

    state.camera.x = plane.x;
    state.camera.alt = plane.alt;
    state.tod = 0.62;
    state.visualTime = 8.1;
    return { screen: SCREEN.COMPLETE };
  }

  // start: the title screen, aeroplane waiting on the dawn strip.
  state.plane.throttle = 0.05;
  state.plane.throttleTarget = 0.05;
  state.plane.prop = 0.6;
  state.camera.x = state.plane.x;
  state.camera.alt = state.plane.alt;
  state.tod = 0;
  state.visualTime = 0.7;
  return { screen: SCREEN.TITLE };
}
