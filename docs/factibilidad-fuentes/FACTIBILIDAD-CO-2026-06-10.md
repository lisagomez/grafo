---
tipo: reporte-de-factibilidad
pais: CO
tema: general (impuestos nacionales / Estatuto Tributario / doctrina DIAN)
fecha: 2026-06-10
generado_por: source-finder
estado: pendiente-confirmacion
---

# Reporte de Factibilidad — Colombia (2026-06-10)

> Motivo: validar los selectores **scaffold** de CO en `legal-sources.json` contra los
> portales reales. Resultado: **ambos selectores scaffold están rotos**; se encontraron
> dos fuentes oficiales mejores. Verificación hecha sobre HTML real descargado (no supuestos).

## Resumen

| Fuente | Oficial | Dificultad | Apta para selector CSS |
|---|---|---|---|
| Secretaría del Senado (Estatuto Tributario) | Sí | Media | ✓ |
| Normograma DIAN (doctrina/resoluciones) | Sí | Baja | ✓ |
| SUIN-Juriscol (MinJusticia) | Sí | Alta | ✗ (diferir a Fase 8: TLS roto) |
| dian.gov.co/normatividad (scaffold actual) | Sí | Alta | ✗ (SharePoint + documentos en PDF) |
| estatuto.co (scaffold actual) | No | Alta | ✗ (Cloudflare challenge anti-bot; verificado en sonda real) |

## Fuente: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario.html

- **Fuente:** http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario.html
- **Carácter:** Oficial (Senado de la República — "Leyes desde 1992, vigencia expresa y control de constitucionalidad").
- **Dificultad de extracción:** **Media**.
- **Estructura encontrada:** La web publica el Estatuto Tributario como libro paginado: una
  portada-índice y ~20+ partes con patrón estable `estatuto_tributario_prNNN.html`; incluye
  notas de vigencia por artículo.
- **Patrón de URL de documento:** `…/senado/basedoc/estatuto_tributario_pr001.html` (NNN secuencial).
- **Selector CSS candidato:** `#aj_data` — verificado en el HTML real (contenedor del texto legal).
- **Obstáculos:** paginación (hay que recorrer las partes `prNNN`); **encoding ISO-8859-1**
  (el `fetch` de Node decodifica UTF-8 por defecto ⇒ acentos corruptos; mitigable); sirve por HTTP.
- **Notas para la extracción:** HTML server-rendered estático (sin JavaScript); el contenedor
  `#aj_data` aparece duplicado en el DOM (cheerio concatena ambos, inocuo).

## Fuente: https://normograma.dian.gov.co/dian/compilacion/docs/

- **Fuente:** https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0227_2025.htm (ejemplo verificado)
- **Carácter:** Oficial (Compilación Jurídica de la DIAN: resoluciones, conceptos, doctrina).
- **Dificultad de extracción:** **Baja**.
- **Estructura encontrada:** La web organiza la normatividad compilada por tipo de norma,
  número y año, con URLs de documento totalmente predecibles.
- **Patrón de URL de documento:** `…/docs/<tipo>_dian_<numero>_<año>.htm` (p. ej. `resolucion_dian_0227_2025.htm`).
- **Selector CSS candidato:** `main.contenido` — verificado en el HTML real (único `main`, clase estable).
- **Obstáculos:** documentos grandes (el ejemplo pesa ~3 MB); ninguno estructural.
- **Notas para la extracción:** server-rendered, UTF-8, ideal como primera fuente CO.

## Fuente: https://www.suin-juriscol.gov.co/viewDocument.asp?id=1132325

- **Fuente:** https://www.suin-juriscol.gov.co/viewDocument.asp?id=1132325 (Decreto 624/1989 — Estatuto Tributario)
- **Carácter:** Oficial (Sistema Único de Información Normativa, Ministerio de Justicia).
- **Dificultad de extracción:** **Alta** (hoy).
- **Estructura encontrada:** Buscador + documentos por id numérico en query param; el documento
  completo viene en una sola página (16 MB) con contenedores limpios (`div.articulo_normal`, `div.division`).
- **Obstáculos:** **certificado TLS inválido** (curl falla con exit 60 sin `-k`; el `fetch` del
  extractor fallará igual — deshabilitar la verificación TLS no es aceptable) + tamaño extremo.
- **Notas:** estructuralmente sería Baja; se difiere SOLO por el TLS. Revisar periódicamente si
  arreglan el certificado.

## Scaffolds actuales (verificados ROTOS)

- `DIAN_NORMATIVIDAD` → `https://www.dian.gov.co/normatividad/Paginas/default.aspx`, selector `#contenido`:
  el portal es **SharePoint** (clases `ms-*`); **no existe** ningún `#contenido` en el HTML real, y los
  documentos finales son **PDF** → dificultad Alta. **Reemplazar por el normograma.**
- `ESTATUTO_TRIBUTARIO` → `https://estatuto.co/`, selector `article`: **no existe** ningún `<article>`
  en el HTML real (constructor Oxygen; el contenedor es `main#main`). Además, en la sonda real
  (2026-06-10) el sitio respondió **403 con `cf-mitigated: challenge`** (Cloudflare anti-bot por
  fingerprint TLS): bloquea el `fetch` de Node aunque acepte curl. **Descartada** — saltarse un
  challenge anti-bot no es un camino aceptable, y siendo fuente de consulta no oficial, las dos
  fuentes oficiales la hacen innecesaria.

## Bloque candidato para legal-sources.json

```json
"CO": {
  "baseUrl": "https://normograma.dian.gov.co",
  "selector": "main.contenido",
  "fuentes": [
    {
      "clave": "DIAN_NORMOGRAMA",
      "path": "/dian/compilacion/docs/resolucion_dian_0227_2025.htm",
      "tipo": "CRITERIO",
      "oficial": true,
      "descripcion": "Compilación Jurídica DIAN; URL patrón docs/<tipo>_dian_<num>_<año>.htm — sustituir el path por el documento objetivo"
    },
    {
      "clave": "ET_SENADO",
      "path": "http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario.html",
      "selector": "#aj_data",
      "tipo": "LEY",
      "oficial": true,
      "descripcion": "Estatuto Tributario con vigencia expresa (Senado); paginado en estatuto_tributario_prNNN.html; encoding ISO-8859-1"
    }
  ]
}
```

> **Aplicado el 2026-06-10** con sonda real en verde (2/2 fuentes, exit 0). El bloque original
> incluía estatuto.co como respaldo; se retiró tras detectar el challenge de Cloudflare.

## Diferidas a Fase 8 (lector especializado)

- https://www.suin-juriscol.gov.co — certificado TLS inválido (estructura limpia; reevaluar si lo arreglan).
- https://www.dian.gov.co/normatividad — resoluciones recientes solo en PDF (`/normatividad/Normatividad/*.pdf`).
- https://estatuto.co — Cloudflare challenge anti-bot (no oficial; innecesaria teniendo ET_SENADO).

## Próximo paso

- [ ] Confirmación humana del bloque JSON (reemplaza por completo la entrada `CO` scaffold).
- [ ] Añadir a `backend/config/legal-sources.json` y validar:
      `npm test` + `NO_COLOR=1 npm run extract:legal -- CO` (exit 0).
