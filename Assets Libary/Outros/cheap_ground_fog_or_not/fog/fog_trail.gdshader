shader_type canvas_item;
render_mode blend_disabled;

// Shallow water sim in one pass, the viewport never clears so the screen texture still has last frame
// R = carved fog (0 = rest level, 1 = cleared, < 0 = piled up), GB = velocity in uv/s
// Fog height is h = 1 - R, velocity moves it around (continuity) and height differences push it
// back (pressure), so shoved fog piles up, sloshes around and flows back into the holes, basically water but lazier
uniform sampler2D screen_tex : hint_screen_texture, filter_linear, repeat_disable;

uniform float dt = 0.016;
// How much the window moved this frame (uv), last frame's state gets read shifted by it
uniform vec2 scroll = vec2(0.0);
uniform float refill_speed = 0.6;
uniform float velocity_damping = 0.8;
// Wave speed at rest height, in uv/s
uniform float wave_speed = 0.06;
uniform float diffusion : hint_range(0.0, 1.0) = 0.2;
// Vorticity confinement, gives energy back to the eddies that the damping and blur keep killing
// In uv, its strength times 1 m (set from ground_fog.gd)
uniform float vorticity = 0.04;

// Shape of whatever goes into the fog, its the distance from the mask camera (under the terrain
// looking up) to the lowest surface of each disturber mesh, carves where thats below the fog top
uniform sampler2D body_mask : filter_linear, repeat_disable;
uniform sampler2D terrain_height : filter_linear, repeat_disable;
uniform float mask_origin = 0.0;
uniform float mask_range = 16.0;
uniform float fog_height = 0.5;
uniform float mask_softness = 0.25;
// Grows the footprint (uv) so small stuff like feet still clears a patch you can actually see
uniform float footprint_spread = 0.01;
uniform float carve_speed = 6.0;

// One capsule brush per body, from last frame's position to this one, it only stirs velocity now, carving is the mask camera's job
// from: xy = last uv, z = radius in uv, w = strength (0..1, fades when the body is above the fog)
// to:   xy = uv, zw = velocity in uv/s
uniform int brush_count = 0;
uniform vec4 brushes_from[64];
uniform vec4 brushes_to[64];
uniform float inject_rate = 6.0;
uniform float drag = 0.7;
uniform float push_speed = 0.05;
// Extra reach (uv) of each brush past its radius, so it moves the fog around the carved hole too
uniform float push_reach = 0.04;

// Landing puffs: xy = uv, z = ring radius in uv (grows over its life), w = strength
uniform int burst_count = 0;
uniform vec4 bursts[8];
uniform float burst_speed = 0.12;
uniform float burst_width = 0.02;

// Fora da janela a névoa tá novinha, ninguém mexeu ainda kkk
vec4 prev(vec2 uv) {
	if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
		return vec4(0.0);
	}
	return texture(screen_tex, uv);
}

float dip_at(vec2 uv) {
	float d = texture(body_mask, vec2(uv.x, 1.0 - uv.y)).r;
	// 0 means the mask wasnt rendered yet (real depths start at the near plane)
	if (d <= 0.0) {
		return -1.0;
	}
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
	d = (d - 0.25) * 2.0 * mask_range;
#endif
	float bottom = mask_origin + d;
	return texture(terrain_height, uv).r + fog_height - bottom;
}

void fragment() {
	vec2 px = SCREEN_PIXEL_SIZE;
	vec2 base = SCREEN_UV + scroll;
	vec2 vel = prev(base).gb;
	vec4 nl = prev(base - vec2(px.x, 0.0));
	vec4 nr = prev(base + vec2(px.x, 0.0));
	vec4 nd = prev(base - vec2(0.0, px.y));
	vec4 nu = prev(base + vec2(0.0, px.y));
	float div = (nr.g - nl.g) / (2.0 * px.x) + (nu.b - nd.b) / (2.0 * px.y);
	// Gradient of carved is minus the gradient of height
	vec2 grad_carved = vec2(nr.r - nl.r, nu.r - nd.r) / (2.0 * px);
	float curl = (nr.b - nl.b) / (2.0 * px.x) - (nu.g - nd.g) / (2.0 * px.y);
	// Curl at the 4 neighbors with a wider stencil, the screen copy drops alpha so it cant be stored
	vec2 c0 = vel;
	vec2 r2 = prev(base + vec2(2.0 * px.x, 0.0)).gb;
	vec2 l2 = prev(base - vec2(2.0 * px.x, 0.0)).gb;
	vec2 u2 = prev(base + vec2(0.0, 2.0 * px.y)).gb;
	vec2 d2 = prev(base - vec2(0.0, 2.0 * px.y)).gb;
	vec2 ru = prev(base + px).gb;
	vec2 rd = prev(base + vec2(px.x, -px.y)).gb;
	vec2 lu = prev(base + vec2(-px.x, px.y)).gb;
	vec2 ld = prev(base - px).gb;
	vec2 inv2 = 1.0 / (2.0 * px);
	float curl_r = (r2.y - c0.y) * inv2.x - (ru.x - rd.x) * inv2.y;
	float curl_l = (c0.y - l2.y) * inv2.x - (lu.x - ld.x) * inv2.y;
	float curl_u = (ru.y - lu.y) * inv2.x - (u2.x - c0.x) * inv2.y;
	float curl_d = (rd.y - ld.y) * inv2.x - (c0.x - d2.x) * inv2.y;
	// Points toward the stronger eddies, the force spins the flow around them so they dont die out
	vec2 grad_curl = vec2(abs(curl_r) - abs(curl_l), abs(curl_u) - abs(curl_d));
	vec2 n_curl = grad_curl / max(length(grad_curl), 1e-5);
	vec2 confinement = vorticity * vec2(n_curl.y, -n_curl.x) * curl;

	// Semi-Lagrangian advection plus a little blur, fancy name for "look back where the fog came from"
	vec2 src = SCREEN_UV + scroll - vel * dt;
	vec4 here = prev(src);
	vec4 around = (prev(src + vec2(px.x, 0.0)) + prev(src - vec2(px.x, 0.0))
			+ prev(src + vec2(0.0, px.y)) + prev(src - vec2(0.0, px.y))) * 0.25;
	vec4 s = mix(here, around, diffusion);

	// Continuity, spreading flow thins the fog and converging flow piles it up
	float h = 1.0 - s.r;
	float carved = 1.0 - max(h - h * div * dt, 0.0);
	// Slow relax back to rest height, fills what carving took and flattens leftover piles, the fog heals itself basically
	carved *= exp(-refill_speed * dt);
	// Pressão afeta a névoa, a névoa escorre do alto pro baixo, aí fds
	vec2 v = (s.gb + (wave_speed * wave_speed * grad_carved + confinement) * dt)
			* exp(-velocity_damping * dt);

	float carve_k = 1.0 - exp(-carve_speed * dt);
	float inject_k = 1.0 - exp(-inject_rate * dt);

	// Dilated footprint, takes the deepest dip in a small ring so the shape gets a soft margin
	float dip = dip_at(UV);
	for (int i = 0; i < 8; i++) {
		float a = float(i) * 0.785398;
		vec2 o = vec2(cos(a), sin(a)) * footprint_spread;
		dip = max(dip, dip_at(UV + o) - mask_softness * 0.5);
	}
	carved = mix(carved, 1.0, smoothstep(0.0, mask_softness, dip) * carve_k);

	for (int i = 0; i < brush_count; i++) {
		vec4 f = brushes_from[i];
		vec4 to = brushes_to[i];
		vec2 ab = to.xy - f.xy;
		float t = clamp(dot(UV - f.xy, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
		vec2 offset = UV - (f.xy + ab * t);
		// Goes past the footprint so the fog around the body moves too, not just the carved part
		float m = (1.0 - smoothstep(f.z, f.z * 2.0 + push_reach, length(offset))) * f.w;
		// Fog gets dragged with the body and shoved out from it as fast as the body moves (capped at
		// push_speed), bodies standing still leave the flow alone
		float body_speed = length(to.zw);
		m *= smoothstep(0.0, wave_speed, body_speed);
		vec2 outward = offset / max(length(offset), 1e-5);
		v = mix(v, to.zw * drag + outward * min(body_speed, push_speed), m * inject_k);
	}

	float burst_k = 1.0 - exp(-12.0 * dt);
	for (int i = 0; i < burst_count; i++) {
		vec4 b = bursts[i];
		vec2 offset = UV - b.xy;
		float d = length(offset);
		float ring = exp(-pow((d - b.z) / burst_width, 2.0));
		v = mix(v, offset / max(d, 1e-5) * burst_speed, ring * b.w * burst_k);
		carved = mix(carved, 1.0, (1.0 - smoothstep(b.z * 0.4, b.z, d)) * b.w * burst_k);
	}

	v *= min(1.0, 0.5 / max(length(v), 1e-5));
	COLOR = vec4(clamp(carved, -1.0, 1.0), v, 1.0);
}
