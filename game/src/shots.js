// The screenshot scenes behind ?shot=flight|title|landing|win. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (bank toward the next ring, pitch toward its height, throttle for cruise speed), so the
// frame is what a real sortie looks like and the same seed always gives the same frame.
// The win scene flies the whole course through the real ring and landing code.
import { RINGS, RUNWAY, RUNWAY_Y, STEP } from './config.js';
import { angleDifference } from './plane.js';
import { nextRing } from './rings.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';

const FLIGHT_SECONDS = 54;
const LANDING_SECONDS = 14;
const WIN_SECONDS = 70;

/** Steer toward a point: bank into the heading error, pitch for the height, hold speed. */
export function autopilot(flight, target) {
  const dx = target.x - flight.x;
  const dz = target.z - flight.z;
  const wantedHeading = Math.atan2(-dz, dx);
  const headingError = angleDifference(flight.heading, wantedHeading);
  const roll = Math.max(-1, Math.min(1, -headingError * 1.6));
  const dy = target.y - flight.y;
  const pitch = Math.max(-0.5, Math.min(0.5, dy * 0.015));
  const cruise = target.speed ?? 55;
  let throttle = 0;
  if (flight.speed < cruise - 3) throttle = 1;
  else if (flight.speed > cruise + 3) throttle = -1;
  return { pitch, roll, throttle };
}

/**
 * The autopilot's target: the next ring, or — once the course is flown — a glide slope
 * down the runway centreline, aiming past the threshold so the plane flies straight in
 * and settles onto the strip instead of orbiting the touchdown point.
 */
function autopilotTarget(world, ringHandle) {
  const ring = nextRing(ringHandle.rings);
  if (ring !== null) return { x: ring.x, y: ring.y, z: ring.z, speed: 55 };
  const flight = world.state.flight;
  // Pure pursuit on the centreline: aim at a point 400 m ahead of the plane, on the
  // centreline, descending on a 1-in-20 slope to touchdown just past the threshold.
  // Aiming ahead like this pulls the cross-track error to zero well before touchdown.
  const toThreshold = -RUNWAY.halfLength + 20 - flight.x;
  const targetY = RUNWAY_Y + 1 + Math.max(0, toThreshold) * 0.05;
  return { x: flight.x + 400, y: targetY, z: 0, speed: 44 };
}

function flyFor(world, ringHandle, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    if (world.state.ended) break;
    const control = autopilot(world.state.flight, autopilotTarget(world, ringHandle));
    // Full throttle until airborne, then the autopilot's cruise throttle.
    if (!world.state.flight.airborne) control.throttle = 1;
    if (!world.state.flight.airborne && world.state.flight.speed > 30) control.pitch = 0.7;
    world.step(STEP, control, false);
  }
}

/**
 * Fly every ring through the real collect code (the plane is placed at each ring's
 * centre, airborne, for one step), so the staged landing and win scenes carry a real
 * 6-of-6 score and the real "land on runway 09" phase.
 */
function collectAllRings(world, ringHandle) {
  const flight = world.state.flight;
  for (const ring of RINGS) {
    flight.x = ring.x;
    flight.y = ring.y;
    flight.z = ring.z;
    flight.airborne = true;
    flight.speed = 55;
    world.step(STEP, { pitch: 0, roll: 0, throttle: 0 }, false);
    if (world.state.ended) break;
  }
  void ringHandle;
}

/** Put the plane on final approach: 1500 m out, 90 m up, lined up on runway 09. */
function setFinalApproach(world) {
  const flight = world.state.flight;
  flight.x = -1500;
  flight.y = 90;
  flight.z = 60;
  flight.heading = 0;
  flight.pitch = -0.08;
  flight.bank = 0;
  flight.speed = 48;
  flight.throttle = 0.4;
  flight.airborne = true;
  flight.onGround = false;
}

/**
 * Set `world` to the named scene (flight, landing or win; any other name is title) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world, ringHandle) {
  world.reset();
  if (name === 'flight') {
    // Take off, climb out and chase the rings: mid-course, a ring ahead, HUD lit.
    world.state.flight.throttle = 1;
    flyFor(world, ringHandle, FLIGHT_SECONDS);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'landing') {
    // All six rings flown, now on final: low over the threshold, runway ahead.
    collectAllRings(world, ringHandle);
    if (!world.state.ended) {
      setFinalApproach(world);
      flyFor(world, ringHandle, LANDING_SECONDS);
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    // All six rings flown, then the autopilot lands: the real scoring code runs.
    collectAllRings(world, ringHandle);
    if (!world.state.ended) {
      setFinalApproach(world);
      flyFor(world, ringHandle, WIN_SECONDS);
    }
    const over = world.state.ended;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  // Title: the plane parked on the runway, the island behind it.
  return { screen: SCREEN_TITLE, best: 0 };
}
