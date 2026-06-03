import "./style.css";
import { setupConversionActions } from "./modules/conversion.js";
import { ModelPreviewer } from "./modules/modelPreviewer.js";

const inputEl = document.querySelector("#inputDir");
const outputEl = document.querySelector("#outputDir");
const modeInputs = document.querySelectorAll('input[name="convertMode"]');
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
const pickFbxBtn = document.querySelector("#pickFbxBtn");
const pickFbxFolderBtn = document.querySelector("#pickFbxFolderBtn");
const fbxFileInputEl = document.querySelector("#fbxFileInput");
const fbxFolderInputEl = document.querySelector("#fbxFolderInput");
const fbxFilePathEl = document.querySelector("#fbxFilePath");
const fbxPreviewStatusEl = document.querySelector("#fbxPreviewStatus");
const fbxPreviewCanvasEl = document.querySelector("#fbxPreviewCanvas");
const fbxToggleFullscreenBtn = document.querySelector("#fbxToggleFullscreenBtn");

setupConversionActions({
  inputEl,
  outputEl,
  modeInputs,
  logEl,
  pickInputBtn,
  pickOutputBtn,
  startBtn
});

const glbPreviewer = new ModelPreviewer({
  previewCanvasEl,
  previewStatusEl,
  filePathEl: glbFilePathEl,
  toggleFullscreenBtn,
  format: "glb"
});

const fbxPreviewer = new ModelPreviewer({
  previewCanvasEl: fbxPreviewCanvasEl,
  previewStatusEl: fbxPreviewStatusEl,
  filePathEl: fbxFilePathEl,
  toggleFullscreenBtn: fbxToggleFullscreenBtn,
  format: "fbx"
});

pickGlbBtn.addEventListener("click", () => {
  glbFileInputEl.click();
});

pickGlbFolderBtn.addEventListener("click", () => {
  glbFolderInputEl.click();
});

glbFileInputEl.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  await glbPreviewer.loadGlbFiles([file]);
});

glbFolderInputEl.addEventListener("change", async (event) => {
  const files = ModelPreviewer.getGlbFiles(event.target.files);
  await glbPreviewer.loadGlbFiles(files);
});

pickFbxBtn.addEventListener("click", () => {
  fbxFileInputEl.click();
});

pickFbxFolderBtn.addEventListener("click", () => {
  fbxFolderInputEl.click();
});

fbxFileInputEl.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  await fbxPreviewer.loadFbxFiles([file], [file]);
});

fbxFolderInputEl.addEventListener("change", async (event) => {
  const allFiles = Array.from(event.target.files || []);
  const fbxFiles = ModelPreviewer.getFbxFiles(event.target.files);
  await fbxPreviewer.loadFbxFiles(fbxFiles, allFiles);
});
