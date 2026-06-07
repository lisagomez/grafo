/**
 * Cypher Query Service — API de negocio sobre el grafo legal.
 *
 * Único módulo (junto con neo4j.js) que ejecuta Cypher. Traduce conceptos de
 * negocio (upsert de norma, cadena legal de un gasto...) a las queries
 * parametrizadas de `cypherQueries.js`, y mapea records → objetos de dominio.
 */

import { runQuery } from '../neo4j.js';
import * as Q from './cypherQueries.js';

/** Tipos de relación permitidos (whitelist; evita interpolación insegura). */
const RELACIONES_VALIDAS = new Set(['APLICA_A', 'DEROGA', 'MODIFICA', 'EXTIENDE', 'INTERPRETA', 'RIGE_EN']);

/**
 * Upsert de un nodo del grafo según su label.
 * @param {'Norma'|'Criterio'|'Gasto'|'Regimen'} label
 * @param {Record<string, any>} props  Debe incluir id (Norma/Criterio) o clave (Gasto/Regimen).
 */
export async function upsertNodo(label, props) {
  switch (label) {
    case 'Norma':
      await runQuery(Q.UPSERT_NORMA, { id: props.id, props }, { write: true });
      break;
    case 'Criterio':
      await runQuery(Q.UPSERT_CRITERIO, { id: props.id, props }, { write: true });
      break;
    case 'Gasto':
      await runQuery(Q.UPSERT_GASTO, { clave: props.clave, props }, { write: true });
      break;
    case 'Regimen':
      await runQuery(Q.UPSERT_REGIMEN, { clave: props.clave, props }, { write: true });
      break;
    default:
      throw new Error(`Label de nodo no soportado: ${label}`);
  }
}

/**
 * Crea/actualiza una relación tipada entre dos nodos.
 * @param {Object} spec
 * @param {string} spec.tipo               Tipo de relación (whitelisted).
 * @param {string} spec.fromKey            'id' | 'clave' del nodo origen.
 * @param {string} spec.fromVal
 * @param {string} spec.toKey              'id' | 'clave' del nodo destino.
 * @param {string} spec.toVal
 * @param {Record<string, any>} [spec.props]
 */
export async function mergeRelacion({ tipo, fromKey, fromVal, toKey, toVal, props = {} }) {
  if (!RELACIONES_VALIDAS.has(tipo)) {
    throw new Error(`Tipo de relación no permitido: ${tipo}`);
  }
  // `tipo` proviene de la whitelist (seguro de interpolar). fromKey/toKey son
  // claves de propiedad controladas ('id'|'clave') y viajan como parámetro.
  const cypher = /* cypher */ `
    MATCH (a) WHERE a[$fromKey] = $fromVal
    MATCH (b) WHERE b[$toKey] = $toVal
    MERGE (a)-[rel:${tipo}]->(b)
    SET rel += $props
    RETURN rel
  `;
  await runQuery(cypher, { fromKey, fromVal, toKey, toVal, props }, { write: true });
}

/**
 * Trae la cadena legal cruda de un gasto (sin resolver vigencia: eso lo hace el motor).
 * @param {{ gasto: string, regimen: string, pais: string }} args
 * @returns {Promise<{ gasto: any, aplicables: any[], vigencia: any[], criterios: any[] } | null>}
 */
export async function getCadenaLegal({ gasto, regimen, pais }) {
  const records = await runQuery(Q.CADENA_LEGAL_POR_GASTO, { gasto, regimen, pais });
  if (records.length === 0) return null;
  const r = records[0];
  const node = (n) => (n ? { ...n.properties, _labels: n.labels } : null);
  return {
    gasto: node(r.get('gasto')),
    aplicables: (r.get('aplicables') || [])
      .filter((x) => x.norma)
      .map((x) => ({ norma: node(x.norma), aplica: x.aplica ? x.aplica.properties : null })),
    vigencia: (r.get('vigencia') || []).filter((x) => x.tipo).map((x) => ({
      tipo: x.tipo, desde: x.desde, hacia: x.hacia, props: x.props ? x.props.properties : {},
    })),
    criterios: (r.get('criterios') || []).filter(Boolean).map(node),
  };
}

/**
 * Lista nodos vivos que están derogados (Modo Contradicción, parcial).
 * @param {string} pais
 */
export async function detectarContradicciones(pais) {
  const records = await runQuery(Q.DETECTAR_CONTRADICCIONES, { pais });
  return records.map((r) => ({ id: r.get('id'), clave: r.get('clave') }));
}

export default { upsertNodo, mergeRelacion, getCadenaLegal, detectarContradicciones };
