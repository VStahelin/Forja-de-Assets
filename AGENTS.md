# Forja de assets

A forja tem dois geradores programáticos de assets para jogos e aplicativos. Use o [README](README.md) para abrir o painel e localizar a biblioteca central.

## Escolha o projeto e o gerador

1. Use o projeto indicado no pedido ou o projeto já estabelecido na conversa. Se houver ambiguidade, confirme qual projeto deve receber o asset. Na raiz, use `npm run forge -- 2d ...` e `npm run forge -- 3d ...` para trabalhar na biblioteca central.
2. Abra o guia do gerador antes de editar. Para um pedido misto, siga o guia de cada etapa.

   | Pedido | Gerador | Guia para agentes |
   | --- | --- | --- |
   | Sprites, texturas, tiles, decals, ícones e UI | NoctAssetForge 2D | [AGENTS.md do 2D](noct-asset-forge-v2.5/AGENTS.md) |
   | Modelos, UV, pintura, rig, animação e exportação GLB | NoctAssetForge 3D | [AGENTS.md do 3D](noct-asset-forge-3d-bb-v2/AGENTS.md) |

3. Abra `Assets Libary/generated/projects/<projeto>/`. Use `2d/source/` para receitas 2D e `3d/project.json` para localizar as receitas 3D. Leia o `AGENTS.md` e a direção de arte do projeto, quando presentes. Confira o inventário antes de criar outra peça.

## Produção e entrega

- Mantenha fontes, paletas, referências e saídas separadas por projeto. Use referências de outro projeto quando o pedido autorizar. Alterações no código compartilhado (`core/`, `Tools/`, `lib/`) fazem parte da manutenção dos geradores.
- Guarde produtos oficiais em `2d/assets/` ou `3d/assets/` dentro do projeto escolhido. Áudio e arquivos importados podem ficar nas pastas por tipo da biblioteca compartilhada, fora de `generated/projects/`.
- Gere apenas as etapas e os formatos solicitados. Valide a saída com os comandos e critérios visuais do gerador e com as regras do projeto.
- Entregue a receita e os arquivos gerados. Se o pedido ou o projeto definir integração com uma engine, siga o destino, a nomenclatura e as verificações do projeto. Atualize seu inventário quando houver um definido.
