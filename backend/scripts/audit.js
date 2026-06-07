/**
 * CLI de auditoría del grafo legal.
 *
 * Ejecuta el GraphAuditor (detectarOrfanos + validarConsistenciaVersiones) y
 * reporta en terminal con colores. Sale con código 1 si hay problemas, 0 si limpio.
 *
 * Auto-selecciona la fuente:
 *   - Neo4j accesible → RealNeo4jService (audita el grafo real).
 *   - Si no          → MockNeo4jService con el seed (modo arquitecto).
 *
 * Uso:
 *   node scripts/audit.js                 # audita el seed (o Neo4j si está arriba)
 *   node scripts/audit.js --data=ruta.json   # audita un dataset específico
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from '../src/config/index.js';
import { verifyConnectivity, closeDriver } from '../src/lib/neo4j.js';
import { RealNeo4jService, MockNeo4jService } from '../src/lib/graph/Neo4jService.js';
import { GraphAuditor } from '../src/services/GraphAuditor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA = path.join(__dirname, '..', 'seed', 'normas_titulo_ii.json');

// --- colores (ANSI, sin dependencias; respeta NO_COLOR y no-TTY) ---
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => paint('31', s);
const green = (s) => paint('32', s);
const yellow = (s) => paint('33', s);
const bold = (s) => paint('1', s);
const dim = (s) => paint('2', s);

function seccion(titulo, reporte, formatear) {
  console.log('\n' + bold('▸ ' + titulo));
  if (reporte.status === 'ok') {
    console.log('  ' + green('✓ OK') + dim(' (sin incidencias)'));
  } else {
    console.log('  ' + red(`✗ ${reporte.count} incidencia(s):`));
    for (const issue of reporte.issues) console.log('    ' + red('•') + ' ' + formatear(issue));
  }
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--data='));
  const dataPath = arg ? path.resolve(arg.slice('--data='.length)) : DEFAULT_DATA;
  const pais = config.defaultCountry;

  // Selección de servicio
  const conn = await verifyConnectivity();
  let service;
  let modo;
  if (conn.ok) {
    service = new RealNeo4jService();
    modo = 'GRAFO (Neo4j)';
  } else {
    const dataset = JSON.parse(await readFile(dataPath, 'utf8'));
    service = new MockNeo4jService(dataset);
    modo = `MOCK (${path.basename(dataPath)})`;
  }

  console.log(bold(`🔍 Auditoría de Grafo — país ${pais}`) + dim(`  ·  modo: ${modo}`));

  const auditor = new GraphAuditor(service);
  const orfanos = await auditor.detectarOrfanos({ pais });
  const consistencia = await auditor.validarConsistenciaVersiones({ pais });

  seccion('Gastos huérfanos', orfanos, (i) => `${bold(i.gasto)} — ${yellow(i.motivo)}`);
  seccion('Consistencia de versiones', consistencia, (i) => `${bold(i.normaId)} ${yellow(i.tipo)}: ${i.detalle}`);

  const totalIssues = orfanos.count + consistencia.count;
  console.log('');
  if (totalIssues === 0) {
    console.log(green(bold('✓ Auditoría OK')) + dim(' — el grafo está limpio.'));
  } else {
    console.log(red(bold(`✗ Auditoría FALLÓ`)) + ` — ${totalIssues} incidencia(s) en total.`);
  }

  await closeDriver();
  process.exit(totalIssues === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(red('Error ejecutando la auditoría:'), err);
  await closeDriver();
  process.exit(1);
});
