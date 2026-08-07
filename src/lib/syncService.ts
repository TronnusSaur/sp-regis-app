/**
 * syncService.ts
 * Servicio de sincronización automática robusto.
 * - Sube las fotos pendientes a Firebase Storage desde el dispositivo.
 * - Envía los metadatos y la URL de la imagen al servidor Vercel.
 * - Limpia los archivos locales temporales tras el éxito.
 */

import { getPendingItems, getReportJSON, getReportPhoto, clearReportFiles } from './robustStore';
import { getIdToken, uploadImageToFirebase } from './firebase';
import { apiFetch } from './apiFetch';

/** Determina si la conexión actual es suficientemente buena para sincronizar */
function hasGoodConnection(): boolean {
  const conn = (navigator as any).connection;
  if (!conn) return navigator.onLine;

  if (conn.saveData) return false;
  const slowTypes = ['slow-2g', '2g'];
  if (slowTypes.includes(conn.effectiveType)) return false;

  return navigator.onLine;
}

type SyncCallback = (result: { synced: number; failed: number }) => void;

let isSyncing = false;

/**
 * Sube todos los reportes pendientes (JSON + Fotos) al servidor.
 * Sube primero las imágenes a Firebase Storage para evitar saturar el canal HTTP de Vercel.
 */
export async function syncPendingReports(onComplete?: SyncCallback): Promise<void> {
  if (isSyncing) {
    console.log('[SYNC] Sincronización en curso. Ignorando llamada concurrente.');
    return;
  }
  isSyncing = true;
  
  if (!hasGoodConnection()) {
    console.log('[SYNC] Conexión insuficiente o inestable, posponiendo.');
    isSyncing = false;
    return;
  }

  const token = await getIdToken();
  if (!token) {
    console.log('[SYNC] Sin sesión de autenticación activa. Posponiendo.');
    isSyncing = false;
    return;
  }

  const pendingItems = await getPendingItems();
  if (pendingItems.length === 0) {
    isSyncing = false;
    return;
  }

  console.log(`[SYNC] Iniciando sincronización de ${pendingItems.length} transaccion(es) pendiente(s)...`);

  let synced = 0;
  let failed = 0;

  for (const itemKey of pendingItems) {
    const parts = itemKey.split('_');
    const folio = parts[0];
    const phase = parts.slice(1).join('_');

    // Emitir inicio de sincronización para la UI
    window.dispatchEvent(new CustomEvent('sync-item-start', { detail: { folio, phase, itemKey } }));

    let isSuccess = false;
    try {
      const report = await getReportJSON(folio, phase);
      if (!report) {
        // Archivo JSON no encontrado o corrupto, lo removemos de la cola para no bloquear
        console.warn(`[SYNC] Limpiando transacción corrupta o inexistente: ${itemKey}`);
        await clearReportFiles(folio, phase);
        isSuccess = true;
        continue;
      }

      // 1. Cargar y subir la foto local asociada a Firebase Storage si existe
      let firebasePhotoUrl = '';
      const photoBlob = await getReportPhoto(folio, phase);
      if (photoBlob) {
        console.log(`[SYNC] Subiendo imagen de ${folio} (${phase}) a Firebase Storage...`);
        const contractId = report.fields.contractId || '0';
        const storagePath = `bacheo/${contractId}/${folio}/${phase}.jpg`;
        
        try {
          firebasePhotoUrl = await uploadImageToFirebase(storagePath, photoBlob);
        } catch (storageErr) {
          console.error(`[SYNC] Error de subida a Firebase Storage para ${folio} (${phase}):`, storageErr);
          failed++;
          continue; // Reintentar en el siguiente ciclo global de sync, no borrar local
        }
      }

      // 2. Construir el FormData de metadatos ligero para la API
      const fd = new FormData();
      const f = report.fields;
      fd.append('folio', f.folio);
      fd.append('contractId', f.contractId);
      fd.append('empresaName', f.empresaName || '');
      fd.append('phase', phase);
      fd.append('lat', f.lat.toString());
      fd.append('lng', f.lng.toString());
      fd.append('largo', f.largo || '0');
      fd.append('ancho', f.ancho || '0');
      fd.append('profundidad', f.profundidad || '0');
      fd.append('m2', f.m2 || '0');
      fd.append('locationDesc', f.locationDesc || '');
      fd.append('calle1', f.calle1 || '');
      fd.append('calle2', f.calle2 || '');
      fd.append('delegacion', f.delegacion || '');
      fd.append('colonia', f.colonia || '');
      fd.append('tipoBache', f.tipoBache || '');

      if (firebasePhotoUrl) {
        fd.append('firebasePhotoUrl', firebasePhotoUrl);
      }

      // 3. Enviar solicitud al Backend de Vercel
      let response;
      if (report.type === 'UPDATE') {
        response = await apiFetch(`/api/reports/${folio}/photo`, {
          method: 'POST',
          body: fd
        });
      } else {
        response = await apiFetch('/api/reports', {
          method: 'POST',
          body: fd
        });
      }

      if (response.ok || response.status === 409) {
        // Éxito o conflicto (ya registrado), limpiamos el almacenamiento del teléfono
        await clearReportFiles(folio, phase);
        synced++;
        isSuccess = true;
        const msg = response.status === 409 ? 'ya existía' : 'sincronizado';
        console.log(`[SYNC] ✅ Reporte ${folio} (${phase}) ${msg}.`);
      } else {
        failed++;
        console.warn(`[SYNC] ❌ Servidor rechazó reporte ${folio} (${phase}) con status ${response.status}.`);
      }
    } catch (err) {
      failed++;
      console.warn(`[SYNC] ❌ Error inesperado al procesar transacción ${itemKey}:`, err);
    } finally {
      // Emitir fin de sincronización para la UI
      window.dispatchEvent(new CustomEvent('sync-item-end', { detail: { folio, phase, itemKey, success: isSuccess } }));
    }
  }

  console.log(`[SYNC] Completado. Sincronizados: ${synced}, Fallidos: ${failed}`);
  isSyncing = false;
  onComplete?.({ synced, failed });
}

/**
 * Registra los listeners globales para la sincronización automática.
 */
export function registerAutoSync(onComplete?: SyncCallback): void {
  // Sincronizar al detectar internet
  window.addEventListener('online', () => {
    console.log('[SYNC] Conexión detectada. Intentando sincronizar...');
    syncPendingReports(onComplete);
  });

  // Sincronizar si mejora el tipo de conexión
  const conn = (navigator as any).connection;
  if (conn) {
    conn.addEventListener('change', () => {
      if (hasGoodConnection()) {
        console.log('[SYNC] Mejora de red detectada. Sincronizando...');
        syncPendingReports(onComplete);
      }
    });
  }

  // Intentar sincronización en el arranque
  syncPendingReports(onComplete);
}
