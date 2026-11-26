// Every tuning number and colour in one place. Distances are metres, speeds metres per
// second, angles radians, headings degrees clockwise from east (+X, runway heading 090).
// The world is a 5200 m square of sea with a home island (and its runway) at the centre.

export const STEP = 1 / 60;

/** The seed every staged screenshot and every fresh world is built from. */
export const WORLD_SEED = 20261126;

/** Where the sea sits, and the flat top of the home island the runway is built on. */
export const SEA_LEVEL = 0;
export const RUNWAY_Y = 6;

/** The runway: a strip along +X (heading 090), threshold at its west end. */
export const RUNWAY = {
  length: 900,
  halfLength: 450,
  width: 36,
  halfWidth: 18,
  headingDeg: 90,
};

/** The islands: centre, peak height above sea, radius. The first is the home island. */
export const ISLANDS = [
  { x: 0, z: 0, peak: 6, radius: 780, plateau: true },
  { x: 1250, z: -950, peak: 95, radius: 520 },
  { x: -1450, z: -1150, peak: 135, radius: 660 },
  { x: 1550, z: 1250, peak: 75, radius: 480 },
  { x: -1250, z: 1350, peak: 165, radius: 720 },
  { x: 350, z: -1850, peak: 55, radius: 420 },
  { x: -2100, z: 350, peak: 85, radius: 540 },
  { x: 2250, z: -250, peak: 65, radius: 460 },
];

export const WORLD_SIZE = 5200;
export const WORLD_HALF = WORLD_SIZE / 2;

/** The ring course: six glowing rings flown in order, then land on runway 09. */
export const RINGS = [
  { x: 620, y: 95, z: -520, radius: 16 },
  { x: 1380, y: 130, z: -980, radius: 16 },
  { x: 320, y: 175, z: -1560, radius: 16 },
  { x: -950, y: 210, z: -1250, radius: 16 },
  { x: -1560, y: 120, z: 180, radius: 16 },
  { x: -980, y: 75, z: 420, radius: 16 },
];
export const RING_POINTS = 150;

export const PLANE = {
  /** Top speed at full throttle, and the speed the wing stops flying. */
  maxSpeed: 92,
  stallSpeed: 26,
  /** How fast the engine answers the throttle, per second. */
  accel: 0.45,
  /** Roll and pitch rates at full stick, radians per second. */
  rollRate: 1.9,
  pitchRate: 0.85,
  maxBank: 1.0,
  maxPitch: 0.62,
  /** The bank eases itself level this fast when the stick is centred. */
  levelRate: 0.55,
  /** Takeoff: the wheels leave the runway at this speed. */
  rotateSpeed: 30,
  /** Touchdown limits for a landing that counts (see world.js). */
  maxLandingSpeed: 58,
  maxSinkRate: 7,
  hardSinkRate: 12,
  maxLandingBank: 0.35,
  maxHeadingErrorDeg: 28,
};

export const FUEL = {
  start: 100,
  /** Burn per second at full throttle; idle burns a quarter of that. */
  burnFull: 0.42,
  burnIdle: 0.1,
  lowWarning: 25,
};

export const DAMAGE = {
  /** A hard-but-survivable touchdown adds this much damage. */
  hardLanding: 34,
  /** Damage at or above this ends the sortie. */
  fatal: 100,
};

export const SCORE = {
  landingSoft: 200,
  landingCentre: 150,
  landingSpeed: 150,
  /** Fuel left is worth this many points per unit at touchdown. */
  fuelPerUnit: 2,
  /** Each second under the par time is worth this much. */
  timePerSecond: 2,
  parSeconds: 240,
};

export const PALETTE = {
  skyTop: 0x2f6fb4,
  skyHorizon: 0xbfd9e8,
  sea: 0x1e6f8e,
  seaDeep: 0x155a75,
  sand: 0xe8d9a0,
  grass: 0x5da24a,
  grassDry: 0x8aa84f,
  rock: 0x8a7f72,
  snow: 0xf2f4f6,
  runway: 0x2b2f36,
  runwayMark: 0xf5f5f0,
  planeBody: 0xe8452c,
  planeWing: 0xf5f2ea,
  planeTrim: 0x1d3557,
  ring: 0xffc93c,
  ringDone: 0x37d67a,
  hudText: '#eef4f8',
  hudDim: '#9fb4c4',
  hudAmber: '#ffc93c',
  hudRed: '#ff5a4e',
  hudGreen: '#37d67a',
  panel: 'rgba(10, 22, 34, 0.82)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'island-air-rally.best';
