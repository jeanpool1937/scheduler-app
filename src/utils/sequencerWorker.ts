
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
    if (produccionTn.length === 0) return [];
    const fixedItem = { sku: 0, sublote: 1, tamano: produccionTn[0] };
    const rest = diasStock.map((dias, idx) => ({ producto: idx, dias })).filter(x => x.producto !== 0).sort((a, b) => a.dias - b.dias);
    return [fixedItem, ...rest.map(({ producto }) => ({ sku: producto, sublote: 1, tamano: produccionTn[producto] }))];
}

/**
 * Heuristic 2: Nearest Neighbor - Priority for Min Changeover
 */
function generarSecuenciaNearestNeighbor(produccionTn: number[], idCambios: number[], matriz: number[][]) {
    const n = produccionTn.length;
    if (n === 0) return [];
    const secuencia: any[] = [];
    let current = 0;
    secuencia.push({ sku: current, sublote: 1, tamano: produccionTn[current] });
    const visitados = new Set([current]);

    while (visitados.size < n) {
        let bestNext = -1;
        let minTC = Infinity;

        for (let i = 1; i < n; i++) {
            if (visitados.has(i)) continue;
            const fromIdx = idCambios[current];
            const toIdx = idCambios[i];
            const tc = (fromIdx !== undefined && fromIdx !== -1 && toIdx !== undefined && toIdx !== -1 && matriz[fromIdx]?.[toIdx] !== undefined) ? matriz[fromIdx][toIdx] : 0;

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

    // Safety fallback
    for (let i = 1; i < n; i++) {
        if (!visitados.has(i)) {
            secuencia.push({ sku: i, sublote: 1, tamano: produccionTn[i] });
            visitados.add(i);
        }
    }
    return secuencia;
}

function generarSecuenciaATCS(produccionTn: number[], diasStock: number[], diasFabricacion: number[], idCambios: number[], matriz: number[][]) {
    const n = produccionTn.length;
    if (n === 0) return [];

    // Calculate averages for scaling
    let avgP = 0;
    let avgS = 0;
    let sCount = 0;
    for (let i = 1; i < n; i++) avgP += diasFabricacion[i];
    avgP /= (n - 1 || 1);

    for (let i = 0; i < matriz.length; i++) {
        for (let j = 0; j < matriz[i].length; j++) {
            if (matriz[i][j] > 0) { avgS += matriz[i][j]; sCount++; }
        }
    }
    avgS /= (sCount || 1);

    const secuencia: any[] = [];
    let current = 0; // always start at 0
    secuencia.push({ sku: current, sublote: 1, tamano: produccionTn[current] });
    const visitados = new Set([current]);
    let currentTime = 0;

    const K1 = 1.5; // Tuning parameter for due date (Slack)
    const K2 = 0.5; // Tuning parameter for setup time

    while (visitados.size < n) {
        let bestNext = -1;
        let bestScore = -Infinity;

        for (let j = 1; j < n; j++) {
            if (visitados.has(j)) continue;

            const pj = diasFabricacion[j];
            const dj = diasStock[j];

            const fromIdx = idCambios[current];
            const toIdx = idCambios[j];
            const s_ij = (fromIdx !== undefined && fromIdx !== -1 && toIdx !== undefined && toIdx !== -1 && matriz[fromIdx]?.[toIdx] !== undefined) ? (matriz[fromIdx][toIdx] / 24) : 0;

            const slack = Math.max(dj - pj - currentTime, 0);

            // ATCS Index formula
            const term1 = Math.exp(-slack / (K1 * avgP));
            const term2 = Math.exp(-s_ij / (K2 * avgS));

            const score = (1 / (pj || 1)) * term1 * term2;

            if (score > bestScore) {
                bestScore = score;
                bestNext = j;
            } else if (score === bestScore && Math.random() > 0.5) {
                bestNext = j;
            }
        }

        if (bestNext !== -1) {
            current = bestNext;
            secuencia.push({ sku: current, sublote: 1, tamano: produccionTn[current] });
            visitados.add(current);
            const fromIdx = idCambios[secuencia[secuencia.length - 2].sku];
            const toIdx = idCambios[current];
            const s_ij = (fromIdx !== undefined && fromIdx !== -1 && toIdx !== undefined && toIdx !== -1 && matriz[fromIdx]?.[toIdx] !== undefined) ? (matriz[fromIdx][toIdx] / 24) : 0;
            currentTime += diasFabricacion[current] + s_ij;
        } else break;
    }

    // fallback
    for (let i = 1; i < n; i++) {
        if (!visitados.has(i)) {
            secuencia.push({ sku: i, sublote: 1, tamano: produccionTn[i] });
            visitados.add(i);
        }
    }
    return secuencia;
}

function generarPoblacionInicial(params: WorkParams, mode: 'balanced' | 'min_lost_sales' | 'min_changeovers', size: number) {
    const { produccionTn, diasStock, diasFabricacion, idCambios, matrizCambioMedida } = params;
    const poblacion: Individual[] = [];

    // Always inject the best deterministic heuristics
    const edd = evaluar(generarSecuenciaEDD(produccionTn, diasStock), params);
    const nn = evaluar(generarSecuenciaNearestNeighbor(produccionTn, idCambios, matrizCambioMedida), params);
    const atcs = evaluar(generarSecuenciaATCS(produccionTn, diasStock, diasFabricacion, idCambios, matrizCambioMedida), params);

    poblacion.push(edd, nn, atcs);

    // Fill the rest with mutated versions of the heuristics (ILS Perturbation style)
    while (poblacion.length < size) {
        let baseSeq = [];
        const rand = Math.random();
        // Give preference based on mode
        if (mode === 'min_lost_sales') {
            baseSeq = [...(rand > 0.3 ? atcs : edd).secuencia];
        } else if (mode === 'min_changeovers') {
            baseSeq = [...nn.secuencia];
        } else {
            baseSeq = [...(rand > 0.6 ? atcs : (rand > 0.3 ? nn : edd)).secuencia];
        }

        // Shuffle 20-50% for diversity
        const swapCount = Math.floor((baseSeq.length - 1) * (0.2 + Math.random() * 0.3));
        for (let i = 0; i < swapCount; i++) {
            const a = Math.floor(Math.random() * (baseSeq.length - 1)) + 1;
            const b = Math.floor(Math.random() * (baseSeq.length - 1)) + 1;
            [baseSeq[a], baseSeq[b]] = [baseSeq[b], baseSeq[a]];
        }
        poblacion.push(evaluar(baseSeq, params));
    }
    return poblacion;
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
    if (n <= 1) return [...p1];

    // start must be >= 1 because index 0 is always fixed.
    const start = Math.floor(Math.random() * (n - 1)) + 1;
    const end = Math.floor(Math.random() * (n - start)) + start;

    const hijo: any[] = new Array(n).fill(null);

    // Copy sub-segment from P1
    const enHijo = new Set<number>(); // Track indices already placed (by sku value)
    for (let i = start; i <= end; i++) {
        hijo[i] = p1[i];
        enHijo.add(p1[i].sku);
    }

    // Fill remaining slots from P2 in order, skipping already-placed sku indices
    let currentP2 = 0;
    for (let i = 0; i < n; i++) {
        if (i >= start && i <= end) continue; // Skip filled segment

        // Find next P2 item whose sku index is not already in the hijo
        while (currentP2 < n && enHijo.has(p2[currentP2].sku)) {
            currentP2++;
        }

        if (currentP2 < n) {
            hijo[i] = p2[currentP2];
            enHijo.add(p2[currentP2].sku);
            currentP2++;
        }
    }

    // Safety: fill any remaining null slots with items not yet placed
    // (should not happen if P1 and P2 are valid permutations, but guards against edge cases)
    const allSkus = new Set(p1.map((it: any) => it.sku));
    const missing = [...allSkus].filter(s => !enHijo.has(s));
    let mIdx = 0;
    for (let i = 0; i < n; i++) {
        if (hijo[i] === null && mIdx < missing.length) {
            // Find original item object from p1 with this sku
            hijo[i] = p1.find((it: any) => it.sku === missing[mIdx]) || p2.find((it: any) => it.sku === missing[mIdx]);
            mIdx++;
        }
    }

    return hijo;
}

function mutar(secuencia: any[], tasa: number) {
    if (Math.random() > tasa) return secuencia;

    const n = secuencia.length;
    if (n <= 2) return secuencia; // Si N<=2 solo 1 item (o 0) es movible, no hay mutacion posible al ser ox1 fijo.

    const tipo = Math.random();

    if (tipo < 0.5) {
        // Swap Mutation (Never move index 0)
        const i = Math.floor(Math.random() * (n - 1)) + 1;
        let j = Math.floor(Math.random() * (n - 1)) + 1;
        while (i === j) j = Math.floor(Math.random() * (n - 1)) + 1;
        [secuencia[i], secuencia[j]] = [secuencia[j], secuencia[i]];
    } else {
        // Insertion Mutation (Shift) (Never move or insert at index 0)
        const i = Math.floor(Math.random() * (n - 1)) + 1;
        let j = Math.floor(Math.random() * (n - 1)) + 1;
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
 * Full 2-Opt Local Search (Steepest Descent / First Improvement)
 * Searches the entire neighborhood and returns the first strictly better sequence.
 */
function full2OptFirstImprovement(ind: Individual, params: WorkParams): Individual {
    const n = ind.secuencia.length;
    if (n <= 3) return ind;

    let currentBest = ind;
    let improved = true;
    let maxIter = 50; // Prevent infinite loops in edge cases

    while (improved && maxIter > 0) {
        improved = false;
        maxIter--;

        // i must be >= 1 because index 0 is fixed.
        for (let i = 1; i < n - 1; i++) {
            for (let k = i + 1; k < n; k++) {
                if (k - i <= 1 && k < n - 1) continue; // Skip adjacent swaps if not needed, but keep it simple

                const nuevaSec = [...currentBest.secuencia];
                const sub = nuevaSec.slice(i, k + 1).reverse();
                nuevaSec.splice(i, sub.length, ...sub);

                const candidato = evaluar(nuevaSec, params);
                if (candidato.aptitud > currentBest.aptitud) {
                    currentBest = candidato;
                    improved = true;
                    break; // First improvement: break inner loop
                }
            }
            if (improved) break; // First improvement: break outer loop and restart
        }
    }
    return currentBest;
}

function busquedaLocal(ind: Individual, params: WorkParams): Individual {
    // For general Memetic GA, use the fast randomized version
    const n = ind.secuencia.length;
    if (n <= 3) return ind;

    let mejorInd = ind;
    const maxAttempts = Math.min(30, n * 2);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const i = Math.floor(Math.random() * (n - 2)) + 1;
        const j = Math.floor(Math.random() * (n - 1 - i)) + i + 1;

        if (j - i <= 1) continue;

        const nuevaSec = [...mejorInd.secuencia];
        const sub = nuevaSec.slice(i, j + 1).reverse();
        nuevaSec.splice(i, sub.length, ...sub);

        const candidato = evaluar(nuevaSec, params);
        if (candidato.aptitud > mejorInd.aptitud) {
            mejorInd = candidato;
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
        const { tamanoPoblacion, tasaMutacion, tasaElitismo } = params;
        const MAX_TIME_MS = 28000; // 28 seconds absolute limit
        let lastReportTime = 0;

        const scenarioMode = params.pesoVenta > 0.8 ? 'min_lost_sales' : (params.pesoVenta < 0.2 ? 'min_changeovers' : 'balanced');

        // 1. Initial Population Seeded with SOTA Heuristics
        let poblacion = generarPoblacionInicial(params, scenarioMode, tamanoPoblacion);

        // 2. Immediately apply Full 2-Opt strictly to the best deterministic seeds
        // This guarantees our baseline is an extremely strong local optimum
        poblacion[0] = full2OptFirstImprovement(poblacion[0], params);
        poblacion[1] = full2OptFirstImprovement(poblacion[1], params);
        poblacion[2] = full2OptFirstImprovement(poblacion[2], params);

        let bestGlobal = poblacion[0];
        for (const ind of poblacion) {
            if (ind.aptitud > bestGlobal.aptitud) bestGlobal = ind;
        }

        let generationsWithoutImprovement = 0;
        let gen = 0;

        // 3. Main Time-Bounded Loop (Hybrid ILS/Memetic)
        while (performance.now() - start < MAX_TIME_MS) {
            gen++;
            poblacion.sort((a, b) => b.aptitud - a.aptitud);

            if (poblacion[0].aptitud > bestGlobal.aptitud) {
                bestGlobal = poblacion[0];
                generationsWithoutImprovement = 0;
            } else {
                generationsWithoutImprovement++;
            }

            let currentMutationRate = generationsWithoutImprovement > 20 ? Math.min(0.8, tasaMutacion * 2.5) : tasaMutacion;

            // ILS Perturbation / Escape Local Optima
            if (generationsWithoutImprovement > 30) {
                // If stuck, apply heavy perturbation to the elite and replace the bottom half
                for (let k = tamanoPoblacion - 1; k > tamanoPoblacion * 0.5; k--) {
                    // Double-bridge or heavy random shuffle to bestGlobal
                    let seq = mutar([...bestGlobal.secuencia], 1.0);
                    seq = mutar(seq, 1.0);
                    poblacion[k] = evaluar(seq, params);
                }

                // Also apply Full 2-Opt to the best again just in case
                poblacion[0] = full2OptFirstImprovement(poblacion[0], params);
                if (poblacion[0].aptitud > bestGlobal.aptitud) {
                    bestGlobal = poblacion[0];
                }

                generationsWithoutImprovement = 0;
            }

            const numElite = Math.max(1, Math.floor((tasaElitismo || DEFAULT_ELITISM_RATE) * tamanoPoblacion));
            const nuevaPob: Individual[] = poblacion.slice(0, numElite);

            // Memetic Step: Local Search
            if (gen % LOCAL_SEARCH_FREQUENCY === 0) {
                const eliteToRefine = Math.floor(nuevaPob.length * LOCAL_SEARCH_INTENSITY) || 1;
                for (let k = 0; k < eliteToRefine; k++) {
                    // Use fast local search for iterations, save Full 2-Opt for perturbations
                    nuevaPob[k] = busquedaLocal(nuevaPob[k], params);
                }
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

            // Report Progress
            const elapsed = performance.now() - start;
            if (elapsed - lastReportTime > 500) {
                const progress = Math.min(99, Math.round((elapsed / MAX_TIME_MS) * 100));
                self.postMessage({ type: 'progress', progress, currentBest: bestGlobal.costos.tiempoTotalCambio });
                lastReportTime = elapsed;
            }
        }

        // Final Full 2-Opt sweep on the best found before finishing
        bestGlobal = full2OptFirstImprovement(bestGlobal, params);

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
                tiemposCambio: tiemposCambio,
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
