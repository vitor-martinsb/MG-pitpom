# Benedita e Samanta

As duas personagens usam o módulo `src/golf/companions.c`, os mesmos passos de física e a navegação dos campos existentes. A inicialização encontra posições seguras em cada campo, inclusive em campos futuros com navegação válida. A dupla só é ativada quando sorteada, ocupando as duas vagas ao lado de Pituca ou Pompom; nunca acrescenta animais ao trio. O posicionamento respeita piso, paredes, tee, buraco, zonas móveis e os animais residentes. Se um campo não oferecer espaço seguro, a personagem correspondente não ocupa uma posição inválida. A geometria e os parâmetros físicos das fases não mudam.

Benedita permanece sentada e acompanha a bola com a cabeça. Seu olhar exige uma bola em movimento, linha de visão no piso, distância menor que 2,7 m e um cone frontal de aproximadamente 130°. O estado individual `GOLF_CAPTURE_BENEDITA` suspende a física por três segundos sem esconder a bola; guarda velocidade e rotação e as restaura ao terminar. A recarga de cinco segundos começa na liberação. Olhos, joias rosas centralizadas, piscada e partículas identificam a habilidade.

Samanta começa parada, identifica bolas passando a até 2,4 m, persegue apenas trajetos com passagem válida e captura a até 0,52 m. Seus estados são espera, perseguição, transporte, retenção, retorno e recarga. Só segura uma bola por vez. A busca sobre o grafo de navegação escolhe um destino aleatório acessível perto de sua origem, validando também a largura da cachorrinha e os pontos intermediários entre nós. A posição e o sentido da corrida determinam a boca, a bola carregada e a animação das patas/rabo. Em trechos sem destino adicional seguro, ela espera em uma posição já válida.

A retenção não expira. Um clique/toque direto do dono da bola, depois da chegada, solta a bola no piso da posição atual, com velocidade e rotação zeradas e sem adicionar uma tacada. A mira fica disponível assim que as regras normais de turno permitem. Samanta volta pelo grafo até sua origem; a recarga de cinco segundos começa ao chegar. Nenhum temporizador solta automaticamente uma bola carregada. Bots realizam explicitamente a mesma interação, e o planejador simula a ação apenas em sua cópia isolada.

O transporte da Samanta tem prioridade sobre o olhar da Benedita. A transferência encerra o olhar e sua recarga, sem restaurar um segundo movimento sobre a bola capturada. Desconexões encerram o olhar ou devolvem uma bola carregada ao piso, permitindo o retorno da personagem. Captura, pausa, caminhada, soltura e retorno não alteram o contador de tacadas.

O worker nativo possui a autoridade no multiplayer. Snapshots incluem as duas posições, orientações, estados, donos e relógios. O cliente interpola a caminhada e calcula a mesma boca 3D. O comando `smanata` reutiliza as validações e a publicação da interação da Meg: dono pelo socket, mapa/partida atuais, estado correto e turno. `pet_pending` é independente da confirmação de tacada, evitando manter a mira bloqueada depois da liberação. O gesto é consumido pela personagem e não vira uma tacada.

O menu mantém seus oito animais e acrescenta Benedita e Samanta como sprites individuais em `art/menu-companions-separated.png`, com espaço entre elas. Cada personagem mantém cabeça, joias, patas e contorno íntegros, com respiração e descrição próprias. O atlas RGBA usa um corredor transparente para impedir recortes da personagem vizinha. Uma nova fileira e o ajuste do conjunto reservam o espaço dos botões em celular e desktop. Iluminação de dia, fim de tarde e noite, Natal, título e continuar usam os sistemas existentes. O buffer de atores reserva 73.728 vértices para os personagens adicionais e efeitos em partidas de 50 participantes.

## Validação

- `companions_mechanics`: três segundos exatos, restauração de velocidade/rotação, cone, recarga, prioridade, retenção sem expiração, dono, soltura no chão, próxima tacada, retorno e desconexão.
- `companions_placement_*`: posicionamento, transporte e retorno com verificações de piso e segmento nos 80 campos.
- `server/test/companions.test.ts`: tacada real passando pelas duas habilidades nos modos simultâneo e por turnos, permissões, snapshots iguais, próxima jogada e retorno.
- `server/test/companions.mjs`: dois clientes, efeitos/estados visíveis, clique no desktop, toque no celular e uma tacada real depois da soltura; imagens em `out/companions`.
- Regressões da Meg, física, Juju, pegadas, Natal, servidor, capacidade de atores, arte/transparência, descrições e responsividade do menu.

## Saliva e apresentação da Samanta

A soltura manual aplica saliva somente à bola devolvida: as próximas três tacadas recebem 20% de velocidade inicial adicional pelo multiplicador compartilhado da física. Cada tacada concluída consome uma carga; capturas, espera, recusas e snapshots repetidos não consomem cargas. O reset do campo limpa o estado. Gotas discretas diminuem a cada carga e a interface informa quantas restam. O worker publica o contador para todos os clientes, inclusive no modo por turnos. O cache do planejador de bots respeita o multiplicador de efeitos da bola.

A bola carregada usa o mesmo material, cor e personalização sazonal da bola em jogo, posicionada na boca desenhada. As pernas mantêm o vínculo ao tronco; o passo é mais visível e sua fase é interpolada entre snapshots multiplayer. O nome Samanta permanece inteiro no tooltip do menu.
