function libraryFiles(assets, glbs, glbUrl) {
    return [
        ...assets.map(asset => ({
            kind: 'bbmodel', id: asset.id, name: asset.name || asset.id,
            path: asset.model_path || `assets/${asset.id}/model.bbmodel`,
            available: Boolean(asset.stamp || asset.has_model),
            source: asset.stamp && { kind: 'bbmodel', modelUrl: asset.model_url },
            revision: asset.stamp, textureFilter: asset.texture_filter
        })),
        ...glbs.map(glb => ({
            kind: 'glb', id: glb.path, name: glb.path.split('/').pop(),
            path: `assets/${glb.path}`, available: true,
            source: { kind: 'glb', url: glbUrl(glb) }, revision: glb.stamp
        }))
    ].sort((a, b) => a.path.localeCompare(b.path, 'pt-BR', { numeric: true }));
}

function folderContains(folder, filePath) {
    return !folder || filePath.startsWith(folder + '/');
}

function parentFolder(path) {
    return path.split('/').slice(0, -1).join('/');
}

class AssetLibrary {
    constructor({ openFolder, openFile }) {
        this.openFolder = openFolder;
        this.openFile = openFile;
        this.expanded = new Set();
        this.tree = document.getElementById('explorer-tree');
        this.gallery = document.getElementById('project-overview-view');
        this.thumbnails = new AssetThumbnails();
    }

    folderKey(project, path) {
        return JSON.stringify([project, path]);
    }

    reveal(project, path) {
        this.expanded.add(this.folderKey(project, ''));
        let folder = '';
        for (const part of path.split('/').filter(Boolean)) {
            folder = folder ? folder + '/' + part : part;
            this.expanded.add(this.folderKey(project, folder));
        }
    }

    update(state) {
        this.state = state;
        this.matches = state.files.filter(file =>
            `${file.name} ${file.id} ${file.path}`.toLocaleLowerCase().includes(state.query));
        this.renderTree();
        if (state.folder !== null) this.renderGallery();
    }

    renderTree() {
        const { projects, project, viewKey, query, folder } = this.state;
        const signature = JSON.stringify([projects, project, viewKey, query, folder,
            this.matches.map(file => [file.path, file.name, file.available]), [...this.expanded]]);
        if (signature === this.treeSignature) return;
        this.treeSignature = signature;
        const focusedKey = this.tree.contains(document.activeElement) && document.activeElement.dataset.focusKey;
        const nodes = document.createDocumentFragment();
        for (const root of projects) {
            nodes.append(this.folderNode(root.id, '', root.name || root.id, 0, root.id === project ? this.matches : null));
        }
        this.tree.replaceChildren(nodes);
        if (focusedKey) {
            [...this.tree.querySelectorAll('[data-focus-key]')]
                .find(button => button.dataset.focusKey === focusedKey)?.focus({ preventScroll: true });
        }
    }

    folderNode(project, path, name, depth, files) {
        const wrapper = document.createElement('div');
        const row = document.createElement('div');
        row.className = 'explorer-folder';
        row.style.setProperty('--depth', depth);
        const { project: selectedProject, folder, query } = this.state;
        const activeProject = project === selectedProject;
        const key = this.folderKey(project, path);
        const canExpand = !activeProject || files?.length > 0;
        const expanded = activeProject && canExpand && (this.expanded.has(key) || !!query);
        const current = activeProject && path === folder;
        row.classList.toggle('selected', current);

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'explorer-chevron';
        toggle.textContent = expanded ? '▾' : '▸';
        toggle.dataset.focusKey = 'toggle:' + key;
        toggle.hidden = !canExpand;
        toggle.disabled = activeProject && !!query;
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.setAttribute('aria-label', `${expanded ? 'Recolher' : 'Expandir'} ${name}`);
        toggle.onclick = () => {
            if (!activeProject) this.openFolder(project, '');
            else {
                if (this.expanded.has(key)) this.expanded.delete(key);
                else this.expanded.add(key);
                this.renderTree();
            }
        };
        row.append(toggle);

        const button = this.rowButton(name, 'folder-symbol');
        button.classList.add('explorer-folder-label');
        button.dataset.folder = path;
        button.dataset.project = project;
        button.dataset.focusKey = 'folder:' + key;
        button.title = path || name;
        if (current) button.setAttribute('aria-current', 'location');
        button.onclick = () => this.openFolder(project, path);
        row.append(button);
        wrapper.append(row);
        if (!expanded) return wrapper;

        const children = document.createElement('div');
        children.className = 'explorer-children';
        children.style.setProperty('--depth', depth);
        const folders = new Map();
        const leaves = [];
        for (const file of files) {
            const relative = path ? file.path.slice(path.length + 1) : file.path;
            const slash = relative.indexOf('/');
            if (slash < 0) leaves.push(file);
            else {
                const name = relative.slice(0, slash);
                if (!folders.has(name)) folders.set(name, []);
                folders.get(name).push(file);
            }
        }
        for (const [name, descendants] of folders) {
            const childPath = path ? path + '/' + name : name;
            children.append(this.folderNode(project, childPath, name, depth + 1, descendants));
        }
        for (const file of leaves) children.append(this.fileNode(project, file, depth + 1));
        wrapper.append(children);
        return wrapper;
    }

    rowButton(name, iconClass) {
        const button = document.createElement('button');
        button.type = 'button';
        const icon = document.createElement('span');
        icon.className = iconClass;
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'asset-label';
        label.textContent = name;
        button.append(icon, label);
        return button;
    }

    fileNode(project, file, depth) {
        const button = this.rowButton(file.path.split('/').pop(), 'model-symbol');
        button.className = 'asset-item';
        button.style.setProperty('--depth', depth);
        button.dataset[file.kind === 'glb' ? 'glb' : 'asset'] = file.id;
        button.dataset.project = project;
        button.dataset.focusKey = `${project}:${file.path}`;
        button.title = file.name + ' · ' + file.path;
        button.setAttribute('aria-label', `${file.name} (${file.path})`);
        if (this.state.folder === null && this.state.viewKey === `${file.kind}:${file.id}`) {
            button.classList.add('selected');
            button.setAttribute('aria-current', 'true');
        }
        if (!file.available) button.classList.add('unavailable');
        button.onclick = () => this.openFile(file, project, false);
        return button;
    }

    hideGallery() {
        this.gallery.hidden = true;
        this.gallerySignature = null;
        this.thumbnails.clear();
    }

    invalidatePreviews() {
        this.gallerySignature = null;
        this.thumbnails.invalidate();
    }

    renderGallery() {
        const { project, projectName, folder, loading, error, query } = this.state;
        const files = this.matches.filter(file => folderContains(folder, file.path));
        const location = JSON.stringify([project, folder]);
        const signature = JSON.stringify([location, projectName, loading, error, query, files]);
        if (signature === this.gallerySignature) return;
        if (this.galleryLocation !== location) this.gallery.scrollTop = 0;
        this.galleryLocation = location;
        this.gallerySignature = signature;
        this.thumbnails.clear();

        const path = document.getElementById('gallery-path');
        const title = document.getElementById('gallery-title');
        const count = document.getElementById('gallery-count');
        const message = document.getElementById('gallery-message');
        const grid = document.getElementById('gallery-grid');
        const parts = folder ? folder.split('/') : [];
        title.textContent = parts.at(-1) || projectName || 'Biblioteca';
        count.textContent = files.length ? `${files.length} ${files.length === 1 ? 'modelo' : 'modelos'}` : '';
        path.replaceChildren();
        const ancestors = folder ? [projectName, ...parts.slice(0, -1)] : ['Biblioteca'];
        ancestors.forEach((name, index) => {
            const crumb = document.createElement(folder ? 'button' : 'span');
            crumb.textContent = name;
            if (folder) {
                crumb.type = 'button';
                crumb.onclick = () => this.openFolder(project, parts.slice(0, index).join('/'));
            }
            path.append(crumb);
        });
        message.hidden = !loading && !error && files.length > 0;
        message.textContent = error || (loading ? 'Carregando modelos…' :
            query ? 'Nenhum modelo nesta pasta corresponde à busca.' : 'Nenhum modelo nesta pasta.');
        grid.replaceChildren(...files.map(file => this.card(project, file)));
    }

    card(project, file) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'model-card';
        card.title = file.path;
        card.onclick = () => this.openFile(file, project, true);
        const preview = document.createElement('span');
        preview.className = 'model-preview';
        preview.textContent = file.available ? '' : 'Modelo ainda não gerado';
        const details = document.createElement('span');
        details.className = 'model-card-details';
        const name = document.createElement('strong');
        name.textContent = file.name;
        const kind = document.createElement('span');
        kind.className = 'model-format';
        kind.textContent = file.kind === 'glb' ? 'GLB' : 'BBModel';
        const filePath = document.createElement('small');
        filePath.textContent = file.path;
        details.append(name, kind, filePath);
        card.append(preview, details);
        if (file.source) this.thumbnails.add(preview, file.source, file.revision, file.textureFilter);
        return card;
    }
}
