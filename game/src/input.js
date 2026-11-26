// Keyboard and mouse input. Held keys give pitch, roll and throttle; one-shot presses
// (start, pause, camera, restart, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The mouse steers too:
// where the pointer sits relative to the window centre banks and pitches the plane, and any
// held key overrides the mouse on that axis.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CAMERA = 4;
export const ACTION_RESTART = 8;
export const ACTION_MUTE = 16;

const PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const ROLL_LEFT = new Set(['ArrowLeft', 'KeyA']);
const ROLL_RIGHT = new Set(['ArrowRight', 'KeyD']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight', 'PageUp']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight', 'PageDown']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CAMERA = new Set(['KeyC']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseActive = false;
  let mouseSeenAt = 0;

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (CAMERA.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CAMERA;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (
      PITCH_UP.has(event.code) || PITCH_DOWN.has(event.code) ||
      ROLL_LEFT.has(event.code) || ROLL_RIGHT.has(event.code) ||
      THROTTLE_UP.has(event.code) || THROTTLE_DOWN.has(event.code)
    ) {
      keys.add(event.code);
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    mouseActive = false;
  });
  window.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = (event.clientY / window.innerHeight) * 2 - 1;
    mouseActive = true;
    mouseSeenAt = performance.now();
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  function held(set) {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  }

  return {
    /**
     * The steering for this frame: pitch -1..1 (up positive), roll -1..1 (right
     * positive), throttle -1..1 (change). Keys win over the mouse on each axis; the
     * mouse goes quiet a second after it stops moving, so it never fights the pilot.
     */
    control() {
      const mouseFresh = mouseActive && performance.now() - mouseSeenAt < 1500;
      let pitch = 0;
      let roll = 0;
      if (held(PITCH_UP)) pitch += 1;
      if (held(PITCH_DOWN)) pitch -= 1;
      if (held(ROLL_LEFT)) roll -= 1;
      if (held(ROLL_RIGHT)) roll += 1;
      if (mouseFresh) {
        if (pitch === 0) pitch = Math.max(-1, Math.min(1, -mouseY * 0.9));
        if (roll === 0) roll = Math.max(-1, Math.min(1, mouseX * 0.9));
      }
      let throttle = 0;
      if (held(THROTTLE_UP)) throttle += 1;
      if (held(THROTTLE_DOWN)) throttle -= 1;
      return { pitch, roll, throttle };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
