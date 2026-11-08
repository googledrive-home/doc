Industrial Site Ops map asset contract

The game automatically looks for the reconstructed industrial environment here:

assets/industrial-site/industrial-site.glb

For a multi-file reconstruction, add:

assets/industrial-site/manifest.json

Example manifest:
{
  "models": [
    "chunks/site-ground.glb",
    "chunks/warehouse-and-pipework.glb",
    {
      "file": "chunks/tank-farm.glb",
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1]
    }
  ]
}

Paths are relative to assets/industrial-site/. GLB/glTF files should be web-ready exports with their materials and textures embedded or included at resolvable relative paths. Keep the Unity source project and .meta files separately if you need them for Unity editing; a browser Three.js game cannot directly render Unity .unity scenes, .prefab files or raw FBX source without conversion.

The game also has a procedural industrial preview layout so it remains playable before the reconstructed GLB assets are uploaded.

Controls:
ON FOOT: WASD move, mouse look, Shift run, Space jump, E scan, F inspection light.
FPV DRONE: W/S pitch, A/D roll, Q/E yaw, Space thrust, Shift descend, mouse look, V switch ACRO/STAB.
TAB switches between on-foot and FPV drone modes. R resets the current mode. E scans survey targets in either mode.
