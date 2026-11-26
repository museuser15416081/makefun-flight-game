// The aircraft's flight model: an arcade side-view plane with a real stall, throttle spool and
// fuel burn. It knows about the ground and the tarmac, but not about rings, scoring or pixels.
// It reports what happened as EV flags so the sortie layer can turn that into a mission result.

import { EV, PLANE, WORLD } from './config.js';

function approach(value, target, maxStep) {
  if (value < target) return Math.min(target, value + maxStep);
  return Math.max(target, value - maxStep);
}

export function createAircraft() {
  return {
    x: 0,
    alt: WORLD.runwayAlt,
    speed: 0,
    vs: 0,
    pitch: 0,
    bank: 0,
    throttle: 0,
    throttleTarget: 0,
    fuel: WORLD.startFuel,
    engineOn: true,
    onGround: true,
    crashed: false,
    stalled: false,
    prop: 0,
    touchdown: null,
    crashKind: '',
  };
}

export function resetAircraft(plane) {
  plane.x = 0;
  plane.alt = WORLD.runwayAlt;
  plane.speed = 0;
  plane.vs = 0;
  plane.pitch = 0;
  plane.bank = 0;
  plane.throttle = 0;
  plane.throttleTarget = 0;
  plane.fuel = WORLD.startFuel;
  plane.engineOn = true;
  plane.onGround = true;
  plane.crashed = false;
  plane.stalled = false;
  plane.prop = 0;
  plane.touchdown = null;
  plane.crashKind = '';
}

/**
 * Advance the plane by dt seconds. `controls.stick` is +1 for full climb, -1 for full dive;
 * the throttle keys trim the target throttle. Returns EV flags.
 */
export function stepAircraft(plane, controls, dt, island) {
  if (plane.crashed) return 0;

  // Throttle lever: the keys drive a target, the engine spools toward it.
  if (plane.engineOn) {
    if (controls.throttleUp) plane.throttleTarget = Math.min(1, plane.throttleTarget + dt * 0.62);
    if (controls.throttleDown) plane.throttleTarget = Math.max(0, plane.throttleTarget - dt * 0.62);
  } else {
    plane.throttleTarget = 0;
  }
  plane.throttle = approach(plane.throttle, plane.throttleTarget, dt * 1.5);

  // Pitch: keys and mouse ask for an attitude, the nose follows at a finite rate. Low speed
  // and wheels on the ground both take authority away, which is what makes the takeoff a decision.
  let authority = 1;
  if (plane.onGround) authority = 0.5;
  else if (plane.speed < PLANE.stallSpeed) authority = 0.55;
  const wantedPitch = controls.stick * PLANE.maxPitch * authority;
  plane.pitch = approach(plane.pitch, wantedPitch, dt * PLANE.pitchSlew);
  plane.bank = approach(plane.bank, controls.stick * 0.55, dt * 2.4);

  // Speed: thrust against quadratic drag, plus the component of weight along the climb.
  const thrust = plane.engineOn && plane.fuel > 0
    ? PLANE.idleThrust + plane.throttle * (PLANE.maxThrust - PLANE.idleThrust)
    : 0;
  const drag = PLANE.drag * plane.speed * plane.speed;
  const gravity = plane.onGround ? 0 : PLANE.gravity * Math.sin(plane.pitch) * 0.6;
  // On the ground the idle engine cannot overcome the brakes, so a parked plane stays parked.
  const rolling = plane.onGround
    ? (plane.throttle < 0.05 ? PLANE.brakeDrag : PLANE.groundFriction)
    : 0;
  plane.speed += (thrust - drag - gravity - rolling) * dt;
  plane.speed = Math.max(0, Math.min(PLANE.maxSpeed, plane.speed));

  let events = 0;

  // Fuel: the open throttle drinks from the tanks; the prop keeps ticking over at idle.
  if (plane.engineOn) {
    const before = plane.fuel;
    plane.fuel = Math.max(0, plane.fuel - (PLANE.fuelBurnIdle + plane.throttle * PLANE.fuelBurnOpen) * dt);
    if (before > 0 && plane.fuel === 0) {
      plane.engineOn = false;
      events |= EV.FUEL_OUT;
    }
  }

  plane.prop += (plane.engineOn ? 14 + plane.throttle * 42 : 2) * dt;

  if (plane.onGround) {
    plane.alt = island.heightAt(plane.x);
    plane.vs = 0;
    plane.x += plane.speed * dt;
    if (!island.onRunway(plane.x, 18) && plane.speed > 9) {
      plane.crashed = true;
      plane.crashKind = 'runway';
      events |= EV.CRASH;
      return events;
    }
    if (plane.speed > PLANE.rotateSpeed && plane.pitch > 0.09) {
      plane.onGround = false;
      plane.alt += 1.4;
      plane.vs = Math.sin(plane.pitch) * plane.speed * PLANE.climbFactor;
      events |= EV.TAKEOFF;
    }
    return events;
  }

  plane.x += Math.cos(plane.pitch) * plane.speed * dt;
  let climb = Math.sin(plane.pitch) * plane.speed * PLANE.climbFactor;
  if (plane.speed < PLANE.stallSpeed) {
    climb -= (PLANE.stallSpeed - plane.speed) * 1.2;
    if (!plane.stalled) {
      plane.stalled = true;
      events |= EV.STALL;
    }
  } else {
    plane.stalled = false;
  }
  plane.vs = climb;
  plane.alt += climb * dt;

  const ground = island.heightAt(plane.x);
  if (plane.alt <= ground + 0.9) {
    plane.alt = ground;
    plane.vs = 0;
    if (island.onRunway(plane.x, 34)) {
      plane.touchdown = {
        sink: Math.max(0, -climb),
        speed: plane.speed,
        offset: island.runwayDistance(plane.x),
      };
      events |= EV.TOUCHDOWN;
    } else {
      plane.crashed = true;
      plane.crashKind = 'terrain';
      events |= EV.CRASH;
    }
  }

  return events;
}
