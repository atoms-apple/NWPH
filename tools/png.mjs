/**
 * A minimal PNG encoder.
 *
 * The app needs raster icons for its web manifest, and the repository has no
 * dependencies and is not going to gain an image library for four files. Node
 * ships zlib, which is the only hard part of a PNG — the rest is four chunks
 * and a CRC.
 */

import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * Encode RGBA pixels as a PNG.
 *
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba  width * height * 4 bytes
 */
export function encodePng(width, height, rgba) {
  const stride = width * 4;
  // Filter byte 0 (none) in front of every scanline.
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: truecolour with alpha
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ── A tiny drawing surface ──────────────────────────────────────────────── */

/**
 * Just enough raster drawing for an app icon: a background, filled discs and
 * stroked line segments, all antialiased by supersampling.
 */
export function canvas(size, { scale = 4 } = {}) {
  const s = size * scale;
  const pixels = new Uint8Array(s * s * 4);

  const put = (x, y, [r, g, b], alpha) => {
    if (x < 0 || y < 0 || x >= s || y >= s || alpha <= 0) return;
    const i = (y * s + x) * 4;
    const a = Math.min(1, alpha);
    pixels[i] = Math.round(pixels[i] * (1 - a) + r * a);
    pixels[i + 1] = Math.round(pixels[i + 1] * (1 - a) + g * a);
    pixels[i + 2] = Math.round(pixels[i + 2] * (1 - a) + b * a);
    pixels[i + 3] = Math.round(pixels[i + 3] * (1 - a) + 255 * a);
  };

  const api = {
    fill(colour) {
      for (let i = 0; i < s * s; i++) {
        pixels[i * 4] = colour[0];
        pixels[i * 4 + 1] = colour[1];
        pixels[i * 4 + 2] = colour[2];
        pixels[i * 4 + 3] = 255;
      }
      return api;
    },
    /** Rounded rectangle, in unscaled units. */
    roundRect(x, y, w, h, radius, colour) {
      const [X, Y, W, H, R] = [x, y, w, h, radius].map((n) => n * scale);
      for (let py = Math.floor(Y); py < Y + H; py++) {
        for (let px = Math.floor(X); px < X + W; px++) {
          const dx = Math.max(X + R - px, px - (X + W - R), 0);
          const dy = Math.max(Y + R - py, py - (Y + H - R), 0);
          if (Math.hypot(dx, dy) <= R) put(px, py, colour, 1);
        }
      }
      return api;
    },
    disc(cx, cy, r, colour) {
      const [CX, CY, R] = [cx, cy, r].map((n) => n * scale);
      for (let py = Math.floor(CY - R - 1); py <= CY + R + 1; py++) {
        for (let px = Math.floor(CX - R - 1); px <= CX + R + 1; px++) {
          const d = Math.hypot(px + 0.5 - CX, py + 0.5 - CY);
          put(px, py, colour, Math.min(1, R - d + 0.5));
        }
      }
      return api;
    },
    /** A round-capped line segment. */
    line(x1, y1, x2, y2, width, colour) {
      const [X1, Y1, X2, Y2, W] = [x1, y1, x2, y2, width].map((n) => n * scale);
      const half = W / 2;
      const minX = Math.floor(Math.min(X1, X2) - half - 1);
      const maxX = Math.ceil(Math.max(X1, X2) + half + 1);
      const minY = Math.floor(Math.min(Y1, Y2) - half - 1);
      const maxY = Math.ceil(Math.max(Y1, Y2) + half + 1);
      const dx = X2 - X1;
      const dy = Y2 - Y1;
      const lengthSq = dx * dx + dy * dy || 1;
      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const t = Math.max(0, Math.min(1, ((px + 0.5 - X1) * dx + (py + 0.5 - Y1) * dy) / lengthSq));
          const d = Math.hypot(px + 0.5 - (X1 + t * dx), py + 0.5 - (Y1 + t * dy));
          put(px, py, colour, Math.min(1, half - d + 0.5));
        }
      }
      return api;
    },
    /** Downsample the supersampled buffer to the requested size. */
    toPng() {
      const out = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let r = 0; let g = 0; let b = 0; let a = 0;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const i = ((y * scale + sy) * s + (x * scale + sx)) * 4;
              r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; a += pixels[i + 3];
            }
          }
          const n = scale * scale;
          const i = (y * size + x) * 4;
          out[i] = Math.round(r / n);
          out[i + 1] = Math.round(g / n);
          out[i + 2] = Math.round(b / n);
          out[i + 3] = Math.round(a / n);
        }
      }
      return encodePng(size, size, out);
    },
  };

  return api;
}
