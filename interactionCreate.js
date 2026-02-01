// ============================================================
// EVENTO: interactionCreate
// Gerencia: comandos slash, botões e select menus
// ============================================================

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { db, saveTickets } = require('../database');
const { CONFIG } = require('../index');

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction) {
    // ---------- COMANDOS SLASH ----------
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: '❌ Comando não encontrado.', ephemeral: true });
      }
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`[CMD] Erro no comando ${interaction.commandName}:`, error);
        const msg = interaction.deferred || interaction.replied
          ? interaction.followUp
          : interaction.reply;
        await msg.call(interaction, { content: '❌ Ocorreu um erro ao executar o comando.', ephemeral: true });
      }
      return;
    }

    // ---------- BOTÃO: Ver Itens ----------
    if (interaction.isButton() && interaction.customId === 'btn_ver_itens') {
      await handleVerItens(interaction);
      return;
    }

    // ---------- BOTÃO: Comprar Item ----------
    if (interaction.isButton() && interaction.customId.startsWith('btn_comprar_')) {
      const itemId = interaction.customId.replace('btn_comprar_', '');
      await handleComprarItem(interaction, itemId);
      return;
    }

    // ---------- SELECT MENU: Categorias ----------
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_categorias_loja') {
      await handleSelectCategoria(interaction);
      return;
    }

    // ---------- SELECT MENU: Categoria no add_item ----------
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_categoria_')) {
      await handleSelectCategoriaAddItem(interaction);
      return;
    }
  },
};

// ============================================================
// Quando clica em "Ver Itens" no painel principal
// Mostra as categorias disponíveis
// ============================================================
async function handleVerItens(interaction) {
  const categorias = Object.entries(db.categorias);
  if (categorias.length === 0) {
    return interaction.reply({ content: '❌ Nenhuma categoria disponível.', ephemeral: true });
  }

  // Verificar se há itens em cada categoria
  const categoriasComItens = categorias.filter(([catId]) => {
    return Object.values(db.itens).some(item => item.categoriaId === catId && item.quantidade > 0);
  });

  if (categoriasComItens.length === 0) {
    return interaction.reply({ content: '❌ Nenhum item disponível no momento.', ephemeral: true });
  }

  const options = categoriasComItens.map(([id, cat]) => {
    const count = Object.values(db.itens).filter(i => i.categoriaId === id && i.quantidade > 0).length;
    return {
      label: cat.nome,
      value: id,
      description: `${count} item(s) disponível(eis)`,
    };
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_categorias_loja')
    .setPlaceholder('Selecione uma categoria')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setColor('#6c3ce0')
    .setTitle('📂 Categorias')
    .setDescription('Selecione uma categoria abaixo para ver os itens disponíveis:')
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// ============================================================
// Quando seleciona uma categoria na loja
// Mostra os itens dessa categoria com botões de compra
// ============================================================
async function handleSelectCategoria(interaction) {
  const categoriaId = interaction.values[0];
  const categoria = db.categorias[categoriaId];

  if (!categoria) {
    return interaction.reply({ content: '❌ Categoria não encontrada.', ephemeral: true });
  }

  // Buscar itens da categoria com estoque
  const itens = Object.entries(db.itens).filter(
    ([id, item]) => item.categoriaId === categoriaId && item.quantidade > 0
  );

  if (itens.length === 0) {
    return interaction.reply({ content: '❌ Nenhum item disponível nesta categoria.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor('#6c3ce0')
    .setTitle(`📂 ${categoria.nome}`)
    .setDescription('Aqui estão os itens disponíveis nesta categoria:')
    .setTimestamp();

  const rows = [];

  itens.forEach(([itemId, item]) => {
    embed.addFields({
      name: `📦 ${item.nome}`,
      value: `💰 **R$ ${item.preco.toFixed(2)}** | 📊 Estoque: ${item.quantidade}`,
      inline: false,
    });

    // Criar botão de compra para cada item
    const btn = new ButtonBuilder()
      .setCustomId(`btn_comprar_${itemId}`)
      .setLabel(`Comprar — R$ ${item.preco.toFixed(2)}`)
      .setStyle(ButtonStyle.Success);

    rows.push(new ActionRowBuilder().addComponents(btn));
  });

  // Limitar a 5 botões por mensagem (limite do Discord)
  const rowsLimited = rows.slice(0, 5);

  await interaction.reply({ embeds: [embed], components: rowsLimited, ephemeral: true });
}

// ============================================================
// Quando clica em "Comprar" um item específico
// Cria um ticket (canal privado) para a transação
// ============================================================
async function handleComprarItem(interaction, itemId) {
  const item = db.itens[itemId];
  if (!item) {
    return interaction.reply({ content: '❌ Item não encontrado.', ephemeral: true });
  }

  if (item.quantidade <= 0) {
    return interaction.reply({ content: '❌ Este item já está sem estoque.', ephemeral: true });
  }

  // Verificar se o usuário já tem um ticket aberto
  const ticketExistente = Object.entries(db.tickets).find(
    ([chId, ticket]) => ticket.usuarioId === interaction.user.id && ticket.status === 'pendente'
  );
  if (ticketExistente) {
    return interaction.reply({
      content: '⚠️ Você já possui um ticket de compra aberto. Finalize ou cancele antes de criar outro.',
      ephemeral: true,
    });
  }

  // ---------- CRIAR CANAL PRIVADO (TICKET) ----------
  const guild = interaction.guild;

  // Criar canal de texto privado
  const ticketChannel = await guild.channels.create({
    name: `compra-${interaction.user.username}-${Date.now().toString(36)}`,
    type: 0, // GUILD_TEXT
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: ['ViewChannel', 'SendMessages'],
      },
      {
        id: interaction.user.id,
        allow: ['ViewChannel', 'SendMessages', 'AttachFiles'],
      },
      {
        id: CONFIG.OWNER_ID,
        allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'ManageChannels'],
      },
    ],
  });

  // ---------- SALVAR TICKET NO DB ----------
  db.tickets[ticketChannel.id] = {
    usuarioId: interaction.user.id,
    itemId: itemId,
    status: 'pendente',
    comprovantes: [],
    ip: null,
    criadoEm: new Date().toISOString(),
  };
  saveTickets();

  // ---------- ENVIAR INSTRUÇÕES NO TICKET ----------
  const embedTicket = new EmbedBuilder()
    .setColor('#ff9900')
    .setTitle('🛒 Ticket de Compra Aberto')
    .setDescription(`Olá **${interaction.user.username}**! Seu ticket de compra foi criado.`)
    .addFields(
      { name: '📦 Item', value: item.nome, inline: true },
      { name: '💰 Preço', value: `R$ ${item.preco.toFixed(2)}`, inline: true },
      { name: '📊 Estoque', value: `${item.quantidade}`, inline: true },
      { name: '💳 Chave Pix', value: `\`${item.chavePix}\``, inline: false },
    )
    .setDescription(`Olá **${interaction.user.username}**!\n\nPara completar sua compra, siga os passos abaixo:\n\n**1️⃣** Faça o pagamento de **R$ ${item.preco.toFixed(2)}** na chave Pix: \`${item.chavePix}\`\n**2️⃣** Envie o **comprovante de pagamento** (screenshot PNG) neste canal\n**3️⃣** Informe seu **IP** (para gerar a key vinculada ao seu IP)\n\n> 💡 A key gerada só vai funcionar no IP que você informar!`)
    .setFooter({ text: 'O dono do servidor vai verificar o pagamento e liberar sua key.' })
    .setTimestamp();

  await ticketChannel.send({ embeds: [embedTicket] });

  // Responder ao usuário
  await interaction.reply({
    content: `✅ Ticket criado! Acesse o canal ${ticketChannel} para completar sua compra.`,
    ephemeral: true,
  });

  console.log(`[TICKET] Novo ticket criado — Canal: ${ticketChannel.id} | Usuário: ${interaction.user.id} | Item: ${item.nome}`);
}

// ============================================================
// Select menu do /add_item — seleciona a categoria do item
// ============================================================
async function handleSelectCategoriaAddItem(interaction) {
  const userId = interaction.user.id;
  const { addItemState } = require('../commands/add_item');
  const state = addItemState[userId];

  if (!state || state.step !== 'categoria') {
    return interaction.reply({ content: '❌ Estado inválido.', ephemeral: true });
  }

  state.categoriaId = interaction.values[0];
  state.step = 'linkDownload';

  const categoriaNome = db.categorias[state.categoriaId]?.nome || 'Desconhecida';

  const embed = new EmbedBuilder()
    .setColor('#ff9900')
    .setTitle('📦 Adicionar Item')
    .addFields({ name: '📝 Etapa atual', value: '6/6 — **Link de Download**', inline: false })
    .setDescription(`✅ Nome: **${state.nome}**\n✅ Preço: **R$ ${state.preco.toFixed(2)}**\n✅ Quantidade: **${state.quantidade}**\n✅ Chave Pix: **${state.chavePix}**\n✅ Categoria: **${categoriaNome}**\n\nAgora informe o link de download do app/produto.`)
    .setFooter({ text: 'Digite o link (deve começar com http:// ou https://).' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
