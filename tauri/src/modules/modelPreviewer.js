import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import basisTranscoderJsUrl from "three/examples/jsm/libs/basis/basis_transcoder.js?url";
import dracoDecoderJsUrl from "three/examples/jsm/libs/draco/gltf/draco_decoder.js?url";

export class ModelPreviewer {
  constructor({ previewCanvasEl, previewStatusEl, glbFilePathEl, toggleFullscreenBtn }) {
    this.previewCanvasEl = previewCanvasEl;
    this.previewShellEl = previewCanvasEl.closest(".preview-shell");
    this.previewStatusEl = previewStatusEl;
    this.glbFilePathEl = glbFilePathEl;
    this.toggleFullscreenBtn = toggleFullscreenBtn;
    this.isAppFullscreen = false;

    this.loadedModels = [];
    this.currentBlobUrls = [];
    this.animationMixers = [];
    this.loadedGroup = null;
    this.clock = new THREE.Clock();

    this.setupScene();
    this.setupLoaders();
    this.bindFullscreenEvents();
    this.startRenderLoop();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf1f5f9);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    this.camera.position.set(3.5, 2.2, 3.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.previewCanvasEl.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(6, 8, 5);
    this.scene.add(dirLight);

    const ground = new THREE.GridHelper(10, 10, 0x94a3b8, 0xcbd5e1);
    ground.position.y = -0.001;
    this.scene.add(ground);

    this.updateRendererSize();
    window.addEventListener("resize", () => this.updateRendererSize());
  }

  setupLoaders() {
    this.gltfLoader = new GLTFLoader();
    const ktx2Loader = new KTX2Loader();
    const dracoLoader = new DRACOLoader();

    const transcoderPath = basisTranscoderJsUrl.slice(0, basisTranscoderJsUrl.lastIndexOf("/") + 1);
    const dracoDecoderPath = dracoDecoderJsUrl.slice(0, dracoDecoderJsUrl.lastIndexOf("/") + 1);

    ktx2Loader.setTranscoderPath(transcoderPath);
    ktx2Loader.detectSupport(this.renderer);
    dracoLoader.setDecoderPath(dracoDecoderPath);
    dracoLoader.setDecoderConfig({ type: "js" });

    this.gltfLoader.setKTX2Loader(ktx2Loader);
    this.gltfLoader.setDRACOLoader(dracoLoader);
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }

  bindFullscreenEvents() {
    const syncFullscreenButtonText = () => {
      const isDomFullscreen = document.fullscreenElement === this.previewCanvasEl;
      this.toggleFullscreenBtn.textContent = isDomFullscreen || this.isAppFullscreen ? "退出全屏" : "全屏预览";
    };

    const setAppFullscreen = (enabled) => {
      this.isAppFullscreen = enabled;
      this.previewShellEl?.classList.toggle("preview-shell-app-fullscreen", enabled);
      document.body.classList.toggle("app-no-scroll", enabled);
      syncFullscreenButtonText();
      this.updateRendererSize();
    };

    this.toggleFullscreenBtn.addEventListener("click", async () => {
      try {
        if (typeof this.previewCanvasEl.requestFullscreen === "function") {
          if (document.fullscreenElement === this.previewCanvasEl) {
            await document.exitFullscreen();
          } else {
            await this.previewCanvasEl.requestFullscreen();
          }
        } else {
          setAppFullscreen(!this.isAppFullscreen);
        }
        syncFullscreenButtonText();
        this.updateRendererSize();
      } catch (error) {
        this.previewStatusEl.textContent = `全屏切换失败：${String(error)}`;
      }
    });

    document.addEventListener("fullscreenchange", () => {
      syncFullscreenButtonText();
      this.updateRendererSize();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isAppFullscreen && document.fullscreenElement !== this.previewCanvasEl) {
        setAppFullscreen(false);
      }
    });
    syncFullscreenButtonText();
  }

  startRenderLoop() {
    const render = () => {
      requestAnimationFrame(render);
      const delta = this.clock.getDelta();
      for (const mixer of this.animationMixers) {
        mixer.update(delta);
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    render();
  }

  updateRendererSize() {
    const width = this.previewCanvasEl.clientWidth;
    const height = this.previewCanvasEl.clientHeight || 420;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  disposeCurrentModel() {
    if (this.loadedModels.length === 0) {
      return;
    }

    for (const model of this.loadedModels) {
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

    this.loadedModels.length = 0;

    for (const mixer of this.animationMixers) {
      mixer.stopAllAction();
      mixer.uncacheRoot(mixer.getRoot());
    }
    this.animationMixers.length = 0;

    if (this.loadedGroup) {
      this.scene.remove(this.loadedGroup);
      this.loadedGroup = null;
    }

    while (this.currentBlobUrls.length > 0) {
      URL.revokeObjectURL(this.currentBlobUrls.pop());
    }
  }

  fitCameraToModel(object3dOrGroup) {
    const box = new THREE.Box3().setFromObject(object3dOrGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z) || 1;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = (maxSize / 2) / Math.tan(fov / 2);

    this.camera.near = Math.max(0.01, maxSize / 100);
    this.camera.far = Math.max(1000, maxSize * 20);
    this.camera.updateProjectionMatrix();

    this.camera.position.set(center.x + distance * 1.2, center.y + distance * 0.8, center.z + distance * 1.2);
    this.controls.target.copy(center);
    this.controls.update();
  }

  static getGlbFiles(fileList) {
    const files = Array.from(fileList || []);
    return files.filter((file) => file.name.toLowerCase().endsWith(".glb"));
  }

  async loadGlbFiles(files) {
    if (!files.length) {
      this.previewStatusEl.textContent = "未找到 .glb 文件";
      return;
    }

    this.glbFilePathEl.value = files.length === 1 ? files[0].name : `已选择 ${files.length} 个 GLB`;
    this.previewStatusEl.textContent = `加载模型中（0/${files.length}）...`;

    try {
      this.disposeCurrentModel();
      const loadedEntries = [];

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const blobUrl = URL.createObjectURL(file);
        this.currentBlobUrls.push(blobUrl);

        const gltf = await this.gltfLoader.loadAsync(blobUrl);
        const model = gltf.scene;
        loadedEntries.push({ model });

        if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          for (const clip of gltf.animations) {
            mixer.clipAction(clip).play();
          }
          this.animationMixers.push(mixer);
        }

        this.previewStatusEl.textContent = `加载模型中（${i + 1}/${files.length}）...`;
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
        this.loadedModels.push(entry.model);
      });

      this.loadedGroup = previewGroup;
      this.scene.add(this.loadedGroup);
      this.fitCameraToModel(this.loadedGroup);
      this.previewStatusEl.textContent = `预览成功：共 ${loadedEntries.length} 个 GLB`;
    } catch (error) {
      this.previewStatusEl.textContent = `加载失败：${String(error)}`;
    }
  }
}
