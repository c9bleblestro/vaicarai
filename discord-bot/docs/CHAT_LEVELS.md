# Níveis por conversa — vaicarai

## Como funciona

Quando o administrador ativa o módulo no `/painel` → `Abrir Funções` → `Níveis por chat`, mensagens normais dos membros do servidor concedem **12–20 XP** após um cooldown persistente de **45 segundos**. Mensagens copiadas iguais, links soltos, comandos e textos quase vazios não concedem XP. Bots e webhooks não participam.

O XP exclusivo do chat é guardado em `ChatLevelCooldown.chatXp` no PostgreSQL, separado da economia. A mesma tabela guarda o controle anti-farm. Todos começam no nível 0 com 0 XP; dados antigos de economia não são importados nem modificados. Configuração separada por servidor, desligada inicialmente.

Quando o XP total atingir um novo nível, o bot anuncia a subida uma única vez com uma imagem rosa e preta renderizada em PNG, com foto do Discord, nome real, níveis anterior/atual e barra do próximo nível. A imagem tem 1600×430 pixels e não contém botões falsos.

### Comandos

- `/painel` → `Abrir Funções` → `Níveis por chat` → `Ativar níveis` ou `Desativar níveis` (somente Gerenciar Servidor)
- `/nivel` (opcionalmente selecionando um membro) mostra o nível e o XP atual sem simular uma subida.

### Escala de XP

Do nível 0 para 1: 200 XP. Do nível 1 para 2: 280 XP adicionais. Depois o requisito cresce gradativamente. O XP antigo da economia continua preservado, mas não conta neste sistema.

### Deploy Railway

O `index.js` já chama `ensureChatLevelSchema()` antes de iniciar a sessão com o Discord. Isso cria as tabelas e a coluna novas de forma aditiva; não apaga a economia. As variáveis `DATABASE_URL` e `DISCORD_TOKEN` atuais continuam sendo usadas. O comando `/nivel` é registrado pelo carregador automático de comandos.

Para publicar, implante a branch principal atualizada no serviço Railway que já hospeda `discord-bot`. O merge no GitHub não garante que o Railway tenha efetuado o deploy; confira os logs e execute `/painel` para verificar o controle.
