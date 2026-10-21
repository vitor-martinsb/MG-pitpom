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
por sala, sem fila de buscas, com rodízio entre bots e uma pausa mínima de
100 ms antes de iniciar a próxima. Um resultado é descartado se a fase, o
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
