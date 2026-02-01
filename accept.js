// ============================================================
// COMANDO: /accept
// O dono aceita o pagamento e entrega a key + link de download
// Só funciona dentro de um ticket de compra
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db, saveTickets } = require('../database');
const { CONFIG } = require('../index');
const { generateKey } = require('../keyGenerator');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'accept',
  data: new SlashCommandBuilder()
    .setName('accept')
    .setDescription('Aceita o pagamento e entrega a key ao comprador (apenas no ticket)'),

  async execute(interaction) {
    // Verificar se é o dono
    if (interaction.user.id !== CONFIG.OWNER_ID) {
      return interaction.reply({
        content: '❌ Apenas o dono do servidor pode usar este comando.',
        ephemeral: true,
      });
    }

    // Verificar se estamos em um ticket
    const ticket = db.tickets[interaction.channel.id];
    if (!ticket) {
      return interaction.reply({
        content: '❌ Este comando só pode ser usado dentro de um ticket de compra.',
        ephemeral: true,
      });
    }

    // Verificar se já foi aceito
    if (ticket.status === 'aceito') {
      return interaction.reply({
        content: '❌ Este ticket já foi aceito anteriormente.',
        ephemeral: true,
      });
    }

    // Verificar se há pelo menos um comprovante
    if (!ticket.comprovantes || ticket.comprovantes.length === 0) {
      return interaction.reply({
        content: '⚠️ O usuário ainda não enviou nenhum comprovante de pagamento.',
        ephemeral: true,
      });
    }

    // Obter item
    const item = db.itens[ticket.itemId];
    if (!item) {
      return interaction.reply({
        content: '❌ Item não encontrado no banco de dados.',
        ephemeral: true,
      });
    }

    // Verificar estoque
    if (item.quantidade <= 0) {
      return interaction.reply({
        content: '❌ O item já está sem estoque.',
        ephemeral: true,
      });
    }

    // ---------- OBTER IP DO USUÁRIO ----------
    // Como não temos acesso direto ao IP no Discord,
    // o usuário precisa enviar seu IP manualmente no ticket.
    // O bot já solicitou isso na mensagem de abertura do ticket.
    if (!ticket.ip) {
      return interaction.reply({
        content: '⚠️ O usuário ainda não informou seu IP. Aguarde ele enviar.',
        ephemeral: true,
      });
    }

    // ---------- GERAR KEY ----------
    const key = generateKey(ticket.ip);

    // ---------- SALVAR KEY no arquivo keys.json ----------
    const keysPath = path.join(__dirname, '..', 'data', 'keys.json');
    let keys = {};
    try {
      if (fs.existsSync(keysPath)) {
        keys = JSON.parse(fs.readFileSync(keysPath, 'utf-8'));
      }
    } catch (e) { /* ignore */ }

    keys[key] = {
      ip: ticket.ip,
      userId: ticket.usuarioId,
      itemId: ticket.itemId,
      criadoEm: new Date().toISOString(),
    };
    fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2), 'utf-8');

    // ---------- DIMINUIR ESTOQUE ----------
    item.quantidade -= 1;
    const { saveItems } = require('../database');
    saveItems();

    // ---------- ATUALIZAR TICKET ----------
    ticket.status = 'aceito';
    ticket.key = key;
    saveTickets();

    // ---------- ENVIAR KEY NO TICKET ----------
    const embedTicket = new EmbedBuilder()
      .setColor('#00ff88')
      .setTitle('✅ Pagamento Aceito!')
      .setDescription('Seu pagamento foi confirmado com sucesso! Abaixo estão os seus dados de acesso.')
      .addFields(
        { name: '🔑 Sua Key', value: `\`${key}\``, inline: false },
        { name: '🌐 IP Vinculado', value: `\`${ticket.ip}\``, inline: true },
        { name: '📦 Item', value: item.nome, inline: true },
        { name: '🔗 Link de Download', value: item.linkDownload, inline: false },
      )
      .setFooter({ text: 'A key funciona APENAS no IP informado. Não compartilhe!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embedTicket] });

    // ---------- ENVIAR DM AO USUÁRIO (backup) ----------
    try {
      const usuario = await interaction.guild.members.fetch(ticket.usuarioId);
      const embedDM = new EmbedBuilder()
        .setColor('#00ff88')
        .setTitle('✅ Compra Concluída!')
        .setDescription(`Sua compra de **${item.nome}** foi confirmada!`)
        .addFields(
          { name: '🔑 Key', value: `\`${key}\``, inline: false },
          { name: '🌐 IP Vinculado', value: `\`${ticket.ip}\``, inline: true },
          { name: '🔗 Download', value: item.linkDownload, inline: false },
        )
        .setFooter({ text: 'A key só funciona no IP que você informou!' });

      await usuario.send({ embeds: [embedDM] });
    } catch (e) {
      console.log('[ACCEPT] Não foi possível enviar DM ao usuário:', e.message);
    }

    // ---------- LOG NO CONSOLE ----------
    console.log(`[ACCEPT] Pagamento aceito — Usuário: ${ticket.usuarioId} | Item: ${item.nome} | Key: ${key} | IP: ${ticket.ip}`);
  },
};
