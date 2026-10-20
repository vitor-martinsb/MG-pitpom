# Temas, trilha, correnteza e visitas dos animais

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

As curvas usam os vetores locais e UVs dos segmentos já gerados. Margens,
pedras, quedas e recuperação continuam usando suas colisões reais. Solo,
worker autoritativo e simulações de trajetória dos bots executam o mesmo C.
Os testes com sondas imersas conferem direção, escala, emendas e duração de
contato; os testes de campanha resolvem os 80 campos com física real.

## Três integrantes, visitas alternadas

A escalação de cada campo tem Pituca, Pompom e um sorteio entre Romeu, Luna e
Frida. As três rotas extras guardadas na geometria são alternativas; apenas
uma delas integra a escalação e pode interagir. Por isso, alternativas podem
reservar o mesmo trecho seguro, sem aparecer juntas. Pituca e Pompom mantêm
seus espaços separados; todos os candidatos continuam evitando spawn, buraco,
água, paredes e áreas varridas por obstáculos móveis.

Uma semente autoritativa e o identificador do campo determinam o terceiro
integrante, a fase dos passeios, um local seguro próximo para Pituca descansar
e a agenda de visitas. Os ciclos duram de 39 a 45 segundos, com visitas
defasadas e intervalos de dois segundos. Entradas e saídas têm transição suave de
0,65 segundo; interações só começam quando o animal já está apresentado.
Uma ação em andamento termina antes da saída. O sorteio do modo solo é novo
a cada entrada em campo. No multiplayer, a semente e o tempo pertencem ao
servidor; reconectar não refaz o sorteio nem reinicia a agenda.

Snapshots distinguem `active` (integrante da escalação) de `visible` e
`presence` (visita atual e transição). `catActive`, `dogActive`, `thirdKind`,
`catVisible`, `dogVisible`, `catPresence` e `dogPresence` permitem verificar
o estado sem enviar decisões de física do cliente ao servidor.

O xixi do Romeu mantém a poça e a lentidão por **três tacadas próprias
concluídas**. A agenda não apaga efeitos já aplicados nem altera seu contador.
As fotos/modelos, identidade dos animais, músicas e loading foram preservados.
