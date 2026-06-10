/**
 * Tests del sistema de extracción agnóstica de fuentes legales:
 * configuración declarativa (Zod) + LegalExtractor con fetch inyectado (sin red).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  LegalSourcesConfigSchema,
  loadLegalSourcesConfig,
  resolveFuente,
} from '../src/lib/legal/extraction/sourcesConfig.js';
import { LegalExtractor } from '../src/lib/legal/extraction/LegalExtractor.js';

/** Configuración mínima válida reutilizada por los tests. */
const CFG = {
  MX: {
    baseUrl: 'https://leyes.example.mx',
    selector: 'main',
    fuentes: [
      { clave: 'LISR_HTML', path: '/lisr', selector: '#texto-ley', tipo: 'LEY', oficial: true },
      { clave: 'CRITERIOS', path: 'https://otro-dominio.example/criterios', tipo: 'CRITERIO', oficial: true },
    ],
  },
  CO: {
    baseUrl: 'https://normas.example.co',
    fuentes: [{ clave: 'ESTATUTO', path: '/estatuto', selector: 'article', oficial: false }],
  },
};

/** Fabrica un fetch falso que responde siempre lo mismo. */
function fetchStub(body, { status = 200, contentType = 'text/html; charset=utf-8' } = {}) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  });
}

const HTML_FIXTURE = `
<html><body>
  <nav>menú que NO debe extraerse</nav>
  <div id="texto-ley">
    <h1>Artículo 27</h1>
    <p>Las deducciones autorizadas deberán   cumplir requisitos.</p>
  </div>
  <footer>pie de página</footer>
</body></html>`;

describe('LegalSourcesConfigSchema', () => {
  test('acepta una configuración válida', () => {
    assert.doesNotThrow(() => LegalSourcesConfigSchema.parse(CFG));
  });

  test('rechaza baseUrl que no es URL', () => {
    const bad = { MX: { ...CFG.MX, baseUrl: 'no-es-url' } };
    assert.throws(() => LegalSourcesConfigSchema.parse(bad));
  });

  test('rechaza claves de país que no son ISO-2 en mayúsculas', () => {
    const bad = { mx: CFG.MX };
    assert.throws(() => LegalSourcesConfigSchema.parse(bad));
  });

  test('rechaza una fuente sin selector cuando el país no define default', () => {
    const bad = {
      CO: { baseUrl: 'https://x.example', fuentes: [{ clave: 'A', path: '/a' }] },
    };
    assert.throws(() => LegalSourcesConfigSchema.parse(bad), /selector/);
  });

  test('loadLegalSourcesConfig falla con mensaje claro si el archivo no existe', async () => {
    await assert.rejects(() => loadLegalSourcesConfig('/ruta/inexistente.json'), /LEGAL_SOURCES_CONFIG_PATH/);
  });

  test('la configuración real del repo es válida', async () => {
    const cfg = await loadLegalSourcesConfig();
    assert.ok(Object.keys(cfg).length >= 1);
  });
});

describe('resolveFuente', () => {
  test('resuelve path relativo contra baseUrl', () => {
    const { url, selector } = resolveFuente(CFG, 'mx', 'LISR_HTML');
    assert.equal(url, 'https://leyes.example.mx/lisr');
    assert.equal(selector, '#texto-ley');
  });

  test('respeta paths absolutos de otro dominio y hereda el selector del país', () => {
    const { url, selector } = resolveFuente(CFG, 'MX', 'CRITERIOS');
    assert.equal(url, 'https://otro-dominio.example/criterios');
    assert.equal(selector, 'main'); // default del país
  });

  test('país no configurado lanza error con los disponibles', () => {
    assert.throws(() => resolveFuente(CFG, 'BR', 'X'), /BR/);
  });

  test('clave inexistente lanza error listando las fuentes del país', () => {
    assert.throws(() => resolveFuente(CFG, 'MX', 'NO_EXISTE'), /LISR_HTML/);
  });
});

describe('LegalExtractor', () => {
  test('extrae el texto del selector y normaliza espacios', async () => {
    const ex = new LegalExtractor({ config: CFG, fetchFn: fetchStub(HTML_FIXTURE) });
    const r = await ex.extract('MX', 'LISR_HTML');

    assert.equal(r.ok, true);
    assert.equal(r.pais, 'MX');
    assert.match(r.content, /Artículo 27/);
    assert.match(r.content, /deberán cumplir requisitos/); // espacios colapsados
    assert.ok(!r.content.includes('menú'), 'no debe extraer fuera del selector');
    assert.equal(r.warnings.length, 0);
  });

  test('selector sin coincidencias → ok:false con warning accionable', async () => {
    const ex = new LegalExtractor({ config: CFG, fetchFn: fetchStub('<html><body><p>x</p></body></html>') });
    const r = await ex.extract('MX', 'LISR_HTML');

    assert.equal(r.ok, false);
    assert.equal(r.content, null);
    assert.match(r.warnings[0], /legal-sources\.json/);
  });

  test('content-type no HTML (PDF) → incidencia explícita, no excepción', async () => {
    const ex = new LegalExtractor({
      config: CFG,
      fetchFn: fetchStub('%PDF-1.7', { contentType: 'application/pdf' }),
    });
    const r = await ex.extract('MX', 'LISR_HTML');

    assert.equal(r.ok, false);
    assert.match(r.warnings[0], /no HTML/);
  });

  test('HTTP no-2xx → ok:false con el status en el warning', async () => {
    const ex = new LegalExtractor({ config: CFG, fetchFn: fetchStub('', { status: 404 }) });
    const r = await ex.extract('MX', 'LISR_HTML');

    assert.equal(r.ok, false);
    assert.match(r.warnings[0], /HTTP 404/);
  });

  test('fallo de red → ok:false, sin lanzar', async () => {
    const ex = new LegalExtractor({
      config: CFG,
      fetchFn: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    const r = await ex.extract('MX', 'LISR_HTML');

    assert.equal(r.ok, false);
    assert.match(r.warnings[0], /ECONNREFUSED/);
  });

  test('marca las fuentes de consulta como no oficiales', async () => {
    const ex = new LegalExtractor({
      config: CFG,
      fetchFn: fetchStub('<article>Estatuto</article>'),
    });
    const r = await ex.extract('CO', 'ESTATUTO');

    assert.equal(r.ok, true);
    assert.equal(r.oficial, false);
  });

  test('extractAll recorre todas las fuentes del país', async () => {
    const ex = new LegalExtractor({ config: CFG, fetchFn: fetchStub(HTML_FIXTURE) });
    const rs = await ex.extractAll('MX');

    assert.equal(rs.length, 2);
    assert.deepEqual(
      rs.map((r) => r.clave),
      ['LISR_HTML', 'CRITERIOS']
    );
  });

  test('el extractor es agnóstico: país nuevo = solo configuración, cero código', async () => {
    const cfgConPaisNuevo = {
      ...CFG,
      PE: {
        baseUrl: 'https://sunat.example.pe',
        selector: '.contenido-legal',
        fuentes: [{ clave: 'IGV', path: '/igv', tipo: 'LEY' }],
      },
    };
    const ex = new LegalExtractor({
      config: cfgConPaisNuevo,
      fetchFn: fetchStub('<div class="contenido-legal">Ley del IGV</div>'),
    });
    const r = await ex.extract('PE', 'IGV');

    assert.equal(r.ok, true);
    assert.equal(r.content, 'Ley del IGV');
  });
});
