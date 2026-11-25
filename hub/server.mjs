import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { lstat, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { startEngines } from './engines.mjs';
import { getCategories, httpError, importFile, listLibrary, moveImport, readMetadata, serveMedia } from './library.mjs';
import { forge3d, idPattern, launch, library, projects, projectPath, sourcePattern } from './workspace.mjs';

const ui = fileURLToPath(new URL('./ui/', import.meta.url));
const files = {
  '/': [join(ui, 'index.html'), 'text/html'],
  '/app.js': [join(ui, 'app.js'), 'text/javascript'],
  '/styles.css': [join(ui, 'styles.css'), 'text/css'],
  '/model.js': [join(ui, 'model.js'), 'text/javascript'],
  '/media-tools.js': [join(ui, 'media-tools.js'), 'text/javascript'],
  '/animations.js': [join(ui, 'animations.js'), 'text/javascript'],
  '/vendor/three.min.js': [join(forge3d, 'Tools/viewer/vendor/three.min.js'), 'text/javascript'],
  '/vendor/GLTFLoader.js': [join(forge3d, 'Tools/viewer/vendor/GLTFLoader.js'), 'text/javascript'],
  '/vendor/OrbitControls.js': [join(forge3d, 'Tools/viewer/vendor/OrbitControls.js'), 'text/javascript'],
  '/vendor/bbmodel_parser.js': [join(forge3d, 'Tools/viewer/js/bbmodel_parser.js'), 'text/javascript'],
  '/vendor/animation_player.js': [join(forge3d, 'Tools/viewer/js/animation_player.js'), 'text/javascript'],
  '/vendor/asset_loader.js': [join(forge3d, 'Tools/viewer/js/asset_loader.js'), 'text/javascript'],
};
const started = Date.now();
const running = new Set();
const children = new Set();
const engines = await startEngines();

function json(response, value, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function body(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) {
    throw httpError(415, 'Envie os dados como JSON.');
  }
  let data = '';
  for await (const chunk of request.setEncoding('utf8')) {
    data += chunk;
    if (data.length > 65536) throw httpError(413, 'Dados do comando acima do limite.');
  }
  try {
    const value = JSON.parse(data);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw httpError(400, 'Dados do comando inválidos.'); }
}

function run(engine, args) {
  return new Promise((resolve, reject) => {
    const child = launch(engine, args);
    children.add(child);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout = (stdout + chunk).slice(-1000000); });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr = (stderr + chunk).slice(-64000); });
    child.on('error', error => { children.delete(child); reject(error); });
    child.on('close', code => { children.delete(child); resolve({ ok: code === 0, code, stdout, stderr }); });
  });
}

async function checkProjectDirectory(id, engine) {
  for (const folder of [join(projects, id), projectPath(id, engine)]) {
    const info = await lstat(folder).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (info && !info.isDirectory()) throw httpError(409, 'O caminho do projeto não é uma pasta regular.');
  }
}

async function job(input) {
  const { engine, project, action, asset } = input;
  if (!['2d', '3d'].includes(engine) || typeof project !== 'string' || !idPattern.test(project)
    || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(project)) {
    throw httpError(400, 'Informe um identificador de projeto válido.');
  }
  const validAsset = typeof asset === 'string' && asset.length <= 160
    && (engine === '2d' ? sourcePattern.test(asset) : idPattern.test(asset))
    && !asset.split('/').some(part => /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(part));
  let args;
  if (engine === '2d') {
    if (action === 'init') args = ['new-project', project, '--style'];
    if (action === 'create' && validAsset && ['brush', 'pixel'].includes(input.mode)) {
      const size = input.size || '128x128';
      if (typeof size !== 'string' || !/^\d{1,4}x\d{1,4}$/.test(size) || size.split('x').some(n => +n < 1 || +n > 4096)) {
        throw httpError(400, 'Use dimensões entre 1 e 4096, por exemplo 128x128.');
      }
      args = ['new-asset', project, asset, '--engine', input.mode, '--size', size];
      if (input.frames) {
        const frames = Number(input.frames);
        const fps = Number(input.fps || 6);
        if (!Number.isInteger(frames) || frames < 1 || frames > 128 || !Number.isFinite(fps) || fps <= 0) {
          throw httpError(400, 'Informe de 1 a 128 quadros e um FPS positivo.');
        }
        args.push('--frames', String(frames), '--fps', String(fps));
      }
    }
    if (action === 'sandbox') args = ['new-sandbox', project];
    if (action === 'check') args = ['check', project];
    if (action === 'export' && (validAsset || asset === '') && ['', 'png', 'jpeg'].includes(input.format ?? '')) {
      args = ['export', project, ...(asset ? [asset] : []), '--server', engines['2d']];
      if (input.format) args.push('--format', input.format);
      if (['grid', 'compact'].includes(input.sheet)) args.push('--' + input.sheet);
      if (input.mockup === true) args.push('--mockup');
    }
  } else {
    const target = projectPath(project, engine);
    const mode = input.mode || 'free';
    if (action === 'init' && validAsset && ['free', 'box', 'mixed'].includes(mode)) {
      args = ['project', 'init', target, '--project-id', project, '--asset', asset, '--mode', mode];
    }
    if (action === 'create' && validAsset && ['free', 'box', 'mixed'].includes(mode)) {
      args = ['asset', 'init', target, '--asset', asset, '--mode', mode, '--animation'];
    }
    if (['model', 'uv', 'texture', 'animation', 'status', 'preview', 'export'].includes(action) && validAsset) {
      args = [action, target, '--asset', asset];
      if (action === 'export' && input.format) {
        if (!['glb', 'png', 'bbmodel'].includes(input.format)) throw httpError(400, 'Formato de exportação inválido.');
        args.push('--format', input.format, '--output', `${asset}/exports/${asset}.${input.format}`);
      }
    }
  }
  if (!args) throw httpError(400, 'Comando ou identificador de asset inválido.');
  const key = `${engine}:${project}`;
  if (running.has(key)) throw httpError(409, 'Já existe uma operação neste projeto.');
  running.add(key);
  try {
    await checkProjectDirectory(project, engine);
    const existing = engine === '3d' ? 'project.json' : 'source/_theme.ts';
    if (action !== 'init' && !(await lstat(join(projectPath(project, engine), existing)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    }))?.isFile()) throw httpError(404, 'Ative o gerador neste projeto primeiro.');
    return await run(engine, args);
  } finally { running.delete(key); }
}

async function workbench() {
  const [two, three, projectFolders] = await Promise.all([
    run('2d', ['list', '--json']),
    fetch(engines['3d'] + '/api/catalog', { signal: AbortSignal.timeout(10000) }).then(res => {
      if (!res.ok) throw new Error('O catálogo 3D está indisponível.');
      return res.json();
    }),
    readdir(projects, { withFileTypes: true }),
  ]);
  if (!two.ok) throw new Error(two.stderr || 'O catálogo 2D está indisponível.');
  return {
    origins: { '2d': engines['2d'], '3d': engines['3d'] },
    projects: projectFolders.filter(entry => entry.isDirectory() && idPattern.test(entry.name)).map(entry => entry.name).sort(),
    two: JSON.parse(two.stdout).projects,
    three: three.projects,
  };
}

const server = createServer(async (request, response) => {
  try {
    const port = server.address().port;
    const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    if (!hosts.has(request.headers.host)) throw httpError(403, 'Abra a forja por localhost.');
    const method = request.method;
    if (['POST', 'PUT'].includes(method) && request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
      throw httpError(403, 'Origem da operação inválida.');
    }
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (method === 'GET' && url.pathname === '/api/health') return json(response, { app: 'asset-forge-workspace' });
    if (method === 'GET' && url.pathname === '/api/version') {
      const stamps = await Promise.all(Object.values(files).map(async ([path]) => (await lstat(path)).mtimeMs));
      return json(response, { version: [started, ...stamps].join(':') });
    }
    if (method === 'GET' && url.pathname === '/api/library') {
      const [categories, entries] = await Promise.all([getCategories(), listLibrary()]);
      return json(response, { categories, entries });
    }
    if (method === 'GET' && url.pathname === '/api/metadata') return json(response, await readMetadata(url.searchParams.get('path')));
    if (method === 'GET' && url.pathname === '/api/workbench') return json(response, await workbench());
    if (method === 'POST' && url.pathname === '/api/job') return json(response, await job(await body(request)));
    if (method === 'PUT' && url.pathname === '/api/import') {
      return json(response, await importFile(url.searchParams.get('path'), request), 201);
    }
    if (method === 'POST' && url.pathname === '/api/move') {
      const { from, to } = await body(request);
      return json(response, await moveImport(from, to));
    }
    if (['GET', 'HEAD'].includes(method) && url.pathname.startsWith('/media/')) {
      if (request.headers.origin === engines['3d']) {
        response.setHeader('Access-Control-Allow-Origin', engines['3d']);
        response.setHeader('Vary', 'Origin');
      }
      let path;
      try { path = decodeURIComponent(url.pathname.slice('/media/'.length)); }
      catch { throw httpError(400, 'Caminho inválido.'); }
      return await serveMedia(path, request, response, url.searchParams.has('download'));
    }
    if (['GET', 'HEAD'].includes(method) && Object.hasOwn(files, url.pathname)) {
      const [path, mime] = files[url.pathname];
      const info = await lstat(path);
      response.writeHead(200, { 'Content-Type': mime + '; charset=utf-8', 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
      if (method === 'HEAD') return response.end();
      return await pipeline(createReadStream(path), response);
    }
    throw httpError(404, 'Página não encontrada.');
  } catch (error) {
    if (!response.headersSent && !response.destroyed) json(response, { error: error.message }, error.status || 500);
    else response.destroy();
  }
});

await mkdir(library, { recursive: true });
const port = Number(process.env.FORGE_PORT ?? 8780);
server.on('error', async error => {
  console.error(error.message);
  await engines.close();
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`Forja e biblioteca em http://127.0.0.1:${server.address().port}/`));

let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  server.close();
  for (const child of children) child.kill();
  await engines.close();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
if (process.connected) process.on('disconnect', stop);
