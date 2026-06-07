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

> Correr `node scripts/audit.js` tras cada seed/ingesta y **antes** de confiar en la inferencia (ver Fase 1.5 del PRP-01).
