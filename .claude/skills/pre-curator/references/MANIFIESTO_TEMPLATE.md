# MANIFIESTO_TEMPLATE

> Plantilla del **Manifiesto de Cambio** que `/pre-curator` escribe en
> `./knowledge-base/countries/<ISO-2>/manifiestos/MANIFIESTO-<YYYY-MM-DD>-<slug>.md`.
> Es el mapa de revisión humana: el contador lo lee de arriba hacia abajo y empieza por los 🚩.

---

```markdown
---
tipo: manifiesto-de-cambio
pais: <ISO-2>
fecha: <YYYY-MM-DD>
fuente_url: <URL oficial del documento procesado>
documento: <título del documento legal bruto>
generado_por: pre-curator
estado: pendiente-revision-humana
---

# Manifiesto de Cambio — <título corto> (<ISO-2>, <YYYY-MM-DD>)

## Resumen

| Riesgo | Reglas |
|---|---|
| 🚩 Rojo (afecta cálculo de impuestos) | <n> |
| 🟡 Amarillo (cambia condiciones) | <n> |
| 🟢 Verde (sin impacto en reglas vivas) | <n> |

Notas escritas en `deducciones/`: <lista de archivos>.

## 🚩 Riesgo Legal Estimado — ROJO (revisar primero)

### 🚩 <clave> — <archivo.md> (`id: <uuid>`)
- **Cálculo afectado:** <qué impuesto/tope/tasa/fórmula cambia>.
- **Antes → Después:** <valor o lógica vigente> → <valor o lógica nueva>.
- **Fundamento:** <artículo, fracción y ley exacta del texto bruto>.
- **Vigencia:** `vigente_desde: <fecha>`<, retroactiva si aplica>.
- **Pregunta para el revisor:** <la decisión concreta que el humano debe tomar>.

## 🟡 Riesgo Legal Estimado — AMARILLO

### 🟡 <clave> — <archivo.md> (`id: <uuid>`)
- **Qué cambia:** <condición agregada/quitada, camino nuevo, fuente actualizada>.
- **Fundamento:** <artículo y ley>.
- **Pregunta para el revisor:** <qué confirmar>.

## 🟢 Riesgo Legal Estimado — VERDE

- 🟢 `<clave>` — <archivo.md> (`id: <uuid>`): <una línea: regla nueva / cambio editorial>.

## Incidencias de pre-curación

- **Líneas de pseudocódigo descartadas por Formato Estricto:** <lista con la línea original y el archivo, o "ninguna">.
- **Posibles contradicciones con `global/`:** <descripción de cada choque detectado, o "ninguna">.
- **Fuentes no verificables:** <URLs o citas que no se pudieron confirmar como oficiales, o "ninguna">.

## Checklist de revisión humana (HITL)

- [ ] Revisé cada 🚩 y confirmé/corregí los valores del cálculo afectado.
- [ ] Revisé los 🟡 y validé las condiciones nuevas.
- [ ] Resolví las contradicciones con `global/` (si las hubo).
- [ ] Aprobado → quitar `estado: pre-curado` de las notas y correr `/sync-country-knowledge <ISO-2>`.
- [ ] Rechazado/parcial → corregir o borrar las notas señaladas y dejar constancia aquí.
```

---

## Convenciones

- El manifiesto vive en `manifiestos/`, **fuera** de `deducciones/` — el motor (`knowledge-engine.js`)
  solo escanea `deducciones/*.md`, así el manifiesto nunca contamina el gate `npm run audit:vault`.
- Omite las secciones de riesgo que queden vacías, pero el **Resumen** siempre lleva las tres filas.
- Orden fijo: rojo → amarillo → verde. El revisor empieza arriba.
- Un manifiesto por documento legal procesado; si un mismo documento toca varios países, un manifiesto por país.
