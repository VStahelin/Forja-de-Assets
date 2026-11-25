/* One offscreen renderer serves the visible cards; each model is released after its snapshot. */
class AssetThumbnails {
    constructor() {
        this.cache = new Map();
        this.jobs = new Map();
        this.visible = new Set();
        this.observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting && this.jobs.has(entry.target)) this.visible.add(entry.target);
                else this.visible.delete(entry.target);
            }
            void this.renderNext();
        }, { root: document.getElementById('project-overview-view'), rootMargin: '120px' });
    }

    add(element, source, revision, textureFilter) {
        const key = JSON.stringify([source, revision, textureFilter]);
        const image = this.cache.get(key);
        if (image) {
            this.cache.delete(key);
            this.cache.set(key, image);
            this.display(element, image);
        } else {
            this.jobs.set(element, { source, key, textureFilter });
            this.observer.observe(element);
        }
    }

    clear() {
        this.observer.disconnect();
        this.visible.clear();
        this.jobs.clear();
    }

    invalidate() {
        this.clear();
        this.cache.clear();
    }

    display(element, url) {
        const image = new Image();
        image.alt = '';
        image.src = url;
        element.replaceChildren(image);
    }

    async renderNext() {
        if (this.rendering || !this.visible.size) return;
        this.rendering = true;
        try {
            for (const element of this.visible) {
                this.visible.delete(element);
                this.observer.unobserve(element);
                const job = this.jobs.get(element);
                let loaded;
                try {
                    loaded = await loadAssetObject(job.source, { textureFilter: job.textureFilter });
                    if (this.jobs.get(element) !== job) continue;
                    const url = this.snapshot(loaded);
                    this.cache.set(job.key, url);
                    if (this.cache.size > 96) this.cache.delete(this.cache.keys().next().value);
                    this.display(element, url);
                } catch {
                    if (this.jobs.get(element) === job) {
                        element.textContent = 'Prévia indisponível';
                    }
                } finally {
                    this.jobs.delete(element);
                    loaded?.dispose();
                }
            }
        } finally {
            this.rendering = false;
        }
    }

    snapshot(loaded) {
        if (!this.renderer) {
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
            this.renderer.setSize(256, 256, false);
            this.scene = new THREE.Scene();
            this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
            const keyLight = new THREE.DirectionalLight(0xffffff, 0.75);
            keyLight.position.set(3, 5, 4);
            this.scene.add(keyLight);
            this.camera = new THREE.OrthographicCamera();
        }

        const bounds = loaded.bbox.box;
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const radius = Math.max(size.length() / 2, 0.01);
        const camera = this.camera;
        camera.position.copy(center).addScaledVector(new THREE.Vector3(5, 3.4, 6).normalize(), radius * 3);
        camera.lookAt(center);
        camera.updateMatrixWorld();
        const view = camera.matrixWorldInverse.elements;
        const width = Math.abs(view[0]) * size.x + Math.abs(view[4]) * size.y + Math.abs(view[8]) * size.z;
        const height = Math.abs(view[1]) * size.x + Math.abs(view[5]) * size.y + Math.abs(view[9]) * size.z;
        const half = Math.max(width, height, 0.01) * 0.62;
        camera.left = camera.bottom = -half;
        camera.right = camera.top = half;
        camera.near = radius;
        camera.far = radius * 5;
        camera.updateProjectionMatrix();

        this.scene.add(loaded.object);
        try {
            this.renderer.outputEncoding = loaded.kind === 'glb' ? THREE.sRGBEncoding : THREE.LinearEncoding;
            this.renderer.render(this.scene, camera);
            return this.renderer.domElement.toDataURL('image/png');
        } finally {
            this.scene.remove(loaded.object);
        }
    }
}
