shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_back, diffuse_lambert_wrap, specular_disabled;

// World Y of the terrain under each texel (raycast by ground_fog.gd)
uniform sampler2D terrain_height : filter_linear, repeat_disable;
// Fluid sim from fog_trail.gdshader: R = carved (0 = rest, 1 = cleared, < 0 = piled), GB = velocity in uv/s
uniform sampler2D disturbance : filter_linear, repeat_disable;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform sampler2D depth_texture : hint_depth_texture, filter_nearest;

uniform float fog_size = 24.0;
uniform float fog_height = 0.5;
// Match it to the scene, warm grey white by day and teal at night
uniform vec4 fog_color : source_color = vec4(0.82, 0.81, 0.76, 1.0);
uniform float density : hint_range(0.0, 8.0) = 1.6;
// 0 = flat color, 1 = lit and shadowed by the scene lights
uniform float lighting : hint_range(0.0, 1.0) = 0.8;
// Fades the fog out as it gets shallow, so it melts into the ground instead of ending in a hard edge
uniform float ground_softness = 0.3;

// Uns morrinhos em cima da névoa, hmmmmm não sei se ficou bom mas é isso
uniform float hill_scale = 0.06;
uniform vec2 wind = vec2(0.03, 0.012);
// Second noise layer going the other way, so the hills change shape instead of just sliding
uniform float morph_speed = 0.15;
// Big slow patches that thin the fog out, so it doesnt cover everything all the time
uniform float coverage_scale = 0.015;
uniform vec2 coverage_drift = vec2(0.006, 0.004);
uniform float coverage_cutoff : hint_range(0.0, 1.0) = 0.35;
uniform float coverage_softness : hint_range(0.01, 1.0) = 0.3;

// Pushes fog up on the rim of the carved trail, so it looks pushed away instead of cut
uniform float wake_lift = 0.4;
// Drags the hills along the sim velocity so the fog smears into streaks behind whatever moves
uniform float streak = 0.6;
// Fog spreads this far (m) past ledges and slopes down them instead of making a step
uniform float ledge_drape = 0.8;

// Sphere around the player where the fog shows up
uniform vec3 player_pos;
uniform float radius = 8.0;
uniform float edge_softness = 3.0;
// Global fade for the exclusion areas
uniform float presence = 1.0;
// Optional black and white mask centered on the player, white = fog, black = none
uniform sampler2D shape_mask : filter_linear, repeat_disable;
uniform bool use_shape = false;
uniform float shape_size = 24.0;
// Fades the fog out within this distance (m) of the camera
uniform float camera_fade = 1.5;
// Per pixel wisps dragged along the sim velocity, so eddies show up finer than the mesh
uniform float detail_strength : hint_range(0.0, 1.0) = 0.5;
// Wisp frequency (1/m)
uniform float detail_scale = 0.8;
// Seconds per flow cycle, longer stretches the wisps more along the flow
uniform float detail_cycle = 1.2;

const vec2 DIRS[8] = vec2[](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
		vec2(0.707, 0.707), vec2(-0.707, 0.707), vec2(0.707, -0.707), vec2(-0.707, -0.707));

varying vec2 v_world_xz;
varying vec2 v_sim_uv;

// How thick the fog is above the ground: noise hills, sim (carved/piled + rim lift), coverage,
// sphere edge and shape mask, vertex uses it to place the mesh and fragment for the per pixel shape
float fog_depth(vec2 uv, vec2 world_xz, float ground, float t) {
	vec3 sim = textureLod(disturbance, uv, 0.0).rgb;
	vec2 flow = -sim.gb * fog_size * streak;
	vec2 texel = 2.0 / vec2(textureSize(disturbance, 0));
	float grad = abs(textureLod(disturbance, uv + vec2(texel.x, 0.0), 0.0).r - textureLod(disturbance, uv - vec2(texel.x, 0.0), 0.0).r)
			+ abs(textureLod(disturbance, uv + vec2(0.0, texel.y), 0.0).r - textureLod(disturbance, uv - vec2(0.0, texel.y), 0.0).r);

	vec2 p = (world_xz + flow) * hill_scale;
	float n = textureLod(noise_tex, p + t * wind, 0.0).r * 0.6
			+ textureLod(noise_tex, p * 1.7 + vec2(-wind.y, wind.x) * t * morph_speed * 10.0, 0.0).r * 0.4;
	float hills = smoothstep(0.2, 0.8, n);
	float coverage = textureLod(noise_tex, world_xz * coverage_scale + t * coverage_drift, 0.0).r;
	coverage = smoothstep(coverage_cutoff, coverage_cutoff + coverage_softness, coverage);

	float dist = distance(vec3(world_xz.x, ground, world_xz.y), player_pos);
	float edge = 1.0 - smoothstep(radius - edge_softness, radius, dist);
	float amount = clamp(1.0 - sim.r, 0.0, 2.0) * edge * coverage;
	if (use_shape) {
		vec2 suv = (world_xz - player_pos.xz) / shape_size + 0.5;
		bool inside = all(greaterThanEqual(suv, vec2(0.0))) && all(lessThanEqual(suv, vec2(1.0)));
		amount *= inside ? textureLod(shape_mask, suv, 0.0).r : 0.0;
	}
	// Rim lift only where theres fog left, if not the gradient fills the inside of the hole back
	return fog_height * amount * (mix(0.4, 1.2, hills) + grad * wake_lift);
}

// Fog top height at an offset (m) from this pixel, depth = layer thickness there
float top_at(vec2 offset, float t, out float depth) {
	vec2 uv = v_sim_uv + offset / fog_size;
	float ground = textureLod(terrain_height, uv, 0.0).r;
	depth = fog_depth(uv, v_world_xz + offset, ground, t);
	return ground + depth;
}

void vertex() {
	vec3 origin = MODEL_MATRIX[3].xyz;
	vec2 uv = VERTEX.xz / fog_size + 0.5;
	vec2 world_xz = VERTEX.xz + origin.xz;

	float ground = textureLod(terrain_height, uv, 0.0).r;
	if (ledge_drape > 0.0) {
		float blur = 0.0;
		for (int i = 0; i < 8; i++) {
			blur += textureLod(terrain_height, uv + DIRS[i] * ledge_drape / fog_size, 0.0).r;
		}
		ground = max(ground, blur * 0.125);
	}
	v_world_xz = world_xz;
	v_sim_uv = uv;
	// Small offset so the cleared surface doesnt z-fight with the ground
	VERTEX.y = ground - origin.y + 0.02 + fog_depth(uv, world_xz, ground, TIME);
}

void fragment() {
	// The mesh is only as fine as the sim so i redo the fog shape per pixel, 4 taps one texel
	// apart give a smooth normal (shading) and a smooth layer depth (opacity), costs some reads but looks way better
	float e = fog_size / float(textureSize(terrain_height, 0).x);
	float d0, d1, d2, d3;
	float hx = top_at(vec2(e, 0.0), TIME, d0) - top_at(vec2(-e, 0.0), TIME, d1);
	float hz = top_at(vec2(0.0, e), TIME, d2) - top_at(vec2(0.0, -e), TIME, d3);
	float layer = (d0 + d1 + d2 + d3) * 0.25;
	// Texels with no ground hold -1e4, this keeps the slope from going insane
	hx = clamp(hx, -4.0 * e, 4.0 * e);
	hz = clamp(hz, -4.0 * e, 4.0 * e);
	NORMAL = normalize((VIEW_MATRIX * vec4(-hx, 2.0 * e, -hz, 0.0)).xyz);

	// Fake volume (not real raymarching, shhh), opacity comes from how far the view ray goes between the fog surface and whatever is behind it
	float depth = texture(depth_texture, SCREEN_UV).r;
	vec4 view = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, depth, 1.0);
	float scene_dist = -view.z / view.w;
	float frag_dist = length(VERTEX);
	// Ray length from the fog surface to whatever is behind it
	float ray_len = max(scene_dist + VERTEX.z, 0.0) * frag_dist / max(-VERTEX.z, 1e-4);

	// Density goes from 0 at the fog top to full at the base, so crests seen from the side fade soft
	// instead of drawing a hard line. Looking straight down its the same total as a uniform slab
	vec3 dir = mat3(INV_VIEW_MATRIX) * (VERTEX / frag_dist);
	float descent = max(-dir.y, 0.02);
	float slab = max(layer, 0.001);
	float t_base = slab / descent;
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
	// Compatibility (web) depth texture reads 0 everywhere, so the ray just crosses the whole layer
	ray_len = t_base;
#endif
	float thickness = ray_len <= t_base ? ray_len * ray_len * descent / slab : ray_len;

	// Flow map detail, two noise layers drift along the velocity and each one resets while the other
	// is fully shown, so the wisps follow the swirls without stretching forever
	vec2 vel = texture(disturbance, v_sim_uv).gb * fog_size;
	float phase = TIME / detail_cycle;
	float p0 = fract(phase);
	float p1 = fract(phase + 0.5);
	vec2 dp = v_world_xz * detail_scale;
	float n0 = texture(noise_tex, dp - vel * p0 * detail_cycle * detail_scale).r;
	float n1 = texture(noise_tex, dp + vec2(0.37, 0.71) - vel * p1 * detail_cycle * detail_scale).r;
	float wisps = mix(n0, n1, abs(1.0 - 2.0 * p0));
	thickness *= mix(1.0, smoothstep(0.15, 0.85, wisps) * 2.0, detail_strength);

	ALBEDO = fog_color.rgb * lighting;
	EMISSION = fog_color.rgb * (1.0 - lighting);
	ROUGHNESS = 1.0;
	ALPHA = (1.0 - exp(-thickness * density)) * smoothstep(0.0, ground_softness, layer) * fog_color.a * presence
			* smoothstep(0.0, camera_fade, frag_dist);
}
