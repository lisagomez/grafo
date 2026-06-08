# countries/CO/ — Colombia

**Scaffold.** Esta carpeta reserva el espacio para la jurisdicción de Colombia, pero
**aún no hay un `LegalSourceProvider` registrado** para CO en
`backend/src/lib/legal/sources/index.js` (solo MX en V1).

Para activar CO (patrón Strategy, sin tocar el motor):

1. Crear `backend/src/lib/legal/sources/COLegalProvider.js` implementando el contrato
   `LegalSourceProvider` (ver `types.js`).
2. Registrarlo en `PROVIDERS` dentro de `index.js`.
3. Poblar esta carpeta con las notas de las normas colombianas (frontmatter con `id`,
   `clave`, vigencias, `fuente_url`, `source_version`).
