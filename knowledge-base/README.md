# knowledge-base/ — Bóveda de conocimiento (Fuente de Verdad)

Ubicación **oficial** de la bóveda de conocimiento de Grafo: la fuente de verdad de
las reglas fiscales (normas, criterios, deducciones y lógica de negocio) desde la
que se siembra el grafo legal (Neo4j) y contra la que se audita el código.

Vive **dentro del repositorio** y se referencia por ruta **relativa** (`./knowledge-base`)
para que funcione igual en tu máquina y en el servidor del cliente, sin rutas absolutas
que cambien entre entornos.

## Estructura

```
knowledge-base/
├── countries/
│   ├── MX/      ← reglas fiscales de México (LISR, CFF, Criterios SAT)
│   └── CO/      ← reglas fiscales de Colombia (scaffold; provider aún no registrado)
└── global/      ← conocimiento transversal a jurisdicciones (entidades, flujos, conceptos)
```

Cada nota es un `.md` con frontmatter. La **identidad** es el `id` (UUID en frontmatter),
**nunca** el nombre de archivo. Política de conflicto: `vault-wins`.

```yaml
---
id: <uuid>
clave: VIATICOS
vigente_desde: 2026-01-01
vigente_hasta: null
fuente_url: https://...
source_version: SAT/RMF 2026 (LISR+CFF DOF 2026-01-01)
---
```

## Configuración

- El backend la localiza vía `KNOWLEDGE_BASE_PATH` (ver `.env` / `.env.example`),
  expuesta en `backend/src/config/index.js` como `config.knowledgeBase`.
- El mapeo bóveda ↔ código vive en `.claude/obsidian_sync.json`.

## Regla de Oro

Todo cambio de código que afecte una regla fiscal (tope, condición, vigencia, veredicto,
norma/criterio) actualiza la nota correspondiente aquí — y viceversa. Una tarea no está
"Terminada" si el código y la bóveda no coinciden.
