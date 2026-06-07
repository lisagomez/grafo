/**
 * audit.template.js — CLI de auditoría PORTABLE (autónomo).
 *
 * Diseñado para funcionar tal cual junto a GraphAuditor.template.js y
 * Neo4jService.template.js copiados en la MISMA carpeta. No depende de ninguna
 * config interna: lee credenciales de variables de entorno.
 *
 * Requisitos: "type": "module" en package.json · `npm install neo4j-driver` · Node ≥ 18.
 *
 * Uso:
 *   NEO4J_URI=... NEO4J_USER=... NEO4J_PASSWORD=... node audit.js   # audita Neo4j
 *   node audit.js --data=fixture.json                               # modo mock (sin Neo4j)
 *
 * Exit codes: 0 = limpio · 1 = incidencias · 2 = sin fuente de datos (ni Neo4j ni --data).
 */

import { RealNeo4jService, MockNeo4jService } from './Neo4jService.js';
import { GraphAuditor } from './GraphAuditor.js';

const pais = process.env.DEFAULT_COUNTRY ?? 'MX';

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

async function resolverServicio(dataPath) {
  const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, NEO4J_DATABASE } = process.env;
  // 1) Si hay credenciales, intentar Neo4j real.
  if (NEO4J_URI && NEO4J_USER && NEO4J_PASSWORD) {
    const real = new RealNeo4jService({
      uri: NEO4J_URI, user: NEO4J_USER, password: NEO4J_PASSWORD, database: NEO4J_DATABASE,
    });
    const conn = await real.verifyConnectivity();
    if (conn.ok) return { service: real, modo: 'GRAFO (Neo4j)' };
    await real.close();
    console.log(yellow(`⚠ Neo4j no accesible (${conn.error}).`));
  }
  // 2) Fallback a mock si se dio --data.
  if (dataPath) {
    return { service: await MockNeo4jService.fromFile(dataPath), modo: `MOCK (${dataPath})` };
  }
  // 3) Sin fuente de datos.
  return null;
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--data='));
  const dataPath = arg ? arg.slice('--data='.length) : null;

  const resuelto = await resolverServicio(dataPath);
  if (!resuelto) {
    console.error(red('✗ Sin fuente de datos.') + ' Define NEO4J_URI/USER/PASSWORD, o pasa --data=ruta.json (modo mock).');
    process.exit(2);
  }
  const { service, modo } = resuelto;

  console.log(bold(`🔍 Auditoría de Grafo — país ${pais}`) + dim(`  ·  modo: ${modo}`));

  const auditor = new GraphAuditor(service);
  const orfanos = await auditor.detectarOrfanos({ pais });
  const consistencia = await auditor.validarConsistenciaVersiones({ pais });

  seccion('Gastos huérfanos', orfanos, (i) => `${bold(i.gasto)} — ${yellow(i.motivo)}`);
  seccion('Consistencia de versiones', consistencia, (i) => `${bold(i.normaId)} ${yellow(i.tipo)}: ${i.detalle}`);

  const totalIssues = orfanos.count + consistencia.count;
  console.log('');
  if (totalIssues === 0) console.log(green(bold('✓ Auditoría OK')) + dim(' — el grafo está limpio.'));
  else console.log(red(bold('✗ Auditoría FALLÓ')) + ` — ${totalIssues} incidencia(s) en total.`);

  await service.close();
  process.exit(totalIssues === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(red('Error ejecutando la auditoría:'), err);
  process.exit(1);
});
