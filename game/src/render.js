// Everything you see: the dawn sky, the island scrolling under the wing, the glowing gates, the
// aeroplane itself, the instruments and the four overlay screens. Drawing only — the renderer
// reads the world's state and never changes it.

import { FIELD, FONT, FONT_UI, PALETTE, VIEW } from './config.js';
import { drawHud } from './hud.js';
import { missionText, STAGE } from './mission.js';
import { wrapSigned } from './terrain.js';

export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  PAUSED: 'paused',
  CRASH: 'crash',
  COMPLETE: 'complete',
};

// Sky palettes from first light to late gold. Every entry is an sRGB hex; themeAt() mixes them.
const SKIES = [
  {
    at: 0,
    top: '#152544', mid: '#7a5068', low: '#f0a56a', haze: '#f7c79a',
    sun: '#ffe0a8', cloud: '#f7dfcb', far: '#4a5878', farLit: '#737a94',
    hill: '#38605a', hillDark: '#2a4a48', water: '#4c7f92',
  },
  {
    at: 0.35,
    top: '#2b6aa6', mid: '#7fb2cc', low: '#dfe9da', haze: '#edf2e3',
    sun: '#fff3c8', cloud: '#ffffff', far: '#5b7896', farLit: '#839ab0',
    hill: '#3f6b52', hillDark: '#2d5242', water: '#3f7f91',
  },
  {
    at: 0.68,
    top: '#2f5d88', mid: '#7d9fb0', low: '#f0cf9c', haze: '#f4dfb4',
    sun: '#ffe6b0', cloud: '#f9e9d8', far: '#5b6c88', farLit: '#8a8fa0',
    hill: '#3b624c', hillDark: '#2a4a3c', water: '#42768a',
  },
  {
    at: 1,
    top: '#1d2b4c', mid: '#77496a', low: '#ef9a60', haze: '#f4b47c',
    sun: '#ffcf92', cloud: '#f0cdbb', far: '#433f62', farLit: '#6f5a78',
    hill: '#33504a', hillDark: '#253f3d', water: '#3a5f74',
  },
];

function parseHex(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function mixRgb(a, b, t) {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

function rgb(c) {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function themeAt(tod) {
  const t = Math.max(0, Math.min(1, tod));
  let lo = SKIES[0];
  let hi = SKIES[SKIES.length - 1];
  for (let i = 0; i < SKIES.length - 1; i += 1) {
    if (t >= SKIES[i].at && t <= SKIES[i + 1].at) {
      lo = SKIES[i];
      hi = SKIES[i + 1];
      break;
    }
  }
  const span = Math.max(0.0001, hi.at - lo.at);
  const k = Math.max(0, Math.min(1, (t - lo.at) / span));
  const out = {};
  for (const key of Object.keys(lo)) {
    if (key === 'at' || typeof lo[key] !== 'string') continue;
    const c = mixRgb(parseHex(lo[key]), parseHex(hi[key]), k);
    out[key] = rgb(c);
    out[`${key}Raw`] = c;
  }
  return out;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function screenXFor(worldX, cameraX) {
  return VIEW.anchorX + wrapSigned(worldX - cameraX);
}

function altY(alt, cameraAlt, offset = 0) {
  return VIEW.planeY + (cameraAlt - alt) * VIEW.altScale + offset;
}

function path(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function panel(ctx, x, y, w, h, cut = 14) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
  ctx.fillStyle = 'rgba(7, 19, 27, 0.9)';
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function label(ctx, value, x, y, size, color, align = 'left', font = FONT) {
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function comma(value) {
  const n = Math.round(value);
  const s = String(Math.abs(n));
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return (n < 0 ? '-' : '') + out;
}

function drawSky(ctx, theme) {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.horizon + 120);
  gradient.addColorStop(0, theme.top);
  gradient.addColorStop(0.58, theme.mid);
  gradient.addColorStop(1, theme.low);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // A warm slab of haze sitting on the horizon.
  const haze = ctx.createLinearGradient(0, VIEW.horizon - 190, 0, VIEW.horizon + 80);
  haze.addColorStop(0, 'rgba(255,255,255,0)');
  haze.addColorStop(0.65, theme.haze.replace('rgb', 'rgba').replace(')', ', 0.18)'));
  haze.addColorStop(1, theme.haze.replace('rgb', 'rgba').replace(')', ', 0.34)'));
  ctx.fillStyle = haze;
  ctx.fillRect(0, VIEW.horizon - 190, FIELD.width, 270);
}

function drawStars(ctx, tod) {
  if (tod > 0.18) return;
  const alpha = Math.max(0, 1 - tod / 0.18) * 0.7;
  for (let i = 0; i < 46; i += 1) {
    const x = ((i * 197) % 1240) + 20;
    const y = ((i * 83) % 280) + 16;
    const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(i * 1.7));
    ctx.fillStyle = `rgba(232, 240, 255, ${alpha * twinkle})`;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
}

function drawSun(ctx, theme, tod) {
  const x = 1040 - tod * 250;
  const y = 336 - tod * 210;
  const glow = ctx.createRadialGradient(x, y, 8, x, y, 230);
  glow.addColorStop(0, `rgba(255, 236, 190, 0.55)`);
  glow.addColorStop(0.28, `rgba(255, 205, 140, 0.22)`);
  glow.addColorStop(1, 'rgba(255, 190, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 240, y - 240, 480, 480);
  ctx.fillStyle = theme.sun;
  ctx.beginPath();
  ctx.arc(x, y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 240, 0.55)';
  ctx.beginPath();
  ctx.arc(x - 7, y - 7, 12, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(ctx, state, theme) {
  const cam = state.camera;
  const span = 2600;
  for (const cloud of state.island.clouds) {
    const drift = state.visualTime * cloud.speed;
    let sx = ((cloud.x + drift - cam.x * 0.4) % span + span) % span - 620;
    if (sx < -420 || sx > FIELD.width + 220) continue;
    const sy = 64 + cloud.band * 330 - (cam.alt - 128) * 0.05;
    const s = cloud.scale;
    ctx.save();
    ctx.globalAlpha = 0.5 + cloud.band * 0.7;
    ctx.fillStyle = theme.cloud;
    ctx.beginPath();
    for (let i = 0; i < cloud.puffs; i += 1) {
      const px = sx + (i - cloud.puffs / 2) * 26 * s;
      const py = sy + Math.sin(i * 2.1 + cloud.scale) * 7 * s;
      const rad = (24 + (i % 3) * 9) * s;
      ctx.moveTo(px + rad, py);
      ctx.ellipse(px, py, rad, rad * 0.62, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#2b3d52';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 20 * s, 86 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRidges(ctx, state, theme) {
  const cam = state.camera;
  // Far range.
  drawRidge(ctx, {
    camera: state.camera.x,
    parallax: 0.1,
    base: altY(72, cam.alt) - 6,
    amp: 168,
    seed: 1.7,
    fill: theme.far,
    rim: theme.farLit,
    step: 10,
    treeLine: 0,
  });
  // Nearer, softer hills.
  drawRidge(ctx, {
    camera: state.camera.x,
    parallax: 0.26,
    base: altY(28, cam.alt) + 10,
    amp: 104,
    seed: 4.1,
    fill: theme.hill,
    rim: theme.hillDark,
    step: 8,
    treeLine: 1,
  });
}

function drawRidge(ctx, spec) {
  const camX = spec.camera ?? 0;
  const pts = [];
  for (let sx = -30; sx <= FIELD.width + 30; sx += spec.step) {
    const wx = sx + camX * spec.parallax;
    const h = spec.amp * (
      0.46
      + 0.26 * Math.sin(wx * 0.0021 + spec.seed)
      + 0.18 * Math.sin(wx * 0.0047 + spec.seed * 2.3)
      + 0.1 * Math.sin(wx * 0.0103 + spec.seed * 3.7)
    );
    pts.push([sx, spec.base - Math.max(14, h)]);
  }
  ctx.beginPath();
  ctx.moveTo(-40, FIELD.height + 40);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(FIELD.width + 40, FIELD.height + 40);
  ctx.closePath();
  ctx.fillStyle = spec.fill;
  ctx.fill();

  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = spec.rim;
  ctx.lineWidth = 3;
  ctx.stroke();

  if (spec.treeLine) {
    ctx.fillStyle = 'rgba(24, 47, 42, 0.45)';
    for (let i = 2; i < pts.length; i += 3) {
      const [x, y] = pts[i];
      const hh = 6 + ((i * 7) % 9);
      ctx.beginPath();
      ctx.moveTo(x, y + 2);
      ctx.lineTo(x - 4, y + 2 + hh);
      ctx.lineTo(x + 4, y + 2 + hh);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function terrainPath(ctx, state, offset = 0) {
  const cam = state.camera;
  const island = state.island;
  ctx.beginPath();
  let first = true;
  for (let sx = -24; sx <= FIELD.width + 24; sx += 8) {
    const wx = cam.x + (sx - VIEW.anchorX);
    const gy = altY(island.heightAt(wx), cam.alt, offset);
    if (first) {
      ctx.moveTo(sx, gy);
      first = false;
    } else ctx.lineTo(sx, gy);
  }
}

function drawGround(ctx, state) {
  const cam = state.camera;
  const island = state.island;

  // Landmass: a cool green shelf fading into shadow below.
  const grad = ctx.createLinearGradient(0, 260, 0, FIELD.height + 40);
  grad.addColorStop(0, '#6f9856');
  grad.addColorStop(0.26, '#577f4b');
  grad.addColorStop(0.6, '#3d6042');
  grad.addColorStop(1, '#243d33');
  terrainPath(ctx, state);
  ctx.lineTo(FIELD.width + 24, FIELD.height + 40);
  ctx.lineTo(-24, FIELD.height + 40);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Dark top edge then a bright grass lip, so the ridge reads at a glance.
  terrainPath(ctx, state);
  ctx.strokeStyle = '#2e4a37';
  ctx.lineWidth = 13;
  ctx.stroke();
  terrainPath(ctx, state);
  ctx.strokeStyle = '#7fa85f';
  ctx.lineWidth = 4;
  ctx.stroke();
  terrainPath(ctx, state, 3);
  ctx.strokeStyle = '#a6c77b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawRiver(ctx, state);
  drawFields(ctx, state);
  drawRoads(ctx, state);
  drawTown(ctx, state);
  drawTrees(ctx, state);
  drawRunways(ctx, state);
}

function drawFields(ctx, state) {
  const cam = state.camera;
  const island = state.island;
  const tones = island.features.tones;
  for (const field of island.features.fields) {
    const sx = screenXFor(field.x, cam.x);
    if (sx < -500 || sx > FIELD.width + 500) continue;
    const tone = tones[field.tone];
    const steps = 5;
    const top = [];
    const bottom = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const wx = field.x + (t - 0.5) * field.width;
      const px = screenXFor(wx, cam.x);
      const gy = altY(island.heightAt(wx), cam.alt);
      top.push([px, gy - 3 + field.tilt * 2]);
      bottom.push([px, gy + 34 + field.tilt * 6 + Math.sin(i * 1.3) * 3]);
    }
    ctx.beginPath();
    top.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    for (let i = bottom.length - 1; i >= 0; i -= 1) ctx.lineTo(bottom[i][0], bottom[i][1]);
    ctx.closePath();
    ctx.fillStyle = tone.body;
    ctx.fill();
    ctx.strokeStyle = tone.edge;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.strokeStyle = tone.furrow;
    ctx.lineWidth = 1.2;
    for (let i = 1; i < steps; i += 1) {
      const a = top[i];
      const b = bottom[i];
      path(ctx, a[0], a[1] + 2, b[0], b[1] - 8);
    }
  }
}

function drawRiver(ctx, state) {
  const cam = state.camera;
  const island = state.island;
  const sx = screenXFor(island.riverX, cam.x);
  if (sx < -400 || sx > FIELD.width + 400) return;
  const points = [];
  for (let i = -6; i <= 6; i += 1) {
    const wx = island.riverX + i * 15;
    const gy = altY(island.heightAt(wx), cam.alt);
    points.push([screenXFor(wx, cam.x), gy]);
  }
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y + 3) : ctx.lineTo(x, y + 3)));
  for (let i = points.length - 1; i >= 0; i -= 1) ctx.lineTo(points[i][0], points[i][1] + 17);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, points[0][1], 0, points[0][1] + 30);
  grad.addColorStop(0, '#7fc6d9');
  grad.addColorStop(1, '#2f7085');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(232, 250, 252, 0.55)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i += 1) {
    const px = points[2 + (i % 8)][0] + Math.sin(i * 2.7) * 20;
    const py = points[2 + (i % 8)][1] + 8 + (i % 3) * 3;
    path(ctx, px, py, px + 12, py);
  }
}

function drawRoads(ctx, state) {
  const cam = state.camera;
  const island = state.island;
  for (const road of island.features.roads) {
    if (road.x1 < cam.x - 900 || road.x0 > cam.x + 1600) continue;
    const from = Math.max(road.x0, cam.x - 900);
    const to = Math.min(road.x1, cam.x + 1600);
    if (to <= from) continue;
    const pts = [];
    for (let wx = from; wx <= to; wx += 26) {
      pts.push([screenXFor(wx, cam.x), altY(island.heightAt(wx), cam.alt) - 1]);
    }
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.strokeStyle = '#5a4c3a';
    ctx.lineWidth = 11;
    ctx.stroke();
    ctx.strokeStyle = '#bba77f';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([9, 13]);
    ctx.strokeStyle = 'rgba(248, 242, 222, 0.6)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }
}

function drawTown(ctx, state) {
  const cam = state.camera;
  const island = state.island;
  for (const house of island.features.houses) {
    const sx = screenXFor(house.x, cam.x);
    if (sx < -80 || sx > FIELD.width + 80) continue;
    const gy = altY(island.heightAt(house.x), cam.alt) - 2;
    const w = house.width;
    const h = house.height;
    ctx.fillStyle = 'rgba(10, 24, 24, 0.25)';
    ctx.fillRect(sx + 3, gy - 2, w, 4);
    ctx.fillStyle = house.wall;
    ctx.fillRect(sx - w / 2, gy - h, w, h);
    ctx.fillStyle = 'rgba(120, 98, 72, 0.28)';
    ctx.fillRect(sx - w / 2, gy - h * 0.35, w, h * 0.35);
    ctx.fillStyle = house.roof;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 - 4, gy - h);
    ctx.lineTo(sx, gy - h - h * 0.55);
    ctx.lineTo(sx + w / 2 + 4, gy - h);
    ctx.closePath();
    ctx.fill();
    if (house.chimney) {
      ctx.fillStyle = '#7b5a48';
      ctx.fillRect(sx + w * 0.2, gy - h - 13, 4, 12);
    }
    ctx.fillStyle = house.lit ? '#ffd783' : '#6d7a74';
    ctx.fillRect(sx - w * 0.26, gy - h * 0.68, 5, 6);
    ctx.fillRect(sx + w * 0.08, gy - h * 0.68, 5, 6);
    ctx.fillStyle = '#604b3b';
    ctx.fillRect(sx - 3, gy - 9, 6, 9);
  }

  // The church tower gives the town a spire to find from the air.
  const wx = island.townX + 150;
  const sx = screenXFor(wx, cam.x);
  if (sx > -80 && sx < FIELD.width + 80) {
    const gy = altY(island.heightAt(wx), cam.alt) - 2;
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(sx - 9, gy - 64, 18, 64);
    ctx.fillStyle = '#7d5847';
    ctx.beginPath();
    ctx.moveTo(sx - 13, gy - 64);
    ctx.lineTo(sx, gy - 90);
    ctx.lineTo(sx + 13, gy - 64);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6d7a74';
    ctx.fillRect(sx - 3, gy - 54, 6, 8);
    ctx.strokeStyle = '#d8c9a8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, gy - 90);
    ctx.lineTo(sx, gy - 100);
    ctx.stroke();
  }
}

function drawTree(ctx, x, ground, size, kind, tint) {
  const h = 30 * size;
  ctx.fillStyle = '#4d3a29';
  ctx.fillRect(x - 1.5, ground - h * 0.42, 3, h * 0.42);
  if (kind === 0) {
    for (let layer = 0; layer < 3; layer += 1) {
      const ly = ground - h * 0.34 - layer * h * 0.2;
      const lw = (12 - layer * 2.4) * size;
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.moveTo(x, ly - h * 0.42);
      ctx.lineTo(x - lw, ly + h * 0.16);
      ctx.lineTo(x + lw, ly + h * 0.16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(x, ground - h * 0.76);
    ctx.lineTo(x - 5 * size, ground - h * 0.46);
    ctx.lineTo(x, ground - h * 0.46);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(x - 5 * size, ground - h * 0.56, 8 * size, 0, Math.PI * 2);
    ctx.arc(x + 6 * size, ground - h * 0.6, 9 * size, 0, Math.PI * 2);
    ctx.arc(x, ground - h * 0.76, 10 * size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(x - 3 * size, ground - h * 0.8, 5 * size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrees(ctx, state) {
  const cam = state.camera;
  const island = state.island;
  for (const tree of island.features.trees) {
    const sx = screenXFor(tree.x, cam.x);
    if (sx < -40 || sx > FIELD.width + 40) continue;
    drawTree(ctx, sx, altY(island.heightAt(tree.x), cam.alt) + 1, tree.size, tree.kind, island.features.treeTints[tree.tint]);
  }
}

function drawRunways(ctx, state) {
  const cam = state.camera;
  const island = state.island;
  const L = island.length;
  const startK = Math.floor((cam.x - 2200) / L);
  for (let k = startK; k <= startK + 3; k += 1) {
    const centre = k * L;
    if (Math.abs(centre - cam.x) > 2600) continue;
    drawAirfield(ctx, state, centre);
  }
}

function drawAirfield(ctx, state, centre) {
  const cam = state.camera;
  const island = state.island;
  const y = altY(island.runwayAlt, cam.alt);
  const x0 = VIEW.anchorX + (centre - island.runwayHalf - cam.x);
  const x1 = VIEW.anchorX + (centre + island.runwayHalf - cam.x);
  if (x1 < -160 || x0 > FIELD.width + 160) return;

  // Mown apron under the tarmac.
  ctx.fillStyle = '#6c9555';
  ctx.fillRect(x0 - 42, y - 20, x1 - x0 + 84, 40);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(x0 - 42, y - 20, x1 - x0 + 84, 3);

  // The strip itself, drawn with a shallow perspective so it reads as a runway from the side.
  ctx.beginPath();
  ctx.moveTo(x0, y - 18);
  ctx.lineTo(x1, y - 18);
  ctx.lineTo(x1, y + 9);
  ctx.lineTo(x0, y + 9);
  ctx.closePath();
  const tarmac = ctx.createLinearGradient(0, y - 18, 0, y + 9);
  tarmac.addColorStop(0, '#464e56');
  tarmac.addColorStop(0.65, '#343a41');
  tarmac.addColorStop(1, '#2b3037');
  ctx.fillStyle = tarmac;
  ctx.fill();
  ctx.strokeStyle = '#252a30';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = 'rgba(242, 240, 220, 0.85)';
  ctx.fillRect(x0 + 4, y - 17, x1 - x0 - 8, 2);
  ctx.fillRect(x0 + 4, y + 6, x1 - x0 - 8, 2);

  // Centreline dashes.
  ctx.fillStyle = 'rgba(245, 240, 214, 0.72)';
  const midY = y - 8;
  for (let x = x0 + 22; x < x1 - 22; x += 54) ctx.fillRect(x, midY, 26, 2.2);

  // Threshold bars at both ends.
  ctx.fillStyle = 'rgba(245, 240, 214, 0.85)';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillRect(x0 + 12 + i * 9, y - 15, 4, 13);
    ctx.fillRect(x1 - 16 - i * 9, y - 15, 4, 13);
  }
  // Touchdown zone marks.
  for (const side of [-1, 1]) {
    const bx = side < 0 ? x0 + (x1 - x0) * 0.2 : x1 - (x1 - x0) * 0.24;
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(bx + i * 12, y - 15, 6, 4);
      ctx.fillRect(bx + i * 12, y - 8, 6, 4);
    }
  }

  // Runway numbers, painted on the tarmac.
  label(ctx, '27', x0 + 44, y - 4, 16, 'rgba(248, 244, 224, 0.72)', 'center');
  label(ctx, '09', x1 - 44, y - 4, 16, 'rgba(248, 244, 224, 0.72)', 'center');

  drawAirfieldProps(ctx, state, centre, x0, x1, y);

  // Approach lights: three green lamps on short poles at each threshold.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const px = (side < 0 ? x0 : x1) + side * (26 + i * 26);
      const py = y + 2;
      ctx.strokeStyle = '#59636a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - 12);
      ctx.stroke();
      ctx.fillStyle = i === 0 ? '#ffe07a' : '#8ef0a4';
      ctx.beginPath();
      ctx.arc(px, py - 14, 3, 0, Math.PI * 2);
      ctx.fill();
      const glow = ctx.createRadialGradient(px, py - 14, 1, px, py - 14, 12);
      glow.addColorStop(0, 'rgba(142, 240, 164, 0.4)');
      glow.addColorStop(1, 'rgba(142, 240, 164, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(px - 12, py - 26, 24, 24);
    }
  }
}

function drawAirfieldProps(ctx, state, centre, x0, x1, y) {
  const cam = state.camera;
  const island = state.island;
  const at = (worldX) => ({
    sx: VIEW.anchorX + (worldX - cam.x),
    gy: altY(island.heightAt(worldX), cam.alt),
  });

  // Hangar and tower sit just past the far threshold, on the grass beside the strip.
  const hangar = at(centre + 742);
  if (hangar.sx > -120 && hangar.sx < FIELD.width + 120) {
    const hx = hangar.sx;
    const hg = hangar.gy;
    ctx.fillStyle = 'rgba(10, 26, 22, 0.25)';
    ctx.beginPath();
    ctx.ellipse(hx, hg + 1, 48, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a8f8b';
    ctx.beginPath();
    ctx.moveTo(hx - 42, hg + 2);
    ctx.lineTo(hx - 42, hg - 24);
    ctx.quadraticCurveTo(hx, hg - 58, hx + 42, hg - 24);
    ctx.lineTo(hx + 42, hg + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5e6664';
    ctx.fillRect(hx - 4, hg - 24, 26, 26);
    ctx.strokeStyle = '#4b5451';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - 42, hg - 24);
    ctx.quadraticCurveTo(hx, hg - 58, hx + 42, hg - 24);
    ctx.stroke();
    ctx.fillStyle = '#d5d8c9';
    ctx.fillRect(hx - 20, hg - 34, 20, 5);
  }

  const tower = at(centre + 868);
  if (tower.sx > -80 && tower.sx < FIELD.width + 80) {
    const tx = tower.sx;
    const tg = tower.gy;
    ctx.fillStyle = '#9aa09a';
    ctx.fillRect(tx - 8, tg - 54, 16, 56);
    ctx.fillStyle = '#c6cbc1';
    ctx.fillRect(tx - 16, tg - 68, 32, 16);
    ctx.fillStyle = '#5a96a4';
    ctx.fillRect(tx - 12, tg - 64, 24, 8);
    ctx.strokeStyle = '#7d847e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, tg - 68);
    ctx.lineTo(tx, tg - 84);
    ctx.stroke();
    ctx.fillStyle = '#ff6b5e';
    ctx.beginPath();
    ctx.arc(tx, tg - 86, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // A windsock by the threshold, pointing down the runway.
  const sock = at(centre + 664);
  if (sock.sx > -20 && sock.sx < FIELD.width + 20) {
    const wx = sock.sx;
    const gy = sock.gy;
    ctx.strokeStyle = '#c7c9c0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx, gy);
    ctx.lineTo(wx, gy - 34);
    ctx.stroke();
    const wave = Math.sin(state.visualTime * 3.4) * 3;
    ctx.fillStyle = '#ee8d4b';
    ctx.beginPath();
    ctx.moveTo(wx, gy - 34);
    ctx.lineTo(wx + 26, gy - 31 + wave);
    ctx.lineTo(wx + 24, gy - 22 + wave);
    ctx.lineTo(wx, gy - 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5f2e8';
    ctx.beginPath();
    ctx.moveTo(wx + 13, gy - 32 + wave * 0.5);
    ctx.lineTo(wx + 26, gy - 31 + wave);
    ctx.lineTo(wx + 24, gy - 22 + wave);
    ctx.lineTo(wx + 13, gy - 23 + wave * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  // A second sock on the near side, for depth.
  const sock2 = at(centre - 690);
  if (sock2.sx > -20 && sock2.sx < FIELD.width + 20) {
    const wx = sock2.sx;
    const gy = sock2.gy;
    ctx.strokeStyle = '#c7c9c0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx, gy);
    ctx.lineTo(wx, gy - 26);
    ctx.stroke();
    const wave = Math.sin(state.visualTime * 3 + 1.4) * 2;
    ctx.fillStyle = '#e07f42';
    ctx.beginPath();
    ctx.moveTo(wx, gy - 26);
    ctx.lineTo(wx + 18, gy - 24 + wave);
    ctx.lineTo(wx + 17, gy - 18 + wave);
    ctx.lineTo(wx, gy - 19);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRings(ctx, state) {
  const cam = state.camera;
  const mission = state.mission;
  for (let i = 0; i < mission.rings.length; i += 1) {
    const ring = mission.rings[i];
    const dx = wrapSigned(ring.x - cam.x);
    if (dx < -260 || dx > 1750) continue;
    const sx = VIEW.anchorX + dx;
    const sy = altY(ring.alt, cam.alt) - 26;
    const r = ring.radius;
    const active = i === mission.active && (mission.stage === STAGE.RINGS || mission.stage === STAGE.TAKEOFF);
    const passed = ring.state === 'passed';
    const missed = ring.state === 'missed';
    const pulse = 0.5 + 0.5 * Math.sin(state.visualTime * 2.6 + ring.pulse);

    if (active) {
      const glow = ctx.createRadialGradient(sx, sy, r * 0.3, sx, sy, r * 2.1);
      glow.addColorStop(0, `rgba(255, 201, 120, ${0.16 + pulse * 0.1})`);
      glow.addColorStop(0.55, 'rgba(255, 170, 80, 0.1)');
      glow.addColorStop(1, 'rgba(255, 170, 80, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - r * 2.2, sy - r * 2.2, r * 4.4, r * 4.4);
    }

    ctx.save();
    ctx.translate(sx, sy);
    const tint = passed ? '#7fe7d4' : missed ? '#ff6b5e' : active ? '#ffc978' : '#78c9d8';
    const alpha = passed ? 0.4 : missed ? 0.42 : active ? 1 : 0.58;
    ctx.globalAlpha = alpha;

    ctx.strokeStyle = tint;
    ctx.lineWidth = active ? 11 : 8;
    ctx.globalAlpha = alpha * 0.16;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.lineWidth = active ? 6 : 5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(255, 255, 240, 0.8)';
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, -1.1, 0.5);
    ctx.stroke();

    if (active) {
      ctx.save();
      ctx.rotate(state.visualTime * 0.9);
      ctx.setLineDash([10, 16]);
      ctx.strokeStyle = 'rgba(255, 217, 150, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      for (let tick = 0; tick < 8; tick += 1) {
        const a = (tick / 8) * Math.PI * 2 + state.visualTime * 0.35;
        ctx.fillStyle = '#ffe0a4';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5), 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (passed) {
      ctx.strokeStyle = 'rgba(127, 231, 212, 0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.32, 0);
      ctx.lineTo(-r * 0.06, r * 0.26);
      ctx.lineTo(r * 0.4, -r * 0.26);
      ctx.stroke();
    }
    if (missed) {
      ctx.strokeStyle = 'rgba(255, 107, 94, 0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.24, -r * 0.24);
      ctx.lineTo(r * 0.24, r * 0.24);
      ctx.moveTo(r * 0.24, -r * 0.24);
      ctx.lineTo(-r * 0.24, r * 0.24);
      ctx.stroke();
    }
    ctx.restore();

    const distance = Math.abs(dx);
    const tag = active ? `GATE ${i + 1}   ${(distance / 1000).toFixed(1)} KM` : passed ? 'CLEAR' : missed ? 'MISSED' : '';
    if (tag) {
      label(ctx, tag, sx, sy - r - 20, active ? 13 : 10, active ? PALETTE.amber : passed ? PALETTE.teal : PALETTE.red, 'center');
    }
  }
}

function drawRunwayTarget(ctx, state) {
  const mission = state.mission;
  if (mission.stage !== STAGE.LANDING) return;
  const cam = state.camera;
  const island = state.island;
  const L = island.length;
  const nextCentre = Math.ceil((cam.x + 1) / L) * L;
  const dx = nextCentre - cam.x;
  if (dx < -200 || dx > 2400) return;
  const sx = VIEW.anchorX + dx;
  const y = altY(island.runwayAlt, cam.alt) - 60;
  const pulse = 0.5 + 0.5 * Math.sin(state.visualTime * 3);
  ctx.save();
  ctx.globalAlpha = 0.45 + pulse * 0.5;
  ctx.fillStyle = PALETTE.green;
  for (let i = 0; i < 3; i += 1) {
    const px = sx + i * 22;
    ctx.beginPath();
    ctx.moveTo(px, y - 8);
    ctx.lineTo(px + 12, y);
    ctx.lineTo(px, y + 8);
    ctx.closePath();
    ctx.fill();
  }
  label(ctx, 'STRIP', sx + 34, y + 5, 12, PALETTE.green);
  ctx.restore();
}

function drawContrail(ctx, plane, sx, sy) {
  if (!plane.engineOn || plane.speed < 24) return;
  ctx.save();
  for (let i = 0; i < 5; i += 1) {
    const age = i * 0.16;
    const px = sx - 66 - i * 16 - age * 10;
    const py = sy + 1 + Math.sin(plane.prop * 0.4 + i) * 2;
    const rad = 3 + i * 2.2;
    ctx.fillStyle = `rgba(235, 240, 235, ${0.13 - i * 0.02})`;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAircraft(ctx, state) {
  const plane = state.plane;
  const cam = state.camera;
  const sx = VIEW.anchorX;
  const sy = altY(plane.alt, cam.alt) - 28;
  const time = state.visualTime;
  const bank = plane.bank;

  // Shadow: a soft oval in the air, two small contact patches on the wheels.
  const groundAlt = state.island.heightAt(plane.x);
  const gap = plane.alt - groundAlt;
  if (plane.onGround) {
    ctx.fillStyle = 'rgba(12, 26, 22, 0.42)';
    ctx.beginPath();
    ctx.ellipse(sx - 2, sy + 33, 10, 3.2, 0, 0, Math.PI * 2);
    ctx.ellipse(sx + 21, sy + 32, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (gap < 260) {
    const gy = altY(groundAlt, cam.alt) + 1;
    const fade = clamp(1 - gap / 260, 0, 1);
    ctx.fillStyle = `rgba(15, 35, 28, ${0.26 * fade})`;
    ctx.beginPath();
    ctx.ellipse(sx + 6, gy, 52 + gap * 0.18, 8 + gap * 0.02, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawContrail(ctx, plane, sx, sy);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-plane.pitch * 0.85 + bank * 0.07);

  // Far wing — swept away and up, lifted further by a left bank.
  ctx.beginPath();
  ctx.moveTo(6, -12);
  ctx.quadraticCurveTo(-26, -26 - bank * 8, -60, -40 - bank * 18);
  ctx.quadraticCurveTo(-66, -34 - bank * 18, -58, -30 - bank * 16);
  ctx.quadraticCurveTo(-26, -14, -4, -6);
  ctx.closePath();
  ctx.fillStyle = PALETTE.wingDeep;
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 48, 42, 0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = PALETTE.bodyRed;
  ctx.beginPath();
  ctx.moveTo(-56, -36 - bank * 17);
  ctx.lineTo(-62, -39 - bank * 18);
  ctx.lineTo(-66, -34 - bank * 18);
  ctx.lineTo(-59, -30 - bank * 16);
  ctx.closePath();
  ctx.fill();
  // Port navigation light.
  const port = time % 1.4 < 0.2;
  ctx.fillStyle = port ? '#ff9a8c' : '#9a3a32';
  ctx.beginPath();
  ctx.arc(-62, -36 - bank * 18, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (port) {
    ctx.fillStyle = 'rgba(255, 120, 100, 0.25)';
    ctx.beginPath();
    ctx.arc(-62, -36 - bank * 18, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Far tailplane.
  ctx.fillStyle = PALETTE.wingDeep;
  ctx.beginPath();
  ctx.ellipse(-55, -8 - bank * 6, 17, 3.6, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // Fuselage.
  ctx.beginPath();
  ctx.moveTo(-67, -3);
  ctx.bezierCurveTo(-58, -13, -38, -16, -12, -15);
  ctx.bezierCurveTo(12, -14, 35, -12, 48, -7);
  ctx.bezierCurveTo(58, -4, 60, 2, 52, 7);
  ctx.bezierCurveTo(34, 13, 4, 14, -24, 11);
  ctx.bezierCurveTo(-46, 9, -60, 6, -67, -3);
  ctx.closePath();
  ctx.fillStyle = PALETTE.cream;
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 48, 34, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Shaded belly and a faint panel line behind the cowling.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-67, -3);
  ctx.bezierCurveTo(-58, -13, -38, -16, -12, -15);
  ctx.bezierCurveTo(12, -14, 35, -12, 48, -7);
  ctx.bezierCurveTo(58, -4, 60, 2, 52, 7);
  ctx.bezierCurveTo(34, 13, 4, 14, -24, 11);
  ctx.bezierCurveTo(-46, 9, -60, 6, -67, -3);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = 'rgba(183, 150, 99, 0.33)';
  ctx.fillRect(-70, 3, 134, 20);
  ctx.strokeStyle = 'rgba(90, 70, 50, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(34, -12);
  ctx.lineTo(33, 12);
  ctx.stroke();
  ctx.restore();

  // Cheatline and tail code.
  ctx.strokeStyle = PALETTE.bodyRed;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-58, 2);
  ctx.quadraticCurveTo(0, 8, 44, 2);
  ctx.stroke();
  label(ctx, 'DP-7', -38, -1, 7, 'rgba(143, 52, 40, 0.85)', 'left');

  // Tail fin with a rudder hinge.
  ctx.fillStyle = PALETTE.bodyRed;
  ctx.beginPath();
  ctx.moveTo(-66, -2);
  ctx.lineTo(-61, -37);
  ctx.lineTo(-48, -33);
  ctx.lineTo(-38, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f3e7c9';
  ctx.beginPath();
  ctx.moveTo(-60, -17);
  ctx.lineTo(-57, -28);
  ctx.lineTo(-51, -30);
  ctx.lineTo(-48, -17);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 50, 40, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-54, -31);
  ctx.lineTo(-49, -6);
  ctx.stroke();

  // Horizontal stabiliser: a clear little wing across the tail root.
  ctx.beginPath();
  ctx.moveTo(-74, -4 + bank * 4);
  ctx.quadraticCurveTo(-58, -8 + bank * 4, -36, -3 + bank * 4);
  ctx.quadraticCurveTo(-38, 1 + bank * 4, -44, 3 + bank * 4);
  ctx.quadraticCurveTo(-60, 1 + bank * 4, -74, 1 + bank * 4);
  ctx.closePath();
  ctx.fillStyle = PALETTE.wing;
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 48, 34, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60, 48, 34, 0.3)';
  ctx.beginPath();
  ctx.moveTo(-48, -5 + bank * 4);
  ctx.lineTo(-46, 2 + bank * 4);
  ctx.stroke();

  // Wing-root fairing ties the wing into the cabin roof.
  ctx.fillStyle = '#e6d8b6';
  ctx.beginPath();
  ctx.moveTo(-15, -16);
  ctx.lineTo(9, -13);
  ctx.lineTo(8, -9);
  ctx.lineTo(-17, -12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 48, 34, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Near wing: a shallow dihedral sweeping back from the wing root, so the two wings read
  // as one high wing seen slightly from the side rather than a second cross-plane.
  ctx.beginPath();
  ctx.moveTo(-4, -16);
  ctx.quadraticCurveTo(22, -13, 50, 2 + bank * 15);
  ctx.quadraticCurveTo(55, 7 + bank * 15, 45, 10 + bank * 15);
  ctx.quadraticCurveTo(20, -3, -10, -7);
  ctx.closePath();
  ctx.fillStyle = PALETTE.wing;
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 48, 34, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = PALETTE.bodyRed;
  ctx.beginPath();
  ctx.moveTo(49, 1 + bank * 15);
  ctx.lineTo(55, 6 + bank * 15);
  ctx.lineTo(45, 10 + bank * 15);
  ctx.lineTo(42, 5 + bank * 15);
  ctx.closePath();
  ctx.fill();
  // Aileron hinge on the near wing.
  ctx.strokeStyle = 'rgba(60, 48, 34, 0.3)';
  ctx.beginPath();
  ctx.moveTo(31, -2 + bank * 8);
  ctx.lineTo(38, 2 + bank * 10);
  ctx.stroke();
  // Starboard light at the near wingtip.
  const starboard = time % 1.4 > 0.7 && time % 1.4 < 0.9;
  ctx.fillStyle = starboard ? '#a8ffb4' : '#3f7a4d';
  ctx.beginPath();
  ctx.arc(51, 5 + bank * 15, 3, 0, Math.PI * 2);
  ctx.fill();
  if (starboard) {
    ctx.fillStyle = 'rgba(140, 255, 160, 0.22)';
    ctx.beginPath();
    ctx.arc(51, 5 + bank * 15, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // A pair of struts from the wing roots to the belly.
  ctx.strokeStyle = '#9a8a68';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-31, -18 - bank * 8);
  ctx.lineTo(-19, 8);
  ctx.moveTo(20, -8 + bank * 8);
  ctx.lineTo(12, 8);
  ctx.stroke();

  // Cockpit glass.
  ctx.fillStyle = '#2e5b6a';
  ctx.beginPath();
  ctx.ellipse(-1, -13, 17, 7, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(170, 231, 236, 0.42)';
  ctx.beginPath();
  ctx.ellipse(-6, -15, 9, 2.6, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8b9a8f';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(-1, -13, 17, 7, -0.05, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1, -20);
  ctx.lineTo(1, -6);
  ctx.stroke();

  // Engine cowling, grille and exhaust.
  ctx.fillStyle = PALETTE.bodyRed;
  ctx.beginPath();
  ctx.moveTo(36, -10);
  ctx.quadraticCurveTo(54, -9, 55, 1);
  ctx.quadraticCurveTo(54, 10, 38, 11);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(80, 30, 24, 0.6)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(40, -6 + i * 5);
    ctx.lineTo(50, -6 + i * 5);
    ctx.stroke();
  }
  if (plane.engineOn) {
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = `rgba(60, 60, 60, ${0.16 - i * 0.04})`;
      ctx.beginPath();
      ctx.arc(42 - i * 10 - (time * 30) % 10, 10 + i * 2, 3 + i, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Main gear: struts, wheel pants and tyres.
  ctx.strokeStyle = '#6d7268';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(2, 8);
  ctx.lineTo(-2, 25);
  ctx.moveTo(20, 8);
  ctx.lineTo(21, 24);
  ctx.stroke();
  ctx.fillStyle = '#d9c9a4';
  ctx.beginPath();
  ctx.moveTo(-6, 18);
  ctx.lineTo(2, 18);
  ctx.lineTo(3, 23);
  ctx.lineTo(-7, 23);
  ctx.closePath();
  ctx.moveTo(17, 18);
  ctx.lineTo(25, 18);
  ctx.lineTo(26, 23);
  ctx.lineTo(16, 23);
  ctx.closePath();
  ctx.fill();
  for (const [wx, wy] of [[-2, 26], [21, 25]]) {
    ctx.fillStyle = PALETTE.cream;
    ctx.beginPath();
    ctx.ellipse(wx, wy - 2, 8.6, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.tyre;
    ctx.beginPath();
    ctx.arc(wx, wy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7e8a8f';
    ctx.beginPath();
    ctx.arc(wx, wy, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(wx - 1.6, wy - 1.6, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Tail wheel.
  ctx.strokeStyle = '#6d7268';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-57, 6);
  ctx.lineTo(-58, 12);
  ctx.stroke();
  ctx.fillStyle = PALETTE.tyre;
  ctx.beginPath();
  ctx.arc(-58, 14, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Propeller: a visible disc, four blurred blades and a spinner.
  ctx.save();
  ctx.translate(57, 1);
  if (plane.engineOn) {
    const disc = ctx.createRadialGradient(0, 0, 2, 0, 0, 31);
    disc.addColorStop(0, 'rgba(232, 236, 228, 0.3)');
    disc.addColorStop(0.72, 'rgba(216, 224, 218, 0.12)');
    disc.addColorStop(1, 'rgba(210, 218, 214, 0)');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 31, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i += 1) {
      const a = plane.prop * 1.4 + (i / 4) * Math.PI * 2;
      ctx.strokeStyle = `rgba(46, 54, 54, ${0.24 + 0.2 * Math.abs(Math.sin(a))})`;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 29);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(240, 245, 238, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 29, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#464e4d';
    ctx.save();
    ctx.rotate(0.5);
    ctx.fillRect(-2, -29, 4, 29);
    ctx.rotate(2.1);
    ctx.fillRect(-2, -29, 4, 29);
    ctx.restore();
  }
  ctx.fillStyle = PALETTE.bodyDeep;
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Tail strobe.
  const strobe = time % 1.8 < 0.12;
  ctx.fillStyle = strobe ? '#ffffff' : 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath();
  ctx.arc(-61, -35, 2.6, 0, Math.PI * 2);
  ctx.fill();
  if (strobe) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.arc(-61, -35, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = time % 1.1 < 0.3 ? '#ff8b7d' : '#a4443a';
  ctx.beginPath();
  ctx.arc(-64, -6, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawEffects(ctx, state) {
  const cam = state.camera;
  for (const fx of state.effects) {
    const age = state.visualTime - fx.born;
    if (age < 0) continue;
    const sx = VIEW.anchorX + wrapSigned(fx.x - cam.x);
    if (fx.kind === 'spark') {
      if (age > 0.8) continue;
      const sy = altY(fx.alt, cam.alt) - 26;
      ctx.fillStyle = `rgba(255, 214, 140, ${0.9 * (1 - age / 0.8)})`;
      for (let i = 0; i < 4; i += 1) {
        const a = i * 1.7 + fx.size;
        const rr = 10 + age * 90;
        ctx.beginPath();
        ctx.arc(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    if (age > 3.2) continue;
    const sy = altY(fx.alt, cam.alt) - age * (fx.kind === 'smoke' ? 34 : 10);
    const drift = fx.drift * age;
    if (fx.kind === 'smoke') {
      const alpha = Math.max(0, 0.5 - age * 0.15);
      ctx.fillStyle = `rgba(46, 48, 50, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx + drift, sy, fx.size + age * 12, 0, Math.PI * 2);
      ctx.fill();
      if (age < 0.6) {
        ctx.fillStyle = `rgba(255, 146, 70, ${0.5 - age * 0.7})`;
        ctx.beginPath();
        ctx.arc(sx, altY(fx.alt, cam.alt) - 26, 12 + age * 20, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (fx.kind === 'dust') {
      const alpha = Math.max(0, 0.4 - age * 0.3);
      ctx.fillStyle = `rgba(205, 188, 148, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx + drift, sy, fx.size + age * 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawOffscreenCue(ctx, state) {
  const mission = state.mission;
  if (mission.stage !== STAGE.RINGS || mission.active >= mission.rings.length) return;
  const ring = mission.rings[mission.active];
  const dx = ring.x - state.camera.x;
  if (dx < 1200) return;
  const y = 300;
  const pulse = 0.6 + 0.4 * Math.sin(state.visualTime * 4);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.amber;
  ctx.beginPath();
  ctx.moveTo(FIELD.width - 64, y);
  ctx.lineTo(FIELD.width - 84, y - 12);
  ctx.lineTo(FIELD.width - 84, y + 12);
  ctx.closePath();
  ctx.fill();
  label(ctx, `${(dx / 1000).toFixed(1)} KM`, FIELD.width - 92, y + 5, 13, PALETTE.amber, 'right');
  label(ctx, `GATE ${mission.active + 1}`, FIELD.width - 92, y - 12, 11, PALETTE.dim, 'right');
  ctx.restore();
}

function drawVignette(ctx) {
  const top = ctx.createLinearGradient(0, 0, 0, 150);
  top.addColorStop(0, 'rgba(4, 10, 15, 0.38)');
  top.addColorStop(1, 'rgba(4, 10, 15, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, FIELD.width, 150);
  const bottom = ctx.createLinearGradient(0, FIELD.height - 230, 0, FIELD.height);
  bottom.addColorStop(0, 'rgba(4, 10, 15, 0)');
  bottom.addColorStop(1, 'rgba(4, 10, 15, 0.45)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, FIELD.height - 230, FIELD.width, 230);
}

function keycap(ctx, x, y, w, text) {
  ctx.fillStyle = 'rgba(127, 231, 212, 0.14)';
  ctx.strokeStyle = 'rgba(127, 231, 212, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 22, 4);
  ctx.fill();
  ctx.stroke();
  label(ctx, text, x + w / 2, y + 15, 11, PALETTE.teal, 'center');
}

function drawTitle(ctx, state, best) {
  const pulse = 0.62 + 0.38 * Math.sin(state.visualTime * 2.2);
  ctx.save();
  ctx.fillStyle = 'rgba(5, 14, 20, 0.18)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  label(ctx, 'A SIDE-VIEW FLIGHT SORTIE', 64, 118, 12, PALETTE.amber);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 18;
  label(ctx, 'DAWN PATROL', 60, 190, 74, PALETTE.cream, 'left', FONT_UI);
  ctx.restore();
  label(ctx, 'ISLAND RUN', 66, 226, 24, PALETTE.amber);
  ctx.fillStyle = 'rgba(255, 201, 120, 0.7)';
  ctx.fillRect(66, 242, 318, 2);
  label(ctx, 'Lift off, thread five gates, land back on the strip.', 66, 270, 15, PALETTE.text);

  // Controls card.
  const cx = 64;
  const cy = 530;
  panel(ctx, cx, cy, 470, 194);
  label(ctx, 'CONTROLS', cx + 20, cy + 28, 11, PALETTE.amber);
  keycap(ctx, cx + 20, cy + 44, 46, 'W / S');
  label(ctx, 'throttle up / down', cx + 78, cy + 60, 13, PALETTE.text);
  keycap(ctx, cx + 20, cy + 76, 46, 'A / D');
  label(ctx, 'climb / dive', cx + 78, cy + 92, 13, PALETTE.text);
  keycap(ctx, cx + 20, cy + 108, 76, 'MOUSE');
  label(ctx, 'point where you want the nose', cx + 108, cy + 124, 13, PALETTE.text);
  keycap(ctx, cx + 20, cy + 140, 46, 'P');
  keycap(ctx, cx + 72, cy + 140, 46, 'M');
  label(ctx, 'pause / sound', cx + 130, cy + 156, 13, PALETTE.text);

  // Sortie brief.
  const bx = 690;
  panel(ctx, bx, cy, 526, 194);
  label(ctx, 'SORTIE BRIEF', bx + 20, cy + 28, 11, PALETTE.amber);
  label(ctx, '01  Take off from the strip at dawn.', bx + 20, cy + 58, 14, PALETTE.text);
  label(ctx, '02  Fly the five lit gates in order.', bx + 20, cy + 84, 14, PALETTE.text);
  label(ctx, '03  Turn back? No — the strip comes round again.', bx + 20, cy + 110, 14, PALETTE.text);
  label(ctx, '04  Land gently and keep fuel in hand.', bx + 20, cy + 136, 14, PALETTE.text);
  label(ctx, 'Fast gates, a quick lap and a greased landing all score.', bx + 20, cy + 168, 12, PALETTE.dim);

  ctx.globalAlpha = pulse;
  label(ctx, 'PRESS ENTER TO FLY', FIELD.width / 2, 768, 22, PALETTE.amber, 'center');
  ctx.globalAlpha = 1;
  if (best > 0) label(ctx, `BEST  ${comma(best)}`, FIELD.width - 64, 768, 13, PALETTE.dim, 'right');
  ctx.restore();
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(4, 11, 17, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  panel(ctx, 440, 316, 400, 168);
  label(ctx, 'PAUSED', FIELD.width / 2, 390, 42, PALETTE.text, 'center', FONT_UI);
  label(ctx, 'The island will wait.', FIELD.width / 2, 426, 14, PALETTE.dim, 'center');
  label(ctx, 'PRESS P TO RESUME', FIELD.width / 2, 462, 13, PALETTE.amber, 'center');
}

function drawCrash(ctx, state) {
  const mission = state.mission;
  const plane = state.plane;
  ctx.fillStyle = 'rgba(10, 6, 8, 0.58)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  panel(ctx, 318, 236, 644, 330);
  label(ctx, mission.failTitle || 'SORTIE FAILED', FIELD.width / 2, 306, 40, PALETTE.red, 'center', FONT_UI);
  const reason = mission.crashReason || 'The island is unforgiving.';
  wrapText(ctx, reason, FIELD.width / 2, 352, 560, 20, PALETTE.text, 'center');
  label(ctx, 'SCORE', FIELD.width / 2 - 62, 420, 11, PALETTE.dim, 'right');
  label(ctx, comma(mission.score), FIELD.width / 2 - 42, 422, 26, PALETTE.text);
  label(ctx, 'GATES', FIELD.width / 2 + 64, 420, 11, PALETTE.dim, 'right');
  label(ctx, `${mission.breakdown.ringCount} / ${mission.rings.length}`, FIELD.width / 2 + 84, 422, 26, PALETTE.teal);
  label(ctx, `AIRFRAME ${plane.crashed ? 'WRECKED' : 'INTACT'}`, FIELD.width / 2, 458, 12, PALETTE.dim, 'center');
  label(ctx, 'PRESS ENTER TO FLY AGAIN', FIELD.width / 2, 520, 16, PALETTE.amber, 'center');
}

function drawComplete(ctx, state, best) {
  const mission = state.mission;
  const b = mission.breakdown;
  ctx.fillStyle = 'rgba(4, 12, 16, 0.32)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  panel(ctx, 676, 168, 540, 486);

  label(ctx, 'MISSION COMPLETE', 712, 226, 30, PALETTE.green, 'left', FONT_UI);
  label(ctx, 'Clean landing at the strip', 712, 254, 13, PALETTE.dim);
  ctx.fillStyle = 'rgba(142, 224, 138, 0.4)';
  ctx.fillRect(712, 270, 468, 1.5);

  const rows = [
    ['Takeoff', b.takeoff],
    [`Gates  ${b.ringCount}/${mission.rings.length}`, b.rings],
    ['Time bonus', b.time],
    ['Landing', b.landing],
    ['Fuel remaining', b.fuel],
  ];
  let y = 304;
  for (const [name, value] of rows) {
    label(ctx, name, 712, y, 14, PALETTE.dim);
    label(ctx, `+${comma(value)}`, 1180, y, 16, PALETTE.text, 'right');
    y += 34;
  }

  ctx.fillStyle = 'rgba(127, 231, 212, 0.22)';
  ctx.fillRect(712, y - 8, 468, 1.5);
  label(ctx, 'TOTAL', 712, y + 32, 14, PALETTE.amber);
  label(ctx, comma(b.total), 1180, y + 42, 44, PALETTE.cream, 'right');
  label(ctx, best > 0 ? `BEST  ${comma(best)}` : '', 1180, y + 66, 11, PALETTE.dim, 'right');

  label(ctx, 'PRESS ENTER TO FLY AGAIN', 946, 628, 15, PALETTE.amber, 'center');
}

function wrapText(ctx, value, x, y, maxWidth, lineHeight, color, align = 'left') {
  const words = value.split(' ');
  let line = '';
  let py = y;
  ctx.font = `15px ${FONT_UI}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, py);
      line = word;
      py += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, py);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(window.innerWidth * ratio));
    const height = Math.max(1, Math.round(window.innerHeight * ratio));
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function draw(state, screen, options = {}) {
    const theme = themeAt(state.tod);
    const shake = state.shake;
    const jx = shake > 0 ? Math.sin(state.visualTime * 71) * shake * 9 : 0;
    const jy = shake > 0 ? Math.cos(state.visualTime * 57) * shake * 7 : 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05090f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x + jx * view.scale, view.y + jy * view.scale);

    drawSky(ctx, theme);
    drawStars(ctx, state.tod);
    drawSun(ctx, theme, state.tod);
    drawClouds(ctx, state, theme);
    drawRidges(ctx, state, theme);
    drawGround(ctx, state);
    drawRings(ctx, state);
    drawRunwayTarget(ctx, state);
    drawAircraft(ctx, state);
    drawEffects(ctx, state);
    drawOffscreenCue(ctx, state);
    drawVignette(ctx);

    if (screen === SCREEN.TITLE) {
      drawTitle(ctx, state, options.best ?? 0);
      return;
    }

    drawHud(ctx, state, { muted: options.muted });

    if (screen === SCREEN.PAUSED) drawPause(ctx);
    else if (screen === SCREEN.CRASH) drawCrash(ctx, state);
    else if (screen === SCREEN.COMPLETE) drawComplete(ctx, state, options.best ?? 0);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize };
}
