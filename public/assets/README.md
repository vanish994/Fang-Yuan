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
| `tilesets/free-asset-pack/` | Tilesets de terreno: grama, água, pedras, árvores, flores, caminhos, neve, deserto e praia. Inclui `ground-atlas-64.png`, um atlas derivado (6×2 tiles de 64 px: linha 1 = grama, linha 2 = terra), recortado de `1. Grass and dirt.png` para o chunk de teste. |
| `tilesets/harmonious-seasons/` | Tilesets por estação (outono, inverno, normal): árvores, arbustos, água animada, caminhos, falésias e personagens de fazendeiro. |

## Licenças e origem

| Pack | Licença | Observação |
| --- | --- | --- |
| HUD (tinyRPG Mana Soul GUI, Gabriel "tiopalada" Lima) | CC0 1.0 | Uso livre, sem atribuição obrigatória. Veja `hud/tinyrpg-mana-soul-gui/README.html`. |
| Feudal Japan Complete 2D Mega Props Pack (nacl1234) | Licença comercial | Permite uso em jogos comerciais. Proíbe redistribuir os arquivos originais como arquivos independentes. Texto completo em `tilesets/feudal-japan-props/Documentation/LICENSE.txt`. Só a versão completa está aqui; a amostra gratuita é subconjunto byte-idêntico e não foi copiada. |
| Personagem Fang Yuan | Não informada | Sprite gerado com IA (provenance no manifesto). Personagem de *Reverend Insanity*. Sem arquivo de licença no pack. |
| Free asset pack, thank u so much! | Não informada | Sem arquivo de licença. Confirmar termos antes de publicar o jogo. |
| Harmonious Seasons - A Seasons Based 2D Pixel Art Pack | Não informada | Sem arquivo de licença. Confirmar termos antes de publicar o jogo. A trilha sonora (WAV de 34 MB) não foi copiada. |

O repositório é privado. Antes de publicar o jogo ou o build, confirme as licenças marcadas como "Não informada".

## Ajustes feitos na cópia

- Dois arquivos do Harmonious Seasons foram renomeados para remover `%` e `&`, que quebram URLs: `Ocean_Water_40%_Anim.png` → `Ocean_Water_40pct_Anim.png`, `Ocean_Water_60%_Anim.png` → `Ocean_Water_60pct_Anim.png`, `Tree_Stumps_&_Bark.png` → `Tree_Stumps_and_Bark.png`.
- `ground-atlas-64.png` foi recortado do tileset original (192×192 px por tile, centro de cada célula) e reduzido para 64×64 px com filtro de área.
- Pastas de pack com nome longo foram simplificadas. Os nomes dos demais arquivos foram mantidos.
- Não foram copiados: a amostra Feudal (subconjunto), o tileset em grade do Feudal (`*_tilesheet.png`, duplicado pelo atlas compactado), as imagens de preview do Feudal, a trilha sonora do Harmonious e as pastas `source/` e `qa/` do personagem.
