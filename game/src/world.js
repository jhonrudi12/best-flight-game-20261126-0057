// The game's rules and state, with no drawing and no browser in it: the sortie's phases
// (rings, then land), the score, fuel and damage, and the win / crash / landed-early
// endings. step() advances one fixed step and returns what happened as bit flags, so the
// caller can react without the world knowing about screens or sound.
import { DAMAGE, FUEL, PLANE, RING_POINTS, RINGS, SCORE } from './config.js';
import { createFlight, headingDegrees, stepFlight } from './plane.js';
import { checkRingPass, nextRing, ringsDone } from './rings.js';
import { terrainHeight } from './terrain.js';

export const EVENT_RING = 1;
export const EVENT_TAKEOFF = 2;
export const EVENT_LANDED = 4;
export const EVENT_HARD_LANDING = 8;
export const EVENT_CRASH = 16;
export const EVENT_OUT_OF_FUEL = 32;
export const EVENT_STALL = 64;

export const PHASE_RINGS = 'rings';
export const PHASE_LAND = 'land';
export const PHASE_DONE = 'done';

/** Plain-English reason for an ending, for the end panel. */
export function endingReason(kind) {
  switch (kind) {
    case 'crash-terrain': return 'You flew into the terrain.';
    case 'crash-water': return 'You ditched in the sea.';
    case 'crash-runway': return 'The landing came in too hard or too fast.';
    case 'crash-damage': return 'The airframe gave out from accumulated damage.';
    case 'out-of-fuel': return 'The tanks ran dry before you got home.';
    case 'landed-early': return 'You landed with rings still unflown.';
    case 'landed': return 'Wheels down on runway 09. Course complete.';
    default: return 'Sortie over.';
  }
}

export function createWorld(ringHandle) {
  const flight = createFlight();
  const state = {
    flight,
    score: 0,
    rings: 0,
    phase: PHASE_RINGS,
    elapsed: 0,
    started: false,
    ended: false,
    ending: '',
    reason: '',
    breakdown: null,
    stallWarned: false,
    fuelWarned: false,
    message: '',
    messageTimer: 0,
  };

  function reset() {
    const fresh = createFlight();
    Object.assign(flight, fresh);
    state.score = 0;
    state.rings = 0;
    state.phase = PHASE_RINGS;
    state.elapsed = 0;
    state.started = false;
    state.ended = false;
    state.ending = '';
    state.reason = '';
    state.breakdown = null;
    state.stallWarned = false;
    state.fuelWarned = false;
    state.message = 'Take off from runway 09, then fly the rings in order.';
    state.messageTimer = 6;
    for (const ring of ringHandle.rings) {
      ring.done = false;
      ring.mesh.material.color.setHex(0xffc93c);
      ring.glow.material.color.setHex(0xffc93c);
      ring.glow.material.opacity = 0.18;
    }
  }

  /** Distance from the plane to the current objective (next ring, or the runway). */
  function objectiveDistance() {
    const target = nextRing(ringHandle.rings);
    if (target !== null) {
      const dx = target.x - flight.x;
      const dy = target.y - flight.y;
      const dz = target.z - flight.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    const dx = 0 - flight.x;
    const dz = 0 - flight.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function objectiveText() {
    if (state.phase === PHASE_RINGS) {
      const target = nextRing(ringHandle.rings);
      if (target === null) return 'All rings flown — land on runway 09';
      return `Ring ${state.rings + 1} of ${RINGS.length} — ${Math.round(objectiveDistance())} m`;
    }
    if (state.phase === PHASE_LAND) return 'Land on runway 09 — gentle, slow, wings level';
    return state.reason;
  }

  /** Score the landing: softness, centreline, speed and the fuel still in the tanks. */
  function scoreLanding() {
    const sink = Math.max(0, -flight.verticalSpeed);
    const soft = Math.round(SCORE.landingSoft * Math.max(0, 1 - sink / PLANE.maxSinkRate));
    const centre = Math.round(SCORE.landingCentre * Math.max(0, 1 - Math.abs(flight.z) / 18));
    const speedScore = Math.round(
      SCORE.landingSpeed * Math.max(0, 1 - Math.max(0, flight.speed - 30) / (PLANE.maxLandingSpeed - 30)),
    );
    const fuelBonus = Math.round(flight.fuel * SCORE.fuelPerUnit);
    const timeBonus = Math.round(Math.max(0, SCORE.parSeconds - state.elapsed) * SCORE.timePerSecond);
    return { soft, centre, speed: speedScore, fuel: fuelBonus, time: timeBonus };
  }

  function finishLanding() {
    const parts = scoreLanding();
    const total = parts.soft + parts.centre + parts.speed + parts.fuel + parts.time;
    state.score += total;
    state.breakdown = { ...parts, rings: state.rings * RING_POINTS, total: state.score };
    state.phase = PHASE_DONE;
    state.ended = true;
    if (state.rings === RINGS.length) {
      state.ending = 'landed';
      state.reason = endingReason('landed');
    } else {
      state.ending = 'landed-early';
      state.reason = endingReason('landed-early');
    }
    return EVENT_LANDED;
  }

  function finishCrash(kind) {
    state.phase = PHASE_DONE;
    state.ended = true;
    state.ending = 'crash';
    state.reason = endingReason(kind);
    return EVENT_CRASH;
  }

  /**
   * One fixed step. `control` is the pilot's steering for this step. With `attract` set
   * (the title screen's backdrop) the plane sits on the runway and nothing scores.
   */
  function step(dt, control, attract) {
    if (state.ended) return 0;
    let events = 0;
    if (attract) return events;
    if (!state.started) state.started = true;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;

    const flightEvent = stepFlight(flight, control, dt);
    if (flightEvent === 'takeoff') {
      events |= EVENT_TAKEOFF;
      state.message = 'Airborne — climb to the first ring.';
      state.messageTimer = 4;
    } else if (flightEvent === 'stall' && !state.stallWarned) {
      state.stallWarned = true;
      events |= EVENT_STALL;
      state.message = 'Stall! Nose down, throttle up.';
      state.messageTimer = 3;
    } else if (flightEvent === 'hard-landing') {
      events |= EVENT_HARD_LANDING;
      state.message = 'Hard touchdown — the airframe took damage.';
      state.messageTimer = 4;
      return finishLanding() | events;
    } else if (flightEvent === 'landed') {
      events |= EVENT_LANDED;
      return finishLanding() | events;
    } else if (flightEvent === 'crash') {
      const ground = terrainHeight(flight.x, flight.z);
      if (flight.y <= 1.5 && ground <= 1.5) return finishCrash('crash-water') | events;
      return finishCrash(flight.damage >= DAMAGE.fatal ? 'crash-damage' : 'crash-runway') | events;
    } else if (flightEvent === 'out-of-fuel') {
      state.phase = PHASE_DONE;
      state.ended = true;
      state.ending = 'out-of-fuel';
      state.reason = endingReason('out-of-fuel');
      return EVENT_OUT_OF_FUEL | events;
    }

    // Fuel warning, once per sortie.
    if (flight.fuel <= FUEL.lowWarning && !state.fuelWarned) {
      state.fuelWarned = true;
      state.message = 'Fuel low — head for the runway.';
      state.messageTimer = 4;
    }

    // Rings are only collected once airborne; the runway start sits under ring 6's path.
    if (flight.airborne) {
      const ring = checkRingPass(ringHandle.rings, flight.x, flight.y, flight.z);
      if (ring !== null) {
        state.rings = ringsDone(ringHandle.rings);
        state.score += RING_POINTS;
        events |= EVENT_RING;
        if (state.rings === RINGS.length) {
          state.phase = PHASE_LAND;
          state.message = 'All rings flown! Land on runway 09.';
          state.messageTimer = 5;
        } else {
          state.message = `Ring ${state.rings} of ${RINGS.length} — nice flying.`;
          state.messageTimer = 3;
        }
      }
    }

    // Out of fuel while airborne: the glide ends when the ground arrives.
    if (flight.fuel <= 0 && flight.airborne && flight.y < terrainHeight(flight.x, flight.z) + 30) {
      state.message = 'Out of fuel — gliding. Find the runway.';
      state.messageTimer = 3;
    }
    return events;
  }

  reset();
  return {
    state,
    reset,
    step,
    objectiveText,
    objectiveDistance,
    headingDegrees: () => headingDegrees(flight.heading),
  };
}
