/* Angry Filmstars
 * A physics slingshot game. All graphics are drawn procedurally on canvas.
 * Physics: Matter.js 0.19 */
'use strict';
(() => {
const { Engine, Bodies, Body, Composite, Events, Sleeping } = Matter;

// ---------------------------------------------------------------- constants
const GROUND = 900;
const SLING = { x: 340, y: 742 };
const MAX_DRAG = 140;
const LAUNCH_K = 0.34;
const STEP = 1000 / 60;
const GRAV = 0.001 * STEP * STEP;
const AIR = 0.004;
const TAU = Math.PI * 2;
const FONT = '"Baloo Da 2", system-ui, sans-serif';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const rnd = (a, b) => a + Math.random() * (b - a);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const bn = n => Math.round(n).toLocaleString('en-US');
function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ---------------------------------------------------------------- data
const SOLDIERS = {
  red:    { name: 'Action Hero', ab: 'Heavy all-round hitter', skin: '#c98a5e', light: '#f0c39a', dark: '#6e4223', r: 24, density: 0.004, hat: 'hero' },
  yellow: { name: 'Heroine', ab: 'Tap: spin dash · smashes wood', skin: '#e0a77a', light: '#fbd6b4', dark: '#8a5530', r: 22, density: 0.0038, hat: 'heroine', tap: 'Spin dash!' },
  black:  { name: 'The Don', ab: 'Tap: explode · cracks stone', skin: '#a8714a', light: '#d9a57c', dark: '#5a3418', r: 27, density: 0.005, hat: 'don', tap: 'Explode!' },
  blue:   { name: 'Comedian', ab: 'Tap: split in three · shatters glass', skin: '#d69a6c', light: '#f6cba4', dark: '#7a4a28', r: 19, density: 0.004, hat: 'comic', tap: 'Split!' },
};
const MATS = {
  wood:  { density: 0.0018, hp: 66, friction: 0.85, rest: 0.05, score: 500,  debris: ['#d79a55', '#a8682c', '#7a4519'] },
  stone: { density: 0.0045, hp: 312, friction: 0.95, rest: 0.02, score: 1000, debris: ['#b9bec4', '#8a9199', '#5f666e'] },
  glass: { density: 0.0012, hp: 19,  friction: 0.4,  rest: 0.1,  score: 300,  debris: ['#d8f4ff', '#9fdcf7', '#ffffff'] },
  tnt:   { density: 0.0015, hp: 24,  friction: 0.8,  rest: 0.05, score: 500,  debris: ['#d8322f', '#8e1715', '#f3d27a'] },
};
const THEMES = {
  day: { sky: ['#3d8ff0', '#8ccaff', '#e3f5ff'], sun: '#fff7cf', glow: '255,240,170', far: ['#b6d0e8', '#9dbbd8'], near: ['#86aecd', '#6d97ba'],
    hills: ['#6cb85c', '#4f9a45'], tree: ['#3f8a3a', '#2f6e2c'], grass: '#74cc48', grassDark: '#3f8f2f', dirt: ['#8d5c35', '#5a381d'],
    cloud: ['#ffffff', '#dbe9f6'], haze: 'rgba(230,245,255,0.55)', stars: false },
  sunset: { sky: ['#2a1a4e', '#c4467a', '#ffb267'], sun: '#ffe1a0', glow: '255,170,90', far: ['#b06a8e', '#8c4c7a'], near: ['#6e3a6c', '#55295a'],
    hills: ['#4a3a5a', '#3a2c48'], tree: ['#2d2238', '#221a2c'], grass: '#6a9a3c', grassDark: '#3d6224', dirt: ['#6d4330', '#3f2519'],
    cloud: ['#ffd3c2', '#d98aa0'], haze: 'rgba(255,170,140,0.45)', stars: false },
  night: { sky: ['#040917', '#0f2452', '#2c4d84'], sun: '#f2f5ff', glow: '180,200,255', moon: true, far: ['#2b416b', '#203357'], near: ['#1b2c4e', '#14223d'],
    hills: ['#16283c', '#101e2e'], tree: ['#0c1824', '#08111a'], grass: '#2f6e4a', grassDark: '#1b4430', dirt: ['#3c2c2a', '#211716'],
    cloud: ['#7a8bb5', '#4a5a85'], haze: 'rgba(60,90,150,0.35)', stars: true },
};

// ---------------------------------------------------------------- levels
function builder() {
  const list = [];
  const b = {
    list,
    block(x, y, w, h, mat, angle) { list.push({ k: 'block', x, y, w, h, mat, angle: angle || 0 }); },
    post(x, base, h, mat = 'wood', w = 22) { b.block(x, base - h / 2, w, h, mat); return base - h; },
    slab(x1, x2, base, mat = 'wood', h = 22) { b.block((x1 + x2) / 2, base - h / 2, x2 - x1, h, mat); return base - h; },
    frame(xc, base, w, h, mat = 'wood', top, over = 8) {
      b.post(xc - w / 2 + 11, base, h, mat); b.post(xc + w / 2 - 11, base, h, mat);
      return b.slab(xc - w / 2 - over, xc + w / 2 + over, base - h, top || mat);
    },
    cube(x, base, s, mat) { b.block(x, base - s / 2, s, s, mat); return base - s; },
    tnt(x, base, s = 46) { return b.cube(x, base, s, 'tnt'); },
    robot(x, base, r = 24) { list.push({ k: 'robot', x, y: base - r, r }); },
    hill(x, w, h) { list.push({ k: 'hill', x, w, h }); return GROUND - h; },
  };
  return b;
}
const G = GROUND;
const LEVELS = [
  { name: 'First Mission', theme: 'day', soldiers: ['red', 'red', 'red'], build(b) {
    let t = b.frame(1650, G, 170, 120, 'wood'); b.robot(1650, G); b.robot(1650, t, 22);
    b.frame(1900, G, 150, 100, 'glass', 'wood'); b.robot(1900, G, 22);
  } },
  { name: 'Glass House', theme: 'day', soldiers: ['red', 'blue', 'red'], build(b) {
    const t1 = b.frame(1650, G, 190, 110, 'wood'); b.robot(1650, G);
    const t2 = b.frame(1650, t1, 150, 95, 'glass'); b.robot(1650, t1, 22);
    b.robot(1650, t2, 20);
    const t3 = b.frame(1920, G, 130, 150, 'glass'); b.robot(1920, G, 22);
    b.cube(1920, t3, 40, 'glass');
  } },
  { name: 'High Tower', theme: 'sunset', soldiers: ['yellow', 'red', 'yellow'], build(b) {
    const p = b.post(1560, G, 170, 'stone', 30); b.cube(1560, p, 34, 'glass');
    const a = b.frame(1800, G, 170, 120, 'wood'); b.robot(1800, G);
    const c = b.frame(1800, a, 150, 110, 'wood'); b.robot(1800, a, 22);
    const d = b.frame(1800, c, 130, 100, 'glass', 'wood'); b.robot(1800, c, 20);
    b.robot(1800, d, 24);
    const q = b.post(2040, G, 170, 'stone', 30); b.cube(2040, q, 34, 'glass');
  } },
  { name: 'Stone Bunker', theme: 'sunset', soldiers: ['red', 'black', 'yellow'], build(b) {
    const t = b.frame(1750, G, 280, 110, 'stone'); b.tnt(1750, G); b.robot(1665, G, 22); b.robot(1835, G, 22);
    const u = b.frame(1750, t, 190, 95, 'wood'); b.robot(1750, t, 24);
    b.robot(1750, u, 22);
    b.frame(2020, G, 120, 90, 'stone'); b.robot(2020, G, 20);
  } },
  { name: 'Twin Towers', theme: 'day', soldiers: ['yellow', 'blue', 'black', 'red'], build(b) {
    let top = G;
    for (const x of [1600, 2000]) {
      const a = b.frame(x, G, 140, 130, 'stone'); b.robot(x, G, 22);
      top = b.frame(x, a, 120, 110, 'wood'); b.robot(x, a, 22);
    }
    const br = b.slab(1580, 2020, top, 'wood');
    b.robot(1800, br, 26);
    b.cube(1600, br, 36, 'glass'); b.cube(2000, br, 36, 'glass');
    b.tnt(1770, G); b.robot(1840, G, 22);
  } },
  { name: 'Pyramid', theme: 'night', soldiers: ['black', 'yellow', 'black', 'red'], build(b) {
    let base = G;
    for (let row = 0; row < 4; row++) {
      const n = 4 - row, x0 = 1600 + row * 55; let top = base;
      const mat = row % 2 ? 'wood' : 'stone';
      for (let i = 0; i < n; i++) { const x = x0 + i * 110; top = b.frame(x, base, 110, 85, mat, mat, 0); b.robot(x, base, row === 3 ? 24 : 20); }
      base = top;
    }
    b.robot(1600 + 3 * 55, base, 22);
  } },
  { name: 'Hill Fort', theme: 'sunset', soldiers: ['red', 'yellow', 'blue', 'black'], build(b) {
    const H = b.hill(1850, 560, 170);
    const t = b.frame(1730, H, 160, 110, 'wood'); b.robot(1730, H, 22);
    const u = b.frame(1730, t, 120, 90, 'glass'); b.robot(1730, t, 20); b.tnt(1730, u, 40);
    const v = b.frame(1960, H, 150, 130, 'stone', 'wood'); b.robot(1960, H, 24); b.robot(1960, v, 22);
    b.frame(2250, G, 110, 80, 'glass'); b.robot(2250, G, 22);
  } },
  { name: 'Night Raid', theme: 'night', soldiers: ['red', 'yellow', 'black', 'blue', 'black'], build(b) {
    const H = b.hill(1700, 300, 90);
    const a = b.frame(1700, H, 180, 120, 'stone'); b.robot(1700, H, 24);
    const a2 = b.frame(1700, a, 150, 100, 'wood'); b.robot(1700, a, 22); b.cube(1700, a2, 44, 'glass');
    const c = b.frame(1980, G, 200, 140, 'stone'); b.tnt(1920, G); b.robot(2010, G, 36);
    const c2 = b.frame(1980, c, 160, 110, 'wood'); b.robot(1980, c, 24);
    const c3 = b.frame(1980, c2, 120, 90, 'glass'); b.robot(1980, c2, 20); b.robot(1980, c3, 22);
    const d = b.frame(2250, G, 140, 110, 'wood'); b.robot(2250, G, 22); b.tnt(2250, d, 40);
  } },
  { name: 'Glass Gardens', theme: 'day', soldiers: ['blue', 'blue', 'red'], build(b) {
    for (const x of [1550, 1750, 1950]) { const t = b.frame(x, G, 140, 120, 'glass', 'wood'); b.robot(x, G, 22); b.robot(x, t, 20); }
  } },
  { name: 'Timber Town', theme: 'sunset', soldiers: ['yellow', 'yellow', 'red'], build(b) {
    for (const x of [1600, 1900]) { const a = b.frame(x, G, 180, 110, 'wood'); b.robot(x, G, 24); const c = b.frame(x, a, 140, 100, 'wood'); b.robot(x, a, 22); b.robot(x, c, 20); }
    b.tnt(1750, G);
  } },
  { name: 'Powder Keg', theme: 'night', soldiers: ['red', 'red', 'black'], build(b) {
    const a = b.frame(1700, G, 220, 100, 'stone'); b.tnt(1660, G); b.tnt(1740, G); b.robot(1700, a, 24);
    b.tnt(1830, G);
    const c = b.frame(1950, G, 160, 120, 'wood'); b.tnt(1920, G, 40); b.robot(1985, G, 20); b.robot(1950, c, 22);
  } },
  { name: 'Hilltop Watch', theme: 'day', soldiers: ['yellow', 'blue', 'black'], build(b) {
    b.frame(1600, G, 120, 90, 'glass'); b.robot(1600, G, 22);
    const H = b.hill(1900, 420, 220);
    const t = b.frame(1820, H, 140, 110, 'wood'); b.robot(1820, H, 22); b.robot(1820, t, 22);
    b.frame(1990, H, 120, 90, 'glass'); b.robot(1990, H, 20);
  } },
  { name: 'Stone Wall', theme: 'sunset', soldiers: ['black', 'black', 'yellow', 'red'], build(b) {
    b.post(1520, G, 200, 'stone', 40);
    const a = b.frame(1750, G, 200, 120, 'stone'); b.robot(1750, G, 26);
    const c = b.frame(1750, a, 160, 100, 'wood'); b.robot(1750, a, 22); b.robot(1750, c, 22);
    const d = b.frame(2000, G, 140, 140, 'wood'); b.robot(2000, G, 22); b.tnt(2000, d, 40);
  } },
  { name: 'Sky Bridge', theme: 'day', soldiers: ['blue', 'yellow', 'black', 'red'], build(b) {
    const H1 = b.hill(1550, 240, 200); b.hill(2150, 240, 200);
    const br = b.slab(1600, 2100, H1, 'wood'); b.robot(1750, br, 22); b.robot(1950, br, 22);
    b.frame(1500, H1, 120, 90, 'glass'); b.robot(1500, H1, 20);
    b.frame(2200, H1, 120, 90, 'stone'); b.robot(2200, H1, 22);
    b.robot(1850, G, 24);
  } },
  { name: 'Twin Bosses', theme: 'night', soldiers: ['red', 'black', 'yellow', 'blue', 'black'], build(b) {
    for (const x of [1650, 2050]) { const a = b.frame(x, G, 180, 150, 'stone'); b.robot(x, G, 36); const c = b.frame(x, a, 140, 100, 'wood'); b.robot(x, a, 22); }
    const t = b.tnt(1850, G); b.robot(1850, t, 20);
  } },
  { name: 'Grand Citadel', theme: 'sunset', soldiers: ['red', 'yellow', 'blue', 'black', 'black', 'yellow'], build(b) {
    const H = b.hill(1850, 700, 80);
    [1650, 1850, 2050].forEach((x, i) => {
      const a = b.frame(x, H, 150, 110, i === 1 ? 'stone' : 'wood'); b.robot(x, H, i === 1 ? 32 : 22);
      const c = b.frame(x, a, 120, 90, 'glass'); b.robot(x, a, 20); b.robot(x, c, 22);
    });
    b.tnt(1750, H, 40); b.tnt(1950, H, 40);
  } },
];

// ---------------------------------------------------------------- progress
const SAVE_KEY = 'asb_progress_v1';
let progress = { unlocked: 1, stars: {}, best: {} };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.unlocked) progress = s; } catch (e) { }
const saveProgress = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { } };

// ---------------------------------------------------------------- sound (synthesised)
const Sound = (() => {
  let ac = null, master = null, nbuf = null;
  let enabled = localStorage.getItem('asb_sound') !== '0';
  const last = {};
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); master = ac.createGain(); master.gain.value = 0.55;
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    nbuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const ch = nbuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  function ok(key, gap) {
    if (!ac || !enabled) return false;
    if (key) { const t = ac.currentTime; if (last[key] && t - last[key] < gap) return false; last[key] = t; }
    return true;
  }
  function tone(f, d, type = 'sine', v = 0.3, f2 = null, delay = 0) {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
  }
  function noise(d, v = 0.3, ft = 'lowpass', freq = 1000, q = 1, delay = 0, f2 = null) {
    const t = ac.currentTime + delay, s = ac.createBufferSource(); s.buffer = nbuf;
    const f = ac.createBiquadFilter(); f.type = ft; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + d); f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  return {
    init,
    get enabled() { return enabled; },
    toggle() { enabled = !enabled; localStorage.setItem('asb_sound', enabled ? '1' : '0'); return enabled; },
    click() { if (ok()) tone(660, 0.07, 'triangle', 0.15, 880); },
    stretch(p) { if (ok('stretch', 0.06)) tone(160 + p * 300, 0.07, 'triangle', 0.07); },
    launch() { if (!ok()) return; noise(0.4, 0.35, 'bandpass', 500, 1.2, 0, 2600); tone(300, 0.45, 'sawtooth', 0.06, 700); },
    cry() { if (!ok('cry', 0.3)) return; tone(440, 0.35, 'square', 0.05, 300); tone(660, 0.3, 'sawtooth', 0.03, 420, 0.03); },
    hit(mat, p) {
      if (!ok('hit_' + mat, 0.045)) return; p = clamp(p, 0.05, 1);
      if (mat === 'wood') { noise(0.16, 0.3 * p, 'lowpass', 700); tone(150 + Math.random() * 40, 0.12, 'triangle', 0.25 * p, 90); }
      else if (mat === 'stone') { noise(0.22, 0.32 * p, 'lowpass', 380); tone(80, 0.18, 'sine', 0.3 * p, 50); }
      else if (mat === 'glass') { noise(0.18, 0.18 * p, 'highpass', 3500); tone(2400 + Math.random() * 800, 0.12, 'sine', 0.06 * p, 1800); }
      else if (mat === 'robot') { tone(700 + Math.random() * 300, 0.12, 'square', 0.06 * p, 400); tone(1500, 0.08, 'sine', 0.05 * p); }
      else { noise(0.14, 0.22 * p, 'lowpass', 260); }
    },
    brk(mat) {
      if (!ok('brk_' + mat, 0.05)) return;
      if (mat === 'wood') { noise(0.35, 0.4, 'bandpass', 900, 0.8, 0, 300); tone(200, 0.2, 'square', 0.05, 70); }
      else if (mat === 'stone') { noise(0.5, 0.5, 'lowpass', 600, 1, 0, 120); }
      else if (mat === 'glass') { for (let i = 0; i < 5; i++) tone(2000 + Math.random() * 3000, 0.25, 'sine', 0.05, 1500, i * 0.03); noise(0.4, 0.25, 'highpass', 4000); }
    },
    robotDie() { if (!ok('rd', 0.05)) return; noise(0.25, 0.7, 'lowpass', 1800, 1, 0, 200); tone(180, 0.3, 'sine', 0.5, 50); tone(520, 0.35, 'triangle', 0.1, 260, 0.08); },
    boom() { if (!ok('boom', 0.05)) return; noise(1.1, 0.8, 'lowpass', 1100, 1, 0, 50); tone(90, 0.8, 'sine', 0.6, 28); },
    dash() { if (!ok()) return; tone(400, 0.3, 'sawtooth', 0.09, 1600); noise(0.3, 0.25, 'bandpass', 1500, 2, 0, 4000); },
    split() { if (!ok()) return; for (let i = 0; i < 3; i++) tone(900 + i * 250, 0.12, 'square', 0.06, 1400 + i * 200, i * 0.05); },
    score() { if (ok('sc', 0.05)) tone(1200, 0.08, 'sine', 0.06, 1600); },
    star(i) { if (ok()) { tone(880 + i * 220, 0.3, 'triangle', 0.18); tone(1760 + i * 440, 0.25, 'sine', 0.06, null, 0.04); } },
    win() { if (!ok()) return; [523, 554, 659, 698, 784, 698, 659, 784, 1047].forEach((f, i) => { tone(f, 0.22, 'sawtooth', 0.06, null, i * 0.1); tone(f * 2, 0.18, 'sine', 0.05, null, i * 0.1); }); for (let i = 0; i < 9; i++) { noise(0.08, 0.35, 'bandpass', i % 2 ? 300 : 900, 4, i * 0.1); tone(i % 2 ? 110 : 220, 0.12, 'sine', 0.25, i % 2 ? 70 : 160, i * 0.1); } },
    lose() { if (!ok()) return; [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'triangle', 0.14, f * 0.97, i * 0.18)); },
  };
})();

// ---------------------------------------------------------------- canvas
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, scale = 1, viewW = 0, viewH = 0, camX = 0, camY = 0;
let skyGrad = null, vignette = null, skyTheme = null;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.floor(innerWidth * DPR); H = Math.floor(innerHeight * DPR);
  canvas.width = W; canvas.height = H;
  scale = Math.min(H / 1000, W / 1300);
  viewW = W / scale; viewH = H / scale;
  camY = GROUND + 110 - viewH;
  skyTheme = null;
  vignette = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.8);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.38)');
  document.getElementById('rotate').classList.toggle('hidden', !(innerHeight > innerWidth && innerWidth < 700));
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- textures
const texCache = new Map();
const TEX_RES = 2.5;
const drawMat = {
  wood(g, w, h, r) {
    const horiz = w >= h, L = horiz ? w : h, T = horiz ? h : w;
    const grad = horiz ? g.createLinearGradient(0, 0, 0, h) : g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#e8ad68'); grad.addColorStop(0.45, '#c98a44'); grad.addColorStop(1, '#93571f');
    rr(g, 0, 0, w, h, 3); g.fillStyle = grad; g.fill();
    g.save(); rr(g, 0, 0, w, h, 3); g.clip();
    const lines = Math.max(2, Math.floor(T / 4.5));
    for (let i = 0; i < lines; i++) {
      const off = (i + 0.5) * T / lines + (r() - 0.5) * 2, amp = 0.5 + r() * 1.4, ph = r() * 6, fr = 0.03 + r() * 0.04;
      g.strokeStyle = `rgba(${80 + r() * 30 | 0},40,10,${0.18 + r() * 0.25})`; g.lineWidth = 0.6 + r() * 0.8;
      g.beginPath();
      for (let s = 0; s <= L; s += 3) { const o = off + Math.sin(s * fr + ph) * amp; if (horiz) { s ? g.lineTo(s, o) : g.moveTo(s, o); } else { s ? g.lineTo(o, s) : g.moveTo(o, s); } }
      g.stroke();
    }
    const knots = Math.floor(L / 80);
    for (let k = 0; k < knots; k++) {
      const a = 15 + r() * (L - 30), b = T * (0.3 + r() * 0.4), x = horiz ? a : b, y = horiz ? b : a;
      for (let ring = 3; ring > 0; ring--) { g.beginPath(); g.ellipse(x, y, horiz ? ring * 2.6 : ring * 1.3, horiz ? ring * 1.3 : ring * 2.6, 0, 0, TAU); g.strokeStyle = 'rgba(90,45,12,0.35)'; g.lineWidth = 0.8; g.stroke(); }
      g.beginPath(); g.ellipse(x, y, 1.6, 1.2, 0, 0, TAU); g.fillStyle = '#6b3a12'; g.fill();
    }
    g.fillStyle = 'rgba(255,235,190,0.35)'; horiz ? g.fillRect(0, 0, w, 2) : g.fillRect(0, 0, 2, h);
    g.fillStyle = 'rgba(60,25,5,0.3)'; horiz ? g.fillRect(0, h - 2.5, w, 2.5) : g.fillRect(w - 2.5, 0, 2.5, h);
    g.restore();
    g.lineWidth = 1.4; g.strokeStyle = '#5e330f'; rr(g, 0.7, 0.7, w - 1.4, h - 1.4, 3); g.stroke();
    g.fillStyle = '#4a4a4f';
    const nails = horiz ? [[5, h / 2], [w - 5, h / 2]] : [[w / 2, 5], [w / 2, h - 5]];
    for (const [x, y] of nails) { g.beginPath(); g.arc(x, y, 1.5, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x - 0.8, y - 0.8, 0.8, 0.8); g.fillStyle = '#4a4a4f'; }
  },
  stone(g, w, h, r) {
    const grad = g.createLinearGradient(0, 0, w * 0.3, h);
    grad.addColorStop(0, '#d3d7dc'); grad.addColorStop(0.5, '#a3a9b1'); grad.addColorStop(1, '#6f767e');
    rr(g, 0, 0, w, h, 4); g.fillStyle = grad; g.fill();
    g.save(); rr(g, 0, 0, w, h, 4); g.clip();
    const n = Math.floor(w * h / 18);
    for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.5 ? `rgba(40,45,52,${0.08 + r() * 0.18})` : `rgba(255,255,255,${0.08 + r() * 0.2})`; g.beginPath(); g.arc(r() * w, r() * h, 0.4 + r() * 1.3, 0, TAU); g.fill(); }
    for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(80,86,94,${0.12 + r() * 0.12})`; g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * w * 0.2, 2 + r() * h * 0.2, r() * 3, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(50,55,60,0.35)'; g.lineWidth = 0.8;
    if (Math.max(w, h) > 60) { g.beginPath(); const horiz = w > h; for (let k = 1; k < 3; k++) { const p = (horiz ? w : h) * (k / 3 + (r() - 0.5) * 0.1); if (horiz) { g.moveTo(p, 0); g.lineTo(p + (r() - 0.5) * 4, h); } else { g.moveTo(0, p); g.lineTo(w, p + (r() - 0.5) * 4); } } g.stroke(); }
    g.restore();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(2, h - 3); g.lineTo(2, 2); g.lineTo(w - 3, 2); g.stroke();
    g.strokeStyle = 'rgba(30,34,40,0.45)'; g.beginPath(); g.moveTo(w - 1.5, 3); g.lineTo(w - 1.5, h - 1.5); g.lineTo(3, h - 1.5); g.stroke();
    g.lineWidth = 1; g.strokeStyle = '#4d535a'; rr(g, 0.5, 0.5, w - 1, h - 1, 4); g.stroke();
  },
  glass(g, w, h, r) {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(215,245,255,0.65)'); grad.addColorStop(0.5, 'rgba(140,215,245,0.38)'); grad.addColorStop(1, 'rgba(90,180,230,0.55)');
    rr(g, 0, 0, w, h, 3); g.fillStyle = grad; g.fill();
    g.save(); rr(g, 0, 0, w, h, 3); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    const d = Math.max(w, h);
    for (let i = 0; i < 2; i++) { const o = d * (0.2 + i * 0.35 + r() * 0.1), t = 3 + i * 3; g.beginPath(); g.moveTo(o, -2); g.lineTo(o + t, -2); g.lineTo(o + t - d, d + 2); g.lineTo(o - d, d + 2); g.closePath(); g.fill(); }
    g.restore();
    g.lineWidth = 1.6; g.strokeStyle = 'rgba(235,252,255,0.95)'; rr(g, 0.8, 0.8, w - 1.6, h - 1.6, 3); g.stroke();
    g.lineWidth = 1; g.strokeStyle = 'rgba(60,150,200,0.6)'; rr(g, 2.5, 2.5, w - 5, h - 5, 2); g.stroke();
  },
  tnt(g, w, h) {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ef4a3a'); grad.addColorStop(1, '#9c1a12');
    rr(g, 0, 0, w, h, 4); g.fillStyle = grad; g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 1; i < 3; i++) g.fillRect(0, h * i / 3 - 1, w, 2);
    g.lineWidth = 3; g.strokeStyle = '#5a0d08'; rr(g, 1.5, 1.5, w - 3, h - 3, 4); g.stroke();
    g.fillStyle = '#f6e3a8'; rr(g, w * 0.12, h * 0.32, w * 0.76, h * 0.36, 3); g.fill();
    g.fillStyle = '#b3160e'; g.font = `800 ${h * 0.3}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TNT', w / 2, h * 0.52);
    g.fillStyle = '#2b2b2b'; g.fillRect(w * 0.08, h * 0.06, w * 0.08, h * 0.08); g.fillRect(w * 0.84, h * 0.06, w * 0.08, h * 0.08);
  },
};
function blockTex(mat, w, h) {
  const key = mat + '_' + w + '_' + h;
  let c = texCache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = Math.ceil(w * TEX_RES); c.height = Math.ceil(h * TEX_RES);
  const g = c.getContext('2d'); g.scale(TEX_RES, TEX_RES);
  drawMat[mat](g, w, h, mulberry32(hashStr(key)));
  texCache.set(key, c); return c;
}
function cloudSprite(theme, seed) {
  const r = mulberry32(seed), c = document.createElement('canvas'); c.width = 420; c.height = 180;
  const g = c.getContext('2d'); const puffs = [];
  for (let i = 0; i < 9; i++) puffs.push([60 + r() * 300, 95 + (r() - 0.5) * 30, 30 + r() * 38]);
  puffs.push([210, 80, 60]);
  g.filter = 'blur(1px)';
  for (const [x, y, rad] of puffs) { const gr = g.createRadialGradient(x, y - rad * 0.4, rad * 0.2, x, y, rad); gr.addColorStop(0, theme.cloud[0]); gr.addColorStop(1, theme.cloud[1]); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'destination-out'; g.fillRect(0, 128, 420, 60);
  return c;
}

// ---------------------------------------------------------------- characters
function drawSoldier(g, type, x, y, r, ang, mood, t, look = 1) {
  const s = SOLDIERS[type], k = s.hat;
  t = t || 0;
  g.save(); g.translate(x, y); g.rotate(ang || 0);
  // ---- behind the head
  if (k === 'heroine') {
    g.fillStyle = '#1a0f0a'; g.beginPath(); g.ellipse(0, r * .3, r * 1.13, r * 1.12, 0, 0, TAU); g.fill();
    const wv = Math.sin(t * 14) * r * .15;
    g.fillStyle = '#d81b3c'; g.beginPath(); g.moveTo(-r * .55, r * .55);
    g.quadraticCurveTo(-r * 1.5, r * .25 + wv, -r * 2.05, r * .65 + wv); g.lineTo(-r * 1.95, r * 1.0 + wv);
    g.quadraticCurveTo(-r * 1.4, r * .8, -r * .55, r * .95); g.closePath(); g.fill();
    g.strokeStyle = '#f2c14e'; g.lineWidth = r * .07; g.stroke();
  }
  // ---- face
  let gr = g.createRadialGradient(-r * .35, -r * .45, r * .1, 0, 0, r * 1.05);
  gr.addColorStop(0, s.light); gr.addColorStop(.6, s.skin); gr.addColorStop(1, s.dark);
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = gr; g.fill();
  g.save(); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
  if (k === 'hero') {
    g.fillStyle = 'rgba(40,25,15,.18)'; g.beginPath(); g.ellipse(r * .05, r * .62, r * .7, r * .38, 0, 0, TAU); g.fill();
    g.fillStyle = '#1b1b20'; g.beginPath(); g.ellipse(0, r * 1.12, r * 1.05, r * .42, 0, 0, TAU); g.fill();
    g.fillStyle = '#c62828'; g.beginPath(); g.moveTo(-r * .28, r * .72); g.lineTo(r * .28, r * .72); g.lineTo(0, r * 1.05); g.fill();
    g.strokeStyle = '#444'; g.lineWidth = r * .05; g.beginPath(); g.moveTo(-r * .3, r * .72); g.lineTo(-r * .6, r); g.moveTo(r * .3, r * .72); g.lineTo(r * .6, r); g.stroke();
  } else if (k === 'heroine') {
    g.fillStyle = '#d81b3c'; g.beginPath(); g.moveTo(-r, r * .62); g.quadraticCurveTo(0, r * .82, r, r * .52); g.lineTo(r, r); g.lineTo(-r, r); g.fill();
    g.strokeStyle = '#f2c14e'; g.lineWidth = r * .08; g.beginPath(); g.moveTo(-r, r * .62); g.quadraticCurveTo(0, r * .82, r, r * .52); g.stroke();
  } else if (k === 'don') {
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(0, r * 1.1, r * 1.05, r * .42, 0, 0, TAU); g.fill();
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.moveTo(-r * .22, r * .72); g.lineTo(r * .22, r * .72); g.lineTo(0, r * 1.05); g.fill();
    g.strokeStyle = '#f2c14e'; g.lineWidth = r * .07; g.setLineDash([r * .07, r * .05]);
    g.beginPath(); g.arc(0, r * .55, r * .42, Math.PI * .2, Math.PI * .8); g.stroke(); g.setLineDash([]);
  } else {
    g.fillStyle = '#3b8fe6'; g.beginPath(); g.ellipse(0, r * 1.1, r * 1.05, r * .42, 0, 0, TAU); g.fill();
    g.fillStyle = '#e53935'; g.beginPath(); g.moveTo(0, r * .78); g.lineTo(-r * .3, r * .64); g.lineTo(-r * .3, r * .92); g.closePath(); g.moveTo(0, r * .78); g.lineTo(r * .3, r * .64); g.lineTo(r * .3, r * .92); g.closePath(); g.fill();
  }
  const sh = g.createRadialGradient(r * .3, r * .4, r * .2, 0, 0, r * 1.1); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.22)');
  g.fillStyle = sh; g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();
  g.lineWidth = Math.max(1, r * .05); g.strokeStyle = s.dark; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
  // ---- hair / hat
  if (k === 'hero') {
    g.fillStyle = '#120c08'; g.beginPath(); g.moveTo(-r * .98, -r * .12);
    g.quadraticCurveTo(-r * 1.1, -r * 1.0, -r * .15, -r * 1.15); g.quadraticCurveTo(r * .75, -r * 1.4, r * 1.05, -r * .7);
    g.quadraticCurveTo(r * 1.05, -r * .4, r * .95, -r * .25); g.quadraticCurveTo(r * .5, -r * .62, 0, -r * .52);
    g.quadraticCurveTo(-r * .6, -r * .48, -r * .98, -r * .12); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = r * .06; g.beginPath(); g.moveTo(-r * .5, -r * .95); g.quadraticCurveTo(r * .2, -r * 1.2, r * .75, -r * .85); g.stroke();
  } else if (k === 'heroine') {
    g.fillStyle = '#1a0f0a'; g.beginPath(); g.ellipse(0, -r * .38, r * 1.02, r * .66, 0, Math.PI, TAU); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-r * 1.0, -r * .4); g.quadraticCurveTo(-r * .7, -r * .1, -r * .92, r * .4); g.lineTo(-r * 1.05, r * .2); g.fill();
    g.beginPath(); g.moveTo(r * 1.0, -r * .4); g.quadraticCurveTo(r * .7, -r * .1, r * .92, r * .4); g.lineTo(r * 1.05, r * .2); g.fill();
    g.strokeStyle = '#c2185b'; g.lineWidth = r * .05; g.beginPath(); g.moveTo(0, -r * 1.02); g.lineTo(0, -r * .62); g.stroke();
    g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(0, -r * .58, r * .07, 0, TAU); g.fill();
    for (const sx of [-1, 1]) { g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(sx * r * .98, r * .18, r * .09, 0, TAU); g.fill(); g.beginPath(); g.moveTo(sx * r * .98 - r * .13, r * .42); g.lineTo(sx * r * .98 + r * .13, r * .42); g.lineTo(sx * r * .98, r * .22); g.fill(); }
  } else if (k === 'don') {
    g.fillStyle = '#141414'; g.beginPath(); g.ellipse(0, -r * .62, r * 1.28, r * .2, 0, 0, TAU); g.fill();
    rr(g, -r * .72, -r * 1.28, r * 1.44, r * .68, r * .25); g.fill();
    g.fillStyle = '#b71c1c'; g.fillRect(-r * .72, -r * .82, r * 1.44, r * .14);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(-r * .6, -r * 1.2, r * .2, r * .35);
  } else {
    g.strokeStyle = '#2b1a10'; g.lineWidth = r * .1; g.lineCap = 'round';
    for (const a of [-.4, 0, .4]) { g.beginPath(); g.moveTo(a * r * .6, -r * .95); g.quadraticCurveTo(a * r * 1.2 + r * .1, -r * 1.35, a * r * .9 + r * .25, -r * 1.25); g.stroke(); }
  }
  // ---- eyes
  const ey = -r * .05, lx = r * .06 * look;
  if (k === 'hero') {
    g.fillStyle = '#0d0d10';
    for (const sx of [-1, 1]) { rr(g, sx * r * .36 - r * .25 + r * .04, ey - r * .17, r * .5, r * .34, r * .14); g.fill(); }
    g.fillRect(-r * .1, ey - r * .1, r * .26, r * .07);
    g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(-r * .48, ey - r * .12, r * .14, r * .05); g.fillRect(r * .26, ey - r * .12, r * .14, r * .05);
  } else {
    for (const sx of [-1, 1]) {
      const ex = sx * r * .33 + r * .04;
      if (mood === 'blink') { g.strokeStyle = '#1a1a1a'; g.lineWidth = r * .07; g.beginPath(); g.moveTo(ex - r * .16, ey); g.lineTo(ex + r * .16, ey); g.stroke(); }
      else {
        const big = k === 'comic' ? 1.15 : 1;
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, r * .18 * big, r * .21 * big, 0, 0, TAU); g.fill();
        g.fillStyle = '#2a1608'; g.beginPath(); g.arc(ex + lx, ey + r * .03, r * .1, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + lx + r * .03, ey - r * .01, r * .03, 0, TAU); g.fill();
        if (k === 'heroine') { g.strokeStyle = '#111'; g.lineWidth = r * .06; g.beginPath(); g.ellipse(ex, ey, r * .19, r * .22, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.beginPath(); g.moveTo(ex + sx * r * .17, ey - r * .1); g.lineTo(ex + sx * r * .28, ey - r * .2); g.stroke(); }
      }
      if (k === 'comic') { g.strokeStyle = '#222'; g.lineWidth = r * .06; g.beginPath(); g.arc(ex, ey, r * .27, 0, TAU); g.stroke(); }
    }
    if (k === 'comic') { g.strokeStyle = '#222'; g.lineWidth = r * .06; g.beginPath(); g.moveTo(-r * .02, ey); g.lineTo(r * .1, ey); g.stroke(); }
  }
  // ---- brows
  g.fillStyle = '#161009';
  const by = mood === 'yell' ? -r * .06 : 0, bt = k === 'heroine' ? .6 : 1;
  g.beginPath(); g.moveTo(-r * .62, -r * .4 + by); g.lineTo(-r * .06, -r * .2); g.lineTo(-r * .08, -r * (.2 - .1 * bt)); g.lineTo(-r * .6, -r * (.4 - .12 * bt) + by); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(r * .7, -r * .4 + by); g.lineTo(r * .14, -r * .2); g.lineTo(r * .16, -r * (.2 - .1 * bt)); g.lineTo(r * .68, -r * (.4 - .12 * bt) + by); g.closePath(); g.fill();
  if (k === 'heroine') { g.fillStyle = '#d0021b'; g.beginPath(); g.arc(r * .05, -r * .32, r * .06, 0, TAU); g.fill(); }
  if (k === 'don') { g.strokeStyle = 'rgba(90,30,20,.8)'; g.lineWidth = r * .05; g.beginPath(); g.moveTo(-r * .5, -r * .38); g.lineTo(-r * .2, r * .12); g.stroke(); }
  // nose + cheeks
  g.fillStyle = 'rgba(80,40,20,.25)'; g.beginPath(); g.ellipse(r * .06, r * .2, r * .12, r * .09, 0, 0, TAU); g.fill();
  if (k === 'heroine' || k === 'comic') { g.fillStyle = 'rgba(255,90,90,.25)'; g.beginPath(); g.ellipse(-r * .5, r * .28, r * .14, r * .08, 0, 0, TAU); g.ellipse(r * .6, r * .28, r * .14, r * .08, 0, 0, TAU); g.fill(); }
  // ---- mouth
  const yell = mood === 'yell';
  if (k === 'heroine') {
    if (yell) { g.fillStyle = '#5a0a14'; g.beginPath(); g.ellipse(r * .06, r * .52, r * .18, r * .14, 0, 0, TAU); g.fill(); g.strokeStyle = '#d0021b'; g.lineWidth = r * .07; g.stroke(); }
    else { g.fillStyle = '#d0021b'; g.beginPath(); g.ellipse(r * .06, r * .5, r * .16, r * .065, 0, 0, TAU); g.fill(); }
  } else if (k === 'comic') {
    g.fillStyle = '#4a0c0c'; g.beginPath(); g.arc(r * .06, r * .42, r * .26, 0.1, Math.PI - 0.1); g.fill();
    g.fillStyle = '#fff'; g.fillRect(-r * .06, r * .44, r * .11, r * .14); g.fillRect(r * .07, r * .44, r * .11, r * .14);
  } else {
    if (yell) { g.fillStyle = '#3a0a0a'; g.beginPath(); g.ellipse(r * .06, r * .52, r * .22, r * .15, 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.fillRect(-r * .1, r * .39, r * .32, r * .06); }
    else { g.strokeStyle = '#3a1a10'; g.lineWidth = r * .07; g.lineCap = 'round'; g.beginPath(); g.moveTo(-r * .16, r * .5); g.quadraticCurveTo(r * .1, r * .58, r * .3, r * .42); g.stroke(); }
    if (k === 'don') {
      if (!yell) { g.fillStyle = '#f2c14e'; g.fillRect(r * .08, r * .48, r * .08, r * .08); }
      g.fillStyle = '#1a0f08'; g.beginPath(); g.moveTo(r * .06, r * .3);
      g.bezierCurveTo(-r * .2, r * .22, -r * .5, r * .3, -r * .6, r * .55); g.bezierCurveTo(-r * .4, r * .4, -r * .15, r * .42, r * .06, r * .4);
      g.bezierCurveTo(r * .27, r * .42, r * .52, r * .4, r * .72, r * .55); g.bezierCurveTo(r * .62, r * .3, r * .32, r * .22, r * .06, r * .3); g.fill();
    }
  }
  g.restore();
}

function drawRobot(g, e, t) {
  const b = e.body, r = e.r, x = b.position.x, y = b.position.y;
  const boss = r >= 32, dmg = 1 - e.hp / e.maxHp;
  g.save(); g.translate(x, y); g.rotate(b.angle);
  const gr = g.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r);
  gr.addColorStop(0, '#c99670'); gr.addColorStop(.55, '#8d5a3a'); gr.addColorStop(1, '#4e2d1a');
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = gr; g.fill();
  g.save(); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
  g.fillStyle = 'rgba(25,15,8,.3)'; g.beginPath(); g.ellipse(0, r * .55, r * .8, r * .45, 0, 0, TAU); g.fill();
  g.fillStyle = '#151515'; g.beginPath(); g.ellipse(0, r * 1.12, r * 1.05, r * .4, 0, 0, TAU); g.fill();
  if (dmg > 0.3) { g.fillStyle = 'rgba(110,40,130,.45)'; g.beginPath(); g.ellipse(r * .45, r * .15, r * .2, r * .16, 0, 0, TAU); g.fill(); }
  g.restore();
  g.lineWidth = r * .06; g.strokeStyle = '#3a2010'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
  if (boss) {
    g.fillStyle = '#111'; g.beginPath(); g.ellipse(0, -r * .62, r * 1.3, r * .2, 0, 0, TAU); g.fill();
    rr(g, -r * .72, -r * 1.25, r * 1.44, r * .66, r * .25); g.fill();
    g.fillStyle = '#d4af37'; g.fillRect(-r * .72, -r * .8, r * 1.44, r * .12);
  } else {
    g.fillStyle = e.seed < .5 ? '#b71c1c' : '#222';
    g.beginPath(); g.ellipse(0, -r * .32, r * 1.0, r * .72, 0, Math.PI, TAU); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(r * .85, -r * .45); g.lineTo(r * 1.35, -r * .65 + Math.sin(t * 6 + e.seed * 9) * r * .1); g.lineTo(r * 1.3, -r * .35); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-r * .6 + i * r * .4, -r * .6, r * .05, 0, TAU); g.fill(); }
  }
  // eyes: mean squint, glancing at the player
  const look = -r * .05 + Math.sin(t * 1.3 + e.seed * 10) * r * .04;
  for (const sx of [-1, 1]) {
    const ex = sx * r * .33;
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, -r * .08, r * .17, r * .1, 0, 0, TAU); g.fill();
    g.fillStyle = '#7a0d0d'; g.beginPath(); g.arc(ex + look, -r * .07, r * .075, 0, TAU); g.fill();
  }
  g.fillStyle = '#120a05';
  g.beginPath(); g.moveTo(-r * .62, -r * .32); g.lineTo(-r * .05, -r * .12); g.lineTo(-r * .06, -r * .02); g.lineTo(-r * .6, -r * .2); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(r * .62, -r * .32); g.lineTo(r * .05, -r * .12); g.lineTo(r * .06, -r * .02); g.lineTo(r * .6, -r * .2); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(120,30,20,.85)'; g.lineWidth = r * .05;
  g.beginPath(); g.moveTo(r * .2, -r * .38); g.lineTo(r * .5, r * .1); g.moveTo(r * .28, -r * .2); g.lineTo(r * .42, -r * .26); g.stroke();
  g.fillStyle = 'rgba(60,25,10,.4)'; g.beginPath(); g.ellipse(0, r * .18, r * .15, r * .11, 0, 0, TAU); g.fill();
  // snarl
  rr(g, -r * .3, r * .42, r * .6, r * .17, r * .06); g.fillStyle = '#fff'; g.fill();
  g.strokeStyle = '#2a1008'; g.lineWidth = r * .04; g.stroke();
  g.beginPath(); for (let i = 1; i < 5; i++) { const xx = -r * .3 + i * r * .12; g.moveTo(xx, r * .42); g.lineTo(xx, r * .59); } g.stroke();
  if (boss) {
    g.fillStyle = '#f2c14e'; g.fillRect(-r * .06, r * .43, r * .11, r * .15);
    g.fillStyle = '#120a05'; g.beginPath(); g.moveTo(0, r * .28); g.bezierCurveTo(-r * .3, r * .2, -r * .55, r * .3, -r * .62, r * .5); g.bezierCurveTo(-r * .4, r * .38, -r * .15, r * .4, 0, r * .38);
    g.bezierCurveTo(r * .15, r * .4, r * .4, r * .38, r * .62, r * .5); g.bezierCurveTo(r * .55, r * .3, r * .3, r * .2, 0, r * .28); g.fill();
  }
  if (dmg > 0.6) {
    g.fillStyle = '#f5f0e6'; g.save(); g.translate(-r * .5, r * .15); g.rotate(.6); g.fillRect(-r * .25, -r * .07, r * .5, r * .14); g.rotate(-1.2); g.fillRect(-r * .25, -r * .07, r * .5, r * .14); g.restore();
  }
  if (e.hitT > 0) { g.globalAlpha = e.hitT / 0.15 * 0.6; g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.globalAlpha = 1; }
  g.restore();
}

// ---------------------------------------------------------------- game state
let engine = null, state = null, acc = 0;

function newEngine() {
  engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
  engine.gravity.y = 1;
  Events.on(engine, 'collisionStart', onCollide);
}

function genScenery(seed) {
  const r = mulberry32(seed * 9973 + 7), sc = {};
  const ridge = (step, base, amp, jit) => {
    const pts = [], ph = [r() * 10, r() * 10, r() * 10];
    for (let x = -2000; x <= 9000; x += step) pts.push(x, base + amp * (0.5 * Math.sin(x * 0.0021 + ph[0]) + 0.3 * Math.sin(x * 0.0057 + ph[1]) + 0.2 * Math.sin(x * 0.013 + ph[2])) + (r() - 0.5) * jit);
    return pts;
  };
  sc.far = ridge(55, 400, 230, 40); sc.near = ridge(45, 240, 120, 18);
  const hp = [r() * 10, r() * 10];
  sc.hillH = x => 95 + 50 * Math.sin(x * 0.004 + hp[0]) + 25 * Math.sin(x * 0.011 + hp[1]);
  sc.trees = [];
  for (let x = -2000; x < 9000; x += 60 + r() * 140) sc.trees.push({ x, k: r() < 0.55 ? 0 : 1, s: 0.6 + r() * 0.7 });
  sc.clouds = [];
  for (let i = 0; i < 12; i++) sc.clouds.push({ x: r() * 5000, y: GROUND - 560 - r() * 420, s: 0.5 + r() * 0.8, v: 3 + r() * 9, sp: i % 3 });
  sc.stars = [];
  for (let i = 0; i < 160; i++) sc.stars.push({ x: r(), y: r() * 0.65, s: 0.5 + r() * 1.6, p: r() * 6 });
  sc.blades = [];
  for (let x = -1800; x < 7000; x += 6) sc.blades.push(5 + r() * 13, (r() - 0.5) * 6);
  sc.pebbles = [];
  for (let i = 0; i < 260; i++) sc.pebbles.push({ x: -1800 + r() * 8800, y: GROUND + 24 + r() * 260, rx: 3 + r() * 9, ry: 2 + r() * 5, a: r() * 0.4 });
  sc.flowers = [];
  for (let i = 0; i < 90; i++) sc.flowers.push({ x: -1800 + r() * 8800, c: ['#ffffff', '#ffd23a', '#ff7aa8', '#b38cff'][r() * 4 | 0], s: 2 + r() * 2 });
  return sc;
}

function loadLevel(idx, attract = false) {
  newEngine();
  const L = LEVELS[idx];
  const th = THEMES[L.theme];
  state = {
    idx, L, attract, theme: th, time: 0, grace: 0.4, score: 0, shake: 0,
    queue: L.soldiers.concat(L.soldiers), loaded: null, loadAnim: 1, flying: [], blocks: [], robots: [], hills: [],
    particles: [], trail: [], removeQ: [], aim: null, phase: 'play', camMode: 'intro', introT: 0,
    nextT: 0, loseT: 0, winT: 0, bonusDone: false, ended: false, bandVib: 0, blinkT: 2, slowmo: 0,
    totalBlockScore: 0, fortX: 1800, worldW: 2400, lastLaunched: null, sc: genScenery(idx + 1),
    clouds: [0, 1, 2].map(i => cloudSprite(th, idx * 31 + i * 7 + 3)), pan: null,
  };
  const b = builder(); L.build(b);
  let maxX = 0, minX = 1e9;
  for (const it of b.list) {
    if (it.k === 'block') addBlock(it);
    else if (it.k === 'robot') addRobot(it);
    else if (it.k === 'hill') addHill(it);
    const half = (it.w || it.r * 2 || 0) / 2;
    maxX = Math.max(maxX, it.x + half); minX = Math.min(minX, it.x - half);
  }
  state.fortX = (minX + maxX) / 2;
  state.worldW = Math.max(2400, maxX + 450);
  const ground = Bodies.rectangle(state.worldW / 2, GROUND + 150, state.worldW * 4, 300, { isStatic: true, friction: 1, label: 'ground' });
  ground.plugin.e = { kind: 'ground', mat: 'ground' };
  Composite.add(engine.world, ground);
  const rs = state.robots.length * 5000;
  state.star2 = rs + state.totalBlockScore * 0.25;
  state.star3 = rs + state.totalBlockScore * 0.5 + 10000;
  state.loaded = state.queue.shift();
  camX = camClamp(state.fortX - viewW / 2);
  acc = 0;
  updateHud(true);
}

function addBlock(it) {
  const m = MATS[it.mat];
  const body = Bodies.rectangle(it.x, it.y, it.w, it.h, { angle: it.angle, density: m.density, friction: m.friction, frictionStatic: 1.2, restitution: m.rest, chamfer: { radius: 1.5 }, sleepThreshold: 45 });
  const area = it.w * it.h;
  const hp = m.hp * clamp(area / 2400, 0.6, 3);
  const rg = mulberry32(hashStr(it.x + ':' + it.y));
  const cracks = [];
  for (let i = 0; i < 4; i++) {
    const pts = []; let px = (rg() - 0.5) * it.w * 0.8, py = (rg() - 0.5) * it.h * 0.8; pts.push(px, py);
    const ang = rg() * TAU;
    for (let k = 0; k < 4; k++) { px += Math.cos(ang + (rg() - 0.5) * 1.5) * Math.min(it.w, it.h) * 0.45 + (rg() - 0.5) * 6; py += Math.sin(ang + (rg() - 0.5) * 1.5) * Math.min(it.w, it.h) * 0.45; pts.push(clamp(px, -it.w / 2, it.w / 2), clamp(py, -it.h / 2, it.h / 2)); }
    cracks.push(pts);
  }
  const e = { kind: 'block', mat: it.mat, w: it.w, h: it.h, hp, maxHp: hp, body, cracks, hitT: 0, tex: blockTex(it.mat, it.w, it.h) };
  body.plugin.e = e;
  state.blocks.push(e);
  state.totalBlockScore += m.score;
  Composite.add(engine.world, body);
  Sleeping.set(body, true);
}
function addRobot(it) {
  const body = Bodies.circle(it.x, it.y, it.r, { density: 0.0012, friction: 0.7, frictionStatic: 1, restitution: 0.15, frictionAir: 0.003, sleepThreshold: 45 });
  const hp = 0.7 * 55 * Math.pow(it.r / 24, 2) * (it.r >= 32 ? 3 : 1);
  const e = { kind: 'robot', r: it.r, hp, maxHp: hp, body, seed: Math.random(), hitT: 0, sparkT: 0 };
  body.plugin.e = e;
  state.robots.push(e);
  Composite.add(engine.world, body);
  Sleeping.set(body, true);
}
function addHill(it) {
  const body = Bodies.rectangle(it.x, GROUND - it.h / 2 + 30, it.w, it.h + 60, { isStatic: true, friction: 1, chamfer: { radius: [40, 40, 0, 0] } });
  body.plugin.e = { kind: 'ground', mat: 'ground' };
  const r = mulberry32(hashStr('h' + it.x));
  const rocks = []; for (let i = 0; i < 14; i++) rocks.push({ x: (r() - 0.5) * it.w * 0.9, y: 30 + r() * (it.h - 20), rx: 5 + r() * 14, ry: 4 + r() * 8 });
  state.hills.push({ x: it.x, w: it.w, h: it.h, rocks });
  Composite.add(engine.world, body);
}

// ---------------------------------------------------------------- physics events
function dmgMult(src, target) {
  if (!src || src.kind !== 'soldier') return 1;
  let m = 1.25;
  if (src.type === 'yellow' && target.mat === 'wood') m = 2.4;
  if (src.type === 'blue' && target.mat === 'glass') m = 3.2;
  if (src.type === 'black' && target.mat === 'stone') m = 1.9;
  if (src.type === 'red') m = 1.5;
  return m;
}
function onCollide(ev) {
  if (!state) return;
  for (const p of ev.pairs) {
    const a = p.bodyA, b = p.bodyB;
    const ea = a.plugin && a.plugin.e, eb = b.plugin && b.plugin.e;
    if (!ea || !eb) continue;
    if (ea.kind === 'soldier') ea.hitOnce = true;
    if (eb.kind === 'soldier') eb.hitOnce = true;
    const rv = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
    if (rv < 1.5 || state.time < state.grace) continue;
    const ma = a.isStatic ? 1e9 : a.mass, mb = b.isStatic ? 1e9 : b.mass;
    const m = Math.min(ma, mb);
    const base = (rv - 1.5) * (rv - 1.5) * m * 0.25;
    hurt(ea, base * dmgMult(eb, ea));
    hurt(eb, base * dmgMult(ea, eb));
    const pw = clamp(rv / 18, 0, 1);
    for (const e of [ea, eb]) {
      if (e.kind === 'block') Sound.hit(e.mat, pw);
      else if (e.kind === 'robot') Sound.hit('robot', pw);
    }
    if (ea.kind === 'ground' || eb.kind === 'ground') Sound.hit('ground', pw * 0.8);
    if (rv > 9 && m > 3) state.shake = Math.max(state.shake, rv * 0.5);
    const sup = p.collision && p.collision.supports && p.collision.supports[0];
    if (sup && rv > 5) {
      const n = Math.min(10, rv | 0);
      const mat = ea.kind === 'block' ? ea.mat : eb.kind === 'block' ? eb.mat : null;
      for (let i = 0; i < n; i++) {
        if (mat) addParticle('chunk', sup.x, sup.y, rnd(-4, 4) * rv * 0.6, rnd(-6, -1) * rv * 0.6, rnd(2, 4), MATS[mat].debris[i % 3], rnd(0.4, 0.8));
        else addParticle('dust', sup.x, sup.y, rnd(-30, 30), rnd(-40, -10), rnd(6, 12), 'rgba(220,200,170,0.5)', rnd(0.4, 0.8));
      }
    }
  }
}
function hurt(e, d) {
  if (!e || e.dead || d < 2) return;
  if (e.kind !== 'block' && e.kind !== 'robot') return;
  e.hp -= d; e.hitT = 0.15;
  if (e.hp <= 0) { e.dead = true; state.removeQ.push(e); }
}
function wakeNear(x, y, R) {
  for (const b of Composite.allBodies(engine.world)) {
    if (b.isStatic) continue;
    if (Math.abs(b.position.x - x) < R && Math.abs(b.position.y - y) < R * 1.5) Sleeping.set(b, false);
  }
}
function processRemovals() {
  let guard = 0;
  while (state.removeQ.length && guard++ < 200) {
    const e = state.removeQ.shift();
    const pos = { x: e.body.position.x, y: e.body.position.y };
    Composite.remove(engine.world, e.body);
    if (e.kind === 'block') {
      state.blocks.splice(state.blocks.indexOf(e), 1);
      debris(pos, e);
      addScore(MATS[e.mat].score, pos.x, pos.y);
      Sound.brk(e.mat);
      if (e.mat === 'tnt') explode(pos.x, pos.y, 210, 22);
    } else if (e.kind === 'robot') {
      state.robots.splice(state.robots.indexOf(e), 1);
      robotDeath(pos, e.r);
      addScore(5000, pos.x, pos.y - 20, true);
      Sound.robotDie();
    }
    wakeNear(pos.x, pos.y, 380);
  }
}
function explode(x, y, R, power) {
  Sound.boom(); state.shake = Math.max(state.shake, 28); state.slowmo = 0.25;
  addParticle('flash', x, y, 0, 0, R * 1.3, '#fff3c0', 0.25);
  for (let i = 0; i < 34; i++) { const a = rnd(0, TAU), s = rnd(150, 650); addParticle('fire', x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(14, 30), null, rnd(0.35, 0.7)); }
  for (let i = 0; i < 16; i++) { const a = rnd(0, TAU), s = rnd(30, 160); addParticle('smoke', x, y, Math.cos(a) * s, Math.sin(a) * s - 40, rnd(22, 44), 'rgba(60,55,55,0.55)', rnd(1.2, 2.2)); }
  for (let i = 0; i < 24; i++) { const a = rnd(0, TAU), s = rnd(300, 900); addParticle('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, 3, '#ffd34a', rnd(0.3, 0.7)); }
  addParticle('ring', x, y, 0, 0, R, 'rgba(255,240,200,0.8)', 0.4);
  for (const b of Composite.allBodies(engine.world)) {
    if (b.isStatic) continue;
    const dx = b.position.x - x, dy = b.position.y - y, d = Math.hypot(dx, dy);
    if (d > R) continue;
    const f = 1 - d / R, nx = d > 1 ? dx / d : 0, ny = d > 1 ? dy / d : -1;
    Sleeping.set(b, false);
    const k = f * power / Math.sqrt(Math.max(1, b.mass));
    Body.setVelocity(b, { x: b.velocity.x + nx * k, y: b.velocity.y + ny * k - f * 3 });
    Body.setAngularVelocity(b, b.angularVelocity + rnd(-0.3, 0.3) * f);
    const e = b.plugin.e;
    if (e && e.kind !== 'soldier') hurt(e, f * f * 1100 + f * 160);
  }
}

// ---------------------------------------------------------------- particles
function addParticle(type, x, y, vx, vy, size, color, life) {
  if (state.particles.length > 900) state.particles.shift();
  state.particles.push({ type, x, y, vx, vy, size, color, life, max: life, rot: rnd(0, TAU), vr: rnd(-8, 8), text: null });
}
function debris(pos, e) {
  const cols = MATS[e.mat].debris, n = clamp((e.w * e.h) / 120, 8, 26) | 0;
  const c = Math.cos(e.body.angle), s = Math.sin(e.body.angle);
  for (let i = 0; i < n; i++) {
    const lx = rnd(-e.w / 2, e.w / 2), ly = rnd(-e.h / 2, e.h / 2);
    const x = pos.x + lx * c - ly * s, y = pos.y + lx * s + ly * c;
    addParticle(e.mat === 'glass' ? 'shard' : 'chunk', x, y, rnd(-220, 220) + e.body.velocity.x * 40, rnd(-380, -60), e.mat === 'glass' ? rnd(4, 9) : rnd(4, 10), cols[i % cols.length], rnd(0.8, 1.6));
  }
  for (let i = 0; i < 5; i++) addParticle('smoke', pos.x + rnd(-e.w / 3, e.w / 3), pos.y, rnd(-30, 30), rnd(-50, -10), rnd(14, 26), e.mat === 'glass' ? 'rgba(230,250,255,0.4)' : 'rgba(210,190,160,0.45)', rnd(0.6, 1.1));
}
function robotDeath(pos, r) {
  state.shake = Math.max(state.shake, 10);
  addParticle('flash', pos.x, pos.y, 0, 0, r * 3, '#ffe0d0', 0.18);
  for (let i = 0; i < 12; i++) { const a = rnd(0, TAU), s = rnd(60, 260); addParticle('smoke', pos.x, pos.y, Math.cos(a) * s, Math.sin(a) * s - 30, rnd(14, 30), 'rgba(200,180,150,0.6)', rnd(0.7, 1.3)); }
  for (let i = 0; i < 18; i++) { const a = rnd(0, TAU), s = rnd(200, 600); addParticle('spark', pos.x, pos.y, Math.cos(a) * s, Math.sin(a) * s, 3, i % 2 ? '#ffffff' : '#ffd34a', rnd(0.3, 0.7)); }
  for (let i = 0; i < 8; i++) addParticle('bolt', pos.x, pos.y, rnd(-250, 250), rnd(-450, -150), rnd(4, 7), ['#151515', '#b71c1c', '#8d5a3a'][i % 3], rnd(1, 1.8));
  addParticle('ring', pos.x, pos.y, 0, 0, r * 3, 'rgba(255,230,150,0.9)', 0.35);
}
function addScore(n, x, y, big) {
  if (state.attract) return;
  state.score += n;
  state.particles.push({ type: 'text', x, y, vx: 0, vy: -60, size: big ? 46 : 30, color: big ? '#ffe14a' : '#ffffff', life: 1.3, max: 1.3, text: bn(n), rot: 0, vr: 0 });
  Sound.score();
  updateHud();
}
function updateParticles(dt) {
  const ps = state.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]; p.life -= dt;
    if (p.life <= 0) { ps.splice(i, 1); continue; }
    switch (p.type) {
      case 'chunk': case 'shard': case 'bolt':
        p.vy += 1400 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y > GROUND - p.size * 0.4) { p.y = GROUND - p.size * 0.4; p.vy *= -0.3; p.vx *= 0.6; p.vr *= 0.5; }
        break;
      case 'spark': p.vy += 900 * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt; break;
      case 'fire': p.vx *= 0.9; p.vy *= 0.9; p.vy -= 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt; break;
      case 'smoke': case 'dust': p.vx *= 0.96; p.vy = p.vy * 0.96 - 20 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.size += 18 * dt; break;
      case 'text': p.y += p.vy * dt; p.vy *= 0.97; break;
      case 'poof': p.size += 60 * dt; break;
    }
  }
}

// ---------------------------------------------------------------- soldiers
function launch(px, py) {
  const type = state.loaded, def = SOLDIERS[type];
  const vx = (SLING.x - px) * LAUNCH_K, vy = (SLING.y - py) * LAUNCH_K;
  const body = Bodies.circle(px, py, def.r, { density: def.density, friction: 0.6, restitution: 0.32, frictionAir: AIR, sleepThreshold: 1e9 });
  Composite.add(engine.world, body);
  Body.setVelocity(body, { x: vx, y: vy });
  Body.setAngularVelocity(body, 0.05);
  const s = spawnSoldierEntity(type, body);
  state.loaded = null; state.trail = []; state.bandVib = 1;
  state.camMode = 'follow'; state.lastLaunched = s;
  Sound.launch(); setTimeout(() => Sound.cry(), 60);
  updateHint();
}
function spawnSoldierEntity(type, body) {
  const s = { kind: 'soldier', type, body, r: SOLDIERS[type].r, age: 0, restT: 0, hitOnce: false, abilityUsed: type === 'red', trailT: 0, fuse: 0 };
  body.plugin.e = s; state.flying.push(s); return s;
}
function useAbility(s) {
  if (s.abilityUsed || s.done) return;
  s.abilityUsed = true;
  const b = s.body, v = b.velocity, sp = Math.hypot(v.x, v.y) || 1;
  if (s.type === 'yellow') {
    const ns = Math.max(sp * 2, 32);
    Body.setVelocity(b, { x: v.x / sp * ns, y: v.y / sp * ns });
    Sound.dash();
    for (let i = 0; i < 16; i++) addParticle('spark', b.position.x, b.position.y, -v.x * rnd(10, 40) + rnd(-80, 80), -v.y * rnd(10, 40) + rnd(-80, 80), 3, '#fff2a0', rnd(0.2, 0.5));
    addParticle('ring', b.position.x, b.position.y, 0, 0, 60, 'rgba(255,240,150,0.9)', 0.25);
  } else if (s.type === 'blue') {
    Sound.split();
    for (const da of [-0.2, 0.2]) {
      const a = Math.atan2(v.y, v.x) + da;
      const nb = Bodies.circle(b.position.x, b.position.y, s.r, { density: SOLDIERS.blue.density, friction: 0.6, restitution: 0.32, frictionAir: AIR, sleepThreshold: 1e9 });
      Composite.add(engine.world, nb);
      Body.setVelocity(nb, { x: Math.cos(a) * sp, y: Math.sin(a) * sp });
      const ns = spawnSoldierEntity('blue', nb); ns.abilityUsed = true; ns.age = s.age;
    }
    addParticle('ring', b.position.x, b.position.y, 0, 0, 50, 'rgba(170,220,255,0.9)', 0.25);
  } else if (s.type === 'black') {
    const x = b.position.x, y = b.position.y;
    finishSoldier(s, true);
    explode(x, y, 230, 24);
  }
  updateHint();
}
function finishSoldier(s, silent) {
  if (s.done) return;
  s.done = true;
  Composite.remove(engine.world, s.body);
  if (!silent) for (let i = 0; i < 6; i++) addParticle('poof', s.body.position.x + rnd(-14, 14), s.body.position.y + rnd(-14, 14), 0, 0, rnd(10, 18), 'rgba(255,255,255,0.85)', rnd(0.35, 0.55));
}
function activeAbilitySoldier() {
  const s = state.lastLaunched;
  if (s && !s.done && !s.abilityUsed && (!s.hitOnce || s.type === 'black')) return s;
  return null;
}

// ---------------------------------------------------------------- camera & input
const camClamp = x => clamp(x, -180, Math.max(-180, state ? state.worldW - viewW + 180 : 0));
const slingCam = () => camClamp(SLING.x - viewW * 0.24);
const toWorld = (cx, cy) => ({ x: cx * DPR / scale + camX, y: cy * DPR / scale + camY });

canvas.addEventListener('pointerdown', ev => {
  Sound.init();
  if (!state || state.attract || state.paused || state.phase !== 'play') return;
  canvas.setPointerCapture(ev.pointerId);
  const w = toWorld(ev.clientX, ev.clientY);
  const s = activeAbilitySoldier();
  if (s) { useAbility(s); return; }
  if (state.loaded && state.loadAnim >= 1 && Math.hypot(w.x - SLING.x, w.y - SLING.y) < 120) {
    state.aim = { x: SLING.x, y: SLING.y, id: ev.pointerId, ox: w.x - SLING.x, oy: w.y - SLING.y };
    state.camMode = 'aim';
    return;
  }
  state.pan = { sx: ev.clientX, cam: camX, id: ev.pointerId };
});
canvas.addEventListener('pointermove', ev => {
  if (!state) return;
  if (state.aim && state.aim.id === ev.pointerId) {
    const w = toWorld(ev.clientX, ev.clientY);
    let dx = w.x - SLING.x, dy = w.y - SLING.y; const d = Math.hypot(dx, dy);
    if (d > MAX_DRAG) { dx = dx / d * MAX_DRAG; dy = dy / d * MAX_DRAG; }
    const ny = Math.min(SLING.y + dy, GROUND - SOLDIERS[state.loaded].r);
    state.aim.x = SLING.x + dx; state.aim.y = ny;
    Sound.stretch(Math.min(d, MAX_DRAG) / MAX_DRAG);
  } else if (state.pan && state.pan.id === ev.pointerId) {
    const dx = (ev.clientX - state.pan.sx) * DPR / scale;
    if (Math.abs(dx) > 4) state.camMode = 'manual';
    camX = camClamp(state.pan.cam - dx);
  }
});
function endPointer(ev) {
  if (!state) return;
  if (state.aim && state.aim.id === ev.pointerId) {
    const a = state.aim; state.aim = null;
    if (Math.hypot(a.x - SLING.x, a.y - SLING.y) > 25 && state.phase === 'play') launch(a.x, a.y);
  }
  if (state.pan && state.pan.id === ev.pointerId) state.pan = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', ev => { if (state && !state.attract) { camX = camClamp(camX + (ev.deltaY + ev.deltaX) / scale * 0.6); state.camMode = 'manual'; } }, { passive: true });
window.addEventListener('keydown', ev => {
  if (ev.key === 'r' || ev.key === 'R') { if (state && !state.attract) restartLevel(); }
  if (ev.key === 'Escape' || ev.key === 'p') { if (state && !state.attract && !state.ended) togglePause(); }
  if (ev.key === ' ') { const s = state && activeAbilitySoldier(); if (s) useAbility(s); }
});

// ---------------------------------------------------------------- update
function update(dt) {
  state.time += dt;
  if (state.slowmo > 0) state.slowmo -= dt;
  engine.timing.timeScale = state.slowmo > 0 ? 0.4 : 1;
  acc += dt; let steps = 0;
  while (acc >= 1 / 60 && steps < 4) { Engine.update(engine, STEP); processRemovals(); acc -= 1 / 60; steps++; }
  if (steps >= 4) acc = 0;

  for (const e of state.blocks) if (e.hitT > 0) e.hitT -= dt;
  for (const e of state.robots) {
    if (e.hitT > 0) e.hitT -= dt;
    const p = e.body.position;
    if (p.y > GROUND + 200 || p.x < -500 || p.x > state.worldW + 800) { if (!e.dead) { e.dead = true; state.removeQ.push(e); } }
    if (e.hp < e.maxHp * 0.5 && Math.random() < dt * 3) addParticle('spark', p.x + rnd(-e.r, e.r) * 0.6, p.y - e.r * 0.5, rnd(-80, 80), rnd(-200, -60), 2.5, '#ffd34a', 0.3);
  }
  for (const e of state.blocks) { const p = e.body.position; if (p.y > GROUND + 300 && !e.dead) { e.dead = true; state.removeQ.push(e); } }
  processRemovals();

  // soldiers
  for (const s of state.flying) {
    if (s.done) continue;
    s.age += dt;
    const b = s.body, p = b.position;
    if (!s.hitOnce) { s.trailT += dt; if (s.trailT > 0.035) { s.trailT = 0; state.trail.push({ x: p.x, y: p.y, s: s.r * (0.18 + Math.random() * 0.14) }); } }
    if (b.speed < 0.3) s.restT += dt; else s.restT = 0;
    if (s.type === 'black' && s.hitOnce && !s.abilityUsed) { s.fuse += dt; if (s.fuse > 1.6) useAbility(s); }
    const oob = p.x < -400 || p.x > state.worldW + 700 || p.y > GROUND + 300;
    if (s.restT > 1.1 || s.age > 12 || oob) finishSoldier(s);
  }
  const before = state.flying.length;
  state.flying = state.flying.filter(s => !s.done);
  if (before !== state.flying.length) updateHint();
  if (state.bandVib > 0) state.bandVib = Math.max(0, state.bandVib - dt * 2.2);
  if (state.loadAnim < 1) state.loadAnim = Math.min(1, state.loadAnim + dt * 2.2);
  state.blinkT -= dt; if (state.blinkT < -0.12) state.blinkT = rnd(1.5, 4);

  // game flow
  if (!state.attract && !state.ended) {
    if (state.robots.length === 0) {
      state.phase = 'win'; state.aim = null;
      state.winT += dt;
      if (state.winT > 1.3 && !state.bonusDone) {
        state.bonusDone = true;
        const rem = state.queue.length + (state.loaded ? 1 : 0);
        for (let i = 0; i < rem; i++) {
          const x = SLING.x - 95 - Math.max(0, i - (state.loaded ? 1 : 0)) * Math.min(54, 300 / Math.max(1, rem));
          setTimeout(() => { if (state && !state.attract) addScore(10000, i === 0 && state.loaded ? SLING.x : x, GROUND - 90, true); }, i * 300);
        }
        state.bonusWait = 1.2 + rem * 0.3;
      }
      if (state.bonusDone) { state.bonusWait -= dt; if (state.bonusWait <= 0) endLevel(true); }
    } else if (!state.loaded && state.flying.length === 0) {
      if (state.queue.length) {
        state.nextT += dt;
        if (state.nextT > 0.7) { state.nextT = 0; state.loaded = state.queue.shift(); state.loadAnim = 0; if (state.camMode !== 'manual' || true) state.camMode = 'aim'; }
      } else {
        state.loseT += dt;
        if (state.loseT > 2.8) endLevel(false);
      }
    }
  }

  // camera
  const sc = slingCam();
  if (state.attract) {
    const t = (Math.sin(state.time * 0.22 - Math.PI / 2) + 1) / 2;
    camX = lerp(sc, camClamp(state.fortX - viewW / 2), easeInOut(t));
  } else if (state.camMode === 'intro') {
    state.introT += dt;
    const t = clamp((state.introT - 1.0) / 1.6, 0, 1);
    camX = lerp(camClamp(state.fortX - viewW / 2), sc, easeInOut(t));
    if (t >= 1) state.camMode = 'aim';
  } else {
    let target = camX;
    if (state.camMode === 'aim') target = sc;
    else if (state.camMode === 'follow') {
      const s = state.lastLaunched;
      if (s && !s.done) target = camClamp(s.body.position.x - viewW * 0.4);
      else if (state.flying.length) target = camClamp(state.flying[0].body.position.x - viewW * 0.4);
    }
    camX += (target - camX) * Math.min(1, dt * 3.2);
  }
  state.shake *= Math.exp(-dt * 7);
  updateParticles(dt);
}

// ---------------------------------------------------------------- render
function buildSky() {
  const th = state.theme;
  skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, th.sky[0]); skyGrad.addColorStop(0.55, th.sky[1]); skyGrad.addColorStop(1, th.sky[2]);
  skyTheme = th;
}
function drawRidge(pts, step, p, cols) {
  const off = camX * p;
  ctx.setTransform(scale, 0, 0, scale, -off * scale, -camY * scale);
  const x0 = off - step * 2, x1 = off + viewW + step * 2;
  let i = Math.max(0, Math.floor((x0 + 2000) / step)) * 2;
  const g = ctx.createLinearGradient(0, GROUND - 650, 0, GROUND);
  g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
  ctx.beginPath(); ctx.moveTo(pts[i], GROUND + 400); let lx = pts[i];
  for (; i < pts.length; i += 2) { ctx.lineTo(pts[i], GROUND - pts[i + 1]); lx = pts[i]; if (pts[i] > x1) break; }
  ctx.lineTo(lx, GROUND + 400); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
}
function drawTree(t, y, th) {
  const s = t.s;
  ctx.fillStyle = th.tree[1];
  ctx.fillRect(t.x - 4 * s, y - 30 * s, 8 * s, 32 * s);
  if (t.k === 0) {
    for (let i = 0; i < 3; i++) {
      const w = (46 - i * 11) * s, yy = y - (28 + i * 26) * s;
      ctx.fillStyle = i % 2 ? th.tree[1] : th.tree[0];
      ctx.beginPath(); ctx.moveTo(t.x - w, yy); ctx.lineTo(t.x, yy - 46 * s); ctx.lineTo(t.x + w, yy); ctx.closePath(); ctx.fill();
    }
  } else {
    ctx.fillStyle = th.tree[0];
    ctx.beginPath(); ctx.arc(t.x, y - 62 * s, 32 * s, 0, TAU); ctx.arc(t.x - 24 * s, y - 44 * s, 24 * s, 0, TAU); ctx.arc(t.x + 24 * s, y - 46 * s, 26 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(t.x - 10 * s, y - 74 * s, 16 * s, 0, TAU); ctx.fill();
  }
}
function drawBackground() {
  const th = state.theme, sc = state.sc;
  if (skyTheme !== th) buildSky();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
  if (th.stars) {
    for (const s of sc.stars) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(state.time * 1.5 + s.p));
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.s * DPR, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // sun / moon
  const sx = W * 0.78 - camX * 0.03 * scale, sy = H * (th.moon ? 0.18 : state.L.theme === 'sunset' ? 0.52 : 0.2), sr = Math.min(W, H) * 0.06;
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 6);
  glow.addColorStop(0, `rgba(${th.glow},0.55)`); glow.addColorStop(1, `rgba(${th.glow},0)`);
  ctx.fillStyle = glow; ctx.fillRect(sx - sr * 6, sy - sr * 6, sr * 12, sr * 12);
  ctx.fillStyle = th.sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
  if (th.moon) { ctx.fillStyle = 'rgba(150,160,200,0.35)'; for (const [a, b, c] of [[-.3, -.2, .22], [.25, .2, .16], [.1, -.4, .1]]) { ctx.beginPath(); ctx.arc(sx + a * sr, sy + b * sr, c * sr, 0, TAU); ctx.fill(); } }

  drawRidge(sc.far, 55, 0.1, th.far);
  // haze
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const hy = (GROUND - camY) * scale;
  const hz = ctx.createLinearGradient(0, hy - 380 * scale, 0, hy);
  hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(1, th.haze);
  ctx.fillStyle = hz; ctx.fillRect(0, hy - 380 * scale, W, 380 * scale);
  drawRidge(sc.near, 45, 0.22, th.near);
  // clouds
  const cp = 0.3, off = camX * cp, span = 5200;
  ctx.setTransform(scale, 0, 0, scale, -off * scale, -camY * scale);
  for (const c of sc.clouds) {
    let x = ((c.x + state.time * c.v - off) % span + span) % span + off - 600;
    const img = state.clouds[c.sp];
    ctx.globalAlpha = th.moon ? 0.6 : 0.92;
    ctx.drawImage(img, x, c.y, img.width * c.s, img.height * c.s);
  }
  ctx.globalAlpha = 1;
  // hills with trees
  const hp = 0.5, hoff = camX * hp;
  ctx.setTransform(scale, 0, 0, scale, -hoff * scale, -camY * scale);
  const x0 = hoff - 100, x1 = hoff + viewW + 100;
  for (const t of sc.trees) if (t.x > x0 && t.x < x1) drawTree(t, GROUND - sc.hillH(t.x) + 14, th);
  const hg = ctx.createLinearGradient(0, GROUND - 200, 0, GROUND);
  hg.addColorStop(0, th.hills[0]); hg.addColorStop(1, th.hills[1]);
  ctx.beginPath(); ctx.moveTo(x0, GROUND + 200);
  for (let x = x0; x <= x1 + 40; x += 30) ctx.lineTo(x, GROUND - sc.hillH(x));
  ctx.lineTo(x1 + 40, GROUND + 200); ctx.closePath(); ctx.fillStyle = hg; ctx.fill();
}
function drawGround() {
  const th = state.theme, sc = state.sc;
  const x0 = camX - 120, x1 = camX + viewW + 120;
  const dg = ctx.createLinearGradient(0, GROUND, 0, GROUND + 320);
  dg.addColorStop(0, th.dirt[0]); dg.addColorStop(1, th.dirt[1]);
  ctx.fillStyle = dg; ctx.fillRect(x0, GROUND, x1 - x0, 900);
  for (const p of sc.pebbles) if (p.x > x0 && p.x < x1) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, p.rx, p.ry, p.a, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,200,0.12)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx, p.ry, p.a, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x0, GROUND + 14, x1 - x0, 8);
  ctx.fillStyle = th.grassDark; ctx.fillRect(x0, GROUND - 2, x1 - x0, 18);
  // blades
  const bl = sc.blades; let i = Math.max(0, Math.floor((x0 + 1800) / 6)) * 2;
  ctx.fillStyle = th.grass; ctx.beginPath(); ctx.moveTo(x0, GROUND + 10);
  for (; i < bl.length; i += 2) {
    const bx = -1800 + (i / 2) * 6; if (bx > x1) break;
    const sway = Math.sin(state.time * 2 + bx * 0.02) * 1.5;
    ctx.lineTo(bx - 3, GROUND + 2); ctx.lineTo(bx + bl[i + 1] + sway, GROUND - bl[i]); ctx.lineTo(bx + 3, GROUND + 2);
  }
  ctx.lineTo(x1, GROUND + 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0, GROUND, x1 - x0, 3);
  for (const f of sc.flowers) if (f.x > x0 && f.x < x1) { ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, GROUND - 6, f.s, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(f.x, GROUND - 6, f.s * 0.4, 0, TAU); ctx.fill(); }
}
function drawHills() {
  const th = state.theme;
  for (const h of state.hills) {
    const x = h.x - h.w / 2, y = GROUND - h.h;
    const g = ctx.createLinearGradient(0, y, 0, GROUND);
    g.addColorStop(0, th.dirt[0]); g.addColorStop(1, th.dirt[1]);
    ctx.beginPath(); ctx.moveTo(x, GROUND + 5); ctx.lineTo(x, y + 40); ctx.quadraticCurveTo(x, y, x + 40, y); ctx.lineTo(x + h.w - 40, y); ctx.quadraticCurveTo(x + h.w, y, x + h.w, y + 40); ctx.lineTo(x + h.w, GROUND + 5); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    for (const r of h.rocks) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(h.x + r.x, y + r.y + 2, r.rx, r.ry, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,235,210,0.14)'; ctx.beginPath(); ctx.ellipse(h.x + r.x, y + r.y, r.rx, r.ry, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + h.w - 18, y, 18, h.h + 10);
    ctx.restore();
    rr(ctx, x - 4, y - 4, h.w + 8, 20, 10); ctx.fillStyle = th.grassDark; ctx.fill();
    rr(ctx, x - 2, y - 7, h.w + 4, 14, 8); ctx.fillStyle = th.grass; ctx.fill();
    ctx.fillStyle = th.grass;
    for (let bx = x + 4; bx < x + h.w - 4; bx += 7) { ctx.beginPath(); ctx.moveTo(bx - 3, y - 3); ctx.lineTo(bx + Math.sin(bx) * 3, y - 10 - (bx * 7 % 9)); ctx.lineTo(bx + 3, y - 3); ctx.fill(); }
  }
}
function drawBlock(e) {
  const b = e.body;
  ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
  ctx.drawImage(e.tex, -e.w / 2, -e.h / 2, e.w, e.h);
  const f = 1 - e.hp / e.maxHp;
  if (f > 0.15) {
    const n = f > 0.7 ? 4 : f > 0.45 ? 3 : f > 0.25 ? 2 : 1;
    ctx.strokeStyle = e.mat === 'glass' ? 'rgba(255,255,255,0.95)' : 'rgba(30,18,8,0.75)';
    ctx.lineWidth = e.mat === 'glass' ? 1.2 : 1.6;
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const c = e.cracks[i]; ctx.moveTo(c[0], c[1]); for (let k = 2; k < c.length; k += 2) ctx.lineTo(c[k], c[k + 1]); }
    ctx.stroke();
  }
  if (e.hitT > 0) { ctx.globalAlpha = e.hitT / 0.15 * 0.35; ctx.fillStyle = '#fff'; ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h); ctx.globalAlpha = 1; }
  ctx.restore();
}
function drawShadows() {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (const e of state.blocks) { const p = e.body.position; if (p.y > GROUND - 140) { const w = Math.max(e.w, e.h) * 0.6; ctx.beginPath(); ctx.ellipse(p.x, GROUND + 2, w, 5, 0, 0, TAU); ctx.fill(); } }
  for (const e of state.robots) { const p = e.body.position; if (p.y > GROUND - 140) { ctx.beginPath(); ctx.ellipse(p.x, GROUND + 2, e.r * 0.9, 5, 0, 0, TAU); ctx.fill(); } }
}
function bandPoint() {
  if (state.aim) return state.aim;
  if (state.loaded) {
    const t = easeInOut(state.loadAnim);
    if (t < 1) return null;
    return SLING;
  }
  const v = state.bandVib;
  return { x: SLING.x + Math.sin(v * 40) * v * 16, y: SLING.y + Math.cos(v * 33) * v * 8 };
}
const BACK_TIP = { x: SLING.x + 20, y: SLING.y - 10 }, FRONT_TIP = { x: SLING.x - 18, y: SLING.y + 2 };
function drawCatapultPart(front) {
  const bx = SLING.x, base = GROUND;
  ctx.lineCap = 'round';
  const wood = (x1, y1, cx, cy, x2, y2, w) => {
    ctx.strokeStyle = '#4a2a12'; ctx.lineWidth = w + 5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
    ctx.strokeStyle = '#9a6332'; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,170,0.35)'; ctx.lineWidth = w * 0.3; ctx.beginPath(); ctx.moveTo(x1 - w * 0.2, y1); ctx.quadraticCurveTo(cx - w * 0.2, cy, x2 - w * 0.2, y2); ctx.stroke();
  };
  if (!front) {
    wood(bx + 2, base - 100, bx + 22, base - 125, BACK_TIP.x, BACK_TIP.y, 15);
    ctx.fillStyle = '#c8b27a'; for (let i = 0; i < 3; i++) ctx.fillRect(BACK_TIP.x - 9, BACK_TIP.y + 6 + i * 6, 18, 3);
  } else {
    wood(bx, base + 5, bx, base - 60, bx, base - 100, 20);
    wood(bx - 2, base - 100, bx - 22, base - 120, FRONT_TIP.x, FRONT_TIP.y, 15);
    ctx.fillStyle = '#c8b27a'; for (let i = 0; i < 3; i++) ctx.fillRect(FRONT_TIP.x - 9, FRONT_TIP.y + 6 + i * 6, 18, 3);
    for (let i = 0; i < 4; i++) ctx.fillRect(bx - 12, base - 92 + i * 7, 24, 3);
    // sandbags
    const bags = [[bx - 38, base - 14, 30, 16], [bx + 38, base - 14, 30, 16], [bx, base - 16, 30, 17], [bx - 20, base - 40, 28, 15], [bx + 20, base - 40, 28, 15]];
    for (const [x, y, rx, ry] of bags) {
      const g = ctx.createLinearGradient(0, y - ry, 0, y + ry); g.addColorStop(0, '#e3cf98'); g.addColorStop(1, '#9c8452');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#6e5a30'; ctx.lineWidth = 2; ctx.stroke();
      ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.ellipse(x, y, rx * 0.75, ry * 0.6, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.setLineDash([]);
    }
    // flag
    const fx = bx - 80, ft = base - 170;
    ctx.strokeStyle = '#5b5b5b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(fx, base - 20); ctx.lineTo(fx, ft); ctx.stroke();
    ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(fx, ft, 4, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(fx + 2, ft + 4);
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let k = 0; k <= 10; k++) { const u = k / 10; ctx.lineTo(u * 66, Math.sin(state.time * 5 - u * 5) * 4 * u); }
    for (let k = 10; k >= 0; k--) { const u = k / 10; ctx.lineTo(u * 66, 40 + Math.sin(state.time * 5 - u * 5) * 4 * u); }
    ctx.closePath(); ctx.fillStyle = '#006a4e'; ctx.fill();
    ctx.fillStyle = '#f42a41'; ctx.beginPath(); ctx.arc(29, 20 + Math.sin(state.time * 5 - 2.2) * 2, 11, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function drawBand(tip, p, r) {
  if (!p) return;
  const dx = p.x - SLING.x, dy = p.y - SLING.y, d = Math.hypot(dx, dy) || 1;
  const bx = p.x + dx / d * (r * 0.8), by = p.y + dy / d * (r * 0.8);
  ctx.strokeStyle = '#2e1a0e'; ctx.lineWidth = 8 - Math.min(4, d / 50); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(bx, by); ctx.stroke();
  return { bx, by };
}
function drawSling() {
  const p = bandPoint();
  const type = state.loaded;
  const r = type ? SOLDIERS[type].r : 12;
  drawCatapultPart(false);
  drawBand(BACK_TIP, p, r);
  if (type) {
    let x, y;
    const t = easeInOut(state.loadAnim);
    if (t < 1) { const sx = SLING.x - 95, sy = GROUND - r; x = lerp(sx, SLING.x, t); y = lerp(sy, SLING.y, t) - Math.sin(t * Math.PI) * 120; }
    else { x = p.x; y = p.y; }
    const mood = state.aim ? 'yell' : state.blinkT < 0 ? 'blink' : 'grit';
    drawSoldier(ctx, type, x, y, r, state.aim ? Math.atan2(SLING.y - y, SLING.x - x) * 0.3 : 0, mood, state.time);
  }
  if (p) { // pouch
    const dx = p.x - SLING.x, dy = p.y - SLING.y, d = Math.hypot(dx, dy) || 1;
    ctx.save(); ctx.translate(p.x + dx / d * r * 0.8, p.y + dy / d * r * 0.8); ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2);
    rr(ctx, -r * 0.7, -5, r * 1.4, 10, 5); ctx.fillStyle = '#5a3418'; ctx.fill(); ctx.strokeStyle = '#2e1a0e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  drawBand(FRONT_TIP, p, r);
  drawCatapultPart(true);
}
function drawQueue() {
  const start = state.loaded && state.loadAnim < 1 ? 1 : 0;
  for (let i = 0; i < state.queue.length; i++) {
    const type = state.queue[i], r = SOLDIERS[type].r;
    const x = SLING.x - 95 - (i + start) * Math.min(54, 300 / Math.max(1, state.queue.length + start));
    const hop = Math.max(0, Math.sin(state.time * 4 + i * 1.3)) * 6;
    drawSoldier(ctx, type, x, GROUND - r - hop, r, 0, state.blinkT < 0 && i % 2 ? 'blink' : 'grit', state.time + i);
  }
}
function drawTrail() {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const t of state.trail) { ctx.beginPath(); ctx.arc(t.x, t.y, t.s, 0, TAU); ctx.fill(); }
}
function drawAim() {
  if (!state.aim) return;
  let px = state.aim.x, py = state.aim.y;
  let vx = (SLING.x - px) * LAUNCH_K, vy = (SLING.y - py) * LAUNCH_K;
  const pw = Math.hypot(vx, vy) / (MAX_DRAG * LAUNCH_K);
  for (let i = 1; i <= 70; i++) {
    vx *= 1 - AIR; vy = vy * (1 - AIR) + GRAV; px += vx; py += vy;
    if (py > GROUND) break;
    if (i % 3 === 0) {
      const a = 1 - i / 75;
      ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
      ctx.beginPath(); ctx.arc(px, py, 4.5 * a + 1.5, 0, TAU); ctx.fill();
    }
  }
  // power meter
  ctx.save(); ctx.translate(SLING.x - 70, SLING.y - 120);
  rr(ctx, 0, 0, 140, 12, 6); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 140, 0); g.addColorStop(0, '#5ee05e'); g.addColorStop(0.6, '#ffd23a'); g.addColorStop(1, '#ff4a2a');
  rr(ctx, 2, 2, 136 * pw, 8, 4); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}
function drawFlying() {
  for (const s of state.flying) {
    const b = s.body;
    const mood = s.hitOnce ? (s.restT > 0.3 ? 'blink' : 'grit') : 'yell';
    if (s.type === 'yellow' && s.abilityUsed && !s.hitOnce) {
      ctx.fillStyle = 'rgba(255,240,150,0.35)';
      ctx.beginPath(); ctx.arc(b.position.x - b.velocity.x * 1.5, b.position.y - b.velocity.y * 1.5, s.r * 0.9, 0, TAU); ctx.fill();
    }
    drawSoldier(ctx, s.type, b.position.x, b.position.y, s.r, b.angle, mood, state.time);
    if (s.type === 'black' && s.hitOnce && !s.abilityUsed && Math.sin(state.time * 30) > 0) {
      ctx.fillStyle = 'rgba(255,60,40,0.35)'; ctx.beginPath(); ctx.arc(b.position.x, b.position.y, s.r * 1.1, 0, TAU); ctx.fill();
    }
  }
}
function drawParticles() {
  for (const p of state.particles) {
    const a = clamp(p.life / p.max, 0, 1);
    switch (p.type) {
      case 'chunk': case 'bolt':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, a * 2);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-p.size / 2, p.size * 0.15, p.size, p.size * 0.18);
        ctx.restore(); break;
      case 'shard':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, a * 2) * 0.85;
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.5, p.size * 0.6); ctx.lineTo(-p.size * 0.5, p.size * 0.4); ctx.closePath(); ctx.fill();
        ctx.restore(); break;
      case 'spark':
        ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); break;
      case 'fire': {
        ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.35, 'rgba(255,190,60,0.9)'); g.addColorStop(1, 'rgba(230,60,10,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); break;
      }
      case 'smoke': case 'dust': case 'poof':
        ctx.globalAlpha = a * (p.type === 'poof' ? 1 : 0.9); ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); break;
      case 'flash': {
        ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); break;
      }
      case 'ring':
        ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 6 * a;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - a * 0.8), 0, TAU); ctx.stroke(); break;
      case 'text': {
        const pop = Math.min(1, (p.max - p.life) * 8);
        ctx.globalAlpha = Math.min(1, a * 2.5);
        ctx.font = `800 ${p.size * (0.6 + pop * 0.4)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(40,20,10,0.85)'; ctx.lineJoin = 'round';
        ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y); break;
      }
    }
  }
  ctx.globalAlpha = 1;
}
function render() {
  drawBackground();
  const sx = (Math.random() - 0.5) * state.shake, sy = (Math.random() - 0.5) * state.shake;
  ctx.setTransform(scale, 0, 0, scale, (-camX + sx) * scale, (-camY + sy) * scale);
  drawGround();
  drawHills();
  drawShadows();
  drawTrail();
  for (const e of state.blocks) drawBlock(e);
  for (const e of state.robots) drawRobot(ctx, e, state.time);
  drawQueue();
  drawSling();
  drawFlying();
  drawParticles();
  drawAim();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- UI
const $ = id => document.getElementById(id);
const ui = { hud: $('hud'), menu: $('menu'), levels: $('levels'), result: $('result'), pause: $('pause'), hint: $('hint') };
function show(el, on) { el.classList.toggle('hidden', !on); }
let lastScoreShown = -1;
function updateHud(force) {
  if (!state || state.attract) return;
  if (force || state.score !== lastScoreShown) {
    $('scoreVal').textContent = bn(state.score);
    if (!force) { const el = $('scoreVal'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    lastScoreShown = state.score;
  }
  if (force) {
    $('lvlLabel').textContent = `Level ${bn(state.idx + 1)} · ${state.L.name}`;
    $('bestVal').textContent = bn(progress.best[state.idx] || 0);
  }
}
function updateHint() {
  if (!state || state.attract) { show(ui.hint, false); return; }
  const s = activeAbilitySoldier();
  if (s) { ui.hint.textContent = `👆 Tap now — ${SOLDIERS[s.type].tap}`; show(ui.hint, true); }
  else show(ui.hint, false);
}
function starsFor(score) { return score >= state.star3 ? 3 : score >= state.star2 ? 2 : 1; }
function endLevel(win) {
  if (state.ended) return;
  state.ended = true; state.phase = 'end'; state.aim = null;
  show(ui.hint, false);
  const idx = state.idx, score = state.score;
  let st = 0;
  if (win) {
    st = starsFor(score);
    progress.stars[idx] = Math.max(progress.stars[idx] || 0, st);
    progress.best[idx] = Math.max(progress.best[idx] || 0, score);
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, idx + 2));
    saveProgress();
  }
  setTimeout(() => {
    const t = $('resTitle');
    t.textContent = win ? (idx === LEVELS.length - 1 ? 'Total Victory! 🏆' : 'Victory!') : 'The Goons Win!';
    t.className = win ? 'win' : 'lose';
    const stars = $('resStars').children;
    for (const s of stars) s.className = '';
    $('resScore').textContent = bn(score);
    $('resBest').textContent = `Best score: ${bn(progress.best[idx] || 0)}`;
    show($('resNext'), win && idx < LEVELS.length - 1);
    show(ui.result, true);
    if (win) { Sound.win(); for (let i = 0; i < st; i++) setTimeout(() => { stars[i].className = 'on'; Sound.star(i); }, 450 + i * 380); }
    else Sound.lose();
  }, 500);
}
function startLevel(i) {
  Sound.init();
  show(ui.menu, false); show(ui.levels, false); show(ui.result, false); show(ui.pause, false); show(ui.hud, true);
  loadLevel(i, false);
  updateHint();
}
function restartLevel() { if (state) startLevel(state.idx); }
function togglePause() {
  if (!state || state.ended) return;
  state.paused = !state.paused;
  show(ui.pause, state.paused);
}
function openLevels() {
  const grid = $('levelGrid'); grid.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button');
    const locked = i + 1 > progress.unlocked;
    b.className = 'lv' + (locked ? ' locked' : '');
    const st = progress.stars[i] || 0;
    b.innerHTML = locked ? `<div class="n">🔒</div><span class="nm">${L.name}</span>`
      : `<div class="n">${bn(i + 1)}</div><span class="nm">${L.name}</span><div class="st">${[0, 1, 2].map(k => `<span class="${k < st ? 'on' : 'off'}">★</span>`).join('')}</div>`;
    b.onclick = () => { if (locked) return; Sound.click(); startLevel(i); };
    b.style.animation = `pop .4s ${i * 0.04}s backwards`;
    grid.appendChild(b);
  });
  show(ui.menu, false); show(ui.result, false); show(ui.pause, false); show(ui.hud, false); show(ui.hint, false);
  show(ui.levels, true);
  if (!state || !state.attract) loadLevel(0, true);
}
function openMenu() {
  show(ui.levels, false); show(ui.result, false); show(ui.pause, false); show(ui.hud, false); show(ui.hint, false);
  show(ui.menu, true);
  if (!state || !state.attract) loadLevel(0, true);
}
function syncSoundLabels() {
  const on = Sound.enabled;
  $('btnSound').textContent = on ? '🔊 Sound: On' : '🔇 Sound: Off';
  $('pSound').textContent = on ? '🔊 Sound: On' : '🔇 Sound: Off';
}
function buildRoster() {
  const ro = $('roster');
  Object.entries(SOLDIERS).forEach(([k, s], i) => {
    const d = document.createElement('div'); d.className = 'hero'; d.style.animationDelay = (0.3 + i * 0.1) + 's';
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    d.appendChild(c);
    d.insertAdjacentHTML('beforeend', `<b>${s.name}</b><small>${s.ab}</small>`);
    ro.appendChild(d);
    d._draw = t => { const g = c.getContext('2d'); g.clearRect(0, 0, 128, 128); drawSoldier(g, k, 64, 72 - Math.abs(Math.sin(t * 3 + i)) * 6, 40, 0, Math.sin(t * 0.9 + i * 2) > 0.97 ? 'blink' : 'grit', t); };
  });
}
$('btnPlay').onclick = () => { Sound.init(); Sound.click(); openLevels(); };
$('btnSound').onclick = () => { Sound.init(); Sound.toggle(); syncSoundLabels(); Sound.click(); };
$('pSound').onclick = () => { Sound.toggle(); syncSoundLabels(); Sound.click(); };
$('btnBack').onclick = () => { Sound.click(); openMenu(); };
$('btnPause').onclick = () => { Sound.click(); togglePause(); };
$('btnRestart').onclick = () => { Sound.click(); restartLevel(); };
$('pResume').onclick = () => { Sound.click(); togglePause(); };
$('pRestart').onclick = () => { Sound.click(); restartLevel(); };
$('pMenu').onclick = () => { Sound.click(); openLevels(); };
$('resMenu').onclick = () => { Sound.click(); openLevels(); };
$('resRetry').onclick = () => { Sound.click(); restartLevel(); };
$('resNext').onclick = () => { Sound.click(); startLevel(Math.min(LEVELS.length - 1, state.idx + 1)); };
document.addEventListener('visibilitychange', () => { if (document.hidden && state && !state.attract && !state.ended && !state.paused) togglePause(); });

// ---------------------------------------------------------------- main loop
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (state && !state.paused) update(dt);
  if (state) render();
  if (!ui.menu.classList.contains('hidden')) for (const d of $('roster').children) d._draw(now / 1000);
  requestAnimationFrame(frame);
}
resize();
buildRoster();
syncSoundLabels();
openMenu();
requestAnimationFrame(frame);
if (document.fonts) document.fonts.ready.then(() => texCache.forEach((v, k) => { if (k.startsWith('tnt')) texCache.delete(k); }));
})();
