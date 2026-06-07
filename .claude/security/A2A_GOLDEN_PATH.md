# A2A — Guía de Implementación Segura (Golden Path)

> Para cuando se **active la Fase 4** (Conectividad Agéntica). Complementa los hallazgos de
> [`A2A_AUDIT.md`](./A2A_AUDIT.md). A2A **aún no está implementado**: esta guía es el orden de construcción
> prescrito para que nazca seguro. **Regla:** no se escribe una sola ruta A2A hasta cumplir los pasos 1–2.

> ✅ **Nota de stack (resuelta):** el `agent_registry` se implementa como **modelo Prisma `AgentRegistry`**
> en `schema.prisma` — decisión confirmada (Express + Prisma + Postgres, **sin Supabase**). El control de
> identidad A2A queda dentro del dominio de datos del proyecto (soberanía total, latencia baja). Ver Pilar 2.

---

## Principio rector

A2A es una **frontera de confianza**: todo lo que entra es hostil hasta probar lo contrario, y todo lo que
sale puede filtrar datos. El orden de construcción va de **adentro hacia afuera**: contrato → identidad →
resiliencia → integridad → recién entonces, rutas.

```
1. Contrato (Zod)  →  2. Registro de Agentes  →  3. DLQ + transaccionalidad  →  4. Gate GraphAuditor  →  (rutas A2A)
```

---

## Pilar 1 — Definición de Contrato (primero, antes que nada)

**Decisión:** el **PRIMER** archivo de `backend/src/lib/a2a/` es el **esquema Zod** que valida TODA la
comunicación A2A (entrante y saliente). Ninguna otra pieza A2A se escribe antes.

- Archivo: `backend/src/lib/a2a/schema.js` — exporta los Zod schemas:
  - `A2ATaskSchema` — mensaje entrante (consulta de un par).
  - `A2AArtifactSchema` — respuesta saliente (dictamen + lineage).
  - `A2AHandshakeSchema` — negociación (Agent Card ref + `A2A_PROTOCOL_VERSION` + credenciales).
  - `A2AErrorSchema` — errores tipados (`PROTOCOL_VERSION_MISMATCH`, `MALFORMED_TASK`, `AUTH_FAILED`, …).
- **Validación bidireccional:** `parse()` en la entrada Y antes de serializar la salida. Si algo no valida →
  `A2AErrorSchema`, nunca una excepción cruda ni un objeto a medio formar.
- **Clasificación de datos en el schema** (soporta Pilar 2 de soberanía): marcar campos `public`
  (norma, lineage, `source_version`) vs `confidential` (cliente, monto, régimen). El `A2AArtifactSchema`
  **prohíbe** los `confidential` por construcción (no `.passthrough()`).
- Versionar el contrato con `A2A_PROTOCOL_VERSION`; rechazar `major` distinto en el handshake.

> Beneficio: el contrato es la única fuente de verdad de la forma del protocolo; el adapter y las rutas
> dependen de él, no al revés (mantiene el desacople del PRP).

---

## Pilar 2 — Registro de Agentes (antes de registrar rutas)

**Decisión:** antes de exponer cualquier endpoint, el diseño incluye un **registro de agentes** que gestiona
**identidades y permisos** de los pares.

**Decisión Arquitectónica:** dado que la infraestructura usa **Express + Prisma + Postgres**, el registro de
agentes se implementa como **modelo nativo en `schema.prisma`** (no servicios externos).

**Definición del Modelo (canónica):**

```prisma
model AgentRegistry {
  id            String   @id @default(uuid())
  agentId       String   @unique
  publicKey     String   // Para validación de firma
  permissions   Json     // Definición de alcance de acceso
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
}
```

- **Toda petición A2A** se resuelve contra este registro: identidad (Pilar 4) + `permissions`. Un par con
  `isActive: false` (revocado) o sin el scope requerido en `permissions` → rechazo inmediato.
- **Aislamiento de tenant / soberanía**: el ámbito permitido del par (scopes + tenant) vive dentro de
  `permissions` (Json); el adapter filtra toda respuesta a ese ámbito. (Rotación de clave: regenerar
  `publicKey` + `createdAt` o extender el modelo si se requiere historial.)

**Nota de Auditoría:** este modelo **sustituye la propuesta inicial que consideraba servicios externos**
(Supabase), garantizando que **todo el control de identidad A2A se mantenga dentro del dominio de datos del
proyecto**: latencia baja y soberanía total.

**Reglas de Oro del Modelo Prisma (`AgentRegistry`):**
- **Regla 1 — Acceso autenticado:** toda consulta a `AgentRegistry` debe pasar por un **middleware de
  autenticación (JWT/HMAC)**. Nunca se accede al registro sin verificar primero la identidad del solicitante.
- **Regla 2 — `agentId` inmutable:** una vez creado, el `agentId` **no se modifica**. Es la identidad estable
  del par; cambiarlo rompería la trazabilidad y los permisos. Para "rotar" un agente se crea uno nuevo y se
  marca el anterior `isActive: false`.

> **Prerrequisito (de `A2A_AUDIT.md`):** la auth base usa hoy `Map()` en memoria. El `AgentRegistry` debe
> vivir en Postgres (Prisma) persistente, separado del plano de identidad de usuarios finales.

---

## Pilar 3 — Dead Letter Queue (DLQ) + transaccionalidad

**Decisión:** dada la naturaleza asíncrona de A2A, el diseño incluye una **DLQ** para mensajes fallidos, de
modo que **el grafo no se corrompa si una transacción se interrumpe**.

- Sobre **BullMQ** (ya previsto para voz): cola `a2a` con política de reintentos
  (backoff exponencial + jitter; máx. N intentos) → al agotarse, el job va a la **`a2a:dead-letter`**.
- **Transaccionalidad / integridad del grafo:** cualquier A2A que **persista** en el grafo debe ser
  **atómico e idempotente**:
  - `idempotency-key` por task (evita doble aplicación si se reintenta).
  - Escrituras a Neo4j dentro de **una transacción**; si se interrumpe → rollback, el grafo queda intacto.
  - Un mensaje que falla a mitad NO deja nodos/relaciones a medias: o todo o nada → DLQ con el payload original.
- La DLQ es **inspeccionable y reprocesable** (no un agujero negro): herramienta para drenar/reintentar manual.

> Nota: las consultas A2A *de solo lectura* (el caso principal del PRP) no persisten nada; este pilar protege
> los flujos A2A que sí escriben (p. ej. ingesta/propuestas de actualización vía agente).

---

## Pilar 4 — Validación de Integridad (gate `GraphAuditor`)

**Decisión:** **cada respuesta/transacción A2A que vaya a persistir en el grafo** debe pasar por el
**`GraphAuditor`** (la skill `graph-auditor-factory` ya blindada) **antes de hacerse durable**.

- Antes de `commit`, correr sobre el subconjunto afectado:
  `detectarOrfanos()` y `validarConsistenciaVersiones()`.
- **Regla de oro:** si el auditor devuelve `status: 'error'` → **abortar la transacción** y enviar el mensaje a
  la **DLQ** (Pilar 3) con el reporte de incidencias adjunto. Solo `status: 'ok'` permite persistir.
- Así, un par que envía datos que crearían huérfanos o inconsistencias de versión **no puede corromper el
  grafo**: el blindaje de auditoría es la última puerta antes de la durabilidad.
- Para respuestas **salientes** (Grafo como proveedor), validar que el artifact no incluya `confidential`
  (Pilar 1) y que el lineage sea coherente (no `Deducible` sin sustento).

> Reutiliza exactamente la infraestructura ya construida y verificada (dry-run portable). El auditor pasa de
> "herramienta de CI" a **gate en línea** del protocolo A2A.

---

## Golden Path (orden de activación de la Fase 4)

1. ⬜ `backend/src/lib/a2a/schema.js` — contrato Zod bidireccional (**primer archivo**).
2. ⬜ Modelo Prisma `AgentRegistry` + migración; identidad/permisos/tenant.
3. ⬜ Mecanismo de identidad (Pilar 4 del audit): HMAC por mensaje **o** JWT asimétrico ≤5 min + anti-replay.
4. ⬜ Cola BullMQ `a2a` + **DLQ** + transaccionalidad idempotente de escrituras a Neo4j.
5. ⬜ Gate `GraphAuditor` pre-commit (abortar→DLQ si `status:'error'`).
6. ⬜ `a2aAdapter.js` (traducción protocolo↔dominio, decoupled) + `agentCard.js`.
7. ⬜ **Recién ahora:** `routes/a2a.js` (`/.well-known/agent.json`, `/api/a2a/tasks`) + registro en `index.js`.
8. ⬜ Suite de seguridad: payload malformado, version mismatch, token expirado/forjado, replay, fuga de tenant,
   transacción interrumpida (verificar rollback + DLQ).

## Mapeo a los 4 pilares del audit
- **Negociación** → Pilar 1 (contrato/handshake versionado) + paso 6.
- **Soberanía** → Pilar 1 (clasificación) + Pilar 2 (tenant scoping).
- **Blindaje** → Pilar 3 (DLQ/retry/rollback).
- **Identidad** → Pilar 2 (registro) + paso 3 (HMAC/JWT).

> Golden Path. No activar Fase 4 saltándose el orden: cada paso es prerrequisito del siguiente.
