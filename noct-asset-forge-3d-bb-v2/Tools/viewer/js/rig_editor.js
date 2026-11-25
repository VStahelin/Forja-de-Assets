class RigEditor {
    constructor(sceneSetup) {
        this.sceneSetup = sceneSetup;
        this.overlay = new RigOverlay(sceneSetup, id => this.select(id, true));
        this.mode = 'pose';
        this.showOverlay = true;
        this.active = false;
        this.element = id => document.getElementById('rig-' + id);
        this.element('search').oninput = () => this.renderTree();
        this.element('overlay-toggle').onchange = event => {
            this.showOverlay = event.target.checked;
            if (!this.showOverlay) this.overlay.hide();
        };
        document.querySelectorAll('[data-rig-mode]').forEach(button =>
            button.onclick = () => this.setMode(button.dataset.rigMode));
        this.element('reset-joint').onclick = () => this.resetJoint();
        this.element('neutral').onclick = () => this.usePose(new Map(), 'Pose zerada.');
        this.element('from-frame').onclick = () => this.usePose(this.sourceFrame, 'Pose copiada do quadro da animação.');
        this.element('pose-name').onkeydown = event => {
            if (event.key === 'Enter') this.savePose();
        };
        this.element('save-pose').onclick = () => this.savePose();
        this.element('poses').onchange = () => this.updateLibraryActions();
        this.element('apply-pose').onclick = () => {
            const pose = this.selectedPose();
            if (pose) this.usePose(new Map(pose.frame), `Pose “${pose.name}” aplicada.`);
        };
        this.element('remove-pose').onclick = () => {
            const pose = this.selectedPose();
            if (!pose) return;
            this.rig.library = this.rig.library.filter(item => item !== pose);
            this.persist(`Pose “${pose.name}” removida.`);
            this.renderLibrary();
        };
        this.element('export').onclick = () => this.download();
    }

    get isEditing() { return this.active && this.editable; }

    setTarget(asset, identity = '', textureInput = null) {
        const selection = this.identity === identity ? this.selection : null;
        this.active = false;
        this.overlay.hide();
        this.identity = identity;
        this.rig = asset ? new RigDocument(asset, identity) : null;
        this.textureInput = textureInput;
        this.playback = null;
        this.sourceFrame = null;
        this.editable = asset?.kind === 'bbmodel' && !!this.rig.entries.size;
        this.selection = this.rig?.entries.has(selection) ? selection : this.rig?.entries.keys().next().value;
        if (this.editable && this.rig.rest.size) this.rig.applyRest();
        this.element('search').value = '';
        this.element('pose-name').value = '';
        this.status(this.rig?.sourceChanged ? 'O rig de origem mudou desde o último rascunho.' : '');
    }

    setActive(enabled) {
        if (enabled === this.active) return;
        this.active = enabled;
        if (this.editable) {
            const clips = this.rig.asset.clips;
            if (enabled) {
                this.playback = ForgeSession.playbackSnapshot(clips);
                this.sourceFrame = clips.clip ? this.rig.capturePose() : null;
                this.rig.pose ??= this.sourceFrame || new Map();
                clips.basePose();
                this.preview();
            } else {
                ForgeSession.restorePlayback(clips, this.playback);
                this.playback = null;
            }
        }
        if (enabled) this.render();
        else this.overlay.hide();
    }

    update() {
        const visible = this.active && this.showOverlay && this.rig?.entries.size && this.sceneSetup.modelGroup.visible;
        if (visible) this.overlay.draw(this.rig, this.selection);
        else if (!this.overlay.canvas.hidden) this.overlay.hide();
    }

    setMode(mode) {
        this.mode = mode;
        this.preview();
        this.render();
    }

    preview() {
        this.rig.previewPose(this.mode === 'pose' ? this.rig.pose : null);
    }

    render() {
        const count = this.rig?.entries.size || 0;
        this.element('count').textContent = count === 1 ? '1 junta' : `${count} juntas`;
        this.element('browser').hidden = !count;
        this.element('modes').hidden = !this.editable;
        this.element('editing').hidden = !this.editable;
        this.element('empty').hidden = !!count && this.editable;
        this.element('empty').textContent = count ? 'Abra o BBModel de origem para editar este rig.' :
            this.rig ? 'Este modelo não tem juntas ou controles de transformação.' : 'Abra um modelo para visualizar o rig.';
        document.querySelectorAll('[data-rig-mode]').forEach(button => {
            const active = button.dataset.rigMode === this.mode;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        this.element('pose-tools').hidden = this.mode !== 'pose';
        this.element('from-frame').disabled = this.sourceFrame === null;
        this.renderTree();
        this.renderJoint();
        this.renderLibrary();
    }

    renderTree() {
        const tree = this.element('tree');
        const query = this.element('search').value.trim().toLocaleLowerCase();
        const rows = document.createDocumentFragment();
        for (const entry of this.rig?.entries.values() || []) {
            if (!(entry.path || entry.id).toLocaleLowerCase().includes(query)) continue;
            const row = document.createElement('button');
            row.type = 'button';
            row.dataset.rigJoint = entry.id;
            row.style.setProperty('--rig-depth', Math.min(entry.depth, 9));
            row.title = entry.path;
            row.textContent = entry.object.name || 'Junta';
            row.setAttribute('aria-label', row.textContent);
            row.onclick = () => this.select(entry.id);
            rows.append(row);
        }
        this.element('no-results').hidden = rows.childElementCount > 0;
        tree.replaceChildren(rows);
        this.markSelection();
    }

    markSelection(fromViewport = false) {
        for (const row of this.element('tree').children) {
            const selected = row.dataset.rigJoint === this.selection;
            row.setAttribute('aria-pressed', String(selected));
            row.classList.toggle('active', selected);
            if (fromViewport && selected) row.scrollIntoView({ block: 'nearest' });
        }
    }

    select(id, fromViewport = false) {
        if (!this.rig?.entries.has(id)) return;
        this.selection = id;
        this.markSelection(fromViewport);
        this.renderJoint();
    }

    renderJoint() {
        const entry = this.rig?.entries.get(this.selection);
        const name = this.element('joint-name');
        name.textContent = entry?.object.name || 'Junta';
        name.title = entry?.path || '';
        this.element('joint-kind').textContent = entry?.control ? (entry.native ? 'Osso' : 'Grupo') : 'Osso';
        this.element('selection').hidden = !entry;
        const fields = this.element('fields');
        fields.replaceChildren();
        if (!this.editable || !entry) return;

        const restMode = this.mode === 'rest';
        const rest = this.rig.restValues(entry);
        const pose = this.rig.pose?.get(entry.id) || {};
        this.element('reset-joint').hidden = entry.locked;
        this.element('locked').hidden = !entry.locked;
        const linked = restMode && entry.native && entry.parent?.native;
        fields.append(this.vectorFields(restMode ? 'Pivô local' : 'Deslocamento local', 'position',
            restMode ? rest.position : pose.position || RIG_DEFAULTS.position, entry, linked && rest.connected));
        fields.append(this.vectorFields(restMode ? 'Rotação de repouso (°)' : 'Rotação (°)', 'rotation',
            restMode ? rest.rotation : pose.rotation || RIG_DEFAULTS.rotation, entry));
        if (!restMode) fields.append(this.vectorFields('Escala', 'scale', pose.scale || RIG_DEFAULTS.scale, entry));
        if (restMode && entry.native) {
            const length = this.numberField('Comprimento', rest.length, entry.locked, 0.1);
            length.min = '0.00000001';
            length.onchange = () => {
                if (!length.validity.valid || !Number.isFinite(length.valueAsNumber)) length.value = this.rig.restValues(entry).length;
                else this.editRest(entry, { length: length.valueAsNumber });
            };
            const label = document.createElement('label');
            label.className = 'rig-bone-length';
            label.append('Comprimento', length);
            fields.append(label);
        }
        if (linked) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = rest.connected;
            checkbox.disabled = entry.locked;
            checkbox.onchange = () => {
                // Keep the current joint position when it is detached from its parent's tip.
                this.editRest(entry, { connected: checkbox.checked, position: this.rig.restValues(entry).position });
                this.renderJoint();
                this.element('fields').querySelector('input[type=checkbox]')?.focus();
            };
            const label = document.createElement('label');
            label.className = 'rig-toggle';
            label.append(checkbox, ' Encaixar na ponta do pai');
            fields.append(label);
        }
    }

    numberField(label, value, disabled, step = 'any') {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = 'any';
        input.value = String(Number(value.toFixed(7)));
        input.disabled = disabled;
        input.setAttribute('aria-label', label);
        if (step !== 'any') input.dataset.step = step;
        input.onkeydown = event => {
            if (event.key === 'Enter') input.blur();
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            const increment = Number(input.dataset.step) || 0.1;
            const value = input.valueAsNumber + (event.key === 'ArrowUp' ? increment : -increment);
            if (!Number.isFinite(value) || (input.min && value < Number(input.min))) return;
            input.value = String(Number(value.toFixed(7)));
            input.dispatchEvent(new Event('change'));
        };
        return input;
    }

    vectorFields(title, channel, values, entry, disabled = false) {
        const group = document.createElement('fieldset');
        group.className = 'rig-vector';
        const legend = document.createElement('legend');
        legend.textContent = title;
        group.append(legend);
        for (const [axis, label] of ['X', 'Y', 'Z'].entries()) {
            const column = document.createElement('label');
            const name = `${title} ${label}`;
            const input = this.numberField(name, values[axis], disabled || entry.locked, channel === 'rotation' ? 1 : 0.1);
            let range;
            if (this.mode === 'pose' && channel === 'rotation') {
                range = document.createElement('input');
                range.type = 'range';
                range.min = '-180';
                range.max = '180';
                range.step = '1';
                range.value = input.value;
                range.disabled = input.disabled;
                range.setAttribute('aria-label', `Ajustar rotação ${label}`);
                range.oninput = () => {
                    input.value = range.value;
                    this.editVector(entry, channel, axis, range.valueAsNumber, false);
                };
                range.onchange = () => this.persist();
            }
            input.onchange = () => {
                if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) {
                    input.value = this.currentVector(entry, channel)[axis];
                    return;
                }
                if (range) range.value = input.value;
                this.editVector(entry, channel, axis, input.valueAsNumber);
            };
            column.append(label, input);
            if (range) column.append(range);
            group.append(column);
        }
        return group;
    }

    currentVector(entry, channel) {
        if (this.mode === 'rest') return this.rig.restValues(entry)[channel];
        return this.rig.pose.get(entry.id)?.[channel] || RIG_DEFAULTS[channel];
    }

    editVector(entry, channel, axis, value, commit = true) {
        const values = [...this.currentVector(entry, channel)];
        values[axis] = value;
        if (this.mode === 'rest') this.editRest(entry, { [channel]: values });
        else {
            const offsets = { ...this.rig.pose.get(entry.id), [channel]: values };
            this.rig.pose.set(entry.id, offsets);
            // Coalesce slider changes to one skin update per animation frame.
            if (!commit) {
                if (this.previewFrame) return;
                const rig = this.rig;
                this.previewFrame = requestAnimationFrame(() => {
                    this.previewFrame = null;
                    if (this.isEditing && this.rig === rig) this.preview();
                });
                return;
            }
            this.preview();
            this.persist();
        }
    }

    editRest(entry, change) {
        this.rig.rest.set(entry.id, { ...this.rig.rest.get(entry.id), ...change });
        this.rig.applyRest();
        this.persist();
    }

    resetJoint() {
        if (this.mode === 'rest') {
            this.rig.rest.delete(this.selection);
            this.rig.applyRest();
        } else {
            this.rig.pose.delete(this.selection);
            this.preview();
        }
        this.persist('Junta restaurada.');
        this.renderJoint();
    }

    usePose(pose, message) {
        if (!pose) return;
        this.rig.pose = new Map(pose);
        this.preview();
        this.persist(message);
        this.renderJoint();
    }

    savePose() {
        const input = this.element('pose-name');
        const name = input.value.trim();
        if (!name) {
            this.status('Dê um nome para a pose.');
            input.focus();
            return;
        }
        if (this.rig.library.some(pose => pose.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
            this.status('Já existe uma pose com esse nome.');
            input.select();
            return;
        }
        const id = crypto.randomUUID();
        this.preview();
        this.rig.library.push({ id, name, frame: [...this.rig.capturePose()] });
        input.value = '';
        this.persist(`Pose “${name}” guardada.`);
        this.renderLibrary(id);
    }

    selectedPose() {
        return this.rig?.library.find(pose => pose.id === this.element('poses').value);
    }

    renderLibrary(selection = this.element('poses').value) {
        const select = this.element('poses');
        const library = this.rig?.library || [];
        select.replaceChildren(...library.map(pose => new Option(pose.name, pose.id)));
        if (library.some(pose => pose.id === selection)) select.value = selection;
        select.disabled = !library.length;
        this.element('pose-list').hidden = !library.length;
        this.updateLibraryActions();
    }

    updateLibraryActions() {
        const disabled = !this.selectedPose();
        this.element('apply-pose').disabled = disabled;
        this.element('remove-pose').disabled = disabled;
    }

    persist(message = '') {
        this.status(this.rig.saveDraft() ? message : 'Rascunho indisponível no navegador. Baixe o BBModel para guardar as alterações.');
    }

    status(message) { this.element('status').textContent = message; }

    async download() {
        if (!this.editable) return;
        const rig = this.rig;
        const button = this.element('export');
        button.disabled = true;
        this.status('Preparando BBModel…');
        try {
            const model = rig.compile();
            const missing = await embedRigTextures(model, this.textureInput);
            const url = URL.createObjectURL(new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = (model.name || 'modelo').replace(/[<>:"/\\|?*]/g, '_') + '-rig.bbmodel';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            if (this.rig === rig) this.status(missing ? `Cópia baixada. ${missing} textura(s) indisponível(is).` : 'Cópia do BBModel baixada.');
        } catch (error) {
            if (this.rig === rig) this.status(`Falha ao baixar o BBModel. ${error.message}`);
        } finally {
            button.disabled = false;
        }
    }
}
