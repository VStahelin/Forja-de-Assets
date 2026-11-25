import { normalizePath, type Plugin } from 'vite';
import { resolve, relative, extname } from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { FORGE_APP_ID, FORGE_HEALTH_PATH, workspaceId } from './forge-server';
import { projectDirectory, projectNames, projectNamePattern } from './project-storage';

async function scan(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, item.name);
    if (item.isDirectory()) files.push(...await scan(path));
    else if (item.isFile()) files.push(path);
  }
  return files.sort();
}
export function forgeApi(): Plugin {
  return { name: 'forge-session-api', configureServer(server) {
    const root = server.config.root, instanceId = randomUUID();
    const configuredScope = JSON.parse(String(server.config.define?.__FORGE_SCOPE__ || 'null')) as string | null;
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url || '/', 'http://localhost');
      let decoded: string;
      try { decoded = decodeURIComponent(url.pathname); }
      catch { res.statusCode = 400; res.end('Invalid URL'); return; }
      const projectPath = decoded.match(/^\/projects\/([^/]+)\/(.*)$/);
      if (configuredScope && projectPath && projectPath[1] !== configuredScope) {
        res.statusCode = 403; res.end('Project is outside the session scope'); return;
      }
      if (projectPath && process.env.FORGE_PROJECTS_ROOT) {
        const [, project, tail] = projectPath;
        if (!projectNamePattern.test(project) || tail.startsWith('/') || /[\\:\0]/.test(tail) || tail.split('/').some(part => part === '..' || part === '.')) {
          res.statusCode = 403; res.end('Invalid project path'); return;
        }
        const file = resolve(projectDirectory(root, project), tail || '.', ...(tail.endsWith('/') || !tail ? ['index.html'] : []));
        req.url = '/@fs/' + normalizePath(file).split('/').map(encodeURIComponent).join('/').replace(/^([A-Z])%3A/i, '$1:') + url.search;
        return next();
      }
      if (!url.pathname.startsWith('/api/')) return next();
      const send = (value: unknown, code = 200) => {
        res.statusCode = code; res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(value));
      };
      if (url.pathname === FORGE_HEALTH_PATH) return send({ app: FORGE_APP_ID, protocolVersion: 2,
        runtimeVersion: '2.0.0', workspaceId: workspaceId(root), instanceId, mode: configuredScope ? 'project' : 'global', scope: configuredScope });
      if (url.pathname !== '/api/catalog') return send({ error: 'Unknown API route' }, 404);
      try {
        const assets: any[] = [], projects: any[] = [];
        const requestedScope = url.searchParams.get('project');
        if (configuredScope && requestedScope && requestedScope !== configuredScope) return send({ error: 'Project is outside the session scope' }, 403);
        const scope = configuredScope || requestedScope;
        if (scope && !projectNamePattern.test(scope)) return send({ error: 'Invalid project' }, 403);
        for (const name of projectNames(root)) {
          if (scope && name !== scope) continue;
          const dir = projectDirectory(root, name);
          const sandboxDir = resolve(dir, 'sandboxes');
          const sandboxes = existsSync(sandboxDir) ? (await readdir(sandboxDir, { withFileTypes: true }))
            .filter(sb => sb.isDirectory() && existsSync(resolve(sandboxDir, sb.name, 'index.html'))).map(sb => sb.name).sort() : [];
          for (const file of await scan(resolve(dir, 'assets'))) {
            const format = extname(file).slice(1).toLowerCase();
            if (!['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(format)) continue;
            const info = await stat(file);
            const subpath = relative(resolve(dir, 'assets'), file).replace(/\\/g, '/');
            assets.push({ project: name, subpath, filename: subpath.split('/').pop(), format,
              ...(process.env.FORGE_PROJECTS_ROOT ? { absolutePath: file } : {}),
              size: info.size, mtime: info.mtimeMs, url: '/projects/' + [name, 'assets', ...subpath.split('/')].map(encodeURIComponent).join('/') });
          }
          projects.push({ name, sandboxes, assetCount: assets.filter(a => a.project === name).length,
            sourceCount: (await scan(resolve(dir, 'source'))).filter(f => /\.[tj]s$/.test(f)).length });
        }
        const sandbox = url.searchParams.get('sandbox');
        let compositionRevision = '';
        if (sandbox && scope) {
          if (!/^[a-zA-Z0-9_-]+$/.test(sandbox)) return send({ error: 'Invalid sandbox' }, 403);
          const dir = projectDirectory(root, scope);
          const files = [...await scan(resolve(dir, 'sandboxes', sandbox)), ...await scan(resolve(dir, 'source')), ...await scan(resolve(root, 'core'))].filter(f => /\.(html|css|[tj]s)$/.test(f));
          compositionRevision = JSON.stringify(await Promise.all(files.map(async path => {
            const info = await stat(path); return [relative(root, path), info.mtimeMs, info.size];
          })));
        }
        send({ schemaVersion: 2, revision: createHash('sha256').update(JSON.stringify([assets, projects])).digest('hex'), assets, projects, compositionRevision });
      } catch (error: any) { send({ error: error.message }, 500); }
    });
  }};
}
