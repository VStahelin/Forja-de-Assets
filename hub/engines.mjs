import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { forge2d, launch, projects } from './workspace.mjs';

export async function startEngines() {
  await mkdir(projects, { recursive: true });
  process.env.FORGE_PROJECTS_ROOT = projects;
  const { createServer } = await import(pathToFileURL(join(forge2d, 'node_modules/vite/dist/node/index.js')));
  const two = await createServer({
    root: forge2d,
    server: { port: 5174, strictPort: false, open: false, host: '127.0.0.1', watch: null },
    logLevel: 'error',
  });
  let child;
  let pythonPid;
  const close = async () => {
    if (pythonPid && pythonPid !== child?.pid) {
      try { process.kill(pythonPid); } catch (error) { if (error.code !== 'ESRCH') console.error(error.message); }
    }
    if (child?.exitCode == null) child?.kill();
    await two.close();
  };
  try {
    await two.listen();
    const origin2d = `http://127.0.0.1:${two.httpServer.address().port}`;
    child = launch('3d', ['view', '--all', '--projects-root', projects, '--port', '0']);
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    let output = '';
    let timeout;
    const ready = new Promise(resolve => child.stdout.on('data', chunk => {
      output = (output + chunk.toString()).slice(-8000);
      const url = /Direct link: (http:\/\/127\.0\.0\.1:\d+)\//.exec(output)?.[1];
      if (url) resolve(url);
    }));
    const exit = once(child, 'exit').then(([code]) => { throw new Error(`O serviço 3D encerrou durante a inicialização (${code}).`); });
    const expired = new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('O serviço 3D não iniciou em 20 s.')), 20000); });
    const origin3d = await Promise.race([ready, exit, expired]).finally(() => clearTimeout(timeout));
    const health = await fetch(origin3d + '/api/health', { signal: AbortSignal.timeout(4000) });
    if (!health.ok) throw new Error('O serviço 3D não respondeu à verificação.');
    pythonPid = (await health.json()).processId;
    child.on('exit', () => { pythonPid = null; });
    return { '2d': origin2d, '3d': origin3d, close };
  } catch (error) {
    await close();
    throw error;
  }
}
