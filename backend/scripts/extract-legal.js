/**
 * CLI de extracción de fuentes legales dirigida por configuración.
 *
 * Lee `backend/config/legal-sources.json` (baseUrl + selector CSS por país/fuente),
 * extrae el texto de los portales y lo escribe en `out/extraction/<ISO>/<CLAVE>.txt`
 * listo para la curaduría (skill /pre-curator).
 *
 * Uso:
 *   node scripts/extract-legal.js MX               # todas las fuentes de MX
 *   node scripts/extract-legal.js MX DOF_NOTA      # una fuente concreta
 *   node scripts/extract-legal.js --list           # países y fuentes configurados
 *
 * Exit codes: 0 = todo extraído; 1 = alguna fuente falló (red/selector/no-HTML).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LegalExtractor } from '../src/lib/legal/extraction/LegalExtractor.js';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => paint('31', s);
const green = (s) => paint('32', s);
const yellow = (s) => paint('33', s);
const bold = (s) => paint('1', s);
const dim = (s) => paint('2', s);

const OUT_DIR = path.resolve(process.cwd(), 'out/extraction');

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('-'));
  const [iso, clave] = args.filter((a) => !a.startsWith('-'));

  const extractor = await LegalExtractor.fromConfigFile();

  if (flags.includes('--list') || !iso) {
    console.log(bold('🌐 Fuentes legales configuradas') + dim(' (backend/config/legal-sources.json)'));
    for (const pais of extractor.getCountries()) {
      console.log('\n' + bold('▸ ' + pais));
      for (const f of extractor.listSources(pais)) {
        const badge = f.oficial === false ? yellow('[consulta]') : green('[oficial]');
        console.log(`  ${badge} ${f.clave} ${dim('→ selector: ' + (f.selector ?? '(default del país)'))}`);
      }
    }
    if (!iso) console.log('\n' + dim('Uso: node scripts/extract-legal.js <ISO-2> [CLAVE]'));
    process.exit(0);
  }

  const results = clave ? [await extractor.extract(iso, clave)] : await extractor.extractAll(iso);

  let fallos = 0;
  for (const r of results) {
    console.log('\n' + bold(`▸ ${r.pais}/${r.clave}`) + dim(`  ${r.url}`));
    if (r.ok) {
      const dir = path.join(OUT_DIR, r.pais);
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${r.clave}.txt`);
      const header =
        `# Extraído por extract-legal.js\n# url: ${r.url}\n# selector: ${r.selector}\n` +
        `# oficial: ${r.oficial}\n# fetchedAt: ${r.fetchedAt}\n\n`;
      await writeFile(file, header + r.content, 'utf8');
      console.log('  ' + green('✓') + ` ${r.content.length} caracteres → ${path.relative(process.cwd(), file)}`);
    } else {
      fallos += 1;
      console.log('  ' + red('✗ sin contenido:'));
      for (const w of r.warnings) console.log('    ' + red('•') + ' ' + yellow(w));
    }
  }

  console.log('');
  if (fallos === 0) {
    console.log(green(bold('✓ Extracción completa')) + dim(` (${results.length} fuente(s))`));
  } else {
    console.log(red(bold('✗ Extracción con fallos')) + ` — ${fallos}/${results.length} fuente(s) sin contenido.`);
  }
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(red('Error ejecutando la extracción:'), err.message);
  process.exit(1);
});
