/**
 * Strings Cypher parametrizados (constantes nombradas).
 *
 * REGLA DE ORO: este es el ÚNICO lugar donde vive Cypher. Nada de queries
 * dispersas en rutas/servicios. El namespace de país SIEMPRE viaja como
 * parámetro ($pais), nunca concatenado.
 */

/** Upsert de un nodo :Norma. */
export const UPSERT_NORMA = /* cypher */ `
  MERGE (n:Norma { id: $id })
  SET n += $props
  RETURN n
`;

/** Upsert de un nodo :Criterio. */
export const UPSERT_CRITERIO = /* cypher */ `
  MERGE (c:Criterio { id: $id })
  SET c += $props
  RETURN c
`;

/** Upsert de un nodo :Gasto (catálogo controlado). */
export const UPSERT_GASTO = /* cypher */ `
  MERGE (g:Gasto { clave: $clave })
  SET g += $props
  RETURN g
`;

/** Upsert de un nodo :Regimen. */
export const UPSERT_REGIMEN = /* cypher */ `
  MERGE (r:Regimen { clave: $clave })
  SET r += $props
  RETURN r
`;

/**
 * Crea/actualiza una relación tipada entre dos nodos identificados por id/clave.
 * El tipo de relación se interpola de forma controlada (whitelist en el service),
 * NUNCA desde input de usuario.
 */
export const MERGE_RELACION = (tipo) => /* cypher */ `
  MATCH (a { ${'$fromKey'} : $fromVal })
  MATCH (b { ${'$toKey'}   : $toVal })
  MERGE (a)-[rel:${tipo}]->(b)
  SET rel += $props
  RETURN rel
`;

/**
 * Cadena legal de un gasto: trae el :Gasto, las :Norma que le APLICA_A en el
 * régimen y país dados (con las props de la relación = topes/condición), las
 * relaciones de vigencia (DEROGA/MODIFICA) entre esas normas, y los :Criterio
 * que las interpretan. La resolución de vigencia final la aplica el motor.
 */
export const CADENA_LEGAL_POR_GASTO = /* cypher */ `
  MATCH (g:Gasto { clave: $gasto })
  OPTIONAL MATCH (n:Norma)-[a:APLICA_A]->(g)
    WHERE a.regimen = $regimen AND n.pais = $pais
  OPTIONAL MATCH (n)-[v:DEROGA|MODIFICA]->(m:Norma)
  OPTIONAL MATCH (c:Criterio)-[:INTERPRETA]->(n)
  RETURN g AS gasto,
         collect(DISTINCT { norma: n, aplica: a }) AS aplicables,
         collect(DISTINCT { tipo: type(v), desde: startNode(v).id, hacia: m.id, props: v }) AS vigencia,
         collect(DISTINCT c) AS criterios
`;

/** Diagnóstico: detecta normas vivas (sin vigente_hasta) que están derogadas. */
export const DETECTAR_CONTRADICCIONES = /* cypher */ `
  MATCH (viva:Norma)<-[:DEROGA]-(:Norma)
  WHERE viva.vigente_hasta IS NULL AND viva.pais = $pais
  RETURN viva.id AS id, viva.clave AS clave
`;

/** Dump del grafo (nodos + relaciones) de un país, para auditoría/export. */
export const EXPORT_GRAFO = /* cypher */ `
  MATCH (n) WHERE n.pais = $pais
  OPTIONAL MATCH (n)-[r]->(m) WHERE m.pais = $pais
  RETURN collect(DISTINCT n) AS nodos,
         collect(DISTINCT { tipo: type(r), desde: startNode(r), hacia: endNode(r), props: r }) AS relaciones
`;
