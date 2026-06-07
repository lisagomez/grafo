/**
 * Contrato de Fuentes de Verdad legales (Legal Source Providers).
 *
 * Define, vía JSDoc (`@typedef`), la interfaz `LegalSourceProvider`: la estrategia
 * que encapsula TODO lo específico de una jurisdicción (esquema del grafo, fuentes
 * oficiales y validación de pertinencia). El `ContextResolver` y el motor de
 * inferencia dependen SOLO de este contrato, nunca de un país concreto (patrón Strategy).
 *
 * Este módulo es de "solo tipos": no exporta runtime, solo typedefs reutilizables.
 */

/**
 * Una fuente legal oficial (Origen de Verdad) de una jurisdicción.
 * @typedef {Object} KnowledgeSource
 * @property {string} clave            Identificador corto, p. ej. 'LISR', 'CFF'.
 * @property {'LEY'|'CODIGO'|'CRITERIO'} tipo  Naturaleza del documento.
 * @property {string} nombre           Nombre completo del cuerpo legal.
 * @property {string} url              URL oficial del documento (DOF/SAT/...).
 * @property {string} version          Versión/edición vigente citada en el dictamen.
 */

/**
 * Estructura de grafo (labels, relaciones y constraints) propia de una jurisdicción.
 * @typedef {Object} GraphSchema
 * @property {string[]} nodos          Labels de nodo, p. ej. ['Norma','Criterio','Gasto','Regimen'].
 * @property {string[]} relaciones     Tipos de relación, p. ej. ['APLICA_A','DEROGA','MODIFICA'].
 * @property {string[]} constraints    Sentencias Cypher de constraint/índice para esta jurisdicción.
 */

/**
 * Intención de consulta ya extraída (por formulario, voz o A2A) lista para validar.
 * @typedef {Object} QueryIntent
 * @property {string} gasto            Clave del concepto de gasto, p. ej. 'VIATICOS'.
 * @property {string} regimen          Clave de régimen fiscal, p. ej. 'PM_TITULO_II'.
 * @property {number} [monto]          Monto opcional para aplicar topes.
 * @property {string} [fecha]          Fecha ISO de referencia (default: hoy).
 * @property {string} [country]        Código ISO-2 del país; default lo resuelve el ContextResolver.
 */

/**
 * Resultado de validar si una consulta es pertinente para la legislación local.
 * @typedef {Object} ValidationResult
 * @property {boolean} ok              true si la consulta aplica a esta jurisdicción.
 * @property {string[]} errores        Lista de motivos cuando `ok` es false (vacía si ok).
 */

/**
 * Namespace de grafo inyectado como parámetro a las consultas Cypher.
 * Aísla los datos de una jurisdicción dentro del mismo Neo4j.
 * @typedef {Object} GraphNamespace
 * @property {string} pais             Código ISO-2, p. ej. 'MX'. Viaja siempre como parámetro.
 */

/**
 * Contrato que toda jurisdicción debe implementar.
 *
 * El `ContextResolver` consume únicamente estos métodos: añadir un país nuevo se
 * reduce a crear un provider que lo implemente y registrarlo en la factory, sin
 * tocar el motor de inferencia ni el Cypher Query Service.
 *
 * @typedef {Object} LegalSourceProvider
 * @property {string} countryCode                         Código ISO-2 de la jurisdicción ('MX').
 * @property {() => GraphSchema} getSchemaNodes           Estructura de nodos/relaciones de ESA jurisdicción.
 * @property {() => KnowledgeSource[]} getKnowledgeSources Fuentes oficiales (Origen de Verdad).
 * @property {(query: QueryIntent) => ValidationResult} validateQuery  ¿Es pertinente para la ley local?
 * @property {() => string} getSourceVersion             Última actualización de la base de conocimiento.
 * @property {() => GraphNamespace} getNamespace          Namespace para el Cypher Query Service.
 */

export {}; // módulo de solo-tipos (sin runtime)
