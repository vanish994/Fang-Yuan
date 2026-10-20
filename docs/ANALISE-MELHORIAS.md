# Análise técnica e melhorias sugeridas — Fang Yuan

Data: 2026-10-20 · Base analisada: `main` @ `2344f25` (branch desta sessão: `arena/184917f3-fang-yuan`)
Método: leitura do código + medições executadas (testes, build, simulações). Nada aqui é suposição: cada achado cita arquivo:linha e, quando aplicável, o resultado medido.

---

## 1. Sumário executivo

O projeto está em boa forma estrutural (TypeScript `strict`, zero `any`, zero `@ts-ignore`, 118 testes, save normalizado, acessibilidade com `aria-live`, CSS sem código morto, 0 vulnerabilidades). Os problemas que restam não são de estilo: são de **comportamento** e de **processo**.

> **Status (2026-10-20):** a **Onda 1** foi implementada nesta branch. Itens 1, 2, 3, 4, 5, 7, 8 e — antecipado da Onda 2 — o backoff do item 5 de robustez estão corrigidos, com testes de regressão. Ver “Progresso da Onda 1” no fim do documento; o restante segue como proposta.

| # | Achado | Severidade | Impacto medido | Esforço |
|---|---|---|---|---|
| 1 | Projétil de Gu selvagem só dispara em 4 direções cardeais e erra alvos fora do eixo | **P0** | em **33%** dos combates o Gu é anunciado e nunca causa dano | P |
| 2 | Teste `wildGu` é instável (revelou o item 1) | **P0** | falha ~1 a cada 6 execuções de `npm test` | P |
| 3 | Loot por criatura do catálogo é ignorado; todas dão 8 pedras | **P1** | 19 criaturas, 18 tabelas de loot distintas, **1** usada | P |
| 4 | `receiveLoot` rejeita 0 pedras → trava em retry infinito quando o item 3 for corrigido | **P1** | loop de 2 s eterno + HUD piscando | P |
| 5 | Falha de `localStorage` entra em retry infinito sem backoff/limite | **P1** | recompensas nunca entram, jogo “travado” silenciosamente | M |
| 6 | Save de versão futura/corrompido é sobrescrito sem backup | **P1** | perda silenciosa de inventário e cultivo | P |
| 7 | CI só publica em `main`; não roda testes/typecheck | **P1** | regressão entra sem aviso | P |
| 8 | `renderRecipes()` reconstrói o DOM a cada quadro | **P1** | perda de foco de teclado ~60×/s na ficha | P |
| 9 | RNG não é injetável no `tick` (IA usa `Math.random`) | **P2** | testes instáveis, sem replay/determinismo | M |
| 10 | Default de inventário duplicado (engine × guState) | **P2** | divergência silenciosa futura | P |
| 11 | 5 exports mortos, estado de Gu selvagem em 6 campos soltos, 3 arquivos > 600 linhas | **P2** | manutenção | M |
| 12 | 16% dos asserts são sobre **texto** do código-fonte | **P2** | já bloqueou refatoração legítima | G |
| 13 | Bundle único de 1,5 MB, sem sourcemap, sem vendor chunk | **P3** | cache/observabilidade | P |
| 14 | `strictPort: true` no dev | **P3** | `npm run dev` falha se 5173 estiver ocupada (aconteceu nesta sessão) | P |
| 15 | Rótulos inconsistentes no catálogo; CSS/HTML monolítico; sem lint/format | **P3** | polimento | P/M |

---

## 2. P0 — corrigir antes de qualquer nova feature

### 2.1 O Gu selvagem muitas vezes é só cosmético (projétil fora do eixo)

`stepEnemyProjectiles` (`src/combat/combatEngine.ts:961`) só considera acerto quando o desvio perpendicular é `<= 16 px` (linha 975):

```ts
const hit = cross <= 16 && along >= 0 && along <= step;
```

O disparo, porém, é cardinal: `dominantDirection` (linha 877) escolhe só `up/down/left/right`, e o projétil anda em passos de 4 px nesse eixo. As criaturas vagueiam até ±32 px do ponto de origem (`brain.stop()` em `combatEngine.ts:864`), então **qualquer alvo com desvio > 16 px nunca é atingido**, mesmo a 150 px de distância e com o Gu em recarga.

Medição com o motor real (120 combates, Coelho Lunar com Star Arrow, offsets de -32 a +32 px):

```
combates=120 disparos=480 combates em que o Gu causou dano=80 (67%)
combates em que o Gu foi usado mas NUNCA acertou=40 (33%)
```

E o HUD anuncia `Fulano usou Gu Flecha Estelar` nesses casos — o jogador vê a habilidade, não vê efeito e não tem como reagir melhor.

**Correção sugerida** (pequena e cirúrgica): guardar direção vetorial normalizada em vez de `Direction`.

```ts
interface EnemyProjectile {
  enemyId: string; guId: GuId; x: number; y: number;
  dx: number; dy: number;            // unitário, mira no herói no instante do disparo
  traveled: number; range: number; speed: number; damage: number; hitId: string;
}

// no disparo
const ox = this.hero.x - enemy.x, oy = (this.hero.y - 12) - (enemy.y - 10);
const len = Math.hypot(ox, oy) || 1;
push({ dx: ox / len, dy: oy / len, ... });

// no passo
const along = toHeroX * shot.dx + toHeroY * shot.dy;
const cross = Math.abs(toHeroX * shot.dy - toHeroY * shot.dx);
const hit = cross <= 12 && along >= 0 && along <= step;
```

Isso mata o item 2 (teste instável), torna o efeito honesto com o anúncio do HUD e mantém o balanceamento (o dano já é limitado por `wildProjectileDamage`). Complemento de design: manter o disparo **não teleguiado** (mira congelada no disparo) para continuar esquivável — só deixa de ser inacertável.

**Teste de regressão a adicionar** (hoje inexistente):
```js
for (const dy of [0, 16, 24, 32]) {
  // inimigo deslocado no eixo Y, herói parado → o projétil DEVE causar dano
  assert.ok(hero.health < before, `dy=${dy}`);
}
```

### 2.2 Teste instável introduzido na etapa anterior

`tests/wildGu.test.mjs:138` ("criatura usa o Gu em combate") usa o Coelho Lunar, que vagueia com `Math.random`; dependendo do offset sorteado, o projétil erra (item 2.1) e o teste falha. Medido: **1 falha em ~6 execuções** de `npm test` (117/118).

Isso é um problema duplo: (a) esconde o bug real; (b) treina a equipe a ignorar falha vermelha. Correção: implementar 2.1 e, além disso, isolar o teste do wander (injetar RNG determinístico — ver 8.1 — ou fixar `enemy.lastAttackAt`/posição). **Um teste só é útil se falhar de forma reprodutível.**

---

## 3. P1 — riscos de dados, economia e processo

### 3.1 O loot por criatura existe no catálogo e é ignorado

`mobCatalog.ts` define `rewardStones` de **5 a 600** e `rewardMaterialId` de `ruptura-rank-1` a `-4`. Nenhum desses campos é lido em lugar algum:

```bash
$ grep -rn "rewardStones" src/
src/combat/mobCatalog.ts:11   # interface
src/combat/mobCatalog.ts:27   # fábrica
src/combat/mobCatalog.ts:34   # spread
# (nenhum uso)
```

O evento de recompensa usa a configuração global (`combatEngine.ts:700`):

```ts
events.push({ type: 'reward', targetId: enemy.id, stoneReward: this.config.enemy.lootStones, ... });
```

Efeito: matar a Besta Demoníaca Antiga (3.500 PV, 180 de dano) paga **as mesmas 8 pedras e 1 `ruptura-rank-1`** de um javali de 45 PV. Isso contraria diretamente a regra de balanceamento do projeto (risk/reward por Rank) e incentiva farmar o inimigo mais fácil — o oposto do desejado.

**Correção**: passar o loot da instância no `addEnemy` e lê-lo na morte:
```ts
this.enemyLoot.set(id, { stones: mob?.rewardStones ?? cfg.lootStones,
                        materialId: mob?.rewardMaterialId ?? cfg.lootMaterialId,
                        quantity: mob?.rewardMaterialQuantity ?? cfg.lootMaterialQuantity });
```
Sem RNG: valores fixos por criatura, como o catálogo já declara.

### 3.2 `receiveLoot` rejeita 0 pedras → retry infinito

`characterCultivation.ts:119` valida `stones <= 0` como inválido e lança `RangeError`. Hoje todos os mobs dão 8 pedras, então ninguém percebe. Assim que o item 3.1 for ligado, qualquer criatura com `rewardStones: 0` fará `flushRewards` cair no `catch`, reagendar em 2 s e repetir **para sempre**, com mensagem no HUD e o restante da fila travado.

**Correção**: aceitar `stones === 0` quando `quantity > 0` (e vice-versa) e proibir só o par (0,0). Adicionar teste com loot `(0 pedras, 1 material)`.

### 3.3 Falha de `localStorage` gera loop infinito sem limite

Dois caminhos independentes repetem a cada 2 s sem contador nem backoff:

- `main.ts:347` e `main.ts:360` — `claimWildGu` falhou ou `receiveLoot` lançou.
- Cenario real: navegador em modo privado com cota esgotada ou storage bloqueado por política.

Nunca há desistência, aviso único, nem degradação para memória. O jogador só vê a mesma mensagem para sempre e perde a recompensa. `CharacterCultivation.grantTestStonesOnce` já tem o padrão certo (`this.storage = null; this.commit(...)`) — ele não foi aplicado ao fluxo de loot.

**Correção**: contador de tentativas (ex.: 3), backoff exponencial limitado, e após esgotar: desligar persistência, manter o estado em memória, emitir **um** aviso ("progresso não será salvo") e seguir o jogo. Registrar a decisão em `BALANCEAMENTO.md`.

### 3.4 Save de versão futura/corrompido é sobrescrito sem backup

`guState.ts:113` (`if (record.version !== undefined && record.version !== GU_STATE_VERSION) return null;`) e `characterCultivation.ts:36` devolvem `null`, o jogo adota o default e o **primeiro save sobrescreve** o arquivo original. Um downgrade, uma extensão de navegador ou um JSON corrompido custam inventário, pedras e cultivo sem chance de recuperação.

**Correção barata (2 linhas + teste)**:
```ts
const raw = this.storage.getItem(KEY);
if (!raw) return null;
try { /* parse + validação */ } catch { /* cai no backup */ }
// antes de qualquer escrita, se a leitura falhou:
this.storage.setItem(`${KEY}.backup`, raw);   // preserva o original
```
E expor um aviso na ficha ("save anterior preservado em backup").

### 3.5 CI não roda testes

`.github/workflows/deploy.yml` roda em `push` para `main`: `npm ci` → `npm run build` → deploy. `npm test` **nunca** roda em CI, e não existe workflow de PR. O `build` cobre o typecheck (bom), mas não a suíte de 118 testes — justamente a que pegou o bug 2.1.

**Sugestão** (`.github/workflows/ci.yml`):
```yaml
name: CI
on:
  pull_request:
  push: { branches: [main] }
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```
Custo: ~40 s por PR. Ganho: o bug intermitente passa a ser detectado antes do merge.

### 3.6 Ficha reconstrói os cards de refino a cada quadro

`characterSheet.ts:289` chama `renderRecipes()` dentro do caminho de `update()` executado a cada frame, e a função começa com `this.recipeList.replaceChildren()` (linha 493). Consequência prática: **o botão focado é destruído ~60×/s**, então navegar por teclado na lista de receitas é impossível (o foco cai para o `body` continuamente). Também gera 2 cards + 2 botões por frame enquanto a ficha está aberta.

O `renderCollection`/`renderEquipment` já usam assinatura (`lastInventoryKey`, `optionSignatures`) — o padrão existe, só não foi aplicado aqui. **Correção**: assinatura `essencia|rank|inventario|locked`, e atualizar apenas o texto de disponibilidade quando só a essência mudar.

---

## 4. P2 — arquitetura e manutenibilidade

### 4.1 RNG não é injetável na simulação (determinismo)
`CombatEngine.tick` chama `brain.decide(now, ...)` sem RNG; `AgentBrain.decide` usa `Math.random` como default (`agentBrain.ts:47`). Ou seja: o motor aceita `random` em `hitHero`, mas a IA sempre é aleatória. Isso (a) torna testes de combate inerentemente instáveis, (b) impede replay/depuração de bugs de combate, (c) impede testes de balanceamento reprodutíveis.
**Sugestão**: um único `rng` no construtor do engine, repassado a `decide`, `hitHero`, `rollWildGu`. Sem quebrar API: parâmetro opcional com default `Math.random`.

### 4.2 Default de inventário duplicado
`combatEngine.ts:114` (`defaultSnapshot`) e `guState.ts:29` (`defaultGuSnapshot`) montam a mesma coisa por caminhos diferentes. Verifiquei que hoje produzem JSON idêntico — mas é uma divergência esperando acontecer (ex.: mudar `STARTING_INVENTORY` e esquecer o engine).
**Sugestão**: `import { defaultGuSnapshot } from './guState'` e remover a cópia (1 linha).

### 4.3 Exports mortos (medido)
Nenhum uso em `src/` nem em `tests/`: `CULTIVATION_COMBAT_STATES`, `PRIMORDIAL_SEA_FRAME_SIZE`, `activeOf`, `passiveOf`, `enemyTraits`. Remover ou passar a usar (5 linhas a menos, menos API fantasma).

### 4.4 Estado de Gu selvagem espalhado no `Enemy`
Hoje: `wildGu`, `wildGuNextAt`, `wildGuCasts`, `wildBuffUntil`, `wildDamageBonus`, `wildLowHealthDefense` — seis campos opcionais soltos no tipo central, sendo `wildGu?: GuId | null` (três estados: ausente, `null`, id).
**Sugestão**: `wild?: { gu: GuId; nextAt: number; casts: number; buffUntil: number; damageBonus: number; lowHealthDefense: number }`. Ganho: `Enemy` volta a ser legível, fica óbvio o que pertence a qual sistema e a serialização futura de inimigos (se existir) fica trivial.

### 4.5 Arquivos grandes com múltiplas responsabilidades
`combatEngine.ts` 999 linhas, `characterSheet.ts` 648, `main.ts` 607. No engine convivem: persistência (`commit`/`adoptSnapshot`), resolução de combate, IA de Gu selvagem (`useWildGu`, 90 linhas), projeto de projéteis e drops de Gu.
**Sugestão incremental** (sem reescrever nada):
1. `enemyAbilities.ts` ← `useWildGu`, `stepEnemyProjectiles`, `dominantDirection`, `travelFrom`.
2. `wildGuDrops.ts` ← `wildGuDrops`/`claimedWildGu`/`claimWildGu`.
3. Em `main.ts`, unificar os dois blocos quase idênticos de render de projétil (jogador e inimigo) num pool único parametrizado por cor/forma.

### 4.6 16% dos asserts são sobre o texto do código
Medição: **163 de 1.027 asserts** (16%) verificam strings de arquivos `.ts`/`.html` via `readFileSync`. Alguns são guardrails legítimos de balanceamento (valores canônicos da Moonlight), mas outros quebram refatorações corretas — aconteceu nesta etapa: `combatBalance.test.mjs` exigia `mitigatedDamage(amount, enemy.defense)` e precisou ser editado porque a defesa efetiva passou a vir de `enemyDefense(enemy)`.
**Sugestão**: manter asserts de texto apenas para **valores de balanceamento**; para estrutura, importar o módulo e testar comportamento (o loader `tests/support/tsModule.mjs` já permite).

### 4.7 A cola de recompensa em `main.ts` não tem teste
`flushRewards` (main.ts:335) é onde o Gu cai no inventário e onde o save pode falhar — e é a única parte do fluxo sem cobertura, porque vive numa cena Phaser não testável. Foi exatamente ali que eu precisei tratar `claim.ok === false`.
**Sugestão**: extrair para um módulo puro `src/combat/rewardFlow.ts`:
```ts
export function applyReward(engine: CombatEngine, loot: LootSink, reward: CombatEvent): RewardOutcome
```
`main.ts` só chama e mostra a mensagem; o fluxo passa a ser testável (inclusive os casos de falha).

---

## 5. P3 — polimento

| Item | Evidência | Sugestão |
|---|---|---|
| Bundle único 1,5 MB | `dist/assets/index-*.js 1.507 kB` | `build.rollupOptions.manualChunks: { phaser: ['phaser'] }` → cache melhor entre versões do jogo |
| Sem sourcemap em produção | `vite.config.ts` | `build.sourcemap: 'hidden'` para depurar erro de produção sem expor fonte no bundle |
| `strictPort` no dev | `vite.config.ts:12` | manter estrito no `preview`; no dev, remover (hoje `npm run dev` **falha** se 5173 estiver ocupada — ocorreu nesta sessão) |
| Rótulos inconsistentes | `wildGuShortLabel('bone-spear')` → `"Gu Lança de Osso"`; `'moonlight'` → `"Gu da Lua"` | campo `short` explícito no catálogo, em vez de derivar por `split('·')` |
| `index.html` monolítico | 570 linhas / 41 KB, um `<style>` de ~460 linhas | extrair CSS para `src/ui/styles/*.css` importado no `main.ts` (Vite já processa) |
| Sem lint/format | nenhum `.editorconfig`, `prettier`, `eslint` | config mínima + `npm run lint`; o código já é consistente, a ferramenta só protege o futuro |
| Sem cobertura | `npm test` sem `--experimental-test-coverage` | habilitar cobertura para saber o que a suíte realmente exercita |

---

## 6. Roadmap sugerido

**Onda 1 — correções (≈meio dia, risco baixo)**
1. Projétil com direção vetorial (2.1) + teste de regressão fora do eixo.
2. Estabilizar `wildGu.test.mjs` (2.2).
3. Ligar o loot por criatura (3.1) e aceitar 0 pedras (3.2) — com testes.
4. Workflow de CI (3.5).
5. Backup de save antes de sobrescrever (3.4).
*Critério de aceite*: `npm test` 5× seguidas sem falha; 0 pedras de recompensa não gera loop; PR vermelho se algum teste cair.

**Onda 2 — robustez e determinismo (≈1 dia)**
6. RNG injetável no engine (4.1) — habilita testes determinísticos de IA e de balanceamento.
7. Retry com limite + degradação para memória (3.3).
8. `renderRecipes` com assinatura (3.6).
9. Extrair `rewardFlow` e testá-lo (4.7).

**Onda 3 — estrutura (contínuo, sem bloquear features)**
10. `enemyAbilities`/`wildGuDrops` fora do engine (4.5); unificar render de projéteis.
11. Agrupar estado selvagem em `Enemy.wild` (4.4); apagar exports mortos e o default duplicado (4.2, 4.3).
12. Reduzir asserts de texto a valores de balanceamento (4.6).
13. Polimento da seção 5.

---

## 7. Pontos fortes que devem ser preservados

- **TypeScript impecável**: `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`; **zero** `any`, `as any`, `@ts-ignore` ou `@ts-expect-error` em 5.473 linhas.
- **Persistência defensiva**: `normalizeGuSnapshot` sanitiza tudo na leitura (ids desconhecidos, quantidades inválidas, Gu em dois slots, equipamento sem posse) e a migração v0 é idempotente. O padrão “salvar antes de publicar” (`commit`) evita estado parcial.
- **Testes de comportamento fortes**: 118 testes em 14 s, incluindo save corrompido, mitigações, assimilação, refino e o fluxo de Gu selvagem.
- **Acessibilidade real**: `role="status"` + `aria-live` em 6 pontos, foco visível, `Escape` fecha a ficha, botões com `aria-label`.
- **CSS limpo**: 68 classes, apenas 1 sem uso (`gu-choice`) — incomum em projetos deste tamanho.
- **Zero vulnerabilidades** (`npm audit`: 0) e lockfile presente.
- **Documentação viva**: `BALANCEAMENTO.md`, `GDD-ATUALIZADO.md` e `README.md` acompanham as decisões, com valores marcados como provisórios.

---

## 8. O que **não** vale a pena fazer agora

- **Migrar para React/Vue ou para ECS**: o DOM imperativo da ficha e o loop do engine funcionam, são testáveis e não há sinal de dor que justifique o custo.
- **Trocar `node:test` por Vitest**: 118 testes em 14 s com um loader de 50 linhas cumprem o papel; migrar só adiciona dependências (reavaliar se a suíte passar de ~2 min).
- **Micro-otimizar o loop de combate**: com ~19 inimigos por área e 60 FPS, o gargalo não está lá — os problemas de CPU/DOM estão na ficha (3.6).
- **Adicionar Gu novos antes de corrigir 2.1/3.1**: hoje o efeito de Gu selvagem falha em 1/3 dos combates e a economia de recompensa está achatada; mais conteúdo sobre essa base amplia o retrabalho.

---

## 9. Próximo passo

Recomendo executar a **Onda 1** inteira de uma vez: são correções pequenas, com testes de regressão, e cada uma fecha um risco concreto (bug de combate, teste instável, economia morta, perda de save, CI cego). Posso implementá-la nesta branch com commit separado por item e relatório de antes/depois das medições (33% de falha → 0%, `npm test` 5× verde, loot por criatura ativo).


---

## 10. Progresso da Onda 1 (implementado)

| Item | Correção | Evidência antes → depois |
|---|---|---|
| 1. Projétil do Gu selvagem | Mira vetorial normalizada, congelada no disparo; corredor de 12 px | **33%** dos combates com Gu anunciado e zero dano → **0%** (120 combates simulados, todos os offsets de −32 a +32 px) |
| 2. Teste instável | Corpo a corpo neutralizado no teste e novo teste paramétrico fora do eixo | 1 falha a cada ~6 `npm test` → **6 execuções seguidas verdes** |
| 3. Loot por criatura | `addEnemy` guarda `rewardStones`/`rewardMaterial` do catálogo; a morte lê a instância | 19 criaturas com 18 tabelas distintas, **1** usada (8 pedras fixas) → **18** usadas (7 a 600 pedras, Rank 1–4) |
| 4. Zero pedras travava a fila | `receiveLoot` aceita 0 em um dos lados e recusa só recompensa vazia | `RangeError` → retry infinito; agora aceito e testado |
| 5. Retry sem limite (antecipado) | Backoff 2 s → 4 s → … → 30 s, aviso único na 5ª falha | mensagem a cada 2 s para sempre → avisos espaçados e conclusivos |
| 6. Save sobrescrito | `<chave>.backup` criado antes da primeira gravação sobre save ilegível/futuro | perda silenciosa → original preservado (testado nos dois saves) |
| 7. CI cego | `.github/workflows/ci.yml` com typecheck + testes + build em PR e push | nenhum teste em PR → suíte completa por PR |

**Balanceamento do novo loot:** a curva é suave em risco normalizado — 0,144 a 0,288 pedras por PV em todas as criaturas; chefes pagam 2–4 materiais de Rank superior. Nenhuma criatura domina o farm por pedra/PV, e o respawn continua inexistente na sessão.

**Pendente da Onda 2/3:** RNG injetável no `tick`, extração de `rewardFlow` para teste, `renderRecipes` com assinatura (perda de foco), agrupamento de `Enemy.wild`, remoção de exports mortos e do default duplicado, redução de asserts sobre texto do código.
