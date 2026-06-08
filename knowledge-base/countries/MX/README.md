# countries/MX/ — México

Reglas fiscales mexicanas: base **LISR** (Ley del ISR) + **CFF** (Código Fiscal de la
Federación) + **Criterios Normativos del SAT**.

Provider de código: `backend/src/lib/legal/sources/MXLegalProvider.js` (registrado en la
factory). `source_version` actual: `SAT/RMF 2026 (LISR+CFF DOF 2026-01-01)`.

Régimen soportado en V1: `PM_TITULO_II` (Personas Morales, Título II LISR).

Cada norma/criterio/deducción es una nota `.md` con frontmatter (`id`, `clave`,
`vigente_desde`/`vigente_hasta`, `fuente_url`, `source_version`). Antes de tocar reglas,
consultar `.claude/memory/BUSINESS_LOGIC.md`.
