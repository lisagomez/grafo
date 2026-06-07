# Auditoría de Protocolo Agéntico (A2A) — Grafo

> **Auditor:** Auditor de Protocolos Agénticos · **Fecha:** 2026-06-07
> **Alcance:** capa de interoperabilidad Agent-to-Agent del motor fiscal "Grafo".

---

## ⚠️ Hallazgo crítico previo: la capa A2A NO está implementada

Verificación en el repo (2026-06-07): **no existe código A2A**.
- Sin `backend/src/lib/a2a/`, sin `routes/a2a.js`, sin Agent Card (`/.well-known/agent.json`), sin registro en `index.js`.
- Única referencia: un comentario en `backend/src/lib/legal/sources/types.js` ("por formulario, voz o A2A").
- A2A existe solo como **diseño** en `PRP-01` (Fase 4 — Conectividad Agéntica, **pendiente**).

**Por lo tanto, esta es una auditoría DE DISEÑO (pre-implementación), no de código en ejecución.** Los
"hallazgos" son **requisitos y huecos a resolver ANTES de construir** la Fase 4, no vulnerabilidades activas.
Esto es deliberado: auditar el diseño ahora es más barato que parchear después.

**Leyenda de estado:** 🟥 No contemplado · 🟧 Mencionado en PRP sin especificar · 🟩 Especificado en PRP.

---

## Resumen ejecutivo

| Pilar | Estado del diseño | Riesgo si se implementa tal cual |
|---|---|---|
| 1. Protocolo de Negociación | 🟧 handshake aludido; timeout y respuesta inválida 🟥 | **Alto** |
| 2. Soberanía de Datos | 🟧 "solo lectura" + lineage; aislamiento de tenant 🟥 | **Alto** |
| 3. Manejo de Errores / Blindaje | 🟧 flag `requiere_revision`; retry/fallback 🟥 | **Medio** |
| 4. Validación de Identidad | 🟧 "token/clave en handshake" sin mecanismo | **Crítico** |

**Prerrequisito transversal (bloqueante):** la autenticación base del proyecto hoy usa **`Map()` en memoria**
(`backend/src/routes/auth.js`) y **no hay RLS** (es Prisma/Postgres, no Supabase). A2A heredaría esa debilidad.
No debe exponerse A2A sobre una base de identidad/aislamiento sin endurecer primero esa capa.

---

## Pilar 1 — Protocolo de Negociación

**Qué dice el PRP:** Agent Card en `/.well-known/agent.json` con skill `consultar_deducibilidad`; recibe
*tasks* y devuelve *artifacts*; sync + async (BullMQ); validación estricta de entrada (Zod) +
`A2A_PROTOCOL_VERSION`.

**Hallazgos:**
- 🟧 **Handshake no definido.** Se menciona "auth en el handshake" pero no hay secuencia de negociación
  (descubrimiento de capacidades → verificación de versión → autenticación → establecimiento de sesión).
- 🟥 **Timeout ausente.** Si Grafo actúa como cliente (o un par tarda), no hay política de timeout ni
  *circuit breaker*. Riesgo: cuelgues, agotamiento de workers BullMQ.
- 🟥 **Respuesta maliciosa/ inválida sin manejo en el lado de salida.** Zod se aplica a la *entrada*; no se
  especifica validación del *artifact* que Grafo emite, ni de respuestas que Grafo recibiría de otros agentes.

**Mejoras de diseño:**
1. **Handshake explícito** (3 fases): `negotiate` (Agent Card + `A2A_PROTOCOL_VERSION`; rechazar si no
   coincide major) → `authenticate` (ver Pilar 4) → `task`. Documentar la máquina de estados.
2. **Timeouts + circuit breaker** por petición saliente (p. ej. 5–10 s) con backoff; abrir el circuito ante un
   par que falla repetidamente.
3. **Validación bidireccional con Zod**: schema de `task` (entrada) Y de `artifact` (salida), versionados.
   Rechazo con error tipado (`PROTOCOL_VERSION_MISMATCH`, `MALFORMED_TASK`) en vez de excepción cruda.
4. **Límite de tamaño/*depth*** del payload (anti-DoS) y *deadline* propagado en el mensaje.

---

## Pilar 2 — Soberanía de Datos

**Qué dice el PRP:** consultas A2A **solo lectura** sobre el grafo; cada respuesta incluye el **Lineage** (cadena
legal + `source_version`).

**Hallazgos:**
- 🟩 **Grafo legal = dato público** (LISR/CFF/RMF). Compartir el lineage es seguro: es ley citable.
- 🟥 **Contexto de cliente NO aislado.** La consulta lleva `régimen`, `monto`, posible identidad de cliente
  (`Cliente.ownerId` = contador). Nada impide que el *artifact* eche de vuelta montos/identificadores del
  despacho → fuga entre tenants.
- 🟥 **Sin scoping por tenant en A2A.** No hay RLS ni verificación de que el par solo acceda a datos de su
  ámbito. Un par podría inferir/solicitar dictámenes de clientes ajenos.

**Mejoras de diseño:**
1. **Minimización de datos**: el *artifact* devuelve **veredicto + lineage legal**, NUNCA PII/`monto`/identidad
   de cliente. El contexto de cliente es de entrada, no de salida.
2. **Aislamiento de tenant en el Adapter**: mapear cada par autenticado a un `workspace/tenant` permitido;
   filtrar toda respuesta a ese ámbito. Tratar el grafo legal como compartible y el contexto de cliente como
   confidencial por defecto (allow-list, no deny-list).
3. **Clasificación de datos** explícita en los schemas: marcar campos `public` (norma, lineage) vs
   `confidential` (cliente, monto) y prohibir los `confidential` en artifacts salientes a nivel de serializer.
4. Cuando exista RLS/tenancy real, **propagar el contexto de tenant** del par a las consultas (no `SELECT *`).

---

## Pilar 3 — Manejo de Errores (Blindaje)

**Qué dice el PRP:** respuestas degradadas por contradicción (B3) viajan con flag `requiere_revision`.

**Hallazgos:**
- 🟧 **Degradación parcial** cubierta (B3), pero solo para el caso "contradicción".
- 🟥 **Sin retry/fallback** ante rechazo o error del par. No está definido qué pasa si el receptor rechaza una
  propuesta: ¿reintento? ¿respuesta alternativa? ¿el flujo muere?
- 🟧 BullMQ permite reintentos pero **no hay política** (intentos, backoff, *dead-letter*).

**Mejoras de diseño:**
1. **Taxonomía de error**: distinguir transitorio (5xx/timeout → reintentable) de permanente (4xx/validación →
   no reintentable). Responder con `error.code` estable, no excepciones crudas.
2. **Retry con backoff exponencial + jitter** en la cola BullMQ para transitorios; **idempotency-key** por task
   para evitar duplicados; **dead-letter queue** para lo que agota reintentos.
3. **Fallback lógico** ante rechazo del par: devolver el **último dictamen validado** disponible o
   `status: 'needs_human'` (HITL) — el sistema **degrada, no muere**.
4. **Circuit breaker** por par (ver Pilar 1) para no martillar a un agente caído.

---

## Pilar 4 — Validación de Identidad

**Qué dice el PRP:** "autenticación de agentes pares (token/clave en el handshake)".

**Hallazgos:**
- 🟧 **Mecanismo no especificado.** "token/clave" es vago; sin firma, sin caducidad, sin rotación.
- 🟥 **Base actual inadecuada**: el auth de usuarios es JWT HS256 con secreto compartido y store en memoria — no
  sirve para identidad agente-a-agente entre organizaciones.
- 🟥 **Sin anti-replay** ni verificación de propiedad del dominio del Agent Card.

**Mejoras de diseño (elegir según topología):**
1. **Firma HMAC por mensaje** (pares con secreto compartido): `HMAC-SHA256(payload + nonce + timestamp)` en un
   header; rechazar si `|now - timestamp| > 30s` y si el `nonce` ya se vio (cache anti-replay). Simple y robusto
   para pocos pares de confianza.
2. **JWT de corta duración asimétrico** (ecosistema abierto): `RS256/EdDSA`, `exp ≤ 2–5 min`, `iss`/`aud`
   verificados, claves públicas publicadas vía el Agent Card (`/.well-known`). Permite rotación sin secreto compartido.
3. **mTLS** en transporte para autenticación mutua fuerte (complementa 1 o 2).
4. **Rotación de claves** y verificación de que el dominio del Agent Card es propiedad del par (DNS/well-known).
5. Identidad de par **nunca** reutiliza el JWT de usuario final (separar planos: usuario vs agente).

---

## Recomendación de secuencia (antes de construir Fase 4)

1. **Endurecer la base** (bloqueante): mover auth de `Map()` a persistencia real; introducir tenancy/aislamiento.
2. Implementar **Pilar 4** (identidad) primero — sin identidad, lo demás es indefendible.
3. Luego **Pilar 1** (handshake + timeouts + validación bidireccional) y **Pilar 2** (minimización + scoping).
4. **Pilar 3** (retry/fallback/circuit breaker) al cablear la cola BullMQ.
5. Tests de seguridad: payload malformado, version mismatch, token expirado/forjado, replay, fuga de tenant.

## Conclusión

La capa A2A está **bien encuadrada conceptualmente** en el PRP (adapter desacoplado, read-only, lineage,
versionado), pero **los 4 pilares de seguridad están incompletos o ausentes a nivel de diseño**, y descansaría
sobre una base de identidad/aislamiento que **hoy no es apta para producción**. Recomendación: **no implementar
A2A hasta** endurecer identidad (Pilar 4) y aislamiento de datos (Pilar 2), y especificar handshake/timeout
(Pilar 1) y retry/fallback (Pilar 3). Registrar estas decisiones en `PRP-01` (sección A2A) y en la Deuda Técnica.

> Este reporte audita un diseño, no código en ejecución. Re-auditar cuando exista `backend/src/lib/a2a/`.
