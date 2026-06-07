/**
 * Motor de inferencia (Tax Logic Engine).
 *
 * Aplica la lógica de negocio de BUSINESS_LOGIC.md sobre la cadena legal que le
 * entrega un Neo4jService (real o mock). NO contiene Cypher: orquesta, resuelve
 * vigencia, determina veredicto/topes y construye el lineage trazable.
 *
 * Inyección de dependencia por **constructor** (o vía `createInferenceEngine`):
 * el motor recibe el Neo4jService y no sabe si detrás hay Neo4j o un mock.
 *
 * Regla: ningún elemento del lineage sale sin su `source_version`.
 */

/**
 * @typedef {Object} Dictamen
 * @property {'DEDUCIBLE'|'NO_DEDUCIBLE'|'CONDICIONAL'} veredicto
 * @property {Array<Object>} rutaLegal   Lineage: nodos y relaciones con source_version.
 * @property {Object} sustento           Topes, condición y criterios aplicables.
 * @property {string} pais
 * @property {string|null} sourceVersion Versión de la base de conocimiento de la norma rectora.
 * @property {boolean} requiereRevision
 */

/** ¿La norma está vigente en `fecha`? (vigente_hasta null = vigente). */
function estaVigente(norma, fecha) {
  if (!norma) return false;
  const desde = norma.vigente_desde ? new Date(norma.vigente_desde) : null;
  const hasta = norma.vigente_hasta ? new Date(norma.vigente_hasta) : null;
  const f = new Date(fecha);
  if (desde && f < desde) return false;
  if (hasta && f > hasta) return false;
  return true;
}

export class InferenceEngine {
  /**
   * @param {import('./Neo4jService.js').Neo4jService} service  Fuente del grafo (real o mock).
   */
  constructor(service) {
    if (!service || typeof service.getCadenaLegal !== 'function') {
      throw new Error('InferenceEngine requiere un Neo4jService con getCadenaLegal()');
    }
    this.service = service;
  }

  /**
   * Resuelve el dictamen de deducibilidad de un gasto.
   * @param {Object} args
   * @param {string} args.gasto
   * @param {string} args.regimen
   * @param {string} args.pais
   * @param {string} [args.fecha]   ISO; default hoy.
   * @param {number} [args.monto]
   * @returns {Promise<Dictamen>}
   */
  async resolve({ gasto, regimen, pais, fecha, monto }) {
    const fechaRef = fecha || new Date().toISOString().slice(0, 10);
    const cadena = await this.service.getCadenaLegal({ gasto, regimen, pais });

    // Sin base legal aplicable → no deducible (no se inventa nada).
    if (!cadena || cadena.aplicables.length === 0) {
      return this._sinBase(pais, 'No existe norma aplicable para el gasto/régimen.');
    }

    // Vigencia: conservar solo las normas vivas en la fecha de la operación.
    const vivas = cadena.aplicables.filter((x) => estaVigente(x.norma, fechaRef));
    if (vivas.length === 0) {
      return this._sinBase(pais, 'Todas las normas aplicables están derogadas a la fecha.');
    }

    // Contradicción: más de una norma viva con veredictos base distintos ⇒ revisión.
    const veredictosBase = new Set(vivas.map((x) => x.aplica?.veredicto_base).filter(Boolean));
    const requiereRevision = veredictosBase.size > 1;

    // Norma rectora: la viva más reciente por vigente_desde.
    const rectora = vivas.slice().sort(
      (a, b) => new Date(b.norma.vigente_desde) - new Date(a.norma.vigente_desde)
    )[0];

    let veredicto = rectora.aplica?.veredicto_base || 'CONDICIONAL';
    if (requiereRevision) veredicto = 'CONDICIONAL';

    // Aplicación de topes (si hay monto y tope definido).
    const tope = rectora.aplica?.tope_monto;
    if (veredicto === 'DEDUCIBLE' && tope != null && monto != null && monto > tope) {
      veredicto = 'CONDICIONAL';
    }

    // Lineage: cada eslabón lleva su source_version.
    const rutaLegal = [
      { tipo: 'Gasto', clave: cadena.gasto.clave, source_version: cadena.gasto.source_version },
      {
        tipo: 'Norma',
        clave: rectora.norma.clave,
        id: rectora.norma.id,
        fuente_url: rectora.norma.fuente_url,
        vigente_desde: rectora.norma.vigente_desde,
        vigente_hasta: rectora.norma.vigente_hasta,
        source_version: rectora.norma.source_version,
      },
      { tipo: 'Relacion', relacion: 'APLICA_A', source_version: rectora.aplica?.source_version ?? null },
      ...cadena.criterios.map((c) => ({
        tipo: 'Criterio', clave: c.clave, fuente_url: c.fuente_url, source_version: c.source_version,
      })),
    ];

    return {
      veredicto,
      rutaLegal,
      sustento: {
        tope_monto: rectora.aplica?.tope_monto ?? null,
        tope_pct: rectora.aplica?.tope_pct ?? null,
        condicion: rectora.aplica?.condicion ?? null,
        criterios: cadena.criterios.map((c) => c.clave),
        normasVivas: vivas.length,
        derogadas: cadena.aplicables.length - vivas.length,
      },
      pais,
      sourceVersion: rectora.norma.source_version ?? null,
      requiereRevision,
    };
  }

  /** @returns {Dictamen} */
  _sinBase(pais, motivo) {
    return {
      veredicto: 'NO_DEDUCIBLE',
      rutaLegal: [],
      sustento: { motivo, criterios: [] },
      pais,
      sourceVersion: null,
      requiereRevision: false,
    };
  }
}

/**
 * Factory: crea un motor con el servicio inyectado.
 * @param {import('./Neo4jService.js').Neo4jService} service
 * @returns {InferenceEngine}
 */
export function createInferenceEngine(service) {
  return new InferenceEngine(service);
}

/**
 * Wrapper funcional (compatibilidad): `resolverDictamen(service, args)`.
 * @param {import('./Neo4jService.js').Neo4jService} service
 * @param {Object} args
 * @returns {Promise<Dictamen>}
 */
export function resolverDictamen(service, args) {
  return new InferenceEngine(service).resolve(args);
}

export default { InferenceEngine, createInferenceEngine, resolverDictamen };
