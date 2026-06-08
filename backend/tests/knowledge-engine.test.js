/**
 * Pruebas del Knowledge Engine (`knowledge-engine.js`).
 *
 * Usa `node:test` + `node:assert`. Forma parte de la suite (`npm test` → `node --test tests/`).
 *
 * Cubre los parsers puros (sin filesystem) y `loadCountryRules` contra el estado real
 * de la bóveda (`./knowledge-base/`), con aserciones estructurales para no volverse
 * frágil cuando se curen notas nuevas.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseFrontmatter,
  extractSection,
  parseGraphPseudocode,
  parseRuleNote,
  parseRegimenes,
  loadCountryRules,
  toKnowledgeSchema,
  validateKnowledgeSchema,
  ENGINE_VERSION,
} from '../src/lib/knowledge-engine.js';

/** Nota de ejemplo conforme al esquema de CURATION_PROMPT.md. */
const NOTA_VIATICOS = [
  '---',
  'id: 11111111-2222-3333-4444-555555555555',
  'clave: VIATICOS',
  'vigente_desde: 2026-01-01',
  'vigente_hasta: null',
  'fuente_url: https://example.gob/lisr',
  'source_version: SAT/RMF 2026',
  '---',
  '',
  '# Viáticos',
  '',
  '## Contexto Legal',
  'Art. 28 LISR.',
  '',
  '## Regla Lógica',
  'Deducible si hay comprobante y no excede el tope.',
  '',
  '## Pseudocódigo de Grafo',
  '```',
  '(Gasto) -[ES_DEDUCIBLE_SI]-> (Cumple_Requisito) {tope_pct: 8, condicion: "comprobante"}',
  '(Gasto) -[NO_ES_DEDUCIBLE_SI]-> (Incumple_Requisito)',
  '```',
  '',
].join('\n');

test('parseFrontmatter extrae claves planas, normaliza null y separa el cuerpo', () => {
  const { frontmatter, body } = parseFrontmatter(NOTA_VIATICOS);
  assert.equal(frontmatter.id, '11111111-2222-3333-4444-555555555555');
  assert.equal(frontmatter.clave, 'VIATICOS');
  assert.equal(frontmatter.vigente_hasta, null); // 'null' → null real
  assert.equal(frontmatter.source_version, 'SAT/RMF 2026');
  assert.match(body, /## Pseudocódigo de Grafo/);
});

test('parseFrontmatter devuelve el contenido íntegro si no hay frontmatter', () => {
  const { frontmatter, body } = parseFrontmatter('# Sin frontmatter\nhola');
  assert.deepEqual(frontmatter, {});
  assert.equal(body, '# Sin frontmatter\nhola');
});

test('extractSection captura el texto y se detiene en el siguiente encabezado', () => {
  const { body } = parseFrontmatter(NOTA_VIATICOS);
  assert.equal(extractSection(body, 'Contexto Legal'), 'Art. 28 LISR.');
  assert.equal(
    extractSection(body, 'Regla Lógica'),
    'Deducible si hay comprobante y no excede el tope.'
  );
});

test('extractSection es insensible a acentos/mayúsculas y devuelve null si falta', () => {
  const { body } = parseFrontmatter(NOTA_VIATICOS);
  assert.ok(extractSection(body, 'pseudocodigo de grafo') !== null);
  assert.equal(extractSection(body, 'Sección Inexistente'), null);
});

test('parseGraphPseudocode convierte aristas en estructura ejecutable y mapea el veredicto', () => {
  const { body } = parseFrontmatter(NOTA_VIATICOS);
  const edges = parseGraphPseudocode(extractSection(body, 'Pseudocódigo de Grafo'));
  assert.equal(edges.length, 2);

  const [deducible, noDeducible] = edges;
  assert.deepEqual(
    { s: deducible.subject, r: deducible.relation, o: deducible.object, e: deducible.effect },
    { s: 'Gasto', r: 'ES_DEDUCIBLE_SI', o: 'Cumple_Requisito', e: 'DEDUCIBLE' }
  );
  assert.equal(noDeducible.effect, 'NO_DEDUCIBLE');
});

test('parseGraphPseudocode tipa las propiedades inline (number/string)', () => {
  const edges = parseGraphPseudocode(
    '(Gasto) -[ES_DEDUCIBLE_SI]-> (Req) {tope_pct: 8, condicion: "comprobante"}'
  );
  assert.equal(edges[0].properties.tope_pct, 8);
  assert.equal(typeof edges[0].properties.tope_pct, 'number');
  assert.equal(edges[0].properties.condicion, 'comprobante');
});

test('parseGraphPseudocode ignora líneas vacías, comentarios y basura', () => {
  const edges = parseGraphPseudocode(
    [
      '// comentario',
      '',
      'texto que no es arista',
      '(Gasto) -[ES_DEDUCIBLE_SI]-> (Req)',
    ].join('\n')
  );
  assert.equal(edges.length, 1);
});

test('parseRuleNote arma la regla completa sin warnings cuando la nota está bien formada', () => {
  const { rule, warnings } = parseRuleNote(NOTA_VIATICOS, 'viaticos.md');
  assert.equal(rule.id, '11111111-2222-3333-4444-555555555555');
  assert.equal(rule.clave, 'VIATICOS');
  assert.equal(rule.sourceVersion, 'SAT/RMF 2026');
  assert.equal(rule.vigenteHasta, null);
  assert.equal(rule.file, 'viaticos.md');
  assert.equal(rule.edges.length, 2);
  assert.deepEqual(warnings, []);
});

test('parseRuleNote advierte cuando falta id o pseudocódigo', () => {
  const { rule, warnings } = parseRuleNote('# Nota incompleta\nsin nada', 'mala.md');
  assert.equal(rule.id, null);
  assert.equal(rule.edges.length, 0);
  assert.ok(warnings.some((w) => /sin 'id'/.test(w)));
  assert.ok(warnings.some((w) => /Pseudocódigo de Grafo/.test(w)));
});

test('loadCountryRules exige un ISO no vacío', async () => {
  await assert.rejects(() => loadCountryRules(''), /ISO-2/);
});

test('loadCountryRules lanza si el país no existe en la bóveda', async () => {
  await assert.rejects(() => loadCountryRules('ZZ'), /no hay bóveda/);
});

test('loadCountryRules normaliza el ISO y devuelve un set estructurado para un país de la bóveda', async () => {
  const set = await loadCountryRules('mx'); // minúsculas → MX
  assert.equal(set.iso, 'MX');
  assert.ok(Array.isArray(set.rules));
  assert.equal(set.count, set.rules.length);
  assert.match(set.sourceDir, /knowledge-base\/countries\/MX\/deducciones$/);
  assert.match(set.loadedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('Nivel 1: parseRuleNote advierte cuando una arista queda con effect null (relación no reconocida)', () => {
  const md = [
    '---', 'id: abc', 'clave: VIATICOS', '---',
    '## Pseudocódigo de Grafo',
    '```',
    '(Gasto) -[ES_DEDUCIBLE]-> (Req)', // sin '_SI' → relación desconocida → effect null
    '```',
  ].join('\n');
  const { rule, warnings } = parseRuleNote(md, 'limbo.md');
  assert.equal(rule.edges.length, 1);
  assert.equal(rule.edges[0].effect, null);
  assert.ok(warnings.some((w) => /no reconocida|effect=null/.test(w)));
});

test('Nivel 2: loadCountryRules strict lanza AggregateError con el detalle de cada incidencia', async () => {
  // CO existe en la bóveda pero sin deducciones curadas (scaffold) → ≥1 incidencia.
  await assert.rejects(
    () => loadCountryRules('CO', { strict: true }),
    (err) => {
      assert.ok(err instanceof AggregateError, 'debe ser AggregateError');
      assert.ok(err.errors.length >= 1, 'debe incluir un Error por incidencia');
      return true;
    }
  );
});

test('Nivel 2: sin strict, las mismas incidencias se devuelven como warnings (no lanza)', async () => {
  const set = await loadCountryRules('CO');
  assert.ok(set.warnings.length >= 1);
});

test('parseRegimenes acepta `regimen` (string) y `regimenes` (lista inline) y normaliza', () => {
  assert.deepEqual(parseRegimenes({ regimen: 'PM_TITULO_II' }), ['PM_TITULO_II']);
  assert.deepEqual(parseRegimenes({ regimenes: '[PM_TITULO_II, RESICO]' }), ['PM_TITULO_II', 'RESICO']);
  assert.deepEqual(parseRegimenes({ regimenes: 'A, B' }), ['A', 'B']);
  assert.deepEqual(parseRegimenes({}), []);
});

test('parseRuleNote expone regimenes en la regla', () => {
  const md = ['---', 'id: x', 'clave: VIATICOS', 'regimen: PM_TITULO_II', '---'].join('\n');
  const { rule } = parseRuleNote(md, 'n.md');
  assert.deepEqual(rule.regimenes, ['PM_TITULO_II']);
});

test('parseRuleNote registra el line_number de la primera arista (rastreo)', () => {
  // La primera arista está en la línea 20 (1-based) de este contenido.
  const { rule } = parseRuleNote(NOTA_VIATICOS, 'viaticos.md');
  assert.equal(rule.line_number, 20);
  assert.equal(NOTA_VIATICOS.split('\n')[rule.line_number - 1].trim(), rule.edges[0].raw);
});

// ── Esquema estándar de intercambio (KnowledgeSchema) ──────────────────────────

test('toKnowledgeSchema produce la estructura {metadata, rules, warnings} esperada', () => {
  const { rule } = parseRuleNote(NOTA_VIATICOS, 'viaticos.md');
  const ruleSet = { iso: 'MX', rules: [rule], warnings: ['x: aviso'] };
  const out = toKnowledgeSchema(ruleSet);

  assert.deepEqual(out.metadata, { country: 'MX', engine_version: ENGINE_VERSION });
  assert.deepEqual(out.warnings, ['x: aviso']);
  assert.equal(out.rules.length, 1);

  const r = out.rules[0];
  assert.equal(r.id, '11111111-2222-3333-4444-555555555555');
  assert.equal(typeof r.line_number, 'number');
  // `predicate` es el `relation` interno; el edge solo lleva los 4 campos del estándar.
  assert.deepEqual(Object.keys(r.edges[0]).sort(), ['effect', 'object', 'predicate', 'subject']);
  assert.equal(r.edges[0].predicate, 'ES_DEDUCIBLE_SI');
  assert.equal(r.edges[0].effect, 'DEDUCIBLE');
});

test('la salida de loadCountryRules (serializada) cumple EXACTAMENTE el esquema', async () => {
  // Camino real de la bóveda (MX: sin notas → rules vacío + warning) debe validar igual.
  const out = toKnowledgeSchema(await loadCountryRules('MX'));
  const { ok, errors } = validateKnowledgeSchema(out);
  assert.ok(ok, `errores: ${errors.join('; ')}`);
});

test('toKnowledgeSchema(parseRuleNote VIATICOS) valida contra el esquema', () => {
  const { rule } = parseRuleNote(NOTA_VIATICOS, 'viaticos.md');
  const out = toKnowledgeSchema({ iso: 'MX', rules: [rule], warnings: [] });
  const { ok, errors } = validateKnowledgeSchema(out);
  assert.ok(ok, `errores: ${errors.join('; ')}`);
});

test('validateKnowledgeSchema detecta incumplimientos (metadata, predicate, effect, line_number)', () => {
  const malo = {
    metadata: { country: 'mexico' }, // no ISO-2; falta engine_version
    rules: [
      {
        id: 1, // debe ser string|null
        description: null,
        edges: [{ subject: 'Gasto', relation: 'X', effect: 'TAL_VEZ', object: 'Req' }], // 'predicate' ausente, effect inválido
        line_number: 'seis', // debe ser integer|null
      },
    ],
    warnings: 'no-array',
  };
  const { ok, errors } = validateKnowledgeSchema(malo);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /country/.test(e)));
  assert.ok(errors.some((e) => /engine_version/.test(e)));
  assert.ok(errors.some((e) => /predicate/.test(e)));
  assert.ok(errors.some((e) => /effect/.test(e)));
  assert.ok(errors.some((e) => /line_number/.test(e)));
  assert.ok(errors.some((e) => /warnings/.test(e)));
});
