#!/usr/bin/env node
/**
 * 从 FBX 二进制内嵌贴图提取到 {ModelName}.fbm/，供 fbx2gltf 读取外部贴图路径。
 * 许多 UE/3ds Max 导出的 FBX 将 JPG/TGA 内嵌在文件中，但 fbx2gltf 只认同目录 .fbm。
 */
const fs = require("fs");
const path = require("path");

const TEXTURE_NAME_RE = /([A-Za-z0-9_.\-]+\.(?:jpe?g|png|tga|bmp|tif{1,2}))[\x00]/i;

function findFilenameBefore(data, contentIdx) {
  const start = Math.max(0, contentIdx - 320);
  const slice = data.subarray(start, contentIdx).toString("latin1");
  const matches = [...slice.matchAll(new RegExp(TEXTURE_NAME_RE.source, "gi"))];
  if (matches.length === 0) {
    return null;
  }
  return matches[matches.length - 1][1];
}

function detectFormat(data) {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return ".jpg";
  }
  if (data.length >= 8 && data[0] === 0x89 && data.slice(1, 4).toString("ascii") === "PNG") {
    return ".png";
  }
  if (data.length >= 18 && [2, 3, 10].includes(data[2])) {
    return ".tga";
  }
  return null;
}

function extractEmbeddedTextures(fbxPath) {
  const data = fs.readFileSync(fbxPath);
  const fbmDir = `${fbxPath.replace(/\.fbx$/i, "")}.fbm`;
  let extracted = 0;
  let offset = 0;

  while (offset < data.length) {
    const idx = data.indexOf("ContentR", offset);
    if (idx === -1) {
      break;
    }

    const sizeOffset = idx + "ContentR".length;
    if (sizeOffset + 4 > data.length) {
      break;
    }

    const size = data.readUInt32LE(sizeOffset);
    const contentStart = sizeOffset + 4;
    const contentEnd = contentStart + size;
    if (size <= 0 || contentEnd > data.length) {
      offset = idx + 1;
      continue;
    }

    const content = data.subarray(contentStart, contentEnd);
    let filename = findFilenameBefore(data, idx);
    const extHint = detectFormat(content);

    if (!filename && extHint) {
      filename = `embedded_${extracted}${extHint}`;
    }

    if (filename) {
      fs.mkdirSync(fbmDir, { recursive: true });
      const outPath = path.join(fbmDir, path.basename(filename));
      if (!fs.existsSync(outPath) || fs.statSync(outPath).size !== content.length) {
        fs.writeFileSync(outPath, content);
        extracted += 1;
      }
    }

    offset = idx + 1;
  }

  return extracted;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node fbx-extract-fbm.cjs <file.fbx>");
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`文件不存在: ${inputPath}`);
    process.exit(1);
  }

  const count = extractEmbeddedTextures(inputPath);
  if (count > 0) {
    console.log(`已提取 ${count} 个内嵌贴图: ${path.basename(inputPath)}`);
  }
}

module.exports = { extractEmbeddedTextures };

if (require.main === module) {
  main();
}
