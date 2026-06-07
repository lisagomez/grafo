# TODO — Tareas pendientes del proyecto

## 🔒 Antes de activar la Fase 4 (Conectividad Agéntica / A2A)

- [ ] **LECTURA OBLIGATORIA PRIMERO** — antes de escribir una sola línea de A2A, el agente debe leer:
  1. [`.claude/security/A2A_AUDIT.md`](../../security/A2A_AUDIT.md) — hallazgos de la auditoría de diseño (4 pilares).
  2. [`.claude/security/A2A_GOLDEN_PATH.md`](../../security/A2A_GOLDEN_PATH.md) — Guía de Implementación Segura (orden de construcción).
- [ ] Seguir el **Golden Path en orden**: contrato Zod → `AgentRegistry` (Prisma) → identidad (JWT/HMAC) → DLQ + transaccionalidad → gate `GraphAuditor` → adapter → **recién entonces** `routes/a2a.js`.
- [ ] **No exponer ninguna ruta A2A** hasta completar los pasos 1–2 del Golden Path (contrato + registro de agentes).
- [ ] Prerrequisito bloqueante: endurecer la auth base (hoy `Map()` en memoria) y el aislamiento de tenant antes de A2A.

> Motivo: la capa A2A es una frontera de confianza. Estos reportes son el contrato de seguridad pre-implementación;
> ignorarlos al arrancar la Fase 4 reintroduce los huecos ya identificados (identidad, soberanía de datos, blindaje).
