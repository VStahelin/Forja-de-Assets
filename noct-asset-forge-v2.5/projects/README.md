# Projects

Each folder here is a separate project. From the 2D generator directory, use `npm run list` to discover existing projects or `npm run new-project -- <name>` to create one.

| Path within a project | Purpose |
| --- | --- |
| `AGENTS.md` (optional) | Project-specific workflow, checks and integration |
| `source/_theme.ts` and optional `STYLE.md` | Visual tokens and art direction |
| `source/<subpath>.ts` | Asset recipes |
| `assets/` | Official exports |
| `sandboxes/main/` (optional) | Preview layouts and asset states |
| `forge.config.json` (optional) | Export defaults, including `outDir` for mirroring outputs |

Pass the selected project's name to `new-asset`, `check` and `export`. See the [generator README](../README.md) for command options.
