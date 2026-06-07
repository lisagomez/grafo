// Esquema del grafo legal — constraints e índices.
// Idempotente (IF NOT EXISTS). Aplicado por scripts/seed-graph.js antes de sembrar.

// Identidad única por nodo
CREATE CONSTRAINT norma_id    IF NOT EXISTS FOR (n:Norma)    REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT criterio_id IF NOT EXISTS FOR (c:Criterio) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT gasto_clave IF NOT EXISTS FOR (g:Gasto)    REQUIRE g.clave IS UNIQUE;
CREATE CONSTRAINT regimen_clave IF NOT EXISTS FOR (r:Regimen) REQUIRE r.clave IS UNIQUE;

// Índices de apoyo para el traversal por jurisdicción y vigencia
CREATE INDEX norma_pais  IF NOT EXISTS FOR (n:Norma) ON (n.pais);
CREATE INDEX gasto_pais  IF NOT EXISTS FOR (g:Gasto) ON (g.pais);
