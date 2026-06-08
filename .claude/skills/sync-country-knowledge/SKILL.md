---
name: sync-country-knowledge
description: |
  Sincroniza la bóveda de conocimiento de una jurisdicción (./knowledge-base/countries/<ISO-2>/)
  con el grafo legal y el código: lee las notas .md de las reglas fiscales de un país y las
  reconcilia con el seed/Neo4j y BUSINESS_LOGIC.md (sync bidireccional, identidad por `id` UUID,
  política vault-wins). Operacionaliza la Regla de Oro: código y bóveda deben coincidir por país.
  Activar cuando el usuario dice: sincroniza el conocimiento de MX/CO, sync country knowledge,
  /sync-country-knowledge, actualiza las reglas de un país, reconcilia la bóveda con el grafo.
argument-hint: "<ISO-2>  (p. ej. MX | CO; default: DEFAULT_COUNTRY)"
user-invocable: true
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Skill: /sync-country-knowledge

> Sincronizar la bóveda de una jurisdicción con el grafo legal y el código. País objetivo: `$ARGUMENTS` (default: `DEFAULT_COUNTRY`).

Reconcilia las notas `.md` de `./knowledge-base/countries/<ISO-2>/` con el seed del grafo
(Neo4j) y `BUSINESS_LOGIC.md`, en ambos sentidos. No modifica nada sin confirmación.

Flujo del dato: **bóveda (`.md`) → seed JSON → Neo4j → motor de inferencia**. Identidad por
`id` (UUID en frontmatter), nunca por nombre de archivo. Conflicto: **`vault-wins`**.

## Proceso

### 0. Preflight (obligatorio antes de tocar reglas)
- Lee [`.claude/memory/BUSINESS_LOGIC.md`](../../memory/BUSINESS_LOGIC.md) — sin esto, **no** escribas ni ejecutes Cypher/reglas.
- Resuelve el país objetivo: `$ARGUMENTS` en mayúsculas (ISO-2). Si viene vacío, usa `DEFAULT_COUNTRY`.
- Confirma que la jurisdicción tiene **provider registrado** en `backend/src/lib/legal/sources/index.js`.
  Si no (p. ej. `CO` es scaffold): es un país **nuevo** → ve al paso 1b (curaduría) y avisa que el provider aún no existe.
- Localiza la carpeta de la bóveda vía `config.knowledgeBase` (`KNOWLEDGE_BASE_PATH` → `./knowledge-base/countries/<ISO-2>/`). Crea subcarpetas (`deducciones/`) si faltan.

### 1a. Inventario (país ya soportado)
- Lista las notas `.md` del país y parsea su frontmatter (`id`, `clave`, `vigente_desde`/`vigente_hasta`, `fuente_url`, `source_version`).
- Carga la contraparte en código: `backend/seed/normas_titulo_ii.json` (y/o Neo4j si está arriba) + las reglas de `BUSINESS_LOGIC.md` (§1 deducibilidad).

### 1b. Curaduría (país/ley nueva o documento crudo)
- Carga y **sigue** [`references/CURATION_PROMPT.md`](references/CURATION_PROMPT.md): extrae entidades → define relaciones `ES_DEDUCIBLE_SI` / `NO_ES_DEDUCIBLE_SI` → produce la nota Markdown en `./knowledge-base/countries/<ISO-2>/deducciones/` (Contexto Legal + Regla Lógica + Pseudocódigo de Grafo).
- Asigna un `id` (UUID) nuevo a cada nota y su `source_version`.

### 2. Diferencia a tres bandas
Compara **bóveda ↔ seed/grafo ↔ BUSINESS_LOGIC** emparejando por `id` (no por nombre). Clasifica cada regla:
- **Solo en bóveda** → falta materializarla en seed/código.
- **Solo en código** → falta documentarla como nota.
- **Divergente** (tope, condición, vigencia, veredicto o `source_version` distintos) → conflicto a resolver con **`vault-wins`** (la bóveda manda; ajusta el código).

### 3. Verificación de integridad (contra `global/`)
Antes de proponer cualquier escritura, valida que las reglas del país **no contradigan** las de `./knowledge-base/global/` (conceptos/flujos transversales). Si hay choque, **detente y reporta** la contradicción en vez de elegir por tu cuenta — recuerda los anti-patrones del PRP-01.

### 4. Plan y confirmación
Presenta un resumen accionable: qué notas/seed/`BUSINESS_LOGIC.md` cambiarían y por qué. **No escribas sin el OK del usuario.**

### 5. Aplicar (tras confirmación)
- Sincroniza en el sentido que mande `vault-wins`: actualiza notas, seed y `BUSINESS_LOGIC.md` para que coincidan.
- El namespace de país viaja como **parámetro**, nunca concatenado en Cypher. Todo Cypher pasa por `backend/src/lib/graph/cypherService.js`.
- Regla dura: **sin lineage no hay `Deducible`** (path vacío ⇒ `Condicional`).

### 6. Validar y reportar
- Corre `node scripts/audit.js` (gastos huérfanos + consistencia de versiones) — exit **0** = limpio, **1** = incidencias.
- Corre `npm test`.
- Reporta el resultado y confirma que **código y bóveda coinciden** para `<ISO-2>` (Definition of Done). Si algo falla, dilo con la salida; no des por terminado lo que no pasó.

## Referencias

- [`references/CURATION_PROMPT.md`](references/CURATION_PROMPT.md) — Prompt de curaduría experto. **Cárgalo y síguelo** cada vez que el skill deba *"aprender" la ley de un país nuevo*: convierte documentos legales crudos en Reglas de Grafo de Conocimiento (extracción de entidades → relaciones de deducibilidad → archivo Markdown en `./knowledge-base/countries/<ISO-2>/deducciones/` con Contexto Legal + Regla Lógica + Pseudocódigo de Grafo, verificando integridad contra `global/`).

## Contexto del proyecto (leer antes de tocar reglas)

- [`.claude/memory/BUSINESS_LOGIC.md`](../../memory/BUSINESS_LOGIC.md) — **OBLIGATORIO** antes de escribir o ejecutar cualquier Cypher/regla (lógica de deducibilidad, entidades, flujos).
- [`.claude/obsidian_sync.json`](../../obsidian_sync.json) — mapeo bóveda ↔ código: `vaultPath` (`./knowledge-base`), identidad por `id` (UUID), política `vault-wins`, `sourcesOfTruth` por país.
- `backend/src/config/index.js` → `config.knowledgeBase` — raíz de la bóveda resuelta a absoluta (`KNOWLEDGE_BASE_PATH`).
- `backend/src/lib/legal/sources/index.js` — factory de `LegalSourceProvider`; un país sin provider registrado es scaffold (p. ej. `CO`).
