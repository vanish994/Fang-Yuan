# Reverend Insanity RPG — Game Design Document

**Projeto:** Fang-Yuan  
**Documento:** GDD principal  
**Versão:** 0.2 — progressão por XP/nível e decisões consolidadas  
**Idioma:** Português  
**Estado:** Revisão consolidada. Decisões explícitas são requisitos; pontos marcados como A definir continuam pendentes.

> Este documento é exclusivo do RPG de *Reverend Insanity*. Não importar sistemas, elementos ou criaturas de outros projetos do desenvolvedor.

## 1. Visão do jogo

Um RPG 2D de exploração e estratégia ambientado no universo de *Reverend Insanity*, com **Fang Yuan como protagonista**. O jogador acompanha sua trajetória de cultivador, explora regiões interconectadas, encontra personagens e facções, obtém e utiliza Gu, coleta recursos, aprende receitas, refina Gu e toma decisões para avançar em um mundo hostil.

O jogo não será um MMORPG. A experiência principal será uma campanha de RPG; o competitivo online será um modo separado, com regras validadas pelo servidor.

### 1.1 Pilares de design

1. **Fidelidade ao universo:** usar os conceitos próprios da obra — Gu, mestres Gu, abertura, essência primeva, pedras primevas, receitas, refinamento, caminhos e reinos de cultivo.
2. **Preparação e estratégia:** vencer depende de combinação de Gu, recursos, informação e decisões, não apenas de atributos altos.
3. **Liberdade com consequências:** recursos são limitados; escolhas de preparação e gasto devem importar.
4. **Exploração recompensadora:** mapas, áreas secretas, materiais, encontros e personagens incentivam a descoberta.
5. **Progressão legível:** o jogador entende os requisitos, custos, riscos e benefícios de cada avanço.
6. **Regras determinísticas:** o motor do jogo resolve combate, custos, efeitos e progressão; narrativa não pode alterar resultados por conveniência.
7. **Compatibilidade mobile:** controles e interface devem funcionar em telas pequenas, priorizando navegador e uso no celular.

## 2. Identidade e escopo

- **Gênero:** RPG de ação/exploração com sistemas estratégicos de cultivo e Gu. A forma exata do combate permanece como decisão de design a validar no protótipo.
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
- Essência primeva e pedras primevas.
- Refinamento e receitas.
- Rank e estágio de cultivo.
- Caminhos e especializações existentes no universo da obra.
- Materiais, plantas, bestas e recursos usados em receitas.
- Clãs, seitas, organizações e outras facções pertinentes ao arco adaptado.

Não introduzir novos elementos ou regras universais sem documentá-los como conteúdo original do jogo.

## 5. Sistema de cultivo e progressão

### 5.1 Princípio central — Definido

A progressão principal de Fang Yuan é simples e baseada em **XP e níveis**. O personagem ganha XP por combate, missões, exploração e outras atividades configuradas; ao atingir os requisitos de XP, sobe de nível. O sistema deve ser fácil de compreender e de implementar, sem simular cada detalhe do cultivo da novel.

Os níveis representam a progressão de cultivo. **Rank e estágio de cultivo são uma camada de leitura narrativa do nível**, não uma segunda barra de experiência independente. O jogo não deve exigir que o jogador gaste pedras primevas para cada subida normal de nível.

Fluxo principal:

**Combate / missões / exploração → XP → nível → Rank/estágio correspondente → acesso gradual a conteúdo, Gu e desafios.**

Pedras primevas continuam importantes como moeda, recurso de comércio e recurso para custos especiais definidos neste GDD. Não devem ser confundidas com XP nem com essência primeva.

### 5.2 Ranks e estágios — Definido

O jogo terá **9 Ranks de Mestre Gu**, cada um dividido em quatro estágios:

1. Inicial
2. Médio
3. Superior
4. Pico

Isso produz 36 faixas de progressão (9 Ranks × 4 estágios). Os intervalos de níveis que correspondem a cada Rank/estágio devem ser configuráveis em dados. A tabela numérica exata de níveis e XP necessários ainda é **A definir**.

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

A interface deve mostrar simultaneamente o nível numérico e sua representação como Rank/estágio. A passagem normal entre níveis é automática ao atingir o XP exigido. O Rank 9 é o limite definido; progressão além dele não deve ser presumida.

### 5.3 Ruptura entre Ranks — Definido com parâmetros pendentes

A transição do estágio Pico de um Rank para o estágio Inicial do Rank seguinte é uma **ruptura especial**, distinta de uma subida normal de nível. Ela mantém o risco e a preparação característicos do universo sem tornar toda a progressão desnecessariamente complexa.

- A ruptura é iniciada manualmente pelo jogador quando os requisitos de nível e conteúdo forem cumpridos.
- A tentativa exige pedras primevas e materiais específicos de avanço, conforme dados configuráveis por Rank.
- A tentativa tem chance de sucesso baseada em fatores permanentes do personagem e na preparação utilizada. A fórmula e os valores exatos permanecem **A definir**.
- Cada tentativa é independente das anteriores: falhas passadas não aumentam nem reduzem a chance da próxima.
- Em caso de falha, as pedras primevas investidas são perdidas e existe uma chance de perder os materiais especiais utilizados. A probabilidade exata permanece **A definir**.
- Não adicionar outras penalidades à falha sem decisão explícita.
- Em caso de sucesso, o personagem passa ao estágio Inicial do Rank seguinte.
- Os parâmetros de ruptura devem ser dados/configuração, não fórmulas espalhadas pelo código.

A ruptura não deve criar uma segunda barra de XP nem exigir o gasto de pedras primevas em cada nível comum. XP e nível continuam sendo a progressão principal; a ruptura é uma barreira especial nos limites entre Ranks.

### 5.4 XP, níveis e atributos

- XP é obtida por fontes configuráveis, com recompensas proporcionais à dificuldade, ao risco e ao esforço.
- Os requisitos de XP aumentam conforme o nível, evitando progressão trivial por repetição de inimigos fracos.
- A progressão deve ser testável e balanceável por dados; não codificar tabelas extensas de XP diretamente nas cenas.
- Os níveis concedem melhorias moderadas de atributos e liberam a faixa correspondente de Rank/estágio.
- Gu, preparação, recursos e decisões táticas devem ter grande influência no estilo de jogo e no resultado dos combates; nível alto não deve substituir estratégia.
- Atributos exatos, valores por nível, curva de XP e recompensas por atividade ficam **A definir**.
- Evitar duas progressões independentes que dupliquem os mesmos benefícios: nível é a mecânica numérica; Rank/estágio é sua representação de cultivo, com ruptura especial entre Ranks.

### 5.5 Aptidão, abertura e essência primeva

A aptidão e a abertura continuam relevantes para a identidade do universo e podem afetar eficiência, capacidade ou opções de cultivo, mas suas regras detalhadas precisam ser especificadas antes da implementação. Não devem recriar uma barra de XP paralela nem substituir o nível como progressão principal.

A essência primeva é o recurso usado para ativar Gu e outras ações compatíveis. Ela é separada de:
- **XP:** mede o progresso até o próximo nível.
- **Nível / Rank / estágio:** representa a progressão do personagem.
- **Pedras primevas:** moeda e recurso econômico, usado em transações e nos custos especiais de ruptura.
- **Essência primeva:** energia disponível para ativar Gu.

Custos, capacidade, recuperação e relação com Rank/estágio ficam **A definir**. O motor deve validar custos e impedir essência negativa.
 
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
- custo de essência primeva;
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
- **Adaptação de gameplay específica do projeto:** equipado no slot de apoio, concede recuperação passiva de essência primeva.
- Esta função de regeneração é uma adaptação para o RPG; não deve ser apresentada como descrição literal de sua habilidade canônica. A relação exata com a função da obra deverá ser documentada nas notas de fidelidade.
- Valor da recuperação, limites, condições e eventuais custos ficam **A definir**.

#### Jade Skin Gu — Gu passivo

- O **Jade Skin Gu (Gu da Pele de Jade)** é planejado para o slot passivo.
- **Adaptação de gameplay específica do projeto:** aumenta a defesa enquanto estiver equipado, de acordo com valores de balanceamento configuráveis.
- O método e o momento de obtenção ainda ficam **A definir**.
- O aumento defensivo, sua magnitude e eventuais condições precisam ser definidos antes da implementação. Não presumir que o efeito passivo do jogo reproduza literalmente todas as regras da obra.

Essas decisões descrevem a adaptação do jogo. Ao documentar Gu adicionais, separar sempre efeito canônico confirmado de mecânica criada para o RPG.


### 6.6 Passiva especial — Cigarra da Primavera e Outono

- Fang Yuan possui uma passiva especial chamada **Cigarra da Primavera e Outono**. Ela é uma mecânica própria desta adaptação de RPG inspirada na obra; não deve ser tratada como um Gu comum equipado em um dos quatro slots.
- **Gatilho:** quando Fang Yuan morre em combate e a passiva não está em recarga, há **5% de chance** de ativação.
- **Sucesso:** Fang Yuan retorna à vida com **50% da vida máxima**. A passiva entra imediatamente em uma recarga muito longa e não pode tentar ativar novamente enquanto estiver em recarga.
- **Falha:** a morte é resolvida normalmente, sem ressurreição. Como a recarga foi definida para começar após uma ativação bem-sucedida, uma tentativa falha não inicia a recarga.
- A passiva não garante sobrevivência e não substitui os sistemas normais de morte e derrota.
- **A definir:** duração exata da recarga, estado dos demais recursos ao reviver, regras de segurança contra ativações repetidas e efeitos visuais/sonoros.
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

### 8.1 Pedras primevas: obtenção e perda na morte

- **Terminologia:** o GDD usa o termo **pedras primevas** para o recurso equivalente às pedras primordiais da obra. Elas funcionam tanto como recurso de cultivo quanto como moeda de troca; não devem ser confundidas com essência primeva.
- **Drops de inimigos:** inimigos podem deixar pedras primevas como saque, além de outros drops definidos por espécie e dificuldade.
- **Troca na vila:** o jogador pode entregar drops obtidos de inimigos a um NPC/comerciante da vila e receber pedras primevas em troca. Os itens aceitos e as taxas de troca serão definidos pelo balanceamento.
- **Penalidade por morte:** quando Fang Yuan morre em combate e a Cigarra da Primavera e Outono não o ressuscita, ele perde uma parte das pedras primevas que carrega. A quantidade ou percentual perdido, o destino das pedras perdidas e as regras para recuperá-las permanecem **A definir**.
- A penalidade deve ser clara para o jogador e não pode retirar mais pedras do que ele possui. A ressurreição bem-sucedida pela Cigarra precisa ser tratada como um resultado diferente da morte normal; se ela evita totalmente a penalidade, isso será confirmado no balanceamento.

Categorias iniciais:
- pedras primevas;
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

## 10. NPCs, facções e missões

NPCs devem possuir identidade, objetivos e relações. Facções podem controlar recursos, informação, rotas e oportunidades, de acordo com a história adaptada.

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

O menu principal do personagem terá abas separadas para organizar a preparação e a progressão, com navegação adequada a telas pequenas.

### 10.1 Aba de Gu / Equipamento

- Exibe os quatro slots funcionais de Gu equipados: **Gu de ataque ativo**, **Gu passivo**, **Gu de movimento** e **Gu de apoio**.
- Mostra os Gu disponíveis no inventário e permite equipar ou trocar Gu **somente fora de combate**.
- Apresenta efeitos, custos, requisitos, compatibilidade com o slot e outras condições relevantes de cada Gu antes de equipá-lo.
- A interface deve destacar quando um slot está vazio ou quando um Gu não pode ser equipado, explicando o motivo.

### 10.2 Aba de Cultivo / Avanço de Rank

- Mostra o Rank e o estágio de cultivo atuais, o próximo avanço disponível e os requisitos necessários.
- Exibe o XP necessário para o próximo nível e, para rupturas de Rank, os custos em pedras primevas e materiais específicos exigidos.
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
  4. **Gu de apoio:** Gu voltado a suporte, como o Verme do Licor, que pode acelerar a recuperação de essência primeva, ou um Gu de cura, conforme suas regras.
- Os quatro espaços são **slots de equipamento por função**, não quatro atalhos livremente intercambiáveis durante o combate. **Gu equipados só podem ser trocados fora de combate**; durante uma luta, a configuração fica bloqueada. O jogo deve comunicar claramente quando o personagem ainda está em combate e não pode trocar seus Gu.
- Cada Gu equipado deve respeitar suas próprias condições, custos, recargas e compatibilidade com o slot correspondente.
- **Mira híbrida:** o jogador pode tocar em um inimigo para selecioná-lo manualmente ou acionar uma opção para selecionar automaticamente o inimigo mais próximo. A seleção automática não deve substituir a seleção manual sem uma ação explícita do jogador.
- A seleção de alvo não ignora regras de alcance, linha de visão, obstáculos ou condições de ativação de ataques e Gu.

### 11.3 Tipos de ataque — Definido

- **Ataque básico:** ação de combate disponível sem depender da ativação de um Gu. Seu dano, alcance, velocidade e possíveis custos ficam **A definir**.
- **Gu ativos:** habilidades acionadas manualmente pelo jogador, conforme as regras e limitações de cada Gu.
- **Ataques especiais combinados:** técnicas que exigem uma combinação específica de Gu. Cada combinação deve declarar seus requisitos, efeito, custo total de essência primeva, alcance, condições, recarga e possíveis riscos. Não presumir que qualquer par de Gu possa ser combinado.
- As combinações devem acrescentar decisões táticas, sem tornar obsoletos os Gu individuais ou o ataque básico.

### 11.4 Controles de combate para celular — Definido

- **Joystick virtual à esquerda:** controla o movimento de Fang Yuan durante a exploração e o combate em tempo real.
- **Botão de ataque básico:** executa o ataque básico sem exigir a ativação de um Gu.
- **Botão de Gu de ataque:** permite ativar o Gu de ataque selecionado, respeitando seus custos, alcance, recarga e condições. Os 4 espaços de acesso rápido continuam sendo atalhos para os Gu.
- **Botão de dash:** só aparece quando Fang Yuan possui um Gu de movimento que conceda essa ação. Sem um Gu de movimento compatível, o botão fica oculto e o dash não pode ser usado.
- **Efeito do dash:** ao ativá-lo, Fang Yuan realiza uma arrancada rápida na direção do movimento. Ao terminar a arrancada, recebe também um bônus temporário e curto de velocidade de movimento, para facilitar a fuga, perseguição ou reposicionamento. O bônus é parte do efeito do Gu de movimento, não um efeito visual.
- **Balanceamento do dash:** distância da arrancada, intensidade e duração do bônus de velocidade, custo de essência primeva e recarga permanecem **A definir**. O bônus não deve se acumular indefinidamente com ativações sucessivas; a regra de reaplicação/empilhamento será definida no balanceamento.
- Os controles devem funcionar em tela sensível ao toque e não podem cobrir desnecessariamente o alvo selecionado ou informações essenciais de combate.

### 11.4 Regras gerais

- O motor de regras é a autoridade sobre custos, acertos, dano, efeitos, recargas e resultados.
- O custo de essência primeva é validado antes da execução; não permitir essência negativa.
- Cada efeito especifica alvo, duração, prioridade, empilhamento, remoção e interação com outros efeitos.
- Movimento, colisão, alcance, linha de visão, interrupções e condições de acerto devem ser explícitos e testáveis.
- Animações e efeitos visuais não podem alterar resultados mecânicos.
- O servidor validará ações e resultados nas partidas competitivas.
- Não introduzir turnos ou ativação automática de Gu ativos sem decisão explícita.

### 11.6 Decisões pendentes

Continuam **A definir**: quantidade total de Gu que podem ser carregados ou equipados; condições exatas para o jogo considerar o combate encerrado e liberar a troca de Gu; valores do ataque básico; fórmula exata de distância do dash por Rank, custo e recarga dos Gu de movimento; evasão; recuperação de essência primeva; recargas; fórmulas de acerto e dano; alcance e linha de visão; fuga e derrota.

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
- modelar essência primeva e abertura;
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
3. **Balanceamento do cultivo:** quais serão os custos de pedras primordiais por estágio, os materiais de ruptura por Rank e os benefícios de atributos?
4. **Gestão de Gu:** quantos Gu podem ser carregados, equipados ou ativados, e quais custos isso gera?
5. **Falha e risco:** qual é a chance-base de sucesso da ruptura, quais fatores a modificam e qual é a chance de perder materiais especiais em caso de falha?
6. **Competitivo:** duelo individual, equipes, formato assíncrono ou partidas em tempo real?
7. **Escopo inicial:** qual arco e quais regiões serão incluídos na primeira versão jogável?

## 19. Regras para agentes de IA

- Ler este GDD e as instruções existentes do repositório antes de implementar.
- Não misturar o projeto com outros RPGs ou MMORPGs.
- Não substituir conceitos canônicos por sistemas genéricos sem aprovação.
- Distinguir fatos definidos, propostas e decisões pendentes.
- Não inventar regras de cultivo, Gu ou história como se fossem canônicas. A progressão principal é por XP e níveis; Rank/estágio mapeiam faixas de nível, e a ruptura manual entre Ranks exige pedras primevas e materiais específicos. O combate é em tempo real no mapa top-down, com Gu ativos acionados pelo jogador e Gu passivos ativados automaticamente conforme suas condições.
- Antes de alterar arquitetura, inspecionar o código atual e preservar o que funciona.
- Implementar mudanças pequenas, verificáveis e documentadas.
- Nunca modificar ou substituir instruções de agentes existentes sem autorização explícita.
- Quando uma lacuna impedir a implementação correta, documentar a questão e apresentar alternativas com consequências técnicas e de design.


## 20. Atualização de decisões — versão 0.2

Esta revisão consolida a direção atual do projeto:

- **Cultivo por XP e níveis:** ganhar XP e subir de nível é a progressão principal e deve permanecer simples.
- **Ranks de cultivo:** os 9 Ranks, cada um com Inicial, Médio, Superior e Pico, mapeiam a progressão numérica. A curva de XP e os intervalos de níveis ainda serão balanceados.
- **Ruptura especial:** nos limites entre Ranks, o jogador inicia uma tentativa manual com custo em pedras primevas e materiais; tentativas são independentes, falhas consomem as pedras investidas e podem perder materiais. Não aplicar punições adicionais não aprovadas.
- **Quatro funções de Gu equipados:** ataque ativo, passivo, movimento e apoio. A troca é permitida apenas fora de combate.
- **Combate em tempo real:** acontece no mapa top-down; Gu ativos são acionados manualmente e Gu passivos funcionam conforme suas condições. O motor de regras é a autoridade para custos, acertos, dano e efeitos.
- **Gu iniciais planejados:** Moonlight Gu é recebido na vila e dispara um corte em meia-lua com hitbox real; Liquor Worm é encontrado ao final de uma caverna com inimigos e concede regeneração passiva de essência como adaptação do jogo; Jade Skin Gu aumenta defesa enquanto equipado.
- **Gu selvagens e comércio:** Gu podem ser vendidos por preços altos na vila e também encontrados na natureza. Alguns Gu selvagens podem fugir, exigindo uma abordagem de captura estratégica; detalhes de captura ainda serão especificados.
- **Pedras primevas:** podem vir de drops e da troca de itens obtidos de inimigos na vila. Ao morrer sem ativação da Cigarra, Fang Yuan perde parte das pedras que carrega; percentual e recuperação continuam pendentes.
- **Fidelidade e adaptação:** separar efeitos canônicos confirmados das mecânicas criadas para o RPG. Não inventar informações como se fossem cânone.
