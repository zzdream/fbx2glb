#!/bin/bash

INPUT_FOLDER="$1"
OUTPUT_FOLDER="$2"

if [ -z "$INPUT_FOLDER" ] || [ -z "$OUTPUT_FOLDER" ]; then
    echo "Usage: ./batch_fbx2glb_final.sh /path/to/fbx /path/to/final_glb"
    echo "一步完成：FBX -> GLB -> gltfpack 压缩"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -x "$SCRIPT_DIR/batch_fbx2glb.sh" ]; then
    echo "Error: 缺少可执行脚本 batch_fbx2glb.sh"
    exit 1
fi

if [ ! -x "$SCRIPT_DIR/batch_gltfpack.sh" ]; then
    echo "Error: 缺少可执行脚本 batch_gltfpack.sh"
    exit 1
fi

TMP_GLB_DIR="$(mktemp -d -t fbx2glb_tmp_XXXXXX)"
cleanup() {
    rm -rf "$TMP_GLB_DIR"
}
trap cleanup EXIT

echo "Step 1/2: FBX -> GLB (临时目录)"
"$SCRIPT_DIR/batch_fbx2glb.sh" "$INPUT_FOLDER" "$TMP_GLB_DIR" || exit 1

echo ""
echo "Step 2/2: gltfpack 压缩 -> 最终目录"
"$SCRIPT_DIR/batch_gltfpack.sh" "$TMP_GLB_DIR" "$OUTPUT_FOLDER" || exit 1

echo ""
echo "清理: 删除与 FBX 同名的 .fbm 目录"
cleaned=0
while IFS= read -r -d '' f; do
    fbm_dir="${f%.*}.fbm"
    if [ -d "$fbm_dir" ]; then
        rm -rf "$fbm_dir"
        ((cleaned++))
    fi
done < <(find "$INPUT_FOLDER" -type f \( -iname "*.fbx" \) -not -path "*/__MACOSX/*" -not -name "._*" -print0)
echo "清理完成: 删除 $cleaned 个 .fbm 目录"

echo ""
echo "全部完成，输出目录: $OUTPUT_FOLDER"

# ./batch_fbx2glb_final.sh /path/to/models /path/to/glb_compressed
# ./batch_fbx2glb_final.sh /path/to/models/vehicle /path/to/output/vehicle