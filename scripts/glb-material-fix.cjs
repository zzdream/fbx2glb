#!/usr/bin/env node
/**
 * 修补 fbx2gltf 导出的 GLB：
 * - TGA 贴图转 PNG（Three.js / glTF 无法识别 image/unknown）
 * - 植被/草地 alpha 裁剪：BLEND → MASK + doubleSided
 * - Phong 转 PBR 的默认金属度修正：metallic 0 / roughness 1，贴近 FBX 漫反射观感
 * - 纯色/贴图标志牌：≥2 个标志色材质时用 KHR_materials_unlit（单材质 3D 道具如水马保留光照）
 * - 标志纯色 baseColorFactor：sRGB→linear（fbx2gltf 常把 Phong diffuse 当 linear 写入，蓝/绿会偏浅偏青）
 * - 玻璃类材质：baseColor alpha < 1 时补 alphaMode=BLEND
 * - 车灯 emissive 材质：补 baseColor、doubleSided，并排到场景末尾优先绘制
 * - materialProfile=lit：不加 unlit，剥离已有 unlit，材质受场景光（default 行为不变）
 */
const fs = require("fs");
const path = require("path");
const { isTgaBuffer, tgaHasAlpha, tgaToPng } = require("./tga-png.cjs");

const MATERIAL_PROFILES = new Set(["default", "lit"]);

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;

const LIGHT_NAME_RE =
  /(?:LightON|LightsON|indicator(?:s)?(?:Left|Right)?ON|brakeLightsON|Baideng|Huang|Hongdeng|FogLightON|DaytimeRunningLightON|NearandFar.*ON|PositionLightON)/i;

const FOLIAGE_NAME_RE = /grass|shrub|leaf|foliage|plant|tree|vegetation|草坪|草/i;

/** 交通标志常见纯色材质名（126 个 sign FBX 实测） */
const SIGN_SOLID_NAME_RE =
  /^M_(?:red|white|yellow|black|blue|green|zi)(?:_\d+)?$|^M_black2$|^M_Green_\d+$/i;

/** 电子限速牌等带贴图的标志面 */
const SIGN_TEXTURE_NAME_RE = /^Variable_Speed_Limit_|^M_Variable_Speed_Limit_/i;

function readGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error(`不是有效的 GLB: ${filePath}`);
  }

  let offset = 12;
  let json = null;
  const chunks = [];

  while (offset + 8 <= buf.length) {
    const chunkLength = buf.readUInt32LE(offset);
    const chunkType = buf.readUInt32LE(offset + 4);
    const chunkData = buf.subarray(offset + 8, offset + 8 + chunkLength);
    chunks.push({ type: chunkType, data: chunkData });
    if (chunkType === GLB_JSON_CHUNK) {
      json = JSON.parse(chunkData.toString("utf8"));
    }
    offset += 8 + chunkLength;
  }

  if (!json) {
    throw new Error(`GLB 缺少 JSON chunk: ${filePath}`);
  }

  const binChunk = chunks.find((c) => c.type === GLB_BIN_CHUNK);
  return { buf, json, chunks, bin: binChunk ? binChunk.data : Buffer.alloc(0) };
}

function hasEmissive(mat) {
  const e = mat.emissiveFactor;
  return Array.isArray(e) && e.some((v) => v > 0.001);
}

function isLightMaterial(mat) {
  if (hasEmissive(mat)) {
    return true;
  }
  return /indicator|brakelight|headlight|taillight|deng|灯光|车灯/i.test(mat.name || "");
}

function isFoliageMaterial(mat) {
  return FOLIAGE_NAME_RE.test(mat.name || "");
}

/** fbx2gltf 从 FBX Phong 猜出的 PBR，非真 PBR 贴图流程 */
function isFbxPhongMaterial(mat) {
  const fromFbx = mat.extras?.fromFBX;
  if (!fromFbx) {
    return false;
  }
  if (fromFbx.isTruePBR === true) {
    return false;
  }
  return fromFbx.shadingModel === "Phong" || fromFbx.isTruePBR === false;
}

/** 保留真金属/镜面材质（名称启发式，避免车身电镀等被归零） */
function isIntentionalMetalMaterial(mat) {
  return /chrome|metal|steel|alumin|mirror|电镀|金属/i.test(mat.name || "");
}

function patchDiffusePbr(mat) {
  const pbr = mat.pbrMetallicRoughness;
  if (!pbr || pbr.metallicRoughnessTexture) {
    return 0;
  }

  let changed = 0;
  if (pbr.metallicFactor !== 0) {
    pbr.metallicFactor = 0;
    changed += 1;
  }
  if (pbr.roughnessFactor !== 1) {
    pbr.roughnessFactor = 1;
    changed += 1;
  }
  return changed;
}

function ensureUnlitExtension(json) {
  if (!json.extensionsUsed) {
    json.extensionsUsed = [];
  }
  if (!json.extensionsUsed.includes("KHR_materials_unlit")) {
    json.extensionsUsed.push("KHR_materials_unlit");
  }
}

/** glTF baseColorFactor 要求 linear；FBX Phong diffuse 实际是 sRGB */
function srgbChannelToLinear(c) {
  if (c <= 0.04045) {
    return c / 12.92;
  }
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

function srgbFactorToLinear(factor) {
  const [r, g, b, a = 1] = factor;
  return [
    srgbChannelToLinear(r),
    srgbChannelToLinear(g),
    srgbChannelToLinear(b),
    a
  ];
}

function factorsEqual(a, b) {
  return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
}

/** fbx2gltf 写入的纯色因子需从 sRGB 转到 linear，否则 unlit 下蓝/绿发浅发青 */
function patchBaseColorSrgbToLinear(mat) {
  const pbr = mat.pbrMetallicRoughness;
  if (!pbr?.baseColorFactor || pbr.baseColorTexture) {
    return 0;
  }
  if (!isFbxPhongMaterial(mat)) {
    return 0;
  }

  const linear = srgbFactorToLinear(pbr.baseColorFactor);
  if (factorsEqual(linear, pbr.baseColorFactor)) {
    return 0;
  }

  pbr.baseColorFactor = linear;
  return 1;
}

/** 统计模型内「标志牌纯色」材质数；≥2 才整体走 unlit（避免水马等 3D 道具误伤） */
function countSignSolidMaterials(materials) {
  let count = 0;
  for (const mat of materials) {
    const pbr = mat.pbrMetallicRoughness || {};
    if (SIGN_SOLID_NAME_RE.test(mat.name || "") && isFbxPhongMaterial(mat) && !pbr.baseColorTexture) {
      count += 1;
    }
  }
  return count;
}

/** 标志牌：多色 flat sign 用 unlit；3D 道具（如 water_weilan 仅 M_yellow）保留 Standard 光照 */
function shouldUseUnlitMaterial(mat, signSolidCount) {
  if (isLightMaterial(mat)) {
    return false;
  }
  if (mat.alphaMode === "BLEND") {
    return false;
  }
  if (mat.extensions?.KHR_materials_unlit) {
    return false;
  }

  const name = mat.name || "";
  if (SIGN_TEXTURE_NAME_RE.test(name)) {
    return true;
  }

  const pbr = mat.pbrMetallicRoughness || {};
  if (pbr.metallicRoughnessTexture) {
    return false;
  }

  if (SIGN_SOLID_NAME_RE.test(name) && isFbxPhongMaterial(mat) && signSolidCount >= 2) {
    return true;
  }

  return false;
}

function patchUnlitMaterial(mat, signSolidCount) {
  if (!shouldUseUnlitMaterial(mat, signSolidCount)) {
    return 0;
  }

  const pbr = mat.pbrMetallicRoughness || (mat.pbrMetallicRoughness = {});
  if (!pbr.baseColorFactor) {
    pbr.baseColorFactor = [1, 1, 1, 1];
  }

  mat.extensions = mat.extensions || {};
  mat.extensions.KHR_materials_unlit = {};
  return 1;
}

/** 解析材质策略：default=现有标志牌 unlit 逻辑；lit=场景受光 */
function normalizeMaterialProfile(opts) {
  const fromOpts = opts?.materialProfile;
  if (fromOpts && MATERIAL_PROFILES.has(fromOpts)) {
    return fromOpts;
  }
  const fromEnv = process.env.FBX2GLB_MATERIAL_PROFILE;
  if (fromEnv && MATERIAL_PROFILES.has(fromEnv)) {
    return fromEnv;
  }
  return "default";
}

/** lit：去掉 KHR_materials_unlit，使 MeshStandardMaterial 受光 */
function stripUnlitMaterial(mat) {
  if (!mat.extensions?.KHR_materials_unlit) {
    return 0;
  }
  delete mat.extensions.KHR_materials_unlit;
  if (Object.keys(mat.extensions).length === 0) {
    delete mat.extensions;
  }
  return 1;
}

function cleanupUnlitExtension(json) {
  const materials = json.materials || [];
  const stillHasUnlit = materials.some((mat) => mat.extensions?.KHR_materials_unlit);
  if (stillHasUnlit || !Array.isArray(json.extensionsUsed)) {
    return 0;
  }
  const idx = json.extensionsUsed.indexOf("KHR_materials_unlit");
  if (idx < 0) {
    return 0;
  }
  json.extensionsUsed.splice(idx, 1);
  if (json.extensionsUsed.length === 0) {
    delete json.extensionsUsed;
  }
  return 1;
}

/** lit：无 baseColor、无贴图时补白，避免受光材质全黑 */
function ensureDefaultBaseColor(mat) {
  if (isLightMaterial(mat)) {
    return 0;
  }
  const pbr = mat.pbrMetallicRoughness;
  if (!pbr || pbr.baseColorTexture) {
    return 0;
  }
  if (pbr.baseColorFactor) {
    return 0;
  }
  pbr.baseColorFactor = [1, 1, 1, 1];
  return 1;
}

function isLightBranch(node, nodes) {
  const name = node.name || "";
  if (LIGHT_NAME_RE.test(name)) {
    return true;
  }
  if (Array.isArray(node.children)) {
    return node.children.some((idx) => isLightBranch(nodes[idx], nodes));
  }
  return false;
}

function reorderNodeChildren(nodeIdx, nodes) {
  const node = nodes[nodeIdx];
  if (!Array.isArray(node.children) || node.children.length < 2) {
    return 0;
  }

  for (const childIdx of node.children) {
    reorderNodeChildren(childIdx, nodes);
  }

  const regular = [];
  const lights = [];
  for (const childIdx of node.children) {
    if (isLightBranch(nodes[childIdx], nodes)) {
      lights.push(childIdx);
    } else {
      regular.push(childIdx);
    }
  }

  if (lights.length === 0 || lights.length === node.children.length) {
    return 0;
  }

  node.children = [...regular, ...lights];
  return 1;
}

function reorderLightNodes(json) {
  const nodes = json.nodes || [];
  const scenes = json.scenes || [{ nodes: [0] }];
  let changed = 0;

  for (const scene of scenes) {
    for (const rootIdx of scene.nodes || []) {
      changed += reorderNodeChildren(rootIdx, nodes);
    }
  }

  return changed;
}

function textureIndexForMaterial(mat) {
  const tex = mat.pbrMetallicRoughness?.baseColorTexture;
  return typeof tex?.index === "number" ? tex.index : -1;
}

function imageIndexForTexture(json, textureIndex) {
  if (textureIndex < 0) {
    return -1;
  }
  const src = json.textures?.[textureIndex]?.source;
  return typeof src === "number" ? src : -1;
}

function convertTgaImages(json, bin) {
  const images = json.images || [];
  const bufferViews = json.bufferViews || [];
  if (images.length === 0 || bufferViews.length === 0 || bin.length === 0) {
    return { bin, convertedImageIndices: new Set(), changed: 0 };
  }

  const convertedImageIndices = new Set();
  const viewData = bufferViews.map((view, viewIndex) => {
    const slice = bin.subarray(view.byteOffset, view.byteOffset + view.byteLength);
    const imageIdx = images.findIndex((img) => img.bufferView === viewIndex);
    if (imageIdx < 0) {
      return slice;
    }

    const image = images[imageIdx];
    const looksLikeTga =
      image.mimeType === "image/unknown" ||
      /\.tga$/i.test(image.name || "") ||
      isTgaBuffer(slice);

    if (!looksLikeTga || !isTgaBuffer(slice)) {
      return slice;
    }

    const png = tgaToPng(slice);
    images[imageIdx].mimeType = "image/png";
    if (image.name && /\.tga$/i.test(image.name)) {
      images[imageIdx].name = image.name.replace(/\.tga$/i, ".png");
    }
    if (tgaHasAlpha(slice)) {
      convertedImageIndices.add(imageIdx);
    }
    return png;
  });

  let offset = 0;
  for (let i = 0; i < bufferViews.length; i += 1) {
    bufferViews[i].byteOffset = offset;
    bufferViews[i].byteLength = viewData[i].length;
    offset += viewData[i].length;
    const pad = (4 - (viewData[i].length % 4)) % 4;
    offset += pad;
  }

  const parts = [];
  for (const data of viewData) {
    parts.push(data);
    const pad = (4 - (data.length % 4)) % 4;
    if (pad) {
      parts.push(Buffer.alloc(pad));
    }
  }

  const newBin = Buffer.concat(parts);
  if (json.buffers?.[0]) {
    json.buffers[0].byteLength = newBin.length;
  }

  return {
    bin: newBin,
    convertedImageIndices,
    changed: convertedImageIndices.size
  };
}

function patchMaterials(json, convertedAlphaImages, opts = {}) {
  const profile = normalizeMaterialProfile(opts);
  const materials = json.materials || [];
  let changed = 0;
  let unlitAdded = false;
  const signSolidCount = countSignSolidMaterials(materials);

  for (const mat of materials) {
    const pbr = mat.pbrMetallicRoughness || (mat.pbrMetallicRoughness = {});
    const base = pbr.baseColorFactor || (pbr.baseColorFactor = [1, 1, 1, 1]);
    while (base.length < 4) {
      base.push(1);
    }

    const texIdx = textureIndexForMaterial(mat);
    const imageIdx = imageIndexForTexture(json, texIdx);
    const usesAlphaTexture = imageIdx >= 0 && convertedAlphaImages.has(imageIdx);

    if (
      !isLightMaterial(mat) &&
      (usesAlphaTexture || (mat.alphaMode === "BLEND" && isFoliageMaterial(mat)))
    ) {
      if (mat.alphaMode !== "MASK") {
        mat.alphaMode = "MASK";
        mat.alphaCutoff = mat.alphaCutoff ?? 0.5;
        changed += 1;
      }
      if (!mat.doubleSided) {
        mat.doubleSided = true;
        changed += 1;
      }
    }

    const alpha = base[3];
    if (
      alpha < 0.999 &&
      !isLightMaterial(mat) &&
      mat.alphaMode !== "BLEND" &&
      mat.alphaMode !== "MASK"
    ) {
      mat.alphaMode = "BLEND";
      changed += 1;
    }

    if (isLightMaterial(mat)) {
      if (hasEmissive(mat)) {
        const e = mat.emissiveFactor;
        pbr.baseColorFactor = [e[0], e[1], e[2], 1];
        changed += 1;
      }
      if (!mat.doubleSided) {
        mat.doubleSided = true;
        changed += 1;
      }
      continue;
    }

    // fbx2gltf 常给 Phong 材质 metallic≈0.4，Standard 着色下整体偏灰偏暗
    if (isFbxPhongMaterial(mat) && !isIntentionalMetalMaterial(mat)) {
      changed += patchDiffusePbr(mat);
      changed += patchBaseColorSrgbToLinear(mat);
    }

    if (profile === "lit") {
      changed += stripUnlitMaterial(mat);
      changed += ensureDefaultBaseColor(mat);
    } else if (patchUnlitMaterial(mat, signSolidCount)) {
      unlitAdded = true;
      changed += 1;
    }
  }

  if (profile === "lit") {
    changed += cleanupUnlitExtension(json);
  } else if (unlitAdded) {
    ensureUnlitExtension(json);
  }

  return changed;
}

function writeGlb(outPath, json, bin) {
  const jsonText = JSON.stringify(json);
  const jsonBuf = Buffer.from(jsonText, "utf8");
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);

  const binPad = bin.length > 0 ? (4 - (bin.length % 4)) % 4 : 0;
  const binChunk = bin.length > 0 ? Buffer.concat([bin, Buffer.alloc(binPad, 0)]) : null;

  const totalLength =
    12 + 8 + jsonChunk.length + (binChunk ? 8 + binChunk.length : 0);
  const out = Buffer.alloc(totalLength);
  out.writeUInt32LE(GLB_MAGIC, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLength, 8);

  let offset = 12;
  out.writeUInt32LE(jsonChunk.length, offset);
  out.writeUInt32LE(GLB_JSON_CHUNK, offset + 4);
  jsonChunk.copy(out, offset + 8);
  offset += 8 + jsonChunk.length;

  if (binChunk) {
    out.writeUInt32LE(binChunk.length, offset);
    out.writeUInt32LE(GLB_BIN_CHUNK, offset + 4);
    binChunk.copy(out, offset + 8);
  }

  fs.writeFileSync(outPath, out);
}

function fixGlbFile(inputPath, outputPath, opts = {}) {
  const { json, bin } = readGlb(inputPath);
  const { bin: patchedBin, convertedImageIndices, changed: tgaChanges } = convertTgaImages(
    json,
    bin
  );
  const materialChanges = patchMaterials(json, convertedImageIndices, opts);
  const sceneChanges = reorderLightNodes(json);
  writeGlb(outputPath, json, patchedBin);
  return tgaChanges + materialChanges + sceneChanges;
}

function parseCliArgs(argv) {
  const positional = [];
  let materialProfile = normalizeMaterialProfile({});

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--profile" && argv[i + 1]) {
      const next = argv[i + 1];
      if (MATERIAL_PROFILES.has(next)) {
        materialProfile = next;
      }
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  return {
    inputPath: positional[0],
    outputPath: positional[1],
    materialProfile
  };
}

function main() {
  const { inputPath, outputPath: cliOutputPath, materialProfile } = parseCliArgs(
    process.argv.slice(2)
  );
  const outputPath = cliOutputPath || inputPath;

  if (!inputPath) {
    console.error(
      "Usage: node glb-material-fix.cjs <input.glb> [output.glb] [--profile default|lit]"
    );
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`文件不存在: ${inputPath}`);
    process.exit(1);
  }

  const outDir = path.dirname(outputPath);
  if (outDir && outDir !== ".") {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const changed = fixGlbFile(inputPath, outputPath, { materialProfile });
  if (changed > 0) {
    console.log(`已修补 ${changed} 项: ${path.basename(inputPath)}`);
  }
}

module.exports = {
  fixGlbFile,
  patchMaterials,
  reorderLightNodes,
  convertTgaImages,
  srgbFactorToLinear,
  patchBaseColorSrgbToLinear,
  normalizeMaterialProfile,
  MATERIAL_PROFILES
};

if (require.main === module) {
  main();
}
