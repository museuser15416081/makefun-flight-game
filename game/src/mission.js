// The sortie: three jobs in one flight — get airborne, thread the five gates in order, and put
// it back on the strip. This file owns the rings, the scoring and the landing verdict; it never
// draws anything and never touches the browser.

import { EV, RINGS, SCORE, WORLD } from './config.js';

export const STAGE = {
  TAKEOFF: 'takeoff',
  RINGS: 'rings',
  LANDING: 'landing',
  DONE: 'done',
  FAILED: 'failed',
};

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function createMission() {
  return {
    rings: [],
    stage: STAGE.TAKEOFF,
    active: 0,
    time: 0,
    score: 0,
    fuelOut: false,
    crashReason: '',
    failTitle: '',
    breakdown: emptyBreakdown(),
  };
}

function emptyBreakdown() {
  return { takeoff: 0, rings: 0, ringCount: 0, time: 0, landing: 0, fuel: 0, total: 0 };
}

export function resetMission(mission) {
  mission.rings = RINGS.map((ring, index) => ({
    x: ring.x,
    alt: ring.alt,
    radius: ring.radius,
    state: 'ahead',
    pulse: index * 1.73,
  }));
  mission.stage = STAGE.TAKEOFF;
  mission.active = 0;
  mission.time = 0;
  mission.score = 0;
  mission.fuelOut = false;
  mission.crashReason = '';
  mission.failTitle = '';
  mission.breakdown = emptyBreakdown();
}

/** The line under the compass: what the pilot should be doing right now. */
export function missionText(mission, plane) {
  if (mission.stage === STAGE.TAKEOFF) return 'LIFT OFF — throttle up, ease back at 100 kt';
  if (mission.stage === STAGE.RINGS) {
    if (mission.fuelOut) return 'ENGINE OUT — trade height for speed and glide';
    return `RING ${mission.active + 1} OF ${mission.rings.length} — thread the lit gate`;
  }
  if (mission.stage === STAGE.LANDING) {
    if (mission.fuelOut) return 'ENGINE OUT — glide to the strip ahead';
    return 'FINAL — land back on the strip, gently';
  }
  if (mission.stage === STAGE.DONE) return 'SORTIE COMPLETE';
  return mission.crashReason;
}

export function progressText(mission) {
  if (mission.stage === STAGE.TAKEOFF) return 'STAGE 1 / 3 — TAKEOFF';
  if (mission.stage === STAGE.RINGS) return `STAGE 2 / 3 — GATES ${mission.breakdown.ringCount}/${mission.rings.length}`;
  if (mission.stage === STAGE.LANDING) return 'STAGE 3 / 3 — LANDING';
  if (mission.stage === STAGE.DONE) return 'SORTIE COMPLETE';
  return 'SORTIE FAILED';
}

function fail(mission, title, reason) {
  mission.stage = STAGE.FAILED;
  mission.failTitle = title;
  mission.crashReason = reason;
}

/** Score a touchdown on the tarmac, or write off the aeroplane. */
export function judgeLanding(mission, plane, island, touchdown) {
  if (mission.stage === STAGE.DONE || mission.stage === STAGE.FAILED) return 0;
  const sink = touchdown.sink;
  const speed = touchdown.speed;
  const offset = touchdown.offset;
  const fpm = Math.round(sink * 196.85);
  const knots = Math.round(speed * 1.944);

  if (mission.stage !== STAGE.LANDING) {
    plane.crashed = true;
    plane.crashKind = 'landing';
    fail(mission, 'TOUCHED DOWN EARLY', 'The gates were still ahead. Fly the course, then land.');
    return EV.CRASH;
  }
  if (sink > 6.2) {
    plane.crashed = true;
    plane.crashKind = 'landing';
    fail(mission, 'HARD LANDING', `You arrived at ${fpm} ft/min. Grease it on below 600.`);
    return EV.CRASH;
  }
  if (speed > 112) {
    plane.crashed = true;
    plane.crashKind = 'landing';
    fail(mission, 'TOO FAST', `Touched down at ${knots} kt. Slow to trim speed on final.`);
    return EV.CRASH;
  }
  if (speed < 38) {
    plane.crashed = true;
    plane.crashKind = 'landing';
    fail(mission, 'STALLED IN', `The wing quit at ${knots} kt on the numbers.`);
    return EV.CRASH;
  }

  plane.onGround = true;
  plane.alt = island.heightAt(plane.x);
  plane.vs = 0;
  plane.speed *= 0.7;
  plane.pitch = 0;

  const b = mission.breakdown;
  const sinkScore = Math.round(170 * clamp(1 - sink / 6.2, 0, 1));
  const trimScore = Math.round(80 * clamp(1 - Math.abs(speed - 72) / 36, 0, 1));
  const centreScore = Math.round(50 * clamp(1 - offset / (island.runwayHalf * 0.9), 0, 1));
  b.landing = sinkScore + trimScore + centreScore;
  b.time = Math.max(0, Math.round(SCORE.time - mission.time * SCORE.timeRate));
  b.fuel = Math.round(Math.max(0, plane.fuel) * SCORE.fuel);
  b.total = b.takeoff + b.rings + b.time + b.landing + b.fuel;
  mission.score = b.total;
  mission.stage = STAGE.DONE;
  return EV.LAND;
}

export function stepMission(mission, plane, island, prevX, events, dt) {
  if (mission.stage === STAGE.DONE || mission.stage === STAGE.FAILED) return 0;

  mission.time += dt;
  if (events & EV.FUEL_OUT) mission.fuelOut = true;

  if (events & EV.TAKEOFF && mission.stage === STAGE.TAKEOFF) {
    mission.breakdown.takeoff = SCORE.takeoff;
    mission.score = SCORE.takeoff;
    mission.stage = STAGE.RINGS;
  }

  if (events & EV.CRASH) {
    if (plane.crashKind === 'runway') {
      fail(mission, 'RUNWAY EXCURSION', 'You rolled off the tarmac. Rotate at one hundred knots.');
    } else {
      const feet = Math.round(plane.alt * 3.281);
      fail(mission, 'TERRAIN STRIKE', `You flew into the island at ${feet} ft. Watch the ridge line.`);
    }
    return events;
  }

  if (events & EV.TOUCHDOWN) {
    events |= judgeLanding(mission, plane, island, plane.touchdown);
    if (mission.stage === STAGE.FAILED) events |= EV.CRASH;
    return events;
  }

  if (mission.stage === STAGE.RINGS && mission.active < mission.rings.length) {
    const ring = mission.rings[mission.active];
    if (prevX < ring.x && plane.x >= ring.x) {
      if (Math.abs(plane.alt - ring.alt) <= ring.radius * 0.78) {
        const speedBonus = Math.round(SCORE.ringSpeed * clamp((plane.speed - 55) / 45, 0, 1));
        ring.state = 'passed';
        mission.breakdown.ringCount += 1;
        mission.breakdown.rings += SCORE.ring + speedBonus;
        mission.score += SCORE.ring + speedBonus;
        mission.active += 1;
        events |= EV.RING;
      } else {
        ring.state = 'missed';
        mission.active += 1;
        events |= EV.MISS;
      }
      if (mission.active >= mission.rings.length) {
        mission.stage = STAGE.LANDING;
        mission.rings.forEach((r) => { if (r.state === 'ahead') r.state = 'missed'; });
      }
    }
  }

  if (mission.stage === STAGE.LANDING && plane.x > WORLD.length + WORLD.runwayHalf + 90) {
    fail(mission, 'OVERSHOT THE STRIP', 'The numbers slipped by. Ease the nose down as the runway comes up.');
    events |= EV.CRASH;
    return events;
  }

  if (mission.time > WORLD.maxSortieSeconds) {
    fail(mission, 'OUT OF DAYLIGHT', 'The sun went down on the sortie. Try a tighter lap.');
    events |= EV.CRASH;
  }

  return events;
}
