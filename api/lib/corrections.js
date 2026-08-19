import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORRECTIONS_FILE = path.join(__dirname, '..', '..', '.corrections.json');

let memoryCorrections = null;

export async function loadCorrections() {
  if (memoryCorrections) return memoryCorrections;

  // Priority 1: Environment variable if provided in Vercel
  if (process.env.CORRECTIONS) {
    try {
      memoryCorrections = typeof process.env.CORRECTIONS === 'string'
        ? JSON.parse(process.env.CORRECTIONS)
        : process.env.CORRECTIONS;
      return memoryCorrections;
    } catch (e) {
      console.warn('[CORRECTIONS] Fallo al parsear CORRECTIONS env:', e.message);
    }
  }

  // Priority 2: File on disk
  try {
    if (fs.existsSync(CORRECTIONS_FILE)) {
      const data = fs.readFileSync(CORRECTIONS_FILE, 'utf8');
      memoryCorrections = JSON.parse(data);
      if (Array.isArray(memoryCorrections)) return memoryCorrections;
    }
  } catch (err) {
    console.warn('[CORRECTIONS] No se pudo leer .corrections.json:', err.message);
  }

  memoryCorrections = [];
  return memoryCorrections;
}

export async function saveCorrections(corrections) {
  memoryCorrections = Array.isArray(corrections) ? corrections : [];
  try {
    fs.writeFileSync(CORRECTIONS_FILE, JSON.stringify(memoryCorrections, null, 2), 'utf8');
  } catch (err) {
    console.warn('[CORRECTIONS] No se pudo escribir .corrections.json:', err.message);
  }
}

export async function getPendingCorrections() {
  const all = await loadCorrections();
  return all.filter(c => c.status === 'PENDING');
}

export async function addCorrectionRequest({ folio, requestedBy, originalData, proposedData, reason }) {
  const all = await loadCorrections();
  const id = `corr_${folio}_${Date.now()}`;
  
  // If there is already a pending correction for this folio, replace or update it
  const filtered = all.filter(c => !(c.folio === folio && c.status === 'PENDING'));

  const newCorrection = {
    id,
    folio: String(folio).trim(),
    requestedBy: requestedBy || 'anon',
    requestedAt: new Date().toISOString(),
    status: 'PENDING',
    originalData: originalData || {},
    proposedData: proposedData || {},
    reason: reason || ''
  };

  filtered.unshift(newCorrection);
  await saveCorrections(filtered);
  return newCorrection;
}

export async function getCorrectionById(id) {
  const all = await loadCorrections();
  return all.find(c => c.id === id) || null;
}

export async function getCorrectionByFolio(folio) {
  const all = await loadCorrections();
  return all.find(c => c.folio === String(folio).trim() && c.status === 'PENDING') || null;
}

export async function markCorrectionApproved(id) {
  const all = await loadCorrections();
  const index = all.findIndex(c => c.id === id);
  if (index !== -1) {
    all[index].status = 'APPROVED';
    all[index].approvedAt = new Date().toISOString();
    await saveCorrections(all);
    return all[index];
  }
  return null;
}

export async function discardCorrection(id) {
  const all = await loadCorrections();
  const filtered = all.filter(c => c.id !== id);
  await saveCorrections(filtered);
  return true;
}
