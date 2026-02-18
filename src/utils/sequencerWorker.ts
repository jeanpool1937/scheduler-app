
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
    costos: {
        tiempoTotalCambio: number;
        ventaPerdidaTotal: number;
        tiempoAcumulado: number;
    };
}

// --- CORE FUNCTIONS ---

function generarSecuenciaDetallada(produccionTn: number[], diasStock: number[]) {
    // Initial heuristic: Sort by days of stock (Earliest Due Date equivalent)
    const productosOrdenados = diasStock.map((dias, idx) => ({ producto: idx, dias })).sort((a, b) => a.dias - b.dias);
    let secuencia: any[] = [];

    for (const { producto } of productosOrdenados) {
        secuencia.push({ sku: producto, sublote: 1, tamano: produccionTn[producto] });
    }

    // Shuffle significantly to create diversity, but keep some order for others
    // We want a mix of random and EDD (Earliest Due Date)
    if (Math.random() > 0.3) {
        for (let i = secuencia.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [secuencia[i], secuencia[j]] = [secuencia[j], secuencia[i]];
        }
    }
    return secuencia;
}

function calcularValores(secuencia: any[], matriz: number[][], ventaDiaria: number[], diasStock: number[], diasFabricacion: number[], idCambios: number[]) {
    let tiempoTotalCambio = 0, tiempoAcumulado = 0, ventaPerdidaTotal = 0;
    const stockActual = [...diasStock];
    const tamanoTotal: Record<number, number> = {};
    for (const { sku, tamano } of secuencia) tamanoTotal[sku] = (tamanoTotal[sku] || 0) + tamano;

    for (let i = 0; i < secuencia.length; i++) {
        const { sku, tamano } = secuencia[i];
        if (i > 0) {
            const prevSku = secuencia[i - 1].sku;
            const fromIdx = idCambios[prevSku];
            const toIdx = idCambios[sku];
            const tc = matriz[fromIdx] && matriz[fromIdx][toIdx] !== undefined ? matriz[fromIdx][toIdx] : 0;
            tiempoTotalCambio += tc;
            tiempoAcumulado += tc;
        }

        // Calculate Stockouts
        // If accumulated time > stock days, we are losing sales
        const diasRotura = Math.max(0, tiempoAcumulado - stockActual[sku]);
        ventaPerdidaTotal += diasRotura * ventaDiaria[sku];

        // Production Time
        const diasFabPonderado = diasFabricacion[sku] * (tamano / tamanoTotal[sku]);

        // Replenish Stock (Logic: produced amount / daily sale = simplified days added)
        // Note: In reality, stock is added at END of production, so it doesn't help current iteration's stockout
        const diasStockAdd = ventaDiaria[sku] > 0 ? tamano / ventaDiaria[sku] : 999;

        // Update state mainly for next products consumption? 
        // Actually, this simple model assumes stock is consumed by TIME, not by other products.
        // Independent demand per SKU.

        stockActual[sku] += diasStockAdd;
        tiempoAcumulado += diasFabPonderado;
    }
    return { tiempoAcumulado, tiempoTotalCambio, ventaPerdidaTotal };
}

function evaluar(secuencia: any[], params: WorkParams): Individual {
    const { matrizCambioMedida, ventaDiaria, diasStock, diasFabricacion, pesoVenta, idCambios, costoToneladaPerdida, costoHoraCambio, horasDia } = params;

    // Performance improvement: pass params directly or structured
    const costos = calcularValores(secuencia, matrizCambioMedida, ventaDiaria, diasStock, diasFabricacion, idCambios);
    const { tiempoTotalCambio, ventaPerdidaTotal } = costos;

    const costoVP = ventaPerdidaTotal * costoToneladaPerdida;
    const costoTC = tiempoTotalCambio * horasDia * costoHoraCambio;

    // Objective Function: Minimize Cost
    // We maximize Fitness = 1 / Cost
    const valorObjetivo = pesoVenta * costoVP + (1 - pesoVenta) * costoTC;

    return {
        secuencia,
        costos,
        aptitud: 1 / (valorObjetivo + 0.0001) // Prevent division by zero
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
function busquedaLocal(ind: Individual, params: WorkParams): Individual {
    let mejorSecuencia = [...ind.secuencia];
    let mejorAptitud = ind.aptitud;
    let mejorCostos = ind.costos;
    let mejoro = false;

    // Simple adjacent swap (fewer checks than full 2-opt) for speed in JS Worker
    for (let i = 0; i < mejorSecuencia.length - 1; i++) {
        // Swap i and i+1
        [mejorSecuencia[i], mejorSecuencia[i + 1]] = [mejorSecuencia[i + 1], mejorSecuencia[i]];

        const candidato = evaluar(mejorSecuencia, params);
        if (candidato.aptitud > mejorAptitud) {
            mejorAptitud = candidato.aptitud;
            mejorCostos = candidato.costos;
            mejoro = true;
            // Greedily accept and continue? Or First Improvement?
            // Restarting scan from i? Let's keep scanning for now (First Improvement)
        } else {
            // Revert
            [mejorSecuencia[i], mejorSecuencia[i + 1]] = [mejorSecuencia[i + 1], mejorSecuencia[i]];
        }
    }

    if (mejoro) {
        return { secuencia: mejorSecuencia, aptitud: mejorAptitud, costos: mejorCostos };
    }
    return ind;
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

        // Init Population
        for (let i = 0; i < tamanoPoblacion; i++) {
            const seq = generarSecuenciaDetallada(produccionTn, diasStock);
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
            const currentMutationRate = generationsWithoutImprovement > 20 ? Math.min(0.8, tasaMutacion * 2) : tasaMutacion;

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
        const { tiempoTotalCambio, ventaPerdidaTotal, tiempoAcumulado } = bestGlobal.costos;
        const costoVP = ventaPerdidaTotal * params.costoToneladaPerdida;
        const costoTC = tiempoTotalCambio * params.horasDia * params.costoHoraCambio;

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
