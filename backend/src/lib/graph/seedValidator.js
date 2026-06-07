/**
 * Validador de procedencia del seed.
 *
 * Regla de oro (BUSINESS_LOGIC.md): NINGUN dato entra al grafo sin su fuente y su
 * `source_version`. Este validador rechaza el dataset completo si cualquier nodo o
 * relación carece de procedencia. Se ejecuta ANTES de tocar Neo4j.
 */

/**
 * @typedef {Object} SeedDataset
 * @property {Object} _meta
 * @property {Array<Object>} regimenes
 * @property {Array<Object>} gastos
 * @property {Array<Object>} normas
 * @property {Array<Object>} criterios
 * @property {Array<Object>} relaciones
 */

/** Nodos requieren source_version; los que citan ley además requieren una URL de fuente. */
const NODE_GROUPS = [
  { key: 'regimenes', requiereUrl: true, urlField: 'fuente' },
  { key: 'gastos', requiereUrl: true, urlField: 'fuente' },
  { key: 'normas', requiereUrl: true, urlField: 'fuente_url' },
  { key: 'criterios', requiereUrl: true, urlField: 'fuente_url' },
];

/**
 * Valida la procedencia de todo el dataset.
 * @param {SeedDataset} data
 * @returns {{ ok: boolean, errores: string[], stats: Record<string, number> }}
 */
export function validarProcedencia(data) {
  const errores = [];
  const stats = {};

  for (const { key, requiereUrl, urlField } of NODE_GROUPS) {
    const items = Array.isArray(data?.[key]) ? data[key] : [];
    stats[key] = items.length;
    items.forEach((item, i) => {
      const ident = item.id || item.clave || `#${i}`;
      if (!item.source_version) {
        errores.push(`${key}[${ident}]: falta source_version`);
      }
      if (requiereUrl && !item[urlField]) {
        errores.push(`${key}[${ident}]: falta fuente (${urlField})`);
      }
    });
  }

  const rels = Array.isArray(data?.relaciones) ? data.relaciones : [];
  stats.relaciones = rels.length;
  rels.forEach((rel, i) => {
    const ident = `${rel.tipo || '?'} ${rel.fromVal || '?'}->${rel.toVal || '?'} (#${i})`;
    if (!rel.props || !rel.props.source_version) {
      errores.push(`relaciones[${ident}]: falta source_version en props`);
    }
  });

  return { ok: errores.length === 0, errores, stats };
}

export default { validarProcedencia };
