/**
 * Exporta el conocimiento de un país al formato estándar de intercambio.
 *
 * Carga la bóveda (`loadCountryRules`), serializa con `toKnowledgeSchema`, valida contra
 * el contrato (`validateKnowledgeSchema`) y escribe `out/knowledge/<ISO>.json`. Es la forma
 * **oficial** de extraer el conocimiento curado para que cualquier motor de reglas lo consuma.
 *
 * Uso: npm run export:knowledge -- <iso>      (p. ej.  npm run export:knowledge -- MX)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  loadCountryRules,
  toKnowledgeSchema,
  validateKnowledgeSchema,
} from '../src/lib/knowledge-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'out', 'knowledge');

async function main() {
  const iso = process.argv.slice(2).find((a) => !a.startsWith('-'));
  if (!iso) {
    console.error('Uso: npm run export:knowledge -- <iso>   (p. ej. MX)');
    process.exit(1);
  }

  const ruleSet = await loadCountryRules(iso); // lanza si el país no existe en la bóveda
  const schema = toKnowledgeSchema(ruleSet);

  // Cierra el ciclo: nunca exportamos algo que no cumpla el contrato publicado.
  const { ok, errors } = validateKnowledgeSchema(schema);
  if (!ok) {
    console.error(`✗ La salida de ${schema.metadata.country} NO cumple el esquema:`);
    for (const e of errors) console.error('  -', e);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${schema.metadata.country}.json`);
  await writeFile(file, JSON.stringify(schema, null, 2) + '\n', 'utf8');

  console.log(`✓ ${schema.metadata.country}: ${schema.rules.length} regla(s) → ${path.relative(process.cwd(), file)}`);
  if (schema.warnings.length > 0) {
    console.warn(`⚠ ${schema.warnings.length} warning(s) de parseo incluidos en el JSON:`);
    for (const w of schema.warnings) console.warn('  -', w);
  }
}

main().catch((err) => {
  console.error('Error exportando el conocimiento:', err.message);
  process.exit(1);
});
