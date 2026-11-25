import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

from Tools.asset_init import init_project
from Tools._resolve import resolve_asset
from Tools.asset_build import asset_build
from Tools.texture_variant import register_variant
from Tools.viewer_server import ModelViewerServer
from Tools.model_viewer import export_standalone_html
from lib import AnimationEditor, ModelBuilder
from lib.animation import validate_animations
from tests.test_armature import rigid_weights, rigged_builder


class ProjectViewerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "collection"
        init_project(self.root, asset_id="hero", animation=True)
        self.context = resolve_asset(f"{self.root}#hero")
        self.server = ModelViewerServer(port=0, project=self.root)
        self.thread = threading.Thread(target=self.server.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.close_server)
        self.url = f"http://127.0.0.1:{self.server.port}"

    def close_server(self):
        self.server.server.shutdown()
        self.server.server.server_close()
        self.thread.join(timeout=3)

    def test_scope_catalog_and_exact_registered_model(self):
        catalog = json.load(urllib.request.urlopen(self.url+"/api/catalog"))
        self.assertEqual([asset["id"] for asset in catalog["assets"]], ["hero"])
        self.assertIsNone(catalog["assets"][0]["stamp"])
        self.assertEqual(asset_build(f"{self.root}#hero", stages="model,uv,texture")["status"], "pass")
        response = json.load(urllib.request.urlopen(self.url+"/api/assets/hero/model"))
        self.assertEqual(response["name"], "hero")
        self.assertEqual(response["textures"][0]["relative_path"], "/api/assets/hero/texture/0")
        outside = Path(self.tmp.name) / "outside.png"
        Image.new("RGBA", (16,16)).save(outside)
        from Tools.model_viewer import to_server_url
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(self.url+to_server_url(outside))
        self.assertEqual(error.exception.code, 403)
        for path in ("/Tools/model_export.py", "/js/../../AGENTS.md", "/api/assets/unknown/model"):
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(self.url+path)

    def test_browser_empty_state_selection_variants_and_file_refresh(self):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"])
            try:
                page = browser.new_page(viewport={"width":1000,"height":750})
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(self.url)
                page.wait_for_function("window.__VIEWER_READY__ === true")
                self.assertIn("não gerado", page.locator("#asset-message").inner_text())
                self.assertFalse(self.context.model.exists())
                self.assertEqual(asset_build(f"{self.root}#hero", stages="model,uv,texture,animation")["status"], "pass")
                page.wait_for_function("currentModelData && currentModelData.name === 'hero'", timeout=10000)
                before = self.context.model.read_bytes()
                recipe = self.context.scripts / "generate_model.py"
                recipe_before = recipe.read_bytes()
                register_variant(f"{self.root}#hero", "angry")
                path = self.context.directory / "textures/angry.png"
                path.parent.mkdir(parents=True, exist_ok=True)
                resolution = json.loads(before)["resolution"]
                Image.new("RGBA", (resolution["width"],resolution["height"]), "red").save(path)
                page.wait_for_function("[...document.querySelector('#texture-select').options].some(option => option.value === 'angry')")
                page.select_option("#texture-select", "angry")
                page.wait_for_function("window.__VIEWER_VARIANT__ === 'angry' && parser.texture && parser.texture.image.src.includes('/variant/angry')")
                self.assertEqual(self.context.model.read_bytes(), before)
                init_project(self.root, asset_id="sword", mode="box")
                self.assertEqual(asset_build(f"{self.root}#sword", stages="model")["status"], "pass")
                page.get_by_role("button", name="Expandir sword", exact=True).click()
                page.locator('[data-asset="sword"]').click()
                page.wait_for_function("currentModelData && currentModelData.name === 'sword'")
                page.locator('[data-asset="hero"]').click()
                page.wait_for_function("currentModelData && currentModelData.name === 'hero'")
                data = json.loads(self.context.model.read_text())
                data["name"] = "edited manually"
                self.context.model.write_text(json.dumps(data))
                page.wait_for_function("currentModelData && currentModelData.name === 'edited manually'", timeout=10000)
                self.assertEqual(recipe.read_bytes(), recipe_before)
                self.assertEqual(json.loads(self.context.model.read_text())["name"], "edited manually")
                self.assertFalse(errors, errors)
                review = Path(__file__).resolve().parents[1] / ".runtime/checks"
                review.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(review / "project-viewer.png"))
            finally:
                browser.close()

    def test_native_multiple_textures_and_external_controls_in_viewer_and_standalone(self):
        self.context.directory.mkdir(parents=True, exist_ok=True)
        Image.new("RGBA", (16,32), "red").save(self.context.directory / "red.png")
        Image.new("RGBA", (32,16), "blue").save(self.context.directory / "blue.png")
        faces = {name: {"texture": None} for name in ("north", "south", "east", "west", "up", "down")}
        faces.update(north={"texture": 0, "uv": [0,0,8,16]}, south={"texture": 1, "uv": [0,0,16,8]})
        data = {"name": "external two atlas model", "meta": {"model_format": "free"},
                "resolution": {"width": 8, "height": 16}, "elements": [
                    {"type": "cube", "uuid": "cube-id", "name": "head", "from": [0,0,0], "to": [4,4,4], "faces": faces}],
                "outliner": [{"uuid": "jaw-id", "name": "jaw", "origin": [0,2,0], "children": ["cube-id"]}],
                "textures": [{"id": "0", "relative_path": "red.png", "uv_width": 8, "uv_height": 16},
                             {"id": "1", "relative_path": "blue.png", "uv_width": 16, "uv_height": 8}]}
        self.context.model.write_text(json.dumps(data))
        editor = AnimationEditor.from_bbmodel(self.context.model)
        editor.animation("turn", duration=1).group("jaw").key(0, rotation=(0,0,0)).key(1, rotation=(0,90,0))
        editor.save()
        original = self.context.model.read_bytes()
        recipe = self.context.scripts / "generate_model.py"
        recipe.write_text('raise RuntimeError("viewer must not execute geometry")')
        standalone = export_standalone_html(self.context.model, self.root / "renders/native.html")
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"])
            try:
                for url in (self.url, standalone.as_uri()):
                    page = browser.new_page()
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(url)
                    page.wait_for_function("window.__VIEWER_READY__ === true && parser && parser.textureList.length === 2")
                    summary = page.evaluate("""() => {
                        const meshes=[]; parser.rootObject.traverse(node=> {if(node.isMesh) meshes.push(node);});
                        return {images: parser.textureList.map(texture=>[texture.image.width,texture.image.height]),
                            controls: [...parser.controls.keys()], errors: parser.textureErrors,
                            faces: meshes[0].geometry.groups.map(group=>group.materialIndex),
                            uv: Array.from(meshes[0].geometry.attributes.uv.array)};
                    }""")
                    self.assertEqual(summary["images"], [[16,32],[32,16]])
                    self.assertEqual(summary["faces"], [0,1])
                    self.assertIn("jaw-id", summary["controls"])
                    self.assertFalse(summary["errors"])
                    self.assertTrue(all(0 <= value <= 1 for value in summary["uv"]))
                    page.evaluate("animationPlayer.select('turn'); animationPlayer.seek(1)")
                    rotation = page.evaluate("parser.controls.get('jaw-id').object.rotation.y")
                    import math
                    self.assertAlmostEqual(rotation, math.pi / 2)
                    self.assertFalse(errors, errors)
                    page.close()
            finally:
                browser.close()
        self.assertEqual(self.context.model.read_bytes(), original)

    def test_rig_editor_can_pose_rebind_and_export_a_skinned_character(self):
        builder, rig, mesh = rigged_builder()
        rig.bind(mesh, weights=rigid_weights(builder, mesh, "upper"))
        builder.export_bbmodel(self.context.model)
        editor = AnimationEditor.from_bbmodel(self.context.model)
        track = editor.animation("turn", duration=1).bone("upper")
        track.key(0, rotation=(0, 0, 0)).key(1, rotation=(0, 0, 40))
        editor.save()
        model = json.loads(self.context.model.read_bytes())
        model["textures"] = [{"name": "skin.png", "relative_path": "skin.png"}]
        self.context.model.write_text(json.dumps(model), encoding="utf-8")
        Image.new("RGBA", (8, 8), "red").save(self.context.model.parent / "skin.png")
        original = self.context.model.read_bytes()

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"])
            try:
                page = browser.new_page(viewport={"width": 1440, "height": 980})
                page.set_default_timeout(10000)
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(self.url)
                page.wait_for_function("window.__VIEWER_READY__ && parser?.skinnedMeshes.length === 1")
                page.evaluate("seekAnimation(0.5)")
                page.get_by_role("tab", name="Rig", exact=True).click()
                page.wait_for_function("rigEditor.overlay.points.length === 2")
                joint = page.evaluate("""() => {
                    const id = [...rigEditor.rig.entries.values()].find(entry => entry.object.name === 'upper').id;
                    const point = rigEditor.overlay.points.find(point => point.id === id);
                    const rect = document.getElementById('rig-overlay').getBoundingClientRect();
                    return {x: rect.x + point.x, y: rect.y + point.y};
                }""")
                page.mouse.click(joint["x"], joint["y"])
                self.assertEqual(page.locator("#rig-joint-name").inner_text(), "upper")
                self.assertEqual(page.get_by_role("spinbutton", name="Rotação (°) Z", exact=True).input_value(), "20")

                page.get_by_role("button", name="Repouso", exact=True).click()
                upper_y = page.get_by_role("spinbutton", name="Pivô local Y", exact=True)
                self.assertTrue(upper_y.is_disabled())
                rest_vertices = page.evaluate("Array.from(parser.skinnedMeshes[0].mesh.geometry.attributes.position.array)")
                page.get_by_role("button", name="lower", exact=True).click()
                length = page.get_by_role("spinbutton", name="Comprimento", exact=True)
                length.fill("4")
                length.press("Enter")
                page.get_by_role("button", name="upper", exact=True).click()
                self.assertEqual(upper_y.input_value(), "4")
                next_vertices = page.evaluate("Array.from(parser.skinnedMeshes[0].mesh.geometry.attributes.position.array)")
                self.assertEqual(rest_vertices, next_vertices)

                page.get_by_role("button", name="Pose", exact=True).click()
                rotation_z = page.get_by_role("spinbutton", name="Rotação (°) Z", exact=True)
                rotation_z.fill("65")
                rotation_z.press("Enter")
                page.locator("#rig-pose-name").fill("Braço alto")
                page.locator("#rig-save-pose").click()
                page.locator("#rig-neutral").click()
                self.assertEqual(rotation_z.input_value(), "0")
                page.locator("#rig-apply-pose").click()
                self.assertEqual(rotation_z.input_value(), "65")
                self.assertNotEqual(rest_vertices, page.evaluate("Array.from(parser.skinnedMeshes[0].mesh.geometry.attributes.position.array)"))
                page.get_by_role("tab", name="Animações", exact=False).click()
                self.assertEqual(page.evaluate("animationPlayer.time"), 0.5)
                page.reload()
                page.wait_for_function("window.__VIEWER_READY__")
                page.get_by_role("tab", name="Rig", exact=True).click()
                self.assertEqual(page.locator("#rig-poses option").inner_text(), "Braço alto")
                with page.expect_download() as downloaded:
                    page.locator("#rig-export").click()
                result = json.loads(downloaded.value.path().read_bytes())
                self.assertEqual([clip["name"] for clip in result["animations"]], ["turn", "pose.braco_alto"])
                pose = result["animations"][-1]
                self.assertAlmostEqual(list(pose["animators"].values())[0]["keyframes"][0]["data_points"][0]["z"], 65)
                self.assertEqual(result["elements"][1]["length"], 4)
                self.assertEqual(result["elements"][2]["origin"], [0, 4, 0])
                self.assertEqual(result["elements"][2]["vertex_weights"], model["elements"][2]["vertex_weights"])
                self.assertTrue(result["textures"][0]["source"].startswith("data:image/png;base64,"))
                self.assertFalse(ModelBuilder.from_bbmodel_data(result).validate()["errors"])
                validate_animations(result)
                self.assertEqual(self.context.model.read_bytes(), original)
                self.assertFalse(errors, errors)
            finally:
                browser.close()

if __name__ == "__main__":
    unittest.main()
