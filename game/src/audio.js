// Synthesised sound only (WebAudio, no files): a prop engine that follows the throttle, wind
// that follows the speed, a chime for each ring, a thud for touchdown, a crash burst and a
// low-fuel warning beep. Everything starts on the first user gesture, as browsers require.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let warningTimer = 0;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
    } catch {
      return false;
    }
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = context.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 110;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(context.destination);
    engineOsc.start();
    engineOsc2.start();

    const noiseLength = context.sampleRate * 2;
    const buffer = context.createBuffer(1, noiseLength, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < noiseLength; index += 1) data[index] = Math.random() * 2 - 1;
    windSource = context.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 600;
    windFilter.Q.value = 0.6;
    windGain = context.createGain();
    windGain.gain.value = 0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(context.destination);
    windSource.start();
    return true;
  }

  function tone(frequency, duration, type, volume, when = 0) {
    if (context === null) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function noiseBurst(duration, volume, filterFrequency) {
    if (context === null) return;
    const start = context.currentTime;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(start);
  }

  return {
    /** Call from any user gesture: creates the context and resumes it. */
    unlock() {
      if (ensure() && context.state === 'suspended') void context.resume();
    },
    /** Continuous engine and wind, called every frame while flying. */
    update(throttle, speed, airborne) {
      if (context === null || muted) return;
      const now = context.currentTime;
      const engineLevel = airborne ? 0.05 + throttle * 0.075 : 0.03 + throttle * 0.05;
      engineGain.gain.setTargetAtTime(engineLevel, now, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + throttle * 68, now, 0.08);
      engineOsc2.frequency.setTargetAtTime(104 + throttle * 136, now, 0.08);
      const windLevel = Math.min(0.16, Math.max(0, (speed - 12) / 90) * 0.16);
      windGain.gain.setTargetAtTime(windLevel, now, 0.12);
      windFilter.frequency.setTargetAtTime(380 + speed * 9, now, 0.12);
    },
    /** Silence the continuous layers (title screen, pause, end screens). */
    idle() {
      if (context === null) return;
      const now = context.currentTime;
      engineGain.gain.setTargetAtTime(0, now, 0.1);
      windGain.gain.setTargetAtTime(0, now, 0.1);
    },
    ring() {
      if (context === null || muted) return;
      tone(880, 0.28, 'sine', 0.22);
      tone(1318, 0.4, 'sine', 0.18, 0.09);
    },
    touchdown() {
      if (context === null || muted) return;
      tone(70, 0.35, 'sine', 0.4);
      noiseBurst(0.18, 0.25, 500);
    },
    hardLanding() {
      if (context === null || muted) return;
      tone(55, 0.5, 'sine', 0.5);
      noiseBurst(0.3, 0.4, 350);
    },
    crash() {
      if (context === null || muted) return;
      noiseBurst(0.9, 0.55, 900);
      tone(48, 0.8, 'sine', 0.5);
    },
    click() {
      if (context === null || muted) return;
      tone(660, 0.07, 'sine', 0.12);
    },
    /** A short beep at most once a second while the warning holds. */
    warning(dt) {
      if (context === null || muted) return;
      warningTimer -= dt;
      if (warningTimer <= 0) {
        warningTimer = 1;
        tone(1046, 0.12, 'square', 0.06);
      }
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.idle();
      return muted;
    },
    get isMuted() {
      return muted;
    },
  };
}
