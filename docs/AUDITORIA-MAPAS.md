# Auditoria visual dos mapas — pacote Mixel 32×32

Comparação das nove áreas geradas (`generateArea`) com a cena de referência do pacote
(`Sample 640x640.PNG`, 20×20 tiles) para achar deformidades puramente cosméticas:
transições de terreno erradas, quadros de atlas trocados, sprites cortados e emendas.

Como não há navegador no ambiente, a verificação foi feita fora do jogo: um dump das áreas
(`tests/support/tsModule.mjs` + `generateArea`) reproduz exatamente as camadas que o
`areaRenderer` desenha, e um renderizador em Pillow recompõe cada área em 1536×1536 na mesma
ordem de profundidade do jogo. Os quadros do atlas foram classificados pixel a pixel
(paletas exatas: grama `(154,176,55)`, terra `(198,156,109)`, água `(115,170,158)`), medindo
quais bordas de cada quadro tocam terra/grama/água.

## O que estava errado

1. **`dirtFrame()` inventava cantos internos.** Depois de tratar as quatro bordas, o código
   devolvia 28/29/40/41 para "diagonal sem terra". Esses quadros não são cantos internos:
   28/29 são meia-célula de grama com degrau e 40/41 são preenchimentos de quadrante. O
   resultado eram blocos de grama no meio da terra e bordas em escada.
2. **Trilhas de 3 células.** `pathTo(..., 1)` desenhava um disco de raio 1 por amostra, então
   toda trilha tinha 2–3 células de largura. Nenhum autotile fica bom nesse formato: sobravam
   degraus de 45°, células com três vizinhas de terra sem peça adequada e cantos quadrados.
3. **Corredores de 1 célula sem peça própria.** Célula de trilha com terra em cima e embaixo
   caía numa peça de borda simples (24/27/37/25), o que desenhava uma cunha de grama no meio do
   caminho. Faltava usar a família de corredor (48/50).
4. **Boca de saída de 7×5.** A abertura de cada portão preenchia 7 células de largura por 5 de
   profundidade e virava um retângulo de terra solto na borda do mapa.
5. **Lagoa aberta.** O lago 4×2 em `35,36` usava apenas os quadros 0–3 (margem norte) e 12–15
   (margem sul). As laterais não tinham orla: a água encostava na grama numa linha reta e o
   conjunto lia como um retângulo azul colado no mapa.
6. **Árvores sobre a trilha e cortadas na borda.** `buildForestTrees` só verificava proteção e
   estruturas; o sprite 3×4 podia nascer com a copa fora do mapa ou por cima do caminho.
   Detalhes soltos (pedra, arbusto, cogumelo) também caíam na terra.
7. **Buracos de grama de 1 célula.** Uma célula de grama cercada de terra nos quatro lados não
   tem transição e aparecia como um quadrado liso no meio da trilha.
8. **Casas só com paredes.** As moradias usam os quadros 24 (topo) e 36 (demais) da folha
   *Ruins*, que são paredões contínuos — não existem peças de telhado ou de canto de casa no
   pacote. Ver "Limitações".

## O que foi corrigido

### Tabela de transição (medida quadro a quadro)

Dirt map = vizinha de terra. A peça escolhida é a que tem grama exatamente nos lados livres:

| vizinhas de terra | quadro | forma |
|---|---|---|
| 4 | 10 | miolo de terra lisa |
| 3 (falta a oeste) | 76 | faixa fina de grama a oeste |
| 3 (falta a leste) | 77 | faixa fina a leste |
| 3 (falta ao norte) | 72 | faixa fina ao norte |
| 3 (falta ao sul) | 84 | faixa fina ao sul |
| norte + sul | 50 | corredor em pé (grama dos lados) |
| leste + oeste | 48 | corredor deitado (grama em cima/embaixo) |
| leste + sul | 43 | quina arredondada noroeste |
| sul + oeste | 42 | quina nordeste |
| norte + leste | 31 | quina sudoeste |
| norte + oeste | 30 | quina sudeste |
| 1 (só ao norte) | 37 | ponta de trilha, grama ao sul |
| 1 (só ao sul) | 25 | ponta, grama ao norte |
| 1 (só a leste) | 24 | ponta, grama a oeste |
| 1 (só a oeste) | 27 | ponta, grama a leste |
| 0 | 44 | mancha isolada |

As diagonais não entram mais na decisão: na cena de referência o próprio pacote usa terra lisa
quando os quatro lados são terra, mesmo com diagonal de grama.

### Trilhas

- `pathTo()` passou a desenhar **1 célula** de largura, com preenchimento do cotovelo quando a
  amostragem anda na diagonal. O caminho continua ligando praça, pontos de interesse e portões,
  e a máscara de colisão não mudou (trilha nunca foi obstáculo).
- Boca de saída reduzida de 7×5 para 3×3 células.
- Buracos de grama de 1 célula dentro da terra são fechados antes de escolher os quadros.

### Lagoa

Mosaico 6×4 em `33,35` (antes 4×2 em `35,36`) com o autotile de água completo do pacote:
quadros 52/50/51/50/53 na margem norte, 48/71/71/71/49 nas laterais, 62/63 na margem sul e
66/67 nas quinas de baixo. Água, colisão e proteção das células são as mesmas de antes (o lago
já era intransponível); só o desenho mudou.

### Cenário

- Árvore 3×4 só é plantada se o corpo inteiro couber com uma célula de folga da borda e não
  tocar trilha, água ou estrutura. Fim das copas cortadas e das árvores em cima do caminho.
- Pedras, arbustos, cogumelos e troncos não nascem mais sobre a trilha.

## Resultado

`npm run check` → lint, `tsc --noEmit` e **216/216** testes.
`npm run build` → 152,50 kB (gzip 48,54 kB).

O único teste ajustado foi o unitário de `dirtFrame` (`tests/initialWorld.test.mjs`): ele fixa
números de quadro, que são justamente o que esta correção mudou. As expectativas de conteúdo das
áreas (conectividade, colisão, spawns, POIs) não mudaram e continuam passando.

## Limitações conhecidas (documentadas, não corrigidas)

- **Sem folha de construções.** O pacote só traz *Ruins* (paredes, arcos, escombros, blocos).
  As casas da vila continuam sendo contornos de parede com pátio de terra dentro: é o que o
  material permite sem inventar arte. Um mosaico de "casa" exigiria telhado e beira, que não
  existem no atlas.
- **Enseadas de 1 célula.** Onde a trilha tem uma reentrância de exatamente uma célula com três
  lados de terra, a orla fica reta naquele tile; as peças de faixa fina do pacote para esse caso
  carregam um tufo de grama desenhado no meio da célula, que sujaria mais do que o canto reto.
- **Escadas diagonais.** Trilha que desce em diagonal vira degraus de 1 célula, como na cena de
  referência do próprio pacote.
