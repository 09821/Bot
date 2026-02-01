// ============================================================
// COMANDO: /refuse
// O dono recusa o pagamento, informa motivo,
// fecha o canal e manda DM ao usuário
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db, saveTickets } = require('../database');
const { CONFIG } = require('../index');

module.exports = {
  name: 'refuse',
  data: new SlashCommandBuilder()
    .setName('refuse')
    .setDescription('Recusa o pagamento e fecha o ticket')
    .addStringOption(option =>
      option.setName('motivo')
        .setDescription('Motivo da recusa')
        .setRequired(true)
    ),

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

    const motivo = interaction.options.getString('motivo');
    const item = db.itens[ticket.itemId];
    const itemNome = item ? item.nome : 'Item desconhecido';

    // ---------- ATUALIZAR TICKET ----------
    ticket.status = 'recusado';
    ticket.motivoRecusa = motivo;
    saveTickets();

    // ---------- ENVIAR MENSAGEM NO TICKET ANTES DE FECHAR ----------
    const embedRecusa = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Pagamento Recusado')
      .setDescription(`O pagamento para **${itemNome}** foi recusado pelo dono do servidor.`)
      .addFields(
        { name: '📝 Motivo', value: motivo, inline: false },
      )
      .setFooter({ text: 'Este canal será fechado em instantes.' })
      .setTimestamp();

    await interaction.reply({ embeds: [embedRecusa] });

    // ---------- ENVIAR DM AO USUÁRIO ----------
    try {
      const usuario = await interaction.guild.members.fetch(ticket.usuarioId);
      const embedDM = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Sua compra foi recusada')
        .setDescription(`Sua tentativa de comprar **${itemNome}** foi recusada.`)
        .addFields(
          { name: '📝 Motivo', value: motivo, inline: false },
          { name: '💡 O que fazer?', value: 'Verifique as informações e tente novamente, ou entre em contato com o dono do servidor.', inline: false },
        )
        .setTimestamp();

      await usuario.send({ embeds: [embedDM] });
      console.log(`[REFUSE] DM enviado ao usuário ${ticket.usuarioId}`);
    } catch (e) {
      console.log('[REFUSE] Não foi possível enviar DM:', e.message);
    }

    // ---------- FECHAR O CANAL (após 3 segundos para mensagem aparecer) ----------
    setTimeout(async () => {
      try {
        await interaction.channel.setName(`fechado-${interaction.channel.name}`);
        await interaction.channel.setTopic('❌ Ticket fechado — Pagamento recusado');
        await interaction.channel.setArchived(true);  // se for thread
        console.log(`[REFUSE] Canal ${interaction.channel.id} fechado.`);
      } catch (e) {
        // Se não for thread, tentar deletar
        try {
          await interaction.channel.delete('Ticket recusado pelo dono');
          console.log(`[REFUSE] Canal ${interaction.channel.id} deletado.`);
        } catch (e2) {
          console.log('[REFUSE] Erro ao fechar canal:', e2.message);
        }
      }
    }, 3000);
  },
};
