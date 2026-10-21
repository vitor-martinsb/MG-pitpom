# Campos 2, 3 e 4: curvas, água e vento

As vinte famílias conservam os arquivos originais do Campo 1, suas saídas,
buracos, obstáculos e identidade. Os sessenta campos evoluídos recebem três
etapas de curvas autorais em `build/evolution-redesign.py`, combinadas com as
mecânicas de cada original. Os identificadores e o progresso salvo continuam
compatíveis com o catálogo anterior.

Cada etapa acrescenta uma deformação transversal de pelo menos 1,1 metro:
há curvas opostas, cotovelos, mudanças em dois eixos e percursos em S. As
regiões escolhidas e seus raios variam entre as vinte famílias. Algumas também
ganham ilhas de pedra com passagens dos dois lados. A deformação preserva a
altura dos terrenos e subdivide piso, paredes, rampas estáticas e água juntos.
Os conjuntos móveis recebem regiões de deslocamento uniforme para conservar
a relação entre geometria, pivôs e movimentos.

Os novos riachos recortam o piso, incluindo plataformas elevadas, com água
física, leito raso contínuo e margens acompanhando as curvas. Rampas nas duas
extremidades permitem entrar e sair do canal sem prender a bola. O leito fica
acima do limite de saída do campo. Os UVs indicam o fluxo local e a
correnteza usa a mesma força compartilhada pelos jogadores e pelos bots.
O limite de contatos inclui as emendas da água e o apoio do leito, inclusive
nas curvas subdivididas. Trechos que cruzavam uma parede ou obstáculos foram
reposicionados dentro de suas fases para manter o canal livre até a saída.
Uma ponte baixa com rampas permite atravessar o riacho da família Riacho da
Paz; a água continua sendo uma alternativa de percurso. Os rios e os moinhos
são distribuídos seletivamente e não aparecem em todos os campos.

Os moinhos têm torre com colisão, hélices de madeira animadas e pequenos
traços e folhas indicando o vento. A aceleração horizontal cai suavemente
com a distância e o afastamento lateral da direção de sopro. Há vento
contínuo e rajadas senoidais previsíveis, com períodos de cinco a sete segundos.
A força é aplicada em passos de 120 Hz, inclusive na água. O centro da faixa
de sopro tem força suficiente para vencer o atrito; rajadas fortes também
movem bolas paradas depois da primeira tacada. A bola permanece estável na
saída antes do primeiro lançamento, e as bordas fracas permitem que ela pare.
Não altera gravidade, atrito ou velocidade de lançamento global. O
vento enfraquece perto do buraco para permitir que a bola termine seu rolamento.

Os bots simulam a física real com água e vento. Quando o grafo normal não
encontra conexão, uma malha mais fina resolve aberturas estreitas, respeitando
os limites de memória existentes. Eles também comparam esperas de até três
segundos contra a física futura. Cada tacada permite uma única espera,
seguida de novo planejamento no tempo real do servidor, evitando espera infinita.
Em salas com bots, o grafo compartilhado é preparado na tela de carregamento,
antes de iniciar o relógio da partida, para não travar a primeira decisão.

As regras de pontuação e DNF, Poppins, o minimapa sem textos ou animais e a
composição permanente de Pituca, Pompom e um terceiro companheiro continuam
preservados. O vento não depende da ativação das interações dos animais.

As verificações incluem hashes dos vinte originais, regeneração determinística
dos sessenta campos, transporte real da entrada até a saída de cada novo
riacho sem reposicionar a bola, deslocamento por vento a partir do repouso,
colisões e conclusão real pelos bots em até 48 tacadas nos oitenta campos.
Os testes de navegador conferem o catálogo, os três animais e os limites de
renderização em desktop e celular.
