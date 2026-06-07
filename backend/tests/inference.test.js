/**
 * Tests del motor de inferencia — escenario "Triángulo Fiscal".
 *
 * Tres versiones temporales de la misma norma (LISR_2023 / LISR_2024 / LISR_2025)
 * con ventanas de vigencia que NO se solapan. Se valida que el motor, vía un
 * Neo4jService inyectado (mock que carga el fixture), selecciona EXCLUSIVAMENTE
 * la versión vigente a la fecha de la consulta.
 *
 * Inyección de dependencias: el motor recibe el servicio por constructor.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MockNeo4jService } from '../src/lib/graph/Neo4jService.js';
import { InferenceEngine } from '../src/lib/graph/inferenceEngine.js';
import { validarProcedencia } from '../src/lib/graph/seedValidator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'fiscal_data.json');
const consulta = { gasto: 'VIATICOS', regimen: 'PM_TITULO_II', pais: 'MX' };

test('consulta en 2024-06-15 → retorna EXCLUSIVAMENTE LISR_2024 (ignora 2023 y 2025)', async () => {
  const service = await MockNeo4jService.fromFile(FIXTURE);
  const engine = new InferenceEngine(service); // inyección por constructor

  const d = await engine.resolve({ ...consulta, fecha: '2024-06-15' });

  // 1. La source_version del dictamen es la de 2024.
  assert.equal(d.sourceVersion, 'LISR_2024');

  // 2. La norma rectora del lineage es la versión 2024.
  const norma = d.rutaLegal.find((p) => p.tipo === 'Norma');
  assert.equal(norma.id, 'N-LISR-2024');
  assert.equal(norma.source_version, 'LISR_2024');

  // 3. Solo 1 norma viva; las otras 2 (2023 y 2025) quedan fuera.
  assert.equal(d.sustento.normasVivas, 1);
  assert.equal(d.sustento.derogadas, 2);

  // 4. Exclusividad estricta: el dictamen NO contiene rastro de 2023 ni 2025.
  const serializado = JSON.stringify(d);
  assert.ok(!serializado.includes('LISR_2023'), 'no debe aparecer LISR_2023');
  assert.ok(!serializado.includes('LISR_2025'), 'no debe aparecer LISR_2025');
});

test('frontera temporal: 2023-06-15 → LISR_2023; 2025-06-15 → LISR_2025', async () => {
  const engine = new InferenceEngine(await MockNeo4jService.fromFile(FIXTURE));

  const d2023 = await engine.resolve({ ...consulta, fecha: '2023-06-15' });
  assert.equal(d2023.sourceVersion, 'LISR_2023');

  const d2025 = await engine.resolve({ ...consulta, fecha: '2025-06-15' });
  assert.equal(d2025.sourceVersion, 'LISR_2025');
});

test('borde exacto: 2024-01-01 ya es LISR_2024; 2023-12-31 aún es LISR_2023', async () => {
  const engine = new InferenceEngine(await MockNeo4jService.fromFile(FIXTURE));

  assert.equal((await engine.resolve({ ...consulta, fecha: '2024-01-01' })).sourceVersion, 'LISR_2024');
  assert.equal((await engine.resolve({ ...consulta, fecha: '2023-12-31' })).sourceVersion, 'LISR_2023');
});

test('cada eslabón del lineage conserva su source_version', async () => {
  const engine = new InferenceEngine(await MockNeo4jService.fromFile(FIXTURE));
  const d = await engine.resolve({ ...consulta, fecha: '2024-06-15' });
  for (const paso of d.rutaLegal) {
    assert.ok(paso.source_version, `eslabón ${paso.tipo} sin source_version`);
  }
});

test('el fixture cumple la regla de procedencia (fuente + source_version)', async () => {
  const { readFile } = await import('node:fs/promises');
  const dataset = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const { ok, errores } = validarProcedencia(dataset);
  assert.ok(ok, `Fixture sin procedencia: ${errores.join('; ')}`);
});

test('el constructor del motor rechaza un servicio inválido', () => {
  assert.throws(() => new InferenceEngine({}), /getCadenaLegal/);
});
