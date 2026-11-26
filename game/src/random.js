// A tiny seeded generator (xorshift32). The island, its trees and the far hills are all
// built from this, so ?seed=7 always gives the same coastline and the same screenshots.

export function createRandom(seed) {
  let state = (seed | 0) || 0x9e3779b9;
  return function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

/** Uniform float in [lo, hi). */
export function between(random, lo, hi) {
  return lo + random() * (hi - lo);
}

/** Pick one element of a list. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length) % list.length];
}
