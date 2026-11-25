import { launch, projects, projectPath } from './workspace.mjs';

const [engine, operation, ...rest] = process.argv.slice(2);
if (!['2d', '3d'].includes(engine) || !operation || operation === '--help') {
  console.log('2D: npm run forge -- 2d <new-project|new-asset|new-sandbox|list|check|export|inspect|capture> ...');
  console.log('3D: npm run forge -- 3d <init|model|uv|texture|animation|export|status|view|...> <projeto> [opções]');
  console.log('3D avançado: npm run forge -- 3d raw <argumentos do CLI, incluindo caminhos absolutos>');
} else {
  try {
    let args = [operation, ...rest];
    if (engine === '3d') {
      const [id, ...flags] = rest;
      if (operation === 'raw') args = rest;
      else if (!id && operation === 'view') args = ['view', '--all', '--projects-root', projects];
      else if (!id && operation === 'doctor') args = ['doctor'];
      else {
        const target = projectPath(id || '', '3d');
        if (operation === 'init') args = ['project', 'init', target, '--project-id', id, ...flags];
        else if (operation === 'new-asset') args = ['asset', 'init', target, '--animation', ...flags];
        else args = [operation, target, ...flags];
      }
    }
    const child = launch(engine, args, { stdio: 'inherit' });
    child.on('error', error => { console.error(error.message); process.exitCode = 1; });
    child.on('exit', code => { process.exitCode = code ?? 1; });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
