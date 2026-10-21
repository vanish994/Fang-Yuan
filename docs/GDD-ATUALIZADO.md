# Reverend Insanity RPG — Game Design Document

**Projeto:** Fang-Yuan  
**Documento:** GDD principal  
**Versão:** 0.3 — cultivo por pedras espirituais; parâmetros do protótipo identificados
**Idioma:** Português  
**Estado:** Revisão consolidada. Decisões explícitas são requisitos; pontos marcados como A definir continuam pendentes.

> Este documento é exclusivo do RPG de *Reverend Insanity*. Não importar sistemas, elementos ou criaturas de outros projetos do desenvolvedor.

## 1. Visão do jogo

Um RPG 2D de exploração e estratégia ambientado no universo de *Reverend Insanity*, com **Fang Yuan como protagonista**. O jogador acompanha sua trajetória de cultivador, explora regiões interconectadas, encontra personagens e facções, obtém e utiliza Gu, coleta recursos, aprende receitas, refina Gu e toma decisões para avançar em um mundo hostil.

O jogo não será um MMORPG. A experiência principal será uma campanha de RPG; o competitivo online será um modo separado, com regras validadas pelo servidor.

### 1.1 Pilares de design

1. **Fidelidade ao universo:** usar os conceitos próprios da obra — Gu, mestres Gu, abertura, essência primordial, pedras espirituais, receitas, refinamento, caminhos e reinos de cultivo.
2. **Preparação e estratégia:** vencer depende de combinação de Gu, recursos, informação e decisões, não apenas de atributos altos.
3. **Liberdade com consequências:** recursos são limitados; escolhas de preparação e gasto devem importar.
4. **Exploração recompensadora:** mapas, áreas secretas, materiais, encontros e personagens incentivam a descoberta.
5. **Progressão legível:** o jogador entende os requisitos, custos, riscos e benefícios de cada avanço.
6. **Regras determinísticas:** o motor do jogo resolve combate, custos, efeitos e progressão; narrativa não pode alterar resultados por conveniência.
7. **Compatibilidade mobile:** controles e interface devem funcionar em telas pequenas, priorizando navegador e uso no celular.

## 2. Identidade e escopo

- **Gênero:** RPG de ação/exploração com sistemas estratégicos de cultivo e Gu. O combate em tempo real no mapa está em protótipo funcional; seu balanceamento ainda precisa de validação.
- **Protagonista:** Fang Yuan.
- **Câmera:** 2D top-down.
- **Arte:** pixel art, com cenários modulares e áreas conectadas.
- **Tecnologia planejada:** Phaser + TypeScript.
- **Plataforma prioritária:** navegador, com atenção especial a Android.
- **Multiplayer:** competitivo online separado da campanha.
- **Não é:** MMORPG com mundo persistente compartilhado por todos os jogadores.
- **Não presumir:** classes tradicionais, sistema elemental genérico ou criaturas importadas de outros projetos.

## 3. Protagonista e narrativa

### 3.1 Fang Yuan

Fang Yuan é o protagonista e o centro da progressão narrativa. A direção visual previamente desejada é uma figura de aparência austera, roupas tradicionais escuras e expressão fria/impassível. A arte deve manter silhueta reconhecível em tamanho pequeno e funcionar em perspectiva top-down.

### 3.2 Abordagem narrativa

A campanha deve se inspirar na trajetória e no universo da novel. A estrutura narrativa exata — adaptação fiel por arcos, recortes de eventos ou linha alternativa — precisa ser detalhada antes da produção de missões em larga escala.

Princípios narrativos:
- As ações de Fang Yuan devem refletir pragmatismo, paciência, cálculo e busca por avanço.
- Personagens e facções devem ter interesses próprios; nem todo NPC deve agir como fornecedor de missão.
- Informação, reputação, alianças temporárias e risco podem influenciar o acesso a oportunidades.
- Evitar transformar decisões moralmente complexas em escolhas simplistas de “bom” e “mau”.
- Eventos centrais da obra não devem ser alterados silenciosamente pelo agente de desenvolvimento; mudanças precisam ser registradas como decisão de design.

### 3.3 Escopo inicial recomendado

O primeiro protótipo narrativo deve cobrir uma pequena área inicial, com movimentação, interação, coleta, um encontro hostil e um objetivo claro. O arco inicial associado à Montanha Qing Mao é uma referência natural para o recorte, mas os eventos e limites exatos precisam ser definidos numa especificação narrativa própria.

## 4. Universo e terminologia

A terminologia deve respeitar a obra. Usar nomes consistentes em português e, quando necessário, manter o nome original em glossário.

Conceitos centrais a representar:
- Mestre Gu e Gu.
- Abertura e aptidão.
- Essência primordial e pedras espirituais.
- Refinamento e receitas.
- Rank e estágio de cultivo.
- Caminhos e especializações existentes no universo da obra.
- Materiais, plantas, bestas e recursos usados em receitas.
- Clãs, seitas, organizações e outras facções pertinentes ao arco adaptado.

Não introduzir novos elementos ou regras universais sem documentá-los como conteúdo original do jogo.

## 5. Sistema de cultivo e progressão

### 5.1 Regra aprovada: sem XP nem níveis

A progressão de Fang Yuan é feita **manualmente** por Rank e estágio, com **pedras espirituais**. Não há XP nem nível numérico, nem avanço automático ao acumular recursos. As pedras espirituais são a única moeda usada nos custos de cultivo (nomes anteriores para esta moeda não criam um segundo recurso); **essência primordial** é outro recurso, reservado à ativação de Gu.

O estado-base do cultivo começa em **Rank 1, Inicial, 0 pedras espirituais e nenhum material**. Para testar a progressão no protótipo, o jogo credita **1.000.000 de pedras espirituais uma única vez por save**, inclusive aos saves anteriores, sem mudar a essência primordial nem transformar o crédito em aquisição narrativa. O saldo e os materiais devem ser verificados pelo motor de regras antes de qualquer gasto. O jogador consulta os requisitos e confirma a operação antes de tentar; avanços repetidos com a mesma confirmação não podem gastar recursos duas vezes.

### 5.2 Nove Ranks e quatro estágios — regra aprovada

Cada um dos **9 Ranks** tem exatamente quatro estágios nesta ordem: **Inicial → Médio → Superior → Pico**. O Rank 9, Pico é o limite: não existe ruptura para Rank 10. Transições até Pico exigem exclusivamente pedras espirituais e não possuem sorteio de falha. Custos maiores nos estágios seguintes são configurados por Rank.

| Rank | Estágios |
|---|---|
| Rank 1 | Inicial, Médio, Superior, Pico |
| Rank 2 | Inicial, Médio, Superior, Pico |
| Rank 3 | Inicial, Médio, Superior, Pico |
| Rank 4 | Inicial, Médio, Superior, Pico |
| Rank 5 | Inicial, Médio, Superior, Pico |
| Rank 6 | Inicial, Médio, Superior, Pico |
| Rank 7 | Inicial, Médio, Superior, Pico |
| Rank 8 | Inicial, Médio, Superior, Pico |
| Rank 9 | Inicial, Médio, Superior, Pico |

### 5.3 Ruptura de Rank — regra aprovada, parâmetros revisáveis

De Pico para Inicial do próximo Rank (somente Ranks 1–8), a tentativa manual exige pedras espirituais e materiais de inimigos. O custo, a lista de materiais, a chance de sucesso e a chance de perda de materiais na falha são dados configuráveis. Cada tentativa é independente das anteriores.

- Sucesso: pedras e materiais exigidos são consumidos; inicia-se o próximo Rank, estágio Inicial.
- Falha: **todas as pedras investidas são perdidas**. Para cada **tipo de material** exigido, um sorteio independente determina se a quantidade investida daquele tipo é perdida; os materiais não perdidos permanecem com o personagem.
- Não existem penalidades adicionais de falha aprovadas. O Rank 9, Pico nunca pode tentar ruptura.

### 5.4 Valores iniciais do protótipo — aprovados para teste, NÃO canônicos/definitivos

Esta tabela é uma **configuração provisória centralizada** em `src/entities/cultivationBalance.ts`, aprovada para o protótipo e sujeita a rebalanceamento. Não descreve custos da novel. Cada ruptura exige uma quantidade provisória de material identificada tecnicamente como `ruptura-rank-N`; o item e o inimigo que o solta ainda não foram escolhidos. Veja também [`BALANCEAMENTO.md`](../BALANCEAMENTO.md).

| Rank atual | Inicial→Médio | Médio→Superior | Superior→Pico | Pico→próximo Rank | Materiais* | Sucesso | Perda por tipo na falha |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 20 | 35 | 55 | 90 | 1 | 80% | 10% |
| 2 | 45 | 75 | 115 | 180 | 2 | 75% | 15% |
| 3 | 90 | 150 | 230 | 360 | 3 | 70% | 20% |
| 4 | 180 | 300 | 460 | 720 | 4 | 65% | 25% |
| 5 | 360 | 600 | 920 | 1.440 | 5 | 60% | 30% |
| 6 | 720 | 1.200 | 1.840 | 2.880 | 6 | 55% | 35% |
| 7 | 1.440 | 2.400 | 3.680 | 5.760 | 7 | 50% | 40% |
| 8 | 2.880 | 4.800 | 7.360 | 11.520 | 8 | 45% | 45% |
| 9 | 5.760 | 9.600 | 14.720 | — | — | — | — |

\*Quantidade por Rank no protótipo; os materiais concretos não estão definidos.

### 5.5 Abertura, Mar Primordial e essência primordial

**Terminologia e origem definidas:** a energia dos Gu é **essência primordial**, não mana. Ela vem do **Mar Primordial na abertura (dantian)** de Fang Yuan; não se confunde com as pedras espirituais, usadas como moeda de cultivo. A aptidão e as regras de capacidade/evolução da abertura ainda estão **A definir**. A reserva do combate começa com capacidade e recuperação **provisórias** (veja §11.6): sua implementação atual não pretende definir a capacidade conforme Rank ou aptidão e não persiste a energia ao recarregar a página. Não há progressão paralela de XP.

### 5.6 Estado da implementação e dependências pendentes

O motor de cultivo é independente da interface Phaser, valida saldo e inventário mínimo de materiais e persiste **Rank, estágio, pedras e materiais** localmente no navegador após cada alteração. A ficha móvel mostra o próximo custo, chance e resultado, exigindo confirmação antes do gasto. Inimigos de teste no mapa deixam pedras e material de ruptura; o inventário completo e a troca dos drops por pedras na vila continuam pendentes. A persistência é local à campanha de teste e não substitui autoridade de servidor em um eventual modo competitivo.

O **spritesheet do Mar Primordial foi enviado pelo usuário** e está em `public/assets/ui/mar-primordial-11x128.png` (1408 × 128 px, 11 quadros horizontais de 128 × 128 px, do mar vazio ao cheio). É exibido **somente na seção de avanço de estágio/Rank do menu de personagem**, com o quadro selecionado pela razão entre essência primordial atual e capacidade máxima do **mesmo estado de combate** usado para custos e regeneração; o HUD da tela de jogo usa apenas uma barra de essência primordial, igual à barra de vida, com valor exato em números. A imagem no menu tem somente 11 níveis. O desenho representa visualmente o mar dentro da abertura/dantian; não determina por si só capacidade, aptidão, acertos ou recuperação. Não é um substituto criado nem arte do pack de cenário Mixel.

## 6. Sistema de Gu

### 6.1 Princípios

Gu são entidades e ferramentas centrais da jogabilidade, não apenas habilidades intercambiáveis. Cada Gu deve ter função, custo, condições, limitações e papel estratégico claramente definidos.

### 6.2 Dados de cada Gu

Cada definição de Gu deverá incluir, conforme aplicável:
- ID estável e nome;
- descrição e origem;
- rank;
- caminho;
- tipo e função;
- efeitos ativos e passivos;
- custo de essência primordial;
- requisitos para uso;
- duração, alcance e alvo;
- condições de ativação e encerramento;
- limitações, riscos e incompatibilidades;
- método de obtenção;
- receita e materiais relacionados;
- dados de balanceamento;
- referência de arte, animação e efeitos sonoros;
- notas de fidelidade à obra e fonte de validação.

### 6.3 Equipamento e capacidade — Definido

Fang Yuan terá quatro slots funcionais de Gu equipados:
1. **Gu de ataque ativo**;
2. **Gu passivo**;
3. **Gu de movimento**;
4. **Gu de apoio**.

Os slots têm funções distintas. O Gu passivo pode aumentar atributos, como a defesa ou a força; o Gu de apoio pode oferecer recuperação de essência, cura ou outros efeitos de suporte. A troca de Gu equipados só é permitida fora de combate. Regras de inventário e quantidade total de Gu carregados permanecem **A definir**.

### 6.4 Aquisição

Métodos de aquisição definidos para o sistema geral:
- **Compra na vila:** comerciantes podem vender Gu, mas os preços devem ser altos para que comprar um Gu seja uma decisão econômica importante, não uma aquisição trivial. Disponibilidade, preço por Rank e estoque ficam **A definir**.
- **Descoberta na natureza:** Gu podem aparecer de forma aleatória em áreas exploráveis. A ocorrência deve depender da região e de regras de distribuição configuráveis, evitando que todos os Gu apareçam em qualquer lugar.
- **Captura estratégica:** alguns Gu encontrados na natureza podem perceber a aproximação de Fang Yuan e fugir ou se afastar antes de serem capturados. Nesses encontros, o jogador precisará observar o comportamento do Gu e usar posicionamento, escolha de rota, terreno e habilidades apropriadas para tentar alcançá-lo. Nem todo Gu selvagem precisa fugir; o comportamento deve variar conforme a espécie e o encontro.
- **Outros métodos:** recompensas narrativas, refinamento, missões e encontros especiais podem fornecer Gu específicos.

Os Gu selvagens devem ser tratados como encontros de exploração, não como itens que entram automaticamente no inventário ao tocar neles. O método de captura, as condições de sucesso e as diferenças por tipo de Gu serão definidos individualmente. Distinguir sempre as regras canônicas da obra das adaptações criadas para a jogabilidade.


### 6.5 Gu iniciais e aquisição na campanha — Proposta definida para o início

#### Moonlight Gu — Gu de ataque ativo

- Fang Yuan recebe o **Moonlight Gu** da vila no início do jogo, como seu Gu inicial de ataque.
- **Adaptação de gameplay:** ao ser ativado, dispara um corte em meia-lua que percorre uma distância máxima definida pelo alcance do Gu.
- O efeito visual do corte deve corresponder a uma hitbox própria, validada pelo motor de combate; a arte não determina sozinha o resultado mecânico.
- Se o corte atingir um inimigo e derrotá-lo, continua avançando até acabar o alcance. Se atingir um inimigo que sobreviva, o corte para no primeiro inimigo atingido.
- O golpe deve respeitar alcance, colisão e regras de acerto, sem atravessar inimigos sobreviventes.
- Velocidade do projétil, dano, alcance, custo de essência e recarga ficam **A definir** para balanceamento.

#### Liquor Worm — Gu de apoio

- O **Liquor Worm (Verme do Licor)** poderá ser obtido no início da campanha, no final de uma caverna explorável com vários inimigos pelo caminho.
- **Adaptação de gameplay específica do projeto:** equipado no slot de apoio, concede recuperação passiva de essência primordial.
- Esta função de regeneração é uma adaptação para o RPG; não deve ser apresentada como descrição literal de sua habilidade canônica. A relação exata com a função da obra deverá ser documentada nas notas de fidelidade.
- Valor da recuperação, limites, condições e eventuais custos ficam **A definir**.

#### Stone Skin Gu — Gu passivo (nome indicado pelo usuário)

- O ícone enviado para o slot passivo foi identificado pelo usuário como **Stone Skin Gu (Pele de Pedra)**; substitui a referência anterior a Jade Skin neste protótipo, sem tratar as duas espécies como equivalentes canônicas.
- **Adaptação de gameplay específica do projeto:** aumenta a defesa enquanto estiver equipado, de acordo com valores de balanceamento configuráveis.
- O método e o momento de obtenção ainda ficam **A definir**.
- O aumento defensivo, sua magnitude e eventuais condições definitivas precisam ser aprovados após testar o valor provisório do protótipo. Não presumir que o efeito passivo do jogo reproduza literalmente todas as regras da obra.

#### Whirlwind Gu — Gu de movimento (nome provisório)

- O usuário descreveu o quarto ícone como um Gu relacionado a “redemoinho” e pediu ajuda com a grafia. **Whirlwind Gu / Gu do Redemoinho** é um rótulo provisório na interface, não confirmação de nome canônico ou aquisição narrativa.
- No protótipo, equipa-se no slot de movimento e habilita o dash com bônus curto de velocidade. Os parâmetros seguem provisórios na configuração de combate.

Os ícones de Gu vêm do **kit de interface do usuário**, um atlas de 1536 × 1024 px recortado por `scripts/slice-ui-kit.py`. A grade publicada `public/assets/ui/gu-icons-8x8-64.png` tem células de **64 × 64 px** e cobre os **26 Gu** do catálogo: cada Gu aponta para uma célula (coluna/linha) e o mesmo mapa serve para 48 px na ficha e 40 px no HUD. Os sigilos do pack são elementais, escolhidos pela cor de cada Gu; não são retratos canônicos nem arte exclusiva de um Gu da novel. A aba Inventário / Gu mostra esses ícones na coleção de teste e ao lado dos slots equipados. Eles não criam Gu adquiridos ou habilidades novas: apenas Moonlight começa equipado. A arte é separada das hitboxes e dos valores mecânicos; o kit completo, com as fatias de cada peça, está em [`UI-ARTE.md`](UI-ARTE.md).

Essas decisões descrevem a adaptação do jogo. Ao documentar Gu adicionais, separar sempre efeito canônico confirmado de mecânica criada para o RPG.


### 6.6 Passiva especial — Cigarra da Primavera e Outono

- Fang Yuan possui uma passiva especial chamada **Cigarra da Primavera e Outono**. Ela é uma mecânica própria desta adaptação de RPG inspirada na obra; não deve ser tratada como um Gu comum equipado em um dos quatro slots.
- **Gatilho:** quando Fang Yuan morre em combate e a passiva não está em recarga, há **5% de chance** de ativação.
- **Sucesso:** Fang Yuan retorna à vida com **50% da vida máxima**. A passiva entra imediatamente em uma recarga muito longa e não pode tentar ativar novamente enquanto estiver em recarga.
- **Falha:** a morte é resolvida normalmente, sem ressurreição. Como a recarga foi definida para começar após uma ativação bem-sucedida, uma tentativa falha não inicia a recarga.
- A passiva não garante sobrevivência e não substitui os sistemas normais de morte e derrota.
- **A definir para a versão final:** duração exata da recarga e estado dos demais recursos ao reviver. No protótipo, os demais recursos permanecem inalterados, a recarga dura 10 minutos e a ID do golpe evita resolver duas vezes o mesmo dano letal; são escolhas provisórias, não cânone.
- A ativação e a recarga devem ser resolvidas pelo motor de regras, não apenas por animações ou lógica visual.

## 7. Refinamento e receitas

O refinamento será um sistema próprio, não apenas uma combinação instantânea de itens.

Uma receita deve definir:
- Gu ou resultado produzido;
- materiais e quantidades;
- requisitos de rank, conhecimento ou instalações, quando aplicáveis;
- custo em recursos;
- etapas e condições;
- chance de sucesso ou falha, se prevista;
- consequências da falha;
- tempo de execução, caso seja relevante;
- origem da receita e como o jogador a descobre.

As fórmulas e regras de refinamento devem ser orientadas por dados. O sistema precisa suportar novas receitas sem reescrever o motor.

## 8. Recursos, coleta e economia

A economia deve reforçar a necessidade de preparação. Recursos e materiais precisam ter usos claros e fontes controladas.

### 8.1 Pedras espirituais: obtenção e perda na morte

- **Terminologia:** o jogo chama **pedras espirituais** a moeda de cultivo e comércio (correspondente às pedras primevas da obra). Este é um só recurso, distinto da essência primordial.
- **Drops de inimigos:** inimigos podem deixar pedras espirituais como saque, além de outros drops definidos por espécie e dificuldade.
- **Troca na vila:** o jogador pode entregar drops obtidos de inimigos a um NPC/comerciante da vila e receber pedras espirituais em troca. Os itens aceitos e as taxas de troca serão definidos pelo balanceamento.
- **Penalidade por morte:** quando Fang Yuan morre em combate e a Cigarra da Primavera e Outono não o ressuscita, ele perde uma parte das pedras espirituais que carrega. A quantidade ou percentual perdido, o destino das pedras perdidas e as regras para recuperá-las permanecem **A definir**.
- **Ainda não implementada:** sem valor aprovado, o protótipo não retira pedras na morte; permite retorno ao centro com vida cheia e preserva pedras e materiais. Isso não substitui a regra planejada de penalidade.
- A penalidade deve ser clara para o jogador e não pode retirar mais pedras do que ele possui. A ressurreição bem-sucedida pela Cigarra precisa ser tratada como um resultado diferente da morte normal; se ela evita totalmente a penalidade, isso será confirmado no balanceamento.

Categorias iniciais:
- pedras espirituais;
- materiais de refinamento;
- plantas e recursos naturais;
- itens consumíveis;
- equipamentos e ferramentas relevantes;
- receitas e informações;
- itens de missão.

Cada item deve registrar origem, usos, valor de troca quando houver, limites de acumulação e condições especiais. A economia não deve ser balanceada apenas por preços: disponibilidade, risco de obtenção e utilidade também importam.

## 9. Exploração e mundo

### 9.1 Estrutura do mapa

O mundo será construído com áreas top-down interconectadas. A transição entre regiões adjacentes deve ser contínua sempre que viável, sem telas de carregamento desnecessárias. Regiões maiores podem ser divididas tecnicamente, mantendo continuidade visual e de navegação.

### 9.2 Construção de mapas

- Usar tilesets modulares e camadas com funções distintas.
- Separar terreno, decoração, elementos acima do personagem, colisão e objetos interativos.
- Manter escala, perspectiva, iluminação e paleta consistentes.
- Criar caminhos legíveis e pontos de referência visuais.
- Usar obstáculos e objetos para comunicar limites físicos sem depender apenas de paredes invisíveis.
- Otimizar mapas para dispositivos móveis.
- Registrar a licença e as restrições de cada pacote de assets.

### 9.3 Conteúdo explorável

As regiões poderão conter NPCs, materiais, áreas ocultas, pontos de interesse, perigos, encontros e acessos condicionados. O conteúdo deve ser ligado à região e ao arco narrativo, não distribuído aleatoriamente sem contexto.

**Mundo inicial jogável — organização de teste, não cânone:** a tabela completa de nove áreas, saídas, pontos de interesse, dez NPCs, doze mobs e quatro bosses está em [`WORLD-PLAN.md`](../WORLD-PLAN.md). Area é a unidade de gameplay/carregamento; chunk 16×16 é somente uma divisão técnica. Cada área tem 3×3 chunks, uma seed determinística, máscaras de colisão independentes do desenho e saídas bidirecionais. Os mobs jogáveis ficam fora da vila; cada boss tem sua própria arena, sem impor Rank, loot especial ou condição de acesso não aprovados. Vida, essência e equipamento continuam durante a travessia. O mundo tem 51 criaturas no total (30 posições autorais + 21 extras distribuídas em tiles livres; a vila não tem nenhuma) e **respawn por tempo**: 60–90 s para a fauna, 5–6 min para chefes, sempre longe do jogador e com aviso no HUD. O respawn não é salvo entre sessões — recarregar a página reinicia os encontros. Para representar a vila sem inventar arte, as construções são abertas e usam paredes/pisos de **ruínas** existentes no ZIP Mixel; o mesmo pack não possui casas intactas, penhascos nem arte integral de caverna. Cogumelos e rochas visíveis não têm coleta mecânica até aprovação de itens e regras. As rotas curtas dos NPCs são teste de circulação local, não definições narrativas de rotina ou facção. A antiga máscara de floresta plana continua somente para regressão; o mapa ativo vem do gerador modular.

## 10. NPCs, facções e missões

NPCs devem possuir identidade, objetivos e relações. Facções podem controlar recursos, informação, rotas e oportunidades, de acordo com a história adaptada.

**Protótipo jogável (não canônico):** dez NPCs com nomes e atributos provisórios usam atlas próprio de poses estáticas de 32×32 px nas quatro direções (Mixel permanece como fallback), sem animação de caminhada, sem substituir a arte própria de Fang Yuan. A movimentação usa a máscara do mapa e raio fixo desde o ponto inicial; tocar num NPC mostra fala temporária, sem enviar o toque à navegação; as falas de teste rodiziam a cada toque, reagem ao Rank/pedras/Gu equipadas do jogador uma vez por sessão e estão documentadas em `docs/DIALOGOS-NPC.md`. Jiang Ya representa o vendedor do clã e traz o rótulo "banca de Gu" no mapa; tocar nele abre a **Banca do clã**, que compra material de ruptura (8/24/70/200 pedras por unidade nos Ranks 1–4) e vende seis Gu Rank 1 simples pelo preço de referência do catálogo (650–700 pedras). A troca é validada por `src/combat/vendor.ts`, grava pedras e inventário antes de publicar e desfaz o pagamento se o inventário falhar; preços são balanceamento, não cânone. O inventário de teste ainda entrega uma cópia de cada Gu Rank 1, então a banca repõe pilha e será a fonte quando esse inventário de teste for retirado. Um cérebro puro compartilhado com criaturas organiza Perception → Memory → Goals → Decision → Actions: NPCs percebem perigo e registram a última interação da sessão; criaturas investigam, alertam aliadas de grupo e podem fugir ao perder vida. O motor de combate, não o cérebro, decide dano, alcance, recarga e recompensa. O catálogo de teste tem 15 mobs e 4 bosses distribuídos pelo mundo com números **provisórios**, não cânone nem balanceamento aprovado. Habilidades específicas como veneno, invocação ou atordoamento ainda são **propostas não implementadas**; comércio existe só na banca do Jiang Ya; os 15 mobs do catálogo usam poses estáticas próprias de 32×32 px nas quatro direções. Os atlas de NPCs e mobs foram recortados das imagens 1920×1920 enviadas pelo usuário; as três linhas finais do atlas de mobs (Serpente de Jade, Tigre Demoníaco e Rei Javali) agora têm encontros próprios; Rei Javali é um elite de Rank 3 e não substitui o boss Rei Javali Demoníaco. Os quatro bosses usam um atlas estático direcional derivado do spritesheet 1920×1920 enviado pelo usuário, reduzido por nearest-neighbor: linhas lobo, javali, serpente e besta antiga, com colunas baixo, esquerda, cima, direita; os 16 quadros finais são de 48×48 px. Não é animação de caminhada. Reputação persistida, rotinas, facções, missões e NVIDIA/LLM seguem pendentes.

Uma missão deve especificar:
- ID e título;
- contexto narrativo;
- pré-requisitos;
- etapas e condições de conclusão;
- personagens e regiões envolvidos;
- recompensas e custos;
- consequências;
- estados possíveis;
- critérios de teste.

Evitar missões que sejam apenas “elimine X inimigos” quando houver oportunidade para exploração, investigação, negociação ou preparação.

## 10. Interface de menu e preparação — Definido

No celular, o jogo é apresentado em **paisagem**; em retrato há um aviso para girar o aparelho, sem tentar forçar rotação onde o navegador não permite. Um botão discreto ao lado do Menu alterna tela cheia quando a API do navegador estiver disponível e tenta travar a orientação em paisagem ao entrar. Falhas da API são comunicadas, e a rotação manual permanece possível. O menu do personagem apresenta duas abas operantes, **Avanço** e **Inventário / Gu**, com navegação por toque ou teclado em telas pequenas. Ambas usam a moldura, cabeçalho e retrato do pack de GUI Tiny RPG - Mana Soul (CC0); o HUD de combate compartilha essa linguagem visual, sem usar os tiles de cenário para simular interface.

### 10.1 Aba de Gu / Equipamento

- Exibe os quatro slots funcionais de Gu equipados: **Gu de ataque ativo**, **Gu passivo**, **Gu de movimento** e **Gu de apoio**.
- Mostra os Gu disponíveis no inventário e permite equipar ou trocar Gu **somente fora de combate**.
- Apresenta efeitos, custos, requisitos, compatibilidade com o slot e outras condições relevantes de cada Gu antes de equipá-lo.
- A interface deve destacar quando um slot está vazio ou quando um Gu não pode ser equipado, explicando o motivo.

### 10.2 Aba de Cultivo / Avanço de Rank

- Mostra o Rank e o estágio de cultivo atuais, o próximo avanço disponível e os requisitos necessários.
- Exibe o custo em pedras espirituais do próximo estágio e, para rupturas de Rank, pedras, materiais, chance de sucesso e risco de perda dos materiais.
- Antes de iniciar uma ruptura, informa a chance de sucesso conhecida e os riscos de falha conforme as regras definidas no jogo.
- A subida de estágio ou Rank é iniciada manualmente pelo jogador; cumprir os requisitos não avança o cultivo automaticamente.
- Não permitir iniciar um avanço quando os requisitos não forem atendidos; explicar claramente o que falta.
- A interface não deve inventar ou ocultar valores: chances, custos e efeitos devem vir dos dados e regras autoritativos do jogo.

### 10.3 Organização e uso

- As abas de Gu/Equipamento e Cultivo/Avanço de Rank ficam acessíveis pelo menu do personagem.
- A navegação deve ser simples e responsiva para uso em celular.
- A abertura do menu não pausa automaticamente o mundo nem o combate; o comportamento exato do mundo enquanto o menu está aberto permanece **A definir**. A troca de Gu continua bloqueada durante combate.

## 11. Combate

### 11.1 Modelo principal — Definido

O combate será **em tempo real, diretamente no mapa top-down**, sem transição para uma arena separada. Personagens e criaturas podem se movimentar enquanto o combate acontece. Posicionamento, distância, alcance, obstáculos e terreno poderão influenciar os resultados. O combate não será por turnos; ações e efeitos serão processados continuamente pelo motor de regras.

### 11.2 Ativação híbrida de Gu — Definido

- **Gu ativos:** o jogador decide quando ativá-los, respeitando custo, alcance, recarga e condições de cada Gu.
- **Gu passivos:** seus efeitos são aplicados automaticamente quando as condições especificadas forem atendidas.
- Cada Gu deve declarar se é ativo, passivo ou se possui componentes dos dois tipos.
- A interface deve comunicar custos, recargas, condições e motivos pelos quais um Gu não pode ser ativado.
- Durante o combate, Fang Yuan terá **4 espaços de Gu equipados**, cada um com uma função definida:
  1. **Gu de ataque ativo:** Gu ativado manualmente para executar um ataque ou habilidade ofensiva.
  2. **Gu passivo:** Gu cujo efeito funciona automaticamente. Pode ser ofensivo, como um Gu que aumenta a força, ou fornecer outro benefício passivo compatível.
  3. **Gu de movimento:** Gu que concede mobilidade especial, incluindo o dash quando aplicável. O botão de dash só aparece se houver um Gu de movimento equipado que permita essa ação.
  4. **Gu de apoio:** Gu voltado a suporte, como o Verme do Licor, que pode acelerar a recuperação de essência primordial, ou um Gu de cura, conforme suas regras.
- Os quatro espaços são **slots de equipamento por função**, não quatro atalhos livremente intercambiáveis durante o combate. **Gu equipados só podem ser trocados fora de combate**; durante uma luta, a configuração fica bloqueada. O jogo deve comunicar claramente quando o personagem ainda está em combate e não pode trocar seus Gu.
- Cada Gu equipado deve respeitar suas próprias condições, custos, recargas e compatibilidade com o slot correspondente.
- **Mira híbrida:** o jogador pode tocar em um inimigo para selecioná-lo manualmente ou acionar uma opção para selecionar automaticamente o inimigo mais próximo. A seleção automática não deve substituir a seleção manual sem uma ação explícita do jogador.
- A seleção de alvo não ignora regras de alcance, linha de visão, obstáculos ou condições de ativação de ataques e Gu.

### 11.3 Tipos de ataque — Definido

- **Ataque básico:** ação de combate disponível sem depender da ativação de um Gu. Seu dano, alcance, velocidade e possíveis custos ficam **A definir**.
- **Gu ativos:** habilidades acionadas manualmente pelo jogador, conforme as regras e limitações de cada Gu.
- **Ataques especiais combinados:** técnicas que exigem uma combinação específica de Gu. Cada combinação deve declarar seus requisitos, efeito, custo total de essência primordial, alcance, condições, recarga e possíveis riscos. Não presumir que qualquer par de Gu possa ser combinado.
- As combinações devem acrescentar decisões táticas, sem tornar obsoletos os Gu individuais ou o ataque básico.

### 11.4 Controles de combate para celular — Definido

- **Joystick virtual à esquerda:** controla o movimento de Fang Yuan durante a exploração e o combate em tempo real.
- **Botão de ataque básico:** executa o ataque básico sem exigir a ativação de um Gu.
- **Botão de Gu de ataque:** permite ativar o Gu de ataque selecionado, respeitando seus custos, alcance, recarga e condições. Os 4 espaços de acesso rápido continuam sendo atalhos para os Gu.
- **Botão de dash:** só aparece quando Fang Yuan possui um Gu de movimento que conceda essa ação. Sem um Gu de movimento compatível, o botão fica oculto e o dash não pode ser usado.
- **Efeito do dash:** ao ativá-lo, Fang Yuan realiza uma arrancada rápida na direção do movimento. Ao terminar a arrancada, recebe também um bônus temporário e curto de velocidade de movimento, para facilitar a fuga, perseguição ou reposicionamento. O bônus é parte do efeito do Gu de movimento, não um efeito visual.
- **Balanceamento do dash:** distância da arrancada, intensidade e duração do bônus de velocidade, custo de essência primordial e recarga permanecem **A definir**. O bônus não deve se acumular indefinidamente com ativações sucessivas; a regra de reaplicação/empilhamento será definida no balanceamento.
- Os controles devem funcionar em tela sensível ao toque e não podem cobrir desnecessariamente o alvo selecionado ou informações essenciais de combate.

### 11.5 Regras gerais

- O motor de regras é a autoridade sobre custos, acertos, dano, efeitos, recargas e resultados.
- O custo de essência primordial é validado antes da execução; não permitir essência negativa.
- Cada efeito especifica alvo, duração, prioridade, empilhamento, remoção e interação com outros efeitos.
- Movimento, colisão, alcance, linha de visão, interrupções e condições de acerto devem ser explícitos e testáveis.
- Animações e efeitos visuais não podem alterar resultados mecânicos.
- **Poses e partículas do protótipo (implementado, só apresentação):** as quatro poses enviadas pelo usuário — caminhada, conjuração, arremetida e queda — são animações 4×4 de 64px (32px no mundo) e não mudam hitbox, velocidade, dano, alcance nem recarga. Ativar um Gu toca a pose de conjuração (Gu de movimento toca a arremetida) por ~0,4 s e volta sozinha à caminhada; a morte toca a pose de queda, travada até o respawn. As partículas vêm de uma folha de quatro formas (redemoinho, corte, fumaça, rastro) publicada como máscara clara e pintada com o `visual.color` do Gu ativo, então qualquer Gu — inclusive os Rank 2 — tem efeito próprio sem arte nova. As três poses de ação são escaladas pelo mesmo fator da caminhada e ancoradas pelo centro dos pés, para o corpo não crescer nem deslizar ao trocar de animação.
- **Segundo personagem jogável — Bai Ning Bing (implementado, v0.5):** a seleção no topo da tela troca o personagem em campo **sem criar outro motor, inventário ou save**: Gu, cultivo, refino, banca e pedras continuam únicos. O que muda é a arte das quatro poses (mesma grade, mesma escala e mesma hitbox do Fang Yuan), a vida (85%), a defesa (−1), o passo (+5%) e o formato do ataque básico, que passa a ser um **estilhaço de gelo** (190 px, 650 ms, 9 de dano, sem custo de essência) em vez do golpe corpo a corpo (62 px, 600 ms, 14 de dano). O disparo não verifica linha de visão ao sair — o projétil viaja e para na parede como qualquer outro, então atirar num alvo protegido desperdiça o tiro. O saldo é deliberado: ela é pior em dano por segundo (−41%), em eficiência (recarga maior) e em sobrevivência, e melhor em alcance (3×) e mobilidade; nenhum dos dois é superior em dano, alcance, velocidade e eficiência ao mesmo tempo. As partículas de gelo usam uma folha própria de 48 px por quadro, também publicada como máscara e pintada pelo `visual.color` do Gu (ou pela cor do personagem no básico), sem arte duplicada por cor. A escolha persiste em chave separada do estado de Gu e trocar de personagem não altera Rank, estágio, pedras, materiais, equipamento nem Gu assimilada.
- O servidor validará ações e resultados nas partidas competitivas.
- Não introduzir turnos ou ativação automática de Gu ativos sem decisão explícita.

### 11.6 Implementação do protótipo — funcional, **não canônica**

`src/combat/combatEngine.ts` resolve dano, morte, aquisição de recompensa, recargas, Gu e IA em tempo real sem depender de Phaser; `src/combat/combatConfig.ts` reúne todos os valores **provisórios** abaixo. O mapa usa toque para selecionar inimigo manualmente; a alternância de seleção automática procura o inimigo vivo mais próximo, mas não substitui a seleção manual. Ataque básico requer alvo em alcance e caminho livre. A Lua pode ser lançada na direção do alvo selecionado ou da orientação atual, sem alvo obrigatório. Sua hitbox desloca-se no motor, separada do desenho do projétil; segue atravessando o inimigo abatido e para no primeiro sobrevivente, no obstáculo ou ao atingir o alcance. Uma instância do projétil registra as IDs já atingidas para não causar dano duplicado.

| Regra provisória (unidades) | Valor nesta versão |
|---|---:|
| Vida / defesa / essência máximas de Fang Yuan | 100 / 2 / 100 |
| Regeneração base de essência | 1 por segundo |
| Criatura de teste: vida / defesa / dano | 36 / 1 / 8 |
| Criatura: alcance de ataque / detecção / velocidade / recarga | 32 px / 96 px / 32 px/s / 1,45 s |
| Ataque básico: dano / alcance / recarga | 12 / 62 px / 0,6 s |
| Lua: dano / alcance / largura da hitbox / velocidade | 22 / 224 px / 26 px / 320 px/s |
| Lua: custo / recarga | 16 essência / 1,8 s |
| Stone Skin / Liquor Worm equipados | +4 defesa / +2 essência por segundo |
| Whirlwind Gu (**nome provisório**): distância / custo / recarga | 96 px / 20 essência / 5 s |
| Gu de movimento: bônus após dash / duração | ×1,5 velocidade / 1,8 s (sem acumular) |
| Cigarra: chance / vida restaurada (**definido no GDD**) | 5% / 50% da vida máxima |
| Cigarra: recarga após sucesso (**provisória**) | 10 minutos |
| Bloqueio de troca após combate / golpe detectado | 5 s sem ameaça/ação hostil |
| Drop por criatura de teste (garantido, **provisório**) | 8 pedras + 1 `ruptura-rank-1` |

Dano provisório = `máximo(1, dano bruto − defesa)` limitado à vida atual. Ataques básicos não gastam essência; Lua e dash cobram o custo apenas ao executar. Regeneração não ultrapassa o máximo; ataques e dash recusam essência insuficiente. Inimigos se aproximam e atacam perto do personagem **em movimento cardinal**: cada passo usa um eixo por vez (o dominante, mantido até encostar no alvo, para o trajeto sair em L e não em escada), com deslize no outro eixo quando o preferido está bloqueado; a diagonal não existe, exatamente como na navegação do jogador. O toque num inimigo seleciona o alvo **e arma o ataque básico automático**: o golpe se repete na cadência da recarga do personagem (600 ms no Fang Yuan, 650 ms no Bai Ning Bing), esperando em silêncio enquanto o alvo estiver fora de alcance ou houver parede no meio, e desarma ao andar, trocar de alvo, morrer, trocar de personagem ou de área. O bloqueio de equipagem expira após 5 s sem inimigos detectando o personagem nem ação ofensiva. A Cigarra é **intrínseca, não ocupa slot**, começa a recarga **só no sucesso**, não consome essência extra e não duplica a resolução do mesmo golpe. Na falha de ressurreição, o jogador pode retornar ao centro sem penalidade monetária até que a regra de perda seja definida.

Os quatro slots funcionais são ataque, passivo, movimento e apoio: Moonlight vem inicialmente equipado; as demais opções são **inventário de teste** acessível exclusivamente pela aba **Inventário / Gu** do menu, não aquisição efetiva ou distribuição narrativa. A aba mostra o efeito/custo provisório do Gu selecionado e bloqueia a troca durante combate ou derrota; tentativas bloqueadas são recusadas pelo motor, não apenas pela interface. Stone Skin aplica defesa somente equipado; Liquor Worm altera regeneração somente equipado; dash só existe com Whirlwind Gu de teste e percorre corredor livre cardinal, seguido de bônus temporário real. Equipagem não é persistida. Inimigos e corte lunar usam **geometria provisória no motor**, não sprites inventados. Os atlas de terreno seguem exclusivos do cenário Mixel; o personagem genérico original do mesmo pack permanece apenas como fallback de NPC, enquanto Fang Yuan mantém seus frames próprios de caminhada. Não há sprites próprios de ataque; NPCs, mobs e bosses usam quadros estáticos direcionais enviados pelo usuário, separados da geometria de combate. A imagem do **Mar Primordial** veio do usuário e é usada apenas na interface.

A morte do inimigo gera recompensa **uma vez**, em uma transação única de pedras e materiais no `fang-yuan.cultivation.v1` existente; se o armazenamento falhar, fica pendente na sessão e a interface avisa, sem publicar metade da recompensa. A ficha atualiza os recursos recebidos, que continuam após recarregar a página. Taxa/itens de troca na vila, aquisição permanente dos demais Gu, persistência de vida/essência/recargas/equipamento, economia de morte e mecânica competitiva não estão implementados. No mobile, joystick cardinal à esquerda convive com o toque até o pixel desejado; o direcional e os botões de combate têm formato circular e fundo semitransparente, preservando área de toque. Botões de ataque básico, Lua e dash (visível apenas com Gu equipado), barras de vida e essência primordial de mesmo formato, estado do alvo, custo, recargas, feedback e status da Cigarra aparecem no HUD, **sem slots de equipagem sobre o mapa**. O painel compacto do mapa apresenta somente as duas barras e seus valores, além do alvo quando selecionado e da opção de alvo automático; não repete a ficha nem a defesa total. Os quatro slots equipáveis aparecem só na aba Inventário / Gu. A aba Avanço concentra o próximo estágio/Rank, requisitos, confirmação do gasto e o sprite do Mar Primordial com a quantidade exata da reserva.

### 11.7 Decisões pendentes

Continuam **A definir** para balanceamento definitivo: capacidade/inventário e aquisição de Gu; duração e critério final do bloqueio de troca; danos, velocidade, custo, regeneração, distância do dash por Rank e recargas; evasão, fórmulas de acerto, linha de visão detalhada e colisão para novos terrenos; AI e drops por espécie; recuperação após derrota e penalidade de pedras; persistência do combate, recursos ao reviver e validação em rede. A tabela anterior é apenas referência configurável do protótipo, não decisão canônica.

## 12. Competitivo online

O modo competitivo é separado da campanha e não transforma o jogo em MMORPG.

Requisitos previstos:
- identidade de jogador e formação de partida;
- validação de ações e resultados pelo servidor;
- proteção contra alterações de estado pelo cliente;
- regras iguais entre os participantes;
- registro de resultados;
- tratamento de desconexões;
- sistema de classificação, caso aprovado;
- separação entre conteúdo narrativo e regras de competição.

O formato de equipe, regras de elegibilidade, sincronização, progressão competitiva e recompensas ainda são decisões pendentes.

## 13. Interface e controles

A interface deverá ser legível em celular e não depender de hover ou precisão de mouse.

Áreas de interface a projetar:
- HUD de exploração;
- ficha de Fang Yuan;
- abertura e estado de cultivo;
- inventário e recursos;
- coleção e gestão de Gu;
- receitas e refinamento;
- mapa e objetivos;
- diálogos e missões;
- configurações e controles;
- interface de combate e resultados.

**Navegação do protótipo:** um minimapa esquemático e pequeno mostra só a área ativa, a posição de Fang Yuan, terrenos/obstáculos e saídas disponíveis, sem revelar outras áreas ou interferir no toque e combate. Fica abaixo dos botões de Menu/tela cheia e pode ser ocultado em paisagem de altura excepcionalmente baixa para proteger os controles. Não é um novo sistema de descoberta/fog of war.

O desenho final deverá ser validado em telas pequenas, com botões de tamanho adequado e informação prioritária bem hierarquizada.

## 14. Direção de arte e animação

- Pixel art 2D top-down.
- Fang Yuan com vestimenta escura e expressão impassível.
- Personagens e objetos com escala consistente.
- Spritesheets com ordem de direções e quadros documentada.
- Animações sem inversão de direção ou deslocamento incompatível com o movimento.
- Camadas de cenário para profundidade visual.
- Assets organizados por personagem, criatura, região, animação e interface.
- Preferência por assets com licenças compatíveis com modificação e uso no projeto; registrar licença, atribuição exigida e restrições.

O tamanho de referência de tiles de 32×32 px e sprite de personagem de 64×64 px é provisório até que a escala seja testada em jogo.

## 15. Arquitetura técnica

### Cliente
Responsável por renderização, entrada, câmera, interface, áudio e apresentação das animações.

### Motor de regras
Responsável por cultivo, recursos, inventário, Gu, receitas, efeitos, missões e combate. Deve ser independente da renderização sempre que possível.

### Dados
Conteúdo de Gu, itens, receitas, NPCs, regiões e missões deve ser definido em dados estruturados com validação de esquema.

### Servidor online
Responsável pela autenticação, criação e validação das partidas competitivas, persistência necessária e prevenção de trapaças.

### Qualidade
- testes unitários para fórmulas e efeitos;
- testes de integração para sistemas que interagem;
- validação automática dos dados;
- testes em Android e navegadores móveis;
- logs úteis sem expor segredos;
- desempenho monitorado em mapas e combates.

## 16. Plano de desenvolvimento

### Fase 1 — Base jogável
- revisar a estrutura atual do repositório;
- definir arquitetura e convenções;
- configurar Phaser e TypeScript conforme o estado real do projeto;
- implementar movimentação, câmera, colisões e interação;
- carregar uma região de teste.

### Fase 2 — Primeiro ciclo de jogo
- implementar ficha básica de Fang Yuan;
- modelar essência primordial e abertura;
- adicionar um conjunto pequeno e representativo de Gu;
- implementar inventário e coleta;
- demonstrar um encontro com começo, decisões e resultado.

### Fase 3 — Sistemas centrais
- cultivo e progressão;
- receitas e refinamento;
- missões, NPCs e facções;
- mais regiões e conteúdo;
- interface de inventário, Gu e cultivo.

### Fase 4 — Campanha
- estruturar o arco inicial;
- produzir mapas e encontros;
- integrar diálogos, objetivos e consequências;
- testar progressão e economia.

### Fase 5 — Competitivo
- definir regras competitivas;
- implementar servidor e partidas;
- validar ações e resultados;
- tratar desconexões, integridade e balanceamento.

As fases devem ser reordenadas conforme a auditoria do código existente. Não recriar componentes já funcionais sem necessidade.

## 17. Critérios de qualidade

Uma funcionalidade só será considerada concluída quando:
- cumprir a especificação;
- funcionar em dispositivo móvel;
- tratar entradas inválidas e estados extremos;
- ter testes proporcionais à sua importância;
- não duplicar regras em cliente e servidor;
- respeitar o conteúdo e as limitações de licenças;
- possuir documentação atualizada;
- integrar-se ao projeto sem quebrar funcionalidades existentes.

## 18. Decisões pendentes

Estas questões devem ser respondidas antes de fechar o design detalhado:

1. **Narrativa:** adaptação fiel da novel por arcos ou história alternativa mantendo Fang Yuan como protagonista?
2. **Combate — parcialmente definido:** tempo real no mapa top-down, com Gu ativos acionados pelo jogador e Gu passivos ativados automaticamente. Faltam definir ataque básico, movimento, alvo, alcance, recargas, recuperação de essência e fórmulas de dano.
3. **Balanceamento do cultivo:** o protótipo usa os valores provisórios da seção 5.4. Permanecem pendentes os materiais concretos, sua origem, taxas de obtenção e quaisquer benefícios de atributos.
4. **Gestão de Gu:** quantos Gu podem ser carregados, equipados ou ativados, e quais custos isso gera?
5. **Falha e risco:** qual é a chance-base de sucesso da ruptura, quais fatores a modificam e qual é a chance de perder materiais especiais em caso de falha?
6. **Competitivo:** duelo individual, equipes, formato assíncrono ou partidas em tempo real?
7. **Escopo inicial:** qual arco e quais regiões serão incluídos na primeira versão jogável?

## 19. Regras para agentes de IA

- Ler este GDD e as instruções existentes do repositório antes de implementar.
- Não misturar o projeto com outros RPGs ou MMORPGs.
- Não substituir conceitos canônicos por sistemas genéricos sem aprovação.
- Distinguir fatos definidos, propostas e decisões pendentes.
- Não inventar regras de cultivo, Gu ou história como se fossem canônicas. A progressão aprovada é por Rank/estágio sem XP ou níveis; avanços manuais gastam pedras espirituais, e a ruptura entre Ranks exige também materiais. O combate é em tempo real no mapa top-down, com Gu ativos acionados pelo jogador e Gu passivos ativados automaticamente conforme suas condições.
- Antes de alterar arquitetura, inspecionar o código atual e preservar o que funciona.
- Implementar mudanças pequenas, verificáveis e documentadas.
- Nunca modificar ou substituir instruções de agentes existentes sem autorização explícita.
- Quando uma lacuna impedir a implementação correta, documentar a questão e apresentar alternativas com consequências técnicas e de design.


## 20. Atualização de decisões — versão 0.3

Esta revisão consolida a direção atual do projeto:

- **Cultivo sem XP/nível:** avançar manualmente por pedras espirituais entre os quatro estágios de cada um dos 9 Ranks. O balanceamento da seção 5.4 é provisório do jogo, não regra canônica da obra.
- **Ranks de cultivo:** Inicial, Médio, Superior e Pico por Rank; Rank 9 Pico é o limite máximo.
- **Ruptura especial:** nos limites entre Ranks, o jogador inicia uma tentativa manual com custo em pedras espirituais e materiais; tentativas são independentes, falhas consomem as pedras investidas e podem perder materiais. Não aplicar punições adicionais não aprovadas.
- **Quatro funções de Gu equipados:** ataque ativo, passivo, movimento e apoio. A troca é permitida apenas fora de combate.
- **Combate em tempo real:** acontece no mapa top-down; Gu ativos são acionados manualmente e Gu passivos funcionam conforme suas condições. O motor de regras é a autoridade para custos, acertos, dano e efeitos.
- **Gu iniciais planejados:** Moonlight Gu é recebido na vila e dispara um corte em meia-lua com hitbox real; Liquor Worm é encontrado ao final de uma caverna com inimigos e concede regeneração passiva de essência como adaptação do jogo; Stone Skin Gu aumenta defesa enquanto equipado. Whirlwind Gu é nome provisório para o Gu de movimento ilustrado como “redemoinho”.
- **Gu selvagens e comércio:** Gu podem ser vendidos por preços altos na vila e também encontrados na natureza. Alguns Gu selvagens podem fugir, exigindo uma abordagem de captura estratégica; detalhes de captura ainda serão especificados.
- **Banca do Jiang Ya (implementado, primeira versão):** compra material de ruptura por Rank e vende seis Gu Rank 1; não vende Gu selvagem, não compra Gu e não tem estoque rotativo. Preços e tabela estão em [`BALANCEAMENTO.md`](../BALANCEAMENTO.md).
- **Gu selvagens v0.3 (implementado, primeira versão):** criaturas raras nascem com um Gu compatível com o Rank (2% / 4% / 6% por tier, 15% para chefes), sorteado uma única vez no nascimento e nunca re-sorteado. A criatura usa o efeito já existente do Gu (projétil, cura, buff, investida ou passivo) com recarga e sinais visuais; a morte entrega exatamente aquele Gu, separado de pedras e material, com entrega idempotente. Captura, fuga e comércio de Gu selvagem continuam fora desta versão. Valores são parâmetros de balanceamento, não cânone.
- **Pedras espirituais:** podem vir de drops e da troca de itens obtidos de inimigos na vila. Ao morrer sem ativação da Cigarra, Fang Yuan perde parte das pedras que carrega; percentual e recuperação continuam pendentes.
- **Fidelidade e adaptação:** separar efeitos canônicos confirmados das mecânicas criadas para o RPG. Não inventar informações como se fossem cânone.
