
# fbx2glb

批量把 FBX 转成 GLB，并支持二次压缩（`gltfpack` 解码更快（比 Draco 更适合实时）现代 Web 推荐方案。）

## 目录说明

| 文件 / 目录 | 用途 |
|-------------|------|
| [`tauri/`](tauri/README.md) | **桌面 GUI（Tauri）**：提供图形界面完成 FBX -> GLB 转换与压缩 |
| [`electron/`](electron/README.md) | **桌面 GUI（Electron）**：与 Tauri 版功能一致的 Electron 实现 |
| `batch_fbx2glb_final.sh` | **推荐主入口**：一步完成 FBX -> GLB -> gltfpack 压缩（中间产物自动清理） |
| `batch_fbx2glb.sh` | 仅做 FBX -> GLB 批量转换，递归子目录并保留目录结构 |
| `batch_gltfpack.sh` | 仅对已有 GLB 做批量压缩，递归子目录并保留目录结构 |
| `batch_gltf_pipeline_draco.sh` | 仅对已有 GLB 批量 Draco 压缩（`gltf-pipeline -d`），递归子目录并保留目录结构 |
| `batch_fbx2glb_final.bat` | Windows 版一步流（FBX -> GLB -> 压缩） |
| `batch_fbx2glb.bat` | Windows 版仅转换（FBX -> GLB） |
| `batch_gltfpack.bat` | Windows 版仅压缩（已有 GLB -> 压缩） |
| `batch_gltf_pipeline_draco.bat` | Windows 版批量 Draco（`gltf-pipeline -d`） |
| `Makefile` | 为常用命令提供统一入口（`make final` / `make fbx2glb` / `make pack`） |
| `justfile` | 与 Makefile 等价（喜欢 `just` 的可用） |
| `fbx_to_glb.py` | Blender 批量导出脚本（备用方案） |
| [`.github/workflows/tauri-multi-platform.yml`](.github/workflows/tauri-multi-platform.yml) | **CI**：推送 `main` / `master` 或手动触发，多平台构建 Tauri 桌面版 |

## 3 分钟快速开始（推荐）

### 桌面版开箱即用（无需手动安装依赖）

如果你使用本仓库的两个桌面应用（`tauri/` 和 `electron/`），可以直接通过 GUI 完成转换与压缩，**不需要手动安装** `fbx2gltf` 和 `gltfpack` 和 `gltf-pipeline`。

桌面 GUI 当前支持 3 种处理模式：

- `FBX -> GLB -> 压缩`（默认，gltfpack）
- `GLB -> 压缩`（gltfpack）
- `GLB -> Draco 压缩`（`gltf-pipeline -d`）

- Tauri 版说明见：[`tauri/README.md`](tauri/README.md)
- Electron 版说明见：[`electron/README.md`](electron/README.md)

命令行脚本（`.sh` / `.bat` / `make` / `just`）场景下，才需要自行安装这两个命令行工具。

### 1) 准备依赖

需要命令行可直接运行：

- `fbx2gltf`（[FBX2glTF 发布页](https://github.com/facebookincubator/FBX2glTF/releases)，按平台下载后放进 `PATH`，必要时重命名为 `fbx2gltf`）
- `gltfpack`（[meshoptimizer 发布页](https://github.com/zeux/meshoptimizer/releases)，包内可执行文件通常名为 `gltfpack` / `gltfpack.exe`）

Windows 上请使用对应 `.exe`，并确保安装目录在系统 `PATH` 中，或在终端当前会话里配置好 `PATH`。

可用下面命令检查：

```bash
command -v fbx2gltf
command -v gltfpack
```

### 2) 一步完成转换和压缩

```bash
cd /path/to/fbx2glb
chmod +x batch_fbx2glb_final.sh batch_fbx2glb.sh batch_gltfpack.sh batch_gltf_pipeline_draco.sh
./batch_fbx2glb_final.sh /path/to/fbx /path/to/final_glb
```

Windows（PowerShell 或 CMD）可使用 `.bat` 版本：

```bat
cd C:\path\to\fbx2glb
batch_fbx2glb_final.bat C:\path\to\fbx C:\path\to\final_glb
```

说明：

- 输出目录不存在会自动创建
- 输入目录下的层级结构会在输出目录保持一致
- 中间 GLB 在临时目录，结束后自动删除

## 日常使用（Makefile / just）

在仓库根目录执行，二选一即可。

### Makefile

```bash
make help
make init
make check-deps
make final INPUT=/path/to/fbx OUTPUT=/path/to/final_glb
# make fbx2glb INPUT=/path/to/fbx OUTPUT=/path/to/raw_glb
# make pack INPUT=/path/to/raw_glb OUTPUT=/path/to/final_glb
```

### just

先安装 [just](https://github.com/casey/just) 后可用：

```bash
just
just init
just check-deps
just final /path/to/fbx /path/to/final_glb
# just fbx2glb /path/to/fbx /path/to/raw_glb
# just pack /path/to/raw_glb /path/to/final_glb
```

## CI（GitHub Actions）

工作流文件：[`.github/workflows/tauri-multi-platform.yml`](.github/workflows/tauri-multi-platform.yml)（Actions 里显示为 **Tauri Multi-Platform Build**）。

| 项目 | 说明 |
|------|------|
| **何时运行** | 向 `main` 或 `master` **push** 且命中 `paths` 过滤时自动运行；也可在仓库 **Actions** → 选中该工作流 → **Run workflow** 手动触发（`workflow_dispatch`） |
| **构建内容** | 在 `tauri/` 目录执行多平台 Tauri 打包（macOS universal、Linux x64、Windows x64） |
| **产物** | 各 job 上传 **Artifacts**，名称形如 `tauri-macos-universal`、`tauri-linux-x64`、`tauri-windows-x64`，内含对应平台的 `bundle` 目录 |

当前 `paths` 包括：`tauri/**`、`README.md`、`batch_fbx2glb_final.sh`、`batch_fbx2glb.sh`、`batch_gltfpack.sh`、`batch_gltf_pipeline_draco.sh`、`batch_fbx2glb_final.bat`、`batch_fbx2glb.bat`、`batch_gltfpack.bat`、`batch_gltf_pipeline_draco.bat`、`Makefile`、`justfile`、`fbx_to_glb.py`、`.github/workflows/tauri-multi-platform.yml`。例如只改 `electron/` 时不会自动触发。

桌面版开发与打包（含内置 `fbx2gltf` / `gltfpack`）细节见 [`tauri/README.md`](tauri/README.md) 与 [`electron/README.md`](electron/README.md)。

## 工作流怎么选

以下以**命令行脚本**为主；桌面 GUI（`tauri/`、`electron/`）可选用与之一致的处理模式，其中 **Draco 模式**同样需要本机可执行 `gltf-pipeline`。

### A. 一步流（推荐，最省心）

`batch_fbx2glb_final.sh`

- 适合：大部分常规批处理（FBX → GLB → gltfpack）
- 优点：无中间目录、命令简单、统一出口

### B. 两步流（需要保留中间结果时）

1. `batch_fbx2glb.sh`：先产出原始 GLB
2. `batch_gltfpack.sh`：再做压缩

- 适合：想对比压缩前后质量、排查问题

### C. 已有 GLB → 仅 Draco（`gltf-pipeline -d`）

`batch_gltf_pipeline_draco.sh` / `batch_gltf_pipeline_draco.bat`

- 适合：输入已经是 GLB，且目标环境需要 Draco 网格压缩（或只想走 Draco 管线）
- 前提：已安装 `gltf-pipeline`（常见：`npm i -g gltf-pipeline`）
- 说明：与 gltfpack 是不同压缩方案，按需二选一或分阶段使用，不要假定输出可互换

### D. Blender 脚本（备用）

`fbx_to_glb.py` 可以批量导出 GLB，但在当前实践里更容易出现骨骼动画问题，因此默认不作为首选链路。

## 压缩参数说明（gltfpack）

当前脚本中核心参数：

- `-cc`：网格压缩
- `-tc`：纹理压缩
- `-vpf`：浮点顶点，避免量化导致的骨骼/蒙皮错位
- `-si 0.5`：几何精度缩放（值越小通常体积越小，失真风险越高）

经验上常见体积下降约 70%~95%（视模型和贴图而定）。

## 动画与绑定姿态注意事项

`gltfpack` 在部分模型上会导致“默认绑定姿态恢复逻辑”不再直接适用。

例如这类调用可能失效：

```typescript
if (!object3D || typeof object3D.traverse !== 'function') return
object3D.traverse((child: any) => {
  if (child?.isSkinnedMesh && typeof child.pose === 'function') {
    child.pose()
  }
})
```

可改为“加载后缓存 bind pose，再按需手动恢复”的方式：

```typescript
object3D.traverse((child: any) => {
  if (child.isSkinnedMesh) {
    const skeleton = child.skeleton
    child.userData.bindMatrix = child.bindMatrix.clone()
    skeleton.bones.forEach((bone: any, i: number) => {
      bone.userData.bindPosition = bone.position.clone()
      bone.userData.bindQuaternion = bone.quaternion.clone()
      bone.userData.bindScale = bone.scale.clone()
      bone.userData.bindInverse = skeleton.boneInverses[i].clone()
    })
  }
})
```

```typescript
object3D.traverse((child: any) => {
  if (child.isSkinnedMesh) {
    const skeleton = child.skeleton
    skeleton.bones.forEach((bone: any, i: number) => {
      bone.position.copy(bone.userData.bindPosition)
      bone.quaternion.copy(bone.userData.bindQuaternion)
      bone.scale.copy(bone.userData.bindScale)
      skeleton.boneInverses[i].copy(bone.userData.bindInverse)
    })
    child.bind(child.skeleton, child.userData.bindMatrix)
    child.updateMatrixWorld(true)
  }
})
```

## 补充

- 命令行可直接执行
- fbx2gltf -i model.fbx -o model.glb --khr-materials-unlit
- gltfpack -i model.glb -o model_final.glb -cc -tc -si 0.5

## 其他方案

### 1) Draco 压缩（最常用）

Draco 通常可以将模型体积减少 **50% ~ 90%**。

```bash
gltf-pipeline -i model.glb -o model_draco.glb -d
```

批量（递归目录、保留结构，需已安装 `gltf-pipeline`，一般 `npm i -g gltf-pipeline`）：

```bash
cd /path/to/fbx2glb
chmod +x batch_gltf_pipeline_draco.sh
./batch_gltf_pipeline_draco.sh /path/to/glb_input /path/to/glb_draco_output
```

Windows：`batch_gltf_pipeline_draco.bat C:\in C:\out`

**优点**
- 压缩率高
- three.js 等主流引擎支持较好

**注意**
- 加载时需要解码，CPU 开销会略有增加
- Web 端需要正确配置 Draco Decoder

### 2) Meshopt 压缩（更现代）

Meshopt 通常在保持较好压缩率的同时，带来更快的加载性能。

```bash
gltf-pipeline -i model.glb -o model_opt.glb --meshopt
```

**特点**
- 解码速度快
- 体积表现也不错
- 适合实时渲染场景

### 3) 贴图压缩（往往比模型更关键）

很多项目里，文件体积的大头其实是贴图，而不是网格本身。

#### 使用 KTX2 / Basis 压缩贴图

```bash
gltf-transform etc1s model.glb model_ktx.glb
```

高质量方案（体积略大、质量更好）：

```bash
gltf-transform uastc model.glb model_ktx.glb
```

**效果**
- 贴图体积常见可缩小 **5~10 倍**
- GPU 可直接使用压缩纹理，运行效率更好

### 4) 减少模型复杂度

#### 减面（Decimate）

在 Blender 中可使用：

`Modifier -> Decimate`

可有效减少：
- 顶点数
- 面数

#### 删除无用数据（Prune）

```bash
gltf-transform prune input.glb output.glb
```

可清理：
- 未使用节点
- 冗余动画数据
- 空数据块

### 5) 动画压缩（骨骼动画重点）

骨骼模型中，动画数据通常占比较高，建议单独压缩：

```bash
gltf-transform resample input.glb output.glb
gltf-transform quantize output.glb final.glb
```

**效果**
- 减少关键帧数据量
- 降低骨骼动画体积

## 常见报错排查

- `Error: 未找到 fbx2gltf`：从 [FBX2glTF Releases](https://github.com/facebookincubator/FBX2glTF/releases) 安装并确保在 `PATH`
- `Error: 未找到 gltfpack`：从 [meshoptimizer Releases](https://github.com/zeux/meshoptimizer/releases) 安装并确保在 `PATH`
- `Failed to parse FBX: .../__MACOSX/...`：`__MACOSX` 和 `._` 开头的文件是 Mac 压缩包元数据，非真实 FBX；脚本已自动排除
- Linux 下 `GLIBC_2.34 not found` / `GLIBCXX_3.4.30 not found`：官方 gltfpack 预编译包需 glibc 2.34+（约 Ubuntu 22.04+）；老系统请在目标机上从 meshoptimizer 源码编译
- 输入目录不存在：确认命令参数路径正确（建议用绝对路径）

## 建议的最小验证流程

1. 随机挑 1 个带骨骼动画的 FBX 先跑完整流程
2. 在引擎里验证：动画是否正常、姿态恢复是否正常
3. 再跑整批目录，避免一次性失败后难定位

