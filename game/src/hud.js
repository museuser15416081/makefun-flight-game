// The instrument panel. Six readable instruments over the world: altitude and vertical speed,
// a moving heading ribbon, airspeed with the throttle lever, fuel, score and gates, and a small
// artificial horizon. Everything is drawn in one dark-glass style with lit figures.

import { FIELD, FONT, PALETTE } from './config.js';
import { headingOf } from './world.js';
import { missionText, progressText, STAGE } from './mission.js';

function text(ctx, value, x, y, size, color, align = 'left', font = FONT) {
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

function panel(ctx, x, y, w, h, cut = 12) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
  ctx.fillStyle = PALETTE.panel;
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function divider(ctx, x0, x1, y) {
  ctx.strokeStyle = 'rgba(158, 226, 214, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawAltitude(ctx, plane) {
  const x = 22;
  const y = 16;
  const w = 232;
  const h = 84;
  panel(ctx, x, y, w, h);
  text(ctx, 'ALTITUDE', x + 16, y + 28, 11, PALETTE.dim);
  text(ctx, comma(plane.alt * 3.281), x + 16, y + 68, 34, PALETTE.text);
  text(ctx, 'FT', x + w - 16, y + 68, 14, PALETTE.teal, 'right');
  const fpm = Math.round(plane.vs * 196.85);
  const trend = plane.onGround ? 'LEVEL' : fpm > 40 ? 'CLIMB' : fpm < -40 ? 'DESCENT' : 'LEVEL';
  text(ctx, 'VS', x + 16, y + 84 - 2, 11, PALETTE.dim);
  text(ctx, `${fpm >= 0 ? '+' : ''}${comma(fpm)} FPM`, x + 40, y + 84 - 2, 11, fpm < -1200 ? PALETTE.amber : PALETTE.dim);
  text(ctx, trend, x + w - 16, y + 84 - 2, 11, PALETTE.teal, 'right');
}

function drawSpeed(ctx, plane) {
  const x = FIELD.width - 254;
  const y = 16;
  const w = 232;
  const h = 84;
  panel(ctx, x, y, w, h);
  text(ctx, 'AIRSPEED', x + 16, y + 28, 11, PALETTE.dim);
  text(ctx, comma(plane.speed * 1.944), x + w - 52, y + 68, 34, PALETTE.text, 'right');
  text(ctx, 'KT', x + w - 16, y + 68, 14, PALETTE.teal, 'right');
  text(ctx, 'THR', x + 16, y + 82, 11, PALETTE.dim);
  const bx = x + 48;
  const by = y + 74;
  const bw = w - 64;
  const segments = 12;
  const gap = 3;
  const sw = (bw - gap * (segments - 1)) / segments;
  for (let i = 0; i < segments; i += 1) {
    const fill = (i + 1) / segments <= plane.throttle + 0.02;
    ctx.fillStyle = fill ? (plane.throttle > 0.85 ? PALETTE.amber : PALETTE.teal) : 'rgba(127, 231, 212, 0.14)';
    ctx.fillRect(bx + i * (sw + gap), by, sw, 8);
  }
  text(ctx, `${Math.round(plane.throttle * 100)}%`, x + w - 16, y + 82, 11, PALETTE.dim, 'right');
}

function drawCompass(ctx, plane) {
  const x = 274;
  const y = 16;
  const w = 730;
  const h = 84;
  panel(ctx, x, y, w, h);
  text(ctx, 'HEADING', x + 16, y + 26, 11, PALETTE.dim);
  const heading = headingOf(plane);
  text(ctx, `${String(Math.round(heading)).padStart(3, '0')}°`, x + w / 2, y + 52, 24, PALETTE.amber, 'center');

  const clipX = x + 20;
  const clipW = w - 40;
  const centre = x + w / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(clipX, y + 54, clipW, 40);
  ctx.clip();
  const pxPerDeg = 6.1;
  const from = Math.ceil((heading - 52) / 5) * 5;
  const to = heading + 52;
  for (let deg = from; deg <= to; deg += 5) {
    const px = centre + (deg - heading) * pxPerDeg;
    const wrapped = ((deg % 360) + 360) % 360;
    const major = wrapped % 30 === 0;
    ctx.strokeStyle = major ? 'rgba(234, 246, 243, 0.75)' : 'rgba(143, 176, 180, 0.45)';
    ctx.lineWidth = major ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(px, y + 58);
    ctx.lineTo(px, y + 58 + (major ? 13 : 7));
    ctx.stroke();
  }
  ctx.restore();

  const cardinals = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  for (let deg = from; deg <= to; deg += 10) {
    if (deg % 30 !== 0) continue;
    const px = centre + (deg - heading) * pxPerDeg;
    if (px < clipX + 8 || px > clipX + clipW - 8) continue;
    const wrapped = ((deg % 360) + 360) % 360;
    text(ctx, cardinals[wrapped] ?? String(wrapped).padStart(3, '0'), px, y + 88, 10, PALETTE.dim, 'center');
  }

  ctx.fillStyle = PALETTE.amber;
  ctx.beginPath();
  ctx.moveTo(centre, y + 77);
  ctx.lineTo(centre - 6, y + 68);
  ctx.lineTo(centre + 6, y + 68);
  ctx.closePath();
  ctx.fill();
}

function drawFuel(ctx, state) {
  const plane = state.plane;
  const mission = state.mission;
  const x = 22;
  const y = 616;
  const w = 310;
  const h = 162;
  panel(ctx, x, y, w, h);

  const pct = Math.max(0, Math.min(100, plane.fuel));
  const low = pct < 18;
  const caution = pct < 35;
  text(ctx, 'FUEL', x + 16, y + 26, 11, PALETTE.dim);
  text(ctx, `${Math.round(pct)}%`, x + w - 16, y + 26, 13, low ? PALETTE.red : caution ? PALETTE.amber : PALETTE.text, 'right');

  const bx = x + 16;
  const by = y + 36;
  const bw = w - 32;
  const segments = 20;
  const gap = 3;
  const sw = (bw - gap * (segments - 1)) / segments;
  const lit = Math.ceil((pct / 100) * segments);
  for (let i = 0; i < segments; i += 1) {
    const on = i < lit;
    ctx.fillStyle = on ? (low ? PALETTE.red : caution ? PALETTE.amber : PALETTE.green) : 'rgba(158, 226, 214, 0.12)';
    ctx.fillRect(bx + i * (sw + gap), by, sw, 12);
  }

  const burn = 0.05 + plane.throttle * 0.45;
  const range = plane.engineOn ? pct / burn : 0;
  text(ctx, `RANGE ${clock(range)}`, x + 16, y + 72, 11, PALETTE.dim);
  text(ctx, plane.engineOn ? 'MIX AUTO' : 'ENGINE STOP', x + w - 16, y + 72, 11, plane.engineOn ? PALETTE.dim : PALETTE.red, 'right');

  divider(ctx, x + 16, x + w - 16, y + 84);

  text(ctx, 'SCORE', x + 16, y + 108, 11, PALETTE.dim);
  text(ctx, comma(mission.score), x + w - 16, y + 110, 24, PALETTE.text, 'right');
  text(ctx, 'GATES', x + 16, y + 138, 11, PALETTE.dim);
  text(ctx, `${mission.breakdown.ringCount} / ${mission.rings.length}`, x + w - 16, y + 140, 17, PALETTE.teal, 'right');
}

function drawHorizon(ctx, plane) {
  const cx = 1168;
  const cy = 688;
  const r = 78;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.panel;
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.clip();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.bank * 0.85);
  const lift = plane.pitch * 120;
  ctx.translate(0, lift);
  ctx.fillStyle = '#2d6c8b';
  ctx.fillRect(-r * 2, -r * 2, r * 4, r * 2);
  ctx.fillStyle = '#6d5036';
  ctx.fillRect(-r * 2, 0, r * 4, r * 2);
  ctx.strokeStyle = 'rgba(240, 248, 245, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(240, 248, 245, 0.35)';
  for (let i = -3; i <= 3; i += 1) {
    if (i === 0) continue;
    const yy = -i * 16;
    const half = Math.abs(i) % 2 === 0 ? 20 : 12;
    ctx.beginPath();
    ctx.moveTo(-half, yy);
    ctx.lineTo(half, yy);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = PALETTE.amber;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(cx + 26, cy);
  ctx.stroke();
  ctx.fillStyle = PALETTE.amber;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(234, 246, 243, 0.35)';
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i += 1) {
    const a = (i * Math.PI) / 6 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
    ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
    ctx.stroke();
  }
  ctx.restore();

  text(ctx, 'ATT', cx, cy - r + 16, 10, PALETTE.dim, 'center');
}

function drawToasts(ctx, state) {
  const toast = state.toast;
  if (!toast) return;
  const age = state.visualTime - toast.born;
  if (age > 1.7) return;
  const fade = age < 0.15 ? age / 0.15 : age > 1.2 ? Math.max(0, 1 - (age - 1.2) / 0.5) : 1;
  ctx.save();
  ctx.globalAlpha = fade;
  text(ctx, toast.text, FIELD.width / 2, 190 - age * 12, toast.big ? 28 : 22, toast.color ?? PALETTE.amber, 'center');
  ctx.restore();
}

export function drawHud(ctx, state, options = {}) {
  const plane = state.plane;
  const mission = state.mission;
  drawAltitude(ctx, plane);
  drawSpeed(ctx, plane);
  drawCompass(ctx, plane);

  // Mission line under the instruments.
  ctx.fillStyle = 'rgba(8, 20, 28, 0.66)';
  ctx.fillRect(274, 106, 730, 32);
  text(ctx, progressText(mission), 288, 126, 11, PALETTE.teal);
  text(ctx, missionText(mission, plane), 990, 126, 11, PALETTE.text, 'right');

  drawFuel(ctx, state);
  drawHorizon(ctx, plane);
  drawToasts(ctx, state);

  const blink = Math.floor(state.visualTime * 3) % 2 === 0;
  if (mission.stage === STAGE.FAILED || mission.stage === STAGE.DONE) {
    // The end panels take over; only the live warning band is skipped.
  } else if (plane.stalled && blink) {
    text(ctx, 'STALL', FIELD.width / 2, 172, 30, PALETTE.red, 'center');
  } else if (!plane.engineOn) {
    text(ctx, 'ENGINE OUT', FIELD.width / 2, 172, 22, PALETTE.red, 'center');
  } else if (plane.fuel < 18 && blink) {
    text(ctx, 'LOW FUEL', FIELD.width / 2, 172, 22, PALETTE.amber, 'center');
  }

  if (options.muted) {
    text(ctx, 'MUTED', FIELD.width - 22, 118, 10, PALETTE.dim, 'right');
  }
}
