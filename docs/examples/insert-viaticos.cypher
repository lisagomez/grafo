// Ejemplo de migración: inserción en Neo4j de UNA nota de la bóveda (VIATICOS).
//
// Muestra cómo `knowledge-base/countries/MX/deducciones/viaticos.md` se materializa
// en el grafo. Usa MERGE (idempotente), igual que backend/src/lib/graph/cypherQueries.js
// (UPSERT_NORMA / UPSERT_GASTO / MERGE_RELACION). El país/régimen viajan como datos,
// nunca concatenados en el string. Equivalente a correr UPSERT_* con estos $props.

// 1) :Gasto (catálogo controlado; identidad por clave) ───────────────────────────
MERGE (g:Gasto { clave: 'VIATICOS' })
  SET g += { pais: 'MX', source_version: 'SAT/RMF 2026 (LISR+CFF DOF 2026-01-01)' };

// 2) :Norma que respalda la deducción (identidad por id = UUID del frontmatter) ──
MERGE (n:Norma { id: '11111111-2222-3333-4444-555555555555' })
  SET n += {
    clave: 'Art. 28 LISR (viáticos)',
    pais: 'MX',
    vigente_desde: date('2026-01-01'),
    vigente_hasta: null,
    fuente_url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf',
    source_version: 'SAT/RMF 2026 (LISR+CFF DOF 2026-01-01)'
  };

// 3) :Norma -[:APLICA_A]-> :Gasto  (modelo que consume HOY el InferenceEngine).
//    Las props de la relación = veredicto base + topes/condición (de la arista).
MATCH (n:Norma { id: '11111111-2222-3333-4444-555555555555' })
MATCH (g:Gasto { clave: 'VIATICOS' })
MERGE (n)-[a:APLICA_A { regimen: 'PM_TITULO_II' }]->(g)
  SET a += {
    veredicto_base: 'DEDUCIBLE',
    tope_monto: 10000,
    tope_pct: 8,
    condicion: 'CFDI',
    source_version: 'SAT/RMF 2026 (LISR+CFF DOF 2026-01-01)'
  };

// 4) Objetivo vault-native: el requisito como nodo de primera clase, espejando la
//    arista del pseudocódigo `(Gasto:Gasto) -[ES_DEDUCIBLE_SI]-> (Cumple_Requisito:Requisito)`.
MERGE (req:Requisito { clave: 'CUMPLE_REQUISITO' })
  SET req += { descripcion: 'Comprobante CFDI válido y monto dentro del tope' };

MATCH (g:Gasto { clave: 'VIATICOS' })
MATCH (req:Requisito { clave: 'CUMPLE_REQUISITO' })
MERGE (g)-[d:ES_DEDUCIBLE_SI]->(req)
  SET d += { tope_monto: 10000, tope_pct: 8, condicion: 'CFDI' };

// Verificación (equivalente a CADENA_LEGAL_POR_GASTO):
//   MATCH (g:Gasto { clave: 'VIATICOS' })
//   OPTIONAL MATCH (n:Norma)-[a:APLICA_A]->(g) WHERE a.regimen = 'PM_TITULO_II' AND n.pais = 'MX'
//   RETURN g AS gasto, collect({ norma: n, aplica: a }) AS aplicables;
