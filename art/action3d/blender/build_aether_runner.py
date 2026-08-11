"""Build the A2 Aether Runner game mesh and export it as GLB.

Run through `bun run export:action3d-assets`; do not invoke from the browser build.
The mesh is deliberately texture-light, but its silhouette, bevels and layered costume
are production geometry rather than the original rig-contract blockout.
"""

from __future__ import annotations

import pathlib
import sys
from math import pi

import bpy
from mathutils import Vector


FPS = 30
ROOT = pathlib.Path(__file__).resolve().parents[3]
DEFAULT_BLEND_PATH = ROOT / "art" / "action3d" / "player" / "aether-runner.blend"
DEFAULT_GLB_PATH = (
    ROOT
    / "web"
    / "public"
    / "assets"
    / "action3d"
    / "characters"
    / "aether-runner.glb"
)


def argument(name: str, default: pathlib.Path) -> pathlib.Path:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if name not in arguments:
        return default
    index = arguments.index(name)
    if index + 1 >= len(arguments):
        raise ValueError(f"{name} requires a path")
    return pathlib.Path(arguments[index + 1]).resolve()


def clean_scene() -> None:
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.armatures,
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.actions,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def material(name: str, rgba: tuple[float, float, float, float], metallic: float, roughness: float):
    value = bpy.data.materials.new(name)
    value.diffuse_color = rgba
    value.use_nodes = True
    principled = value.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = rgba
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    return value


def add_bone(armature, name: str, head, tail, parent: str | None = None):
    bone = armature.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    if parent:
        bone.parent = armature.edit_bones[parent]
    return bone


def create_rig():
    root = bpy.data.objects.new("AetherRunnerRoot", None)
    bpy.context.scene.collection.objects.link(root)

    armature_data = bpy.data.armatures.new("AetherRunnerSkeleton")
    rig = bpy.data.objects.new("AetherRunnerSkeleton", armature_data)
    bpy.context.scene.collection.objects.link(rig)
    rig.parent = root
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    add_bone(armature_data, "root", (0, 0, 0), (0, 0, 0.25))
    add_bone(armature_data, "hips", (0, 0, 0.82), (0, 0, 1.05), "root")
    add_bone(armature_data, "spine", (0, 0, 1.02), (0, 0, 1.38), "hips")
    add_bone(armature_data, "chest", (0, 0, 1.35), (0, 0, 1.68), "spine")
    add_bone(armature_data, "neck", (0, 0, 1.66), (0, 0, 1.82), "chest")
    add_bone(armature_data, "head", (0, 0, 1.8), (0, 0, 2.18), "neck")
    add_bone(armature_data, "cape", (0, 0.08, 1.58), (0, 0.12, 0.92), "chest")

    for side, x in (("L", 1), ("R", -1)):
        add_bone(armature_data, f"shoulder.{side}", (0.14 * x, 0, 1.62), (0.34 * x, 0, 1.61), "chest")
        add_bone(armature_data, f"upper_arm.{side}", (0.32 * x, 0, 1.61), (0.66 * x, 0, 1.42), f"shoulder.{side}")
        add_bone(armature_data, f"lower_arm.{side}", (0.64 * x, 0, 1.42), (0.82 * x, 0, 1.12), f"upper_arm.{side}")
        add_bone(armature_data, f"hand.{side}", (0.82 * x, 0, 1.12), (0.9 * x, 0, 1.0), f"lower_arm.{side}")
        add_bone(armature_data, f"upper_leg.{side}", (0.18 * x, 0, 0.9), (0.2 * x, 0, 0.5), "hips")
        add_bone(armature_data, f"lower_leg.{side}", (0.2 * x, 0, 0.5), (0.2 * x, 0, 0.12), f"upper_leg.{side}")
        add_bone(armature_data, f"foot.{side}", (0.2 * x, 0, 0.14), (0.2 * x, -0.22, 0.08), f"lower_leg.{side}")

    bpy.ops.object.mode_set(mode="POSE")
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)

    return root, rig


def bind_mesh(obj, rig, bone_name: str, assigned_material) -> None:
    obj.data.materials.append(assigned_material)
    group = obj.vertex_groups.new(name=bone_name)
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    modifier = obj.modifiers.new(name="AetherRunnerArmature", type="ARMATURE")
    modifier.object = rig
    obj.parent = rig


def apply_bevel(obj, width: float, segments: int = 3) -> None:
    if width <= 0:
        return
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new(name="BakedBevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def smooth(obj) -> None:
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def add_cube(
    name: str,
    location,
    scale,
    rig,
    bone: str,
    assigned_material,
    bevel=0.04,
    rotation=(0, 0, 0),
    bevel_segments=3,
):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    apply_bevel(obj, bevel, bevel_segments)
    bind_mesh(obj, rig, bone, assigned_material)
    return obj


def add_sphere(
    name: str,
    location,
    scale,
    rig,
    bone: str,
    assigned_material,
    segments=20,
    rings=12,
):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        radius=1,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth(obj)
    bind_mesh(obj, rig, bone, assigned_material)
    return obj


def add_limb(
    name: str,
    start,
    end,
    radius: float,
    rig,
    bone: str,
    assigned_material,
    end_radius: float | None = None,
    vertices=16,
    bevel=0.025,
):
    start_vector = Vector(start)
    end_vector = Vector(end)
    delta = end_vector - start_vector
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=end_radius if end_radius is not None else radius * 0.88,
        radius2=radius,
        depth=delta.length,
        location=(start_vector + end_vector) / 2,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    apply_bevel(obj, bevel, 2)
    smooth(obj)
    bind_mesh(obj, rig, bone, assigned_material)
    return obj


def add_extruded_profile(
    name: str,
    points,
    depth: float,
    location,
    rig,
    bone: str,
    assigned_material,
    bevel=0.015,
    rotation=(0, 0, 0),
):
    """Extrude an X/Z profile along Y for blades, coat panels and armor plates."""
    vertices = [(x, -depth, z) for x, z in points] + [
        (x, depth, z) for x, z in points
    ]
    count = len(points)
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    faces.extend(
        (
            index,
            (index + 1) % count,
            count + (index + 1) % count,
            count + index,
        )
        for index in range(count)
    )
    mesh = bpy.data.meshes.new(f"{name}Geometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    apply_bevel(obj, bevel, 2)
    bind_mesh(obj, rig, bone, assigned_material)
    return obj


def add_torus(
    name: str,
    location,
    major_radius: float,
    minor_radius: float,
    rig,
    bone: str,
    assigned_material,
    rotation=(pi / 2, 0, 0),
):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=24,
        minor_segments=8,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    smooth(obj)
    bind_mesh(obj, rig, bone, assigned_material)
    return obj


def add_hair_spike(name, location, scale, rotation, rig, assigned_material):
    bpy.ops.mesh.primitive_cone_add(
        vertices=10,
        radius1=1,
        radius2=0.06,
        depth=2,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth(obj)
    bind_mesh(obj, rig, "head", assigned_material)
    return obj


def add_socket(name: str, rig, bone: str, location=(0, 0, 0)):
    socket = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(socket)
    socket.empty_display_type = "PLAIN_AXES"
    socket.empty_display_size = 0.12
    socket.parent = rig
    socket.parent_type = "BONE"
    socket.parent_bone = bone
    socket.location = location
    return socket


def join_skinned_meshes(name: str):
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("No skinned meshes were created.")
    bpy.ops.object.select_all(action="DESELECT")
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    combined = bpy.context.object
    combined.name = name
    combined.data.name = name
    combined.select_set(False)
    return combined


def optimize_game_mesh(obj, ratio: float) -> None:
    """Collapse invisible subdivision density while preserving the authored silhouette."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new(name="GameplayTriangleBudget", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    # The retained armature modifier must evaluate after the baked optimization.
    while obj.modifiers.find(modifier.name) > 0:
        bpy.ops.object.modifier_move_up(modifier=modifier.name)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def build_meshes(root, rig):
    body = material("Runner.Body", (0.025, 0.16, 0.18, 1), 0.02, 0.67)
    cloth = material("Runner.Cloth", (0.018, 0.07, 0.085, 1), 0.0, 0.82)
    ivory = material("Runner.Ivory", (0.72, 0.67, 0.54, 1), 0.0, 0.78)
    skin = material("Runner.Skin", (0.72, 0.42, 0.28, 1), 0.0, 0.62)
    hair = material("Runner.Hair", (0.008, 0.025, 0.035, 1), 0.0, 0.4)
    leather = material("Runner.Leather", (0.1, 0.045, 0.022, 1), 0.0, 0.69)
    metal = material("Runner.Metal", (0.48, 0.34, 0.12, 1), 0.72, 0.25)
    energy = material("Runner.Energy", (0.01, 0.76, 0.82, 1), 0.12, 0.16)
    energy.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (0.01, 0.32, 0.35, 1)
    energy.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 2.2

    # Athletic proportions and a layered ivory tunic establish the human silhouette.
    add_cube("Runner.Hips", (0, 0.015, 0.94), (0.255, 0.16, 0.13), rig, "hips", cloth, 0.065)
    add_cube("Runner.Waist", (0, 0, 1.12), (0.27, 0.15, 0.14), rig, "spine", ivory, 0.065)
    add_cube("Runner.Torso", (0, 0, 1.39), (0.335, 0.175, 0.3), rig, "chest", ivory, 0.105, bevel_segments=4)
    add_cube("Runner.TunicPlacket", (0, -0.183, 1.39), (0.085, 0.018, 0.27), rig, "chest", body, 0.018)
    add_cube("Runner.Collar", (0, -0.02, 1.67), (0.24, 0.17, 0.08), rig, "chest", cloth, 0.045)
    add_torus("Runner.CollarTrim", (0, -0.11, 1.67), 0.24, 0.016, rig, "chest", metal)

    # Neck, sculpted head, ears, eyes and brows survive the gameplay camera close-up.
    add_limb("Runner.Neck", (0, 0, 1.66), (0, 0, 1.8), 0.095, rig, "neck", skin, 0.09, 18, 0.012)
    add_sphere("Runner.Head", (0, -0.018, 1.98), (0.205, 0.185, 0.265), rig, "head", skin, 28, 18)
    add_sphere("Runner.Ear.L", (0.205, -0.02, 1.98), (0.035, 0.025, 0.07), rig, "head", skin, 16, 10)
    add_sphere("Runner.Ear.R", (-0.205, -0.02, 1.98), (0.035, 0.025, 0.07), rig, "head", skin, 16, 10)
    for side, x in (("L", 1), ("R", -1)):
        add_sphere(f"Runner.EyeWhite.{side}", (0.076 * x, -0.203, 2.015), (0.042, 0.004, 0.019), rig, "head", ivory, 16, 8)
        add_sphere(f"Runner.Iris.{side}", (0.076 * x, -0.208, 2.015), (0.014, 0.002, 0.014), rig, "head", energy, 14, 8)
        add_cube(f"Runner.Brow.{side}", (0.075 * x, -0.215, 2.065), (0.058, 0.008, 0.011), rig, "head", hair, 0.007, rotation=(0, 0, -0.09 * x))
    add_sphere("Runner.Nose", (0, -0.215, 1.978), (0.026, 0.02, 0.04), rig, "head", skin, 14, 8)
    add_cube("Runner.Mouth", (0, -0.207, 1.915), (0.052, 0.008, 0.007), rig, "head", hair, 0.004)

    # A rounded hair cap plus asymmetric tapered locks replaces the old hair box.
    add_sphere("Runner.HairCap", (0, 0.006, 2.105), (0.225, 0.205, 0.19), rig, "head", hair, 24, 16)
    hair_spikes = [
        ("Crown", (0.03, 0.02, 2.25), (0.075, 0.075, 0.12), (0.06, -0.2, -0.2)),
        ("Left", (0.17, -0.01, 2.18), (0.07, 0.07, 0.12), (0.08, 0.5, 0.1)),
        ("Right", (-0.17, 0.015, 2.18), (0.065, 0.065, 0.115), (-0.05, -0.5, -0.1)),
        ("FringeA", (0.115, -0.18, 2.15), (0.05, 0.05, 0.105), (-0.34, 0.18, 0.05)),
        ("FringeB", (-0.025, -0.185, 2.15), (0.047, 0.047, 0.10), (-0.35, -0.05, 0.0)),
        ("SideLock", (-0.18, -0.12, 2.09), (0.05, 0.05, 0.105), (-0.3, -0.35, -0.2)),
    ]
    for label, location, scale, rotation in hair_spikes:
        add_hair_spike(f"Runner.Hair.{label}", location, scale, rotation, rig, hair)

    # Mantle, split cape and tunic tails match the teal/ivory concept silhouette.
    add_extruded_profile("Runner.Mantle", [(-0.43, -0.1), (-0.35, 0.2), (0, 0.3), (0.35, 0.2), (0.43, -0.1), (0, -0.22)], 0.055, (0, 0.17, 1.55), rig, "chest", body, 0.025)
    for side, x in (("L", 1), ("R", -1)):
        add_extruded_profile(f"Runner.Cape.{side}", [(-0.2, 0.36), (0.2, 0.36), (0.16, -0.46), (0, -0.58), (-0.18, -0.43)], 0.025, (0.19 * x, 0.225, 1.27), rig, "cape", cloth, 0.012, rotation=(0.04, 0, -0.035 * x))
        add_extruded_profile(f"Runner.TunicTail.{side}", [(-0.15, 0.2), (0.15, 0.2), (0.11, -0.35), (0, -0.44), (-0.12, -0.34)], 0.025, (0.16 * x, -0.02, 1.0), rig, "hips", ivory, 0.01, rotation=(0, 0, -0.06 * x))
        add_cube(f"Runner.CapeEdge.{side}", (0.36 * x, 0.258, 1.23), (0.016, 0.012, 0.37), rig, "cape", metal, 0.007, rotation=(0.04, 0, 0.045 * x))
    add_cube("Runner.CapeCenterTrim", (0, 0.266, 1.16), (0.013, 0.01, 0.35), rig, "cape", energy, 0.005, rotation=(0.04, 0, 0))
    add_extruded_profile("Runner.CapeClasp", [(0, 0.1), (0.075, 0), (0, -0.12), (-0.075, 0)], 0.018, (0, 0.272, 1.57), rig, "cape", energy, 0.009)
    add_cube("Runner.CapeShoulderTrim", (0, 0.255, 1.63), (0.3, 0.012, 0.018), rig, "cape", metal, 0.008)
    add_cube("Runner.MantleTrim", (0, -0.205, 1.51), (0.31, 0.018, 0.018), rig, "chest", metal, 0.009)
    add_extruded_profile("Runner.ChestGem", [(0, 0.095), (0.075, 0), (0, -0.12), (-0.075, 0)], 0.022, (0, -0.235, 1.55), rig, "chest", energy, 0.009)
    add_cube("Runner.CrossStrap", (0.03, -0.21, 1.39), (0.035, 0.025, 0.38), rig, "chest", leather, 0.012, rotation=(0, -0.04, -0.55))
    add_cube("Runner.Belt", (0, -0.005, 1.08), (0.33, 0.18, 0.045), rig, "hips", leather, 0.018)
    add_cube("Runner.Buckle", (0, -0.192, 1.08), (0.07, 0.018, 0.055), rig, "hips", metal, 0.012)
    add_cube("Runner.Pouch", (0.31, 0.0, 1.02), (0.10, 0.075, 0.13), rig, "hips", leather, 0.025)

    for side, x in (("L", 1), ("R", -1)):
        add_sphere(f"Runner.Shoulder.{side}", (0.37 * x, 0, 1.57), (0.14, 0.13, 0.14), rig, f"upper_arm.{side}", body, 18, 12)
        add_limb(f"Runner.UpperArm.{side}", (0.38 * x, 0, 1.54), (0.64 * x, 0, 1.39), 0.105, rig, f"upper_arm.{side}", ivory, 0.09)
        add_sphere(f"Runner.Elbow.{side}", (0.64 * x, 0, 1.39), (0.105, 0.1, 0.11), rig, f"lower_arm.{side}", leather, 18, 10)
        add_limb(f"Runner.Forearm.{side}", (0.65 * x, 0, 1.36), (0.82 * x, -0.01, 1.12), 0.11, rig, f"lower_arm.{side}", leather, 0.085)
        add_cube(f"Runner.Bracer.{side}", (0.76 * x, -0.015, 1.22), (0.11, 0.115, 0.17), rig, f"lower_arm.{side}", cloth, 0.035, rotation=(0, 0.18 * x, -0.54 * x))
        add_cube(f"Runner.BracerGlow.{side}", (0.81 * x, -0.13, 1.2), (0.018, 0.012, 0.105), rig, f"lower_arm.{side}", energy, 0.007, rotation=(0, 0.18 * x, -0.54 * x))
        add_sphere(f"Runner.Hand.{side}", (0.86 * x, -0.015, 1.06), (0.085, 0.075, 0.115), rig, f"hand.{side}", leather, 18, 10)

        add_limb(f"Runner.Thigh.{side}", (0.18 * x, 0, 0.9), (0.2 * x, 0, 0.52), 0.145, rig, f"upper_leg.{side}", cloth, 0.125)
        add_sphere(f"Runner.Knee.{side}", (0.2 * x, -0.01, 0.5), (0.135, 0.13, 0.13), rig, f"lower_leg.{side}", cloth, 18, 10)
        add_limb(f"Runner.Calf.{side}", (0.2 * x, 0, 0.48), (0.2 * x, 0, 0.16), 0.13, rig, f"lower_leg.{side}", leather, 0.105)
        add_cube(f"Runner.BootCuff.{side}", (0.2 * x, 0, 0.36), (0.155, 0.15, 0.075), rig, f"lower_leg.{side}", leather, 0.028)
        add_cube(f"Runner.Boot.{side}", (0.2 * x, -0.085, 0.12), (0.145, 0.225, 0.115), rig, f"foot.{side}", leather, 0.05)
        add_cube(f"Runner.BootSole.{side}", (0.2 * x, -0.105, 0.025), (0.155, 0.24, 0.035), rig, f"foot.{side}", cloth, 0.018)
        add_cube(f"Runner.BootBuckle.{side}", (0.2 * x, -0.285, 0.15), (0.07, 0.018, 0.035), rig, f"foot.{side}", metal, 0.009)

    # A pointed, readable sword with guard, grip and cyan inlay replaces the stick.
    add_extruded_profile("Runner.SwordBlade", [(-0.065, 0.48), (0, 0.62), (0.065, 0.48), (0.048, -0.46), (0, -0.54), (-0.048, -0.46)], 0.025, (-0.91, -0.02, 0.56), rig, "hand.R", metal, 0.012, rotation=(0, -0.08, 0))
    add_extruded_profile("Runner.SwordInlay", [(-0.014, 0.43), (0, 0.52), (0.014, 0.43), (0.012, -0.4), (0, -0.45), (-0.012, -0.4)], 0.008, (-0.91, -0.052, 0.56), rig, "hand.R", energy, 0.004, rotation=(0, -0.08, 0))
    add_extruded_profile("Runner.SwordGuard", [(-0.2, 0), (-0.08, 0.065), (0, 0.035), (0.08, 0.065), (0.2, 0), (0.07, -0.04), (-0.07, -0.04)], 0.045, (-0.91, -0.02, 1.08), rig, "hand.R", metal, 0.014)
    add_limb("Runner.SwordGrip", (-0.91, -0.02, 1.11), (-0.91, -0.02, 1.29), 0.045, rig, "hand.R", leather, 0.04, 12, 0.01)
    add_sphere("Runner.SwordPommel", (-0.91, -0.02, 1.31), (0.065, 0.06, 0.065), rig, "hand.R", energy, 16, 10)

    add_socket("socket.weapon.right", rig, "hand.R", (0, 0, 0.02))
    add_socket("socket.hit.center", rig, "chest", (0, 0, -0.1))
    add_socket("socket.vfx.feet", rig, "root", (0, 0, 0))
    add_socket("socket.blade.root", rig, "hand.R", (0, 0, 0.05))
    add_socket("socket.blade.tip", rig, "hand.R", (0, 0, -1.0))

    combined = join_skinned_meshes("AetherRunnerMesh")
    optimize_game_mesh(combined, 0.20)
    return root


def key(
    rig,
    bone_name: str,
    frame: int,
    rotation=(0, 0, 0),
    location=(0, 0, 0),
    write_rotation=True,
    write_location=True,
):
    bone = rig.pose.bones[bone_name]
    if write_rotation:
        bone.rotation_euler = rotation
        bone.keyframe_insert("rotation_euler", frame=frame, group=bone_name)
    if write_location:
        bone.location = location
        bone.keyframe_insert("location", frame=frame, group=bone_name)


def reset_pose(rig):
    for bone in rig.pose.bones:
        bone.rotation_euler = (0, 0, 0)
        bone.location = (0, 0, 0)


def action(rig, name: str, end_frame: int, keys, interpolation="BEZIER"):
    reset_pose(rig)
    value = bpy.data.actions.new(name=name)
    rig.animation_data_create()
    rig.animation_data.action = value
    # Every clip owns a complete pose reset. glTF animation groups retain the
    # last value for channels that the next clip does not target, which used to
    # leave JumpLoop legs and attack torso rotations stuck underneath Idle.
    # Key only authored frames (not every sampled frame), but include rotation
    # and location channels for the full skeleton at those frames.
    channels = {
        bone.name: {"rotation", "location"}
        for bone in rig.pose.bones
    }
    for frame, poses in keys:
        for bone_name, properties in channels.items():
            transform = poses.get(bone_name, {})
            key(
                rig,
                bone_name,
                frame,
                transform.get("rotation", (0, 0, 0)),
                transform.get("location", (0, 0, 0)),
                "rotation" in properties,
                "location" in properties,
            )
    value.frame_start = 0
    value.frame_end = end_frame
    value.use_frame_range = True
    value.use_fake_user = True
    for layer in value.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                for fcurve in channelbag.fcurves:
                    for point in fcurve.keyframe_points:
                        point.interpolation = interpolation
                        if interpolation == "BEZIER":
                            point.handle_left_type = "AUTO_CLAMPED"
                            point.handle_right_type = "AUTO_CLAMPED"
    rig.animation_data.action = None


def build_actions(rig):
    # The sword is rigidly bound to hand.R, so every locomotion clip needs a
    # deliberate shoulder/elbow/wrist pose.  Leaving these channels unkeyed made
    # the weapon arm swing like an empty hand and left the blade hanging straight
    # down between attacks.
    sword_ready = {
        "shoulder.R": {"rotation": (0.03, -0.08, -0.06)},
        "upper_arm.R": {"rotation": (-0.22, 0.14, -0.34)},
        "lower_arm.R": {"rotation": (-0.58, -0.10, 0.22)},
        "hand.R": {"rotation": (-0.35, -0.18, -0.24)},
    }
    sword_ready_breathe = {
        "shoulder.R": {"rotation": (0.025, -0.07, -0.045)},
        "upper_arm.R": {"rotation": (-0.19, 0.13, -0.30)},
        "lower_arm.R": {"rotation": (-0.54, -0.08, 0.20)},
        "hand.R": {"rotation": (-0.32, -0.16, -0.21)},
    }
    sword_run_a = {
        "shoulder.R": {"rotation": (0.06, -0.12, -0.08)},
        "upper_arm.R": {"rotation": (-0.08, 0.20, -0.24)},
        "lower_arm.R": {"rotation": (-0.72, -0.08, 0.28)},
        "hand.R": {"rotation": (-0.22, -0.22, -0.30)},
    }
    sword_run_b = {
        "shoulder.R": {"rotation": (0.04, -0.10, -0.04)},
        "upper_arm.R": {"rotation": (-0.17, 0.16, -0.31)},
        "lower_arm.R": {"rotation": (-0.62, -0.06, 0.24)},
        "hand.R": {"rotation": (-0.42, -0.18, -0.25)},
    }
    walk_a = {
        "upper_leg.L": {"rotation": (0.55, 0, 0)},
        "upper_leg.R": {"rotation": (-0.55, 0, 0)},
        "upper_arm.L": {"rotation": (-0.35, 0, 0)},
    }
    walk_b = {
        "upper_leg.L": {"rotation": (-0.55, 0, 0)},
        "upper_leg.R": {"rotation": (0.55, 0, 0)},
        "upper_arm.L": {"rotation": (0.35, 0, 0)},
    }
    action(
        rig,
        "Idle",
        60,
        [
            (0, sword_ready),
            (30, sword_ready_breathe | {"chest": {"rotation": (0.025, 0, 0)}, "cape": {"rotation": (-0.05, 0, 0)}}),
            (60, sword_ready),
        ],
    )
    action(rig, "Walk", 30, [(0, walk_a | sword_run_a), (15, walk_b | sword_run_b), (30, walk_a | sword_run_a)])
    action(
        rig,
        "Run",
        22,
        [
            (0, walk_a | sword_run_a | {"chest": {"rotation": (0.14, 0, 0)}}),
            (11, walk_b | sword_run_b | {"chest": {"rotation": (0.14, 0, 0)}}),
            (22, walk_a | sword_run_a | {"chest": {"rotation": (0.14, 0, 0)}}),
        ],
    )
    action(
        rig,
        "JumpStart",
        8,
        [
            (0, sword_ready),
            (8, sword_run_a | {"hips": {"location": (0, 0, -0.09)}, "upper_leg.L": {"rotation": (-0.35, 0, 0)}, "upper_leg.R": {"rotation": (-0.35, 0, 0)}, "chest": {"rotation": (0.16, 0, 0)}}),
        ],
    )
    action(
        rig,
        "JumpLoop",
        18,
        [
            (0, sword_run_a | {"upper_leg.L": {"rotation": (-0.18, 0, 0)}, "upper_leg.R": {"rotation": (0.24, 0, 0)}, "cape": {"rotation": (0.18, 0, 0)}}),
            (18, sword_run_b | {"upper_leg.L": {"rotation": (0.15, 0, 0)}, "upper_leg.R": {"rotation": (-0.12, 0, 0)}, "cape": {"rotation": (0.1, 0, 0)}}),
        ],
    )
    action(
        rig,
        "Land",
        8,
        [
            (0, sword_run_a | {"hips": {"location": (0, 0, -0.14)}, "upper_leg.L": {"rotation": (-0.42, 0, 0)}, "upper_leg.R": {"rotation": (-0.42, 0, 0)}, "chest": {"rotation": (0.2, 0, 0)}}),
            (8, sword_ready),
        ],
    )
    action(
        rig,
        "Dodge",
        14,
        [
            (0, sword_ready),
            (5, sword_run_a | {"root": {"rotation": (0, 0, -0.22)}, "hips": {"location": (0, 0, -0.12)}, "chest": {"rotation": (0.3, 0, 0)}}),
            (14, sword_ready),
        ],
    )
    action(rig, "Hit", 10, [(0, {}), (4, {"chest": {"rotation": (-0.25, 0, 0.32)}, "head": {"rotation": (0.12, 0, -0.18)}}), (10, {})])
    action(rig, "Defeat", 32, [(0, {}), (16, {"root": {"rotation": (0, 0.25, 0.65)}, "hips": {"location": (0, 0, -0.38)}, "chest": {"rotation": (0.5, 0, 0)}}), (32, {"root": {"rotation": (0, 0.4, 1.22)}, "hips": {"location": (0, 0, -0.72)}, "chest": {"rotation": (0.7, 0, 0)}})])

    # Keep the torso close to vertical and make the sword cross the silhouette
    # on the character's right side.  Large lateral chest rotations made the
    # cape look like the whole character had fallen over and hid the blade from
    # the third-person camera.
    high_guard = {
        "hips": {"location": (0, 0, -0.03), "rotation": (0, 0, -0.03)},
        "chest": {"rotation": (-0.08, 0, -0.05)},
        "head": {"rotation": (0.04, 0, 0.02)},
        "shoulder.R": {"rotation": (-0.10, -0.16, -0.22)},
        "upper_arm.R": {"rotation": (-1.30, 0.26, -1.02)},
        "lower_arm.R": {"rotation": (-1.12, -0.12, -0.24)},
        "hand.R": {"rotation": (-0.80, -0.30, 0.50)},
        "upper_arm.L": {"rotation": (-0.24, 0.04, 0.10)},
        "lower_arm.L": {"rotation": (-0.18, 0, 0)},
        "cape": {"rotation": (-0.04, 0, 0.03)},
    }
    diagonal_cut = {
        "hips": {"rotation": (0, 0, -0.06)},
        "chest": {"rotation": (0.06, 0, -0.12)},
        "head": {"rotation": (0, 0, 0.04)},
        "shoulder.R": {"rotation": (0.04, -0.06, -0.10)},
        "upper_arm.R": {"rotation": (-1.06, 0.05, -0.92)},
        "lower_arm.R": {"rotation": (-0.24, -0.04, 0.16)},
        "hand.R": {"rotation": (-0.20, -0.28, 1.00)},
        "upper_arm.L": {"rotation": (0.18, 0, 0.10)},
        "cape": {"rotation": (0.04, 0, 0.08)},
    }
    low_guard = {
        "hips": {"rotation": (0, 0, -0.04)},
        "chest": {"rotation": (0.04, 0, -0.10)},
        "shoulder.R": {"rotation": (0.04, -0.06, -0.10)},
        "upper_arm.R": {"rotation": (-1.06, 0.05, -0.92)},
        "lower_arm.R": {"rotation": (-0.24, -0.04, 0.16)},
        "hand.R": {"rotation": (0.90, -0.28, 1.00)},
        "upper_arm.L": {"rotation": (0.18, 0, 0.10)},
        "cape": {"rotation": (0.02, 0, 0.05)},
    }
    heavy_cut = {
        "hips": {"location": (0, 0, -0.10), "rotation": (0, 0, -0.04)},
        "chest": {"rotation": (0.18, 0, -0.08)},
        "head": {"rotation": (-0.06, 0, 0.03)},
        "shoulder.R": {"rotation": (0.06, -0.08, -0.12)},
        "upper_arm.R": {"rotation": (-1.08, 0.04, -0.94)},
        "lower_arm.R": {"rotation": (-0.22, -0.04, 0.14)},
        "hand.R": {"rotation": (0.55, -0.26, 0.96)},
        "upper_arm.L": {"rotation": (0.24, 0, 0.12)},
        "upper_leg.L": {"rotation": (-0.16, 0, 0)},
        "upper_leg.R": {"rotation": (-0.16, 0, 0)},
        "lower_leg.L": {"rotation": (0.24, 0, 0)},
        "lower_leg.R": {"rotation": (0.24, 0, 0)},
        "cape": {"rotation": (0.12, 0, 0.06)},
    }

    # Each combo uses a different, readable path: descending diagonal, rising
    # diagonal, then an overhead finishing cut. Contact frames remain inside
    # the gameplay hit window (150-310 ms).
    action(
        rig,
        "Attack1",
        18,
        [
            (0, sword_ready),
            (2, sword_ready),
            (5, high_guard),
            (9, diagonal_cut),
            (13, low_guard),
            (18, sword_ready),
        ],
        "LINEAR",
    )
    action(
        rig,
        "Attack2",
        20,
        [
            (0, sword_ready),
            (2, sword_ready),
            (5, low_guard),
            (10, high_guard),
            (14, high_guard | {"chest": {"rotation": (-0.03, 0, -0.02)}, "cape": {"rotation": (-0.08, 0, 0.02)}}),
            (20, sword_ready),
        ],
        "LINEAR",
    )
    action(
        rig,
        "Attack3",
        26,
        [
            (0, sword_ready),
            (2, sword_ready),
            (6, high_guard),
            (11, heavy_cut),
            (16, low_guard | {"hips": {"location": (0, 0, -0.05), "rotation": (0, 0, -0.02)}, "chest": {"rotation": (0.10, 0, -0.04)}}),
            (26, sword_ready),
        ],
        "LINEAR",
    )
    reset_pose(rig)
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
    return blend_path, glb_path


def main():
    clean_scene()
    root, rig = create_rig()
    build_meshes(root, rig)
    build_actions(rig)
    blend_path, glb_path = save_and_export()
    print(f"ACTION3D_EXPORT blend={blend_path} glb={glb_path}")


if __name__ == "__main__":
    main()
