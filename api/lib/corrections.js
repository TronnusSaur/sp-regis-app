import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSupabaseHeaders } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORRECTIONS_FILE = path.join(__dirname, '..', '..', '.corrections.json');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://supabase.soranoserver.com';

let memoryCorrections = [];

function loadFallbackFile() {
  try {
    if (fs.existsSync(CORRECTIONS_FILE)) {
      const data = fs.readFileSync(CORRECTIONS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        memoryCorrections = parsed;
      }
    }
  } catch {
    // ignore
  }
  return memoryCorrections;
}

function saveFallbackFile(list) {
  memoryCorrections = Array.isArray(list) ? list : [];
  try {
    fs.writeFileSync(CORRECTIONS_FILE, JSON.stringify(memoryCorrections, null, 2), 'utf8');
  } catch {
    // ignore on read-only serverless fs
  }
}

export async function getPendingCorrections() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/corrections?select=*&status=eq.PENDING&order=requestedAt.desc`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getSupabaseHeaders(false)
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        memoryCorrections = rows;
        return rows;
      }
    }
  } catch (err) {
    console.warn('[CORRECTIONS] Error consultando Supabase corrections:', err.message);
  }
  return loadFallbackFile().filter(c => c.status === 'PENDING');
}

export async function addCorrectionRequest({ folio, requestedBy, originalData, proposedData, reason }) {
  const cleanFolio = String(folio || '').replace(/-2026$/, '').trim();
  const id = `corr_${cleanFolio}_${Date.now()}`;

  const newCorrection = {
    id,
    folio: cleanFolio,
    requestedBy: requestedBy || 'anon',
    requestedAt: new Date().toISOString(),
    status: 'PENDING',
    originalData: originalData || {},
    proposedData: proposedData || {},
    reason: reason || ''
  };

  try {
    // Discard any previous PENDING correction for the same folio in Supabase
    const delUrl = `${SUPABASE_URL}/rest/v1/corrections?folio=eq.${encodeURIComponent(cleanFolio)}&status=eq.PENDING`;
    await fetch(delUrl, {
      method: 'DELETE',
      headers: getSupabaseHeaders(true)
    });

    // Insert new correction into sp_regis_test.corrections
    const postUrl = `${SUPABASE_URL}/rest/v1/corrections`;
    const res = await fetch(postUrl, {
      method: 'POST',
      headers: getSupabaseHeaders(true, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(newCorrection)
    });

    if (res.ok) {
      const created = await res.json();
      return created?.[0] || newCorrection;
    }
  } catch (err) {
    console.warn('[CORRECTIONS] Fallback local al guardar corrección:', err.message);
  }

  const all = loadFallbackFile().filter(c => !(c.folio === cleanFolio && c.status === 'PENDING'));
  all.unshift(newCorrection);
  saveFallbackFile(all);
  return newCorrection;
}

export async function getCorrectionById(id) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/corrections?select=*&id=eq.${encodeURIComponent(id)}&limit=1`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getSupabaseHeaders(false)
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length > 0) return rows[0];
    }
  } catch (err) {
    console.warn('[CORRECTIONS] Error getCorrectionById en Supabase:', err.message);
  }
  return loadFallbackFile().find(c => c.id === id) || null;
}

export async function getCorrectionByFolio(folio) {
  const cleanFolio = String(folio || '').replace(/-2026$/, '').trim();
  try {
    const url = `${SUPABASE_URL}/rest/v1/corrections?select=*&folio=eq.${encodeURIComponent(cleanFolio)}&status=eq.PENDING&limit=1`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getSupabaseHeaders(false)
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length > 0) return rows[0];
    }
  } catch (err) {
    console.warn('[CORRECTIONS] Error getCorrectionByFolio en Supabase:', err.message);
  }
  return loadFallbackFile().find(c => c.folio === cleanFolio && c.status === 'PENDING') || null;
}

export async function markCorrectionApproved(id) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/corrections?id=eq.${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: getSupabaseHeaders(true, { 'Prefer': 'return=representation' }),
      body: JSON.stringify({
        status: 'APPROVED',
        approvedAt: new Date().toISOString()
      })
    });
    if (res.ok) {
      const rows = await res.json();
      return rows?.[0] || { id, status: 'APPROVED' };
    }
  } catch (err) {
    console.warn('[CORRECTIONS] Error markCorrectionApproved en Supabase:', err.message);
  }

  const all = loadFallbackFile();
  const idx = all.findIndex(c => c.id === id);
  if (idx !== -1) {
    all[idx].status = 'APPROVED';
    all[idx].approvedAt = new Date().toISOString();
    saveFallbackFile(all);
    return all[idx];
  }
  return null;
}

export async function discardCorrection(id) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/corrections?id=eq.${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getSupabaseHeaders(true)
    });
    if (res.ok) return true;
  } catch (err) {
    console.warn('[CORRECTIONS] Error discardCorrection en Supabase:', err.message);
  }

  const all = loadFallbackFile().filter(c => c.id !== id);
  saveFallbackFile(all);
  return true;
}
