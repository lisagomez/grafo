# REPORTE_TEMPLATE — Reporte de Factibilidad de fuentes legales

> Plantilla que `/source-finder` escribe en
> `docs/factibilidad-fuentes/FACTIBILIDAD-<ISO>-<YYYY-MM-DD>.md`.
> Un reporte por jurisdicción investigada; una sección por fuente candidata.

---

```markdown
---
tipo: reporte-de-factibilidad
pais: <ISO-2>
tema: <tema investigado, o "general">
fecha: <YYYY-MM-DD>
generado_por: source-finder
estado: pendiente-confirmacion
---

# Reporte de Factibilidad — <País> (<YYYY-MM-DD>)

## Resumen

| Fuente | Oficial | Dificultad | Apta para selector CSS |
|---|---|---|---|
| <nombre corto> | Sí/No | Baja/Media/Alta | ✓ / ✗ (diferir a Fase 8) |

## Fuente: <URL>

- **Fuente:** <URL exacta evaluada>
- **Carácter:** Oficial (Diario Oficial / portal de gobierno / autoridad fiscal) | Consulta.
- **Dificultad de extracción:** Baja | Media | Alta.
- **Estructura encontrada:** <una frase. Ej: "La web organiza las leyes por año y materia,
  con buscador por número de norma; cada norma tiene URL estable con query params.">
- **Patrón de URL de documento:** <ejemplo real de URL final de un documento>
- **Selector CSS candidato:** `<selector>` — verificado contra el HTML real de <URL ejemplo>.
- **Obstáculos:** <render por JavaScript, PDFs, captcha, paginación, ninguno…>
- **Notas para la extracción:** <encoding, frecuencia de actualización, secciones a evitar…>

## Bloque candidato para legal-sources.json

(Solo fuentes Baja/Media. Las Alta se listan abajo como diferidas.)

​```json
"<ISO>": {
  "baseUrl": "<https://...>",
  "selector": "<default del país>",
  "fuentes": [
    { "clave": "<CLAVE>", "path": "</ruta>", "selector": "<css>", "tipo": "LEY|CODIGO|CRITERIO",
      "oficial": true, "descripcion": "<qué es>" }
  ]
}
​```

## Diferidas a Fase 8 (lector especializado)

- <URL> — <por qué no es viable con selector: PDF escaneado, SPA, captcha…>

## Próximo paso

- [ ] Confirmación humana del bloque JSON.
- [ ] Añadir a `backend/config/legal-sources.json` y validar:
      `npm test` + `npm run extract:legal -- <ISO>` (exit 0).
```

---

## Rúbrica de dificultad

| Nivel | Criterios (basta cumplir uno del nivel más alto aplicable) |
|---|---|
| **Baja** | HTML server-rendered y estático · el texto legal vive en un contenedor con id/clase estable · URLs de documento predecibles · sin login/captcha. |
| **Media** | Hay que navegar índice o buscador para llegar al documento (varias requests) · HTML inconsistente entre documentos · paginación · selectores genéricos (`main`, `article`) sin id propio · encoding problemático. |
| **Alta** | Contenido renderizado por JavaScript (SPA: WebFetch devuelve HTML vacío) · documentos solo en PDF/escaneo · captcha/login/anti-bot · URLs de sesión o POST. **No apta** para el extractor por selector → documentar y diferir a Fase 8 (`autoResearchIngest`). |

Reglas:
- En duda entre dos niveles, **escala al más alto** (mismo principio que el Manifiesto de Cambio).
- El selector candidato debe haberse verificado contra HTML real obtenido con WebFetch,
  nunca propuesto "de memoria".
- Una fuente de consulta (no oficial) nunca sustituye a la oficial: se propone solo como
  respaldo y con `oficial: false`, para que el dictamen la cite como tal.
