# Câmera, rodadas e fluidez

## Componentes e decisões

- `src/golf/game.[ch]` e `course.c`: distância local da câmera entre 0,65 e 2,25 vezes a distância padrão, preservando foco na bola, orientação e introduções dos campos. A visão usa as BVHs existentes para evitar atravessar a geometria. Zoom não altera a simulação ou a rede.
- `build/emscripten/gameplay.js`, `course.js` e `multiplayer.css`: botões de zoom, restauração, roda do mouse e indicação da vez. Os botões têm área mínima de 44 px, respeitam áreas seguras e ficam ocultos fora da partida. O botão central restaura a distância padrão.
- `server/src/room.ts`, `index.ts`, `multiplayer.js` e `src/golf/online.c`: opção de ordem das jogadas na aba Modo do lobby existente. Simultâneo permanece o padrão. Por turnos é independente de Clássico/Colisão e reutiliza a mesma física, proteção da primeira tacada, bots, pontuação e DNF +12.
- `src/golf/wildlife.[ch]` e `mechanics.c`: trajetos dos companheiros que já caminhavam preferem corredores de até 3,2 m; podem receber uma pequena curva em S validada com folga. A frequência de patrulha aumenta e as paradas nas pontas diminuem. A travessia do gato também pode ampliar-se até onde o piso e os demais bichinhos permitem. O cão parado não ganha deslocamento. Pontos reais de animação mantêm a verificação de piso; em uma borda problemática, usa-se o corredor reto validado ou interrompe-se o avanço.
- `src/golf/physics.c`: em faces de apoio inclinadas, resistência ao rolamento substitui o atrito excessivo que cancelava pequenas velocidades de descida. O repouso não interrompe uma descida cuja componente de gravidade supera a resistência; superfícies quase planas ainda podem parar. O cache de repouso fica reservado a apoio quase horizontal. Atrito de paredes, água, colisões entre bolas e valores de superfícies planas permanecem no caminho existente.

## Rodadas e desconexões

O servidor publica `playStyle`, `turn` e `turnOrder` nos estados e snapshots existentes. Apenas a identidade autorizada pode tacar. A trava também cobre o intervalo assíncrono de aceitação para impedir duas tacadas concorrentes. A vez passa depois de receber a contagem autoritativa da tacada e de a bola terminar movimento e eventual captura/resgate. Jogadores que concluíram, desconectados e bots no limite existente de tacadas são ignorados.

Uma desconexão libera a vez imediatamente: o worker não simula bolas de jogadores desconectados, portanto aguardar essa bola parar bloquearia a sala. Reconexão conserva a identidade e a sequência de tacadas; o jogador retorna à ordem disponível, sem tomar a vez atual. O próximo campo reinicia a ordem. O relógio global, a tolerância de conclusão, as regras de limite de tacadas e a penalidade existente não são substituídos por outro sistema.

## Tutorial

O botão Tutorial fica abaixo de Multijogador. Um diálogo com seis etapas explica mira/força, câmera/zoom, obstáculos/bichinhos, pontuação, simultâneo/turnos e conclusão/DNF. Há ajuste de força por arrasto e teclado, uma demonstração ilustrada e zoom da ilustração. A demonstração nunca cria uma partida nem altera pontuações, e não implementa outra física de jogo. É possível avançar, voltar e sair por botão ou Escape a qualquer momento. O diálogo contém o foco; o teclado não aciona o jogo ao fundo. Todo o texto usa o catálogo existente em português, inglês e espanhol.

## Validação

- Testes nativos de rampas em 5°, 15°, 25° e 35°, nos dois sentidos, com início parado e velocidade pequena, faces duplicadas e repouso em piso plano/quase plano.
- Suíte nativa completa: captura, colisões, efeitos individuais, trilha da Juju, trajetos reais e amostras dos companheiros, orçamento de simulação e todos os campos do catálogo.
- `server/test/turns.test.ts`: autoridade, tacada concorrente, rotação após repouso, sincronização, desconexão/reconexão, jogadores finalizados, ambos os modos físicos e bots.
- `server/test/gameplay-improvements.mjs`: tutorial em quatro resoluções, navegação por teclado, zoom nativo com limites/restauração/roda/botões e dois clientes com bloqueio nativo por turno. O CI executa em Chromium e WebKit, junto às regressões existentes.
- Regressões do menu preservam a exigência de carregamento simultâneo de todos os botões, agora incluindo Tutorial. A lista de mapas e os hashes dos recursos originais permanecem protegidos. Somente os hashes dos pontos de integração de gameplay intencionalmente alterados são atualizados na baseline revisada.
