---
name: optimizador_iterativo
description: Skill para la mejora continua y sistemática de algoritmos de optimización de secuencia de producción.
---

# Skill de Optimización Iterativa de Secuencia

Este skill guía al agente de IA para realizar iteraciones de mejora sobre los algoritmos de secuenciación de la aplicación Scheduler App. El objetivo principal es minimizar los costos de cambio de medida y la venta perdida.

## 1. Contexto del Problema
La aplicación utiliza un algoritmo memético (Algoritmo Genético + Búsqueda Local 2-Opt) para encontrar el orden óptimo de producción de una lista de SKUs. Los costos se basan en:
- **Tiempos de Cambio**: Horas de inactividad por cambiar entre diferentes medidas o artículos.
- **Venta Perdida**: Toneladas no entregadas a tiempo por retrasos en la producción.

## 2. Flujo de Trabajo Iterativo

### Fase A: Investigación y Análisis
1.  **Analizar el Código Actual**: Revisar `src/utils/sequencerWorker.ts` para entender la lógica de evaluación y los operadores genéticos.
2.  **Estado del Arte**: Buscar algoritmos o técnicas avanzadas para "Sequence-Dependent Setup Times" (SDST) Travelling Salesman Problem (TSP) o Job Shop Scheduling.
    -   *Ejemplos*: Ant Colony Optimization (ACO), Tabu Search, GRASP, Simulated Annealing.
3.  **Identificar Cuellos de Botella**: Revisar si el algoritmo actual se queda atrapado en óptimos locales o si la función de aptitud (fitness) necesita más matices.

### Fase B: Implementación de Candidatos
1.  **Versiones del Worker**: Crear nuevas ramas del worker o hibridar `sequencerWorker.ts` con nuevos métodos.
2.  **Nuevas Ideas (Heurísticas)**:
    -   **Sub-loteo (Batching)**: Dividir lotes grandes para insertar pedidos urgentes.
    -   **Penalizaciones Dinámicas**: Ajustar el peso de la venta perdida basado en la criticidad del SKU.
    -   **Local Search Intensivo**: Implementar 3-Opt o Variable Neighborhood Search (VNS).

### Fase C: Ejecución y Comparación
1.  **Simulación**: Usar datos del `backup_scheduler.json` para ejecutar benchmarks.
2.  **Comparación de Escenarios**: La UI del `ProductionSequencer` permite comparar múltiples escenarios (Equilibrado, Mín. Venta Perdida, Mín. Tiempos de Cambio).
3.  **Métricas de Éxito**:
    -   Reducción del Costo Total ($)
    -   Aumento de la Eficiencia (%)
    -   Reducción de Horas de Parada

### Fase D: Refinamiento
Si el nuevo algoritmo no mejora los resultados:
1.  Documentar por qué falló.
2.  Ajustar hiperparámetros (población, tasas de mutación, temperaturas de enfriamiento).
3.  Volver a la Fase A con una nueva hipótesis.

## 3. Comandos Útiles
-   **Benchmark**: Generar scripts de prueba rápidos en `/tmp/` para medir tiempos de ejecución y calidad de la solución.
-   **Debug**: Inspeccionar la convergencia de la aptitud en los logs del worker.

## 4. Filosofía de "Bias for Action"
No te limites a sugerir algoritmos. **Impleméntalos**, pruébalos y presenta los resultados comparativos al usuario.
