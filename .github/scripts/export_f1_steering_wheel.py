import bpy
import json
import os
import shutil
from pathlib import Path
from mathutils import Vector

blend_path = Path(os.environ["APEX_WHEEL_BLEND"])
output_dir = Path(os.environ["APEX_WHEEL_OUTPUT"])
output_dir.mkdir(parents=True, exist_ok=True)
max_file_bytes = 24 * 1024 * 1024

if bpy.data.filepath != str(blend_path):
    bpy.ops.wm.open_mainfile(filepath=str(blend_path))

# Each named part remains a separate mesh. The game uses these real objects
# for screen projection, physical button raycasts, and shift-paddle inputs.
control_words = (
    "top_buttons", "turning_knobs", "turning_switches",
    "turnable_knobs", "middle_turning_knob", "inter_switch",
    "top_leds", "top_panel_leds", "led_case"
)
wheel_words = (
    "steering_wheel", "ferrari_dashboard_screen", "ferrari-logo",
    "paddle_", "paddle "
)
mesh_objects = []
for obj in bpy.context.scene.objects:
    if obj.type != "MESH" or not obj.visible_get():
        continue
    label = (obj.name + " " + (obj.data.name if obj.data else "")).lower()
    if any(word in label for word in wheel_words):
        mesh_objects.append(obj)

if not mesh_objects:
    raise RuntimeError("No Ferrari steering wheel mesh objects were found.")

def group_name(obj):
    name = obj.name.lower()
    return "controls" if any(word in name for word in control_words) else "core"

groups = {
    "core": [obj for obj in mesh_objects if group_name(obj) == "core"],
    "controls": [obj for obj in mesh_objects if group_name(obj) == "controls"]
}
if not groups["core"] or not groups["controls"]:
    raise RuntimeError("The wheel could not be separated into body and control groups.")

used_images = {}
for obj in mesh_objects:
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes or not mat.node_tree:
            continue
        for node in mat.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image and node.image.type == "IMAGE":
                used_images[node.image.name] = node.image

def world_bounds(obj):
    bpy.context.view_layer.update()
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    lo = [min(v[i] for v in corners) for i in range(3)]
    hi = [max(v[i] for v in corners) for i in range(3)]
    return lo, hi

def connected_parts(obj, limit=80):
    mesh = obj.data
    count = len(mesh.vertices)
    if count == 0:
        return []
    parent = list(range(count))
    rank = bytearray(count)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra == rb:
            return
        if rank[ra] < rank[rb]:
            ra, rb = rb, ra
        parent[rb] = ra
        if rank[ra] == rank[rb]:
            rank[ra] += 1

    for edge in mesh.edges:
        union(int(edge.vertices[0]), int(edge.vertices[1]))

    parts = {}
    for vertex in mesh.vertices:
        root = find(vertex.index)
        item = parts.get(root)
        if item is None:
            item = {"vertices": 0, "polygons": 0, "min": [float("inf")] * 3,
                    "max": [float("-inf")] * 3, "sum": [0.0] * 3}
            parts[root] = item
        p = obj.matrix_world @ vertex.co
        item["vertices"] += 1
        for axis in range(3):
            value = float(p[axis])
            item["sum"][axis] += value
            item["min"][axis] = min(item["min"][axis], value)
            item["max"][axis] = max(item["max"][axis], value)

    for poly in mesh.polygons:
        if poly.vertices:
            parts[find(int(poly.vertices[0]))]["polygons"] += 1

    rows = []
    for item in parts.values():
        if item["polygons"] == 0:
            continue
        n = item["vertices"]
        rows.append({
            "vertices": item["vertices"],
            "polygons": item["polygons"],
            "world_center": [round(v / n, 6) for v in item["sum"]],
            "world_min": [round(v, 6) for v in item["min"]],
            "world_max": [round(v, 6) for v in item["max"]],
            "world_dimensions": [round(item["max"][i] - item["min"][i], 6) for i in range(3)]
        })
    rows.sort(key=lambda x: x["vertices"], reverse=True)
    return rows[:limit]

def object_record(obj):
    lo, hi = world_bounds(obj)
    by_material = {}
    for poly in obj.data.polygons:
        index = poly.material_index
        by_material[str(index)] = by_material.get(str(index), 0) + 1
    name = obj.name.lower()
    return {
        "name": obj.name,
        "data_name": obj.data.name,
        "group": group_name(obj),
        "world_min": [round(v, 6) for v in lo],
        "world_max": [round(v, 6) for v in hi],
        "world_dimensions": [round(hi[i] - lo[i], 6) for i in range(3)],
        "world_matrix": [[round(float(v), 7) for v in row] for row in obj.matrix_world],
        "vertices": len(obj.data.vertices),
        "polygons": len(obj.data.polygons),
        "uv_layers": [layer.name for layer in obj.data.uv_layers],
        "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
        "polygons_by_material_index": by_material,
        "connected_components": connected_parts(obj) if any(
            word in name for word in control_words
        ) else []
    }

def clear_previous_export():
    for path in output_dir.iterdir():
        if path.is_file():
            path.unlink()
        elif path.is_dir():
            shutil.rmtree(path)

def export_group(name, objects, decimate_ratio=None):
    if decimate_ratio is not None:
        for obj in objects:
            if len(obj.data.polygons) < 2500:
                continue
            modifier = obj.modifiers.new("APEX export optimisation", "DECIMATE")
            modifier.decimate_type = "COLLAPSE"
            modifier.ratio = decimate_ratio
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            obj.select_set(False)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = output_dir / ("F1_steering_wheel_" + name + ".gltf")
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLTF_SEPARATE",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_jpeg_quality=94
    )
    return path

clear_previous_export()
quality_steps = {"core": "full original geometry", "controls": "full original geometry"}
export_paths = {}
for group, objects in groups.items():
    export_paths[group] = export_group(group, objects)

# If an individual binary asset crosses the per-file repository limit,
# reload the exact source and try progressively mild geometry reduction for
# that group only. The original .blend and source textures remain untouched.
original_names = {group: [obj.name for obj in objects] for group, objects in groups.items()}
for group, path in export_paths.items():
    bin_path = path.with_suffix(".bin")
    if bin_path.exists() and bin_path.stat().st_size > max_file_bytes:
        for ratio in (0.90, 0.82, 0.74):
            bpy.ops.wm.open_mainfile(filepath=str(blend_path))
            mesh_objects = [bpy.data.objects[name] for name in
                            sorted({n for names in original_names.values() for n in names})
                            if name in bpy.data.objects]
            groups[group] = [bpy.data.objects[name] for name in original_names[group]
                             if name in bpy.data.objects]
            export_group(group, groups[group], decimate_ratio=ratio)
            quality_steps[group] = "geometry decimated to " + str(ratio)
            if bin_path.exists() and bin_path.stat().st_size <= max_file_bytes:
                break

records = [object_record(obj) for obj in mesh_objects]
screen_records = [
    item for item in records
    if any(word in item["name"].lower()
           for word in ("dashboard_screen", "display_screen", "lcd"))
]
control_records = [item for item in records if item["connected_components"]]
all_output_files = [p for p in output_dir.iterdir() if p.is_file()]
file_rows = [{
    "name": p.name,
    "bytes": p.stat().st_size,
    "mib": round(p.stat().st_size / (1024 * 1024), 3)
} for p in sorted(all_output_files)]
largest = max((p.stat().st_size for p in all_output_files), default=0)

bounds_min = [min(item["world_min"][i] for item in records) for i in range(3)]
bounds_max = [max(item["world_max"][i] for item in records) for i in range(3)]
manifest = {
    "format": "glTF 2.0 with external binary and textures",
    "load_files": [export_paths["core"].name, export_paths["controls"].name],
    "max_individual_file_bytes": max_file_bytes,
    "all_files_under_limit": largest <= max_file_bytes,
    "largest_file_bytes": largest,
    "file_quality_steps": quality_steps,
    "files": file_rows,
    "mesh_count": len(records),
    "total_polygons": sum(item["polygons"] for item in records),
    "world_bounds": {"min": bounds_min, "max": bounds_max,
                     "dimensions": [bounds_max[i] - bounds_min[i] for i in range(3)]},
    "screen_meshes": screen_records,
    "control_meshes": control_records,
    "meshes": records,
    "textures": [{
        "name": image.name,
        "width": int(image.size[0]),
        "height": int(image.size[1]),
        "packed": bool(image.packed_file),
        "has_data": bool(image.has_data)
    } for image in used_images.values()]
}
(output_dir / "F1_steering_wheel_manifest.json").write_text(
    json.dumps(manifest, indent=2), encoding="utf-8"
)
print(json.dumps({
    "files": file_rows,
    "largest_file_bytes": largest,
    "all_files_under_limit": manifest["all_files_under_limit"],
    "mesh_count": len(records),
    "total_polygons": manifest["total_polygons"],
    "screen_meshes": [x["name"] for x in screen_records],
    "control_meshes": [x["name"] for x in control_records],
    "quality_steps": quality_steps
}, indent=2))
if not manifest["all_files_under_limit"]:
    raise RuntimeError("At least one wheel export file still exceeds 24 MiB.")
