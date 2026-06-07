/**
 * Seed del grafo legal.
 *
 * 1. Valida la PROCEDENCIA del dataset (ningún dato sin fuente + source_version).
 * 2. Aplica el schema (constraints) a Neo4j.
 * 3. Hace upsert de nodos y relaciones vía el Cypher Query Service.
 *
 * Si Neo4j no está accesible, aborta tras la validación (la validación SÍ corre
 * sin DB, así que sirve como gate en "Modo Arquitecto").
 *
 * Uso: node scripts/seed-graph.js
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validarProcedencia } from '../src/lib/graph/seedValidator.js';
import { verifyConnectivity, runQuery, closeDriver } from '../src/lib/neo4j.js';
import * as cypherService from '../src/lib/graph/cypherService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'seed', 'normas_titulo_ii.json');
const SCHEMA_PATH = path.join(__dirname, '..', 'src', 'lib', 'graph', 'schema.cypher');

async function main() {
  const dataset = JSON.parse(await readFile(SEED_PATH, 'utf8'));

  // 1. Gate de procedencia
  const { ok, errores, stats } = validarProcedencia(dataset);
  console.log('Procedencia:', JSON.stringify(stats));
  if (!ok) {
    console.error('❌ Seed rechazado: datos sin fuente/source_version:');
    errores.forEach((e) => console.error('  -', e));
    process.exit(1);
  }
  console.log('✅ Procedencia válida: todo nodo/relación tiene fuente + source_version.');

  // 2. ¿Hay Neo4j?
  const conn = await verifyConnectivity();
  if (!conn.ok) {
    console.warn(`\n⚠️  Neo4j no accesible (${conn.error}).`);
    console.warn('   Validación superada pero NO se sembró. Levanta Neo4j y reintenta.');
    await closeDriver();
    process.exit(2);
  }

  // 3. Schema
  const schema = await readFile(SCHEMA_PATH, 'utf8');
  for (const stmt of schema.split(';').map((s) => s.trim()).filter((s) => s && !s.startsWith('//'))) {
    await runQuery(stmt, {}, { write: true });
  }
  console.log('✅ Schema aplicado (constraints/índices).');

  // 4. Upsert nodos
  for (const r of dataset.regimenes) await cypherService.upsertNodo('Regimen', r);
  for (const g of dataset.gastos) await cypherService.upsertNodo('Gasto', g);
  for (const n of dataset.normas) await cypherService.upsertNodo('Norma', n);
  for (const c of dataset.criterios) await cypherService.upsertNodo('Criterio', c);

  // 5. Upsert relaciones
  for (const rel of dataset.relaciones) await cypherService.mergeRelacion(rel);

  console.log('✅ Grafo sembrado.');
  await closeDriver();
}

main().catch(async (err) => {
  console.error('Error en seed:', err);
  await closeDriver();
  process.exit(1);
});
