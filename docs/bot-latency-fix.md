# Correção da demora entre tacadas dos bots

O reteste anterior (`4c390ae`) encontrou espera mediana de 27,78 s com 30 bots,
máxima de 76,42 s e nenhum bot terminando o mapa complexo em dois minutos.
Veja [o diagnóstico original](bot-latency-retest.md).

## Alterações

- O servidor consulta um índice espacial dos triângulos estáticos. A lista de
  contatos mantém a ordem original, inclusive com buffers limitados; raios
  preservam o primeiro triângulo nos empates. Os cálculos exatos de contato e
  resposta física continuam os mesmos. A varredura completa continua disponível
  por `GOLF_BVH_FULL_FACES=1` e como fallback em consultas muito densas.
- O orçamento inicial no perfil restrito passa de 20 para 4 ms de CPU. Saltos
  e recuperações reservam uma busca adicional limitada. A busca não encerra
  antecipadamente com uma tacada sem progresso apenas por atingir 12 opções.
- O carregamento prepara sugestões de rota usando o planejador e o simulador
  existentes, somente em cópias no processo auxiliar. O cache retém até 128
  propostas e avalia até três sugestões próximas. Toda sugestão é novamente
  simulada com a bola, horário, vento, animais, efeitos e histórico reais.
- A sala empresta CPU ociosa ao planejador, descontando o custo medido da física
  e reservando 20% da quota para Node/rede. Tacadas humanas em movimento mantêm
  o perfil conservador. O worker auxiliar valida a parcela por pedido e não a
  transfere ao worker autoritativo nem ao pedido seguinte.

Continuam existindo um planejador por sala, o rodízio entre bots, o relógio real
da rodada, o limite de 48 tacadas e a aceleração de espectador condicionada à
folga de CPU. Não foram alterados mapas, materiais, forças, pontuação ou
trajetórias por teleporte. As dificuldades mantêm seus erros próprios.

## Resultado comparável: 30 bots médios em mapa complexo

Mapa `data/campaign/family-04-3.level`, semente 12345, um humano conectado sem
jogar, simulação 1x, rodada de 120 s e encerramento de 5 s. Mesma máquina local,
sem outros testes pesados concorrentes. Perfil configurado para 0,1 CPU;
o computador não foi submetido à quota real de um cgroup do Render.

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Espera mediana com a bola parada | 27,78 s | 2,67 s |
| Espera P95 concluída | 73,33 s | 12,14 s |
| Maior espera concluída | 76,42 s | 16,00 s |
| Tacadas aceitas | 67 | 549 |
| Bots que concluíram | 0/30 | 15/30 |
| Intervalo P95 entre snapshots | 67,02 ms | 67,00 ms |
| Falhas do planejador | 0 | 0 |

A mediana caiu aproximadamente 90%. O perfil mantém a mesma quota configurada,
mas agora usa sua capacidade ociosa; o ganho inclui esse ajuste. O teste não
promete que todos os bots vencerão todo mapa dentro do tempo da rodada. Os
percentis consideram esperas que terminaram em tacadas; esperas ainda em curso
ficam separadas nos JSONs por jogador.

Dados brutos locais: `out/bot-latency-before/` e `out/bot-latency-complex/`.
O benchmark não usa um navegador real nem mede RTT WebSocket, FPS ou a quota
física do serviço publicado. O host do teste usa um coletor local de mensagens.

No mapa inicial `data/levels/level-3.level`, os 30 bots médios concluíram em
39,96 s reais, com 189 tacadas aceitas e nenhuma falha do planejador. A espera
mediana foi 1,69 s e a máxima concluída 5,84 s. A observação terminou quando
todos os bots chegaram ao buraco; o host ainda estava conectado e a simulação
continuou em 1x. Esses dados estão em `out/bot-latency-initial/`.

## Validações reproduzíveis

```sh
cmake -S server/native -B out/server-native -DCMAKE_BUILD_TYPE=Release
cmake --build out/server-native
ctest --test-dir out/server-native -R 'budget_family|ordered_face_acceleration' --output-on-failure
cd server
node --import tsx --test test/bot-performance.test.ts test/thirty-bots.test.ts test/bots-update.test.ts
node --import tsx test/bot-latency.mts --bots 30
node --import tsx test/bot-latency.mts --bots 30 --level data/levels/level-3.level
```

As 20 regressões incluem preservação exata das trajetórias de 31 bolas contra
a referência completa, planejamento isolado, tacadas humanas e snapshots durante
uma decisão pendente, preparação sem mover bolas/animais/relógio e validação da
parcela de CPU. Os cinco testes nativos focados incluem os quatro mapas de
orçamento restrito e consultas com mais de 256 candidatos, ordem de contatos,
buffers limitados e empates de raios. Os limites de conclusão dos mapas foram
preservados nos testes; não foram aumentados para fazer a busca reduzida passar.

A suíte local completa terminou com **208/208 testes nativos** e **55/55 testes
do servidor** aprovados, além da compilação TypeScript. As 20 regressões e os
cinco testes focados acima fazem parte desses totais.

O manifesto mantém os hashes de todos os mapas/modelos e da física da bola.
Somente as entradas já revisáveis de `worker.c` e `room.ts` foram atualizadas
para refletir o parâmetro interno de CPU e sua seleção no escalonador.
