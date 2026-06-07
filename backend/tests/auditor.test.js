/**
 * Tests del GraphAuditor (auditoría proactiva, sin Neo4j).
 *
 * Usa el patrón de mock inyectable: MockNeo4jService cargado desde fixture
 * (con errores deliberados) y también con un dataset limpio inyectado en memoria.
 * Valida el contrato de reporte { status, issues, count } en ambos métodos.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MockNeo4jService } from '../src/lib/graph/Neo4jService.js';
import { GraphAuditor } from '../src/services/GraphAuditor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'audit_data.json');

async function auditorConErrores() {
  return new GraphAuditor(await MockNeo4jService.fromFile(FIXTURE));
}

// --- detectarOrfanos() ---

test('detectarOrfanos: reporte con status "error" y count correcto', async () => {
  const rep = await (await auditorConErrores()).detectarOrfanos({ pais: 'MX', fecha: '2024-06-15' });
  assert.equal(rep.status, 'error');
  assert.equal(rep.count, 2);
  assert.equal(rep.issues.length, rep.count);
});

test('detectarOrfanos: DONATIVOS=SIN_NORMA y COMBUSTIBLES=SIN_VIGENTE', async () => {
  const { issues } = await (await auditorConErrores()).detectarOrfanos({ pais: 'MX', fecha: '2024-06-15' });
  assert.equal(issues.find((i) => i.gasto === 'DONATIVOS')?.motivo, 'SIN_NORMA');
  assert.equal(issues.find((i) => i.gasto === 'COMBUSTIBLES')?.motivo, 'SIN_VIGENTE');
  assert.ok(!issues.some((i) => i.gasto === 'VIATICOS'));
});

// --- validarConsistenciaVersiones() ---

test('validarConsistenciaVersiones: status "error" detecta VENTANA_INVALIDA y SOURCE_MISMATCH', async () => {
  const rep = await (await auditorConErrores()).validarConsistenciaVersiones({ pais: 'MX' });
  assert.equal(rep.status, 'error');
  assert.ok(rep.count >= 2);
  assert.ok(rep.issues.some((d) => d.normaId === 'N-MAL-VENTANA' && d.tipo === 'VENTANA_INVALIDA'));
  assert.ok(rep.issues.some((d) => d.normaId === 'N-VIATICOS-2024' && d.tipo === 'SOURCE_MISMATCH'));
});

// --- caso limpio (status 'ok') con mock inyectado en memoria ---

test('grafo sano → ambos métodos devuelven status "ok", count 0, issues []', async () => {
  const datasetLimpio = {
    regimenes: [{ clave: 'PM_TITULO_II', pais: 'MX', source_version: 'v1' }],
    gastos: [{ clave: 'VIATICOS', pais: 'MX', source_version: 'v1' }],
    normas: [{ id: 'N1', pais: 'MX', clave: 'Art X', vigente_desde: '2024-01-01', vigente_hasta: null, source_version: 'v1' }],
    criterios: [],
    relaciones: [
      { tipo: 'APLICA_A', fromVal: 'N1', toVal: 'VIATICOS', props: { regimen: 'PM_TITULO_II', source_version: 'v1' } },
    ],
  };
  const auditor = new GraphAuditor(new MockNeo4jService(datasetLimpio)); // inyección directa

  const orf = await auditor.detectarOrfanos({ pais: 'MX', fecha: '2024-06-15' });
  assert.deepEqual(orf, { status: 'ok', issues: [], count: 0 });

  const cons = await auditor.validarConsistenciaVersiones({ pais: 'MX' });
  assert.deepEqual(cons, { status: 'ok', issues: [], count: 0 });
});

test('el constructor rechaza un servicio sin exportGrafo()', () => {
  assert.throws(() => new GraphAuditor({}), /exportGrafo/);
});
