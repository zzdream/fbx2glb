import bpy
import os
import sys

argv = sys.argv
argv = argv[argv.index("--") + 1:]

if len(argv) < 2:
    print("Usage: blender --background --python convert_fbx_to_glb.py -- input_folder output_folder")
    sys.exit(1)

input_root = argv[0]
output_root = argv[1]

print("Input:", input_root)
print("Output:", output_root)

count = 0

def fix_materials():
    """
    尽量少动原始材质设置：
    - 默认不改导入 FBX 后的贴图色空间（保持 DCC / 导入器的判断）
    - 只对“明显是法线贴图”的图片强制设为 Non-Color，避免被错误当成 sRGB
    """
    for mat in bpy.data.materials:
        if not mat.node_tree:
            continue

        for node in mat.node_tree.nodes:
            if node.type != 'TEX_IMAGE' or not node.image:
                continue

            img = node.image
            name_lower = (img.name or "").lower()

            try:
                # 只针对法线贴图做修正，其余交给 FBX 导入器/美术原始设置
                if any(k in name_lower for k in ("normal", "norm")):
                    img.colorspace_settings.name = "Non-Color"
            except Exception:
                # 某些内置图或不支持修改色空间的资源直接忽略
                pass


def clean_scene():
    """清空场景"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()


for root, dirs, files in os.walk(input_root):

    rel_path = os.path.relpath(root, input_root)
    out_dir = os.path.join(output_root, rel_path)

    os.makedirs(out_dir, exist_ok=True)

    for file in files:

        if not file.lower().endswith(".fbx"):
            continue

        count += 1

        fbx_path = os.path.join(root, file)
        glb_name = os.path.splitext(file)[0] + ".glb"
        glb_path = os.path.join(out_dir, glb_name)

        print("Converting:", fbx_path)

        bpy.ops.wm.read_factory_settings(use_empty=True)

        # 导入 FBX
        bpy.ops.import_scene.fbx(
            filepath=fbx_path,
            use_custom_normals=True,
            use_image_search=True
        )

        # 修复材质
        fix_materials()

        # 导出 GLB（更激进压缩：Draco 更低量化 + 贴图 JPEG + 不导出切线）
        bpy.ops.export_scene.gltf(
            filepath=glb_path,
            export_format="GLB",

            export_texcoords=True,
            export_normals=True,
            # 不导出切线可显著减小体积，运行时可由法线+UV 计算
            export_tangents=False,

            export_materials="EXPORT",
            export_animations=True,

            export_yup=True,
            export_apply=False,

            # Draco 网格压缩：最高等级 + 更低量化位深以进一步缩小体积
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=10,   # 最高等级，更小体积（导出更慢）
            export_draco_position_quantization=10,    # 12→10，位置精度再降一点换体积
            export_draco_normal_quantization=6,       # 8→6
            export_draco_texcoord_quantization=8,     # 10→8

            # 贴图以 JPEG 嵌入，大幅减小体积（若需无损可改为 'AUTO' 或 'PNG'）
            export_image_format="JPEG",
        )

print("DONE. Converted", count, "files")

# 批量转换 fbx 转 glb
# 终端运行 blender --background --python convert_fbx_to_glb.py -- /path/to/models /path/to/models2

