/**
 * Normalizes raw date values from Google Sheets, ISO strings, or Excel serial numbers into a clean, human-readable date.
 * E.g., "46253.43" -> "19/08/2026, 10:19"
 * E.g., "2026-08-19T16:24:00Z" -> "19/08/2026, 10:24"
 * E.g., "19/08/2026, 10:24:00" -> "19/08/2026, 10:24"
 */
export function formatDisplayDate(rawVal: string | number | null | undefined): string {
  if (!rawVal) return 'Fecha no disponible';
  const str = String(rawVal).trim();
  if (!str) return 'Fecha no disponible';

  // 1. Check if it is an Excel / Google Sheets serial date number (e.g., 46253.43 or 48252.58214)
  const num = parseFloat(str);
  if (!isNaN(num) && num > 30000 && num < 70000 && /^\d+(\.\d+)?$/.test(str)) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const utcMs = (num - 25569) * msPerDay;
    const date = new Date(utcMs);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  // 2. Check if it is a standard ISO date string
  if (str.includes('T') || (str.includes('-') && str.length >= 10)) {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  return str;
}
