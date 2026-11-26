// The island: a looping coastal profile plus the things that make it a place — farm strips,
// a river valley, a road, an airfield and a little hill town. Everything is a pure function of
// world x, so the renderer can ask for a height anywhere and always get the same answer.

import { WORLD } from './config.js';
import { between, pick } from './random.js';

const L = WORLD.length;

const FIELD_TONES = [
  { body: '#c7b06c', furrow: '#b39a55', edge: '#8f8a4c' },
  { body: '#93b25b', furrow: '#7d9d49', edge: '#5f7d3d' },
  { body: '#b18054', furrow: '#9b6d44', edge: '#7a573a' },
  { body: '#b9c36a', furrow: '#a4ad55', edge: '#858f45' },
  { body: '#7fa86b', furrow: '#6b9259', edge: '#557747' },
];

const HOUSE_WALLS = ['#efe1c2', '#e4d3b2', '#d8c9ad', '#f2e7cf'];
const HOUSE_ROOFS = ['#b65743', '#a34d3c', '#c16848', '#8e5546'];
const TREE_TINTS = ['#3f6f43', '#4b7d4a', '#356040', '#547f4a'];

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Signed distance from x to the seam at 0 (the airfield), in the range -L/2..L/2. */
export function wrapSigned(x) {
  const w = ((x % L) + L) % L;
  return w > L / 2 ? w - L : w;
}

/** Distance along the loop from x to a landmark. */
export function wrapDistance(x, landmark) {
  return Math.abs(wrapSigned(x - landmark));
}

export function createIsland(random) {
  function heightAt(x) {
    // Long ridges with shorter shoulders; the sums never dip below the beaches.
    let h = 116
      + 30 * Math.sin(x * 0.00185 + 0.6)
      + 19 * Math.sin(x * 0.0042 + 2.2)
      + 8 * Math.sin(x * 0.0115 + 0.9)
      + 18 * Math.sin(x * 0.0009 + 1.7);

    // The river has cut a soft valley through the middle of the island.
    const river = wrapDistance(x, WORLD.riverX);
    h -= 62 * Math.exp(-(river * river) / (2 * 92 * 92));

    // The town stands on a levelled shelf.
    const town = wrapDistance(x, WORLD.townX);
    const shelf = Math.exp(-(town * town) / (2 * 300 * 300)) * 0.6;
    h = h * (1 - shelf) + 112 * shelf;

    h = clamp(h, 44, 248);

    // Blend the rolling profile down to the flat airfield plateau at the seam. The approach
    // side gets a long coastal plain so the last gate opens onto a clean final; the departure
    // side climbs away quickly behind the strip.
    const signed = wrapSigned(x);
    const ad = Math.abs(signed);
    const blend = signed < 0 && ad > WORLD.runwayHalf
      ? smoothstep(WORLD.runwayHalf + 1680, WORLD.runwayHalf + 2380, ad)
      : smoothstep(WORLD.runwayHalf + 14, WORLD.runwayHalf + 430, ad);
    return WORLD.runwayAlt * (1 - blend) + h * blend;
  }

  const features = buildFeatures(random);
  const clouds = buildClouds(random);

  return {
    length: L,
    heightAt,
    runwayAlt: WORLD.runwayAlt,
    runwayHalf: WORLD.runwayHalf,
    /** Distance from the middle of the nearest tarmac. */
    runwayDistance(x) {
      return Math.abs(wrapSigned(x));
    },
    /** True when x is over tarmac, with `margin` metres of tarmac still either side. */
    onRunway(x, margin = 0) {
      return Math.abs(wrapSigned(x)) < WORLD.runwayHalf - margin;
    },
    riverX: WORLD.riverX,
    townX: WORLD.townX,
    features,
    clouds,
  };
}

function buildFeatures(random) {
  const fields = [];
  const trees = [];
  const houses = [];
  const roads = [];

  // Farm strips: patchwork quilts laid over the slopes.
  for (let i = 0; i < 30; i += 1) {
    const x = between(random, 900, L - 900);
    if (Math.abs(wrapSigned(x)) < 900) continue;
    if (wrapDistance(x, WORLD.riverX) < 170) continue;
    if (wrapDistance(x, WORLD.townX) < 330) continue;
    const width = between(random, 170, 360);
    fields.push({ x, width, tone: Math.floor(random() * FIELD_TONES.length), tilt: between(random, -1, 1) });
  }

  // Trees, in loose clumps rather than an even hedge.
  let cursor = 700;
  while (cursor < L - 700) {
    const x = cursor + between(random, 8, 34);
    cursor = x + between(random, 22, 54);
    if (Math.abs(wrapSigned(x)) < 760) continue;
    if (wrapDistance(x, WORLD.townX) < 280) continue;
    const clump = random() < 0.22 ? 3 : 1;
    for (let i = 0; i < clump; i += 1) {
      const tx = x + between(random, -26, 26);
      trees.push({
        x: tx,
        size: between(random, 0.7, 1.35),
        kind: random() < 0.55 ? 0 : 1,
        tint: Math.floor(random() * TREE_TINTS.length),
      });
    }
  }

  // The hill town: a handful of cottages, a barn and a church tower.
  const townBase = WORLD.townX - 240;
  for (let i = 0; i < 9; i += 1) {
    const x = townBase + i * between(random, 48, 74) + between(random, -14, 14);
    houses.push({
      x,
      width: between(random, 24, 44),
      height: between(random, 20, 34),
      wall: pick(random, HOUSE_WALLS),
      roof: pick(random, HOUSE_ROOFS),
      lit: random() < 0.7,
      chimney: random() < 0.6,
    });
  }
  houses.push({
    x: WORLD.townX + 150,
    width: 38,
    height: 42,
    wall: '#e9dcc0',
    roof: '#7d5847',
    lit: true,
    chimney: true,
  });

  // The coast road runs in three long stretches, following the land.
  roads.push({ x0: 820, x1: 3350 }, { x0: 3560, x1: 5460 }, { x0: 5750, x1: 6820 }, { x0: 7450, x1: 8320 });

  return { fields, trees, houses, roads, tones: FIELD_TONES, treeTints: TREE_TINTS };
}

function buildClouds(random) {
  const clouds = [];
  for (let i = 0; i < 16; i += 1) {
    clouds.push({
      x: between(random, 0, 2600),
      band: between(random, 0.08, 0.46),
      scale: between(random, 0.6, 1.5),
      speed: between(random, 2, 7),
      puffs: Math.floor(between(random, 3, 6)),
    });
  }
  return clouds;
}
