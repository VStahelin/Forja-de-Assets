const RIG_DEFAULTS = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
const rigDegrees = radians => THREE.MathUtils.radToDeg(radians);

class RigDocument {
    constructor(asset, identity) {
        this.asset = asset;
        this.entries = new Map();
        const controls = asset.parser?.controls;
        if (controls) {
            for (const [id, control] of controls) {
                if (typeof id !== 'string' || !id) continue;
                const record = control.record;
                this.entries.set(id, {
                    id, object: control.object, control, native: record.type === 'armature_bone',
                    locked: record.locked === true,
                    position: record.origin || control.position.toArray(),
                    rotation: record.rotation || control.rotation.toArray().slice(0, 3).map(rigDegrees),
                    length: record.length > 0 ? record.length : 1, connected: record.connected === true
                });
            }
        } else {
            asset.object.traverse(object => {
                if (object.isBone) this.entries.set(object.uuid, { id: object.uuid, object });
            });
        }

        const byObject = new Map([...this.entries.values()].map(entry => [entry.object, entry]));
        for (const entry of this.entries.values()) {
            let ancestor = entry.object.parent;
            while (ancestor && !byObject.has(ancestor)) ancestor = ancestor.parent;
            entry.parent = byObject.get(ancestor);
            entry.path = entry.parent ? `${entry.parent.path} / ${entry.object.name}` : entry.object.name;
            entry.depth = entry.parent ? entry.parent.depth + 1 : 0;
        }

        this.storageKey = `noct3d.rig:${identity}`;
        this.signature = JSON.stringify([...this.entries.values()].map(entry => [
            entry.id, entry.object.name, entry.parent?.id, entry.native, entry.locked,
            entry.position, entry.rotation, entry.length, entry.connected
        ]));
        this.rest = new Map();
        this.pose = null;
        this.library = [];
        if (controls) this.readDraft();
    }

    readDraft() {
        try {
            const draft = JSON.parse(sessionStorage.getItem(this.storageKey));
            if (!draft) return;
            if (draft.signature !== this.signature) {
                this.sourceChanged = true;
                return;
            }
            this.rest = new Map(draft.rest);
            this.pose = draft.pose && new Map(draft.pose);
            this.library = draft.library;
        } catch {
            // The editor also works when browser storage is unavailable.
        }
    }

    saveDraft() {
        try {
            sessionStorage.setItem(this.storageKey, JSON.stringify({
                signature: this.signature, rest: [...this.rest],
                pose: this.pose && [...this.pose], library: this.library
            }));
            return true;
        } catch {
            return false;
        }
    }

    restValues(entry) {
        const edit = this.rest.get(entry.id);
        const length = edit?.length ?? entry.length;
        const connected = edit?.connected ?? entry.connected;
        const parentLength = this.rest.get(entry.parent?.id)?.length ?? entry.parent?.length;
        const snap = entry.native && entry.parent?.native && connected &&
            (edit?.connected !== undefined || parentLength !== entry.parent.length);
        return {
            position: snap ? [0, parentLength, 0] : edit?.position ?? entry.position,
            rotation: edit?.rotation ?? entry.rotation, length, connected
        };
    }

    applyRest() {
        if (!this.asset.parser) return;
        for (const entry of this.entries.values()) {
            const { control } = entry;
            const { position, rotation } = this.restValues(entry);
            control.position.fromArray(position);
            control.rotation.set(...rotation.map(THREE.MathUtils.degToRad), 'ZYX');
            if (!entry.native) control.container.position.copy(control.position).negate();
            AnimationPlayer.resetControl(control);
        }
        this.asset.parser.rebindSkinning();
    }

    capturePose() {
        const pose = new Map();
        for (const { id, control } of this.entries.values()) {
            const { object, position, rotation, scale } = control;
            const offsets = {
                position: object.position.clone().sub(position).toArray(),
                rotation: ['x', 'y', 'z'].map(axis => rigDegrees(object.rotation[axis] - rotation[axis])),
                scale: ['x', 'y', 'z'].map(axis => object.scale[axis] / scale[axis])
            };
            for (const channel of Object.keys(offsets)) {
                if (!offsets[channel].some((value, axis) => Math.abs(value - RIG_DEFAULTS[channel][axis]) > 1e-8)) {
                    delete offsets[channel];
                }
            }
            if (Object.keys(offsets).length) pose.set(id, offsets);
        }
        return pose;
    }

    previewPose(pose) {
        for (const { id, control } of this.entries.values()) {
            AnimationPlayer.resetControl(control);
            for (const [channel, values] of Object.entries(pose?.get(id) || {})) {
                AnimationPlayer.applyChannel(control, channel, values);
            }
        }
        this.asset.parser.updateSkinning();
    }

    compile() {
        const model = structuredClone(this.asset.modelData);
        const definitions = new Map();
        const visit = node => {
            if (!node || typeof node !== 'object') return;
            definitions.set(node.uuid, node);
            for (const child of node.children || []) visit(child);
        };
        for (const node of model.outliner || []) visit(node);
        for (const node of [...(model.elements || []), ...(model.groups || [])]) definitions.set(node.uuid, node);

        for (const entry of this.entries.values()) {
            const node = definitions.get(entry.id);
            const rest = this.restValues(entry);
            if (rest.position !== entry.position) node.origin = rest.position;
            if (rest.rotation !== entry.rotation) node.rotation = rest.rotation;
            if (entry.native && rest.length !== entry.length) node.length = rest.length;
            if (entry.native && rest.connected !== entry.connected) node.connected = rest.connected;
        }

        model.animations ||= [];
        const used = new Set(model.animations.map(clip => clip.name));
        for (const pose of this.library) {
            const slug = pose.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            const stem = 'pose.' + (slug || 'rig');
            let name = stem;
            for (let suffix = 2; used.has(name); suffix++) name = `${stem}_${suffix}`;
            used.add(name);
            const animators = Object.fromEntries((pose.frame.length ? pose.frame :
                [[this.entries.keys().next().value, { rotation: RIG_DEFAULTS.rotation }]]).map(([id, values]) => {
                const entry = this.entries.get(id);
                const keyframes = Object.entries(values).map(([channel, [x, y, z]]) => ({
                    uuid: crypto.randomUUID(), channel, time: 0, interpolation: 'linear',
                    data_points: [{ x, y, z }]
                }));
                return [id, { name: entry.object.name, type: entry.native ? 'armature_bone' : 'bone', keyframes }];
            }));
            model.animations.push({ uuid: crypto.randomUUID(), name, length: 0.05, loop: 'hold', snapping: 20, animators });
        }
        return model;
    }
}

async function embedRigTextures(model, fallback) {
    const textures = model.textures || [];
    const results = await Promise.all(textures.map(async (texture, index) => {
        if (texture.source?.startsWith('data:image/')) return true;
        const path = texture.relative_path || texture.path;
        if (!path && !(index === 0 && fallback)) return true;
        let source = index === 0 && fallback?.startsWith('data:image/') ? fallback : null;
        try {
            if (!source && path) {
                const response = await fetch(path);
                if (response.ok) {
                    const blob = await response.blob();
                    if (blob.type.startsWith('image/')) {
                        source = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = () => reject(reader.error);
                            reader.readAsDataURL(blob);
                        });
                    }
                }
            }
        } catch {
            return false;
        }
        if (!source) return false;
        texture.source = source;
        texture.mode = 'bitmap';
        delete texture.relative_path;
        delete texture.path;
        return true;
    }));
    return results.filter(ok => !ok).length;
}
