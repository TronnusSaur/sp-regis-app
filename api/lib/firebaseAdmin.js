/**
 * firebaseAdmin.js (SP REGIS - Sin Firebase)
 * Middleware de acceso directo sin Firebase ni autenticación de usuarios.
 */

export async function verifyFirebaseToken(req) {
  return { email: 'servicios.publicos@toluca.gob.mx', role: 'ADMIN' };
}

/**
 * Express middleware sin autenticación (acceso directo para Servicios Públicos).
 */
export async function requireAuth(req, res, next) {
  req.user = {
    email: 'servicios.publicos@toluca.gob.mx',
    role: 'ADMIN',
    assignments: []
  };
  next();
}
