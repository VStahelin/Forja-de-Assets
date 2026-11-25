import { randomUUID } from 'node:crypto';
import { cp, lstat, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { forge2d, forge3d, idPattern, projects, projectPath } from './workspace.mjs';

await mkdir(projects, { recursive: true });
for (const [engine, forge] of [['2d', forge2d], ['3d', forge3d]]) {
  const sourceRoot = join(forge, 'projects');
  for (const entry of await readdir(sourceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !idPattern.test(entry.name)) continue;
    const target = projectPath(entry.name, engine);
    if (await lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error; })) {
      console.log(`Mantido: ${target}`);
      continue;
    }
    const collection = join(projects, entry.name);
    const staging = join(collection, `.adopt-${randomUUID()}`);
    await mkdir(collection, { recursive: true });
    try {
      await cp(join(sourceRoot, entry.name), staging, {
        recursive: true, force: false, errorOnExist: true,
        filter: async source => {
          const name = source.split(sep).at(-1);
          return !['__pycache__', '.forge-project.lock', '.runtime', '.cache'].includes(name)
            && !name.endsWith('.bak') && !(await lstat(source)).isSymbolicLink();
        },
      });
      await rename(staging, target);
      console.log(`Adotado: ${target}`);
    } finally {
      if (staging.startsWith(collection + sep + '.adopt-')) await rm(staging, { recursive: true, force: true });
    }
  }
}
