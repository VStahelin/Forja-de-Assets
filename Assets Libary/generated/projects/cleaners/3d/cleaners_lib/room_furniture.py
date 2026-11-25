"""Geometria do banco, da tábua, do caixote e da caneca da primeira sala."""
from __future__ import annotations

from lib import MeshDraft, ModelBuilder

from .props import U, m


def box(model, name, size, center):
    model.add_box(name, "root", size=m(*size), at=m(*center), native=False)


def prism(model, name, outline, near, far, vertical=False, center=None):
    """Extruda uma silhueta estrelada em XZ ou XY com as pontas lascadas."""
    draft = MeshDraft(closed=True)
    if center is None:
        center = tuple(sum(vertex[axis] for vertex in outline) / len(outline) for axis in range(2))

    def point(shape_point, depth):
        x, cross = shape_point
        return m(x, cross, depth) if vertical else m(x, depth, cross)

    rings = []
    for side, depth in (("near", near), ("far", far)):
        ring = tuple(f"{side}_{index}" for index in range(len(outline)))
        for vertex, where in zip(ring, outline):
            draft.vertex(vertex, point(where, depth))
        cap = f"{side}_center"
        draft.vertex(cap, point(center, depth))
        for index, vertex in enumerate(ring):
            draft.face(f"{side}_cap_{index}", (cap, vertex, ring[(index + 1) % len(ring)]))
        rings.append(ring)
    draft.connect_rings(*rings, prefix="edge")
    draft.anchor("mesh_center", point(center, (near + far) / 2))
    model.add_mesh(name, "root", draft, allow_triangles=True, pivot="mesh_center")


def wooden_bench(model):
    for index, z in enumerate((-0.145, -0.048, 0.048, 0.145)):
        box(model, f"seat_plank_{index}", (1.5, 0.0625, 0.090), (0, 0.46875, z))

    for side in (-1, 1):
        for end in (-1, 1):
            box(model, f"leg_{side}_{end}", (0.086, 0.375, 0.085),
                (0.590 * side, 0.1875, 0.126 * end))
        box(model, f"crossbeam_{side}", (0.12, 0.0625, 0.350),
            (0.590 * side, 0.40625, 0))
        box(model, f"tie_{side}", (0.082, 0.0625, 0.167),
            (0.590 * side, 0.215, 0))
    box(model, "stretcher", (1.098, 0.0625, 0.078), (0, 0.215, 0))


def broken_plank(model):
    prism(model, "split_wood", (
        (-0.237, -0.075), (0.171, -0.067), (0.272, -0.048), (0.207, -0.014),
        (0.251, 0.011), (0.169, 0.037), (0.200, 0.073), (-0.229, 0.068),
        (-0.273, 0.028), (-0.250, 0.002), (-0.269, -0.041),
    ), 0, 0.046875)


def broken_crate(model):
    box(model, "base", (0.625, 0.0625, 0.50), (0, 0.03125, 0))
    for side in (-1, 1):
        for end in (-1, 1):
            box(model, f"corner_{side}_{end}", (0.0625, 0.375, 0.0625),
                (0.28125 * side, 0.25, 0.21875 * end))

    for row, y in enumerate((0.12, 0.243, 0.366)):
        box(model, f"back_board_{row}", (0.50, 0.107, 0.043), (0, y, -0.21875))
        for side in (-1, 1):
            box(model, f"side_{side}_board_{row}", (0.046, 0.107, 0.375),
                (0.28125 * side, y, 0))

    box(model, "front_bottom_board", (0.50, 0.107, 0.043), (0, 0.12, 0.21875))
    prism(model, "front_splinter_left", (
        (-0.25, 0.189), (-0.065, 0.189), (-0.115, 0.213), (-0.067, 0.233),
        (-0.143, 0.247), (-0.112, 0.271), (-0.17, 0.298), (-0.25, 0.298),
    ), 0.197, 0.240, vertical=True, center=(-0.244, 0.244))
    prism(model, "front_splinter_right", (
        (0.143, 0.318), (0.25, 0.318), (0.25, 0.42), (0.093, 0.42),
        (0.142, 0.387), (0.111, 0.374), (0.163, 0.356), (0.118, 0.332),
    ), 0.197, 0.240, vertical=True, center=(0.244, 0.369))


def tin_mug(model):
    model.add_revolve("hollow_cup", "root", meridian=[
        m(0.045, 0.0), m(0.051, 0.010), m(0.058, 0.101), m(0.061, 0.112),
        m(0.049, 0.112), m(0.041, 0.014),
    ], segments=8, start_cap="flat", end_cap="flat", allow_cap_triangles=True)

    # Closed loop extruded along Z, with the long edge anchored into the cup.
    outer = ((0.049, 0.026), (0.083, 0.026), (0.103, 0.047),
             (0.103, 0.082), (0.084, 0.097), (0.053, 0.097))
    inner = ((0.059, 0.038), (0.077, 0.038), (0.091, 0.051),
             (0.091, 0.077), (0.080, 0.084), (0.061, 0.084))
    draft = MeshDraft(closed=True)
    loops = []
    for layer, z in (("front", 0.0105), ("back", -0.0105)):
        for label, outline in (("outside", outer), ("inside", inner)):
            loop = tuple(f"{layer}_{label}_{i}" for i in range(len(outline)))
            for vertex, (x, y) in zip(loop, outline):
                draft.vertex(vertex, m(x, y, z))
            loops.append(loop)
    face_front, hole_front, face_back, hole_back = loops
    draft.connect_rings(face_front, hole_front, prefix="front_handle")
    draft.connect_rings(face_back, hole_back, prefix="back_handle")
    draft.connect_rings(face_front, face_back, prefix="outer_handle")
    draft.connect_rings(hole_front, hole_back, prefix="inner_handle")
    draft.anchor("mesh_center", m(0.076, 0.061, 0.0))
    model.add_mesh("loop_handle", "root", draft, pivot="mesh_center")


BUILDERS = {
    "prop_wooden_bench_01": wooden_bench,
    "prop_broken_plank_01": broken_plank,
    "prop_broken_crate_01": broken_crate,
    "prop_tin_mug_01": tin_mug,
}


def build_model(asset_id):
    model = ModelBuilder(asset_id, require_integer_dimensions=False)
    model.add_group("root")
    BUILDERS[asset_id](model)
    return model
