# Natal Encantado

O evento é opcional. Em **Configurações → Eventos sazonais**, escolha **Especial de Natal**. O tema original é o padrão. A troca visual funciona imediatamente, sem reiniciar o jogo. Cores e avatares existentes continuam pertencendo ao perfil de cada jogador.

No solo, a opção **Obstáculos natalinos interativos** vale a partir do próximo campo. Desligar o tema durante um campo não oculta obstáculos que ainda têm colisão: eles permanecem visíveis até a próxima preparação do campo. Essa regra evita remover um obstáculo durante uma tacada ou deixar colisores invisíveis.

No multiplayer, o anfitrião configura o evento na aba **Modo**. O **Torneio da Estrela de Natal** utiliza a mesma sala, seleção dinâmica de campos, classificação, bots, limite de 50 participantes e DNF +12. Clássico e Colisão continuam sendo os modos físicos existentes. O tema e os obstáculos da sala ficam sincronizados e bloqueados durante a partida. Ao sair, o cliente restaura seu tema pessoal. As personalizações natalinas da própria bola e do rastro são salvas junto ao perfil no lobby; convidados não podem alterar outros jogadores.

## Arquitetura

- `src/golf/seasonal.[ch]`: distribuição determinística e interações dos oito obstáculos, compartilhadas pelo solo, servidor e previsões dos bots. Nenhum arquivo de fase é modificado.
- `src/golf/seasonal-render.inc`: apresentação pelo shader e buffer de profundidade existentes. Árvores, presentes, cabana com fumaça, guirlanda, sinos, bonecos de neve, rena, trenó, duende, aurora, estrelas e neve são geometria visual independente. A água recebe detalhes de gelo e continua perigosa (lava e cenários espaciais não são congelados); somente a plataforma especial habilitada modifica o atrito.
- `build/emscripten/seasonal.js` / `.css`: preferências, controles do evento na sala, neve de interface, luzes, árvore do menu, fantasias sobre a arte original, comemorações e troféu. Os acessórios dos bichinhos usam a mesma superfície de canvas do menu, sem novos recortes ou filtros CSS.
- `lofi.js` / `music.js`: composição instrumental procedural original, sinos e vento, usando o mixer, mute e volumes existentes. A troca do tema faz um crossfade; nenhuma música externa ou novo AudioContext é criado.
- `Room.seasonal` e os campos `seasonSkin` / `seasonTrail` estendem o protocolo existente. A autoridade envia posições, fases e instante de reação dos obstáculos nos snapshots; clientes não sorteiam nem simulam colisões separadamente.

Para adicionar um campo, basta registrá-lo normalmente no catálogo do jogo. A navegação fornece piso alcançável, início, buraco e áreas excluídas; o evento usa esses dados para reservar espaço. Obstáculos que não cabem são omitidos, mantendo a ambientação. A verificação atual percorre os 80 campos e encontra espaço em 79 deles, com 403 objetos no conjunto para uma semente fixa. Esses números são resultados do teste, não limites de implementação.

Para futuros eventos, mantenha a mesma separação entre tema visual, preferências, configuração da sala e mecânicas opcionais. Novos identificadores de tema podem acrescentar outra apresentação e catálogo de interações sem duplicar o lobby, o carregador de campos ou o simulador.

## Regras e orçamento

Os presentes desviam a velocidade horizontal em até 0,18 radianos. Bonecos, bengalas, trenós e bolas de neve usam movimentos periódicos e pequenas colisões; todos os envelopes são verificados contra o piso e as exclusões do cenário. Portais vêm em pares e reutilizam a captura/liberação existente, com cooldown por jogador. A estrela aplica impulso de 0,9 e limita a velocidade resultante a 12. O gelo reduz o atrito de contato a 45% enquanto há contato; sua influência expira em 0,12 segundo. O raio físico da bola e a geometria das fases permanecem intactos.

A decoração usa um buffer fixo de até 36.000 vértices, 64 flocos no campo, até dez árvores originais com luzes e detalhes de rastro para até doze jogadores mais o jogador local. As cores das bolas continuam visíveis para todos os participantes; o círculo de identificação mantém a cor do perfil. A interface limita neve a 32 partículas no celular ou 56 no desktop, densidade de pixels a 1,5 e animação a 30 Hz, pausando quando a página fica oculta. A preferência por movimento reduzido mantém a neve da interface parada.

## Verificação

- `golf_seasonal_test`: oito interações, efeitos desativados invariantes, colocação determinística, cooldown por participante, liberação dos portais e atrito normal restaurado.
- `server/test/seasonal.test.ts`: todos os campos do catálogo, permissões da sala, 50 participantes, perfis, simulações idênticas e previsões dos bots sem alteração da partida real.
- `server/test/seasonal.mjs`: tema original/Natal em tempo real, desktop/celular, duas páginas na sala, personalizações salvas e decoração WebGL. `seasonal-webkit.mjs` executa o mesmo fluxo no motor do Safari em CI.
- As suítes anteriores de mapas, física, avatares, menu, áudio e lobby continuam habilitadas. Os hashes de todos os mapas e modelos originais permanecem inalterados; apenas os hashes dos cinco pontos de integração de gameplay revisados foram atualizados.

O teste em navegador emulado cobre Chromium e WebKit; ele não substitui uma medição de desempenho num aparelho Android ou iPhone físico.

## Arte do menu de Natal

O menu natalino utiliza as composições `menu-christmas.png` e `menu-christmas-portrait.png`, preparadas a partir da referência enviada em `1000132077.png`. A arte mantém os sete bichinhos agrupados, roupas natalinas completas, árvore com laço, guirlandas, presentes, lago e moinho iluminado. Barras pretas e elementos do telefone não fazem parte dos arquivos. Logo, legendas e botões são HTML independente.

`christmas-menu.js` desenha a composição adequada ao formato da tela em um único canvas opaco. Os rabos usam deformação local com bordas e pontos de ligação fixos; patas e corpos nunca são removidos da imagem. Luzes variam suavemente, sem apagar. O movimento respeita a preferência de movimento reduzido e para quando a página ou o menu ficam ocultos. O renderizador do menu original é pausado durante o Natal e retomado ao trocar de tema.

As imagens são carregadas sob demanda, sem downloads extras no tema original. As duas composições são decodificadas antes de revelar o menu quando o Natal está selecionado. Em celulares muito altos, somente a faixa de gramado vazio é estendida; os personagens preservam proporções. Descrições acessíveis continuam disponíveis nos sete bichinhos, com áreas de interação ajustadas à nova arte.

A validação visual cobre 320×900, 390×844, 768×1024, 844×390, 1280×800 e 1920×1080, verificando cobertura opaca, personagens inteiros, botões sem sobreposição, retorno do tema original e sincronização do lobby. A alteração é restrita à apresentação do menu; não muda campos, física ou regras da partida.
