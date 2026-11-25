class RigOverlay {
    constructor(sceneSetup, onSelect) {
        this.setup = sceneSetup;
        this.canvas = document.getElementById('rig-overlay');
        this.context = this.canvas.getContext('2d');
        this.points = [];
        this.vector = new THREE.Vector3();
        const target = sceneSetup.renderer.domElement;
        target.addEventListener('pointerdown', event => {
            if (this.canvas.hidden || event.button !== 0) return;
            this.pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
        });
        target.addEventListener('pointerup', event => {
            const start = this.pointerStart;
            this.pointerStart = null;
            if (this.canvas.hidden || start?.id !== event.pointerId ||
                Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            let distance = 14;
            let id;
            for (const point of this.points) {
                const next = Math.hypot(point.x - x, point.y - y);
                if (next <= distance) {
                    distance = next;
                    id = point.id;
                }
            }
            if (id !== undefined) onSelect(id);
        });
        target.addEventListener('pointercancel', () => { this.pointerStart = null; });
    }

    hide() {
        this.canvas.hidden = true;
        this.points = [];
        this.pointerStart = null;
    }

    project(vector, width, height) {
        vector.project(this.setup.camera);
        if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y) || Math.abs(vector.z) > 1) return null;
        return { x: (vector.x + 1) * width / 2, y: (1 - vector.y) * height / 2, z: vector.z };
    }

    draw(rig, selection) {
        this.canvas.hidden = false;
        const width = this.setup.width;
        const height = this.setup.height;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const pixelWidth = Math.round(width * ratio);
        const pixelHeight = Math.round(height * ratio);
        if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
            this.canvas.width = pixelWidth;
            this.canvas.height = pixelHeight;
        }
        const ctx = this.context;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const positions = new Map();
        for (const entry of rig.entries.values()) {
            if (!entry.object.visible) continue;
            const point = this.project(this.vector.setFromMatrixPosition(entry.object.matrixWorld), width, height);
            if (point) positions.set(entry, { ...point, id: entry.id });
        }

        ctx.lineCap = 'round';
        for (const [entry, point] of positions) {
            const parent = positions.get(entry.parent);
            if (parent) this.line(ctx, parent, point, '#8eb6ed70', 1.5);
            if (!entry.native) continue;
            const length = rig.restValues(entry).length;
            const tip = this.project(this.vector.set(0, length, 0).applyMatrix4(entry.object.matrixWorld), width, height);
            if (tip) this.line(ctx, point, tip, entry.id === selection ? '#ffcf83' : '#96c1fa', entry.id === selection ? 3 : 2);
        }
        this.points = [...positions.values()].sort((a, b) => b.z - a.z || Number(a.id === selection) - Number(b.id === selection));
        for (const point of this.points) {
            const selected = point.id === selection;
            ctx.beginPath();
            ctx.arc(point.x, point.y, selected ? 6 : 3.5, 0, Math.PI * 2);
            ctx.fillStyle = selected ? '#ffcf83' : '#a5ccff';
            ctx.strokeStyle = '#171b25';
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();
        }
    }

    line(ctx, from, to, color, width) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
    }
}
