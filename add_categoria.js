// ============================================================
// COMANDO: /add_categoria
// Adiciona uma nova categoria de vendas
// Apenas o dono do servidor pode usar
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db, saveCategory, generateId } = require('../database');
const { CONFIG } = require('../index');

module.exports = {
  name: 'add_categoria',
  data: new SlashCommandBuilder()
    .setName('add_categoria')
    .setDescription('Adiciona uma nova categoria de vendas')
    .addStringOption(option =>
      option.setName('nome')
        .setDescription('Nome da categoria')
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

    const nome = interaction.options.getString('nome');

    // Verificar se a categoria já existe
    const existe = Object.values(db.categorias).find(
      c => c.nome.toLowerCase() === nome.toLowerCase()
    );
    if (existe) {
      return interaction.reply({
        content: `❌ A categoria **${nome}** já existe!`,
        ephemeral: true,
      });
    }

    // Criar categoria
    const id = generateId();
    db.categorias[id] = {
      nome: nome,
      criadoPor: interaction.user.id,
      criadoEm: new Date().toISOString(),
    };
    saveCategory();

    const embed = new EmbedBuilder()
      .setColor('#00ff88')
      .setTitle('✅ Categoria Criada!')
      .setDescription(`A categoria **${nome}** foi criada com sucesso.`)
      .addFields(
        { name: '📂 ID', value: id, inline: true },
        { name: '👤 Criado por', value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
