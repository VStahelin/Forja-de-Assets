# NoctAssetForge 2D

Run the CLI from this directory. Use the [README](README.md) for setup and commands and the [project guide](projects/README.md) for project layout.

- Select the project named in the request or already established in the conversation. Read its `AGENTS.md` and `STYLE.md` when present, and its `source/_theme.ts` for visual tokens. Keep asset work scoped to that project.
- Read [noct-asset-forge](.agents/skills/noct-asset-forge/SKILL.md) before writing sources. It routes to the API guides for `@core/brush` and `@core/pixel`.
- Read [noct-setup](.agents/skills/noct-setup/SKILL.md) for environment checks and [noct-review](.agents/skills/noct-review/SKILL.md) for export verification and visual review.
- Use the selected project's output conventions. The exporter writes into its `assets/` directory by default and can mirror exports to a project-specific destination.
