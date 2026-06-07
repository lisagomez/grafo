/**
 * Consulta de prueba del motor de inferencia.
 *
 * Demuestra que el motor lee la lógica de negocio y la aplica a un nodo del grafo.
 * Auto-selecciona la fuente:
 *   - Si Neo4j está accesible → RealNeo4jService (grafo).
 *   - Si no → MockNeo4jService con el seed (modo arquitecto, sin DB).
 *
 * Uso: node scripts/test-inference.js
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifyConnectivity, closeDriver } from '../src/lib/neo4j.js';
import { RealNeo4jService, MockNeo4jService } from '../src/lib/graph/Neo4jService.js';
import { createInferenceEngine } from '../src/lib/graph/inferenceEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'seed', 'normas_titulo_ii.json');

async function main() {
  const conn = await verifyConnectivity();
  let service;
  if (conn.ok) {
    service = new RealNeo4jService();
    console.log('Modo: GRAFO (Neo4j accesible)\n');
  } else {
    const dataset = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    service = new MockNeo4jService(dataset);
    console.log(`Modo: MOCK (Neo4j no accesible: ${conn.error})\n`);
  }

  const consulta = { gasto: 'VIATICOS', regimen: 'PM_TITULO_II', pais: 'MX', fecha: '2026-06-07', monto: 8000 };
  console.log('Consulta:', JSON.stringify(consulta));

  const engine = createInferenceEngine(service);
  const dictamen = await engine.resolve(consulta);

  console.log('\n=== DICTAMEN ===');
  console.log('Veredicto:      ', dictamen.veredicto);
  console.log('source_version: ', dictamen.sourceVersion);
  console.log('Requiere revisión:', dictamen.requiereRevision);
  console.log('Sustento:       ', JSON.stringify(dictamen.sustento));
  console.log('\nLineage (cada eslabón con su source_version):');
  for (const paso of dictamen.rutaLegal) {
    console.log(`  • ${paso.tipo}${paso.clave ? ' ' + paso.clave : ''}  [${paso.source_version ?? 'SIN FUENTE'}]`);
  }

  await closeDriver();
}

main().catch(async (err) => {
  console.error(err);
  await closeDriver();
  process.exit(1);
});
