// Dawn Patrol: Island Run — every tuning number the sortie is balanced around lives here.
// The canvas is a fixed 1280x800 logical field; the renderer scales it to the window so the
// flying, the camera and the screenshots all see the same frame.

export const FIELD = { width: 1280, height: 800 };

/** Fixed simulation step: the world advances in sixtieths whatever the display does. */
export const STEP = 1 / 60;

/** Camera and world-to-screen layout. The plane sits at anchorX, a little left of centre. */
export const VIEW = {
  anchorX: 402,
  planeY: 344,
  altScale: 0.64,
  horizon: 566,
};

export const WORLD = {
  length: 9000,        // metres in one lap of the island; the strip sits at 0 and at L
  runwayHalf: 620,     // half length of the tarmac, in world metres
  runwayAlt: 128,      // the airfield plateau, in metres above the sea
  riverX: 4380,
  townX: 6120,
  startFuel: 74,       // percent
  ringClearance: 46,   // rings are hung at least this far above the ground
  maxSortieSeconds: 240,
};

/** The five gates of the course, west to east across the island. */
export const RINGS = [
  { x: 1520, alt: 250, radius: 78 },
  { x: 2900, alt: 332, radius: 78 },
  { x: 4260, alt: 226, radius: 74 },
  { x: 5580, alt: 342, radius: 78 },
  { x: 8000, alt: 238, radius: 74 },
];

export const PLANE = {
  pitchSlew: 1.65,      // radians per second the nose can travel
  maxPitch: 0.58,       // about 33 degrees, enough for a steep climb
  idleThrust: 4.2,
  maxThrust: 15.6,
  drag: 0.0016,
  gravity: 9.81,
  climbFactor: 0.85,
  stallSpeed: 40,
  rotateSpeed: 52,
  maxSpeed: 126,
  fuelBurnIdle: 0.05,
  fuelBurnOpen: 0.45,
  groundFriction: 0.55,
  brakeDrag: 5.2,
};

export const SCORE = {
  takeoff: 100,
  ring: 200,
  ringSpeed: 100,     // extra for arriving fast, up to this
  time: 320,          // at the ramp, falling with the clock
  timeRate: 2.2,
  landing: 300,
  fuel: 3,            // points per percent still in the tanks
};

/** Bit flags returned by the simulation so the loop can play sound and change screens. */
export const EV = {
  TAKEOFF: 1,
  RING: 2,
  MISS: 4,
  CRASH: 8,
  TOUCHDOWN: 16,
  LAND: 32,
  FUEL_OUT: 64,
  STALL: 128,
};

/** One flat-shaded palette shared by the terrain, the plane and the HUD. */
export const PALETTE = {
  ink: '#08141c',
  panel: 'rgba(8, 22, 30, 0.91)',
  panelEdge: 'rgba(158, 226, 214, 0.35)',
  text: '#eaf6f3',
  dim: '#8fb0b4',
  teal: '#7fe7d4',
  amber: '#ffc978',
  red: '#ff6b5e',
  green: '#8ee08a',
  glass: '#173b4a',
  cream: '#f3e7c9',
  bodyRed: '#c8503f',
  bodyDeep: '#8f3428',
  wing: '#e8dcc0',
  wingDeep: '#c9b98f',
  tyre: '#1d2428',
  chrome: '#b9c7cc',
};

export const FONT = 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace';
export const FONT_UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const BEST_KEY = 'dawn-patrol.best';
