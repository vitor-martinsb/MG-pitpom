# Meg, a lançadora de bolinhas

Meg é a quinta candidata ao terceiro animal de cada campo, junto de Romeu, Luna, Frida e Juju. Pituca e Pompom continuam fixas. O catálogo e o posicionamento compartilhado a incluem nos campos existentes e futuros com animais, sem editar a geometria das fases. A posição sentada usa a navegação e as mesmas verificações de piso, obstáculos, tee e buraco. O marcador opcional `animal:4` permite indicar uma preferência em novos campos.

A ilustração cartoon usa a malha de atores já existente, com contornos planos arredondados, orelhas caídas, olhos castanhos, focinho grisalho e mancha branca no peito. Sua silhueta é maior que a dos companheiros. Ela se volta para a câmera, permanece apoiada no piso e participa do teste de profundidade do cenário. Respiração, piscadas e rabo são calculados sem imagens recortadas ou sobreposições HTML. Não há texturas ou dependências novas.

## Captura e lançamento

O contato válido com Meg usa o raio de 0,75 m e é verificado em cada passo fixo de física, como nos outros animais. O estado é individual por bola; até 50 jogadores podem estar segurados simultaneamente. `capture_kind == GOLF_CAPTURE_MEG` identifica a captura. A velocidade fica zerada, a física fica suspensa e a posição acompanha a boca. A apresentação usa a cor real da bola do jogador. Capturas não expiram: a sentinela finita `FLT_MAX` mantém os bloqueios existentes e o ramo explícito de Meg nunca executa a liberação por tempo.

Somente `golf_meg_release` libera a bola após uma interação autorizada. A direção vem de uma amostra independente em todo o círculo, calculada pela autoridade a partir da semente da partida, identidade e contador de lançamentos. A intensidade reutiliza `golf_physics_max_shot_speed`, a mesma configuração `aim_dark_red_speed` da tacada máxima. O lançamento não passa pelo contador de tacadas, não consome duração de barro e não permite tacada extra. A gravidade e as colisões normais voltam imediatamente. A proteção de 1,5 s impede recaptura ou outro contato com animais durante a saída.

Os estados são `MEG_IDLE`, `MEG_CAPTURING`, `MEG_HOLDING`, `MEG_RELEASING` e `MEG_COOLDOWN`. A animação de captura dura 0,18 s; a de lançamento, 0,25 s. Esses prazos afetam somente a apresentação, nunca a duração da retenção. A indicação “Toque na Meg para soltar!” acompanha a personagem e o HUD, com traduções em português, inglês e espanhol.

## Entrada e multiplayer

O clique/toque começa e termina na área projetada da personagem. Interações rápidas também funcionam quando pressionar e soltar ocorrem entre dois quadros. O gesto é consumido e não inicia mira, tacada ou rotação de câmera. Fora da Meg a câmera continua disponível. A interface do jogo chama o mesmo comando no solo e no multiplayer.

No multiplayer, `meg` inclui o mapa e a partida atuais; o servidor determina o participante pelo socket. A requisição não aceita identidade, direção nem potência fornecidas pelo cliente. A validação exige jogador conectado, pronto, partida em andamento e uma bola realmente capturada por Meg. Por turnos, também exige a vez correspondente; a retenção impede a rotação. Soltar na vigésima tacada continua permitido, pois faz parte da mesma jogada. Mensagens duplicadas não provocam outro lançamento. Snapshots propagam a captura, animação, posição, velocidade e efeito aos participantes, incluindo reconexões. As regras existentes de prazo no modo simultâneo e de DNF permanecem.

Bots acionam explicitamente a mesma interação no seu controlador de decisões, como jogadores virtuais. Não existe temporizador de soltura em Meg. A busca de trajetória continua isolada no worker de planejamento e não pode soltar ou modificar bolas reais.

## Validação

- `ctest --test-dir out/server-native -R '^meg_' --output-on-failure`: retenção prolongada, 50 bolas independentes, força máxima, distribuição de direções, gravidade, ausência de tacadas adicionais e posicionamento nos 80 campos.
- `cd server && npx tsx --test test/meg.test.ts`: colisão real por uma tacada no campo original, autorização por dono/turno/partida, rejeição de repetição e sincronização em ambos os modos.
- `cd server && node test/meg.mjs` (também `--webkit`): dois clientes, clique no desktop, toque no celular, rejeição fora da personagem e preservação do placar. Capturas de tela em `out/meg`.
- Regressões nativas de física, animais, barro, resgate e Natal; suíte do servidor; contratos e verificação dos hashes dos mapas/modelos.
