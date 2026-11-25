const main = document.querySelector('#main');
const sidebar = document.querySelector('#sidebar');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const audio = document.querySelector('#audio');
const transport = document.querySelector('#transport');
const names = { Textures: 'Texturas', Models: 'Modelos 3D', Animations: 'Rigs e animações', Masks: 'Máscaras', Smokes: 'Fumaça', Sounds: 'Sons', Voices: 'Vozes', VFX: 'VFX', FX: 'FX', Text: 'Textos', Other: 'Outros', '@generated': 'Gerados' };
const labelOf = category => names[category] || category;
const icons = {
  forge: 'M12 2 3 7v10l9 5 9-5V7L12 2Zm0 10L3 7m9 5 9-5m-9 5v10m-4-8 4 2 4-2',
  library: 'M4 5h4v15H4zm6 0h4v15h-4zM17 5l4 14-4 1-3-14z',
  image: 'M4 4h16v16H4zm0 13 5-5 4 4 3-3 4 4m-5-8h.01',
  box: 'M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 9 8-5M4 7l8 5v9',
  play: 'm9 5 11 7-11 7z',
  pause: 'M9 5v14m6-14v14',
  mask: 'M3 5c5 2 13 2 18 0v7c-1 5-4 7-9 8-5-1-8-3-9-8V5Zm3 6h4m4 0h4',
  smoke: 'M6 19a4 4 0 0 1 0-8 6 6 0 0 1 11-3 5 5 0 0 1 1 10H7',
  sound: 'M3 10v4h4l5 4V6l-5 4H3Zm13-1a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12',
  file: 'M5 3h10l4 4v14H5V3Zm9 0v5h5m-11 5h8m-8 4h8',
  search: 'M15.4 15.4 21 21m-4-10A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z',
  grid: 'M4 4h6v6H4zm10 0h6v6h-6zm0 10h6v6h-6zm-10 0h6v6H4z',
  list: 'M8 5h12M8 12h12M8 19h12M4 5h.01M4 12h.01M4 19h.01',
  plus: 'M12 5v14M5 12h14',
  import: 'M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4',
  close: 'm6 6 12 12m0-12L6 18',
  refresh: 'M20 9a8 8 0 0 0-14-3L3 9m0-5v5h5m-4 6a8 8 0 0 0 14 3l3-3m0 5v-5h-5',
  arrow: 'm9 6 6 6-6 6',
  folder: 'M3 6h7l2 2h9v11H3z',
  copy: 'M8 8h12v12H8zm8-4H4v12',
};
const typeIcons = { Textures: 'image', Models: 'box', Animations: 'play', Masks: 'mask', Smokes: 'smoke', Sounds: 'sound', Voices: 'sound', VFX: 'play', FX: 'play', Other: 'file' };
const categoryDescriptions = {
  Textures: 'Mapas de superfície e imagens tileáveis.',
  Models: 'Malhas e seus formatos de entrega. Selecione um GLB ou glTF para orbitar o modelo.',
  Animations: 'Modelos animados e bibliotecas de clipes. Escolha um clipe na prévia 3D.',
  Masks: 'Máscaras de luz e transparência. Alterne o fundo da prévia para conferir a silhueta e o alfa.',
  Smokes: 'Partículas de fumaça e sequências de quadros.',
  Sounds: 'Efeitos sonoros organizados por pasta. Use o botão de reprodução de qualquer faixa.',
  Voices: 'Gravações de voz organizadas por situação. Use o botão de reprodução de qualquer faixa.',
  VFX: 'Efeitos visuais e atlas de partículas. Selecione um atlas para reproduzir seus quadros.',
  FX: 'Efeitos, cenas e materiais Godot. Veja os recursos e suas dependências nos metadados.',
  Text: 'Arquivos de texto e dados legíveis no painel de metadados.',
  '@generated': 'Saídas das duas forjas reunidas por projeto.',
};
const state = {
  screen: ['2d', '3d'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'library',
  entries: [], categories: [], work: { projects: [], two: [], three: [], origins: {} },
  category: localStorage.getItem('forge-category') || '', origin: '', pack: '', search: '', layout: 'grid', file: '', playing: '', auxiliary: false,
  modelDetail: '', modelPreview: '',
};
const pageSize = 30;
let toastTimer;
let inspectorController;
let effectThumbnails;
let animationController;
let galleryObserver;

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}
const svg = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]}"/></svg>`;
const option = (value, label, selected) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;
const action = (label, id, icon, style = '') => `<button type="button" class="btn ${style}" data-action="${id}"${style.includes('icon-only') ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}>${icon ? svg(icon) : ''}${style.includes('icon-only') ? '' : esc(label)}</button>`;
const number = value => value.toLocaleString('pt-BR');

function announce(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 4600);
}

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Falha na operação (${response.status}).`);
  return data;
}

const post = (path, data) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
async function refresh() {
  const [library, work] = await Promise.all([api('/api/library'), api('/api/workbench')]);
  state.entries = library.entries;
  state.categories = library.categories;
  state.work = work;
}

function navButton(label, icon, screen) {
  return `<button type="button" data-screen="${screen}" aria-label="${label}" title="${label}"${screen === state.screen ? ' aria-current="page"' : ''}>${svg(icon)}<span>${label}</span></button>`;
}

function renderSidebar() {
  const mark = state.entries.find(entry => entry.project === 'forge-assets' && entry.engine === '2d' && entry.name === 'forge-mark.png');
  sidebar.innerHTML = `
    <div class="brand" title="Forja de Assets" aria-label="Forja de Assets"><span class="brand-mark">${mark ? `<img src="${esc(mark.url)}" alt="">` : svg('forge')}</span></div>
    <nav class="nav" aria-label="Áreas">
      ${navButton('Biblioteca', 'library', 'library')}
      ${navButton('Forja 2D', 'image', '2d')}
      ${navButton('Forja 3D', 'box', '3d')}
    </nav>`;
}

function render() {
  renderSidebar();
  if (state.screen === 'library') renderLibrary();
  else {
    inspectorController?.abort();
    effectThumbnails?.abort();
    animationController?.abort();
      galleryObserver?.disconnect();
    renderWorkbench();
  }
}

function renderLibrary() {
  animationController?.abort();
  main.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1>Biblioteca de assets</h1><p class="sub">Acervo compartilhado e arquivos gerados por projeto.</p></div>
        <div class="actions">${action('Atualizar biblioteca', 'refresh', 'refresh', 'icon-only')}${action('Importar', 'import', 'import', 'primary')}</div>
      </div>
      <nav class="tabs" aria-label="Tipos de asset">
        ${['', ...state.categories, '@generated'].map(category =>
          `<button type="button" data-category="${esc(category)}"${state.category === category ? ' aria-current="page"' : ''}>
          ${svg(typeIcons[category] || (category ? 'folder' : 'grid'))}${esc(category ? labelOf(category) : 'Todos')}</button>`).join('')}
      </nav>
      ${state.modelDetail && state.category === 'Models' ? '<div id="model-detail"></div>' :
      ['Animations', 'FX'].includes(state.category) && !state.auxiliary ? `
      <div id="animation-workbench"></div>
      <div class="files-toggle"><label><input type="checkbox" id="auxiliary"> Mostrar arquivos do pacote</label></div>` : `
      <div class="library-layout">
      <div class="library-results">
      ${state.category && categoryDescriptions[state.category] ? `<p class="category-description">${esc(categoryDescriptions[state.category])}</p>` : ''}
      <div class="toolbar">
        <label class="search">${svg('search')}<input id="search" type="search" placeholder="Buscar assets, pastas e formatos…" aria-label="Buscar assets" value="${esc(state.search)}"></label>
        <select id="origin" aria-label="Origem">${option('', 'Todas as origens', state.origin)}${option('imported', 'Importados', state.origin)}
          ${state.work.projects.map(name => option(name, name, state.origin)).join('')}</select>
        <select id="pack" aria-label="Pasta"></select>
        <span class="spacer"></span>
        ${['Sounds', 'Voices'].includes(state.category) ? '' : ['grid', 'list'].map(layout => `<button type="button" class="btn icon-only" data-layout="${layout}" aria-pressed="${state.layout === layout}" aria-label="${layout === 'grid' ? 'Grade' : 'Lista'}">${svg(layout)}</button>`).join('')}
      </div>
      <div class="files-toggle"><label><input type="checkbox" id="auxiliary"${state.auxiliary ? ' checked' : ''}> ${state.category === 'Animations' ? 'Mostrar arquivos do pacote' : 'Mostrar arquivos auxiliares'}</label></div>
      <div id="gallery"></div>
      </div>
      <aside id="inspector" class="inspector panel" aria-label="Metadados do asset"></aside>
      </div>`}
    </div>`;
  if (state.modelDetail && state.category === 'Models') {
    effectThumbnails?.abort();
    galleryObserver?.disconnect();
    inspectorController?.abort();
    renderModelDetail();
  } else if (['Animations', 'FX'].includes(state.category) && !state.auxiliary) {
    inspectorController?.abort();
    effectThumbnails?.abort();
    galleryObserver?.disconnect();
    animationController = new AbortController();
    const signal = animationController.signal;
    const target = document.querySelector('#animation-workbench');
    const animations = state.category === 'Animations';
    import(animations ? '/animations.js' : '/media-tools.js').then(module => {
      if (!signal.aborted) return (animations ? module.animationWorkbench : module.fxWorkbench)(target, state.entries, signal);
    }).catch(error => {
      if (!signal.aborted) {
        target.textContent = 'Não foi possível carregar esta prévia. Atualize a página para tentar de novo.';
        console.error(error);
      }
    });
  } else renderGallery();
}

function renderModelDetail() {
  const holder = document.querySelector('#model-detail');
  const file = state.entries.find(item => item.path === state.modelDetail);
  const model = file && compatibleModel(file);
  const origin = state.work.origins['3d'];
  if (!model || !origin) {
    state.modelDetail = '';
    renderLibrary();
    return;
  }
  const url = new URL(origin);
  url.searchParams.set('embed', '1');
  url.searchParams.set('detail', '1');
  const nativeProject = model.project && state.work.three.find(project => project.id === model.project);
  const relative = model.path.split('/').slice(4).join('/');
  const asset = nativeProject?.assets.find(item => item.model_path === relative);
  if (asset || (nativeProject && model.format === 'glb')) {
    url.searchParams.set('project', nativeProject.id);
    url.searchParams.set(asset ? 'asset' : 'glb', asset ? asset.id : relative.replace(/^assets\//, ''));
  } else {
    const source = new URL(model.url, location.origin).href;
    url.searchParams.set('library', '1');
    url.searchParams.set(model.format === 'bbmodel' ? 'model' : 'glb', source);
  }
  holder.innerHTML = `
    <div class="model-heading">${action('Voltar à galeria', 'model-back')}<h2>${esc(file.name)}</h2>
      <div class="actions model-download">
        <a href="${esc(file.url)}?download=1" download class="btn">Baixar</a>
        ${!file.project ? `<button class="btn" data-move="${esc(file.path)}">Mover ou renomear</button>` : ''}
      </div>
    </div>
    <iframe class="model-native-frame" src="${esc(url.href)}" title="Detalhes do modelo na Forja 3D"></iframe>`;
}

function assetCard(asset, inLibrary = false) {
  const parent = asset.path.split('/').slice(asset.project ? 5 : 1, -1).join('/');
  const subtitle = asset.project ? `${asset.project} · ${asset.engine.toUpperCase()}` : parent || labelOf(asset.category);
  const model = inLibrary && state.category === 'Models' ? compatibleModel(asset) : null;
  const name = asset.project && asset.name === 'model.bbmodel' ? asset.path.split('/')[5] : asset.name;
  return `<button type="button" class="asset" data-file="${esc(asset.path)}" title="${esc(asset.name)}"${inLibrary ? ` aria-pressed="${state.file === asset.path}"` : ''}>
     <div class="thumb"${model ? ` data-model-thumb="${esc(model.url)}"` : ''}>${asset.preview === 'image' ? `<img alt="" loading="lazy" src="${esc(asset.url)}">`
       : asset.preview === 'tga' && inLibrary ? `<canvas data-sheet="${esc(asset.path)}" aria-hidden="true"></canvas>` : svg(typeIcons[asset.category] || 'file')}
       <span class="format">${esc(asset.format ? asset.format.toUpperCase() : 'ARQUIVO')}</span>
     </div>
     <div class="asset-info"><strong>${esc(name)}</strong><small title="${esc(subtitle)}">${esc(subtitle)}</small></div>
   </button>`;
}

function audioRow(file) {
  const parts = file.path.split('/');
  const subtitle = parts.slice(1, -1).join(' / ') || labelOf(file.category);
  const playing = state.playing === file.path && !audio.paused;
  return `<div class="audio-row${state.file === file.path ? ' selected' : ''}">
    ${file.preview === 'audio' ? `<button class="btn audio-play icon-only" type="button" aria-label="${playing ? 'Pausar' : 'Reproduzir'} ${esc(file.name)}" data-play="${esc(file.path)}">${svg(playing ? 'pause' : 'play')}</button>`
      : `<span class="file-icon">${svg('file')}</span>`}
    <button class="audio-name" type="button" data-file="${esc(file.path)}" aria-pressed="${state.file === file.path}">
      <strong>${esc(file.name)}</strong><small>${esc(subtitle)}</small>
    </button>
    <span class="row-format">${esc(file.format.toUpperCase())}</span>
  </div>`;
}

const folder = asset => {
  const parts = asset.path.split('/');
  const parent = parts.slice(0, asset.project ? 6 : 2);
  if (parts.length <= parent.length) parent.pop();
  return parent.join('/');
};

function primaryAsset(file) {
  if (file.category === 'Models') return modelFormats.has(file.format);
  if (file.category === 'Animations') return file.preview === 'model';
  if (['Sounds', 'Voices'].includes(file.category)) return file.preview === 'audio';
  if (file.category === 'FX' && ['tscn', 'tres', 'gdshader', 'gdshaderinc', 'anim', 'glb', 'gltf'].includes(file.format)) return true;
  if (['Textures', 'Masks', 'Smokes', 'VFX', 'FX'].includes(file.category)) {
    return ['image', 'tga'].includes(file.preview) && !/^(preview|sample)(?:[ ._(]|$)/i.test(file.name);
  }
  if (/\.(bak|blend1|url|html)$/i.test(file.name)) return false;
  if (file.project && file.format === 'json') return false;
  return true;
}
const modelFormats = new Set(['glb', 'gltf', 'obj', 'fbx', 'blend', 'bbmodel', 'stl', 'dae', 'usd', 'usdz']);

function renderGallery() {
  galleryObserver?.disconnect();
  effectThumbnails?.abort();
  effectThumbnails = new AbortController();
  const thumbSignal = effectThumbnails.signal;
  const chosen = state.entries.filter(asset => (state.auxiliary || primaryAsset(asset))
    && (!state.category || (state.category === '@generated' ? asset.project : asset.category === state.category))
    && (!state.origin || (state.origin === 'imported' ? !asset.project : asset.project === state.origin)));
  const packs = [...new Set(chosen.map(folder))].sort((a, b) => a.localeCompare(b));
  if (!packs.includes(state.pack)) state.pack = '';
  document.querySelector('#pack').innerHTML = option('', 'Todas as pastas', state.pack) + packs.map(path => option(path, path.split('/').at(-1), state.pack)).join('');
  const query = state.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let matches = chosen.filter(asset => (!state.pack || folder(asset) === state.pack)
    && query.every(term => `${asset.path} ${labelOf(asset.category)}`.toLowerCase().includes(term)));
  if (!state.search && !state.category && !state.origin && !state.pack) {
    const priority = asset => asset.preview === 'image' ? 0 : asset.preview ? 1 : 2;
    matches.sort((a, b) => priority(a) - priority(b));
    const firstByFolder = new Map();
    for (const asset of matches) {
      if (asset.preview === 'image' && !firstByFolder.has(folder(asset))) firstByFolder.set(folder(asset), asset);
    }
    const featured = new Set(firstByFolder.values());
    matches.sort((a, b) => Number(featured.has(b)) - Number(featured.has(a)));
  }
  if (['Models', 'Animations'].includes(state.category)) {
    const rank = file => file.preview === 'model' ? 0 : file.preview === 'image' ? 1 : 2;
    matches.sort((a, b) => rank(a) - rank(b));
  }
  if (['VFX', 'FX'].includes(state.category)) matches.sort((a, b) => Number(Boolean(b.columns)) - Number(Boolean(a.columns)));
  if (state.category === 'Models' && !state.auxiliary && !query.length) {
    const distinct = new Set();
    matches = matches.filter(file => {
      const preferred = compatibleModel(file);
      if (!preferred || distinct.has(preferred.path)) return false;
      distinct.add(preferred.path);
      return true;
    });
  }
  if (!matches.some(file => file.path === state.file)) state.file = matches[0]?.path || '';
  const audioList = ['Sounds', 'Voices'].includes(state.category);
  const gallery = document.querySelector('#gallery');
  gallery.innerHTML = `
    <div class="result-head"><span>${number(matches.length)} ${matches.length === 1 ? 'arquivo' : 'arquivos'}</span>
      ${state.pack && !state.pack.startsWith('generated/') && state.pack.includes('/') ? action('Mover pasta', 'move-pack', 'folder') : ''}
    </div>
    ${matches.length ? `<div class="${audioList ? 'audio-list' : state.layout}" id="gallery-items"></div>`
      : '<div class="empty">Nenhum arquivo encontrado para estes filtros.</div>'}
    ${matches.length ? '<div class="gallery-end" id="gallery-end" role="status"></div>' : ''}`;
  if (matches.length) {
    const status = gallery.querySelector('#gallery-end');
    const holder = gallery.querySelector('#gallery-items');
    const byPath = new Map(matches.map(item => [item.path, item]));
    const thumbObserver = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        thumbObserver.unobserve(target);
        if (target.dataset.sheet) {
          import('/media-tools.js').then(({ drawContactSheet }) => drawContactSheet(target, byPath.get(target.dataset.sheet), thumbSignal)).catch(() => {});
        } else {
          import('/model.js').then(({ modelThumbnail }) => modelThumbnail(target.dataset.modelThumb, thumbSignal)).then(url => {
            if (!url || thumbSignal.aborted) return;
            const image = new Image();
            image.alt = '';
            image.src = url;
            target.querySelector('.icon')?.replaceWith(image);
          }).catch(() => {});
        }
      }
    }, { rootMargin: '145px' });
    thumbSignal.addEventListener('abort', () => thumbObserver.disconnect(), { once: true });
    let offset = 0;
    const more = () => {
      const batch = matches.slice(offset, offset + pageSize);
      const previous = holder.lastElementChild;
      holder.insertAdjacentHTML('beforeend', batch.map(asset => audioList ? audioRow(asset) : assetCard(asset, true)).join(''));
      let card = previous ? previous.nextElementSibling : holder.firstElementChild;
      for (; card; card = card.nextElementSibling) {
        const thumbnail = card.querySelector('[data-sheet], [data-model-thumb]');
        if (thumbnail) thumbObserver.observe(thumbnail);
      }
      offset += batch.length;
      status.textContent = `${number(offset)} de ${number(matches.length)} arquivos`;
      if (offset >= matches.length) galleryObserver?.disconnect();
    };
    more();
    if (offset < matches.length) {
      galleryObserver = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) more();
      }, { rootMargin: '450px' });
      galleryObserver.observe(status);
    }
  }
  renderInspector();
}

function humanSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function mediaTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${Math.round(seconds % 60)}s` : `${seconds.toFixed(2)} s`;
}

function compatibleModel(file) {
  if (file.preview === 'model' || file.format === 'bbmodel') return file;
  if (!['fbx', 'obj', 'blend', 'gltf'].includes(file.format)) return null;
  const stem = file.name.replace(/\.[^.]+$/, '').toLowerCase();
  if (file.category === 'Models' && stem === 'humanoid') {
    return state.entries.find(item => item.name === 'humanoid-low-poly.glb' && item.project === 'forge-assets');
  }
  return state.entries.find(item => item.preview === 'model' && folder(item) === folder(file)
    && item.name.replace(/\.[^.]+$/, '').toLowerCase() === stem);
}

function framesFor(file) {
  if (file.category !== 'Smokes') return [];
  const frame = /^(.*?)(\d{2,3})\.png$/i.exec(file.path);
  if (!frame) return [];
  const sequence = state.entries.filter(item => /^(.*?)(\d{2,3})\.png$/i.exec(item.path)?.[1] === frame[1])
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return sequence.length <= 100 ? sequence : [];
}

function renderInspector() {
  inspectorController?.abort();
  inspectorController = new AbortController();
  const signal = inspectorController.signal;
  const inspector = document.querySelector('#inspector');
  const file = state.entries.find(entry => entry.path === state.file);
  if (!inspector) return;
  if (!file) {
    inspector.innerHTML = '<header class="panel-title"><h2>Metadados</h2></header><p class="panel-content sub">Selecione um arquivo para ver os detalhes.</p>';
    return;
  }
  const model = compatibleModel(file);
  const autoModel = model && state.category === 'Models' && state.modelPreview === file.path;
  const sequence = framesFor(file);
  const effect = file.columns || sequence.length > 1 || file.preview === 'tga';
  const stem = file.name.replace(/\.[^.]+$/, '');
  const candidateSpeaker = file.category === 'Voices' && /^.+?_\d+_([\w-]+)$/.exec(stem)?.[1];
  const rows = [['Tipo', labelOf(file.category)], ['Formato', file.format.toUpperCase() || '—'], ['Tamanho', humanSize(file.size)],
    ['Origem', file.project ? `${file.project} · ${file.engine.toUpperCase()}` : 'Acervo compartilhado']];
  if (candidateSpeaker) rows.push(['Voz', candidateSpeaker]);
  if (file.columns) rows.push(['Atlas', `${file.columns} × ${file.rows} · ${file.columns * file.rows} quadros`]);
  if (sequence.length > 1) rows.push(['Sequência', `${sequence.length} quadros`]);
  const row = ([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`;
  inspector.innerHTML = `<header class="panel-title"><h2>Metadados</h2></header><div class="panel-content">
    <div class="inspector-name">${esc(file.name)}</div>
    ${effect ? '<div class="preview sample" id="sample-preview"><p class="sub">Carregando prévia…</p></div>'
      : file.preview === 'image' ? `<div class="preview sample" id="sample-preview"><img src="${esc(file.url)}" alt="${esc(file.name)}"></div>
        ${file.category === 'Textures' ? action('Repetir textura', 'tile') : file.category === 'Masks' ? action('Alternar fundo', 'mask-bg') : ''}`
      : file.preview === 'audio' ? `<div class="preview waveform" id="sample-preview"><canvas width="320" height="70" aria-label="Forma de onda"></canvas></div>
        <button class="btn primary" data-play="${esc(file.path)}">${svg('play')} Ouvir</button>`
      : model ? `<div class="preview sample placeholder${autoModel ? ' model' : ''}" id="sample-preview">${autoModel ? '<span class="model-message">Carregando modelo…</span>' : svg('box')}</div>
        ${state.category === 'Models' ? action('Ver detalhes', 'model-open', null, 'primary') : `<button class="btn" data-model="${esc(model.path)}">Carregar prévia 3D</button>`}`
      : file.preview === 'text' ? '<pre class="text-preview" id="sample-preview">Carregando texto…</pre>'
      : ''}
    <dl id="metadata" class="metadata">${rows.map(row).join('')}</dl>
    <code class="path" id="inspector-path">${esc(file.path)}</code>
    <div class="actions"><a class="btn" href="${esc(file.url)}?download=1" download>Baixar</a>
      ${action('Copiar caminho', 'copy-library', 'copy', 'icon-only')}
      ${!file.project ? `<button class="btn" data-move="${esc(file.path)}">Mover ou renomear</button>` : ''}
    </div></div>`;
  const target = inspector.querySelector('#sample-preview');
  const data = inspector.querySelector('#metadata');
  api('/api/metadata?' + new URLSearchParams({ path: file.path }), { signal }).then(info => {
    if (signal.aborted) return;
    const extra = [];
    const image = target?.querySelector('img');
    if (info.width && info.height) extra.push(['Dimensões', `${info.width} × ${info.height} px`]);
    else if (image) {
      const recordSize = () => {
        if (!signal.aborted && image.naturalWidth) data.insertAdjacentHTML('beforeend', row(['Dimensões', `${image.naturalWidth} × ${image.naturalHeight} px`]));
      };
      if (image.complete) recordSize();
      else image.addEventListener('load', recordSize, { once: true });
    }
    if (info.sampleRate) extra.push(['Amostragem', `${number(info.sampleRate)} Hz`]);
    if (info.channels) extra.push(['Canais', info.channels === 1 ? 'Mono' : info.channels === 2 ? 'Estéreo' : info.channels]);
    if (info.bitDepth) extra.push(['Profundidade', `${info.bitDepth} bits`]);
    if (info.duration !== undefined) extra.push(['Duração', mediaTime(info.duration)]);
    if (info.meshes !== undefined) extra.push(['Malhas', info.meshes], ['Materiais', info.materials], ['Clipes', info.clips.length]);
    if (info.godotType) extra.push(['Recurso', info.godotType], ['Referências na prévia', info.references.length]);
    if (info.modified) extra.push(['Modificado', new Date(info.modified).toLocaleDateString('pt-BR')]);
    data.insertAdjacentHTML('beforeend', extra.map(row).join(''));
    if (file.preview === 'text' && target) target.textContent = info.text + (info.truncated ? '\n[Prévia parcial]' : '');
    if (info.references?.length) {
      const references = document.createElement('details');
      references.className = 'asset-references';
      references.innerHTML = `<summary>Dependências</summary><ul>${info.references.map(path => `<li>${esc(path)}</li>`).join('')}</ul>`;
      data.after(references);
    }
  }).catch(error => {
    if (!signal.aborted && file.preview === 'text' && target) target.textContent = error.message;
  });
  if (effect) {
    import('/media-tools.js').then(({ attachEffectPreview }) => attachEffectPreview(target, file, sequence, signal)).catch(error => {
      if (!signal.aborted) target.textContent = error.message;
    });
  } else if (file.preview === 'audio' && file.size <= 16 * 1024 * 1024) {
    import('/media-tools.js').then(({ renderWaveform }) => renderWaveform(target.querySelector('canvas'), file.url, signal)).catch(() => {});
  } else if (autoModel) {
    loadInspectorModel(target, model, signal);
  }
}

async function loadInspectorModel(target, file, signal) {
  try {
    const { showModel } = await import('/model.js');
    if (!signal.aborted) await showModel(target, file.url, signal);
  } catch (error) { if (!signal.aborted) target.textContent = error.message; }
}

function openModelDetail(path) {
  const file = state.entries.find(item => item.path === path);
  if (!file || !compatibleModel(file)) return;
  state.modelDetail = path;
  renderLibrary();
  window.scrollTo(0, 0);
}

function selectFile(path, focusPreview = false) {
  if (state.category === 'Models') {
    if (state.file === path && state.modelPreview === path) return;
    state.modelPreview = path;
  }
  state.file = path;
  document.querySelectorAll('#gallery [data-file]').forEach(button => {
    const selected = button.dataset.file === path;
    button.setAttribute('aria-pressed', String(selected));
    button.closest('.audio-row')?.classList.toggle('selected', selected);
  });
  renderInspector();
  if (focusPreview && matchMedia('(max-width: 760px)').matches) {
    document.querySelector('#inspector')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

async function playAudio(file) {
  if (state.screen === 'library' && state.file !== file.path) selectFile(file.path);
  if (state.playing === file.path && !audio.paused) {
    audio.pause();
    return;
  }
  if (state.playing !== file.path) {
    state.playing = file.path;
    audio.src = file.url;
    document.querySelector('#playing-type').textContent = labelOf(file.category);
    document.querySelector('#playing-name').textContent = file.name;
  }
  transport.hidden = false;
  try { await audio.play(); } catch { announce('Este áudio não pôde ser reproduzido.'); }
}

function syncAudioButtons() {
  document.querySelectorAll('#gallery [data-play]').forEach(button => {
    const file = state.entries.find(item => item.path === button.dataset.play);
    const playing = file.path === state.playing && !audio.paused;
    button.innerHTML = svg(playing ? 'pause' : 'play');
    button.setAttribute('aria-label', `${playing ? 'Pausar' : 'Reproduzir'} ${file.name}`);
  });
}
for (const name of ['play', 'pause', 'ended']) audio.addEventListener(name, syncAudioButtons);
document.querySelector('#stop-audio').addEventListener('click', () => {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  state.playing = '';
  transport.hidden = true;
  syncAudioButtons();
});

function renderWorkbench() {
  const engine = state.screen;
  const url = new URL(state.work.origins[engine] || location.origin);
  if (engine === '2d') url.pathname = '/viewer/';
  url.searchParams.set('embed', '1');
  main.innerHTML = `<div class="native-workbench"><iframe class="native-frame" src="${esc(url.href)}"
    title="Visualizador da Forja ${engine.toUpperCase()}"></iframe></div>`;
}

function showDialog(title, content, wide = false) {
  dialog.classList.toggle('wide', wide);
  dialog.innerHTML = `<header class="dialog-head"><h2>${esc(title)}</h2>${action('Fechar', 'close', 'close', 'icon-only')}</header>${content}`;
  if (!dialog.open) dialog.showModal();
}

dialog.addEventListener('close', () => {
  if (!dialog.open) dialog.replaceChildren();
});

function importPrompt() {
  showDialog('Importar para a biblioteca', `<form class="form" data-form="import">
    <label>Tipo <select name="category">${state.categories.map(category => option(category, labelOf(category), state.category || 'Textures')).join('')}</select></label>
    <label>Pasta ou pacote <input name="folder" placeholder="Ex.: pacote-medieval"></label>
    <label>Arquivos <input name="files" type="file" multiple></label>
    <label>Ou selecionar uma pasta <input name="directory" type="file" webkitdirectory multiple></label>
    <p class="sub" id="import-progress">Arquivos com o mesmo nome no destino são preservados.</p>
    <button type="submit" class="btn primary">Importar arquivos</button>
  </form>`);
}

function movePrompt(path) {
  const [category, ...parts] = path.split('/');
  showDialog('Renomear ou mover', `<form class="form" data-form="move" data-from="${esc(path)}">
    <label>Tipo de destino <select name="category">${state.categories.map(value => option(value, labelOf(value), category)).join('')}</select></label>
    <label>Caminho dentro da categoria <input name="target" required value="${esc(parts.join('/'))}"></label>
    <button type="submit" class="btn primary">Salvar destino</button>
  </form>`);
}

document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  const { screen, category, layout, file, move, play, model, action: command } = button.dataset;
  if (screen) {
    state.screen = screen;
    history.replaceState(null, '', screen === 'library' ? '/' : '#' + screen);
    render();
  } else if (category !== undefined) {
    state.category = category;
    localStorage.setItem('forge-category', category);
    state.modelDetail = '';
    state.modelPreview = '';
    state.pack = '';
    state.auxiliary = false;
    render();
    document.querySelector('.tabs [aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else if (layout) {
    state.layout = layout;
    renderLibrary();
  } else if (file) {
    const item = state.entries.find(entry => entry.path === file);
    if (item && state.screen === 'library') selectFile(file, state.category !== 'Models');
  } else if (play) {
    const item = state.entries.find(entry => entry.path === play);
    if (item) await playAudio(item);
  } else if (model) {
    const file = state.entries.find(entry => entry.path === model);
    const target = document.querySelector('#sample-preview');
    const signal = inspectorController.signal;
    if (file && target) {
      button.hidden = true;
      target.classList.add('model');
      target.innerHTML = '<span class="model-message">Carregando modelo…</span>';
      await loadInspectorModel(target, file, signal);
    }
  } else if (move) {
    movePrompt(move);
  } else if (command === 'refresh') {
    try { await refresh(); render(); announce('Biblioteca atualizada.'); } catch (error) { announce(error.message); }
  } else if (command === 'import') importPrompt();
  else if (command === 'model-open') openModelDetail(state.file);
  else if (command === 'model-back') {
    state.modelDetail = '';
    renderLibrary();
  } else if (command === 'close') dialog.close();
  else if (command === 'move-pack') movePrompt(state.pack);
  else if (command === 'tile' || command === 'mask-bg') {
    const target = document.querySelector('#sample-preview');
    if (command === 'tile') {
      const tiled = target.classList.toggle('tiled');
      target.style.backgroundImage = tiled ? `url("${target.querySelector('img').src}")` : '';
      button.textContent = tiled ? 'Ver imagem única' : 'Repetir textura';
    } else {
      const next = (Number(target.dataset.background || 0) + 1) % 3;
      target.dataset.background = next;
      button.textContent = ['Fundo quadriculado', 'Fundo claro', 'Fundo escuro'][next];
    }
  }
  else if (command === 'copy-library') {
    try {
      await navigator.clipboard.writeText(document.querySelector('#inspector-path').textContent);
      announce('Caminho copiado.');
    } catch { announce('Selecione o caminho exibido para copiar.'); }
  }
});

document.addEventListener('dblclick', event => {
  const button = event.target.closest('#gallery [data-file]');
  if (button && state.screen === 'library' && state.category === 'Models') openModelDetail(button.dataset.file);
});

document.addEventListener('input', event => {
  const { id, value } = event.target;
  if (id === 'search') { state.search = value; renderGallery(); }
});

document.addEventListener('change', event => {
  const { id, value } = event.target;
  if (id === 'auxiliary') { state.auxiliary = event.target.checked; renderLibrary(); }
  if (id === 'origin' || id === 'pack') {
    state[id] = value;
    if (id === 'origin') state.pack = '';
    renderGallery();
  }

});

dialog.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const values = Object.fromEntries(data);
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    if (form.dataset.form === 'move') {
      await post('/api/move', { from: form.dataset.from, to: `${values.category}/${values.target.trim()}` });
      announce('Destino atualizado.');
    } else if (form.dataset.form === 'import') {
      const files = [...form.elements.files.files, ...form.elements.directory.files];
      if (!files.length) throw new Error('Selecione arquivos ou uma pasta.');
      const progress = form.querySelector('#import-progress');
      const skipped = [];
      const group = values.folder.trim();
      for (const [index, file] of files.entries()) {
        progress.textContent = `Importando ${index + 1} de ${files.length}…`;
        const path = [values.category, group, file.webkitRelativePath || file.name].filter(Boolean).join('/');
        try { await api('/api/import?' + new URLSearchParams({ path }), { method: 'PUT', body: file }); }
        catch (error) { skipped.push(`${file.name} (${error.message})`); }
      }
      announce(`${files.length - skipped.length} importados${skipped.length ? `, ${skipped.length} ignorados` : ''}.`);
      if (skipped.length) {
        progress.textContent = skipped.slice(0, 5).join(' · ');
        await refresh();
        render();
        return;
      }
      state.category = values.category;
      state.origin = 'imported';
      state.search = state.pack = '';
    }
    dialog.close();
    await refresh();
    render();
  } catch (error) { announce(error.message); }
  finally { submit.disabled = false; }
});

refresh().then(render).catch(error => {
  renderSidebar();
  main.innerHTML = `<p class="loading error">${esc(error.message)}</p>`;
});

let uiVersion;
async function checkVersion() {
  if (document.hidden || dialog.open || !audio.paused) return;
  try {
    const { version } = await api('/api/version');
    if (uiVersion && version !== uiVersion) location.reload();
    else uiVersion = version;
  } catch { /* The viewer reconnects when the local service finishes restarting. */ }
}
checkVersion();
setInterval(checkVersion, 2700);
