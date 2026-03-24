# fbx2glb：脚本编排（在仓库根目录执行 make）
SHELL := /bin/bash
ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

.PHONY: help init check-deps final fbx2glb pack

# 兼容你直接传参的用法：
# make final /path/to/fbx /path/to/output
# make fbx2glb /path/to/fbx /path/to/glb
# make pack /path/to/glb /path/to/output
ifeq ($(firstword $(MAKECMDGOALS)),final)
  INPUT ?= $(word 2,$(MAKECMDGOALS))
  OUTPUT ?= $(word 3,$(MAKECMDGOALS))
endif

ifeq ($(firstword $(MAKECMDGOALS)),fbx2glb)
  INPUT ?= $(word 2,$(MAKECMDGOALS))
  OUTPUT ?= $(word 3,$(MAKECMDGOALS))
endif

ifeq ($(firstword $(MAKECMDGOALS)),pack)
  INPUT ?= $(word 2,$(MAKECMDGOALS))
  OUTPUT ?= $(word 3,$(MAKECMDGOALS))
endif

help:
	@echo "fbx2glb 工作流（脚本 + Makefile）"
	@echo ""
	@echo "  make init                         # 一次性：chmod +x 三个批量脚本"
	@echo "  make check-deps                   # 检查 fbx2gltf、gltfpack 是否在 PATH"
	@echo ""
	@echo "  make final INPUT=/path/to/fbx OUTPUT=/path/to/out"
	@echo "  make final /path/to/fbx /path/to/out   # 位置参数（兼容）"
	@echo "      推荐：FBX → GLB（临时）→ gltfpack，无中间目录"
	@echo ""
	@echo "  make fbx2glb INPUT=/path/to/fbx OUTPUT=/path/to/glb"
	@echo "  make fbx2glb /path/to/fbx /path/to/glb   # 位置参数（兼容）"
	@echo "      仅批量 FBX → GLB"
	@echo ""
	@echo "  make pack INPUT=/path/to/glb OUTPUT=/path/to/out"
	@echo "  make pack /path/to/glb /path/to/out      # 位置参数（兼容）"
	@echo "      仅批量 gltfpack 压缩"
	@echo ""

init:
	chmod +x "$(ROOT)/batch_fbx2glb_final.sh" "$(ROOT)/batch_fbx2glb.sh" "$(ROOT)/batch_gltfpack.sh"
	@echo "已设置脚本可执行"

check-deps:
	@command -v fbx2gltf >/dev/null 2>&1 || { echo "Error: 未找到 fbx2gltf"; exit 1; }
	@command -v gltfpack >/dev/null 2>&1 || { echo "Error: 未找到 gltfpack"; exit 1; }
	@echo "依赖 OK: fbx2gltf, gltfpack"

final: init check-deps
	@test -n "$(INPUT)" -a -n "$(OUTPUT)" || { echo "用法: make final INPUT=/abs/fbx OUTPUT=/abs/out"; exit 1; }
	"$(ROOT)/batch_fbx2glb_final.sh" "$(INPUT)" "$(OUTPUT)"

fbx2glb: init
	@test -n "$(INPUT)" -a -n "$(OUTPUT)" || { echo "用法: make fbx2glb INPUT=... OUTPUT=..."; exit 1; }
	@command -v fbx2gltf >/dev/null 2>&1 || { echo "Error: 未找到 fbx2gltf"; exit 1; }
	"$(ROOT)/batch_fbx2glb.sh" "$(INPUT)" "$(OUTPUT)"

pack: init
	@test -n "$(INPUT)" -a -n "$(OUTPUT)" || { echo "用法: make pack INPUT=... OUTPUT=..."; exit 1; }
	@command -v gltfpack >/dev/null 2>&1 || { echo "Error: 未找到 gltfpack"; exit 1; }
	"$(ROOT)/batch_gltfpack.sh" "$(INPUT)" "$(OUTPUT)"

