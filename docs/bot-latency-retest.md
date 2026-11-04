# Reteste de latência dos bots — antes da correção

Código testado: `4c390ae`. Nenhum ajuste no servidor, física, dificuldade ou
configuração publicada foi aplicado durante este reteste.

## Reprodução

Com o worker nativo compilado, executar na pasta `server`:

```sh
node --import tsx --test test/bot-performance.test.ts test/thirty-bots.test.ts test/bots-update.test.ts
node --import tsx test/bot-latency.mts
```

As 18 regressões funcionais passaram. O benchmark adicional usa a `Room` real,
o planejador nativo e tacadas aceitas pela física existente. Usa semente 12345,
dificuldade média e `data/campaign/family-04-3.level`, com um humano conectado
sem jogar para manter a simulação em 1x. Configura o perfil do Render:
`GOLF_CPU_BUDGET=0.1`, `GOLF_BOT_CPU_FRACTION=0.04`,
`GOLF_BOT_SEARCH_MS=20`.

O computador local não estava sob a quota de CPU do Render. O socket do humano
é um coletor local, sem transporte WebSocket. Os valores não são medições de
latência de rede nem de FPS do navegador. As execuções foram sequenciais,
depois de concluir as regressões, sem sobrepor outros testes locais.

## Resultado observado

Espera medida desde a bola parada e disponível até uma tacada aceita, incluindo
a fila do planejador. Percentis desta tabela consideram esperas que terminaram
em uma tacada; esperas ainda em curso ficam separadas nos arquivos brutos.

| Bots | Janela de jogo | Tacadas aceitas | Espera mediana | P95 | Maior espera concluída |
| --- | --- | --- | --- | --- | --- |
| 1 | 30 s | 5 | 2,64 s | 3,60 s | 3,60 s |
| 10 | 30 s | 18 | 8,43 s | 20,21 s | 20,21 s |
| 30 | 120 s | 67 | 27,78 s | 73,33 s | 76,42 s |

As janelas de 30 segundos são observações curtas, sem representar a duração
padrão da partida. Todas incluem os cinco segundos de encerramento da física,
durante os quais novas tacadas não são aceitas. Na rodada completa de 120 s
com 30 bots, **nenhum bot concluiu o mapa**. Todos deram pelo menos uma tacada;
o último começou após 24,23 s. Ao encerrar, havia uma espera ainda aberta de
78,47 s. O intervalo P95 entre snapshots ficou próximo de 67 ms nos três
cenários, e não houve falhas de planejamento locais.

## Origem da demora

`Room.tick()` permite uma única decisão em andamento por sala. Os outros bots
parados aguardam esse planejador compartilhado. Aumentar a quantidade de bots
amplia a espera mesmo quando os snapshots continuam regulares.

O limite de busca de 20 ms representa um orçamento **flexível de CPU**, não
um prazo máximo de 20 ms de relógio. A busca termina candidatos completos e
cede CPU para manter a fração de 0,04. No cenário de um bot, as decisões
consumiram aproximadamente 99–270 ms de CPU e 2,47–6,74 s reais. Na rodada de
30 bots, uma decisão chegou a 7,30 s. O reuso de decisões foi exercitado, mas
não eliminou a espera acumulada. As regressões funcionais aprovadas não
constituem um critério de aprovação dessa latência.

## Verificação no serviço publicado

O endpoint `/health` respondeu com zero salas antes do teste. Foi criada uma
única sala privada, com um bot médio e somente esse mapa. A conexão WebSocket
foi feita pelo proxy HTTPS configurado no ambiente. O serviço respondeu:

> Falha na física. Crie uma nova sala.

A falha ocorreu na fase `loading`, antes de `playing`, sem snapshots ou
tacadas. Portanto, **não foi possível medir os intervalos de tacadas no Render**.
O erro público não informa a causa interna; seria necessário consultar os logs
do serviço para distinguir timeout, processo encerrado ou outra falha. A
conexão foi fechada e `/health` voltou a informar zero salas após a limpeza.

Os JSONs de cada cenário e da tentativa publicada estão em
`out/bot-latency-before/`. O relatório confirma a demora no perfil local e uma falha
de carregamento no serviço; não declara esses problemas corrigidos.

Este documento preserva as medições anteriores à correção. A rotina de
benchmark atual acompanha a nova configuração; o perfil e a implementação
usados acima eram os da revisão `4c390ae`. Veja a implementação atual em
[bot-performance.md](bot-performance.md).
Os resultados posteriores estão em [bot-latency-fix.md](bot-latency-fix.md).
