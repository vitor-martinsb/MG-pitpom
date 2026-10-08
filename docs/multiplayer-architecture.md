# PitPom Minigolfe multiplayer

O cliente Web mantém o jogo 3D em C/Sokol/WebAssembly, os mapas, os materiais,
os shaders e a mira existentes. O servidor Node.js/TypeScript usa WebSocket e
executa a física C compartilhada em um processo sem gráficos por sala/mapa.
O executável desktop continua oferecendo o single-player e as fixtures de debug.

## Executar com cinco jogadores

Na raiz do projeto, com os builds desta máquina já gerados:

```bat
python build/multiplayer.py start
```

Também é possível abrir `build/run-multiplayer.cmd` no Windows. Manter o
terminal aberto e acessar **http://localhost:3000** em cinco abas ou navegadores.

1. Escolher nickname ASCII, cor e avatar; no primeiro cliente, clicar **Criar sala**.
2. Copiar o código de cinco caracteres exibido no lobby.
3. Nos outros quatro clientes, escolher nicknames próprios, informar o código
   e clicar **Entrar**. Cada cliente controla sua própria bola.
4. O anfitrião escolhe 3, 6, 9 ou 18 mapas e clica **Iniciar partida**.
5. Clicar no círculo da bola para mirar; mover o mouse e clicar para tacar.
   Arrastar fora desse círculo gira a câmera. **Tab** abre o placar completo.

Todos começam no mesmo spawn e podem tacar simultaneamente. As bolas podem
coincidir ou atravessar umas às outras. Após concluir, o seletor de espectador
permite acompanhar outra bola. **Sair** retorna à conexão; **Jogar sozinho**
abre o fluxo offline existente.

Recarregar a mesma aba recupera o jogador por até 60 segundos. Uma aba duplicada
pode copiar seu `sessionStorage`; para criar outro jogador, abrir o endereço
diretamente em uma nova aba, sem duplicar a aba conectada. O token não pode
substituir uma conexão ainda ativa.

O servidor escuta na porta 3000; a variável `PORT` pode alterá-la. Para acesso
por outros computadores, servir a aplicação por HTTPS com um proxy que encaminhe
também `/ws` e preserve os headers COOP/COEP. O cliente usa pthreads e exige um
contexto seguro para `SharedArrayBuffer`; `localhost` funciona diretamente.
As salas ficam em memória e são encerradas quando o servidor é reiniciado.

## Compilar

Requisitos: Python 3, CMake, Ninja, compilador C/C++, Node.js 22 ou superior e
Emscripten SDK ativado (`EMSDK`). O script também encontra as toolchains
portáteis já presentes em `out/toolchain` nesta máquina.

```sh
python build/multiplayer.py build
python build/multiplayer.py start
```

O build gera `out/server-native/golf_physics_worker[.exe]`, `out/web/golf.html`,
WebAssembly e recursos do lobby, além de `server/dist`. Em geradores com
múltiplas configurações, o worker pode estar em `out/server-native/Release`.
`server/src/physics.ts` procura ambas as localizações. Os assets são empacotados
deterministicamente e o WebAssembly também recebe uma versão gzip para HTTP.

Os builds desktop continuam usando os scripts Windows/Linux existentes.
Nesta máquina, o build Windows verificado está em
`out/stage1-build/golf-online.exe`; o nome evita sobrescrever um `golf.exe`
que estava aberto durante a validação.

## Arquitetura implementada

```text
Browser: C + Sokol + WebAssembly
  mira/câmera/UI locais -> intenção de tacada via WebSocket
  snapshots -> interpolação -> players[50] -> bolas e nicknames
                            |
Node.js + TypeScript + ws    |
  salas/host/ready/relógio/scores/reconexão/validações
                            |
Processo C por sala e mapa, sem GPU ou áudio
  mapas e geometria originais -> mundo/BVH uma vez por tick
  física independente de cada bola, a 120 Hz
```

| Responsabilidade | Arquivos |
| --- | --- |
| Identidade, cor, bola, tacadas e reset | `src/golf/player.h`, `player.c` |
| Colisão original, água, atrito, tacada e funil | `src/golf/physics.h`, `physics.c` |
| Mundo, geometria, transformações e BVH | `src/common/level.c`, `bvh.c` |
| Loader sem gráficos e worker de física | `server/native/headless.c`, `worker.c` |
| Salas, fases, relógio, score e reconexão | `server/src/room.ts` |
| HTTP, WebSocket e limites de conexão | `server/src/index.ts` |
| IPC com a física C | `server/src/physics.ts` |
| Ponte de snapshots e estado do jogo | `src/golf/online.c`, `game.c`, `golf.c` |
| Lobby, HUD, placar e espectador | `build/emscripten/multiplayer.*` |
| Passes de bola/água e labels | `draw.c`, `ui.c`, `player_labels.c`, `common/projection.c` |

O núcleo C usa o mesmo solver esfera/triângulo e a mesma curva de potência do
single-player. O servidor carrega entidades, materiais, OBJ e geometria salvos
sem inicializar lightmaps, GPU ou áudio. Atualiza o BVH dinâmico uma vez por
tick compartilhado; todas as bolas conectadas ainda participam da atualização,
incluindo bolas paradas diante de obstáculos móveis. Não há colisão bola/bola.

No modo online, o cliente não calcula resultados físicos ou recordes. Envia
direção horizontal e potência; recebe posição, velocidade, movimento, água,
conclusão e tacadas oficiais. Interpola o desenho e mantém câmera, mira, áudio e
ripples locais. Deltas vazios preservam a posição final da interpolação.

## Regras e protocolo

- Salas têm código de cinco caracteres, anfitrião e até 50 identidades.
  Nicknames ASCII têm de 1 a 24 caracteres; cores usam `#RRGGBB` e há oito avatares.
- Fases: `lobby -> loading -> playing -> settling -> results -> loading/finished`.
  O relógio começa quando o servidor e todos os clientes conectados estão
  prontos, ou após 10 segundos de espera pelos clientes.
- Cada mapa dura 120 segundos. O deadline bloqueia novas tacadas; bolas em
  movimento recebem até cinco segundos adicionais. Todos os conectados
  concluídos antecipam o resultado. A pausa de um cliente não pausa a sala.
- DNF recebe 12 pontos, configuráveis, sem limitar o número de tacadas.
  Jogadores desconectados e ainda não concluídos também recebem DNF.
  Resultados ficam visíveis por cinco segundos. Menor soma vence.
- Reconexão usa token aleatório, preservando ID, perfil, bola, tacadas,
  sequência de comandos e resultados. O estado fica retido por 60 segundos.
  O anfitrião passa para outro conectado quando sai.
- Snapshots são enviados a 15 Hz, com deltas e um snapshot completo a cada
  dois segundos. Nickname/cor/avatar/score pertencem ao roster, sem repetição
  nos snapshots de bola. `ready` e reconexão recebem snapshot completo.
- Comandos: `create`, `join`, `reconnect`, `start`, `ready`, `shot`, `ping`.
  Respostas: `welcome`, `room`, `load`, `snapshot`, `shot`, `error`, `pong`.
- Tacadas exigem fase ativa, conexão, ready do mapa, bola parada e não concluída,
  prazo válido, sequência crescente, direção finita horizontal e potência `[0,1]`.
  A física revalida o estado antes de aplicar a tacada.
- Payload máximo: 2 KiB; até 30 mensagens/s por conexão; mensagens binárias,
  JSON inválido e origens incompatíveis são rejeitados. Heartbeat remove
  conexões mortas; clientes com fila de envio acima de 1 MiB são desconectados.

Tempos, DNF e frequência ficam em `server/config.json`. `GOLF_HOLE_SECONDS` e
`GOLF_GRACE_SECONDS` permitem reduzir tempos em testes. O funil fica em
`data/config/game.cfg`: raio 0.65, força 0.12, captura 0.18 e velocidade máxima 2.
A atração gradual leva a bola ao centro e à descida; não teleporta a posição.
Os mapas seguem a ordem já definida em `game.cfg`.

## Renderização e debug local

Passes normal, oculto, buraco e água desenham jogadores conectados, compartilhando
modelos, texturas e pipelines. O uniform da bola recebe a cor individual. Sombra
do ambiente e destaque através de obstáculos permanecem vinculados à bola local;
as demais bolas ocultas usam menor opacidade.

Labels usam `draw_pos + (0, player_label_height, 0)`, fonte existente, texto
branco, sombra e indicador de cor. A local recebe `VOCE` e prioridade. As remotas
são ordenadas por distância/ID e tentam deslocamentos verticais limitados;
labels sem espaço são ocultadas. Buffers têm limite de 50, sem alocação por label
a cada frame. Projeção rejeita NaN, pontos atrás da câmera e fora do clipping.
A câmera é atualizada antes da UI no mesmo frame. `player_labels_enabled` e
`player_label_height` permitem configurar a exibição.

O modo **Cinco jogadores de teste** continua na aba **Game** do console de debug
durante o single-player. Acrescenta quatro fixtures vermelha/azul/verde/amarela,
com editores de posição e flags de água/buraco. Não executa física remota.
Retry/próximo mapa reinicializam as fixtures; sair ao menu encerra esse modo.
Os controles ficam indisponíveis durante uma sala online.

## Verificação

```sh
cmake -S tests -B out/player-tests
cmake --build out/player-tests
ctest --test-dir out/player-tests --output-on-failure
python build/multiplayer.py test
```

Após compilar o cliente, o teste de navegador usa Chrome instalado, ou o
executável indicado por `CHROME_PATH`:

```sh
cd server
npm run test:browser
npm run load-test -- --players 50 --seconds 5
```

Passaram nesta máquina: dois testes de ciclo de vida/projeção/layout, o teste
C do funil e seis testes Node de física/regras/protocolo. O navegador passou
com cinco clientes WebGL: ready, tacada pela mira, cores, placar, resize e
reconexão. Também passou com um cliente WebGL mais 49 clientes WebSocket,
confirmando 50 bolas, labels coincidentes e o placar de 50 linhas. Capturas
ficam em `out/multiplayer-validation`. Após sair da sala, o teste também
passou por seleção de nível, mira/tacada, pausa, retry, resume e saída offline.

O teste de carga envia ready e tacadas quando cada bola está parada até encerrar
três mapas; pode usar `--url ws://host/ws` contra um servidor existente.
Uma execução local de 50 bots, com cinco segundos por mapa mais grace/resultados,
concluiu os três mapas em 46.64 s com 243 tacadas aceitas. Mediu CPU combinada
Node/bots/física de 2.85%, RSS do Node de 106.29 MiB, pico RSS do worker de
6.0 MiB e RTT P95 de 2.35 ms. Tráfego agregado dos 50 clientes: 2.47 MiB/s.
Esses valores descrevem localhost e esse cenário curto; não são previsão de
desempenho para hospedagem ou redes externas.

Testes cobrem os 20 mapas, 50 trajetórias independentes, limite de sala, host,
ready/timeout, comandos repetidos, bolas em movimento, deadline, grace, DNF,
transições e reconexão. O teste WebSocket real cobre origem, payload, binário,
JSON e rate limit. Projeção/layout cobrem câmera, viewport e prioridade local.

Windows, Web/Emscripten e TypeScript foram compilados neste ambiente.
Linux, Android e iOS não foram executados aqui. A verificação automatizada
não substitui a revisão manual completa de todos os mapas, água, obstáculos
móveis e fluxos offline de pausa/retry/recordes.
