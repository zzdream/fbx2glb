# FBX / GLB 处理器（Electron 桌面版）

这是仓库中 `tauri/` 实现的 Electron 对应版本，当前已包含“批处理转换 + 压缩 + 本地预览”完整能力。

## 功能概览

### 1) 批处理转换/压缩（主流程）

支持三种处理模式：

- `FBX -> GLB -> 压缩`（默认）
- `GLB -> 压缩`（直接压缩 GLB 文件夹）
- `GLB -> Draco 压缩`（直接对已有 GLB 做 `gltf-pipeline -d`）

你只需要选择输入目录和输出目录，点击 `开始转换`，界面会展示脚本执行日志。

对应脚本：

- `FBX -> GLB -> 压缩`：
  - macOS/Linux: `batch_fbx2glb_final.sh`
  - Windows: `batch_fbx2glb_final.bat`
- `GLB -> 压缩`：
  - macOS/Linux: `batch_gltfpack.sh`
  - Windows: `batch_gltfpack.bat`
- `GLB -> Draco 压缩`：
  - macOS/Linux: `batch_gltf_pipeline_draco.sh`
  - Windows: `batch_gltf_pipeline_draco.bat`

### 2) GLB 本地预览（右侧预览区）

支持以下预览能力：

- 选择单个 `.glb` 文件预览
- 选择文件夹并批量加载 `.glb`（自动排布）
- 模型轨道控制：旋转/缩放/平移
- 全屏预览
- 自动播放骨骼动画（若模型含 animation clips）
- 自动相机框选（加载后自动看全模型/模型组）

支持的压缩/扩展格式：

- `KHR_texture_basisu`（`KTX2Loader`）
- `EXT_meshopt_compression`（`MeshoptDecoder`）
- Draco 压缩（`DRACOLoader`）

## 环境要求

- Node.js 20+
- pnpm（或 npm）
- `fbx2gltf`、`gltfpack` 已可在终端里直接运行（开发模式下）

## 开发运行

```bash
cd electron
pnpm install
pnpm dev
```

默认会启动：

- Vite 开发服务：`http://localhost:1421`
- Electron 桌面窗口

## 使用说明

### A. 处理模式（转换/压缩）

1. 在“处理模式”中选择一种：
   - `FBX 转 GLB 并压缩`
   - `仅压缩 GLB 目录`
   - `仅压缩 GLB（draco）`
2. 选择输入目录与输出目录
3. 点击 `开始转换`
4. 在“执行日志”中查看进度与结果

提示：

- 当模式切换为“仅压缩 GLB 目录”或“仅压缩 GLB（draco）”时，输入目录文案会自动切换为“输入目录（GLB）”。
- `batch_gltfpack` 支持递归子目录并保留目录结构。
- `batch_gltf_pipeline_draco` 支持递归子目录并保留目录结构（依赖 `gltf-pipeline`）。

### B. 预览模式（模型查看）

1. 点击 `选择 GLB`：加载单个模型  
   或点击 `选择文件夹`：批量加载目录内所有 `.glb`
2. 鼠标交互查看模型：
   - 左键拖动：旋转
   - 滚轮：缩放
   - 右键拖动：平移
3. 点击预览区右上角 `全屏预览` 可全屏查看

## 常见问题

- 打包后运行报错 `未找到 fbx2gltf` 或 `未找到 gltfpack`：
  - 说明对应平台的 `bin-*` 目录里缺少 `fbx2gltf` / `gltfpack`（macOS 用 `bin-darwin-*`，Linux 用 `bin-linux-x64`，Windows 用 `bin-win-x64`）。
  - 见下方「准备可执行文件」后重新打包。
- 选择“仅压缩 GLB 目录”后没有输出：
  - 请确认输入目录下实际存在 `.glb` 文件（支持递归）。
  - 请确认终端可执行 `gltfpack`（开发模式）或打包资源中已包含对应平台的 `gltfpack`。
- 选择“仅压缩 GLB（draco）”后失败：
  - 请确认终端可执行 `gltf-pipeline`（可通过 `npm i -g gltf-pipeline` 安装）。
  - 请确认输入目录下存在 `.glb` 文件（支持递归）。
- 预览时压缩模型加载失败：
  - 请确认模型使用的压缩扩展是否完整（KTX2 / Meshopt / Draco 资源应与模型一致）。
  - 先用未压缩 GLB 验证模型内容是否正常，再定位压缩链路问题。
- Linux 上报错 `GLIBC_2.34 not found` 或 `GLIBCXX_3.4.30 not found`：
  - 官方 gltfpack 预编译包需要较新的 glibc（约 Ubuntu 22.04+）。请在**目标 Linux 系统上**从 [meshoptimizer](https://github.com/zeux/meshoptimizer) 源码编译 gltfpack，替换 `bin-linux-x64/gltfpack` 后重新打包。
- 报错 `Electron failed to install correctly`：
  - 说明 Electron 二进制没下载完整，可执行：
  - `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/.pnpm/electron@36.9.5/node_modules/electron/install.js`
- 报错 `app is undefined` 或 Electron 像 Node 一样运行：
  - 通常是环境变量 `ELECTRON_RUN_AS_NODE=1` 导致。
  - 当前 `package.json` 的脚本已内置 `env -u ELECTRON_RUN_AS_NODE`，如你手动启动 Electron，也要先清掉该变量。
- 报错 `dmg-builder ... 404`（例如 `cdn.npmmirror.com/binaries/electron/...`）：
  - 这是镜像地址缺失资源导致，`build:mac` 脚本已内置下载源覆盖到 GitHub release。

## 打包安装包

### 1. 准备 fbx2gltf 和 gltfpack（按平台分目录）

**不要用 macOS 的二进制去打 Linux 包**，每种系统只认自己的 ELF / Mach-O。

#### macOS（打 `pnpm build:mac` 时用）

| 目录 | 适用 |
|------|------|
| `electron/bin-darwin-arm64/` | Apple Silicon (M1/M2/M3) |
| `electron/bin-darwin-x64/`   | Intel Mac |

- **fbx2gltf**：https://github.com/facebookincubator/FBX2glTF/releases → `FBX2glTF-darwin-x64`，重命名为 `fbx2gltf`
- **gltfpack**：https://github.com/zeux/meshoptimizer/releases → macOS 包中的 `gltfpack`

#### Linux（仅 x86_64 / amd64；打 `pnpm build:linux` 时在 Linux 或 CI 上构建）

将工具放入 **`electron/bin-linux-x64/`**：

- **fbx2gltf**：https://github.com/facebookincubator/FBX2glTF/releases → `FBX2glTF-linux-x64`，重命名为 `fbx2gltf`
- **gltfpack**：https://github.com/zeux/meshoptimizer/releases → Linux 包中的 `gltfpack`  
  **注意**：官方预编译 gltfpack 需要 glibc 2.34+（约 Ubuntu 22.04 及以上）。若在更老系统（如 Ubuntu 18.04）上出现 `GLIBC_2.34 not found` 等报错，请在**目标 Linux 上**从 meshoptimizer 源码编译 gltfpack 后放入该目录。


#### Windows（x64；打 `pnpm build:win` 时用）

将工具放入 **`electron/bin-win-x64/`**：

- **fbx2gltf**：https://github.com/facebookincubator/FBX2glTF/releases → `FBX2glTF-windows-x64.exe`，重命名为 `fbx2gltf.exe`
- **gltfpack**：https://github.com/zeux/meshoptimizer/releases → Windows 包中的 `gltfpack.exe`

```bash
# macOS 示例
chmod +x electron/bin-darwin-arm64/fbx2gltf electron/bin-darwin-arm64/gltfpack
chmod +x electron/bin-darwin-x64/fbx2gltf electron/bin-darwin-x64/gltfpack

# Linux 示例（在 Linux 上）
chmod +x electron/bin-linux-x64/fbx2gltf electron/bin-linux-x64/gltfpack
```

### 2. 执行打包

```bash
cd electron
pnpm install
pnpm build:mac          # macOS dmg（arm64 + x64）
pnpm build:linux        # Linux AppImage（x64），脚本内已包含 build:electron
pnpm build:win          # Windows NSIS（x64）
```

产物输出在 `electron/build/` 目录。

补充说明：

- **Windows**：已支持内置 `fbx2gltf.exe` + `gltfpack.exe` 转换链（x64）。
- 若只想构建前端静态资源，可执行 `pnpm build:electron`
