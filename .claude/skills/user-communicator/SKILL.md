---
name: user-communicator
description: |
  Capa final de comunicación: se activa SIEMPRE que el sistema necesita entregar un reporte
  al usuario (cierre de bucle-agentico, resultados de auditoría, manifiestos, resúmenes de
  fase, hallazgos de investigación). Toma el reporte técnico crudo y lo "traduce" según el
  tono definido en references/tone.md antes de que el usuario lo vea. No altera los hechos:
  solo la forma. Activar cuando: hay que reportar al usuario el resultado de un trabajo,
  traducir un reporte técnico, comunicar hallazgos, o el usuario dice /user-communicator,
  traduce este reporte, hazlo legible, explícamelo en mi tono.
argument-hint: "<reporte o ruta al reporte a traducir>  (opcional; por defecto, el reporte en curso)"
user-invocable: true
allowed-tools: Read, Write, Glob, Grep
---

# Skill: /user-communicator

> Traductor de reportes técnicos → comunicación en el tono del usuario. Entrada: `$ARGUMENTS` (o el reporte que el flujo actual está por entregar).

## Propósito

Ningún reporte llega crudo al usuario. Esta skill es la **última milla** de cualquier flujo
que produzca un resultado (bucle-agentico, auditorías, pre-curaduría, investigación): toma
el contenido técnico y lo reescribe siguiendo el contrato de tono de
[`references/tone.md`](references/tone.md), sin perder ni distorsionar información.

## Cuándo se activa

1. **Encadenada (automática)**: al final del `bucle-agentico` — cuando el Agente Investigador
   termina (mapeo + ejecución de fases), el Agente de Síntesis invoca esta skill para traducir
   el reporte final ANTES de mostrarlo (PASO 5 del bucle).
2. **Cualquier reporte al usuario**: resultados de `npm run audit` / `audit:vault`, manifiestos
   de `/pre-curator`, hallazgos de exploración, cierres de fase de PRP.
3. **Manual**: `/user-communicator <texto o ruta>`.

## Proceso

### 1. Cargar el contrato de tono
Lee [`references/tone.md`](references/tone.md) **completo** antes de escribir una sola línea.
Ese archivo es la fuente única del estilo; esta skill no define tono propio.

### 2. Identificar el reporte fuente
- Si `$ARGUMENTS` trae texto o una ruta, esa es la fuente.
- Si se invoca encadenada, la fuente es el reporte que el flujo estaba a punto de entregar.

### 3. Traducir (reglas duras)
- **Fidelidad fáctica absoluta**: cifras, rutas, comandos, exit codes, banderas de riesgo
  (🚩/🟡/🟢), veredictos (`Deducible`/`Condicional`/`No deducible`) y citas legales pasan
  intactos. Si el reporte dice que algo falló, la traducción dice que falló.
- **No ocultar incidencias**: errores, warnings y pendientes se comunican, nunca se suavizan
  hasta desaparecer. Las banderas rojas del Manifiesto de Cambio van AL PRINCIPIO.
- **Sin jerga interna no explicada**: si un término técnico es imprescindible (lineage, HITL,
  vault-gate), una frase lo aclara la primera vez.
- Aplica todo lo demás según `tone.md` (registro, longitud, estructura, idioma).

### 4. Entregar
Devuelve SOLO el reporte traducido (sin meta-comentarios del proceso de traducción).
Si la traducción omitió secciones por irrelevantes, listarlas en una línea final
("Detalle técnico disponible en: …") en vez de borrarlas en silencio.

## Anti-patrones

- ❌ Inventar optimismo: "todo salió bien" cuando hubo warnings.
- ❌ Resumir tanto que el usuario no pueda decidir (un 🚩 sin su pregunta de revisión es inútil).
- ❌ Cambiar números, comandos o rutas "para que suenen mejor".
- ❌ Saltarse `tone.md` por tener prisa: sin tono cargado, no hay traducción.

## Referencias

- [`references/tone.md`](references/tone.md) — **contrato de tono del usuario** (fuente única del estilo).
