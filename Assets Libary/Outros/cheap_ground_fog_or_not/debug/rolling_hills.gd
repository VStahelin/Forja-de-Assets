@tool
extends StaticBody3D
## Procedural hills with matching collision, i use it to test how the fog wraps over terrain

@export var size: Vector2 = Vector2(24.0, 16.0):
	set(v):
		size = v
		_rebuild()
@export_range(0.1, 6.0, 0.1) var height: float = 2.0:
	set(v):
		height = v
		_rebuild()
## How far (m) from the border the hills take to flatten into the ground
@export_range(0.0, 10.0, 0.1) var edge: float = 3.0:
	set(v):
		edge = v
		_rebuild()
@export_range(0.1, 2.0, 0.05) var cell: float = 0.25:
	set(v):
		cell = v
		_rebuild()
@export var material: Material:
	set(v):
		material = v
		_rebuild()

var _mesh_instance: MeshInstance3D
var _shape: CollisionShape3D


func _ready() -> void:
	_rebuild()


func _height_at(x: float, z: float) -> float:
	var h: float = 0.5 + 0.5 * sin(x * 0.35 + 0.7) * cos(z * 0.3)
	h = h * 0.75 + 0.25 * (0.5 + 0.5 * sin(x * 0.9 - z * 0.7))
	var border: float = minf(size.x * 0.5 - absf(x), size.y * 0.5 - absf(z))
	# Afunda a borda um pouquinho abaixo de y = 0 senão dá z-fight com o chão e fica piscando kkkj
	return height * h * smoothstep(0.0, maxf(edge, 0.001), border) - 0.01


func _rebuild() -> void:
	if not is_inside_tree():
		return
	if not _mesh_instance:
		_mesh_instance = MeshInstance3D.new()
		_shape = CollisionShape3D.new()
		add_child(_mesh_instance)
		add_child(_shape)

	var nx: int = maxi(int(size.x / cell), 1)
	var nz: int = maxi(int(size.y / cell), 1)
	var st: SurfaceTool = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for iz in nz + 1:
		for ix in nx + 1:
			var x: float = -size.x * 0.5 + size.x * ix / nx
			var z: float = -size.y * 0.5 + size.y * iz / nz
			st.set_uv(Vector2(x, z))
			st.add_vertex(Vector3(x, _height_at(x, z), z))
	for iz in nz:
		for ix in nx:
			var i: int = iz * (nx + 1) + ix
			st.add_index(i)
			st.add_index(i + 1)
			st.add_index(i + nx + 1)
			st.add_index(i + 1)
			st.add_index(i + nx + 2)
			st.add_index(i + nx + 1)
	st.generate_normals()
	var mesh: ArrayMesh = st.commit()
	_mesh_instance.mesh = mesh
	_mesh_instance.material_override = material
	_shape.shape = mesh.create_trimesh_shape()
