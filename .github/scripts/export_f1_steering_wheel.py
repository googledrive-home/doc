import bpy
import json
import os
from pathlib import Path
from mathutils import Vector

input_blend = Path(os.environ["APEX_WHEEL_BLEND"])
output_dir = Path(os.environ["APEX_WHEEL_OUTPUT"])
output_dir.mkdir(parents=True, exist_ok=True)
glb_path = output_dir / "F1_steering_wheel.glb"
manifest_path = output_dir / "F1_steering_wheel_manifest.json"
max_bytes = 24 * 1024 * 1024

if bpy.data.filepath != str(input_blend):
    bpy.ops.wm.open_mainfile(filepath=str(input_blend))

# Keep the model's physically separate parts separate in the GLB. That is
# important: the game will raycast these real mesh surfaces for button input.
keywords = (
    "steering_wheel", "steering wheel", "ferrari_dashboard_screen",
    "ferrari-logo", "paddle_", "paddle "
)
mesh_objects = []
for obj in bpy.context.scene.objects:
    if obj.type != "MESH" or not obj.visible_get():
        continue
    label = (obj.name + " " + (obj.data.name if obj.data else "")).lower()
    if any(key in label for key in keywords):
        mesh_objects.append(obj)

if not mesh_objects:
    raise RuntimeError("No Ferrari steering wheel mesh objects were found.")

# Collect only images referenced by selected mesh materials. This avoids
# carrying unrelated scenes and textures into the game asset.
used_images = {}
for obj in mesh_objects:
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes or not mat.node_tree:
            continue
        for node in mat.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image:
                used_images[node.image.name] = node.image

# Report all world-space object bounds and exact mesh/material names so the
# in-game script can target the screen and actual knobs/buttons.
def object_record(obj):
    bpy.context.view_layer.update()
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    lo = [min(v[i] for v in corners) for i in range(3)]
    hi = [max(v[i] for v in corners) for i in range(3)]
    by_material = {}
    for poly in obj.data.polygons:
        idx = poly.material_index
        by_material[str(idx)] = by_material.get(str(idx), 0) + 1
    return {
        "name": obj.name,
        "data_name": obj.data.name,
        "world_min": [round(v, 6) for v in lo],
        "world_max": [round(v, 6) for v in hi],
        "world_dimensions": [round(hi[i] - lo[i], 6) for i in range(3)],
        "world_matrix": [[round(float(v), 7) for v in row] for row in obj.matrix_world],
        "vertices": len(obj.data.vertices),
        "polygons": len(obj.data.polygons),
        "uv_layers": [layer.name for layer in obj.data.uv_layers],
        "materials": [
            slot.material.name if slot.material else None
            for slot in obj.material_slots
        ],
        "polygons_by_material_index": by_material
    }

def export_glb():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_jpeg_quality=94
    )

# Preserve original texture resolution whenever possible. If required by the
# repository size cap, progressively scale only textures used by this wheel.
export_glb()
quality_steps = ["original texture resolution"]
if glb_path.stat().st_size > max_bytes:
    for cap in (4096, 3072, 2048, 1536, 1024):
        for image in used_images.values():
            width, height = map(int, image.size)
            longest = max(width, height)
            if longest > cap:
                ratio = cap / float(longest)
                image.scale(max(1, round(width * ratio)), max(1, round(height * ratio)))
        quality_steps.append("wheel textures capped at " + str(cap) + "px")
        export_glb()
        if glb_path.stat().st_size <= max_bytes:
            break

records = [object_record(obj) for obj in mesh_objects]
screen_records = [
    item for item in records
    if any(k in item["name"].lower() for k in ("dashboard_screen", "display_screen", "lcd"))
]
control_records = [
    item for item in records
    if any(k in item["name"].lower() for k in (
        "button", "knob", "switch", "paddle", "led"
    ))
]
all_points = [Vector((x, y, z))
              for item in records
              for x in item["world_min"] for y in [] for z in []]  # empty; bounds below
bounds_min = [min(item["world_min"][i] for item in records) for i in range(3)]
bounds_max = [max(item["world_max"][i] for item in records) for i in range(3)]
images = [{
    "name": image.name,
    "width": int(image.size[0]),
    "height": int(image.size[1]),
    "packed": bool(image.packed_file),
    "filepath": image.filepath,
    "has_data": bool(image.has_data)
} for image in used_images.values()]

manifest = {
    "source_blend": input_blend.name,
    "glb": glb_path.name,
    "glb_bytes": glb_path.stat().st_size,
    "glb_mib": round(glb_path.stat().st_size / (1024 * 1024), 3),
    "max_bytes": max_bytes,
    "within_limit": glb_path.stat().st_size <= max_bytes,
    "texture_quality_steps": quality_steps,
    "mesh_count": len(records),
    "total_polygons": sum(item["polygons"] for item in records),
    "world_bounds": {"min": bounds_min, "max": bounds_max,
                     "dimensions": [bounds_max[i] - bounds_min[i] for i in range(3)]},
    "screen_meshes": screen_records,
    "control_meshes": control_records,
    "meshes": records,
    "textures": images
}
manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print("APEX wheel export:", glb_path, glb_path.stat().st_size, "bytes")
print("Meshes:", len(records), "Polygons:", manifest["total_polygons"])
print("Screen meshes:", [x["name"] for x in screen_records])
print("Control meshes:", [x["name"] for x in control_records])
print("Texture steps:", quality_steps)
print("Within 24 MiB:", manifest["within_limit"])
if not manifest["within_limit"]:
    raise RuntimeError("Wheel GLB exceeds 24 MiB even after texture optimisation.")
