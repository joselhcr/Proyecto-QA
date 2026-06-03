/**
 * Ejecución automática de TC-R-05 — Tiempo de carga inicial del frontend
 * El frontend debe estar corriendo en http://localhost:3000
 * Ejecutar: node tests/manual/run-tc-r-05.js
 */
const http = require('http');
const path = require('path');
const fs   = require('fs');

const FRONTEND_URL = 'http://localhost:3000';
const UMBRAL_MS    = 3000;

function medirCarga(url) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let totalBytes = 0;
    const req = http.get(url, (res) => {
      res.on('data', chunk => { totalBytes += chunk.length; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          ms: Date.now() - t0,
          bytes: totalBytes,
          headers: res.headers,
        });
      });
    });
    req.on('error', e => resolve({ status: 0, ms: Date.now() - t0, bytes: 0, error: e.message }));
    req.setTimeout(10000, () => { req.destroy(); });
  });
}

function contarRecursos(html) {
  const scripts  = (html.match(/<script[^>]+src=/gi) || []).length;
  const links    = (html.match(/<link[^>]+href=/gi) || []).length;
  const imgs     = (html.match(/<img[^>]+src=/gi) || []).length;
  return { scripts, links, imgs, total: scripts + links + imgs };
}

async function run() {
  console.log('\n====================================================');
  console.log(' TC-R-05 — Tiempo de carga inicial de la aplicación');
  console.log('====================================================\n');

  // Verificar que el frontend está corriendo
  const check = await medirCarga(FRONTEND_URL);
  if (check.status === 0) {
    console.error('ERROR: Frontend no detectado en ' + FRONTEND_URL);
    process.exit(1);
  }

  const mediciones = [];
  let html = '';

  console.log(` Med. | HTTP | Tiempo(ms) | Tamaño(KB)`);
  console.log(`------+------+------------+-----------`);

  for (let i = 1; i <= 3; i++) {
    const r = await medirCarga(FRONTEND_URL);
    // Obtener HTML solo en la primera medición
    if (i === 1) {
      const res2 = await new Promise(resolve => {
        let d = ''; http.get(FRONTEND_URL, res => { res.on('data', c => d += c); res.on('end', () => resolve(d)); });
      });
      html = res2;
    }
    const kb = (r.bytes / 1024).toFixed(1);
    const pasa = r.ms <= UMBRAL_MS ? '✅' : '❌';
    console.log(`  ${i}   | ${r.status} | ${String(r.ms).padEnd(10)} | ${kb} KB  ${pasa}`);
    mediciones.push({ n: i, status: r.status, ms: r.ms, kb });
    await new Promise(r => setTimeout(r, 500));
  }

  const promedio = Math.round(mediciones.reduce((s, m) => s + m.ms, 0) / mediciones.length);
  const recursos = contarRecursos(html);
  const pasa = promedio <= UMBRAL_MS;

  console.log(`------+------+------------+-----------`);
  console.log(` Prom | —    | ${String(promedio).padEnd(10)} | ${pasa ? 'PASA ✅' : 'FALLA ❌'}\n`);
  console.log(`Recursos detectados en HTML: Scripts=${recursos.scripts}, Links=${recursos.links}, Imágenes=${recursos.imgs}`);
  console.log(`\nNOTA: Medición programática (TTFB + descarga HTML).`);
  console.log(`Para FCP/TTI completo se recomienda validar manualmente con Chrome DevTools.\n`);
  console.log(`Resultado: ${pasa ? 'PASA ✅ — Promedio ' + promedio + 'ms <= 3000ms' : 'FALLA ❌ — Promedio ' + promedio + 'ms > 3000ms'}\n`);

  // Actualizar el markdown
  const mdPath = path.join(__dirname, 'TC-R-05-carga-frontend.md');
  let md = fs.readFileSync(mdPath, 'utf8');

  // Reemplazar filas de mediciones
  let tablaDevTools = '| Medición | Load (ms) | Recursos # | Tamaño total (KB) |\n|---|---|---|---|\n';
  for (const m of mediciones) {
    tablaDevTools += `| ${m.n} | ${m.ms} | ${recursos.total} | ${m.kb} |\n`;
  }
  tablaDevTools += `| **Promedio** | **${promedio}** | | |\n`;

  md = md.replace(
    /\| Medición \| Load \(ms\) \| Recursos # \| Tamaño total \(KB\) \|[\s\S]*?\| \*\*Promedio\*\* \|.*\n/,
    tablaDevTools
  );

  // Actualizar lighthouse con nota de medición programática
  md = md.replace(
    '| First Contentful Paint (FCP) | | ≤ 1500ms | |',
    `| First Contentful Paint (FCP) | N/A (medición programática) | ≤ 1500ms | Pendiente verificación manual |`
  );
  md = md.replace(
    '| Time to Interactive (TTI) | | ≤ 3500ms | |',
    `| Time to Interactive (TTI) | N/A (medición programática) | ≤ 3500ms | Pendiente verificación manual |`
  );
  md = md.replace(
    '| Performance Score | | ≥ 70 | |',
    `| Performance Score | N/A (medición programática) | ≥ 70 | Pendiente verificación manual |`
  );

  if (pasa) {
    md = md.replace('- [ ] PASA — Tiempo de carga promedio ≤ 3000ms', `- [x] PASA — Tiempo de carga promedio ${promedio}ms ≤ 3000ms`);
  } else {
    md = md.replace('- [ ] FALLA — Tiempo de carga promedio > 3000ms (documentar defecto)',
      `- [x] FALLA — Tiempo de carga promedio ${promedio}ms > 3000ms`);
  }

  fs.writeFileSync(mdPath, md, 'utf8');
  console.log('Markdown TC-R-05 actualizado con resultados reales.\n');
}

run().catch(e => { console.error(e); process.exit(1); });
