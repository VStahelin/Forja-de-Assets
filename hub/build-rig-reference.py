"""Build the local animation preview character inside Blender's background runtime."""

import sys
from pathlib import Path

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
base, mannequin, output = map(Path, argv)
bpy.ops.wm.open_mainfile(filepath=str(base))
if bpy.context.object and bpy.context.object.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
mesh = bpy.data.objects["HumanoidBase_NotOverlapping"]
for obj in list(bpy.context.scene.objects):
    if obj != mesh:
        bpy.data.objects.remove(obj, do_unlink=True)

before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(mannequin))
reference_objects = set(bpy.context.scene.objects) - before
armature = next(obj for obj in reference_objects if obj.type == "ARMATURE")
source_mesh = next(obj for obj in reference_objects if any(mod.type == "ARMATURE" for mod in obj.modifiers))

bpy.context.view_layer.objects.active = mesh
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
for group in source_mesh.vertex_groups:
    mesh.vertex_groups.new(name=group.name)
transfer = mesh.modifiers.new("Transfer mannequin weights", "DATA_TRANSFER")
transfer.object = source_mesh
transfer.use_vert_data = True
transfer.data_types_verts = {"VGROUP_WEIGHTS"}
transfer.vert_mapping = "POLYINTERP_NEAREST"
transfer.layers_vgroup_select_src = "ALL"
transfer.layers_vgroup_select_dst = "NAME"
bpy.ops.object.modifier_apply(modifier=transfer.name)
if any(not any(group.weight > 0.001 for group in vertex.groups) for vertex in mesh.data.vertices):
    raise RuntimeError("The reference character has unbound vertices.")

mesh.name = "Humanoid Low Poly"
modifier = mesh.modifiers.new("UAL-compatible armature", "ARMATURE")
modifier.object = armature
world = mesh.matrix_world.copy()
mesh.parent = armature
mesh.matrix_world = world

material = bpy.data.materials.new("Preview sage")
material.diffuse_color = (0.35, 0.48, 0.34, 1)
material.use_nodes = True
nodes = material.node_tree.nodes
shader = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
if shader is None:
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    output_node = nodes.new("ShaderNodeOutputMaterial")
    material.node_tree.links.new(shader.outputs["BSDF"], output_node.inputs["Surface"])
shader.inputs["Base Color"].default_value = material.diffuse_color
shader.inputs["Roughness"].default_value = 0.8
mesh.data.materials.clear()
mesh.data.materials.append(material)

for obj in reference_objects - {armature}:
    bpy.data.objects.remove(obj, do_unlink=True)
armature.select_set(True)
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", use_selection=True, export_animations=False)
print(f"Rig reference: {len(mesh.data.vertices)} vertices, {len(armature.data.bones)} bones")
