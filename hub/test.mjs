import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { createRequire } from 'node:module';
import { forge2d, root } from './workspace.mjs';

const { chromium } = createRequire(join(forge2d, 'package.json'))('playwright');
const runtime = join(root, '.runtime');
await mkdir(runtime, { recursive: true });
const library = await mkdtemp(join(runtime, 'hub-test-'));
const child = spawn(process.execPath, ['hub/server.mjs'], {
  cwd: root,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  env: { ...process.env, ASSET_LIBRARY_ROOT: library, FORGE_PORT: '0', PYTHONDONTWRITEBYTECODE: '1' },
});
child.stderr.pipe(process.stderr);
const exited = once(child, 'close');
let browser;

try {
  let timeout;
  const listening = new Promise(resolve => child.stdout.on('data', chunk => {
    const url = /Forja e biblioteca em (http:\/\/127\.0\.0\.1:\d+)\//.exec(chunk.toString())?.[1];
    if (url) resolve(url);
  }));
  const neverReady = new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Workspace startup timed out')), 30000); });
  const origin = await Promise.race([listening, neverReady, exited.then(([code]) => { throw new Error(`Workspace exited: ${code}`); })])
    .finally(() => clearTimeout(timeout));
  const request = async (path, options) => {
    const response = await fetch(origin + path, options);
    const body = await response.json();
    assert.ok(response.ok, `${path}: ${JSON.stringify(body)}`);
    return body;
  };
  const send = method => (path, body) => request(path, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const post = send('POST');
  const project = 'smoke-test';
  const job = async (engine, action, options = {}) => {
    const result = await post('/api/job', { engine, action, project, ...options });
    assert.ok(result.ok, `${engine} ${action}\n${result.stdout}\n${result.stderr}`);
  };
  const projectDir = join(library, 'generated', 'projects', project);
  await job('2d', 'init');
  await job('2d', 'create', { asset: 'icons/key', mode: 'pixel', size: '16x16' });
  const source = join(projectDir, '2d', 'source', 'icons', 'key.ts');
  const original = await readFile(source, 'utf8');
  await writeFile(source, original.replace('pc.render(ctx);', 'pc.render(ctx);\n    ctx.fillStyle = "#9fd18b";\n    ctx.fillRect(4, 4, 8, 8);'));
  await job('2d', 'check');
  await job('2d', 'export', { asset: 'icons/key' });
  const png = await readFile(join(projectDir, '2d', 'assets', 'icons', 'key.png'));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  await job('2d', 'sandbox');

  await job('3d', 'init', { asset: 'crate', mode: 'box' });
  for (const step of ['model', 'uv', 'texture', 'animation', 'export']) await job('3d', step, { asset: 'crate' });
  const glb = await readFile(join(projectDir, '3d', 'assets', 'crate', 'exports', 'crate.glb'));
  assert.equal(glb.subarray(0, 4).toString(), 'glTF');
  const workbench = await request('/api/workbench');
  assert.deepEqual(workbench.projects, [project]);
  assert.equal(workbench.three[0].id, project);
  assert.equal(workbench.three[0].assets[0].id, 'crate');
  assert.equal(workbench.two[0].assets[0], 'icons/key.png');

  const imported = 'Textures/Meu pacote/importada.png';
  await request('/api/import?' + new URLSearchParams({ path: imported }), { method: 'PUT', body: png });
  const duplicate = await fetch(origin + '/api/import?' + new URLSearchParams({ path: imported }), { method: 'PUT', body: png });
  assert.equal(duplicate.status, 409);
  const moved = 'Masks/Meu pacote/importada.png';
  await post('/api/move', { from: imported, to: moved });
  const catalog = (await request('/api/library')).entries;
  const record = catalog.find(file => file.path === moved);
  assert.equal(record.category, 'Masks');
  assert.equal(catalog.filter(file => file.project === project).length > 2, true);
  const range = await fetch(origin + record.url, { headers: { Range: 'bytes=0-7' } });
  assert.equal(range.status, 206);
  assert.ok(Buffer.from(await range.arrayBuffer()).equals(png.subarray(0, 8)));
  const effect = `[gd_scene format=3]
[sub_resource type="ParticleProcessMaterial" id="motion"]
direction = Vector3(0, 1, 0)
initial_velocity_min = 1.0
initial_velocity_max = 2.0
[sub_resource type="BoxMesh" id="mesh"]
size = Vector3(0.1, 0.1, 0.1)
[node name="Stage" type="Node3D"]
[node name="Burst" type="GPUParticles3D" parent="."]
amount = 12
lifetime = 0.7
one_shot = true
process_material = SubResource("motion")
draw_pass_1 = SubResource("mesh")
`;
  for (const [category, name, contents] of [['Animations', 'crate.glb', glb], ['Smokes', 'license.txt', 'fixture'],
    ['FX', 'fixture/effects/burst.tscn', effect]]) {
    await request('/api/import?' + new URLSearchParams({ path: category + '/' + name }), { method: 'PUT', body: contents });
  }
  for (let index = 0; index < 35; index++) {
    await writeFile(join(library, 'Textures', `test-${index}.png`), png);
  }
  console.log('Catálogo, importação e etapas 2D/3D concluídos.');

  browser = await chromium.launch({ headless: true, ...(process.env.FORGE_BROWSER ? { executablePath: process.env.FORGE_BROWSER } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
  page.setDefaultTimeout(10000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Biblioteca de assets' }).waitFor();
  await page.getByRole('searchbox', { name: 'Buscar assets' }).fill('importada');
  await page.getByRole('button', { name: /importada\.png/ }).click();
  await page.locator('#inspector img[alt="importada.png"]').waitFor();
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await page.locator('input[name="files"]').setInputFiles({ name: 'via-ui.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Importar arquivos' }).click();
  await page.getByRole('button', { name: /via-ui\.png/ }).waitFor();
  await page.getByRole('searchbox', { name: 'Buscar assets' }).fill('');
  await page.locator('#gallery-end').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelectorAll('#gallery-items [data-file]').length > 30);
  await page.getByRole('button', { name: 'Fumaça', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: /license\.txt/ }).count(), 0);
  await page.getByRole('checkbox', { name: 'Mostrar arquivos auxiliares' }).check();
  await page.getByRole('button', { name: /license\.txt/ }).waitFor();
  await page.getByRole('combobox', { name: 'Origem' }).selectOption('');
  await page.getByRole('button', { name: 'Modelos 3D', exact: true }).click();
  await page.locator('[data-model-thumb] img').first().waitFor();
  await page.getByRole('button', { name: /crate\.glb/ }).click();
  await page.locator('#sample-preview canvas').waitFor();
  assert.equal(await page.locator('#main-model').count(), 0);
  await page.getByRole('button', { name: 'Ver detalhes' }).click();
  const detail = page.frameLocator('.model-native-frame');
  await detail.getByRole('tab', { name: 'Rig', exact: true }).waitFor();
  await detail.locator('#canvas-container canvas').waitFor();
  await detail.getByRole('tab', { name: 'Detalhes', exact: true }).click();
  await detail.locator('#model-details').waitFor();
  await page.getByRole('button', { name: 'Rigs e animações', exact: true }).click();
  await page.locator('#clip-tree [data-clip]').first().click();
  await page.locator('#rig-viewport canvas').waitFor();
  await page.getByRole('button', { name: 'Pausar', exact: true }).waitFor();
  await page.getByRole('button', { name: 'FX', exact: true }).click();
  await page.locator('#fx-stage canvas').waitFor();
  await page.getByRole('button', { name: 'Reiniciar efeito' }).click();
  console.log('Biblioteca, rolagem, miniaturas e player verificados.');
  await page.getByRole('button', { name: 'Forja 2D', exact: true }).click();
  const two = page.frameLocator('iframe');
  await two.locator('.asset-card').first().click();
  await two.getByRole('tab', { name: 'Detalhes', exact: true }).click();
  await two.getByText('16 × 16 px', { exact: true }).last().waitFor();
  await page.getByRole('button', { name: 'Forja 3D', exact: true }).click();
  const three = page.frameLocator('iframe');
  await three.getByRole('combobox', { name: 'Projeto', exact: true }).selectOption('smoke-test');
  await three.locator('.model-card').first().click();
  await three.getByRole('tab', { name: 'Rig', exact: true }).waitFor();
  assert.deepEqual(pageErrors, []);
  console.log('Workspace OK: visualizadores originais, detalhes 2D e rig 3D.');
} finally {
  await browser?.close();
  if (child.connected) child.disconnect();
  await exited;
  if (library.startsWith(runtime + sep + 'hub-test-')) await rm(library, { recursive: true, force: true });
}
