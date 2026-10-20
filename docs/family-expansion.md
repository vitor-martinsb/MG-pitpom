# 80 fases em 20 famílias

As vinte pistas originais permanecem byte a byte iguais à referência restaurada.
Cada uma tem três evoluções cumulativas: `X → X.1 → X.2 → X.3`. São 60 novos
arquivos em `data/campaign/family-XX-R.level`, escritos por operações específicas
de cada família, sem sorteio de obstáculos. O número de tacadas necessário pode
variar conforme tabelas e atalhos; a dificuldade foi construída por precisão,
combinação de desafios e janelas de passagem, não por alongamento artificial.

## Resumo das 60 evoluções

Cada coluna acrescenta os desafios à versão imediatamente anterior.

| Família | X.1 — leve | X.2 — intermediária | X.3 — avançada |
|---|---|---|---|
| 1 · reta | estreitamento e pedra irregular | curva lateral no corredor | contracurva e segunda pedra na chegada |
| 2 · L | entrada mais estreita | ápice da curva deslocado e reduzido | pedra na saída e segundo ajuste de tabela |
| 3 · lombadas | duas lombadas elevadas | outras duas lombadas e riacho lateral | últimas duas elevadas e entrada deslocada |
| 4 · circuito | rotor e portão defasados | curva mais fechada e segundo portão em outro ciclo | primeiro conjunto acelerado e aproximação mais estreita |
| 5 · loop em altura | aproximação do loop mais estreita | riacho na margem da aproximação | segunda inflexão, mais precisa, na entrada |
| 6 · pêndulos | dois primeiros pêndulos defasados | outros dois com ciclos diferentes e corredor reduzido | ritmo alternado e chegada mais estreita |
| 7 · água transversal | riacho lateral conectado ao setor aquático | aproximação deslocada e estreitada | saída em contracurva com pedra de precisão |
| 8 · rampa de retorno | aproximação mais estreita e deslocada | riacho na lateral da plataforma superior | corredor de chegada reduzido e deslocado |
| 9 · loop e portão | nova fase do portão | retorno mais estreito e deslocado | outra janela do portão e pedra perto da saída |
| 10 · arco e salto | entrada do arco mais técnica | riacho lateral na zona inferior | portão defasado e duas lombadas mais altas |
| 11 · dois loops | primeiro par de portões defasado | segundo par em outro ciclo e saída reduzida | novas janelas do primeiro par e corredor final reduzido |
| 12 · salto longo | aterrissagem mais estreita e deslocada | riacho junto ao trecho de chegada | segundo setor de aterrissagem mais preciso |
| 13 · S elevado | rotores em fases diferentes | ápice do S reduzido e novo ciclo do bloqueio | ciclos diferentes entre rotores e aproximação estreita |
| 14 · U | margem de retorno mais precisa | riacho ao lado da curva | corredor final reduzido e deslocado |
| 15 · loops opostos | dois rotores defasados | terceiro rotor e saída estreitada | riacho na plataforma elevada e outra redução na saída |
| 16 · ponte basculante | nova janela da ponte | riacho curvo sob a travessia | outro ciclo da ponte e chegada mais estreita |
| 17 · elevador e rotores | primeiro conjunto defasado | elevador, rotor e corredor combinados | último rotor em novo ciclo e corredor final estreito |
| 18 · portões e semicírculo | primeiro par de portões defasado | terceiro portão e ápice do semicírculo | último portão e saída estreitada |
| 19 · arco e defletores | três defletores com novos ângulos | riacho na margem externa e outro defletor ajustado | corredor reduzido e últimos dois defletores em novos ângulos |
| 20 · ilhas e pontes | duas pontes em fases diferentes | outras duas pontes defasadas e margem de aterrissagem reduzida | última ponte, chegada reduzida e riacho entre ilhas |

## Riachos

Água nova aparece em **21 evoluções**: **3.2, 3.3, 5.2, 5.3, 7.1, 7.2,
7.3, 8.2, 8.3, 10.2, 10.3, 12.2, 12.3, 14.2, 14.3, 15.3, 16.2, 16.3,
19.2, 19.3 e 20.3**. A água adicionada em X.2 continua presente em X.3.

Os riachos usam o tipo físico, o material e a corrente do Campo 7. O piso é
recortado onde passa a água, com margens curvas, leito, pedras e grama. Nas
travessias já elevadas, a água ocupa o vão sob a pista. Colisão, penalidade e
recuperação continuam usando as regras existentes. A maioria das novas águas
é lateral; permanece uma rota seca ou uma travessia fisicamente possível.

## Seleção e progresso

**Escolha de Fase** apresenta vinte famílias de quatro nós, com os nomes
`X / X.1 / X.2 / X.3`. A seleção livre é o padrão. **Progressão individual**
habilita o desbloqueio sequencial e salva a preferência no navegador.
Os recordes das vinte originais mantêm suas chaves antigas; as evoluções usam
um espaço próprio, sem importar recordes da campanha anterior de cem mapas.

O anfitrião pode escolher **todas**, **originais**, **evoluções** ou **seleção
manual**. O servidor valida a lista e sorteia os mapas sem repetir. A ordem
permanece igual para todos, inclusive após reconexão. Só o anfitrião humano,
no lobby, pode alterar essa configuração. Pontuação e limites continuam iguais.

## Bots e preservação

O planejador distingue pisos sobrepostos e as faces superiores das pontes,
considera travessias curtas de água e prepara o lançamento nas rampas curvas.
Destinos adicionais são procurados quando o grafo inicial não alcança o buraco.
Cada candidato é simulado pela física C real; os quatro níveis de dificuldade
mantêm seus orçamentos e erros de direção/força.

As originais, a física global, as animações, o modelo de autoridade, a música,
a fonte Poppins e o minimapa limpo são preservados. A lentidão do Romeu continua
durando três tacadas pessoais completas; a duração da poça é independente.
Nas evoluções, as patrulhas verificam também as novas margens e pedras.

## Arquivos e reprodução

- `build/evolve-families.py`: vinte projetos explícitos com três etapas cada.
- `build/evolution-mesh.py`: deformação, recorte de piso, pedras e riachos.
- `build/generate-campaign.py`: catálogo, metadados e reconhecimento das originais.
- `data/campaign/manifest.json`: IDs únicos, cadeia de pais, operações e hashes.
- `src/golf/progress.h`, `ui.c`, `wildlife.c`, `garden.c`: seleção, saves e integração.
- `build/emscripten/`: trilha agrupada, filtros e rótulos nos três idiomas.
- `server/src/room.ts`, `index.ts`: seleção autorizada e sorteio no servidor.
- `server/native/bot.c`, `bot_layers.h`: planejamento sem alterar a física.

```sh
python build/generate-campaign.py --check
python -m unittest discover -s tests -p test_campaign_layouts.py
python build/verify-gameplay-assets.py
ctest --test-dir out/server-native --output-on-failure -j 2
cd server
npm test
node test/evolution-browser.mjs
node test/campaign-browser.mjs
```

Os testes nativos registrados executam a conclusão das **80 fases**, partindo
do spawn real, com colisões C e limite de 48 tacadas. Também verificam contato
e recuperação dos riachos, patrulhas seguras, efeitos individuais e os recordes
antigos. Os testes de navegador percorrem as 80 fases em desktop e celular
emulado, medindo buffers de cenário/animais, câmera, idiomas e estado compartilhado.
Na prova de percurso, a interferência dos animais é desativada; suas patrulhas
e efeitos são verificados separadamente em cada pista. Durante o jogo, seguem ativos.
Dispositivos Android/iOS físicos continuam dependendo de verificação manual.

### Resultado local de 20/10/2026

Passaram **122 testes nativos**, incluindo as 80 conclusões, **30 testes de
protocolo** e **5 testes de catálogo/imutabilidade**. As 80 fases foram renderizadas
em Chrome desktop e celular emulado, sem erros de WebGL. Também passaram o
fluxo solo/progressão, seleção manual por anfitrião, partida de dois navegadores,
reconexão, idiomas, Poppins, minimapa limpo e as ações de 50 jogadores em Impact.

O cenário chegou a **68.748 / 72.000 vértices**; o teste com 50 jogadores e
ações simultâneas usou **15.330 / 24.576 vértices de atores**. Os 706 arquivos
protegidos de mapas, modelos e lógica revisada mantiveram seus hashes esperados.
Os parâmetros de física e demais opções fora do catálogo são os mesmos de
`a2051c01`. Veja [o relatório por fase](family-validation.json).
