# Interface: kit de arte e como ele é usado

O pacote de interface enviado pelo usuário (estilo webnovel de cultivo) é um atlas
único de **1536 × 1024 px**. Ele é recortado por script em peças soltas, e a pele
`src/styles/ui-kit.css` aplica essas peças por cima de `main.css`.

- Fonte: `art/source/ui/ui-kit-source.png` (original, 2,3 MB)
- Recorte: `scripts/slice-ui-kit.py`
- Saída: `public/assets/ui/*.png` + `art/source/ui/ui-kit.json`
- Pele: `src/styles/ui-kit.css` (ligada no `index.html` **depois** de `main.css`)

```bash
/tmp/venv2/bin/python scripts/slice-ui-kit.py --check   # só mede as caixas
/tmp/venv2/bin/python scripts/slice-ui-kit.py           # regrava tudo
```

## Regras que o kit obedece

1. **Nenhum texto vem da arte.** O jogo é PT-BR e os rótulos são HTML/DOM
   (mudam de idioma, de estado e de conteúdo em tempo de execução). O que o
   atlas trazia escrito foi descartado já no recorte.
2. **A arte é 2× a exibição.** Todo `border-image-slice` vale o dobro do
   `border-width` em pixels de tela; ícones usam `--cell` (48 px na ficha,
   40 px no HUD).
3. **Barras são brancas.** `bar-fill.png` é branco puro e recebe cor em CSS com
   `background-blend-mode: multiply` (`--ui-bar-health` / `--ui-bar-essence`).
   Nenhuma cor de vida/essência está assada na imagem.
4. **O miolo da moldura de retrato é transparente de verdade.** O script abre o
   centro (`punch_center`) para o sprite do personagem aparecer.
5. **Layout intacto.** A pele só troca fundo, moldura, cor e ícone. Medidas,
   posições, áreas de toque, foco visível e o `pointer-events` do HUD continuam
   vindos de `main.css`.
6. **Escala ajustável.** Para mudar o tamanho da moldura de um painel basta
   trocar `border-width` (e o slice correspondente); para os ícones basta
   mudar `--cell`.

## Peças publicadas

| Arquivo | Recorte no atlas | Tamanho | Uso |
| --- | --- | --- | --- |
| `panel-9slice.png` | (10,10)–(420,285) | 384×264 | ficha, escolha de personagem, banca, aviso de rotação (slice 64, borda 26 px) |
| `header-3slice.png` | (420,20)–(900,130) | 455×87 | etiqueta da ficha, botão Menu, troca de personagem |
| `divider-3slice.png` | (14,528)–(326,596) | 291×47 | régua sob o cabeçalho da ficha |
| `frame-portrait.png` | (920,18)–(1170,266) | 224×222 | moldura redonda do retrato (64 px, centro vazado) |
| `card-gu-9slice.png` | (14,270)–(346,530) | 321×249 | cartão de personagem na escolha |
| `card-character-9slice.png` | (696,600)–(1000,666) | 290×56 | linhas de camadas de atributo |
| `card-recipe-9slice.png` | (696,664)–(1000,730) | 278×66 | cartões de receita de refino |
| `chip-9slice.png` | (515,604)–(670,660) | 140×41 | cartões de Gu, atributos, HUD, abas, avisos |
| `btn-list-9slice.png` | (24,606)–(320,672) | 286×53 | linhas da banca |
| `slot-gu-9slice.png` | (1078,884)–(1448,958) | 358×66 | fundo dos quatro slots de Gu (quase 1:1) |
| `pill-green-3slice.png` | (1072,750)–(1292,812) | 199×40 | botão de avanço, retorno ao início |
| `pill-gold-3slice.png` | (1288,750)–(1510,812) | 203×40 | aba ativa |
| `btn-small-green.png` | (342,598)–(500,656) | 141×50 | comprar (banca) |
| `btn-small-brown.png` | (342,652)–(500,704) | 140×40 | vender / refinar |
| `btn-small-slate.png` | (342,700)–(500,754) | 140×41 | ações de Gu |
| `btn-small-red.png` | (342,752)–(500,806) | 141×42 | assimilar (irreversível) |
| `btn-close-4x88.png` | 4 quadros | 352×88 | fechar: normal, hover, pressionado, desativado |
| `btn-round-4x128.png` | knob + variações | 512×128 | botões redondos do HUD, 4 estados |
| `btn-basic.png` | (1075,268)–(1186,378) | 128×128 | ataque básico (espada) |
| `joystick-base.png` | (1070,482)–(1262,674) | 232×232 | base do direcional |
| `joystick-knob-3x96.png` | knob + variações | 288×96 | manete: parado, ativo, pressionado |
| `bar-track.png` | (425,125)–(890,193) | 442×52 | trilho das barras |
| `bar-fill.png` | (425,193)–(890,258) | 443×51 | preenchimento branco (recolorido em CSS) |
| `badge-cicada.png` | (1400,386)–(1495,487) | 77×85 | ícone da Cigarra no HUD |
| `gu-icons-8x8-64.png` | grade 8×5 → 8×8 | 512×512 | ícones dos 26 Gu |
| `icon-diamond.png` | (1026,950)–(1094,1018) | 64×64 | ícone do botão Menu |
| `icon-medal-red.png`, `icon-drop-blue.png`, `icon-arrow-green.png`, `cursor-target.png` | diversos | 64×64 / 70×62 | peças reservadas do kit (ainda sem uso na tela) |

## Estados

- **Fechar:** os quatro estados vêm desenhados no atlas (normal, hover,
  pressionado, desativado) e são lidos por `background-position` em passos de
  25% (`background-size: 400% 100%`).
- **Botão redondo e manete:** o atlas traz um desenho por botão. Os estados são
  derivados no recorte (brilho/saturação/alfa), documentados em
  `art/source/ui/ui-kit.json`. Nada de arte inventada.
- **Botão redondo em si:** o miolo do botão é a arte do manete (aro dourado,
  centro verde). O ícone do Gu equipado continua vindo do CSS/`.gu-icon`, então
  trocar o Gu no inventário muda o botão sem tocar na arte.

## Ícones dos Gu

Os sigilos do pack são elementais, não retratos canônicos de Gu. O mapa
`gu_cells` (no JSON e no fim de `ui-kit.css`) associa cada um dos 26 Gu a uma
célula pela cor/elemento: Moonlight → prata, Ghost Fire → violeta, Stone Skin →
cinza, Liquor Worm → dourado, Whirlwind → redemoinho laranja, e assim por diante.
O mesmo mapa serve para 48 px (ficha) e 40 px (HUD) porque a posição é calculada
com `--cell`.

## Desvios em relação ao manifesto enviado

O manifesto (`fang-yuan-ui-kit` v1) descrevia um atlas ideal; a folha real é
menor em algumas peças. O que mudou:

- `gu-icons-8x8-64`: a folha tem **8 × 5** células (40 desenhos, 37 úteis); a
  grade publicada é 8 × 8 para caber no mesmo passo de 64 px, com as 26 células
  usadas pelo catálogo.
- `minimap-frame`: o minimapa do jogo tem 88 px e uma moldura de 9 fatias
  comeria o canvas. Ficou um aro dourado circular no próprio canvas e a caixa
  com borda fina.
- `btn-round-*`, `joystick-knob-*`: estados derivados por brilho, não desenhados
  separadamente.
- `display_size` de alguns botões: o layout real manda (62–72 px no HUD), então
  a arte usa 400% de largura em vez de medidas fixas.

## Armadilhas

- Não recortar textos nem rótulos da arte: o jogo é PT-BR e os rótulos mudam.
- `border-image` precisa de `slice` = 2 × `border-width` para manter a escala 1:1
  do atlas; valores menores comprimem a moldura e somem com o ornamento.
- A pele usa `image-rendering: auto` (a arte é 2×, reduzida em 1×); sprites do
  mundo continuam `pixelated`.
- URLs de CSS usam `/assets/...`: o Vite prefixa com `/Fang-Yuan/` no build. Com
  `./assets/...` o navegador procuraria `/Fang-Yuan/assets/assets/...` (404).
