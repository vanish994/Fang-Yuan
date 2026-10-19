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

## Regra de trabalho

Não vamos inflar HP/DEF para criar dificuldade. Toda alteração deve ser validada contra TTK, dano recebido, custo em essência, disponibilidade de recursos, risco/recompensa e progressão de Rank. Depois dos testes de combate, a economia será recalibrada para que a progressão seja exigente sem virar grind vazio.
