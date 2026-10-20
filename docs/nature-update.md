# Temas, trilha, correnteza e moradores permanentes

Os 80 identificadores, caminhos dos mapas e chaves de progresso continuam iguais.
Os rótulos decimais do catálogo são referências internas legadas. A apresentação
usa o catálogo único `data/locales.json`: **nome do tema - Campo 1 a 4**,
com tradução imediata em inglês, português brasileiro e espanhol. O HUD em C
e a seleção, lobby, placar e resultados no navegador usam o mesmo catálogo.

| Família interna | Tema em português |
|---|---|
| 1 | Bosque Sereno |
| 2 | Curva dos Salgueiros |
| 3 | Colinas das Margaridas |
| 4 | Jardim das Brisas |
| 5 | Voltas Suaves |
| 6 | Prado dos Pêndulos |
| 7 | Riacho da Paz |
| 8 | Terraço das Samambaias |
| 9 | Volta dos Trevos |
| 10 | Colina Crescente |
| 11 | Jardins Gêmeos |
| 12 | Vale das Nuvens |
| 13 | Copa Sinuosa |
| 14 | Enseada Serena |
| 15 | Nascentes em Espiral |
| 16 | Recanto das Pontes |
| 17 | Clareira Dançante |
| 18 | Passagem do Bosque |
| 19 | Refúgio dos Arcos |
| 20 | Santuário das Ilhas |

A trilha continua na Escolha de Fase e nos painéis de jornada da partida.
Há atalhos com os dez mundos, destaque do mundo atual, quatro campos por
família, conclusão, melhor pontuação e bloqueios opcionais. Caminhos de terra,
pedrinhas e pontes conectam os grupos; a página inicial continua sem trilha.

## Correnteza compartilhada

A água já tinha vetores por face no motor original. A física agora normaliza
os vetores horizontais após a transformação do objeto, combina os contatos
locais e aplica uma única aproximação exponencial da velocidade da corrente
por atualização. Isso evita multiplicar a força em emendas e mudar sua
intensidade com a escala da malha. Preserva os parâmetros existentes:
velocidade alvo de 4 m/s e resposta de 2,5 por segundo. A água não passa a
amortecer artificialmente a gravidade.

Nos riachos gerados, a direção local é recuperada da tangente dos UVs após
a deformação do corredor: a física acompanha o mesmo sentido visual do shader,
inclusive quando uma evolução curva um riacho de uma versão anterior. As águas
originais conservam seus vetores, com indexação correta entre grupos de material. Margens,
pedras, quedas e recuperação continuam usando suas colisões reais. Solo,
worker autoritativo e simulações de trajetória dos bots executam o mesmo C.
Os testes com sondas imersas conferem direção, escala, emendas e duração de
contato; os testes de campanha resolvem os 80 campos com física real.

## Três moradores permanentes

Todos os 80 campos têm Pituca e Pompom mais um integrante sorteado entre
Romeu, Luna e Frida. A escolha acontece uma vez no carregamento e exclui o
companheiro do campo anterior, tanto no solo como no multiplayer. As três
rotas extras guardadas na geometria são alternativas: apenas a escolhida
integra a partida. Elas podem compartilhar espaço entre si porque nunca
são usadas simultaneamente.

Os três moradores ficam visíveis durante toda a fase, inclusive em descanso.
Não há agenda de visitas, temporizador de remoção ou animação de escala para
fazê-los entrar ou sair. As posições e percursos reservam espaços separados,
com verificações do piso, paredes, água, buraco e obstáculos móveis. Em campos
estreitos, o passeio da Pompom é limitado ao espaço seguro disponível.

Os passeios alternam deslocamento suave e descanso; a velocidade varia entre
os animais e a animação das patas acompanha a distância percorrida. Pituca
preserva sua postura deitada e suas reações. O servidor escolhe o terceiro e
simula as posições no mesmo código C usado pelo solo. Reconectar mantém a
composição e o estado da fase; todos os clientes recebem os mesmos snapshots.

Os campos `active`, `visible` e `presence` continuam no protocolo para
compatibilidade. Os três integrantes permanecem visíveis com presença plena;
as duas alternativas não escolhidas permanecem inativas. Os animais continuam
ocultos no minimapa.

As interações existentes foram preservadas. O xixi do Romeu mantém a poça e a
lentidão por **três tacadas próprias concluídas**, sem alterar a física global.
Os modelos, identidades, músicas e loading continuam preservados.
