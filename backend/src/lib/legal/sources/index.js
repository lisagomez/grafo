/**
 * LegalSourceFactory — resuelve el `LegalSourceProvider` correcto según el país.
 *
 * Patrón Strategy: el `ContextResolver` pide aquí un provider por `countryCode` y
 * recibe una instancia que cumple el contrato, sin saber de qué país se trata.
 * Añadir una jurisdicción = importar su provider y registrarlo en `PROVIDERS`.
 */

import './types.js'; // @typedef LegalSourceProvider
import { MXLegalProvider } from './MXLegalProvider.js';

/**
 * Registro de providers por código ISO-2. Instancias singleton (los providers
 * son stateless, así que se reutilizan sin coste).
 * @type {Record<string, LegalSourceProvider>}
 */
const PROVIDERS = {
  MX: new MXLegalProvider(),
};

/**
 * Error lanzado cuando no hay un provider registrado para una jurisdicción.
 * El ContextResolver lo captura para disparar `autoResearchIngest(countryCode)`
 * y responder `procesando_jurisdiccion` en vez de inventar una respuesta sin base.
 */
export class UnsupportedJurisdictionError extends Error {
  /** @param {string} countryCode */
  constructor(countryCode) {
    super(`No hay Fuente de Verdad cargada para la jurisdicción: ${countryCode}`);
    this.name = 'UnsupportedJurisdictionError';
    /** @type {string} */
    this.countryCode = countryCode;
  }
}

/**
 * Devuelve el provider de la jurisdicción solicitada.
 * @param {string} countryCode  Código ISO-2, p. ej. 'MX'.
 * @returns {LegalSourceProvider}
 * @throws {UnsupportedJurisdictionError} si la jurisdicción no está registrada.
 */
export function getProvider(countryCode) {
  const code = String(countryCode || '').toUpperCase();
  const provider = PROVIDERS[code];
  if (!provider) {
    throw new UnsupportedJurisdictionError(code);
  }
  return provider;
}

/**
 * Lista los códigos de país soportados (útil para diagnósticos/UI).
 * @returns {string[]}
 */
export function getSupportedCountries() {
  return Object.keys(PROVIDERS);
}

export const LegalSourceFactory = { getProvider, getSupportedCountries };

export default LegalSourceFactory;
