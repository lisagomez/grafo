/**
 * Driver singleton de Neo4j (grafo legal).
 *
 * Punto único de conexión al grafo. El resto del código NO debe importar
 * `neo4j-driver` directamente: usa el Cypher Query Service, que a su vez usa
 * `runQuery`/`getSession` de aquí.
 */

import neo4j from 'neo4j-driver';
import { config } from '../config/index.js';

/** @type {import('neo4j-driver').Driver | null} */
let driver = null;

/**
 * Devuelve (creando si hace falta) el driver singleton.
 * @returns {import('neo4j-driver').Driver}
 */
export function getDriver() {
  if (!driver) {
    driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
      { disableLosslessIntegers: true } // enteros JS nativos en los resultados
    );
  }
  return driver;
}

/**
 * Verifica que el grafo esté accesible. No lanza: devuelve un diagnóstico.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function verifyConnectivity() {
  try {
    await getDriver().verifyConnectivity();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Ejecuta una query Cypher parametrizada y devuelve los records crudos.
 * @param {string} cypher
 * @param {Record<string, unknown>} [params]
 * @param {{ write?: boolean }} [opts]  write=true usa sesión de escritura.
 * @returns {Promise<import('neo4j-driver').Record[]>}
 */
export async function runQuery(cypher, params = {}, opts = {}) {
  const session = getDriver().session({
    database: config.neo4j.database,
    defaultAccessMode: opts.write ? neo4j.session.WRITE : neo4j.session.READ,
  });
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

/**
 * Cierra el driver (para apagado limpio / fin de scripts).
 * @returns {Promise<void>}
 */
export async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

export default { getDriver, verifyConnectivity, runQuery, closeDriver };
