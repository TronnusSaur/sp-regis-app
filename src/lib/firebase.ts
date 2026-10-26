import { Preferences } from '@capacitor/preferences';

export interface AppUser {
  email: string;
  name: string;
  role: string;
}

const AUTHORIZED_ACCOUNTS = [
  {
    email: 'juanpablobumblebee@gmail.com',
    password: 'Yume2kki@',
    name: 'Juan Pablo Evans',
    role: 'ADMIN'
  },
  {
    email: 'servicios.publicos@toluca.gob.mx',
    password: 'rehabilitacion_sp',
    name: 'Servicios Públicos Toluca',
    role: 'ADMIN'
  }
];

const SESSION_KEY = 'sp_regis_active_session';
let authListeners: Array<(user: AppUser | null) => void> = [];
let currentAppUser: AppUser | null = null;

export async function signIn(emailInput: string, passwordInput: string): Promise<AppUser> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  const found = AUTHORIZED_ACCOUNTS.find(
    acc => acc.email.toLowerCase() === cleanEmail && acc.password === cleanPass
  );

  if (!found) {
    const error: any = new Error('Credenciales incorrectas. Verifica tu correo y contraseña.');
    error.code = 'auth/invalid-credential';
    throw error;
  }

  const appUser: AppUser = {
    email: found.email,
    name: found.name,
    role: found.role
  };

  currentAppUser = appUser;
  try {
    await Preferences.set({ key: SESSION_KEY, value: JSON.stringify(appUser) });
  } catch {
    try {
      localStorage.setItem(`CapacitorStorage.${SESSION_KEY}`, JSON.stringify(appUser));
    } catch {}
  }
  notifyListeners(appUser);
  return appUser;
}

export async function signOut(): Promise<void> {
  currentAppUser = null;
  try {
    await Preferences.remove({ key: SESSION_KEY });
  } catch {
    try {
      localStorage.removeItem(`CapacitorStorage.${SESSION_KEY}`);
    } catch {}
  }
  notifyListeners(null);
}

export async function getStoredUser(): Promise<AppUser | null> {
  if (currentAppUser) return currentAppUser;
  try {
    const { value } = await Preferences.get({ key: SESSION_KEY });
    if (value) {
      currentAppUser = JSON.parse(value);
      return currentAppUser;
    }
  } catch (e) {
    try {
      const raw = localStorage.getItem(`CapacitorStorage.${SESSION_KEY}`);
      if (raw) {
        currentAppUser = JSON.parse(raw);
        return currentAppUser;
      }
    } catch {}
    console.warn('[AUTH] Error al leer sesión cacheada:', e);
  }
  return null;
}

export function onAuthChange(callback: (user: AppUser | null) => void): () => void {
  authListeners.push(callback);

  // Initial check
  getStoredUser().then(user => {
    callback(user);
  });

  return () => {
    authListeners = authListeners.filter(cb => cb !== callback);
  };
}

function notifyListeners(user: AppUser | null) {
  authListeners.forEach(cb => cb(user));
}

export async function getIdToken(): Promise<string | null> {
  return 'mock-sp-regis-token';
}

export async function uploadImageToFirebase(_path: string, _blob: Blob): Promise<string> {
  return '';
}
