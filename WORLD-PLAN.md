# Mundo inicial Qing Mao — distribuição de teste

Planejamento antes da implementação. Derivado de `docs/GDD-ATUALIZADO.md`, `src/entities/npc.ts`, `src/combat/mobCatalog.ts` e do ZIP Mixel v1.7. **Não é uma definição canônica de narrativa, loot, rank de boss ou balanceamento.** Coordenadas são tiles locais da área, em mapas 3×3 chunks de 16×16 tiles (48×48, 32 px/tile). Area é a unidade de carregamento; chunk é apenas divisão de renderização.

## Áreas e ligações

| Área (ID) | Risco | Conexões | Pontos de interesse / recursos visuais disponíveis no pack |
|---|---|---|---|
| Vila Gu Yue (`vila_gu_yue`) | Seguro | leste → Floresta Exterior | Centro, residencial, mercado, treino e portão; paredes e pisos de **ruínas** sem teto (não casas intactas). NPCs; sem comércio funcional. |
| Floresta Exterior (`floresta_exterior`) | Baixo | oeste → Vila; leste → Floresta Perigosa | Clareiras, trilha de caça, áreas de coleta; cogumelos, arbustos, troncos. Coleta funcional ainda não aprovada. |
| Floresta Perigosa (`floresta_perigosa`) | Médio | oeste → Exterior; norte → Região Rochosa; sul → Cavernas; leste → Covil do Lobo | Encruzilhada de risco, emboscadas, árvores densas e pedras. |
| Região Rochosa (`regiao_rochosa`) | Alto | sul → Perigosa; leste → Covil do Javali | Rochas do pack e ruínas; não há sprites de penhasco/montanha no ZIP. |
| Cavernas (`cavernas`) | Alto | norte → Perigosa; leste → Ninho da Serpente | Corredores rochosos/ruínas como representação provisória; o pack não contém conjunto completo de caverna. |
| Covil do Rei Lobo (`covil_lobo`) | Boss | oeste → Perigosa | Arena e lobos existentes como sentinelas de teste. |
| Covil do Rei Javali Demoníaco (`covil_javali`) | Boss | oeste → Rochosa | Arena aberta para movimentação de carga (habilidade ainda não implementada). |
| Ninho do Rei Serpente (`ninho_serpente`) | Boss | oeste → Cavernas; leste → Santuário da Besta | Solo e umidade representados com água/margens existentes, sem regra nova de veneno. |
| Santuário da Besta Antiga (`santuario_besta`) | Extremo | oeste → Ninho | Arena isolada; condição definitiva de acesso ainda a definir, não inventar bloqueio por Rank. |

Acesso entre áreas é bidirecional e conserva progresso de vida/essência/equipagem na sessão. Criaturas derrotadas voltam sozinhas: **60–90 s** para a fauna e **5–6 min** para chefes, sempre na área em que morreram, longe do jogador (≥ 3 tiles) e em tile livre — caso contrário a tentativa é repetida em 5 s. O retorno aparece no HUD. Os seis alvos genéricos anteriores ("Criatura 1–6") foram retirados do mapa: encontros jogáveis usam exclusivamente as 12 espécies e quatro bosses com arte fornecida. Coleta específica por área e persistência entre saves dependem de regras futuras. Não transformar sprites de cogumelos/rochas em itens coletáveis com taxas inventadas.

## Distribuição integral dos 10 NPCs jogáveis

Todos estão na Vila por decisão de layout **provisória**; ID, nome, role, rank e atributos vêm do catálogo existente. Itinerários abaixo registram pontos de interesse de teste, não história aprovada; por enquanto os NPCs percorrem somente rotas curtas próximas do home dentro do raio já existente. Itinerários longos dependem de navegação e horários definidos depois. Os spawns foram redistribuídos pelos bairros e portão; a câmera inicial já não exibe os quatro NPCs agrupados.

| ID | Nome | Área / subárea | Spawn (tile) | Home/território e itinerário provisório | Papel / facção / Rank existente |
|---|---|---|---|---|---|
| npc-gu-yue-mei | Gu Yue Mei | Vila / residencial | (13,21) | Residencial; ronda curta | Aldeã; facção a definir; Mortal |
| npc-zhao-he | Zhao He | Vila / mercado | (17,29) | Mercado; ronda curta | Mercador; facção a definir; 1 |
| npc-old-chen | Velho Chen | Vila / portão | (40,24) | Portão; patrulha curta | Guarda; facção a definir; 1 |
| npc-lin-shan | Lin Shan | Vila / treino | (34,22) | Treino; ronda curta | Cultivador; facção a definir; 1 · Inicial |
| npc-gu-yue-lan | Gu Yue Lan | Vila / residencial | (19,19) | Residencial; ronda curta | Discípula; facção a definir; 1 |
| npc-gu-yue-fang | Gu Yue Fang | Vila / treino | (34,27) | Treino; ronda curta | Discípulo; facção a definir; 1 |
| npc-aunt-hua | Tia Hua | Vila / mercado | (19,35) | Mercado; banca; ronda curta | Mercadora; facção a definir; Mortal |
| npc-gu-yue-bo | Gu Yue Bo | Vila / centro | (24,20) | Centro; posição fixa | Patriarca; facção a definir; 4 |
| npc-gu-yue-chi-lian | Gu Yue Chi Lian | Vila / residencial | (37,31) | Residencial; posição fixa | Ancião; facção a definir; 3 |
| npc-gu-yue-mo-bei | Gu Yue Mo Bei | Vila / residencial | (26,34) | Residencial; ronda curta | Discípulo; facção a definir; 2 |

## Distribuição integral dos 12 mobs jogáveis

Cada espécie permanece com **os mesmos HP, dano, defesa, velocidade, aggro, IA e drop provisórios** do catálogo. Spawns e densidade são **de layout**; o tempo de retorno é regra global (60–90 s), não um número por criatura. Posições autorais ficam onde têm leitura de mapa; as **criaturas extras** (`extraMobs` em `src/world/initialWorld.ts`) são distribuídas em tiles livres por hash da seed da área, com 4 tiles de separação e 4 tiles de proteção em volta de spawns autorais, NPCs, pontos de interesse e da entrada. Nenhum chefe é duplicado. Patrulha é centrada no spawn; matilha somente para as espécies cujo perfil já a habilita. Instâncias adicionais da **mesma espécie**, sem novos atributos: Coelho Lunar (33,26) e Lobo Cinzento (27,18) na Floresta Exterior; dois Lobos Cinzentos no Covil do Rei Lobo (20,26) e (28,26). Seus IDs únicos são derivados do ID da espécie e preservam o atlas original.

| ID | Espécie | Área / subárea | Tier | Spawn (tile) | Densidade/território provisórios |
|---|---|---|---:|---|---|
| mob-wild-boar | Javali Selvagem | Exterior / trilha | 1 | (18,24) | comum; clareira |
| mob-moon-rabbit | Coelho Lunar | Exterior / clareira | 1 | (31,25) | comum; área aberta |
| mob-grey-wolf | Lobo Cinzento | Exterior / mata | 1 | (25,17) | grupo conforme IA; borda da floresta |
| mob-mountain-monkey | Macaco da Montanha | Exterior / coleta | 1 | (25,32) | disperso; árvores |
| mob-green-snake | Serpente Verde | Exterior / mata | 1 | (17,29) | disperso; vegetação |
| mob-fierce-wolf | Lobo Feroz | Perigosa / trilha | 2 | (12,18) | grupo conforme IA; rota de risco |
| mob-demonic-boar | Javali Demoníaco | Perigosa / clareira | 2 | (35,18) | isolado; clareira |
| mob-black-fang-snake | Serpente de Presas Negras | Perigosa / umidade | 2 | (35,32) | disperso; margem |
| mob-shadow-spider | Aranha Sombria | Perigosa / emboscada | 2 | (13,34) | isolada; floresta |
| mob-stone-lizard | Lagarto de Pedra | Rochosa / pedras | 2 | (20,37) | disperso; rochas |
| mob-demon-wolf | Lobo Demoníaco | Cavernas / corredor | 3 | (12,12) | grupo conforme IA; passagem profunda |
| mob-demon-bear | Urso Demoníaco | Cavernas / câmara | 3 | (36,12) | isolado; câmara |
| mob-stone-lizard-burrow | Lagarto de Pedra (ninhada) | Rochosa / pedras | 2 | (26,30) | instância da mesma espécie |
| mob-demonic-boar-guard-1/2 | Javali Demoníaco (guardas) | Covil do Javali | 2 | (21,26) e (27,26) | sentinelas da arena |
| mob-jade-serpent-guard-1/2 | Serpente de Jade (guardas) | Ninho | 3 | (21,26) e (27,26) | sentinelas da arena |
| mob-demon-tiger-guard-1/2 | Tigre Demoníaco (guardas) | Santuário | 3 | (21,26) e (27,26) | sentinelas da arena |

## Quantidade efetiva por área

Soma das posições autorais e das criaturas extras. A vila continua sem mobs.

| Área | Autorais | Extras | Total |
|---|---:|---:|---:|
| Vila Gu Yue | 0 | 0 | **0** |
| Floresta Exterior | 7 | 5 | **12** |
| Floresta Perigosa | 4 | 4 | **8** |
| Região Rochosa | 2 | 4 | **6** |
| Cavernas | 4 | 4 | **8** |
| Covil do Rei Lobo | 3 | 1 | **4** |
| Covil do Rei Javali | 4 | 1 | **5** |
| Ninho do Rei Serpente | 3 | 1 | **4** |
| Santuário da Besta Antiga | 3 | 1 | **4** |
| **Total** | **30** | **21** | **51** |

## Distribuição integral dos quatro bosses jogáveis

Cada boss é um encontro próprio, e **não** um mob adicional espalhado pelo mapa. Bosses usam os valores e o drop provisório já existentes; `spawn condition`, loot específico e dificuldade numérica definitiva **não estão aprovados**. O acesso é por passagem visível. O boss volta **5–6 minutos** depois de derrotado — bem mais que a fauna, para o maior pagamento do jogo não virar farm de 90 s. Minions são somente espécies já definidas, quando indicados; habilidades planejadas no catálogo permanecem não implementadas.

| ID | Boss | Área / arena | Spawn (tile) | Território / sentinelas | Acesso / loot |
|---|---|---|---|---|---|
| mob-grey-wolf-king | Rei Lobo Cinzento | Covil do Lobo / clareira | (24,24) | Arena; duas instâncias do Lobo Cinzento existente (20,26) e (28,26) como sentinelas | passagem Perigosa; drop provisório já existente |
| mob-demonic-boar-king | Rei Javali Demoníaco | Covil do Javali / corredor largo | (24,24) | Arena; sem minion aprovado | passagem Rochosa; drop provisório já existente |
| mob-serpent-king | Rei Serpente | Ninho da Serpente / câmara úmida | (24,24) | Arena; sem minion aprovado | passagem Cavernas; drop provisório já existente |
| mob-ancient-demonic-beast | Besta Demoníaca Antiga | Santuário da Besta / arena isolada | (24,24) | Arena exclusiva; sem minion aprovado | passagem Ninho; bloqueio de endgame e loot especial pendentes de aprovação |

**Não são mobs jogáveis:** `mob-jade-snake` (Serpente de Jade), `mob-demonic-tiger` (Tigre Demoníaco) e `mob-boar-king` (Rei Javali). Existem **somente no atlas de arte**; o GDD registra explicitamente que não possuem adversário nem atributos aprovados. O Tigre citado no exemplo do pedido poderá ocupar uma área de alto risco quando sua inclusão e atributos forem definidos; não criar números ou um segundo Rei Javali para cumprir o exemplo.

## Regras técnicas antes do mapa

1. Gerar máscaras de bioma/caminho/água/ruína no espaço global da área; selecionar tiles do pack por vizinhança N, NE, E, SE, S, SW, W, NW, e apenas após isso variar detalhes pela seed.
2. Mosaicos existentes (árvores 3×4, pedras/arbustos multicélula) são objetos inteiros, âncora nos pés e colisão apenas em tronco/base, sem bloquear a copa inteira.
3. Áreas têm layers lógicas GROUND, TERRAIN, TERRAIN_TRANSITIONS, PATHS, STRUCTURES, DECORATION_BACK, OBJECTS, DECORATION_FRONT, ENTITIES/Y_SORT, COLLISION, GAMEPLAY/SPAWN/RESOURCES. Tiles faltantes não são sintetizados.
4. Saídas devem preservar a navegabilidade entre áreas, spawn seguro e retorno; chunk 16×16 não guarda estado de gameplay isolado.

A praça inicial agora tem gramado, trilhas estreitas e dois recintos de ruínas abertos próximos ao centro, além das quatro estruturas periféricas originais. Não representa casas intactas nem substitui arte ausente.
