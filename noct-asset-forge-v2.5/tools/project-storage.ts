import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const projectNamePattern = /^[a-z0-9][a-z0-9_-]*$/;

export function storageRoot(root: string): string {
  return resolve(root, process.env.FORGE_PROJECTS_ROOT || 'projects');
}

export function projectDirectory(root: string, name: string): string {
  if (!projectNamePattern.test(name)) throw new Error(`Invalid project name: ${name}`);
  return process.env.FORGE_PROJECTS_ROOT
    ? resolve(storageRoot(root), name, '2d')
    : resolve(storageRoot(root), name);
}

export function projectNames(root: string): string[] {
  const directory = storageRoot(root);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && projectNamePattern.test(entry.name)
      && existsSync(resolve(projectDirectory(root, entry.name), 'source')))
    .map(entry => entry.name).sort();
}
