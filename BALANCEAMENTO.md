# Balanceamento de Fang Yuan

**Estado: v0.2 em implementação.** O balanceamento é responsabilidade do projeto e deve ser aplicado no código, não apenas documentado. O GDD continua sendo a fonte das regras de design; estes números são valores de gameplay e podem ser recalibrados após playtest.

Não há XP nem níveis. O cultivo usa exatamente **9 Ranks × 4 estágios**: Inicial, Médio, Superior e Pico. O Rank 9 Pico é o limite. Os custos de cultivo ativos permanecem os definidos na implementação atual; esta versão adiciona a curva de poder e a primeira calibração de combate.

## Curva de poder — 36 estágios

`power` é relativo a Rank 1 Inicial = 1,00. Não é XP nem um atributo visível ao jogador. Serve como orçamento para converter Rank/estágio em atributos quando a ficha de combate aplicar o cultivo.

| Rank | Inicial | Médio | Superior | Pico |
|---|---:|---:|---:|---:|
| 1 | 1,00 | 1,08 | 1,16 | 1,25 |
| 2 | 1,38 | 1,48 | 1,59 | 1,72 |
| 3 | 1,90 | 2,04 | 2,19 | 2,35 |
| 4 | 2,60 | 2,78 | 2,97 | 3,18 |
| 5 | 3,50 | 3,75 | 4,02 | 4,30 |
| 6 | 4,75 | 5,10 | 5,45 | 5,85 |
| 7 | 6,45 | 6,90 | 7,35 | 7,85 |
| 8 | 8,70 | 9,30 | 9,90 | 10,55 |
| 9 | 11,70 | 12,50 | 13,30 | 14,20 |

A implementação está em `src/entities/cultivationPower.ts` e possui teste cobrindo os 36 estados.

## Combate v0.2

Objetivo: **difícil, mas justo**. O jogador deve morrer por decisão, posicionamento ou falta de preparação — não por números impossíveis.

- Fang Yuan R1 Inicial: 100 HP, 2 DEF, ataque básico 14, Gu da Lua 26.
- Ataque básico: 600 ms de recarga, alcance 62 px.
- Gu da Lua: 26 de dano, 16 de essência, 1.800 ms de recarga.
- Fauna Tier 1 continua sendo a porta de entrada; animais comuns devem cair em poucos golpes.
- Tier 2 exige preparação e posicionamento.
- Tier 3 já deve exigir domínio do combate, Gu e/ou vantagem de terreno.
- Chefes não podem ter defesa maior que o dano do ataque básico de R1 sem uma mecânica explícita que explique isso. A primeira calibração reduz HP/DEF dos chefes para evitar o estado anterior em que o dano básico ficava efetivamente em 1.
- Habilidades de chefe ainda são marcadas como planejadas no catálogo; portanto, os valores atuais não fingem que essas mecânicas já existem.

### TTK de referência

Considerando o dano atual como `max(1, ataque - defesa)`, a referência de balanceamento é:

- Tier 1: aproximadamente 3–10 ataques básicos.
- Tier 2: aproximadamente 10–25 ataques básicos.
- Tier 3: aproximadamente 30–50 ataques básicos.
- Chefes: dezenas de ataques básicos, mas com Gu, posicionamento e futuras fases/mecânicas reduzindo o tempo real de combate. Nenhum chefe deve virar uma luta de vários minutos baseada somente em HP.

## Cultivo e economia

Os custos atuais continuam:

| Rank | Inicial→Médio | Médio→Superior | Superior→Pico | Ruptura |
|---|---:|---:|---:|---:|
| 1 | 20 | 35 | 55 | 90 |
| 2 | 45 | 75 | 115 | 180 |
| 3 | 90 | 150 | 230 | 360 |
| 4 | 180 | 300 | 460 | 720 |
| 5 | 360 | 600 | 920 | 1.440 |
| 6 | 720 | 1.200 | 1.840 | 2.880 |
| 7 | 1.440 | 2.400 | 3.680 | 5.760 |
| 8 | 2.880 | 4.800 | 7.360 | 11.520 |
| 9 | 5.760 | 9.600 | 14.720 | — |

As chances e materiais de ruptura permanecem como estão no motor até um playtest específico de economia. A próxima etapa do balanceamento é substituir os IDs técnicos `ruptura-rank-N` por materiais obtidos de criaturas/áreas e medir renda por hora, custo por avanço e risco de morte.

**Moeda única:** pedras espirituais. Não existe segunda moeda, XP nem ouro. As fontes previstas são o **drop direto de inimigos** — cada criatura entrega as pedras e o material de ruptura declarados no próprio catálogo (`rewardStones`, `rewardMaterialId`, `rewardMaterialQuantity`), do Rank 1 ao chefe — e, no futuro, a **troca dos itens dropados pelos inimigos por pedras** num NPC/loja. Inimigos criados sem catálogo (testes) usam o valor de `combatConfig`. A curva é suave em risco normalizado (0,14–0,29 pedras por PV): nenhuma criatura domina o farm por segundo, e os chefes pagam 2–4 materiais de Rank superior. Ainda não há **taxas de drop, itens aceitos nem valores de troca definidos**; nenhuma loja está ligada ao jogo, e os preços de referência dos Gu (`price` em `guCatalog.ts`) servem apenas de âncora de balanceamento.

Os Gu também são economia: receitas de refino consomem Gu possuídos de forma determinística (sem sorteio). Os materiais de refino usam a mesma moeda de essência do motor de combate (`essenceCost`), separada das pedras espirituais gastas na ficha de cultivo.

## Gu e combate v0.2 — catálogo implementado

Dados centralizados: `src/combat/types.ts` (modelo), `src/combat/guCatalog.ts` (catálogo),
`src/combat/guRecipes.ts` (refino), `src/combat/guState.ts` (inventário/save) e
`src/combat/combatEngine.ts` (efeitos). Nenhum número de Gu vive na UI: a ficha lê o motor.

**Categorias funcionais são independentes de Rank:** equipável, ativável, assimilável,
material de refino e consumível. Um material pode ser também equipável (Jade Skin, Little Light).

### Catálogo Rank 1

24 Gu com Rank 1 confirmado; nenhum nome inventado para completar cota e nenhuma inclusão de
Blood Moon (Rank 3), Moonglow/White Jade (Rank 2) ou Moon Raiment (Rank 2) no Rank 1. Cada
entrada registra `source.reference`, `fidelity` (`canonical`, `canonical-adapted`, `fan-made`)
e `price` entre 500 e 1.000 pedras.

| Slot | Rank 1 equipáveis | Situação |
|---|---:|---|
| Ataque | 6 | Moonlight, Bone Spear, Star Arrow, Star Dart, Ghost Fire, Exploding Egg |
| Passivo | 6 | Stone, Jade, Bronze, Iron, Rock e Beast Skin |
| Apoio | 5 | Liquor Worm, Little Light, Amplify Effect, Cleansing Water, All-Out Effort (+ Flash Blink consumível) |
| Movimento | 3 | Whirlwind, Clear Wind Wheel, Dragonpill Cricket |

**Pendente:** faltam 3 Gu de movimento para a meta de 6 por slot. Somente nomes com Rank 1
verificado entram; Jumping Grass (Rank não confirmado), Chasing Wind (Rank 4), Lightning Flash
(Rank 5) e Footless Bird (Rank 3) foram rejeitados. A lacuna está declarada em
`PENDING_GU_SLOTS` e aparece na ficha; não será preenchida com invenção.

Os três Gu assimiláveis (Bear Strength, White Boar, Black Boar) não são equipáveis nem
consumíveis: a única ação é a assimilação permanente.

### Valores ativos

- **Moonlight (base preservada):** 26 de dano, 224 px, 26 px de largura, 320 px/s, 16 de essência,
  1.800 ms. Escala pela qualidade da essência do cultivo (`primordialEssenceQualityMultiplier`),
  não pelo ataque bruto.
- **Whirlwind (base preservada):** 96 px, 20 de essência, 5.000 ms, 1,5× de velocidade por 1.800 ms.
- Bone Spear 32 / 200 px / perfurante · 22 de essência · 2.200 ms.
- Star Arrow 20 / 260 px / 520 px/s · 13 · 1.400 ms.
- Star Dart 12×3 / 190 px · 18 · 1.700 ms (cada projétil sofre mitigação separada).
- Ghost Fire 30 espírito / 180 px · 22 · 2.000 ms.
- Exploding Egg 16 em área de 56 px / 150 px · 26 · 2.600 ms.

### Passivos e mitigação

| Gu | Efeito | Limitação |
|---|---|---|
| Stone Skin | +4 defesa | sem bônus secundário |
| Jade Skin | +3 defesa e +8% vida máxima | valor de defesa menor |
| Bronze Skin | +3 defesa, +2 abaixo de 50% de vida | depende de estar ferido |
| Iron Skin | +5 defesa | −20% regeneração de essência |
| Rock Skin | +6 defesa | −10% velocidade |
| Beast Skin | +3 defesa e +6% velocidade | defesa menor |

Fórmula única: `max(1, floor(dano × 100 / (100 + defesa)))`. Defesa alta reduz, mas nunca
zera o dano de inimigos comuns (testado até 1.000.000 de defesa).

### Essência, temporários e assimilação

- Essência nunca fica negativa: custo, recarga e Rank são verificados antes de qualquer gasto.
- Regeneração: 1/s base + 2/s do Liquor Worm (eficiência, não multiplicador), interrompida
  na morte e limitada ao máximo do Rank.
- Buffs temporários: +15% a +25% de dano por 5–10 s. Regra de combinação: **o maior valor
  prevalece e a maior duração é mantida**; reaplicar não soma (Little Light continua 1,25×).
- Amplify Effect: a próxima ativação custa +50% e produz +50%; é consumido na ativação
  (efeito único, sem empilhamento).
- Assimilação: +6% dano físico (Bear Strength), +4% dano físico (White Boar) e +4% corpo a
  corpo (Black Boar). Permanente, não desfeita por morte, troca de equipamento ou reset de UI.
  **Limite:** cada Gu pode ser assimilado uma única vez; não há outro teto numérico. O Gu é
  consumido; falha (Rank, combate, item ausente, save) não consome nada. Um save que contenha
  o Gu e a assimilação ao mesmo tempo tem a quantidade forçada a zero.

### Refino determinístico

| Receita | Ingredientes | Essência | Rank | Resultado |
|---|---|---:|---:|---|
| Moonglow Gu (R2) | 1 Moonlight + 2 Little Light | 30 | 2 | 40 dano / 250 px / 380 px/s · 24 de essência · 2.200 ms |
| White Jade Gu (R2) | 1 White Boar + 1 Jade Skin | 30 | 2 | +8 defesa e +12% vida máxima |

Sem sorteio: `successChance = 1`; ingredientes e essência só são gastos com save concluído.
Um ingrediente equipado sai do slot ao ser consumido. Rank 2 tem dados próprios, não recicla
os números do Rank 1.

### Save

Chave `fang-yuan.gu.v1`, versão 1. Saves v0 (sem inventário persistente) são migrados
preservando apenas o equipamento/lista que comprovadamente possuíam — nunca o catálogo
inteiro —, e a migração é idempotente. IDs desconhecidos, quantidades inválidas, Gu duplicado
em dois slots e equipamento sem posse são descartados na leitura.

## Gu selvagens — v0.3

Criaturas podem nascer portando um Gu e usá-lo em combate. É um encontro raro: a chance é
sorteada **uma única vez, no nascimento** (`CombatEngine.addEnemy` → `rollWildGu`), fica
gravada na instância (`Enemy.wildGu`) e nunca é recalculada por ataque, tick, morte ou troca
de área. O cenário de jogo passa `Math.random`; sem fonte de aleatoriedade explícita a
criatura nasce sem Gu, o que mantém os testes de combate determinísticos.

| Criatura | Chance | Pool máximo |
|---|---:|---|
| Tier 1 (Rank 1) | 2% | Gu Rank 1 |
| Tier 2 (Rank 2) | 4% | Gu Rank 1–2 |
| Tier 3 (Rank 3) | 6% | Gu Rank 1–2 (ainda não há Gu Rank 3) |
| Chefes (qualquer Rank) | 15% | até o Rank do chefe |

Regras do pool (`src/combat/wildGu.ts`):

- Nenhum Gu acima do Rank da criatura. Força-bruta (`forcedWildGu`) com Rank acima do teto é
  recusada e a criatura nasce sem Gu.
- Ficam fora do sorteio consumíveis e Gu sem efeito observável em criatura: Flash Blink,
  Liquor Worm (essência não existe para inimigos) e os três Gu assimiláveis de força.
- Afinidade por criatura (`wildGuAffinity` no `mobCatalog`) só estreita o pool; nunca eleva o Rank.
  Sem Gu do mesmo Rank no catálogo, usa-se o Rank mais alto abaixo dele (caso de Rank 3/4).
- Criaturas sem Gu mantêm exatamente os valores anteriores de vida, defesa, dano, velocidade e drops.

### Uso em combate

O comportamento vem do efeito já existente no catálogo — não há Gu novo nesta versão:

| Efeito do Gu | Ação da criatura | Limite |
|---|---|---|
| Projétil (Moonlight, Bone Spear, Star Arrow/Dart, Ghost Fire, Exploding Egg, Moonglow) | Dispara um orbe na direção do herói | 11–21 dano (8–21% da vida máxima do herói), alcance 85% e velocidade 80% do Gu do jogador, recarga 1,4× (2,6–7 s), 900 ms de espera inicial |
| Passivo de defesa/vida (Stone/Jade/Bronze/Iron/Rock/Beast Skin, White Jade) | Aplica defesa, vida máxima, velocidade e Bronze Skin condicional no nascimento | Defesa passa pela fórmula de mitigação (piso 1); nunca imunidade |
| Cura (Cleansing Water) | Cura 18% da vida máxima | Só abaixo de 60% da vida; recarga 8–14 s; nunca passa do teto |
| Buff (Little Light, All-Out Effort) e Empower (Amplify Effect) | +15/+25% de dano corpo a corpo por 6–8 s | Teto de +30%; recarga 8–12 s; não acumula |
| Movimento (Whirlwind, Clear Wind Wheel, Dragonpill Cricket) | Investida curta na direção do herói | Usa a colisão real do mapa (não atravessa parede nem sai do mapa); para a 30 px do herói; recarga 5–9 s |

Cada uso emite `enemy-ability` e a criatura mostra o nome do Gu acima do sprite, um anel
colorido no corpo, texto flutuante e mensagem no HUD. Projéteis selvagens são orbes distintos
das lâminas do jogador, com a cor do Gu.

### Recompensa

- A morte lê `enemy.wildGu` e grava o **mesmo** Gu no evento `reward.guReward` — nada é
  sorteado no óbito. Sem Gu no corpo, o evento não tem `guReward`.
- O Gu é separado de pedras e materiais: `cultivation.receiveLoot` continua tratando os
  recursos e `CombatEngine.claimWildGu` só mexe no inventário de Gu.
- `claimWildGu` é idempotente (`claimedWildGu` + remoção do drop pendente): processar a mesma
  morte duas vezes, recarregar a área ou reiniciar a sessão não duplica a unidade.
- Se o save falhar, o drop permanece pendente e a fila tenta de novo com **backoff exponencial**
  (2 s → 4 s → 8 s → 16 s → 30 s); o HUD avisa na primeira e na penúltima tentativa, sem repetir a
  mesma mensagem. A lógica vive em `src/combat/rewardFlow.ts` (`RewardQueue`), testada fora do Phaser.
- Depois de **5 falhas seguidas** a persistência é desligada nos dois lados (Gu e cultivo) e a sessão
  continua **em memória**: a recompensa entra, o jogador recebe um aviso único de que o progresso
  não será salvo e o jogo para de tentar gravar. Sem isso, um `localStorage` bloqueado repetia a
  mesma tentativa para sempre. Pedras/materiais só são entregues depois que o Gu é gravado, quando o
  motivo é inventário cheio (aí os outros drops seguem normalmente) ou quando a fila degradou.
- Recompensas com zero pedras (ou zero material) são válidas desde que não sejam vazias; antes
  disso, a primeira criatura sem pedras travaria a fila inteira em retry infinito.
- Mobs voltam em 60–90 s (chefes, 5–6 min), sempre na área onde morreram e longe do jogador. O farm da criatura mais fácil é limitado pelo tempo de retorno, não pela ausência de respawn.

### Limitação conhecida

O kit inicial da v0.2 concede **todos** os 24 Gu Rank 1. Um drop de Gu Rank 1 é, portanto,
uma segunda unidade de algo já possuído; o prêmio realmente novo são Moonglow/White Jade
(Rank 2) de criaturas Rank 2+ e chefes. Recomenda-se, num passe futuro, trocar o kit inicial
por aquisição gradual ou dar uso a duplicatas.

## Banca do Jiang Ya — v0.4

Comércio inicial do protótipo: **um** vendedor na vila. Nenhum valor é cânone.

| Item | Pedras | Observação |
| --- | --- | --- |
| Material de ruptura Rank 1 | 8 | um javali/lobo/cobra comum rende 1 |
| Material de ruptura Rank 2 | 24 | fauna perigosa |
| Material de ruptura Rank 3 | 70 | elites |
| Material de ruptura Rank 4 | 200 | chefes (4 materiais por morte) |
| Seta Estelar (Flecha Estelar Gu) | 650 | preço do catálogo |
| Lança de Osso | 700 | preço do catálogo |
| Pele de Besta | 500 | preço do catálogo |
| Pele de Rocha | 650 | preço do catálogo |
| Roda de Vento | 650 | preço do catálogo |
| Pequena Luz | 700 | preço do catálogo |

Regras e raciocínio:

- A venda de material é **sink de drop**: dobra aproximadamente o retorno em pedras
  de uma caçada (fauna Rank 1 dá 7–10 pedras + 1 material = 15–18 no total), sem
  competir com o custo de estágio do Rank 1 (20/35/55).
- Materiais Rank 4 valem 4× mais que Rank 3 porque só chefes os soltam e em maior
  quantidade; um chefe antigo paga 600 pedras + 4 materiais = 1.400 no total.
- Gu usam o preço de referência já existente; não há markup nem desconto. Nenhuma
  Gu da banca é assimilável ou consumível, então a compra nunca cria benefício
  permanente duplicado.
- A banca **não compra Gu**: vender Gu exigiria preço de compra por Rank e abriria
  um ciclo de farmar Gu selvagem → pedras infinitas; fica fora até revisão.
- O inventário de teste ainda concede uma cópia de cada Gu Rank 1; o efeito
  econômico real da banca aparece quando esse inventário for retirado.

## Personagens jogáveis — Bai Ning Bing (v0.5)

Dois personagens, **as mesmas regras**: Gu, cultivo, refino, banca e salvamento são
únicos; o que muda é arte, sobrevivência, passo e formato do ataque básico. Os números
abaixo são parâmetros de gameplay (não canon) e a referência do Fang Yuan **não** foi
alterada na v0.5.

| Personagem | Vida | Defesa | Passo | Básico | Alcance | Recarga | DPS do básico |
|---|---:|---:|---:|---|---:|---:|---:|
| Fang Yuan (corpo a corpo) | 100% | 2 | 100% | 14 de dano, imediato | 62 px | 600 ms | ~23,3 |
| Bai Ning Bing (à distância) | 85% | 1 | 105% | 9 de dano, projétil 420 px/s | 190 px | 650 ms | ~13,8 |

Justificativa, eixo a eixo: ela **perde** em dano (−41% por segundo), em eficiência
(650 ms contra 600 ms) e em sobrevivência (−15% de vida, 1 de defesa a menos); **ganha**
em alcance (3× o do corpo a corpo) e num passo 5% maior, que é o que permite manter a
distância. Nenhum dos dois é simultaneamente superior em dano, alcance, velocidade e
eficiência.

O básico à distância não faz checagem de linha de visão no disparo, porque quem viaja é
o projétil: ele para na parede como qualquer outro, e é por isso que atirar num alvo
atrás de árvore desperdiça o tiro em vez de atravessar o obstáculo. O dano continua
proporcional ao ataque de cultivo (0,64 × ataque), então os dois personagens escalam
junto nos nove Ranks; o Gu da Lua e os demais Gu de ataque seguem iguais para os dois.

## Regra de trabalho

Não vamos inflar HP/DEF para criar dificuldade. Toda alteração deve ser validada contra TTK, dano recebido, custo em essência, disponibilidade de recursos, risco/recompensa e progressão de Rank. Depois dos testes de combate, a economia será recalibrada para que a progressão seja exigente sem virar grind vazio.
