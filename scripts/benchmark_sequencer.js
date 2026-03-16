
import fs from 'fs';

// Load benchmark data
const data = JSON.parse(fs.readFileSync('./scripts/benchmark_data.json', 'utf8'));

const { items, rules } = data;

// Helper to map ids to changeover matrix
const idSet = new Set(items.map(it => it.id_tabla_cambio_medida));
const ids = Array.from(idSet);
const idMap = new Map(ids.map((id, index) => [id, index]));

const matrix = Array.from({ length: ids.length }, () => new Array(ids.length).fill(0));
rules.forEach(rule => {
  if (idMap.has(rule.from_id) && idMap.has(rule.to_id)) {
    matrix[idMap.get(rule.from_id)][idMap.get(rule.to_id)] = rule.duration_hours;
  }
});

// Mock constants for evaluation
const COSTO_HORA_CAMBIO = 500;
const COSTO_TN_PERDIDA = 100;
const PESO_VENTA = 0.5;

// Refined Evaluation Function with Non-linear Penalty
function evaluate(sequence) {
  let totalChangeover = 0;
  let totalLostSales = 0;
  let currentTime = 0;
  
  // Real-world calibration: diasStock (simulated)
  // Let's assume some items have 1-5 days of stock
  for (let i = 0; i < sequence.length; i++) {
    const item = sequence[i];
    const diasStock = (parseInt(item.sku_code) % 5) + 1; // Simulated stock
    
    if (i > 0) {
      const fromIdx = idMap.get(sequence[i-1].id_tabla_cambio_medida);
      const toIdx = idMap.get(item.id_tabla_cambio_medida);
      const tc = matrix[fromIdx][toIdx];
      totalChangeover += tc;
      currentTime += tc;
    }
    
    const delay = Math.max(0, currentTime - diasStock);
    // Non-linear penalty: delay squared to avoid extreme stockouts
    totalLostSales += (Math.pow(delay, 1.5) * (item.quantity / 1000)); 
    
    const prodTime = (item.quantity / item.ritmo_th);
    currentTime += prodTime;
  }
  
  const costTC = totalChangeover * COSTO_HORA_CAMBIO;
  const costVP = totalLostSales * COSTO_TN_PERDIDA;
  const totalCost = (PESO_VENTA * costVP) + ((1 - PESO_VENTA) * costTC);
  
  return { totalCost, totalChangeover, totalLostSales };
}

// --- OPTIMIZATION ALGORITHMS ---

// Neighborhood Structures for VNS
function swap(seq) {
    const n = seq.length;
    const a = Math.floor(Math.random() * n);
    const b = Math.floor(Math.random() * n);
    [seq[a], seq[b]] = [seq[b], seq[a]];
    return seq;
}

function insert(seq) {
    const n = seq.length;
    const a = Math.floor(Math.random() * n);
    const [item] = seq.splice(a, 1);
    const b = Math.floor(Math.random() * n);
    seq.splice(b, 0, item);
    return seq;
}

function reverse(seq) {
    const n = seq.length;
    const i = Math.floor(Math.random() * (n - 2));
    const j = Math.floor(Math.random() * (n - 1 - i)) + i + 2;
    const sub = seq.slice(i, j).reverse();
    seq.splice(i, sub.length, ...sub);
    return seq;
}

function batchMove(seq) {
    const targetId = seq[Math.floor(Math.random() * seq.length)].id_tabla_cambio_medida;
    const batch = [];
    const remaining = [];
    for (const it of seq) {
        if (it.id_tabla_cambio_medida === targetId) batch.push(it);
        else remaining.push(it);
    }
    if (batch.length > 0) {
        const insertPos = Math.floor(Math.random() * (remaining.length + 1));
        remaining.splice(insertPos, 0, ...batch);
        return remaining;
    }
    return seq;
}

// Variable Neighborhood Search (VNS)
function variableNeighborhoodSearch(items, iterations = 20000) {
    let currentSeq = [...items].sort(() => Math.random() - 0.5);
    let currentEval = evaluate(currentSeq);
    let best = { seq: [...currentSeq], ...currentEval };
    
    let kMax = 4; // 4 Neighborhoods
    
    for (let i = 0; i < iterations; i++) {
        let k = 1;
        while (k <= kMax) {
            // Shaking: Move to a different neighborhood
            let nextSeq = [...currentSeq];
            if (k === 1) nextSeq = swap(nextSeq);
            if (k === 2) nextSeq = insert(nextSeq);
            if (k === 3) nextSeq = reverse(nextSeq);
            if (k === 4) nextSeq = batchMove(nextSeq);
            
            // Local Search (Greedy on same neighborhood)
            const nextEval = evaluate(nextSeq);
            
            if (nextEval.totalCost < currentEval.totalCost) {
                currentSeq = nextSeq;
                currentEval = nextEval;
                if (currentEval.totalCost < best.totalCost) {
                    best = { seq: [...currentSeq], ...currentEval };
                }
                k = 1; // Reset to first neighborhood on improvement
            } else {
                k++; // Try next neighborhood
            }
        }
    }
    return best;
}

// Tabu Search implementation
function tabuSearch(items, iterations = 10000, tabuTenure = 10) {
    let currentSeq = [...items].sort(() => Math.random() - 0.5);
    let currentEval = evaluate(currentSeq);
    let best = { seq: [...currentSeq], ...currentEval };
    
    const tabuList = new Map(); // key: move identifier, value: expiry iteration
    
    for (let i = 0; i < iterations; i++) {
        let bestCandidate = null;
        let bestCandidateEval = null;
        let chosenMove = null;

        // Neighborhood sampling
        for (let j = 0; j < 50; j++) {
            const nextSeq = [...currentSeq];
            const a = Math.floor(Math.random() * nextSeq.length);
            const b = Math.floor(Math.random() * nextSeq.length);
            const moveKey = `${Math.min(a,b)}-${Math.max(a,b)}`;
            
            [nextSeq[a], nextSeq[b]] = [nextSeq[b], nextSeq[a]];
            const nextEval = evaluate(nextSeq);
            
            const isTabu = tabuList.has(moveKey) && tabuList.get(moveKey) > i;
            const satisfiesAspiration = nextEval.totalCost < best.totalCost;

            if (!isTabu || satisfiesAspiration) {
                if (!bestCandidateEval || nextEval.totalCost < bestCandidateEval.totalCost) {
                    bestCandidate = nextSeq;
                    bestCandidateEval = nextEval;
                    chosenMove = moveKey;
                }
            }
        }

        if (bestCandidate) {
            currentSeq = bestCandidate;
            currentEval = bestCandidateEval;
            tabuList.set(chosenMove, i + tabuTenure);
            
            if (currentEval.totalCost < best.totalCost) {
                best = { seq: [...currentSeq], ...currentEval };
            }
        }
    }
    return best;
}

// GRASP implementation
function graspOptimization(items, iterations = 100, rclAlpha = 0.2) {
    let best = null;

    for (let i = 0; i < iterations; i++) {
        // Step 1: Construction Phase (Greedy Randomized)
        let unvisited = [...items];
        let current = unvisited.splice(Math.floor(Math.random() * unvisited.length), 1)[0];
        let seq = [current];

        while (unvisited.length > 0) {
            // Calculate costs for all candidates
            const candidates = unvisited.map((it, idx) => ({
                idx,
                cost: matrix[idMap.get(current.id_tabla_cambio_medida)][idMap.get(it.id_tabla_cambio_medida)]
            })).sort((a,b) => a.cost - b.cost);

            // Create Restricted Candidate List (RCL)
            const minCost = candidates[0].cost;
            const maxCost = candidates[candidates.length - 1].cost;
            const threshold = minCost + rclAlpha * (maxCost - minCost);
            const rcl = candidates.filter(c => c.cost <= threshold);

            // Select random from RCL
            const chosen = rcl[Math.floor(Math.random() * rcl.length)];
            current = unvisited.splice(chosen.idx, 1)[0];
            seq.push(current);
        }

        // Step 2: Local Search Phase (using VNS logic for intensity)
        const refined = variableNeighborhoodSearch(seq, 500); // Small refinement
        
        if (!best || refined.totalCost < best.totalCost) {
            best = refined;
        }
    }
    return best;
}

// Late Acceptance Hill Climbing (LAHC)
function lahcOptimization(items, iterations = 20000, historyLength = 50) {
    let currentSeq = [...items].sort(() => Math.random() - 0.5);
    let currentEval = evaluate(currentSeq);
    let best = { seq: [...currentSeq], ...currentEval };
    
    const history = new Array(historyLength).fill(currentEval.totalCost);
    
    for (let i = 0; i < iterations; i++) {
        const nextSeq = [...currentSeq];
        const a = Math.floor(Math.random() * nextSeq.length);
        const b = Math.floor(Math.random() * nextSeq.length);
        [nextSeq[a], nextSeq[b]] = [nextSeq[b], nextSeq[a]];
        
        const nextEval = evaluate(nextSeq);
        const prevCost = history[i % historyLength];

        if (nextEval.totalCost <= currentEval.totalCost || nextEval.totalCost <= prevCost) {
            currentSeq = nextSeq;
            currentEval = nextEval;
            if (currentEval.totalCost < best.totalCost) {
                best = { seq: [...currentSeq], ...currentEval };
            }
        }
        history[i % historyLength] = currentEval.totalCost;
    }
    return best;
}

// Ruin and Recreate (R&R)
function ruinAndRecreate(items, iterations = 200, ruinSize = 4) {
    let currentSeq = [...items].sort(() => Math.random() - 0.5);
    let currentEval = evaluate(currentSeq);
    let best = { seq: [...currentSeq], ...currentEval };
    
    for (let i = 0; i < iterations; i++) {
        let tempSeq = [...currentSeq];
        
        // 1. Ruin Phase: Remove random sub-sequence
        const startPos = Math.floor(Math.random() * (tempSeq.length - ruinSize));
        const ruinedItems = tempSeq.splice(startPos, ruinSize);
        
        // 2. Recreate Phase: Re-insert greedily with some randomness
        while (ruinedItems.length > 0) {
            const it = ruinedItems.pop();
            let bestPos = -1;
            let minAddedCost = Infinity;
            
            // Sample positions to re-insert
            for (let p = 0; p <= tempSeq.length; p++) {
                const testSeq = [...tempSeq];
                testSeq.splice(p, 0, it);
                const testEval = evaluate(testSeq);
                const addedCost = testEval.totalCost;
                
                if (addedCost < minAddedCost) {
                    minAddedCost = addedCost;
                    bestPos = p;
                }
            }
            tempSeq.splice(bestPos, 0, it);
        }
        
        // Local Search Sweep
        const refined = variableNeighborhoodSearch(tempSeq, 100);
        
        if (refined.totalCost < currentEval.totalCost) {
            currentSeq = refined.seq;
            currentEval = refined;
            if (currentEval.totalCost < best.totalCost) {
                best = { seq: [...currentSeq], ...currentEval };
            }
        }
    }
    return best;
}

// Guided Local Search (GLS)
function guidedLocalSearch(items, iterations = 2000, lambda = 0.5) {
    let currentSeq = [...items].sort(() => Math.random() - 0.5);
    const n = items.length;
    const penalties = Array.from({ length: n }, () => new Float64Array(n).fill(0));
    
    function augmentedEvaluate(seq) {
        let base = evaluate(seq).totalCost;
        let penaltySum = 0;
        for (let i = 0; i < seq.length - 1; i++) {
            const u = items.indexOf(seq[i]);
            const v = items.indexOf(seq[i+1]);
            penaltySum += penalties[u][v];
        }
        return base + lambda * penaltySum;
    }

    let currentEval = augmentedEvaluate(currentSeq);
    let best = { seq: [...currentSeq], ...evaluate(currentSeq) };

    for (let i = 0; i < iterations; i++) {
        // Local Search Sweep with augmented objective
        let improved = true;
        while (improved) {
            improved = false;
            // Neighborhood sampling for speed
            for (let j = 0; j < 50; j++) {
                const testSeq = [...currentSeq];
                const a = Math.floor(Math.random() * n);
                const b = Math.floor(Math.random() * n);
                [testSeq[a], testSeq[b]] = [testSeq[b], testSeq[a]];
                
                const testEval = augmentedEvaluate(testSeq);
                if (testEval < currentEval) {
                    currentSeq = testSeq;
                    currentEval = testEval;
                    improved = true;
                }
            }
        }

        // Stuck in local optimum? Penalize current features
        const realEval = evaluate(currentSeq);
        if (realEval.totalCost < best.totalCost) {
            best = { seq: [...currentSeq], ...realEval };
        }

        // Find edge with max utility (cost / (1 + penalty))
        let maxUtility = -1;
        let edgesToPenalize = [];
        for (let j = 0; j < currentSeq.length - 1; j++) {
            const u = items.indexOf(currentSeq[j]);
            const v = items.indexOf(currentSeq[j+1]);
            const cost = matrix[idMap.get(currentSeq[j].id_tabla_cambio_medida)][idMap.get(currentSeq[j+1].id_tabla_cambio_medida)];
            const utility = cost / (1 + penalties[u][v]);
            if (utility > maxUtility) {
                maxUtility = utility;
                edgesToPenalize = [[u, v]];
            } else if (utility === maxUtility) {
                edgesToPenalize.push([u, v]);
            }
        }
        for (const [u, v] of edgesToPenalize) {
            penalties[u][v]++;
        }
    }
    return best;
}

// Or-Opt Relocation
function orOptOptimization(items, iterations = 200) {
    let currentSeq = [...items].sort(() => Math.random() - 0.5);
    let currentEval = evaluate(currentSeq);
    let best = { seq: [...currentSeq], ...currentEval };
    
    for (let i = 0; i < iterations; i++) {
        let improved = false;
        // Try to relocate segments of size 3, 2, 1
        for (let size = 3; size >= 1; size--) {
            for (let j = 0; j <= currentSeq.length - size; j++) {
                const segment = currentSeq.slice(j, j + size);
                const remaining = [...currentSeq];
                remaining.splice(j, size);
                
                for (let k = 0; k <= remaining.length; k++) {
                    const testSeq = [...remaining];
                    testSeq.splice(k, 0, ...segment);
                    const testEval = evaluate(testSeq);
                    
                    if (testEval.totalCost < currentEval.totalCost) {
                        currentSeq = testSeq;
                        currentEval = testEval;
                        improved = true;
                        if (currentEval.totalCost < best.totalCost) {
                            best = { seq: [...currentSeq], ...currentEval };
                        }
                    }
                }
            }
        }
        if (!improved) break; // Local optimum for Or-Opt
    }
    return best;
}

// Memetic Hybrid (Mini-Population + VNS)
function memeticHybrid(items, popSize = 5, generations = 20) {
    let population = Array.from({ length: popSize }, () => {
        const seq = [...items].sort(() => Math.random() - 0.5);
        return { seq, ...evaluate(seq) };
    });

    for (let g = 0; g < generations; g++) {
        // 1. Refinement (VNS)
        population = population.map(ind => variableNeighborhoodSearch(ind.seq, 200));

        // 2. Crossover (OX1 partial)
        for (let i = 0; i < popSize; i++) {
            const p1 = population[i].seq;
            const p2 = population[(i + 1) % popSize].seq;
            const cut = Math.floor(Math.random() * items.length);
            const childSeq = [...p1.slice(0, cut)];
            const seen = new Set(childSeq.map(it => it.sku_code));
            for (const it of p2) {
                if (!seen.has(it.sku_code)) childSeq.push(it);
            }
            if (childSeq.length === items.length) {
                population.push({ seq: childSeq, ...evaluate(childSeq) });
            }
        }
        
        // 3. Selection
        population.sort((a,b) => a.totalCost - b.totalCost);
        population = population.slice(0, popSize);
    }
    return population[0];
}

// 3-Opt (Simplified for 30 items)
function threeOptOptimization(items, iterations = 100) {
    let currentSeq = [...items].sort(() => Math.random() - 0.5);
    let currentEval = evaluate(currentSeq);
    let best = { seq: [...currentSeq], ...currentEval };
    
    for (let i = 0; i < iterations; i++) {
        const n = currentSeq.length;
        const [a, b, c] = [
            Math.floor(Math.random() * (n - 6)),
            0, 0
        ].map((v, i, arr) => {
            if (i === 0) return v;
            return arr[i-1] + 2 + Math.floor(Math.random() * 2);
        });

        const testSeq = [
            ...currentSeq.slice(0, a),
            ...currentSeq.slice(b, c),
            ...currentSeq.slice(a, b),
            ...currentSeq.slice(c)
        ];
        
        const testEval = evaluate(testSeq);
        if (testEval.totalCost < currentEval.totalCost) {
            currentSeq = testSeq;
            currentEval = testEval;
            if (currentEval.totalCost < best.totalCost) {
                best = { seq: [...currentSeq], ...currentEval };
            }
        }
    }
    return best;
}

// Adaptive VNS (AVNS)
function adaptiveVNS(items, iterations = 5000) {
    let currentSeq = [...items].sort(() => Math.random() - 0.5);
    let currentEval = evaluate(currentSeq);
    let best = { seq: [...currentSeq], ...currentEval };
    
    const weights = [1, 1, 1, 1]; // Weights for Swap, Insert, Reverse, BatchMove
    
    for (let i = 0; i < iterations; i++) {
        // Choose neighborhood based on weights (Roulette wheel simplified)
        let k = 0;
        const r = Math.random() * weights.reduce((a, b) => a + b);
        let sum = 0;
        for (let j = 0; j < weights.length; j++) {
            sum += weights[j];
            if (r <= sum) {
                k = j + 1;
                break;
            }
        }

        let nextSeq = [...currentSeq];
        if (k === 1) nextSeq = swap(nextSeq);
        if (k === 2) nextSeq = insert(nextSeq);
        if (k === 3) nextSeq = reverse(nextSeq);
        if (k === 4) nextSeq = batchMove(nextSeq);
        
        const nextEval = evaluate(nextSeq);
        if (nextEval.totalCost < currentEval.totalCost) {
            weights[k-1] += 0.1; // Reward neighborhood
            currentSeq = nextSeq;
            currentEval = nextEval;
            if (currentEval.totalCost < best.totalCost) {
                best = { seq: [...currentSeq], ...currentEval };
            }
        } else {
            weights[k-1] = Math.max(0.1, weights[k-1] - 0.01); // Penalty
        }
    }
    return best;
}

// HyperOptimizer (Iteration 13 - Final Ensemble)
// Combines GRASP (Diversity) + AVNS (Intelligence) + Or-Opt (Precision)
function hyperOptimizer(items, iterations = 5000) {
    // 1. Generate a high-quality initial seed using GRASP
    const seedResult = graspOptimization(items, 10, 0.2);
    let currentSeq = [...seedResult.seq];
    let currentEval = evaluate(currentSeq);
    let best = { seq: [...currentSeq], ...currentEval };
    
    // 2. Adaptive Neighborhood Weights (AVNS + Or-Opt components)
    const neighborhoods = [
        { name: "Swap", move: swap, weight: 1.0 },
        { name: "Insert", move: insert, weight: 1.0 },
        { name: "Reverse", move: reverse, weight: 1.5 }, // 2-opt is usually strong
        { name: "BatchMove", move: (s) => batchMove(s), weight: 1.2 },
        { name: "Or-Opt", move: (s) => orOptOptimization(s).seq, weight: 2.0 } // Or-Opt is very precise
    ];

    for (let i = 0; i < iterations; i++) {
        // Selection: Roulette wheel for adaptive strategy
        const totalWeight = neighborhoods.reduce((sum, n) => sum + n.weight, 0);
        let r = Math.random() * totalWeight;
        let neighborhood = neighborhoods[0];
        for (const n of neighborhoods) {
            r -= n.weight;
            if (r <= 0) {
                neighborhood = n;
                break;
            }
        }

        let nextSeq = [...currentSeq];
        // Apply chosen maneuver
        if (neighborhood.name === "Or-Opt") {
            // Or-Opt is an optimizer itself, we use its result if better
            const res = orOptOptimization(currentSeq);
            nextSeq = res.seq;
        } else {
            nextSeq = neighborhood.move([...currentSeq]);
        }
        
        const nextEval = evaluate(nextSeq);
        
        if (nextEval.totalCost < currentEval.totalCost) {
            // Success: Reward the strategy
            neighborhood.weight += 0.2;
            currentSeq = nextSeq;
            currentEval = nextEval;
            if (currentEval.totalCost < best.totalCost) {
                best = { seq: [...currentSeq], ...currentEval };
            }
        } else {
            // Failure: Slight penalty or decay
            neighborhood.weight = Math.max(0.1, neighborhood.weight - 0.02);
        }

        // Periodic Large Disturbance (Ruin & Recreate) to avoid global plateaus
        if (i % 1000 === 0 && i > 0) {
            const ruined = ruinAndRecreate(currentSeq, 5, 4);
            if (ruined.totalCost < currentEval.totalCost) {
                currentSeq = ruined.seq;
                currentEval = ruined;
            }
        }
    }
    
    // Final Polish with Or-Opt explicitly
    return orOptOptimization(best.seq);
}

// 1. Random Baseline
function randomOptimization(items, iterations = 1000) {
  let best = null;
  for (let i = 0; i < iterations; i++) {
    const seq = [...items].sort(() => Math.random() - 0.5);
    const result = evaluate(seq);
    if (!best || result.totalCost < best.totalCost) {
      best = { seq, ...result };
    }
  }
  return best;
}

// 2. Simulated Annealing (Iteration 1)
function simulatedAnnealing(items, iterations = 5000) {
  let currentSeq = [...items].sort(() => Math.random() - 0.5);
  let currentEval = evaluate(currentSeq);
  let best = { seq: [...currentSeq], ...currentEval };
  
  let temp = 1000;
  const coolingRate = 0.999;
  
  for (let i = 0; i < iterations; i++) {
    const nextSeq = [...currentSeq];
    
    // Move: Swap, Insertion, or Batch Move
    const moveType = Math.random();
    if (moveType < 0.3) {
      // Swap
      const a = Math.floor(Math.random() * nextSeq.length);
      const b = Math.floor(Math.random() * nextSeq.length);
      [nextSeq[a], nextSeq[b]] = [nextSeq[b], nextSeq[a]];
    } else if (moveType < 0.6) {
      // Insertion
      const a = Math.floor(Math.random() * nextSeq.length);
      const [item] = nextSeq.splice(a, 1);
      const b = Math.floor(Math.random() * nextSeq.length);
      nextSeq.splice(b, 0, item);
    } else {
      // Batch Move: Move all items of the same family together
      const targetId = items[Math.floor(Math.random() * items.length)].id_tabla_cambio_medida;
      const batch = [];
      const remaining = [];
      for (const it of nextSeq) {
        if (it.id_tabla_cambio_medida === targetId) batch.push(it);
        else remaining.push(it);
      }
      if (batch.length > 0) {
        const insertPos = Math.floor(Math.random() * (remaining.length + 1));
        remaining.splice(insertPos, 0, ...batch);
        nextSeq.length = 0;
        nextSeq.push(...remaining);
      }
    }
    
    const nextEval = evaluate(nextSeq);
    const delta = nextEval.totalCost - currentEval.totalCost;
    
    if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
      currentSeq = nextSeq;
      currentEval = nextEval;
      if (currentEval.totalCost < best.totalCost) {
        best = { seq: [...currentSeq], ...currentEval };
      }
    }
    
    temp *= coolingRate;
  }
  return best;
}

// 3. Simple Greedy (Nearest Neighbor + EDD heuristic)
function greedyOptimization(items) {
    let current = items[0];
    let remaining = items.slice(1);
    const seq = [current];
    
    while (remaining.length > 0) {
        let bestNextIdx = -1;
        let minCost = Infinity;
        
        for (let i = 0; i < remaining.length; i++) {
            const next = remaining[i];
            const tc = matrix[idMap.get(current.id_tabla_cambio_medida)][idMap.get(next.id_tabla_cambio_medida)];
            if (tc < minCost) {
                minCost = tc;
                bestNextIdx = i;
            }
        }
        
        current = remaining.splice(bestNextIdx, 1)[0];
        seq.push(current);
    }
    return { seq, ...evaluate(seq) };
}

// --- RUN BENCHMARK ---
console.log("--- Sequencer Benchmark Iteration 2 - Laminador 2 ---");
console.log(`Items: ${items.length}`);
console.log(`Rules: ${rules.length}`);
console.log("-----------------------------------------");

const startGreedy = performance.now();
const resGreedy = greedyOptimization([...items]);
console.log(`Greedy (Heuristic): Cost ${resGreedy.totalCost.toFixed(2)} | TC: ${resGreedy.totalChangeover}h | VP: ${resGreedy.totalLostSales.toFixed(2)} | Time: ${(performance.now() - startGreedy).toFixed(2)}ms`);

const startSA = performance.now();
const resSA = simulatedAnnealing([...items], 50000);
console.log(`SA (Iter 1 - 50k):  Cost ${resSA.totalCost.toFixed(2)} | TC: ${resSA.totalChangeover}h | VP: ${resSA.totalLostSales.toFixed(2)} | Time: ${(performance.now() - startSA).toFixed(2)}ms`);

const startVNS = performance.now();
const resVNS = variableNeighborhoodSearch([...items], 5000); // VNS converges faster usually
console.log(`VNS (Iter 2 - 5k):   Cost ${resVNS.totalCost.toFixed(2)} | TC: ${resVNS.totalChangeover}h | VP: ${resVNS.totalLostSales.toFixed(2)} | Time: ${(performance.now() - startVNS).toFixed(2)}ms`);

const startTabu = performance.now();
const resTabu = tabuSearch([...items], 10000);
console.log(`Tabu (Iter 4 - 10k):  Cost ${resTabu.totalCost.toFixed(2)} | TC: ${resTabu.totalChangeover}h | VP: ${resTabu.totalLostSales.toFixed(2)} | Time: ${(performance.now() - startTabu).toFixed(2)}ms`);

const startGRASP = performance.now();
const resGRASP = graspOptimization([...items], 100, 0.3); // Reduced iterations for speed
console.log(`GRASP (Iter 5 - 100): Cost ${resGRASP.totalCost.toFixed(2)} | TC: ${resGRASP.totalChangeover}h | VP: ${resGRASP.totalLostSales.toFixed(2)} | Time: ${(performance.now() - startGRASP).toFixed(2)}ms`);

const startLAHC = performance.now();
const resLAHC = lahcOptimization([...items], 50000, 100);
console.log(`LAHC (Iter 6 - 50k):  Cost ${resLAHC.totalCost.toFixed(2)} | TC: ${resLAHC.totalChangeover}h | VP: ${resLAHC.totalLostSales.toFixed(2)} | Time: ${(performance.now() - startLAHC).toFixed(2)}ms`);

const startRR = performance.now();
const resRR = ruinAndRecreate([...items], 100, 4);
console.log(`R&R (Iter 7 - 100):  Cost ${resRR.totalCost.toFixed(2)} | TC: ${resRR.totalChangeover}h | VP: ${resRR.totalLostSales.toFixed(2)} | Time: ${(performance.now() - startRR).toFixed(2)}ms`);

const startGLS = performance.now();
const resGLS = guidedLocalSearch([...items], 500);
console.log(`GLS (Iter 8 - 500):  Cost ${resGLS.totalCost.toFixed(2)} | TC: ${resGLS.totalChangeover}h | VP: ${resGLS.totalLostSales.toFixed(2)} | Time: ${(performance.now() - startGLS).toFixed(2)}ms`);

const startOrOpt = performance.now();
const resOrOpt = orOptOptimization([...items]);
console.log(`Or-Opt (Iter 9):     Cost ${resOrOpt.totalCost.toFixed(2)} | TC: ${resOrOpt.totalChangeover}h | VP: ${resOrOpt.totalLostSales.toFixed(2)} | Time: ${(performance.now() - startOrOpt).toFixed(2)}ms`);

const startMemetic = performance.now();
const resMemetic = memeticHybrid([...items]);
console.log(`Memetic (Iter 10):   Cost ${resMemetic.totalCost.toFixed(2)} | TC: ${resMemetic.totalChangeover}h | VP: ${resMemetic.totalLostSales.toFixed(2)} | Time: ${(performance.now() - startMemetic).toFixed(2)}ms`);

const start3Opt = performance.now();
const res3Opt = threeOptOptimization([...items]);
console.log(`3-Opt (Iter 11):     Cost ${res3Opt.totalCost.toFixed(2)} | TC: ${res3Opt.totalChangeover}h | VP: ${res3Opt.totalLostSales.toFixed(2)} | Time: ${(performance.now() - start3Opt).toFixed(2)}ms`);

const startAVNS = performance.now();
const resAVNS = adaptiveVNS([...items], 10000);
console.log(`AVNS (Iter 12 - 10k): Cost ${resAVNS.totalCost.toFixed(2)} | TC: ${resAVNS.totalChangeover}h | VP: ${resAVNS.totalLostSales.toFixed(2)} | Time: ${(performance.now() - startAVNS).toFixed(2)}ms`);

const startHyper = performance.now();
const resHyper = hyperOptimizer([...items], 5000);
console.log(`Hyper (Iter 13 - 5k):  Cost ${resHyper.totalCost.toFixed(2)} | TC: ${resHyper.totalChangeover}h | VP: ${resHyper.totalLostSales.toFixed(2)} | Time: ${(performance.now() - startHyper).toFixed(2)}ms`);

console.log("-----------------------------------------");
const improvementVNS = ((resGreedy.totalCost - resVNS.totalCost) / resGreedy.totalCost * 100);
const improvementHyper = ((resGreedy.totalCost - resHyper.totalCost) / resGreedy.totalCost * 100);
const jumpHyper = ((resVNS.totalCost - resHyper.totalCost) / resVNS.totalCost * 100);

console.log(`Improvement (VNS vs Greedy):     ${improvementVNS.toFixed(2)}%`);
console.log(`Improvement (Hyper vs Greedy):   ${improvementHyper.toFixed(2)}%`);
console.log(`Final Jump (Hyper vs Iter 2):    ${jumpHyper.toFixed(2)}%`);

if (jumpHyper >= 0) {
    console.log("Result: HyperOptimizer is the new undisputed King of the Sequencer.");
}
