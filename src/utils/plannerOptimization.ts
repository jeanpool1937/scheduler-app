/**
 * Planner Optimization Engine
 * Adapted from optimizationService.ts (HP Optimizer) for Antigravity integration.
 * Uses javascript-lp-solver loaded via CDN (window.solver).
 */

import type {
    MachineCost,
    PeriodCapacity,
    PlannerProductionResult,
    PlannerMonthlyResult,
    PlannerOptimizationResult,
    PlannerExcelData,
    OptimizationMode,
} from '../types/planner';
import type { MaestroCostosItem } from '../store/useCostosStore';

import solver from 'javascript-lp-solver';

// ─── Single Period LP Solver ────────────────────────────────────────────
const solveSinglePeriod = (
    periodName: string,
    demandMap: Map<string, { desc: string; qty: number }>,
    machineCosts: MachineCost[],
    periodCapacity: PeriodCapacity | undefined,
    costs: { [sku: string]: { [machine: string]: number } },
    times: { [sku: string]: { [machine: string]: number } },
    compat: { [sku: string]: { [machine: string]: number } },
    mode: OptimizationMode
): PlannerMonthlyResult => {
    if (!solver) throw new Error('Solver library not loaded. Check import.');

    const allSkus = Array.from(demandMap.keys());
    const model: any = {
        optimize: 'total_cost',
        opType: 'min',
        constraints: {} as any,
        variables: {} as any,
        ints: {} as any,
    };

    const currentPeriodCapacities: { [id: string]: { base: number; total: number } } = {};

    // 1. Capacity constraints
    machineCosts.forEach((m) => {
        const caps = periodCapacity?.machines[m.id];
        const baseCap = caps?.base || 0;
        const totalCap = caps?.total || 0;

        currentPeriodCapacities[m.id] = { base: baseCap, total: totalCap };

        const hardLimit = mode === 'base_only' ? baseCap : totalCap;
        model.constraints[`capacity_hard_${m.id}`] = { max: hardLimit };

        if (mode === 'smart' || mode === 'force_peak') {
            model.constraints[`capacity_soft_${m.id}`] = { max: baseCap };

            const overtimeVar: any = {
                total_cost: m.overtimeRate,
                [`capacity_soft_${m.id}`]: -1,
            };

            if (mode === 'smart') {
                const bigM = totalCap * 10;
                model.constraints[`peak_trigger_${m.id}`] = { max: 0 };
                overtimeVar[`peak_trigger_${m.id}`] = 1;

                model.variables[`is_peak_${m.id}`] = {
                    total_cost: m.peakPowerCost,
                    [`peak_trigger_${m.id}`]: -bigM,
                    [`is_binary_${m.id}`]: 1,
                };
                model.ints[`is_peak_${m.id}`] = 1;
                model.constraints[`is_binary_${m.id}`] = { max: 1 };
            }
            model.variables[`overtime_${m.id}`] = overtimeVar;
        }
    });

    // 2. Demand constraints
    allSkus.forEach((sku) => {
        const qty = demandMap.get(sku)?.qty || 0;
        if (qty > 0) {
            model.constraints[`demand_${sku}`] = { equal: qty };
        }
    });

    // 3. Production variables
    allSkus.forEach((sku) => {
        machineCosts.forEach((m) => {
            const explicitCompat = compat[sku]?.[m.id];
            const timeVal = times[sku]?.[m.id] || 0;
            const isCompatible = explicitCompat === 1 || (explicitCompat === undefined && timeVal > 0);

            if (isCompatible && timeVal > 0) {
                const unitCost = costs[sku]?.[m.id] || 0;
                const variableConfig: any = {
                    total_cost: unitCost,
                    [`demand_${sku}`]: 1,
                    [`capacity_hard_${m.id}`]: timeVal,
                };
                if (mode === 'smart' || mode === 'force_peak') {
                    variableConfig[`capacity_soft_${m.id}`] = timeVal;
                }
                model.variables[`${sku}:::${m.id}`] = variableConfig;
            }
        });

        // Slack variable (unmet demand)
        model.variables[`unmet_${sku}`] = {
            total_cost: 9999999999,
            [`demand_${sku}`]: 1,
        };
    });

    // 4. Solve
    const results = solver.Solve(model) as Record<string, number>;

    // 5. Parse results
    const allocations: PlannerProductionResult[] = [];
    const unmetDemandResult: { skuId: string; skuDesc: string; amount: number }[] = [];
    const machineUsage: { [id: string]: number } = {};
    machineCosts.forEach((m) => (machineUsage[m.id] = 0));

    let productionCost = 0;
    let overtimeCost = 0;
    let peakPowerCost = 0;

    Object.keys(results).forEach((key) => {
        const val = results[key];
        if (key === 'feasible' || key === 'result' || key === 'bounded' || val <= 0.001) return;

        if (key.startsWith('unmet_')) {
            const skuId = key.replace('unmet_', '');
            unmetDemandResult.push({
                skuId,
                skuDesc: demandMap.get(skuId)?.desc || '',
                amount: val,
            });
        } else if (key.includes(':::')) {
            const [skuId, machineId] = key.split(':::');
            const unitCost = costs[skuId]?.[machineId] || 0;
            const unitTime = times[skuId]?.[machineId] || 0;

            allocations.push({
                period: periodName,
                skuId,
                skuDesc: demandMap.get(skuId)?.desc || '',
                machineId,
                quantity: val,
                cost: val * unitCost,
                timeUsed: val * unitTime,
            });

            machineUsage[machineId] += val * unitTime;
            productionCost += val * unitCost;
        }
    });

    // Post-calculate overtime and peak power costs
    if (mode === 'smart' || mode === 'force_peak') {
        machineCosts.forEach((m) => {
            const baseCap = periodCapacity?.machines[m.id]?.base || 0;
            const usage = machineUsage[m.id];
            if (usage > baseCap + 0.01) {
                const extra = usage - baseCap;
                overtimeCost += extra * m.overtimeRate;
                peakPowerCost += m.peakPowerCost;
            }
        });
    }

    return {
        period: periodName,
        allocations,
        unmetDemand: unmetDemandResult,
        totalCost: productionCost + overtimeCost + peakPowerCost,
        machineUsage,
        capacities: currentPeriodCapacities,
        breakdown: { productionCost, overtimeCost, peakPowerCost },
    };
};

// ─── Multi-Period Scenario Runner ───────────────────────────────────────
const runMultiPeriodScenario = (
    scenarioName: string,
    periodData: { period: string; sku: string; qty: number }[],
    masterDemand: Map<string, string>,
    machineCosts: MachineCost[],
    schedule: PeriodCapacity[],
    costs: any,
    times: any,
    compat: any,
    mode: OptimizationMode
): PlannerOptimizationResult => {
    const distinctPeriods = Array.from(new Set(periodData.map((p) => p.period))).sort();
    const monthlyResults: PlannerMonthlyResult[] = [];

    distinctPeriods.forEach((p) => {
        const currentDemandMap = new Map<string, { desc: string; qty: number }>();
        periodData
            .filter((d) => d.period === p)
            .forEach((d) => {
                currentDemandMap.set(d.sku, {
                    desc: masterDemand.get(d.sku) || '',
                    qty: d.qty,
                });
            });

        if (currentDemandMap.size > 0) {
            const capData = schedule.find((s) => s.period === p);
            const result = solveSinglePeriod(p, currentDemandMap, machineCosts, capData, costs, times, compat, mode);
            monthlyResults.push(result);
        }
    });

    // Aggregate
    const allAllocations = monthlyResults.flatMap((m) => m.allocations);
    const allUnmet = monthlyResults.flatMap((m) => m.unmetDemand);

    const aggregatedUnmetMap = new Map<string, { skuId: string; skuDesc: string; amount: number }>();
    allUnmet.forEach((u) => {
        const existing = aggregatedUnmetMap.get(u.skuId);
        if (existing) {
            existing.amount += u.amount;
        } else {
            aggregatedUnmetMap.set(u.skuId, { ...u });
        }
    });

    const totalCost = monthlyResults.reduce((sum, m) => sum + m.totalCost, 0);
    const breakdown = monthlyResults.reduce(
        (acc, m) => ({
            productionCost: acc.productionCost + m.breakdown.productionCost,
            overtimeCost: acc.overtimeCost + m.breakdown.overtimeCost,
            peakPowerCost: acc.peakPowerCost + m.breakdown.peakPowerCost,
        }),
        { productionCost: 0, overtimeCost: 0, peakPowerCost: 0 }
    );

    const totalMachineUsage: Record<string, number> = {};
    const totalCapacity: Record<string, number> = {};
    const baseCapacity: Record<string, number> = {};

    machineCosts.forEach((m) => {
        totalMachineUsage[m.id] = monthlyResults.reduce((sum, res) => sum + (res.machineUsage[m.id] || 0), 0);
        let sumTotalCap = 0;
        let sumBaseCap = 0;
        monthlyResults.forEach((res) => {
            const pCap = schedule.find((s) => s.period === res.period);
            const caps = pCap?.machines[m.id];
            const mTotal = caps?.total || 0;
            const mBase = caps?.base || 0;
            const effectiveCap = mode === 'base_only' ? mBase : mTotal;
            sumTotalCap += effectiveCap;
            sumBaseCap += mBase;
        });
        totalCapacity[m.id] = sumTotalCap;
        baseCapacity[m.id] = sumBaseCap;
    });

    return {
        scenarioName,
        allocations: allAllocations,
        unmetDemand: Array.from(aggregatedUnmetMap.values()),
        totalCost,
        breakdown,
        machineUsage: totalMachineUsage,
        totalCapacity,
        baseCapacity,
        monthlyResults,
        rawInputs: { costs, times, compatibility: compat },
    };
};

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Normalize a raw period value to YYYY-MM format.
 */
const toPeriodStr = (rawPeriod: any): string => {
    if (!rawPeriod) return '';
    if (typeof rawPeriod === 'number') {
        // Excel serial date
        const date = new Date(Math.round((rawPeriod - 25569) * 86400 * 1000));
        return date.toISOString().slice(0, 7);
    }
    if (rawPeriod instanceof Date) {
        return rawPeriod.toISOString().slice(0, 7);
    }
    const s = String(rawPeriod).trim();
    // Handles YYYY-MM-DD, YYYY/MM/DD, YYYY-MM, YYYY/MM
    const match = s.match(/^(\d{4})[\-\/](\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 7);
    return s;
};

/**
 * Run the full optimization from parsed Excel-like data.
 * Returns 3 scenarios: Optimal (smart), Maximum Capacity (force_peak), Base Only.
 */
export const runPlannerOptimization = (
    data: PlannerExcelData,
    maestroCostos: MaestroCostosItem[],
    machineCosts: MachineCost[],
    schedule: PeriodCapacity[]
) => {
    console.log(`[PlannerOptimization] maestroCostos: ${maestroCostos.length} registros`);

    const cleanId = (s: any) => String(s ?? '').trim().toUpperCase();
    const getValue = (row: any, ...candidates: string[]) => {
        for (const c of candidates) {
            if (row[c] !== undefined) return row[c];
            const foundKey = Object.keys(row).find((k) => k.trim().toLowerCase() === c.toLowerCase());
            if (foundKey) return row[foundKey];
        }
        return undefined;
    };

    // 1. Master demand catalog
    const masterDemand = new Map<string, string>();
    if (data.Demanda && data.Demanda.length > 0) {
        data.Demanda.forEach((r: any) => {
            const sku = getValue(r, 'SKU', 'Codigo', 'Cod_Producto', 'Código_Producto', 'Material');
            const desc = getValue(r, 'Descripcion', 'Desc', 'Material', 'Texto_Breve', 'Descripción');
            if (sku) masterDemand.set(cleanId(sku), String(desc ?? ''));
        });
    }

    // 2. Period transactions
    const periodData: { period: string; sku: string; qty: number }[] = [];
    data.Periodos.forEach((r: any) => {
        const rawPeriod = getValue(r, 'Periodo', 'Fecha', 'Mes', 'Mes_Prod', 'Period');
        const sku = getValue(r, 'SKU', 'Codigo', 'Cod_Producto', 'Código_Producto', 'Material');
        const qty = getValue(r, 'Demanda', 'Cantidad', 'Qty', 'TN', 'Volumen', 'Tn_Total');

        if (rawPeriod && sku && qty !== undefined) {
            const periodStr = toPeriodStr(rawPeriod);
            const qtyNum = Number(qty);
            if (periodStr && !isNaN(qtyNum) && qtyNum > 0) {
                periodData.push({ period: periodStr, sku: cleanId(sku), qty: qtyNum });
            }
        }
    });

    const uniquePeriods = [...new Set(periodData.map(p => p.period))];
    console.log(`[PlannerOptimization] periodData: ${periodData.length} filas, ${uniquePeriods.length} periodos -> ${uniquePeriods.slice(0, 5).join(', ')}`);

    // 3. Cost, Time, and Compatibility matrices
    const costs: any = {};
    const times: any = {};
    const compat: any = {};

    // Helper to process legacy Excel matrices if needed
    const processMatrix = (rows: any[], target: any) => {
        if (!rows || !Array.isArray(rows)) return;
        rows.forEach((r: any) => {
            const skuVal = getValue(r, 'SKU', 'Codigo', 'Cod_Producto', 'Código_Producto', 'Material');
            if (!skuVal) return;
            const sku = cleanId(skuVal);
            if (!target[sku]) target[sku] = {};
            Object.keys(r).forEach((key) => {
                const cleanKey = cleanId(key).replace(/[\s\-]/g, '');
                const matchedMachine = machineCosts.find(
                    (m) => cleanId(m.id).replace(/[\s\-]/g, '') === cleanKey
                );
                if (matchedMachine) {
                    target[sku][matchedMachine.id] = Number(r[key]);
                }
            });
        });
    };

    if (maestroCostos && maestroCostos.length > 0) {
        maestroCostos.forEach((c) => {
            const sku = cleanId(c.codigo_sap);
            // Normalize machine name: 'LAM 1', 'LAM-1', 'LAM1' -> 'LAM1'
            const machine = cleanId(c.codigo_lam).replace(/[\s\-]/g, '');

            if (!costs[sku]) costs[sku] = {};
            if (!times[sku]) times[sku] = {};
            if (!compat[sku]) compat[sku] = {};

            // Force numeric conversion (Supabase returns numeric as JS number but guarantee it)
            const costo = Number(c.costo_total_lam_sin_cf) || 0;
            const ritmo = Number(c.ritmo_th) || 0;

            costs[sku][machine] = costo;
            times[sku][machine] = ritmo > 0 ? 1 / ritmo : 0;
            compat[sku][machine] = ritmo > 0 ? 1 : 0;

            // Enrich masterDemand with descriptions from Maestro Costos
            if (!masterDemand.has(sku) && c.descripcion) {
                masterDemand.set(sku, String(c.descripcion));
            }
        });

        const costSkuCount = Object.keys(costs).length;
        console.log(`[PlannerOptimization] Matrices construidas: ${costSkuCount} SKUs con costos`);

        // Log SKU matching quality
        const demandSkus = new Set(periodData.map(p => p.sku));
        const matchedCount = [...demandSkus].filter(s => costs[s] && Object.keys(costs[s]).length > 0).length;
        console.log(`[PlannerOptimization] SKUs demanda: ${demandSkus.size} | con costos en maestro: ${matchedCount}`);
        if (matchedCount === 0 && demandSkus.size > 0) {
            const sampleDemand = [...demandSkus].slice(0, 3);
            const sampleCost = Object.keys(costs).slice(0, 3);
            console.warn('[PlannerOptimization] ⚠️ CERO matches! Muestra demanda:', sampleDemand, '| Muestra costos:', sampleCost);
        }
    } else {
        console.warn('[PlannerOptimization] maestroCostos VACÍO → usando fallback Excel/muestra');
        // Fallback to data from Excel (or Sample Data)
        processMatrix(data.Costos || [], costs);
        processMatrix(data.Tiempos || [], times);
        processMatrix(data.Compatibilidad || [], compat);
    }

    const resultA = runMultiPeriodScenario('Escenario A (Óptimo)', periodData, masterDemand, machineCosts, schedule, costs, times, compat, 'smart');
    const resultB = runMultiPeriodScenario('Escenario B (Máxima Capacidad)', periodData, masterDemand, machineCosts, schedule, costs, times, compat, 'force_peak');
    const resultC = runMultiPeriodScenario('Escenario C (Solo Base)', periodData, masterDemand, machineCosts, schedule, costs, times, compat, 'base_only');

    console.log(`[PlannerOptimization] RESULTADO: totalCost=${resultA.totalCost}, allocations=${resultA.allocations.length}, unmet=${resultA.unmetDemand.length}`);

    return { resultA, resultB, resultC };
};

/**
 * Generate sample data for testing the planner without a real Excel file.
 * Uses REAL SAP codes from scheduler_maestro_costos that exist in the 3 laminators.
 */
export const getPlannerSampleData = (): PlannerExcelData => {
    // SKUs reales del Maestro de Costos con datos en LAM1, LAM2 y LAM3
    const skus = [
        { id: '300080', desc: 'REDONDO P/P A36 1 1/2" X 12.00M', annualQty: 60000 },
        { id: '300082', desc: 'REDONDO P/P SAE 1045 1 1/2" X 12.00M', annualQty: 38400 },
        { id: '300083', desc: 'REDONDO P/P A36 1 3/4" X 12.00M', annualQty: 28000 },
        { id: '300085', desc: 'REDONDO P/P SAE 1045 1 3/4" X 12.00M', annualQty: 18000 },
        { id: '400005', desc: 'BACO A615-GR60 3/8" X 9M', annualQty: 96000 },
        { id: '405254', desc: 'REDONDO LISO A36 12MM X 12M', annualQty: 54000 },
        { id: '408574', desc: 'BACO ASTM A615/A706-G60 3/8" X 9M', annualQty: 72000 },
    ];

    const periodos: any[] = [];
    const demanda: any[] = [];

    skus.forEach((s) => {
        demanda.push({ SKU: s.id, Descripcion: s.desc, Demanda: s.annualQty });
        for (let m = 1; m <= 12; m++) {
            const monthStr = m < 10 ? `0${m}` : `${m}`;
            const baseMonthly = s.annualQty / 12;
            const variation = 0.8 + Math.random() * 0.4;
            const qty = Math.round(baseMonthly * variation);
            periodos.push({ Periodo: `2026-${monthStr}-01`, SKU: s.id, Demanda: qty });
        }
    });

    return {
        Demanda: demanda,
        Periodos: periodos,
        // Las matrices de costos, tiempos y compatibilidad vienen del Maestro de Costos (Supabase)
        // No proveer datos hardcodeados para evitar conflictos con SKUs ficticios
        Tiempos: [],
        Compatibilidad: [],
        Costos: [],
    };
};
