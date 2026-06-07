/**
 * Provider de Fuentes de Verdad para México (MX).
 *
 * Implementación de referencia del contrato `LegalSourceProvider` para la
 * legislación fiscal mexicana, usando la LISR (Ley del ISR) y el CFF (Código
 * Fiscal de la Federación) como base, más los Criterios Normativos del SAT.
 *
 * El `@implements` permite que el editor valide que esta clase cumple el contrato
 * declarado en `types.js`, sin necesidad de un toolchain de TypeScript.
 */

import './types.js'; // carga los @typedef para que el editor resuelva el contrato

/**
 * Catálogo controlado de conceptos de gasto reconocidos en MX (V1: PM Título II).
 * Coincide con las claves `:Gasto.clave` del grafo.
 * @type {ReadonlySet<string>}
 */
const GASTOS_MX = new Set([
  'VIATICOS',
  'SERVICIOS_PROFESIONALES',
  'EQUIPO_DE_COMPUTO',
  'DONATIVOS',
  'INTERESES',
  'COMBUSTIBLES',
  'ARRENDAMIENTO',
]);

/**
 * Regímenes fiscales soportados en MX (V1).
 * @type {ReadonlySet<string>}
 */
const REGIMENES_MX = new Set([
  'PM_TITULO_II', // Personas Morales, Título II LISR
]);

/**
 * Última actualización de la base de conocimiento mexicana.
 * Se cita en el dictamen como `source_version`.
 * @type {string}
 */
const SOURCE_VERSION_MX = 'SAT/RMF 2026 (LISR+CFF DOF 2026-01-01)';

/**
 * @implements {LegalSourceProvider}
 */
export class MXLegalProvider {
  /** @type {string} */
  countryCode = 'MX';

  /**
   * Estructura del grafo legal mexicano: labels, relaciones y constraints.
   * @returns {GraphSchema}
   */
  getSchemaNodes() {
    return {
      nodos: ['Norma', 'Criterio', 'Gasto', 'Regimen'],
      relaciones: ['APLICA_A', 'DEROGA', 'MODIFICA', 'EXTIENDE', 'INTERPRETA', 'RIGE_EN'],
      constraints: [
        'CREATE CONSTRAINT norma_id IF NOT EXISTS FOR (n:Norma) REQUIRE n.id IS UNIQUE',
        'CREATE CONSTRAINT criterio_id IF NOT EXISTS FOR (c:Criterio) REQUIRE c.id IS UNIQUE',
        'CREATE CONSTRAINT gasto_clave IF NOT EXISTS FOR (g:Gasto) REQUIRE g.clave IS UNIQUE',
        'CREATE CONSTRAINT regimen_clave IF NOT EXISTS FOR (r:Regimen) REQUIRE r.clave IS UNIQUE',
      ],
    };
  }

  /**
   * Fuentes oficiales (Origen de Verdad) de la legislación fiscal mexicana.
   * @returns {KnowledgeSource[]}
   */
  getKnowledgeSources() {
    return [
      {
        clave: 'LISR',
        tipo: 'LEY',
        nombre: 'Ley del Impuesto sobre la Renta',
        url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf',
        version: '2026',
      },
      {
        clave: 'CFF',
        tipo: 'CODIGO',
        nombre: 'Código Fiscal de la Federación',
        url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CFF.pdf',
        version: '2026',
      },
      {
        clave: 'CRITERIOS_SAT',
        tipo: 'CRITERIO',
        nombre: 'Criterios Normativos del SAT',
        url: 'https://www.sat.gob.mx/normatividad/criterios-normativos',
        version: '2026',
      },
    ];
  }

  /**
   * Valida que la consulta sea pertinente para la legislación mexicana:
   * el gasto y el régimen deben existir en el catálogo controlado de MX.
   * @param {QueryIntent} query
   * @returns {ValidationResult}
   */
  validateQuery(query) {
    const errores = [];

    if (!query || typeof query !== 'object') {
      return { ok: false, errores: ['Consulta vacía o malformada'] };
    }
    if (!query.gasto || !GASTOS_MX.has(query.gasto)) {
      errores.push(`Concepto de gasto no reconocido para MX: ${query.gasto ?? '(ninguno)'}`);
    }
    if (!query.regimen || !REGIMENES_MX.has(query.regimen)) {
      errores.push(`Régimen fiscal no soportado para MX en V1: ${query.regimen ?? '(ninguno)'}`);
    }
    if (query.monto != null && (typeof query.monto !== 'number' || query.monto < 0)) {
      errores.push('El monto debe ser un número no negativo');
    }

    return { ok: errores.length === 0, errores };
  }

  /**
   * @returns {string}
   */
  getSourceVersion() {
    return SOURCE_VERSION_MX;
  }

  /**
   * @returns {GraphNamespace}
   */
  getNamespace() {
    return { pais: this.countryCode };
  }
}

export default MXLegalProvider;
