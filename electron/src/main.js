import "./style.css";
import { setupConversionActions } from "./modules/conversion.js";
import { ModelPreviewer } from "./modules/modelPreviewer.js";

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

setupConversionActions({
  inputEl,
  outputEl,
  logEl,
  pickInputBtn,
  pickOutputBtn,
  startBtn
});

const previewer = new ModelPreviewer({
  previewCanvasEl,
  previewStatusEl,
  glbFilePathEl,
  toggleFullscreenBtn
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
  await previewer.loadGlbFiles([file]);
});

glbFolderInputEl.addEventListener("change", async (event) => {
  const files = ModelPreviewer.getGlbFiles(event.target.files);
  await previewer.loadGlbFiles(files);
});
