// ============================================================
// COMANDO: /add_item
// Adiciona um item para venda com: nome, preço, quantidade,
// chave pix, categoria e link de download
// Apenas o dono do servidor pode usar
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
const { db, saveItems, generateId } = require('../database');
const { CONFIG } = require('../index');

// Estado temporário para coleta de dados do item
// { userId: { step, nome, preco, quantidade, chavePix, categoriaId, linkDownload } }
const addItemState = {};

module.exports = {
  name: 'add_item',
  data: new SlashCommandBuilder()
    .setName('add_item')
    .setDescription('Adiciona um item para venda (processo em etapas)'),

  addItemState, // exportar para uso no evento de mensagem

  async execute(interaction) {
    // Verificar se é o dono
    if (interaction.user.id !== CONFIG.OWNER_ID) {
      return interaction.reply({
        content: '❌ Apenas o dono do servidor pode usar este comando.',
        ephemeral: true,
      });
    }

    // Verificar se há categorias
    const categorias = Object.entries(db.categorias);
    if (categorias.length === 0) {
      return interaction.reply({
        content: '❌ Nenhuma categoria existe ainda! Use `/add_categoria` primeiro.',
        ephemeral: true,
      });
    }

    // Passo 1: Pedir o nome do item
    addItemState[interaction.user.id] = {
      step: 'nome',
      interactionChannel: interaction.channel,
    };

    const embed = new EmbedBuilder()
      .setColor('#ff9900')
      .setTitle('📦 Adicionar Item')
      .setDescription('Vamos adicionar um item para venda! Siga as etapas abaixo.')
      .addFields(
        { name: '📝 Etapa atual', value: '1/6 — **Nome do item**', inline: false },
      )
      .setFooter({ text: 'Digite o nome do item na mensagem abaixo. Type "cancelar" para cancelar.' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

// ============================================================
// FUNÇÃO AUXILIAR: Processa cada etapa do add_item
// Chamada pelo evento messageCreate
// ============================================================
async function processAddItem(message) {
  const state = addItemState[message.author.id];
  if (!state) return false;

  const userId = message.author.id;
  const content = message.content.trim();

  // Permitir cancelar a qualquer momento
  if (content.toLowerCase() === 'cancelar') {
    delete addItemState[userId];
    await message.reply('❌ Criação do item cancelada.');
    return true;
  }

  switch (state.step) {
    // ---------- NOME ----------
    case 'nome': {
      if (content.length < 2 || content.length > 100) {
        await message.reply('⚠️ O nome deve ter entre 2 e 100 caracteres. Tente novamente.');
        return true;
      }
      state.nome = content;
      state.step = 'preco';

      const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('📦 Adicionar Item')
        .addFields({ name: '📝 Etapa atual', value: '2/6 — **Preço (em R$)**', inline: false })
        .setDescription(`✅ Nome: **${state.nome}**\n\nAgora informe o preço em reais (ex: 29.90)`)
        .setFooter({ text: 'Digite o preço.' });

      await message.reply({ embeds: [embed] });
      return true;
    }

    // ---------- PREÇO ----------
    case 'preco': {
      const preco = parseFloat(content.replace(',', '.'));
      if (isNaN(preco) || preco <= 0) {
        await message.reply('⚠️ Insira um preço válido (ex: 29.90 ou 29,90).');
        return true;
      }
      state.preco = preco;
      state.step = 'quantidade';

      const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('📦 Adicionar Item')
        .addFields({ name: '📝 Etapa atual', value: '3/6 — **Quantidade em estoque**', inline: false })
        .setDescription(`✅ Nome: **${state.nome}**\n✅ Preço: **R$ ${preco.toFixed(2)}**\n\nAgora informe a quantidade em estoque.`)
        .setFooter({ text: 'Digite a quantidade.' });

      await message.reply({ embeds: [embed] });
      return true;
    }

    // ---------- QUANTIDADE ----------
    case 'quantidade': {
      const qty = parseInt(content);
      if (isNaN(qty) || qty <= 0 || qty > 99999) {
        await message.reply('⚠️ Insira uma quantidade válida (número inteiro positivo).');
        return true;
      }
      state.quantidade = qty;
      state.step = 'chavePix';

      const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('📦 Adicionar Item')
        .addFields({ name: '📝 Etapa atual', value: '4/6 — **Chave Pix**', inline: false })
        .setDescription(`✅ Nome: **${state.nome}**\n✅ Preço: **R$ ${state.preco.toFixed(2)}**\n✅ Quantidade: **${qty}**\n\nAgora informe sua chave Pix (CPF, CNPJ, email ou celular).`)
        .setFooter({ text: 'Digite sua chave Pix.' });

      await message.reply({ embeds: [embed] });
      return true;
    }

    // ---------- CHAVE PIX ----------
    case 'chavePix': {
      if (content.length < 3 || content.length > 100) {
        await message.reply('⚠️ Chave Pix inválida. Tente novamente.');
        return true;
      }
      state.chavePix = content;
      state.step = 'categoria';

      // Mostrar categorias para selecionar
      const categorias = Object.entries(db.categorias);
      const options = categorias.map(([id, cat]) => ({
        label: cat.nome,
        value: id,
        description: `Categoria: ${cat.nome}`,
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_categoria_${userId}`)
        .setPlaceholder('Selecione uma categoria')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('📦 Adicionar Item')
        .addFields({ name: '📝 Etapa atual', value: '5/6 — **Categoria**', inline: false })
        .setDescription(`✅ Nome: **${state.nome}**\n✅ Preço: **R$ ${state.preco.toFixed(2)}**\n✅ Quantidade: **${state.quantidade}**\n✅ Chave Pix: **${state.chavePix}**\n\nSelecione a categoria abaixo:`)
        .setFooter({ text: 'Selecione no menu abaixo.' });

      await message.reply({ embeds: [embed], components: [row] });
      return true;
    }

    // ---------- LINK DE DOWNLOAD ----------
    case 'linkDownload': {
      // Validar se parece um link
      if (!content.startsWith('http://') && !content.startsWith('https://')) {
        await message.reply('⚠️ Insira um link válido começando com http:// ou https://');
        return true;
      }
      state.linkDownload = content;

      // ---------- CRIAR O ITEM ----------
      const itemId = generateId();
      db.itens[itemId] = {
        nome: state.nome,
        preco: state.preco,
        quantidade: state.quantidade,
        chavePix: state.chavePix,
        categoriaId: state.categoriaId,
        linkDownload: state.linkDownload,
        criadoPor: userId,
        criadoEm: new Date().toISOString(),
      };
      saveItems();

      const categoriaNome = db.categorias[state.categoriaId]?.nome || 'Desconhecida';

      const embed = new EmbedBuilder()
        .setColor('#00ff88')
        .setTitle('✅ Item Criado com Sucesso!')
        .addFields(
          { name: '📦 Nome', value: state.nome, inline: true },
          { name: '💰 Preço', value: `R$ ${state.preco.toFixed(2)}`, inline: true },
          { name: '📊 Quantidade', value: `${state.quantidade}`, inline: true },
          { name: '💳 Chave Pix', value: state.chavePix, inline: true },
          { name: '📂 Categoria', value: categoriaNome, inline: true },
          { name: '🔗 Link Download', value: state.linkDownload, inline: false },
          { name: '🏷️ ID do Item', value: itemId, inline: true },
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      // Limpar estado
      delete addItemState[userId];
      return true;
    }

    default:
      return false;
  }
}

module.exports.processAddItem = processAddItem;
