/**
 * VaultRuleService — adaptador Bóveda → Motor de Inferencia.
 *
 * Traduce el `CountryRuleSet` que produce el knowledge-engine (notas `.md` de
 * `./knowledge-base/`) al dataset con forma de seed que consume `MockNeo4jService`,
 * y reutiliza su semántica de recorrido (`getCadenaLegal`). Así el `InferenceEngine`
 * existente emite un `Dictamen` completo (veredicto + lineage + source_version) sobre
 * datos de la bóveda, **sin duplicar** la lógica del motor.
 *
 * Mapeo (transparente, ver `buildDatasetFromRuleSet`):
 *   - Nota            → nodo `:Norma`  (id, vigencia, fuente_url, source_version).
 *   - `clave` (nota)  → nodo `:Gasto`.
 *   - Arista          → relación `APLICA_A` (veredicto_base ← effect; topes/condición ← properties).
 *   - `regimenes`     → una `APLICA_A` por régimen (el motor filtra por régimen vía el servicio).
 *
 * Regla de oro del adaptador: si el motor espera un dato que la nota NO provee
 * (régimen, source_version, veredicto, id, gasto), se acumula un **warning claro**
 * en `service.warnings` — nunca se inventa el dato.
 */

import { loadCountryRules } from '../knowledge-engine.js';
import { MockNeo4jService } from './Neo4jService.js';

/** Primera línea no vacía de un texto (para etiquetar la norma en el lineage). */
function primeraLinea(texto) {
  if (!texto) return null;
  const linea = texto.split('\n').map((l) => l.trim()).find(Boolean);
  return linea || null;
}

/**
 * Deriva el veredicto base y los topes/condición de una regla a partir de sus aristas.
 * @param {import('../knowledge-engine.js').DeductionRule} rule
 * @returns {{ veredicto_base: 'DEDUCIBLE'|'NO_DEDUCIBLE'|null, tope_monto: number|null, tope_pct: number|null, condicion: string|null }}
 */
function derivarAplica(rule) {
  const positivas = rule.edges.filter((e) => e.effect === 'DEDUCIBLE');
  const negativas = rule.edges.filter((e) => e.effect === 'NO_DEDUCIBLE');

  // Si habilita el gasto (hay arista positiva) el base es DEDUCIBLE; las negativas son
  // descalificadores. Si solo hay negativas, el base es NO_DEDUCIBLE.
  const veredicto_base = positivas.length ? 'DEDUCIBLE' : negativas.length ? 'NO_DEDUCIBLE' : null;

  // Los topes/condición viajan en la arista positiva (el requisito de deducibilidad).
  const props = positivas[0]?.properties ?? {};
  const num = (v) => (typeof v === 'number' ? v : null);

  return {
    veredicto_base,
    tope_monto: num(props.tope_monto),
    tope_pct: num(props.tope_pct),
    condicion: props.condicion != null ? String(props.condicion) : null,
  };
}

/**
 * Construye el dataset (forma de seed) a partir de un `CountryRuleSet`, acumulando
 * warnings por cada dato que el motor necesita y la nota no provee.
 * @param {import('../knowledge-engine.js').CountryRuleSet} ruleSet
 * @returns {{ dataset: Object, warnings: string[] }}
 */
export function buildDatasetFromRuleSet(ruleSet) {
  const pais = ruleSet.iso;
  const warnings = [];

  /** @type {Map<string, Object>} */
  const gastosByClave = new Map();
  const normas = [];
  const relaciones = [];

  ruleSet.rules.forEach((rule, i) => {
    const ref = rule.file || `nota#${i}`;

    // El gasto (toVal de APLICA_A) es obligatorio para emparejar la consulta.
    if (!rule.clave) {
      warnings.push(`${ref}: sin 'clave' de gasto en el frontmatter; la regla no se puede asociar a un :Gasto.`);
      return;
    }

    // Identidad de la norma. Sin id no hay nodo estable: se sintetiza y se avisa.
    let normaId = rule.id;
    if (!normaId) {
      normaId = `vault:${pais}:${rule.clave}:${i}`;
      warnings.push(`${ref}: sin 'id'; se usó un id sintético (${normaId}) para la :Norma.`);
    }

    if (!rule.sourceVersion) {
      warnings.push(`${ref}: sin 'source_version'; el lineage y la auditoría lo necesitan.`);
    }

    const { veredicto_base, tope_monto, tope_pct, condicion } = derivarAplica(rule);
    if (!veredicto_base) {
      warnings.push(`${ref}: ninguna arista produce veredicto (ES_DEDUCIBLE_SI / NO_ES_DEDUCIBLE_SI); la regla es inerte.`);
    }

    // :Gasto (uno por clave; el primero define el source_version del nodo).
    if (!gastosByClave.has(rule.clave)) {
      gastosByClave.set(rule.clave, { clave: rule.clave, pais, source_version: rule.sourceVersion ?? null });
    }

    // :Norma
    normas.push({
      id: normaId,
      clave: primeraLinea(rule.contextoLegal) || `NORMA_${String(normaId).slice(0, 12)}`,
      pais,
      vigente_desde: rule.vigenteDesde ?? null,
      vigente_hasta: rule.vigenteHasta ?? null,
      fuente_url: rule.fuenteUrl ?? null,
      source_version: rule.sourceVersion ?? null,
    });

    // APLICA_A: una por régimen. Sin régimen, la regla nunca emparejará una consulta.
    if (rule.regimenes.length === 0) {
      warnings.push(`${ref}: sin 'regimen' en el frontmatter; el motor no podrá emparejarla con ninguna consulta.`);
    }
    for (const regimen of rule.regimenes) {
      relaciones.push({
        tipo: 'APLICA_A',
        fromVal: normaId,
        toVal: rule.clave,
        props: { regimen, veredicto_base, tope_monto, tope_pct, condicion, source_version: rule.sourceVersion ?? null },
      });
    }
  });

  const dataset = {
    regimenes: [],
    gastos: [...gastosByClave.values()],
    normas,
    criterios: [],
    relaciones,
  };
  return { dataset, warnings };
}

/**
 * Servicio compatible con el contrato `Neo4jService`, alimentado desde la bóveda.
 * Hereda toda la semántica de `MockNeo4jService` (recorrido `getCadenaLegal`, etc.).
 * @implements {import('./Neo4jService.js').Neo4jService}
 */
export class VaultRuleService extends MockNeo4jService {
  /**
   * @param {Object} dataset           Dataset (forma de seed) ya construido.
   * @param {string[]} [warnings]      Warnings de carga + mapeo, para que el llamador los revise.
   */
  constructor(dataset, warnings = []) {
    super(dataset);
    this.isVault = true;
    /** @type {string[]} */
    this.warnings = warnings;
  }
}

/**
 * Factory: carga la bóveda de un país y devuelve un `VaultRuleService` listo para el motor.
 * @param {string} iso  Código ISO-2 (p. ej. 'MX').
 * @returns {Promise<VaultRuleService>}
 */
export async function createVaultRuleService(iso) {
  const ruleSet = await loadCountryRules(iso); // tolerante: clasificamos/avisamos, no lanzamos
  const { dataset, warnings } = buildDatasetFromRuleSet(ruleSet);
  return new VaultRuleService(dataset, [...ruleSet.warnings, ...warnings]);
}

export default { VaultRuleService, createVaultRuleService, buildDatasetFromRuleSet };
