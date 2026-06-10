# rules.md — Criterios de validación del vault-gate

> Lo que `npm run audit:vault` (→ `loadCountryRules` + `parseRuleNote` de
> `backend/src/lib/knowledge-engine.js`) exige a cada nota de `deducciones/`.
> El pre-curator debe cumplirlos **mientras cura**, no corregirlos después.
> Fuente de verdad: el código del motor; si el motor cambia, regenerar este archivo.

## 1. Criterios BLOQUEANTES (exit 1 del gate)

Una bóveda con notas que incumplan cualquiera de estos puntos **bloquea el deploy**:

| # | Criterio | Warning que emite el motor |
|---|---|---|
| B1 | El frontmatter debe traer `id` (UUID estable; la identidad NUNCA es el nombre de archivo). | `nota sin 'id' (UUID) en el frontmatter.` |
| B2 | La nota debe tener una sección con encabezado `Pseudocódigo de Grafo` (`#`..`######`; el matcheo es insensible a mayúsculas y acentos) y la sección no puede estar vacía. | `falta la sección 'Pseudocódigo de Grafo'.` |
| B3 | El pseudocódigo debe producir **al menos una arista válida** con la forma `(Origen) -[RELACION]-> (Destino)`. | `el Pseudocódigo de Grafo no produjo aristas válidas.` |
| B4 | **Ninguna arista en el limbo**: toda relación debe mapear a un veredicto. Solo existen `ES_DEDUCIBLE_SI` → `DEDUCIBLE` y `NO_ES_DEDUCIBLE_SI` → `NO_DEDUCIBLE`. Cualquier otra relación (p. ej. `APLICA_A`, `REQUIERE`) deja `effect=null` ⇒ no-op silencioso ⇒ **bloqueo**. | `relación no reconocida '<REL>' (sin veredicto, effect=null) en » <arista>` |
| B5 | La carpeta del país debe existir en `knowledge-base/countries/<ISO>/`. ISO vacío o país inexistente = error duro. | `no hay bóveda para '<ISO>' ...` |

**Distinción estructural del gate:** país con `count === 0` (sin notas) = **vacío permitido**
(informativo, exit 0); país con `count > 0` y cualquier warning = **bloqueo** (exit 1).
Corolario: en cuanto escribes la **primera** nota de un país, toda la carpeta debe estar impecable.

## 2. Sintaxis que el parser acepta (y nada más)

### Frontmatter — YAML **llano** (sin anidación)
- Solo pares `clave: valor` de una línea; claves `[A-Za-z0-9_-]+`. Listas SOLO inline: `regimenes: [A, B]`.
- `''` o `null` (con o sin comillas) ⇒ `null`. Comillas externas se quitan.
- Claves que el motor lee: `id`, `clave`, `regimen`/`regimenes`, `vigente_desde`, `vigente_hasta`, `fuente_url`, `source_version`. Claves extra (p. ej. `estado: pre-curado`) se ignoran sin error — por eso los borradores son seguros.

### Pseudocódigo de Grafo
- Una arista por línea: `(Origen) -[RELACION]-> (Destino)` + propiedades opcionales `{key: val, ...}`.
- Puede ir dentro de un fence ``` o sin él; líneas vacías y comentarios `//` o `#` se ignoran.
- La relación se normaliza a MAYÚSCULAS. Los nombres de nodo admiten `Nodo:Etiqueta` (hoy el parser
  guarda el texto completo sin separar etiqueta — deuda TD-1, no "corregirlo" en la nota).
- **Toda línea que no matchee el formato se descarta en silencio** — el gate no la ve, pero la regla
  pierde lógica. El pre-curator debe listar las líneas descartadas en el Manifiesto de Cambio.
- Propiedades de arista: `{tope: 1500, moneda: MXN}` → números/booleanos tipados, resto string.

### Secciones que el motor extrae del cuerpo
- `Contexto Legal` y `Regla Lógica` (mismo matcheo de encabezados, insensible a acentos/mayúsculas).
  No bloquean el gate si faltan, pero sin ellas el dictamen pierde trazabilidad → el pre-curator
  SIEMPRE las incluye.

## 3. Criterios de curaduría (no los detecta el gate, pero rompen la inferencia)

| # | Criterio | Consecuencia si se omite |
|---|---|---|
| C1 | `regimen`/`regimenes` **obligatorio** (inferirlo del texto legal). | Regla **inerte**: el motor empareja por régimen; sin régimen nunca se aplica. |
| C2 | `vigente_desde`/`vigente_hasta` coherentes (`null` = vigente). | Inconsistencias de vigencia que `npm run audit` (GraphAuditor) marcará después. |
| C3 | `fuente_url` oficial y `source_version` presentes. | El dictamen no puede citar fuente → sin lineage no hay `Deducible`. |
| C4 | No contradecir reglas de `knowledge-base/global/`. | Contradicción en el grafo; reportar en el manifiesto, nunca resolver en silencio. |
| C5 | `id` UUID nuevo solo para reglas nuevas; si la regla ya existe (misma `clave`+régimen), conservar su `id`. | Identidad duplicada → el sync (vault-wins) tratará la modificación como regla nueva. |

## 4. Verificación local

```bash
# Gate real (desde backend/) — exit 0 obligatorio:
npm run audit:vault                      # países con provider registrado
node scripts/audit-vault.js MX CO        # lista explícita (incluye scaffolds)

# Dry-run aislado (sin tocar la bóveda real):
KNOWLEDGE_BASE_PATH=/ruta/temporal node scripts/audit-vault.js MX
```
