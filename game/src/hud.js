// The HUD: DOM readouts for altitude, speed, heading, throttle, fuel, damage, score and
// the objective, plus a 2D instruments canvas with an artificial horizon and a compass
// strip. Text that holds a number is rebuilt only when the number changes.
import { FUEL, PALETTE, RINGS } from './config.js';
import { headingDegrees } from './plane.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function cachedText(element) {
  let value = null;
  return function set(next) {
    if (next !== value) {
      value = next;
      element.textContent = next;
    }
  };
}

export function createHud() {
  const root = document.getElementById('hud');
  const alt = cachedText(document.getElementById('hud-alt'));
  const speed = cachedText(document.getElementById('hud-speed'));
  const heading = cachedText(document.getElementById('hud-heading'));
  const score = cachedText(document.getElementById('hud-score'));
  const timer = cachedText(document.getElementById('hud-time'));
  const objective = cachedText(document.getElementById('hud-objective'));
  const message = cachedText(document.getElementById('hud-message'));
  const rings = cachedText(document.getElementById('hud-rings'));
  const throttleFill = document.getElementById('hud-throttle-fill');
  const fuelFill = document.getElementById('hud-fuel-fill');
  const damageFill = document.getElementById('hud-damage-fill');
  const fuelValue = cachedText(document.getElementById('hud-fuel-value'));
  const cameraLabel = cachedText(document.getElementById('hud-camera'));
  const instruments = document.getElementById('instruments');
  const instrumentContext = instruments.getContext('2d');
  const panel = document.getElementById('panel');
  const panelTitle = document.getElementById('panel-title');
  const panelLines = document.getElementById('panel-lines');
  const panelPrompt = document.getElementById('panel-prompt');
  const status = document.getElementById('status');

  let lastThrottle = -1;
  let lastFuel = -1;
  let lastDamage = -1;

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  /** The artificial horizon and compass strip, painted every frame while flying. */
  function drawInstruments(flight) {
    const context = instrumentContext;
    const width = instruments.width;
    const height = instruments.height;
    context.clearRect(0, 0, width, height);

    // Attitude indicator, left half.
    const cx = 78;
    const cy = height / 2;
    const radius = 62;
    context.save();
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.clip();
    context.translate(cx, cy);
    context.rotate(flight.bank);
    const pitchOffset = flight.pitch * 90;
    context.fillStyle = '#3f8fd2';
    context.fillRect(-radius, -radius - pitchOffset, radius * 2, radius + pitchOffset);
    context.fillStyle = '#8a6b46';
    context.fillRect(-radius, -pitchOffset, radius * 2, radius + pitchOffset);
    context.strokeStyle = '#eef4f8';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-radius, -pitchOffset);
    context.lineTo(radius, -pitchOffset);
    context.stroke();
    context.restore();
    context.strokeStyle = '#eef4f8';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.stroke();
    // Fixed aircraft symbol over the moving horizon.
    context.strokeStyle = '#ffc93c';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(cx - 26, cy);
    context.lineTo(cx - 8, cy);
    context.moveTo(cx + 8, cy);
    context.lineTo(cx + 26, cy);
    context.moveTo(cx, cy);
    context.lineTo(cx, cy + 6);
    context.stroke();
    context.fillStyle = '#9fb4c4';
    context.font = '11px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('ATT', cx, cy + radius + 14);

    // Compass strip, right half: ticks every 30 degrees around the heading.
    const stripX = 168;
    const stripWidth = width - stripX - 12;
    const stripY = 14;
    const centreHeading = headingDegrees(flight.heading);
    context.fillStyle = 'rgba(10, 22, 34, 0.55)';
    context.fillRect(stripX, stripY, stripWidth, 44);
    context.strokeStyle = '#9fb4c4';
    context.lineWidth = 1;
    context.strokeRect(stripX, stripY, stripWidth, 44);
    context.fillStyle = '#eef4f8';
    context.font = 'bold 13px system-ui, sans-serif';
    context.textAlign = 'center';
    for (let offset = -90; offset <= 90; offset += 15) {
      const degrees = ((Math.round(centreHeading + offset) % 360) + 360) % 360;
      const x = stripX + stripWidth / 2 + (offset / 90) * (stripWidth / 2 - 8);
      const major = degrees % 30 === 0;
      context.beginPath();
      context.moveTo(x, stripY + 44);
      context.lineTo(x, stripY + (major ? 28 : 36));
      context.stroke();
      if (major) {
        const label = degrees === 0 ? 'E' : degrees === 90 ? 'N' : degrees === 180 ? 'W' : degrees === 270 ? 'S' : String(degrees);
        context.fillText(label, x, stripY + 24);
      }
    }
    // Centre caret and the heading number.
    context.fillStyle = '#ffc93c';
    context.beginPath();
    context.moveTo(stripX + stripWidth / 2 - 6, stripY + 2);
    context.lineTo(stripX + stripWidth / 2 + 6, stripY + 2);
    context.lineTo(stripX + stripWidth / 2, stripY + 10);
    context.closePath();
    context.fill();
    context.fillStyle = '#9fb4c4';
    context.font = '11px system-ui, sans-serif';
    context.fillText('HDG', stripX + stripWidth / 2, stripY + 58);
  }

  function showPanel(title, lines, prompt) {
    panelTitle.textContent = title;
    panelLines.innerHTML = '';
    for (const line of lines) {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      panelLines.appendChild(paragraph);
    }
    panelPrompt.textContent = prompt;
    panel.classList.remove('hidden');
  }

  function hidePanel() {
    panel.classList.add('hidden');
  }

  return {
    /** Paint one frame: readouts, bars and instruments for the screen the game is on. */
    draw(state, screen, best, cameraName) {
      const flight = state.flight;
      instruments.classList.toggle('hidden', screen !== SCREEN_PLAY);
      if (screen === SCREEN_TITLE) {
        showPanel(
          'Island Air Rally',
          [
            'Take off from runway 09 on Coral Island.',
            `Fly through all ${RINGS.length} golden rings, then land back on the runway.`,
            'Watch your fuel — a dry tank means a long glide home.',
            `Best score: ${best}`,
          ],
          'Press Space or click to fly',
        );
        alt('ALT — ft');
        speed('SPD — kt');
        heading('HDG —°');
        score('SCORE 0');
        timer('0:00');
        objective('Island Air Rally — Coral Archipelago');
        message('');
        rings(`RINGS 0/${RINGS.length}`);
        cameraLabel(cameraName);
      } else if (screen === SCREEN_PLAY) {
        hidePanel();
        drawInstruments(flight);
      } else if (screen === SCREEN_PAUSED) {
        showPanel('Paused', ['The island will wait for you.'], 'Press P to resume');
      } else if (screen === SCREEN_OVER) {
        const lines = [];
        if (state.breakdown !== null) {
          lines.push(`Rings flown: ${state.rings} of ${RINGS.length}  (+${state.breakdown.rings})`);
          lines.push(`Landing — soft ${state.breakdown.soft}, centreline ${state.breakdown.centre}, speed ${state.breakdown.speed}`);
          lines.push(`Fuel left ${state.breakdown.fuel}  ·  Time bonus ${state.breakdown.time}`);
          lines.push(`Total score: ${state.score}   ·   Best: ${best}`);
        } else {
          lines.push(`Score: ${state.score}   ·   Best: ${best}`);
          lines.push(`Rings flown: ${state.rings} of ${RINGS.length}`);
        }
        showPanel(state.ending === 'landed' ? 'Course complete!' : state.ending === 'landed-early' ? 'Landed early' : 'Sortie over', lines, 'Press Space or click to fly again');
        message('');
      }

      // Readouts stay live on every screen but the title, so the end panel never
      // sits under a stale zero score.
      if (screen !== SCREEN_TITLE) {
        const altitudeFt = Math.max(0, Math.round((flight.y - 6) * 3.281));
        const speedKt = Math.round(flight.speed * 1.944);
        alt(`ALT ${altitudeFt.toLocaleString('en-US')} ft`);
        speed(`SPD ${speedKt} kt`);
        heading(`HDG ${String(Math.round(headingDegrees(flight.heading))).padStart(3, '0')}°`);
        score(`SCORE ${state.score}`);
        timer(formatTime(state.elapsed));
        objective(state.objective ?? '');
        message(screen === SCREEN_PLAY && state.messageTimer > 0 ? state.message : '');
        rings(`RINGS ${state.rings}/${RINGS.length}`);
        cameraLabel(cameraName);
      }

      // Bars, updated only when they move: throttle, fuel, damage.
      const throttlePercent = Math.round(flight.throttle * 100);
      if (throttlePercent !== lastThrottle) {
        lastThrottle = throttlePercent;
        throttleFill.style.width = `${throttlePercent}%`;
      }
      const fuelPercent = Math.round(flight.fuel);
      if (fuelPercent !== lastFuel) {
        lastFuel = fuelPercent;
        fuelFill.style.width = `${fuelPercent}%`;
        fuelFill.style.background = fuelPercent <= FUEL.lowWarning ? PALETTE.hudRed : PALETTE.hudGreen;
        fuelValue(`FUEL ${fuelPercent}%`);
      }
      const damagePercent = Math.round(flight.damage);
      if (damagePercent !== lastDamage) {
        lastDamage = damagePercent;
        damageFill.style.width = `${damagePercent}%`;
      }
    },
    /** Screen readers (and anyone watching the page's text) hear screen changes. */
    announce(text) {
      status.textContent = text;
    },
  };
}
