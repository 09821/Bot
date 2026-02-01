// ============================================================
// EVENTO: ready
// Registra os comandos slash quando o bot conecta
// ============================================================

const { REST, Routes } = require('discord.js');
const path = require('path');
const fs = require('fs');

module.exports = {
  name: 'ready',
  once: true,

  async execute(client) {
    console.log(`[BOT] Conectado como ${client.user.tag}`);

    // Carregar todos os comandos
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    const commands = [];
    for (const file of commandFiles) {
      const cmd = require(path.join(commandsPath, file));
      if (cmd.data) {
        commands.push(cmd.data.toJSON());
      }
    }

    // Registrar comandos no servidor específico (mais rápido que global)
    const { CONFIG } = require('../index');
    const rest = new REST().setToken(CONFIG.TOKEN);

    try {
      console.log(`[SLASH] Registrando ${commands.length} comandos...`);

      const data = await rest.put(
        Routes.guildCommands(client.user.id, CONFIG.GUILD_ID),
        { body: commands }
      );

      console.log(`[SLASH] ${data.length} comandos registrados com sucesso!`);
      data.forEach(cmd => console.log(`  ✅ /${cmd.name}`));
    } catch (error) {
      console.error('[SLASH] Erro ao registrar comandos:', error);
    }
  },
};
