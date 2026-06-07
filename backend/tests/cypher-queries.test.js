/**
 * Lint estructural/sintáctico de las queries Cypher (sin Neo4j).
 *
 * No es un parser completo de openCypher: valida balanceo de delimitadores,
 * presencia de cláusulas esperadas, uso de parámetros ($), y AUSENCIA de
 * interpolación de valores (anti-inyección) en las queries estáticas.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Q from '../src/lib/graph/cypherQueries.js';

/** Verifica que los delimitadores estén balanceados. */
function balanceado(str) {
  const pares = { ')': '(', ']': '[', '}': '{' };
  const abren = new Set(['(', '[', '{']);
  const stack = [];
  for (const ch of str) {
    if (abren.has(ch)) stack.push(ch);
    else if (pares[ch]) { if (stack.pop() !== pares[ch]) return false; }
  }
  return stack.length === 0;
}

const QUERIES_ESTATICAS = {
  UPSERT_NORMA: Q.UPSERT_NORMA,
  UPSERT_CRITERIO: Q.UPSERT_CRITERIO,
  UPSERT_GASTO: Q.UPSERT_GASTO,
  UPSERT_REGIMEN: Q.UPSERT_REGIMEN,
  CADENA_LEGAL_POR_GASTO: Q.CADENA_LEGAL_POR_GASTO,
  DETECTAR_CONTRADICCIONES: Q.DETECTAR_CONTRADICCIONES,
};

test('todas las queries estáticas tienen delimitadores balanceados', () => {
  for (const [name, q] of Object.entries(QUERIES_ESTATICAS)) {
    assert.ok(balanceado(q), `${name}: delimitadores desbalanceados`);
  }
});

test('cada query usa al menos una cláusula Cypher válida', () => {
  const clausulas = /\b(MATCH|MERGE|RETURN|SET|WHERE|OPTIONAL MATCH|CREATE)\b/;
  for (const [name, q] of Object.entries(QUERIES_ESTATICAS)) {
    assert.match(q, clausulas, `${name}: sin cláusula Cypher reconocible`);
  }
});

test('queries de upsert son parametrizadas (usan $) y no concatenan valores', () => {
  for (const name of ['UPSERT_NORMA', 'UPSERT_CRITERIO', 'UPSERT_GASTO', 'UPSERT_REGIMEN']) {
    const q = QUERIES_ESTATICAS[name];
    assert.match(q, /\$\w+/, `${name}: debería usar parámetros $`);
    assert.doesNotMatch(q, /\$\{/, `${name}: no debe interpolar JS (\${...})`);
  }
});

test('CADENA_LEGAL_POR_GASTO usa los parámetros esperados', () => {
  for (const p of ['$gasto', '$regimen', '$pais']) {
    assert.ok(Q.CADENA_LEGAL_POR_GASTO.includes(p), `falta parámetro ${p}`);
  }
});

test('MERGE_RELACION sólo interpola un tipo de relación whitelisted y queda balanceada', () => {
  const q = Q.MERGE_RELACION('APLICA_A');
  assert.ok(q.includes('[rel:APLICA_A]'), 'el tipo debe interpolarse en la relación');
  assert.ok(balanceado(q), 'MERGE_RELACION desbalanceada');
});
