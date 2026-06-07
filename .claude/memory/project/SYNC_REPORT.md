# Reporte de Sincronización Código ↔ Docs Maestros

> **Fecha:** 2026-06-07 · **Alcance:** `BUSINESS_LOGIC.md` + `PRP-01-Cimientos-Motor.md` vs. `backend/src/` y frontend.
> **Método:** inspección real del árbol de archivos + rutas registradas, contra lo que describen los docs.
> **Acción:** solo reporte. NO se corrigió nada (pendiente de tu OK).

## Veredicto

El núcleo (grafo + motor + auditor) **sí está documentado y coherente**. Las brechas reales son **3**:
1. Código **scaffold genérico** (workspaces/teams/billing) presente pero **ausente/contradictorio** en los docs de dominio.
2. El PRP nombra un script (`diagnose-contradictions.js`) cuya función **se fusionó** en el `GraphAuditor`.
3. La estructura **NO es Feature-First** — divergencia **deliberada y documentada**, pero no declarada explícitamente como tal.

El resto de "doc sin código" son fases futuras del roadmap (Fase 2–8), correctamente marcadas como pendientes → **no son brechas**.

---

## 1. Análisis de Discrepancias

| Área | Doc dice | Código real | ¿Brecha? |
|---|---|---|---|
| Grafo/motor/auditor | `lib/graph/*`, `services/GraphAuditor`, `lib/legal/sources/*` | Existen y coinciden | ✅ Coherente |
| Rutas de dominio | `routes/{clientes,dictamen,grafo}.js` (Fase 3/5) | **No existen** (fases pendientes) | 🟡 Esperado (roadmap) |
| Rutas reales registradas | — (no documentadas) | `auth, billing, workspaces, teams, permissions` (scaffold) | 🟥 **Brecha** |
| Modo Contradicción | `scripts/diagnose-contradictions.js` (Fase 3) | Fusionado en `GraphAuditor.validarConsistenciaVersiones` (`VIVA_DEROGADA`) | 🟥 **Brecha** |
| Context Resolver | `lib/graph/contextResolver.js` (Fase 3) | **No existe** (Fase 3 "parcial") | 🟡 Esperado |
| Frontend dominio | `consulta`, `dictamen/[id]` (Fase 5) | Solo scaffold (`app/auth`, `app/dashboard/{workspaces,teams,billing}`) | 🟡 Esperado + 🟥 scaffold sin doc |
| Arquitectura | "Golden Path" genérico = Feature-First | Layer-based (`lib/`, `services/`, `routes/`) | 🟥 **Brecha de declaración** |

---

## 2. Identificación de Brechas

### A) Código que existe pero NO está en los docs (drift)
- **Rutas scaffold de SaaS Factory** activas en `index.js`: `auth` (en memoria), `billing` (Stripe), `workspaces`, `teams`, `permissions`. Los docs de dominio hablan de **despacho fiscal** (`clientes`/cartera, `dictamen`, `consulta`) — **no** de workspaces/teams/Stripe. Estas rutas:
  - No están descritas en BUSINESS_LOGIC ni en el PRP.
  - **Contradicen** parcialmente el modelo (genérico multi-tenant vs. despacho contable).
- **Frontend scaffold**: `app/dashboard/{workspaces,teams,billing}` y `app/auth/*` — genéricos, sin relación con consulta/dictamen.
- Menor: `lib/graph/seedValidator.js` y `tests/fixtures/fiscal_data.json` existen pero el file-map del PRP no los lista explícitamente (sí conceptualmente).

### B) Docs que nombran código inexistente
- 🟥 **`diagnose-contradictions.js`** (PRP Fase 3): la detección de contradicciones **vive en `GraphAuditor`** (`VIVA_DEROGADA` + `validarConsistenciaVersiones`). El script standalone nunca se construyó. El PRP debe reconciliarlo.
- 🟡 `contextResolver.js`, `routes/{dictamen,grafo,clientes}.js`, `autoResearchIngest.js`, capa A2A, sync Obsidian, voz → **fases pendientes** (2–8) correctamente marcadas. No son brechas; son roadmap.

---

## 3. Plan de Sincronización (qué actualizar — NO aplicado)

**En `PRP-01-Cimientos-Motor.md`:**
1. **Reconciliar Modo Contradicción:** en Fase 3 / Deuda Técnica, reemplazar la referencia a `diagnose-contradictions.js` por: *"detección de contradicciones cubierta parcialmente por `GraphAuditor.validarConsistenciaVersiones` (`VIVA_DEROGADA`); script standalone no construido."*
2. **Declarar la arquitectura real:** añadir nota explícita *"Arquitectura layer-based (`lib/`/`services/`/`routes/`), NO Feature-First; el Golden Path Feature-First del template SaaS Factory no aplica a este proyecto"* (hoy se infiere de "Realidad técnica" pero no se dice).
3. **Mapear el scaffold genérico:** documentar el destino de `workspaces/teams/billing/permissions` — ¿se reemplazan por `clientes` (cartera del despacho)? ¿se elimina el billing Stripe (el PRP preveía Polar/ninguno)? Decidir y registrar.
4. (Menor) Añadir `seedValidator.js` y `fixtures/fiscal_data.json` al file-map.

**En `BUSINESS_LOGIC.md`:**
5. Aclarar que el concepto **`Cliente` (cartera del despacho)** es el que sustituye al `workspace` genérico del scaffold (hoy el código tiene `workspaces`, el dominio quiere `clientes`).
6. (Opcional) Nota de que la auth actual (`Map()` en memoria) es deuda y no implementa aún el modelo de `Cliente`/`ownerId`.

---

## 4. Validación de Reglas — Arquitectura Feature-First

**Resultado: ❌ El proyecto NO sigue Feature-First.**
- No existe ninguna carpeta `features/`. El backend es **layer-based**: `config/`, `middleware/`, `routes/`, `utils/`, `lib/{graph,legal,neo4j}`, `services/`.
- **PERO es una divergencia DELIBERADA y documentada** (PRP-01 "Realidad técnica: no migrar"; CLAUDE.md stack real). El Feature-First + Supabase + Next 16 es el **Golden Path genérico del template SaaS Factory** (`prp-base.md`), que este proyecto descartó a propósito.
- **Coherencia interna:** el código SÍ respeta su propia arquitectura (layer-based) y las "Convenciones del scaffold" del PRP-01 (Router+Zod+asyncHandler, Cypher centralizado).
- **Acción recomendada:** no "arreglar" la estructura hacia Feature-First; en su lugar, **declarar explícitamente** la arquitectura layer-based en el PRP (punto 2 del plan) para que el `prp-base.md` genérico deje de ser la "fuente de verdad" aparente.

---

## Resumen para decisión

Las brechas accionables son pocas y concretas: (1) reconciliar `diagnose-contradictions.js`, (2) declarar la
arquitectura layer-based, (3) decidir el destino del scaffold genérico (workspaces/billing → clientes). Lo demás
es roadmap pendiente (coherente) o divergencia intencional. Dime cuáles aplicar y ejecuto la sincronización
(con `/sync-docs` o a mano).
