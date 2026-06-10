/**
 * TGA (type 2/10) → PNG，供 glb-material-fix 修补 fbx2gltf 输出的 image/unknown 贴图。
 */
const zlib = require("zlib");

function decodeTga(buffer) {
  if (buffer.length < 18) {
    throw new Error("TGA 文件过短");
  }

  const idLength = buffer[0];
  const imageType = buffer[2];
  if (imageType !== 2 && imageType !== 10) {
    throw new Error(`不支持的 TGA 类型: ${imageType}`);
  }

  const width = buffer.readUInt16LE(12);
  const height = buffer.readUInt16LE(14);
  const bpp = buffer[16];
  if (width <= 0 || height <= 0) {
    throw new Error("TGA 尺寸无效");
  }

  const bytesPerPixel = bpp >> 3;
  if (bytesPerPixel !== 3 && bytesPerPixel !== 4) {
    throw new Error(`不支持的 TGA 位深: ${bpp}`);
  }

  const descriptor = buffer[17];
  const originTop = (descriptor & 0x20) !== 0;
  const headerSize = 18 + idLength;
  let offset = headerSize;
  const rgba = Buffer.alloc(width * height * 4, 255);

  for (let y = 0; y < height; y += 1) {
    const dstY = originTop ? y : height - 1 - y;
    for (let x = 0; x < width; x += 1) {
      let b;
      let g;
      let r;
      let a = 255;

      if (imageType === 2) {
        b = buffer[offset++];
        g = buffer[offset++];
        r = buffer[offset++];
        if (bytesPerPixel === 4) {
          a = buffer[offset++];
        }
      } else {
        const packet = buffer[offset++];
        const raw = (packet & 0x80) === 0;
        const count = (packet & 0x7f) + 1;
        for (let i = 0; i < count; i += 1) {
          if (raw || i === 0) {
            b = buffer[offset++];
            g = buffer[offset++];
            r = buffer[offset++];
            if (bytesPerPixel === 4) {
              a = buffer[offset++];
            }
          }
          const dstIndex = (dstY * width + x) * 4;
          rgba[dstIndex] = r;
          rgba[dstIndex + 1] = g;
          rgba[dstIndex + 2] = b;
          rgba[dstIndex + 3] = a;
          if (!raw && i + 1 < count) {
            continue;
          }
          x += 1;
          if (x >= width) {
            break;
          }
        }
        x -= 1;
        continue;
      }

      const dstIndex = (dstY * width + x) * 4;
      rgba[dstIndex] = r;
      rgba[dstIndex + 1] = g;
      rgba[dstIndex + 2] = b;
      rgba[dstIndex + 3] = a;
    }
  }

  return { width, height, rgba };
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng({ width, height, rgba }) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function isTgaBuffer(buffer) {
  return buffer.length >= 18 && [2, 3, 10].includes(buffer[2]);
}

function tgaHasAlpha(buffer) {
  if (!isTgaBuffer(buffer)) {
    return false;
  }
  if (buffer[16] === 32) {
    return true;
  }
  try {
    const { width, height, rgba } = decodeTga(buffer);
    let low = 0;
    for (let i = 0; i < width * height; i += 1) {
      if (rgba[i * 4 + 3] < 16) {
        low += 1;
      }
    }
    return low > width * height * 0.05;
  } catch {
    return false;
  }
}

function tgaToPng(buffer) {
  return encodePng(decodeTga(buffer));
}

module.exports = { decodeTga, encodePng, isTgaBuffer, tgaHasAlpha, tgaToPng };
