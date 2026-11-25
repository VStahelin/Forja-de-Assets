/* Statistics for the geometry of the loaded model, independently of inspector overlays. */
function surfaceTopology(mesh, bbmodel) {
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    const index = geometry.index;
    const vertexKeys = bbmodel ? mesh.userData.vertexKeys : null;
    const vertices = new Map();
    const edges = new Set();
    const stats = { vertices: 0, bufferVertices: positions.count, edges: 0, faces: 0,
        triangularFaces: 0, quads: 0, ngons: 0, triangles: 0 };

    function vertexAt(offset) {
        const vertex = index ? index.getX(offset) : offset;
        const key = vertexKeys?.[vertex] ?? `${positions.getX(vertex)},${positions.getY(vertex)},${positions.getZ(vertex)}`;
        if (!vertices.has(key)) vertices.set(key, vertices.size);
        return vertices.get(key);
    }

    function countFace(perimeter) {
        stats.faces++;
        if (perimeter.length === 3) stats.triangularFaces++;
        else if (perimeter.length === 4) stats.quads++;
        else stats.ngons++;
        for (let i = 0; i < perimeter.length; i++) {
            const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
            if (a !== b) edges.add(a < b ? `${a}:${b}` : `${b}:${a}`);
        }
    }

    if (bbmodel) {
        // Each parser group is one native face, stored as a triangle fan in the draw buffer.
        for (const { start, count } of geometry.groups) {
            if (count < 3) continue;
            const perimeter = [vertexAt(start), vertexAt(start + 1)];
            for (let offset = start + 2; offset < start + count; offset += 3) {
                perimeter.push(vertexAt(offset));
                stats.triangles++;
            }
            countFace(perimeter);
        }
    } else {
        const start = geometry.drawRange.start;
        const end = Math.min(index?.count ?? positions.count, start + geometry.drawRange.count);
        for (let offset = start; offset + 2 < end; offset += 3) {
            countFace([vertexAt(offset), vertexAt(offset + 1), vertexAt(offset + 2)]);
            stats.triangles++;
        }
    }
    stats.vertices = vertices.size;
    stats.edges = edges.size;
    return stats;
}

function modelStatistics(asset) {
    const stats = { vertices: 0, bufferVertices: 0, edges: 0, faces: 0, triangularFaces: 0,
        quads: 0, ngons: 0, triangles: 0, meshes: 0, cubes: 0, skinnedMeshes: 0, bones: 0,
        groups: 0, armatures: 0, lines: 0, points: 0 };
    const materials = new Set();
    const nativeSkins = new Set(asset.parser?.skinnedMeshes?.map(binding => binding.mesh));
    asset.object.traverse(node => {
        const { kind, internal } = node.userData;
        if (internal) return;
        if (node.isBone || kind === 'bone') stats.bones++;
        else if (kind === 'armature') stats.armatures++;
        else if (node !== asset.object && node.isGroup && kind === 'group') stats.groups++;
        if (node.isLine) stats.lines++;
        if (node.isPoints) stats.points++;
        if (!node.isMesh || !node.geometry?.attributes.position) return;

        const instances = node.isInstancedMesh ? node.count : 1;
        stats.meshes += instances;
        if (kind === 'cube') stats.cubes += instances;
        if (node.isSkinnedMesh || nativeSkins.has(node)) stats.skinnedMeshes += instances;
        const topology = surfaceTopology(node, asset.kind === 'bbmodel');
        for (const [key, count] of Object.entries(topology)) stats[key] += count * instances;

        if (Array.isArray(node.material)) {
            for (const { materialIndex, count } of node.geometry.groups) {
                if (count && node.material[materialIndex]) materials.add(node.material[materialIndex]);
            }
        } else if (node.material && topology.triangles) {
            materials.add(node.material);
        }
    });
    return { ...stats, materials: materials.size };
}

function sourceMetadata(asset) {
    if (asset.kind === 'glb') return asset.gltf?.parser?.json || {};
    const { elements = [], textures = [], ...settings } = asset.modelData;
    return {
        ...settings,
        elements: elements.map(({ vertices, faces, vertex_weights, ...metadata }) => metadata),
        textures: textures.map(({ source, ...metadata }) => ({
            ...metadata, ...(source ? { source: source.startsWith('data:') ? '[dados incorporados]' : source } : {})
        }))
    };
}

class ModelDetails {
    constructor() {
        this.content = document.getElementById('model-details-content');
        this.empty = document.getElementById('model-details-empty');
        this.numbers = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
    }

    setTarget(asset, file = {}) {
        this.asset = asset;
        this.file = file;
        this.rendered = false;
        this.content.replaceChildren();
        this.content.hidden = !asset;
        this.empty.hidden = Boolean(asset);
    }

    section(title, entries, className) {
        const rows = entries.filter(([, value]) => value !== undefined && value !== null && value !== '');
        if (!rows.length) return;
        const section = document.createElement('section');
        section.className = className || 'model-details-section';
        const heading = document.createElement('h3');
        heading.textContent = title;
        const list = document.createElement('dl');
        for (const [label, value, field] of rows) {
            const term = document.createElement('dt');
            const description = document.createElement('dd');
            term.textContent = label;
            description.textContent = typeof value === 'number' ? this.numbers.format(value) : value;
            if (field) description.dataset.detail = field;
            list.append(term, description);
        }
        section.append(heading, list);
        this.content.append(section);
        return section;
    }

    render() {
        if (!this.asset || this.rendered) return;
        this.rendered = true;
        const asset = this.asset;
        const stats = modelStatistics(asset);
        const bbmodel = asset.kind === 'bbmodel';
        const data = bbmodel ? asset.modelData : asset.gltf?.parser?.json || {};
        const file = this.file;
        const vector = values => values?.map(value => this.numbers.format(value)).join(' × ');
        const geometry = this.section('Geometria', [
            ['Vértices', stats.vertices, 'vertices'], ['Arestas', stats.edges, 'edges'],
            ['Polígonos', stats.faces, 'faces'], ['Triângulos renderizados', stats.triangles, 'triangles']
        ], 'model-details-section geometry-details');
        const note = document.createElement('p');
        note.className = 'detail-note';
        note.textContent = bbmodel ? 'As arestas seguem o contorno dos polígonos de cada malha.' : 'As arestas do GLB incluem as diagonais da triangulação.';
        geometry.append(note);
        this.section('Topologia', [
            ['Faces triangulares', stats.triangularFaces], ['Faces quadrangulares', stats.quads],
            ['Faces de 5 ou mais lados', stats.ngons], ['Vértices no buffer', stats.bufferVertices]
        ]);
        this.section('Dimensões', [
            ['Tamanho (X × Y × Z)', vector(asset.bbox?.size)],
            ['Centro (X, Y, Z)', asset.bbox?.center?.map(value => this.numbers.format(value)).join(' / ')],
            ['Limite mínimo', asset.bbox?.min?.map(value => this.numbers.format(value)).join(' / ')],
            ['Limite máximo', asset.bbox?.max?.map(value => this.numbers.format(value)).join(' / ')]
        ]);
        this.section('Estrutura', [
            ['Malhas', stats.meshes], ['Cubos', bbmodel ? stats.cubes : undefined],
            ['Grupos', bbmodel ? stats.groups : undefined], ['Nós', data.nodes?.length],
            ['Cenas', data.scenes?.length], ['Armaduras', bbmodel ? stats.armatures : data.skins?.length],
            ['Ossos', stats.bones], ['Malhas com skinning', stats.skinnedMeshes],
            ['Objetos de linha', stats.lines || undefined], ['Objetos de pontos', stats.points || undefined]
        ]);
        this.section('Arquivo', [
            ['Nome', file.name], ['Formato', asset.kind.toUpperCase(), 'format'],
            ['Versão do formato', data.meta?.format_version ?? data.asset?.version],
            ['Tipo de modelo', data.meta?.model_format], ['Identificador', data.model_identifier],
            ['Gerador', data.asset?.generator], ['Direitos autorais', data.asset?.copyright],
            ['Projeto', file.project], ['Caminho', file.path, 'path'],
            ['Tamanho do arquivo', file.stamp ? `${this.numbers.format(file.stamp[1])} bytes` : undefined],
            ['Modificado em', file.stamp ? new Date(Number(file.stamp[0]) / 1e6).toLocaleString('pt-BR') : undefined]
        ]);

        const textures = data.textures || [];
        const images = data.images || [];
        const resolution = data.resolution;
        this.section('Materiais e texturas', [
            ['Materiais em uso', stats.materials], ['Texturas declaradas', textures.length],
            ['Imagens', bbmodel ? undefined : images.length], ['Variante', file.variant],
            ['Resolução UV', resolution ? `${resolution.width} × ${resolution.height} px` : undefined],
            ...textures.map((texture, index) => {
                const image = bbmodel ? asset.parser?.textureList?.[index]?.image : null;
                const uri = images[texture.source]?.uri;
                const name = texture.name || images[texture.source]?.name || (uri?.startsWith('data:') ? '' : uri);
                const width = image?.width || texture.width, height = image?.height || texture.height;
                const size = width && height ? `${width} × ${height} px` : '';
                return [`Textura ${index + 1}`, [name, size].filter(Boolean).join(' · ') || 'Sem nome'];
            })
        ]);

        const clips = bbmodel ? data.animations || [] : asset.gltf?.animations || [];
        this.section('Animação', [
            ['Clipes', clips.length],
            ...clips.map((clip, index) => [clip.name || `Clipe ${index + 1}`,
                `${this.numbers.format(bbmodel ? clip.length || 0 : clip.duration)} s${clip.loop ? ` · ${clip.loop}` : ''}`])
        ]);

        const metadata = document.createElement('details');
        metadata.className = 'model-source-metadata';
        const summary = document.createElement('summary');
        summary.textContent = 'Metadados do arquivo (JSON)';
        const json = document.createElement('pre');
        metadata.addEventListener('toggle', () => {
            if (metadata.open && !json.textContent) {
                json.textContent = JSON.stringify(sourceMetadata(asset), (_key, value) =>
                    typeof value === 'string' && value.startsWith('data:') ? '[dados incorporados]' : value, 2);
            }
        });
        metadata.append(summary, json);
        this.content.append(metadata);
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { modelStatistics, sourceMetadata };
