# Mecânicas do PitPom Minigolfe

## Física e personagens

`src/golf/mechanics.c` é compartilhado pelo jogo solo e pelo worker C do
servidor. Os mapas, modelos originais, materiais de colisão e detecção do
buraco continuam usando a geometria existente. As mascotes ocupam regiões
seguras da pista, encontradas uma vez ao carregar cada mapa por amostragem
das superfícies jogáveis e consultas ao BVH. Não há uma barreira sólida que
feche a passagem da Pompom.

- **Pompom**: gata laranja e branca, olhos verdes, orelhas triangulares,
  peito e patas brancos e rabo curvo. Atravessa lateralmente a pista com
  desaceleração nas extremidades e animação de caminhada. Um contato aplica
  um tapa com velocidade de 7,5 unidades/s na direção principal do percurso
  ou no sentido contrário. Cooldown de 2,8 s por bola, com saída obrigatória
  da região antes de um novo contato. A seleção é pseudoaleatória, usando
  uma semente da sala, identidade do jogador e número da interação.
- **Pituca**: cachorra de pelo curto, corpo branco com manchas pretas,
  cabeça preta, faixa branca, focinho branco, olhos castanhos, orelhas caídas
  e **sem rabo**. Respira deitada, levanta, abre a boca e captura a bola.
  Cada bola mantém seu próprio estado: começa a desaparecer após 0,35 s,
  retorna após 1,1 s ao ponto anterior à última tacada e recebe cooldown
  de 3 s. Posição, velocidade, rotação e estado de água/limites são
  restaurados sem remover a tacada. Novas tacadas ficam bloqueadas durante
  a captura. Cinquenta capturas simultâneas não usam uma fila global.

Os modelos são **geometria procedural final de baixa complexidade**, feita
com volumes, manchas, olhos, patas e movimentos articulados no renderizador
Sokol existente. Não dependem de um asset 3D externo nem de outro motor.
Essa escolha resulta em personagens estilizados com superfícies facetadas,
sem pelagem simulada ou animações esqueléticas importadas. As pequenas placas
com retratos das mascotes continuam no jardim.

## Multiplayer

O anfitrião escolhe **Clássico** ou **Impacto** no lobby. A opção enviada
em `start.mode` é validada pelo servidor e permanece fixa na partida.
Clássico mantém as bolas independentes. Em Impacto, cada cliente oculta as
outras bolas, seus rótulos, sombras e marcadores no minimapa até terminar
sua primeira tacada. A autoridade permite colisão somente quando **ambos**
os jogadores já terminaram essa primeira tacada no mapa.

As colisões usam massas unitárias iguais, restituição 0,72, quatro passagens
de separação e limite de velocidade de 12 unidades/s. Não alteram a contagem
de tacadas nem a identidade das bolas. Buracos, água, bolas capturadas e
jogadores desconectados são excluídos. O cálculo segue a ordem fixa dos slots
a 120 Hz no worker C. Os clientes recebem posições e velocidades calculadas
pelo servidor, além de `firstComplete`, `captured`, `captureUntil` e estado das
mascotes. Reconexões recebem o mesmo estado autoritativo.

A probabilidade inicial de tapa para frente é **50%**. Configure
`catForwardProbability` em `server/config.json` ou
`GOLF_CAT_FORWARD_PROBABILITY` no ambiente, entre 0 e 1. No solo, os
parâmetros iniciais ficam em `golf_mechanics_init`.

## Câmera, minimapa e bandeira

A apresentação dura 7,5 s: buraco, elevação, visão completa, sobrevoo até o
início, aproximação e câmera original da bola. Interpolação suave e altura
ajustada aos limites e proporção da tela preservam o enquadramento no
celular. O botão **Pular apresentação** libera somente a apresentação local.
O cliente confirma prontidão após terminar ou pular; o servidor inicia a
rodada quando todos os clientes conectados confirmam ou quando vence o limite
de carregamento. Um cliente que não confirmou continua impedido de jogar.
O servidor reserva mais 8 s para a apresentação além do prazo configurado
para carregar os assets (18 s no total com a configuração padrão).
Desconexões e clientes sem resposta não bloqueiam a partida indefinidamente.

O minimapa projeta as superfícies reais, bordas, água e obstáculos em uma
imagem armazenada por mapa. Somente bolas, mascotes e limites dos obstáculos
móveis são redesenhados, a 10 Hz. Inclui a direção do percurso, bandeira,
cores dos jogadores e um botão para recolher no celular. Novos controles,
modo de jogo e legendas estão em inglês, português brasileiro e espanhol.

A bandeira usa 12 faixas de tecido com ondulação senoidal, vento na mesma
direção e pequena variação da intensidade. O mastro é estável e o modelo
original de colisão do buraco não muda. Mascotes e bandeira compartilham um
buffer de até 8.192 vértices e uma chamada adicional de renderização; não há
simulação de tecido nem tráfego de rede para o vento ou a câmera.

## Arquivos da implementação

Criados: `src/golf/mechanics.c`, `src/golf/mechanics.h`, `src/golf/course.c`,
`build/emscripten/course.js`, `server/native/mechanics_test.c`,
`server/test/mechanics.test.ts`, `server/test/course-features.mjs`,
`tests/fixtures/gameplay-mechanics-baseline.json` e este documento.

Modificados:

- Motor: `src/golf/player.h`, `physics.c`, `game.c`, `game.h`, `online.c`,
  `draw.c`, `ui.c`, `garden.c`, `garden.h` e `src/golf/CMakeLists.txt`.
- Servidor: `server/native/worker.c`, `server/native/CMakeLists.txt`,
  `server/src/physics.ts`, `room.ts`, `index.ts` e `server/config.json`.
- Navegador: `build/emscripten/multiplayer.html`, `multiplayer.js`,
  `multiplayer.css` e `data/locales.json`.
- Compilação/publicação: `CMakeLists.txt`, `Dockerfile`,
  `.github/workflows/validate.yml`, `build/verify-gameplay-assets.py` e `README.md`.

## Validação

- Testes C de captura do buraco em todos os 20 mapas.
- Testes C das duas direções do tapa, movimento lateral, contato único,
  colocação segura, 50 capturas simultâneas, retorno e proteção da primeira
  tacada, separação e limites de velocidade/tacadas.
- Testes Node de protocolo, limite de sala, seleção de modo pelo anfitrião,
  barreira de prontidão, desconexão, snapshots e repetibilidade de 50 bolas.
- Navegador real: apresentação completa e skip em dois clientes, prontidão
  compartilhada, visibilidade independente, minimapa, mascotes, ondulação
  usada pelo tecido, recolhimento no celular e tradução.
- Regressões: três idiomas, solo, chat/música, mouse/toque, nickname,
  reconexão, cinco setas e renderização dos 20 mapas.
- GitHub Actions recompila o contêiner Linux e executa os testes nativos,
  protocolo, HTTP/WebSocket, shaders e fluxo das novas funcionalidades.

`gameplay-mechanics-baseline.json` documenta as alterações intencionais em
cinco arquivos de regras/rede. O manifesto anterior conserva os hashes
originais de todos os mapas e modelos, sem liberar alterações nessa geometria.

As verificações de celular usam emulação de toque no Chromium; testes em
aparelhos físicos iOS/Android e o estado **Live** do Render ainda dependem
do ambiente externo. A colocação das mascotes é automática; uma futura edição
artística dos mapas pode escolher manualmente regiões de interação.
