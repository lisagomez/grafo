/**
 * CLI de auditoría de la BÓVEDA de conocimiento (`./knowledge-base/`).
 *
 * Gate de CI/CD que distingue dos clases de incidencia (no usa el modo `strict`
 * de `loadCountryRules`; clasifica él mismo para ser "inteligente"):
 *
 *   - **Errores de formato** (notas mal formadas: sin id, sin pseudocódigo, aristas
 *     con veredicto null, etc.) → **BLOQUEO**, `exit 1`. La bóveda tiene basura.
 *   - **País vacío** (sin reglas curadas todavía) → **warning informativo**, `exit 0`.
 *     No es un defecto, solo trabajo pendiente; no debe frenar el despliegue.
 *
 * La distinción es estructural: `count === 0` ⇒ no hay notas (vacío); `count > 0`
 * con warnings ⇒ hay notas y están mal formadas (bloqueo).
 *
 * Auto-selecciona los países:
 *   - Sin argumentos → jurisdicciones REGISTRADAS en la factory (providers).
 *   - Con argumentos → solo esos ISO (p. ej. para revisar un scaffold como CO).
 *
 * Uso:
 *   node scripts/audit-vault.js            # países con provider registrado
 *   node scripts/audit-vault.js MX CO      # lista explícita
 */

import { loadCountryRules } from '../src/lib/knowledge-engine.js';
import { getSupportedCountries } from '../src/lib/legal/sources/index.js';

// --- colores (ANSI, sin dependencias; respeta NO_COLOR y no-TTY) ---
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => paint('31', s);
const green = (s) => paint('32', s);
const yellow = (s) => paint('33', s);
const cyan = (s) => paint('36', s);
const bold = (s) => paint('1', s);
const dim = (s) => paint('2', s);

/**
 * Audita un país y lo clasifica.
 * @param {string} iso
 * @returns {Promise<{iso:string, status:'ok'|'empty'|'block'|'error', count:number, issues:string[]}>}
 */
async function auditarPais(iso) {
  let set;
  try {
    set = await loadCountryRules(iso); // sin strict: clasificamos abajo
  } catch (err) {
    // País inexistente en la bóveda o ISO inválido: error duro → bloquea.
    return { iso, status: 'error', count: 0, issues: [err.message] };
  }

  // count === 0 ⇒ no hay notas curadas ⇒ país vacío (permitido).
  if (set.count === 0) {
    return { iso, status: 'empty', count: 0, issues: set.warnings };
  }

  // Hay notas; cualquier warning aquí es un error de formato/sintaxis ⇒ bloquea.
  if (set.warnings.length > 0) {
    return { iso, status: 'block', count: set.count, issues: set.warnings };
  }

  return { iso, status: 'ok', count: set.count, issues: [] };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const paises = (args.length > 0 ? args : getSupportedCountries()).map((p) => p.toUpperCase());

  console.log(bold('🔒 Auditoría de la bóveda') + dim(`  ·  países: ${paises.join(', ') || '(ninguno)'}`));

  let bloqueos = 0;
  let vacios = 0;

  for (const iso of paises) {
    const res = await auditarPais(iso);
    console.log('\n' + bold('▸ ' + res.iso));

    switch (res.status) {
      case 'ok':
        console.log('  ' + green('✓ OK') + dim(` (${res.count} regla(s), sin incidencias)`));
        break;
      case 'empty':
        vacios += 1;
        console.log('  ' + cyan('ℹ vacío') + dim(' — 0 reglas curadas; despliegue permitido.'));
        for (const i of res.issues) console.log('    ' + dim('· ' + i));
        break;
      case 'block':
        bloqueos += 1;
        console.log('  ' + red(`✗ ${res.issues.length} error(es) de formato:`));
        for (const i of res.issues) console.log('    ' + red('•') + ' ' + yellow(i));
        break;
      case 'error':
        bloqueos += 1;
        console.log('  ' + red('✗ error:'));
        for (const i of res.issues) console.log('    ' + red('•') + ' ' + yellow(i));
        break;
    }
  }

  console.log('');
  if (bloqueos === 0) {
    const nota = vacios > 0 ? ` (${vacios} país(es) vacío(s), permitido(s))` : '';
    console.log(green(bold('✓ Bóveda apta para despliegue')) + dim(nota));
  } else {
    console.log(red(bold('✗ Auditoría de bóveda FALLÓ')) + ` — ${bloqueos} país(es) con errores de formato.`);
  }

  process.exit(bloqueos === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(red('Error ejecutando la auditoría de bóveda:'), err);
  process.exit(1);
});
