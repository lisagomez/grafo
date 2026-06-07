---
name: graph-auditor-factory
description: |
  Auditoría proactiva de integridad en grafos (Neo4j). Inyecta en cualquier proyecto un
  GraphAuditor desacoplado que detecta nodos huérfanos y inconsistencias de versión/vigencia
  ANTES de ejecutar la lógica de negocio, más un CLI (scripts/audit.js) con exit codes.
  Activar cuando el usuario dice: auditar grafo, integridad del grafo, gastos huérfanos,
  nodos huérfanos, consistencia de versiones, audita Neo4j, graph auditor, o /graph-auditor-factory.
argument-hint: "[auditar | install]"
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

# Skill: Graph Auditor Factory

> Auditoría proactiva de integridad de grafos (Neo4j). Modo: `$ARGUMENTS`

Inyecta un **auditor de grafo desacoplado** que valida la integridad estructural ANTES de la
inferencia/lógica de negocio. Nace del motor fiscal "Grafo" (ver `services/GraphAuditor.js` y
`scripts/audit.js` de este repo); esta skill lo hace portable a otros proyectos.

## Modos

- **`/graph-auditor-factory auditar`** → ejecuta la auditoría en el proyecto actual:
  `node scripts/audit.js` (o `backend/scripts/audit.js`). Si no está instalado, primero instala (abajo).
- **`/graph-auditor-factory install`** (o sin args) → instala/inyecta el auditor en el proyecto.

## Qué entrega

1. `services/GraphAuditor.js` — clase con dos métodos, reporte estándar `{ status, issues, count }`:
   - **`detectarOrfanos({pais, fecha})`** — nodos de entrada (p. ej. `:Gasto`) sin relación a una
     norma/regla vigente: `SIN_NORMA` (sin arista) o `SIN_VIGENTE` (todas fuera de vigencia a la fecha).
   - **`validarConsistenciaVersiones({pais})`** — discrepancias `source_version` ↔ vigencia:
     `VENTANA_INVALIDA`, `VIVA_DEROGADA`, `SOURCE_MISMATCH`, `SIN_SOURCE_VERSION`.
2. `scripts/audit.js` — CLI con colores; **exit 1** si hay incidencias, **0** si limpio. Acepta `--data=ruta.json`.

Templates canónicos (copiar tal cual):
- [`references/GraphAuditor.template.js`](references/GraphAuditor.template.js) — el auditor (sin imports externos).
- [`references/Neo4jService.template.js`](references/Neo4jService.template.js) — dependencia mínima portable (Real + Mock, solo `exportGrafo` + conectividad).
- [`references/audit.template.js`](references/audit.template.js) — el CLI portable (importa los otros dos vía `./`, lee credenciales de env; sin ediciones).

## Configuración del Entorno

Requisitos del proyecto destino ANTES de instalar (evita errores CJS/ESM y de conexión):

- **`"type": "module"` en `package.json`** — OBLIGATORIO. Los templates son ESM (`import/export`); sin esto
  Node lanza `Cannot use import statement outside a module` / `ERR_REQUIRE_ESM`. *(Alternativa: renombrar los
  archivos a `.mjs`, o convertir a CommonJS al copiar.)*
- **Node ≥ 18** (usa `node:fs/promises` y, opcional, `node --test`). Verificar: `node -v`.
- **Dependencia npm**: `npm install neo4j-driver` (única).
- **Variables de entorno** (las consume `RealNeo4jService`; ponlas en `.env` / entorno):

  | Variable | Requerida | Ejemplo | Uso |
  |---|---|---|---|
  | `NEO4J_URI` | ✅ | `bolt://localhost:7687` (o `neo4j+s://...` en Aura) | Endpoint del grafo |
  | `NEO4J_USER` | ✅ | `neo4j` | Usuario |
  | `NEO4J_PASSWORD` | ✅ | `••••••` | Contraseña |
  | `NEO4J_DATABASE` | ⬜ | `neo4j` | Base (default `neo4j`) |
  | `DEFAULT_COUNTRY` | ⬜ | `MX` | País a auditar (filtro `pais`) |

  > Sin Neo4j arriba, la auditoría corre en **modo mock** con `--data=ruta.json` (no requiere las `NEO4J_*`).

## Instalación (pasos para el agente)

### 1. Dependencia npm
- **`neo4j-driver`** (ÚNICA): `npm install neo4j-driver`. Si falta → `Cannot find module 'neo4j-driver'`.
- (Entorno/ESM/env vars → ver [Configuración del Entorno](#configuración-del-entorno) arriba.)
- **Sin otras dependencias**: `GraphAuditor.template.js` y `Neo4jService.template.js` no importan nada del
  proyecto Grafo — son **autónomos** (solo `neo4j-driver`). Por eso se evita el `module not found` por rutas internas.

### 2. Contrato `Neo4jService` (inyección — clave del desacople)
El auditor NO habla con Neo4j directamente: recibe por **constructor** un servicio que expone
`exportGrafo(pais) => Promise<{ regimenes, gastos, normas, criterios, relaciones }>`
(nodos con sus props; relaciones `{tipo, fromVal, toVal, props}`).

**Usa el template portable** [`references/Neo4jService.template.js`](references/Neo4jService.template.js):
trae `RealNeo4jService` (dump Cypher) y `MockNeo4jService` (dataset JSON, audita **sin Neo4j**), sin
dependencias del proyecto Grafo. Si tu proyecto YA tiene capa Neo4j, basta con añadirle un método `exportGrafo`.

### 3. Inyectar en el flujo de trabajo existente

> **Verificado con un dry-run en proyecto vacío:** los 3 templates funcionan **sin editar imports**.
> Importan entre sí por ruta relativa (`./`) y leen credenciales de env. Solo deben quedar **en la MISMA carpeta**.

1. Copia los **3 archivos a UNA carpeta** (p. ej. `src/graph-audit/`), conservando los nombres `*.js`:
   - `references/GraphAuditor.template.js`   → `GraphAuditor.js`
   - `references/Neo4jService.template.js`   → `Neo4jService.js`
   - `references/audit.template.js`          → `audit.js`
2. **No hay imports que editar** — `audit.js` ya importa `./GraphAuditor.js` y `./Neo4jService.js`.
   (Si los pones en carpetas distintas, ajusta solo esas dos rutas relativas.)
3. Añade el npm script: `"audit": "node src/graph-audit/audit.js"` y define las env `NEO4J_*`
   (ver [Configuración del Entorno](#configuración-del-entorno)). Sin Neo4j, usa `--data=fixture.json`.
4. **Engánchalo** en uno o varios puntos:
   - **Post-seed / post-ingesta**: correr `npm run audit` tras poblar el grafo.
   - **Pre-commit / CI**: como gate (el exit code 1 frena el pipeline si hay incidencias).
   - **Pre-inferencia**: invocar `detectarOrfanos()` / `validarConsistenciaVersiones()` antes de confiar
     en resultados del motor; degradar/abortar si `status === 'error'`.

### 4. Configurar los dos reportes
El auditor asume un dominio tipo "norma temporal" (propiedades `vigente_desde`, `vigente_hasta`,
`source_version`; nodos `:Gasto`/`:Norma`; relación `APLICA_A`). Para otro dominio, ajusta en
`GraphAuditor.js`:

- **Gastos huérfanos** (`detectarOrfanos`): cambia el label de nodo de entrada (`gastos`) y el tipo de
  arista (`APLICA_A`) por los de tu grafo. Cambia `_vigente()` si tu vigencia usa otros campos.
- **Consistencia de versiones** (`validarConsistenciaVersiones`): adapta los `tipo` de issue y los
  campos comparados. Mantén el invariante central: **el `source_version` de un nodo debe ser coherente
  con su ventana de vigencia, y la arista no debe citar una versión distinta a la del nodo**.
- El reporte SIEMPRE devuelve `{ status: 'ok'|'error', issues: [], count }` — no romper ese contrato
  (de él dependen el CLI y los exit codes).

### 5. Verificar (smoke test sin Neo4j)
- `node audit.js --data=clean.json` (gasto con norma vigente) → **exit 0** (`✓ Auditoría OK`).
- `node audit.js --data=broken.json` (gasto sin norma) → **exit 1** (`✗ Auditoría FALLÓ`).
- `node audit.js` sin env ni `--data` → **exit 2** (`✗ Sin fuente de datos`).
- Con Neo4j real: definir `NEO4J_URI/USER/PASSWORD` → modo `GRAFO`.
- (Opcional) Tests `node --test` con un `MockNeo4jService` inyectado (casos `ok`/`error`).

## Manual de Resolución

> **Este manual ES el "system prompt" de remediación.** Cuando la auditoría falla (`status: 'error'`), el
> agente carga estas instrucciones para **sugerir** soluciones al usuario. El script `scripts/audit.js`
> es determinista (solo detecta y reporta); la *interpretación y propuesta de fixes* la hace el agente
> usando ESTE manual como fuente de verdad. NUNCA se corrige el grafo sin confirmación (Human-in-the-Loop).

Mapeo incidencia → soluciones a ofrecer (presenta **ambas opciones** y deja elegir al usuario):

| Incidencia detectada | Opción A | Opción B |
|---|---|---|
| **Gasto Huérfano** (`SIN_NORMA` / `SIN_VIGENTE`) | **Crear relación manual**: `MERGE` de un `APLICA_A` del gasto a una norma vigente existente. | **Importar norma faltante**: correr la ingesta/seed para traer la norma que falta y luego relacionarla. |
| **Versión Inconsistente** (`VENTANA_INVALIDA` / `VIVA_DEROGADA` / `SOURCE_MISMATCH` / `SIN_SOURCE_VERSION`) | **Actualizar fecha de vigencia**: `SET` de `vigente_desde`/`vigente_hasta` para cerrar/corregir la ventana. | **Re-mapear versión**: alinear el `source_version` del nodo y de la arista a la versión correcta. |

**Protocolo del agente al encontrar errores:**
1. Mostrar el reporte de `scripts/audit.js` agrupado por tipo.
2. Por cada incidencia, ofrecer **Opción A** y **Opción B** (arriba) con la consulta Cypher `MERGE`/`SET`
   concreta que la aplicaría.
3. Esperar la elección del usuario. **Ejecutar la corrección SOLO tras su OK**, vía la capa de escritura del
   grafo (nunca editar a mano en producción).
4. Re-correr `npm run audit` para confirmar que la incidencia se resolvió (`status: 'ok'`).

## Troubleshooting

- **`Cannot find module 'neo4j-driver'`** → falta `npm install neo4j-driver` en el proyecto destino.
- **`Cannot find module './GraphAuditor.js'` / `'./Neo4jService.js'`** → los 3 archivos no están en la misma
  carpeta (o renombraste mal). Ponlos juntos o ajusta las 2 rutas relativas en `audit.js`.
- **`exit 2` / "Sin fuente de datos"** → ni hay `NEO4J_*` válidas ni pasaste `--data=`. Define las env o usa mock.
- **`ERR_REQUIRE_ESM` / `Cannot use import statement outside a module`** → falta `"type": "module"` en
  `package.json` (o convierte los templates a CommonJS).
- **`ECONNREFUSED 127.0.0.1:7687`** → Neo4j no está arriba. La auditoría puede correr en **modo mock**
  (`--data=ruta.json`) para validar la lógica sin la DB.
- **Reporte vacío pese a tener datos** → revisa que los nodos tengan la propiedad `pais` y que coincida con
  el país consultado (el `exportGrafo` filtra por `pais`).

## Reglas
- El auditor es **independiente y desacoplado**: NO debe modificar el motor de inferencia.
- Toda detección es **proactiva** (antes de la inferencia); el auditor **reporta** y el agente **propone**
  correcciones (ver Remediación), pero NO modifica el grafo sin confirmación del usuario.
- Respetar el contrato de reporte `{ status, issues, count }` y los exit codes (0 limpio / 1 con incidencias).
