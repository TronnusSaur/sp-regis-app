import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { google } from 'googleapis';
import { getGoogleClient } from './googleClient.js';
import fs from 'fs';
import path from 'path';

export async function createSpMasterSheet() {
  try {
    const auth = await getGoogleClient();
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('[SP SHEET] Creando nuevo libro en Google Sheets para Servicios Públicos...');
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: 'SP REGIS - Master Sheet (Servicios Públicos Toluca)'
        },
        sheets: [
          {
            properties: {
              title: 'Hoja 1'
            }
          }
        ]
      }
    });

    const newSheetId = createRes.data.spreadsheetId;
    const spreadsheetUrl = createRes.data.spreadsheetUrl;
    console.log(`[SP SHEET SUCCESS] ✅ Nuevo libro creado: ${spreadsheetUrl} (ID: ${newSheetId})`);

    // Insert headers (A to T)
    const headers = [
      'Folio', 'Fecha', 'Contrato', 'Empresa', 'Ubicación (Ref)', 'Delegación', 'Colonia', 
      'Coordenadas (Lat,Lng)', 'Largo (M)', 'Ancho (M)', 'Profundidad (M)', 'M2', 'Tipo Bache', 'Estatus', 
      'Foto Inicial (Link)', 'Photo Caja', 'Photo Final', 'Calle 1', 'Calle 2', 'Responsable (T)'
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: newSheetId,
      range: 'Hoja 1!A1:T1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers]
      }
    });

    console.log('[SP SHEET SUCCESS] ✅ Encabezados A-T configurados.');

    // Update .env.local automatically
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      content = content.replace(/SHEET_ID="[^"]*"/, `SHEET_ID="${newSheetId}"`);
      fs.writeFileSync(envPath, content, 'utf8');
      process.env.SHEET_ID = newSheetId;
      console.log(`[SP SHEET SUCCESS] ✅ .env.local actualizado con SHEET_ID="${newSheetId}"`);
    }

    return { newSheetId, spreadsheetUrl };
  } catch (err) {
    console.error('[SP SHEET ERROR]', err);
    throw err;
  }
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('createSpSheet.js')) {
  createSpMasterSheet().catch(console.error);
}
