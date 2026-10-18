# Fang-Yuan

Projeto de RPG inspirado em *Reverend Insanity* (*Gu Zhen Ren*).

## Documento principal

O Game Design Document (GDD) é a fonte de verdade para as decisões de design:

- [Abrir o GDD](docs/GDD.md)

Antes de implementar sistemas ou propor mudanças, agentes de IA devem ler o GDD e respeitar as decisões marcadas como **Definido**. As decisões **A definir** devem continuar abertas até serem aprovadas.

Jogo 2D feito com **Phaser 4**, **TypeScript** e **Vite**.

## Requisitos

- Node.js 22 (ver `.nvmrc`); mínimo `20.19` ou `22.12`
- npm

## Começando

```bash
npm install      # instala as dependências (phaser, vite, typescript)
npm run dev      # servidor de desenvolvimento em http://localhost:5173
```

Outros comandos:

| Comando             | O que faz                                              |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Sobe o Vite com hot reload                             |
| `npm run typecheck` | Verifica tipos com `tsc --noEmit`                      |
| `npm run build`     | Checa tipos e gera o build de produção em `dist/`      |
| `npm run preview`   | Serve o build de `dist/` localmente (porta 4173)       |

## Estrutura

```
.
├── index.html            # Página que hospeda o canvas do Phaser
├── vite.config.ts        # Configuração do Vite (servidor/preview)
├── tsconfig.json         # Configuração do TypeScript
├── public/               # Arquivos estáticos copiados como estão (ex.: public/assets/)
└── src/
    ├── main.ts           # Cria o Phaser.Game e registra as cenas
    ├── config/
    │   └── gameConfig.ts # Constantes globais (resolução, cores)
    └── scenes/
        ├── BootScene.ts  # Carregamento de assets e tela de loading
        └── GameScene.ts  # Cena principal (por enquanto, um protótipo com setas)
```

### Como adicionar uma nova cena

1. Crie `src/scenes/MinhaCena.ts` estendendo `Phaser.Scene` com uma `key` única.
2. Registre-a no array `scene` em `src/main.ts`.
3. Troque de cena com `this.scene.start('MinhaCena')`.

### Assets

Os assets do projeto estão em `public/assets/` (personagem, HUD e três tilesets). Veja `public/assets/README.md` para a organização, o status das licenças e como carregá-los no `preload()` da cena:

```ts
this.load.image('grass', 'assets/tilesets/free-asset-pack/1. Grass and dirt.png');
```

## Controles

- **Computador:** setas ou WASD para mover; `J` ataque básico, `K` habilidade ativa, `Shift` dash.
- **Celular/tablet:** joystick flutuante no lado esquerdo (a base aparece onde você tocou). No lado direito: **ATK** (ataque básico, o maior botão), **DASH** e **HAB** (habilidade ativa), todos redondos e próximos ao polegar. Em celular na vertical, a tela pede para girar o aparelho.
- A habilidade ativa é o corte em meia-lua do **Moonlight Gu**, na direção em que o personagem está virado, com cooldown provisório de 4 s. Por enquanto é só visual: dano e hitbox entram com os inimigos.

## Notas

- A resolução base é 1280×720, com escala `FIT` centralizada (ver `src/config/gameConfig.ts` e `src/main.ts`).
- O `vite.config.ts` libera o host do preview e faz bind em `0.0.0.0`, para funcionar em ambientes de preview/contêiner.

## Ferramentas de agente (SpriteShip)

A pasta `scripts/` e o arquivo `setup_spriteship_079.py` são o instalador de skills do SpriteShip 0.7.9 para agentes de código. Eles não fazem parte do jogo e não são usados pelo build.

## Mapa

A cena principal é a **Vila Inicial da Montanha** (`src/world/village/villageMap.ts`): um platô gramado com falésia ao sul, casas e objetos em volta de uma praça, canteiro a oeste, lago ao sudeste e floresta densa em volta. Trilhas levam à montanha (norte), ao lago (sul e leste) e à orla oeste.

- Os dados do mapa são código TypeScript (sem Phaser), e o próprio `buildVillageMap()` valida o layout (sem colisão sobre água ou falésia e sem sólidos sobrepostos).
- Os recortes dos packs vêm de `scripts/build-village-assets.py`. Ver `public/assets/README.md`.
