// ============================================================
// COMANDO: /vender
// Cria um painel de vendas com botão que abre as categorias/itens
// Quando um usuário clica, abre um ticket privado
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { db, savePanels } = require('../database');
const { CONFIG } = require('../index');

module.exports = {
  name: 'vender',
  data: new SlashCommandBuilder()
    .setName('vender')
    .setDescription('Cria um painel de vendas no canal atual'),

  async execute(interaction) {
    // Verificar se é o dono
    if (interaction.user.id !== CONFIG.OWNER_ID) {
      return interaction.reply({
        content: '❌ Apenas o dono do servidor pode usar este comando.',
        ephemeral: true,
      });
    }

    // Verificar se há itens para vender
    const itens = Object.values(db.itens).filter(i => i.quantidade > 0);
    if (itens.length === 0) {
      return interaction.reply({
        content: '❌ Nenhum item disponível para venda. Adicione itens com `/add_item` primeiro.',
        ephemeral: true,
      });
    }

    // Criar o embed do painel principal
    const embed = new EmbedBuilder()
      .setColor('#6c3ce0')
      .setTitle('🛒 Loja Online')
      .setDescription('Bem-vindo à nossa loja! Clique no botão abaixo para ver todos os itens disponíveis e realizar uma compra.')
      .addFields(
        { name: '📦 Itens disponíveis', value: `${itens.length} itens`, inline: true },
        { name: '📂 Categorias', value: `${Object.keys(db.categorias).length} categorias`, inline: true },
      )
      .setFooter({ text: 'Clique em "Ver Itens" para browsear os produtos.' })
      .setTimestamp();

    // Botão para ver itens
    const button = new ButtonBuilder()
      .setCustomId('btn_ver_itens')
      .setLabel('🛍️ Ver Itens')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    // Enviar o painel (não ephemeral — para todos verem)
    const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    // Salvar referência do painel
    db.paineis[message.id] = {
      criadoPor: interaction.user.id,
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      criadoEm: new Date().toISOString(),
    };
    savePanels();

    console.log(`[PAINEL] Painel de vendas criado: ${message.id}`);
  },
};
