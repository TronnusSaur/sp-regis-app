import fs from 'fs';
import path from 'path';

const TOKENS_FILE = path.join(process.cwd(), '.tokens.json');
let memoryTokens = null;

export async function initDb() {
  console.log('[DB] PostgreSQL desactivado para versión SP REGIS. Usando almacenamiento directo en Google Sheets.');
}

export async function saveTokens(tokens) {
  memoryTokens = tokens;
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
    console.log('[TOKENS] Guardados exitosamente en .tokens.json');
  } catch (err) {
    console.error('[TOKENS ERROR] No se pudo guardar .tokens.json:', err.message);
  }
}

export async function loadTokens() {
  if (memoryTokens) return memoryTokens;
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const data = fs.readFileSync(TOKENS_FILE, 'utf8');
      memoryTokens = JSON.parse(data);
      return memoryTokens;
    }
  } catch (err) {
    console.error('[TOKENS ERROR] No se pudo leer .tokens.json:', err.message);
  }
  return null;
}

export default { query: async () => ({ rows: [], rowCount: 0 }) };

