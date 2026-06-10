# CLAUDE.md — Grafo

> Guía de contexto para agentes. Grafo es un **motor de inteligencia fiscal basado en grafos**:
> un copiloto Human-in-the-Loop que entrega dictámenes de deducibilidad trazables a contadores.

## Stack real (no asumir el Golden Path del template)

- **Backend**: Express + Prisma + PostgreSQL + JWT. **JavaScript / ESM** (no TypeScript). Contratos vía JSDoc `@typedef`/`@implements`.
- **Frontend**: Next.js 14 + React 18 + Tailwind 3.4 (no Next 16/React 19).
- **Grafo legal**: Neo4j + Cypher (toda inferencia vía el Cypher Query Service).
- **Conocimiento**: Obsidian (sync bidireccional con Neo4j).
- **No se usa Supabase** pese a que el MCP esté configurado.

Patrones a reutilizar: rutas `Router`+Zod+`asyncHandler`/`HttpErrors`; `authenticate` middleware; `frontend/lib/api.ts` para llamadas; `DashboardLayout` para páginas.

## Decision Tree

Cuándo consultar qué, antes de escribir código:

1. **¿Feature compleja / cambio multi-archivo?** → Lee el PRP correspondiente en `.claude/PRPs/` ANTES de implementar. Genera uno nuevo con el skill `/prp` si no existe.
   - **[PRP-01: Cimientos + Motor](.claude/PRPs/PRP-01-Cimientos-Motor.md)** — arquitectura completa: Neo4j+Cypher, sync bidireccional Obsidian, Legal Context Resolver (multi-jurisdicción), capa de voz, blindaje (HITL / lineage / contradicción) e interoperabilidad A2A. **Estado: EN PROGRESO** (~30%; Fases 0/1/1.5 completadas en Modo Arquitecto).
2. **¿Implementar una fase ya planificada del PRP?** → skill `/bucle-agentico` (ejecuta fase por fase con mapeo de contexto just-in-time).
3. **¿Toca el grafo legal (normas/relaciones/inferencia)?** → **OBLIGATORIO: lee primero [`.claude/memory/BUSINESS_LOGIC.md`](.claude/memory/BUSINESS_LOGIC.md)** (reglas de deducibilidad, entidades y flujos de decisión) ANTES de escribir o ejecutar cualquier query de Cypher. Luego, todo Cypher pasa por el **Cypher Query Service** (`backend/src/lib/graph/cypherService.js`). Nunca queries dispersas.
4. **¿Nueva jurisdicción/país?** → crear un `LegalSourceProvider` y registrarlo en la factory (`backend/src/lib/legal/sources/index.js`). No tocar el motor (patrón Strategy).
5. **¿Auth / pagos / emails / mobile?** → skills `/add-login`, `/add-payments`, `/add-emails`, `/add-mobile`.

## Reglas críticas (ver Anti-Patrones del PRP-01)

- **Antes de cualquier Cypher**: consultar [`.claude/memory/BUSINESS_LOGIC.md`](.claude/memory/BUSINESS_LOGIC.md) (lógica de dominio fiscal).
- Cypher centralizado; namespace de país viaja como **parámetro**, nunca concatenado.
- Sin **lineage** no hay `Deducible` (path vacío ⇒ `Condicional`).
- Export de PDF **bloqueado** sin validación humana (gate 409).
- No acoplar el motor a un país, protocolo o proveedor de IA concretos (Strategy/Adapter en los bordes).
- `.env` está gitignoreado — nunca commitearlo.

## Comandos (desde `backend/`)

| Comando | Qué hace |
|---|---|
| `node scripts/audit.js` (`npm run audit`) | **Auditoría del grafo**: gastos huérfanos + consistencia de versiones. Sale con código **1** si hay incidencias, **0** si está limpio. Acepta `--data=ruta.json`. |
| `npm test` | Suite `node:test` (motor, auditor, lint de Cypher). |
| `npm run seed:graph` | Valida procedencia y siembra el grafo (requiere Neo4j). |
| `npm run test:inference` | Consulta de prueba del motor (mock si no hay Neo4j). |
| `npm run test:vault-inference` | Dictamen del motor **sobre datos de la bóveda** (vault → `VaultRuleService` → motor). |
| `npm run audit:vault` | **Gate de la bóveda**: bloquea (exit 1) si hay notas mal formadas; un país vacío es informativo (exit 0). |
| `npm run export:knowledge -- <iso>` | **Exporta** el conocimiento de un país al formato estándar → `out/knowledge/<ISO>.json`. |
| `npm run extract:legal -- <iso> [clave]` | **Extracción agnóstica de fuentes legales** dirigida por `backend/config/legal-sources.json` (baseUrl + selector CSS por país/fuente) → `out/extraction/<ISO>/<CLAVE>.txt` (insumo de `/pre-curator`). `--list` muestra lo configurado. Exit 1 si alguna fuente falla. |
| `npm run generate-schema` | Regenera `docs/knowledge-schema.json` desde `KNOWLEDGE_SCHEMA` (fuente única). |

> Correr `node scripts/audit.js` tras cada seed/ingesta y **antes** de confiar en la inferencia (ver Fase 1.5 del PRP-01).

## Formato estándar de intercambio (Knowledge Schema)

La salida oficial del knowledge-engine es un **JSON estándar** (`metadata` + `rules[]` con `edges` sujeto/predicado/efecto/objeto + `warnings`) que **cualquier motor de reglas** puede consumir. Ciclo cerrado **curaduría → validación → exportación**:

- **Contrato:** [`docs/knowledge-schema.json`](docs/knowledge-schema.json) — artefacto **generado**, no editar a mano. Fuente única: `KNOWLEDGE_SCHEMA` en `backend/src/lib/knowledge-engine.js` (`npm run generate-schema` lo regenera; el validador deriva del mismo objeto).
- **Producción:** `toKnowledgeSchema(countryRuleSet)` serializa; `validateKnowledgeSchema()` valida.
- **Extracción oficial:** `npm run export:knowledge -- <iso>` (valida antes de escribir; nunca exporta algo que no cumpla el contrato).
- **Nota:** este formato es genérico y *más simple* que el modelo interno (no lleva topes/regímenes/vigencia). Para la **inferencia fiscal** se usa el `CountryRuleSet` + `VaultRuleService`, no este JSON.

> **Requerimiento de CI (obligatorio):** cualquier cambio en la **estructura del motor** (p. ej. `KNOWLEDGE_SCHEMA`, `toKnowledgeSchema`, la forma de las reglas/aristas) exige **regenerar y versionar** el esquema: corre `npm run generate-schema` y **commitea** `docs/knowledge-schema.json` en el mismo cambio. El job `vault-gate` lo verifica (`generate-schema` + `git diff --exit-code`); si el esquema quedó desincronizado, el pipeline **falla** y bloquea el deploy.

## Technical Debt / Future Improvements

Deuda técnica conocida y diferida **a propósito** (decisión registrada, no olvido). No abordar sin un caso de uso real que lo justifique.

| # | Deuda | Estado / Razón | Disparador para refactorizar |
|---|---|---|---|
| TD-1 | **El parser de Pseudocódigo de Grafo no separa `Nodo:Etiqueta`.** `parseGraphPseudocode` (`backend/src/lib/knowledge-engine.js`) guarda el texto completo del nodo (p. ej. `"Gasto:Gasto"`) como `subject`/`object`, sin dividir entidad y etiqueta. | **Diferida (Postel's Law).** El parser es deliberadamente tolerante; el formato estricto se enforce en la curaduría (`CURATION_PROMPT.md`), no en la lectura. Prioridad actual: motor **funcional** con el formato vigente. | El **primer caso de uso real de consulta compleja** que necesite filtrar/recorrer por etiqueta de nodo. Entonces: extraer `entidad` y `etiqueta` por separado en `GraphEdge` (+ tests). |

> Al cerrar una deuda, mover la fila a un changelog/commit y actualizar los tests correspondientes.
