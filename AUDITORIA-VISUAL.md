# Auditoria visual e funcional — Qing Mao

Revisão realizada em navegador Chromium headless com renderização WebGL e simulação de toque. Telas verificadas: **320 × 568**, **375 × 667**, **390 × 844**, **568 × 320**, **844 × 390**, **768 × 1024** e **1365 × 768**. Foram conferidos mapa/personagem, HUD, inventário, avanço, recorte dos quatro ícones, Mar Primordial, quatro slots, estados de equipagem, alvo manual/automático e ações de combate.

## Problemas reproduzidos e corrigidos

1. **Sobreposição do título do mapa:** em 320 px, o título encostava no botão Menu; em paisagem, invadia o HUD. O título agora ocupa uma faixa própria e se adapta aos dois tamanhos.
2. **Inventário bloqueado logo no início:** o raio de detecção de teste (170 px) fazia inimigos próximos dispararem o bloqueio de equipagem antes de o jogador se mover. Ajustado para 96 px; ao se aproximar, o bloqueio continua funcionando. Adicionado teste de regressão para a condição inicial e a entrada em combate.
3. **Gu fora da primeira tela em 320 px:** textos e retrato consumiam a altura disponível, deixando os quatro ícones abaixo do limite visível. A ficha foi compactada apenas nesse tamanho, os ícones agora aparecem juntos e o aviso narrativo foi movido para depois deles. As áreas de toque dos botões foram preservadas.
4. **Alvo automático ocupava espaço demais no HUD estreito:** o texto foi abreviado em telas de até 600 px, mantendo nome acessível completo e estado `aria-pressed`.
5. **Aviso de recompensa sobrescrito pelo nome do golpe:** a mensagem do ataque agora é publicada antes dos eventos; recompensas e morte têm prioridade no feedback.

## Verificações finais

- A ficha abre, alterna abas e permite equipar Stone Skin e Whirlwind antes do combate; o botão de dash passa a aparecer no HUD. Durante combate, a troca fica bloqueada.
- O toque em inimigo seleciona o alvo; ataque fora de alcance informa o motivo; alvo automático alterna corretamente; Moonlight consome essência primordial. O Mar Primordial aparece **somente** na aba Avanço e representa a mesma reserva de essência.
- Inventário e avanço rolam verticalmente sem transbordamento horizontal nas dimensões testadas. Os quatro ícones mostram os quadrantes corretos; os quatro slots e a Cigarra intrínseca aparecem após rolagem.
- Não houve exceções de página, erros no console nem respostas HTTP com falha nos cenários automatizados. **53/53 testes**, `npm run build` e `git diff --check` passaram.

## Atualização posterior: paisagem e tela cheia

O jogo agora prioriza paisagem no celular: em retrato, há um aviso para girar o aparelho. Um botão compacto ao lado do Menu alterna tela cheia quando permitida pelo navegador e tenta travar a orientação; há mensagem de fallback quando isso não for possível. Em paisagem estreita, o HUD foi deslocado/compactado para não encobrir Fang Yuan. A alternância de tela cheia, o menu e o layout foram conferidos em navegador simulado nas larguras de 568, 667 e 844 px. As capturas de retrato do primeiro levantamento referem-se ao layout anterior a esta atualização.

## Checagem final pré-merge

- Uma instalação limpa com `npm ci` passou em **53/53 testes**, build, `git diff --check` e preview HTTP 200. `npm audit` reportou **0 vulnerabilidades** nas dependências declaradas.
- Removido metadado de Gu sem consumidores; o compilador com `noUnusedLocals` e `noUnusedParameters` não aponta imports, variáveis locais ou parâmetros sem uso. Os assets de `public/` estão referenciados pelo jogo. A remoção dos arquivos do protótipo antigo é intencional.
- Corrigido o retry de drop pendente: falha de armazenamento não provoca nova tentativa a cada frame. Verificado no navegador com armazenamento indisponível e posterior recuperação: tentativas espaçadas por 2 s e recompensa contabilizada uma única vez (8 pedras e 1 material).
- A área informativa do HUD agora captura o toque: clique testado em paisagem não dispara `pointerdown` no canvas. Bônus temporário de velocidade não persiste após morte/retorno. Alternância de tela cheia, menu e equipagem foram exercitados sem erro de página.

**Limites da auditoria:** as telas foram renderizadas em navegador headless/simulação de toque, não em aparelho físico. O analisador opcional Knip não concluiu por limite de memória do ambiente; a revisão de código sem uso foi feita com o TypeScript e busca manual de referências. O jogo ainda usa marcadores geométricos para inimigos porque não há sprite de inimigo no pack; valores de combate e Gu de teste permanecem provisórios conforme o GDD.
