/**
 * Consulta de prueba del motor SOBRE DATOS DE LA BÓVEDA (vault → motor).
 *
 * Demuestra el camino Opción A: nota `.md` → VaultRuleService → InferenceEngine → Dictamen.
 * Auto-selecciona la fuente:
 *   - Si la bóveda real (`./knowledge-base/countries/MX/deducciones/`) tiene una regla
 *     para el gasto consultado → la usa (datos reales de la bóveda).
 *   - Si no → fixture VIATICOS embebida (modo arquitecto, sin notas curadas todavía).
 *
 * Uso: node scripts/test-vault-inference.js
 */

import { parseRuleNote } from '../src/lib/knowledge-engine.js';
import {
  createVaultRuleService,
  buildDatasetFromRuleSet,
  VaultRuleService,
} from '../src/lib/graph/vaultRuleService.js';
import { createInferenceEngine } from '../src/lib/graph/inferenceEngine.js';

// Fixture: cómo luce una nota VIATICOS curada (formato estricto + regimen en frontmatter).
const FIXTURE_VIATICOS = [
  '---',
  'id: 11111111-2222-3333-4444-555555555555',
  'clave: VIATICOS',
  'regimen: PM_TITULO_II',
  'vigente_desde: 2026-01-01',
  'vigente_hasta: null',
  'fuente_url: https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf',
  'source_version: SAT/RMF 2026 (LISR+CFF DOF 2026-01-01)',
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

async function main() {
  const consulta = { gasto: 'VIATICOS', regimen: 'PM_TITULO_II', pais: 'MX', fecha: '2026-06-07', monto: 8000 };

  // Intenta la bóveda real; si no hay regla aplicable, cae a la fixture (modo arquitecto).
  let service = await createVaultRuleService(consulta.pais);
  const cadena = await service.getCadenaLegal(consulta);
  let modo;
  if (cadena && cadena.aplicables.length > 0) {
    modo = 'BÓVEDA (notas reales)';
  } else {
    const { rule } = parseRuleNote(FIXTURE_VIATICOS, 'viaticos.md');
    const { dataset, warnings } = buildDatasetFromRuleSet({ iso: consulta.pais, rules: [rule], warnings: [] });
    service = new VaultRuleService(dataset, warnings);
    modo = 'FIXTURE (modo arquitecto: la bóveda MX aún no tiene notas curadas)';
  }

  console.log(`Modo: ${modo}`);
  console.log('Consulta:', JSON.stringify(consulta));

  if (service.warnings.length > 0) {
    console.log('\n⚠ Warnings del adaptador (datos que el motor espera y la nota no provee):');
    for (const w of service.warnings) console.log('  -', w);
  }

  const engine = createInferenceEngine(service);
  const dictamen = await engine.resolve(consulta);

  console.log('\n=== DICTAMEN (sobre datos de la bóveda) ===');
  console.log('Veredicto:        ', dictamen.veredicto);
  console.log('source_version:   ', dictamen.sourceVersion);
  console.log('Requiere revisión:', dictamen.requiereRevision);
  console.log('Sustento:         ', JSON.stringify(dictamen.sustento));
  console.log('\nLineage (cada eslabón con su source_version):');
  for (const paso of dictamen.rutaLegal) {
    console.log(`  • ${paso.tipo}${paso.clave ? ' ' + paso.clave : ''}  [${paso.source_version ?? 'SIN FUENTE'}]`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
