// The archipelago: one analytic height function drives both the terrain mesh and the
// flight model's ground collisions, so what you see is what you can hit. The home island
// is a flat plateau at runway height; the others are smooth hills with sand rims, grass
// slopes, rock shoulders and pale tops. Sea, runway, clouds and sun are meshes too.
import * as THREE from 'three';
import { ISLANDS, PALETTE, RUNWAY, RUNWAY_Y, SEA_LEVEL, WORLD_HALF, WORLD_SEED, WORLD_SIZE } from './config.js';
import { createRandom } from './random.js';

/** Smooth falloff: 1 at the centre, 0 at and past the rim. */
function islandFalloff(distance, radius) {
  const t = Math.min(1, distance / radius);
  const s = t * t * (3 - 2 * t);
  return 1 - s;
}

/** Ground height in metres at (x, z): 0 over open sea. */
export function terrainHeight(x, z) {
  let height = 0;
  for (const island of ISLANDS) {
    const dx = x - island.x;
    const dz = z - island.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance >= island.radius) continue;
    const falloff = islandFalloff(distance, island.radius);
    if (island.plateau) {
      // Flat top with a smooth beach skirt, so the runway sits on level ground.
      const skirt = Math.min(1, Math.max(0, (distance - island.radius * 0.55) / (island.radius * 0.45)));
      height = Math.max(height, island.peak * (1 - skirt * skirt * (3 - 2 * skirt)));
    } else {
      height = Math.max(height, island.peak * falloff * falloff);
    }
  }
  return height;
}

/** True while (x, z) is on the runway strip. */
export function onRunway(x, z) {
  return Math.abs(x) <= RUNWAY.halfLength && Math.abs(z) <= RUNWAY.halfWidth;
}

const SEGMENTS = 160;

function colourFor(height, random) {
  const colour = new THREE.Color();
  if (height <= 1.2) colour.setHex(PALETTE.sand);
  else if (height <= 3.5) colour.setHex(PALETTE.sand).lerp(new THREE.Color(PALETTE.grass), (height - 1.2) / 2.3);
  else if (height <= 55) colour.setHex(PALETTE.grass).lerp(new THREE.Color(PALETTE.grassDry), (height - 3.5) / 51.5);
  else if (height <= 110) colour.setHex(PALETTE.grassDry).lerp(new THREE.Color(PALETTE.rock), (height - 55) / 55);
  else colour.setHex(PALETTE.rock).lerp(new THREE.Color(PALETTE.snow), Math.min(1, (height - 110) / 40));
  // A little patchiness so the slopes read as terrain, not plastic.
  const shade = 0.92 + random() * 0.16;
  colour.multiplyScalar(shade);
  return colour;
}

export function createTerrain(random) {
  const group = new THREE.Group();

  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colours = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const height = terrainHeight(x, z);
    positions.setY(index, Math.max(height, -2));
    const colour = colourFor(height, random);
    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  const land = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  group.add(land);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE * 1.6, WORLD_SIZE * 1.6),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = SEA_LEVEL + 0.4;
  group.add(sea);

  // Runway: dark asphalt, white centreline dashes, threshold bars and edge lights.
  const runway = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.length, 0.6, RUNWAY.width),
    new THREE.MeshLambertMaterial({ color: PALETTE.runway }),
  );
  strip.position.y = RUNWAY_Y - 0.3;
  runway.add(strip);
  const markMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.runwayMark });
  for (let x = -RUNWAY.halfLength + 60; x < RUNWAY.halfLength - 40; x += 60) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(30, 0.15, 2.4), markMaterial);
    dash.position.set(x, RUNWAY_Y + 0.05, 0);
    runway.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let offset = -12; offset <= 12; offset += 6) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 4.5), markMaterial);
      bar.position.set(end * (RUNWAY.halfLength - 24), RUNWAY_Y + 0.05, offset);
      runway.add(bar);
    }
  }
  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0x7de3ff });
  for (let x = -RUNWAY.halfLength; x <= RUNWAY.halfLength; x += 90) {
    for (const side of [-1, 1]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), lightMaterial);
      light.position.set(x, RUNWAY_Y + 0.6, side * (RUNWAY.halfWidth + 3));
      runway.add(light);
    }
  }
  group.add(runway);

  // A windsock and a little hangar beside the threshold, so the airfield reads as a place.
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xdadada }),
  );
  sockPole.position.set(-RUNWAY.halfLength + 30, RUNWAY_Y + 4.5, -RUNWAY.halfWidth - 14);
  group.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 5, 8),
    new THREE.MeshLambertMaterial({ color: 0xff7a3c }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(-RUNWAY.halfLength + 33, RUNWAY_Y + 8.2, -RUNWAY.halfWidth - 14);
  group.add(sock);
  const hangar = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 22, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0xcfd8dc }),
  );
  hangar.rotation.z = Math.PI / 2;
  hangar.rotation.y = Math.PI / 2;
  hangar.position.set(-200, RUNWAY_Y, -120);
  group.add(hangar);

  // Puffy clouds: flattened white spheres drifting slowly above the islands. Basic
  // material keeps them bright white from every angle, like sunlit cloud tops.
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let index = 0; index < 16; index += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(random() * 3);
    for (let puff = 0; puff < puffs; puff += 1) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(14 + random() * 16, 10, 8), cloudMaterial);
      sphere.position.set((random() - 0.5) * 46, (random() - 0.5) * 7, (random() - 0.5) * 22);
      sphere.scale.y = 0.7;
      cloud.add(sphere);
    }
    cloud.position.set(
      (random() - 0.5) * WORLD_SIZE * 0.9,
      260 + random() * 140,
      (random() - 0.5) * WORLD_SIZE * 0.9,
    );
    cloud.userData.drift = 1.5 + random() * 2;
    clouds.push(cloud);
    group.add(cloud);
  }

  // Sun disc and a soft haze ring on the horizon.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }),
  );
  sun.position.set(-3200, 900, -4200);
  sun.lookAt(0, 0, 0);
  group.add(sun);

  return { group, clouds };
}

/** Clouds drift east and wrap around the world edge. */
export function stepClouds(clouds, dt) {
  for (const cloud of clouds) {
    cloud.position.x += cloud.userData.drift * dt;
    if (cloud.position.x > WORLD_HALF + 200) cloud.position.x = -WORLD_HALF - 200;
  }
}

export function createTerrainRandom() {
  return createRandom(WORLD_SEED);
}
