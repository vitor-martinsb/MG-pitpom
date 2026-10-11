# Publicar PitPom Minigolfe no Render

1. Acesse https://dashboard.render.com e crie sua conta usando o GitHub.
2. Autorize acesso ao repositório `vitor-martinsb/MG-pitpom`.
3. Abra [Deploy to Render](https://render.com/deploy?repo=https://github.com/vitor-martinsb/MG-pitpom/tree/staging).
4. Confirme o serviço `pitpom-minigolfe`, a branch **staging** e o plano **Free**.
   Não crie banco de dados nem selecione um plano pago.
5. Espere o primeiro deploy terminar. Copie a URL HTTPS mostrada pelo Render.
6. Abra essa URL em dois navegadores; crie uma sala, entre com o mesmo código,
   inicie a partida, envie uma mensagem e faça uma tacada.
7. No GitHub, edite **About → Website** para apontar para a URL real do jogo.
   Acrescente também um link **Play online** ao README de `dev` e `staging`.

O botão de deploy configura a hospedagem; não é o endereço do jogo.
O subdomínio é atribuído pelo Render e só deve ser divulgado depois que o
serviço estiver saudável. Não é necessário domínio próprio ou túnel no PC.

## Configuração

O Dockerfile fixa Emscripten 6.0.11 e Node.js 22.23.3. Compila o cliente
WebAssembly, a física C para Linux e o TypeScript em etapas separadas. O
contêiner final executa como usuário sem privilégios e respeita `PORT`.
O servidor usa `/ws` para WebSocket e `/health` para verificação de saúde.
COOP/COEP são servidos pelo Node, permitindo as threads do WebAssembly via HTTPS.

O workflow `Validate game and deployment` compila o contêiner, testa os
20 mapas e valida assets, idiomas, chat, erros, física e reconexão. O Render
acompanha `staging` e atualiza depois dos checks aprovados.

## Verificar localmente

```sh
docker build -t pitpom .
docker run --rm -p 3000:10000 pitpom
```

Em outro terminal, depois de instalar as dependências de `server`:

```sh
cd server
npm run test:deployment -- --url http://localhost:3000
```

## Limites do plano gratuito

O endereço é fixo, mas o serviço suspende após 15 minutos sem tráfego e pode
levar cerca de um minuto para voltar. Salas e chat ficam em memória: reiniciar,
publicar uma nova versão ou suspender o servidor encerra as salas existentes.
O plano gratuito tem limites de CPU, horas, banda e minutos de build; 50
jogadores por sala é o limite funcional do jogo, não uma garantia de desempenho
nessa hospedagem. Consulte [os limites atuais do Render](https://render.com/docs/free).

Para investigar uma falha, abra os logs do serviço e a execução correspondente
na aba Actions do GitHub. Para voltar a uma versão anterior, faça um revert em
`dev`, valide e promova o commit para `staging`; preserve o histórico das branches.
