
# fbx2glb：与 Makefile 等价，需安装 https://github.com/casey/just
# 在仓库根目录执行；首次可运行: just init

set shell := ["bash", "-eu", "-o", "pipefail", "-c"]
# 列出任务
default:
	@just --list
# 一次性为三个批量脚本加执行权限
init:
	chmod +x batch_fbx2glb_final.sh batch_fbx2glb.sh batch_gltfpack.sh batch_gltf_pipeline_draco.sh
	@echo "已设置脚本可执行"
# 检查 PATH 中是否有 fbx2gltf、gltfpack
check-deps:
	command -v fbx2gltf >/dev/null
	command -v gltfpack >/dev/null
	@echo "依赖 OK: fbx2gltf, gltfpack"
# 推荐：FBX → 临时 GLB → gltfpack 输出最终目录
final input output: init check-deps
	./batch_fbx2glb_final.sh "{{input}}" "{{output}}"
# 仅 FBX → GLB
fbx2glb input output: init
	command -v fbx2gltf >/dev/null
	./batch_fbx2glb.sh "{{input}}" "{{output}}"
# 仅压缩已有 GLB
pack input output: init
	command -v gltfpack >/dev/null
	./batch_gltfpack.sh "{{input}}" "{{output}}"

# 仅批量 gltf-pipeline -d（Draco）压缩已有 GLB
draco input output: init
	command -v gltf-pipeline >/dev/null
	./batch_gltf_pipeline_draco.sh "{{input}}" "{{output}}"
