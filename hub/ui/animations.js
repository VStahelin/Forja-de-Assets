import { showModel } from './model.js';

const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const title = value => value.replaceAll('_', ' ');
const time = seconds => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
const loading = '<span class="model-message">Carregando modelo…</span>';

export async function animationWorkbench(root, entries, signal) {
  const candidates = entries.filter(entry => entry.category === 'Animations' && entry.preview === 'model');
  const reference = candidates.find(entry => /^mannequin_f\.glb$/i.test(entry.name));
  root.innerHTML = `
    <div class="animation-layout">
      <section class="panel clip-explorer">
        <div class="panel-title"><h2>Clipes da biblioteca</h2><span class="sub" id="clip-total"></span></div>
        <div class="panel-content"><input id="clip-filter" type="search" placeholder="Buscar clipe ou GLB…" aria-label="Buscar clipes"></div>
        <div class="clip-tree" id="clip-tree"><p class="sub">Lendo clipes dos pacotes…</p></div>
      </section>
      <section class="panel animation-stage">
        <div class="panel-title"><h2>Rigs e animações</h2><span class="sub">Rig original</span></div>
        <div class="preview model rig-viewport" id="rig-viewport">${loading}</div>
        <div class="animation-transport">
          <div><strong id="clip-now">Pose de repouso</strong><p class="sub" id="clip-package">Selecione um clipe na árvore.</p></div>
          <div class="row">
            <button type="button" class="btn" id="clip-prev" aria-label="Clipe anterior" disabled>Anterior</button>
            <button type="button" class="btn primary" id="clip-play" disabled>Reproduzir</button>
            <button type="button" class="btn" id="clip-next" aria-label="Próximo clipe" disabled>Próximo</button>
            <label class="auto-next"><input type="checkbox" id="clip-auto"> Avançar automaticamente</label>
          </div>
          <div class="clip-time"><input type="range" id="clip-seek" min="0" max="1" step="0.001" value="0" aria-label="Posição do clipe" disabled><output id="clip-time">0:00.00</output></div>
        </div>
      </section>
      <aside class="panel inspector animation-info" aria-label="Metadados da animação">
        <div class="panel-title"><h2>Metadados</h2></div>
        <div class="panel-content" id="clip-info"><p class="sub">Selecione um clipe para ver a origem e a duração.</p></div>
      </aside>
    </div>`;
  const find = id => root.querySelector('#' + id);
  const viewport = find('rig-viewport');
  const tree = find('clip-tree');
  const play = find('clip-play');
  const seek = find('clip-seek');
  const auto = find('clip-auto');
  let viewer, sceneController;
  let sceneUrl, selected;
  let modelLoading;
  let groups = [], clips = [];
  let viewedClipDuration;
  let requestNumber = 0;
  const expanded = new Set();
  signal.addEventListener('abort', () => sceneController?.abort(), { once: true });

  function list() {
    const query = find('clip-filter').value.trim().toLowerCase();
    tree.innerHTML = groups.map(group => {
      const fileMatch = group.file.name.toLowerCase().includes(query);
      const visible = group.clips.filter(clip => !query || fileMatch || clip.name.toLowerCase().includes(query) || title(clip.name).toLowerCase().includes(query));
      if (!visible.length) return '';
      return `<details class="clip-group" data-group="${esc(group.file.path)}"${expanded.has(group.file.path) || query ? ' open' : ''}>
        <summary><strong title="${esc(group.file.path)}">${esc(group.file.name)}</strong><span>${visible.length}</span></summary>
        <div>${visible.map(clip => `<button type="button" data-clip="${clip.index}" aria-pressed="${selected?.index === clip.index}">
          <span aria-hidden="true">▷</span><span>${esc(title(clip.name))}</span></button>`).join('')}</div>
      </details>`;
    }).join('') || '<p class="sub">Nenhum clipe encontrado.</p>';
  }

  async function mount(file) {
    if (file.url === sceneUrl && viewer) return viewer;
    if (file.url === sceneUrl && modelLoading) return modelLoading;
    sceneController?.abort();
    sceneController = new AbortController();
    const currentSignal = sceneController.signal;
    viewer = null;
    sceneUrl = file.url;
    viewport.innerHTML = loading;
    modelLoading = showModel(viewport, file.url, currentSignal, {
      external: true,
      onTick(position, duration, running) {
        if (currentSignal.aborted) return;
        seek.max = duration;
        if (!seek.matches(':active')) seek.value = position;
        find('clip-time').textContent = `${time(position)} / ${time(duration)}`;
        play.textContent = running ? 'Pausar' : 'Reproduzir';
        if (viewedClipDuration !== duration) {
          viewedClipDuration = duration;
          const field = find('clip-duration');
          if (field) field.textContent = time(duration);
        }
      },
      onFinish() { if (auto.checked) chooseRelative(1, true); },
    }).then(instance => {
      if (currentSignal.aborted) return null;
      viewer = instance;
      return viewer;
    }).finally(() => { if (!currentSignal.aborted) modelLoading = null; });
    return modelLoading;
  }

  function metadata(clip, model) {
    const rows = [
      ['Arquivo', clip.file.name], ['Clipe', clip.name], ['Duração', '—'],
      ['Modelo', model], ['Movimento de raiz', /(?:^|_)RM\./i.test(clip.file.name) ? 'Incluído' : 'Sem variante RM'],
    ];
    find('clip-info').innerHTML = `<dl class="metadata">
      ${rows.map(([label, value]) => `<dt>${esc(label)}</dt><dd${label === 'Duração' ? ' id="clip-duration"' : ''}>${esc(value)}</dd>`).join('')}
      </dl><code class="path">${esc(clip.file.path)}</code><a class="btn" href="${esc(clip.file.url)}?download=1" download>Baixar pacote</a>`;
  }

  async function choose(clip) {
    if (!clip || signal.aborted) return;
    selected = clip;
    const request = ++requestNumber;
    expanded.add(clip.file.path);
    const group = tree.querySelector(`details[data-group="${CSS.escape(clip.file.path)}"]`);
    if (group) group.open = true;
    tree.querySelectorAll('[data-clip]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.clip) === clip.index)));
    find('clip-now').textContent = title(clip.name);
    find('clip-package').textContent = clip.file.name;
    find('clip-prev').disabled = clip.index === 0;
    find('clip-next').disabled = clip.index + 1 === clips.length;
    seek.disabled = play.disabled = true;
    viewedClipDuration = undefined;
    try {
      const instance = await mount(clip.file);
      if (request !== requestNumber || !instance || signal.aborted) return;
      if (!instance.select(clip.name, auto.checked)) throw new Error('Este clipe não foi encontrado no modelo.');
      metadata(clip, 'Rig original do pacote');
      seek.disabled = play.disabled = false;
    } catch (error) {
      if (request === requestNumber && !signal.aborted) find('clip-package').textContent = error.message;
    }
  }

  function chooseRelative(direction, wrap = false) {
    const index = selected ? selected.index + direction : 0;
    const next = wrap ? (index + clips.length) % clips.length : index;
    if (clips[next]) choose(clips[next]);
  }

  find('clip-filter').addEventListener('input', list);
  tree.addEventListener('toggle', event => {
    const path = event.target.dataset.group;
    if (!path || find('clip-filter').value.trim()) return;
    if (event.target.open) expanded.add(path);
    else expanded.delete(path);
  }, true);
  tree.addEventListener('click', event => {
    const button = event.target.closest('[data-clip]');
    if (button) choose(clips[Number(button.dataset.clip)]);
  });
  find('clip-prev').onclick = () => chooseRelative(-1);
  find('clip-next').onclick = () => chooseRelative(1);
  play.onclick = () => viewer?.toggle();
  seek.oninput = () => viewer?.seek(Number(seek.value));
  auto.onchange = () => viewer?.setLoop(auto.checked);
  if (reference) mount(reference).catch(error => { if (!signal.aborted) viewport.textContent = error.message; });
  else viewport.textContent = 'Selecione um clipe para abrir o rig do pacote.';

  groups = (await Promise.all(candidates.map(async file => {
    const result = await fetch('/api/metadata?' + new URLSearchParams({ path: file.path }), { signal });
    if (!result.ok) return null;
    const info = await result.json();
    return info.clips?.length ? { file, names: info.clips } : null;
  }))).filter(Boolean);
  if (signal.aborted) return;
  for (const group of groups) {
    group.clips = group.names.map(name => {
      const clip = { file: group.file, name, index: clips.length };
      clips.push(clip);
      return clip;
    });
  }
  if (groups.length) expanded.add(groups[0].file.path);
  if (!reference && groups.length && !selected) mount(groups[0].file).catch(error => { if (!signal.aborted) viewport.textContent = error.message; });
  find('clip-total').textContent = `${clips.length} clipes`;
  find('clip-next').disabled = !clips.length;
  list();
}
