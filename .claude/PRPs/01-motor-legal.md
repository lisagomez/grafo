# PRP-01: Motor de Inteligencia Fiscal (Grafo)

> **Estado**: EN PROGRESO
> **Fecha**: 2026-06-07
> **Proyecto**: grafo
> **Blueprint**: ver sección [MVP Roadmap (fases)](#mvp-roadmap-fases). Implementación fase por fase con el skill `/bucle-agentico`.
> **Avance**: Fase 3 parcial — `LegalSourceProvider` (Strategy) implementado en `backend/src/lib/legal/sources/`.

---

## Context (por qué se hace esto)

Grafo resuelve la **asimetría de información fiscal**: un Contador Público Senior pierde 5–10 h/semana validando qué norma sigue vigente para determinar la deducibilidad de un gasto, con riesgo de multas del 20–100% del impuesto omitido. El objetivo de la V1 es un **copiloto Human-in-the-Loop** que entregue un *Dictamen de Soporte* trazable (veredicto + ruta legal + sustento exportable) en **< 45 s**, cubriendo el **80%** de los conceptos de gasto recurrentes de Personas Morales Título II.

**Realidad técnica (decisión del usuario, no migrar):** se conserva el scaffold existente **Express + Prisma + PostgreSQL + JWT**. Se **añade Neo4j** como motor del grafo legal y **Obsidian** como capa de gestión del conocimiento. No se adopta Supabase.

### División de responsabilidades de datos
| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Relacional | PostgreSQL + Prisma | Usuarios, clientes del despacho, catálogo de conceptos, historial de consultas, dictámenes (metadatos + resultado), audit log |
| Grafo | **Neo4j + Cypher** | Nodos `:Norma`/`:Criterio`/`:Gasto`/`:Regimen` + relaciones `:APLICA_A`/`:DEROGA`/`:MODIFICA`/`:EXTIENDE`/`:INTERPRETA`/`:RIGE_EN`; traversal de vigencia. Toda inferencia vía **Cypher Query Service** |
| Conocimiento | **Obsidian (vault Markdown)** | Espejo navegable del grafo: 1 nodo = 1 archivo `.md` con frontmatter + `[[wikilinks]]` = relaciones |
| Voz | **Whisper (STT) + LLM + BullMQ/Redis** | Consulta y feedback por dictado: audio → entidades → params Cypher / notas Obsidian, procesado async |
| Blindaje | **HITL + Lineage + Modo Contradicción** | Validación humana obligatoria antes del PDF, path Cypher como justificación auditable, diagnóstico de inconsistencias del grafo |
| Interop | **Protocolo A2A + Adapter** | Grafo como agente fiscal: recibe consultas y envía dictámenes (con lineage) a otros agentes; Cypher nunca expuesto al exterior |
| Contexto | **Legal Context Resolver** | Multi-jurisdicción: detecta país, carga fuentes-de-verdad, inyecta Graph Namespace, dispara Auto-Research si falta; `source_version` en el dictamen |

El **motor de inferencia** consulta Neo4j para hallar la ruta legal vigente, y persiste el dictamen resultante en Postgres vía Prisma.

---

## Convenciones del scaffold a reutilizar (no reinventar)

- **Rutas backend:** patrón `Router` por feature + Zod + `asyncHandler`/`HttpErrors` (`backend/src/middleware/errorHandler.js`) + `authenticate` (`backend/src/middleware/auth.js`). Registrar en `backend/src/index.js` bajo `apiRouter`.
- **Config:** extender `backend/src/config/index.js` (añadir bloques `neo4j` y `obsidian`).
- **Cliente API frontend:** extender `frontend/lib/api.ts` con `clientesApi`, `grafoApi`, `dictamenApi` (reusa Bearer token de localStorage).
- **UI:** envolver páginas nuevas con `frontend/components/layouts/DashboardLayout`; íconos `lucide-react`; añadir shadcn/ui sobre Next 14/React 18 (sin upgrade).
- **Auth:** las rutas actuales usan `Map()` en memoria. Para V1 NO se bloquea por esto; se documenta como deuda. Las features nuevas que necesiten persistencia usan Prisma directamente.

---

## Arquitectura del Grafo Legal (Neo4j + Cypher)

### Cypher Query Service (capa de abstracción — regla de oro)
**Ninguna consulta Cypher vive dispersa en rutas/componentes.** Toda inferencia legal pasa por una capa de servicios que **traduce conceptos de negocio → Cypher**:

- `backend/src/lib/graph/cypherQueries.js` — **único** módulo que contiene strings Cypher parametrizados (constantes nombradas, p. ej. `CADENA_LEGAL_POR_GASTO`, `VERSION_VIGENTE`, `EXPORT_GRAFO_COMPLETO`). Sin Cypher fuera de aquí.
- `backend/src/lib/graph/cypherService.js` — **Cypher Query Service**: API de negocio (`getCadenaLegal({gasto, regimen, fecha})`, `getVersionVigente(normaId, fecha)`, `exportGrafo()`, `upsertNorma()`, `mergeRelacion()`). Ejecuta vía el driver (`neo4j.js`), mapea records → objetos de dominio, gestiona sesiones/transacciones. Es el **único** punto que importa el driver.
- `inferenceEngine.js` y `vaultSync.js` consumen el Cypher Query Service; **no** escriben Cypher por su cuenta.

### Schema de Grafo (definición formal de nodos y relaciones)

**Nodos (labels):**
| Label | Significado | Propiedades clave |
|---|---|---|
| `:Norma` | Norma legal: ley, artículo o regla RMF | `id`(UUID), `tipo`(LEY\|ARTICULO\|REGLA_RMF), `clave`("Art. 28 LISR"), `titulo`, `texto`, `fuente_url`, `vigente_desde`, `vigente_hasta`(null=vigente), `hash_fuente`, `graph_rev` |
| `:Criterio` | Criterio normativo del SAT (interpretación que matiza una norma) | `id`, `clave`("45/ISR"), `texto`, `fuente_url`, `vigente_desde`, `vigente_hasta`, `graph_rev` |
| `:Gasto` | Concepto de gasto deducible (catálogo controlado; espejo de Prisma `ConceptoGasto`) | `id`, `clave`("VIATICOS"), `nombre`, `descripcion` |
| `:Regimen` | Régimen fiscal | `id`, `clave`("PM_TITULO_II"), `nombre` |

**Relaciones (dirigidas):**
| Relación | Patrón | Propiedades | Semántica |
|---|---|---|---|
| `:APLICA_A` | `(:Norma)-[:APLICA_A]->(:Gasto)` | `regimen`, `tope_monto`, `tope_pct`, `condicion` | Punto de entrada: norma que rige un gasto |
| `:DEROGA` | `(:Norma)-[:DEROGA]->(:Norma)` | `fecha_efecto` | Origen deja sin efecto a destino |
| `:MODIFICA` | `(:Norma)-[:MODIFICA]->(:Norma)` | `fecha_efecto` | Origen reforma a destino |
| `:EXTIENDE` | `(:Norma)-[:EXTIENDE]->(:Norma)` | — | Amplía alcance |
| `:INTERPRETA` | `(:Criterio)-[:INTERPRETA]->(:Norma)` | `fecha_efecto` | Criterio SAT matiza una norma |
| `:RIGE_EN` | `(:Norma)-[:RIGE_EN]->(:Regimen)` | — | Ámbito de aplicación por régimen |

**Constraints/índices:** `CREATE CONSTRAINT` único sobre `id` de cada label y sobre `clave` de `:Gasto` y `:Regimen`. Definidos en `schema.cypher`.

**Lógica de vigencia (Tax Logic Engine, expresada en Cypher):** dado `(gasto, regimen, fecha=hoy)`, partir de `:Gasto`, recorrer `APLICA_A` hacia las `:Norma` aplicables filtradas por `regimen`; para cada una resolver la versión vigente siguiendo `MODIFICA`/`DEROGA` con `fecha_efecto <= hoy` y descartando nodos con `vigente_hasta < hoy`; anexar `:Criterio` vía `INTERPRETA`. El **veredicto** se deriva de si existe una `:Norma` viva que habilite el gasto (`Deducible`), lo prohíba (`No Deducible`), o lo condicione a topes (`Condicional`).

---

## Legal Context Resolver (multi-jurisdicción)

Capa **transversal a todos los caminos de consulta** (formulario, voz y A2A): antes de tocar el grafo, resuelve *de qué cuerpo legal* se está hablando. Permite que Grafo escale a múltiples países sin reescribir el motor. **V1 ships solo MX**, pero la arquitectura queda lista.

### Flujo del Resolver
```
entidades {gasto, regimen, ..., country?} 
  → 1. Detección de Origen      → country (default 'MX' si no se infiere)
  → 2. Carga Dinámica de Fuentes → registro Fuentes-de-Verdad por país
  → 3. Inyección de Contexto     → Graph Namespace + source_version
  → 4. (si falta) Auto-Research   → ingesta de fuentes oficiales → grafo
  → params + namespace → Cypher Query Service
```

1. **Detección de Origen:** el `intentExtractor` ya devuelve `country` (ISO-2, p. ej. `'MX'`); si no se infiere, default configurable (`DEFAULT_COUNTRY=MX`).
2. **Carga Dinámica de Fuentes (modular, Strategy):** el Resolver **no** contiene lógica por país. Delega en un **`LegalSourceProvider`** (un provider por jurisdicción) que encapsula esquema, fuentes y validación de esa legislación (ver "Contrato LegalSourceProvider" abajo). El registro de versiones persiste en `FuentePais` (Prisma), pero las *reglas del juego* viven en el provider, no en el Resolver ni en el motor.
3. **Inyección de Contexto (Graph Namespace):** `contextResolver.resolve(country)` obtiene el provider vía `LegalSourceFactory` y de él el **namespace** + fuentes, que se inyectan como **parámetro** a las consultas Cypher (propiedad `pais` en los nodos `:Norma {pais:'MX'}` + filtro obligatorio; nunca concatenado). *(Evolución futura: base/etiqueta Neo4j por país.)* El motor de inferencia **no sabe** de países: solo recibe el namespace ya resuelto.
4. **Base de Conocimiento como Origen de Verdad + Auto-Research:** si el país es nuevo o una fuente declarada no está cargada en el grafo, el Resolver dispara una rutina **`autoResearchIngest(country, sources)`** que: descarga los documentos legales oficiales (PDF/Web) → normaliza → extrae entidades/relaciones (LLM) → hace `upsert` al grafo vía Cypher Query Service → registra `version`/`actualizado_en` en `FuentePais`. Es la **versión on-demand de la Ingesta (Fase 8)**, encolada en BullMQ (no bloquea).
   - *Nota:* esta rutina es propia del dominio legal; **no** es el skill `autoresearch` del entorno (ese optimiza prompts, otro propósito). Se nombra `autoResearchIngest` para evitar confusión.
5. **`source_version` en el dictamen:** todo `Dictamen` incluye `source_version` = la última fecha de actualización de la base de conocimiento **del país consultado** (de `FuentePais`), citada junto al lineage. Un dictamen MX dirá p. ej. `source_version: "SAT/RMF 2026-03-15"`.

### Contrato `LegalSourceProvider` (Strategy — fuentes de verdad desacopladas del motor)
La lógica de "qué es la ley aquí" se modela como **una estrategia por país**. El `ContextResolver` depende **solo de la interfaz**, nunca de un país concreto.

**Stack decidido: JS + JSDoc (ESM), sin toolchain TS.** El "contrato" se expresa con `@typedef`; las implementaciones se anotan `@implements` para que el editor valide cumplimiento sin build step.

```js
// backend/src/lib/legal/sources/types.js  — contrato vía JSDoc
/**
 * @typedef {Object} KnowledgeSource
 * @property {string} clave  // 'LISR'
 * @property {'LEY'|'CODIGO'|'CRITERIO'} tipo
 * @property {string} url    // fuente oficial
 * @property {string} version
 */
/**
 * @typedef {Object} LegalSourceProvider
 * @property {string} countryCode                       // 'MX'
 * @property {() => GraphSchema} getSchemaNodes          // nodos/relaciones de ESA jurisdicción
 * @property {() => KnowledgeSource[]} getKnowledgeSources // URLs/PDFs oficiales (Origen de Verdad)
 * @property {(q: QueryIntent) => ValidationResult} validateQuery // ¿pertinente localmente?
 * @property {() => string} getSourceVersion             // última actualización de la KB
 * @property {() => GraphNamespace} getNamespace         // namespace para el Cypher Query Service
 */
export {}; // módulo de solo-tipos
```

- **`MXLegalProvider.js`** (`backend/src/lib/legal/sources/MXLegalProvider.js`, `/** @implements {LegalSourceProvider} */`): `getKnowledgeSources()` → LISR y CFF (+ Criterios SAT) con URLs oficiales y versión; `getSchemaNodes()` → labels `:Norma/:Criterio/:Gasto/:Regimen` con constraints MX; `validateQuery()` → confirma que el `gasto`/`regimen` existe en el catálogo mexicano; `getNamespace()` → `{ pais: 'MX' }`.
- **`LegalSourceFactory`** (`backend/src/lib/legal/sources/index.js`, ESM): `getProvider(countryCode)` → instancia del provider. Mapa `{ MX: new MXLegalProvider(), ... }`. Si el país no está registrado ⇒ dispara `autoResearchIngest(countryCode)` y responde `procesando_jurisdiccion`.
- **Principio de diseño (Strategy):** añadir un país = un archivo provider nuevo + registrarlo en la factory. **Cero cambios** en `contextResolver`, `inferenceEngine` ni `cypherService`. Las "Fuentes de Verdad" quedan **modulares y desacopladas del motor de inferencia**.

### Acoplamiento
- `Dictamen` gana campos `pais` y `sourceVersion` (este último de `provider.getSourceVersion()`). El lineage (B2) se restringe al namespace del país.
- Si `autoResearchIngest` aún corre (país nuevo), la consulta responde `procesando_jurisdiccion` (async) en vez de inventar una respuesta sin base.

## Integración con Obsidian — Sincronización Bidireccional (capa de visualización y edición)

**Modelo:** Neo4j y el vault de Obsidian son **dos vistas de un mismo grafo** sincronizadas en **ambas direcciones**. Neo4j es el motor de inferencia; Obsidian es la capa humana de **visualización y edición** de la lógica legal. El `id` (UUID) en el frontmatter es la **clave de identidad** que une ambos lados — nunca se deriva del nombre de archivo.

**Flujo de trabajo del contador:**
1. Consulta el dictamen en la web (rápido, estructurado).
2. Si necesita **profundizar o corregir la lógica legal** (p. ej. una relación `DEROGA` mal mapeada, una vigencia incorrecta, agregar un criterio), abre **Obsidian**, donde el grafo está renderizado en el *Graph View*.
3. Edita el `.md` (frontmatter y/o wikilinks) → el cambio **se propaga de vuelta a Neo4j** → la siguiente consulta usa la lógica corregida.

- Cada `Norma` → archivo `vault/normas/<clave-slug>.md`:
  ```markdown
  ---
  id: <uuid>            # IDENTIDAD — fuente de verdad del match, no el filename
  tipo: ARTICULO
  clave: "Art. 28 LISR"
  vigente_desde: 2022-01-01
  vigente_hasta: null
  fuente_url: https://...
  graph_rev: 7          # revisión para detección de conflictos
  ---
  # Art. 28 LISR
  <texto normalizado>

  ## Relaciones
  - deroga:: [[Regla 3.15.1 RMF 2023]]
  - aplica_a:: [[Viáticos]]
  ```
- Relaciones ↔ `[[wikilinks]]` resueltos por `id`/`clave` del nodo destino.

### Dirección A — Export (Neo4j → vault)
`vaultSync.exportFromGraph()` llama al **Cypher Query Service** (`cypherService.exportGrafo()`, query `EXPORT_GRAFO_COMPLETO`) para extraer nodos y relaciones, y **genera/actualiza** archivos Markdown (frontmatter + `[[wikilinks]]`). Idempotente: solo reescribe si cambió `hash_fuente`; preserva archivos no afectados. El script **no** ejecuta Cypher directo: pasa siempre por el servicio.

### Dirección B — Import (vault → Neo4j)
`vaultSync.importToGraph()`: **parsea** el frontmatter (lib `gray-matter`) y los wikilinks de cada `.md`, y delega en `cypherService.upsertNorma`/`mergeRelacion` (Cypher `MERGE` por `id`). Wikilinks ausentes ⇒ relación eliminada; wikilinks nuevos ⇒ relación creada.

### Resolución de conflictos
Cada nodo lleva `graph_rev` (entero) en Neo4j y en el frontmatter. En import, si `graph_rev` del archivo `<` el de Neo4j ⇒ conflicto (el grafo cambió desde la última exportación): se registra en `backend/storage/sync-conflicts.log` y se respeta una política configurable (`OBSIDIAN_SYNC_CONFLICT=graph-wins|vault-wins`, default `vault-wins` porque la edición humana es deliberada). Tras cada escritura exitosa se incrementa `graph_rev` en ambos lados.

### Mecanismo de ejecución
- **Manual (V1):** `npm run sync:obsidian -- --export | --import | --both`.
- **Automático (V1):** *file watcher* con `chokidar` sobre `OBSIDIAN_VAULT_PATH` → al detectar guardado en Obsidian dispara `importToGraph()` (debounce 1 s). Un trigger desde la app (post-ingesta/seed) dispara `exportFromGraph()`.
- **Acceso al vault:** filesystem por defecto (el vault es una carpeta local: `OBSIDIAN_VAULT_PATH`); soporte opcional para el plugin **Obsidian Local REST API** (`OBSIDIAN_API_URL` + token) para vaults no locales.

---

## Capa de Voz (Voice-to-Intent)

Capa opcional sobre el motor de dictamen que permite al contador **dictar** en lugar de teclear. Gestiona dos momentos:

### Momento 1 — Input (Consulta por voz)
El contador dicta su duda ("¿son deducibles 8 mil pesos de viáticos para una persona moral?"). Flujo:

```
Audio → STT (Whisper) → Transcripción → Extracción de Entidades (LLM)
      → {gasto, monto, regimen, fecha, country} → Legal Context Resolver
      → (resuelve país + fuentes + namespace; auto-research si falta)
      → params + namespace → Cypher Query Service
      → cadena legal → Dictamen (con source_version)
```

- **STT (modular — provider-agnóstico):** la app **nunca** llama a OpenAI directamente. Depende de una **interfaz estable** `STTProvider` con un único contrato:
  ```
  transcribe(audioBuffer, { lang?, mimeType? }) → { texto, lang, confidence?, durationMs }
  ```
  Implementaciones intercambiables (patrón adapter/strategy) en `backend/src/lib/voice/stt/`:
  - `openAIWhisperProvider.js` — **MVP**: `whisper-1` vía API OpenAI.
  - `localWhisperProvider.js` — **futuro**: `faster-whisper`/self-host (mismo contrato, sin cambios aguas arriba).
  - `index.js` — **factory** que resuelve el provider según `config.voice.sttProvider` (`STT_PROVIDER=openai|local`, default `openai`).
  `sttService` y el `voiceWorker` consumen **solo la interfaz**; cambiar de proveedor = una variable de entorno + un adaptador nuevo, **cero reescritura** de la lógica de negocio. (Mismo principio aplicará al LLM de extracción de entidades, ver `intentExtractor`.)
- **Extracción de entidades (NLP):** `intentExtractor.extract(texto)` llama a un LLM con **salida estructurada validada por Zod** (`{ gastoClave, monto?, regimen, fecha? }`), mapeando lenguaje natural al catálogo controlado (`:Gasto.clave`, `:Regimen.clave`). Si la confianza es baja o falta una entidad, devuelve `needs_clarification` con la entidad faltante (no se inventa).
- **Resolución de contexto:** las entidades pasan por el **Legal Context Resolver** (ver sección dedicada) antes del Cypher, que determina jurisdicción, fuentes y namespace del grafo.
- **Cypher:** las entidades + el namespace resueltos se pasan **tal cual** al Cypher Query Service (`getCadenaLegal`). La voz **no** genera Cypher libre — solo produce parámetros; el Cypher sigue centralizado y parametrizado (preserva la regla de oro y evita inyección).

### Momento 2 — Feedback (Validación por voz)
Tras ver el dictamen, el contador dicta observaciones ("ojo, esta regla se derogó en la última RMF, hay que revisarla"). Flujo:

```
Audio → STT (Whisper) → Transcripción → Estructuración (LLM)
      → (a) nota en el archivo Obsidian asociado  y/o
        (b) actualización de metadatos del nodo vía Cypher Query Service
```

- La transcripción se anexa como nota fechada (`## Observaciones del Contador`) al `.md` del nodo asociado en el vault de Obsidian, **y/o** actualiza metadatos del nodo (`cypherService.upsertNorma` / propiedad `revision_pendiente=true`). Respeta la **sincronización bidireccional** ya definida (la edición fluye Obsidian ↔ Neo4j).
- Caso de uso clave: el feedback de voz alimenta la corrección humana del grafo legal sin salir del flujo.

### Asincronía y latencia (no bloquear al usuario)
- El procesamiento de audio (STT + LLM) es **asíncrono** sobre una cola en **Redis** (`REDIS_URL` ya existe en el scaffold) con **BullMQ**.
- `POST /api/voz/consulta` recibe el audio (`multer`), **encola** el job y responde `202 { jobId }` de inmediato. El worker (`backend/src/workers/voiceWorker.js`) procesa y guarda el resultado.
- El cliente obtiene el resultado por **polling** `GET /api/voz/job/:id` (o SSE en V2). Estados: `queued → transcribing → extracting → querying → done|needs_clarification|error`.
- Límite de tamaño/duración de audio y timeout configurables; los errores de STT/LLM no tumban el request original.

## Capa de Blindaje (Confiabilidad y Trazabilidad)

Tres salvaguardas transversales que protegen el criterio profesional del contador y la integridad del grafo.

### B1 — Human-in-the-Loop (validación obligatoria antes del PDF)
Ningún Reporte de Sustento se genera sin firma humana explícita. El `Dictamen` tiene una máquina de estados:
```
generado → pendiente_validacion → validado → exportable
                     │
                     └─→ rechazado (con motivo) → vuelve al contador
```
- Campo Prisma `Dictamen.estadoValidacion` (enum `PENDIENTE|VALIDADO|RECHAZADO`), `validadoPor`(userId), `validadoEn`, `motivoRechazo?`.
- El endpoint de export (`GET /api/dictamen/:id/export`) **rechaza con 409** si `estadoValidacion != VALIDADO`. La UI deshabilita "Exportar" hasta que el contador pulsa **"Revisé y valido este dictamen"** (`POST /api/dictamen/:id/validar`).
- Refuerza el posicionamiento: el sistema sustenta, el contador firma.

### B2 — Lineage (rastreo de la cadena que justifica la conclusión)
La consulta Cypher **retorna el `path` completo** (nodos + relaciones con sus propiedades), no solo el veredicto. Ese path **es** la justificación auditable.
- Cypher usa `path = (g:Gasto)<-[:APLICA_A]-(n:Norma)...` y retorna `nodes(path)`, `relationships(path)` con `fecha_efecto`, `tope_*`, `vigente_*`.
- `Dictamen.rutaLegalJson` persiste el lineage estructurado: `[{nodo, label, clave, fuente_url, vigencia}, {relacion, tipo, fecha_efecto}, ...]`.
- La UI (Nivel 2 del dictamen) renderiza la cadena paso a paso, cada eslabón linkeable a su fuente oficial. Sin lineage no hay dictamen: si el path viene vacío/ambiguo ⇒ `Condicional` + aviso, nunca un `Deducible` sin sustento.

### B3 — Modo Contradicción (diagnóstico de relaciones contradictorias)
Rutina que recorre el grafo buscando inconsistencias lógicas y las **marca para revisión manual** (no las resuelve sola).
- Patrones detectados (Cypher en `cypherQueries.js`, p. ej. `DETECTAR_CONTRADICCIONES`):
  - Una `:Norma` que está `DEROGA`-da pero sigue con `vigente_hasta IS NULL` (viva y derogada a la vez).
  - Dos `:APLICA_A` sobre el mismo `(:Gasto, regimen)` con condiciones/topes **excluyentes** (p. ej. una dice deducible 100% y otra lo prohíbe).
  - Ciclos `DEROGA`/`MODIFICA` (A deroga B y B deroga A).
  - `:Criterio` vigente que `INTERPRETA` una `:Norma` ya derogada.
- Marcado: a los nodos/relaciones afectados se les fija `revision_pendiente=true` + `motivo_conflicto`; opcionalmente se crea un nodo `(:Conflicto {tipo, detectado_en})` enlazado.
- **Acoplamiento con el dictamen:** si el lineage de una consulta toca un elemento marcado, el veredicto se degrada a `Condicional — requiere revisión` y se expone el conflicto al contador (que puede resolverlo vía Obsidian, cerrando el loop bidireccional).
- Ejecución: script `backend/scripts/diagnose-contradictions.js` (on-demand y/o tras cada seed/ingesta); resultados consultables vía `GET /api/grafo/conflictos`.

## Servicios Externos — Interoperabilidad A2A (Agent-to-Agent)

Grafo se expone al ecosistema como un **agente especializado en derecho fiscal**: otros agentes (p. ej. el *Agente de Estrategia* o el *Agente de Ejecución de Pólizas* de la visión) le consultan deducibilidad y reciben dictámenes **con evidencia**. La comunicación usa el estándar **A2A**.

### Interfaz A2A
- Grafo publica una **Agent Card** (`/.well-known/agent.json`) que declara su skill: `consultar_deducibilidad` (input: gasto/régimen/contexto; output: dictamen + lineage).
- Recibe **tasks** A2A entrantes (consultas) y devuelve **artifacts** A2A (dictámenes). Soporta intercambio síncrono y, para cargas pesadas, asíncrono reutilizando la cola BullMQ ya definida.
- Endpoints bajo `/.well-known/agent.json` y `/api/a2a/*`.

### A2A Adapter (capa de traducción — Adapter Pattern, módulo desacoplado)
**El exterior nunca ve Neo4j/Cypher ni el modelo interno.** Un adaptador aislado media entre el protocolo y el motor:
```
Mensaje A2A → [A2A Adapter] valida (Zod, schema A2A) → traduce a params internos
            → Cypher Query Service / inferenceEngine → dictamen + lineage
            → [A2A Adapter] serializa a artifact A2A → respuesta
```
- Módulo `backend/src/lib/a2a/` con: `protocol.js` (parse/serialize del estándar A2A), `a2aAdapter.js` (traducción bidireccional A2A ↔ dominio interno), `agentCard.js` (descriptor de capacidades).
- **Regla de desacople:** el `inferenceEngine` y el `cypherService` **no conocen A2A**; el Adapter depende de ellos, nunca al revés. Si A2A evoluciona (nueva versión/forma de mensaje), **solo cambia `backend/src/lib/a2a/`** — el motor legal no requiere tocar código. Versionado explícito (`A2A_PROTOCOL_VERSION`) y validación estricta de entrada.

### Seguridad y Confianza (Lineage obligatorio en cada respuesta)
- **Toda** respuesta A2A incluye el **Lineage (B2)**: la cadena de nodos/relaciones (con fuentes oficiales y vigencias) que justifica la conclusión. Un agente receptor puede auditar el porqué, no solo el veredicto.
- Respuestas degradadas por contradicción (B3) viajan con su flag `requiere_revision` para que el agente consumidor no actúe a ciegas.
- Autenticación de agentes pares (token/clave en el handshake A2A) y rate-limiting reutilizando el middleware existente. Las consultas A2A son de **solo lectura** sobre el grafo (no mutan el motor legal).

## MVP Roadmap (fases)

### Fase 0 — Cimientos (Neo4j + Prisma + config)
- `docker-compose.yml` con servicio Neo4j (5.x, puertos 7474/7687) y volumen.
- Backend: dependencia `neo4j-driver`; singleton `backend/src/lib/neo4j.js` (driver + helper `runQuery`). Singleton Prisma `backend/src/lib/prisma.js`.
- Extender `backend/src/config/index.js`: bloque `neo4j {uri,user,password}` y `obsidian {vaultPath,apiUrl,apiToken,mode}`.
- Extender `.env.example` con `NEO4J_URI/USER/PASSWORD`, `OBSIDIAN_VAULT_PATH`, `OBSIDIAN_API_URL`, `OBSIDIAN_API_TOKEN`.
- Prisma: añadir modelos `Cliente`, `ConceptoGasto`, `Consulta`, `Dictamen` a `backend/prisma/schema.prisma` (ver abajo). `prisma migrate dev`.

**Modelos Prisma nuevos (resumen):**
- `Cliente` — `id, nombre, regimenFiscal, ownerId(User), createdAt` (cartera del despacho).
- `ConceptoGasto` — `clave(unique), nombre, descripcion` (catálogo controlado; espejo de los `:ConceptoGasto` de Neo4j).
- `Consulta` — `id, userId, clienteId?, conceptoClave, regimen, contextoJson, createdAt`.
- `Dictamen` — `id, consultaId(unique), veredicto(enum DEDUCIBLE|NO_DEDUCIBLE|CONDICIONAL), rutaLegalJson(lineage), sustentoJson, pais, sourceVersion, estadoValidacion(enum PENDIENTE|VALIDADO|RECHAZADO), validadoPor?, validadoEn?, motivoRechazo?, pdfPath?, createdAt`.
- `FuentePais` — `id, pais(ISO-2), fuentes(String[] p.ej. ['LISR','CFF','Criterios_SAT_2026']), version, actualizadoEn` (registro de Fuentes de Verdad por jurisdicción).

### Fase 1 — Estructura del grafo + seed (empezar aquí, por petición)
- `backend/src/lib/graph/schema.cypher` — constraints e índices (un constraint por label sobre `id`; `clave` único en `:Gasto`/`:Regimen`).
- `backend/src/lib/graph/cypherQueries.js` — strings Cypher parametrizados (constantes nombradas). `backend/src/lib/graph/cypherService.js` — Cypher Query Service (API de negocio sobre el driver).
- `backend/scripts/seed-graph.js` + `backend/seed/normas_titulo_ii.json` — dataset curado para PM Título II (`:Gasto`: Viáticos, Servicios Profesionales, Equipo de Cómputo, Donativos, Intereses, etc.) con `:Norma`, `:Criterio`, vigencias y relaciones reales. El seed carga vía `cypherService.upsertNorma/mergeRelacion`.
- **Verificación:** `npm run seed:graph` y comprobar en Neo4j Browser (`http://localhost:7474`) que el grafo de Viáticos se visualiza con sus `:Norma`/`:Criterio` y relaciones.

### Fase 2 — Sincronización Bidireccional Obsidian ↔ Neo4j
- `backend/src/lib/obsidian/vaultSync.js` con `exportFromGraph()` (Neo4j → `.md`) e `importToGraph()` (`.md` → Neo4j), serializer de frontmatter + wikilinks y parser con `gray-matter`.
- `backend/src/lib/obsidian/conflict.js` — control de `graph_rev` y log de conflictos.
- `backend/scripts/sync-obsidian.js` — CLI `--export | --import | --both`.
- `backend/scripts/watch-obsidian.js` — watcher `chokidar` que dispara `importToGraph()` al guardar en Obsidian (debounce).
- Deps: `gray-matter`, `chokidar`. Env: `OBSIDIAN_SYNC_CONFLICT`.
- **Verificación (ida y vuelta):**
  1. `npm run sync:obsidian -- --export` → abrir vault en Obsidian, *Graph View* muestra `deroga/aplica_a`.
  2. En Obsidian, editar un `.md` (p. ej. cambiar `vigente_hasta` o agregar un wikilink `deroga::`) y guardar.
  3. Con el watcher activo (o `--import`), confirmar en Neo4j Browser que el nodo/relación se actualizó por `id`.
  4. Re-ejecutar un dictamen afectado y verificar que el veredicto refleja la edición hecha en Obsidian.

### Fase 3 — Motor de inferencia (Tax Logic Engine)
- **Paso 3.0 — Consulta de Prueba (gate antes de cualquier UI):** ejecutar, vía el Cypher Query Service, `getCadenaLegal({gasto:'VIATICOS', regimen:'PM_TITULO_II', fecha:hoy})` y confirmar que recupera la **cadena legal completa y vigente** (`:Gasto`→`:Norma`(vigente)→`:Criterio`, con `:DEROGA`/`:MODIFICA` aplicados). Script `backend/scripts/test-inference.js` que imprime la ruta. **No se construye frontend hasta que esta consulta retorne la cadena correcta.**
- `backend/src/lib/legal/sources/{types,MXLegalProvider,index}` — contrato `LegalSourceProvider` (Strategy) + impl. MX (LISR/CFF) + `LegalSourceFactory`. Las Fuentes de Verdad viven aquí, no en el motor.
- `backend/src/lib/graph/contextResolver.js` — Legal Context Resolver: `resolve({country})` obtiene el provider vía `LegalSourceFactory` → `{ namespace, sources, sourceVersion }`; dispara `autoResearchIngest` si la jurisdicción no está cargada. **V1: MX precargado.**
- `backend/src/lib/graph/inferenceEngine.js` — `resolverDictamen({gasto, regimen, contexto, fecha, country})`: primero llama al `contextResolver`, luego consume `cypherService.getCadenaLegal` (con `namespace`, que retorna el **`path`/lineage** completo) → `{veredicto, rutaLegal[] (lineage), sustento{topes,citas}, pais, sourceVersion}`. No contiene Cypher; orquesta, aplica reglas de veredicto/topes y **degrada a `Condicional — requiere revisión`** si el lineage toca un elemento con `revision_pendiente=true` (B3).
- `backend/scripts/diagnose-contradictions.js` + query `DETECTAR_CONTRADICCIONES` — Modo Contradicción (B3): marca nodos/relaciones inconsistentes. `GET /api/grafo/conflictos` los lista.
- `backend/src/routes/dictamen.js` — `POST /api/dictamen` (Zod: `gastoClave`, `regimen`, `contexto`), persiste `Consulta` + `Dictamen` vía Prisma, responde el dictamen 3-niveles. Registrar en `index.js`.
- `backend/src/routes/grafo.js` — `GET /api/grafo/gastos`, `GET /api/grafo/norma/:id` (para liga a fuente).
- **Verificación:** (1) `npm run test:inference` imprime la cadena legal de Viáticos; (2) `curl POST /api/dictamen` con Viáticos/PM-Título-II → veredicto + ruta + sustento en < 45 s.

### Fase 4 — Conectividad Agéntica (A2A)
- `backend/src/lib/a2a/{protocol.js,a2aAdapter.js,agentCard.js}` — adaptador desacoplado (no importa Neo4j; consume `inferenceEngine`/`cypherService`).
- `backend/src/routes/a2a.js` — `GET /.well-known/agent.json` (Agent Card), `POST /api/a2a/tasks` (recibe consulta A2A → dictamen+lineage como artifact), `GET /api/a2a/tasks/:id` (async vía BullMQ para cargas pesadas). Registrar en `index.js`.
- Validación estricta del mensaje entrante (Zod + `A2A_PROTOCOL_VERSION`); auth de agente par + rate-limit; **solo lectura** sobre el grafo.
- Cada respuesta incluye el **Lineage (B2)** y, si aplica, el flag `requiere_revision` (B3).
- **Verificación:** `curl GET /.well-known/agent.json` devuelve la skill `consultar_deducibilidad`; un `POST /api/a2a/tasks` con una consulta de Viáticos devuelve un artifact con veredicto **+ lineage completo**; simular bump de `A2A_PROTOCOL_VERSION` y confirmar que solo `lib/a2a/` cambia (el motor intacto).

### Fase 5 — Frontend: consulta + dictamen
- shadcn/ui init (Button, Card, Select, Badge, Form).
- `frontend/app/dashboard/consulta/page.tsx` — formulario **estructurado** (Select de régimen, Select de concepto desde catálogo, inputs de contexto/monto). Sin texto libre.
- `frontend/app/dashboard/dictamen/[id]/page.tsx` — vista 3 niveles: Veredicto (Badge color), Ruta legal (cadena con links a fuente), Sustento (topes).
- Extender `frontend/lib/api.ts`: `grafoApi`, `dictamenApi`, `clientesApi`.
- **Verificación (Playwright MCP):** login → consulta Viáticos → render del dictamen.

### Fase 6 — Export con Gate de Validación (Human-in-the-Loop)
- **Gate HITL (B1):** `POST /api/dictamen/:id/validar` (marca `VALIDADO`, registra `validadoPor`/`validadoEn`) y `POST /api/dictamen/:id/rechazar` (`RECHAZADO` + `motivoRechazo`). El export **devuelve 409 si no está `VALIDADO`**.
- Backend: `GET /api/dictamen/:id/export?format=pdf|json`. JSON = `sustentoJson` + lineage; PDF server-side (`pdfkit`/`@react-pdf/renderer`) guardado en `backend/storage/dictamenes/`; `pdfPath` en `Dictamen`. El PDF incluye la cadena de lineage (B2) y el sello de validación (quién/cuándo).
- Frontend: botón **"Revisé y valido"** (habilita exportar) → luego "Exportar Reporte de Sustento". Si el dictamen está degradado por contradicción (B3), se muestra el conflicto antes de permitir validar.
- **Verificación:** intentar exportar sin validar → 409; validar → PDF/JSON con lineage y sello; el JSON sirve como input agéntico (estructura estable).

### Fase 7 — Capa de Voz (Voice-to-Intent)
- Backend: `backend/src/lib/voice/sttService.js` (orquesta vía interfaz), `backend/src/lib/voice/stt/{index.js (factory),openAIWhisperProvider.js,localWhisperProvider.js(stub)}`, `backend/src/lib/voice/intentExtractor.js`, cola `backend/src/lib/voice/voiceQueue.js` (BullMQ) + worker `backend/src/workers/voiceWorker.js`.
- Rutas `backend/src/routes/voz.js`: `POST /api/voz/consulta` (multer → 202 + jobId), `GET /api/voz/job/:id` (polling), `POST /api/voz/feedback` (audio + dictamenId/nodoId → nota Obsidian + metadatos). Registrar en `index.js`.
- Frontend: componente de grabación (MediaRecorder) en `consulta/page.tsx` (botón micrófono) y en la vista de dictamen (feedback por voz). Extender `frontend/lib/api.ts` con `vozApi`.
- Deps: `openai` (Whisper), `multer`, `bullmq`, `ioredis`. Env: `STT_PROVIDER` (openai|local), `OPENAI_API_KEY`, `WHISPER_MODEL`, `LLM_*` (proveedor de extracción), `VOICE_MAX_AUDIO_MB`.
- **Verificación:** dictar "8 mil de viáticos para persona moral" → 202 con jobId → polling devuelve el mismo dictamen que el formulario; dictar un feedback → aparece la nota en el `.md` de Obsidian y el metadato en Neo4j.

### Fase 8 — (Post-MVP) Ingesta automatizada + Auto-Research multi-país
- Scrapers DOF/SAT/RMF como jobs que normalizan y hacen `upsert` al grafo (vía Cypher Query Service). **Fuera de V1.**
- `backend/src/lib/research/autoResearchIngest.js` — rutina on-demand disparada por el Context Resolver para **onboarding de una jurisdicción nueva**: descarga fuentes oficiales (PDF/Web) → normaliza → extrae nodos/relaciones (LLM) → `upsert` namespaced + actualiza `FuentePais.version/actualizadoEn`. Encolada en BullMQ.
- **V1 entrega solo MX (seed precargado); el resto de países llega por esta vía post-MVP.**

> **Asunción a confirmar:** la **Ingesta real (scrapers) queda fuera del MVP**; V1 arranca con el **dataset curado (seed)** para validar el motor de dictamen primero. Si prefieres un scraper funcional desde V1, lo movemos a Fase 1b.

---

## Mapa de archivos (nuevos / modificados)

**Nuevos — backend:** `docker-compose.yml` (raíz), `backend/src/lib/{neo4j.js,prisma.js}`, `backend/src/lib/graph/{schema.cypher,cypherQueries.js,cypherService.js,contextResolver.js,inferenceEngine.js}`, `backend/src/lib/legal/sources/{types,MXLegalProvider,index}`, `backend/src/lib/research/autoResearchIngest.js`, `backend/src/lib/obsidian/{vaultSync.js,conflict.js}`, `backend/src/lib/voice/{sttService.js,intentExtractor.js,voiceQueue.js}`, `backend/src/lib/voice/stt/{index.js,openAIWhisperProvider.js,localWhisperProvider.js}`, `backend/src/lib/a2a/{protocol.js,a2aAdapter.js,agentCard.js}`, `backend/src/workers/voiceWorker.js`, `backend/src/routes/{dictamen.js,grafo.js,clientes.js,voz.js,a2a.js}`, `backend/scripts/{seed-graph.js,test-inference.js,diagnose-contradictions.js,sync-obsidian.js,watch-obsidian.js}`, `backend/seed/normas_titulo_ii.json`.
**Modificados — backend:** `backend/prisma/schema.prisma`, `backend/src/config/index.js`, `backend/src/index.js`, `backend/package.json` (deps: `neo4j-driver`, `pdfkit`, `gray-matter`, `chokidar`, `openai`, `multer`, `bullmq`, `ioredis`; scripts `seed:graph`, `test:inference`, `diagnose:contradictions`, `sync:obsidian`, `watch:obsidian`, `worker:voice`), `.env.example` (`STT_PROVIDER`, `OPENAI_API_KEY`, `WHISPER_MODEL`, `VOICE_MAX_AUDIO_MB`, `A2A_PROTOCOL_VERSION`, `DEFAULT_COUNTRY`).
**Nuevos — frontend:** `frontend/app/dashboard/consulta/page.tsx`, `frontend/app/dashboard/dictamen/[id]/page.tsx`, componentes shadcn/ui.
**Modificados — frontend:** `frontend/lib/api.ts` (+`vozApi`), `frontend/package.json` (shadcn deps), componente de grabación (MediaRecorder) en consulta y dictamen.
**Raíz:** `PRP.md`, `BUSINESS_LOGIC.md` (pendiente de la sesión previa).

---

## Verificación end-to-end (criterio de aceptación)
1. `docker compose up neo4j` + `npm run seed:graph` → grafo poblado (Neo4j Browser).
2. `npm run sync:obsidian -- --both` → vault navegable en Obsidian (Graph View muestra relaciones); editar un `.md` y confirmar que el cambio vuelve a Neo4j (sync bidireccional).
3. Backend arriba → `POST /api/dictamen` (Viáticos, PM Título II) responde veredicto+ruta+sustento en < 45 s.
4. Frontend (Playwright MCP): consulta estructurada → dictamen 3-niveles (con lineage visible) → validar (HITL) → exportar PDF y JSON.
5. `npm run diagnose:contradictions` → inserta un conflicto de prueba y verificar que el dictamen afectado se degrada a `Condicional — requiere revisión` y que `GET /api/grafo/conflictos` lo lista.
6. Intentar exportar un dictamen sin validar → 409 (gate HITL activo).
7. A2A: `GET /.well-known/agent.json` expone la skill; `POST /api/a2a/tasks` (Viáticos) responde artifact con veredicto **+ lineage**; subir `A2A_PROTOCOL_VERSION` solo toca `lib/a2a/` (motor intacto).
8. Context Resolver: una consulta MX devuelve `pais:'MX'` + `source_version` (de `FuentePais`) en el dictamen; una consulta con `country` no cargado encola `autoResearchIngest` y responde `procesando_jurisdiccion` (no inventa).
9. KPIs V1: < 45 s, 80% conceptos Título II en el seed, export disponible en ≥ 70% del flujo.

---

## Decisiones abiertas (confirmar antes de ejecutar)
1. **Ingesta:** seed curado en V1 (recomendado) vs. scraper real desde V1.
2. **Obsidian:** sync por filesystem (recomendado) vs. plugin Local REST API.
3. **Auth:** dejar el `Map()` en memoria para V1 (recomendado) vs. cablear Prisma a las rutas de auth ahora.
4. **Conflictos de sync:** política por defecto `vault-wins` (la edición humana en Obsidian gana) vs. `graph-wins`.
5. **Capa de Voz:** ¿entra en V1 (Fase 7) o se difiere a V2? Añade dependencia de `OPENAI_API_KEY` y de un worker Redis corriendo. Recomendado: dejar el formulario estructurado como camino principal de V1 y la voz como fast-follow una vez validado el motor de dictamen.
6. **Proveedor NLP de extracción de entidades:** OpenAI vs. Claude (Anthropic) vs. OpenRouter — configurable; STT fijo en Whisper.

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece con cada error/decisión no obvia durante la implementación.

### 2026-06-07: El backend es JS/ESM, no TypeScript ni Supabase
- **Error/contexto**: El skill y el template asumen Next.js 16 + React 19 + Supabase + TypeScript (Golden Path). El scaffold real es **Express + Prisma + PostgreSQL + JWT** (backend JS/ESM) y **Next 14 + React 18** en el frontend.
- **Fix**: No migrar. Se añade Neo4j (grafo) y Obsidian (conocimiento) sobre el stack existente. Los contratos de interfaz se expresan con **JSDoc `@typedef` / `@implements`**, no con `.ts`.
- **Aplicar en**: cualquier módulo nuevo del backend → seguir el patrón `Router`+Zod+`asyncHandler` y JSDoc, no introducir toolchain TS.

### 2026-06-07: PRP/BUSINESS_LOGIC no se materializan solos
- **Error**: el contenido del plan vivía solo en `~/.claude/plans/`; `PRP.md` y `BUSINESS_LOGIC.md` no existían en el repo.
- **Fix**: materializar explícitamente los documentos en el repo y versionarlos.

---

## Gotchas

- [ ] **Cypher centralizado**: ninguna query fuera del Cypher Query Service (regla de oro). Evita inyección y dispersión.
- [ ] **Namespace por país viaja como parámetro**, nunca concatenado al Cypher.
- [ ] **Identidad por `id` (UUID)** en el sync Obsidian — nunca por nombre de archivo.
- [ ] **Neo4j y Redis** requieren `docker compose up` antes de seed/inferencia/voz.
- [ ] **A2A es solo lectura**: no debe mutar el grafo.

## Anti-Patrones

- NO exponer Neo4j/Cypher al exterior (siempre vía A2A Adapter / Cypher Service).
- NO generar un `Deducible` sin lineage (B2): path vacío ⇒ `Condicional`.
- NO permitir export de PDF sin validación humana (B1, gate 409).
- NO acoplar el motor de inferencia a un país, protocolo o proveedor de IA concretos (Strategy/Adapter en todos los bordes).

---

*PRP en progreso. Implementación fase por fase vía `/bucle-agentico`.*
