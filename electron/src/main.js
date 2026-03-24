import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import basisTranscoderJsUrl from "three/examples/jsm/libs/basis/basis_transcoder.js?url";
import dracoDecoderJsUrl from "three/examples/jsm/libs/draco/gltf/draco_decoder.js?url";

const inputEl = document.querySelector("#inputDir");
const outputEl = document.querySelector("#outputDir");
const logEl = document.querySelector("#log");
const pickInputBtn = document.querySelector("#pickInputBtn");
const pickOutputBtn = document.querySelector("#pickOutputBtn");
const startBtn = document.querySelector("#startBtn");
const pickGlbBtn = document.querySelector("#pickGlbBtn");
const pickGlbFolderBtn = document.querySelector("#pickGlbFolderBtn");
const glbFileInputEl = document.querySelector("#glbFileInput");
const glbFolderInputEl = document.querySelector("#glbFolderInput");
const glbFilePathEl = document.querySelector("#glbFilePath");
const previewStatusEl = document.querySelector("#previewStatus");
const previewCanvasEl = document.querySelector("#previewCanvas");
const toggleFullscreenBtn = document.querySelector("#toggleFullscreenBtn");

function appendLog(line) {
  logEl.value += `${line}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function setRunning(running) {
  startBtn.disabled = running;
  pickInputBtn.disabled = running;
  pickOutputBtn.disabled = running;
  startBtn.textContent = running ? "转换中..." : "开始转换";
}

pickInputBtn.addEventListener("click", async () => {
  const selected = await window.electronAPI.pickDirectory();
  if (selected) {
    inputEl.value = selected;
  }
});

pickOutputBtn.addEventListener("click", async () => {
  const selected = await window.electronAPI.pickDirectory();
  if (selected) {
    outputEl.value = selected;
  }
});

startBtn.addEventListener("click", async () => {
  const inputDir = inputEl.value.trim();
  const outputDir = outputEl.value.trim();

  if (!inputDir || !outputDir) {
    appendLog("请先选择输入目录和输出目录。");
    return;
  }

  setRunning(true);
  appendLog("开始执行转换任务...");

  try {
    const result = await window.electronAPI.runConversion(inputDir, outputDir);
    appendLog(result);
  } catch (error) {
    appendLog(`执行失败: ${String(error)}`);
  } finally {
    setRunning(false);
  }
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf1f5f9);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
camera.position.set(3.5, 2.2, 3.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
previewCanvasEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(6, 8, 5);
scene.add(dirLight);

const ground = new THREE.GridHelper(10, 10, 0x94a3b8, 0xcbd5e1);
ground.position.y = -0.001;
scene.add(ground);

const loadedModels = [];
const currentBlobUrls = [];
const animationMixers = [];
let loadedGroup = null;
const clock = new THREE.Clock();

function updateRendererSize() {
  const width = previewCanvasEl.clientWidth;
  const height = previewCanvasEl.clientHeight || 420;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function disposeCurrentModel() {
  if (loadedModels.length === 0) {
    return;
  }

  for (const model of loadedModels) {
    model.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat?.dispose?.());
        } else {
          child.material?.dispose?.();
        }
      }
    });

  }

  loadedModels.length = 0;
  for (const mixer of animationMixers) {
    mixer.stopAllAction();
    mixer.uncacheRoot(mixer.getRoot());
  }
  animationMixers.length = 0;
  if (loadedGroup) {
    scene.remove(loadedGroup);
    loadedGroup = null;
  }
  while (currentBlobUrls.length > 0) {
    URL.revokeObjectURL(currentBlobUrls.pop());
  }
}

function fitCameraToModel(object3dOrGroup) {
  const box = new THREE.Box3().setFromObject(object3dOrGroup);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (maxSize / 2) / Math.tan(fov / 2);

  camera.near = Math.max(0.01, maxSize / 100);
  camera.far = Math.max(1000, maxSize * 20);
  camera.updateProjectionMatrix();

  camera.position.set(center.x + distance * 1.2, center.y + distance * 0.8, center.z + distance * 1.2);
  controls.target.copy(center);
  controls.update();
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  const delta = clock.getDelta();
  for (const mixer of animationMixers) {
    mixer.update(delta);
  }
  controls.update();
  renderer.render(scene, camera);
}

updateRendererSize();
renderLoop();
window.addEventListener("resize", updateRendererSize);
document.addEventListener("fullscreenchange", () => {
  const isFullscreen = document.fullscreenElement === previewCanvasEl;
  toggleFullscreenBtn.textContent = isFullscreen ? "退出全屏" : "全屏预览";
  updateRendererSize();
});

const gltfLoader = new GLTFLoader();
const ktx2Loader = new KTX2Loader();
const transcoderPath = basisTranscoderJsUrl.slice(0, basisTranscoderJsUrl.lastIndexOf("/") + 1);
const dracoLoader = new DRACOLoader();
const dracoDecoderPath = dracoDecoderJsUrl.slice(0, dracoDecoderJsUrl.lastIndexOf("/") + 1);

ktx2Loader.setTranscoderPath(transcoderPath);
ktx2Loader.detectSupport(renderer);
dracoLoader.setDecoderPath(dracoDecoderPath);
dracoLoader.setDecoderConfig({ type: "js" });
gltfLoader.setKTX2Loader(ktx2Loader);
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

pickGlbBtn.addEventListener("click", () => {
  glbFileInputEl.click();
});

pickGlbFolderBtn.addEventListener("click", () => {
  glbFolderInputEl.click();
});

toggleFullscreenBtn.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement === previewCanvasEl) {
      await document.exitFullscreen();
    } else {
      await previewCanvasEl.requestFullscreen();
    }
  } catch (error) {
    previewStatusEl.textContent = `全屏切换失败：${String(error)}`;
  }
});

function getGlbFiles(fileList) {
  const files = Array.from(fileList || []);
  return files.filter((file) => file.name.toLowerCase().endsWith(".glb"));
}

async function loadGlbFiles(files) {
  if (!files.length) {
    previewStatusEl.textContent = "未找到 .glb 文件";
    return;
  }

  glbFilePathEl.value = files.length === 1 ? files[0].name : `已选择 ${files.length} 个 GLB`;
  previewStatusEl.textContent = `加载模型中（0/${files.length}）...`;

  try {
    disposeCurrentModel();
    const loadedEntries = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const blobUrl = URL.createObjectURL(file);
      currentBlobUrls.push(blobUrl);
      const gltf = await gltfLoader.loadAsync(blobUrl);
      const model = gltf.scene;
      loadedEntries.push({ model, fileName: file.name });
      if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        for (const clip of gltf.animations) {
          mixer.clipAction(clip).play();
        }
        animationMixers.push(mixer);
      }
      previewStatusEl.textContent = `加载模型中（${i + 1}/${files.length}）...`;
    }

    const spacing = 8;
    const columns = Math.max(1, Math.ceil(Math.sqrt(loadedEntries.length)));
    const previewGroup = new THREE.Group();

    loadedEntries.forEach((entry, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = (col - (columns - 1) / 2) * spacing;
      const z = row * spacing;
      entry.model.position.set(x, 0, z);
      previewGroup.add(entry.model);
      loadedModels.push(entry.model);
    });

    loadedGroup = previewGroup;
    scene.add(loadedGroup);
    fitCameraToModel(loadedGroup);
    previewStatusEl.textContent = `预览成功：共 ${loadedEntries.length} 个 GLB`;
  } catch (error) {
    previewStatusEl.textContent = `加载失败：${String(error)}`;
  }
}

glbFileInputEl.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  await loadGlbFiles([file]);
});

glbFolderInputEl.addEventListener("change", async (event) => {
  const files = getGlbFiles(event.target.files);
  await loadGlbFiles(files);
});
