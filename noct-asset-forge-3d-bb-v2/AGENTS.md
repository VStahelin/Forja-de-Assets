# NoctAssetForge3D

Canonical runtime: Official Python (`py -3.12`) on Windows (elsewhere `python3.12` or `python3`). Terminal execution is restricted to saved scripts and CLIs; never run inline Python (`python -c`, stdin).

Select the project named in the request or already established in the conversation. Read its `AGENTS.md`, `STYLE.md` and `theme.py` when present. Keep asset work scoped to that project. Repository maintenance may inspect and change shared Tools/lib, documentation, skills and tests.

Use the selected project's `project.json` to identify the asset. Pass `--asset <id>` when the project has multiple assets. Recipes receive their paths through `Tools.recipe_context`.

The current BBModel is the serialized JSON input to independent UV, painting, animation and export stages, processed entirely by Python without requiring the Blockbench application (which is purely an optional GUI editor for manual tweaks). Never regenerate geometry or run a missing prerequisite unless the user requested it. See `docs/pipeline.md` and `docs/projects.md`.

Start from [forge-3d-orchestrator](.agents/skills/forge-3d-orchestrator/SKILL.md), which routes to the specialized skills in `.agents/skills/`:
- `forge-3d-model`: geometry, hierarchy, rigs
- `forge-3d-visual-conformance`: clay review
- `forge-3d-texture`: surface and UV
- `forge-3d-animation`: clips
- `forge-3d-manual-edits`: changes the user made in Blockbench, and importing a `.bbmodel`
- `forge-3d-visualize`: inspection renders
- `forge-3d-export`: final products, parts and texture variants in chosen assets/ paths
- `forge-3d-setup`: checks this machine's dependencies (`Tools.forge doctor`) and installs missing ones only with the user's permission
