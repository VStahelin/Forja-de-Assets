shader_type spatial;
render_mode unshaded, depth_draw_never, depth_test_disabled, cull_disabled, fog_disabled, shadows_disabled;

// Fullscreen quad for the mask camera that looks up from under the ground, writes the distance from the camera to the
// nearest (lowest) surface of every disturber mesh, so the sim knows how deep bodies go into the fog
uniform sampler2D depth_texture : hint_depth_texture, filter_nearest;
uniform float cam_near = 0.05;
uniform float cam_far = 73.0;
uniform float mask_range = 16.0;

void vertex() {
	// Every camera sees this quad (layers are shared) so it collapses unless its the ortho camera looking straight up, if not it covers your whole screen lol
	bool mask_cam = INV_VIEW_MATRIX[2].y < -0.99 && PROJECTION_MATRIX[3][3] > 0.5;
	POSITION = mask_cam ? vec4(VERTEX.xy, 1.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}

void fragment() {
	float depth = texture(depth_texture, SCREEN_UV).r;
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
	// Compatibility depth is reversed and linear for ortho, and the inverse projection there is fodido.
	// It also wrecks values outside ~0.25..0.9 so the distance gets squeezed into 0.25..0.75, sim unpacks it
	float dist = mix(cam_far, cam_near, depth);
	ALBEDO = vec3(0.25 + 0.5 * clamp(dist / mask_range, 0.0, 1.0));
#else
	vec4 view = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, depth, 1.0);
	ALBEDO = vec3(-view.z / view.w);
#endif
	// Passe transparente pra desenhar depois de todos os meshes opacos, mexe nisso e NADA FUNCIONA
	ALPHA = 1.0;
}
