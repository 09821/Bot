// ============================================================
// EVENTO: messageCreate
// Gerencia:
//   1. Fluxo do /add_item (coleta de dados em etapas)
//   2. Mensagens dentro dos tickets (comprovante, IP)
//   3. Forward de comprovantes para o dono
// ============================================================

const { EmbedBuilder } = require('discord.js');
const { db, saveTickets } = require('../database');
const { CONFIG } = require('../index');

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(message) {
    // Ignorar bots
    if (message.author.bot) return;

    // ---------- FLUXO DO /add_item ----------
    const { processAddItem } = require('../commands/add_item');
    const handled = await processAddItem(message);
    if (handled) return;

    // ---------- MENSAGENS NOS TICKETS ----------
    const ticket = db.tickets[message.channel.id];
    if (!ticket || ticket.status !== 'pendente') return;

    // Verificar se é o usuário dono do ticket
    if (message.author.id !== ticket.usuarioId) return;

    // ---------- VERIFICAR SE ENVIOU COMPROVANTE (imagem PNG/JPG) ----------
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      const validExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
      const ext = '.' + attachment.name.split('.').pop().toLowerCase();

      if (validExtensions.includes(ext)) {
        // Salvar URL do comprovante
        ticket.comprovantes.push({
          url: attachment.url,
          nome: attachment.name,
          enviadoEm: new Date().toISOString(),
        });
        saveTickets();

        // Confirmar ao usuário
        await message.reply('✅ Comprovante recebido! O dono do servidor vai verificar em breve.');

        // ---------- FORWARD DO COMPROVANTE PARA O DONO ----------
        try {
          const owner = await message.guild.members.fetch(CONFIG.OWNER_ID);
          const item = db.itens[ticket.itemId];

          const embedFwd = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('💳 Comprovante de Pagamento Recebido')
            .setDescription(`Um comprovante foi enviado no ticket de compra.`)
            .addFields(
              { name: '👤 Usuário', value: `<@${ticket.usuarioId}> (${ticket.usuarioId})`, inline: true },
              { name: '📦 Item', value: item ? item.nome : 'Desconhecido', inline: true },
              { name: '💰 Valor', value: item ? `R$ ${item.preco.toFixed(2)}` : '—', inline: true },
              { name: '🏷️ Canal do Ticket', value: `<#${message.channel.id}>`, inline: false },
              { name: '📎 Comprovantes enviados', value: `${ticket.comprovantes.length}`, inline: true },
            )
            .setImage(attachment.url) // Mostra a imagem no embed
            .setFooter({ text: 'Use /accept ou /refuse no canal do ticket.' })
            .setTimestamp();

          await owner.send({ embeds: [embedFwd] });
          console.log(`[TICKET] Comprovante enviado ao dono — Ticket: ${message.channel.id}`);
        } catch (e) {
          console.log('[TICKET] Erro ao enviar DM ao dono:', e.message);
        }

        return;
      }
    }

    // ---------- VERIFICAR SE ENVIOU O IP ----------
    // Detectar se a mensagem parece um IP (formato: xxx.xxx.xxx.xxx)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const contentTrimmed = message.content.trim();

    if (ipRegex.test(contentTrimmed) && !ticket.ip) {
      // Validar IP básico
      const parts = contentTrimmed.split('.').map(Number);
      const validIP = parts.every(p => p >= 0 && p <= 255);

      if (validIP) {
        ticket.ip = contentTrimmed;
        saveTickets();

        await message.reply(`✅ IP **${contentTrimmed}** registrado! A key será vinculada a este IP.`);
        console.log(`[TICKET] IP registrado — Ticket: ${message.channel.id} | IP: ${contentTrimmed}`);
        return;
      } else {
        await message.reply('⚠️ IP inválido. Por favor envie um IP válido (ex: 192.168.1.1).');
        return;
      }
    }

    // ---------- MENSAGEM GENÉRICA NO TICKET ----------
    // Se não for comprovante nem IP, apenas deixar a mensagem (conversa livre)
  },
};
