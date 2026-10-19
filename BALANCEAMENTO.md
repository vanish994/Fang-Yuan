# Balanceamento inicial — cultivo de Fang Yuan

**Estado: provisório para este protótipo e aplicado em `src/entities/cultivationBalance.ts`.** Valores podem ser aprimorados em revisões futuras. Não há XP nem níveis. O estado-base de Fang Yuan é **Rank 1, estágio Inicial, com 0 pedras espirituais e sem materiais**; a campanha jogável recebe um crédito único de **1.000.000 de pedras espirituais de teste** por save, sem alterar a essência primordial.

Os números abaixo são os custos e probabilidades ativos no motor de cultivo. As colunas Inicial→Médio, Médio→Superior e Superior→Pico são **custos em pedras espirituais**. A coluna Pico→Rank seguinte é o custo de pedras para uma ruptura, além dos materiais. O Rank 9 Pico é o limite.

| Rank atual | Inicial→Médio | Médio→Superior | Superior→Pico | Pico→próximo Rank | Materiais exigidos* | Sucesso da ruptura | Perda por tipo de material na falha |
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

\*Quantidade total por Rank aprovada para o protótipo. Os tipos de item e inimigos que os deixam cair **ainda não estão definidos**: `ruptura-rank-N` é somente um ID técnico neutro, sem item canônico ou fonte no mapa. Cada tipo exigido tem seu próprio sorteio de perda se a ruptura falhar.

## Regras definidas

- São 9 Ranks com 4 estágios: Inicial, Médio, Superior, Pico. Sem XP/nível.
- A moeda do cultivo se chama **pedras espirituais**; é o mesmo recurso anteriormente chamado de pedras primordiais, não uma segunda moeda.
- Subir de estágio consome pedras espirituais; estágios superiores exigem mais.
- Passar de Pico ao próximo Rank exige pedras e materiais de inimigos e pode falhar.
- Na falha, as pedras investidas são sempre perdidas. A perda de **cada tipo** de material é sorteada separadamente. Tentativas não recebem bônus por falhas anteriores.
- **Fontes futuras das pedras espirituais:** drop direto de inimigos e troca dos itens dropados pelos inimigos por pedras. Ainda não há taxas de drop, itens aceitos nem valores de troca definidos.

## O que ainda falta no mundo

O motor já está ligado à ficha: exibe o próximo custo, recursos possuídos, chance e motivo do bloqueio; o botão só permite avanço quando há recursos. O crédito de teste é gravado junto com o saldo e com uma marca de concessão, para não reaparecer após gastar ou recarregar. Ele **não é um drop nem uma nova moeda**. Criaturas de teste deixam pedras e material de ruptura do Rank 1; a troca de drops por pedras e fontes de materiais dos Ranks superiores ainda não foram implementadas. Por isso, muitas pedras permitem testar os estágios, mas não removem a exigência de materiais para rupturas. A progressão é salva localmente no navegador, sem servidor. O sprite do Mar Primordial está disponível apenas na aba Avanço e representa a essência primordial, um recurso diferente das pedras espirituais.

> O GDD em `docs/GDD-ATUALIZADO.md` foi atualizado para refletir a decisão de cultivar sem XP e distinguir os valores aprovados para o protótipo das regras canônicas.
