# Projects

Each folder here is a separate project with a `project.json` that registers its 3D assets and recipe paths. Create one from the 3D generator directory with `py -3.12 -m Tools.forge project init projects/<name> --asset <initial_asset>`.

Use the project path and registered asset ID when running stages, for example `py -3.12 -m Tools.forge model projects/<name> --asset <id>`. A project can define its workflow in `AGENTS.md` and its art direction in `STYLE.md` and `theme.py`. See the [project guide](../docs/projects.md) for layout and recipe conventions.
