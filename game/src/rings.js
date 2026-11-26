// The ring course: six glowing torus rings flown in order, a floating guide arrow that
// always points at the next one, and the pass detection (close to the ring's centre).
import * as THREE from 'three';
import { PALETTE, RINGS } from './config.js';

/** Build the ring meshes and the guide arrow; returns handles the world drives. */
export function createRings() {
  const group = new THREE.Group();
  // Each ring faces the point the pilot comes from, so it reads as a circle to fly
  // through, never as an edge-on line: ring 1 faces the runway, the rest face the
  // ring before them.
  const course = [{ x: -330, y: 8, z: 0 }, ...RINGS];
  const meshes = RINGS.map((ring, index) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(ring.radius, 1.1, 12, 40),
      new THREE.MeshBasicMaterial({ color: PALETTE.ring }),
    );
    mesh.position.set(ring.x, ring.y, ring.z);
    const previous = course[index];
    mesh.lookAt(previous.x, previous.y, previous.z);
    group.add(mesh);
    const glow = new THREE.Mesh(
      new THREE.TorusGeometry(ring.radius, 2.6, 8, 40),
      new THREE.MeshBasicMaterial({ color: PALETTE.ring, transparent: true, opacity: 0.18 }),
    );
    glow.position.copy(mesh.position);
    glow.quaternion.copy(mesh.quaternion);
    group.add(glow);
    return { mesh, glow, ...ring, done: false };
  });

  // Guide arrow: a cone that hovers ahead of the plane and points at the next ring.
  const arrow = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 6, 8),
    new THREE.MeshBasicMaterial({ color: PALETTE.ring }),
  );
  shaft.rotation.x = Math.PI / 2;
  arrow.add(shaft);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 4.5, 10),
    new THREE.MeshBasicMaterial({ color: PALETTE.ring }),
  );
  head.rotation.x = Math.PI / 2;
  head.position.z = -5;
  arrow.add(head);
  group.add(arrow);

  return { group, rings: meshes, arrow };
}

/** The next ring not yet flown through, or null when the course is complete. */
export function nextRing(rings) {
  for (const ring of rings) if (!ring.done) return ring;
  return null;
}

/** How many rings the pilot has flown through. */
export function ringsDone(rings) {
  let count = 0;
  for (const ring of rings) if (ring.done) count += 1;
  return count;
}

/**
 * Check the plane against the next ring: flying within its radius collects it.
 * Returns the ring collected, or null.
 */
export function checkRingPass(rings, x, y, z) {
  const ring = nextRing(rings);
  if (ring === null) return null;
  const dx = x - ring.x;
  const dy = y - ring.y;
  const dz = z - ring.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (distance > ring.radius) return null;
  ring.done = true;
  ring.mesh.material.color.setHex(PALETTE.ringDone);
  ring.glow.material.color.setHex(PALETTE.ringDone);
  ring.glow.material.opacity = 0.08;
  return ring;
}

/** Reset every ring to unflown (a fresh sortie). */
export function resetRings(rings) {
  for (const ring of rings) {
    ring.done = false;
    ring.mesh.material.color.setHex(PALETTE.ring);
    ring.glow.material.color.setHex(PALETTE.ring);
    ring.glow.material.opacity = 0.18;
  }
}

/** Animate the rings (a slow pulse) and aim the guide arrow at the next ring. */
export function updateRings(handle, flight, time) {
  for (const ring of handle.rings) {
    if (ring.done) continue;
    const pulse = 1 + Math.sin(time * 2.4 + ring.x * 0.01) * 0.05;
    ring.mesh.scale.setScalar(pulse);
    ring.glow.scale.setScalar(pulse);
  }
  const target = nextRing(handle.rings);
  const arrow = handle.arrow;
  if (target === null) {
    arrow.visible = false;
    return;
  }
  arrow.visible = true;
  const dx = target.x - flight.x;
  const dy = target.y - flight.y;
  const dz = target.z - flight.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  // Hover 40 m ahead of the nose, offset to the pilot's right and above the nose line:
  // seen at an angle it reads as an arrow, never as a head-on blob.
  const forwardX = Math.cos(flight.heading);
  const forwardZ = -Math.sin(flight.heading);
  const rightX = Math.sin(flight.heading);
  const rightZ = Math.cos(flight.heading);
  arrow.position.set(
    flight.x + forwardX * 40 + rightX * 11,
    flight.y + 4,
    flight.z + forwardZ * 40 + rightZ * 11,
  );
  arrow.lookAt(target.x, target.y, target.z);
  const scale = Math.min(0.7, Math.max(0.45, distance / 700));
  arrow.scale.setScalar(scale);
}
