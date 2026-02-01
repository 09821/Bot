// ============================================================
// BOT DE VENDAS DISCORD - index.js (Entry Point)
// ============================================================

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { initDB, db } = require('./database');
const path = require('path');
const fs = require('fs');

// ---------- CONFIGURAÇÕES ----------
const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN || 'SEU_TOKEN_AQUI',
  GUILD_ID: process.env.GUILD_ID || 'ID_DO_SERVIDOR',
  OWNER_ID: process.env.OWNER_ID || 'ID_DO_DONO',
  PING_INTERVAL_MS: 60000, // ping a cada 1 minuto para manter online
};

// ---------- CLIENTE DISCORD ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageAttachments,
  ],
});

client.commands = new Collection();

// ---------- CARREGAR COMANDOS ----------
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.name) {
    client.commands.set(command.name, command);
  }
}

// ---------- CARREGAR EVENTOS ----------
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// ---------- KEEP ALIVE (mantém o bot online 24/7) ----------
// Se você hospedar em um serviço como Render/Replit, use um serviço externo
// para fazer ping no endpoint HTTP abaixo.
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot está online!');
});

server.listen(process.env.PORT || 3000, () => {
  console.log('[KEEP-ALIVE] Servidor HTTP rodando na porta', process.env.PORT || 3000);
});

// Ping interno a cada minuto (backup)
setInterval(() => {
  const port = process.env.PORT || 3000;
  http.get(`http://localhost:${port}`, (res) => {
    // console.log('[PING] Status:', res.statusCode);
  }).on('error', () => {});
}, CONFIG.PING_INTERVAL_MS);

// ---------- LOGIN ----------
async function start() {
  await initDB(); // inicializa o banco de dados
  client.login(CONFIG.TOKEN);
}

start();

module.exports = { client, CONFIG };
