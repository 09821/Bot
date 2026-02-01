// ============================================================
// KEY GENERATOR - Gera keys vinculadas a IP
// ============================================================

const crypto = require('crypto');

/**
 * Gera uma key única vinculada a um IP específico.
 * A key é um hash que combina: IP + secret + timestamp
 * Isso garante que cada key só funcione no IP correto.
 *
 * @param {string} ip - O IP do usuário
 * @returns {string} A key gerada (formato: KEY-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX)
 */
function generateKey(ip) {
  const SECRET = process.env.KEY_SECRET || 'meu_segredo_super_secreto_aqui'; // MUDE ISSO!
  const timestamp = Date.now().toString();
  const raw = `${ip}:${SECRET}:${timestamp}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return `KEY-${hash}`;
}

/**
 * Valida se uma key corresponde ao IP fornecido.
 * Nota: como usamos timestamp no hash, precisamos armazenar o mapeamento IP->Key
 * para validação posterior. Essa função verifica no banco de dados.
 *
 * @param {string} key - A key a ser validada
 * @param {string} ip - O IP para verificar
 * @param {object} keysDB - Objeto com as keys armazenadas { key: { ip, userId } }
 * @returns {boolean}
 */
function validateKey(key, ip, keysDB) {
  if (!keysDB[key]) return false;
  return keysDB[key].ip === ip;
}

module.exports = { generateKey, validateKey };
