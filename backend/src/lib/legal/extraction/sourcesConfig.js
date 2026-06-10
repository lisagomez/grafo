/**
 * Configuración agnóstica de extracción de fuentes legales.
 *
 * El "qué extraer" y el "de dónde" viven en un archivo de configuración declarativo
 * (`backend/config/legal-sources.json`, override con `LEGAL_SOURCES_CONFIG_PATH`):
 * por país, una `baseUrl` y un `selector` CSS por defecto; por fuente, un `path`
 * (relativo a la base o URL absoluta) y opcionalmente su propio `selector`.
 *
 * El extractor (`LegalExtractor`) consume SOLO esta configuración: añadir un país
 * o cambiar un portal es editar el JSON, nunca tocar código (mismo principio que
 * los `LegalSourceProvider`: el país viaja como dato, no como rama de código).
 */

import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { config } from '../../../config/index.js';

/**
 * Una fuente extraíble de una jurisdicción.
 * @typedef {Object} FuenteExtraccion
 * @property {string} clave        Identificador corto (p. ej. 'DOF_NOTA'); idealmente
 *                                 coincide con `KnowledgeSource.clave` del provider.
 * @property {string} path         Ruta relativa a `baseUrl` o URL absoluta (otro dominio).
 * @property {string} [selector]   Selector CSS de esta fuente; si falta, hereda el del país.
 * @property {'LEY'|'CODIGO'|'CRITERIO'} [tipo]  Naturaleza del documento.
 * @property {boolean} [oficial]   true = fuente oficial (default); false = fuente de consulta.
 * @property {string} [descripcion]
 */

/**
 * Configuración de extracción de un país.
 * @typedef {Object} PaisExtraccion
 * @property {string} baseUrl      URL base del portal legal de la jurisdicción.
 * @property {string} [selector]   Selector CSS por defecto para sus fuentes.
 * @property {FuenteExtraccion[]} fuentes
 */

/** @typedef {Record<string, PaisExtraccion>} LegalSourcesConfig  ISO-2 → configuración. */

const FuenteExtraccionSchema = z.object({
  clave: z.string().min(1),
  path: z.string().min(1),
  selector: z.string().min(1).optional(),
  tipo: z.enum(['LEY', 'CODIGO', 'CRITERIO']).optional(),
  oficial: z.boolean().default(true),
  descripcion: z.string().optional(),
});

const PaisExtraccionSchema = z
  .object({
    baseUrl: z.string().url(),
    selector: z.string().min(1).optional(),
    fuentes: z.array(FuenteExtraccionSchema).min(1),
  })
  .superRefine((pais, ctx) => {
    // Toda fuente debe acabar con un selector: propio o heredado del país.
    pais.fuentes.forEach((fuente, i) => {
      if (!fuente.selector && !pais.selector) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fuentes', i, 'selector'],
          message: `la fuente '${fuente.clave}' no tiene 'selector' y el país no define uno por defecto`,
        });
      }
    });
  });

export const LegalSourcesConfigSchema = z.record(
  z.string().regex(/^[A-Z]{2}$/, 'la clave de país debe ser ISO-2 en mayúsculas (p. ej. MX)'),
  PaisExtraccionSchema
);

/**
 * Carga y valida el archivo de configuración de fuentes legales.
 * @param {string} [configPath]  Ruta absoluta; default `config.legalSources.configPath`.
 * @returns {Promise<LegalSourcesConfig>}
 * @throws {Error} si el archivo no existe o no es JSON.
 * @throws {import('zod').ZodError} si la estructura no cumple el esquema.
 */
export async function loadLegalSourcesConfig(configPath = config.legalSources.configPath) {
  let raw;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch {
    throw new Error(
      `loadLegalSourcesConfig: no se encontró la configuración en ${configPath}. ` +
        'Crea backend/config/legal-sources.json o define LEGAL_SOURCES_CONFIG_PATH.'
    );
  }
  return LegalSourcesConfigSchema.parse(JSON.parse(raw));
}

/**
 * Resuelve la URL final y el selector efectivo de una fuente.
 * `new URL(path, baseUrl)` respeta paths absolutos (otro dominio) y relativos,
 * sin concatenación manual de strings.
 *
 * @param {LegalSourcesConfig} cfg
 * @param {string} iso    Código ISO-2 (insensible a mayúsculas).
 * @param {string} clave  Clave de la fuente dentro del país.
 * @returns {{ url: string, selector: string, fuente: FuenteExtraccion, pais: string }}
 * @throws {Error} si el país o la clave no existen en la configuración.
 */
export function resolveFuente(cfg, iso, clave) {
  const pais = String(iso ?? '').trim().toUpperCase();
  const paisCfg = cfg[pais];
  if (!paisCfg) {
    throw new Error(
      `resolveFuente: no hay configuración de extracción para '${pais}'. ` +
        `Países configurados: ${Object.keys(cfg).join(', ') || '(ninguno)'}.`
    );
  }

  const fuente = paisCfg.fuentes.find((f) => f.clave === clave);
  if (!fuente) {
    const claves = paisCfg.fuentes.map((f) => f.clave).join(', ');
    throw new Error(`resolveFuente: '${pais}' no tiene la fuente '${clave}'. Disponibles: ${claves}.`);
  }

  return {
    url: new URL(fuente.path, paisCfg.baseUrl).href,
    selector: fuente.selector ?? paisCfg.selector,
    fuente,
    pais,
  };
}
