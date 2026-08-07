import { google } from 'googleapis';
import { getOAuth2Client } from './auth.js';
import { loadTokens, saveTokens } from './db.js';

let cachedClient = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 50 * 60 * 1000; // 50 minutes (tokens expire at 60)

export async function getGoogleClient() {
  // Return cached client if still valid
  if (cachedClient && Date.now() < cacheExpiry) {
    return cachedClient;
  }

  // Priority 1: User OAuth2 (Loads from DB/file, auto-refreshes)
  try {
    const tokens = await loadTokens();
    
    if (tokens) {
      console.log('[GS-CLIENT] Cargando tokens OAuth de usuario...');
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials(tokens);

      // Auto-refresh if the access_token is expired or about to expire
      const expiryDate = tokens.expiry_date || 0;
      const isExpired = Date.now() >= expiryDate - 60000; // 1 min buffer

      if (isExpired && tokens.refresh_token) {
        console.log('[GS-CLIENT] Token expirado, refrescando automáticamente...');
        const { credentials } = await oauth2Client.refreshAccessToken();
        const newTokens = { ...credentials, refresh_token: tokens.refresh_token };
        await saveTokens(newTokens);
        oauth2Client.setCredentials(newTokens);
        console.log('[GS-CLIENT] Token refrescado y guardado en disco.');
      }

      cachedClient = oauth2Client;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
      return cachedClient;
    }
  } catch (err) {
    console.error('[GS-CLIENT ERROR] Error al cargar/refrescar tokens desde DB:', err.message);
  }

  // Priority 2: Service Account (Fallback) 
  if (process.env.GOOGLE_CREDENTIALS) {
    let creds;
    try {
      creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch (_) {
      try {
        creds = JSON.parse(process.env.GOOGLE_CREDENTIALS.replace(/\\n/g, '\n'));
      } catch (err2) {
        // Fallback for double backslashes in .env
        creds = JSON.parse(process.env.GOOGLE_CREDENTIALS.replace(/\\\\n/g, '\\n'));
      }
    }
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = await auth.getClient();
    cachedClient = client;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return cachedClient;
  }

  throw new Error('NO AUTH CONFIGURED. Provide GOOGLE_TOKENS in DB or GOOGLE_CREDENTIALS.');
}
