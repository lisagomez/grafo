---
marp: true
theme: default
paginate: true
header: "Grafo · Motor de Inteligencia Fiscal"
---

<!-- _paginate: false -->
<!-- _header: "" -->

# Grafo
## El copiloto fiscal que **firma con evidencia**, no con suposiciones

Motor de inteligencia fiscal basado en grafos para despachos contables.

*Determine la deducibilidad de cualquier gasto — con la ley vigente citada — en menos de 45 segundos.*

---

## El problema

Hoy, saber si un gasto es deducible es **manual, fragmentado y de alto riesgo.**

- Portales gubernamentales **desactualizados** y leyes entrelazadas.
- **Asimetría de información**: ¿qué ley se derogó? ¿qué resolución reciente cambió la regla?
- El error se traduce en **contingencias fiscales, multas y pérdida de beneficios.**

> El contador no necesita más información. Necesita **certeza trazable.**

---

## Lo que cuesta (hoy, sin Grafo)

| Dimensión | Impacto |
|---|---|
| ⏱️ **Tiempo** | 5–10 h/semana por profesional buscando y validando vigencia normativa. |
| ⚖️ **Riesgo** | Multas del **20%–100%** del impuesto omitido por una deducción mal sustentada. |
| 📈 **Crecimiento** | El despacho no escala: cada cliente nuevo es más carga manual. |

---

## La solución

**Un motor de inteligencia fiscal que mapea, vincula y valida la vigencia de las normas para automatizar la decisión de deducibilidad — con trazabilidad total.**

Grafo es un **copiloto**, no un robot que decide:
el sistema entrega la **evidencia**, el contador **firma el criterio.**

---

## Cómo funciona

```
1. Consulta estructurada     → régimen + concepto de gasto + monto/fecha
2. Recorrido del grafo legal → norma vigente a la fecha (descarta lo derogado)
3. Dictamen trazable         → Veredicto + Ruta Legal + Sustento
4. Validación humana         → el contador revisa, firma y exporta
```

Sin texto libre ambiguo. Sin "según mi experiencia". **Con la ley citada.**

---

## El diferenciador: **Trazabilidad total**

Cada dictamen llega con su **cadena de sustento (lineage)**:

`Gasto → Art. 28 LISR (vigente) → Criterio SAT 2026`

- Cada eslabón **enlaza a su fuente oficial.**
- Cada respuesta cita su **`source_version`** (qué edición de la ley se usó).
- **Sin sustento no hay "Deducible"**: si la base es ambigua, el veredicto es *Condicional*.

> No es una opinión. Es **prueba de debida diligencia.**

---

## Confiabilidad por diseño

- 🗓️ **Vigencia exacta por fecha** — usa la norma viva en la fecha de la operación; ignora lo derogado y lo aún no vigente.
- 🛡️ **Auditor de integridad proactivo** — detecta normas huérfanas o inconsistentes **antes** de emitir un dictamen.
- 🧑‍⚖️ **Human-in-the-Loop** — el sistema sustenta; **el contador firma.** El cliente paga por su criterio, no por un bot.

---

## El Dictamen de Soporte (lo que recibe el contador)

**Tres niveles, accionables:**

1. **Veredicto** — `Deducible` / `No Deducible` / `Condicional`.
2. **Ruta legal** — la cadena de normas vigentes, enlazada a la fuente.
3. **Sustento** — topes, condiciones y criterios aplicables.

➡️ Exportable como **Reporte de Sustento** (PDF para el archivo del despacho, JSON para integraciones).

---

## Para quién

**El Contador Público Senior de un despacho externo.**

- Gestiona múltiples clientes con regímenes distintos → paga un alto **"costo de contexto"**.
- Es la autoridad final: valida y firma.
- Con Grafo: **menos horas de búsqueda, más capacidad de atender clientes, cero adivinanzas.**

---

## El valor, en números (objetivo V1)

| KPI | Meta |
|---|---|
| ⚡ Velocidad | Dictamen con ruta legal en **< 45 segundos** (−90% vs. manual) |
| 🎯 Cobertura | **80%** de los conceptos de gasto recurrentes (Personas Morales) |
| 📄 Adopción | **≥ 70%** de las consultas terminan en un Reporte de Sustento entregable |

---

## La visión

Grafo es la **única fuente de verdad fiscal** sobre la que se construye un ecosistema:

- 🌎 **Multi-jurisdicción** — arquitectura lista para escalar a más países.
- 🤖 **Interoperable (A2A)** — otros agentes (estrategia fiscal, generación de pólizas) consultan a Grafo y reciben dictámenes **con evidencia**.
- 🔭 **Conocimiento navegable** — el grafo legal se explora y corrige visualmente.

---

## Hacia dónde vamos

- ✅ **Núcleo validado** — motor de inferencia por vigencia + auditoría de integridad + trazabilidad por `source_version`.
- 🔜 **Piloto** — catálogo de gastos de Personas Morales (Título II), consulta y dictamen end-to-end.
- 🚀 **Escala** — más conceptos, más regímenes, ingesta automatizada de normativa.

---

<!-- _header: "" -->

# Grafo

## De horas de incertidumbre → a **45 segundos con evidencia.**

**¿Construimos el piloto con su despacho?**

*Hablemos.*
