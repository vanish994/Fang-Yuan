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

## Fang Yuan — quatro poses

| master | pose | uso no jogo |
|---|---|---|
| `fang-yuan-walk-4dir-4frames-master.png` | caminhada | locomoção |
| `fang-yuan-cast-4dir-4frames-master.png` | conjuração | ativar Gu de ataque/apoio/item |
| `fang-yuan-dash-4dir-4frames-master.png` | arremetida | Gu de movimento |
| `fang-yuan-down-4dir-4frames-master.png` | queda | morte do herói, travada até o respawn |

Todas são grades 4×4 de 480px (linhas `down`, `left`, `up`, `right`) e são
escaladas por **um único fator** (o maior quadro entre as quatro), então o corpo
não muda de tamanho ao trocar de animação. Detalhes em `fang-yuan-poses.json`.

## Partículas de Gu

`gu-effects-4x4-32.png` traz quatro formas (redemoinho, corte, fumaça e rastro)
em quatro quadros de 32px. O jogo publica uma **máscara clara** dessa folha: a cor
sai do `visual.color` de cada Gu em tempo real (`setParticleTint`), então nenhum
Gu novo precisa de arte de efeito própria.
