# Matrizes das artes enviadas

Este diretório guarda **sem alteração** os quatro PNGs-mestre 1920×1920 e os
JSONs fornecidos pelo usuário. Os caminhos absolutos dentro dos JSONs são do
ambiente de criação original; o jogo carrega os atlas publicados em `public/`.

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
