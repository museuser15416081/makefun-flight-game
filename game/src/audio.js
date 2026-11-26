// Every sound is synthesised on the spot with WebAudio — no files, no samples, no network.
// The engine hum follows the throttle and airspeed, the wind follows speed, and the one-shot
// cues (gate chime, touchdown thud, crash) are short envelopes over the same tiny graph.
// Nothing is created until the first click or key press, as browsers require.

let ctx = null;
let master = null;
let engineGain = null;
let engineLow = null;
let engineOsc = null;
let engineSub = null;
let windGain = null;
let noiseBuffer = null;
let muted = false;
let started = false;

function noise(ctxSeconds) {
  const length = Math.floor(ctxSeconds * ctx.sampleRate);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = last * 0.82 + white * 0.18;
    data[i] = last;
  }
  return buffer;
}

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(ctx.destination);

  noiseBuffer = noise(2);

  // Engine: a filtered saw with a square sub-octave, left running and steered by gain.
  engineLow = ctx.createBiquadFilter();
  engineLow.type = 'lowpass';
  engineLow.frequency.value = 460;
  engineLow.Q.value = 0.8;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 58;
  engineSub = ctx.createOscillator();
  engineSub.type = 'square';
  engineSub.frequency.value = 29;
  const subGain = ctx.createGain();
  subGain.gain.value = 0.25;
  engineOsc.connect(engineLow);
  engineSub.connect(subGain);
  subGain.connect(engineLow);
  engineLow.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();
  engineSub.start();

  // Wind: looping brown noise through a band-pass, gain from airspeed.
  const wind = ctx.createBufferSource();
  wind.buffer = noiseBuffer;
  wind.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 720;
  windFilter.Q.value = 0.4;
  windGain = ctx.createGain();
  windGain.gain.value = 0;
  wind.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(master);
  wind.start();

  started = true;
}

/** Steer the continuous sounds; call once per frame while a sortie is on screen. */
export function updateEngine(plane, active) {
  if (!started) return;
  const now = ctx.currentTime;
  const speed = plane.speed;
  const throttle = plane.throttle;
  const on = active && plane.engineOn && !plane.crashed;
  const tone = 44 + throttle * 74 + Math.min(46, speed * 0.22);
  engineOsc.frequency.setTargetAtTime(tone, now, 0.09);
  engineSub.frequency.setTargetAtTime(tone * 0.5, now, 0.09);
  engineLow.frequency.setTargetAtTime(380 + throttle * 950 + speed * 4, now, 0.12);
  engineGain.gain.setTargetAtTime(on ? 0.016 + throttle * 0.048 : 0, now, 0.12);
  const rush = active ? Math.min(1, Math.max(0, (speed - 28) / 105)) : 0;
  windGain.gain.setTargetAtTime(rush * 0.075, now, 0.18);
}

function blip(freq, delay, duration, type, volume) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export function chime(step) {
  const base = 620 + (step % 5) * 70;
  blip(base, 0, 0.22, 'sine', 0.16);
  blip(base * 1.5, 0.07, 0.28, 'sine', 0.1);
}

export function missBuzz() {
  blip(150, 0, 0.18, 'square', 0.07);
  blip(112, 0.1, 0.2, 'square', 0.05);
}

export function stallHorn() {
  blip(420, 0, 0.16, 'square', 0.08);
  blip(420, 0.22, 0.16, 'square', 0.08);
}

export function touchdown(strength) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(600 + strength * 500, t);
  const gain = ctx.createGain();
  const level = 0.14 + strength * 0.2;
  gain.gain.setValueAtTime(level, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(t);
  source.stop(t + 0.4);
  blip(78 - strength * 20, 0, 0.32, 'sine', 0.12 + strength * 0.12);
}

export function crash() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1600, t);
  filter.frequency.exponentialRampToValueAtTime(120, t + 1.1);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(t);
  source.stop(t + 1.25);
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.9);
  og.gain.setValueAtTime(0.16, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 1);
  osc.connect(og);
  og.connect(master);
  osc.start(t);
  osc.stop(t + 1.05);
}

export function fuelSputter() {
  blip(90, 0, 0.3, 'sawtooth', 0.1);
  blip(62, 0.18, 0.35, 'sawtooth', 0.08);
  blip(48, 0.4, 0.3, 'sawtooth', 0.05);
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.05);
  return muted;
}

export function isMuted() {
  return muted;
}
