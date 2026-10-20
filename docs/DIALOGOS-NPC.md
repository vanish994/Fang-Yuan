# Diálogos dos NPCs — base de pesquisa

Pesquisa feita na novel *Reverend Insanity* (Gu Zhen Ren) para tirar as falas do
elenco de teste da Vila Gu Yue do genérico ("Fala de teste: ..."). Este documento
guarda **de onde veio cada ideia** e o que é **adaptação de teste**, não citação.

> **Status:** todo o texto abaixo é conteúdo de teste do protótipo. Não é citação
> traduzida da novel, não cria missão, preço, facção jogável ou reputação
> persistida. O jogo se passa numa Vila Gu Yue viva, antes da destruição do clã, e
> Fang Yuan não aparece no elenco.

## Como as falas funcionam no jogo

- Cada NPC tem `dialogue` (primeira conversa) e `dialogues` (conversas seguintes),
  em `src/entities/npc.ts`. `npcLines()` devolve a lista e `npcLine()` escolhe a
  fala pelo número da conversa, em ciclo.
- Tocar no NPC sempre soma uma conversa (`NpcBrain.interact`), então a segunda
  conversa avança uma fala, e depois da última volta à primeira. O marcador
  `(já conversou)` continua aparecendo a partir do segundo toque.
- Limite prático: **até 120 caracteres por fala**. O aviso do HUD
  (`.combat-feedback`) tem largura máxima de 330 px e altura livre; falas maiores
  cobririam a tela no celular. Há teste garantindo o limite.
- Nada de comércio real: as falas de mercador **não** anunciam preço ou item
  comprável, porque essas mecânicas não existem nesta versão.

## Fatos usados (e onde conferir)

| # | Fato da novel | Uso no jogo |
| --- | --- | --- |
| 1 | Vila Gu Yue fica no meio do Monte Qing Mao; há três clãs na montanha (Xiong na frente, Gu Yue no meio, Bai atrás, junto à cachoeira), e a Gu Yue é a **primeira** entre eles. | Gu Yue Bo e Tia Hua falam dos três clãs e do peso de ser o clã líder. |
| 2 | Cerimônia do Despertar: os jovens atravessam um mar de **orquídeas-da-lua** sob pressão crescente; o número de passos define o grau (A–D) e a abertura do apertura. | Gu Yue Lan ("mal cheguei ao grau C") e Mei (as flores antes da cerimônia). |
| 3 | A **Gu Luar-da-Lua** é a Gu-assinatura do clã, entregue a todo discípulo; a primeira tarefa é movê-la até a palma, onde vira uma marca de meia-lua, e lançar a lâmina de luar em bonecos de palha. | Lin Shan, Gu Yue Lan e Gu Yue Fang. |
| 4 | Quem refinar a Gu Luar-da-Lua primeiro no treino ganha **vinte pedras primárias**. | Fala de Gu Yue Fang. |
| 5 | Criar Gu custa caro: a Luar-da-Lua come **pétalas de orquídea-da-lua duas vezes ao dia**; o bordão do protagonista é que criar uma Gu é como criar uma esposa. | Zhao He e Tia Hua; a comparação vai na fala de Zhao He. |
| 6 | **Pedras primárias** são moeda e combustível de cultivo; a essência primária é limitada e se gasta. | Lin Shan e Zhao He. |
| 7 | A **onda de lobos** desce a montanha em ciclos (a cada três anos, no relato do clã), com os lobos de coroa de trovão na frente. | Velho Chen e Mei. |
| 8 | **Gu Yue Bo**: líder do clã, Rank 4 no estágio médio, praticamente estagnado desde que assumiu o posto; adotou Gu Yue Qing Shu como herdeiro. | Falas 2 e 3 de Gu Yue Bo. |
| 9 | **Gu Yue Chi Lian**: ancião Rank 3, chefe da facção Chi, avô de Chi Chen. | Três falas de Chi Lian, incluindo a defesa do neto. |
| 10 | **Gu Yue Mo Bei**: discípulo alto, rosto de cavalo, neto do ancião Mo Chen, da facção Mo; rivalidade Chi × Mo dentro do clã. | Mo Bei, Fang ("os Chi e os Mo dividem os corredores"). |
| 11 | A academia ensina lâmina de luar, essência e avaliações; instrutor e anciãos assistem aos testes dos jovens. | Lan e Fang (instrutor, academia). |

Fontes consultadas em 2026-10-20: `reverend-insanity.fandom.com` (Gu Yue Bo,
Gu Yue Chi Lian, Gu Yue Mo Bei, Gu Yue Clan, Qing Mao Mountain, Moonlight Gu,
Bai Clan), `novelwiki.net` (resumos dos capítulos 1–100), `grokipedia.com`
(arcos iniciais, cerimônia e graus), WebNovel (cap. 22, lâmina de luar; cap. 31,
onda de lobos trienal) e a página da novel na Wikipédia (os três clãs e a nascente
de pedras primárias sob as cavernas da Gu Yue).

## Falas por NPC

| NPC | Papel no jogo | Falas | Ideia de origem |
| --- | --- | --- | --- |
| Gu Yue Mei | moradora | 3 | Rotina da vila, orquídeas-da-lua, aviso de onda de lobos (fatos 2 e 7). |
| Lin Shan | cultivador Rank 1 | 3 | Marca da Meia-Lua na palma e economia de essência (fatos 3 e 6). |
| Zhao He | mercador | 3 | Pétalas como comida de Gu e pedras primárias como moeda (fatos 5 e 6). |
| Velho Chen | guarda | 3 | Ciclo de três anos dos lobos e o erro de confiar só na lâmina de luar (fato 7). |
| Gu Yue Lan | discípulo | 3 | Treino nos bonecos de palha e passos na cerimônia do despertar (fatos 2 e 3). |
| Gu Yue Fang | discípulo | 3 | Aposta das vinte pedras e a divisão Chi × Mo na academia (fatos 4, 10 e 11). |
| Tia Hua | mercadora mortal | 3 | Pétalas e vinho de bambu verde; fofoca sobre as duas facções (fatos 5 e 10). |
| Gu Yue Bo | patriarca Rank 4 | 3 | Estagnação no Rank 4 e o peso de liderar o primeiro clã da montanha (fatos 1 e 8). |
| Gu Yue Chi Lian | ancião Rank 3 | 4 | Contagem de passos como dívida política, orgulho da família Chi e defesa do neto (fatos 9 e 2). |
| Gu Yue Mo Bei | discípulo Rank 2 | 3 | Pressão do avô Mo Chen e rivalidade com Chi Chen (fato 10). |

## O que é adaptação (não cânone)

- Clima, tom e opiniões pessoais de cada fala; a novel não tem essas réplicas.
- O Rank em que cada NPC está **no jogo** (Mei e Tia Hua mortais; Bo Rank 4;
  Chi Lian Rank 3; Mo Bei Rank 2; demais Rank 1) segue a ficha do protótipo. Na
  novel, Mo Bei abre a história no Rank 1 e sobe depois — a fala dele fala da
  cobrança do avô, não de uma idade.
- "Onda de lobos" é usado como ameaça de fundo, sem evento scriptado: o jogo ainda
  não tem onda de lobos, só as criaturas das áreas.
- Nenhuma fala entrega missão, item, desconto ou informação de sistema; são
  ambientação e pistas de mundo.
- Nomes em português (Luar-da-Lua, orquídeas-da-lua, pedras primárias, essência
  primária) são traduções de trabalho, não terminologia oficial.
