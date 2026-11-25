import { loadPreviewRuntime } from './model.js';

// Uncompressed true-color TGA used by the VFX sheets in the library.
async function readTga(url, signal) {
  const result = await fetch(url, { signal });
  if (!result.ok) throw new Error('Não foi possível abrir a imagem.');
  const bytes = new Uint8Array(await result.arrayBuffer());
  const header = new DataView(bytes.buffer);
  if (bytes.length < 18 || bytes[1] || bytes[2] !== 2 || ![24, 32].includes(bytes[16])) {
    throw new Error('Este TGA não tem prévia neste formato.');
  }
  const width = header.getUint16(12, true), height = header.getUint16(14, true);
  const stride = bytes[16] / 8, offset = 18 + bytes[0];
  if (!width || !height || width * height > 16 * 1024 * 1024 || offset + width * height * stride > bytes.length) {
    throw new Error('Dimensões ou dados do TGA inválidos.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    const row = bytes[17] & 32 ? y : height - 1 - y;
    for (let x = 0; x < width; x++) {
      const column = bytes[17] & 16 ? width - 1 - x : x;
      const source = offset + (row * width + column) * stride;
      const pixel = (y * width + x) * 4;
      image.data[pixel] = bytes[source + 2];
      image.data[pixel + 1] = bytes[source + 1];
      image.data[pixel + 2] = bytes[source];
      image.data[pixel + 3] = stride === 4 ? bytes[source + 3] : 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function loadImage(url) {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
}

export async function drawContactSheet(canvas, file, signal) {
  const sheet = file.preview === 'tga' ? await readTga(file.url, signal) : await loadImage(file.url);
  if (signal.aborted) return;
  canvas.width = sheet.width;
  canvas.height = sheet.height;
  canvas.getContext('2d').drawImage(sheet, 0, 0);
  return sheet;
}

export async function attachEffectPreview(target, file, sequence, signal) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Prévia do efeito');
  const context = canvas.getContext('2d');
  let frames;
  if (file.columns && file.rows) {
    const sheet = file.preview === 'tga' ? await readTga(file.url, signal) : await loadImage(file.url);
    const width = sheet.width / (sheet.width % file.columns === 0 ? file.columns : 2 ** Math.ceil(Math.log2(file.columns)));
    const height = sheet.height / file.rows;
    canvas.width = width;
    canvas.height = height;
    frames = Array.from({ length: file.columns * file.rows }, (_, index) => ({
      image: sheet, x: index % file.columns * width, y: Math.floor(index / file.columns) * height,
    }));
  } else if (sequence.length > 1) {
    const images = await Promise.all(sequence.map(asset => loadImage(asset.url)));
    canvas.width = images[0].width;
    canvas.height = images[0].height;
    frames = images.map(image => ({ image, x: 0, y: 0 }));
  } else {
    const sheet = file.preview === 'tga' ? await readTga(file.url, signal) : await loadImage(file.url);
    canvas.width = sheet.width;
    canvas.height = sheet.height;
    frames = [{ image: sheet, x: 0, y: 0 }];
  }
  if (signal.aborted) return;
  target.replaceChildren(canvas);
  let index = 0;
  let timer;
  function render() {
    const { image, x, y } = frames[index];
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    index = (index + 1) % frames.length;
  }
  render();
  if (frames.length === 1) return;
  const controls = document.createElement('div');
  controls.className = 'inspector-controls';
  controls.innerHTML = '<button type="button" class="btn">Reproduzir</button><label>FPS <input type="number" value="12" min="1" max="60"></label>';
  target.after(controls);
  const [button, speed] = controls.querySelectorAll('button, input');
  const start = () => setInterval(render, 1000 / Math.max(1, Math.min(60, +speed.value || 12)));
  button.onclick = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
      button.textContent = 'Reproduzir';
    } else {
      timer = start();
      button.textContent = 'Pausar';
    }
  };
  speed.onchange = () => { if (timer) { clearInterval(timer); timer = start(); } };
  signal.addEventListener('abort', () => clearInterval(timer), { once: true });
}

export async function renderWaveform(canvas, url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) return;
  const bytes = await response.arrayBuffer();
  const audio = new AudioContext();
  try {
    const decoded = await audio.decodeAudioData(bytes);
    if (signal.aborted) return;
    const samples = decoded.getChannelData(0);
    const bars = 80;
    const stride = Math.max(1, Math.floor(samples.length / bars));
    const context = canvas.getContext('2d');
    const step = canvas.width / bars;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#b7f478';
    for (let bar = 0; bar < bars; bar++) {
      let peak = 0;
      for (let index = bar * stride; index < Math.min(samples.length, (bar + 1) * stride); index += Math.max(1, Math.floor(stride / 120))) {
        peak = Math.max(peak, Math.abs(samples[index]));
      }
      const height = Math.max(2, Math.sqrt(peak) * (canvas.height - 4));
      context.fillRect(bar * step, (canvas.height - height) / 2, Math.max(1, step - 1), height);
    }
  } finally { await audio.close(); }
}

// Godot scene preview

const numbers = value => (value?.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
const vector = (value, fallback) => value ? numbers(value.replace(/^\w+\(/, '')) : fallback;
const ref = value => /(?:ExtResource|SubResource)\("([^"]+)"\)/.exec(value || '')?.[1];
const attr = (line, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(line)?.[1];
const bounded = (number, min, max) => Math.max(min, Math.min(max, number));

export function parseFxScene(source) {
  const resources = new Map(), external = new Map(), nodes = [];
  let current;
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      current = { type: attr(line, 'type'), name: attr(line, 'name'), parent: attr(line, 'parent'), fields: {} };
      if (line.startsWith('[ext_resource ')) external.set(attr(line, 'id'), { ...current, path: attr(line, 'path') });
      else if (line.startsWith('[sub_resource ')) resources.set(attr(line, 'id'), current);
      else if (line.startsWith('[node ')) {
        current.instance = ref(/instance=(.+)\]$/.exec(line)?.[1]);
        nodes.push(current);
      } else current = null;
    } else if (current) {
      const equals = line.indexOf(' = ');
      if (equals !== -1) current.fields[line.slice(0, equals)] = line.slice(equals + 3);
    }
  }
  return { nodes, resources, external };
}

function particleSpec(document, node) {
  const { fields } = node;
  const { resources, external } = document;
  const particle = node.type !== 'MeshInstance3D';
  const process = resources.get(ref(fields.process_material))?.fields || {};
  const mesh = resources.get(ref(particle ? fields.draw_pass_1 : fields.mesh));
  const material = resources.get(ref(fields.material_override || mesh?.fields.material))?.fields || {};
  const shader = external.get(ref(material.shader))?.path?.split('/').at(-1) || '';
  const ramp = resources.get(ref(process.color_initial_ramp || process.color_ramp))?.fields.gradient;
  const palette = vector(resources.get(ref(ramp))?.fields.colors, []);
  const color = Object.entries(material).find(([key, value]) => /(?:secondary|tint|emission)_?color/i.test(key) && /^Color\(/.test(value))?.[1]
    || Object.entries(material).find(([key, value]) => /color/i.test(key) && /^Color\(/.test(value))?.[1]
    || process.color;
  const curve = key => {
    const texture = resources.get(ref(process[key]));
    const values = resources.get(ref(texture?.fields.curve))?.fields._data || '';
    return [...values.matchAll(/Vector2\(([^,]+),\s*([^)]+)\)/g)].map(point => [Number(point[1]), Number(point[2])]);
  };
  return {
    name: node.name, particle, shader, type: mesh?.type, mesh: mesh?.fields || {},
    origin: vector(fields.transform, []), position: vector(fields.position, [0, 0, 0]),
    direction: vector(process.direction, [1, 0, 0]), gravity: vector(process.gravity, [0, -9.8, 0]),
    offset: vector(process.emission_shape_offset, [0, 0, 0]), extents: vector(process.emission_box_extents, [1, 1, 1]),
    spread: Number(process.spread ?? 45), shape: Number(process.emission_shape || 0),
    radius: Number(process.emission_sphere_radius || process.emission_ring_radius || 0.4),
    velocity: [Number(process.initial_velocity_min || 0), Number(process.initial_velocity_max || 0)],
    scales: [Number(process.scale_min ?? 1), Number(process.scale_max ?? 1)],
    duration: bounded(Number(fields.lifetime || (particle ? 1 : 2.2)), 0.06, 10),
    amount: particle ? bounded(Number(fields.amount ?? 8), 1, 90) : 1,
    burst: Number(fields.explosiveness ?? (fields.one_shot === 'true' ? 1 : 0)),
    repeat: fields.one_shot !== 'true',
    color: vector(color, palette.length > 4 ? palette.slice(4, 8) : null),
    alpha: curve('alpha_curve'), scale: curve('scale_curve'),
  };
}

export function extractFxLayers(document) {
  return document.nodes
    .filter(node => ['GPUParticles3D', 'CPUParticles3D', 'MeshInstance3D'].includes(node.type))
    .map(node => particleSpec(document, node));
}

function curveAt(points, t, fallback) {
  if (!points.length) return fallback;
  const after = points.findIndex(point => point[0] >= t);
  if (after === 0) return points[0][1];
  if (after < 0) return points.at(-1)[1];
  const [a, b] = points.slice(after - 1, after + 1);
  return a[1] + (b[1] - a[1]) * (t - a[0]) / Math.max(0.0001, b[0] - a[0]);
}

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function family(path) {
  if (/electric|lightning|zap/i.test(path)) return '#55d7ff';
  if (/portal|status/i.test(path)) return '#c082ff';
  if (/magic/i.test(path)) return '#76a9ff';
  if (/explosion|muzzle|impact|hit/i.test(path)) return '#ff9b47';
  return '#a9dd9a';
}

function geometryFor(THREE, spec) {
  const number = (key, fallback) => bounded(Number(spec.mesh[key] ?? fallback), 0.01, 45);
  const size = vector(spec.mesh.size, [0.5, 0.5, 0.5]);
  if (/zap\.gdshader/i.test(spec.shader) && spec.type === 'CylinderMesh') {
    const height = number('height', 2);
    const random = seeded(55 + spec.name.length);
    const points = Array.from({ length: 13 }, (_, index) => new THREE.Vector3(
      index === 0 || index === 12 ? 0 : (random() - 0.5) * height * 0.19,
      (index / 12 - 0.5) * height,
      index === 0 || index === 12 ? 0 : (random() - 0.5) * height * 0.16,
    ));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 34, number('top_radius', 0.04) * 0.38, 5, false);
  }
  if (/portal|ring|streak|ground_impact/.test(spec.shader) && ['QuadMesh', 'PlaneMesh'].includes(spec.type)) {
    const radius = Math.max(...size.slice(0, 2)) / 2;
    const ring = new THREE.RingGeometry(radius * 0.7, radius, 42);
    if (spec.type === 'PlaneMesh') ring.rotateX(-Math.PI / 2);
    return ring;
  }
  if (spec.type === 'SphereMesh') return new THREE.SphereGeometry(number('radius', 0.48), 12, 10);
  if (spec.type === 'BoxMesh') return new THREE.BoxGeometry(...size);
  if (spec.type === 'PlaneMesh') return new THREE.PlaneGeometry(size[0], size[1]).rotateX(-Math.PI / 2);
  if (spec.type === 'QuadMesh') return new THREE.PlaneGeometry(size[0], size[1]);
  if (spec.type === 'CylinderMesh') return new THREE.CylinderGeometry(number('top_radius', 0.1), number('bottom_radius', 0.13), number('height', 0.7), 9);
  if (spec.type === 'TubeTrailMesh') return new THREE.CylinderGeometry(0.015, number('radius', 0.12), 0.9, 8);
  if (spec.type === 'CapsuleMesh') return new THREE.SphereGeometry(number('radius', 0.3), 10, 8).scale(1, number('height', 1.5), 1);
  return new THREE.IcosahedronGeometry(0.13, 0);
}

function transformFor(THREE, spec) {
  const values = spec.origin;
  if (values.length !== 12) return new THREE.Matrix4().makeTranslation(...spec.position);
  return new THREE.Matrix4().set(values[0], values[3], values[6], values[9],
    values[1], values[4], values[7], values[10], values[2], values[5], values[8], values[11], 0, 0, 0, 1);
}

function coneVelocity(THREE, spec, random) {
  const axis = new THREE.Vector3(...spec.direction).normalize();
  if (!axis.lengthSq()) axis.set(1, 0, 0);
  const radians = spec.spread * Math.PI / 180;
  const y = 1 - random() * (1 - Math.cos(radians));
  const angle = random() * Math.PI * 2;
  const tangent = Math.sqrt(Math.max(0, 1 - y * y));
  const direction = new THREE.Vector3(Math.cos(angle) * tangent, y, Math.sin(angle) * tangent);
  direction.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis));
  return direction.multiplyScalar(spec.velocity[0] + random() * (spec.velocity[1] - spec.velocity[0]));
}

function sourceOffset(THREE, spec, random) {
  const source = new THREE.Vector3(...spec.offset);
  if ([1, 2, 3, 6].includes(spec.shape)) {
    const yaw = random() * 2 * Math.PI, y = random() * 2 - 1;
    const size = spec.shape === 1 ? spec.radius * Math.cbrt(random()) : spec.radius;
    const radius = Math.sqrt(1 - y * y) * size;
    if (spec.shape === 3) source.add(new THREE.Vector3(...spec.extents.map(value => (random() * 2 - 1) * value)));
    else source.add(new THREE.Vector3(Math.cos(yaw) * radius, spec.shape === 6 ? 0 : size * y, Math.sin(yaw) * radius));
  }
  return source;
}

function softEdgeMap(THREE) {
  const size = 48;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + 0.5) * 2 / size - 1, (y + 0.5) * 2 / size - 1);
    pixels.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - radius) ** 1.5)], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export async function createFxStage(target, file, signal, controls) {
  const [THREE, request] = await Promise.all([loadPreviewRuntime(), fetch(file.url, { signal })]);
  if (!request.ok) throw new Error('A cena não pôde ser aberta.');
  const document = parseFxScene(await request.text());
  const specs = extractFxLayers(document).slice(0, 40);
  if (signal.aborted) return;
  if (!specs.length) throw new Error('Esta cena não tem emissores ou malhas locais para visualizar.');
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x101824);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 220);
  const orbit = new THREE.OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  const grid = new THREE.GridHelper(40, 40, 0x405366, 0x283949);
  scene.add(grid);
  const assets = new Set();
  const soft = softEdgeMap(THREE);
  assets.add(soft);
  const bounds = new THREE.Box3();
  const layers = specs.map((spec, index) => {
    const random = seeded(index * 117 + 26);
    const base = geometryFor(THREE, spec);
    assets.add(base);
    const transform = transformFor(THREE, spec);
    base.computeBoundingBox();
    bounds.union(base.boundingBox.clone().applyMatrix4(transform));
    const parent = new THREE.Group();
    parent.matrixAutoUpdate = false;
    parent.matrix.copy(transform);
    scene.add(parent);
    const color = new THREE.Color(family(file.path));
    if (spec.color) color.setRGB(...spec.color.slice(0, 3).map(value => bounded(value, 0, 1)));
    const members = Array.from({ length: spec.amount }, (_, item) => {
      const billboard = ['PlaneMesh', 'QuadMesh'].includes(spec.type) && !/portal|ring|streak|ground_impact/.test(spec.shader);
      const material = new THREE.MeshBasicMaterial({ color, map: billboard ? soft : null, transparent: true, opacity: 0.8, depthWrite: false,
        side: THREE.DoubleSide, blending: /smoke|dust/i.test(spec.shader) ? THREE.NormalBlending : THREE.AdditiveBlending });
      assets.add(material);
      const mesh = new THREE.Mesh(base, material);
      parent.add(mesh);
      return {
        mesh, initial: sourceOffset(THREE, spec, random), velocity: coneVelocity(THREE, spec, random),
        size: spec.scales[0] + random() * (spec.scales[1] - spec.scales[0]),
        delay: spec.particle ? item / spec.amount * spec.duration * (1 - bounded(spec.burst, 0, 1)) : 0,
        turn: random() * Math.PI * 2, billboard,
      };
    });
    return { spec, members };
  });
  const center = bounds.getCenter(new THREE.Vector3());
  center.y = Math.max(0.25, center.y);
  const dimensions = bounds.getSize(new THREE.Vector3());
  const extent = bounded(Math.max(dimensions.x, dimensions.y, dimensions.z,
    ...specs.map(spec => Math.max(...spec.velocity.map(Math.abs)) * spec.duration * 0.5)), 2.3, 22);
  function recenter() {
    camera.position.copy(center).add(new THREE.Vector3(extent * 0.82, extent * 0.56, extent * 0.96));
    orbit.target.copy(center);
    orbit.update();
  }
  recenter();
  target.replaceChildren(renderer.domElement);
  const resize = new ResizeObserver(() => {
    if (!target.clientHeight || !target.clientWidth) return;
    renderer.setSize(target.clientWidth, target.clientHeight);
    camera.aspect = target.clientWidth / target.clientHeight;
    camera.updateProjectionMatrix();
  });
  resize.observe(target);
  const duration = bounded(Math.max(1.4, ...specs.map(spec => spec.duration * 1.65)), 1.4, 10);
  let time = 0;
  let playing = true;
  let frame;
  const clock = new THREE.Clock();
  controls.play.onclick = () => {
    playing = !playing;
    if (playing && time >= duration) time = 0;
    controls.play.textContent = playing ? 'Pausar' : 'Reproduzir';
  };
  controls.replay.onclick = () => { time = 0; playing = true; controls.play.textContent = 'Pausar'; };
  controls.recenter.onclick = recenter;
  const position = new THREE.Vector3();
  const update = () => {
    const delta = Math.min(clock.getDelta(), 0.05);
    if (playing) time += delta * Number(controls.speed.value);
    if (time >= duration) {
      if (controls.loop.checked) time %= duration;
      else { time = duration; playing = false; controls.play.textContent = 'Reproduzir'; }
    }
    controls.time.textContent = `${time.toFixed(2)} s`;
    for (const { spec, members } of layers) for (const item of members) {
      const elapsed = time - item.delay;
      const life = elapsed / spec.duration;
      const progress = spec.repeat && spec.particle ? life % 1 : life;
      item.mesh.visible = !spec.particle || (elapsed >= 0 && progress <= 1);
      if (!item.mesh.visible) continue;
      const age = spec.duration * bounded(progress, 0, 1);
      position.copy(item.initial).addScaledVector(item.velocity, age);
      position.x += spec.gravity[0] * age * age / 2;
      position.y += spec.gravity[1] * age * age / 2;
      position.z += spec.gravity[2] * age * age / 2;
      item.mesh.position.copy(position);
      const scale = spec.particle ? Math.max(0.02, item.size * curveAt(spec.scale, progress, 1)) : 1 + Math.sin(time * 3) * 0.035;
      item.mesh.scale.setScalar(scale);
      if (spec.type === 'QuadMesh' && !/portal/i.test(spec.shader)) item.mesh.quaternion.copy(camera.quaternion);
      else if (/portal|ring/i.test(spec.shader)) item.mesh.rotation.z = time * 0.85;
      else if (spec.particle && spec.type !== 'CylinderMesh' && spec.type !== 'PlaneMesh') item.mesh.rotation.y = item.turn + age;
      const opacity = spec.particle ? curveAt(spec.alpha, progress, 1 - Math.max(0, progress - 0.5) * 1.55) : 0.8;
      const intensity = item.billboard ? 0.72 : /glow/i.test(spec.name) ? 0.28 : 0.86;
      item.mesh.material.opacity = bounded(opacity, 0, 1) * intensity;
    }
    orbit.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(update);
  };
  signal.addEventListener('abort', () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    orbit.dispose();
    for (const asset of assets) asset.dispose();
    grid.geometry.dispose();
    grid.material.dispose();
    renderer.dispose();
  }, { once: true });
  update();
  return { particles: specs.filter(spec => spec.particle).length, meshes: specs.filter(spec => !spec.particle).length,
    shaders: new Set(specs.map(spec => spec.shader).filter(Boolean)).size, duration };
}

const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function fxWorkbench(root, entries, signal) {
  const recordings = new Map(entries.filter(file => file.category === 'FX' && file.path.endsWith('.godot.webm'))
    .map(file => [file.path.replace(/\.godot\.webm$/, '.tscn'), file]));
  const candidates = entries.filter(file => file.category === 'FX' && file.format === 'tscn' && /\/effects?\//i.test(file.path));
  const scenes = candidates.length ? candidates : entries.filter(file => file.category === 'FX' && file.format === 'tscn');
  const groups = Map.groupBy ? Map.groupBy(scenes, scene => scene.path.split('/').slice(1, 3).join(' / ')) : new Map();
  if (!groups.size) for (const scene of scenes) {
    const key = scene.path.split('/').slice(1, 3).join(' / ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(scene);
  }
  root.innerHTML = `
    <div class="animation-layout fx-layout">
      <section class="panel clip-explorer"><header class="panel-title"><h2>Cenas de efeitos</h2><span>${scenes.length}</span></header>
        <div class="panel-content"><input id="fx-search" type="search" aria-label="Buscar efeitos" placeholder="Buscar por nome…"></div>
        <div class="clip-tree" id="fx-tree"></div>
      </section>
      <section class="panel animation-stage"><header class="panel-title"><h2>Prévia de FX</h2>
        <select id="fx-mode" aria-label="Modo de prévia"><option value="capture">Renderização Godot</option><option value="orbit">Órbita 3D aproximada</option></select></header>
        <div class="preview model rig-viewport" id="fx-stage"><p class="sub">Selecione uma cena.</p></div>
        <div class="animation-transport"><strong id="fx-title">Palco de efeitos</strong>
          <div class="row"><button class="btn primary" id="fx-play">Pausar</button>
            <button class="btn" id="fx-replay">Reiniciar efeito</button><button class="btn" id="fx-recenter">Recentrar</button>
            <label><input id="fx-loop" type="checkbox" checked> Repetir</label>
            <label>Velocidade <select id="fx-speed"><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1×</option></select></label>
            <output id="fx-time">0.00 s</output>
          </div><p class="sub" id="fx-hint"></p>
        </div>
      </section>
      <aside class="panel inspector animation-info"><header class="panel-title"><h2>Metadados</h2></header>
        <div class="panel-content" id="fx-info"><p class="sub">Prévia das malhas e partículas da cena.</p></div>
      </aside>
    </div>`;
  const find = id => root.querySelector('#fx-' + id);
  const stage = find('stage'), tree = find('tree');
  let active, stageController;
  const opened = new Set([groups.keys().next().value]);
  const controls = Object.fromEntries(['play', 'replay', 'recenter', 'loop', 'speed', 'time'].map(key => [key, find(key)]));
  signal.addEventListener('abort', () => stageController?.abort(), { once: true });
  function renderTree() {
    const query = find('search').value.trim().toLowerCase();
    tree.innerHTML = [...groups].map(([key, list]) => {
      const files = list.filter(file => file.path.toLowerCase().includes(query));
      if (!files.length) return '';
      return `<details class="clip-group" data-group="${esc(key)}"${query || opened.has(key) ? ' open' : ''}><summary><strong>${esc(key.split(' / ').at(-1))}</strong><span>${files.length}</span></summary>
       ${files.map(file => `<button type="button" data-fx="${esc(file.path)}" aria-pressed="${active?.path === file.path}"><span aria-hidden="true">▷</span><span>${esc(file.name.replace(/\.tscn$/i, ''))}</span></button>`).join('')}</details>`;
    }).join('') || '<p class="sub">Nenhuma cena encontrada.</p>';
  }
  async function select(file) {
    stageController?.abort();
    stageController = new AbortController();
    const local = stageController.signal;
    active = file;
    const recording = recordings.get(file.path);
    const mode = find('mode');
    mode.options[0].disabled = !recording;
    const native = recording && mode.dataset.preferred !== 'orbit';
    mode.value = native ? 'capture' : 'orbit';
    controls.recenter.hidden = !!native;
    find('hint').textContent = native ? '' : 'Arraste para orbitar · scroll para aproximar';
    for (const button of tree.querySelectorAll('[data-fx]')) button.setAttribute('aria-pressed', String(button.dataset.fx === file.path));
    stage.innerHTML = '<p class="model-message">Carregando a cena…</p>';
    find('title').textContent = file.name.replace(/\.tscn$/i, '');
    controls.play.textContent = 'Pausar';
    find('info').innerHTML = `<code class="path">${esc(file.path)}</code><a class="btn" href="${esc(file.url)}?download=1" download>Baixar cena</a>
      <p class="sub">${native ? 'Cena renderizada no Godot com os materiais do pacote.' : 'A órbita usa uma representação simplificada dos materiais.'}</p><dl class="metadata"></dl>`;
    try {
      if (native) {
        const response = await fetch(file.url, { signal: local });
        if (!response.ok) throw new Error('A cena não pôde ser aberta.');
        const scene = parseFxScene(await response.text());
        if (local.aborted) return;
        const video = document.createElement('video');
        video.muted = video.playsInline = true;
        video.loop = controls.loop.checked;
        video.playbackRate = Number(controls.speed.value);
        video.setAttribute('aria-label', file.name);
        video.src = recording.url;
        const sync = () => {
          controls.play.textContent = video.paused ? 'Reproduzir' : 'Pausar';
          controls.time.textContent = `${video.currentTime.toFixed(2)} s`;
        };
        for (const event of ['timeupdate', 'play', 'pause', 'ended']) video.addEventListener(event, sync, { signal: local });
        const play = () => video.play().catch(sync);
        controls.play.onclick = () => {
          if (video.paused) play();
          else { video.pause(); sync(); }
        };
        controls.replay.onclick = () => { video.currentTime = 0; play(); };
        controls.loop.onchange = () => { video.loop = controls.loop.checked; };
        controls.speed.onchange = () => { video.playbackRate = Number(controls.speed.value); };
        local.addEventListener('abort', () => {
          controls.loop.onchange = controls.speed.onchange = null;
          video.pause();
          video.removeAttribute('src');
          video.load();
        }, { once: true });
        video.onerror = () => {
          if (!local.aborted) stage.textContent = 'Não foi possível abrir a captura. A órbita 3D está disponível no seletor acima.';
        };
        stage.replaceChildren(video);
        const layers = extractFxLayers(scene);
        find('info').querySelector('dl').innerHTML = `<dt>Emissores</dt><dd>${layers.filter(layer => layer.particle).length}</dd>
          <dt>Malhas</dt><dd>${layers.filter(layer => !layer.particle).length}</dd><dt>Captura</dt><dd>800 × 500 · 24 fps</dd>`;
        video.addEventListener('loadedmetadata', () => {
          find('info').querySelector('dl').insertAdjacentHTML('beforeend', `<dt>Duração</dt><dd>${video.duration.toFixed(2)} s</dd>`);
        }, { once: true, signal: local });
        sync();
        play();
        return;
      }
      const stats = await createFxStage(stage, file, local, controls);
      if (!stats || local.aborted) return;
      find('info').querySelector('dl').innerHTML = [['Emissores', stats.particles], ['Malhas', stats.meshes], ['Shaders', stats.shaders], ['Ciclo de prévia', `${stats.duration.toFixed(2)} s`]]
        .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('');
    } catch (error) {
      if (!local.aborted) stage.textContent = error.message;
    }
  }
  find('search').addEventListener('input', renderTree);
  find('mode').onchange = () => {
    find('mode').dataset.preferred = find('mode').value;
    if (active) select(active);
  };
  tree.addEventListener('toggle', event => {
    const key = event.target.dataset.group;
    if (!key || find('search').value) return;
    if (event.target.open) opened.add(key);
    else opened.delete(key);
  }, true);
  tree.addEventListener('click', event => {
    const clicked = event.target.closest('[data-fx]');
    if (clicked) select(scenes.find(file => file.path === clicked.dataset.fx));
  });
  renderTree();
  if (scenes.length) select(scenes[0]);
}
