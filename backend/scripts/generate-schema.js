/**
 * Genera `docs/knowledge-schema.json` desde la única fuente de verdad en código
 * (`KNOWLEDGE_SCHEMA` en `knowledge-engine.js`). Elimina la duplicidad: el archivo
 * publicado es un artefacto derivado, nunca se edita a mano.
 *
 * Uso: node scripts/generate-schema.js   (npm run generate-schema)
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { KNOWLEDGE_SCHEMA } from '../src/lib/knowledge-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', '..', 'docs', 'knowledge-schema.json');

async function main() {
  await writeFile(OUT, JSON.stringify(KNOWLEDGE_SCHEMA, null, 2) + '\n', 'utf8');
  console.log(`✓ Esquema escrito en ${path.relative(process.cwd(), OUT)} (fuente: KNOWLEDGE_SCHEMA).`);
}

main().catch((err) => {
  console.error('Error generando el esquema:', err);
  process.exit(1);
});
