// make-version.js
// v2026-10-22 - NOVÝ SOUBOR: Vercel ho spustí při každém nasazení (viz vercel.json) a vytvoří
//             version.json s číslem commitu a časem. Apka to ukáže v modrém pruhu u ADMIN.
const fs = require('fs');
const commit = (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7);
const date = new Date().toLocaleString('cs-CZ', {
  timeZone: 'Europe/Prague', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
});
fs.writeFileSync('version.json', JSON.stringify({ commit, date }));
console.log('version.json:', commit, date);
