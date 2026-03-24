# FBX / GLB 处理器（Tauri 桌面版）

基于 [Tauri](https://tauri.app/) 的桌面 GUI，提供“批处理转换/压缩 + 本地预览”能力。

## 功能概览

### 1) 批处理转换/压缩

支持两种处理模式：

- `FBX -> GLB -> 压缩`（默认）
- `GLB -> 压缩`（直接压缩 GLB 文件夹）

对应脚本：

- `FBX -> GLB -> 压缩`：`batch_fbx2glb_final.sh`
- `GLB -> 压缩`：`batch_gltfpack.sh`

### 2) GLB 本地预览

支持以下能力：

- 选择单个 `.glb` 预览
- 选择文件夹批量加载 `.glb`（自动网格排布）
- 旋转/缩放/平移交互
- 全屏预览
- 骨骼动画自动播放（有动画 clip 时）
- 自动相机框选

支持的压缩/扩展：

- `KHR_texture_basisu`（KTX2）
- `EXT_meshopt_compression`（Meshopt）
- Draco（DRACOLoader）

## 环境要求

- Node.js 20+
- pnpm（或 npm）
- Rust（Tauri 需要）
- **转换依赖**：`fbx2gltf`、`gltfpack`（与主脚本相同，见主 README 的「3 分钟快速开始」）

## 开发运行

在仓库根目录进入本目录（与 `package.json` 同级）：

```bash
cd tauri
pnpm install
pnpm tauri dev
```

## 使用说明

### A. 转换/压缩

1. 选择处理模式（`FBX -> GLB -> 压缩` 或 `GLB -> 压缩`）
2. 选择输入目录与输出目录
3. 点击 `开始转换`
4. 在“执行日志”查看结果

提示：

- 模式切换为“仅压缩 GLB 目录”时，输入目录文案会自动改为“输入目录（GLB）”。
- `batch_gltfpack.sh` 支持递归子目录并保留目录结构。

### B. 预览

1. 点击 `选择 GLB`（单模型）或 `选择文件夹`（批量）
2. 鼠标左键旋转、滚轮缩放、右键平移
3. 点击预览区右上角 `全屏预览` 可放大查看

## 打包构建

```bash
cd tauri
pnpm install
pnpm tauri build
```

平台相关构建脚本：

```bash
pnpm tauri:build:mac   # macOS（universal）
pnpm tauri:build:linux # Linux x64
pnpm tauri:build:win   # Windows x64（NSIS）
```

## 打包时嵌入依赖（给开发者）

构建前将对应平台的可执行文件放入 `tauri/src-tauri/resources/bin/`：

| 文件名 | 说明 |
|--------|------|
| `fbx2gltf` | 与主 README 中一致的官方二进制（macOS / Linux 无扩展名） |
| `gltfpack` | meshoptimizer 的 gltfpack 可执行文件 |

`tauri.conf.json` 的 `bundle.resources` 会把上述两个文件打进安装包，运行时由 `main.rs` 注入到 `PATH` 供脚本调用。

## 平台支持

- **macOS**：已支持（需自备上述二进制后打包）
- **Linux**：已支持（需自备上述二进制后打包）
- **Windows**：应用内转换仍为预留说明；请使用 macOS / Linux 包，或在 WSL 中运行根目录脚本

---

更多关于转换流程、压缩参数、常见问题等，请参考 [项目主 README](../README.md)。
