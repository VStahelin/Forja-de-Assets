const assert = require("assert");
global.THREE = require("../Tools/viewer/vendor/three.min.js");
global.requestAnimationFrame = (fn) => 1;
global.cancelAnimationFrame = (id) => {};
require("../Tools/viewer/vendor/GLTFLoader.js");

const { BBModelParser } = require("../Tools/viewer/js/bbmodel_parser.js");
const { AnimationPlayer } = require("../Tools/viewer/js/animation_player.js");
const { modelStatistics, sourceMetadata } = require("../Tools/viewer/js/model_details.js");
const {
    computeBoundingBox,
    loadAssetObject,
    LoadedAsset,
    BBModelClipController,
    GlbClipController
} = require("../Tools/viewer/js/asset_loader.js");

// 1. Verify GLTFLoader is registered on THREE
assert(typeof THREE.GLTFLoader === "function", "GLTFLoader must be on THREE");

const bindGeometry = new THREE.BoxGeometry(2, 4, 2);
const vertexCount = bindGeometry.attributes.position.count;
const weights = new Float32Array(vertexCount * 4);
for (let i = 0; i < weights.length; i += 4) weights[i] = 1;
bindGeometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Uint16Array(vertexCount * 4), 4));
bindGeometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
const scaledSkeletonMesh = new THREE.SkinnedMesh(bindGeometry, new THREE.MeshBasicMaterial());
const scaledBone = new THREE.Bone();
scaledSkeletonMesh.add(scaledBone);
scaledSkeletonMesh.bind(new THREE.Skeleton([scaledBone]));
scaledBone.scale.setScalar(0.01);
const skinnedBounds = computeBoundingBox(scaledSkeletonMesh, true);
assert(Math.abs(skinnedBounds.size[1] - 0.04) < 1e-8, "GLB bounds must use skin transforms");
bindGeometry.dispose();
scaledSkeletonMesh.material.dispose();

// 2. Test BBModelParser tagging in buildScene
const testData = {
    name: "test_model",
    resolution: { width: 16, height: 16 },
    groups: [
        { uuid: "grp-1", name: "head_group", origin: [0, 4, 0], rotation: [0, 0, 0] }
    ],
    elements: [
        {
            type: "cube",
            uuid: "cube-1",
            name: "head_cube",
            from: [0, 0, 0],
            to: [4, 4, 4],
            origin: [0, 0, 0],
            faces: {
                north: { uv: [0, 0, 4, 4], texture: null }
            }
        },
        {
            type: "armature_bone",
            uuid: "bone-1",
            name: "neck_bone",
            origin: [0, 2, 0],
            rotation: [0, 0, 0]
        }
    ],
    outliner: [
        {
            uuid: "grp-1",
            children: [
                "cube-1",
                { uuid: "bone-1", children: [] }
            ]
        }
    ],
    animations: [
        {
            name: "idle",
            length: 1.5,
            loop: "loop",
            animators: {
                "bone-1": {
                    keyframes: [
                        { time: 0, channel: "rotation", data_points: [{ x: 0, y: 0, z: 0 }] },
                        { time: 1.5, channel: "rotation", data_points: [{ x: 0, y: 0, z: 45 }] }
                    ]
                }
            }
        }
    ]
};

const parser = new BBModelParser(testData);
const scene = parser.buildScene();
const cube = { type: "cube", uuid: "plain-cube", from: [0, 0, 0], to: [2, 2, 2] };
const polygonMesh = {
    type: "mesh", uuid: "polygon-mesh",
    vertices: { a: [0, 0, 0], b: [2, 0, 0], c: [3, 1, 0], d: [1, 2, 0], e: [0, 1, 0], f: [1, -1, 0] },
    faces: { pentagon: { vertices: ["a", "b", "c", "d", "e"] }, triangle: { vertices: ["b", "a", "f"] } }
};
const topologyDocument = { elements: [cube, polygonMesh], meta: { model_format: "free" },
    textures: [{ source: "data:image/png;base64,example" }] };
const topologyParser = new BBModelParser(topologyDocument);
const bbAsset = { kind: "bbmodel", object: topologyParser.buildScene(), parser: topologyParser, modelData: topologyDocument };
const bbStats = modelStatistics(bbAsset);
assert.deepStrictEqual([bbStats.vertices, bbStats.edges, bbStats.faces, bbStats.triangles], [14, 19, 8, 16]);
assert.deepStrictEqual([bbStats.triangularFaces, bbStats.quads, bbStats.ngons], [1, 6, 1]);
const metadata = sourceMetadata(bbAsset);
assert.strictEqual(metadata.meta.model_format, "free");
assert.strictEqual(metadata.elements[1].vertices, undefined);
assert.strictEqual(metadata.textures[0].source, "[dados incorporados]");
const glbStats = modelStatistics({
    kind: "glb", object: new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial())
});
assert.deepStrictEqual([glbStats.vertices, glbStats.edges, glbStats.faces, glbStats.triangles, glbStats.bufferVertices],
    [8, 18, 12, 12, 24]);

// Check rootGroup tagging
assert.strictEqual(scene.userData.kind, "group");

// Find group, bone, cube, and internal pivot containers
let foundGroup = null;
let foundBone = null;
let foundCube = null;
let foundInternal = 0;

scene.traverse(node => {
    if (node.userData.kind === "group" && node.userData.uuid === "grp-1") {
        foundGroup = node;
    }
    if (node.userData.kind === "bone" && node.userData.uuid === "bone-1") {
        foundBone = node;
    }
    if (node.userData.kind === "cube" && node.userData.uuid === "cube-1") {
        foundCube = node;
    }
    if (node.userData.internal === true) {
        foundInternal++;
    }
});

assert(foundGroup, "Outliner group must be tagged with kind: 'group' and uuid");
assert(foundBone, "Armature bone must be tagged with kind: 'bone' and uuid");
assert(foundCube, "Cube mesh must be tagged with kind: 'cube' and uuid");
assert(foundInternal >= 2, "childrenContainer and pivotGroup must have internal: true");

// 3. Test loadAssetObject for bbmodel
async function runAsyncTests() {
    const asset = await loadAssetObject({
        kind: "bbmodel",
        modelData: testData
    });

    assert(asset instanceof LoadedAsset);
    assert.strictEqual(asset.kind, "bbmodel");
    assert(asset.object instanceof THREE.Object3D);
    assert(asset.bbox && typeof asset.bbox.maxDimension === "number");
    assert(Array.isArray(asset.bbox.center));
    assert(Array.isArray(asset.bbox.size));

    // Test clips
    assert.deepStrictEqual(asset.clips.names, ["idle"]);
    assert.strictEqual(asset.clips.length, 0);
    asset.clips.select("idle");
    assert.strictEqual(asset.clips.length, 1.5);
    assert.strictEqual(asset.clips.playing, false);
    asset.clips.seek(0.75);
    assert.strictEqual(asset.clips.time, 0.75);
    asset.clips.play();
    assert.strictEqual(asset.clips.playing, true);
    asset.clips.pause();
    assert.strictEqual(asset.clips.playing, false);

    // Test setWireframe
    asset.setWireframe(true);
    let wireframeOn = false;
    asset.object.traverse(child => {
        if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            if (mats.some(m => m.wireframe)) wireframeOn = true;
        }
    });
    assert(wireframeOn, "setWireframe(true) must set material.wireframe");

    asset.setWireframe(false);
    let wireframeOff = true;
    asset.object.traverse(child => {
        if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            if (mats.some(m => m.wireframe)) wireframeOff = false;
        }
    });
    assert(wireframeOff, "setWireframe(false) must clear material.wireframe");

    // Test setShading
    asset.setShading(false);
    let hasBasic = false;
    asset.object.traverse(child => {
        if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            if (mats.some(m => m.type === "MeshBasicMaterial")) hasBasic = true;
        }
    });
    assert(hasBasic, "setShading(false) must switch to MeshBasicMaterial");

    asset.setShading(true);
    let hasStandard = false;
    asset.object.traverse(child => {
        if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            if (mats.some(m => m.type === "MeshStandardMaterial")) hasStandard = true;
        }
    });
    assert(hasStandard, "setShading(true) must switch to MeshStandardMaterial");

    // Test setTextureFilter
    asset.setTextureFilter("linear");
    assert.strictEqual(asset.textureFilter, "linear");
    asset.setTextureFilter("nearest");
    assert.strictEqual(asset.textureFilter, "nearest");

    // Test dispose
    asset.dispose();

    // 4. Test GlbClipController
    const glbRoot = new THREE.Group();
    const clip1 = new THREE.AnimationClip("walk", 2.0, []);
    const glbClips = new GlbClipController(glbRoot, [clip1]);
    assert.deepStrictEqual(glbClips.names, ["walk"]);
    assert.strictEqual(glbClips.length, 0); // No clip selected yet
    glbClips.select("walk");
    assert.strictEqual(glbClips.length, 2.0);
    glbClips.seek(1.0);
    assert.strictEqual(glbClips.time, 1.0);
    glbClips.play();
    assert.strictEqual(glbClips.playing, true);
    glbClips.pause();
    assert.strictEqual(glbClips.playing, false);
    glbClips.dispose();

    console.log("All asset_loader_check tests PASSED!");
}

runAsyncTests().catch(err => {
    console.error(err);
    process.exit(1);
});
