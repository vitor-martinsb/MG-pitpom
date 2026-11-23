# Alfredo — embaixadinhas em 3D

Alfredo é um componente independente (`src/golf/alfredo.c` / `.h`), integrado ao
módulo de animais e à física atual. Não há um simulador de parábolas alternativo.
O eixo Y é a altura. A constante `GOLF_PHYSICS_GRAVITY` é a mesma usada pelo motor
para todas as bolas; os rebotes e o chute apenas atribuem velocidades iniciais.

A inicialização de cada campo procura uma região navegável, plana e com espaço
para o corpo e para o voo vertical. Respeita tee, buraco, animais existentes e
zonas incompatíveis. Campos atuais e futuros usam essa mesma busca; sem uma área
segura, Alfredo não ocupa um local inválido. A aproximação e o retorno validam o
segmento completo e a largura do personagem, sem atravessar paredes.

A máquina de estados é espera → aproximação → captura → deitar → embaixadinhas
→ chute → recuperação → retorno → recarga. A captura aproxima a bola às patas;
a virada move o corpo articulado inteiro, com cabeça e patas conectadas. Durante
as embaixadinhas, `capture_kind=9` bloqueia tacadas e colisões entre jogadores,
mas `captured=false` mantém a bola visível e permite seu passo físico normal.
O contato detecta a bola descendo até a altura das patas: os contatos 1, 2 e 3
aplicam impulso vertical; o contato 4 libera o controle e aplica componentes
horizontal aleatória e vertical. O contador `beats` é publicado com o estado.

O destino nominal do chute é validado no piso e no grafo navegável antes do
impulso: uma superfície sólida isolada não é considerada uma aterrissagem válida. As colisões
tridimensionais reais ainda podem mudar o voo; paredes, rampas, quicadas e
rolamento seguem o motor existente. A proteção contra recaptura dura 1,5 s.
Qualquer interrupção, desconexão ou captura incompatível devolve o controle à
física e à recuperação existentes. O retorno termina na origem e inicia uma
recarga de cinco segundos. A habilidade nunca altera `stroke_count`.

Durante o controle, a câmera do dono mantém o foco no corpo do Alfredo,
em vez de oscilar com cada rebote e ocultar o personagem atrás do minimapa.
O chute final devolve o acompanhamento normal à bola; zoom e visão dos
espectadores preservam os controles existentes.

O worker possui a autoridade no multiplayer. Os snapshots já existentes passam
posição, orientação, estado, relógio e número de contatos do Alfredo junto aos
demais animais. Os clientes interpolam sua posição e reutilizam a bola 3D da
partida. Não existe comando de clique nem nova confirmação pendente. Isso também
permite que bots atravessem a sequência automática sem uma interação especial.

`alfredo-render.inc` usa o mesmo mesh volumétrico, materiais e iluminação dos
outros animais. Mantém pelagem laranja rajada, olhos verdes e bandana vermelha
com um pequeno dinossauro. Patas reagem a cada contato, e o quarto chute enfatiza
as patas traseiras. As partículas e o rastro são discretos; não substituem a bola.

O menu adiciona `art/menu-pet-alfredo.png`, preparado a partir da referência
anexada, em RGBA transparente. A última fileira passa a ter três personagens;
somente as duas posições dessa fileira em retrato são redistribuídas para
receber Alfredo, sem remover nenhum animal. Título, controles, cenário,
decoração natalina, transição e referência independente da arte permanecem.

## Validação

- `alfredo_juggling_3d`: três ciclos reais de subida/descida, aceleração de
  gravidade, quarta batida, voo e aterrissagem, bloqueio/retorno da tacada,
  contador intacto, retorno à origem, recarga, desconexão e repouso correto
  com 50 vagas parcialmente vazias.
- `alfredo_placement_*`: busca segura nos 80 campos, sem editar fases.
- `server/test/alfredo.test.ts`: uma tacada real aciona a habilidade nos modos
  simultâneo e por turnos, com snapshots iguais, placar intacto e próxima jogada.
- `server/test/alfredo.mjs`: dois clientes nativos, desktop e celular, verificam
  os três ápices, o quarto chute, renderização e desbloqueio; capturas em
  `out/alfredo`. Incluído no CI junto às regressões dos outros animais.
