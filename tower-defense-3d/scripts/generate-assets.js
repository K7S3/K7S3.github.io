/* Nova Bastion 3D - procedural PWA asset generator.
 *
 * Renders the Command Spire mark (amber spire silhouette + cyan uplink ring
 * on a charcoal/indigo field) into icons/ at every manifest size, plus the
 * two store screenshots (stylized battlefield vista). Pure JS PNG writer:
 * no external assets, no npm dependencies, no PIL needed.
 *
 * Usage: node scripts/generate-assets.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');

/* ---------------- palette ---------------- */
const INK      = { r: 10,  g: 12,  b: 20  }; // charcoal/indigo field #0a0c14
const INK_TOP  = { r: 21,  g: 26,  b: 47  }; // indigo lift at top
const GROUND   = { r: 12,  g: 14,  b: 23  };
const AMBER    = { r: 245, g: 166, b: 35  }; // spire amber
const AMBER_HI = { r: 255, g: 210, b: 122 }; // spire highlight
const CYAN     = { r: 34,  g: 211, b: 238 }; // uplink cyan
const RUST     = { r: 248, g: 87,  b: 60  }; // rust swarm red
const DARK     = { r: 8,   g: 10,  b: 16  };

/* ---------------- tiny raster core ---------------- */
function makeImage(w, h) {
  return { w, h, data: Buffer.alloc(w * h * 4, 0) };
}
function blend(img, x, y, c, a) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= img.w || y >= img.h || a <= 0) return;
  if (a > 1) a = 1;
  const i = (y * img.w + x) * 4, d = img.data, ia = 1 - a;
  d[i]     = c.r * a + d[i] * ia;
  d[i + 1] = c.g * a + d[i + 1] * ia;
  d[i + 2] = c.b * a + d[i + 2] * ia;
  d[i + 3] = 255;
}
function fillRect(img, x0, y0, x1, y1, c, a) {
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++)
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) blend(img, x, y, c, a);
}
/* vertical gradient fill */
function vGrad(img, top, bottom) {
  for (let y = 0; y < img.h; y++) {
    const t = y / (img.h - 1);
    const c = {
      r: top.r + (bottom.r - top.r) * t,
      g: top.g + (bottom.g - top.g) * t,
      b: top.b + (bottom.b - top.b) * t,
    };
    fillRect(img, 0, y, img.w, y + 1, c, 1);
  }
}
/* soft radial glow */
function radialGlow(img, cx, cy, r, c, maxA, falloff) {
  falloff = falloff || 2;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(img.w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(img.h - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = Math.hypot(x - cx, y - cy) / r;
    if (d >= 1) continue;
    blend(img, x, y, c, maxA * Math.pow(1 - d, falloff));
  }
}
function filledCircle(img, cx, cy, r, c, a) {
  radialGlow(img, cx, cy, r, c, a, 0.15); // hard-ish disc
}
/* trapezoid band: spans half-width w0 at y0 to half-width w1 at y1, vertical gradient color */
function band(img, cx, w0, y0, w1, y1, cTop, cBot) {
  const top = Math.min(y0, y1), bot = Math.max(y0, y1);
  for (let y = Math.floor(top); y < Math.ceil(bot); y++) {
    const t = (y - top) / Math.max(1, bot - top);
    const w = w0 + (w1 - w0) * t;
    const c = {
      r: cTop.r + (cBot.r - cTop.r) * t,
      g: cTop.g + (cBot.g - cTop.g) * t,
      b: cTop.b + (cBot.b - cTop.b) * t,
    };
    for (let x = Math.floor(cx - w); x < Math.ceil(cx + w); x++) blend(img, x, y, c, 1);
  }
}
/* ellipse stroke */
function ellipseStroke(img, cx, cy, rx, ry, sw, c, alpha) {
  const x0 = Math.max(0, Math.floor(cx - rx - sw)), x1 = Math.min(img.w - 1, Math.ceil(cx + rx + sw));
  const y0 = Math.max(0, Math.floor(cy - ry - sw)), y1 = Math.min(img.h - 1, Math.ceil(cy + ry + sw));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    const e = Math.sqrt(dx * dx + dy * dy);
    const dist = Math.abs(e - 1) * Math.min(rx, ry);
    if (dist <= sw) blend(img, x, y, c, alpha * (1 - dist / sw));
  }
}
/* ellipse arc stroke, angles in radians, 0 = east, going clockwise in image coords */
function ellipseArc(img, cx, cy, rx, ry, sw, a0, a1, c, alpha) {
  const x0 = Math.max(0, Math.floor(cx - rx - sw)), x1 = Math.min(img.w - 1, Math.ceil(cx + rx + sw));
  const y0 = Math.max(0, Math.floor(cy - ry - sw)), y1 = Math.min(img.h - 1, Math.ceil(cy + ry + sw));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    const e = Math.sqrt(dx * dx + dy * dy);
    const dist = Math.abs(e - 1) * Math.min(rx, ry);
    if (dist > sw) continue;
    let ang = Math.atan2(y - cy, x - cx);
    if (ang < 0) ang += Math.PI * 2;
    let n0 = a0 % (Math.PI * 2), n1 = a1 % (Math.PI * 2);
    if (n0 < 0) n0 += Math.PI * 2; if (n1 < 0) n1 += Math.PI * 2;
    const inside = n0 <= n1 ? (ang >= n0 && ang <= n1) : (ang >= n0 || ang <= n1);
    if (inside) blend(img, x, y, c, alpha * (1 - dist / sw));
  }
}
function line(img, x0, y0, x1, y1, w, c, alpha) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(len);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    filledCircle(img, x, y, w / 2, c, alpha);
  }
}
/* seeded PRNG so the art is intentional and reproducible */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* darken toward corners */
function vignette(img, strength) {
  const cx = img.w / 2, cy = img.h / 2, r = Math.hypot(cx, cy);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const d = Math.hypot(x - cx, y - cy) / r;
    const i = (y * img.w + x) * 4;
    const f = 1 - strength * Math.pow(d, 2.2);
    img.data[i] *= f; img.data[i + 1] *= f; img.data[i + 2] *= f;
  }
}

/* ---------------- the Command Spire mark ---------------- */
/* s = canvas size, scale = fraction of the canvas the mark occupies (1 = full) */
function drawMark(s, scale) {
  const img = makeImage(s, s);
  vGrad(img, INK_TOP, DARK);
  vignette(img, 0.45);

  const cx = s / 2, markS = s * scale;
  const baseY = s / 2 + 0.36 * markS, topY = s / 2 - 0.42 * markS;

  // amber ambience behind the spire
  radialGlow(img, cx, baseY - 0.30 * markS, 0.48 * markS, AMBER, 0.28);
  // faint cyan haze along the uplink plane
  radialGlow(img, cx, baseY, 0.42 * markS, CYAN, 0.10);

  // uplink ring (back arc first)
  ellipseArc(img, cx, baseY + 0.01 * markS, 0.36 * markS, 0.13 * markS,
    markS / 42, Math.PI, Math.PI * 2, CYAN, 0.85);
  radialGlow(img, cx, baseY + 0.01 * markS, 0.36 * markS, CYAN, 0.06);

  // spire silhouette: stacked trapezoid bands with amber gradient
  const midY = baseY - 0.42 * markS, hiY = topY + 0.06 * markS;
  band(img, cx, 0.115 * markS, baseY, 0.038 * markS, midY, AMBER, AMBER_HI);
  band(img, cx, 0.038 * markS, midY, 0.014 * markS, hiY, AMBER, AMBER_HI);
  // dark right-side shading for depth
  band(img, cx + 0.035 * markS, 0.045 * markS, baseY, 0.008 * markS, hiY,
    { r: 60, g: 30, b: 8 }, { r: 90, g: 50, b: 14 });
  // antenna spike + tip light
  line(img, cx, hiY, cx, hiY - 0.09 * markS, 0.016 * markS, AMBER, 0.95);
  filledCircle(img, cx, hiY - 0.09 * markS, 0.020 * markS, AMBER_HI, 1);
  radialGlow(img, cx, hiY - 0.09 * markS, 0.09 * markS, AMBER_HI, 0.6);
  // cyan windows up the shaft
  for (let i = 0; i < 4; i++) {
    const t = i / 3, y = baseY - 0.05 * markS - t * 0.30 * markS;
    const w = 0.075 * markS * (1 - t * 0.7);
    filledCircle(img, cx, y, 0.012 * markS, CYAN, 0.95);
    line(img, cx - w, y, cx + w, y, 0.010 * markS, CYAN, 0.5);
  }
  // base platform with amber rim
  ellipseStroke(img, cx, baseY + 0.015 * markS, 0.16 * markS, 0.048 * markS,
    markS / 60, { r: 70, g: 60, b: 50 }, 0.9);
  radialGlow(img, cx, baseY + 0.015 * markS, 0.13 * markS, AMBER, 0.18);

  // uplink ring front arc over the spire (3D depth cue)
  ellipseArc(img, cx, baseY + 0.01 * markS, 0.36 * markS, 0.13 * markS,
    markS / 42, 0, Math.PI, CYAN, 0.95);
  // uplink nodes on the ring
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const nx = cx + Math.cos(a) * 0.36 * markS, ny = baseY + 0.01 * markS + Math.sin(a) * 0.13 * markS;
    filledCircle(img, nx, ny, 0.016 * markS, CYAN, 0.95);
    radialGlow(img, nx, ny, 0.06 * markS, CYAN, 0.5);
  }
  return img;
}

/* ---------------- battlefield vista screenshots ---------------- */
function drawSpire(img, cx, baseY, height, rnd) {
  const topY = baseY - height, midY = baseY - height * 0.62;
  const wBase = height * 0.11, wMid = height * 0.045, wTop = height * 0.016;
  radialGlow(img, cx, baseY - height * 0.4, height * 0.75, AMBER, 0.30);
  band(img, cx, wBase, baseY, wMid, midY, AMBER, AMBER_HI);
  band(img, cx, wMid, midY, wTop, topY + height * 0.05, AMBER, AMBER_HI);
  line(img, cx, topY + height * 0.05, cx, topY - height * 0.06, height * 0.014, AMBER, 0.9);
  filledCircle(img, cx, topY - height * 0.06, height * 0.016, AMBER_HI, 1);
  radialGlow(img, cx, topY - height * 0.06, height * 0.10, AMBER_HI, 0.55);
  for (let i = 0; i < 5; i++) {
    const t = i / 4, y = baseY - height * 0.08 - t * height * 0.48;
    filledCircle(img, cx, y, height * 0.008, CYAN, 0.95);
  }
  ellipseStroke(img, cx, baseY + height * 0.01, height * 0.30, height * 0.075, height / 55, CYAN, 0.85);
  ellipseArc(img, cx, baseY + height * 0.01, height * 0.30, height * 0.075, height / 55, 0, Math.PI, CYAN, 0.95);
  radialGlow(img, cx, baseY, height * 0.28, AMBER, 0.16);
}

function drawVista(w, h, landscape) {
  const img = makeImage(w, h);
  const rnd = mulberry32(landscape ? 2100 : 518);
  const horizon = landscape ? h * 0.42 : h * 0.34;
  const vpx = w / 2;

  // sky
  vGrad(img, { r: 9, g: 11, b: 22 }, { r: 30, g: 33, b: 66 });
  for (let y = 0; y < horizon; y++) {
    const t = y / horizon;
    const r = 9 + (30 - 9) * t, g = 11 + (33 - 11) * t, b = 22 + (66 - 22) * t;
    fillRect(img, 0, y, w, y + 1, { r, g, b }, 1);
  }
  // stars
  for (let i = 0; i < (landscape ? 130 : 110); i++) {
    const x = rnd() * w, y = rnd() * horizon * 0.92;
    filledCircle(img, x, y, rnd() * 1.6 + 0.4, { r: 200, g: 220, b: 255 }, 0.25 + rnd() * 0.55);
  }
  // amber horizon wash over the spire sector
  const spireX = landscape ? w * 0.68 : w * 0.5;
  radialGlow(img, spireX, horizon, w * 0.30, AMBER, 0.20);

  // ground
  for (let y = Math.floor(horizon); y < h; y++) {
    const t = (y - horizon) / (h - horizon);
    const c = {
      r: GROUND.r + 6 * t, g: GROUND.g + 6 * t, b: GROUND.b + 8 * t,
    };
    fillRect(img, 0, y, w, y + 1, c, 1);
  }
  // perspective grid (cyan, tactical)
  const spread = landscape ? w * 0.9 : w * 0.75;
  for (let i = -10; i <= 10; i++) {
    if (i === 0) continue;
    line(img, vpx + i * spread * 0.12, horizon, vpx + i * spread, h, 1.5, CYAN, 0.16);
  }
  for (let i = 0; i < 9; i++) {
    const t = Math.pow(i / 8, 2.1);
    const y = horizon + t * (h - horizon);
    line(img, 0, y, w, y, 1.5, CYAN, 0.10 + 0.10 * t);
  }

  // command spire (hero, right-of-center on wide / center on tall)
  const spireH = landscape ? h * 0.62 : h * 0.42;
  const spireBaseY = h * (landscape ? 0.86 : 0.82);
  drawSpire(img, spireX, spireBaseY, spireH, rnd);

  // allied turret outposts on the near flank
  const towers = landscape
    ? [[w * 0.16, h * 0.72, 0.16], [w * 0.30, h * 0.80, 0.22], [w * 0.07, h * 0.88, 0.28]]
    : [[w * 0.18, h * 0.60, 0.16], [w * 0.82, h * 0.66, 0.20], [w * 0.10, h * 0.78, 0.26]];
  const rustTargets = [];
  for (const [tx, ty, ts] of towers) {
    const th = spireH * ts;
    radialGlow(img, tx, ty - th * 0.4, th * 0.9, AMBER, 0.18);
    band(img, tx, th * 0.14, ty, th * 0.05, ty - th * 0.75, { r: 120, g: 90, b: 45 }, { r: 220, g: 160, b: 70 });
    filledCircle(img, tx, ty - th * 0.85, th * 0.06, AMBER_HI, 1);
    radialGlow(img, tx, ty - th * 0.85, th * 0.22, AMBER_HI, 0.5);
    rustTargets.push([tx, ty - th * 0.85]);
  }

  // the RUST swarm: red glints marching on the spire from the far gate
  const gateX = landscape ? w * 0.97 : w * 0.5, gateY = landscape ? h * 0.98 : h * 0.99;
  for (let i = 0; i < 46; i++) {
    const t = rnd();
    const x = spireX + (gateX - spireX) * t + (rnd() - 0.5) * w * 0.10 * (1 - t);
    const y = spireBaseY + (gateY - spireBaseY) * t * t + (rnd() - 0.5) * h * 0.05 * (1 - t);
    const size = 2 + rnd() * 5 * (1 - t * 0.5);
    radialGlow(img, x, y, size * 3.2, RUST, 0.35);
    filledCircle(img, x, y, size * 0.8, RUST, 0.95);
  }

  // tracer fire from the outposts into the swarm
  for (const [tx, ty] of rustTargets) {
    for (let k = 0; k < 2; k++) {
      const tx2 = spireX + (gateX - spireX) * (0.55 + rnd() * 0.3);
      const ty2 = spireBaseY + (gateY - spireBaseY) * (0.5 + rnd() * 0.3);
      line(img, tx, ty, tx2, ty2, 2.2, CYAN, 0.45);
    }
  }
  // uplink ring pulse arcs around the spire
  ellipseArc(img, spireX, spireBaseY + spireH * 0.01, spireH * 0.42, spireH * 0.105,
    spireH / 50, Math.PI * 0.15, Math.PI * 0.85, CYAN, 0.5);

  vignette(img, 0.42);
  return img;
}

/* ---------------- PNG writer (pure JS) ---------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function writePNG(img, outPath) {
  const w = img.w, h = img.h, src = img.data;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    src.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(outPath, png);
}

/* ---------------- run ---------------- */
function main() {
  const iconsDir = path.join(ROOT, 'icons');
  const shotsDir = path.join(ROOT, 'screenshots');
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(shotsDir, { recursive: true });

  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  for (const s of sizes) {
    const out = path.join(iconsDir, `icon-${s}.png`);
    writePNG(drawMark(s, 1.0), out);
    console.log('wrote', out);
  }
  // maskable: full-bleed field with the mark kept in the safe zone
  writePNG(drawMark(512, 0.72), path.join(iconsDir, 'icon-maskable-512.png'));
  console.log('wrote icons/icon-maskable-512.png');

  writePNG(drawVista(1280, 720, true), path.join(shotsDir, 'screenshot-wide.png'));
  console.log('wrote screenshots/screenshot-wide.png');
  writePNG(drawVista(720, 1280, false), path.join(shotsDir, 'screenshot-narrow.png'));
  console.log('wrote screenshots/screenshot-narrow.png');
}

if (require.main === module) main();
module.exports = { drawMark, drawVista, writePNG };
