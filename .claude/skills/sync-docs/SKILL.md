---
name: sync-docs
description: |
  Compara los cambios del último commit con los documentos de diseño (PRP y BUSINESS_LOGIC.md),
  identifica discrepancias entre el código real y lo documentado, y pregunta si actualizarlos
  automáticamente. Operacionaliza la Definition of Done: ningún cambio está "terminado" si los
  docs no reflejan el código.
  Activar cuando el usuario dice: sync docs, sincroniza docs, /sync-docs, actualiza la documentación,
  los docs están desactualizados, revisa que el PRP coincida con el código, reflejar cambios en el diseño.
argument-hint: "[<commit-ref> | --range=A..B]  (default: HEAD)"
user-invocable: true
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Skill: /sync-docs

> Sincronizar documentos de diseño con la realidad del código. Objetivo: `$ARGUMENTS` (default: último commit, `HEAD`).

Compara lo que cambió en el código contra el **PRP** y **`BUSINESS_LOGIC.md`**, lista las discrepancias y
**pregunta** antes de actualizar. No modifica docs sin confirmación.

## Proceso

### Paso 1 — Determinar el alcance del diff
- Por defecto, el **último commit**: `git show --stat HEAD` y `git show HEAD`.
- Si `$ARGUMENTS` trae un ref o `--range=A..B`, usar ese: `git diff --stat <ref>` / `git diff <range>`.
- Quédate con los **archivos de código** cambiados (ignora cambios que sean solo de docs).

### Paso 2 — Localizar los documentos de diseño
- **BUSINESS_LOGIC:** `.claude/memory/BUSINESS_LOGIC.md` (o `BUSINESS_LOGIC.md` en la raíz si existe).
- **PRP / blueprint:** el `.md` en `.claude/PRPs/` (p. ej. `PRP-01-Cimientos-Motor.md`); si hay varios,
  el que corresponda al área tocada. Usa Glob `\.claude/PRPs/*.md` para descubrirlos.
- Si no encuentras alguno, repórtalo (no inventes su contenido).

### Paso 3 — Detectar discrepancias (código ↔ docs)
Para cada cambio relevante del diff, verifica si el doc lo refleja. Señales de discrepancia:
- **Métodos/funciones/clases** nuevos, renombrados o eliminados que el doc aún nombra con el valor viejo.
- **Modelos de datos** (Prisma/schema, nodos/relaciones del grafo) nuevos o modificados no documentados.
- **Fases del PRP** completadas/avanzadas que siguen marcadas como pendientes (o viceversa).
- **Reglas de negocio, entidades, flujos o KPIs** que cambiaron el valor entregado al usuario → deben ir a
  `BUSINESS_LOGIC.md`.
- **Deuda técnica / decisiones** nuevas no registradas.
- **Comandos/scripts** nuevos no documentados.

Construye una **lista de discrepancias** concreta: `[doc] dice "X" → el código ahora hace "Y"` o
`código añadió "Z" no documentado en [doc]`. Cita archivo y línea cuando puedas. **No inventes**: si el doc
ya está alineado, dilo (no fuerces cambios).

### Paso 4 — Presentar y PREGUNTAR
Muestra la lista de discrepancias agrupada por documento. Luego usa **AskUserQuestion** para preguntar si
deseas actualizar los documentos automáticamente:
- Opción **Actualizar ambos** (PRP + BUSINESS_LOGIC).
- Opción **Solo PRP** / **Solo BUSINESS_LOGIC**.
- Opción **No actualizar** (solo reportar).

Si no hay discrepancias → reportar `✅ Docs sincronizados` y terminar (no preguntar).

### Paso 5 — Aplicar (solo si el usuario confirma)
- Edita **únicamente** lo necesario para reflejar la realidad del código (ediciones quirúrgicas; preserva la
  estructura y el tono del doc).
- No reescribas secciones enteras si basta un ajuste puntual.
- Tras editar, muestra un resumen de qué cambió en cada doc.

## Reglas
- **Pregunta siempre antes de editar** (Paso 4). Esta skill nunca actualiza docs sin confirmación.
- **Exactitud sobre cantidad**: solo discrepancias reales y verificables; nada inventado.
- **No tocar código** — esta skill solo sincroniza documentación con el código existente.
- Es la herramienta para cumplir la **Definition of Done**: una tarea no está "terminada" si los docs no
  reflejan el código. Correr `/sync-docs` antes de dar por cerrada una tarea o antes de un commit.
