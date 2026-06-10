/**
 * LegalExtractor — extracción agnóstica de fuentes legales dirigida por configuración.
 *
 * No sabe nada de países concretos: recibe la configuración declarativa
 * (`legal-sources.json`: baseUrl + selector CSS por fuente) y extrae el texto del
 * portal aplicando el selector. El `fetch` es inyectable (Adapter en el borde),
 * así la lógica se testea sin red ("Modo Arquitecto").
 *
 * Alcance V1: documentos HTML vía selector CSS. Un content-type no HTML (p. ej.
 * PDF) se reporta como incidencia explícita — esa ruta requiere el lector
 * especializado de la Fase 8 (autoResearchIngest), no un selector.
 *
 * Esta capa SOLO extrae texto bruto: no interpreta, no escribe en el grafo.
 * Su salida alimenta la curaduría (skill /pre-curator → bóveda → motor).
 */

import * as cheerio from 'cheerio';
import { loadLegalSourcesConfig, resolveFuente } from './sourcesConfig.js';

/**
 * Headers por defecto: varios portales gubernamentales devuelven 403 al
 * User-Agent vacío de Node. Nos identificamos honestamente como extractor;
 * la configuración puede sobreescribirlo por país o por fuente (`headers`).
 * @type {Record<string, string>}
 */
const DEFAULT_HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; GrafoLegalExtractor/1.0)',
};

/**
 * Resultado de extraer una fuente legal.
 * @typedef {Object} ExtractionResult
 * @property {boolean} ok          true si se obtuvo contenido con el selector.
 * @property {string} pais         ISO-2 de la jurisdicción.
 * @property {string} clave        Clave de la fuente extraída.
 * @property {string} url          URL final consultada.
 * @property {string} selector     Selector CSS aplicado.
 * @property {boolean} oficial     true si la fuente es oficial (vs. de consulta).
 * @property {string|null} content Texto extraído (normalizado), o null si falló.
 * @property {string} fetchedAt    Timestamp ISO de la extracción.
 * @property {string[]} warnings   Incidencias (HTTP, selector sin matches, no-HTML...).
 */

export class LegalExtractor {
  /**
   * @param {Object} options
   * @param {import('./sourcesConfig.js').LegalSourcesConfig} options.config  Configuración ya validada.
   * @param {typeof fetch} [options.fetchFn]  Implementación de fetch (inyectable para tests).
   */
  constructor({ config, fetchFn } = {}) {
    if (!config || typeof config !== 'object') {
      throw new Error('LegalExtractor: se requiere la configuración de fuentes (usa LegalExtractor.fromConfigFile()).');
    }
    /** @type {import('./sourcesConfig.js').LegalSourcesConfig} */
    this.config = config;
    /** @type {typeof fetch} */
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  /**
   * Construye un extractor cargando y validando el archivo de configuración.
   * @param {string} [configPath]
   * @returns {Promise<LegalExtractor>}
   */
  static async fromConfigFile(configPath) {
    return new LegalExtractor({ config: await loadLegalSourcesConfig(configPath) });
  }

  /** @returns {string[]} Países configurados (ISO-2). */
  getCountries() {
    return Object.keys(this.config);
  }

  /**
   * @param {string} iso
   * @returns {import('./sourcesConfig.js').FuenteExtraccion[]}
   */
  listSources(iso) {
    const pais = String(iso ?? '').trim().toUpperCase();
    if (!this.config[pais]) {
      throw new Error(`listSources: no hay configuración de extracción para '${pais}'.`);
    }
    return this.config[pais].fuentes;
  }

  /**
   * Extrae el texto de una fuente aplicando su selector CSS.
   * Nunca lanza por fallos del documento remoto: los reporta en `warnings` con
   * `ok: false` (el llamador decide; el CLI sale con código 1).
   *
   * @param {string} iso    País ISO-2.
   * @param {string} clave  Clave de la fuente.
   * @returns {Promise<ExtractionResult>}
   * @throws {Error} solo por configuración inválida (país/clave inexistentes).
   */
  async extract(iso, clave) {
    const { url, selector, headers, fuente, pais } = resolveFuente(this.config, iso, clave);

    /** @type {ExtractionResult} */
    const result = {
      ok: false,
      pais,
      clave,
      url,
      selector,
      oficial: fuente.oficial !== false,
      content: null,
      fetchedAt: new Date().toISOString(),
      warnings: [],
    };

    let response;
    try {
      response = await this.fetchFn(url, { headers: { ...DEFAULT_HEADERS, ...headers } });
    } catch (err) {
      result.warnings.push(`fallo de red al consultar ${url}: ${err.message}`);
      return result;
    }

    if (!response.ok) {
      result.warnings.push(`HTTP ${response.status} al consultar ${url}`);
      return result;
    }

    const contentType = response.headers?.get?.('content-type') ?? '';
    if (!contentType.toLowerCase().includes('html')) {
      result.warnings.push(
        `documento no HTML (content-type: ${contentType || 'desconocido'}): ` +
          'requiere el lector especializado de ingesta (Fase 8), no extracción por selector.'
      );
      return result;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const nodes = $(selector);

    if (nodes.length === 0) {
      result.warnings.push(
        `el selector '${selector}' no encontró coincidencias en ${url} ` +
          '(¿cambió la estructura del portal? Actualiza legal-sources.json).'
      );
      return result;
    }

    const content = nodes
      .map((_, el) => $(el).text())
      .get()
      .join('\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .trim();

    if (!content) {
      result.warnings.push(`el selector '${selector}' coincidió pero no produjo texto en ${url}.`);
      return result;
    }

    result.ok = true;
    result.content = content;
    return result;
  }

  /**
   * Extrae todas las fuentes configuradas de un país.
   * @param {string} iso
   * @returns {Promise<ExtractionResult[]>}
   */
  async extractAll(iso) {
    const fuentes = this.listSources(iso);
    const results = [];
    for (const fuente of fuentes) {
      results.push(await this.extract(iso, fuente.clave));
    }
    return results;
  }
}

export default LegalExtractor;
