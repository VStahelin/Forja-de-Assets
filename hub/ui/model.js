function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () => reject(new Error('O visualizador 3D não carregou.'));
    document.head.append(script);
  });
}

let dependencies;

async function openGltf(THREE, url, signal) {
  const base = new URL(url, location.origin);
  const directory = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(value => {
    if (/^(data|blob):/.test(value)) return value;
    const resource = new URL(value, base);
    if (resource.origin !== base.origin || !resource.pathname.startsWith(directory)) return 'data:application/octet-stream,';
    return resource.href;
  });
  const response = await fetch(base, { signal });
  if (!response.ok) throw new Error('Não foi possível abrir o modelo.');
  const contents = await response.arrayBuffer();
  const loader = new THREE.GLTFLoader(manager);
  return new Promise((resolve, reject) => loader.parse(contents, location.origin + directory, resolve, reject));
}

function loadDependencies() {
  dependencies ??= loadScript('/vendor/three.min.js')
    .then(() => Promise.all([loadScript('/vendor/OrbitControls.js'), loadScript('/vendor/GLTFLoader.js')]));
  return dependencies;
}

export async function loadPreviewRuntime() {
  await loadDependencies();
  return window.THREE;
}

let bbDependencies;
async function openModel(THREE, url, signal, onTime, thumbnail = false) {
  const base = new URL(url, location.origin);
  if (!base.pathname.toLowerCase().endsWith('.bbmodel')) return openGltf(THREE, url, signal);
  bbDependencies ??= Promise.all([
    loadScript('/vendor/bbmodel_parser.js'), loadScript('/vendor/animation_player.js'), loadScript('/vendor/asset_loader.js'),
  ]);
  await bbDependencies;
  const response = await fetch(base, { signal });
  if (!response.ok) throw new Error('Não foi possível abrir o BBModel.');
  const modelData = await response.json();
  const directory = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1);
  for (const texture of modelData.textures || []) {
    if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(texture.source || '')) delete texture.source;
    const path = texture.relative_path || texture.name || 'texture.png';
    const resource = new URL(path, base);
    texture.relative_path = resource.origin === base.origin && resource.pathname.startsWith(directory) ? resource.href : null;
  }
  if (thumbnail) modelData.animations = [];
  const asset = await window.loadAssetObject({ kind: 'bbmodel', modelData }, { onTime });
  return { scene: asset.object, animations: [], legacy: asset };
}

function discard(model) {
  model.traverse(node => {
    node.geometry?.dispose();
    for (const material of [node.material].flat().filter(Boolean)) {
      for (const option of Object.values(material)) {
        if (option?.isTexture) option.dispose();
      }
      material.dispose();
    }
  });
}

function lightScene(THREE, scene) {
  scene.add(new THREE.HemisphereLight(0xe6f0ff, 0x6e6e73, 1.5));
  const key = new THREE.DirectionalLight(0xffefd8, 1.7);
  key.position.set(3, 7, 5);
  scene.add(key);
}

export async function showModel(container, url, signal, { external = false, onTick, onFinish } = {}) {
  await loadDependencies();
  if (signal.aborted) return;
  const THREE = window.THREE;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x10151c);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.01, 1000);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  lightScene(THREE, scene);
  const status = container.querySelector('.model-message');
  let mixer, active, frame, action, legacy;
  const resize = new ResizeObserver(() => {
    if (signal.aborted || !container.clientWidth || !container.clientHeight) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
  signal.addEventListener('abort', () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    controls.dispose();
    mixer?.stopAllAction();
    legacy?.dispose();
    if (active && !legacy) discard(active);
    renderer.dispose();
  }, { once: true });
  const gltf = await openModel(THREE, url, signal, () => {
    if (legacy?.clips.clip) onTick?.(legacy.clips.time, legacy.clips.length, legacy.clips.playing);
  });
  legacy = gltf.legacy;
  if (signal.aborted) {
    if (legacy) legacy.dispose();
    else discard(gltf.scene);
    return;
  }
  const clips = gltf.animations;
  const rawBounds = new THREE.Box3().setFromObject(gltf.scene);
  if (rawBounds.isEmpty()) throw new Error('O modelo não contém geometria visível.');
  const center = rawBounds.getCenter(new THREE.Vector3());
  const size = rawBounds.getSize(new THREE.Vector3()).length();
  const group = new THREE.Group();
  group.add(gltf.scene);
  group.position.copy(center).multiplyScalar(-1);
  scene.add(group);
  active = group;
  const grid = new THREE.GridHelper(size * 2, 12, 0x475667, 0x252e3a);
  group.add(grid);
  grid.position.set(center.x, rawBounds.min.y, center.z);
  const setCamera = () => {
    camera.position.set(size * 0.9, size * 0.65, size * 1.15);
    camera.near = size / 1000;
    camera.far = size * 50;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
  };
  setCamera();
  status?.remove();
  container.append(renderer.domElement);
  resize.observe(container);
  const toolbar = document.createElement('div');
  toolbar.className = 'preview-tools';
  const reset = document.createElement('button');
  reset.className = 'btn';
  reset.type = 'button';
  reset.textContent = 'Recentrar';
  reset.onclick = setCamera;
  toolbar.append(reset);
  mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.addEventListener('finished', onFinish || (() => {}));
  const controller = {
    select(name, once) {
      if (legacy) {
        if (!legacy.clips.names.includes(name)) return false;
        legacy.clips.select(name);
        legacy.clips.play();
        return true;
      }
      const clip = clips.find(clip => clip.name === name);
      if (!clip) return false;
      mixer.stopAllAction();
      action = mixer.clipAction(clip).reset();
      controller.setLoop(once);
      action.play();
      return true;
    },
    setLoop(once) {
      if (!action) return;
      action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      action.clampWhenFinished = once;
    },
    toggle() {
      if (!action) return;
      if (action.paused && action.time >= action.getClip().duration - 0.005) action.reset();
      else action.paused = !action.paused;
    },
    seek(time) {
      if (!action) return;
      action.time = Math.min(time, Math.max(0, action.getClip().duration - 0.001));
      mixer.update(0);
    },
  };
  if (!external && clips.length) {
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Animação');
    select.add(new Option('Sem animação', ''));
    clips.forEach((clip, index) => select.add(new Option(clip.name || `Clipe ${index + 1}`, String(index))));
    select.onchange = () => {
      mixer.stopAllAction();
      if (select.value !== '') mixer.clipAction(clips[Number(select.value)]).reset().play();
    };
    toolbar.append(select);
  }
  container.append(toolbar);
  const clock = new THREE.Clock();
  function animate() {
    frame = requestAnimationFrame(animate);
    mixer?.update(clock.getDelta());
    if (action) onTick?.(action.time, action.getClip().duration, !action.paused);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
  return controller;
}

let thumbRenderer;
let thumbQueue = Promise.resolve();
const thumbnailCache = new Map();

export function modelThumbnail(url, signal) {
  if (thumbnailCache.has(url)) return Promise.resolve(thumbnailCache.get(url));
  const task = thumbQueue.then(async () => {
    if (signal.aborted) return;
    if (thumbnailCache.has(url)) return thumbnailCache.get(url);
    await loadDependencies();
    const THREE = window.THREE;
    const { scene: model, legacy } = await openModel(THREE, url, signal, null, true);
    try {
      if (signal.aborted) return;
      const bounds = new THREE.Box3().setFromObject(model);
      if (bounds.isEmpty()) return;
      const size = bounds.getSize(new THREE.Vector3()).length();
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.sub(center);
      const scene = new THREE.Scene();
      lightScene(THREE, scene);
      scene.add(model);
      const camera = new THREE.PerspectiveCamera(36, 4 / 3, size / 1000, size * 25);
      camera.position.set(size * 0.82, size * 0.47, size * 1.03);
      camera.lookAt(0, 0, 0);
      if (!thumbRenderer) {
        thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        thumbRenderer.setSize(192, 144);
        thumbRenderer.setClearAlpha(0);
      }
      thumbRenderer.render(scene, camera);
      const image = thumbRenderer.domElement.toDataURL('image/png');
      if (thumbnailCache.size >= 120) thumbnailCache.delete(thumbnailCache.keys().next().value);
      thumbnailCache.set(url, image);
      return image;
    } finally {
      if (legacy) legacy.dispose();
      else discard(model);
    }
  });
  thumbQueue = task.catch(() => {});
  return task;
}
