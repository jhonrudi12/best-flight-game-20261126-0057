// The 3D view: a three.js scene over the archipelago, a chase camera that trails the plane
// without ever fighting the pilot, and a cockpit camera at the pilot's seat. Sun, sky,
// haze and the plane's own shadow keep the depth readable at a glance.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { buildPlaneMesh, posePlane } from './plane.js';
import { createRings, updateRings } from './rings.js';
import { createTerrain, stepClouds } from './terrain.js';

export const CAMERA_CHASE = 'chase';
export const CAMERA_COCKPIT = 'cockpit';

/** A smoothed value that chases a target without snapping: the camera never judders. */
function createSmoother(initial, rate) {
  let value = initial;
  return {
    get() {
      return value;
    },
    update(target, dt) {
      value += (target - value) * (1 - Math.exp(-rate * dt));
      return value;
    },
    snap(target) {
      value = target;
    },
  };
}

export function createRenderer(canvas, random) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyHorizon);
  scene.fog = new THREE.Fog(PALETTE.skyHorizon, 700, 5200);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 12000);

  const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
  sun.position.set(-1800, 1600, -1200);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -2600;
  sun.shadow.camera.right = 2600;
  sun.shadow.camera.top = 2600;
  sun.shadow.camera.bottom = -2600;
  sun.shadow.camera.far = 7000;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9e8, 0x3d6b52, 1.1));

  const terrain = createTerrain(random);
  scene.add(terrain.group);

  const plane = buildPlaneMesh();
  plane.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
    }
  });
  scene.add(plane);

  const rings = createRings();
  scene.add(rings.group);

  // The chase camera's smoothed position and look target.
  const camX = createSmoother(0, 4.5);
  const camY = createSmoother(0, 4.5);
  const camZ = createSmoother(0, 4.5);
  const lookX = createSmoother(0, 7);
  const lookY = createSmoother(0, 7);
  const lookZ = createSmoother(0, 7);
  let cameraMode = CAMERA_CHASE;
  let snapped = false;

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /** Snap the chase camera behind the plane (used when a scene is staged). */
  function snapCamera(flight) {
    const backX = Math.cos(flight.heading);
    const backZ = -Math.sin(flight.heading);
    camX.snap(flight.x - backX * 16);
    camY.snap(flight.y + 5);
    camZ.snap(flight.z - backZ * 16);
    lookX.snap(flight.x + backX * 30);
    lookY.snap(flight.y);
    lookZ.snap(flight.z + backZ * 30);
    snapped = true;
  }

  function draw(flight, time, dt, attract) {
    posePlane(plane, flight, dt);
    updateRings(rings, flight, time);
    stepClouds(terrain.clouds, dt);

    const forwardX = Math.cos(flight.heading);
    const forwardZ = -Math.sin(flight.heading);
    if (cameraMode === CAMERA_COCKPIT) {
      // At the pilot's seat, ahead of the canopy and above the nose line, looking
      // along the nose: the canopy never blocks the view, the nose sits at the
      // bottom of the frame like a real cockpit view.
      const eyeX = flight.x + forwardX * 2.6;
      const eyeY = flight.y + 1.35;
      const eyeZ = flight.z + forwardZ * 2.6;
      camera.position.set(eyeX, eyeY, eyeZ);
      const pitchLook = Math.tan(flight.pitch);
      camera.lookAt(
        eyeX + forwardX * 60,
        eyeY + pitchLook * 60,
        eyeZ + forwardZ * 60,
      );
      camera.rotation.z += flight.bank * 0.55;
    } else {
      if (!snapped) snapCamera(flight);
      // Trail 17 m behind and 5 m above, and look 30 m ahead of the nose.
      const targetX = flight.x - forwardX * 17;
      const targetY = Math.max(flight.y + 5, 4);
      const targetZ = flight.z - forwardZ * 17;
      camX.update(targetX, dt);
      camY.update(targetY, dt);
      camZ.update(targetZ, dt);
      camera.position.set(camX.get(), camY.get(), camZ.get());
      lookX.update(flight.x + forwardX * 30, dt);
      lookY.update(flight.y + Math.sin(flight.pitch) * 18, dt);
      lookZ.update(flight.z + forwardZ * 30, dt);
      camera.lookAt(lookX.get(), lookY.get(), lookZ.get());
    }

    // The shadow camera follows the plane so the shadow stays crisp.
    sun.position.set(flight.x - 900, 1200, flight.z - 600);
    sun.target.position.set(flight.x, 0, flight.z);
    sun.target.updateMatrixWorld();

    renderer.render(scene, camera);
    void attract;
  }

  return {
    draw,
    snapCamera,
    rings,
    terrain,
    get cameraMode() {
      return cameraMode;
    },
    toggleCamera() {
      cameraMode = cameraMode === CAMERA_CHASE ? CAMERA_COCKPIT : CAMERA_CHASE;
      snapped = false;
      return cameraMode;
    },
  };
}
