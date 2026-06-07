# BUSINESS_LOGIC.md — Grafo (Lógica de Negocio Fiscal)

> Memoria de dominio del proyecto. Origen: sesión de entrevista de negocio + [PRP-01](../PRPs/01-motor-legal.md).
> **Consultar ANTES de escribir o ejecutar cualquier query de Cypher** sobre el grafo legal.
>
> ⚠️ **Regla de oro**: las cifras legales concretas (topes, porcentajes, fechas de vigencia) NO viven aquí.
> Viven en el grafo Neo4j, sembradas desde fuentes oficiales (LISR / CFF / RMF / Criterios SAT) y citadas
> con su `source_version`. Este documento define la **estructura** del razonamiento, no la ley. No hardcodear
> cifras fiscales en código ni en este archivo.

---

## 1. Reglas de Deducibilidad

**Principio rector:** un gasto es **Deducible** solo si existe una **norma viva** (no derogada, vigente en la fecha
de la operación) que lo habilite, para el **régimen fiscal** del cliente. Si no, es **No Deducible**; si la norma lo
permite sujeto a límites/condiciones, es **Condicional**.

**Veredictos posibles** (Nivel 1 del dictamen):
| Veredicto | Significado |
|---|---|
| `DEDUCIBLE` | Existe base legal vigente que habilita el gasto sin restricción pendiente. |
| `NO_DEDUCIBLE` | Norma vigente lo prohíbe, o no existe base que lo habilite. |
| `CONDICIONAL` | Permitido sujeto a topes/condiciones, o degradado por contradicción/revisión pendiente. |

**Estructura de una regla** (en el grafo, relación `(:Norma)-[:APLICA_A]->(:Gasto)`):
- `regimen` — régimen al que aplica la regla.
- `tope_monto` / `tope_pct` — límites cuantitativos **(valor real desde la fuente oficial, no aquí)**.
- `condicion` — requisito cualitativo (ver abajo).
- Vigencia resuelta vía `DEROGA` / `MODIFICA` (`fecha_efecto <= fecha de la operación`).

**Tipos de condición que el grafo modela** (categorías; el detalle exacto se valida contra LISR/CFF/RMF):
- Requisitos de comprobación fiscal (p. ej. CFDI válido).
- Forma/medio de pago.
- "Estricta indispensabilidad" del gasto para la actividad (principio general LISR).
- Topes por monto, porcentaje o periodo.

**Catálogo de conceptos de gasto V1** (PM Título II; claves = `:Gasto.clave`, espejo de `MXLegalProvider`):
`VIATICOS`, `SERVICIOS_PROFESIONALES`, `EQUIPO_DE_COMPUTO`, `DONATIVOS`, `INTERESES`, `COMBUSTIBLES`, `ARRENDAMIENTO`.
> Las reglas concretas (topes/%/condiciones) de cada uno **se pueblan en el seed** del grafo y se citan con `source_version`.
> Pendiente: validar cada regla contra la fuente oficial antes de producción.

---

## 2. Entidades de Negocio

| Entidad | Definición de negocio |
|---|---|
| **Persona Moral (Título II)** | Contribuyente regido por el Título II de la LISR (sociedades/empresas). Régimen objetivo de V1: `PM_TITULO_II`. |
| **Régimen Fiscal** | Marco que determina qué reglas de deducibilidad aplican. Nodo `:Regimen`. |
| **Gasto / Concepto de Gasto** | Erogación deducible candidata, de un **catálogo controlado** (no texto libre). Nodo `:Gasto`. |
| **Viáticos** | Gastos de traslado/representación de personal; deducibilidad sujeta a topes y comprobación. |
| **Servicios Profesionales** | Honorarios por servicios; condiciones de comprobante y, en su caso, retención. |
| **Equipo de Cómputo** | Activo deducible vía depreciación/condiciones específicas. |
| **Norma** | Ley, artículo o regla RMF. Nodo `:Norma` con vigencia (`vigente_desde/hasta`) y `fuente_url`. |
| **Criterio (SAT)** | Interpretación oficial que matiza una norma. Nodo `:Criterio` (`INTERPRETA` una `:Norma`). |
| **Vigencia** | Estado temporal de una norma; clave para descartar normas derogadas. |
| **Contador Público Senior** | Usuario primario. Human-in-the-Loop de alta autoridad: valida y **firma** el dictamen. |
| **Cliente (del despacho)** | Empresa atendida por el contador, con su régimen fiscal asociado. |
| **Dictamen de Soporte** | Salida del motor: veredicto + ruta legal (lineage) + sustento. Estados de validación: `PENDIENTE/VALIDADO/RECHAZADO`. |
| **Reporte de Sustento** | Export (PDF/JSON) del dictamen validado; prueba de debida diligencia. |
| **Lineage** | Cadena de nodos/relaciones que justifica el veredicto; obligatorio en toda respuesta. |
| **source_version** | Última actualización de la base de conocimiento de la jurisdicción consultada. |

---

## 3. Flujos de Decisión (la lógica que sigue el contador / el motor)

El sistema es un **copiloto**: propone el sustento, el contador firma. Flujo:

1. **Entrada estructurada** — el contador (o voz/A2A) especifica: `régimen` del cliente, `concepto de gasto`
   (del catálogo) y `contexto` (monto, fecha). Sin texto libre ambiguo.
2. **Resolución de contexto legal** — el `ContextResolver` detecta país, carga las Fuentes de Verdad y fija el
   `namespace` del grafo (V1: MX). De aquí sale el `source_version`.
3. **Recorrido del grafo (Tax Logic Engine, vía Cypher Query Service)**:
   - Partir del `:Gasto` → encontrar `:Norma` aplicables por `APLICA_A` filtradas por `regimen`.
   - Resolver **vigencia**: seguir `MODIFICA`/`DEROGA` con `fecha_efecto <= fecha`; descartar normas con `vigente_hasta < fecha`.
   - Anexar `:Criterio` relevantes vía `INTERPRETA`.
4. **Determinación del veredicto** — `DEDUCIBLE` / `NO_DEDUCIBLE` / `CONDICIONAL`, aplicando topes/condiciones de la
   regla, y construyendo el **lineage** (la justificación auditable). Sin lineage no hay `DEDUCIBLE`.
5. **Blindaje** — si el lineage toca un elemento marcado por el Modo Contradicción, degradar a
   `CONDICIONAL — requiere revisión` y exponer el conflicto.
6. **Human-in-the-Loop** — el contador revisa el dictamen y la ruta legal. Puede **validar** (firma) o **rechazar**
   (con motivo) o profundizar/editar la lógica en Obsidian (sync bidireccional al grafo).
7. **Export** — solo tras validación: genera el Reporte de Sustento (PDF/JSON) con lineage y `source_version`.

> El criterio profesional del contador es la autoridad final. El motor nunca firma; entrega evidencia trazable.

---

## 4. Protocolo pre-commit (OBLIGATORIO)

> Antes de **cada `git commit`**, el agente debe ejecutar este checklist. No es opcional:
> es la forma de mantener la memoria del proyecto sincronizada con el código.

1. **`BUSINESS_LOGIC.md`** — ¿cambió alguna **regla de negocio, restricción o supuesto fiscal** con este cambio?
   (ej. un nuevo tope, una condición de deducibilidad, un nuevo veredicto, un régimen soportado).
   → Si sí, **actualiza este archivo** para que refleje la nueva realidad antes de commitear.

2. **[`PRP-01`](../PRPs/01-motor-legal.md)** — ¿se **completó una fase o sub-tarea** del Product Requirements Proposal?
   → Marca el progreso (estado/avance) y **ajusta el alcance** si cambió.

3. **`.claude/memory/`** — ¿**aprendimos algo nuevo**? (un error que encontramos y su fix, una limitación de Cypher,
   una mejor forma de hacer el mock, una decisión de diseño no obvia).
   → **Crea o actualiza** un archivo en `.claude/memory/` con ese aprendizaje, para no volver a resolverlo.
   Registra también el aprendizaje en la sección *Aprendizajes (Self-Annealing)* del PRP si aplica.

4. **Resumen de cambios** — genera un **mensaje de commit breve** que incluya explícitamente
   **qué parte del sistema** se vio impactada (ej. `motor de inferencia`, `grafo/Cypher`, `Neo4jService/mock`,
   `Legal Source Provider`, `docs/PRP`, `seed`). Usa el formato `tipo(área): resumen`.

> Para volverlo *forzoso* (no solo documentado), se puede añadir un hook `pre-commit` en `.claude/settings.json`
> vía `/update-config`. Mientras tanto, este checklist es la fuente de verdad del proceso.

---

*Memoria de dominio. Mantener sincronizada con el seed del grafo y con [PRP-01](../PRPs/01-motor-legal.md).*
