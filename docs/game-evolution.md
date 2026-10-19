# Evolução do PitPom Minigolfe

## Sala e sequência

O anfitrião humano configura Clássico/Impacto, quantidade de pistas e bots no
lobby. Convidados recebem as mesmas opções, com edição bloqueada. A validação
também ocorre no servidor: enviar mensagens diretamente não permite alterar
configurações, editar bots ou iniciar/reiniciar partidas sem ser o anfitrião.
Ao desconectar, o anfitrião passa ao humano conectado de menor ID. Bots nunca
recebem essa função. Configurações e sequência são restauradas na reconexão.

Cada partida sorteia uma única sequência, sem repetição, entre os mapas válidos
do catálogo existente. Arquivos repetidos ou sem início/buraco são excluídos.
O limite atual é **100 pistas**; pedidos acima do catálogo são rejeitados, sem
repetir mapas silenciosamente. A trilha e todos os clientes usam essa mesma
ordem. Após os resultados finais, **Jogar novamente** devolve a sala ao lobby;
a partida seguinte recebe novo sorteio e placares limpos.

## Bots com física real

O limite de **50 participantes** inclui humanos e bots. O anfitrião pode criar,
editar e remover bots, escolhendo nome, cor e dificuldade. Eles não usam sockets
fictícios nem enviam posições: o servidor solicita ao worker C uma direção e
força e aplica uma tacada pelo mesmo caminho validado dos humanos.

`navigation.c` amostra superfícies jogáveis e constrói um grafo limitado a
4.096 nós. Consultas ao BVH identificam piso, paredes, água, limites e conexões.
O custo até o buraco orienta a escolha de trajetos; candidatos simulados na
física original permitem avaliar desvios, ricochetes e perigo de captura.
Cada previsão usa uma cópia da bola e das mecânicas; não altera a partida nem
emite sons reais. A busca considera até 24/48/96/144 candidatos, conforme
dificuldade, com previsão de 8/10/12/12 segundos. Difícil e Especialista também
avaliam uma segunda tacada, com largura limitada. O grafo do planejador inclui
ligações de salto e portal; posições futuras dos obstáculos móveis são simuladas.

Fácil tem maiores erros de direção/força; Médio reduz esses erros; Difícil e
Especialista ampliam a busca e a precisão. Tentativas malsucedidas são lembradas
durante o mapa. Bots obedecem prontidão, cronômetro, capturas e pontuação, com um
limite de segurança independente de 48 tacadas. DNF soma 12 às tacadas realizadas.
Quando todos os humanos terminam, a simulação dos bots passa a 5x com o mesmo
passo físico de 1/120 s. A próxima pista volta a 1x.
Veja [regras e testes atuais](bots-audio-loading.md).

## Bolas e mascotes

Em Impacto, todas as bolas ficam visíveis desde o início. Bolas protegidas têm
transparência parcial, halo claro e indicador de escudo. A proteção termina
somente quando a primeira tacada válida para completamente. Colisões exigem
que ambos tenham terminado; uma pequena tolerância de liberação separa bolas
sobrepostas sem criar um impulso imediato. Clássico mantém bolas independentes.

Pituca continua sendo a cachorra preta e branca, **sem rabo**, deitadinha olhando
para a bola que se aproxima. Pompom continua sendo a gata laranja e branca.
As regiões de interação vêm de pisos alcançáveis, com espaço para o corpo,
distância do início/buraco e exclusão da área varrida por obstáculos móveis.
O passeio da Pompom segue a orientação local do percurso e é limitado ao piso
seguro. Se um novo mapa não oferecer região segura, o obstáculo correspondente
fica desativado com diagnóstico, em vez de ocupar uma parede ou espaço externo.
Os 20 mapas atuais possuem colocação validada para ambas.

Tapa, cooldown e captura conservam as regras anteriores. A captura retorna a
bola ao ponto anterior à última tacada, preservando a tacada e restaurando o
estado físico. [Detalhes das mecânicas](new-mechanics.md).

## Navegador, animação e áudio

A trilha ilustrada usa vegetação, rio, casinhas, cogumelos e uma rota orgânica,
com identificação das pistas e seis temas de ambiente. Na partida, mostra a
sequência real e os estados concluído/atual/próximo. Não cria bloqueios permanentes.
O botão **Jornada** abre a trilha sem perder a partida; celular usa painéis com
rolagem. As funções anteriores de solo, chat, placar e configurações permanecem.

O carregamento utiliza o atlas PNG original em referências SVG independentes:
Pituca corre à frente de Pompom, cada uma com oito poses, sem linhas pontilhadas.
A animação acompanha espera real pelo motor/sala. O progresso só mostra bytes
informados pelo Emscripten ou jogadores efetivamente prontos; espera sem medida
usa indicador indeterminado. Movimento reduzido respeita a preferência do sistema.

As dez trilhas instrumentais originais são sintetizadas localmente, uma por
mundo, entre 58 e 72 BPM. O menu mantém seu tema de 62 BPM. Mudanças de mundo
usam transição de 1,8 segundo; mapas do mesmo mundo mantêm a reprodução.
Efeitos respondem às tacadas reais e à força, madeira/pedra,
buraco, tapa, captura, colisão entre bolas, contagem final e início da pista.
O worker identifica e transmite eventos; clientes eliminam duplicatas e limitam
a reprodução por atualização. Efeitos tonais têm limite de 24 vozes, com variação
leve e intervalo entre repetições. Aplausos têm duração aproximada de quatro segundos.

**Settings** oferece volumes independentes geral/música/efeitos/interface,
silenciamento da música e de tudo. Preferências ficam salvas; som começa após
interação para cumprir o bloqueio de autoplay. Silenciar música conserva efeitos.

A comemoração principal depende de `completed` confirmado pelo servidor após
todas as pistas: reduz música, toca fanfarra e aplausos, mostra pétalas, vencedores
incluindo empates e placar. Não se repete em snapshots ou recarregamentos da mesma
partida e não comemora uma falha de física. Resultados intermediários usam somente
uma confirmação curta. Novos textos estão em inglês, português brasileiro e espanhol.

## Validação e publicação

Testes nativos cobrem os 20 mapas, piso/caminho das mascotes, captura, tapa,
proteção, separação e limites. Testes Node cobrem permissões, sorteio fixo,
reconexão, reinício, planejamento sem mutação, eventos reais e 49 bots com um
humano. Testes Chromium cobrem dois clientes, toque em celular, configurações,
trilha compartilhada, escudos, áudio persistido e comemoração somente ao final.

O workflow em `dev` e `staging` recompila o contêiner Linux com WebAssembly,
física e Node e testa protocolo, HTTP/WebSocket e navegador. O manifesto mantém
mapas/modelos originais imutáveis; apenas cinco arquivos de regras/rede recebem
novos hashes das alterações intencionais revisadas.

Validação de celular é emulação Chromium; aparelhos físicos iOS/Android exigem
teste no dispositivo. A passagem `dev` → `staging` mantém o histórico e não altera
`main`. O estado **Live** e o endereço público devem ser conferidos no Render
após o deploy; o envio ao GitHub não confirma sozinho a publicação.
