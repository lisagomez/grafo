# Memoria del Proyecto — project/

## Sistemas Blindados

- **GraphAuditor V1.0**: Sistema de auditoría de grafos con throughput de **~900 ops/s** (optimizado a O(N+R); 100% correctitud bajo carga concurrente). Estado: **Producción**.
  - *Nota:* el throughput depende del tamaño del grafo (~900 ops/s a 1k nodos, ~500 ops/s a 2.1k). El "75 ops/s" original era la versión previa a la optimización O(N+R).
