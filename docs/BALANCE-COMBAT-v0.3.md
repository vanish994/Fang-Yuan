# Balance de Combate v0.3

## Objetivo

Validar a progressão R1–R9 contra a fauna e os quatro bosses usando a fórmula de mitigação não-linear atual. O objetivo é manter a sensação de **difícil, mas justo** sem fazer o Gu da Lua Rank 1 substituir Gus de Rank superior.

## Fórmula usada

`dano = floor(dano_base * 100 / (100 + defesa))`, com mínimo de 1.

Ataque básico usa o ataque derivado da cultivação. O Gu da Lua permanece Rank 1 e usa `26 × qualidade_da_essência`; o Rank do cultivador aumenta a qualidade da essência, não o Rank do Gu.

## Curva de referência — Inicial de cada Rank

| Rank | HP | Ataque | Defesa | Dano Gu da Lua |
|---:|---:|---:|---:|---:|
| 1 | 100 | 14 | 2 | 26 |
| 2 | 142 | 20 | 3 | 28 |
| 3 | 202 | 28 | 5 | 30 |
| 4 | 286 | 40 | 7 | 32 |
| 5 | 407 | 57 | 9 | 34 |
| 6 | 577 | 81 | 11 | 36 |
| 7 | 820 | 115 | 12 | 38 |
| 8 | 1164 | 163 | 14 | 41 |
| 9 | 1653 | 231 | 16 | 43 |

## TTK observado no Rank 1 Inicial

Quantidade de acertos, sem considerar habilidades futuras, terreno ou crítico:

| Grupo | Ataque básico | Gu da Lua |
|---|---:|---:|
| Fauna comum (T1) | 2–5 | 1–3 |
| Fauna perigosa (T2) | 5–15 | 5–8 |
| Elite (T3) | 22–70 | 12–35 |
| Boss | 54–219 | 47–163 |

O resultado é intencional: R1 consegue lidar com fauna comum, T2 já exige preparação e T3/bosses não devem ser tratados como encontros normais. Os bosses também têm dano suficiente para tornar uma aproximação descuidada letal.

## Progressão esperada

- R1: sobreviver e caçar fauna comum; T2 é perigoso; T3 exige preparação; bosses não são alvos normais.
- R2–R3: T1 deixa de ser ameaça séria; T2 torna-se caça viável; T3 passa a ser o conteúdo de risco; bosses de baixo Rank continuam exigindo preparo e Gus adequados.
- R4–R6: T2 torna-se conteúdo de farm/recursos; T3 deve continuar relevante em grupos e situações ruins; bosses passam a ser encontros planejáveis.
- R7–R9: fauna comum não deve consumir atenção; elites e bosses continuam importantes por mecânicas, drops e risco, não por simplesmente inflar números.

## Regra para futuros Gus

Um Gu novo recebe seu próprio `rank`, dano/efeito base, custo e curva de eficiência. Um Gu Rank 1 não sobe automaticamente para o poder de um Gu Rank 5 só porque o cultivador chegou ao Rank 5. A essência de qualidade superior aumenta a eficiência de ativação dentro dos limites daquele Gu.

## Próximo passe

Este documento fecha a curva numérica de combate atual. O próximo balanceamento deve adicionar habilidades reais aos mobs/bosses, testar grupos e medir consumo de essência por encontro. Depois disso, economia e loot podem ser ajustados com base no tempo real de caça.
