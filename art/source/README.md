# Matrizes das artes enviadas

Este diretório guarda **sem alteração** os PNGs-mestre 1920×1920 e os JSONs
fornecidos pelo usuário. Os caminhos absolutos dentro dos JSONs são do ambiente
de criação original; o jogo carrega os atlas publicados em `public/`.

Para reconstruir os atlas 64/96px a partir destas matrizes:

```sh
python3 -m venv .venv
.venv/bin/pip install Pillow
.venv/bin/python scripts/build-sprite-atlases.py
```

O script separa linhas pelo espaço transparente real (os pés ultrapassam a
grade nominal em vários quadros), alinha os pés e redimensiona com Lanczos.
O tamanho no mundo e a colisão não dependem da resolução destas texturas.
As três últimas linhas dos mobs continuam **somente arte**, sem atributos.

## Personagens jogáveis — quatro poses cada

| personagem | masters | uso |
|---|---|---|
| Fang Yuan (corpo a corpo) | `fang-yuan-{walk,cast,dash,down}-4dir-4frames-master.png` | locomoção, ativar Gu, arremetida e queda |
| Bai Ning Bing (à distância) | `bai-ning-bing-{walk,cast,dash,down}-4dir-4frames-master.png` | as mesmas quatro poses, com básico à distância |

Todas são grades 4×4 de 480px e são escaladas por **um único fator comum aos dois
personagens** (o maior quadro entre as oito poses), então o corpo não muda de
tamanho ao trocar de animação nem um personagem fica maior que o outro.
Detalhes em `fang-yuan-poses.json` e `bai-ning-bing-poses.json`.

A linha **cast** do Bai Ning Bing já traz o gesto de disparo: é ela que aparece
tanto ao ativar um Gu quanto no ataque básico de gelo.

**Atenção à ordem das linhas:** os oito masters vêm desenhados como
`down`, **`right`**, `up`, **`left`**, e o atlas publicado usa
`down`, `left`, `up`, `right` — a mesma ordem dos NPCs, mobs e bosses. O script
troca as linhas 2 e 4 (`MASTER_ROW_MAP = [0, 3, 2, 1]`) e, depois de
montar cada atlas, confere pelo lado do rosto se a linha lateral realmente olha
para o lado que diz olhar (`check_side_rows`). Sem a troca, andar para a esquerda
mostrava o sprite virado para a direita. Essa conferência automática cobre só o
Fang Yuan: no Bai Ning Bing o cabelo branco em volta do rosto confunde a medida, e a
ordem dele foi verificada olhando os quadros.

## Partículas — duas folhas, mesma ideia

| master | atlas | personagem | formas |
|---|---|---|---|
| `gu-effects-4x4-32.png` | `gu-effects-4x4-32.png` | Fang Yuan | redemoinho, corte, fumaça, rastro (32px) |
| `ice-effects-4x4-master.png` | `ice-effects-4x4-48.png` | Bai Ning Bing | geada, estilhaço, explosão, onda (48px) |

As duas folhas são publicadas como **máscara clara**: a cor sai do `visual.color`
de cada Gu em tempo real (`setParticleTint`) e, no ataque básico sem Gu, da cor de
destaque do personagem. Nenhum Gu novo e nenhuma cor nova precisam de arte extra —
a arte nunca carrega a tintura.
