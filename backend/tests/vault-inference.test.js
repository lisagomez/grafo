/**
 * Test de integración: Bóveda → Motor (Opción A).
 *
 * Verifica el camino completo nota `.md` → VaultRuleService → InferenceEngine → Dictamen,
 * incluyendo el lineage trazable y la degradación a CONDICIONAL por tope, sobre una nota
 * en el formato real de la bóveda. No toca el filesystem (usa una fixture en memoria).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseRuleNote } from '../src/lib/knowledge-engine.js';
import {
  buildDatasetFromRuleSet,
  VaultRuleService,
} from '../src/lib/graph/vaultRuleService.js';
import { createInferenceEngine } from '../src/lib/graph/inferenceEngine.js';

const SOURCE_VERSION = 'SAT/RMF 2026 (LISR+CFF DOF 2026-01-01)';

/** Nota VIATICOS bien formada (formato estricto + regimen en frontmatter). */
const NOTA_VIATICOS = [
  '---',
  'id: 11111111-2222-3333-4444-555555555555',
  'clave: VIATICOS',
  'regimen: PM_TITULO_II',
  'vigente_desde: 2026-01-01',
  'vigente_hasta: null',
  'fuente_url: https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf',
  `source_version: ${SOURCE_VERSION}`,
  '---',
  '',
  '## Contexto Legal',
  'Art. 28 LISR (viáticos)',
  '',
  '## Pseudocódigo de Grafo',
  '```',
  '(Gasto:Gasto) -[ES_DEDUCIBLE_SI]-> (Cumple_Requisito:Requisito) {tope_monto: 10000, tope_pct: 8, condicion: "CFDI"}',
  '```',
  '',
].join('\n');

/** Construye un VaultRuleService desde una o más notas en memoria. */
function serviceFromNotes(notes) {
  const rules = notes.map((md, i) => parseRuleNote(md, `nota${i}.md`).rule);
  const { dataset, warnings } = buildDatasetFromRuleSet({ iso: 'MX', rules, warnings: [] });
  return { service: new VaultRuleService(dataset, warnings), dataset, warnings };
}

test('mapeo transparente: la arista positiva se traduce a APLICA_A con topes y condición', () => {
  const { dataset, warnings } = serviceFromNotes([NOTA_VIATICOS]);
  assert.deepEqual(warnings, []); // nota completa → sin avisos del adaptador

  assert.equal(dataset.relaciones.length, 1);
  const rel = dataset.relaciones[0];
  assert.equal(rel.tipo, 'APLICA_A');
  assert.equal(rel.toVal, 'VIATICOS');
  assert.deepEqual(rel.props, {
    regimen: 'PM_TITULO_II',
    veredicto_base: 'DEDUCIBLE',
    tope_monto: 10000,
    tope_pct: 8,
    condicion: 'CFDI',
    source_version: SOURCE_VERSION,
  });
});

test('Dictamen DEDUCIBLE con lineage trazable cuando el monto no excede el tope', async () => {
  const { service } = serviceFromNotes([NOTA_VIATICOS]);
  const engine = createInferenceEngine(service);

  const dictamen = await engine.resolve({
    gasto: 'VIATICOS', regimen: 'PM_TITULO_II', pais: 'MX', fecha: '2026-06-07', monto: 8000,
  });

  assert.equal(dictamen.veredicto, 'DEDUCIBLE');
  assert.equal(dictamen.sourceVersion, SOURCE_VERSION);
  assert.equal(dictamen.requiereRevision, false);

  // Lineage: Gasto + Norma + Relacion, cada eslabón con su source_version.
  const tipos = dictamen.rutaLegal.map((p) => p.tipo);
  assert.deepEqual(tipos, ['Gasto', 'Norma', 'Relacion']);
  assert.ok(dictamen.rutaLegal.every((p) => p.source_version === SOURCE_VERSION));
  const norma = dictamen.rutaLegal.find((p) => p.tipo === 'Norma');
  assert.equal(norma.clave, 'Art. 28 LISR (viáticos)'); // etiqueta tomada del Contexto Legal
});

test('degrada a CONDICIONAL cuando el monto excede el tope_monto', async () => {
  const { service } = serviceFromNotes([NOTA_VIATICOS]);
  const engine = createInferenceEngine(service);

  const dictamen = await engine.resolve({
    gasto: 'VIATICOS', regimen: 'PM_TITULO_II', pais: 'MX', fecha: '2026-06-07', monto: 25000,
  });
  assert.equal(dictamen.veredicto, 'CONDICIONAL');
  assert.equal(dictamen.sustento.tope_monto, 10000);
});

test('una consulta con un régimen no declarado en la nota no encuentra base (NO_DEDUCIBLE)', async () => {
  const { service } = serviceFromNotes([NOTA_VIATICOS]); // solo PM_TITULO_II
  const engine = createInferenceEngine(service);
  const dictamen = await engine.resolve({
    gasto: 'VIATICOS', regimen: 'RESICO', pais: 'MX', fecha: '2026-06-07', monto: 8000,
  });
  assert.equal(dictamen.veredicto, 'NO_DEDUCIBLE');
});

test('warning claro del adaptador cuando la nota no declara régimen', () => {
  const sinRegimen = NOTA_VIATICOS.replace('regimen: PM_TITULO_II\n', '');
  const { warnings, dataset } = serviceFromNotes([sinRegimen]);
  assert.ok(warnings.some((w) => /sin 'regimen'/.test(w)));
  assert.equal(dataset.relaciones.length, 0); // sin régimen → ninguna APLICA_A
});

test('warning claro del adaptador cuando la nota no declara source_version', () => {
  const sinSource = NOTA_VIATICOS.replace(`source_version: ${SOURCE_VERSION}\n`, '');
  const { warnings } = serviceFromNotes([sinSource]);
  assert.ok(warnings.some((w) => /sin 'source_version'/.test(w)));
});
