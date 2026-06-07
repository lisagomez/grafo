/**
 * GraphAuditor — Auditor de Grafo proactivo (Fase 1.5).
 *
 * Detecta errores estructurales del grafo legal ANTES de la inferencia:
 *   - Gastos huérfanos (sin relación a normas vigentes).
 *   - Inconsistencias entre `source_version` y las fechas de vigencia.
 *
 * Servicio INDEPENDIENTE y DESACOPLADO: no toca el InferenceEngine. Depende de un
 * `Neo4jService` inyectado (real o mock) y audita sobre `exportGrafo()`, por lo que
 * es testeable sin Neo4j. Las queries nativas equivalentes quedan abajo como referencia.
 *
 * Contrato de reporte (consistente entre métodos):
 *   { status: 'ok' | 'error', issues: Array<Object>, count: number }
 *   - status 'ok'    → no se encontraron problemas (count 0).
 *   - status 'error' → el grafo tiene problemas (count = issues.length).
 */

/**
 * Queries de auditoría (Cypher nativo de referencia).
 * Hoy la auditoría se ejecuta en JS sobre exportGrafo() para ser testeable sin DB;
 * estas son las equivalentes nativas para optimizar cuando haya Neo4j real.
 */
export const AUDIT_CYPHER = {
  /** Gastos sin NINGUNA norma vigente asociada a la fecha. */
  HUERFANOS: /* cypher */ `
    MATCH (g:Gasto { pais: $pais })
    WHERE NOT EXISTS {
      MATCH (n:Norma)-[:APLICA_A]->(g)
      WHERE (n.vigente_desde IS NULL OR n.vigente_desde <= $fecha)
        AND (n.vigente_hasta IS NULL OR n.vigente_hasta >= $fecha)
    }
    RETURN g.clave AS gasto
  `,
  /** Normas vivas (sin vigente_hasta) que son destino de un DEROGA. */
  VIVA_DEROGADA: /* cypher */ `
    MATCH (viva:Norma { pais: $pais })<-[:DEROGA]-(:Norma)
    WHERE viva.vigente_hasta IS NULL
    RETURN viva.id AS id, viva.clave AS clave
  `,
};

/** Construye el reporte estándar. */
function reporte(issues) {
  return { status: issues.length === 0 ? 'ok' : 'error', issues, count: issues.length };
}

export class GraphAuditor {
  /**
   * @param {import('../lib/graph/Neo4jService.js').Neo4jService} service
   */
  constructor(service) {
    if (!service || typeof service.exportGrafo !== 'function') {
      throw new Error('GraphAuditor requiere un Neo4jService con exportGrafo()');
    }
    this.service = service;
  }

  /** ¿La norma está vigente en `fecha`? (vigente_hasta null = vigente). */
  static _vigente(norma, fecha) {
    const f = new Date(fecha);
    if (norma.vigente_desde && f < new Date(norma.vigente_desde)) return false;
    if (norma.vigente_hasta && f > new Date(norma.vigente_hasta)) return false;
    return true;
  }

  /**
   * Detecta gastos huérfanos: sin `APLICA_A` (`SIN_NORMA`) o sin norma vigente a la
   * fecha (`SIN_VIGENTE`).
   * @param {{ pais: string, fecha?: string }} [args]
   * @returns {Promise<{ status: 'ok'|'error', issues: Array<{gasto:string, motivo:string}>, count: number }>}
   */
  async detectarOrfanos({ pais, fecha } = {}) {
    const fechaRef = fecha || new Date().toISOString().slice(0, 10);
    const grafo = await this.service.exportGrafo(pais);
    const normaById = new Map((grafo.normas || []).map((n) => [n.id, n]));
    const issues = [];

    for (const g of grafo.gastos || []) {
      const aplican = (grafo.relaciones || [])
        .filter((r) => r.tipo === 'APLICA_A' && r.toVal === g.clave)
        .map((r) => normaById.get(r.fromVal))
        .filter(Boolean);

      if (aplican.length === 0) {
        issues.push({ gasto: g.clave, motivo: 'SIN_NORMA' });
      } else if (!aplican.some((n) => GraphAuditor._vigente(n, fechaRef))) {
        issues.push({ gasto: g.clave, motivo: 'SIN_VIGENTE' });
      }
    }
    return reporte(issues);
  }

  /**
   * Valida consistencia entre `source_version` y vigencia de las normas.
   * Tipos de issue: VENTANA_INVALIDA, VIVA_DEROGADA, SOURCE_MISMATCH, SIN_SOURCE_VERSION.
   * @param {{ pais: string }} [args]
   * @returns {Promise<{ status: 'ok'|'error', issues: Array<{normaId:string, tipo:string, detalle:string}>, count: number }>}
   */
  async validarConsistenciaVersiones({ pais } = {}) {
    const grafo = await this.service.exportGrafo(pais);
    const rels = grafo.relaciones || [];
    const derogadas = new Set(rels.filter((r) => r.tipo === 'DEROGA').map((r) => r.toVal));
    const issues = [];

    for (const n of grafo.normas || []) {
      if (!n.source_version) {
        issues.push({ normaId: n.id, tipo: 'SIN_SOURCE_VERSION', detalle: 'Norma sin source_version.' });
      }
      if (n.vigente_desde && n.vigente_hasta && new Date(n.vigente_hasta) < new Date(n.vigente_desde)) {
        issues.push({
          normaId: n.id, tipo: 'VENTANA_INVALIDA',
          detalle: `vigente_hasta (${n.vigente_hasta}) < vigente_desde (${n.vigente_desde}).`,
        });
      }
      if (n.vigente_hasta == null && derogadas.has(n.id)) {
        issues.push({
          normaId: n.id, tipo: 'VIVA_DEROGADA',
          detalle: 'Norma sin vigente_hasta pero destino de un DEROGA (viva y derogada a la vez).',
        });
      }
      for (const r of rels.filter((x) => x.tipo === 'APLICA_A' && x.fromVal === n.id)) {
        const sv = r.props?.source_version;
        if (sv && n.source_version && sv !== n.source_version) {
          issues.push({
            normaId: n.id, tipo: 'SOURCE_MISMATCH',
            detalle: `APLICA_A cita source_version "${sv}" ≠ nodo "${n.source_version}".`,
          });
        }
      }
    }
    return reporte(issues);
  }
}

export function createGraphAuditor(service) {
  return new GraphAuditor(service);
}

export default { GraphAuditor, createGraphAuditor, AUDIT_CYPHER };
