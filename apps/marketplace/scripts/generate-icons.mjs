// Generates the PWA PNG icons from scratch — no image library, just zlib.
// Draws the TutorHub mark: a white "T" on the brand-teal rounded square.
// Run with: node apps/marketplace/scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const TEAL = [14, 143, 138]; // --th-primary (#0e8f8a)
const WHITE = [255, 255, 255];

/** CRC-32 (PNG chunk checksum). */
function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Encode an RGBA pixel buffer as a PNG. */
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  // 10..12 = compression/filter/interlace = 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function set(rgba, width, x, y, [r, g, b]) {
  const i = (y * width + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = 255;
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.18; // rounded-corner radius
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Rounded-square mask: corners outside the radius stay transparent.
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      const inCorner = cx < radius && cy < radius;
      const dist = Math.hypot(radius - cx, radius - cy);
      if (inCorner && dist > radius) continue; // transparent corner
      set(rgba, size, x, y, TEAL);
    }
  }
  // White "T": a top bar and a centered stem, with generous padding (maskable-safe).
  const pad = Math.round(size * 0.28);
  const barH = Math.round(size * 0.12);
  const stemW = Math.round(size * 0.12);
  const top = pad;
  const bottom = size - pad;
  for (let y = top; y < bottom; y++) {
    for (let x = pad; x < size - pad; x++) {
      const inBar = y < top + barH;
      const inStem = x >= (size - stemW) / 2 && x < (size + stemW) / 2;
      if (inBar || inStem) set(rgba, size, x, y, WHITE);
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), drawIcon(size));
  console.log(`wrote public/icon-${size}.png`);
}
