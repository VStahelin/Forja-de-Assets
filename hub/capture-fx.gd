# Offline capture of the bundled Binbun pack in a staging Godot project.
extends SceneTree

func _initialize() -> void:
	capture.call_deferred()

func capture() -> void:
	var stage := Node3D.new()
	root.add_child(stage)
	var world := WorldEnvironment.new()
	world.environment = Environment.new()
	world.environment.background_mode = Environment.BG_COLOR
	world.environment.background_color = Color("#171e29")
	world.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	world.environment.ambient_light_color = Color.WHITE
	world.environment.ambient_light_energy = 0.45
	world.environment.tonemap_mode = Environment.TONE_MAPPER_ACES
	stage.add_child(world)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-52, -32, 0)
	stage.add_child(light)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	stage.add_child(camera)
	var args := OS.get_cmdline_user_args()
	var paths := FileAccess.get_file_as_string(args[0]).strip_edges().split("\n")
	var fits: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(args[2])) if args.size() > 2 else {}
	for raw in paths:
		var path := raw.strip_edges()
		var packed := load(path) as PackedScene
		if not packed:
			continue
		var fx := packed.instantiate() as Node3D
		stage.add_child(fx)
		var anim := fx.get_node_or_null("AnimationPlayer") as AnimationPlayer
		var duration := 2.0
		if anim and anim.has_animation("main"):
			duration = clampf(anim.get_animation("main").length, 0.5, 4.0)
		var span := 8.0
		if path.contains("muzzle_flash"): span = 3.0
		if path.contains("ExplosionFX"): span = 18.0
		if path.contains("nuke"): span = 36.0
		camera.size = span
		var center := Vector3.UP * (span * 0.15 if path.contains("ExplosionFX") else 0.0)
		camera.position = center + Vector3(0.48, 0.29, 1.0).normalized() * 55.0
		camera.look_at(center)
		var fit: Array = fits.get(path.get_file().get_basename(), [])
		if not fit.is_empty():
			camera.position += span * (camera.basis.x * float(fit[0]) + camera.basis.y * float(fit[1]))
			camera.size = span * float(fit[2])
		for i in 12:
			await process_frame
		if fx.has_method("play"): fx.call("play")
		var dir := args[1].path_join(path.get_file().get_basename())
		DirAccess.make_dir_recursive_absolute(dir)
		for i in ceili(duration * 24.0) + 2:
			await process_frame
			await RenderingServer.frame_post_draw
			var img := root.get_texture().get_image()
			img.save_png(dir.path_join("%03d.png" % i))
		stage.remove_child(fx)
		fx.free()
		print("CAPTURE ", path)
	quit()

