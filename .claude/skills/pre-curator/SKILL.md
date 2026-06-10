---
name: pre-curator
description: |
  Pre-curación de texto legal bruto: toma un documento legal crudo (reforma, decreto, artículo,
  miscelánea fiscal) y lo formatea automáticamente como notas de la bóveda siguiendo el
  CURATION_PROMPT probado del knowledge-engine, generando además un Manifiesto de Cambio con
  "Riesgo Legal Estimado" que marca con bandera roja (🚩) todo cambio que afecte un cálculo de
  impuestos, para dirigir la revisión humana (HITL). NO sincroniza con el grafo ni el código:
  produce borradores `estado: pre-curado` que un humano valida antes de /sync-country-knowledge.
  Activar cuando el usuario dice: pre-cura, pre-curator, /pre-curator, procesa este texto legal,
  formatea esta reforma/decreto/ley, curación previa, manifiesto de cambio, pre-curación.
argument-hint: "<ISO-2> <ruta-al-texto-legal | texto pegado | URL>  (p. ej. MX ./tmp/reforma-isr-2026.txt)"
user-invocable: true
model: sonnet
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, WebFetch
license: MIT
---

# Skill: /pre-curator

> Pre-curación automática de texto legal bruto → borradores de notas de la bóveda + **Manifiesto de Cambio** con **Riesgo Legal Estimado**. País y fuente: `$ARGUMENTS`.

## Propósito

Acelerar la fase mecánica de la curaduría sin saltarse el HITL: el agente hace el formateo
(extracción de entidades, relaciones, Pseudocódigo de Grafo) y el análisis de impacto; el
humano conserva la decisión. La salida son **borradores** (`estado: pre-curado`) más un
manifiesto que dice exactamente **dónde poner el ojo** en la revisión.

**Qué NO hace este skill** (frontera dura):
- No toca seed, Neo4j, `BUSINESS_LOGIC.md` ni código. Eso es de `/sync-country-knowledge`, **después** de la validación humana.
- No marca nada como validado. Sin validación humana no hay regla confiable (mismo principio que el gate 409 de export).

## Proceso

### 0. Preflight (obligatorio)
- Lee [`.claude/memory/BUSINESS_LOGIC.md`](../../memory/BUSINESS_LOGIC.md) — sin esto, no escribas reglas.
- Lee [`references/rules.md`](references/rules.md) — los criterios del **vault-gate** que toda nota debe cumplir **desde que se cura**, no después.
- Resuelve `<ISO-2>` desde `$ARGUMENTS` (mayúsculas). Si falta, pregunta — no asumas país.
- Obtén el texto legal bruto: ruta de archivo (`Read`), texto pegado en la conversación, o URL (`WebFetch`). Registra la fuente oficial (`fuente_url`) — si la fuente no es oficial/verificable, dilo en el manifiesto.
- Asegura que existan `./knowledge-base/countries/<ISO-2>/deducciones/` y `./knowledge-base/countries/<ISO-2>/manifiestos/`.

### 1. Curaduría automática (prompt probado)

Actúa como un experto en arquitectura fiscal y grafos de conocimiento. Tu tarea es procesar
documentos legales crudos y transformarlos en Reglas de Grafo de Conocimiento para el sistema
fiscal. Sigue este proceso riguroso:

**Extracción de Entidades:** Identifica los sujetos (contribuyente, autoridad), los objetos
(gasto, factura, deducción) y los eventos (fecha, monto, actividad).

**Definición de Relaciones:** Define las reglas de deducibilidad como relaciones lógicas:

```
(Gasto) -[ES_DEDUCIBLE_SI]-> (Cumple_Requisito)
(Gasto) -[NO_ES_DEDUCIBLE_SI]-> (Incumple_Requisito)
```

**Estructuración:** Genera un archivo en formato Markdown dentro de
`./knowledge-base/countries/{ISO}/deducciones/` que siga este esquema:

- **Frontmatter (metadatos):** bloque YAML al inicio con:
  - `id` — UUID estable (identidad de la regla; nunca el nombre de archivo).
  - `clave` — concepto de gasto del catálogo controlado (p. ej. `VIATICOS`).
  - `regimen` — **infiere y asigna el régimen fiscal** al que aplica la regla (p. ej. `PM_TITULO_II`).
    Si aplica a varios, usa `regimenes: [REG_A, REG_B]`. **Obligatorio**: el motor empareja las
    consultas por régimen; una regla sin régimen es inerte (nunca se aplica).
  - `vigente_desde` / `vigente_hasta` — vigencia (`null` = vigente).
  - `fuente_url` — URL de la fuente oficial.
  - `source_version` — versión de la base de conocimiento citada en el dictamen.
- **Contexto Legal:** Referencia al artículo o ley oficial.
- **Regla Lógica:** Explicación en lenguaje natural.
- **Pseudocódigo de Grafo:** La estructura que el motor debe seguir para validar el gasto.

**Verificación de Integridad:** Antes de guardar, asegúrate de que la regla no contradiga las
reglas ya existentes en `global/`.

**Formato:** Todo debe ser legible para un humano (el contador) y para una máquina (el motor de grafos).

**Formato Estricto:** Al generar el Pseudocódigo de Grafo, usa SIEMPRE la sintaxis
`(Nodo:Etiqueta) -[RELACION]-> (Nodo:Etiqueta)`.
- No uses espacios dentro de los paréntesis o corchetes.
- Usa `ES_DEDUCIBLE_SI` para condiciones positivas.
- Usa `NO_ES_DEDUCIBLE_SI` para condiciones negativas.
- Cualquier línea que no siga este formato exacto debe ser omitida o marcada como error.

> Origen: `CURATION_PROMPT.md` de `/sync-country-knowledge` (copiado aquí por requisito de
> autonomía del skill). Si aquel cambia, sincroniza esta sección.
> Además del prompt, cada nota debe cumplir [`references/rules.md`](references/rules.md)
> (criterios mecánicos del vault-gate) — una nota por regla.

### 2. Identidad y estado del borrador
Antes de escribir cada nota, busca contraparte existente en `deducciones/` del país (empareja por `clave` + régimen, identidad final por `id` UUID):

- **Regla nueva** (sin contraparte): genera `id` UUID nuevo (`uuidgen` o `node -e "console.log(crypto.randomUUID())"`).
- **Regla modificada** (hay contraparte): **conserva el `id` existente** (la identidad es el UUID, nunca el archivo), actualiza `source_version` y vigencias. Una modificación nunca es riesgo 🟢.
- En **todos** los borradores agrega al frontmatter:
  ```yaml
  estado: pre-curado          # pendiente de validación humana — NO sincronizar
  pre_curado_en: <YYYY-MM-DD>
  manifiesto: ../manifiestos/MANIFIESTO-<YYYY-MM-DD>-<slug>.md
  ```

### 3. Manifiesto de Cambio (Riesgo Legal Estimado)
Genera `./knowledge-base/countries/<ISO-2>/manifiestos/MANIFIESTO-<YYYY-MM-DD>-<slug>.md`
usando [`references/MANIFIESTO_TEMPLATE.md`](references/MANIFIESTO_TEMPLATE.md). Clasifica **cada regla** producida:

| Bandera | Criterio (basta con cumplir uno) |
|---|---|
| 🚩 **ROJO — afecta cálculo de impuestos** | Cambia topes, montos, porcentajes, tasas o fórmulas · invierte o altera el veredicto de una regla existente (deducible ↔ no deducible/condicional) · cambia el/los régimen(es) a los que aplica · vigencia retroactiva (`vigente_desde` en el pasado respecto a reglas vivas) · deroga o acota una norma que participa en lineage de dictámenes (`vigente_hasta` deja de ser `null`). |
| 🟡 **AMARILLO — cambia condiciones, no el cálculo directo** | Agrega/quita requisitos (`ES_DEDUCIBLE_SI`/`NO_ES_DEDUCIBLE_SI`) a una regla existente · abre un camino nuevo de deducibilidad · cambia `fuente_url`/`source_version` con texto sustantivo distinto · posible contradicción con `global/` (repórtala, no la resuelvas tú). |
| 🟢 **VERDE — sin impacto en reglas vivas** | Regla nueva sin contraparte previa · cambio editorial o de metadatos sin efecto lógico. |

Reglas del manifiesto:
- Cada 🚩 lleva: regla (`id`, `clave`, archivo), **qué cálculo se ve afectado y cómo** (antes → después), artículo/fuente exacta, y la pregunta concreta que el revisor humano debe responder.
- En caso de duda entre dos niveles, **escala al más alto**. Falsos rojos son baratos; falsos verdes son caros.
- Incluye también: líneas de pseudocódigo descartadas por formato, fuentes no verificables, y cualquier contradicción detectada contra `./knowledge-base/global/` (verificación de integridad del prompt de curaduría).

### 4. Validar y reportar
- Corre el gate de la bóveda desde `backend/`: `npm run audit:vault` — exit **0** obligatorio. Si falla, corrige el formato de los borradores antes de terminar (nunca dejes la bóveda en rojo).
- **No** corras seed, sync ni escribas en `BUSINESS_LOGIC.md`.
- Reporta al usuario: notas creadas/modificadas, ruta del manifiesto y el **resumen de banderas** (cuántos 🚩/🟡/🟢 y cuáles son los rojos), recordando el siguiente paso del pipeline:

```
texto legal bruto → /pre-curator (borradores + manifiesto) → REVISIÓN HUMANA → /sync-country-knowledge <ISO> → npm run audit
```

## Ejemplos

- `/pre-curator MX ./tmp/dof-reforma-isr.txt` → pre-cura la reforma, detecta que cambia el tope de viáticos (🚩), escribe 3 borradores y `MANIFIESTO-2026-06-10-reforma-isr.md`.
- `/pre-curator CO https://www.dian.gov.co/...` → descarga el texto, genera borradores para país scaffold y avisa que CO aún no tiene `LegalSourceProvider`.

## Referencias

- [`references/rules.md`](references/rules.md) — criterios de validación del **vault-gate** (`npm run audit:vault`): lo que el parser del motor exige a cada nota. Respetar **durante** la curaduría.
- [`references/MANIFIESTO_TEMPLATE.md`](references/MANIFIESTO_TEMPLATE.md) — plantilla del Manifiesto de Cambio.
- [`.claude/memory/BUSINESS_LOGIC.md`](../../memory/BUSINESS_LOGIC.md) — lógica fiscal de dominio (lectura obligatoria).
- `backend/src/lib/knowledge-engine.js` — parser real de las notas (frontmatter llano + Pseudocódigo de Grafo); los borradores deben pasar su validación (`npm run audit:vault`).
