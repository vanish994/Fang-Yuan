# Reverend Insanity RPG — Game Design Document

**Projeto:** Fang-Yuan  
**Documento:** GDD principal  
**Versão:** 0.1 — fundação de design  
**Idioma:** Português  
**Estado:** Base inicial; decisões marcadas como provisórias não devem ser tratadas como regras definitivas.

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

**Pedras primordiais substituem XP como recurso principal de progressão do cultivo.** O personagem não precisa acumular uma barra tradicional de experiência para subir de nível. Em vez disso, utiliza pedras primordiais para avançar no cultivo.

O fluxo principal é:

**Combate / missões / exploração / comércio → pedras primordiais e materiais → avanço de cultivo → melhorias moderadas de atributos e acesso a Gu.**

A proposta mantém o cultivo fácil de entender e implementar, sem transformar cada detalhe da novel em uma simulação complexa. As pedras primordiais também são um recurso econômico do mundo; portanto, gastá-las no cultivo cria uma escolha entre fortalecer o personagem e guardá-las para comprar itens, Gu ou outros serviços.

### 5.2 Ranks e estágios — Definido

O jogo terá **9 Ranks de Mestre Gu**, cada um dividido em quatro estágios:

1. Inicial
2. Médio
3. Superior
4. Pico

Isso produz **36 etapas de progressão** (9 Ranks × 4 estágios).

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

O jogador gasta pedras primordiais para progredir entre os estágios dentro do Rank atual. **Ao alcançar o Pico, a passagem para o Rank seguinte exige pedras primordiais e materiais específicos de avanço.** Após cumprir os requisitos, o personagem entra no estágio Inicial do próximo Rank.

Os materiais exigidos devem fazer sentido para o Rank e para a ambientação, podendo vir de criaturas, coleta, exploração, missões, comércio ou outros sistemas documentados. A lista e as quantidades serão definidas por Rank. Não exigir esses materiais em cada avanço comum de estágio.

### 5.3 Requisitos de avanço e balanceamento

- Avanços comuns (Inicial → Médio → Superior → Pico): exigem pedras primordiais; não exigem materiais especiais de ruptura na regra-base.
- Ruptura de Rank (Pico → Inicial do próximo Rank): exige pedras primordiais e um conjunto de materiais específicos.
- O Rank 9 é o último Rank definido; progressão além dele não deve ser presumida.
- Os custos de pedras, materiais por Rank, requisitos adicionais e ritmo de progressão ficam **A definir** e devem ser configuráveis em dados.
- Os custos devem crescer de forma controlada, sem tornar os primeiros avanços lentos nem permitir que o jogador acumule recursos e salte toda a progressão.
- Recompensas devem considerar risco, dificuldade e esforço; não criar uma fonte repetível e ilimitada que torne o cultivo trivial.
- A economia precisa equilibrar o gasto de pedras no cultivo com seu uso como moeda de troca.
- **A ruptura é uma ação manual:** cumprir os requisitos não avança o personagem automaticamente; o jogador escolhe quando iniciar a tentativa.
- **A tentativa de ruptura tem chance de falha.** A chance depende de fatores permanentes do personagem e da preparação usada para a tentativa, com fatores exatos e fórmula ainda **A definir**. **Cada tentativa é independente das anteriores:** falhas passadas não aumentam nem reduzem a chance de sucesso da próxima tentativa. Não presumir valores nem implementar uma fórmula arbitrária.
- **Falha na ruptura:** as pedras primordiais investidas na tentativa são perdidas. Além disso, existe uma chance de perder os materiais especiais usados na ruptura. A probabilidade de perda dos materiais e se ela varia por Rank permanecem **A definir**.
- Não adicionar outras penalidades à falha sem uma decisão de design explícita.
- Em caso de sucesso, o personagem avança para o estágio Inicial do Rank seguinte.

### 5.4 Level e atributos

XP deixa de ser a trilha de progressão principal. A representação principal do progresso será o **Rank + estágio de cultivo**. Se o jogo precisar de um atributo técnico chamado `level`, ele deverá derivar do estágio de cultivo ou cumprir uma função secundária claramente documentada; não deve coexistir como uma segunda progressão que duplique o cultivo.

Atributos básicos recebem crescimento moderado conforme o avanço de cultivo. O poder principal deve vir da escolha, aquisição e combinação de Gu, além de recursos, preparação e decisões táticas. Dois personagens em estágios semelhantes podem ter estilos e resultados de combate muito diferentes por causa de suas builds.

Os atributos exatos, seus valores e os benefícios de cada estágio são **A definir**.

### 5.5 Aptidão, abertura e essência primeva

A aptidão e a abertura continuam relevantes para a identidade do universo e podem afetar capacidade, eficiência ou opções de cultivo, mas suas regras detalhadas precisam ser especificadas antes da implementação. Elas não devem recriar uma barra de XP paralela.

A essência primeva é um recurso de combate e uso de Gu, separado das pedras primordiais usadas para pagar a progressão. O motor deve distinguir claramente:
- **Pedras primordiais:** recurso econômico consumido para cultivar e realizar transações.
- **Essência primeva:** energia disponível ao personagem para ativar Gu e outras ações compatíveis.

Custos, capacidade, recuperação e relação com Rank/estágio ficam **A definir**. Não tratar pedras primordiais e essência primeva como o mesmo recurso.

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

Possíveis métodos, a confirmar por arco e por Gu:
- recompensa narrativa;
- compra ou troca;
- exploração e descoberta;
- refinamento;
- obtenção por encontro ou missão;
- recompensa de sistemas específicos.

Evitar que todos os Gu sejam simplesmente capturados após uma luta; os métodos devem respeitar a natureza de cada Gu no universo.


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
- **Gatilho:** quando Fang Yuan morre em combate e a passiva não está em recarga, há uma pequena chance de ativação.
- **Sucesso:** Fang Yuan retorna à vida com **50% da vida máxima**. A passiva entra imediatamente em uma recarga muito longa e não pode tentar ativar novamente enquanto estiver em recarga.
- **Falha:** a morte é resolvida normalmente, sem ressurreição. Como a recarga foi definida para começar após uma ativação bem-sucedida, uma tentativa falha não inicia a recarga.
- A passiva não garante sobrevivência e não substitui os sistemas normais de morte e derrota.
- **A definir:** chance de ativação, duração exata da recarga, estado dos demais recursos ao reviver, regras de segurança contra ativações repetidas e efeitos visuais/sonoros.
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
- Exibe separadamente o custo em pedras primordiais e, para rupturas de Rank, os materiais específicos exigidos.
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
- Não inventar regras de cultivo, Gu ou história como se fossem canônicas. A progressão definida usa pedras primordiais para avanços comuns e materiais específicos apenas nas rupturas de Rank, do Pico para o Inicial do Rank seguinte. O combate é em tempo real no mapa top-down, com Gu ativos acionados pelo jogador e Gu passivos ativados automaticamente conforme suas condições.
- Antes de alterar arquitetura, inspecionar o código atual e preservar o que funciona.
- Implementar mudanças pequenas, verificáveis e documentadas.
- Nunca modificar ou substituir instruções de agentes existentes sem autorização explícita.
- Quando uma lacuna impedir a implementação correta, documentar a questão e apresentar alternativas com consequências técnicas e de design.
