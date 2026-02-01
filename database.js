// ============================================================
// DATABASE - Armazenamento em JSON (sem necessidade de servidor externo)
// ============================================================

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data');

const files = {
  categorias: path.join(DB_PATH, 'categorias.json'),
  itens: path.join(DB_PATH, 'itens.json'),
  tickets: path.join(DB_PATH, 'tickets.json'),
  paineis: path.join(DB_PATH, 'paineis.json'),
};

let db = {
  categorias: {},  // { id: { nome, criadoPor } }
  itens: {},       // { id: { nome, preco, quantidade, categoria, chavePix, linkDownload, criadoPor } }
  tickets: {},     // { channelId: { usuarioId, itemId, status, comprovantes } }
  paineis: {},     // { messageId: { criadoPor, guildId } }
};

function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[DB] Erro ao carregar', filePath, e.message);
  }
  return {};
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH, { recursive: true });
  }

  db.categorias = loadJSON(files.categorias);
  db.itens = loadJSON(files.itens);
  db.tickets = loadJSON(files.tickets);
  db.paineis = loadJSON(files.paineis);

  console.log('[DB] Banco de dados carregado com sucesso.');
  console.log(`  Categorias: ${Object.keys(db.categorias).length}`);
  console.log(`  Itens: ${Object.keys(db.itens).length}`);
  console.log(`  Tickets: ${Object.keys(db.tickets).length}`);
}

function saveAll() {
  saveJSON(files.categorias, db.categorias);
  saveJSON(files.itens, db.itens);
  saveJSON(files.tickets, db.tickets);
  saveJSON(files.paineis, db.paineis);
}

function saveCategory() { saveJSON(files.categorias, db.categorias); }
function saveItems() { saveJSON(files.itens, db.itens); }
function saveTickets() { saveJSON(files.tickets, db.tickets); }
function savePanels() { saveJSON(files.paineis, db.paineis); }

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

module.exports = {
  db,
  initDB,
  saveAll,
  saveCategory,
  saveItems,
  saveTickets,
  savePanels,
  generateId,
};
