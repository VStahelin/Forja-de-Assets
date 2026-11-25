# Cleaners 3D

Estas instruções valem para os assets 3D do jogo Cleaners (Limpadores).

- Selecione o asset no [project.json](project.json). Use as receitas em `scripts/<id>/` e o código compartilhado deste projeto em `cleaners_lib/`.
- Para tarefas que envolvam o jogo, consulte a skill `.agents/skills/criar-asset/SKILL.md` e o motor de decisão em `docs/pipeline/motor-de-decisao.md` no repositório Limpadores, quando disponível. Confira o inventário em `docs/arte/progresso-assets-primeira-sala.md` antes de criar uma peça que possa já existir.
- Para a entrega à engine, exporte o GLB em `assets/engine/`. Quando a tarefa incluir integração ao jogo, siga `docs/forja/README.md` no repositório Limpadores para validar escala, materiais e importação em `cleaners-godot/assets/` e atualizar o inventário.
