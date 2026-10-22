import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';
import https from 'https';

// Production Libraries (Supabase sp_regis_test + Native Alfa Image Storage)
import { getAuthUrl, getTokensFromCode, setClientTokens } from './lib/auth.js';
import { 
  getAllReportsFromSupabase, 
  getNextFolioFromSupabase, 
  insertReportInSupabase, 
  updateReportInSupabase, 
  uploadPhotosToAlfaServer 
} from './lib/supabase.js';
import { requireAuth, verifyFirebaseToken } from './lib/firebaseAdmin.js';
import { saveTokens } from './lib/db.js';
import { getPendingCorrections, addCorrectionRequest, getCorrectionById, markCorrectionApproved, discardCorrection } from './lib/corrections.js';

const app = express();
const upload = multer({ dest: '/tmp/' });

app.use(cors());
app.use(express.json());


// --- VALIDATION HELPERS ---
const VALID_STATUSES = ['DETECTADO', 'EN PROCESO', 'TERMINADO'];
const FOLIO_REGEX = /^50\d{5}$/;
const MAX_STRING_LEN = 500;


function sanitizeString(val, maxLen = MAX_STRING_LEN) {
  if (typeof val !== 'string') return String(val || '');
  return val.trim().slice(0, maxLen);
}

function isValidCoord(val) {
  const n = parseFloat(val);
  return !isNaN(n) && isFinite(n);
}

/** Safely remove multer temp file */
function cleanupTempFile(file) {
  if (file?.path) {
    try { fs.unlinkSync(file.path); } catch (e) { /* ignore */ }
  }
}

// --- CACHE PARA DATOS GEOGRÁFICOS ---
let utbDataCache = null;
let delegationsDataCache = null;
const GEOJSON_FILE = path.join(process.cwd(), 'UTB REAL.geojson');

function loadGeoJSON() {
  if (!utbDataCache) {
    if (fs.existsSync(GEOJSON_FILE)) {
      const content = fs.readFileSync(GEOJSON_FILE, 'utf8');
      const data = JSON.parse(content);
      
      // NORMALIZE TO UPPERCASE
      data.features = data.features.map(f => ({
        ...f,
        properties: {
          ...f.properties,
          NOMDEL: f.properties.NOMDEL?.toUpperCase(),
          NOMUT: f.properties.NOMUT?.toUpperCase()
        }
      }));

      utbDataCache = data;
      console.log('[API] UTB REAL.geojson cargado y normalizado.');
    } else {
      console.error('[API ERROR] UTB REAL.geojson no encontrado en:', GEOJSON_FILE);
    }
  }
  return utbDataCache;
}

// --- AUTH ROUTES ---
app.get('/api/auth/login', (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

app.get('/api/auth/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const tokens = await getTokensFromCode(code);
    await saveTokens(tokens); // Persistent in Postgres
    setClientTokens(tokens);
    res.send('<h1>Login Exitoso en la Nube</h1><p>Ya puedes cerrar esta ventana y volver a usar la app.</p>');
  } catch (err) {
    res.status(500).send('Falló el login en la nube: ' + err.message);
  }
});

// --- CATALOG DATA (DYNAMIC) ---
app.get('/api/catalogs/contracts', requireAuth, (req, res) => {
  const CONTRACTS_FILE = path.join(process.cwd(), 'CATALOGOS', 'RESUMEN DE CONTRATOS - SUPERVISORES 2026 - Registros Contratos Reales.csv');
  
  if (!fs.existsSync(CONTRACTS_FILE)) {
    return res.status(404).json({ error: 'Catálogo de contratos no encontrado' });
  }

  try {
    const content = fs.readFileSync(CONTRACTS_FILE, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    
    let contracts = lines.slice(1).map((line) => {
      const row = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(item => item.trim().replace(/^"|"$/g, ''));
      if (row.length < 10) return null;
      return {
        id_real: row[0],
        id: row[1],
        delegacion: row[2],
        empresa: row[3],
        supervisor: row[9],
        supervisor_tel: row[10],
        residente: row[11],
        residente_tel: row[12],
      };
    }).filter(c => c && c.id && c.id !== '#REF!');

    // RBAC: Filter contracts if not ADMIN
    if (req.user.role !== 'ADMIN') {
      const allowed = req.user.assignments || [];
      contracts = contracts.filter(c => allowed.includes(c.id));
    }

    res.json(contracts);
  } catch (err) {
    console.error('[CATALOG ERROR]', err);
    res.status(500).json({ error: 'Error al procesar catálogo' });
  }
});

// --- RADAR API ---
app.post('/api/radar', requireAuth, (req, res) => {
  const { lat, lng } = req.body;
  const data = loadGeoJSON();
  if (!data) return res.status(500).json({ error: 'Datos geográficos no disponibles en el servidor' });

  try {
    const point = turf.point([lng, lat]);
    let foundZone = null;

    for (const feature of data.features) {
      if (turf.booleanPointInPolygon(point, feature)) {
        foundZone = {
          name: feature.properties.NOMUT || feature.properties.NOMDEL,
          type: feature.properties.NOMUT ? 'COLONIA' : 'DELEGACION',
          delegacion: feature.properties.NOMDEL
        };
        break;
      }
    }

    if (foundZone) {
      res.json(foundZone);
    } else {
      res.status(404).json({ error: 'Ubicación fuera de la zona de cobertura de Toluca' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error en procesamiento radar: ' + err.message });
  }
});

// --- GEOJSON ENDPOINTS (MAP) ---
app.get('/api/geojson', (req, res) => {
  const data = loadGeoJSON();
  if (data) res.json(data);
  else res.status(500).json({ error: 'GeoJSON no disponible' });
});

app.get('/api/geojson/delegations', (req, res) => {
  if (delegationsDataCache) return res.json(delegationsDataCache);
  
  const data = loadGeoJSON();
  if (!data) return res.status(500).json({ error: 'GeoJSON no disponible' });

  try {
    delegationsDataCache = turf.dissolve(data, { propertyName: 'NOMDEL' });
    res.json(delegationsDataCache);
  } catch (err) {
    res.status(500).json({ error: 'Error al disolver delegaciones' });
  }
});

/**
 * Descarga una imagen desde una URL y la devuelve como un Buffer.
 * @param {string} url - URL de la imagen
 * @returns {Promise<Buffer>} Buffer de la imagen
 */
function downloadImageToBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Fallo al descargar imagen. Status: ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', (err) => reject(err));
    }).on('error', (err) => reject(err));
  });
}

// --- IN-MEMORY CACHE FOR REPORTS ---
let reportsCache = [];
let lastCacheTime = 0;
const CACHE_TTL = 10000; // 10 seconds

// --- REPORTS API (PROTECTED) ---
app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    if (Date.now() - lastCacheTime > CACHE_TTL || reportsCache.length === 0) {
      const reports = await getAllReportsFromSupabase();
      reportsCache = reports;
      lastCacheTime = Date.now();
    }
    
    res.json(reportsCache);
  } catch (err) {
    console.error('[REPORTS GET ERROR]', err);
    res.json(reportsCache);
  }
});

// Endpoint to get guaranteed next sequential folio
app.get('/api/reports/next-folio', requireAuth, async (req, res) => {
  try {
    const nextFolio = await getNextFolioFromSupabase(reportsCache);
    res.json({ nextFolio, suffix: nextFolio.slice(2) });
  } catch (err) {
    console.error('[NEXT-FOLIO ERROR]', err);
    res.status(500).json({ error: 'Error al calcular siguiente folio' });
  }
});

app.get('/api/profile', requireAuth, async (req, res) => {
  res.json({
    email: req.user.email,
    role: 'ADMIN',
    assignments: []
  });
});

// Configure Multer to accept up to 3 photos (Inicial, Caja, Final)
const multiUpload = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'photoInicial', maxCount: 1 },
  { name: 'photoCaja', maxCount: 1 },
  { name: 'photoFinal', maxCount: 1 }
]);

app.post('/api/reports', requireAuth, multiUpload, async (req, res) => {
  try {
    const { 
      folio: manualFolio, contractId, empresaName, lat, lng, 
      locationDesc, delegacion, colonia, tipoBache, 
      calle1, calle2, largo, ancho, profundidad, m2
    } = req.body;

    const finalContractId = sanitizeString(contractId || 'SP-TOLUCA', 50);
    const finalEmpresaName = sanitizeString(empresaName || 'Servicios Públicos Toluca', 200);

    // Guaranteed sequential non-duplicate folio calculation from Supabase (sp_regis_test.bacheo)
    let folio = '';
    const calculatedNextFolio = await getNextFolioFromSupabase(reportsCache);

    if (manualFolio && manualFolio !== 'undefined' && manualFolio !== 'auto' && FOLIO_REGEX.test(manualFolio)) {
      const existsInCache = reportsCache.some(r => String(r.folio).trim() === manualFolio.trim());
      if (existsInCache) {
        folio = calculatedNextFolio;
      } else {
        folio = manualFolio;
      }
    } else {
      folio = calculatedNextFolio;
    }

    const files = req.files || {};
    const photoInicialFile = files.photoInicial?.[0] || files.photo?.[0];
    const photoCajaFile = files.photoCaja?.[0];
    const photoFinalFile = files.photoFinal?.[0];

    // Determine initial status based on uploaded photos
    let status = 'DETECTADO';
    if (photoFinalFile) {
      status = 'TERMINADO';
    } else if (photoCajaFile) {
      status = 'EN PROCESO';
    }

    const calculatedM2 = parseFloat(m2) || ((parseFloat(largo) || 0) * (parseFloat(ancho) || 0)) || 0;

    const nowFormatted = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date());

    const newReport = {
      folio,
      created_at: nowFormatted,
      contractId: finalContractId,
      empresaName: finalEmpresaName,
      lat: parseFloat(lat) || 0,
      lng: parseFloat(lng) || 0,
      locationDesc: sanitizeString(locationDesc),
      delegacion: sanitizeString(delegacion, 100),
      colonia: sanitizeString(colonia, 100),
      tipoBache: (parseFloat(profundidad) || 0) > 0.07 ? 'PROFUNDO' : 'SUPERFICIAL',
      calle_1: sanitizeString(calle1, 200),
      calle_2: sanitizeString(calle2, 200),
      largo: parseFloat(largo) || 0,
      ancho: parseFloat(ancho) || 0,
      profundidad: parseFloat(profundidad) || 0,
      m2: calculatedM2,
      status,
      created_by: req.user.email,
      updated_by: req.user.email,
      photoUrl: '',
      photoCaja: '',
      photoFinal: ''
    };

    // 1. Subir fotos nativas a Alfa (/home/kinger/imagenes/SERVICIOS PUBLICOS 2026/DGSP SEGUNDO SEMESTRE 2026/{folio})
    try {
      const filesMap = {};
      if (photoInicialFile) {
        filesMap.inicial = fs.readFileSync(photoInicialFile.path);
        cleanupTempFile(photoInicialFile);
      }
      if (photoCajaFile) {
        filesMap.caja = fs.readFileSync(photoCajaFile.path);
        cleanupTempFile(photoCajaFile);
      }
      if (photoFinalFile) {
        filesMap.terminado = fs.readFileSync(photoFinalFile.path);
        cleanupTempFile(photoFinalFile);
      }

      if (Object.keys(filesMap).length > 0) {
        const uploadedPaths = await uploadPhotosToAlfaServer(newReport.folio, filesMap);
        if (uploadedPaths.photoUrl) newReport.photoUrl = uploadedPaths.photoUrl;
        if (uploadedPaths.photoCaja) newReport.photoCaja = uploadedPaths.photoCaja;
        if (uploadedPaths.photoFinal) newReport.photoFinal = uploadedPaths.photoFinal;
        console.log(`[ALFA IMAGES SUCCESS] ✅ Fotos guardadas para folio ${newReport.folio}`);
      }
    } catch (imgErr) {
      console.error(`[ALFA IMAGES ERROR] Folio ${newReport.folio}:`, imgErr.message);
    }

    // 2. Guardar registro en Supabase (sp_regis_test.bacheo)
    await insertReportInSupabase(newReport);
    console.log(`[SUPABASE SUCCESS] ✅ Folio ${newReport.folio} registrado en sp_regis_test.bacheo.`);

    // Update in-memory cache immediately
    reportsCache.unshift(newReport);
    lastCacheTime = Date.now();

    // 3. Responder al cliente
    res.status(201).json({
      folio: newReport.folio,
      status: newReport.status,
      success: true
    });

  } catch (err) {
    console.error('[REPORTS POST ERROR]', err);
    res.status(500).json({ error: 'Fallo al procesar bache: ' + err.message });
  }
});

// Photo Update (Caja/Final)
app.post('/api/reports/:folio/photo', requireAuth, upload.single('photo'), async (req, res) => {
  const { folio } = req.params;
  const { phase } = req.body; // 'caja' o 'terminado'

  if (!phase) {
    cleanupTempFile(req.file);
    return res.status(400).json({ error: 'Falta especificar la fase (caja/terminado)' });
  }

  const nextStatus = phase === 'caja' ? 'EN PROCESO' : 'TERMINADO';
  const tempFilePath = req.file?.path || null;

  try {
    if (tempFilePath) {
      const buf = fs.readFileSync(tempFilePath);
      const uploadedPaths = await uploadPhotosToAlfaServer(folio, {
        [phase === 'caja' ? 'caja' : 'terminado']: buf
      });
      
      const updates = { status: nextStatus, usuario: req.user.email };
      if (phase === 'caja') updates.photoCaja = uploadedPaths.photoCaja;
      else updates.photoFinal = uploadedPaths.photoFinal;

      await updateReportInSupabase(folio, updates);
      lastCacheTime = 0;
      console.log(`[PHOTO SUCCESS] ✅ Foto ${phase} actualizada en Alfa y Supabase para folio ${folio}.`);
    }
  } catch (e) {
    console.error(`[PHOTO ERROR] ${e.message}`);
  } finally {
    if (tempFilePath) cleanupTempFile({ path: tempFilePath });
  }

  res.json({ success: true, status: nextStatus });
});

// Update Status
app.patch('/api/reports/:folio/status', requireAuth, async (req, res) => {
  const { folio } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Estatus inválido: "${status}"` });
  }

  try {
    await updateReportInSupabase(folio, { status, usuario: req.user.email });
    const report = reportsCache.find(r => r.folio === folio) || { folio, status };
    report.status = status;
    res.json(report);
  } catch (err) {
    console.error('[STATUS PATCH ERROR]', err);
    res.status(500).json({ error: 'Fallo al actualizar estatus' });
  }
});

// --- CORRECTIONS API ---

// Get all pending corrections
app.get('/api/corrections', requireAuth, async (req, res) => {
  try {
    const pending = await getPendingCorrections();
    res.json(pending);
  } catch (err) {
    console.error('[CORRECTIONS GET ERROR]', err);
    res.status(500).json({ error: 'Error al obtener correcciones: ' + err.message });
  }
});

// Submit a new correction request
app.post('/api/corrections', requireAuth, async (req, res) => {
  try {
    const { folio, originalData, proposedData, reason } = req.body;
    if (!folio || !proposedData || Object.keys(proposedData).length === 0) {
      return res.status(400).json({ error: 'Folio y datos propuestos son obligatorios' });
    }

    const newCorrection = await addCorrectionRequest({
      folio,
      requestedBy: req.user.email,
      originalData: originalData || {},
      proposedData: proposedData || {},
      reason: sanitizeString(reason || '', 300)
    });

    console.log(`[CORRECTION CREATED] Solicitud creada para folio ${folio} por ${req.user.email}`);
    res.status(201).json(newCorrection);
  } catch (err) {
    console.error('[CORRECTIONS POST ERROR]', err);
    res.status(500).json({ error: 'Error al crear solicitud de corrección: ' + err.message });
  }
});

// Approve a correction (Admin only)
app.post('/api/corrections/:id/approve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const correction = await getCorrectionById(id);

    if (!correction) {
      return res.status(404).json({ error: 'Solicitud de corrección no encontrada' });
    }

    if (correction.proposedData) {
      console.log(`[CORRECTION APPROVE] Aplicando cambios en Supabase (sp_regis_test.bacheo) para folio ${correction.folio}...`);
      await updateReportInSupabase(correction.folio, {
        ...correction.proposedData
      });
      lastCacheTime = 0;
    }

    // Update in-memory reports cache
    const cachedIdx = reportsCache.findIndex(r => String(r.folio).trim() === String(correction.folio).trim());
    if (cachedIdx !== -1) {
      reportsCache[cachedIdx] = {
        ...reportsCache[cachedIdx],
        ...correction.proposedData
      };
    }

    await markCorrectionApproved(id);
    console.log(`[CORRECTION APPROVED] ✅ Solicitud ${id} para folio ${correction.folio} aprobada.`);
    res.json({ success: true, message: 'Corrección aprobada y aplicada a la base de datos con éxito' });
  } catch (err) {
    console.error('[CORRECTIONS APPROVE ERROR]', err);
    res.status(500).json({ error: 'Error al aprobar corrección: ' + err.message });
  }
});

// Discard a correction (Admin only)
app.post('/api/corrections/:id/discard', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await discardCorrection(id);
    console.log(`[CORRECTION DISCARDED] Solicitud ${id} descartada.`);
    res.json({ success: true, message: 'Solicitud de corrección descartada sin alterar la base de datos' });
  } catch (err) {
    console.error('[CORRECTIONS DISCARD ERROR]', err);
    res.status(500).json({ error: 'Error al descartar corrección: ' + err.message });
  }
});

app.delete('/api/corrections/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await discardCorrection(id);
    res.json({ success: true, message: 'Solicitud eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[SP REGIS API] Servidor Express iniciado en http://localhost:${PORT}`);
  console.log(`[SP REGIS API] Motor activo: Supabase (sp_regis_test.bacheo) + Alfa Native Images`);
});

export default app;
