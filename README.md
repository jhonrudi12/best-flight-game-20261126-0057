# best-flight-game-20261126-0057
[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/jhonrudi12/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/jhonrudi12/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Island Air Rally** — a complete 3D flight game that runs in a desktop browser from static files, no network needed. Take off from runway 09 on Coral Island, fly a six-ring course over a procedural archipelago of islands, mountains and sea, then bring the plane home and land it — gentle, slow, wings level — before the fuel runs out.

## What you fly

- **Real 3D world** (three.js, vendored): chase or cockpit camera over recognisable terrain — sandy beaches, grass slopes, rocky peaks, a marked runway with threshold bars and edge lights, drifting clouds and a low sun.
- **Flight model with consequences**: throttle sets your speed, banking turns you, pitch climbs and descends, and the wing stalls if you get slow. Fuel burns with the throttle, so a sortie is a decision: push for the time bonus or save fuel for the landing.
- **A mission, not a sandbox**: six golden rings in order, a guide arrow and a distance readout to the next one, then a scored landing — softness, centreline, speed, fuel left and time all count.
- **Clear endings**: course complete, landed early, ditched in the sea, flown into a mountain, or out of fuel — each with its own score breakdown and a best score kept between visits.
- **Instruments lit**: altitude, speed and heading on the HUD, plus an artificial horizon and a compass strip, throttle / fuel / damage bars, and synthesised WebAudio engine, wind, ring chimes and touchdown thuds — no audio files.

## Controls

| Input | Does |
| --- | --- |
| W/S or ↑/↓ | Pitch up / down |
| A/D or ←/→ | Bank left / right |
| Shift / Ctrl | Throttle up / down |
| Mouse | Steers (bank and pitch follow the pointer) |
| C | Chase / cockpit camera |
| P | Pause |
| M | Sound on / off |
| R | Restart after a sortie ends |
| Space / click | Start, restart |

## Run it

Serve `game/` with any static server and open it in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly from any static host. The game makes zero network requests: every script, library and asset is a file under `game/`.
