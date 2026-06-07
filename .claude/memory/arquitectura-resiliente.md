# Arquitectura Resiliente — Lógica de negocio independiente de la infraestructura

> Aprendizaje del proyecto (Fase 0/1). Fecha: 2026-06-07.
> **Lección central: La lógica de negocio debe ser testeable independientemente de la infraestructura.**

## Contexto

El entorno de desarrollo **no tiene Docker ni un Neo4j local** (puertos 7687/7474 cerrados).
Aun así había que construir y **validar** el grafo legal y el motor de inferencia. La respuesta fue
desacoplar la lógica de la base de datos, no esperar a tener la infraestructura.

## Patrón 1 — Mocking inyectable (`Neo4jService`)

Una interfaz única (`backend/src/lib/graph/Neo4jService.js`) con dos implementaciones intercambiables:

- **`RealNeo4jService`** — delega en el Cypher Query Service (Neo4j real).
- **`MockNeo4jService`** — responde el **mismo contrato** desde datos en memoria. Carga fixtures con
  `MockNeo4jService.fromFile(path)` o recibe el dataset por constructor.

El motor recibe el servicio por **inyección de dependencias (constructor)**:
`new InferenceEngine(service)`. No sabe si detrás hay Neo4j o un mock → **hoy corre con mock, mañana
con Neo4j, sin cambiar una línea del motor**.

```
InferenceEngine(service) ──► service.getCadenaLegal({gasto, regimen, pais})
                              ├── RealNeo4jService  → Cypher → Neo4j
                              └── MockNeo4jService   → fixture JSON en memoria
```

## Patrón 2 — Validación sin dependencias (`node:test`)

Los tests usan el **runner nativo `node --test`** (Node ≥18) + `node:assert`. **Cero dependencias** de
testing añadidas (sin Jest/Vitest). Script: `"test": "node --test tests/"`.
Esto valida la lógica (vigencia, veredicto, mapeo de `source_version`, lint de Cypher) sin DB ni toolchain.

El fixture **"Triángulo Fiscal"** (`tests/fixtures/fiscal_data.json`) — tres versiones temporales de una
norma con vigencias que no se solapan — permite probar que el motor selecciona **exclusivamente** la
versión vigente a la fecha de la consulta.

## Lección aprendida

**La lógica de negocio debe ser testeable independientemente de la infraestructura.**
Si el código de dominio depende directamente de una DB/servicio externo, no se puede validar sin él y el
desarrollo se bloquea. Con interfaces + inyección + mocks, la lógica se prueba siempre y la infraestructura
se conecta cuando esté disponible.

## Cómo aplicarlo (regla para módulos nuevos)

- Todo motor/servicio depende de una **interfaz inyectable**, nunca de la implementación concreta.
- Provee siempre un **mock** que cumpla el mismo contrato y pueda cargar fixtures.
- Escribe tests con `node:test` que corran **sin** infraestructura externa.
- Relacionado: [[BUSINESS_LOGIC]] (protocolo pre-commit) y PRP-01 (Aprendizajes / Self-Annealing).
