// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The
// game moves between four screens: title, play, paused and game over. The engine hum and
// the wind follow the throttle and the speed; a ring chimes, a touchdown thuds.
//
// ?seed=N fixes the world. ?shot=flight|title|landing|win (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP, WORLD_SEED } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_HARD_LANDING, EVENT_LANDED, EVENT_OUT_OF_FUEL, EVENT_RING, EVENT_TAKEOFF } from './world.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : WORLD_SEED;

const canvas = document.getElementById('game');
const random = createRandom(seed);
const renderer = createRenderer(canvas, random);
const world = createWorld(renderer.rings);
const hud = createHud();
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function cameraName() {
  return renderer.cameraMode === 'cockpit' ? 'CAM COCKPIT [C]' : 'CAM CHASE [C]';
}

function runShot(name) {
  const scene = stageShot(name, world, renderer.rings);
  const flight = world.state.flight;
  renderer.snapCamera(flight);
  world.state.objective = world.objectiveText();
  let painted = 0;
  function paint() {
    renderer.draw(flight, 12, STEP, false);
    hud.draw(world.state, scene.screen, scene.best, cameraName());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let time = 0;

  function startGame() {
    audio.unlock();
    audio.click();
    world.reset();
    renderer.snapCamera(world.state.flight);
    accumulator = 0;
    screen = SCREEN_PLAY;
    hud.announce('Playing. Fly the rings, then land on runway 09.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.idle();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    hud.announce(`${world.state.reason} Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      hud.announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CAMERA && (screen === SCREEN_PLAY || screen === SCREEN_TITLE)) {
      renderer.toggleCamera();
      audio.click();
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_PAUSED)) startGame();
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        hud.announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.idle();
      hud.announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      hud.announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { pitch: 0, roll: 0, throttle: 0 }, true);
      return;
    }
    const control = input.control();
    const events = world.step(STEP, control, false);
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_TAKEOFF) audio.click();
    if (events & EVENT_HARD_LANDING) audio.hardLanding();
    if (events & EVENT_LANDED) {
      audio.touchdown();
      endGame();
    } else if (events & EVENT_CRASH) {
      audio.crash();
      endGame();
    } else if (events & EVENT_OUT_OF_FUEL) {
      audio.idle();
      endGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
        time += STEP;
      }
    } else {
      accumulator = 0;
    }
    const flight = world.state.flight;
    if (screen === SCREEN_PLAY) {
      audio.update(flight.throttle, flight.speed, flight.airborne);
      if (flight.fuel <= 25 && flight.fuel > 0 && !world.state.ended) audio.warning(STEP);
    }
    world.state.objective = world.objectiveText();
    renderer.draw(flight, time, frameDt, screen === SCREEN_TITLE);
    hud.draw(world.state, screen, best, cameraName());
  }

  // Leaving the tab pauses a running game rather than letting the plane fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.idle();
      hud.announce('Paused.');
    }
  });

  hud.announce('Island Air Rally. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
