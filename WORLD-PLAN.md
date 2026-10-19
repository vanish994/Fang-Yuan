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

Acesso entre áreas é bidirecional e conserva progresso de vida/essência/equipagem na sessão; inimigos derrotados não reaparecem até recarregar a página. Os seis alvos genéricos anteriores ("Criatura 1–6") permanecem na Floresta Exterior, fora do elenco de 12 espécies. Coleta específica por área e persistência entre saves dependem de regras futuras. Não transformar sprites de cogumelos/rochas em itens coletáveis com taxas inventadas.

## Distribuição integral dos 10 NPCs jogáveis

Todos estão na Vila por decisão de layout **provisória**; ID, nome, role, rank e atributos vêm do catálogo existente. Itinerários abaixo registram pontos de interesse de teste, não história aprovada; por enquanto os NPCs percorrem somente rotas curtas próximas do home dentro do raio já existente. Itinerários longos dependem de navegação e horários definidos depois. Spawns preservam os quatro NPCs visíveis no mobile ao iniciar.

| ID | Nome | Área / subárea | Spawn (tile) | Home/território e itinerário provisório | Papel / facção / Rank existente |
|---|---|---|---|---|---|
| npc-gu-yue-mei | Gu Yue Mei | Vila / residencial | (22,25) | Residencial; casa → mercado → casa | Aldeã; facção a definir; Mortal |
| npc-zhao-he | Zhao He | Vila / mercado | (23,26) | Mercado; loja → mercado → casa | Mercador; facção a definir; 1 |
| npc-old-chen | Velho Chen | Vila / portão | (25.75,24) | Portão; patrulha vila → saída | Guarda; facção a definir; 1 |
| npc-lin-shan | Lin Shan | Vila / treino | (26.75,24.5) | Campo; treino → centro | Cultivador; facção a definir; 1 · Inicial |
| npc-gu-yue-lan | Gu Yue Lan | Vila / residencial | (20,21) | Residencial; casa → treino | Discípula; facção a definir; 1 |
| npc-gu-yue-fang | Gu Yue Fang | Vila / treino | (29,21) | Treino; treino → centro | Discípulo; facção a definir; 1 |
| npc-aunt-hua | Tia Hua | Vila / mercado | (17,30) | Mercado; banca → casa | Mercadora; facção a definir; Mortal |
| npc-gu-yue-bo | Gu Yue Bo | Vila / centro | (24,20) | Centro; posição fixa | Patriarca; facção a definir; 4 |
| npc-gu-yue-chi-lian | Gu Yue Chi Lian | Vila / residencial | (32,30) | Residencial; posição fixa | Ancião; facção a definir; 3 |
| npc-gu-yue-mo-bei | Gu Yue Mo Bei | Vila / residencial | (20,30) | Residencial; casa → treino | Discípulo; facção a definir; 2 |

## Distribuição integral dos 12 mobs jogáveis

Cada espécie permanece com **os mesmos HP, dano, defesa, velocidade, aggro, IA e drop provisórios** do catálogo. Spawns e densidade são **de layout**, não taxas de respawn: não há respawn funcional, política futura a definir. Patrulha é centrada no spawn; matilha somente para as espécies cujo perfil já a habilita. Instâncias adicionais da **mesma espécie**, sem novos atributos: Coelho Lunar (33,26) e Lobo Cinzento (27,18) na Floresta Exterior; dois Lobos Cinzentos no Covil do Rei Lobo (20,26) e (28,26). Seus IDs únicos são derivados do ID da espécie e preservam o atlas original.

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

## Distribuição integral dos quatro bosses jogáveis

Cada boss é um encontro próprio, e **não** um mob adicional espalhado pelo mapa. Bosses usam os valores e o drop provisório já existentes; `spawn condition`, loot específico, respawn e dificuldade numérica definitiva **não estão aprovados**. Até definição, o acesso é por passagem visível e cada boss aparece uma vez por sessão (sem temporizador de respawn; recarregar a página reinicia os encontros). Minions são somente espécies já definidas, quando indicados; habilidades planejadas no catálogo permanecem não implementadas.

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
