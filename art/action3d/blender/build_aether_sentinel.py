"""Build the A2 Aether Sentinel game mesh and export it as GLB."""

from __future__ import annotations

import pathlib
import sys
from math import pi

import bpy

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_aether_runner as rig_tools


FPS = 30
ROOT = pathlib.Path(__file__).resolve().parents[3]
DEFAULT_BLEND_PATH = ROOT / "art" / "action3d" / "enemies" / "aether-sentinel.blend"
DEFAULT_GLB_PATH = (
    ROOT
    / "web"
    / "public"
    / "assets"
    / "action3d"
    / "enemies"
    / "aether-sentinel.glb"
)


def argument(name: str, default: pathlib.Path) -> pathlib.Path:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if name not in arguments:
        return default
    index = arguments.index(name)
    if index + 1 >= len(arguments):
        raise ValueError(f"{name} requires a path")
    return pathlib.Path(arguments[index + 1]).resolve()


def create_rig():
    root = bpy.data.objects.new("AetherSentinelRoot", None)
    bpy.context.scene.collection.objects.link(root)
    armature_data = bpy.data.armatures.new("AetherSentinelSkeleton")
    rig = bpy.data.objects.new("AetherSentinelSkeleton", armature_data)
    bpy.context.scene.collection.objects.link(rig)
    rig.parent = root
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    rig_tools.add_bone(armature_data, "root", (0, 0, 0), (0, 0, 0.3))
    rig_tools.add_bone(armature_data, "hips", (0, 0, 0.95), (0, 0, 1.2), "root")
    rig_tools.add_bone(armature_data, "chest", (0, 0, 1.15), (0, 0, 1.95), "hips")
    rig_tools.add_bone(armature_data, "head", (0, 0, 1.92), (0, 0, 2.42), "chest")
    for side, x in (("L", 1), ("R", -1)):
        rig_tools.add_bone(armature_data, f"upper_arm.{side}", (0.48 * x, 0, 1.82), (0.84 * x, 0, 1.55), "chest")
        rig_tools.add_bone(armature_data, f"lower_arm.{side}", (0.84 * x, 0, 1.55), (1.0 * x, 0, 1.12), f"upper_arm.{side}")
        rig_tools.add_bone(armature_data, f"hand.{side}", (1.0 * x, 0, 1.12), (1.04 * x, 0, 0.95), f"lower_arm.{side}")
        rig_tools.add_bone(armature_data, f"upper_leg.{side}", (0.27 * x, 0, 1.02), (0.3 * x, 0, 0.56), "hips")
        rig_tools.add_bone(armature_data, f"lower_leg.{side}", (0.3 * x, 0, 0.56), (0.3 * x, 0, 0.15), f"upper_leg.{side}")
        rig_tools.add_bone(armature_data, f"foot.{side}", (0.3 * x, 0, 0.16), (0.3 * x, -0.28, 0.08), f"lower_leg.{side}")

    bpy.ops.object.mode_set(mode="POSE")
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)
    return root, rig


def build_meshes(rig):
    stone = rig_tools.material("Sentinel.Stone", (0.11, 0.26, 0.25, 1), 0.08, 0.68)
    stone_dark = rig_tools.material("Sentinel.StoneDark", (0.035, 0.08, 0.085, 1), 0.1, 0.6)
    iron = rig_tools.material("Sentinel.Iron", (0.035, 0.045, 0.048, 1), 0.78, 0.27)
    brass = rig_tools.material("Sentinel.Brass", (0.48, 0.3, 0.075, 1), 0.72, 0.24)
    core = rig_tools.material("Sentinel.Core", (1.0, 0.28, 0.012, 1), 0.06, 0.12)
    core.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1.0, 0.12, 0.005, 1)
    core.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 5.0

    # Mechanical under-frame and faceted stone shell.
    rig_tools.add_cube("Sentinel.Hips", (0, 0, 1.02), (0.32, 0.2, 0.17), rig, "hips", iron, 0.07, bevel_segments=4)
    rig_tools.add_sphere("Sentinel.Abdomen", (0, 0, 1.32), (0.28, 0.2, 0.31), rig, "chest", iron, 24, 14)
    rig_tools.add_extruded_profile("Sentinel.ChestPlate.L", [(-0.06, -0.32), (0.34, -0.22), (0.42, 0.22), (0.18, 0.38), (-0.03, 0.17)], 0.07, (0.04, -0.245, 1.62), rig, "chest", stone, 0.035)
    rig_tools.add_extruded_profile("Sentinel.ChestPlate.R", [(-0.42, 0.22), (-0.34, -0.22), (0.06, -0.32), (0.03, 0.17), (-0.18, 0.38)], 0.07, (-0.04, -0.245, 1.62), rig, "chest", stone, 0.035)
    rig_tools.add_cube("Sentinel.SpineMass", (0, 0.12, 1.63), (0.43, 0.18, 0.39), rig, "chest", stone_dark, 0.11, bevel_segments=4)
    rig_tools.add_cube("Sentinel.Waist", (0, 0, 1.12), (0.22, 0.17, 0.12), rig, "hips", brass, 0.045)

    # The concentric emissive core is the enemy's unmistakable combat read.
    rig_tools.add_torus("Sentinel.CoreOuter", (0, -0.335, 1.64), 0.245, 0.045, rig, "chest", brass)
    rig_tools.add_torus("Sentinel.CoreInner", (0, -0.38, 1.64), 0.165, 0.025, rig, "chest", iron)
    rig_tools.add_sphere("Sentinel.Core", (0, -0.402, 1.64), (0.135, 0.035, 0.135), rig, "chest", core, 24, 14)
    for angle, x, z in ((0, 0, 1), (1, 1, 0), (2, 0, -1), (3, -1, 0)):
        rig_tools.add_cube(f"Sentinel.CoreClamp.{angle}", (0.28 * x, -0.35, 1.64 + 0.28 * z), (0.055, 0.045, 0.095), rig, "chest", brass, 0.018, rotation=(0, 0, -angle * pi / 2))

    # A wedge helmet, cheek plates and bright slit replace the anonymous head box.
    rig_tools.add_extruded_profile("Sentinel.Helmet", [(-0.28, -0.25), (-0.23, 0.18), (-0.07, 0.34), (0.22, 0.27), (0.3, -0.12), (0.16, -0.3), (-0.14, -0.32)], 0.23, (0, 0, 2.16), rig, "head", stone, 0.045)
    rig_tools.add_extruded_profile("Sentinel.FacePlate", [(-0.23, 0.16), (0.2, 0.16), (0.18, -0.17), (0.05, -0.27), (-0.16, -0.19)], 0.035, (0, -0.275, 2.13), rig, "head", stone_dark, 0.025)
    rig_tools.add_cube("Sentinel.Visor", (0, -0.325, 2.2), (0.17, 0.018, 0.035), rig, "head", core, 0.01)
    rig_tools.add_extruded_profile("Sentinel.Crest", [(-0.07, -0.2), (-0.045, 0.22), (0.08, 0.38), (0.13, -0.12), (0.05, -0.23)], 0.11, (0, 0.035, 2.38), rig, "head", stone_dark, 0.025)

    for side, x in (("L", 1), ("R", -1)):
        rig_tools.add_sphere(f"Sentinel.ShoulderJoint.{side}", (0.5 * x, 0, 1.79), (0.2, 0.19, 0.2), rig, f"upper_arm.{side}", iron, 20, 12)
        rig_tools.add_extruded_profile(f"Sentinel.ShoulderPlate.{side}", [(-0.31, -0.12), (-0.24, 0.18), (0, 0.28), (0.34, 0.12), (0.25, -0.16), (0, -0.24)], 0.22, (0.56 * x, -0.02, 1.88), rig, f"upper_arm.{side}", stone, 0.045, rotation=(0, 0, -0.17 * x))
        rig_tools.add_cube(f"Sentinel.ShoulderTrim.{side}", (0.59 * x, -0.25, 1.88), (0.22, 0.025, 0.035), rig, f"upper_arm.{side}", brass, 0.014, rotation=(0, 0, -0.17 * x))
        rig_tools.add_limb(f"Sentinel.UpperArm.{side}", (0.58 * x, 0, 1.69), (0.84 * x, 0, 1.49), 0.18, rig, f"upper_arm.{side}", iron, 0.15, 16, 0.028)
        rig_tools.add_sphere(f"Sentinel.Elbow.{side}", (0.84 * x, 0, 1.48), (0.19, 0.18, 0.19), rig, f"lower_arm.{side}", brass, 20, 12)
        rig_tools.add_limb(f"Sentinel.Forearm.{side}", (0.86 * x, 0, 1.43), (0.99 * x, 0, 1.12), 0.205, rig, f"lower_arm.{side}", stone_dark, 0.165, 16, 0.032)
        rig_tools.add_extruded_profile(f"Sentinel.ForearmPlate.{side}", [(-0.17, 0.22), (0.18, 0.16), (0.15, -0.2), (0, -0.3), (-0.14, -0.2)], 0.19, (0.94 * x, -0.06, 1.28), rig, f"lower_arm.{side}", stone, 0.028, rotation=(0, 0, -0.22 * x))
        rig_tools.add_sphere(f"Sentinel.Hand.{side}", (1.02 * x, 0, 1.02), (0.145, 0.14, 0.17), rig, f"hand.{side}", iron, 18, 10)

        rig_tools.add_sphere(f"Sentinel.HipJoint.{side}", (0.27 * x, 0, 0.96), (0.21, 0.19, 0.22), rig, f"upper_leg.{side}", iron, 20, 12)
        rig_tools.add_limb(f"Sentinel.Thigh.{side}", (0.27 * x, 0, 0.91), (0.3 * x, 0, 0.58), 0.215, rig, f"upper_leg.{side}", stone_dark, 0.18, 16, 0.035)
        rig_tools.add_extruded_profile(f"Sentinel.ThighPlate.{side}", [(-0.2, 0.2), (0.19, 0.16), (0.17, -0.2), (0, -0.29), (-0.17, -0.18)], 0.19, (0.29 * x, -0.08, 0.75), rig, f"upper_leg.{side}", stone, 0.03)
        rig_tools.add_sphere(f"Sentinel.Knee.{side}", (0.3 * x, -0.02, 0.53), (0.19, 0.18, 0.19), rig, f"lower_leg.{side}", brass, 20, 12)
        rig_tools.add_sphere(f"Sentinel.KneeCore.{side}", (0.3 * x, -0.18, 0.53), (0.09, 0.025, 0.09), rig, f"lower_leg.{side}", core, 16, 10)
        rig_tools.add_limb(f"Sentinel.Shin.{side}", (0.3 * x, 0, 0.48), (0.3 * x, 0, 0.17), 0.19, rig, f"lower_leg.{side}", stone_dark, 0.145, 16, 0.03)
        rig_tools.add_extruded_profile(f"Sentinel.ShinPlate.{side}", [(-0.18, 0.21), (0.18, 0.21), (0.15, -0.2), (0, -0.28), (-0.15, -0.2)], 0.16, (0.3 * x, -0.1, 0.32), rig, f"lower_leg.{side}", stone, 0.027)
        rig_tools.add_cube(f"Sentinel.Foot.{side}", (0.3 * x, -0.105, 0.13), (0.205, 0.29, 0.13), rig, f"foot.{side}", stone, 0.065, rotation=(0, 0, 0.025 * x), bevel_segments=4)
        rig_tools.add_cube(f"Sentinel.Heel.{side}", (0.3 * x, 0.16, 0.17), (0.17, 0.11, 0.16), rig, f"foot.{side}", iron, 0.04)
        rig_tools.add_cube(f"Sentinel.FootTrim.{side}", (0.3 * x, -0.37, 0.12), (0.13, 0.018, 0.065), rig, f"foot.{side}", brass, 0.012)

    # Shield and spear-blade make the left/right combat silhouette readable.
    rig_tools.add_cube("Sentinel.GuardPlate", (1.12, -0.03, 1.2), (0.075, 0.39, 0.49), rig, "hand.L", stone, 0.085, rotation=(0, -0.08, 0), bevel_segments=4)
    rig_tools.add_cube("Sentinel.GuardInset", (1.195, -0.03, 1.2), (0.022, 0.31, 0.4), rig, "hand.L", stone_dark, 0.04, rotation=(0, -0.08, 0))
    rig_tools.add_torus("Sentinel.GuardRing", (1.225, -0.03, 1.2), 0.2, 0.032, rig, "hand.L", brass, rotation=(0, pi / 2, 0))
    rig_tools.add_sphere("Sentinel.GuardCore", (1.25, -0.03, 1.2), (0.025, 0.12, 0.12), rig, "hand.L", core, 20, 12)

    rig_tools.add_extruded_profile("Sentinel.WeaponBlade", [(-0.12, 0.5), (0, 0.7), (0.14, 0.46), (0.1, -0.38), (0, -0.62), (-0.1, -0.38)], 0.065, (-1.04, -0.02, 0.63), rig, "hand.R", stone, 0.025, rotation=(0, -0.1, 0))
    rig_tools.add_extruded_profile("Sentinel.WeaponEdge", [(-0.025, 0.5), (0, 0.61), (0.028, 0.46), (0.02, -0.37), (0, -0.51), (-0.02, -0.37)], 0.008, (-1.04, -0.09, 0.63), rig, "hand.R", brass, 0.006, rotation=(0, -0.1, 0))
    rig_tools.add_limb("Sentinel.WeaponGrip", (-1.04, -0.02, 1.12), (-1.04, -0.02, 1.38), 0.055, rig, "hand.R", iron, 0.05, 14, 0.012)

    rig_tools.add_socket("socket.hit.center", rig, "chest", (0, 0, -0.12))
    rig_tools.add_socket("socket.core", rig, "chest", (0, -0.3, -0.02))
    rig_tools.add_socket("socket.lock.target", rig, "head", (0, 0, 0.2))
    rig_tools.add_socket("socket.blade.root", rig, "hand.R", (0, 0, 0.02))
    rig_tools.add_socket("socket.blade.tip", rig, "hand.R", (0, 0, -1.15))
    combined = rig_tools.join_skinned_meshes("AetherSentinelMesh")
    rig_tools.optimize_game_mesh(combined, 0.12)


def build_actions(rig):
    rig_tools.action(rig, "SentinelIdle", 60, [(0, {}), (30, {"chest": {"rotation": (0.025, 0, 0)}, "head": {"rotation": (0, 0, 0.12)}}), (60, {})])
    walk_a = {"upper_leg.L": {"rotation": (0.35, 0, 0)}, "upper_leg.R": {"rotation": (-0.35, 0, 0)}, "upper_arm.L": {"rotation": (-0.16, 0, 0)}, "upper_arm.R": {"rotation": (0.16, 0, 0)}}
    walk_b = {"upper_leg.L": {"rotation": (-0.35, 0, 0)}, "upper_leg.R": {"rotation": (0.35, 0, 0)}, "upper_arm.L": {"rotation": (0.16, 0, 0)}, "upper_arm.R": {"rotation": (-0.16, 0, 0)}}
    rig_tools.action(rig, "SentinelWalk", 36, [(0, walk_a), (18, walk_b), (36, walk_a)])
    rig_tools.action(rig, "SentinelWindup", 14, [(0, {}), (14, {"chest": {"rotation": (0, 0, -0.3)}, "upper_arm.R": {"rotation": (-0.72, 0.15, -0.85)}, "lower_arm.R": {"rotation": (-0.35, 0, 0)}})])
    rig_tools.action(rig, "SentinelAttack", 18, [(0, {"chest": {"rotation": (0, 0, -0.3)}, "upper_arm.R": {"rotation": (-0.72, 0.15, -0.85)}}), (8, {"chest": {"rotation": (0.12, 0, 0.38)}, "upper_arm.R": {"rotation": (-1.1, 0.05, 0.95)}}), (18, {})])
    rig_tools.action(rig, "SentinelRecover", 16, [(0, {"chest": {"rotation": (0.18, 0, 0.35)}, "upper_arm.R": {"rotation": (-0.8, 0, 0.7)}}), (16, {})])
    rig_tools.action(rig, "SentinelStagger", 12, [(0, {}), (5, {"chest": {"rotation": (-0.3, 0, -0.22)}, "head": {"rotation": (0.18, 0, 0.15)}}), (12, {})])
    # The runtime owns the persistent world-space fall so an interrupted GLB
    # one-shot can never leave a defeated enemy standing. This clip adds the
    # secondary limp/slump motion without rotating the skeleton root twice.
    rig_tools.action(rig, "SentinelDefeat", 36, [
        (0, {}),
        (18, {
            "hips": {"location": (0, 0, -0.18)},
            "chest": {"rotation": (0.38, 0, 0)},
            "head": {"rotation": (0.18, 0, 0)},
            "upper_arm.L": {"rotation": (-0.2, 0, 0.25)},
            "upper_arm.R": {"rotation": (-0.35, 0, -0.35)},
            "upper_leg.L": {"rotation": (0.18, 0, 0)},
            "upper_leg.R": {"rotation": (-0.12, 0, 0)},
        }),
        (36, {
            "hips": {"location": (0, 0, -0.34)},
            "chest": {"rotation": (0.65, 0, 0)},
            "head": {"rotation": (0.32, 0, 0.08)},
            "upper_arm.L": {"rotation": (-0.35, 0, 0.42)},
            "upper_arm.R": {"rotation": (-0.52, 0, -0.48)},
            "lower_arm.L": {"rotation": (-0.3, 0, 0)},
            "lower_arm.R": {"rotation": (-0.2, 0, 0)},
            "upper_leg.L": {"rotation": (0.28, 0, 0)},
            "upper_leg.R": {"rotation": (-0.2, 0, 0)},
        }),
    ])
    rig_tools.reset_pose(rig)
    rig.animation_data.action = None
    bpy.context.scene.frame_set(0)


def save_and_export():
    blend_path = argument("--blend", DEFAULT_BLEND_PATH)
    glb_path = argument("--glb", DEFAULT_GLB_PATH)
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), check_existing=False)
    result = bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        check_existing=False,
        export_format="GLB",
        export_yup=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=False,
        export_skins=True,
        export_def_bones=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_apply=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"glTF export failed: {result}")
    print(f"ACTION3D_EXPORT blend={blend_path} glb={glb_path}")


def main():
    rig_tools.clean_scene()
    _, rig = create_rig()
    build_meshes(rig)
    build_actions(rig)
    save_and_export()


if __name__ == "__main__":
    main()
