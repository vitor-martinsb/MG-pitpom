# Plano de evolução: 20 famílias, 80 fases

Os arquivos originais `data/levels/level-*.level` são imutáveis. A ordem da
referência é 3, 2, 4, 1, 5…20. Cada evolução parte do arquivo da evolução anterior,
com operações determinísticas e específicas. Não há sorteio de obstáculos.

| Família / identidade original | X.1: leve | X.2: intermediária | X.3: avançada | Água nova |
|---|---|---|---|---|
| 1 — iniciação em reta | estreitamento suave e pedra de aproximação | inflexão lateral da pista | contracurva e corredor de chegada | não |
| 2 — curva em L e tabela | entrada da curva mais precisa | ápice deslocado e escolha de tabela | sequência de duas zonas de precisão | não |
| 3 — ondulações | duas lombadas um pouco mais altas | mais duas ondulações e riacho lateral | últimas ondulações elevadas e entrada deslocada | lateral em .2/.3 |
| 4 — circuito com mecanismos | portões com fases diferentes | curva final mais fechada e giro combinado | passagem sincronizada com duas janelas de movimento | não |
| 5 — loop e percurso em altura | ajuste da aproximação ao loop | corredor de saída com margem de risco | combinação da tabela de entrada e saída precisa | lateral em .2/.3 |
| 6 — pêndulos em sequência | fases alternadas | janelas e corredor progressivamente menores | ritmo irregular com chegada de precisão | não |
| 7 — riacho transversal | margens curvas e presença de água ampliada | aproximação deslocada e passagem segura mais estreita | travessia técnica combinada com a curva | .1/.2/.3 |
| 8 — rampa e retorno | preparação mais precisa da rampa | riacho na lateral da plataforma de retorno | rampa e chegada em corredor | lateral em .2/.3 |
| 9 — loop e portão na saída | portão fora de fase | ápice do retorno mais técnico | loop, tabela e janela final | não |
| 10 — curva elevada e salto | entrada da curva mais precisa | área de aterrissagem com margem de risco | combinação da curva, salto e ondulações finais | lateral em .2/.3 |
| 11 — dois loops e quatro portões | grupos de portões defasados | saída do primeiro loop mais técnica | combinação dos dois loops com janelas diferentes | não |
| 12 — salto longo e descida | área de aterrissagem bem definida | riacho junto à zona de chegada | aterrissagem e corredor final mais precisos | .2/.3 |
| 13 — S elevado e rotores | alternância dos rotores | curvas do S com ápices diferentes | corredor central e ciclo de bloqueio combinado | não |
| 14 — U com relevos e loops | margens da curva mais precisas | riacho junto ao retorno | curva, rampa e passagem final técnica | .2/.3 |
| 15 — loops opostos e rotores | rotores defasados | saídas dos loops mais estreitas | sequência dos dois loops com tabela de chegada | lateral em .3 |
| 16 — ponte basculante e salto | janela de lançamento mais definida | riacho sob a travessia e margem na chegada | combinação de tempo e precisão da aterrissagem | .2/.3 |
| 17 — mecanismos em sequência | rotores em fases alternadas | corredor de passagem e elevador combinados | janelas diferentes no elevador e nos rotores | não |
| 18 — portões e semicírculo | portões alternados | curvatura do semicírculo mais técnica | portões, tabela e chegada mais estreita | não |
| 19 — arco com defletores | defletores em ângulos diferentes | riacho na margem externa | arco mais técnico e corredor de chegada | .2/.3 |
| 20 — ilhas com pontes basculantes | ciclos das pontes defasados | áreas de aterrissagem menores | sequência de lançamentos com janelas diferentes | entre ilhas em .3 |

Os riachos reaproveitam o tipo `water`, material, direção de escoamento e regras
de recuperação do Campo 7. As novas margens devem recortar o piso, com alturas
compatíveis, mantendo uma rota segura ou uma travessia validada fisicamente.

A Família 1 é o piloto: gerar, compilar e validar as três evoluções antes de
expandir para as demais. As fases recebem IDs únicos, nome visível X/X.1/X.2/X.3,
e registros próprios de progresso; os recordes das originais são preservados.

No solo haverá escolha livre e progressão opcional. No multiplayer, o anfitrião
poderá usar originais, evoluções, todas ou seleção manual, preservando o sorteio
sem repetições. O mapa de seleção mostrará as 20 famílias.

O teste final deve comprovar conclusão real por bots, incluindo as originais
11 e 20. Não substituir esse teste por apenas carregar o mapa ou executar poucas
tacadas. Melhorias necessárias ficam no planejador, sem mudar a física global.
