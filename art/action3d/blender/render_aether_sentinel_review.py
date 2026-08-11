"""Render a stable modeling review frame from the generated Aether Sentinel blend."""

from __future__ import annotations

import os
import pathlib

import bpy
from mathutils import Vector


ROOT = pathlib.Path(__file__).resolve().parents[3]
OUTPUT = pathlib.Path(
    os.environ.get(
        "ACTION3D_REVIEW_OUTPUT",
        ROOT / "art" / "action3d" / "reviews" / "aether-sentinel-quality-pass-v2.png",
    )
)


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUTPUT)
    scene.render.film_transparent = False
    scene.world.color = (0.025, 0.035, 0.04)

    bpy.ops.object.camera_add(location=(4.4, -7.2, 3.0))
    camera = bpy.context.object
    camera.data.lens = 62
    point_at(camera, (0, 0, 1.3))
    scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(-3.5, -4.5, 6.0))
    key = bpy.context.object
    key.data.energy = 1100
    key.data.shape = "DISK"
    key.data.size = 5
    point_at(key, (0, 0, 1.3))
    bpy.ops.object.light_add(type="AREA", location=(4.5, 1.5, 3.6))
    rim = bpy.context.object
    rim.data.energy = 850
    rim.data.color = (0.15, 0.7, 0.85)
    rim.data.size = 4
    point_at(rim, (0, 0, 1.4))

    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.015))
    ground = bpy.context.object
    ground.name = "ReviewGround"
    material = bpy.data.materials.new("ReviewGroundMaterial")
    material.diffuse_color = (0.025, 0.045, 0.05, 1)
    material.use_nodes = True
    ground.data.materials.append(material)

    action_name = os.environ.get("ACTION3D_REVIEW_ACTION")
    if action_name:
        rig = bpy.data.objects["AetherSentinelSkeleton"]
        rig.animation_data_create()
        rig.animation_data.action = bpy.data.actions[action_name]
    scene.frame_set(int(os.environ.get("ACTION3D_REVIEW_FRAME", "0")))
    bpy.ops.render.render(write_still=True)
    print(f"ACTION3D_REVIEW {OUTPUT}")


if __name__ == "__main__":
    main()
