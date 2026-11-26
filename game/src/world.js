// The simulation's front door: island, aeroplane, sortie and camera, advanced one fixed step at
// a time. Nothing here draws. The loop above it asks for a step, gets EV flags back, and decides
// which screen and which sound belongs to them.

import { EV, WORLD } from './config.js';
import { createAircraft, resetAircraft, stepAircraft } from './flight.js';
import { createIsland } from './terrain.js';
import { createMission, resetMission, stepMission } from './mission.js';

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function createWorld(random) {
  const island = createIsland(random);
  const plane = createAircraft();
  const mission = createMission();
  const camera = { x: plane.x, alt: plane.alt };
  const state = {
    island,
    plane,
    mission,
    camera,
    elapsed: 0,
    tod: 0,
    visualTime: 0,
    shake: 0,
    effects: [],
    toast: null,
  };

  resetMission(mission);
  resetAircraft(plane);

  function reset() {
    resetMission(mission);
    resetAircraft(plane);
    state.elapsed = 0;
    state.tod = 0;
    state.shake = 0;
    state.effects.length = 0;
    state.toast = null;
    camera.x = plane.x;
    camera.alt = plane.alt;
  }

  function puff(kind, x, alt, count, spread) {
    for (let i = 0; i < count; i += 1) {
      state.effects.push({
        kind,
        x: x + (Math.random() - 0.5) * spread,
        alt: alt + Math.random() * spread * 0.4,
        born: state.visualTime + i * 0.05,
        drift: (Math.random() - 0.4) * 26,
        size: 8 + Math.random() * 18,
      });
    }
  }

  function step(dt, controls) {
    if (state.mission.stage === 'done' || state.mission.stage === 'failed') return 0;

    const prevX = plane.x;
    const scoreBefore = mission.score;
    let events = stepAircraft(plane, controls, dt, island);
    events |= stepMission(mission, plane, island, prevX, events, dt);

    camera.x = plane.x;
    const lead = clamp(plane.vs * 0.55, -42, 42);
    camera.alt += (plane.alt + lead - camera.alt) * Math.min(1, dt * 3.1);

    state.elapsed += dt;
    state.tod = Math.min(0.84, state.elapsed / 165);
    state.shake = Math.max(0, state.shake - dt * 1.7);

    if (events & EV.CRASH) {
      state.shake = 1;
      puff('smoke', plane.x, plane.alt, 14, 40);
    }
    if (events & EV.LAND) {
      puff('dust', plane.x, plane.alt, 8, 30);
    }
    if (events & EV.RING) {
      const ring = mission.rings[Math.max(0, mission.active - 1)];
      if (ring) puff('spark', ring.x, ring.alt, 12, ring.radius * 1.2);
      state.toast = { text: `GATE ${mission.breakdown.ringCount} CLEAR   +${mission.score - scoreBefore}`, born: state.visualTime, color: '#ffc978', big: true };
    }
    if (events & EV.MISS) {
      state.toast = { text: 'GATE MISSED', born: state.visualTime, color: '#ff6b5e', big: false };
    }
    if (events & EV.TAKEOFF) {
      state.toast = { text: 'AIRBORNE', born: state.visualTime, color: '#7fe7d4', big: false };
    }
    if (events & EV.FUEL_OUT) {
      state.toast = { text: 'ENGINE OUT', born: state.visualTime, color: '#ff6b5e', big: true };
    }
    return events;
  }

  function tickVisual(dt) {
    state.visualTime += dt;
  }

  return { state, reset, step, tickVisual };
}

/** Compass bearing for the lap: east at the strip, turning with the island as it goes round. */
export function headingOf(plane) {
  return (90 + 360 * (plane.x / WORLD.length)) % 360;
}
