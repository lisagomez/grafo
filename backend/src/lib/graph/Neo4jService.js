/**
 * Neo4jService — capa de abstracción sobre el grafo legal.
 *
 * Define un contrato único que el motor de inferencia consume. Tiene dos
 * implementaciones intercambiables:
 *   - RealNeo4jService: habla con Neo4j vía el Cypher Query Service.
 *   - MockNeo4jService: responde el MISMO contrato desde datos en memoria
 *     (JSON/mocks inyectados), para validar la lógica SIN base de datos real.
 *
 * El motor depende del contrato, no de la implementación: hoy corre con mock,
 * mañana con Neo4j, sin cambiar una línea del motor.
 *
 * @typedef {Object} CadenaLegal
 * @property {Object|null} gasto
 * @property {Array<{ norma: Object, aplica: Object|null }>} aplicables
 * @property {Array<{ tipo: string, desde: string, hacia: string, props: Object }>} vigencia
 * @property {Array<Object>} criterios
 *
 * @typedef {Object} Neo4jService
 * @property {boolean} isMock
 * @property {(args: { gasto: string, regimen: string, pais: string }) => Promise<CadenaLegal|null>} getCadenaLegal
 * @property {(pais: string) => Promise<Array<{id:string, clave:string}>>} detectarContradicciones
 * @property {(pais: string) => Promise<Object>} exportGrafo  Dump del grafo (para auditoría/export).
 */

import * as cypherService from './cypherService.js';

/**
 * Implementación real: delega en el Cypher Query Service (Neo4j).
 * @implements {Neo4jService}
 */
export class RealNeo4jService {
  isMock = false;

  /** @param {{ gasto: string, regimen: string, pais: string }} args */
  getCadenaLegal(args) {
    return cypherService.getCadenaLegal(args);
  }

  /** @param {string} pais */
  detectarContradicciones(pais) {
    return cypherService.detectarContradicciones(pais);
  }

  /**
   * Dump del grafo de un país en el shape del dataset (regimenes/gastos/normas/criterios/relaciones).
   * @param {string} pais
   */
  async exportGrafo(pais) {
    const { runQuery } = await import('../neo4j.js');
    const { EXPORT_GRAFO } = await import('./cypherQueries.js');
    const records = await runQuery(EXPORT_GRAFO, { pais });
    const out = { regimenes: [], gastos: [], normas: [], criterios: [], relaciones: [] };
    if (records.length === 0) return out;
    const grupo = { Regimen: 'regimenes', Gasto: 'gastos', Norma: 'normas', Criterio: 'criterios' };
    for (const n of records[0].get('nodos') || []) {
      const key = grupo[n.labels?.[0]];
      if (key) out[key].push({ ...n.properties });
    }
    for (const r of records[0].get('relaciones') || []) {
      if (!r.tipo) continue;
      out.relaciones.push({
        tipo: r.tipo,
        fromVal: r.desde?.properties?.id ?? r.desde?.properties?.clave,
        toVal: r.hacia?.properties?.id ?? r.hacia?.properties?.clave,
        props: r.props?.properties ?? {},
      });
    }
    return out;
  }
}

/**
 * Implementación mock: responde desde un dataset en memoria (mismo shape que el
 * resultado de Neo4j). Reproduce en JS la semántica de la query CADENA_LEGAL_POR_GASTO.
 * @implements {Neo4jService}
 */
export class MockNeo4jService {
  isMock = true;

  /**
   * Carga un dataset desde un archivo JSON (fixture) y devuelve un mock listo.
   * @param {string} filePath  Ruta absoluta al JSON.
   * @returns {Promise<MockNeo4jService>}
   */
  static async fromFile(filePath) {
    const { readFile } = await import('node:fs/promises');
    const dataset = JSON.parse(await readFile(filePath, 'utf8'));
    return new MockNeo4jService(dataset);
  }

  /**
   * @param {Object} dataset  Estructura del seed (regimenes/gastos/normas/criterios/relaciones).
   */
  constructor(dataset) {
    this.data = dataset;
    this._normaById = new Map((dataset.normas || []).map((n) => [n.id, n]));
    this._criterioById = new Map((dataset.criterios || []).map((c) => [c.id, c]));
    this._gastoByClave = new Map((dataset.gastos || []).map((g) => [g.clave, g]));
  }

  /** @param {{ gasto: string, regimen: string, pais: string }} args @returns {Promise<CadenaLegal|null>} */
  async getCadenaLegal({ gasto, regimen, pais }) {
    const gastoNode = this._gastoByClave.get(gasto);
    if (!gastoNode || gastoNode.pais !== pais) return null;

    const rels = this.data.relaciones || [];

    // Normas que APLICA_A el gasto, en el régimen y país dados.
    const aplicables = rels
      .filter((r) => r.tipo === 'APLICA_A' && r.toVal === gasto && r.props?.regimen === regimen)
      .map((r) => ({ norma: this._normaById.get(r.fromVal), aplica: r.props || null }))
      .filter((x) => x.norma && x.norma.pais === pais);

    const idsAplicables = new Set(aplicables.map((x) => x.norma.id));

    // Relaciones de vigencia (DEROGA/MODIFICA) que involucran a esas normas.
    const vigencia = rels
      .filter((r) => (r.tipo === 'DEROGA' || r.tipo === 'MODIFICA')
        && (idsAplicables.has(r.fromVal) || idsAplicables.has(r.toVal)))
      .map((r) => ({ tipo: r.tipo, desde: r.fromVal, hacia: r.toVal, props: r.props || {} }));

    // Criterios que INTERPRETAN alguna norma aplicable.
    const criterios = rels
      .filter((r) => r.tipo === 'INTERPRETA' && idsAplicables.has(r.toVal))
      .map((r) => this._criterioById.get(r.fromVal))
      .filter(Boolean);

    return {
      gasto: gastoNode,
      aplicables: aplicables.map((x) => ({ norma: x.norma, aplica: x.aplica })),
      vigencia,
      criterios,
    };
  }

  /** @param {string} pais */
  async detectarContradicciones(pais) {
    // Norma "viva" (vigente_hasta == null) que es destino de un DEROGA.
    const rels = this.data.relaciones || [];
    const derogadas = new Set(rels.filter((r) => r.tipo === 'DEROGA').map((r) => r.toVal));
    return (this.data.normas || [])
      .filter((n) => n.pais === pais && n.vigente_hasta == null && derogadas.has(n.id))
      .map((n) => ({ id: n.id, clave: n.clave }));
  }

  /** @param {string} pais  Devuelve el dataset filtrado por país (mismo shape del seed). */
  async exportGrafo(pais) {
    const filtra = (arr) => (arr || []).filter((x) => !x.pais || x.pais === pais);
    return {
      regimenes: filtra(this.data.regimenes),
      gastos: filtra(this.data.gastos),
      normas: filtra(this.data.normas),
      criterios: filtra(this.data.criterios),
      relaciones: this.data.relaciones || [],
    };
  }
}

/**
 * Factory: devuelve la implementación adecuada.
 * @param {{ mockData?: Object }} [opts]  Si se pasa mockData, devuelve MockNeo4jService.
 * @returns {Neo4jService}
 */
export function createNeo4jService(opts = {}) {
  if (opts.mockData) return new MockNeo4jService(opts.mockData);
  return new RealNeo4jService();
}

export default { RealNeo4jService, MockNeo4jService, createNeo4jService };
