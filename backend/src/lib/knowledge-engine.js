/**
 * Knowledge Engine — lectura dinámica de la bóveda de conocimiento.
 *
 * Permite que el sistema "lea" la Fuente de Verdad (`./knowledge-base/`) en caliente:
 * carga las notas `.md` de deducciones de un país, parsea su bloque **Pseudocódigo de
 * Grafo** (ver `references/CURATION_PROMPT.md` del skill `sync-country-knowledge`) y
 * devuelve un objeto JSON que el motor de reglas puede ejecutar para validar un gasto.
 *
 * No depende de Neo4j: opera sobre los `.md` de la bóveda. La ruta raíz NUNCA se
 * hardcodea aquí; se toma de `config.knowledgeBase` (`KNOWLEDGE_BASE_PATH`), que es la
 * única autoridad sobre dónde vive la bóveda. JavaScript/ESM + JSDoc (sin TypeScript),
 * coherente con el resto de `src/lib/`.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/index.js';

/**
 * Una arista del Pseudocódigo de Grafo, p. ej. `(Gasto) -[ES_DEDUCIBLE_SI]-> (Cumple_Requisito)`.
 * @typedef {Object} GraphEdge
 * @property {string} subject    Nodo origen (p. ej. 'Gasto').
 * @property {string} relation   Relación en mayúsculas (p. ej. 'ES_DEDUCIBLE_SI').
 * @property {string} object     Nodo destino (p. ej. 'Cumple_Requisito').
 * @property {'DEDUCIBLE'|'NO_DEDUCIBLE'|null} effect  Veredicto derivado de la relación, si se reconoce.
 * @property {Record<string, string|number|boolean|null>} properties  Propiedades inline `{tope_pct: 8, ...}`.
 * @property {string} raw        Línea original, para trazabilidad.
 */

/**
 * Regla de deducibilidad de un gasto, materializada desde una nota `.md`.
 * @typedef {Object} DeductionRule
 * @property {string|null} id            UUID del frontmatter (identidad estable; NUNCA el nombre de archivo).
 * @property {string|null} clave         Clave del gasto (p. ej. 'VIATICOS'), si está en el frontmatter.
 * @property {string[]} regimenes        Regímenes a los que aplica la regla (frontmatter `regimen` o `regimenes`).
 * @property {string|null} contextoLegal Texto de la sección "Contexto Legal".
 * @property {string|null} reglaLogica   Texto de la sección "Regla Lógica".
 * @property {string|null} sourceVersion Versión de la base de conocimiento citada en el dictamen.
 * @property {string|null} vigenteDesde  ISO date o null.
 * @property {string|null} vigenteHasta  ISO date o null (null = vigente).
 * @property {string|null} fuenteUrl     URL de la fuente oficial.
 * @property {string} file               Nombre del archivo de origen (relativo a deducciones/).
 * @property {number|null} line_number   Línea (1-based) de la primera arista en la nota, para rastreo.
 * @property {GraphEdge[]} edges         Aristas ejecutables parseadas del Pseudocódigo de Grafo.
 * @property {string|null} pseudocodigoRaw  Bloque de pseudocódigo crudo, para depuración.
 */

/**
 * Conjunto de reglas de una jurisdicción, listo para el motor.
 * @typedef {Object} CountryRuleSet
 * @property {string} iso          Código ISO-2 normalizado (mayúsculas).
 * @property {string} sourceDir    Ruta absoluta de la carpeta `deducciones/` leída.
 * @property {string} loadedAt     Timestamp ISO de la carga.
 * @property {number} count        Número de reglas cargadas.
 * @property {DeductionRule[]} rules
 * @property {string[]} warnings   Avisos no fatales (notas sin pseudocódigo, sin id, etc.).
 */

/* ───────────────────────────────────────────────────────────────────────────
 * Esquema estándar de intercambio (KnowledgeSchema)
 *
 * Formato JSON genérico y estable que cualquier motor de reglas puede consumir,
 * derivado del `CountryRuleSet` vía `toKnowledgeSchema()`. Contrato publicado en
 * `docs/knowledge-schema.json`. Es intencionalmente más simple que el modelo
 * interno (no lleva topes/regímenes/vigencia): para la inferencia fiscal usa el
 * `CountryRuleSet` + `VaultRuleService`; para interoperar, usa este esquema.
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {Object} KnowledgeEdge
 * @property {string} subject     Nodo origen.
 * @property {string} predicate   Relación (el `relation` interno; p. ej. 'ES_DEDUCIBLE_SI').
 * @property {'DEDUCIBLE'|'NO_DEDUCIBLE'|null} effect  Veredicto que implica la relación.
 * @property {string} object      Nodo destino.
 *
 * @typedef {Object} KnowledgeRule
 * @property {string|null} id           Identidad estable de la regla (UUID).
 * @property {string|null} description  Descripción legible (Regla Lógica / Contexto Legal).
 * @property {KnowledgeEdge[]} edges
 * @property {number|null} line_number  Línea de origen en la nota (rastreo).
 *
 * @typedef {Object} KnowledgeSchema
 * @property {{ country: string, engine_version: string }} metadata
 * @property {KnowledgeRule[]} rules
 * @property {string[]} warnings        Errores no bloqueantes detectados durante el parseo.
 */

/** Versión del esquema/engine de salida (semver). Subir al cambiar el contrato. */
export const ENGINE_VERSION = '1.0.0';

/**
 * Definición JSON Schema del `KnowledgeSchema`. **Única fuente de verdad**: de aquí
 * derivan el validador (`validateKnowledgeSchema`) y el archivo publicado
 * `docs/knowledge-schema.json` (generado por `scripts/generate-schema.js`).
 * @type {Object}
 */
export const KNOWLEDGE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://grafo.local/schemas/knowledge-schema.json',
  title: 'KnowledgeSchema',
  description:
    'Salida estándar de intercambio del knowledge-engine (backend/src/lib/knowledge-engine.js → toKnowledgeSchema). Formato genérico que cualquier motor de reglas puede consumir. NOTA: es intencionalmente más simple que el modelo interno (no incluye topes/regímenes/vigencia); para la inferencia fiscal se usa el CountryRuleSet + VaultRuleService.',
  type: 'object',
  additionalProperties: false,
  required: ['metadata', 'rules', 'warnings'],
  properties: {
    metadata: {
      type: 'object',
      additionalProperties: false,
      required: ['country', 'engine_version'],
      properties: {
        country: { type: 'string', pattern: '^[A-Z]{2}$', description: 'Código de país ISO-2 en mayúsculas.' },
        engine_version: { type: 'string', description: 'Versión semver del esquema/engine que produjo este JSON.' },
      },
    },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'description', 'edges', 'line_number'],
        properties: {
          id: { type: ['string', 'null'], description: 'Identidad estable de la regla (UUID). null si la nota no la declara.' },
          description: { type: ['string', 'null'], description: 'Descripción legible (Regla Lógica / Contexto Legal).' },
          edges: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['subject', 'predicate', 'effect', 'object'],
              properties: {
                subject: { type: 'string', description: 'Nodo origen.' },
                predicate: { type: 'string', description: 'Relación (p. ej. ES_DEDUCIBLE_SI).' },
                effect: {
                  type: ['string', 'null'],
                  enum: ['DEDUCIBLE', 'NO_DEDUCIBLE', null],
                  description: 'Veredicto que implica la relación; null si no se reconoce.',
                },
                object: { type: 'string', description: 'Nodo destino.' },
              },
            },
          },
          line_number: {
            type: ['integer', 'null'],
            description: 'Línea (1-based) de origen en la nota, para rastreo. null si no hay aristas.',
          },
        },
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Errores no bloqueantes detectados durante el parseo.',
    },
  },
};

/** Relación → veredicto que el motor debe aplicar. */
const RELATION_EFFECT = {
  ES_DEDUCIBLE_SI: 'DEDUCIBLE',
  NO_ES_DEDUCIBLE_SI: 'NO_DEDUCIBLE',
};

/** Normaliza un texto para comparar encabezados sin importar acentos ni mayúsculas. */
function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

/**
 * Parsea el frontmatter YAML plano (`clave: valor`) de una nota. Sin dependencias:
 * la bóveda usa frontmatter llano (id, clave, vigencias, fuente_url, source_version).
 * @param {string} content  Contenido completo del `.md`.
 * @returns {{ frontmatter: Record<string, string|null>, body: string }}
 */
export function parseFrontmatter(content) {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(content);
  if (!match) return { frontmatter: {}, body: content };

  /** @type {Record<string, string|null>} */
  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const kv = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    let value = kv[2].trim().replace(/^["']|["']$/g, '');
    frontmatter[kv[1]] = value === '' || normalize(value) === 'null' ? null : value;
  }
  return { frontmatter, body: match[2] };
}

/**
 * Extrae el texto bajo un encabezado Markdown (`#`..`######`) hasta el siguiente encabezado.
 * @param {string} markdown
 * @param {string} headingName  Nombre del encabezado a buscar (insensible a acentos/mayúsculas).
 * @returns {string|null}
 */
export function extractSection(markdown, headingName) {
  const target = normalize(headingName);
  const lines = markdown.split('\n');
  const out = [];
  let capturing = false;

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      if (capturing) break; // llegó el siguiente encabezado → fin de la sección
      if (normalize(heading[2]) === target) {
        capturing = true;
        continue;
      }
    }
    if (capturing) out.push(line);
  }

  if (!capturing) return null;
  const text = out.join('\n').trim();
  return text === '' ? null : text;
}

/**
 * Convierte el cuerpo `{key: val, ...}` de una arista en un objeto tipado.
 * @param {string|undefined} rawProps
 * @returns {Record<string, string|number|boolean|null>}
 */
function parseEdgeProperties(rawProps) {
  /** @type {Record<string, string|number|boolean|null>} */
  const props = {};
  if (!rawProps) return props;
  const inner = rawProps.replace(/^\{|\}$/g, '').trim();
  if (!inner) return props;

  for (const pair of inner.split(',')) {
    const kv = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(pair);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim().replace(/^["']|["']$/g, '');
    if (/^-?\d+(\.\d+)?$/.test(value)) props[key] = Number(value);
    else if (value === 'true' || value === 'false') props[key] = value === 'true';
    else if (normalize(value) === 'null' || value === '') props[key] = null;
    else props[key] = value;
  }
  return props;
}

/**
 * Parsea el bloque "Pseudocódigo de Grafo" en aristas ejecutables.
 * Acepta el contenido tal cual (con o sin fence ```), una arista por línea con la forma
 * `(Origen) -[RELACION]-> (Destino)` y propiedades opcionales `{...}`.
 * @param {string|null} pseudocodigo
 * @returns {GraphEdge[]}
 */
export function parseGraphPseudocode(pseudocodigo) {
  if (!pseudocodigo) return [];

  // Si viene envuelto en una valla de código, usa solo su contenido.
  const fence = /```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)```/.exec(pseudocodigo);
  const block = fence ? fence[1] : pseudocodigo;

  const edgeRe = /^\(\s*([^)]+?)\s*\)\s*-\[\s*([A-Za-z0-9_]+)\s*\]->\s*\(\s*([^)]+?)\s*\)\s*(\{[^}]*\})?\s*$/;
  /** @type {GraphEdge[]} */
  const edges = [];

  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
    const m = edgeRe.exec(trimmed);
    if (!m) continue;
    const relation = m[2].toUpperCase();
    edges.push({
      subject: m[1].trim(),
      relation,
      object: m[3].trim(),
      effect: RELATION_EFFECT[relation] ?? null,
      properties: parseEdgeProperties(m[4]),
      raw: trimmed,
    });
  }
  return edges;
}

/**
 * Normaliza el/los régimen(es) del frontmatter a un array. Acepta `regimen` (string)
 * o `regimenes` (lista inline `[A, B]` o `A, B`). Insensible a espacios.
 * @param {Record<string, string|null>} frontmatter
 * @returns {string[]}
 */
export function parseRegimenes(frontmatter) {
  const raw = frontmatter.regimenes ?? frontmatter.regimen;
  if (!raw) return [];
  return String(raw)
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/**
 * Parsea una nota `.md` completa en una regla de deducibilidad.
 * @param {string} content  Contenido del archivo.
 * @param {string} file     Nombre del archivo (para trazabilidad).
 * @returns {{ rule: DeductionRule, warnings: string[] }}
 */
export function parseRuleNote(content, file) {
  const warnings = [];
  const { frontmatter, body } = parseFrontmatter(content);

  const pseudocodigoRaw = extractSection(body, 'Pseudocódigo de Grafo');
  const edges = parseGraphPseudocode(pseudocodigoRaw);

  if (!frontmatter.id) warnings.push(`${file}: nota sin 'id' (UUID) en el frontmatter.`);
  if (!pseudocodigoRaw) warnings.push(`${file}: falta la sección 'Pseudocódigo de Grafo'.`);
  else if (edges.length === 0) warnings.push(`${file}: el Pseudocódigo de Grafo no produjo aristas válidas.`);

  // Nivel 1: ninguna arista debe quedar "en el limbo". Una relación que no mapea a un
  // veredicto (effect === null) es un no-op silencioso peligroso en deducibilidad fiscal.
  for (const edge of edges) {
    if (edge.effect === null) {
      warnings.push(
        `${file}: relación no reconocida '${edge.relation}' (sin veredicto, effect=null) en » ${edge.raw}`
      );
    }
  }

  // Rastreo: línea (1-based) de la primera arista dentro de la nota, para auditar el origen.
  let lineNumber = null;
  if (edges.length > 0) {
    const idx = content.split('\n').findIndex((l) => l.trim() === edges[0].raw);
    lineNumber = idx >= 0 ? idx + 1 : null;
  }

  /** @type {DeductionRule} */
  const rule = {
    id: frontmatter.id ?? null,
    clave: frontmatter.clave ?? null,
    regimenes: parseRegimenes(frontmatter),
    contextoLegal: extractSection(body, 'Contexto Legal'),
    reglaLogica: extractSection(body, 'Regla Lógica'),
    sourceVersion: frontmatter.source_version ?? null,
    vigenteDesde: frontmatter.vigente_desde ?? null,
    vigenteHasta: frontmatter.vigente_hasta ?? null,
    fuenteUrl: frontmatter.fuente_url ?? null,
    file,
    line_number: lineNumber,
    edges,
    pseudocodigoRaw,
  };
  return { rule, warnings };
}

/**
 * Carga las reglas de deducibilidad de un país desde la bóveda oficial.
 *
 * Lee `./knowledge-base/countries/{ISO}/deducciones/*.md`, parsea cada nota (frontmatter
 * + Pseudocódigo de Grafo) y devuelve un `CountryRuleSet` que el motor de reglas puede
 * ejecutar para validar un gasto.
 *
 * @param {string} iso  Código de país ISO-2 (p. ej. 'MX'). Insensible a mayúsculas.
 * @param {Object} [options]
 * @param {boolean} [options.strict=false]  Si hay cualquier warning, lanza `AggregateError`
 *   con un `Error` por incidencia. Pensado para CI/CD: la bóveda debe estar impecable.
 * @returns {Promise<CountryRuleSet>}
 * @throws {Error} Si `iso` es vacío, o si la carpeta del país no existe en la bóveda.
 * @throws {AggregateError} En modo `strict` cuando el resultado contiene warnings.
 */
export async function loadCountryRules(iso, options = {}) {
  const { strict = false } = options;
  const ISO = String(iso ?? '').trim().toUpperCase();
  if (!ISO) {
    throw new Error("loadCountryRules: se requiere un código de país ISO-2 (p. ej. 'MX').");
  }

  const countryDir = path.join(config.knowledgeBase.countriesDir, ISO);
  const deduccionesDir = path.join(countryDir, 'deducciones');

  // El país debe existir en la bóveda; si no, es un error claro (jurisdicción no curada).
  try {
    await stat(countryDir);
  } catch {
    throw new Error(
      `loadCountryRules: no hay bóveda para '${ISO}' en ${countryDir}. ` +
        'Crea la carpeta del país y cura sus reglas (ver skill /sync-country-knowledge).'
    );
  }

  /** @type {CountryRuleSet} */
  const result = {
    iso: ISO,
    sourceDir: deduccionesDir,
    loadedAt: new Date().toISOString(),
    count: 0,
    rules: [],
    warnings: [],
  };

  // `deducciones/` puede no existir aún (país presente, sin reglas curadas): no es fatal
  // en modo normal, pero sí cuenta como incidencia para el gate estricto de más abajo.
  let entries = null;
  try {
    entries = await readdir(deduccionesDir, { withFileTypes: true });
  } catch {
    result.warnings.push(`No existe ${deduccionesDir}; aún no hay deducciones curadas para ${ISO}.`);
  }

  if (entries) {
    const files = entries
      .filter((e) => e.isFile() && /\.(md|markdown)$/i.test(e.name))
      .map((e) => e.name)
      .sort();

    for (const file of files) {
      const content = await readFile(path.join(deduccionesDir, file), 'utf8');
      const { rule, warnings } = parseRuleNote(content, file);
      result.rules.push(rule);
      result.warnings.push(...warnings);
    }
  }

  result.count = result.rules.length;

  // Nivel 2: en CI/CD, cualquier incidencia bloquea. Un AggregateError preserva el
  // detalle completo (un Error por warning) sin perder el set ya cargado en `.errors`.
  if (strict && result.warnings.length > 0) {
    throw new AggregateError(
      result.warnings.map((w) => new Error(w)),
      `loadCountryRules(${ISO}): bóveda con ${result.warnings.length} incidencia(s) en modo estricto.`
    );
  }

  return result;
}

/**
 * Serializa un `CountryRuleSet` al esquema estándar de intercambio (`KnowledgeSchema`).
 * Esta es la salida que cualquier motor de reglas debe consumir. Contrato en
 * `docs/knowledge-schema.json`.
 * @param {CountryRuleSet} ruleSet
 * @returns {KnowledgeSchema}
 */
export function toKnowledgeSchema(ruleSet) {
  return {
    metadata: {
      country: ruleSet.iso,
      engine_version: ENGINE_VERSION,
    },
    rules: ruleSet.rules.map((r) => ({
      id: r.id,
      description: r.reglaLogica ?? r.contextoLegal ?? r.clave ?? null,
      edges: r.edges.map((e) => ({
        subject: e.subject,
        predicate: e.relation,
        effect: e.effect,
        object: e.object,
      })),
      line_number: r.line_number ?? null,
    })),
    warnings: ruleSet.warnings,
  };
}

/** Tipo JSON-Schema de un valor (subset que usa KNOWLEDGE_SCHEMA). */
function jsonType(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v; // 'string' | 'object' | 'number' | 'boolean'
}

/** ¿`v` satisface el tipo JSON-Schema `t`? */
function matchesType(v, t) {
  if (t === 'object') return typeof v === 'object' && v !== null && !Array.isArray(v);
  if (t === 'array') return Array.isArray(v);
  if (t === 'integer') return Number.isInteger(v);
  return typeof v === t || (t === 'null' && v === null);
}

/**
 * Validador genérico contra un (subset de) JSON Schema: type, enum, pattern, required,
 * properties, additionalProperties:false, items. Acumula todos los errores con su ruta.
 * @param {unknown} value
 * @param {Object} schema
 * @param {string} path
 * @param {string[]} errors
 */
function validateNode(value, schema, path, errors) {
  const p = path || 'raíz';

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${p}: se esperaba ${types.join('|')}, se obtuvo ${jsonType(value)}.`);
      return; // si el tipo base falla, no tiene sentido seguir descendiendo
    }
  }
  if (schema.enum && !schema.enum.some((e) => e === value)) {
    errors.push(`${p}: valor no permitido ${JSON.stringify(value)}; enum ${JSON.stringify(schema.enum)}.`);
  }
  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
    errors.push(`${p}: no cumple el patrón ${schema.pattern}.`);
  }

  if (matchesType(value, 'object')) {
    const props = schema.properties || {};
    for (const req of schema.required || []) {
      if (!(req in value)) errors.push(`${p}: falta la propiedad requerida '${req}'.`);
    }
    for (const key of Object.keys(value)) {
      if (props[key]) validateNode(value[key], props[key], path ? `${path}.${key}` : key, errors);
      else if (schema.additionalProperties === false) errors.push(`${p}: propiedad no permitida '${key}'.`);
    }
  }

  if (matchesType(value, 'array') && schema.items) {
    value.forEach((item, i) => validateNode(item, schema.items, `${path}[${i}]`, errors));
  }
}

/**
 * Valida un objeto contra `KNOWLEDGE_SCHEMA` (la única fuente de verdad del contrato).
 * Devuelve todos los errores hallados, no solo el primero.
 * @param {unknown} obj
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateKnowledgeSchema(obj) {
  const errors = [];
  validateNode(obj, KNOWLEDGE_SCHEMA, '', errors);
  return { ok: errors.length === 0, errors };
}

export default loadCountryRules;
