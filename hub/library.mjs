import { createReadStream, createWriteStream } from 'node:fs';
import { link, lstat, mkdir, open, readdir, realpath, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, extname, join, relative, sep } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { commonCategories, idPattern, library, projects } from './workspace.mjs';

const types = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', webm: 'video/webm', ogg: 'audio/ogg', mp3: 'audio/mpeg',
  wav: 'audio/wav', m4a: 'audio/mp4', flac: 'audio/flac', glb: 'model/gltf-binary',
  gltf: 'model/gltf+json', obj: 'model/obj', fbx: 'application/octet-stream',
  bbmodel: 'application/json', tga: 'application/octet-stream',
};
export const httpError = (status, message) => Object.assign(new Error(message), { status });
const format = path => extname(path).slice(1).toLowerCase();
const slash = path => path.split(sep).join('/');
const modelTypes = new Set(['glb', 'gltf', 'obj', 'fbx', 'bbmodel', 'blend', 'stl', 'dae', 'usd', 'usdz']);
const textTypes = new Set(['txt', 'md', 'csv', 'json', 'xml', 'fnt', 'yaml', 'yml', 'ini', 'mtl',
  'tscn', 'tres', 'gdshader', 'gdshaderinc', 'anim']);
const missing = error => { if (error.code !== 'ENOENT') throw error; };

export async function getCategories() {
  const directories = await readdir(library, { withFileTypes: true });
  const extra = directories.filter(dir => dir.isDirectory() && !dir.name.startsWith('.') && dir.name.toLowerCase() !== 'generated')
    .map(dir => dir.name).sort((a, b) => a.localeCompare(b));
  return [...new Set([...commonCategories, ...extra])];
}

function parts(path) {
  if (typeof path !== 'string' || !path || path.length > 1000) throw httpError(400, 'Caminho inválido.');
  const segments = path.split('/');
  for (const part of segments) {
    if (!part || part.startsWith('.') || /[<>:"\\|?*\x00-\x1f]|[ .]$/.test(part)
      || /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(part)) {
      throw httpError(400, 'Nome de arquivo ou pasta inválido.');
    }
  }
  return segments;
}

function generatedParts(segments) {
  return segments.length >= 6 && segments[0] === 'generated' && segments[1] === 'projects'
    && idPattern.test(segments[2]) && ['2d', '3d'].includes(segments[3]) && segments[4] === 'assets';
}

async function resolveLibraryPath(path, { importedOnly = false, createParents = false } = {}) {
  const segments = parts(path);
  const rootName = segments[0];
  if (segments.length < 2 || (!commonCategories.includes(rootName) && !(importedOnly === false && generatedParts(segments))
    && (rootName.toLowerCase() === 'generated' || !(await lstat(join(library, rootName)).catch(missing))?.isDirectory()))) {
    throw httpError(403, 'Caminho fora do acervo.');
  }
  let current = await realpath(library);
  for (const [index, segment] of segments.entries()) {
    current = join(current, segment);
    const info = await lstat(current).catch(missing);
    if (info?.isSymbolicLink()) throw httpError(403, 'Links de arquivo ficam fora do acervo.');
    if (index < segments.length - 1) {
      if (createParents && !info) await mkdir(current, { recursive: true });
      else if (!info?.isDirectory()) throw httpError(404, 'Pasta não encontrada.');
    }
  }
  return current;
}

async function walk(dir, add) {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(missing) || []) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, add);
    else if (entry.isFile()) {
      const info = await lstat(path).catch(missing);
      if (info?.isFile()) add(path, info.size);
    }
  }
}

export async function listLibrary() {
  const entries = [];
  function entry(path, size, category, project = null, engine = null) {
    const key = slash(relative(library, path));
    const name = key.split('/').at(-1);
    const kind = format(name);
    const mime = types[kind] || '';
    const atlas = ['VFX', 'FX', 'Smokes'].includes(category) && /(?:^|[_ -])(\d{1,2})x(\d{1,2})\.[^.]+$/i.exec(name);
    entries.push({
      path: key, name, size, category, project, engine, format: kind,
      preview: mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio'
        : ['glb', 'gltf'].includes(kind) ? 'model' : kind === 'tga' ? 'tga' : textTypes.has(kind) ? 'text' : null,
      ...(atlas && Number(atlas[1]) * Number(atlas[2]) > 1 ? { columns: Number(atlas[1]), rows: Number(atlas[2]) } : {}),
      url: '/media/' + key.split('/').map(encodeURIComponent).join('/'),
    });
  }
  const rootEntries = await readdir(library, { withFileTypes: true });
  await Promise.all(rootEntries.filter(dir => dir.isDirectory() && !dir.name.startsWith('.') && dir.name.toLowerCase() !== 'generated')
    .map(dir => walk(join(library, dir.name), (file, size) => entry(file, size, dir.name))));
  for (const collection of await readdir(projects, { withFileTypes: true })) {
    if (!collection.isDirectory() || !idPattern.test(collection.name)) continue;
    for (const engine of ['2d', '3d']) {
      const dir = join(projects, collection.name, engine, 'assets');
      if (!(await lstat(dirname(dir)).catch(missing))?.isDirectory() || !(await lstat(dir).catch(missing))?.isDirectory()) continue;
      await walk(dir, (file, size) => {
        const kind = format(file);
        const category = modelTypes.has(kind)
          ? /(?:^|[\\/])animations?(?:[\\/]|$)/i.test(relative(dir, file)) ? 'Animations' : 'Models'
          : types[kind]?.startsWith('audio/') ? 'Sounds' : types[kind]?.startsWith('image/') ? 'Textures' : 'Other';
        entry(file, size, category, collection.name, engine);
      });
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function waveInfo(header) {
  if (header.length < 12 || header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE') return {};
  let result = {};
  let dataSize;
  let rate;
  for (let offset = 12; offset + 8 <= header.length;) {
    const type = header.toString('ascii', offset, offset + 4);
    const length = header.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (type === 'fmt ' && start + 16 <= header.length) {
      result = {
        channels: header.readUInt16LE(start + 2),
        sampleRate: header.readUInt32LE(start + 4),
        bitDepth: header.readUInt16LE(start + 14),
      };
      rate = header.readUInt32LE(start + 8);
    }
    if (type === 'data') dataSize = length;
    if (rate && dataSize !== undefined) break;
    offset = start + length + length % 2;
  }
  if (rate && dataSize !== undefined) result.duration = dataSize / rate;
  return result;
}

export async function readMetadata(path) {
  const file = await resolveLibraryPath(path);
  const info = await lstat(file).catch(missing);
  if (!info?.isFile()) throw httpError(404, 'Arquivo não encontrado.');
  const kind = format(file);
  const result = { modified: info.mtime.toISOString() };
  if (!['wav', 'png', 'tga', 'gltf', 'glb', 'bbmodel'].includes(kind) && !textTypes.has(kind)) return result;
  const handle = await open(file, 'r');
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(Math.min(65536, info.size)), 0, Math.min(65536, info.size), 0);
    const header = buffer.subarray(0, bytesRead);
    if (kind === 'wav') Object.assign(result, waveInfo(header));
    if (kind === 'png' && header.length >= 26 && header.toString('ascii', 1, 4) === 'PNG') {
      Object.assign(result, { width: header.readUInt32BE(16), height: header.readUInt32BE(20), bitDepth: header[24] });
    }
    if (kind === 'tga' && header.length >= 18) {
      Object.assign(result, { width: header.readUInt16LE(12), height: header.readUInt16LE(14), bitDepth: header[16] });
    }
    if (textTypes.has(kind)) {
      const text = header.subarray(0, 32768).toString('utf8');
      Object.assign(result, { text, truncated: info.size > 32768 });
      if (['tscn', 'tres'].includes(kind)) {
        result.godotType = header.toString('utf8', 0, 1024).match(/^\[gd_resource\s+type="([^"]+)"/)?.[1]
          || (kind === 'tscn' ? 'Cena Godot' : 'Recurso Godot');
        result.references = [...text.matchAll(/^\[ext_resource[^\r\n]*?\bpath="([^"]+)"/gm)]
          .map(match => match[1]).slice(0, 25);
      }
    }
    let document;
    try {
      if (kind === 'glb' && header.length >= 20 && header.toString('ascii', 0, 4) === 'glTF') {
        const length = header.readUInt32LE(12);
        if (length <= 8 * 1024 * 1024 && length + 20 <= info.size) {
          const { buffer } = await handle.read(Buffer.alloc(length), 0, length, 20);
          document = JSON.parse(buffer.toString('utf8').trim());
        }
      }
      if (kind === 'gltf' && info.size === header.length) document = JSON.parse(header.toString('utf8'));
      if (kind === 'bbmodel' && info.size <= 12 * 1024 * 1024) {
        const model = JSON.parse(await handle.readFile({ encoding: 'utf8' }));
        return { ...result, meshes: model.elements?.filter(element => ['cube', 'mesh'].includes(element.type)).length ?? 0,
          materials: model.textures?.length ?? 0, clips: model.animations?.map(clip => clip.name) ?? [] };
      }
    } catch { /* Uma malha sem metadados legíveis ainda pode ser baixada. */ }
    if (document) Object.assign(result, {
      meshes: document.meshes?.length ?? 0, materials: document.materials?.length ?? 0,
      clips: document.animations?.map((clip, index) => clip.name || `Clipe ${index + 1}`) ?? [],
    });
    return result;
  } finally { await handle.close(); }
}

export async function importFile(path, request) {
  const maxBytes = 2 * 1024 * 1024 * 1024;
  if (Number(request.headers['content-length']) > maxBytes) throw httpError(413, 'Limite de 2 GB por arquivo.');
  const target = await resolveLibraryPath(path, { importedOnly: true, createParents: true });
  const temp = join(dirname(target), `.upload-${randomUUID()}`);
  let size = 0;
  try {
    await pipeline(request, new Transform({ transform(chunk, _encoding, done) {
      size += chunk.length;
      done(size > maxBytes ? httpError(413, 'Limite de 2 GB por arquivo.') : null, chunk);
    } }), createWriteStream(temp, { flags: 'wx' }));
    await link(temp, target).catch(error => {
      if (error.code === 'EEXIST') throw httpError(409, 'Já existe um arquivo com esse nome.');
      throw error;
    });
    return { path, size };
  } finally {
    await rm(temp, { force: true });
  }
}

let moves = Promise.resolve();
export function moveImport(from, to) {
  const operation = moves.then(async () => {
    const source = await resolveLibraryPath(from, { importedOnly: true });
    const target = await resolveLibraryPath(to, { importedOnly: true, createParents: true });
    const sourceInfo = await lstat(source).catch(missing);
    if (!sourceInfo) throw httpError(404, 'Origem não encontrada.');
    if (await lstat(target).catch(missing)) throw httpError(409, 'Já existe um item nesse destino.');
    if (relative(source, target).startsWith('..') === false && sourceInfo.isDirectory()) {
      throw httpError(400, 'Escolha um destino fora da pasta movida.');
    }
    if (sourceInfo.isDirectory()) await rename(source, target);
    else {
      await link(source, target);
      await rm(source);
    }
    return { path: to };
  });
  moves = operation.catch(() => {});
  return operation;
}

export async function serveMedia(path, request, response, download) {
  const file = await resolveLibraryPath(path);
  const info = await lstat(file).catch(missing);
  if (!info?.isFile()) throw httpError(404, 'Arquivo não encontrado.');
  const mime = types[format(file)] || 'application/octet-stream';
  const headers = {
    'Content-Type': mime, 'Content-Length': info.size,
    'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
  if (download || mime === 'application/octet-stream') {
    headers['Content-Disposition'] = "attachment; filename*=UTF-8''" + encodeURIComponent(parts(path).at(-1));
  }
  let range;
  if (request.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    const start = match?.[1] ? Number(match[1]) : Math.max(info.size - Number(match?.[2]), 0);
    const end = match?.[1] && match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
    if (!match || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) {
      response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
      return;
    }
    range = { start, end };
    headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    headers['Content-Length'] = end - start + 1;
  }
  response.writeHead(range ? 206 : 200, headers);
  if (request.method === 'HEAD') response.end();
  else await pipeline(createReadStream(file, range), response);
}
