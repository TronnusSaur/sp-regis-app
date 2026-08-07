import { google } from 'googleapis';

export function getOAuth2Client() {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

  return new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // CRITICAL: Get refresh token
    scope: scopes,
    prompt: 'consent', // Ensure refresh token is sent every time if needed
  });
}

export async function getTokensFromCode(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export function setClientTokens(tokens) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}
