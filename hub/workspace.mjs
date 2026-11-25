import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
const preferredLibrary = join(root, 'Assets Library');
export const library = resolve(process.env.ASSET_LIBRARY_ROOT || (existsSync(preferredLibrary)
  ? preferredLibrary : join(root, 'Assets Libary')));
export const projects = join(library, 'generated', 'projects');
export const forge2d = join(root, 'noct-asset-forge-v2.5');
export const forge3d = join(root, 'noct-asset-forge-3d-bb-v2');
export const commonCategories = ['Textures', 'Models', 'Animations', 'Masks', 'Smokes', 'Sounds', 'Voices', 'VFX', 'Text', 'Other'];
export const idPattern = /^[a-z0-9][a-z0-9_-]{0,79}$/;
export const sourcePattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9_-]*)*$/;

export function projectPath(id, engine) {
  if (!idPattern.test(id) || !['2d', '3d'].includes(engine)) throw new Error('Projeto ou gerador inválido.');
  return join(projects, id, engine);
}

const python = process.env.FORGE_PYTHON || (process.platform === 'win32' ? 'py' : 'python3.12');
const pythonFlags = basename(python).toLowerCase().replace(/\.exe$/, '') === 'py' ? ['-3.12'] : [];

export function launch(engine, args, options = {}) {
  const common = { windowsHide: true, ...options, env: { ...process.env, PYTHONUTF8: '1', FORGE_PROJECTS_ROOT: projects } };
  if (engine === '2d') {
    const [action, ...rest] = args;
    const script = action === 'export' ? 'tools/export.ts' : 'tools/forge.ts';
    return spawn(process.execPath, [join(forge2d, 'node_modules', 'tsx', 'dist', 'cli.mjs'), script,
      ...(action === 'export' ? rest : [action, ...rest])], { ...common, cwd: forge2d });
  }
  if (engine === '3d') {
    return spawn(python, [...pythonFlags, '-m', 'Tools.forge', ...args], { ...common, cwd: forge3d });
  }
  throw new Error('Gerador inválido.');
}
