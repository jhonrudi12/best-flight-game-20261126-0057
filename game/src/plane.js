// The aircraft: a low-poly single-prop island hopper built from primitives (no borrowed
// model), and the arcade flight model that flies it — throttle, bank, pitch, stall, sink,
// takeoff roll and the landing checks. Forward is +X at heading 0; heading grows toward -Z.
import * as THREE from 'three';
import { DAMAGE, FUEL, PALETTE, PLANE, RUNWAY, RUNWAY_Y, SEA_LEVEL } from './config.js';
import { onRunway, terrainHeight } from './terrain.js';

const GRAVITY = 9.81;

/** Build the plane mesh: fuselage, wings, tail, prop, cockpit glass and nav lights. */
export function buildPlaneMesh() {
  const group = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: PALETTE.planeBody });
  const wing = new THREE.MeshLambertMaterial({ color: PALETTE.planeWing });
  const trim = new THREE.MeshLambertMaterial({ color: PALETTE.planeTrim });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8ef });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 6.4, 12), body);
  fuselage.rotation.z = Math.PI / 2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 12), body);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 4;
  group.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 8), glass);
  canopy.scale.set(1.7, 0.85, 0.95);
  canopy.position.set(1.1, 0.62, 0);
  group.add(canopy);
  const mainWing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 11.4), wing);
  mainWing.position.set(0.4, -0.1, 0);
  group.add(mainWing);
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 3.6), wing);
  tailWing.position.set(-3.1, 0.25, 0);
  group.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.14), trim);
  fin.position.set(-3.1, 0.95, 0);
  group.add(fin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(6.42, 0.18, 0.2), trim);
  stripe.position.set(0, 0.55, 0);
  group.add(stripe);

  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), trim);
  hub.rotation.z = Math.PI / 2;
  prop.add(hub);
  // The blades are translucent: a spinning prop reads as a blur, not as slabs
  // across the cockpit view.
  const bladeMaterial = new THREE.MeshLambertMaterial({ color: PALETTE.planeTrim, transparent: true, opacity: 0.5 });
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 0.42), bladeMaterial);
    blade.rotation.x = angle;
    prop.add(blade);
  }
  prop.position.x = 4.9;
  group.add(prop);

  const leftLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
  );
  leftLight.position.set(0.4, -0.1, -5.7);
  group.add(leftLight);
  const rightLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0x35e065 }),
  );
  rightLight.position.set(0.4, -0.1, 5.7);
  group.add(rightLight);

  group.userData.prop = prop;
  return group;
}

/** The flight state: position, attitude, speed, throttle, fuel and damage. */
export function createFlight() {
  return {
    x: -RUNWAY.halfLength + 120,
    y: RUNWAY_Y + 1.4,
    z: 0,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: 0,
    fuel: FUEL.start,
    damage: 0,
    onGround: true,
    airborne: false,
    verticalSpeed: 0,
  };
}

/** Degrees, 0..360, clockwise from east (+X). */
export function headingDegrees(heading) {
  return ((-(heading * 180) / Math.PI) % 360 + 360) % 360;
}

/** Signed smallest turn from `from` to `to`, in radians. */
export function angleDifference(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * One fixed step of the flight model. `control` is { pitch: -1..1 (up positive),
 * roll: -1..1 (right positive), throttle: -1..1 change }. Returns an event string:
 * 'takeoff', 'stall' (once, when the wing first quits), 'crash' or ''.
 */
export function stepFlight(flight, control, dt) {
  let event = '';
  const wasAirborne = flight.airborne;

  flight.throttle = Math.min(1, Math.max(0, flight.throttle + control.throttle * dt * 0.55));
  if (flight.fuel <= 0) flight.throttle = 0;
  const burning = FUEL.burnIdle + (FUEL.burnFull - FUEL.burnIdle) * flight.throttle;
  flight.fuel = Math.max(0, flight.fuel - burning * dt);

  // Throttle sets a target speed; the engine closes on it, faster when light on fuel.
  const targetSpeed = flight.throttle * PLANE.maxSpeed;
  flight.speed += (targetSpeed - flight.speed) * (1 - Math.exp(-PLANE.accel * dt));

  // Stick authority fades as the wing slows toward the stall.
  const authority = Math.min(1, Math.max(0.25, flight.speed / PLANE.stallSpeed));
  const targetBank = control.roll * PLANE.maxBank;
  const bankRate = PLANE.rollRate * authority;
  flight.bank += Math.min(bankRate * dt, Math.max(-bankRate * dt, targetBank - flight.bank));
  if (control.roll === 0) {
    const level = Math.min(PLANE.levelRate * dt, Math.abs(flight.bank));
    flight.bank -= Math.sign(flight.bank) * level;
  }
  const targetPitch = control.pitch * PLANE.maxPitch;
  const pitchRate = PLANE.pitchRate * authority;
  flight.pitch += Math.min(pitchRate * dt, Math.max(-pitchRate * dt, targetPitch - flight.pitch));
  if (control.pitch === 0 && flight.airborne) {
    const level = Math.min(0.08 * dt, Math.abs(flight.pitch));
    flight.pitch -= Math.sign(flight.pitch) * level;
  }

  // A banked wing turns: heading rate grows with bank and shrinks with speed.
  const turnRate = (GRAVITY * Math.tan(flight.bank)) / Math.max(flight.speed, 12);
  flight.heading -= turnRate * dt;

  // Climb from pitch, sink when slow, and a little extra sink with no power.
  const stallSink = Math.max(0, PLANE.stallSpeed - flight.speed) * 0.4;
  const glideSink = flight.throttle === 0 && flight.airborne ? 1.6 : 0;
  flight.verticalSpeed = flight.speed * Math.sin(flight.pitch) - stallSink - glideSink;
  if (!flight.airborne && flight.speed < PLANE.rotateSpeed) flight.verticalSpeed = 0;

  const forwardX = Math.cos(flight.heading);
  const forwardZ = -Math.sin(flight.heading);
  flight.x += forwardX * flight.speed * dt;
  flight.z += forwardZ * flight.speed * dt;
  flight.y += flight.verticalSpeed * dt;

  if (!flight.airborne && flight.speed >= PLANE.rotateSpeed && flight.pitch > 0.06) {
    flight.airborne = true;
    flight.onGround = false;
    event = 'takeoff';
  }

  // World edge: turn the pilot back with a gentle wall rather than a void.
  const edge = 2500;
  if (Math.abs(flight.x) > edge || Math.abs(flight.z) > edge) {
    // Head back toward the centre: forward (cos h, -sin h) must point at (-x, -z).
    flight.heading = Math.atan2(flight.z, -flight.x);
    flight.x = Math.min(edge, Math.max(-edge, flight.x));
    flight.z = Math.min(edge, Math.max(-edge, flight.z));
  }

  // Ground and water.
  const ground = terrainHeight(flight.x, flight.z);
  const runwayHere = onRunway(flight.x, flight.z);
  const floor = runwayHere ? RUNWAY_Y : ground;
  if (flight.y <= floor + 1.4) {
    flight.y = floor + 1.4;
    if (flight.airborne) {
      const sink = -flight.verticalSpeed;
      const headingError = Math.abs(angleDifference(flight.heading, 0));
      const aligned = headingError < (PLANE.maxHeadingErrorDeg * Math.PI) / 180;
      const gentle = sink <= PLANE.maxSinkRate;
      const slow = flight.speed <= PLANE.maxLandingSpeed;
      const level = Math.abs(flight.bank) <= PLANE.maxLandingBank;
      if (runwayHere && gentle && slow && level && aligned) {
        flight.onGround = true;
        flight.airborne = false;
        flight.pitch = 0;
        flight.bank = 0;
        flight.verticalSpeed = 0;
        return 'landed';
      }
      if (runwayHere && sink <= PLANE.hardSinkRate && slow && level && aligned) {
        flight.damage += DAMAGE.hardLanding;
        flight.onGround = true;
        flight.airborne = false;
        flight.pitch = 0;
        flight.bank = 0;
        flight.verticalSpeed = 0;
        return flight.damage >= DAMAGE.fatal ? 'crash' : 'hard-landing';
      }
      return 'crash';
    }
    flight.onGround = true;
    flight.verticalSpeed = 0;
    if (flight.speed > 0) {
      // Rolling on the ground: drag and a little steering from the bank.
      flight.speed = Math.max(0, flight.speed - 14 * dt);
      flight.heading -= flight.bank * 0.4 * dt;
    }
  } else if (flight.y < floor + 6 && flight.airborne && flight.speed < PLANE.stallSpeed * 0.6) {
    event = 'stall';
  }

  // Rolled off the runway end without rotating: the ground fell away, so we are flying.
  if (!flight.airborne && flight.y > floor + 3) {
    flight.airborne = true;
    flight.onGround = false;
    event = 'takeoff';
  }

  if (flight.fuel <= 0 && !flight.airborne && flight.speed < 4) return 'out-of-fuel';
  if (flight.y <= SEA_LEVEL + 0.5 && ground <= SEA_LEVEL + 0.5 && flight.airborne) return 'crash';
  if (wasAirborne !== flight.airborne && flight.airborne) event = 'takeoff';
  return event;
}

/** Write the flight state onto the mesh: position plus yaw/pitch/roll. */
export function posePlane(mesh, flight, dt) {
  mesh.position.set(flight.x, flight.y, flight.z);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = flight.heading;
  mesh.rotation.x = -flight.pitch;
  mesh.rotation.z = flight.bank;
  const prop = mesh.userData.prop;
  if (prop) prop.rotation.x += (2 + flight.throttle * 38) * dt;
}
