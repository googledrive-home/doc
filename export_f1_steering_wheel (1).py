import bpy
import json
from pathlib import Path

# Export a separate game-ready GLB. The original .blend is never overwritten.
MAX_GLB_BYTES = 24 * 1024 * 1024
OUT = Path(bpy.path.abspath("//"))
GLB = OUT / "F1_steering_wheel.glb"
MANIFEST = OUT / "F1_steering_wheel_manifest.json"

def lower(obj):
    return (obj.name + " " + (obj.data.name if obj.data else "")).lower()

# The source file contains separately named steering-wheel parts and a
# Ferrari dashboard-screen mesh. Select those mesh parts together so that
# buttons, LEDs, grips, knobs and the display remain separate mesh objects.
KEYWORDS = ("steering_wheel", "steering wheel", "ferrari_dashboard_screen")
wheel_meshes = [
    obj for obj in bpy.context.scene.objects
    if obj.type == "MESH"
    and obj.visible_get()
    and any(key in lower(obj) for key in KEYWORDS)
]
if not wheel_meshes:
    raise RuntimeError(
        "No steering-wheel mesh parts found. Open the original blend file "
        "and check its Outliner before running this exporter."
    )

def image_report():
    result = []
    for img in bpy.data.images:
        if img.type == "IMAGE":
            result.append({
                "name": img.name,
                "width": int(img.size[0]),
                "height": int(img.size[1]),
                "packed": bool(img.packed_file),
                "file_format": img.file_format
            })
    return result

def mesh_report():
    rows = []
    for obj in wheel_meshes:
        rows.append({
            "name": obj.name,
            "dimensions": [round(float(v), 5) for v in obj.dimensions],
            "vertices": len(obj.data.vertices),
            "polygons": len(obj.data.polygons),
            "materials": [
                slot.material.name for slot in obj.material_slots if slot.material
            ],
            "has_uv": len(obj.data.uv_layers) > 0,
            "location": [round(float(v), 5) for v in obj.location],
            "rotation_euler": [round(float(v), 5) for v in obj.rotation_euler],
            "scale": [round(float(v), 5) for v in obj.scale]
        })
    return rows

def export_glb():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in wheel_meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = wheel_meshes[0]
    bpy.ops.export_scene.gltf(
        filepath=str(GLB),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_jpeg_quality=95
    )

# First pass keeps the original texture resolution.
export_glb()
quality_steps = ["original textures"]

# Only reduce textures if the GLB exceeds the 24 MiB target.
textures = [
    img for img in bpy.data.images
    if img.type == "IMAGE" and img.size[0] > 0 and img.size[1] > 0
]
if GLB.stat().st_size > MAX_GLB_BYTES:
    for cap in (4096, 3072, 2048, 1536, 1024):
        for img in textures:
            w, h = int(img.size[0]), int(img.size[1])
            longest = max(w, h)
            if longest > cap:
                factor = cap / longest
                img.scale(max(1, round(w * factor)), max(1, round(h * factor)))
        quality_steps.append(f"textures capped at {cap}px")
        export_glb()
        if GLB.stat().st_size <= MAX_GLB_BYTES:
            break

manifest = {
    "glb": GLB.name,
    "glb_bytes": GLB.stat().st_size,
    "target_bytes": MAX_GLB_BYTES,
    "within_target": GLB.stat().st_size <= MAX_GLB_BYTES,
    "texture_quality_steps": quality_steps,
    "mesh_count": len(wheel_meshes),
    "total_polygons": sum(len(obj.data.polygons) for obj in wheel_meshes),
    "screen_candidates": [
        row for row in mesh_report()
        if any(word in row["name"].lower()
               for word in ("screen", "display", "lcd", "ferrari_dashboard"))
    ],
    "meshes": mesh_report(),
    "images": image_report(),
    "integration_note": (
        "Use the mesh named ferrari_dashboard_screen as the live display surface. "
        "The game should replace that mesh material's colour map with its existing "
        "dashCanvas/dashTexture, retaining the exported screen UVs."
    )
}
MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

print("Exported:", GLB)
print(f"GLB size: {GLB.stat().st_size:,} bytes "
      f"({GLB.stat().st_size / 1024 / 1024:.2f} MiB)")
print("Within 24 MiB target:", GLB.stat().st_size <= MAX_GLB_BYTES)
print("Meshes:", len(wheel_meshes))
print("Polygons:", manifest["total_polygons"])
print("Screen candidates:")
for item in manifest["screen_candidates"]:
    print(" -", item["name"], "| materials:", item["materials"],
          "| UV:", item["has_uv"])
print("Manifest:", MANIFEST)
