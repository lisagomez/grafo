/**
 * Test de estrés del GraphAuditor.
 *
 * Genera un grafo sintético grande con un número CONOCIDO de inconsistencias
 * inyectadas (huérfanos + versiones inválidas), lanza N auditorías CONCURRENTES
 * y valida:
 *   - Correctitud bajo carga: cada corrida detecta exactamente lo inyectado.
 *   - Determinismo: ninguna corrida concurrente contamina a otra (auditor stateless).
 *   - Rendimiento: throughput + latencia p50/p95 (línea base de "tiempo real").
 *
 * Corre 100% en memoria (MockNeo4jService) — sin Neo4j.
 *
 * Uso:
 *   node scripts/stress-audit.js
 *   node scripts/stress-audit.js --gastos=2000 --orphans=100 --bad=100 --concurrency=100
 *
 * Exit: 0 si todas las corridas dieron el conteo exacto · 1 si alguna falló.
 */

import { performance } from 'node:perf_hooks';
import { MockNeo4jService } from '../src/lib/graph/Neo4jService.js';
import { GraphAuditor } from '../src/services/GraphAuditor.js';

const argNum = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.slice(name.length + 3)) : def;
};

const HEALTHY = argNum('gastos', 1000);     // gastos sanos (cada uno con su norma vigente)
const ORPHANS = argNum('orphans', 50);      // gastos sin norma → SIN_NORMA
const BAD = argNum('bad', 50);              // normas con ventana inválida → VENTANA_INVALIDA
const CONCURRENCY = argNum('concurrency', 100);
const PAIS = 'MX';
const FECHA = '2024-06-15';

/** Construye un grafo sintético con inconsistencias conocidas. */
function buildDataset() {
  const gastos = [];
  const normas = [];
  const relaciones = [];

  // Gastos sanos: cada uno con una norma vigente y consistente.
  for (let i = 0; i < HEALTHY; i++) {
    const gc = `G_${i}`;
    const nid = `N_${i}`;
    gastos.push({ clave: gc, pais: PAIS, source_version: 'v1' });
    normas.push({ id: nid, pais: PAIS, clave: `Art ${i}`, vigente_desde: '2020-01-01', vigente_hasta: null, source_version: 'v1' });
    relaciones.push({ tipo: 'APLICA_A', fromVal: nid, toVal: gc, props: { regimen: 'R', source_version: 'v1' } });
  }
  // Huérfanos: gastos sin ninguna relación APLICA_A.
  for (let i = 0; i < ORPHANS; i++) gastos.push({ clave: `ORPH_${i}`, pais: PAIS, source_version: 'v1' });

  // Inconsistencias de versión: normas standalone con ventana inválida (hasta < desde).
  for (let i = 0; i < BAD; i++) {
    normas.push({ id: `BAD_${i}`, pais: PAIS, clave: `Bad ${i}`, vigente_desde: '2025-01-01', vigente_hasta: '2023-12-31', source_version: 'v1' });
  }
  return { regimenes: [{ clave: 'R', pais: PAIS, source_version: 'v1' }], gastos, normas, criterios: [], relaciones };
}

function percentil(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  const dataset = buildDataset();
  const expectedOrphans = ORPHANS;
  const expectedConsistency = BAD;

  console.log('🏋  Test de estrés — GraphAuditor');
  console.log(`Grafo: ${dataset.gastos.length} gastos · ${dataset.normas.length} normas · ${dataset.relaciones.length} relaciones`);
  console.log(`Inyectado: ${expectedOrphans} huérfanos · ${expectedConsistency} inconsistencias de versión`);
  console.log(`Concurrencia: ${CONCURRENCY} auditorías simultáneas\n`);

  const service = new MockNeo4jService(dataset);
  const auditor = new GraphAuditor(service);

  const latencias = [];
  let fallos = 0;

  const t0 = performance.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      const s = performance.now();
      const orf = await auditor.detectarOrfanos({ pais: PAIS, fecha: FECHA });
      const cons = await auditor.validarConsistenciaVersiones({ pais: PAIS });
      latencias.push(performance.now() - s);
      if (orf.count !== expectedOrphans || cons.count !== expectedConsistency) fallos += 1;
    }),
  );
  const totalMs = performance.now() - t0;

  latencias.sort((a, b) => a - b);
  console.log('=== Resultados ===');
  console.log(`Correctitud: ${CONCURRENCY - fallos}/${CONCURRENCY} corridas con conteo exacto ${fallos === 0 ? '✅' : '❌'}`);
  console.log(`Wall time total: ${totalMs.toFixed(1)} ms`);
  console.log(`Throughput: ${(CONCURRENCY / (totalMs / 1000)).toFixed(1)} auditorías/seg`);
  console.log(`Latencia por auditoría → p50: ${percentil(latencias, 50).toFixed(2)} ms · p95: ${percentil(latencias, 95).toFixed(2)} ms · max: ${latencias[latencias.length - 1].toFixed(2)} ms`);

  if (fallos > 0) {
    console.log(`\n❌ ${fallos} corrida(s) detectaron un conteo distinto al inyectado (posible condición de carrera).`);
    process.exit(1);
  }
  console.log('\n✅ Detección consistente y exacta bajo carga concurrente.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error en el test de estrés:', err);
  process.exit(1);
});
