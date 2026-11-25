# Forja de Assets

Painel local para navegar pelo acervo e usar as forjas 2D e 3D. Os dois visualizadores abrem dentro da mesma interface, com os controles de cada gerador.

## Abrir o painel

Na raiz do workspace, execute:

```powershell
npm start
```

Abra [a Forja de Assets](http://127.0.0.1:8780/). O serviço sobe os dois visualizadores em loopback e usa as dependências dos geradores. Em outra máquina, prepare primeiro o [2D](noct-asset-forge-v2.5/README.md) com Node.js 20+ e Chromium e o [3D](noct-asset-forge-3d-bb-v2/README.md) com Python 3.12. O painel lê as mudanças da biblioteca e permite atualizar o catálogo. A geração de assets usa os comandos da raiz, descritos abaixo.

## Onde ficam os arquivos

```text
Assets Libary/
  Animations/          # Rigs e animações na interface
  FX/
  Masks/
  Models/
  Smokes/
  Sounds/
  Textures/
  VFX/
  Voices/
  generated/
    projects/
      <id-do-projeto>/
        2d/
          source/
          assets/
        3d/
          project.json
          scripts/
          assets/
```

O painel usa a pasta existente `Assets Libary` e também reconhece `Assets Library`. A variável `ASSET_LIBRARY_ROOT` pode indicar outro caminho. As pastas do primeiro nível aparecem como abas. Os arquivos criados pelas forjas aparecem em **Gerados**, agrupados pelo ID compartilhado do jogo. O acervo permite importar arquivos e pastas, renomear ou mover itens importados e baixar o arquivo original. Use **Mostrar arquivos auxiliares** para mostrar itens como licenças e formatos associados.

Um clique em um cartão de modelo carrega a prévia e os metadados à direita. **Ver detalhes** ou clique duplo abre o inspetor da Forja 3D, com texturas registradas, animações, hierarquia, rig, visual e detalhes. **Rigs e animações** organiza os clipes por GLB ou glTF e os reproduz no rig original do pacote. **Sons** e **Vozes** têm reprodução na lista. **Fumaça** e **VFX** reproduzem sequências e atlas reconhecidos pelo nome.

**FX** abre as cenas de efeitos Godot em um palco WebGL com câmera orbital, repetição e velocidade ajustável. A prévia lê emissores, malhas e parâmetros dos materiais das cenas. Shaders e scripts do pacote têm sua execução original no Godot. Use **Mostrar arquivos do pacote** para consultar a cena e suas dependências.

## Comandos para agentes

Use o mesmo ID no 2D e no 3D para juntar as duas partes do jogo em `generated/projects/<id>/`. Rode estes comandos na raiz do workspace:

```powershell
npm run forge -- 2d new-project meu-jogo --style
npm run forge -- 2d new-asset meu-jogo icons/chave --engine pixel
npm run forge -- 2d check meu-jogo
npm run forge -- 2d export meu-jogo icons/chave

npm run forge -- 3d init meu-jogo --asset luminaria
npm run forge -- 3d model meu-jogo --asset luminaria
npm run forge -- 3d uv meu-jogo --asset luminaria
npm run forge -- 3d texture meu-jogo --asset luminaria
npm run forge -- 3d export meu-jogo --asset luminaria
```

Abra a receita registrada e edite a geometria ou o desenho antes de gerar. As etapas 3D são independentes e operam sobre o BBModel atual. Veja o [fluxo para agentes](AGENTS.md) e o [pipeline 3D](noct-asset-forge-3d-bb-v2/docs/pipeline.md). Para comandos 3D que recebem caminhos e argumentos próprios, use `npm run forge -- 3d raw <argumentos>`.

`npm run adopt` copia projetos antigos para a biblioteca central quando a pasta de destino está livre. Os projetos antigos permanecem disponíveis como cópias. `npm test` verifica os dois geradores e o painel com um projeto temporário.

O logo em pixel art tem uma receita de 64 × 64 no projeto `forge-assets` da biblioteca. O PNG aparece em **Gerados**.
