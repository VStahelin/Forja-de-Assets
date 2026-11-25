# Style: cleaners

Este arquivo resume as regras do Cleaners no gerador 2D. A direção de arte e o motor de decisão ficam em `docs/arte/direcao-de-arte.md` e `docs/pipeline/motor-de-decisao.md` no repositório Limpadores.

## Summary of the theme

- Paleta mestre do jogo em `source/_theme.ts`, organizada em rampas da sombra para o brilho: abismo, pedra, pedra_verde, ferro, musgo, madeira, osso, couro_tecido, ferrugem, fogo, magia, sangue, slime.
- Base fria (pedra, pedra_verde, ferro, musgo) ocupa a maior parte da tela. Laranja (fogo) só em fonte de luz, roxo (magia) só em magia, sangue e slime só em sujeira.
- `RULES.pxPerMeter` = 128 e `RULES.tileSize` = 256 (2 x 2 m).

## Specifications the theme cannot express

- Resolution and export scale: motor `@core/pixel`, `scale: 1`, 128 px por metro. Texturas tileáveis de cenário em 256 x 256.
- Edge treatment: pixel duro, `antialiasing: 'none'`. Sem gradiente suave: transições só por dithering ordenado (Bayer 4x4).
- Colors: 8 a 16 cores por asset, todas da paleta. Sem `#000` nem `#fff`.
- Layering rules: junta escura de 1 a 2 px entre blocos; oclusão leve nas bordas dos blocos; realce de 1 px em cima. Sem sombra direcional forte pintada (a luz vem das tochas no Godot).
- Tiling: texturas de cenário fecham nos dois eixos sem costura. Todo ruído e todo layout são periódicos no tamanho do tile.
- Sujeira limpável (sangue, slime, fuligem) nunca vai na textura base: é asset separado.
- No baked text. Runas são formas abstratas.
- HUD, menus e sobreposições usam o kit de pedra e ferro em `source/ui/gothic/` (VX-10). O chanfro e o acabamento usam Bayer 4 × 4, com cantos preservados em 9-slice. As peças são exportadas em tamanho nativo, como o botão de 216 × 64 px na base de 720p. As pranchetas e os documentos conservam os materiais que representam.
