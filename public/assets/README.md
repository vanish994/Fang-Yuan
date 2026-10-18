# Assets do jogo

Todos os arquivos desta pasta são servidos pelo Vite a partir de `/assets/...`.
No Phaser, carregue com caminhos relativos a `public/`, por exemplo:

```ts
this.load.image('grass', 'assets/tilesets/free-asset-pack/1. Grass and dirt.png');
```

## Organização

| Pasta | Conteúdo |
| --- | --- |
| `characters/fang-yuan/` | Sprite do personagem principal (64×64 px por célula). `fang-yuan-sprite-pack.json` é o manifesto de runtime com os caminhos e durações das animações (`idle`, `walk`, `dash`, `attack`, `death`). |
| `hud/tinyrpg-mana-soul-gui/` | Pack de interface (botões, molduras, setas, 9-slices). |
| `tilesets/feudal-japan-props/` | Props do Japão feudal (240 tiles individuais em `Tiles/`) e o atlas compactado em `TileMap/*_packed.*`. `ASSET_LIST.json` mapeia nome, categoria e âncora de cada tile. |
| `tilesets/free-asset-pack/` | Tilesets de terreno: grama, água, pedras, árvores, flores, caminhos, neve, deserto e praia. Inclui `ground-atlas-64.png`, um atlas derivado (6×2 tiles de 64 px: linha 1 = grama, linha 2 = terra), recortado de `1. Grass and dirt.png` para o mapa da vila. |
| `effects/moonlight-gu/` | Efeito do Moonlight Gu (corte em meia-lua) em 8 direções. Cada pasta tem `behind.png` (atrás do personagem), `front.png` (na frente) e `manifest.json`. A configuração de runtime está em `src/config/moonlightSlash.ts`, gerada a partir dos manifestos. `whole.png` (efeito sem personagem) não foi copiado, porque o jogo não usa. |
| `village/props/` | Peças da vila (casas, poço, lenha, barris, cerca, escada de pedra, árvores de jardim e rochas) em tamanho reduzido (~2/3), derivadas de `tilesets/feudal-japan-props/Tiles/`. Geradas por `scripts/build-village-assets.py`. |
| `tilesets/harmonious-seasons/` | Tilesets por estação (outono, inverno, normal): árvores, arbustos, água animada, caminhos, falésias e personagens de fazendeiro. |

## Licenças e origem

| Pack | Licença | Observação |
| --- | --- | --- |
| HUD (tinyRPG Mana Soul GUI, Gabriel "tiopalada" Lima) | CC0 1.0 | Uso livre, sem atribuição obrigatória. Veja `hud/tinyrpg-mana-soul-gui/README.html`. |
| Feudal Japan Complete 2D Mega Props Pack (nacl1234) | Licença comercial | Permite uso em jogos comerciais. Proíbe redistribuir os arquivos originais como arquivos independentes. Texto completo em `tilesets/feudal-japan-props/Documentation/LICENSE.txt`. Só a versão completa está aqui; a amostra gratuita é subconjunto byte-idêntico e não foi copiada. |
| Personagem Fang Yuan | Não informada | Sprite gerado com IA (provenance no manifesto). Personagem de *Reverend Insanity*. Sem arquivo de licença no pack. |
| Efeito Moonlight Gu ("Slash arc", PixelLab VFX Creator) | Não informada | Gerado com PixelLab VFX Creator; sem arquivo de licença no pack. Confirmar termos antes de publicar o jogo. |
| Peças da vila (`village/props/`, derivadas do Feudal Japan) | Licença comercial (a mesma do Feudal) | São cópias reduzidas e cortadas das peças originais. A licença do Feudal proíbe redistribuir os originais como arquivos independentes; estas cópias são o mesmo tipo de uso e devem seguir a mesma regra, então não devem sair do jogo como pacote de assets. |
| Free asset pack, thank u so much! | Não informada | Sem arquivo de licença. Confirmar termos antes de publicar o jogo. |
| Harmonious Seasons - A Seasons Based 2D Pixel Art Pack | Não informada | Sem arquivo de licença. Confirmar termos antes de publicar o jogo. A trilha sonora (WAV de 34 MB) não foi copiada. |

O repositório é privado. Antes de publicar o jogo ou o build, confirme as licenças marcadas como "Não informada".

## Ajustes feitos na cópia

- Dois arquivos do Harmonious Seasons foram renomeados para remover `%` e `&`, que quebram URLs: `Ocean_Water_40%_Anim.png` → `Ocean_Water_40pct_Anim.png`, `Ocean_Water_60%_Anim.png` → `Ocean_Water_60pct_Anim.png`, `Tree_Stumps_&_Bark.png` → `Tree_Stumps_and_Bark.png`.
- `ground-atlas-64.png` foi recortado do tileset original (192×192 px por tile, centro de cada célula) e reduzido para 64×64 px com filtro de área.
- Pastas de pack com nome longo foram simplificadas. Os nomes dos demais arquivos foram mantidos.
- Não foram copiados: a amostra Feudal (subconjunto), o tileset em grade do Feudal (`*_tilesheet.png`, duplicado pelo atlas compactado), as imagens de preview do Feudal, a trilha sonora do Harmonious e as pastas `source/` e `qa/` do personagem.

## Mapa da vila: dados gerados

`scripts/build-village-assets.py` lê os packs e gera:

- `public/assets/village/props/*.png`: peças do Feudal reduzidas para ~2/3 e cortadas pelo alfa.
- `src/world/village/assetCatalog.ts`: recortes em pixels nativos dos sheets do Harmonious (cada componente conexo vira um frame), tamanhos das peças e máscaras do platô e do lago.

Regenerar depois de mexer nos packs: `python3 scripts/build-village-assets.py` (precisa de Pillow, numpy e scipy). O chão e o relevo ficam em `src/world/village/baseLayout.ts` (alturas 0–3 e superfície: grama, terra da praça, escadas e trilhas). `src/world/village/villageMap.ts` deriva paredes, escadas e colisões a partir dele e recusa layouts com desnível sem parede.

## Editar a vila no Tiled

`village/vila-inicial-da-montanha.tmj` é o mapa no formato JSON do [Tiled](https://www.mapeditor.org/) (1.10 ou mais novo). Abra o arquivo direto no Tiled: os caminhos das imagens são relativos a ele.

- Camadas de tile: `chao` (grama e terra da praça) e `sobreposicao` (penhascos, escadas e trilhas). Tileset `base`: `village/base-tiles-64.png`, 8×7 tiles de 64 px (52 usados).
- Camadas de objeto: `imagens` (platô, lago e água), `chao_objetos` (sob o personagem), `objetos` (árvores, casas e rochas, ordenados pelo y da base) e `colisao` (retângulos sólidos). A camada `spawn` marca o ponto de partida.
- Tileset `vila-arte`: uma imagem por tile (recortes em `village/tiles/` e `village/props/`). A paleta traz toda a arte do catálogo, mesmo sem uso no mapa, para montar o mapa do zero.
- O chão atual (relevo, grama, terra, escadas e trilhas verticais) está no `.tmj`. Objetos e colisões de decoração ainda não foram colocados.

### Atlas base (`village/base-tiles-64.png`)

Derivado do pack gratuito que já está em `tilesets/free-asset-pack/` (sheets `1. Grass and dirt.png` e `6. Dirt paths.png`), com a mesma regra de licença das cópias reduzidas. Cada tile é recortado do sheet e reduzido para 64 px com filtro de área. Regenerar: `python3 scripts/build-base-layer.py` (precisa de Pillow).

Ordem dos índices (linha a linha, 8 colunas):
- 0–5 grama, 6–11 terra (6 e 7 são as usadas na praça).
- 12–17 penhasco de frente (grama no topo, rocha embaixo): patamar ao norte.
- 34–39 penhasco girado no sentido horário (grama à direita): patamar a leste.
- 40–45 penhasco girado no sentido anti-horário (grama à esquerda): patamar a oeste.
- 46–51 penhasco girado 180° (grama embaixo): patamar ao sul.
- 18–19 escadas de pedra (degraus compostos a partir dos blocos de piso de pedra do pack "3. Rocks and cliffs"; ver `scripts/build-base-layer.py`).
- 20 trilha vertical. 21–33 (trilhas horizontais, curvas, cruzamentos, arco) estão no atlas, mas o layout hoje só usa a 20.

As paredes são células inteiras. A arte segue o lado do patamar mais alto que encosta na célula (na diagonal, vale a componente vertical).

O jogo lê o mapa de `src/world/village/villageMap.ts`, não deste arquivo. Para o `.tmj` refletir o código, gere de novo: `scripts/build-village-assets.py` (recortes) e depois `scripts/export-village-tiled.cjs` (ver o cabeçalho do script para compilar o TypeScript antes).

