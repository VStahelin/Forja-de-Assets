@tool
class_name GroundFog
extends Node3D
## Drop-in ground fog, just throw it as a child of the player and thats it, a sphere of fog
## follows it around (snapped to a world grid), wraps the terrain under it and moves like a fluid
## when stuff goes into it. Area3Ds in the exclusion group fade it out when you or the cam go in

const MAX_BRUSHES: int = 64
const MAX_BURSTS: int = 8
## Layer the mask camera sees, meshes of bodies that go into the fog get it added automatically
const DISTURB_LAYER: int = 20
const FOG_SHADER: Shader = preload("res://fog/ground_fog.gdshader")
const SIM_SHADER: Shader = preload("res://fog/fog_trail.gdshader")
const MASK_SHADER: Shader = preload("res://fog/fog_mask.gdshader")

@export_group("Area")
## How big (m) the fog sphere around the player is, radius not diameter
@export_range(2.0, 64.0, 0.5) var radius: float = 24.0:
	set(v):
		radius = v
		_rebuild()
@export_range(0.0, 16.0, 0.1) var edge_softness: float = 16.0
## Stuff higher than this above the node (roofs, tables, big blocks) gets no fog on top, the fog
## just keeps going on the floor under them, open terrain like hills always gets fog tho
@export_range(0.0, 10.0, 0.05) var max_surface_height: float = 1.0
## How far down from the node it looks for ground
@export_range(1.0, 50.0, 0.5) var max_depth: float = 12.0
@export_range(32, 512, 16) var resolution: int = 256:
	set(v):
		resolution = v
		_rebuild()
## How many terrain rows get raycast again each physics frame, so height changes catch up
@export_range(0, 64) var rows_per_frame: int = 4

@export_group("Look")
@export_range(0.05, 2.0, 0.01) var fog_height: float = 0.46
@export_range(0.0, 8.0, 0.05) var density: float = 7.6
@export var fog_color: Color = Color(0.82, 0.81, 0.76)
## 0 = flat color, 1 = fully lit and shadowed by the scene lights, i like it around 0.8
@export_range(0.0, 1.0, 0.01) var lighting: float = 0.8
## Fades the thin fog so it melts into the ground, without it you get an ugly hard edge
@export_range(0.01, 1.0, 0.01) var ground_softness: float = 1.0
@export_range(0.0, 0.5, 0.005) var hill_scale: float = 0.03
@export var wind: Vector2 = Vector2(0.03, 0.012)
## How fast the little hills on top change shape
@export_range(0.0, 1.0, 0.01) var morph_speed: float = 0.05
## Above 0 the fog breaks into big patches that drift around, keep it low with a small radius or
## the player can end up standing on bare ground lol
@export_range(0.0, 1.0, 0.01) var coverage_cutoff: float = 0.0
@export_range(0.01, 1.0, 0.01) var coverage_softness: float = 1.0
## How much fog piles up on the rim of the trails you carve
@export_range(0.0, 2.0, 0.01) var wake_lift: float = 0.4
@export_range(0.0, 2.0, 0.01) var streak: float = 0.6
## How far (m) the fog goes past ledges and spills down, like a waterfall but lazy
@export_range(0.0, 3.0, 0.05) var ledge_drape: float = 0.8
## Fades the fog close to the camera (m), so it doesnt just cut through your face
@export_range(0.0, 10.0, 0.1) var camera_fade: float = 1.5
## Small per pixel wisps dragged by the flow, so swirls look finer than the mesh actually is
@export_range(0.0, 1.0, 0.01) var detail_strength: float = 0.5
## Wisp frequency (1/m), bigger = smaller wisps
@export_range(0.05, 4.0, 0.05) var detail_scale: float = 0.0
## Seconds per flow cycle, longer = wisps stretch more along the flow
@export_range(0.2, 5.0, 0.05) var detail_cycle: float = 0.0
## Black and white texture centered on the player to shape the fog (white = fog), empty = no mask
@export var shape_mask: Texture2D
## World size (m) the mask covers, leave 0 to just use the fog sphere size
@export_range(0.0, 200.0, 0.5) var shape_size: float = 0.0

@export_group("Interaction")
@export_range(0.0, 30.0, 0.1) var carve_speed: float = 14.0
@export_range(0.0, 5.0, 0.05) var refill_speed: float = 0.0
## How deep (m) something has to go in before it clears the fog all the way
@export_range(0.01, 1.0, 0.01) var mask_softness: float = 0.2
## Extra margin (m) cleared around anything touching the fog, so feet dont look tiny
@export_range(0.0, 1.0, 0.01) var footprint_spread: float = 0.2
## How fast the fog flows back and the waves travel, in m/s
@export_range(0.0, 5.0, 0.05) var flow_speed: float = 1.5
## Keeps the swirls alive behind moving bodies instead of smearing them out, above ~4.5 they feed
## themselves and never calm down, i tested it, dont do it
@export_range(0.0, 5.0, 0.05) var vorticity: float = 1.0
## Multiplies how big each body stirs (taken from its collision shapes)
@export_range(0.1, 3.0, 0.05) var radius_scale: float = 0.1
## Max outward shove in m/s, bodies push at their own speed up to this
@export_range(0.0, 5.0, 0.05) var push_speed: float = 1.0
## How much of the body speed the fog picks up and drags along
@export_range(0.0, 1.0, 0.01) var drag: float = 0.6
@export_flags_3d_physics var terrain_mask: int = 1
@export_flags_3d_physics var disturb_mask: int = 1

@export_group("Landing")
## Minimum fall speed (m/s) to make the fog go poof when you land
@export_range(0.5, 20.0, 0.1) var land_speed: float = 2.5
## How fast the puff pushes outward, in m/s
@export_range(0.0, 10.0, 0.1) var burst_speed: float = 3.0
@export_range(0.1, 3.0, 0.05) var burst_life: float = 0.6
## How far (m) the ring spreads for each m/s of impact
@export_range(0.0, 1.0, 0.01) var burst_spread: float = 0.35

@export_group("Exclusion")
## Area3Ds in this group fade the fog out when the player or the camera are inside, they need at
## least one collision layer on or they wont be found, took me a while to figure that one out
@export var exclusion_group: StringName = &"no_ground_fog"
@export_range(0.05, 5.0, 0.05) var exclusion_fade: float = 1.0

var _size: float = 16.0
var _texel: float = 0.125
var _cell: Vector2i = Vector2i.ZERO
var _baked: bool = false
var _physics_frames: int = 0
var _refresh_row: int = 0
var _scroll: Vector2 = Vector2.ZERO
var _presence: float = 1.0
var _mask_origin: float = 1e6
var _heights: Image
var _height_tex: ImageTexture
var _internals: Array[Node] = []
var _local_bounds: Dictionary = {}
var _last_centers: Dictionary = {}
var _last_vy: Dictionary = {}
var _tagged: Dictionary = {}
var _bursts: Array[Dictionary] = []

var _mesh: MeshInstance3D
var _material: ShaderMaterial
var _trail: SubViewport
var _sim_material: ShaderMaterial
var _mask_vp: SubViewport
var _mask_cam: Camera3D
var _area: Area3D
var _area_shape: CollisionShape3D


func _ready() -> void:
	_rebuild()


func _exit_tree() -> void:
	_tagged.clear()


## Rebuilds all the internal nodes, runs on ready and when radius or resolution change
func _rebuild() -> void:
	if not is_inside_tree():
		return
	for n in _internals:
		n.queue_free()
	_internals.clear()
	_size = radius * 2.0
	_texel = _size / resolution
	_baked = false
	_physics_frames = 0
	_mask_origin = 1e6
	_scroll = Vector2.ZERO
	_last_centers.clear()
	_last_vy.clear()
	_bursts.clear()

	var plane: PlaneMesh = PlaneMesh.new()
	plane.size = Vector2(_size, _size)
	plane.subdivide_width = resolution
	plane.subdivide_depth = resolution
	var noise: FastNoiseLite = FastNoiseLite.new()
	noise.frequency = 0.02
	noise.fractal_octaves = 2
	var noise_tex: NoiseTexture2D = NoiseTexture2D.new()
	noise_tex.width = 256
	noise_tex.height = 256
	noise_tex.seamless = true
	noise_tex.noise = noise
	_material = ShaderMaterial.new()
	_material.shader = FOG_SHADER
	_material.set_shader_parameter("noise_tex", noise_tex)
	_mesh = MeshInstance3D.new()
	_mesh.name = "FogMesh"
	_mesh.mesh = plane
	_mesh.material_override = _material
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_mesh.custom_aabb = AABB(Vector3(-_size, -100.0, -_size), Vector3(_size, 100.0, _size) * 2.0)
	_mesh.visible = false
	_add_internal(_mesh)

	# The sim never clears, it reads last frame back from the screen texture, cheap trick but works
	_trail = SubViewport.new()
	_trail.name = "TrailViewport"
	_trail.disable_3d = true
	_trail.transparent_bg = true
	_trail.use_hdr_2d = true
	_trail.size = Vector2i(resolution, resolution)
	_trail.render_target_clear_mode = SubViewport.CLEAR_MODE_ONCE
	_trail.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_sim_material = ShaderMaterial.new()
	_sim_material.shader = SIM_SHADER
	var sim: ColorRect = ColorRect.new()
	sim.size = Vector2(resolution, resolution)
	sim.material = _sim_material
	_trail.add_child(sim)
	_add_internal(_trail)

	# Ortho camera under the ground looking up, gives the depth to the lowest surface of everything
	# that goes into the fog, basically a fog x-ray
	var layer: int = 1 << (DISTURB_LAYER - 1)
	_mask_vp = SubViewport.new()
	_mask_vp.name = "MaskViewport"
	_mask_vp.use_hdr_2d = true
	_mask_vp.positional_shadow_atlas_size = 0
	_mask_vp.debug_draw = Viewport.DEBUG_DRAW_UNSHADED
	_mask_vp.size = Vector2i(resolution * 2, resolution * 2)
	_mask_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var env: Environment = Environment.new()
	env.background_mode = Environment.BG_COLOR
	_mask_cam = Camera3D.new()
	_mask_cam.environment = env
	_mask_cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	_mask_cam.size = _size
	_mask_cam.cull_mask = layer
	_mask_cam.current = true
	var quad_mesh: QuadMesh = QuadMesh.new()
	quad_mesh.size = Vector2(2.0, 2.0)
	var quad_mat: ShaderMaterial = ShaderMaterial.new()
	quad_mat.shader = MASK_SHADER
	quad_mesh.material = quad_mat
	var quad: MeshInstance3D = MeshInstance3D.new()
	quad.mesh = quad_mesh
	quad.layers = layer
	quad.position.z = -1.0
	quad.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	quad.extra_cull_margin = 16384.0
	_mask_cam.add_child(quad)
	_mask_vp.add_child(_mask_cam)
	_add_internal(_mask_vp)

	_area = Area3D.new()
	_area.name = "DisturbArea"
	_area.collision_layer = 0
	_area.collision_mask = disturb_mask
	_area.monitorable = false
	_area_shape = CollisionShape3D.new()
	var sphere: SphereShape3D = SphereShape3D.new()
	sphere.radius = radius
	_area_shape.shape = sphere
	_area.add_child(_area_shape)
	_add_internal(_area)

	_heights = Image.create_empty(resolution, resolution, false, Image.FORMAT_RF)
	_heights.fill(Color(-1e4, 0.0, 0.0))
	_height_tex = ImageTexture.create_from_image(_heights)


func _add_internal(node: Node) -> void:
	# Internal, no owner and top level, so its never saved, never shows in the tree and doesnt follow
	# the player around
	if node is Node3D:
		node.top_level = true
	# Snapped to the texel grid together with the textures, with interpolation it slides and
	# jitters like crazy, learned that the hard way
	node.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	add_child(node, false, Node.INTERNAL_MODE_BACK)
	_internals.append(node)


func _physics_process(delta: float) -> void:
	if not _heights:
		return
	# CSG e os bodies não ficam prontos nos primeiros frames, aí tem que esperar, NÃO SEI PORQUE kkkk
	_physics_frames += 1
	if _physics_frames < 3:
		return
	var space: PhysicsDirectSpaceState3D = get_world_3d().direct_space_state
	var cell: Vector2i = Vector2i(
		roundi(global_position.x / _texel), roundi(global_position.z / _texel)
	)
	if not _baked:
		_cell = cell
		for y in resolution:
			_bake_row(space, y)
		_baked = true
		_mesh.visible = true
	elif cell != _cell:
		_shift_heights(space, cell - _cell)
	for _i in rows_per_frame:
		_bake_row(space, _refresh_row)
		_refresh_row = (_refresh_row + 1) % resolution
	_height_tex.update(_heights)

	var center: Vector3 = Vector3(_cell.x * _texel, 0.0, _cell.y * _texel)
	_mesh.global_position = center
	_mask_origin = global_position.y - max_depth - 1.0
	_mask_cam.global_transform = Transform3D(
		Basis(Vector3.RIGHT, PI * 0.5), Vector3(center.x, _mask_origin, center.z)
	)
	# Way past the fog top on purpose, ragdoll skinned meshes keep their spawn AABB so a tight far
	# plane culls them, anything above the fog is behind the lower surfaces anyway so its fine
	_mask_cam.far = max_depth + max_surface_height + 60.0
	_mask_cam.near = 0.05
	var mask_mat: ShaderMaterial = (_mask_cam.get_child(0) as MeshInstance3D).mesh.material
	mask_mat.set_shader_parameter("cam_near", _mask_cam.near)
	mask_mat.set_shader_parameter("cam_far", _mask_cam.far)
	mask_mat.set_shader_parameter("mask_range", max_depth + max_surface_height + 4.0)
	_area.global_position = global_position
	_area.collision_mask = disturb_mask

	if Engine.is_editor_hint():
		_presence = 1.0
		return
	# Checks a bit above the node, feet sit right on the floor and keep missing the zone by a hair
	var inside: bool = _in_exclusion(space, global_position + Vector3.UP * fog_height)
	var cam: Camera3D = get_viewport().get_camera_3d()
	if cam and not inside:
		inside = _in_exclusion(space, cam.global_position)
	_presence = move_toward(_presence, 0.0 if inside else 1.0, delta / exclusion_fade)
	_update_brushes(delta)
	_update_bursts(delta)


func _process(delta: float) -> void:
	if not _material:
		return
	var m: ShaderMaterial = _material
	m.set_shader_parameter("terrain_height", _height_tex)
	m.set_shader_parameter("disturbance", _trail.get_texture())
	m.set_shader_parameter("fog_size", _size)
	m.set_shader_parameter("fog_height", fog_height)
	m.set_shader_parameter("fog_color", fog_color)
	m.set_shader_parameter("density", density)
	m.set_shader_parameter("lighting", lighting)
	m.set_shader_parameter("ground_softness", ground_softness)
	m.set_shader_parameter("hill_scale", hill_scale)
	m.set_shader_parameter("wind", wind)
	m.set_shader_parameter("morph_speed", morph_speed)
	m.set_shader_parameter("coverage_cutoff", coverage_cutoff)
	m.set_shader_parameter("coverage_softness", coverage_softness)
	m.set_shader_parameter("wake_lift", wake_lift)
	m.set_shader_parameter("streak", streak)
	m.set_shader_parameter("ledge_drape", ledge_drape)
	m.set_shader_parameter("player_pos", get_global_transform_interpolated().origin)
	m.set_shader_parameter("camera_fade", camera_fade)
	m.set_shader_parameter("detail_strength", detail_strength)
	m.set_shader_parameter("detail_scale", detail_scale)
	m.set_shader_parameter("detail_cycle", detail_cycle)
	m.set_shader_parameter("use_shape", shape_mask != null)
	m.set_shader_parameter("shape_mask", shape_mask)
	m.set_shader_parameter("shape_size", shape_size if shape_size > 0.0 else _size)
	m.set_shader_parameter("radius", radius)
	m.set_shader_parameter("edge_softness", edge_softness)
	m.set_shader_parameter("presence", smoothstep(0.0, 1.0, _presence))

	var s: ShaderMaterial = _sim_material
	s.set_shader_parameter("dt", delta)
	# Sent only once, the sim shifts its state when the window snaps to a new cell
	s.set_shader_parameter("scroll", _scroll)
	_scroll = Vector2.ZERO
	s.set_shader_parameter("terrain_height", _height_tex)
	s.set_shader_parameter("body_mask", _mask_vp.get_texture())
	s.set_shader_parameter("mask_origin", _mask_origin)
	s.set_shader_parameter("mask_range", max_depth + max_surface_height + 4.0)
	s.set_shader_parameter("fog_height", fog_height)
	s.set_shader_parameter("mask_softness", mask_softness)
	s.set_shader_parameter("footprint_spread", footprint_spread / _size)
	s.set_shader_parameter("refill_speed", refill_speed)
	s.set_shader_parameter("carve_speed", carve_speed)
	s.set_shader_parameter("drag", drag)
	s.set_shader_parameter("wave_speed", flow_speed / _size)
	s.set_shader_parameter("vorticity", vorticity / _size)
	s.set_shader_parameter("push_speed", push_speed / _size)
	s.set_shader_parameter("push_reach", 1.0 / _size)
	s.set_shader_parameter("burst_speed", burst_speed / _size)
	s.set_shader_parameter("burst_width", 0.4 / _size)


## Moves the height window by `d` cells, keeps the overlap and only raycasts the new strips
func _shift_heights(space: PhysicsDirectSpaceState3D, d: Vector2i) -> void:
	_cell += d
	_scroll += Vector2(d) / resolution
	if absi(d.x) >= resolution or absi(d.y) >= resolution:
		for y in resolution:
			_bake_row(space, y)
		return
	var old: Image = _heights.duplicate() as Image
	_heights.fill(Color(-1e4, 0.0, 0.0))
	_heights.blit_rect(old, Rect2i(Vector2i.ZERO, old.get_size()), -d)
	var cols: Array = range(resolution - d.x, resolution) if d.x > 0 else range(0, -d.x)
	for x in cols:
		for y in resolution:
			_bake_texel(space, x, y)
	var rows: Array = range(resolution - d.y, resolution) if d.y > 0 else range(0, -d.y)
	for y in rows:
		_bake_row(space, y)


func _bake_row(space: PhysicsDirectSpaceState3D, y: int) -> void:
	for x in resolution:
		_bake_texel(space, x, y)


func _bake_texel(space: PhysicsDirectSpaceState3D, x: int, y: int) -> void:
	var half: float = resolution * 0.5
	var wx: float = (_cell.x + x + 0.5 - half) * _texel
	var wz: float = (_cell.y + y + 0.5 - half) * _texel
	var cap: Vector3 = Vector3(wx, global_position.y + max_surface_height, wz)
	var bottom: float = global_position.y - max_depth
	var h: float = _cast_down(space, Vector3(wx, global_position.y + max_depth, wz), bottom)
	if h > cap.y:
		# Something above the cap, if theres an underside right above the cap point its an overhang
		# and the fog goes on the floor under it. If not, the cap point is buried in the terrain
		# (trimesh and heightmap surfaces are one sided) so the top surface is the ground, simple
		var up: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(
			cap, Vector3(wx, h + 0.01, wz), terrain_mask
		)
		up.hit_from_inside = true
		var ceiling: Dictionary = space.intersect_ray(up)
		if not ceiling.is_empty() and not _is_moving(ceiling.collider):
			h = _cast_down(space, cap, bottom)
	_heights.set_pixel(x, y, Color(h, 0.0, 0.0))


## Height of the first static surface below `from`, or -1e4 (sunk out of sight) if theres nothing
func _cast_down(space: PhysicsDirectSpaceState3D, from: Vector3, bottom: float) -> float:
	var query: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(
		from, Vector3(from.x, bottom, from.z), terrain_mask
	)
	var exclude: Array[RID] = []
	for _i in 4:
		var hit: Dictionary = space.intersect_ray(query)
		if hit.is_empty():
			break
		# Pula tudo que se mexe (player, ragdoll, plataforma), senão o bake fica todo fodido kkk
		if _is_moving(hit.collider):
			exclude.append(hit.rid)
			query.exclude = exclude
			continue
		return hit.position.y
	return -1e4


func _in_exclusion(space: PhysicsDirectSpaceState3D, point: Vector3) -> bool:
	var params: PhysicsPointQueryParameters3D = PhysicsPointQueryParameters3D.new()
	params.position = point
	params.collide_with_areas = true
	params.collide_with_bodies = false
	for r in space.intersect_point(params, 8):
		if r.collider is Node and r.collider.is_in_group(exclusion_group):
			return true
	return false


func _update_brushes(delta: float) -> void:
	var froms: PackedVector4Array = PackedVector4Array()
	var tos: PackedVector4Array = PackedVector4Array()
	froms.resize(MAX_BRUSHES)
	tos.resize(MAX_BRUSHES)
	var candidates: Array[Dictionary] = []
	var seen: Dictionary = {}
	for body in _area.get_overlapping_bodies():
		if not _is_moving(body):
			continue
		# Ragdoll bones of a character thats not ragdolling would just count it twice
		if body is PhysicalBone3D and not body.is_simulating_physics():
			continue
		var id: int = body.get_instance_id()
		seen[id] = true
		_tag_visuals(body)
		var bounds: AABB = body.global_transform * _get_local_bounds(body)
		var center: Vector3 = bounds.get_center()
		var last: Vector3 = _last_centers.get(id, center)
		_last_centers[id] = center

		var uv: Vector2 = _to_uv(center)
		var above: float = bounds.position.y - _ground_at(uv)
		# Se o body tá acima da névoa ele vai sumindo, hmmmmm
		var strength: float = 1.0 - clampf((above - fog_height) / 0.5, 0.0, 1.0)
		var body_radius: float = maxf(bounds.size.x, bounds.size.z) * 0.5
		var vy: float = (center.y - last.y) / maxf(delta, 0.001)
		var prev_vy: float = _last_vy.get(id, 0.0)
		_last_vy[id] = vy
		# Caiu rápido e parou dentro da névoa, aí pousou, aí poof kkkkjsk
		if prev_vy < -land_speed and vy > prev_vy * 0.5 and above < fog_height:
			_add_burst(uv, body_radius, minf(-prev_vy, 12.0))
		if strength <= 0.0:
			continue
		(
			candidates
			. append(
				{
					"from": _to_uv(last),
					"to": uv,
					"radius": body_radius * radius_scale / _size,
					"strength": strength,
					"moved": center.distance_squared_to(last),
				}
			)
		)
	for id in _last_centers.keys():
		if not seen.has(id):
			_last_centers.erase(id)
			_last_vy.erase(id)

	# More bodies than brush slots, the fastest ones win, sorry slow guys
	candidates.sort_custom(func(a, b): return a.moved > b.moved)
	var count: int = 0
	for c in candidates.slice(0, MAX_BRUSHES):
		var vel: Vector2 = (c.to - c.from) / maxf(delta, 0.001)
		froms[count] = Vector4(c.from.x, c.from.y, c.radius, c.strength)
		tos[count] = Vector4(c.to.x, c.to.y, vel.x, vel.y)
		count += 1
	_sim_material.set_shader_parameter("brushes_from", froms)
	_sim_material.set_shader_parameter("brushes_to", tos)
	_sim_material.set_shader_parameter("brush_count", count)


func _add_burst(uv: Vector2, body_radius: float, impact: float) -> void:
	var world: Vector2 = (uv - Vector2(0.5, 0.5)) * _size + Vector2(_cell) * _texel
	_bursts.append({"world": world, "radius": body_radius, "impact": impact, "age": 0.0})
	if _bursts.size() > MAX_BURSTS:
		_bursts.pop_front()


func _update_bursts(delta: float) -> void:
	var packed: PackedVector4Array = PackedVector4Array()
	packed.resize(MAX_BURSTS)
	var alive: Array[Dictionary] = []
	for b in _bursts:
		b.age += delta
		var t: float = b.age / burst_life
		if t >= 1.0:
			continue
		var grow: float = 1.0 - (1.0 - t) * (1.0 - t)
		var r: float = b.radius + b.impact * burst_spread * grow
		var strength: float = clampf(b.impact / 8.0, 0.3, 1.0) * (1.0 - t)
		# Kept in world space so the ring doesnt slide when the window scrolls
		var uv: Vector2 = (b.world - Vector2(_cell) * _texel) / _size + Vector2(0.5, 0.5)
		packed[alive.size()] = Vector4(uv.x, uv.y, r / _size, strength)
		alive.append(b)
	_bursts = alive
	_sim_material.set_shader_parameter("bursts", packed)
	_sim_material.set_shader_parameter("burst_count", alive.size())


## Puts the body meshes on the mask camera layer, ragdoll bones tag the whole skeleton at once
func _tag_visuals(body: Node) -> void:
	var root: Node = body
	if body is PhysicalBone3D:
		while root and not root is Skeleton3D:
			root = root.get_parent()
	if root == null or _tagged.has(root.get_instance_id()):
		return
	_tagged[root.get_instance_id()] = true
	for mesh: MeshInstance3D in root.find_children("*", "MeshInstance3D", true, false):
		mesh.set_layer_mask_value(DISTURB_LAYER, true)


func _is_moving(body: Object) -> bool:
	return body is PhysicsBody3D and (not body is StaticBody3D or body is AnimatableBody3D)


func _to_uv(world: Vector3) -> Vector2:
	return (Vector2(world.x, world.z) - Vector2(_cell) * _texel) / _size + Vector2(0.5, 0.5)


func _ground_at(uv: Vector2) -> float:
	var px: Vector2i = Vector2i(uv * resolution).clamp(
		Vector2i.ZERO, Vector2i(resolution - 1, resolution - 1)
	)
	return _heights.get_pixelv(px).r


## All the body collision shapes merged in local space, cached per body so it doesnt redo it
func _get_local_bounds(body: CollisionObject3D) -> AABB:
	var id: int = body.get_instance_id()
	if _local_bounds.has(id):
		return _local_bounds[id]
	var bounds: AABB = AABB()
	var first: bool = true
	for owner_id in body.get_shape_owners():
		var xform: Transform3D = body.shape_owner_get_transform(owner_id)
		for i in body.shape_owner_get_shape_count(owner_id):
			var b: AABB = (
				xform * body.shape_owner_get_shape(owner_id, i).get_debug_mesh().get_aabb()
			)
			bounds = b if first else bounds.merge(b)
			first = false
	_local_bounds[id] = bounds
	return bounds
