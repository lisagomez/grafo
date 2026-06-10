---
name: source-finder
description: |
  Reconocimiento de fuentes legales para una jurisdicción: busca el portal legal (oficial
  primero), entiende su estructura de navegación (¿buscador? ¿índice alfabético? ¿árbol de
  leyes por año/materia?) y produce un Reporte de Factibilidad (Fuente / Dificultad de
  extracción Baja-Media-Alta / Estructura encontrada) cuyo único propósito es alimentar
  backend/config/legal-sources.json (baseUrl + selector CSS) para el extractor agnóstico
  (npm run extract:legal). Activar cuando el usuario dice: source-finder, /source-finder,
  busca la fuente legal de <país>, encuentra el portal de leyes, factibilidad de extracción,
  reporte de factibilidad, qué fuente usamos para <país>.
argument-hint: "<ISO-2 | país> [tema, p. ej. impuesto sobre la renta]"
user-invocable: true
allowed-tools: Read, Write, Grep, Glob, Bash, WebSearch, WebFetch
---

# Skill: /source-finder

> Reconocimiento de portales legales → **Reporte de Factibilidad** → entrada candidata para `backend/config/legal-sources.json`. Objetivo: `$ARGUMENTS`.

## Propósito

Único propósito: **alimentar el archivo de configuración de países** del sistema de extracción
agnóstica. Antes de que un país entre a `legal-sources.json`, este skill responde tres
preguntas: ¿cuál es la fuente correcta?, ¿cómo está organizada?, ¿qué tan difícil será
extraerla con un selector CSS?

**Frontera dura:** este skill investiga y reporta; no extrae contenido legal (eso es
`npm run extract:legal`) ni cura reglas (eso es `/pre-curator`). No escribe en
`legal-sources.json` sin confirmación del usuario.

## Proceso

### 0. Preflight
- Resuelve el país (ISO-2) y el tema desde `$ARGUMENTS`. Sin país, pregunta.
- Lee `backend/config/legal-sources.json` — si el país ya tiene fuentes configuradas, dilo
  y enfoca la búsqueda en lo que falta (no dupliques claves).
- Ten presente el contrato que la entrada final debe cumplir:
  `backend/src/lib/legal/extraction/sourcesConfig.js` (Zod: `baseUrl` URL válida, ISO-2 en
  mayúsculas, toda fuente con `selector` propio o default del país).

### Paso A — Buscar la fuente
- `WebSearch`: localiza los portales legales de la jurisdicción para el tema.
- **Prioridad a la fuente** (misma regla que `tone.md` de `/user-communicator`):
  1. Diario/Boletín Oficial y portales de gobierno (`oficial: true`).
  2. Portales de la autoridad fiscal (SAT/DIAN/SUNAT…).
  3. Fuentes de consulta (compilaciones privadas) solo como respaldo, SIEMPRE `oficial: false`.
- Registra 1–3 candidatos por tema. Descarta agregadores sin respaldo institucional.

### Paso B — Entender la estructura
Para cada candidato, `WebFetch` a la portada y a 1–2 páginas de contenido reales. Clasifica:

1. **Modelo de navegación**: ¿buscador (formulario/query params)? ¿índice alfabético?
   ¿árbol por año/materia/tipo de norma? ¿página única con todo el texto?
2. **Cómo se llega a un documento**: patrón de URL (¿estable, con query params predecibles,
   o sesión/POST?). Anota un ejemplo de URL final de documento.
3. **El contenido**: ¿HTML server-rendered o lo pinta JavaScript (SPA)? ¿El texto legal vive
   en un contenedor identificable? Propón el **selector CSS candidato** (ej. `#DivDetalleNota`,
   `main article`) mirando el HTML real que devolvió WebFetch, no suposiciones.
4. **Obstáculos**: PDF/escaneados, captcha, login, paginación agresiva, anti-bot.

> Si WebFetch devuelve HTML casi vacío pero la página "se ve" con contenido en el navegador,
> es señal de render por JavaScript → el selector no servirá con fetch plano (dificultad Alta).

### Paso C — Reporte de Factibilidad
Genera `docs/factibilidad-fuentes/FACTIBILIDAD-<ISO>-<YYYY-MM-DD>.md` usando
[`references/REPORTE_TEMPLATE.md`](references/REPORTE_TEMPLATE.md). Por cada fuente:

- **Fuente:** [URL]
- **Dificultad de extracción:** Baja / Media / Alta (rúbrica en el template; en duda, escala).
- **Estructura encontrada:** descripción en una frase (ej. "La web organiza las leyes por
  año y materia, con buscador por número de norma").

Y al final, el **bloque JSON candidato** para `legal-sources.json` (solo fuentes con
dificultad Baja/Media; las Altas se documentan como diferidas a Fase 8 — lector especializado).

### Paso D — Alimentar la configuración (solo con OK del usuario)
1. Presenta el reporte y el bloque JSON; espera confirmación.
2. Tras el OK: añade la entrada a `backend/config/legal-sources.json`.
3. Valida desde `backend/`:
   - `npm test` (la suite valida la config real del repo contra el esquema Zod).
   - `NO_COLOR=1 npm run extract:legal -- --list` (la entrada aparece).
   - Sonda real opcional: `npm run extract:legal -- <ISO> <CLAVE>` — si el selector no
     coincide, ajústalo y reintenta antes de dar por cerrado (exit 0 obligatorio).
4. Reporta el resultado citando el reporte de factibilidad.

```
/source-finder <país> → Reporte de Factibilidad → OK humano → legal-sources.json
        → npm run extract:legal → /pre-curator → revisión humana → /sync-country-knowledge
```

## Ejemplos

- `/source-finder PE impuesto a la renta` → encuentra SUNAT + El Peruano, clasifica sus
  estructuras, reporta dificultades y propone el bloque `"PE": {...}`.
- `/source-finder CO` → revisa los selectores scaffold de la DIAN ya configurados y valida
  contra el portal real (caso: confirmar configuración existente).

## Referencias

- [`references/REPORTE_TEMPLATE.md`](references/REPORTE_TEMPLATE.md) — plantilla del Reporte de Factibilidad + rúbrica de dificultad.
- `backend/config/legal-sources.json` — el archivo que este skill alimenta.
- `backend/src/lib/legal/extraction/sourcesConfig.js` — contrato Zod que la entrada debe cumplir.
- `backend/scripts/extract-legal.js` — el consumidor final (`npm run extract:legal`).
