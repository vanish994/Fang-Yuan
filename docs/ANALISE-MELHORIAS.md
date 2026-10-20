# Análise técnica e melhorias sugeridas — Fang Yuan

Data: 2026-10-20 · Base analisada: `main` @ `2344f25` (branch desta sessão: `arena/184917f3-fang-yuan`)
Método: leitura do código + medições executadas (testes, build, simulações). Nada aqui é suposição: cada achado cita arquivo:linha e, quando aplicável, o resultado medido.

---

## 1. Sumário executivo

O projeto está em boa forma estrutural (TypeScript `strict`, zero `any`, zero `@ts-ignore`, 118 testes, save normalizado, acessibilidade com `aria-live`, CSS sem código morto, 0 vulnerabilidades). Os problemas que restam não são de estilo: são de **comportamento** e de **processo**.

> **Status (2026-10-20):** **Ondas 1, 2 e 3 implementadas** nesta branch, com testes de regressão e medições antes/depois.
> Onda 1: itens 1, 2, 3, 4, 5, 7, 8. Onda 2: RNG injetável (4.1), degradação para memória (3.3), assinatura de render das receitas (3.6) e extração do fluxo de recompensa (4.7).
> Onda 3: `Enemy.wild` (4.4), exports mortos (4.2/4.3), `enemyAbilities`/`wildGuDrops` fora do motor (4.5), render de projéteis unificado, asserts de texto reduzidos (4.6) e todo o polimento da seção 5.
> Ver “Progresso da Onda 1”, “Onda 2” e “Onda 3” no fim do documento. O que continua em aberto está em “Pendências (não bloqueiam features)”.

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

**Balanceamento do novo loot:** a curva é suave em risco normalizado — 0,144 a 0,288 pedras por PV em todas as criaturas; chefes pagam 2–4 materiais de Rank superior. Nenhuma criatura domina o farm por pedra/PV. (Na época desta onda não havia respawn; a seção 13 registra a mudança posterior.)

**Pendente na época (hoje concluído na Onda 3):** RNG injetável no `tick`, extração de `rewardFlow` para teste, `renderRecipes` com assinatura (perda de foco), agrupamento de `Enemy.wild`, remoção de exports mortos e do default duplicado, redução de asserts sobre texto do código.


---

## 11. Progresso da Onda 2 (implementado)

| Item | Correção | Evidência antes → depois |
|---|---|---|
| 4.7 Fluxo de recompensa sem teste | `src/combat/rewardFlow.ts` com `RewardQueue` (enqueue/drain/degrade) e mensagens prontas para o HUD; `main.ts` só decide quando drenar | lógica de gravação dentro da cena Phaser (0 testes) → **9 testes**, incluindo integração com motor e saves reais |
| 3.3 Retry sem limite | Após **5 falhas seguidas**: persistência desligada nos dois lados, aviso único, entrega em memória | retry a cada 2 s para sempre → **2 s → 4 s → 8 s → 16 s → 30 s**, degradação e entrega no mesmo instante |
| 4.1 RNG não injetável | `CombatEngine(..., random?)` governa IA, revive da Cigarra e sorteio de Gu selvagem | testes de combate dependiam de `Math.random` → mesma seed reproduz **exatamente** a mesma simulação (8 testes) |
| 3.6 Ficha reconstruía o DOM a cada quadro | `src/ui/recipeView.ts` (chave de render sem a essência) + `refreshRecipeButtons` | **600 reconstruções em 10 s** (foco de teclado destruído ~60×/s) → **1** |

**Como foi medido**

- Reconstruções da ficha: 600 quadros com o motor real, contando mudanças da chave de render — 600 → 1.
- Fila degradada: simulação com `setItem` lançando sempre; mensagens em 0 s, 14 s e 30 s, entrega do Gu + 22 pedras + material no instante da degradação, fila vazia ao fim.
- Determinismo: `mulberry32` com seeds 1, 7 e 1234; retratos de posição/vida/eventos idênticos entre execuções e distintos entre seeds.

**Detalhes de projeto que valem registro**

- `claimWildGu` passou a devolver `retryable`: a UI não decide mais por regex no texto do motivo.
- Inventário de Gu cheio continua sendo falha **não** retentável — pedras e material entram normalmente.
- Depois de degradar, uma nova falha vira `stalled` (fila pausada por 30 s) em vez de reiniciar o ciclo: não existe caminho de laço infinito.
- O RNG nunca é serializado; o save continua só com inventário, equipamento, assimilados, pedras e materiais.

---

## 12. Progresso da Onda 3 (implementado)

| Item | Correção | Evidência antes → depois |
|---|---|---|
| 4.4 Estado selvagem espalhado em `Enemy` | `WildGuState { gu, casts, nextAt?, buffUntil?, damageBonus?, lowHealthDefense? }`; `Enemy.wild?: WildGuState` | **6** campos opcionais soltos em `Enemy` (fáceis de esquecer ao criar/serializar) → **1** objeto opcional; o motor lê `enemy.wild?.gu`, nunca um Gu sorteado na morte |
| 4.2 Exports mortos | Removidos `activeOf`, `passiveOf` (guCatalog), `enemyTraits` (mobCatalog), `CULTIVATION_COMBAT_STATES` (cultivationCombat), `PRIMORDIAL_SEA_FRAME_SIZE` (primordialSea) | **5** símbolos exportados sem um único importador → **0** |
| 4.3 Default duplicado | `CombatEngine.defaultSnapshot` e a cópia do inventário inicial eliminados; regra única em `defaultGuSnapshot()` | mesma regra escrita em 2 lugares → **1** |
| 4.5 Motor monolítico | Novos `enemyAbilities.ts` (`useWildGu`, `stepEnemyProjectiles`, `wildMeleeMultiplier`), `geometry.ts` (vetores/distância/caminho livre) e `wildGuDrops.ts` (log puro de drops) com contexto injetado | `combatEngine.ts` **1.032 → 902 linhas**; as habilidades passaram a ser testáveis sem sessão/save (15 testes novos) |
| 4.5 Render de projéteis duplicado | `src/ui/projectileView.ts` (funções puras) + um único ciclo de pooling em `main.ts`, redesenho só quando a assinatura `guId:width`/`guId` muda | dois blocos quase idênticos (jogador/inimigo), redraw a cada quadro → **1** caminho de render (8 testes) |
| 4.6 Asserts sobre texto do código | Curva de mitigação, Moonlight e fauna passaram a ler dados e a exercitar o motor; `combatBalance.test.mjs` não lê mais `.ts` | **163 de 1.027 asserts (16%)** → **137 de 1.256 (10,9%)**; o resto é CSS, manifesto de sprites e guardrails de conteúdo |
| 5. Bundle único | `manualChunks` separa o Phaser (forma de função — o Vite 8/rolldown rejeita a forma de objeto) | `index-*.js` **1.510,77 kB (gzip 400)** → **136,52 kB (gzip 43,24)**; Phaser 1.374,10 kB fica em cache entre versões |
| 5. Sourcemap em produção | `SOURCEMAP=true` só em `npm run build:debug`; build normal sem `.map` | `sourcemap: 'hidden'` publicaria **11,2 MB** de mapa do Phaser em todo deploy → `dist` de 3,2 MB sem mapa |
| 5. `strictPort` no dev | `server.strictPort: false` (o `preview` continua estrito) | `npm run dev` falhava com a 5173 ocupada → escolhe outra porta |
| 5. `index.html` monolítico | CSS movido para `src/styles/main.css`, ligado por `<link>`; `tests/support/markup.mjs` centraliza `readHtml()`/`readStyles()` | **570 linhas / 33,4 kB, `<style>` de 436 linhas** → HTML **9,5 kB** + CSS **24,0 kB (gzip 5,55)** com hash próprio |
| 5. Sem lint/format | ESLint 9 + `typescript-eslint` com config mínima (`npm run lint`, `npm run check`) e `.editorconfig` | 0 verificações estáticas além do `tsc` → lint cobrindo `src`, `tests` e `vite.config.ts`; **5 erros e 2 avisos preexistentes corrigidos** |
| 5. Cobertura invisível | `npm run test:coverage` (`--experimental-test-coverage`) | nenhuma métrica → **99,93 % linhas / 96,66 % branches / 94,96 % funções** |
| 5. Rótulos derivados por `split('·')` | Campo `short` explícito em `GuDefinition`, preenchido nas 26 entradas do catálogo; teste garante presença, unicidade e ≤ 14 caracteres | rótulo dependia da posição do separador no texto de exibição → dado explícito, independente do `label` |

**Decisões que valem registro**

- O `SHORT_NAMES` do HUD **não** virou duplicata: o botão tem 72 px e mostra `rótulo ·custo`, então ele mantém um conjunto próprio (mais curto que o `short` do mundo). O catálogo continua sendo a fonte dos nomes completos; a decisão está comentada em `combatHUD.ts`.
- Prettier ficou de fora de propósito: reformataria todos os arquivos de uma vez e esconderia o histórico do que mudou de verdade. As regras de estilo que importam (imports de tipo, `any`, variáveis mortas) estão no ESLint.
- Os asserts restantes sobre arquivos são, em sua maioria, CSS (`.combat-joystick`, `.combat-minimap`) e manifestos de sprites — verificam o que o navegador consome, não como o código está escrito.
- `sourcemap: 'hidden'` é o modo correto (depura produção sem expor a fonte), mas só faz sentido sob demanda enquanto o Phaser gerar um mapa de 11 MB.

**Pendências (não bloqueiam features)**

1. **Balanceamento R1 → R2:** `R1 Pico` (130 PV) → `R2 Inicial` (142 PV) = **+12 PV**, o mesmo salto de `R1 Superior` → `R1 Pico` (118 → 130). O GDD diz que o Rank é o salto principal; os valores foram mantidos intactos e a questão segue aberta (precisa de teste de jogo, não de refactor).
2. **Prettier:** pode entrar depois de um commit de formatação isolado (`git blame` ignorando o commit), quando houver janela para o diff grande.
3. **Asserts de texto restantes:** os 137 são predominantemente CSS/arte; converter os de `npc.test.mjs` e `combat.test.mjs` exigiria um DOM de teste (jsdom), o que adicionaria dependência sem ganho imediato.
4. **`main.ts` ainda grande (≈600 linhas):** a cena concentra entrada, render e orquestração. A extração de projéteis já reduziu o pior trecho; dividir por sistemas (input, mundo, HUD) é o próximo passo natural, não um pré-requisito.


---

## 13. Densidade de criaturas e respawn por tempo (a pedido, 2026-10-20)

Pedido: **mais mobs nas áreas** e **respawn por tempo** (escolhido entre as opções 60–90 s com aviso no HUD).

| Item | Implementação | Evidência antes → depois |
|---|---|---|
| Quantidade por área | `extraMobs` em `src/world/initialWorld.ts` + `src/world/mobPlacement.ts`: posições autorais continuam sendo a base e as extras caem em tiles livres por hash da seed, com 4 tiles de separação e 4 de proteção (spawns autorais, NPCs, POIs, entrada) | **23** criaturas no mundo → **51** (fauna: Exterior 7→12, Perigosa 4→8, Rochosa **1→6**, Cavernas 4→8; covis 1–2 chefes + 1–2 guardas) |
| Chefes | `isBossSpawn` impede duplicação de chefe na distribuição automática | 4 chefes → **4 chefes** (nenhum extra virou chefe) |
| Respawn | `src/world/mobRespawn.ts` (`RespawnQueue`, `respawnDelay`): 60–90 s por criatura, determinístico pela chave | área ficava vazia até recarregar a página → criatura volta sozinha, com aviso no HUD |
| Chefes no respawn | Intervalo próprio de **5–6 min** | sem isso, o maior pagamento (centenas de pedras + material de Rank alto) viraria farm de 90 s |
| Segurança do nascimento | Só na área atual, ≥ 96 px do jogador e em tile livre; contrário → nova tentativa em 5 s | nunca nasce dentro de parede nem em cima do jogador |
| Recompensa repetida | Cada vida usa uma instância (`id~2`, `id~3`); o motor recusa reutilizar id | primeira morte não “engole” a recompensa da segunda |

**Medições executadas**

- Mapa real (nove áreas, `generateArea` + `canStandAt`): **51/51** spawns em chão livre, sem dois no mesmo tile, extras a ≥ 4 tiles dos pontos protegidos e nenhum chefe duplicado.
- `mobPlacement.test.mjs` (8 testes) e `mobRespawn.test.mjs` (9): determinismo por seed, teto de quantidade, refúgio quando o mapa não tem espaço, atraso em [60 s, 90 s] (chefe em [5 min, 6 min]), fila sem duplicar e sem reiniciar prazo.
- `combat.test.mjs`: segunda vida (`mob-wild-boar~2`) recebe recompensa de novo; o motor recusa reutilizar o id antigo.
- Suíte completa: **191/191**, `tsc --noEmit` limpo, `npm run lint` limpo.

**Pendente:** o respawn não é persistido entre sessões (recarregar a página reinicia os encontros) e o Gu selvagem é re-sorteado a cada renascimento — se isso ficar raro demais ou comum demais no teste de jogo, o ajuste é em `WILD_GU_CHANCES`, não no respawn.
