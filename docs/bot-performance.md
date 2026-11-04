# Planejamento dos bots sem pausar a partida

O servidor mantém a física real no processo autoritativo existente. Salas com
bots criam um único processo adicional para pesquisar tacadas, compartilhado
por todos os bots da sala e com prioridade de CPU inferior quando o sistema
permite. Salas sem bots continuam usando somente o processo de física.

O grafo do planejador é preparado durante o carregamento. Cada decisão recebe
uma cópia do jogador, tempo, efeitos, animais, poças e tentativa anterior. A
transferência é interna, entre instâncias do mesmo executável: tem tamanho,
versão e identificação do mapa; os ponteiros são removidos e religados à
geometria local. O processo autoritativo rejeita restaurações desse estado.
Somente direção e força retornam para a validação normal de tacadas.

O loop da sala não espera pela busca. A física, os snapshots, o chat e as
tacadas humanas continuam durante o planejamento. Há uma decisão em andamento
por sala, sem fila de promessas, com rodízio entre bots. A próxima decisão pode
começar no tick seguinte à conclusão da anterior. Um resultado é descartado se a fase, o
processo, o número de tacadas ou a posição da bola mudaram. Falhas do planejador
adiam a decisão do bot sem encerrar a partida. Trocas de campo e encerramentos
também encerram o processo auxiliar.

A busca mantém dificuldades, quantidade máxima de candidatos, antecipação,
gravidade e simulação em 120 Hz. Nas previsões, esferas conservadoras dos
obstáculos móveis evitam reconstruir triângulos que não podem tocar a bola
naquele instante. `GOLF_BOT_FULL_MOVERS=1` preserva o caminho de referência para
comparações; os testes comparam suas direções, forças e pontos de chegada.

As regressões incluem planejamento pendente com tacadas humanas, snapshots e
chat ativos; falha e aposentadoria de decisões; isolamento da física real;
memória de tentativas; previsão com vento; salas com 49 bots e os modos 1x/5x.
As métricas da sala distinguem o tempo da física do tempo de planejamento.

O perfil de CPU pequena usa uma meta inicial de 4 ms de CPU por busca. Saltos
e recuperação de uma tentativa sem progresso têm uma reserva de 20 ms e, nas
dificuldades mais altas, até seis previsões de segundo passo. São metas de
CPU entre previsões completas, não limites rígidos de tempo de relógio. Uma
busca encerrada por orçamento precisa ter encontrado progresso seguro; não
devolve antecipadamente uma tacada sem progresso só por ter testado 12 opções.

Quando nenhuma bola humana está em movimento, a sala pode emprestar CPU
ociosa ao planejador. Usa a taxa de CPU já medida pela física, incluindo a
velocidade de simulação, e reserva 20% da quota para Node/rede. No perfil de
0,1 CPU, a parcela do planejador pode chegar a 0,08 CPU quando há folga e cai
conforme o custo da física aumenta. Uma tacada humana em movimento mantém a
parcela conservadora configurada. O worker auxiliar valida o limite da quota
por requisição e não conserva a exceção para o próximo pedido; o worker
autoritativo não aceita esse aumento de parcela.

Propostas recentes de até 128 buscas ficam disponíveis para bots próximos.
São avaliadas até três sugestões próximas, a até três metros da posição atual.
Cada proposta é simulada novamente com o jogador, horário, animais, vento e
efeitos atuais. A memória de tentativas rejeita sugestões já fracassadas.
Curvas curtas podem compartilhar uma proposta que avance até o próximo trecho,
sem exigir os mesmos 1,5 m de avanço de uma reta longa.

No perfil restrito, o carregamento também prepara propostas ao longo de uma
rota virtual, chamando o próprio planejador e o mesmo simulador. Essa etapa
ocorre somente no processo auxiliar, avança apenas cópias e não move bolas,
animais ou relógio da partida. Os animais ficam fora dessa busca preparatória;
portais e vento continuam no simulador. Uma proposta nunca vira tacada sem
passar por uma nova previsão com o estado completo atual, incluindo animais.
Uma rota preparatória incompleta não impede o planejador normal de pesquisar.
Propostas já reaproveitadas não expulsam toda a rota preparada do cache com
cópias iguais de um mesmo trecho.

No executável nativo, malhas estáticas grandes têm um índice espacial por
triângulo. Consultas de bola ordenam os candidatos pelos índices originais antes
de calcular contatos; raios preservam o primeiro triângulo em empates. A lista
temporária tem tamanho fixo e volta à varredura completa se exceder 256 itens.
Geometria móvel usa intervalos contíguos na ordem original. Os mesmos testes
exatos de triângulos, materiais e respostas físicas continuam sendo usados.
`GOLF_BVH_FULL_FACES=1` desativa o índice para comparação com a referência.

O reteste anterior está em [bot-latency-retest.md](bot-latency-retest.md).
`node --import tsx test/bot-latency.mts`, executado em `server`, mede a espera
real com a bola parada, separada do tempo de rolamento e do custo de cada busca.
