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
   - **[PRP-01: Motor de Inteligencia Fiscal](.claude/PRPs/01-motor-legal.md)** — arquitectura completa: Neo4j+Cypher, sync bidireccional Obsidian, Legal Context Resolver (multi-jurisdicción), capa de voz, blindaje (HITL / lineage / contradicción) e interoperabilidad A2A. **Estado: EN PROGRESO** (Fase 3 parcial: `LegalSourceProvider` en `backend/src/lib/legal/sources/`).
2. **¿Implementar una fase ya planificada del PRP?** → skill `/bucle-agentico` (ejecuta fase por fase con mapeo de contexto just-in-time).
3. **¿Toca el grafo legal (normas/relaciones/inferencia)?** → todo Cypher pasa por el **Cypher Query Service** (`backend/src/lib/graph/cypherService.js`). Nunca queries dispersas.
4. **¿Nueva jurisdicción/país?** → crear un `LegalSourceProvider` y registrarlo en la factory (`backend/src/lib/legal/sources/index.js`). No tocar el motor (patrón Strategy).
5. **¿Auth / pagos / emails / mobile?** → skills `/add-login`, `/add-payments`, `/add-emails`, `/add-mobile`.

## Reglas críticas (ver Anti-Patrones del PRP-01)

- Cypher centralizado; namespace de país viaja como **parámetro**, nunca concatenado.
- Sin **lineage** no hay `Deducible` (path vacío ⇒ `Condicional`).
- Export de PDF **bloqueado** sin validación humana (gate 409).
- No acoplar el motor a un país, protocolo o proveedor de IA concretos (Strategy/Adapter en los bordes).
- `.env` está gitignoreado — nunca commitearlo.
