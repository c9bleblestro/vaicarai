# Níveis por conversa — vaicarai

## Como funciona

Quando o administrador ativa o módulo no `/painel` → `Abrir Funções` → `Níveis por chat`, mensagens normais dos membros do servidor concedem **1 XP por mensagem válida**, sem cooldown entre mensagens diferentes. Mensagens copiadas iguais, links soltos, comandos e textos quase vazios não concedem XP. Bots e webhooks não participam.

O contador exclusivo do chat é guardado em `ChatLevelCooldown.chatMessages` no PostgreSQL, separado da economia. A mesma tabela guarda o controle anti-farm. Novos membros começam no nível 0 com 0 XP. O XP de conversa anterior é convertido uma única vez, preservando o nível e a fração de progresso (arredondada para baixo); os dados antigos ficam intactos. Configuração separada por servidor, desligada inicialmente.

Quando o XP total atingir um novo nível, o bot anuncia a subida uma única vez com uma imagem rosa e preta renderizada em PNG, com foto do Discord, nome real, níveis anterior/atual e barra do próximo nível. A imagem tem 1600×430 pixels e não contém botões falsos.

### Comandos

- `/painel` → `Abrir Funções` → `Níveis por chat` → `Ativar níveis` ou `Desativar níveis` (somente Gerenciar Servidor)
- `/nivel` (opcionalmente selecionando um membro) mostra o nível e o XP atual sem simular uma subida. Os prefixos `s nivel` e `savage nivel` consultam os mesmos dados.
- `/perfil` e seus prefixos e botão Atualizar mostram o mesmo nível e XP de conversa; o XP anterior da economia permanece no banco e não é usado para esses cards.

### Escala de XP

Cada 50 mensagens válidas (50 XP) concedem exatamente um nível. Mensagens diferentes não têm cooldown; repetições consecutivas idênticas são bloqueadas por 5 minutos. O XP antigo da economia continua preservado, mas não conta neste sistema.

### Deploy Railway

O `index.js` já chama `ensureChatLevelSchema()` antes de iniciar a sessão com o Discord. Isso cria as tabelas e a coluna novas de forma aditiva; não apaga a economia. As variáveis `DATABASE_URL` e `DISCORD_TOKEN` atuais continuam sendo usadas. O comando `/nivel` é registrado pelo carregador automático de comandos.

Para publicar, implante a branch principal atualizada no serviço Railway que já hospeda `discord-bot`. O merge no GitHub não garante que o Railway tenha efetuado o deploy; confira os logs e execute `/painel` para verificar o controle.
