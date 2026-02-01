# 🛒 Bot de Vendas Discord — Com Keys Vinculadas a IP

Um bot completo de vendas para Discord que gera keys únicas vinculadas ao IP do comprador.

---

## 📁 Estrutura do Projeto

```
bot_vendas/
├── index.js              → Entry point (login, keep-alive, carrega comandos)
├── database.js           → Banco de dados em JSON
├── keyGenerator.js       → Gerador de keys vinculadas a IP
├── painel.html           → Painel web para visualizar dados
├── package.json
├── .env.example          → Exemplo de configurações
├── commands/
│   ├── add_categoria.js  → /add_categoria
│   ├── add_item.js       → /add_item (fluxo em etapas)
│   ├── vender.js         → /vender (cria painel de vendas)
│   ├── accept.js         → /accept (aceita pagamento, entrega key)
│   └── refuse.js         → /refuse (recusa pagamento)
├── events/
│   ├── ready.js          → Registra slash commands
│   ├── interactionCreate.js → Botões, select menus, comandos
│   └── messageCreate.js  → Mensagens nos tickets + fluxo do add_item
└── data/                 → (criado automaticamente)
    ├── categorias.json
    ├── itens.json
    ├── tickets.json
    ├── paineis.json
    └── keys.json
```

---

## ⚙️ Como Configurar

### 1. Instalar dependências
```bash
npm install
```

### 2. Criar o arquivo .env
Copie `.env.example` para `.env` e preencha:
```bash
cp .env.example .env
```

Edite o `.env`:
```
DISCORD_TOKEN=seu_token_do_bot
GUILD_ID=id_do_servidor
OWNER_ID=seu_id_no_discord
KEY_SECRET=coloque_um_segredo_aqui
PORT=3000
```

### 3. Criar o bot no Discord Developer Portal
- Acesse: https://discord.com/developers/applications
- Crie uma nova aplicação
- Vá em **Bot** e copie o **Token**
- Ative as **Intents**: `Server Members`, `Message Content`
- Convide o bot para o servidor com as permissões: `Gerenciar Canais`, `Enviar Mensagens`, `Annexar Arquivos`, `Ver Canais`

### 4. Rodar o bot
```bash
npm start
```

---

## 📋 Comandos Disponíveis

| Comando | Descrição | Quem pode usar |
|---|---|---|
| `/add_categoria` | Adiciona uma categoria de vendas | Dono |
| `/add_item` | Adiciona um item (fluxo interativo em 6 etapas) | Dono |
| `/vender` | Cria um painel de vendas com botão | Dono |
| `/accept` | Aceita pagamento e entrega key (dentro do ticket) | Dono |
| `/refuse` | Recusa pagamento com motivo (dentro do ticket) | Dono |

---

## 🔄 Como o Fluxo Funciona

### Dono (vendedor):
1. Usa `/add_categoria` para criar categorias
2. Usa `/add_item` para adicionar itens (nome → preço → quantidade → chave pix → categoria → link download)
3. Usa `/vender` para criar o painel de vendas no canal

### Cliente (comprador):
1. Vê o painel e clica **"Ver Itens"**
2. Seleciona uma categoria
3. Clica **"Comprar"** no item desejado
4. Um canal privado (ticket) é criado automaticamente
5. O bot mostra a chave Pix e as instruções
6. O cliente envia o **comprovante** (PNG/JPG) e seu **IP**
7. O dono recebe notificação com o comprovante via DM

### Dono (verificação):
1. Entra no canal do ticket
2. Verifica o comprovante
3. Usa `/accept` → o bot gera a key vinculada ao IP e enrega junto com o link de download
4. ou usa `/refuse motivo` → fecha o canal e envia DM ao cliente com o motivo

---

## 🔑 Como as Keys Funcionam

- Cada key é gerada usando **SHA-256** combinando: `IP + segredo + timestamp`
- A key é **única** e só funciona no IP que foi informado
- As keys são salvas em `data/keys.json` para validação posterior
- No seu app (Sketchware), faça uma requisição ao servidor (ou valide localmente) comparando a key com o IP

### Integrar no App (Sketchware):
Para usar a key no seu app, você precisa criar um endpoint de validação. Exemplo simples com um servidor:

```javascript
// server-validar.js (rodado separadamente se necessário)
const http = require('http');
const fs = require('fs');
const path = require('path');

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/validar') {
    const key = url.searchParams.get('key');
    const keys = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'keys.json'), 'utf-8'));

    // Obter IP do cliente
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (keys[key] && keys[key].ip === ip) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: true, message: 'Key válida!' }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, message: 'Key inválida ou IP não corresponde.' }));
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
}).listen(3001, () => console.log('Servidor de validação rodando na porta 3001'));
```

No Sketchware, faça um HTTP GET para:
```
http://seu-servidor:3001/validar?key=KEY-xxxxx
```

---

## 📊 Painel HTML

O arquivo `painel.html` pode ser aberto diretamente no navegador. Ele carrega os dados dos arquivos JSON em `data/`.

Para que funcione com fetch, serve os arquivos com um servidor estático simples ou coloque o `painel.html` na mesma pasta raiz do projeto.

---

## 🔧 Keep-Alive (24/7)

O bot already roda um servidor HTTP na porta definida no `.env` (padrão: 3000).

Para manter online 24/7, use um serviço como:
- **Render** (https://render.com) — gratuito com limitações
- **Railway** (https://railway.app)
- **Replit** — configure o Keep Awake

Aponte um serviço de uptime monitoring (como UptimeRobot) para fazer ping no endpoint HTTP do seu host.

---

## ⚠️ Notas Importantes

- O **IP do usuário** é informado manualmente pelo comprador no ticket (o Discord não expõe IPs)
- Para validação mais segura, use um servidor intermediário que captura o IP real via `X-Forwarded-For`
- A chave Pix é a mesma para todos os itens criados pelo mesmo dono — você pode alterar isso no fluxo do `/add_item`
- Os dados são salvos em arquivos JSON na pasta `data/` — sem necessidade de banco de dados externo
