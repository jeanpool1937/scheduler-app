
/**
 * Sequencer Worker - Memetic Algorithm (GA + Local Search)
 * Optimized for Sequence Dependent Setup Times
 */

interface WorkParams {
    matrizCambioMedida: number[][]; // [fromId][toId] -> hours
    ventaDiaria: number[];
    diasStock: number[];
    diasFabricacion: number[];
    tamanoLote: number[];
    produccionTn: number[];
    skus: string[];
    descripciones: string[];
    ids: string[];
    idCambios: number[]; // Mapped to matrix indices (0-based)
    originalIdCambios: string[];
    fechaHoraInicio: number;
    horasDia: number;
    pesoVenta: number; // 0 to 1
    costoToneladaPerdida: number;
    costoHoraCambio: number;
    tamanoPoblacion: number;
    numGeneraciones: number;
    tasaMutacion: number;
    tasaElitismo: number;
}

// --- CONFIGURATION ---
const DEFAULT_ELITISM_RATE = 0.1;
const TOURNAMENT_SIZE = 5;
const LOCAL_SEARCH_FREQUENCY = 10; // Run 2-Opt every N generations
const LOCAL_SEARCH_INTENSITY = 0.2; // % of population to apply LS

// --- HELPER TYPES ---
interface Individual {
    secuencia: any[];
    aptitud: number;
    costoVP: number;
    costoTC: number;
    costos: {
        tiempoTotalCambio: number;
        ventaPerdidaTotal: number;
        tiempoAcumulado: number;
        tiemposCambio: number[]; // Changeover time for EACH item (0 for first)
    };
}

// --- CORE FUNCTIONS ---

/**
 * Heuristic 1: Earliest Due Date (EDD) - Priority for Min Lost Sales
 */
function generarSecuenciaEDD(produccionTn: number[], diasStock: number[]) {
    const sorted = diasStock.map((dias, idx) => ({ producto: idx, dias })).sort((a, b) => a.dias - b.dias);
    return sorted.map(({ producto }) => ({ sku: producto, sublote: 1, tamano: produccionTn[producto] }));
}

/**
 * Heuristic 2: Nearest Neighbor - Priority for Min Changeover
 */
function generarSecuenciaNearestNeighbor(produccionTn: number[], idCambios: number[], matriz: number[][]) {
    const n = produccionTn.length;
    const items = Array.from({ length: n }, (_, i) => i);
    const secuencia: any[] = [];
    let current = items[Math.floor(Math.random() * n)];
    secuencia.push({ sku: current, sublote: 1, tamano: produccionTn[current] });
    const visitados = new Set([current]);

    while (visitados.size < n) {
        let bestNext = -1;
        let minTC = Infinity;

        for (let i = 0; i < n; i++) {
            if (visitados.has(i)) continue;
            const fromIdx = idCambios[current];
            const toIdx = idCambios[i];
            const tc = (fromIdx !== -1 && toIdx !== -1) ? (matriz[fromIdx]?.[toIdx] || 0) : 0;

            if (tc < minTC) {
                minTC = tc;
                bestNext = i;
            } else if (tc === minTC && Math.random() > 0.5) {
                bestNext = i;
            }
        }

        if (bestNext !== -1) {
            current = bestNext;
            secuencia.push({ sku: current, sublote: 1, tamano: produccionTn[current] });
            visitados.add(current);
        } else break;
    }
    return secuencia;
}

function generarSecuenciaDetallada(produccionTn: number[], diasStock: number[], idCambios: number[], matriz: number[][], mode: 'balanced' | 'min_lost_sales' | 'min_changeovers') {
    let secuencia: any[] = [];

    if (mode === 'min_lost_sales') {
        secuencia = generarSecuenciaEDD(produccionTn, diasStock);
    } else if (mode === 'min_changeovers') {
        secuencia = generarSecuenciaNearestNeighbor(produccionTn, idCambios, matriz);
    } else {
        // Balanced: Mix 
        secuencia = Math.random() > 0.5
            ? generarSecuenciaEDD(produccionTn, diasStock)
            : generarSecuenciaNearestNeighbor(produccionTn, idCambios, matriz);
    }

    // Add noise for GA diversity (Shuffle 20% of items)
    if (Math.random() > 0.1) {
        const swapCount = Math.floor(secuencia.length * 0.2);
        for (let i = 0; i < swapCount; i++) {
            const a = Math.floor(Math.random() * secuencia.length);
            const b = Math.floor(Math.random() * secuencia.length);
            [secuencia[a], secuencia[b]] = [secuencia[b], secuencia[a]];
        }
    }
    return secuencia;
}

function calcularValores(secuencia: any[], matriz: number[][], ventaDiaria: number[], diasStock: number[], diasFabricacion: number[], idCambios: number[]) {
    let tiempoTotalCambio = 0, tiempoAcumulado = 0, ventaPerdidaTotal = 0;
    const stockActual = [...diasStock];
    const tamanoTotal: Record<number, number> = {};
    for (const { sku, tamano } of secuencia) tamanoTotal[sku] = (tamanoTotal[sku] || 0) + tamano;

    const tiemposCambio: number[] = new Array(secuencia.length).fill(0);

    for (let i = 0; i < secuencia.length; i++) {
        const { sku, tamano } = secuencia[i];
        if (i > 0) {
            const prevSku = secuencia[i - 1].sku;
            const fromIdx = idCambios[prevSku];
            const toIdx = idCambios[sku];

            let tc = 0;
            if (fromIdx !== undefined && fromIdx !== -1 && toIdx !== undefined && toIdx !== -1) {
                tc = matriz[fromIdx] && matriz[fromIdx][toIdx] !== undefined ? matriz[fromIdx][toIdx] : 0;
            }

            tiemposCambio[i] = tc; // Track individual TC
            tiempoTotalCambio += tc;
            tiempoAcumulado += tc;
        }

        // Calculate Stockouts
        const diasRotura = Math.max(0, tiempoAcumulado - stockActual[sku]);
        ventaPerdidaTotal += diasRotura * ventaDiaria[sku];

        // Production Time
        const diasFabPonderado = diasFabricacion[sku] * (tamano / (tamanoTotal[sku] || 1));

        // Replenish Stock
        const diasStockAdd = ventaDiaria[sku] > 0 ? tamano / ventaDiaria[sku] : 999;

        stockActual[sku] += diasStockAdd;
        tiempoAcumulado += diasFabPonderado;
    }
    return { tiempoAcumulado, tiempoTotalCambio, ventaPerdidaTotal, tiemposCambio };
}

function evaluar(secuencia: any[], params: WorkParams): Individual {
    const { matrizCambioMedida, ventaDiaria, diasStock, diasFabricacion, pesoVenta, idCambios, costoToneladaPerdida, costoHoraCambio } = params;

    const costos = calcularValores(secuencia, matrizCambioMedida, ventaDiaria, diasStock, diasFabricacion, idCambios);
    const { tiempoTotalCambio, ventaPerdidaTotal } = costos;

    const costoVP = ventaPerdidaTotal * costoToneladaPerdida;
    const costoTC = tiempoTotalCambio * costoHoraCambio;

    // --- ENHANCEMENT: Continuity Bonus ---
    // Penalize fragmented production if same SKU appears twice (not supported in current logic but good for future)
    // Bonus for grouping same "change table ID" (idCambios)
    let continuityBonus = 0;
    for (let i = 1; i < secuencia.length; i++) {
        if (idCambios[secuencia[i].sku] === idCambios[secuencia[i - 1].sku]) {
            continuityBonus += (costoHoraCambio * 0.1); // Small bonus for staying in same setup
        }
    }

    // Objective Function: Minimize Cost
    const valorObjetivo = Math.max(0, (pesoVenta * costoVP + (1 - pesoVenta) * costoTC) - continuityBonus);

    return {
        secuencia,
        costos,
        costoVP,
        costoTC,
        aptitud: 1 / (valorObjetivo + 0.0001)
    };
}

// --- GENETIC OPERATORS ---

/**
 * Order Crossover (OX1) - Preserves relative order and handles permutations
 */
function cruzarOX(p1: any[], p2: any[]): any[] {
    const n = p1.length;
    const start = Math.floor(Math.random() * (n - 1));
    const end = Math.floor(Math.random() * (n - start)) + start;

    const hijo = new Array(n).fill(null);
    // Wait, items might have same SKU if split lots?
    // Assuming distinct objects or simple indices. Current implementation uses objects.
    // We should use object reference or a unique ID. 
    // For simplicity given current data structure, let's assume index-based or unique items.
    // The previous implementation assumed {sku, sublote, tamano}.
    // If distinct items, we use reference equality.

    // Copy sub-segment from P1
    for (let i = start; i <= end; i++) {
        hijo[i] = p1[i];
    }

    // Fill remaining from P2 in order
    let currentP2 = 0;
    for (let i = 0; i < n; i++) {
        if (i >= start && i <= end) continue; // Skip filled slots

        // Find next item in P2 that isn't already in hijo (from P1 segment)
        // Note: O(N^2) here in bad implementation. Optimization: fast lookup set.
        // Since we might have duplicates of SKUs (if split lots), we need to be careful.
        // If we treat the initial array as a permutation of indices 0..N-1, it's safer.
        // The original code passed full objects.
        // Let's rely on filter approach for now.

        while (currentP2 < n) {
            const candidate = p2[currentP2];
            // Check if candidate is already in sub-segment of P1
            // Issue: Direct object comparison works if referencing same objects in memory
            let exists = false;
            for (let k = start; k <= end; k++) {
                if (hijo[k] === candidate) { exists = true; break; }
            }

            if (!exists) {
                hijo[i] = candidate;
                currentP2++;
                break;
            }
            currentP2++;
        }
    }

    return hijo;
}

function mutar(secuencia: any[], tasa: number) {
    if (Math.random() > tasa) return secuencia;

    const n = secuencia.length;
    if (n < 2) return secuencia;

    const tipo = Math.random();

    if (tipo < 0.5) {
        // Swap Mutation
        const i = Math.floor(Math.random() * n);
        let j = Math.floor(Math.random() * n);
        while (i === j) j = Math.floor(Math.random() * n);
        [secuencia[i], secuencia[j]] = [secuencia[j], secuencia[i]];
    } else {
        // Insertion Mutation (Shift)
        // Take item at i and move to j
        const i = Math.floor(Math.random() * n);
        let j = Math.floor(Math.random() * n);
        const [item] = secuencia.splice(i, 1);
        secuencia.splice(j, 0, item);
    }

    return secuencia;
}

// --- MEMETIC OPERATORS ---

/**
 * 2-Opt Local Search
 * Tries to untangle the sequence by reversing segments or swapping adjacent pairs.
 * Computationally expensive, so only applied to top individuals or periodically.
 */
/**
 * 2-Opt Local Search (Segment Reversal)
 */
function busquedaLocal(ind: Individual, params: WorkParams): Individual {
    const n = ind.secuencia.length;
    if (n < 3) return ind;

    let mejorInd = { ...ind };
    let mejoro = false;

    // Try a few random 2-opt moves for performance
    const maxAttempts = Math.min(20, n);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const i = Math.floor(Math.random() * (n - 1));
        const j = Math.floor(Math.random() * (n - i)) + i + 1;

        if (j - i <= 1) continue;

        // Reverse segment [i...j]
        const nuevaSec = [...mejorInd.secuencia];
        const sub = nuevaSec.slice(i, j + 1).reverse();
        nuevaSec.splice(i, sub.length, ...sub);

        const candidato = evaluar(nuevaSec, params);
        if (candidato.aptitud > mejorInd.aptitud) {
            mejorInd = candidato;
            mejoro = true;
        }
    }

    return mejorInd;
}

function seleccionTorneo(poblacion: Individual[]): Individual {
    let mejor = poblacion[Math.floor(Math.random() * poblacion.length)];
    for (let i = 1; i < TOURNAMENT_SIZE; i++) {
        const oponente = poblacion[Math.floor(Math.random() * poblacion.length)];
        if (oponente.aptitud > mejor.aptitud) {
            mejor = oponente;
        }
    }
    return mejor;
}

// --- WORKER HANDLER ---

onmessage = function (e) {
    const { type, params } = e.data as { type: string, params: WorkParams };

    if (type === 'run') {
        const start = performance.now();
        const { tamanoPoblacion, numGeneraciones, tasaMutacion, tasaElitismo, produccionTn, diasStock } = params;

        let poblacion: Individual[] = [];

        // Initialize mode based on weight
        const scenarioMode = params.pesoVenta > 0.8 ? 'min_lost_sales' : (params.pesoVenta < 0.2 ? 'min_changeovers' : 'balanced');

        // Init Population
        for (let i = 0; i < tamanoPoblacion; i++) {
            const seq = generarSecuenciaDetallada(produccionTn, diasStock, params.idCambios, params.matrizCambioMedida, scenarioMode);
            poblacion.push(evaluar(seq, params));
        }

        let bestGlobal = poblacion[0];
        let generationsWithoutImprovement = 0;

        for (let gen = 0; gen < numGeneraciones; gen++) {
            // Sort by fitness desc
            poblacion.sort((a, b) => b.aptitud - a.aptitud);

            if (poblacion[0].aptitud > bestGlobal.aptitud) {
                bestGlobal = poblacion[0];
                generationsWithoutImprovement = 0;
            } else {
                generationsWithoutImprovement++;
            }

            // Adaptive Mutation: Increase if stuck
            let currentMutationRate = generationsWithoutImprovement > 20 ? Math.min(0.8, tasaMutacion * 2) : tasaMutacion;

            // --- ESCAPE LOCAL OPTIMA: Diversification ---
            if (generationsWithoutImprovement > 40) {
                // Re-inject 20% random/heuristic individuals
                for (let k = tamanoPoblacion - 1; k > tamanoPoblacion * 0.8; k--) {
                    const seq = generarSecuenciaDetallada(produccionTn, diasStock, params.idCambios, params.matrizCambioMedida, scenarioMode);
                    poblacion[k] = evaluar(seq, params);
                }
                generationsWithoutImprovement = 0; // Reset counter after injection
            }

            // Elitism
            const numElite = Math.max(1, Math.floor((tasaElitismo || DEFAULT_ELITISM_RATE) * tamanoPoblacion));
            const nuevaPob: Individual[] = poblacion.slice(0, numElite);

            // Memetic Step: Apply Local Search to Elite occasionally
            if (gen % LOCAL_SEARCH_FREQUENCY === 0) {
                const eliteToRefine = Math.floor(nuevaPob.length * LOCAL_SEARCH_INTENSITY) || 1;
                for (let k = 0; k < eliteToRefine; k++) {
                    nuevaPob[k] = busquedaLocal(nuevaPob[k], params);
                }
                // Re-update best global if LS found something better
                if (nuevaPob[0].aptitud > bestGlobal.aptitud) bestGlobal = nuevaPob[0];
            }

            // Breeding
            while (nuevaPob.length < tamanoPoblacion) {
                const p1 = seleccionTorneo(poblacion);
                const p2 = seleccionTorneo(poblacion);

                let hijoSeq = cruzarOX(p1.secuencia, p2.secuencia);
                hijoSeq = mutar(hijoSeq, currentMutationRate);

                nuevaPob.push(evaluar(hijoSeq, params));
            }

            poblacion = nuevaPob;

            if (gen % 10 === 0 || gen === numGeneraciones - 1) {
                self.postMessage({ type: 'progress', progress: Math.round(((gen + 1) / numGeneraciones) * 100) });
            }
        }

        // Final result construction
        const { tiempoTotalCambio, ventaPerdidaTotal, tiempoAcumulado, tiemposCambio } = bestGlobal.costos;
        const costoVP = ventaPerdidaTotal * params.costoToneladaPerdida;
        const costoTC = tiempoTotalCambio * params.costoHoraCambio;

        self.postMessage({
            type: 'complete',
            result: {
                secuencia: bestGlobal.secuencia,
                tiempoTotalCambio,
                ventaPerdidaTotal,
                tiempoProduccionTotal: tiempoAcumulado - tiempoTotalCambio,
                costoVentaPerdida: costoVP,
                costoTiempoCambio: costoTC,
                costoTotal: costoVP + costoTC,
                tiemposCambio: tiemposCambio, // Detailed individual times
                processingTime: (performance.now() - start) / 1000,
                params_skus: params.skus,
                params_desc: params.descripciones,
                params_cant: params.produccionTn,
                params_idCambios: params.idCambios,
                params_ids: params.ids
            }
        });
    }
};
