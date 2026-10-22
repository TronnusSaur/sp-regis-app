const SUPABASE_URL = process.env.SUPABASE_URL || 'https://supabase.soranoserver.com';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'sp_regis_test';
const IMAGES_UPLOAD_URL = process.env.IMAGES_UPLOAD_URL || 'https://imagenes.soranoserver.com/api/sp-regis/upload';
const IMAGES_UPLOAD_TOKEN = process.env.IMAGES_UPLOAD_TOKEN || 'sp_regis_toluca_upload_token_2026';

export const DELEGACION_MAP = {
  'CENTRO HISTORICO': 1,
  'BARRIOS TRADICIONALES': 2,
  'ARBOL DE LAS MANITAS': 3,
  'LA MAQUINITA': 4,
  'INDEPENDENCIA': 5,
  'SAN SEBASTIAN': 6,
  'UNIVERSIDAD': 7,
  'SANTA MARIA DE LAS ROSAS': 8,
  'EL CERRILLO VISTA HERMOSA': 9,
  'METROPOLITANA': 10,
  'DEL PARQUE': 11,
  'MODERNA DE LA CRUZ': 12,
  'OCHO CEDROS': 13,
  'SEMINARIO CONCILIAR': 14,
  'SEMINARIO 2 DE MARZO': 15,
  'SEMINARIO LAS TORRES': 16,
  'MORELOS': 17,
  'COLON': 18,
  'NUEVA OXTOTITLAN': 19,
  'ADOLFO LOPEZ MATEOS': 20,
  'SANCHEZ': 21,
  'CACALOMACAN': 22,
  'CALIXTLAHUACA': 23,
  'CAPULTITLAN': 24,
  'SAN ANDRES CUEXCONTITLAN': 25,
  'SAN ANTONIO BUENAVISTA': 26,
  'SAN BUENAVENTURA': 27,
  'SAN CRISTOBAL HUICHOCHITLAN': 28,
  'SAN FELIPE TLALMIMILOLPAN': 29,
  'SAN JUAN TILAPA': 30,
  'SAN LORENZO TEPALTITLAN': 31,
  'SAN MARCOS YACHIHUACALTEPEC': 32,
  'SAN MARTIN TOLTEPEC': 33,
  'SAN MATEO OTZACATIPAN': 34,
  'SAN MATEO OXTOTITLAN': 35,
  'SAN PABLO AUTOPAN': 36,
  'SAN PEDRO TOTOLTEPEC': 37,
  'SANTA ANA TLAPALTITLAN': 38,
  'SANTA CRUZ ATZCAPOTZALTONGO': 39,
  'SANTA MARIA TOTOLTEPEC': 40,
  'SANTIAGO MILTEPEC': 41,
  'SANTIAGO TLACOTEPEC': 42,
  'SANTIAGO TLAXOMULCO': 43,
  'TLACHALOYA': 45,
  'SAN CAYETANO MORELOS': 46,
  'CIUDAD UNIVERSITARIA': 47,
  'SAUCES': 48,
  'TECAXIC': 49
};

export function stripAccents(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function resolveIdDelegacion(delegacionName) {
  const norm = stripAccents(delegacionName);
  if (DELEGACION_MAP[norm]) return DELEGACION_MAP[norm];
  for (const [key, id] of Object.entries(DELEGACION_MAP)) {
    if (norm.includes(key) || key.includes(norm)) return id;
  }
  return 1;
}

export function getSupabaseHeaders(isWrite = false, extra = {}) {
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Accept-Profile': SUPABASE_SCHEMA,
    'Content-Type': 'application/json',
    ...extra
  };
  if (isWrite) {
    headers['Content-Profile'] = SUPABASE_SCHEMA;
  }
  return headers;
}

export function mapDbRowToReport(r, idx = 0) {
  const folioClean = String(r.folioRef || r.folio || '').replace(/-2026$/, '').trim();
  const est = String(r.estatus || 'T').trim().toUpperCase();
  let status = 'TERMINADO';
  if (est === 'D') status = 'DETECTADO';
  else if (est === 'P') status = 'EN PROCESO';
  else if (est === 'T') status = 'TERMINADO';

  const prof = parseFloat(r.profundidad || '0') || 0;
  const rawTipo = String(r.tipo || '').trim().toUpperCase();
  const tipoBache = prof > 0.07 ? 'PROFUNDO' : (rawTipo || 'SUPERFICIAL');

  return {
    id: Number(r.Id) || idx + 1,
    folio: folioClean,
    folioDb: r.folio,
    created_at: r.fecha || '',
    contractId: 'SP-TOLUCA',
    contractid: 'SP-TOLUCA',
    empresaName: 'Servicios Públicos Toluca',
    empresaname: 'Servicios Públicos Toluca',
    locationDesc: r.calle || '',
    locationdesc: r.calle || '',
    delegacion: r.delegacion || 'TOLUCA',
    colonia: r.colonia || 'CENTRO',
    lat: parseFloat(r.latitude || '0') || 0,
    lng: parseFloat(r.longitude || '0') || 0,
    largo: parseFloat(r.largo || '0') || 0,
    ancho: parseFloat(r.ancho || '0') || 0,
    profundidad: prof,
    m2: parseFloat(r.m2total ?? '0') || 0,
    tipoBache,
    tipobache: tipoBache,
    status,
    photoUrl: r.fotoBache1 || '',
    photourl: r.fotoBache1 || '',
    photoCaja: r.fotoBacheProceso1 || '',
    photocaja: r.fotoBacheProceso1 || '',
    photoFinal: r.fotoBacheTerminado1 || '',
    photofinal: r.fotoBacheTerminado1 || '',
    calle_1: r.entreCalle1 || '',
    calle1: r.entreCalle1 || '',
    calle_2: r.entreCalle2 || '',
    calle2: r.entreCalle2 || '',
    created_by: 'servicios.publicos@toluca.gob.mx',
    updated_by: 'servicios.publicos@toluca.gob.mx'
  };
}

export async function getAllReportsFromSupabase() {
  const url = `${SUPABASE_URL}/rest/v1/bacheo?select=*&folioRef=like.50*&order=folioRef.desc&limit=5000`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getSupabaseHeaders(false)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase GET bacheo failed (${res.status}): ${errText}`);
  }

  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows.map((r, idx) => mapDbRowToReport(r, idx));
}

export async function getNextFolioFromSupabase(inMemoryReports = []) {
  let maxNum = 5000000;

  if (Array.isArray(inMemoryReports)) {
    for (const r of inMemoryReports) {
      const fStr = String(r.folio || '').replace(/-2026$/, '').trim();
      if (/^50\d{5}$/.test(fStr)) {
        const num = parseInt(fStr, 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/bacheo?select=folio,folioRef&folioRef=like.50*&order=folioRef.desc&limit=25`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getSupabaseHeaders(false)
    });
    if (res.ok) {
      const rows = await res.json();
      for (const r of rows) {
        const fStr = String(r.folioRef || r.folio || '').replace(/-2026$/, '').trim();
        if (/^50\d{5}$/.test(fStr)) {
          const num = parseInt(fStr, 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    }
  } catch (err) {
    console.warn('[SUPABASE WARN] getNextFolioFromSupabase error:', err.message);
  }

  return String(maxNum + 1);
}

export async function insertReportInSupabase(report) {
  const cleanFolio = String(report.folio || '').replace(/-2026$/, '').trim();
  const pkFolio = `${cleanFolio}-2026`;

  const nowMx = new Date();
  const fechaParts = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(nowMx);
  const d = fechaParts.find(p => p.type === 'day')?.value || '01';
  const m = fechaParts.find(p => p.type === 'month')?.value || '01';
  const y = fechaParts.find(p => p.type === 'year')?.value || '2026';
  const fechaStr = `${d}/${m}/${y}`;

  const normDelegacion = stripAccents(report.delegacion || 'CENTRO HISTORICO');
  const normColonia = stripAccents(report.colonia || 'CENTRO');
  const idDelegacion = resolveIdDelegacion(normDelegacion);

  const prof = parseFloat(report.profundidad) || 0;
  const tipo = prof > 0.07 ? 'PROFUNDO' : 'SUPERFICIAL';

  let estatus = 'D';
  if (report.status === 'TERMINADO') estatus = 'T';
  else if (report.status === 'EN PROCESO') estatus = 'P';

  const largoNum = parseFloat(report.largo) || 0;
  const anchoNum = parseFloat(report.ancho) || 0;
  const m2total = Number((parseFloat(report.m2) || (largoNum * anchoNum) || 0).toFixed(3));

  const payload = {
    folio: pkFolio,
    folioRef: cleanFolio,
    idBacheo: 102,
    idEtapa: 102,
    idDelegacion,
    fecha: fechaStr,
    estatus,
    latitude: String(report.lat || 0),
    longitude: String(report.lng || 0),
    calle: String(report.locationDesc || report.locationdesc || '').trim().toUpperCase().slice(0, 150),
    entreCalle1: String(report.calle_1 || report.calle1 || '').trim().toUpperCase().slice(0, 150),
    entreCalle2: String(report.calle_2 || report.calle2 || '').trim().toUpperCase().slice(0, 150),
    delegacion: normDelegacion,
    colonia: normColonia,
    tipo,
    largo: String(largoNum),
    ancho: String(anchoNum),
    profundidad: String(prof),
    m2total,
    fotoBache1: report.photoUrl || report.photourl || '',
    fotoBacheProceso1: report.photoCaja || report.photocaja || '',
    fotoBacheTerminado1: report.photoFinal || report.photofinal || '',
    date_added: nowMx.toISOString()
  };

  const url = `${SUPABASE_URL}/rest/v1/bacheo?on_conflict=folio`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getSupabaseHeaders(true, {
      'Prefer': 'resolution=merge-duplicates,return=representation'
    }),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase INSERT failed (${res.status}): ${errText}`);
  }

  return await res.json();
}

export async function updateReportInSupabase(folio, updates) {
  const cleanFolio = String(folio || '').replace(/-2026$/, '').trim();

  // 1. Read existing row to preserve unmodified measurements
  const getUrl = `${SUPABASE_URL}/rest/v1/bacheo?select=*&folioRef=eq.${encodeURIComponent(cleanFolio)}&limit=1`;
  const getRes = await fetch(getUrl, {
    method: 'GET',
    headers: getSupabaseHeaders(false)
  });

  let existing = null;
  if (getRes.ok) {
    const rows = await getRes.json();
    existing = rows?.[0] || null;
  }

  const patchData = {};

  const finalLocationDesc = updates.locationDesc !== undefined ? updates.locationDesc : updates.locationdesc;
  if (finalLocationDesc !== undefined) {
    patchData.calle = String(finalLocationDesc).trim().toUpperCase().slice(0, 150);
  }

  if (updates.delegacion !== undefined) {
    const normDel = stripAccents(updates.delegacion);
    patchData.delegacion = normDel;
    patchData.idDelegacion = resolveIdDelegacion(normDel);
  }

  if (updates.colonia !== undefined) {
    patchData.colonia = stripAccents(updates.colonia).slice(0, 150);
  }

  const finalCalle1 = updates.calle_1 !== undefined ? updates.calle_1 : updates.calle1;
  if (finalCalle1 !== undefined) {
    patchData.entreCalle1 = String(finalCalle1).trim().toUpperCase().slice(0, 150);
  }

  const finalCalle2 = updates.calle_2 !== undefined ? updates.calle_2 : updates.calle2;
  if (finalCalle2 !== undefined) {
    patchData.entreCalle2 = String(finalCalle2).trim().toUpperCase().slice(0, 150);
  }

  if (updates.lat !== undefined) patchData.latitude = String(updates.lat);
  if (updates.lng !== undefined) patchData.longitude = String(updates.lng);

  // Measurements preservation logic
  const existingLargo = parseFloat(existing?.largo || '0') || 0;
  const existingAncho = parseFloat(existing?.ancho || '0') || 0;
  const existingProf = parseFloat(existing?.profundidad || '0') || 0;

  let newLargo = existingLargo;
  let newAncho = existingAncho;
  let newProf = existingProf;
  let hasDimChange = false;

  if (updates.largo !== undefined && updates.largo !== '') {
    newLargo = parseFloat(updates.largo) || 0;
    patchData.largo = String(newLargo);
    hasDimChange = true;
  }
  if (updates.ancho !== undefined && updates.ancho !== '') {
    newAncho = parseFloat(updates.ancho) || 0;
    patchData.ancho = String(newAncho);
    hasDimChange = true;
  }
  if (updates.profundidad !== undefined && updates.profundidad !== '') {
    newProf = parseFloat(updates.profundidad) || 0;
    patchData.profundidad = String(newProf);
    patchData.tipo = newProf > 0.07 ? 'PROFUNDO' : 'SUPERFICIAL';
    hasDimChange = true;
  }

  if (updates.m2 !== undefined && updates.m2 !== '') {
    patchData.m2total = Number((parseFloat(updates.m2) || 0).toFixed(3));
  } else if (hasDimChange) {
    patchData.m2total = Number((newLargo * newAncho).toFixed(3));
  }

  const rawTipo = updates.tipoBache || updates.tipobache;
  if (rawTipo && !patchData.tipo) {
    patchData.tipo = String(rawTipo).replace(/^CAJA\s+/i, '').trim().toUpperCase();
  }

  if (updates.status) {
    if (updates.status === 'TERMINADO') {
      patchData.estatus = 'T';
      patchData.date_added_termino = new Date().toISOString();
    } else if (updates.status === 'EN PROCESO') {
      patchData.estatus = 'P';
      patchData.date_added_proceso = new Date().toISOString();
    } else if (updates.status === 'DETECTADO') {
      patchData.estatus = 'D';
    }
  }

  const photoUrl = updates.photoUrl || updates.photourl;
  const photoCaja = updates.photoCaja || updates.photocaja;
  const photoFinal = updates.photoFinal || updates.photofinal;

  if (photoUrl) patchData.fotoBache1 = photoUrl;
  if (photoCaja) patchData.fotoBacheProceso1 = photoCaja;
  if (photoFinal) patchData.fotoBacheTerminado1 = photoFinal;

  if (Object.keys(patchData).length === 0) return null;

  const patchUrl = `${SUPABASE_URL}/rest/v1/bacheo?folioRef=eq.${encodeURIComponent(cleanFolio)}`;
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: getSupabaseHeaders(true, {
      'Prefer': 'return=representation'
    }),
    body: JSON.stringify(patchData)
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    throw new Error(`Supabase PATCH failed (${patchRes.status}): ${errText}`);
  }

  return await patchRes.json();
}

/**
 * Uploads photo buffers for a folio to the native Alfa directory:
 * /home/kinger/imagenes/SERVICIOS PUBLICOS 2026/DGSP SEGUNDO SEMESTRE 2026/{folio}/{folio}_{phase}.jpg
 * via https://imagenes.soranoserver.com/api/sp-regis/upload
 */
export async function uploadPhotosToAlfaServer(folio, filesMap = {}) {
  const cleanFolio = String(folio || '').replace(/-2026$/, '').trim();
  const baseRelPath = `imagenes/SERVICIOS%20PUBLICOS%202026/DGSP%20SEGUNDO%20SEMESTRE%202026/${cleanFolio}/${cleanFolio}`;

  const payloadFiles = {};
  if (filesMap.inicial) payloadFiles.inicial = filesMap.inicial.toString('base64');
  if (filesMap.caja) payloadFiles.caja = filesMap.caja.toString('base64');
  if (filesMap.terminado) payloadFiles.terminado = filesMap.terminado.toString('base64');

  if (Object.keys(payloadFiles).length === 0) {
    return {};
  }

  const res = await fetch(IMAGES_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-upload-token': IMAGES_UPLOAD_TOKEN
    },
    body: JSON.stringify({
      folio: cleanFolio,
      files: payloadFiles
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Alfa Image Upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    photoUrl: data.paths?.inicial || (filesMap.inicial ? `${baseRelPath}_inicial.jpg` : ''),
    photoCaja: data.paths?.caja || (filesMap.caja ? `${baseRelPath}_caja.jpg` : ''),
    photoFinal: data.paths?.terminado || (filesMap.terminado ? `${baseRelPath}_terminado.jpg` : '')
  };
}
