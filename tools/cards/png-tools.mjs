import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function channelsForColorType(colorType) {
  if (colorType === 6) return 4;
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 0) return 1;
  throw new Error(`Unsupported PNG color type ${colorType}; expected 0, 2, 4 or 6.`);
}

export function decodePng(path) {
  const data = readFileSync(path);
  if (!data.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${path} is not a PNG file.`);

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  let offset = 8;
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString('ascii');
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      interlace = chunk[12];
    } else if (type === 'IDAT') {
      idat.push(chunk);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8) throw new Error(`${path}: only 8-bit PNG files are supported.`);
  if (interlace !== 0) throw new Error(`${path}: interlaced PNG files are not supported.`);

  const channels = channelsForColorType(colorType);
  const bytesPerPixel = channels;
  const rowBytes = width * channels;
  const inflated = inflateSync(Buffer.concat(idat));
  const expected = height * (rowBytes + 1);
  if (inflated.length !== expected) {
    throw new Error(`${path}: invalid PNG payload length ${inflated.length}, expected ${expected}.`);
  }

  const raw = Buffer.alloc(rowBytes * height);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset++];
    const rowOffset = y * rowBytes;
    const prevOffset = (y - 1) * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const value = inflated[inputOffset++];
      const left = x >= bytesPerPixel ? raw[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? raw[prevOffset + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? raw[prevOffset + x - bytesPerPixel] : 0;
      let decoded;
      switch (filter) {
        case 0: decoded = value; break;
        case 1: decoded = value + left; break;
        case 2: decoded = value + up; break;
        case 3: decoded = value + Math.floor((left + up) / 2); break;
        case 4: decoded = value + paethPredictor(left, up, upLeft); break;
        default: throw new Error(`${path}: unsupported PNG filter ${filter}.`);
      }
      raw[rowOffset + x] = decoded & 0xff;
    }
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i += 1, p += channels) {
    const q = i * 4;
    if (colorType === 6) {
      rgba[q] = raw[p]; rgba[q + 1] = raw[p + 1]; rgba[q + 2] = raw[p + 2]; rgba[q + 3] = raw[p + 3];
    } else if (colorType === 2) {
      rgba[q] = raw[p]; rgba[q + 1] = raw[p + 1]; rgba[q + 2] = raw[p + 2]; rgba[q + 3] = 255;
    } else if (colorType === 4) {
      rgba[q] = raw[p]; rgba[q + 1] = raw[p]; rgba[q + 2] = raw[p]; rgba[q + 3] = raw[p + 1];
    } else {
      rgba[q] = raw[p]; rgba[q + 1] = raw[p]; rgba[q + 2] = raw[p]; rgba[q + 3] = 255;
    }
  }
  return { width, height, data: rgba };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, payload = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(payload.length + 12);
  out.writeUInt32BE(payload.length, 0);
  typeBuffer.copy(out, 4);
  payload.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuffer, payload])), payload.length + 8);
  return out;
}

export function encodePng(path, image) {
  const { width, height, data } = image;
  if (data.length !== width * height * 4) throw new Error('RGBA image size mismatch.');
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(scanlines, rowStart + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const file = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND'),
  ]);
  writeFileSync(path, file);
}

export function rotate180(image) {
  const out = new Uint8ClampedArray(image.data.length);
  const pixels = image.width * image.height;
  for (let i = 0; i < pixels; i += 1) {
    const from = i * 4;
    const to = (pixels - 1 - i) * 4;
    out[to] = image.data[from];
    out[to + 1] = image.data[from + 1];
    out[to + 2] = image.data[from + 2];
    out[to + 3] = image.data[from + 3];
  }
  return { width: image.width, height: image.height, data: out };
}


export function tintRgba(image, color) {
  const out = new Uint8ClampedArray(image.data.length);
  const [red, green, blue] = color;
  for (let i = 0; i < image.width * image.height; i += 1) {
    const src = i * 4;
    out[src] = red;
    out[src + 1] = green;
    out[src + 2] = blue;
    out[src + 3] = image.data[src + 3];
  }
  return { width: image.width, height: image.height, data: out };
}

export function resizeRgba(image, targetWidth, targetHeight) {
  if (image.width === targetWidth && image.height === targetHeight) return image;
  const out = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  const sxScale = image.width / targetWidth;
  const syScale = image.height / targetHeight;

  for (let y = 0; y < targetHeight; y += 1) {
    const sy = (y + 0.5) * syScale - 0.5;
    const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(sy)));
    const y1 = Math.max(0, Math.min(image.height - 1, y0 + 1));
    const fy = Math.max(0, Math.min(1, sy - Math.floor(sy)));
    for (let x = 0; x < targetWidth; x += 1) {
      const sx = (x + 0.5) * sxScale - 0.5;
      const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(sx)));
      const x1 = Math.max(0, Math.min(image.width - 1, x0 + 1));
      const fx = Math.max(0, Math.min(1, sx - Math.floor(sx)));
      const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
      const coords = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
      let alpha = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let i = 0; i < 4; i += 1) {
        const [px, py] = coords[i];
        const idx = (py * image.width + px) * 4;
        const a = image.data[idx + 3] / 255;
        const w = weights[i];
        alpha += a * w;
        red += image.data[idx] * a * w;
        green += image.data[idx + 1] * a * w;
        blue += image.data[idx + 2] * a * w;
      }
      const dst = (y * targetWidth + x) * 4;
      if (alpha > 1e-6) {
        out[dst] = Math.round(red / alpha);
        out[dst + 1] = Math.round(green / alpha);
        out[dst + 2] = Math.round(blue / alpha);
        out[dst + 3] = Math.round(alpha * 255);
      }
    }
  }
  return { width: targetWidth, height: targetHeight, data: out };
}


export function resizeRgbaArea(image, targetWidth, targetHeight) {
  if (image.width === targetWidth && image.height === targetHeight) return image;
  if (targetWidth >= image.width || targetHeight >= image.height) {
    return resizeRgba(image, targetWidth, targetHeight);
  }

  // Exact box/area resampling for strong minification. Unlike sampling a single
  // bilinear footprint, this averages every source pixel covered by an output
  // pixel, which preserves thin card lines and avoids WebGL-style aliasing.
  const horizontal = new Float64Array(targetWidth * image.height * 4);
  const scaleX = image.width / targetWidth;

  for (let y = 0; y < image.height; y += 1) {
    for (let dx = 0; dx < targetWidth; dx += 1) {
      const start = dx * scaleX;
      const end = (dx + 1) * scaleX;
      const first = Math.floor(start);
      const last = Math.ceil(end) - 1;
      let total = 0;
      let alpha = 0;
      let red = 0;
      let green = 0;
      let blue = 0;

      for (let sx = first; sx <= last; sx += 1) {
        const overlap = Math.max(0, Math.min(end, sx + 1) - Math.max(start, sx));
        if (overlap <= 0 || sx < 0 || sx >= image.width) continue;
        const si = (y * image.width + sx) * 4;
        const a = image.data[si + 3] / 255;
        total += overlap;
        alpha += a * overlap;
        red += image.data[si] * a * overlap;
        green += image.data[si + 1] * a * overlap;
        blue += image.data[si + 2] * a * overlap;
      }

      const hi = (y * targetWidth + dx) * 4;
      if (total > 0 && alpha > 1e-12) {
        horizontal[hi] = red / alpha;
        horizontal[hi + 1] = green / alpha;
        horizontal[hi + 2] = blue / alpha;
        horizontal[hi + 3] = alpha / total;
      }
    }
  }

  const out = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  const scaleY = image.height / targetHeight;
  for (let dy = 0; dy < targetHeight; dy += 1) {
    const start = dy * scaleY;
    const end = (dy + 1) * scaleY;
    const first = Math.floor(start);
    const last = Math.ceil(end) - 1;

    for (let x = 0; x < targetWidth; x += 1) {
      let total = 0;
      let alpha = 0;
      let red = 0;
      let green = 0;
      let blue = 0;

      for (let sy = first; sy <= last; sy += 1) {
        const overlap = Math.max(0, Math.min(end, sy + 1) - Math.max(start, sy));
        if (overlap <= 0 || sy < 0 || sy >= image.height) continue;
        const hi = (sy * targetWidth + x) * 4;
        const a = horizontal[hi + 3];
        total += overlap;
        alpha += a * overlap;
        red += horizontal[hi] * a * overlap;
        green += horizontal[hi + 1] * a * overlap;
        blue += horizontal[hi + 2] * a * overlap;
      }

      const di = (dy * targetWidth + x) * 4;
      if (total > 0 && alpha > 1e-12) {
        out[di] = Math.round(red / alpha);
        out[di + 1] = Math.round(green / alpha);
        out[di + 2] = Math.round(blue / alpha);
        out[di + 3] = Math.round((alpha / total) * 255);
      }
    }
  }
  return { width: targetWidth, height: targetHeight, data: out };
}

export function contain(image, boxWidth, boxHeight) {
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  return resizeRgba(image, width, height);
}

export function compositeOver(destination, source, x, y) {
  for (let sy = 0; sy < source.height; sy += 1) {
    const dy = y + sy;
    if (dy < 0 || dy >= destination.height) continue;
    for (let sx = 0; sx < source.width; sx += 1) {
      const dx = x + sx;
      if (dx < 0 || dx >= destination.width) continue;
      const si = (sy * source.width + sx) * 4;
      const sa = source.data[si + 3] / 255;
      if (sa <= 0) continue;
      const di = (dy * destination.width + dx) * 4;
      const da = destination.data[di + 3] / 255;
      const oa = sa + da * (1 - sa);
      if (oa <= 0) continue;
      destination.data[di] = Math.round((source.data[si] * sa + destination.data[di] * da * (1 - sa)) / oa);
      destination.data[di + 1] = Math.round((source.data[si + 1] * sa + destination.data[di + 1] * da * (1 - sa)) / oa);
      destination.data[di + 2] = Math.round((source.data[si + 2] * sa + destination.data[di + 2] * da * (1 - sa)) / oa);
      destination.data[di + 3] = Math.round(oa * 255);
    }
  }
}

export function placeContained(destination, source, box) {
  const fitted = contain(source, box.width, box.height);
  const draw = box.rotate180 ? rotate180(fitted) : fitted;
  const x = Math.round(box.x + (box.width - draw.width) / 2);
  const y = Math.round(box.y + (box.height - draw.height) / 2);
  compositeOver(destination, draw, x, y);
}
