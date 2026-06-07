/**
 * Neo4jService.template.js — dependencia MÍNIMA y PORTABLE del GraphAuditor.
 *
 * Contiene solo lo que el auditor necesita (`exportGrafo` + conectividad), sin
 * arrastrar el resto de la capa de grafo. Copiar a `services/` (o `lib/`) y
 * ajustar nada más que el nombre/rutas si hace falta.
 *
 * ESM: requiere "type": "module" en package.json (o renombrar a .mjs).
 * Dependencia: `npm install neo4j-driver`.
 */

import neo4j from 'neo4j-driver';

/** Implementación real: habla con Neo4j. */
export class RealNeo4jService {
  isMock = false;

  /** @param {{uri:string,user:string,password:string,database?:string}} cfg */
  constructor({ uri, user, password, database = 'neo4j' }) {
    this.database = database;
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), { disableLosslessIntegers: true });
  }

  async verifyConnectivity() {
    try { await this.driver.verifyConnectivity(); return { ok: true }; }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  }

  /** Dump del grafo de un país en el shape que consume el auditor. */
  async exportGrafo(pais) {
    const session = this.driver.session({ database: this.database });
    try {
      const res = await session.run(
        `MATCH (n) WHERE n.pais = $pais
         OPTIONAL MATCH (n)-[r]->(m) WHERE m.pais = $pais
         RETURN collect(DISTINCT n) AS nodos,
                collect(DISTINCT {tipo:type(r), desde:startNode(r), hacia:endNode(r), props:r}) AS rels`,
        { pais },
      );
      const out = { regimenes: [], gastos: [], normas: [], criterios: [], relaciones: [] };
      if (!res.records.length) return out;
      const grupo = { Regimen: 'regimenes', Gasto: 'gastos', Norma: 'normas', Criterio: 'criterios' };
      for (const n of res.records[0].get('nodos') || []) {
        const k = grupo[n.labels?.[0]];
        if (k) out[k].push({ ...n.properties });
      }
      for (const r of res.records[0].get('rels') || []) {
        if (!r.tipo) continue;
        out.relaciones.push({
          tipo: r.tipo,
          fromVal: r.desde?.properties?.id ?? r.desde?.properties?.clave,
          toVal: r.hacia?.properties?.id ?? r.hacia?.properties?.clave,
          props: r.props?.properties ?? {},
        });
      }
      return out;
    } finally {
      await session.close();
    }
  }

  async close() { await this.driver.close(); }
}

/** Implementación mock: dataset en memoria. Permite auditar/probar SIN Neo4j. */
export class MockNeo4jService {
  isMock = true;

  constructor(dataset) { this.data = dataset; }

  static async fromFile(filePath) {
    const { readFile } = await import('node:fs/promises');
    return new MockNeo4jService(JSON.parse(await readFile(filePath, 'utf8')));
  }

  async verifyConnectivity() { return { ok: false, error: 'mock (sin Neo4j)' }; }

  async exportGrafo(pais) {
    const f = (a) => (a || []).filter((x) => !x.pais || x.pais === pais);
    return {
      regimenes: f(this.data.regimenes), gastos: f(this.data.gastos),
      normas: f(this.data.normas), criterios: f(this.data.criterios),
      relaciones: this.data.relaciones || [],
    };
  }

  async close() {}
}
