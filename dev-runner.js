import { spawn } from 'child_process';

console.log('====================================================');
console.log('🚀 INICIANDO ENTORNO LOCAL COMPLETO SP REGIS');
console.log('  1. API Backend Express -> http://localhost:3000');
console.log('  2. Frontend Vite Client -> http://localhost:5173');
console.log('====================================================\n');

const api = spawn('node', ['api/index.js'], { stdio: 'inherit', shell: true });
const vite = spawn('npx', ['vite'], { stdio: 'inherit', shell: true });

function shutdown() {
  console.log('\n[CERRANDO SERVIDORES LOCALES]...');
  try { api.kill(); } catch (e) {}
  try { vite.kill(); } catch (e) {}
  process.exit();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
